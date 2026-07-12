const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
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

  // Validate videoId: only alphanumeric, hyphens, underscores
  if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
    return res.status(400).send('Invalid video ID');
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Try yt-dlp to get direct stream URL
  execFile('yt-dlp', ['-g', '-f', 'best', youtubeUrl], { timeout: 30000 }, (error, stdout) => {
    let m3uContent;

    if (error) {
      // Fallback: use YouTube URL directly (VLC can handle it with its own yt-dlp/youtube.lua)
      console.warn('yt-dlp not available or failed, using direct YouTube URL:', error.message);
      m3uContent = `#EXTM3U\n#EXTINF:-1,Video\n${youtubeUrl}\n`;
    } else {
      const streamUrl = stdout.trim().split('\n')[0]; // Take first URL if multiple
      m3uContent = `#EXTM3U\n#EXTINF:-1,Video\n${streamUrl}\n`;
    }

    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}.m3u"`);
    res.send(m3uContent);
  });
});

module.exports = router;
