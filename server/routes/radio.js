const express = require('express');
const router = express.Router();

const radios = [
  { id: 1, name: 'Power FM', frequency: '100.0', type: 'Yabancı Hit', stream: 'https://listen.powerapp.com.tr/powerfm/mpeg/icecast.audio' },
  { id: 2, name: 'Metro FM', frequency: '97.2', type: 'Yabancı Pop', stream: 'https://17733.live.streamtheworld.com/METRO_FM.mp3' },
  { id: 3, name: 'JoyTurk', frequency: '89.0', type: 'Türkçe Yavaş', stream: 'https://17733.live.streamtheworld.com/JOY_TURK.mp3' },
  { id: 4, name: 'Kral Pop', frequency: '94.7', type: 'Türkçe Pop', stream: 'https://kralpop.radyotvonline.net/kralpop/icerik/kralpop.m3u8' },
  { id: 5, name: 'TRT FM', frequency: '91.4', type: 'Karma', stream: 'https://trtdijital.radyotvonline.net/trtfm/playlist.m3u8' },
  { id: 6, name: 'BBC Radio 1', frequency: '-', type: 'UK Pop / Dance', stream: 'http://stream.live.vc.bbcmedia.co.uk/bbc_radio_one' },
  { id: 7, name: 'KEXP Seattle', frequency: '-', type: 'Indie / Alt', stream: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3' },
  { id: 8, name: 'SomaFM: Groove Salad', frequency: '-', type: 'Ambient / Chill', stream: 'http://ice1.somafm.com/groovesalad-128-mp3' },
  { id: 9, name: 'SomaFM: Secret Agent', frequency: '-', type: 'Downtempo / Spy', stream: 'http://ice1.somafm.com/secretagent-128-mp3' },
  { id: 10, name: 'SomaFM: DEFCON', frequency: '-', type: 'Cyber / Hacker', stream: 'http://ice1.somafm.com/defcon-128-mp3' },
  { id: 11, name: 'Ibiza Global Radio', frequency: '-', type: 'Electronic', stream: 'http://listenssl.ibizaglobalradio.com:8024/stream' },
  { id: 12, name: 'Classic FM UK', frequency: '-', type: 'Classical', stream: 'http://media-ice.musicradio.com/ClassicFMMP3' }
];

router.get('/radio', (req, res) => {
  res.render('radio', { pageTitle: 'Radyo', radios });
});

router.get('/api/radio/:id/m3u', (req, res) => {
  const radio = radios.find(r => r.id == req.params.id);
  if (!radio) return res.status(404).send('Not Found');

  const m3uContent = `#EXTM3U\n#EXTINF:-1,${radio.name}\n${radio.stream}`;
  
  res.setHeader('Content-disposition', `attachment; filename=${radio.name.replace(/\s+/g, '_')}.m3u`);
  res.setHeader('Content-type', 'audio/x-mpegurl');
  res.send(m3uContent);
});

module.exports = router;
