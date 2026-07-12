const RssParser = require('rss-parser');

const parser = new RssParser({
  customFields: {
    item: [
      ['media:group', 'mediaGroup'],
      ['media:thumbnail', 'mediaThumbnail'],
    ]
  }
});

// In-memory cache
let newsCache = [];
let videosCache = [];
let weatherCache = null;
const lastUpdated = { news: null, videos: null, weather: null };

// Strip HTML tags from a string
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

// Truncate string to maxLen
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

async function refreshNews(db) {
  try {
    const feeds = (await db.execute('SELECT * FROM rss_feeds')).rows;
    const allItems = [];

    for (const feed of feeds) {
      try {
        const parsed = await parser.parseURL(feed.url);
        const sourceName = feed.title || parsed.title || feed.url;
        for (const item of parsed.items) {
          allItems.push({
            title: item.title || 'Untitled',
            link: item.link || '#',
            pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
            snippet: truncate(stripHtml(item.contentSnippet || item.content || ''), 200),
            source: sourceName,
            image: item.enclosure?.url || null
          });
        }
      } catch (err) {
        console.error(`RSS fetch error for ${feed.url}:`, err.message);
      }
    }

    allItems.sort((a, b) => b.pubDate - a.pubDate);
    newsCache = allItems;
    lastUpdated.news = new Date();
    console.log(`News cache refreshed: ${allItems.length} items from ${feeds.length} feeds`);
  } catch (err) {
    console.error('News refresh error:', err.message);
  }
}

async function refreshVideos(db) {
  try {
    const channels = (await db.execute('SELECT * FROM youtube_channels')).rows;
    const allVideos = [];

    for (const channel of channels) {
      try {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channel_id}`;
        const parsed = await parser.parseURL(feedUrl);
        const channelName = channel.name || parsed.title || channel.channel_id;

        for (const item of parsed.items) {
          // Extract video ID from id field (format: yt:video:VIDEO_ID) or from link
          let videoId = '';
          if (item.id && item.id.includes('yt:video:')) {
            videoId = item.id.split('yt:video:')[1];
          } else if (item.link) {
            const match = item.link.match(/[?&]v=([^&]+)/);
            if (match) videoId = match[1];
          }

          if (videoId) {
            allVideos.push({
              videoId,
              title: item.title || 'Untitled',
              channelName,
              channelId: channel.channel_id,
              published: item.pubDate ? new Date(item.pubDate) : new Date(),
              thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
              link: `https://www.youtube.com/watch?v=${videoId}`
            });
          }
        }
      } catch (err) {
        console.error(`YouTube feed error for ${channel.channel_id}:`, err.message);
      }
    }

    allVideos.sort((a, b) => b.published - a.published);
    videosCache = allVideos;
    lastUpdated.videos = new Date();
    console.log(`Videos cache refreshed: ${allVideos.length} videos from ${channels.length} channels`);
  } catch (err) {
    console.error('Videos refresh error:', err.message);
  }
}

async function refreshWeather(city) {
  if (!city) return;
  try {
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'GunlukMerkez/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const current = data.current_condition[0];
    
    let forecast = [];
    if (data.weather && data.weather.length > 0) {
      forecast = data.weather.slice(0, 3).map(w => {
        let maxRain = 0;
        let peakRainHour = '00:00';
        let avgHumid = 0;
        
        if (w.hourly && w.hourly.length > 0) {
          w.hourly.forEach(h => {
            let rain = parseInt(h.chanceofrain) || 0;
            avgHumid += parseInt(h.humidity) || 0;
            if (rain > maxRain) {
              maxRain = rain;
              let timeStr = h.time.padStart(4, '0');
              peakRainHour = timeStr.substring(0, 2) + ':00';
            }
          });
          avgHumid = Math.round(avgHumid / w.hourly.length);
        }

        return {
          date: w.date,
          maxTemp: w.maxtempC,
          minTemp: w.mintempC,
          rainChance: maxRain,
          rainHour: peakRainHour,
          humidity: avgHumid
        };
      });
    }

    weatherCache = {
      city,
      temp: current.temp_C,
      feelsLike: current.FeelsLikeC,
      humidity: current.humidity,
      wind: current.windspeedKmph,
      description: current.lang_tr && current.lang_tr[0] ? current.lang_tr[0].value : (current.weatherDesc[0]?.value || ''),
      descriptionEn: current.weatherDesc[0]?.value || '',
      forecast: forecast
    };
    lastUpdated.weather = new Date();
    console.log(`Weather cache refreshed for ${city}: ${weatherCache.temp}°C`);
  } catch (err) {
    console.error('Weather refresh error:', err.message);
    weatherCache = null;
  }
}

async function startAutoRefresh(db) {
  let city = 'Istanbul';
  try {
    const rs = await db.execute("SELECT value FROM settings WHERE key = 'weatherCity'");
    if (rs.rows[0]) city = rs.rows[0].value;
  } catch (err) {
    console.warn('Could not read weatherCity from DB on startup', err);
  }

  // Initial fetch
  refreshNews(db).catch(() => {});
  refreshVideos(db).catch(() => {});
  refreshWeather(city).catch(() => {});

  // Periodic refresh
  setInterval(() => refreshNews(db).catch(() => {}), 15 * 60 * 1000);   // 15 min
  setInterval(() => refreshVideos(db).catch(() => {}), 30 * 60 * 1000);  // 30 min
  setInterval(async () => {
    let c = 'Istanbul';
    try {
      const rs = await db.execute("SELECT value FROM settings WHERE key = 'weatherCity'");
      if (rs.rows[0]) c = rs.rows[0].value;
    } catch(e) {}
    refreshWeather(c).catch(() => {});
  }, 30 * 60 * 1000); // 30 min
}

module.exports = {
  refreshNews,
  refreshVideos,
  refreshWeather,
  startAutoRefresh,
  getNews: () => newsCache,
  getVideos: () => videosCache,
  getWeather: () => weatherCache,
  getLastUpdated: () => ({ ...lastUpdated })
};
