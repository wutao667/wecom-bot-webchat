const { getDb } = require('../db');

function createMessage({ botId, direction, msgType, content, fromUser, toUser, msgId, wxMsgId, status }) {
  const db = getDb();

  // Dedup by wx_msg_id if present
  if (wxMsgId) {
    const existing = db.prepare('SELECT id FROM messages WHERE wx_msg_id = ?').get(wxMsgId);
    if (existing) {
      return db.prepare('SELECT * FROM messages WHERE id = ?').get(existing.id);
    }
  }

  const result = db.prepare(
    `INSERT INTO messages (bot_id, direction, msg_type, content, from_user, to_user, msg_id, wx_msg_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(botId, direction, msgType, content, fromUser, toUser, msgId || null, wxMsgId || null, status || 'sent');

  return db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
}

function getMessages(botId, { contact, page = 1, pageSize = 20 }) {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE bot_id = ?';
  const params = [botId];

  if (contact) {
    whereClause += ' AND (from_user = ? OR to_user = ?)';
    params.push(contact, contact);
  }

  const countResult = db.prepare(`SELECT COUNT(*) as total FROM messages ${whereClause}`).get(...params);
  const total = countResult.total;

  const items = db.prepare(
    `SELECT id, bot_id, direction, msg_type, content, from_user, to_user, msg_id, wx_msg_id, status, created_at
     FROM messages ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  return { total, page, page_size: pageSize, items };
}

function getContacts(botId, userId) {
  const db = getDb();

  // Verify the bot belongs to the user
  const bot = db.prepare('SELECT id FROM bots WHERE id = ? AND user_id = ?').get(botId, userId);
  if (!bot) return [];

  // Get distinct contacts from messages, with their last message.
  // NOTE: SQLite does not allow referencing a column alias in the same query's
  // GROUP BY or subquery WHERE, so we compute the contact_user in a subquery
  // and group on the original expression.
  const contacts = db.prepare(`
    SELECT
      contact_user,
      MAX(last_time) as last_time,
      (SELECT content FROM messages
       WHERE bot_id = ? AND (from_user = contact_user OR to_user = contact_user)
       ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM messages
       WHERE bot_id = ? AND direction = 'incoming' AND from_user = contact_user
       AND status = 'sent') as unread_count
    FROM (
      SELECT from_user AS contact_user, created_at AS last_time
      FROM messages WHERE bot_id = ? AND direction = 'incoming'
      UNION
      SELECT to_user AS contact_user, created_at AS last_time
      FROM messages WHERE bot_id = ? AND direction = 'outgoing' AND to_user != ''
    ) sub
    WHERE contact_user != '' AND contact_user IS NOT NULL
    GROUP BY contact_user
    ORDER BY last_time DESC
  `).all(botId, botId, botId, botId);

  return contacts.map(c => ({
    userid: c.contact_user,
    name: c.contact_user,
    last_message: c.last_message ? (c.last_message.length > 100 ? c.last_message.slice(0, 100) + '...' : c.last_message) : '',
    unread_count: c.unread_count || 0,
    last_time: c.last_time,
  }));
}

module.exports = { createMessage, getMessages, getContacts };
