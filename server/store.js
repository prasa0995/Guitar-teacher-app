// Simple JSON-file persistence layer. Schema documented in ARCHITECTURE.md.
// Swap this module for a real DB layer later without touching route code —
// every route talks to `store.*` methods, never to the file directly.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

function emptyState() {
  return {
    users: [], // { id, email, passwordHash, securityQuestion, securityAnswerHash, createdAt }
    profiles: {}, // userId -> profile
    userChords: {}, // userId -> { chordId -> { status, updatedAt } }
    userTechniques: {}, // userId -> { techniqueId -> { status, updatedAt } }
    customTechniques: {}, // userId -> [ { id, name, category, description } ]
    customSongs: {}, // userId -> [ song ] — user-added songs (schema matches server/data/songs.json)
    practiceSessions: {}, // userId -> [ session ]
    songProgress: {}, // userId -> { songId -> progress }
    lessonProgress: {}, // userId -> { lessonId -> progress }
    aiConversations: {}, // userId -> [ { role, content, ts, screenContext } ]
  };
}

// On Netlify, the deployed filesystem is read-only, so persistence there
// goes through Netlify Blobs instead — see hydrate()/flush() below, called
// once per request, ONLY by netlify/functions/api.js. Locally, the plain
// JSON file is used exactly as before (index.js never calls hydrate/flush
// at all). Whether we're in "Blobs mode" is decided by actual usage — the
// first hydrate() call sets it — not by guessing at environment variables
// (Netlify doesn't reliably expose the same env vars at function-runtime
// that it does at build-time, which silently broke persistence before:
// signups worked in-memory for one request, then vanished on the next).
let usingBlobs = false;

let state = load();

function load() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
      const s = emptyState();
      fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 2));
      return s;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Object.assign(emptyState(), parsed);
  } catch (err) {
    // Expected on Netlify (read-only filesystem) until the first hydrate()
    // call switches us into Blobs mode — not a real error there.
    state = emptyState();
    return state;
  }
}

let saveTimer = null;
function persist() {
  if (usingBlobs) return; // flush() (Blobs) handles persistence there instead
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  }, 50);
}

let blobStore = null;
async function getBlobStore() {
  if (!blobStore) {
    const { getStore } = require('@netlify/blobs');
    blobStore = getStore('guitar-teacher-data');
  }
  return blobStore;
}

// Loads state from Netlify Blobs at the start of a function invocation.
// Only ever called by netlify/functions/api.js.
async function hydrate() {
  usingBlobs = true;
  try {
    const bs = await getBlobStore();
    const raw = await bs.get('state', { type: 'json' });
    state = raw ? Object.assign(emptyState(), raw) : emptyState();
  } catch (err) {
    console.error('Blob hydrate failed, starting fresh for this request:', err.message);
    state = emptyState();
  }
}

// Writes state back to Netlify Blobs at the end of a function invocation.
async function flush() {
  if (!usingBlobs) return;
  try {
    const bs = await getBlobStore();
    await bs.setJSON('state', state);
  } catch (err) {
    console.error('Blob flush failed — changes from this request may be lost:', err.message);
  }
}

function ensureUserBuckets(userId) {
  if (!state.profiles[userId]) {
    state.profiles[userId] = {
      userId,
      skillLevel: 'brand_new',
      hasPlayedBefore: false,
      guitarType: null,
      daysPerWeek: null,
      minutesPerDay: null,
      goalSongIds: [],
      onboardingComplete: false,
      streak: 0,
      lastPracticeDate: null,
      createdAt: new Date().toISOString(),
    };
  }
  if (!state.userChords[userId]) state.userChords[userId] = {};
  if (!state.userTechniques[userId]) state.userTechniques[userId] = {};
  if (!state.customTechniques[userId]) state.customTechniques[userId] = [];
  if (!state.customSongs[userId]) state.customSongs[userId] = [];
  if (!state.practiceSessions[userId]) state.practiceSessions[userId] = [];
  if (!state.songProgress[userId]) state.songProgress[userId] = {};
  if (!state.lessonProgress[userId]) state.lessonProgress[userId] = {};
  if (!state.aiConversations[userId]) state.aiConversations[userId] = [];
}

