const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../store');
const { newId, requireAuth, publicUser, bcrypt } = require('../auth');

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyGenerator: (req) => req.ip || 'unknown' });

function validEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Temporary diagnostic endpoint — no auth required, no secrets exposed
// (emails only, no passwords/hashes) — for tracking down the Netlify
// storage persistence issue. Safe to remove once resolved.
router.get('/debug', (req, res) => {
  res.json(store.getDebugInfo());
});

router.post('/signup', authLimiter, (req, res) => {
  const { email, password, securityQuestion, securityAnswer } = req.body || {};
  if (!validEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!securityQuestion || !securityAnswer) return res.status(400).json({ error: 'Security question and answer required (for password recovery)' });
  if (store.findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists' });

  const user = {
    id: newId('user'),
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    securityQuestion,
    securityAnswerHash: bcrypt.hashSync(securityAnswer.trim().toLowerCase(), 10),
    createdAt: new Date().toISOString(),
  };
  store.createUser(user);
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

router.post('/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const user = store.findUserByEmail(email || '');
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const userId = req.session && req.session.userId;
  const user = userId && store.findUserById(userId);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json({ user: publicUser(user) });
});

router.post('/forgot-password/question', authLimiter, (req, res) => {
  const { email } = req.body || {};
  const user = store.findUserByEmail(email || '');
  if (!user) return res.status(404).json({ error: 'No account with that email' });
  res.json({ securityQuestion: user.securityQuestion });
});

router.post('/forgot-password/reset', authLimiter, (req, res) => {
  const { email, securityAnswer, newPassword } = req.body || {};
  const user = store.findUserByEmail(email || '');
  if (!user) return res.status(404).json({ error: 'No account with that email' });
  if (!bcrypt.compareSync((securityAnswer || '').trim().toLowerCase(), user.securityAnswerHash)) {
    return res.status(401).json({ error: 'Security answer incorrect' });
  }
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  store.updateUserPassword(user.id, bcrypt.hashSync(newPassword, 10));
  res.json({ ok: true });
});

module.exports = router;
