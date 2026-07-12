const express = require('express');
const router = express.Router();
const youtubedl = require('youtube-dl-exec');
const cache = require('../cache');

const { Readable } = require('stream');

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

// Generate .m3u file for VLC playback
router.get('/api/videos/play/:videoId', (req, res) => {
  const videoId = req.params.videoId;

  if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
    return res.status(400).send('Invalid video ID');
  }

  // Use dynamic host for the stream URL
  const proxyUrl = `https://${req.get('host')}/api/videos/stream/${videoId}`;
  const m3uContent = `#EXTM3U\n#EXTINF:-1,Video\n${proxyUrl}\n`;
  
  res.setHeader('Content-Type', 'audio/x-mpegurl');
  res.setHeader('Content-Disposition', `attachment; filename="${videoId}.m3u"`);
  res.send(m3uContent);
});

// Proxy the video stream to bypass YouTube IP blocks and support HTTP Range requests for VLC
router.get('/api/videos/stream/:videoId', async (req, res) => {
  const videoId = req.params.videoId;

  if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
    return res.status(400).send('Invalid video ID');
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    // 1. Get the direct streaming URL
    const output = await youtubedl(youtubeUrl, {
      getUrl: true,
      format: 'best',
      noWarnings: true
    });
    
    const streamUrl = typeof output === 'string' ? output.trim() : null;
    if (!streamUrl || !streamUrl.startsWith('http')) {
      throw new Error('Could not extract direct stream URL');
    }

    // 2. Fetch from Google servers forwarding client's Range headers
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    };
    if (req.headers.range) fetchHeaders['Range'] = req.headers.range;

    const fetchRes = await fetch(streamUrl, { headers: fetchHeaders });
    
    // 3. Pipe the response back to VLC
    res.status(fetchRes.status);
    fetchRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    if (fetchRes.body) {
      // Use Web Streams -> Node Streams
      const stream = Readable.fromWeb(fetchRes.body);
      stream.pipe(res);
      req.on('close', () => { stream.destroy(); });
    } else {
      res.end();
    }
  } catch (err) {
    console.error('youtube-dl-exec stream error:', err.message);
    if (!res.headersSent) res.status(500).end();
  }
});

module.exports = router;
