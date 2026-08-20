const express = require('express');
const curriculum = require('../data/curriculum.json');
const store = require('../store');

const router = express.Router();

router.get('/', (req, res) => {
  const progress = store.getLessonProgress(req.userId);
  const list = curriculum.map((l) => ({ ...l, progress: progress[l.id] || { status: 'not_started' } }));
  res.json({ curriculum: list });
});

router.put('/:id/status', (req, res) => {
  const { status, quizScore } = req.body || {};
  const patch = { status };
  if (status === 'completed') patch.completedAt = new Date().toISOString();
  if (quizScore !== undefined) patch.quizScore = quizScore;
  const progress = store.updateLessonProgress(req.userId, req.params.id, patch);
  res.json({ progress });
});

module.exports = router;
