const express = require('express');
const router = express.Router();
const os = require('os');
const db = require('../db');
const cache = require('../cache');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

// Homepage: news feed + daily tools data
router.get('/', async (req, res) => {
  const news = cache.getNews();
  const todos = (await db.execute('SELECT * FROM todos ORDER BY done ASC, created_at DESC')).rows;
  const notes = (await db.execute('SELECT * FROM notes ORDER BY created_at DESC')).rows;
  const reminders = (await db.execute('SELECT * FROM reminders ORDER BY date ASC')).rows;
  const bookmarks = (await db.execute('SELECT * FROM bookmarks ORDER BY created_at DESC')).rows;
  const weather = cache.getWeather();
  const lastUpdated = cache.getLastUpdated();
  
  // Recent videos (last 4) for mini preview on homepage
  const allVideos = cache.getVideos();
  const recentVideos = allVideos.slice(0, 4);

  // System info
  const uptime = process.uptime();
  const mem = process.memoryUsage();
  const sysInfo = {
    uptimeHours: Math.floor(uptime / 3600),
    uptimeMinutes: Math.floor((uptime % 3600) / 60),
    uptimeSeconds: Math.floor(uptime % 60),
    memoryUsedMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    nodeVersion: process.version,
    platform: os.platform() + ' ' + os.arch(),
    port: process.env.PORT || 3000
  };

  res.render('index', {
    pageTitle: '',
    news,
    todos,
    notes,
    reminders,
    bookmarks,
    weather,
    lastUpdated,
    recentVideos,
    sysInfo
  });
});

// API endpoint for system info (for live updates)
router.get('/api/sysinfo', (req, res) => {
  const uptime = process.uptime();
  const mem = process.memoryUsage();
  res.json({
    uptimeHours: Math.floor(uptime / 3600),
    uptimeMinutes: Math.floor((uptime % 3600) / 60),
    uptimeSeconds: Math.floor(uptime % 60),
    memoryUsedMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024)
  });
});

// API endpoint for reading articles
router.post('/api/read-article', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch article');
    
    const html = await response.text();
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();
    
    if (!article) throw new Error('Failed to parse article');
    
    res.json({ title: article.title, content: article.textContent, htmlContent: article.content });
  } catch (error) {
    console.error('Readability Error:', error.message);
    res.status(500).json({ error: 'Makale yüklenemedi.' });
  }
});

module.exports = router;
