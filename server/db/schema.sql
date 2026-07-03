PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL CHECK(length(username) >= 3),
    password_hash TEXT    NOT NULL,
    display_name  TEXT    DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    bot_id        TEXT    NOT NULL,
    secret        TEXT    NOT NULL,
    status        TEXT    DEFAULT 'disconnected' CHECK(status IN ('connected','disconnected','error')),
    last_error    TEXT    DEFAULT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);

CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id      INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    direction   TEXT    NOT NULL CHECK(direction IN ('outgoing','incoming')),
    msg_type    TEXT    NOT NULL CHECK(msg_type IN ('text','markdown','image','file','voice','video','mixed')),
    content     TEXT    NOT NULL,
    from_user   TEXT    NOT NULL,
    to_user     TEXT    NOT NULL DEFAULT '',
    msg_id      TEXT    DEFAULT NULL,
    wx_msg_id   TEXT    DEFAULT NULL,
    status      TEXT    DEFAULT 'sent' CHECK(status IN ('sending','sent','delivered','failed','read')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_bot_id  ON messages(bot_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(bot_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wx_msg_id ON messages(wx_msg_id) WHERE wx_msg_id IS NOT NULL;
