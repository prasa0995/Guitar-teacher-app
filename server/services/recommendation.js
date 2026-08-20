const chords = require('../data/chords.json');
const techniques = require('../data/techniques.json');
const store = require('../store');
const { getAllSongs } = require('./songCatalog');

const READY_STATUSES = new Set(['comfortable', 'mastered']);

function knownSet(map) {
  return new Set(Object.entries(map).filter(([, v]) => READY_STATUSES.has(v.status)).map(([k]) => k));
}

function nameFor(id, list) {
  const item = list.find((x) => x.id === id);
  return item ? item.name : id;
}

// Scores every song against the user's comfortable/mastered chords+techniques.
// Returns { ready: [...], almostReady: [...], notYet: [...] }
function recommendSongs(userId) {
  const userChords = knownSet(store.getUserChords(userId));
  const userTechniques = knownSet(store.getUserTechniques(userId));

  const scored = getAllSongs(userId).map((song) => {
    const missingChords = song.requiredChordIds.filter((c) => !userChords.has(c));
    const missingTechniques = song.requiredTechniqueIds.filter((t) => !userTechniques.has(t));
    const missing = [
      ...missingChords.map((id) => nameFor(id, chords)),
      ...missingTechniques.map((id) => nameFor(id, techniques)),
    ];
    return { song, missing, missingCount: missing.length };
  });

  const ready = scored.filter((s) => s.missingCount === 0).map((s) => s.song);
  const almostReady = scored
    .filter((s) => s.missingCount > 0 && s.missingCount <= 2)
    .map((s) => ({ song: s.song, missing: s.missing }));
  const notYet = scored
    .filter((s) => s.missingCount > 2)
    .map((s) => ({ song: s.song, missing: s.missing }));

  return { ready, almostReady, notYet };
}

module.exports = { recommendSongs };
