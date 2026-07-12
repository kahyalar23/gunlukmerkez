const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const pdfParse = require('pdf-parse');

const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  }
});

// Lazy-init Deepseek (NVIDIA NIM) for text tools
let openaiAi = null;
function getDeepseekAI() {
  if (!openaiAi && process.env.DEEPSEEK_API_KEY) {
    const { OpenAI } = require('openai');
    openaiAi = new OpenAI({ 
      apiKey: process.env.DEEPSEEK_API_KEY, 
      baseURL: 'https://integrate.api.nvidia.com/v1' 
    });
  }
  return openaiAi;
}

// ----------------------------------------------------
// TRANSLATE API
// ----------------------------------------------------
router.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang, sourceLang } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });
    
    const sourceStr = (sourceLang && sourceLang !== 'Auto') ? sourceLang : 'the original language';

    const client = getDeepseekAI();
    if (!client) return res.status(503).json({ error: 'Deepseek API key not configured' });

    const response = await client.chat.completions.create({
      model: 'deepseek-ai/deepseek-v4-pro',
      messages: [{ role: 'user', content: `You are a professional translator. Translate the following text from ${sourceStr} into ${targetLang || 'Turkish'}. Only output the translation, nothing else.\n\nTEXT:\n${text}` }],
      max_tokens: 1024
    });
    res.json({ translation: response.choices[0].message.content });
  } catch (err) {
    console.error('Translation error:', err.message);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// ----------------------------------------------------
// PAINT API (Pollinations.ai - No API Key Needed)
// ----------------------------------------------------
router.post('/api/paint', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });

    let finalPrompt = prompt;
    try {
      const client = getDeepseekAI();
      if (client) {
        const response = await client.chat.completions.create({
          model: 'deepseek-ai/deepseek-v4-pro',
          messages: [{ role: 'user', content: `Translate the following prompt into English for an image generator. Only output the English translation, no quotes, no extra text.\n\nPROMPT:\n${prompt}` }],
          max_tokens: 256
        });
        if (response.choices[0].message.content) finalPrompt = response.choices[0].message.content.trim();
      }
    } catch(err) {
      console.warn("Paint prompt translation failed, using original:", err.message);
    }

    const encodedPrompt = encodeURIComponent(finalPrompt + ", high quality, detailed");
    const seed = Math.floor(Math.random() * 100000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=512&height=512&nologo=true`;

    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Image generation failed');

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    res.json({ imageBase64: base64 });
  } catch (err) {
    console.error('Paint error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// DOCUMENT SCANNER & PAPER TLDR API
// ----------------------------------------------------
router.post('/api/scanner', upload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    filePath = req.file.path;
    const action = req.body.action || 'ocr';
    const mimeType = req.file.mimetype;

    let extractedText = '';
    if (mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      extractedText = data.text;
    } else if (mimeType === 'text/plain') {
      extractedText = fs.readFileSync(filePath, 'utf8');
    }

    if (action === 'ocr') {
      if (extractedText) {
        return res.json({ result: extractedText.substring(0, 15000) });
      } else if (mimeType.startsWith('image/')) {
        return res.json({ result: 'Image OCR is temporarily unavailable because Gemini is overloaded. Use a PDF or TXT file.' });
      }
    } else if (action === 'tldr') {
      if (!extractedText) return res.status(400).json({ error: 'Requires a PDF or Text file for TLDR' });
      
      const client = getDeepseekAI();
      if (!client) return res.status(503).json({ error: 'Deepseek API key not configured' });

      const response = await client.chat.completions.create({
        model: 'deepseek-ai/deepseek-v4-pro',
        messages: [{ role: 'user', content: `You are an academic summarizer. Summarize the following document into three sections: Purpose, Methodology, and Conclusion. Keep it very concise.\n\nTEXT:\n${extractedText.substring(0, 30000)}` }],
        max_tokens: 1500
      });
      return res.json({ result: response.choices[0].message.content });
    }

    res.json({ result: 'Action not supported for this file type.' });
  } catch (err) {
    console.error('Scanner error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
});

// ----------------------------------------------------
// NEWS TLDR API
// ----------------------------------------------------
router.post('/api/tldr', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const client = getDeepseekAI();
    if (!client) return res.status(503).json({ error: 'Deepseek API key not configured' });

    const response = await client.chat.completions.create({
      model: 'deepseek-ai/deepseek-v4-pro',
      messages: [{ role: 'user', content: `You are a precise news summarizer. Summarize the following news snippet in a single, short Turkish sentence.\n\nSNIPPET:\n${text}` }],
      max_tokens: 200
    });
    res.json({ summary: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: 'TLDR failed' });
  }
});

// ----------------------------------------------------
// YOUTUBE TLDR API
// ----------------------------------------------------
router.post('/api/youtube-tldr', async (req, res) => {
  try {
    const { title, channel } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const client = getDeepseekAI();
    if (!client) return res.status(503).json({ error: 'Deepseek API key not configured' });

    const response = await client.chat.completions.create({
      model: 'deepseek-ai/deepseek-v4-pro',
      messages: [{ role: 'user', content: `You are a helpful assistant. Give a 1-2 sentence educated guess in Turkish about what a YouTube video with the given title and channel is about. Be direct and concise.\n\nKanal: ${channel}\nBaşlık: ${title}` }],
      max_tokens: 200
    });
    res.json({ summary: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: 'YouTube TLDR failed' });
  }
});

// ----------------------------------------------------
// CONCEPT OF THE DAY API
// ----------------------------------------------------
router.get('/api/concept', async (req, res) => {
  try {
    const client = getDeepseekAI();
    if (!client) return res.status(503).json({ error: 'Deepseek API key not configured' });

    const response = await client.chat.completions.create({
      model: 'deepseek-ai/deepseek-v4-pro',
      messages: [{ role: 'user', content: 'You are an engineering professor. Output a short, interesting engineering concept (civil, mechanical, electrical, or software) in Turkish. Format: Concept Name: Brief explanation (2 sentences max).' }],
      max_tokens: 200
    });
    res.json({ concept: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch concept' });
  }
});

module.exports = router;
