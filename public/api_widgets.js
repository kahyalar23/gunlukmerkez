/**
 * API_WIDGETS.JS
 * Contains 6 lightweight client-side API integrations.
 * Features strict try/catch error handling to prevent site crashes.
 */

// 1. IP-API (Location) & 2. Open-Meteo (Weather)
async function initLocationAndWeather() {
  const weatherEl = document.getElementById('mini-weather');
  let lat = 41.0082; // Default: Istanbul
  let lon = 28.9784;

  try {
    // Fetch Location based on IP
    const ipRes = await fetch('http://ip-api.com/json/');
    if (!ipRes.ok) throw new Error('IP-API failed');
    const ipData = await ipRes.json();
    
    if (ipData.status === 'success') {
      lat = ipData.lat;
      lon = ipData.lon;
    }
  } catch (err) {
    console.warn('[IP-API] Fallback used.', err);
  }

  try {
    // Fetch Weather using obtained or default coordinates
    const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    if (!wxRes.ok) throw new Error('Open-Meteo failed');
    const wxData = await wxRes.json();
    
    const temp = wxData.current_weather.temperature;
    weatherEl.textContent = `[M-WX] ${temp}°C`;
  } catch (err) {
    console.warn('[Open-Meteo] Fallback used.', err);
    weatherEl.textContent = `[M-WX] OFFLINE`;
  }

  // Init map with the coordinates
  initContactMap(lat, lon);
}

// 4. ExchangeRate-API (FX Ticker)
async function initFxTicker() {
  const tickerEl = document.getElementById('fx-marquee');
  try {
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), 4000);
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: c.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error('ER-API failed');
    const data = await res.json();
    
    const tryRate = data.rates.TRY;
    const eurRate = data.rates.EUR;
    const gbpRate = data.rates.GBP;
    
    const eurTry = tryRate / eurRate;
    const gbpTry = tryRate / gbpRate;

    tickerEl.textContent = `[FX TICKER] USD/TRY: ${tryRate.toFixed(2)} | EUR/TRY: ${eurTry.toFixed(2)} | GBP/TRY: ${gbpTry.toFixed(2)} | DATA: OPEN EXCHANGE RATES`;
  } catch (err) {
    console.warn('[FX Ticker] Fallback used.', err);
    tickerEl.textContent = `[FX TICKER] OFFLINE - YAYIN KESİLDİ`;
  }
}

// 4. Quotable (Quote of the Day) with Session Caching
async function initQuotable() {
  const quoteText = document.getElementById('quote-text');
  const quoteAuthor = document.getElementById('quote-author');
  if (!quoteText || !quoteAuthor) return;

  const isHome = window.location.pathname === '/';
  
  if (!isHome) {
    const cachedHTML = sessionStorage.getItem('dailyQuoteText');
    const cachedAuthor = sessionStorage.getItem('dailyQuoteAuthor');
    if (cachedHTML && cachedAuthor) {
      quoteText.textContent = cachedHTML;
      quoteAuthor.textContent = cachedAuthor;
      return;
    }
  }
  
  const fallbackQuotes = [
    { content: "Zorlukların tam ortasında fırsatlar yatar.", author: "Albert Einstein" },
    { content: "Bilgi, sadece paylaşıldığında değerlidir.", author: "Socrates" },
    { content: "Sistemler çöker, ama fikirler yaşar.", author: "Anonymous" }
  ];

  try {
    const res = await fetch('https://api.quotable.io/random?tags=technology|science|philosophy');
    if (!res.ok) throw new Error('Quotable API failed');
    const data = await res.json();
    
    const textStr = `"${data.content}"`;
    const authorStr = `- ${data.author}`;
    
    quoteText.textContent = textStr;
    quoteAuthor.textContent = authorStr;
    sessionStorage.setItem('dailyQuoteText', textStr);
    sessionStorage.setItem('dailyQuoteAuthor', authorStr);
  } catch (err) {
    console.warn('[Quotable] API failed, using fallback.', err);
    const randomQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    const textStr = `"${randomQuote.content}"`;
    const authorStr = `- ${randomQuote.author}`;
    quoteText.textContent = textStr;
    quoteAuthor.textContent = authorStr;
    sessionStorage.setItem('dailyQuoteText', textStr);
    sessionStorage.setItem('dailyQuoteAuthor', authorStr);
  }
}

