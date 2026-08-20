const express = require('express');
const store = require('../store');
const chords = require('../data/chords.json');
const techniques = require('../data/techniques.json');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ profile: store.getProfile(req.userId) });
});

router.put('/', (req, res) => {
  const allowed = ['daysPerWeek', 'minutesPerDay', 'goalSongIds'];
  const patch = {};
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  });
  res.json({ profile: store.updateProfile(req.userId, patch) });
});

const STARTER_CHORDS = ['Em', 'Am', 'C', 'G'];
const STARTER_TECHNIQUES = ['down-strum', 'up-strum'];

// Evaluates onboarding answers into an initial skill level + starter plan,
// and pre-marks any chords/techniques the user already claims to know.
router.post('/onboarding', (req, res) => {
  const {
    hasPlayedBefore,
    guitarType,
    daysPerWeek,
    minutesPerDay,
    goalSongTitles,
    knownChordIds = [],
    knownTechniqueIds = [],
  } = req.body || {};

  const knownChordSet = new Set(knownChordIds.filter((id) => chords.some((c) => c.id === id)));
  const knownTechSet = new Set(knownTechniqueIds.filter((id) => techniques.some((t) => t.id === id)));

  let skillLevel = 'brand_new';
  if (hasPlayedBefore) {
    skillLevel = knownChordSet.size >= 4 ? 'early_intermediate' : 'beginner';
  }

  knownChordSet.forEach((id) => store.setUserChordStatus(req.userId, id, 'comfortable'));
  knownTechSet.forEach((id) => store.setUserTechniqueStatus(req.userId, id, 'comfortable'));

  // Starter chords/techniques the plan will introduce first (skip ones already known).
  const planChords = STARTER_CHORDS.filter((id) => !knownChordSet.has(id));
  const planTechniques = STARTER_TECHNIQUES.filter((id) => !knownTechSet.has(id));
  planChords.forEach((id) => {
    if (!store.getUserChords(req.userId)[id]) store.setUserChordStatus(req.userId, id, 'not_learned');
  });

  const profile = store.updateProfile(req.userId, {
    hasPlayedBefore: !!hasPlayedBefore,
    guitarType: guitarType || null,
    daysPerWeek: daysPerWeek || 3,
    minutesPerDay: minutesPerDay || 20,
    goalSongIds: [],
    skillLevel,
    onboardingComplete: true,
  });

  const summary = skillLevel === 'brand_new'
    ? `You're starting from scratch. We'll begin with guitar basics, tuning, and your first chords (${STARTER_CHORDS.map((id) => chords.find((c) => c.id === id).name).join(', ')}) with simple downstrumming. Your first song unlocks once you can comfortably transition between these chords.`
    : `You already know ${knownChordSet.size} chord(s) and ${knownTechSet.size} technique(s) — we'll fill in the gaps (${planChords.map((id) => chords.find((c) => c.id === id).name).join(', ') || 'none'}) and get you into song practice quickly.`;

  res.json({
    profile,
    goalSongTitles: goalSongTitles || [],
    starterPlan: { chords: planChords, techniques: planTechniques, summary },
  });
});

module.exports = router;
