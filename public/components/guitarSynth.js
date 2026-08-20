// Synthesizes a plucked-string guitar sound with the Web Audio API — no
// audio samples/recordings involved (so no licensing concerns), just
// oscillators + filters shaped to approximate a plucked string's envelope.
let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const STRING_MIDI = [40, 45, 50, 55, 59, 64]; // low E, A, D, G, B, high E (open strings)

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function pluckString(audioCtx, freq, startTime, velocity = 1) {
  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;

  const osc2 = audioCtx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = freq * 2.003; // slight detune for a fuller string tone

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, startTime);
  filter.frequency.exponentialRampToValueAtTime(500, startTime + 0.5);
  filter.Q.value = 0.7;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.22 * velocity, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.6);

  const gain2 = audioCtx.createGain();
  gain2.gain.setValueAtTime(0.0001, startTime);
  gain2.gain.exponentialRampToValueAtTime(0.07 * velocity, startTime + 0.008);
  gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.1);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);

  osc.start(startTime); osc.stop(startTime + 1.7);
  osc2.start(startTime); osc2.stop(startTime + 1.2);
}

// Strums a chord's fretted strings low-to-high with a natural stagger.
export function playChord(chord, { strumMs = 22 } = {}) {
  const audioCtx = getCtx();
  const now = audioCtx.currentTime + 0.02;
  let strumIndex = 0;
  chord.frets.forEach((fret, i) => {
    if (fret === null || fret === undefined) return;
    const midi = STRING_MIDI[i] + fret;
    const startTime = now + strumIndex * (strumMs / 1000);
    pluckString(audioCtx, midiToFreq(midi), startTime, 0.85 + i * 0.03);
    strumIndex++;
  });
}

// Plays a single fretted note (used by the fretboard explorer).
export function playNote(stringIndex, fret) {
  const audioCtx = getCtx();
  const midi = STRING_MIDI[stringIndex] + fret;
  pluckString(audioCtx, midiToFreq(midi), audioCtx.currentTime + 0.01, 1);
}
