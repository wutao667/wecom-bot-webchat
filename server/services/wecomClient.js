const { WSClient } = require('@wecom/aibot-node-sdk');
const botService = require('./botService');
const msgService = require('./msgService');

class BotConnectionPool {
  /**
   * @param {object} io - socket.io server instance
   */
  constructor(io) {
    this.clients = new Map(); // botId (DB id) → { wsClient, botInfo }
    this.io = io;
  }

  /**
   * Initialize all bots from the database on startup.
   */
  async initAll() {
    const bots = botService.getAllBots();
    console.log(`[wecomClient] Initializing ${bots.length} bot(s)...`);
    for (const bot of bots) {
      await this.connectBot(bot).catch(err => {
        console.error(`[wecomClient] Failed to connect bot ${bot.id}:`, err.message);
      });
    }
    console.log(`[wecomClient] Initialization complete`);
  }

  /**
   * Connect a single bot using WSClient.
   */
  async connectBot(bot) {
    const wsClient = new WSClient({ botId: bot.bot_id, secret: bot.secret });

    wsClient.on('connected', () => {
      console.log(`[wecomClient] Bot ${bot.id} connected`);
      botService.updateBotStatus(bot.id, 'connected');
      this._pushBotStatus(bot.id, 'connected');
    });

    wsClient.on('authenticated', () => {
      console.log(`[wecomClient] Bot ${bot.id} authenticated`);
      botService.updateBotStatus(bot.id, 'connected');
      this._pushBotStatus(bot.id, 'connected');
    });

    wsClient.on('disconnected', (reason) => {
      console.log(`[wecomClient] Bot ${bot.id} disconnected: ${reason}`);
      botService.updateBotStatus(bot.id, 'disconnected');
      this._pushBotStatus(bot.id, 'disconnected');
    });

    wsClient.on('error', (error) => {
      console.error(`[wecomClient] Bot ${bot.id} error:`, error.message || error);
      const errMsg = typeof error === 'string' ? error : (error.message || 'Unknown error');
      botService.updateBotStatus(bot.id, 'error', errMsg);
      this._pushBotStatus(bot.id, 'error');
    });

    // Message event handlers
    wsClient.on('message.text', (frame) => {
      this._handleMessage(bot.id, 'text', frame);
    });

    wsClient.on('message.image', (frame) => {
      this._handleMessage(bot.id, 'image', frame);
    });

    wsClient.on('event.enter_chat', (frame) => {
      console.log(`[wecomClient] Bot ${bot.id} - user ${frame.body?.from?.userid || 'unknown'} entered chat`);
    });

    this.clients.set(bot.id, { wsClient, botInfo: bot });
    wsClient.connect();
  }

  /**
   * Disconnect a bot and remove from pool.
   */
  disconnectBot(botId) {
    const entry = this.clients.get(botId);
    if (!entry) return;

    try {
      entry.wsClient.disconnect();
    } catch (err) {
      console.error(`[wecomClient] Error disconnecting bot ${botId}:`, err.message);
    }
    this.clients.delete(botId);
    botService.updateBotStatus(botId, 'disconnected');
    this._pushBotStatus(botId, 'disconnected');
  }

  /**
   * Send a message through a bot.
   */
  sendMessage(botId, chatid, body) {
    const entry = this.clients.get(botId);
    if (!entry) {
      throw Object.assign(new Error('Bot not connected'), { status: 400 });
    }
    return entry.wsClient.sendMessage(chatid, body);
  }

  /**
   * Handle an incoming message from WeCom.
   */
  _handleMessage(botId, msgType, frame) {
    const body = frame.body;
    if (!body) return;

    const fromUser = body.from?.userid || body.sender?.userid || 'unknown';
    const content = body.text?.content || body.content || '';
    const wxMsgId = body?.msgid || body?.message_id || null;

    // Determine actual msg_type from SDK frame if available
    const actualMsgType = body.msgtype || msgType;

    // Save incoming message to DB
    const saved = msgService.createMessage({
      botId,
      direction: 'incoming',
      msgType: actualMsgType,
      content: content || JSON.stringify(body),
      fromUser,
      toUser: '',
      wxMsgId,
      status: 'sent',
    });

    // Push to all connected clients
    if (this.io) {
      this.io.emit('new_message', saved);
      this.io.emit('contact_update', { botId });
    }

    console.log(`[wecomClient] Bot ${botId} received msg from ${fromUser}: ${content.slice(0, 50)}`);
  }

  /**
   * Push bot connection status via socket.io.
   */
  _pushBotStatus(botId, status) {
    if (!this.io) return;
    this.io.emit('bot_status', { botId, status });
  }

  /**
   * Get pool status for a bot.
   */
  getStatus(botId) {
    return this.clients.has(botId) ? 'connected' : 'disconnected';
  }

  /**
   * Cleanup all connections.
   */
  async shutdown() {
    console.log('[wecomClient] Shutting down all bot connections...');
    for (const [botId] of this.clients) {
      this.disconnectBot(botId);
    }
    console.log('[wecomClient] All bot connections closed');
  }
}

module.exports = BotConnectionPool;
