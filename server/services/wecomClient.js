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

    // Auto-reconnect state
    this._reconnectTimer = null;
    this._reconnectAttempts = new Map(); // botId → { count, lastAttempt }
    this.MAX_RECONNECT_INTERVAL = 300000; // 5 min
    this.BASE_RECONNECT_INTERVAL = 10000; // 10 sec
    this.RECONNECT_CHECK_INTERVAL = 30000; // 30 sec
    this.CONNECT_TIMEOUT = 15000; // 15 sec
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
    this._startReconnectTimer();
    console.log(`[wecomClient] Initialization complete`);
  }

  /**
   * Connect a single bot using WSClient.
   * Returns a Promise that resolves when connected/authenticated,
   * or rejects on error/timeout/disconnected-before-connected.
   */
  async connectBot(bot) {
    // Clean up existing connection if any
    if (this.clients.has(bot.id)) {
      this.disconnectBot(bot.id);
    }

    const wsClient = new WSClient({ botId: bot.bot_id, secret: bot.secret });

    // ── Connection promise machinery ──
    // These are captured by the event handlers below. The Promise is
    // created after handlers are registered but before wsClient.connect(),
    // so connectResolve/connectReject are always assigned before any
    // async event can fire.
    let connectResolve, connectReject;
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.error(`[wecomClient] Bot ${bot.id} connection timed out after ${this.CONNECT_TIMEOUT}ms`);
      // Force-close the wsClient since we're giving up on this attempt
      try { wsClient.disconnect(); } catch (_) {}
      this.clients.delete(bot.id);
      connectReject(new Error('Connection timeout after ' + this.CONNECT_TIMEOUT + 'ms'));
    }, this.CONNECT_TIMEOUT);

    // Helper: settle the connection promise (resolve or reject).
    // Returns true if already settled (caller should skip).
    const settle = (fn, value) => {
      if (settled) return true;
      settled = true;
      clearTimeout(timeout);
      fn(value);
      return false;
    };

    // ── Lifecycle event handlers ──
    wsClient.on('connected', () => {
      console.log(`[wecomClient] Bot ${bot.id} connected`);
      botService.updateBotStatus(bot.id, 'connected', null);
      this._pushBotStatus(bot.id, 'connected');
      settle(connectResolve);
    });

    wsClient.on('authenticated', () => {
      console.log(`[wecomClient] Bot ${bot.id} authenticated`);
      botService.updateBotStatus(bot.id, 'connected', null);
      this._pushBotStatus(bot.id, 'connected');
      // Full authentication confirms a valid connection — reset backoff
      this._reconnectAttempts.delete(bot.id);
      settle(connectResolve);
    });

    wsClient.on('disconnected', (reason) => {
      console.log(`[wecomClient] Bot ${bot.id} disconnected: ${reason}`);
      botService.updateBotStatus(bot.id, 'disconnected');
      this._pushBotStatus(bot.id, 'disconnected');
      this.clients.delete(bot.id);

      // If the connect promise hasn't settled yet, reject it
      const wasSettled = settle(
        connectReject,
        new Error(`Disconnected before connected${reason ? ': ' + reason : ''}`)
      );

      // If the bot was already connected and this is an unexpected
      // disconnect, try to reconnect
      if (wasSettled) {
        this._tryReconnectBot(bot.id);
      }
    });

    wsClient.on('error', (error) => {
      const errMsg = typeof error === 'string' ? error : (error.message || 'Unknown error');
      console.error(`[wecomClient] Bot ${bot.id} error:`, errMsg);
      botService.updateBotStatus(bot.id, 'error', errMsg);
      this._pushBotStatus(bot.id, 'error');

      // If the connect promise hasn't settled yet, reject it
      settle(
        connectReject,
        error instanceof Error ? error : new Error(String(error))
      );
    });

    // ── Message event handlers ──
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

    // Create the promise BEFORE connect() so that even if connect()
    // emits events synchronously, connectResolve/connectReject are set.
    const connectPromise = new Promise((resolve, reject) => {
      connectResolve = resolve;
      connectReject = reject;
    });

    wsClient.connect();

    return connectPromise;
  }

  /**
   * Disconnect a bot and remove from pool.
   * Resets reconnect backoff for this bot so a subsequent manual
   * reconnect attempt starts fresh.
   */
  disconnectBot(botId) {
    const entry = this.clients.get(botId);
    if (!entry) return;

    // Mark as manual so we can distinguish deliberate disconnects
    // from unexpected ones (the disconnected handler checks this)
    entry._manualDisconnect = true;
    this._reconnectAttempts.delete(botId);

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
   * Start periodic reconnect check timer.
   */
  _startReconnectTimer() {
    if (this._reconnectTimer) clearInterval(this._reconnectTimer);
    this._reconnectTimer = setInterval(() => {
      this._reconnectAllMissing();
    }, this.RECONNECT_CHECK_INTERVAL);
    this._reconnectTimer.unref();
  }

  /**
   * Check all bots in the database; connect any that are
   * missing from the pool, respecting exponential backoff.
   */
  _reconnectAllMissing() {
    let bots;
    try {
      bots = botService.getAllBots();
    } catch (err) {
      console.error('[wecomClient] Error fetching bots for reconnect timer:', err.message);
      return;
    }

    for (const bot of bots) {
      if (this.clients.has(bot.id)) continue; // Already in pool

      if (!this._allowReconnect(bot.id)) continue; // Backoff guard

      this._doReconnect(bot);
    }
  }

  /**
   * Attempt immediate reconnection for a single bot.
   * Called from the disconnected event handler.
   * Respects exponential backoff.
   */
  _tryReconnectBot(botId) {
    if (this.clients.has(botId)) return; // Already connected

    if (!this._allowReconnect(botId)) return; // Backoff guard

    // Get latest bot info from DB
    let bot;
    try {
      const bots = botService.getAllBots();
      bot = bots.find(b => b.id === botId);
    } catch (err) {
      console.error('[wecomClient] Error fetching bot for reconnect:', err.message);
      return;
    }

    if (!bot) {
      this._reconnectAttempts.delete(botId);
      return; // Bot was deleted from DB
    }

    this._doReconnect(bot);
  }

  /**
   * Check exponential backoff for a bot.
   * Returns true if reconnection is allowed now.
   */
  _allowReconnect(botId) {
    const attempt = this._reconnectAttempts.get(botId);
    if (!attempt) return true; // No previous attempt

    const backoff = Math.min(
      this.BASE_RECONNECT_INTERVAL * Math.pow(2, attempt.count),
      this.MAX_RECONNECT_INTERVAL
    );
    const elapsed = Date.now() - attempt.lastAttempt;
    if (elapsed < backoff) {
      console.log(`[wecomClient] Skipping reconnect for bot ${botId} (backoff ${backoff}ms, elapsed ${elapsed}ms)`);
      return false;
    }
    return true;
  }

  /**
   * Execute a reconnect attempt for a bot.
   * Increments the attempt counter and calls connectBot.
   */
  _doReconnect(bot) {
    const attempt = this._reconnectAttempts.get(bot.id);
    this._reconnectAttempts.set(bot.id, {
      count: (attempt?.count || 0) + 1,
      lastAttempt: Date.now(),
    });

    this.connectBot(bot).then(() => {
      console.log(`[wecomClient] Reconnect succeeded for bot ${bot.id}`);
      // Backoff is reset on 'authenticated' event, not after 'connected'
    }).catch(err => {
      console.error(`[wecomClient] Reconnect failed for bot ${bot.id}:`, err.message);
    });
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
   * Cleanup all connections and timers.
   */
  async shutdown() {
    console.log('[wecomClient] Shutting down all bot connections...');

    // Stop reconnect timer
    if (this._reconnectTimer) {
      clearInterval(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    // Disconnect all bots
    for (const [botId] of this.clients) {
      this.disconnectBot(botId);
    }
    console.log('[wecomClient] All bot connections closed');
  }
}

module.exports = BotConnectionPool;
