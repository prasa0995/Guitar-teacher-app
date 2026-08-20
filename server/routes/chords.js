const express = require('express');
const chords = require('../data/chords.json');
const store = require('../store');

const router = express.Router();
const STATUSES = new Set(['not_learned', 'learning', 'comfortable', 'mastered']);

router.get('/', (req, res) => {
  const userChords = store.getUserChords(req.userId);
  const list = chords.map((c) => ({ ...c, status: (userChords[c.id] && userChords[c.id].status) || 'not_learned' }));
  res.json({ chords: list });
});

router.get('/:id', (req, res) => {
  const chord = chords.find((c) => c.id === req.params.id);
  if (!chord) return res.status(404).json({ error: 'Chord not found' });
  const userChords = store.getUserChords(req.userId);
  const related = chords.filter((c) => chord.relatedChordIds.includes(c.id));
  res.json({
    chord: { ...chord, status: (userChords[chord.id] && userChords[chord.id].status) || 'not_learned' },
    related,
  });
});

router.put('/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status' });
  const chord = chords.find((c) => c.id === req.params.id);
  if (!chord) return res.status(404).json({ error: 'Chord not found' });
  const record = store.setUserChordStatus(req.userId, req.params.id, status);
  res.json({ status: record });
});

module.exports = router;
