const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const msgService = require('../services/msgService');

// All routes require auth
router.use(authMiddleware);

// POST /api/bots/:id/send — Send a message
router.post('/:id/send', (req, res, next) => {
  try {
    const botId = parseInt(req.params.id, 10);
    const { to_user: toUser, msg_type: msgType, content } = req.body;

    if (!toUser || !content) {
      throw Object.assign(new Error('to_user and content are required'), { status: 400 });
    }

    const msgBody = {
      msgtype: msgType || 'text',
      [(msgType || 'text')]: { content },
    };

    // Send via WebSocket pool
    const pool = req.app.get('botPool');
    if (!pool) {
      throw Object.assign(new Error('Bot connection pool not available'), { status: 500 });
    }

    pool.sendMessage(botId, toUser, msgBody);

    // Save outgoing message to DB
    const saved = msgService.createMessage({
      botId,
      direction: 'outgoing',
      msgType: msgType || 'text',
      content,
      fromUser: '',
      toUser,
      status: 'sent',
    });

    // Emit via socket.io for real-time updates
    const io = req.app.io;
    if (io) {
      io.emit('new_message', saved);
      io.emit('contact_update', { botId });
    }

    res.json({ success: true, data: { message_id: saved.id, status: 'sent' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/bots/:id/messages — Get message history
router.get('/:id/messages', (req, res, next) => {
  try {
    const botId = parseInt(req.params.id, 10);
    const { contact, page = 1, page_size: pageSize = 20 } = req.query;

    const result = msgService.getMessages(botId, {
      contact,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
