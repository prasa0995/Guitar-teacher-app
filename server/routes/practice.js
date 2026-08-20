const express = require('express');
const store = require('../store');
const { newId } = require('../auth');
const { generatePlan } = require('../services/practicePlan');

const router = express.Router();

router.post('/generate', (req, res) => {
  const minutes = (req.body && req.body.minutes) || (store.getProfile(req.userId).minutesPerDay) || 20;
  res.json({ plan: generatePlan(req.userId, minutes) });
});

router.post('/log', (req, res) => {
  const { durationMin, blocks, source } = req.body || {};
  if (!durationMin) return res.status(400).json({ error: 'durationMin required' });
  const session = {
    id: newId('session'),
    userId: req.userId,
    date: new Date().toISOString(),
    durationMin,
    blocks: blocks || [],
    source: source || 'manual',
  };
  store.addPracticeSession(req.userId, session);

  // Update streak
  const profile = store.getProfile(req.userId);
  const today = new Date().toISOString().slice(0, 10);
  const last = profile.lastPracticeDate ? profile.lastPracticeDate.slice(0, 10) : null;
  let streak = profile.streak || 0;
  if (last !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streak = last === yesterday ? streak + 1 : 1;
  }
  store.updateProfile(req.userId, { streak, lastPracticeDate: session.date });

  res.json({ session });
});

router.get('/history', (req, res) => {
  res.json({ sessions: store.getPracticeSessions(req.userId) });
});

module.exports = router;
