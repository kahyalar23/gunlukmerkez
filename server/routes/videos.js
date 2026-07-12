const express = require('express');
const router = express.Router();
const youtubedl = require('youtube-dl-exec');
const cache = require('../cache');

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

// Proxy the video stream to bypass YouTube IP blocks
router.get('/api/videos/stream/:videoId', (req, res) => {
  const videoId = req.params.videoId;

  if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
    return res.status(400).send('Invalid video ID');
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const subprocess = youtubedl.exec(youtubeUrl, {
      o: '-', // output to stdout
      f: 'best' // best quality
    });

    res.setHeader('Content-Type', 'video/mp4');
    
    // Pipe the stdout of yt-dlp directly to the response
    subprocess.stdout.pipe(res);

    // Handle process errors gracefully
    subprocess.on('error', (err) => {
      console.error('youtube-dl-exec process error:', err.message);
      if (!res.headersSent) res.status(500).end();
    });

    // If client closes connection early, kill the yt-dlp process
    req.on('close', () => {
      subprocess.kill('SIGKILL');
    });

  } catch (err) {
    console.error('youtube-dl-exec stream error:', err.message);
    if (!res.headersSent) res.status(500).end();
  }
});

module.exports = router;
