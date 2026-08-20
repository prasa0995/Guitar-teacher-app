const express = require('express');
const techniques = require('../data/techniques.json');
const store = require('../store');
const { newId } = require('../auth');

const router = express.Router();
const STATUSES = new Set(['not_learned', 'learning', 'comfortable', 'mastered']);

router.get('/', (req, res) => {
  const userTech = store.getUserTechniques(req.userId);
  const custom = store.getCustomTechniques(req.userId);
  const all = [...techniques, ...custom];
  const list = all.map((t) => ({ ...t, status: (userTech[t.id] && userTech[t.id].status) || 'not_learned' }));
  res.json({ techniques: list });
});

router.post('/', (req, res) => {
  const { name, category, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const technique = {
    id: newId('tech'),
    name,
    category: category || 'custom',
    description: description || '',
    difficulty: 'custom',
    custom: true,
  };
  store.addCustomTechnique(req.userId, technique);
  store.setUserTechniqueStatus(req.userId, technique.id, 'learning');
  res.json({ technique });
});

router.put('/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status' });
  const record = store.setUserTechniqueStatus(req.userId, req.params.id, status);
  res.json({ status: record });
});

module.exports = router;
