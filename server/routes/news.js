const express = require('express');
const router = express.Router();
const os = require('os');
const db = require('../db');
const cache = require('../cache');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { marked } = require('marked');

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

  const dailyMovies = [
    { title: 'Stalker (1979)', director: 'Andrei Tarkovsky', desc: 'A guide leads two men through an area known as the Zone to find a room that grants wishes.' },
    { title: 'Blade Runner (1982)', director: 'Ridley Scott', desc: 'A blade runner must pursue and terminate four replicants who stole a ship in space.' },
    { title: '2001: A Space Odyssey (1968)', director: 'Stanley Kubrick', desc: 'After uncovering a mysterious artifact, a spacecraft is sent to Jupiter.' },
    { title: 'The Matrix (1999)', director: 'Lana & Lilly Wachowski', desc: 'A computer hacker learns from mysterious rebels about the true nature of his reality.' },
    { title: 'Ghost in the Shell (1995)', director: 'Mamoru Oshii', desc: 'A cyborg policewoman and her partner hunt a mysterious and powerful hacker.' },
    { title: 'Ex Machina (2014)', director: 'Alex Garland', desc: 'A young programmer is selected to participate in a ground-breaking experiment in synthetic intelligence.' },
    { title: 'Solaris (1972)', director: 'Andrei Tarkovsky', desc: 'A psychologist is sent to a station orbiting a distant planet in order to discover what has caused the crew to go insane.' },
    { title: 'Arrival (2016)', director: 'Denis Villeneuve', desc: 'A linguist works with the military to communicate with alien lifeforms after twelve mysterious spacecraft appear.' },
    { title: 'Her (2013)', director: 'Spike Jonze', desc: 'In a near future, a lonely writer develops an unlikely relationship with an operating system.' },
    { title: 'Children of Men (2006)', director: 'Alfonso Cuarón', desc: 'In 2027, in a chaotic world in which women have somehow become infertile, a former activist agrees to help transport a miraculously pregnant woman.' }
  ];

  const dailyAlbums = [
    { title: 'Unknown Pleasures', artist: 'Joy Division', desc: 'The debut studio album by English rock band Joy Division, released in 1979.' },
    { title: 'Dark Side of the Moon', artist: 'Pink Floyd', desc: 'The eighth studio album by the English rock band Pink Floyd, released in 1973.' },
    { title: 'Kid A', artist: 'Radiohead', desc: 'The fourth studio album by the English rock band Radiohead, released in 2000.' },
    { title: 'Mezzanine', artist: 'Massive Attack', desc: 'The third studio album by English electronic music group Massive Attack, released in 1998.' },
    { title: 'Discovery', artist: 'Daft Punk', desc: 'The second studio album by French electronic music duo Daft Punk, released in 2001.' },
    { title: 'Homogenic', artist: 'Björk', desc: 'The third studio album by Icelandic musician Björk, released in 1997.' },
    { title: 'Dummy', artist: 'Portishead', desc: 'The debut studio album by English electronic music band Portishead, released in 1994.' },
    { title: 'Selected Ambient Works 85-92', artist: 'Aphex Twin', desc: 'The debut studio album by Aphex Twin, a defining work of ambient techno.' },
    { title: 'Disintegration', artist: 'The Cure', desc: 'The eighth studio album by English rock band the Cure, released in 1989.' },
    { title: 'In Rainbows', artist: 'Radiohead', desc: 'The seventh studio album by the English rock band Radiohead, released in 2007.' }
  ];

  const dayIndex = Math.floor(Date.now() / 86400000);
  const dailyMovie = dailyMovies[dayIndex % dailyMovies.length];
  const dailyAlbum = dailyAlbums[dayIndex % dailyAlbums.length];

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
    sysInfo,
    dailyMovie,
    dailyAlbum
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.8,en-US;q=0.5,en;q=0.3'
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch article: ' + response.status);
    
    const html = await response.text();
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();
    
    if (!article) throw new Error('Failed to parse article');

    // Detect Cloudflare / Bot Challenges that return 200 OK
    const titleLower = article.title.toLowerCase();
    if (titleLower.includes('just a moment') || 
        titleLower.includes('attention required') || 
        titleLower.includes('cloudflare') ||
        titleLower.includes('client challenge') ||
        titleLower.includes('robot') ||
        titleLower.includes('security check')) {
        throw new Error('Bot challenge detected (Cloudflare etc.)');
    }
    
    res.json({ title: article.title, content: article.textContent, htmlContent: article.content });
  } catch (error) {
    console.error('Readability Error for', url, ':', error.message);
    console.log(`Using Jina AI fallback for ${url}`);
    
    try {
      const jinaHeaders = {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown'
      };
      if (process.env.JINA_API_KEY) {
        jinaHeaders['Authorization'] = 'Bearer ' + process.env.JINA_API_KEY;
      }
      
      const jinaResponse = await fetch('https://r.jina.ai/' + url, { headers: jinaHeaders });
      
      if (!jinaResponse.ok) throw new Error('Jina fetch failed');
      const jinaText = await jinaResponse.text();
      
      if (jinaText.includes('Title: Just a moment') || jinaText.includes('Attention Required!')) {
         throw new Error('Jina also blocked by Cloudflare');
      }

      let parsedTitle = 'Makale Okuyucu (AI)';
      const titleMatch = jinaText.match(/Title:\s*(.+)/);
      if (titleMatch) parsedTitle = titleMatch[1];
      
      const htmlContent = marked.parse(jinaText);
      res.json({ title: parsedTitle + ' 🤖', content: jinaText.substring(0, 300), htmlContent });
    } catch (jinaError) {
      console.error('Jina AI fallback failed:', jinaError.message);
      res.json({ 
        title: 'Erişim Koruması', 
        content: 'Bu site güvenlik nedeniyle otomatik okumayı engelledi.',
        htmlContent: `<div style="text-align:center; padding: 20px; border: 1px dashed #808080; margin-top: 10px;">
          <p style="margin-bottom:15px; font-family:'JetBrains Mono', monospace; font-size:12px;">🚫 Bu haber sitesi sistemleri (botları) engellediği için Jina AI bile metni buraya çekemedi.</p>
          <a href="${url}" target="_blank" class="btn-nav" style="text-decoration:none; padding: 4px 12px; display:inline-block;">👉 Orijinal Kaynağa Git</a>
        </div>` 
      });
    }
  }
});

module.exports = router;
