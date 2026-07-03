const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const botService = require('../services/botService');

// All routes require auth
router.use(authMiddleware);

// GET /api/bots — List bots
router.get('/', (req, res, next) => {
  try {
    const bots = botService.listBots(req.user.id);
    res.json({ success: true, data: bots });
  } catch (err) {
    next(err);
  }
});

// POST /api/bots — Create bot
router.post('/', (req, res, next) => {
  try {
    const { name, bot_id: botId, secret } = req.body;
    const bot = botService.createBot(req.user.id, name, botId, secret);

    // Try to connect the bot via pool if available
    try {
      const pool = req.app.get('botPool');
      if (pool) {
        pool.connectBot(bot).catch(err => {
          console.error(`[routes/bots] Auto-connect failed for bot ${bot.id}:`, err.message);
        });
      }
    } catch (poolErr) {
      console.error('[routes/bots] Error triggering bot connect:', poolErr.message);
    }

    res.status(201).json({ success: true, data: bot });
  } catch (err) {
    next(err);
  }
});

// PUT /api/bots/:id — Update bot
router.put('/:id', (req, res, next) => {
  try {
    const botId = parseInt(req.params.id, 10);
    const bot = botService.updateBot(botId, req.user.id, req.body);

    // Reconnect if name or secret changed
    try {
      const pool = req.app.get('botPool');
      if (pool) {
        pool.disconnectBot(botId);
        const fullBot = botService.getBotById(botId, req.user.id);
        if (fullBot) {
          pool.connectBot(fullBot).catch(err => {
            console.error(`[routes/bots] Reconnect failed for bot ${botId}:`, err.message);
          });
        }
      }
    } catch (poolErr) {
      console.error('[routes/bots] Error reconnecting bot:', poolErr.message);
    }

    res.json({ success: true, data: bot });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/bots/:id — Delete bot
router.delete('/:id', (req, res, next) => {
  try {
    const botId = parseInt(req.params.id, 10);

    // Disconnect from pool first
    try {
      const pool = req.app.get('botPool');
      if (pool) {
        pool.disconnectBot(botId);
      }
    } catch (poolErr) {
      console.error('[routes/bots] Error disconnecting bot:', poolErr.message);
    }

    botService.deleteBot(botId, req.user.id);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
