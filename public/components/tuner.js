// Client-side pitch detection via microphone using autocorrelation.
// Everything runs in-browser — no audio is uploaded anywhere.
export const TUNINGS = {
  standard: { label: 'Standard (E A D G B E)', strings: [
    { name: 'E2', freq: 82.41 }, { name: 'A2', freq: 110.0 }, { name: 'D3', freq: 146.83 },
    { name: 'G3', freq: 196.0 }, { name: 'B3', freq: 246.94 }, { name: 'E4', freq: 329.63 },
  ] },
  dropD: { label: 'Drop D (D A D G B E)', strings: [
    { name: 'D2', freq: 73.42 }, { name: 'A2', freq: 110.0 }, { name: 'D3', freq: 146.83 },
    { name: 'G3', freq: 196.0 }, { name: 'B3', freq: 246.94 }, { name: 'E4', freq: 329.63 },
  ] },
  halfStepDown: { label: 'Half-step down (Eb Ab Db Gb Bb Eb)', strings: [
    { name: 'Eb2', freq: 77.78 }, { name: 'Ab2', freq: 103.83 }, { name: 'Db3', freq: 138.59 },
    { name: 'Gb3', freq: 185.0 }, { name: 'Bb3', freq: 233.08 }, { name: 'Eb4', freq: 311.13 },
  ] },
  openG: { label: 'Open G (D G D G B D)', strings: [
    { name: 'D2', freq: 73.42 }, { name: 'G2', freq: 98.0 }, { name: 'D3', freq: 146.83 },
    { name: 'G3', freq: 196.0 }, { name: 'B3', freq: 246.94 }, { name: 'D4', freq: 293.66 },
  ] },
};

export function closestString(freq, tuningKey = 'standard') {
  const strings = TUNINGS[tuningKey].strings;
  let best = strings[0];
  let bestCents = Infinity;
  strings.forEach((s) => {
    const cents = 1200 * Math.log2(freq / s.freq);
    if (Math.abs(cents) < Math.abs(bestCents)) { best = s; bestCents = cents; }
  });
  return { string: best, cents: bestCents };
}

// Autocorrelation-based pitch detection (ACF2+), good enough for a guitar tuner.
function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // too quiet

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  const trimmed = buf.slice(r1, r2);
  const newSize = trimmed.length;

  const c = new Array(newSize).fill(0);
  for (let i = 0; i < newSize; i++)
    for (let j = 0; j < newSize - i; j++) c[i] += trimmed[j] * trimmed[j + i];

  let d = 0;
  while (d + 1 < c.length && c[d] > c[d + 1]) d++;
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < c.length; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  let T0 = maxPos;
  if (T0 <= 0) return -1;
  const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);
  return sampleRate / T0;
}

export class Tuner {
  constructor(onPitch) {
    this.onPitch = onPitch;
    this.audioCtx = null;
    this.stream = null;
    this.analyser = null;
    this.buf = null;
    this.rafId = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.loop();
  }

  loop = () => {
    this.analyser.getFloatTimeDomainData(this.buf);
    const freq = autoCorrelate(this.buf, this.audioCtx.sampleRate);
    this.onPitch(freq > 0 ? freq : null);
    this.rafId = requestAnimationFrame(this.loop);
  };

  stop() {
    cancelAnimationFrame(this.rafId);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.audioCtx) this.audioCtx.close();
  }
}
