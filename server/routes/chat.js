const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
const db = require('../db');

// Multer setup
const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'video/mp4'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  }
});

// Gemini Client
let geminiAi = null;
function getGeminiAI() {
  if (!geminiAi && process.env.GEMINI_API_KEY) {
    const { GoogleGenAI } = require('@google/genai');
    geminiAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiAi;
}

// Map for OpenAI-compatible independent providers
const PROVIDERS = {
  'deepseek-v4-pro': {
    getApiKey: () => process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
    modelStr: 'deepseek-ai/deepseek-v4-pro'
  },
  'glm-5.2': {
    getApiKey: () => process.env.GLM_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
    modelStr: 'z-ai/glm-5.2'
  },
  'minimax-m3': {
    getApiKey: () => process.env.MINIMAX_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
    modelStr: 'minimaxai/minimax-m3'
  }
};

function getOpenAIClient(selectedModel) {
  const provider = PROVIDERS[selectedModel];
  if (!provider) return null;
  const apiKey = provider.getApiKey();
  if (!apiKey) return null;
  return new OpenAI({ apiKey: apiKey, baseURL: provider.baseURL });
}

router.get('/chat', (req, res) => {
  res.render('chat', { pageTitle: res.locals.t.chat.title });
});

router.post('/api/chat', async (req, res) => {
  try {
    const { message, history, model } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });

    const selectedModel = model || 'gemini';

    if (selectedModel === 'gemini') {
      const client = getGeminiAI();
      if (!client) return res.status(503).json({ error: 'Gemini API key not configured' });

      const contents = [];
      if (Array.isArray(history)) {
        history.slice(-10).forEach(h => {
          if (h.role && h.text) contents.push({ role: h.role, parts: [{ text: h.text }] });
        });
      }
      contents.push({ role: 'user', parts: [{ text: message.trim() }] });

      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents
      });
      return res.json({ reply: response.text || 'No response generated.' });
    } 
    else {
      const provider = PROVIDERS[selectedModel];
      const client = getOpenAIClient(selectedModel);
      if (!client) return res.status(503).json({ error: `${selectedModel} API key not configured` });

      const messages = [
        { role: 'system', content: 'You are a helpful assistant. Eğer kullanıcı bir resim çizmeni veya görsel oluşturmanı isterse, LÜTFEN SADECE `[RESIM: <ingilizce_detayli_resim_promptu>]` formatında cevap ver. Başka hiçbir şey yazma. ÖNEMLİ: Sen Gemini, ChatGPT veya OpenAI değilsin. Senin model ismin ' + selectedModel + ' (NVIDIA NIM üzerinden çalışıyor). Eğer sana kim olduğun sorulursa gerçek adını söyle.' }
      ];
      if (Array.isArray(history)) {
        history.slice(-10).forEach(h => {
          messages.push({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text });
        });
      }
      messages.push({ role: 'user', content: message.trim() });

      const response = await client.chat.completions.create({
        model: provider.modelStr,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
      });

      return res.json({ reply: response.choices[0].message.content });
    }
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: res.locals.t.chat.error + ' (' + err.message + ')' });
  }
});

router.post('/api/chat/upload', upload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    filePath = req.file.path;
    const message = req.body.message?.trim() || 'Bu dosyayı analiz et / Analyze this file';
    const selectedModel = req.body.model || 'gemini';
    const mimeType = req.file.mimetype;

    // Helper: Parse PDF text
    let extractedText = '';
    if (mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      extractedText = data.text;
    }

    if (selectedModel === 'gemini') {
      const client = getGeminiAI();
      if (!client) return res.status(503).json({ error: 'Gemini API key not configured' });

      let parts = [{ text: message }];
      
      if (mimeType === 'application/pdf' || mimeType === 'text/plain') {
        const textContent = mimeType === 'text/plain' ? fs.readFileSync(filePath, 'utf8') : extractedText;
        parts.push({ text: `\n\n--- FILE CONTENT ---\n${textContent}\n--- END FILE ---` });
      } else {
        const fileData = fs.readFileSync(filePath).toString('base64');
        parts.push({ inlineData: { mimeType, data: fileData } });
      }

      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts }]
      });
      return res.json({ reply: response.text });
    } 
    else {
      // Other APIs (Deepseek, GLM, Minimax) generally do not have robust multimodal upload in standard chat format
      // We will extract text and pass it if it's text/pdf. 
      const provider = PROVIDERS[selectedModel];
      const client = getOpenAIClient(selectedModel);
      if (!client) return res.status(503).json({ error: `${selectedModel} API key not configured` });
      
      let finalMessage = message;
      let messages = [];

      if (mimeType === 'application/pdf' || mimeType === 'text/plain') {
        const textContent = mimeType === 'text/plain' ? fs.readFileSync(filePath, 'utf8') : extractedText;
        finalMessage += `\n\n--- FILE CONTENT ---\n${textContent}\n--- END FILE ---`;
        messages.push({ role: 'user', content: finalMessage });
      } else {
        // Fallback for image/video since Deepseek/GLM standard text APIs don't accept image b64 natively
         return res.status(400).json({ error: `The selected model (${selectedModel}) does not support ${mimeType} inputs directly. Please use Gemini for multimodal.` });
      }

      const response = await client.chat.completions.create({
        model: provider.modelStr,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
      });
      return res.json({ reply: response.choices[0].message.content });
    }
  } catch (err) {
    console.error('Chat upload error:', err.message);
    res.status(500).json({ error: res.locals.t.chat.error + ' (' + err.message + ')' });
  } finally {
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
});

router.use('/api/chat/upload', (err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: res.locals.t.chat.fileTooLarge });
  }
  if (err.message === 'Invalid file type') return res.status(400).json({ error: res.locals.t.chat.invalidType });
  next(err);
});

router.get('/api/saved-chats', async (req, res) => {
  try {
    const chats = (await db.execute('SELECT * FROM saved_chats ORDER BY id DESC')).rows;
    res.json(chats);
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

router.post('/api/saved-chats', express.json(), async (req, res) => {
  try {
    const { title, history } = req.body;
    if (!title || !history) return res.status(400).json({error: 'Title and history required'});
    const result = await db.execute({ sql: 'INSERT INTO saved_chats (title, history) VALUES (?, ?)', args: [title, JSON.stringify(history)] });
    res.json({success: true, id: Number(result.lastInsertRowid)});
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

router.post('/api/saved-chats/:id/delete', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM saved_chats WHERE id = ?', args: [req.params.id] });
    res.json({success: true});
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

module.exports = router;
