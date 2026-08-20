const express = require('express');
const store = require('../store');
const chords = require('../data/chords.json');
const techniques = require('../data/techniques.json');
const { getAllSongs } = require('../services/songCatalog');
const { buildContext } = require('../services/aiTutor');
const { generatePlan } = require('../services/practicePlan');

const router = express.Router();

router.get('/', (req, res) => {
  const profile = store.getProfile(req.userId);
  const userChords = store.getUserChords(req.userId);
  const userTechniques = store.getUserTechniques(req.userId);
  const sessions = store.getPracticeSessions(req.userId);
  const songProgress = store.getAllSongProgress(req.userId);
  const lessonProgress = store.getLessonProgress(req.userId);

  const daysPracticed = new Set(sessions.map((s) => s.date.slice(0, 10))).size;
  const totalMinutes = sessions.reduce((s, x) => s + (x.durationMin || 0), 0);
  const chordsLearned = Object.entries(userChords).filter(([, v]) => v.status === 'comfortable' || v.status === 'mastered').length;
  const techniquesLearned = Object.entries(userTechniques).filter(([, v]) => v.status === 'comfortable' || v.status === 'mastered').length;
  const songsLearned = Object.values(songProgress).filter((p) => p.status === 'learned').length;
  const lessonsCompleted = Object.values(lessonProgress).filter((p) => p.status === 'completed').length;
  const quizScores = Object.values(lessonProgress).filter((p) => p.quizScore != null).map((p) => p.quizScore);
  const avgQuizScore = quizScores.length ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;

  const ctx = buildContext(req.userId, {});
  const todaysPlan = generatePlan(req.userId, profile.minutesPerDay || 20);

  res.json({
    headline: `What should I practice today?`,
    todaysPlan,
    stats: {
      daysPracticed,
      totalMinutes,
      chordsLearned,
      chordsTotal: chords.length,
      techniquesLearned,
      techniquesTotal: techniques.length,
      songsLearned,
      songsTotal: getAllSongs(req.userId).length,
      lessonsCompleted,
      avgQuizScore,
      streak: profile.streak || 0,
    },
    weakAreas: ctx.weakAreas,
    songBpmProgress: Object.entries(songProgress).map(([songId, p]) => ({
      songId,
      currentBpm: p.currentBpm,
      status: p.status,
    })),
  });
});

module.exports = router;
