const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const { getDb } = require('../db');
const msgService = require('../services/msgService');

// ---- Authenticated routes (require login) ----
router.use(authMiddleware);

// GET /api/bots/:id/tokens — List all tokens for a bot
router.get('/:id/tokens', (req, res, next) => {
  try {
    const botId = parseInt(req.params.id, 10);
    const db = getDb();

    // Verify bot belongs to user
    const bot = db.prepare('SELECT id FROM bots WHERE id = ? AND user_id = ?').get(botId, req.user.id);
    if (!bot) {
      throw Object.assign(new Error('Bot not found'), { status: 404 });
    }

    const tokens = db.prepare(
      'SELECT id, bot_id, contact_userid, token, name, created_at FROM api_tokens WHERE bot_id = ? ORDER BY created_at DESC'
    ).all(botId);

    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

// POST /api/bots/:id/tokens — Generate a new token
router.post('/:id/tokens', (req, res, next) => {
  try {
    const botId = parseInt(req.params.id, 10);
    const { contact_userid, name } = req.body;
    const db = getDb();

    if (!contact_userid) {
      throw Object.assign(new Error('contact_userid is required'), { status: 400 });
    }

    // Verify bot belongs to user
    const bot = db.prepare('SELECT id FROM bots WHERE id = ? AND user_id = ?').get(botId, req.user.id);
    if (!bot) {
      throw Object.assign(new Error('Bot not found'), { status: 404 });
    }

    const token = crypto.randomUUID();
    const result = db.prepare(
      'INSERT INTO api_tokens (bot_id, contact_userid, token, name) VALUES (?, ?, ?, ?)'
    ).run(botId, contact_userid, token, name || '');

    const created = db.prepare(
      'SELECT id, bot_id, contact_userid, token, name, created_at FROM api_tokens WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/bots/:id/tokens/:tokenId — Delete a token
router.delete('/:id/tokens/:tokenId', (req, res, next) => {
  try {
    const botId = parseInt(req.params.id, 10);
    const tokenId = parseInt(req.params.tokenId, 10);
    const db = getDb();

    // Verify bot belongs to user
    const bot = db.prepare('SELECT id FROM bots WHERE id = ? AND user_id = ?').get(botId, req.user.id);
    if (!bot) {
      throw Object.assign(new Error('Bot not found'), { status: 404 });
    }

    const token = db.prepare('SELECT id FROM api_tokens WHERE id = ? AND bot_id = ?').get(tokenId, botId);
    if (!token) {
      throw Object.assign(new Error('Token not found'), { status: 404 });
    }

    db.prepare('DELETE FROM api_tokens WHERE id = ?').run(tokenId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
