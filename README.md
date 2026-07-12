# Günlük Merkez

Hafif, hızlı ve kişisel bir günlük dashboard sitesi. Haber akışı, yapay zeka sohbet, YouTube kanal takibi ve günlük araçları tek bir sayfada toplar.

## Özellikler

- **Haber Akışı**: RSS/Atom feed'lerinden otomatik haber çekme ve önbellekleme
- **Günlük Araçlar**: Yapılacaklar listesi, hızlı notlar, hatırlatıcılar, hesap makinesi
- **Hava Durumu**: wttr.in API ile anlık hava durumu (API anahtarı gerektirmez)
- **Yapay Zeka Sohbet**: Google Gemini API ile metin + fotoğraf/belge destekli chatbot
- **YouTube Takip**: Kanal RSS'lerinden yeni video listesi, VLC ile açma desteği (.m3u)
- **Çift Dil**: Türkçe ve İngilizce arayüz desteği
- **Ultra Hafif**: < 150 KB sayfa ağırlığı, JavaScript kapalıyken de çalışır
- **Koyu/Açık Tema**: Kullanıcı tercihi ile tema değiştirme
- **Resimsiz Mod**: Düşük bant genişliği için görselleri gizleme

## Gereksinimler

- **Node.js** 18+ (20+ önerilir)
- **yt-dlp** (opsiyonel — YouTube videolarını VLC'de açmak için)

## Kurulum

```bash
# 1. Projeyi klonlayın veya indirin
cd gunluk-merkez

# 2. Bağımlılıkları yükleyin
npm install

# 3. Ortam değişkenlerini ayarlayın
cp .env.example .env
# .env dosyasını düzenleyin ve Gemini API anahtarınızı girin

# 4. Sunucuyu başlatın
npm start

# Geliştirme modu (otomatik yenileme)
npm run dev
```

Tarayıcınızda açın: http://localhost:3000

## Gemini API Anahtarı

1. [Google AI Studio](https://aistudio.google.com/apikey) adresine gidin
2. "Create API Key" butonuna tıklayın
3. Oluşturulan anahtarı `.env` dosyasındaki `GEMINI_API_KEY` değerine yapıştırın

## yt-dlp Kurulumu (Opsiyonel)

YouTube videolarını VLC/medya oynatıcıda açmak için yt-dlp gereklidir:

- **Windows**: `winget install yt-dlp` veya [GitHub Releases](https://github.com/yt-dlp/yt-dlp/releases) sayfasından indirin
- **macOS**: `brew install yt-dlp`
- **Linux**: `sudo apt install yt-dlp` veya `pip install yt-dlp`

yt-dlp kurulu değilse, .m3u dosyaları doğrudan YouTube linkini içerir (VLC genellikle bunu da oynatabilir).

## YouTube Kanal ID Bulma

1. YouTube'da kanalın ana sayfasına gidin
2. URL'deki `UC` ile başlayan kısmı kopyalayın
   - Örnek: `https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxxx`
3. Alternatif: Sayfa kaynağında "channelId" araması yapın

## Proje Yapısı

```
gunluk-merkez/
├── server/
│   ├── index.js          # Express uygulama giriş noktası
│   ├── db.js             # SQLite veritabanı modülü
│   ├── i18n.js           # Çoklu dil çevirileri (TR/EN)
│   ├── cache.js          # RSS, YouTube, hava durumu önbellek
│   └── routes/
│       ├── news.js       # Ana sayfa / haber akışı
│       ├── tools.js      # Yapılacaklar, notlar, hatırlatıcılar
│       ├── chat.js       # Gemini AI sohbet
│       ├── videos.js     # YouTube video listesi + VLC
│       └── settings.js   # Ayarlar yönetimi
├── views/
│   ├── partials/
│   │   ├── header.ejs    # Ortak sayfa başlığı
│   │   └── footer.ejs    # Ortak sayfa sonu
│   ├── index.ejs         # Ana sayfa şablonu
│   ├── chat.ejs          # Sohbet şablonu
│   ├── videos.ejs        # Video listesi şablonu
│   └── settings.ejs      # Ayarlar şablonu
├── public/
│   ├── style.css         # Minimal CSS (~5 KB)
│   └── script.js         # Vanilla JS (~8 KB)
├── data/                 # SQLite veritabanı (otomatik oluşturulur)
├── .env                  # API anahtarları (repoya eklenmez)
├── .env.example          # Ortam değişkenleri şablonu
├── package.json
└── README.md
```

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Backend | Node.js + Express |
| Şablon | EJS (sunucu tarafı render) |
| Veritabanı | SQLite (better-sqlite3) |
| AI | Google Gemini API (@google/genai) |
| RSS | rss-parser |
| Frontend | Vanilla HTML/CSS/JS |
| Font | Sistem fontları (sıfır indirme) |

## Lisans

MIT
