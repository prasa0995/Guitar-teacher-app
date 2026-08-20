const store = require('./../store');
const chords = require('../data/chords.json');
const { recommendSongs } = require('./recommendation');

// Generates a personalized session, biased toward chords/pairs marked
// "learning" (not yet comfortable), plus a song block once something is ready.
function generatePlan(userId, totalMinutes = 20) {
  const profile = store.getProfile(userId);
  const userChords = store.getUserChords(userId);

  const learning = Object.entries(userChords)
    .filter(([, v]) => v.status === 'learning')
    .map(([id]) => id);
  const comfortable = Object.entries(userChords)
    .filter(([, v]) => v.status === 'comfortable' || v.status === 'mastered')
    .map(([id]) => id);

  const blocks = [];
  let remaining = totalMinutes;

  // 1. Chords still "learning" get isolated drill time.
  learning.slice(0, 2).forEach((chordId) => {
    if (remaining < 5) return;
    blocks.push({
      type: 'chord-drill',
      targetId: chordId,
      label: `Practice the ${nameFor(chordId)} chord shape until every string rings clean`,
      minutes: 5,
    });
    remaining -= 5;
  });

  // 2. Transitions between two comfortable chords, to build speed.
  if (comfortable.length >= 2 && remaining >= 5) {
    const [a, b] = comfortable.slice(0, 2);
    blocks.push({
      type: 'transition-drill',
      targetId: `${a}-${b}`,
      label: `${nameFor(a)} ↔ ${nameFor(b)} chord transitions with a metronome`,
      minutes: 5,
    });
    remaining -= 5;
  }

  // 3. Strumming/rhythm block.
  if (remaining >= 5) {
    blocks.push({
      type: 'strumming',
      targetId: 'rhythm',
      label: 'Down/up strumming pattern practice with the metronome',
      minutes: 5,
    });
    remaining -= 5;
  }

  // 4. Song practice, using whatever the user is closest to being ready for.
  if (remaining >= 5) {
    const { ready, almostReady } = recommendSongs(userId);
    const song = ready[0] || (almostReady[0] && almostReady[0].song);
    if (song) {
      blocks.push({
        type: 'song-practice',
        targetId: song.id,
        label: `Song practice: ${song.title} — loop a section at your current BPM`,
        minutes: remaining,
      });
    } else {
      blocks.push({
        type: 'chord-drill',
        targetId: comfortable[0] || 'Em',
        label: 'Keep building clean, fast chord changes — you are close to your first song',
        minutes: remaining,
      });
    }
    remaining = 0;
  }

  return {
    userId,
    date: new Date().toISOString().slice(0, 10),
    totalMinutes,
    blocks,
    rationale: buildRationale(profile, learning, comfortable),
  };
}

function nameFor(id) {
  const c = chords.find((x) => x.id === id);
  return c ? c.name : id;
}

function buildRationale(profile, learning, comfortable) {
  if (comfortable.length === 0 && learning.length === 0) {
    return "You're just getting started — this session focuses on your very first open chords.";
  }
  if (learning.length > 0) {
    return `You marked ${learning.length} chord(s) as still "learning", so this session drills those first before moving to transitions and a song.`;
  }
  return 'Your chords are solid, so this session leans into transition speed and song application.';
}

module.exports = { generatePlan };
