const express = require('express');
const router = express.Router();
const db = require('../db');

// HTML sanitization
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const isAjax = (req) => req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';

// --- TODOS ---

router.post('/api/todos', async (req, res) => {
  const text = escapeHtml(req.body.text?.trim());
  if (!text) {
    if (isAjax(req)) return res.status(400).json({ error: 'Text required' });
    return res.redirect('/');
  }
  const result = await db.execute({ sql: 'INSERT INTO todos (text) VALUES (?)', args: [text] });
  if (isAjax(req)) return res.json({ success: true, id: Number(result.lastInsertRowid), text, done: 0 });
  res.redirect('/');
});

router.post('/api/todos/:id/toggle', async (req, res) => {
  const rs = await db.execute({ sql: 'SELECT * FROM todos WHERE id = ?', args: [req.params.id] });
  const todo = rs.rows[0];
  if (todo) {
    await db.execute({ sql: 'UPDATE todos SET done = ? WHERE id = ?', args: [todo.done ? 0 : 1, req.params.id] });
  }
  if (isAjax(req)) return res.json({ success: true, done: todo ? (todo.done ? 0 : 1) : 0 });
  res.redirect('/');
});

router.post('/api/todos/:id/delete', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM todos WHERE id = ?', args: [req.params.id] });
  if (isAjax(req)) return res.json({ success: true });
  res.redirect('/');
});

// --- NOTES ---

router.post('/api/notes', async (req, res) => {
  const text = escapeHtml(req.body.text?.trim());
  if (!text) {
    if (isAjax(req)) return res.status(400).json({ error: 'Text required' });
    return res.redirect('/');
  }
  const result = await db.execute({ sql: 'INSERT INTO notes (text) VALUES (?)', args: [text] });
  if (isAjax(req)) return res.json({ success: true, id: Number(result.lastInsertRowid), text, created_at: new Date().toISOString() });
  res.redirect('/');
});

router.post('/api/notes/:id/delete', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM notes WHERE id = ?', args: [req.params.id] });
  if (isAjax(req)) return res.json({ success: true });
  res.redirect('/');
});

// --- REMINDERS ---

router.post('/api/reminders', async (req, res) => {
  const date = req.body.date?.trim();
  const text = escapeHtml(req.body.text?.trim());
  if (!date || !text) {
    if (isAjax(req)) return res.status(400).json({ error: 'Date and text required' });
    return res.redirect('/');
  }
  const result = await db.execute({ sql: 'INSERT INTO reminders (date, text) VALUES (?, ?)', args: [date, text] });
  if (isAjax(req)) return res.json({ success: true, id: Number(result.lastInsertRowid), date, text });
  res.redirect('/');
});

router.post('/api/reminders/:id/delete', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM reminders WHERE id = ?', args: [req.params.id] });
  if (isAjax(req)) return res.json({ success: true });
  res.redirect('/');
});

// --- Bookmarks ---
router.post('/api/bookmarks', async (req, res) => {
  const { title, url } = req.body;
  if (!url) {
    if (req.xhr || req.headers['x-requested-with']) return res.json({ error: 'URL required' });
    return res.redirect('/');
  }
  const name = title || new URL(url).hostname;
  const result = await db.execute({ sql: 'INSERT INTO bookmarks (title, url) VALUES (?, ?)', args: [name, url] });
  if (req.xhr || req.headers['x-requested-with']) {
    return res.json({ success: true, id: Number(result.lastInsertRowid), title: name, url });
  }
  res.redirect('/');
});

router.post('/api/bookmarks/:id/delete', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM bookmarks WHERE id = ?', args: [req.params.id] });
  if (req.xhr || req.headers['x-requested-with']) {
    return res.json({ success: true });
  }
  res.redirect('/');
});

module.exports = router;
