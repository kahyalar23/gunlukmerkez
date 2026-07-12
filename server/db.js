const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Since @libsql/client doesn't have .exec, we can create a small helper for initialization
async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS rss_feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS youtube_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL UNIQUE,
      name TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      title TEXT NOT NULL
    );
  `);

  // Seed defaults
  await db.execute({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: ['theme', 'light'] });
  await db.execute({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: ['noImages', 'false'] });
  await db.execute({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: ['lang', 'tr'] });
  await db.execute({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: ['weatherCity', 'Istanbul'] });

  // Seed default RSS feed
  await db.execute({ sql: 'INSERT OR IGNORE INTO rss_feeds (url, title) VALUES (?, ?)', args: ['https://feeds.bbci.co.uk/turkce/rss.xml', 'BBC Türkçe'] });

  // Seed default bookmarks (only if table is empty)
  const bmCount = await db.execute('SELECT COUNT(*) as c FROM bookmarks');
  if (bmCount.rows[0].c === 0 || bmCount.rows[0].c === 0n) {
    await db.execute({ sql: 'INSERT INTO bookmarks (title, url) VALUES (?, ?)', args: ['GitHub', 'https://github.com'] });
    await db.execute({ sql: 'INSERT INTO bookmarks (title, url) VALUES (?, ?)', args: ['Reddit', 'https://reddit.com'] });
    await db.execute({ sql: 'INSERT INTO bookmarks (title, url) VALUES (?, ?)', args: ['Hacker News', 'https://news.ycombinator.com'] });
    await db.execute({ sql: 'INSERT INTO bookmarks (title, url) VALUES (?, ?)', args: ['Stack Overflow', 'https://stackoverflow.com'] });
    await db.execute({ sql: 'INSERT INTO bookmarks (title, url) VALUES (?, ?)', args: ['YouTube', 'https://youtube.com'] });
  }
}

// Wrap export and init
db.init = initDb;

module.exports = db;