// 5. Random Image (Picsum)
function initRandomImage() {
  const container = document.getElementById('random-image-container');
  const caption = document.getElementById('random-image-caption');
  
  if (!container) return;

  try {
    // Generate a random seed to avoid caching
    const seed = Math.floor(Math.random() * 1000);
    const imageUrl = `https://picsum.photos/seed/${seed}/400/200?grayscale`; // Added grayscale param as aesthetic choice
    
    // Test if image loads smoothly
    const img = new Image();
    img.onload = () => {
      container.style.backgroundImage = `url('${imageUrl}')`;
      caption.textContent = `IMAGE_ID: ${seed} [SYSTEM_OK]`;
    };
    img.onerror = () => {
      throw new Error('Image failed to load');
    };
    img.src = imageUrl;
    
  } catch (err) {
    console.warn('[ImageFeed] Fallback used.', err);
    caption.textContent = `[IMAGE_FEED_OFFLINE]`;
  }
}

// 6. Leaflet Map (Contact/Location)
function initContactMap(lat, lon) {
  const mapContainer = document.getElementById('contact-map');
  if (!mapContainer || typeof L === 'undefined') return;

  try {
    const map = L.map('contact-map').setView([lat, lon], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    L.marker([lat, lon]).addTo(map)
      .bindPopup('Bağlantı Noktası')
      .openPopup();
      
  } catch (err) {
    console.warn('[Leaflet] Fallback used.', err);
    mapContainer.innerHTML = '<div style="color:#f00; padding:10px;">[MAP_MODULE_OFFLINE]</div>';
  }
}

// 7. Wikipedia On This Day
async function initOnThisDay() {
  const historyEl = document.getElementById('history-marquee');
  if (!historyEl) return;
  
  try {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    // Use Wikipedia REST API
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}`);
    if (!res.ok) throw new Error('Wiki API failed');
    const data = await res.json();
    
    if (data && data.events && data.events.length > 0) {
      // Get a few random events or the first 3
      const events = data.events.slice(0, 3).map(e => `[${e.year}] ${e.text}`);
      historyEl.textContent = `[ON THIS DAY] ` + events.join(' *** ');
    } else {
      historyEl.textContent = '[ON THIS DAY] NO DATA';
    }
  } catch (err) {
    console.warn('[OnThisDay] API failed.', err);
    historyEl.textContent = `[HISTORY] OFFLINE`;
  }
}

// 8. Astro Data (Sunrise/Sunset)
async function initAstroData() {
  const astroEl = document.getElementById('astro-data');
  if (!astroEl) return;
  try {
    let lat = 41.0082, lon = 28.9784;
    try {
      const ipRes = await fetch('http://ip-api.com/json/');
      const ipData = await ipRes.json();
      if(ipData.status==='success') { lat = ipData.lat; lon = ipData.lon; }
    } catch(e) {}
    
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), 4000);
    const res = await fetch(`https://api.sunrisesunset.io/json?lat=${lat}&lng=${lon}`, { signal: c.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error('Astro API failed');
    const data = await res.json();
    const sunrise = data.results.sunrise;
    const sunset = data.results.sunset;
    
    astroEl.innerHTML = `
      <pre style="font-size:6px; color:#fa0; line-height:1; margin:0 auto 4px auto;">
   \\  |  / 
 '- /_\\ -' 
   /   \\  
      </pre>
      <div style="font-size:11px;">
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#fa0;">SUNRISE:</span> <span>${sunrise}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#f55;">SUNSET:</span> <span>${sunset}</span>
        </div>
      </div>
    `;
  } catch (err) {
    astroEl.innerHTML = '> ASTRO_DAT OFFLINE';
  }
}

