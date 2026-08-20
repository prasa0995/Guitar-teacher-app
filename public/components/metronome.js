// Reusable Web Audio metronome. Uses a lookahead scheduler for accurate timing
// (setInterval alone drifts badly for audio timing).
export class Metronome {
  constructor({ bpm = 60, beatsPerMeasure = 4, subdivision = 1, onBeat = () => {} } = {}) {
    this.bpm = bpm;
    this.beatsPerMeasure = beatsPerMeasure;
    this.subdivision = subdivision; // 1 = quarter notes, 2 = eighth notes
    this.onBeat = onBeat;
    this.sound = 'click';
    this.audible = true;
    this.audioCtx = null;
    this.running = false;
    this.currentBeat = 0;
    this.nextNoteTime = 0;
    this.lookahead = 25; // ms
    this.scheduleAheadTime = 0.1; // s
    this.timerId = null;
    this.tapTimes = [];
  }

  ensureCtx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
  }

  start() {
    this.ensureCtx();
    if (this.running) return;
    this.running = true;
    this.currentBeat = 0;
    this.playStartTime = this.audioCtx.currentTime + 0.05;
    this.nextNoteTime = this.playStartTime;
    this.scheduler();
  }

  // Precise elapsed time since start(), driven by the audio clock (not
  // setInterval/Date.now, which drift) — used to drive smooth animation
  // like the song player's scrolling rhythm lane.
  elapsedSeconds() {
    if (!this.running || !this.audioCtx) return 0;
    return Math.max(0, this.audioCtx.currentTime - this.playStartTime);
  }

  stop() {
    this.running = false;
    clearTimeout(this.timerId);
  }

  setBpm(bpm) { this.bpm = Math.max(30, Math.min(240, bpm)); }

  secondsPerBeat() {
    return 60.0 / this.bpm / this.subdivision;
  }

  scheduler = () => {
    if (!this.running) return;
    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.nextNoteTime += this.secondsPerBeat();
      this.currentBeat = (this.currentBeat + 1) % (this.beatsPerMeasure * this.subdivision);
    }
    this.timerId = setTimeout(this.scheduler, this.lookahead);
  };

  scheduleNote(beatIndex, time) {
    const isDownbeat = beatIndex % this.subdivision === 0;
    const beatNumber = Math.floor(beatIndex / this.subdivision);
    const isAccent = beatNumber === 0 && isDownbeat;

    if (isDownbeat && this.audible) this.playClick(time, isAccent);
    const delay = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
    setTimeout(() => this.onBeat({ beatNumber, isDownbeat, isAccent, subBeat: beatIndex % this.subdivision }), delay);
  }

  playClick(time, accent) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = this.sound === 'beep' ? 'sine' : 'square';
    osc.frequency.value = accent ? 1500 : this.sound === 'wood' ? 800 : 1000;
    gain.gain.setValueAtTime(accent ? 0.5 : 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  tapTempo() {
    const now = performance.now();
    this.tapTimes = this.tapTimes.filter((t) => now - t < 2500);
    this.tapTimes.push(now);
    if (this.tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.tapTimes.length; i++) intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      this.setBpm(Math.round(60000 / avgMs));
    }
    return this.bpm;
  }
}
