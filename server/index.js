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

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use(rateLimit({ windowMs: 60 * 1000, max: 300 }));

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

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`AI Guitar Teacher server running on http://localhost:${PORT}`);
  console.log(process.env.ANTHROPIC_API_KEY ? 'AI Tutor: Anthropic API enabled' : 'AI Tutor: rule-based engine (no ANTHROPIC_API_KEY set)');
});
