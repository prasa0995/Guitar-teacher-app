const express = require('express');
const theory = require('../data/theory.json');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ theory });
});

router.get('/:id', (req, res) => {
  const topic = theory.find((t) => t.id === req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });
  res.json({ topic });
});

router.post('/:id/quiz', (req, res) => {
  const topic = theory.find((t) => t.id === req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });
  const { answers } = req.body || {}; // array of selected option indices
  const correct = topic.quiz.reduce((sum, q, i) => sum + (answers && answers[i] === q.answer ? 1 : 0), 0);
  const score = Math.round((correct / topic.quiz.length) * 100);
  res.json({ score, correct, total: topic.quiz.length });
});

module.exports = router;
