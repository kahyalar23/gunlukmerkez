const path = require('path');
const fs = require('fs');
const os = require('os');

function getSysInfo() {
  return {
    uptime: os.uptime(),
    memory: os.freemem(),
    port: process.env.PORT || 3000
  };
}

// Load environment variables FIRST
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const i18n = require('./i18n');
const cache = require('./cache');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Static files with caching
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

// Rate limiting for API routes
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: 'Too many requests' } });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many requests' } });
app.use('/api/', apiLimiter);
app.use('/api/chat', chatLimiter);

// Settings + i18n middleware (runs on every request)
app.use(async (req, res, next) => {
  try {
    // Read settings from DB
    const rs = await db.execute('SELECT key, value FROM settings');
    const settings = Object.fromEntries(rs.rows.map(r => [r.key, r.value]));

    // Determine language: cookie > DB setting > default
    const lang = req.cookies.lang || settings.lang || 'tr';

    // Set template locals
    res.locals.settings = settings;
    res.locals.lang = lang;
    res.locals.t = i18n[lang] || i18n.tr;
    res.locals.currentPath = req.path;
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/paint', (req, res) => {
  res.render('paint', {
    pageTitle: res.locals.t.programs.paint || 'Paint',
    sysInfo: getSysInfo()
  });
});

app.post('/api/paint-canvas', express.json({limit: '50mb'}), async (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl) return res.status(400).json({error: 'Data required'});
  await db.execute({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES ('paint_canvas', ?)", args: [dataUrl] });
  res.json({success: true});
});

app.get('/api/paint-canvas', async (req, res) => {
  const rs = await db.execute("SELECT value FROM settings WHERE key = 'paint_canvas'");
  const row = rs.rows[0];
  res.json({ dataUrl: row ? row.value : null });
});

app.get('/api/calendar', async (req, res) => {
  const events = (await db.execute("SELECT * FROM calendar_events")).rows;
  res.json(events);
});

app.post('/api/calendar', express.json(), async (req, res) => {
  const { date, title } = req.body;
  if (!date || !title) return res.status(400).json({error: 'Missing fields'});
  await db.execute({ sql: "INSERT INTO calendar_events (date, title) VALUES (?, ?)", args: [date, title] });
  res.json({success: true});
});

app.post('/api/calendar/:id/delete', async (req, res) => {
  const { id } = req.params;
  await db.execute({ sql: "DELETE FROM calendar_events WHERE id = ?", args: [id] });
  res.json({success: true});
});

app.get('/api/status', (req, res) => {
  res.json(getSysInfo());
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Mount routes
app.use('/', require('./routes/news'));
app.use('/', require('./routes/tools'));
app.use('/', require('./routes/chat'));
app.use('/', require('./routes/videos'));
app.use('/', require('./routes/settings'));
app.use('/', require('./routes/ai_tools'));
app.use('/', require('./routes/radio'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Sunucu hatası / Server error');
});

// Init DB and start server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await db.init(); // Our new init wrapper for Turso
    console.log('Database initialized.');
    
    // Start cache auto-refresh
    cache.startAutoRefresh(db);
    
    app.listen(PORT, () => {
      console.log(`\nGünlük Merkez çalışıyor / running on http://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

start();
