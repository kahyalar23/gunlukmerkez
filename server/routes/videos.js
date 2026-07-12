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
router.get('/api/videos/play/:videoId', async (req, res) => {
  const videoId = req.params.videoId;

  // Validate videoId: only alphanumeric, hyphens, underscores
  if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
    return res.status(400).send('Invalid video ID');
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const output = await youtubedl(youtubeUrl, {
      getUrl: true,
      format: 'best',
      noWarnings: true
    });
    
    const streamUrl = output.trim();
    if (!streamUrl || !streamUrl.startsWith('http')) {
      throw new Error('Could not get stream URL');
    }

    const m3uContent = `#EXTM3U\n#EXTINF:-1,Video\n${streamUrl}\n`;
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}.m3u"`);
    res.send(m3uContent);
  } catch (err) {
    console.error('youtube-dl-exec failed, using direct YouTube URL fallback:', err.message);
    const m3uContent = `#EXTM3U\n#EXTINF:-1,Video\n${youtubeUrl}\n`;
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}.m3u"`);
    res.send(m3uContent);
  }
});

module.exports = router;
