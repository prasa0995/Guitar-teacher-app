// Generates the full chord library (all 12 roots × 7 chord qualities) using
// standard movable "E-shape" / "A-shape" barre-chord templates from guitar
// theory, and merges them with the hand-curated open-position chords in
// data/chords.json (curated versions always win when an id collides — they
// have friendlier open-position fingerings than a generated barre shape).
//
// Run with: node server/scripts/generateChords.js
// Rewrites server/data/chords.json in place.
const fs = require('fs');
const path = require('path');

const CHORDS_PATH = path.join(__dirname, '..', 'data', 'chords.json');
const curated = JSON.parse(fs.readFileSync(CHORDS_PATH, 'utf8'));

// Practical mixed sharp/flat spelling, index = semitone from C.
const ROOT_LABELS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function semitone(label) { return ROOT_LABELS.indexOf(label); }

const QUALITIES = [
  { suffix: '', name: 'major', family: 'major', e: [0, 2, 2, 1, 0, 0], a: [null, 0, 2, 2, 2, 0] },
  { suffix: 'm', name: 'minor', family: 'minor', e: [0, 2, 2, 0, 0, 0], a: [null, 0, 2, 2, 1, 0] },
  { suffix: '7', name: 'dominant 7th', family: '7th', e: [0, 2, 0, 1, 0, 0], a: [null, 0, 2, 0, 2, 0] },
  { suffix: 'maj7', name: 'major 7th', family: 'major7', e: [0, 2, 1, 1, 0, 0], a: [null, 0, 2, 1, 2, 0] },
  { suffix: 'm7', name: 'minor 7th', family: 'minor7', e: [0, 2, 0, 0, 0, 0], a: [null, 0, 2, 0, 1, 0] },
  { suffix: 'sus4', name: 'suspended 4th', family: 'sus', e: [0, 2, 2, 2, 0, 0], a: [null, 0, 2, 2, 3, 0] },
  { suffix: '5', name: 'power chord', family: 'power', e: [0, 2, 2, null, null, null], a: [null, 0, 2, null, null, null] },
];

const E_ROOT_SEMITONE = semitone('E'); // 4
const A_ROOT_SEMITONE = semitone('A'); // 9

function assignFingers(offsets, barreFret) {
  const fingers = offsets.map(() => 0);
  if (barreFret > 0) offsets.forEach((o, i) => { if (o === 0) fingers[i] = 1; });
  let next = barreFret > 0 ? 2 : 1;
  offsets.forEach((o, i) => {
    if (o !== null && o !== 0) { fingers[i] = Math.min(next, 4); next++; }
  });
  return fingers;
}

function buildChord(root, quality) {
  const rootSemi = semitone(root);
  const eBarre = (rootSemi - E_ROOT_SEMITONE + 12) % 12;
  const aBarre = (rootSemi - A_ROOT_SEMITONE + 12) % 12;
  const useE = eBarre <= aBarre;
  const barreFret = useE ? eBarre : aBarre;
  const offsets = useE ? quality.e : quality.a;

  const frets = offsets.map((o) => (o === null ? null : barreFret + o));
  const fingers = assignFingers(offsets, barreFret);
  const mutedStrings = offsets.map((o, i) => (o === null ? i : -1)).filter((i) => i >= 0);
  const openStrings = frets.map((f, i) => (f === 0 ? i : -1)).filter((i) => i >= 0);
  const playedIdx = offsets.map((o, i) => (o !== null ? i : -1)).filter((i) => i >= 0);

  const chord = {
    id: `${root}${quality.suffix}`,
    name: `${root} ${quality.name}`,
    family: quality.family,
    difficulty: barreFret === 0 ? 'beginner' : quality.family === 'power' ? 'beginner' : 'intermediate',
    frets, fingers, mutedStrings, openStrings,
    commonMistakes: barreFret > 0
      ? ['Barre finger not pressing evenly across every string — roll toward the side of the finger, not flat', 'Not enough thumb-behind-neck support, causing buzz']
      : ['Letting a neighboring string get muted by an overlapping finger'],
    beginnerVariant: null,
    altFingerings: [],
    relatedChordIds: [],
    songIds: [],
    audioNote: barreFret > 0
      ? `Movable ${useE ? 'E-shape' : 'A-shape'} barre chord, barred at fret ${barreFret}.`
      : 'Open-position chord — no barre needed.',
    generated: true,
  };
  if (barreFret > 0) chord.barre = { fret: barreFret, fromString: Math.min(...playedIdx), toString: Math.max(...playedIdx) };
  return chord;
}

const curatedIds = new Set(curated.map((c) => c.id));
const generated = [];
ROOT_LABELS.forEach((root) => {
  QUALITIES.forEach((quality) => {
    const id = `${root}${quality.suffix}`;
    if (curatedIds.has(id)) return; // curated open-position version wins
    generated.push(buildChord(root, quality));
  });
});

const full = [...curated, ...generated];
fs.writeFileSync(CHORDS_PATH, JSON.stringify(full, null, 2));
console.log(`Wrote ${full.length} chords (${curated.length} curated + ${generated.length} generated) to ${CHORDS_PATH}`);