module.exports = {
  raw: () => state,

  // Users
  findUserByEmail(email) {
    return state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  findUserById(id) {
    return state.users.find((u) => u.id === id);
  },
  createUser(user) {
    state.users.push(user);
    ensureUserBuckets(user.id);
    persist();
    return user;
  },
  updateUserPassword(id, passwordHash) {
    const u = this.findUserById(id);
    if (u) {
      u.passwordHash = passwordHash;
      persist();
    }
    return u;
  },

  // Profile
  getProfile(userId) {
    ensureUserBuckets(userId);
    return state.profiles[userId];
  },
  updateProfile(userId, patch) {
    ensureUserBuckets(userId);
    Object.assign(state.profiles[userId], patch);
    persist();
    return state.profiles[userId];
  },

  // Chords
  getUserChords(userId) {
    ensureUserBuckets(userId);
    return state.userChords[userId];
  },
  setUserChordStatus(userId, chordId, status) {
    ensureUserBuckets(userId);
    state.userChords[userId][chordId] = { status, updatedAt: new Date().toISOString() };
    persist();
    return state.userChords[userId][chordId];
  },

  // Techniques
  getUserTechniques(userId) {
    ensureUserBuckets(userId);
    return state.userTechniques[userId];
  },
  setUserTechniqueStatus(userId, techniqueId, status) {
    ensureUserBuckets(userId);
    state.userTechniques[userId][techniqueId] = { status, updatedAt: new Date().toISOString() };
    persist();
    return state.userTechniques[userId][techniqueId];
  },
  getCustomTechniques(userId) {
    ensureUserBuckets(userId);
    return state.customTechniques[userId];
  },
  addCustomTechnique(userId, technique) {
    ensureUserBuckets(userId);
    state.customTechniques[userId].push(technique);
    persist();
    return technique;
  },

  // Custom (user-added) songs
  getCustomSongs(userId) {
    ensureUserBuckets(userId);
    return state.customSongs[userId];
  },
  addCustomSong(userId, song) {
    ensureUserBuckets(userId);
    state.customSongs[userId].push(song);
    persist();
    return song;
  },

  // Practice sessions
  getPracticeSessions(userId) {
    ensureUserBuckets(userId);
    return state.practiceSessions[userId];
  },
  addPracticeSession(userId, session) {
    ensureUserBuckets(userId);
    state.practiceSessions[userId].push(session);
    persist();
    return session;
  },

  // Song progress
  getSongProgress(userId, songId) {
    ensureUserBuckets(userId);
    return state.songProgress[userId][songId] || null;
  },
  getAllSongProgress(userId) {
    ensureUserBuckets(userId);
    return state.songProgress[userId];
  },
  updateSongProgress(userId, songId, patch) {
    ensureUserBuckets(userId);
    const existing = state.songProgress[userId][songId] || {
      userId,
      songId,
      status: 'not_started',
      currentBpm: null,
      sectionsLooped: [],
      lastPracticed: null,
      accuracyLog: [],
    };
    state.songProgress[userId][songId] = Object.assign(existing, patch);
    persist();
    return state.songProgress[userId][songId];
  },

  // Lessons
  getLessonProgress(userId) {
    ensureUserBuckets(userId);
    return state.lessonProgress[userId];
  },
  updateLessonProgress(userId, lessonId, patch) {
    ensureUserBuckets(userId);
    const existing = state.lessonProgress[userId][lessonId] || {
      lessonId,
      status: 'not_started',
      quizScore: null,
      completedAt: null,
    };
    state.lessonProgress[userId][lessonId] = Object.assign(existing, patch);
    persist();
    return state.lessonProgress[userId][lessonId];
  },

  // AI conversation history
  getAIConversation(userId) {
    ensureUserBuckets(userId);
    return state.aiConversations[userId];
  },
  appendAIMessage(userId, message) {
    ensureUserBuckets(userId);
    state.aiConversations[userId].push(message);
    // keep it bounded
    if (state.aiConversations[userId].length > 200) {
      state.aiConversations[userId] = state.aiConversations[userId].slice(-200);
    }
    persist();
  },

  ensureUserBuckets,
  hydrate,
  flush,
};
