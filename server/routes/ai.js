const express = require('express');
const store = require('../store');
const { answer } = require('../services/aiTutor');

const router = express.Router();

router.post('/chat', async (req, res) => {
  const { message, screenContext } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });

  store.appendAIMessage(req.userId, { role: 'user', content: message, ts: Date.now(), screenContext });
  const result = await answer(req.userId, message, screenContext);
  store.appendAIMessage(req.userId, { role: 'assistant', content: result.reply, ts: Date.now(), source: result.source });

  res.json(result);
});

router.get('/conversation', (req, res) => {
  res.json({ messages: store.getAIConversation(req.userId) });
});

module.exports = router;
