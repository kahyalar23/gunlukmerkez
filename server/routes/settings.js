const express = require('express');
const router = express.Router();
const db = require('../db');
const cache = require('../cache');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Settings page
router.get('/settings', async (req, res) => {
  const feeds = (await db.execute('SELECT * FROM rss_feeds ORDER BY id')).rows;
  const channels = (await db.execute('SELECT * FROM youtube_channels ORDER BY id')).rows;

  res.render('settings', {
    pageTitle: res.locals.t.settings.title,
    feeds,
    channels
  });
});

// --- RSS FEEDS ---

router.post('/settings/rss', async (req, res) => {
  const url = req.body.url?.trim();
  const title = escapeHtml(req.body.title?.trim() || '');
  if (url) {
    try {
      await db.execute({ sql: 'INSERT INTO rss_feeds (url, title) VALUES (?, ?)', args: [url, title] });
      cache.refreshNews(db).catch(() => {}); // Fire and forget
    } catch (err) {
      // Ignore duplicate errors
      console.warn('RSS add error:', err.message);
    }
  }
  res.redirect('/settings');
});

router.post('/settings/rss/:id/delete', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM rss_feeds WHERE id = ?', args: [req.params.id] });
  cache.refreshNews(db).catch(() => {});
  res.redirect('/settings');
});

// --- YOUTUBE CHANNELS ---

router.post('/settings/youtube', async (req, res) => {
  let channel_id = req.body.channel_id?.trim();
  const name = escapeHtml(req.body.name?.trim() || '');
  
  if (channel_id) {
    try {
      // Auto-parse URLs
      if (channel_id.startsWith('http') || channel_id.startsWith('www')) {
        if (!channel_id.startsWith('http')) channel_id = 'https://' + channel_id;
        
        // Try fetching the HTML to find channelId
        const resp = await fetch(channel_id);
        const html = await resp.text();
        
        // Find channel/UC... in the raw HTML which is very reliable
        const channelIdx = html.indexOf('channel/UC');
        if (channelIdx !== -1) {
          const idChunk = html.substring(channelIdx + 8, channelIdx + 32);
          const cleanId = idChunk.match(/(UC[\w-]+)/);
          if (cleanId) channel_id = cleanId[1];
        }

        if (!channel_id || !channel_id.startsWith('UC')) {
           // Fallback to meta tag
           const metaIdx = html.indexOf('itemprop="channelId" content="');
           if (metaIdx !== -1) {
             const idChunk = html.substring(metaIdx + 30, metaIdx + 54);
             const cleanId = idChunk.match(/(UC[\w-]+)/);
             if (cleanId) channel_id = cleanId[1];
           }
        }
        
        if (!channel_id || !channel_id.startsWith('UC')) {
          throw new Error('Kanal ID otomatik bulunamadı. Lütfen "UC..." formatında ID girin.');
        }
      }

      if (!channel_id.startsWith('UC')) throw new Error('Geçersiz YouTube ID');

      await db.execute({ sql: 'INSERT INTO youtube_channels (channel_id, name) VALUES (?, ?)', args: [channel_id, name] });
      await cache.refreshVideos(db); // Wait for the videos to sync instantly
    } catch (err) {
      console.warn('YouTube channel add error:', err.message);
    }
  }
  res.redirect(req.headers.referer || '/settings');
});

router.post('/settings/youtube/:id/delete', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM youtube_channels WHERE id = ?', args: [req.params.id] });
  cache.refreshVideos(db).catch(() => {});
  res.redirect('/settings');
});

// --- PREFERENCES ---

router.post('/settings/preferences', async (req, res) => {
  const sql = 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';

  await db.execute({ sql, args: ['theme', req.body.theme === 'dark' ? 'dark' : 'light'] });
  await db.execute({ sql, args: ['noImages', req.body.noImages ? 'true' : 'false'] });
  await db.execute({ sql, args: ['weatherCity', req.body.weatherCity?.trim() || 'Istanbul'] });

  // Refresh weather with new city
  const newCity = req.body.weatherCity?.trim() || 'Istanbul';
  cache.refreshWeather(newCity).catch(() => {});

  res.redirect('/settings');
});

router.post('/settings/theme', async (req, res) => {
  const sql = 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
  await db.execute({ sql, args: ['theme', req.body.theme === 'dark' ? 'dark' : 'light'] });
  
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    res.json({success: true});
  } else {
    res.redirect(req.headers.referer || '/');
  }
});

// --- LANGUAGE TOGGLE ---

router.post('/settings/language', async (req, res) => {
  const lang = req.body.lang === 'en' ? 'en' : 'tr';

  // Set cookie (1 year)
  res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });

  // Also update DB setting
  await db.execute({ sql: "INSERT INTO settings (key, value) VALUES ('lang', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [lang] });

  // Redirect back to referring page
  res.redirect(req.headers.referer || '/');
});

module.exports = router;
