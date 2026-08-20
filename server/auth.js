const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const store = require('./store');

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString('hex')}`;
}

function requireAuth(req, res, next) {
  const userId = req.session && req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  const user = store.findUserById(userId);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  req.userId = userId;
  req.user = user;
  next();
}

function publicUser(user) {
  return { id: user.id, email: user.email };
}

module.exports = { newId, requireAuth, publicUser, bcrypt };
