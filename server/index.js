const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const config = require('./config');
const { getDb } = require('./db');
const errorHandler = require('./middleware/errorHandler');
const initSocket = require('./socket');
const BotConnectionPool = require('./services/wecomClient');
const msgService = require('./services/msgService');

// Routes
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bots');
const messageRoutes = require('./routes/messages');
const contactRoutes = require('./routes/contacts');
const tokenRoutes = require('./routes/tokens');

async function main() {
  // Initialize database
  console.log('[server] Initializing database...');
  getDb();
  console.log('[server] Database initialized');

  // Create Express app
  const app = express();
  const httpServer = http.createServer(app);

  // Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: config.frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Make io accessible from app
  app.io = io;
  io.app = app;

  // Middleware
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json());
  app.use(morgan('short'));

  // Public routes (no auth required — token-based auth)
  app.post('/api/message/:token', (req, res, next) => {
    try {
      const { token } = req.params;
      const { content, msg_type: msgType } = req.body;
      const db = getDb();

      if (!content) {
        return res.status(400).json({ success: false, error: 'content is required' });
      }

      // Look up the token
      const tokenRecord = db.prepare('SELECT * FROM api_tokens WHERE token = ?').get(token);
      if (!tokenRecord) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
      }

      const { bot_id: botId, contact_userid: toUser } = tokenRecord;

      // Get bot info to verify it exists
      const bot = db.prepare('SELECT id, bot_id, name FROM bots WHERE id = ?').get(botId);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }

      // Send message via bot pool
      const pool = req.app.get('botPool');
      if (!pool) {
        return res.status(500).json({ success: false, error: 'Bot connection pool not available' });
      }

      const actualMsgType = msgType || 'markdown';
      let msgBody;

      if (actualMsgType === 'text') {
        msgBody = { msgtype: 'text', text: { content } };
      } else {
        msgBody = { msgtype: 'markdown', markdown: { content } };
      }

      pool.sendMessage(botId, toUser, msgBody);

      // Save outgoing message to DB
      const saved = msgService.createMessage({
        botId,
        direction: 'outgoing',
        msgType: actualMsgType,
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

      res.json({ success: true, message: '消息已发送' });
    } catch (err) {
      next(err);
    }
  });

  // Mount API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/bots', botRoutes);
  app.use('/api/bots', messageRoutes);
  app.use('/api/bots', contactRoutes);
  app.use('/api/bots', tokenRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Error handler
  app.use(errorHandler);

  // Initialize socket.io
  initSocket(io);

  // Initialize bot connection pool
  const botPool = new BotConnectionPool(io);
  app.set('botPool', botPool);
  await botPool.initAll();

  // Start server
  httpServer.listen(config.port, config.host, () => {
    console.log(`[server] WeCom Bot WebChat running at http://${config.host}:${config.port}`);
    console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[server] Shutting down...');
    await botPool.shutdown();
    io.close();
    httpServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('[server] Fatal error:', err);
  process.exit(1);
});
