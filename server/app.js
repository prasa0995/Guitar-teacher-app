require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieSession = require('cookie-session');
const rateLimit = require('express-rate-limit');

const { requireAuth } = require('./auth');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const chordRoutes = require('./routes/chords');
const techniqueRoutes = require('./routes/techniques');
const songRoutes = require('./routes/songs');
const theoryRoutes = require('./routes/theory');
const curriculumRoutes = require('./routes/curriculum');
const practiceRoutes = require('./routes/practice');
const progressRoutes = require('./routes/progress');
const aiRoutes = require('./routes/ai');

// Builds the Express app without starting a listener — used both by the
// local dev server (index.js) and the Netlify serverless function
// (netlify/functions/api.js), which wrap this same app differently.
function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(
    cookieSession({
      name: 'guitar_session',
      keys: [process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me'],
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    })
  );
  // Custom keyGenerator: falls back to a constant key instead of throwing
  // when req.ip is undefined, which can happen depending on how the
  // surrounding serverless runtime shapes the request (e.g. under
  // serverless-http on Netlify Functions) — degrades to a shared limit
  // rather than crashing the request.
  app.use(rateLimit({ windowMs: 60 * 1000, max: 300, keyGenerator: (req) => req.ip || 'unknown' }));

  // Public
  app.use('/api/auth', authRoutes);

  // Authenticated
  app.use('/api/profile', requireAuth, profileRoutes);
  app.use('/api/chords', requireAuth, chordRoutes);
  app.use('/api/techniques', requireAuth, techniqueRoutes);
  app.use('/api/songs', requireAuth, songRoutes);
  app.use('/api/theory', requireAuth, theoryRoutes);
  app.use('/api/curriculum', requireAuth, curriculumRoutes);
  app.use('/api/practice', requireAuth, practiceRoutes);
  app.use('/api/progress', requireAuth, progressRoutes);
  app.use('/api/ai', requireAuth, aiRoutes);

  // Static frontend — only exercised by the local dev server. On Netlify the
  // `public` folder is published directly by Netlify itself, and this
  // function is only ever invoked for /api/* (see netlify.toml), so this
  // branch is simply unused there, not harmful.
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

  return app;
}

module.exports = { createApp };
