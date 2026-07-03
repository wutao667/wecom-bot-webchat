const socketAuth = require('./auth');

/**
 * Initialize socket.io server with authentication and event handlers.
 * @param {object} io - socket.io Server instance
 */
function initSocket(io) {
  // Authentication middleware
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`[socket] User ${socket.username} (${socket.userId}) connected`);

    // Join bot room — receive messages for a specific bot
    socket.on('join_bot', (botId) => {
      if (!botId) return;
      const room = `bot:${botId}`;
      socket.join(room);
      console.log(`[socket] User ${socket.username} joined room ${room}`);
    });

    // Leave bot room
    socket.on('leave_bot', (botId) => {
      if (!botId) return;
      const room = `bot:${botId}`;
      socket.leave(room);
      console.log(`[socket] User ${socket.username} left room ${room}`);
    });

    // Handle send_message from client (alternative to REST)
    socket.on('send_message', (data) => {
      const { botId, toUser, content, msgType } = data;
      if (!botId || !toUser || !content) return;

      try {
        const pool = io.app?.get('botPool');
        if (!pool) {
          socket.emit('message_error', { error: 'Bot connection pool not available' });
          return;
        }

        const msgBody = {
          msgtype: msgType || 'text',
          [(msgType || 'text')]: { content },
        };

        pool.sendMessage(botId, toUser, msgBody);

        // Save outgoing message
        const msgService = require('../services/msgService');
        const saved = msgService.createMessage({
          botId,
          direction: 'outgoing',
          msgType: msgType || 'text',
          content,
          fromUser: '',
          toUser,
          status: 'sent',
        });

        io.to(`bot:${botId}`).emit('new_message', saved);
      } catch (err) {
        socket.emit('message_error', { error: err.message });
      }
    });

    // Mark messages as read
    socket.on('mark_read', (data) => {
      const { botId, contact } = data;
      if (!botId || !contact) return;

      // Simple read receipt — future enhancement
      console.log(`[socket] Bot ${botId} messages from ${contact} marked as read by ${socket.username}`);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] User ${socket.username} (${socket.userId}) disconnected`);
    });
  });

  console.log('[socket] Socket.io initialized');
}

module.exports = initSocket;
