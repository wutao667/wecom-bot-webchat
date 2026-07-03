const { getDb } = require('../db');

function listBots(userId) {
  const db = getDb();
  return db.prepare(
    'SELECT id, name, bot_id, status, last_error, created_at, updated_at FROM bots WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
}

function getBotById(botId, userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(botId, userId);
}

function createBot(userId, name, botId, secret) {
  const db = getDb();

  if (!name || !botId || !secret) {
    throw Object.assign(new Error('name, bot_id, and secret are required'), { status: 400 });
  }

  const result = db.prepare(
    'INSERT INTO bots (user_id, name, bot_id, secret) VALUES (?, ?, ?, ?)'
  ).run(userId, name, botId, secret);

  return db.prepare('SELECT * FROM bots WHERE id = ?').get(result.lastInsertRowid);
}

function updateBot(botId, userId, updates) {
  const db = getDb();
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(botId, userId);
  if (!bot) {
    throw Object.assign(new Error('Bot not found'), { status: 404 });
  }

  const name = updates.name || bot.name;
  const secret = updates.secret || bot.secret;

  db.prepare(
    'UPDATE bots SET name = ?, secret = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run(name, secret, botId);

  return db.prepare('SELECT id, name, bot_id, status, last_error, created_at, updated_at FROM bots WHERE id = ?').get(botId);
}

function deleteBot(botId, userId) {
  const db = getDb();
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(botId, userId);
  if (!bot) {
    throw Object.assign(new Error('Bot not found'), { status: 404 });
  }

  db.prepare('DELETE FROM bots WHERE id = ?').run(botId);
  return true;
}

function updateBotStatus(botId, status, lastError) {
  const db = getDb();
  const stmt = lastError !== undefined
    ? db.prepare('UPDATE bots SET status = ?, last_error = ?, updated_at = datetime(\'now\') WHERE id = ?')
    : db.prepare('UPDATE bots SET status = ?, updated_at = datetime(\'now\') WHERE id = ?');

  if (lastError !== undefined) {
    stmt.run(status, lastError, botId);
  } else {
    stmt.run(status, botId);
  }
}

function getAllBots() {
  const db = getDb();
  return db.prepare('SELECT * FROM bots').all();
}

module.exports = { listBots, getBotById, createBot, updateBot, deleteBot, updateBotStatus, getAllBots };