// 9. World Clocks
function initWorldClocks() {
  const clockEl = document.getElementById('world-clocks');
  if (!clockEl) return;
  
  function updateClocks() {
    try {
      const now = new Date();
      const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
      const tokyo = now.toLocaleTimeString('en-US', { ...options, timeZone: 'Asia/Tokyo' });
      const london = now.toLocaleTimeString('en-US', { ...options, timeZone: 'Europe/London' });
      const newYork = now.toLocaleTimeString('en-US', { ...options, timeZone: 'America/New_York' });
      const istanbul = now.toLocaleTimeString('en-US', { ...options, timeZone: 'Europe/Istanbul' });
      
      clockEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #333; padding-bottom:2px; margin-bottom:2px;"><span>TYO:</span> <span style="color:#0ff;">${tokyo}</span></div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #333; padding-bottom:2px; margin-bottom:2px;"><span>LON:</span> <span style="color:#0ff;">${london}</span></div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #333; padding-bottom:2px; margin-bottom:2px;"><span>NYC:</span> <span style="color:#0ff;">${newYork}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>IST:</span> <span style="color:#0ff;">${istanbul}</span></div>
      `;
    } catch(err) {
      clockEl.innerHTML = '> DÜNYA SAATLERİ HATA: ' + err.message;
    }
  }
  updateClocks();
  setInterval(updateClocks, 1000);
}

// 10. USGS Earthquakes
async function initEarthquakes() {
  const listEl = document.getElementById('earthquakes-list');
  if (!listEl) return;
  try {
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), 4000);
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson', { signal: c.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error('USGS API failed');
    const data = await res.json();
    
    if (data && data.features && data.features.length > 0) {
      let html = '';
      data.features.slice(0, 8).forEach(eq => {
        const mag = eq.properties.mag.toFixed(1);
        const place = eq.properties.place.replace(' of ', ' - ').substring(0, 22);
        const color = mag >= 6.0 ? '#f00' : (mag >= 5.0 ? '#fa0' : '#0f0');
        html += `<div style="display:flex; justify-content:space-between; border-bottom:1px dashed #333; padding:2px 0;">
          <span style="color:${color};">[M${mag}]</span>
          <span style="flex:1; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-left:4px;" title="${eq.properties.place}">${place}</span>
        </div>`;
      });
      listEl.innerHTML = html;
    } else {
      listEl.innerHTML = '> NO SEISMIC ACTIVITY > 4.5';
    }
  } catch (err) {
    listEl.innerHTML = '> SEISMIC FEED OFFLINE';
  }
}

// 11. ISS Tracker
async function initISSTracker() {
  const dataEl = document.getElementById('iss-data');
  if (!dataEl) return;
  
  async function fetchISS() {
    try {
      const c = new AbortController();
      const id = setTimeout(() => c.abort(), 4000);
      const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544', { signal: c.signal });
      clearTimeout(id);
      if (!res.ok) throw new Error('ISS API failed');
      const data = await res.json();
      const lat = parseFloat(data.latitude).toFixed(4);
      const lon = parseFloat(data.longitude).toFixed(4);
      dataEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #333; padding-bottom:2px; margin-bottom:2px;"><span>LATITUDE:</span> <span style="color:#0ff;">${lat}</span></div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #333; padding-bottom:2px; margin-bottom:2px;"><span>LONGITUDE:</span> <span style="color:#0ff;">${lon}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>STATUS:</span> <span style="color:#0f0;">ORBITING</span></div>
      `;
    } catch (err) {
      // ignore, wait for next tick
    }
  }
  fetchISS();
  setInterval(fetchISS, 5000); // update every 5 seconds
}

// Initialize all widgets when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initLocationAndWeather();
  initFxTicker();
  initQuotable();
  initRandomImage();
  initOnThisDay();
  initAstroData();
  initWorldClocks();
  initEarthquakes();
  initISSTracker();
});
