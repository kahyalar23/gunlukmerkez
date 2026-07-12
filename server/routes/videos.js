const express = require('express');
const router = express.Router();
const youtubedl = require('youtube-dl-exec');
const cache = require('../cache');
const { Readable } = require('stream');

// Optional fallback: @distube/ytdl-core (package.json'da zaten var)
let ytdlCore = null;
try { ytdlCore = require('@distube/ytdl-core'); } catch(e) { console.warn('ytdl-core not available, only yt-dlp will be used'); }

// Simple in-memory cache for direct googlevideo URLs (5dk)
const directUrlCache = new Map(); // videoId -> { url, expires }
function getCachedUrl(videoId) {
  const entry = directUrlCache.get(videoId);
  if (entry && entry.expires > Date.now()) return entry.url;
  directUrlCache.delete(videoId);
  return null;
}
function setCachedUrl(videoId, url) {
  directUrlCache.set(videoId, { url, expires: Date.now() + 5 * 60 * 1000 });
}

// Videos page
router.get('/videos', (req, res) => {
  const videos = cache.getVideos();
  const lastUpdated = cache.getLastUpdated();
  res.render('videos', {
    pageTitle: res.locals.t.videos.title,
    videos,
    lastUpdated
  });
});

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  return `${proto}://${host}`;
}

// ============================================================
// REVERSIBLE FIX - A Yöntemi
// Eski davranış: M3U içine https://youtube.com/watch?v=ID koyuyordu
//                VLC kendi youtube.lua ile parse etmeye çalışıyordu
//                Bu lua öldü -> get_video_info hatası
// Yeni davranış: M3U içine /api/videos/stream/ID koyuyoruz
//                YouTube'u sunucuda yt-dlp çözüyor, VLC düz mp4 oynatıyor
// GERİ ALMAK İÇİN: Aşağıdaki /play endpoint'ini silip /play-direct içindeki
//                  kodu /play'e kopyalaman yeterli. Veya videos.ejs'deki
//                  linki /api/videos/play-direct/ID olarak değiştir.
// ============================================================

// YENİ: VLC için proxy M3U (çalışan yöntem)
router.get('/api/videos/play/:videoId', (req, res) => {
  const videoId = req.params.videoId;
  if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
    return res.status(400).send('Invalid video ID');
  }
  const base = getBaseUrl(req);
  const streamUrl = `${base}/api/videos/stream/${videoId}`;
  const m3uContent = `#EXTM3U\n#EXTINF:-1,YouTube ${videoId}\n${streamUrl}\n`;
  res.setHeader('Content-Type', 'audio/x-mpegurl');
  res.setHeader('Content-Disposition', `attachment; filename="${videoId}.m3u"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(m3uContent);
});

// ESKİ: Direkt YouTube URL'li M3U (geri alınabilirlik için korundu)
// Bu endpoint'i kullanarak eski davranışa dönebilirsin
router.get('/api/videos/play-direct/:videoId', (req, res) => {
  const videoId = req.params.videoId;
  if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
    return res.status(400).send('Invalid video ID');
  }
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const m3uContent = `#EXTM3U\n#EXTINF:-1,Video\n${youtubeUrl}\n`;
  res.setHeader('Content-Type', 'audio/x-mpegurl');
  res.setHeader('Content-Disposition', `attachment; filename="${videoId}.m3u"`);
  res.send(m3uContent);
});

async function resolveDirectUrlViaYtDlp(youtubeUrl) {
  const vidMatch = youtubeUrl.match(/v=([a-zA-Z0-9_-]+)/);
  const vId = vidMatch ? vidMatch[1] : null;
  if (vId) {
    const cached = getCachedUrl(vId);
    if (cached) return cached;
  }

  const output = await youtubedl(youtubeUrl, {
    getUrl: true,
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    noWarnings: true,
    noPlaylist: true,
    addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36']
  });

  let streamUrl = null;
  if (typeof output === 'string') streamUrl = output.trim().split('\n')[0];
  else if (Array.isArray(output)) streamUrl = String(output[0]).trim();

  if (!streamUrl || !streamUrl.startsWith('http')) {
    throw new Error('yt-dlp could not extract URL');
  }
  if (vId) setCachedUrl(vId, streamUrl);
  return streamUrl;
}

async function resolveDirectUrlViaYtdlCore(videoId) {
  if (!ytdlCore) throw new Error('ytdl-core not installed');
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const info = await ytdlCore.getInfo(youtubeUrl);
  let format = ytdlCore.chooseFormat(info.formats, {
    quality: 'highest',
    filter: f => f.hasAudio && f.hasVideo && f.container === 'mp4'
  });
  if (!format || !format.url) {
    format = ytdlCore.chooseFormat(info.formats, { quality: 'highest' });
  }
  if (!format || !format.url) throw new Error('ytdl-core could not find format');
  return format.url;
}

// Proxy + Range destekli stream - VLC bu URL'yi düz HTTP dosya gibi görür
router.get('/api/videos/stream/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
    return res.status(400).send('Invalid video ID');
  }
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const wantRedirect = req.query.redirect === '1' || req.query.redirect === 'true';

  let streamUrl = null;
  let resolver = 'none';

  try {
    streamUrl = await resolveDirectUrlViaYtDlp(youtubeUrl);
    resolver = 'yt-dlp';
  } catch (err) {
    console.warn(`yt-dlp failed for ${videoId}: ${err.message}, trying ytdl-core fallback`);
    try {
      streamUrl = await resolveDirectUrlViaYtdlCore(videoId);
      resolver = 'ytdl-core';
    } catch (err2) {
      console.error(`Both resolvers failed for ${videoId}:`, err2.message);
      if (!res.headersSent) return res.status(500).send(`Stream çözülemedi: ${err.message} / ${err2.message}`);
      return;
    }
  }

  console.log(`Streaming ${videoId} via ${resolver}`);

  if (wantRedirect) {
    return res.redirect(302, streamUrl);
  }

  try {
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.youtube.com/'
    };
    if (req.headers.range) fetchHeaders['Range'] = req.headers.range;

    const fetchRes = await fetch(streamUrl, { headers: fetchHeaders });

    if (!fetchRes.ok && fetchRes.status !== 206) {
      throw new Error(`Upstream HTTP ${fetchRes.status}`);
    }

    res.status(fetchRes.status);
    const hopByHop = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','content-encoding']);
    fetchRes.headers.forEach((val, key) => {
      if (!hopByHop.has(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (fetchRes.body) {
      const nodeStream = Readable.fromWeb(fetchRes.body);
      nodeStream.pipe(res);
      req.on('close', () => { try { nodeStream.destroy(); } catch(e){} });
    } else {
      res.end();
    }
  } catch (err) {
    console.error('stream proxy error:', err.message);
    if (!res.headersSent) {
      try { return res.redirect(302, streamUrl); } catch(e){}
      res.status(500).send('Stream proxy hatası');
    }
  }
});

module.exports = router;
