const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const config = require('../config');

const SALT_ROUNDS = 10;

async function register(username, password) {
  const db = getDb();

  if (!username || username.length < 3) {
    throw Object.assign(new Error('Username must be at least 3 characters'), { status: 400 });
  }
  if (!password || password.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    throw Object.assign(new Error('Username already exists'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).run(username, passwordHash);

  const user = db.prepare('SELECT id, username, display_name, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  return user;
}

async function login(username, password) {
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    throw Object.assign(new Error('Invalid username or password'), { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid username or password'), { status: 401 });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name },
  };
}

function getUserById(userId) {
  const db = getDb();
  return db.prepare('SELECT id, username, display_name, created_at FROM users WHERE id = ?').get(userId);
}

module.exports = { register, login, getUserById };
