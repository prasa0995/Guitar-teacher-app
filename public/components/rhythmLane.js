// A Guitar-Hero/Piano-Tiles-style scrolling lane: upcoming strums (down/up)
// slide toward a fixed "hit line" in time with the metronome's audio clock.
// It loops the CURRENT measure's strumming pattern continuously — the large
// chord name above it (driven separately, on each beat) still shows which
// chord that measure belongs to.
export function createRhythmLane(canvas) {
  const ctx2d = canvas.getContext('2d');
  const style = getComputedStyle(document.documentElement);
  const ACCENT = style.getPropertyValue('--accent-strong').trim() || '#ffb84d';
  const ACCENT2 = style.getPropertyValue('--accent-2-strong').trim() || '#5fd6c5';
  const DIM = style.getPropertyValue('--bg-elev-3').trim() || '#262b34';
  const TEXT = style.getPropertyValue('--text').trim() || '#f3f5f8';

  function parsePattern(pattern) {
    if (!pattern) return [];
    const cleaned = pattern.replace(/\([^)]*\)/g, ''); // strip "(palm mute)" style notes
    return cleaned.replace(/\s+/g, '').split('').filter((c) => c === 'D' || c === 'U' || c === '.');
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // metronome: the Metronome instance (for elapsedSeconds() + secondsPerBeat()).
  // getState(): () => { pattern, beatsPerMeasure } — read fresh each frame so
  // section/loop changes are picked up without re-creating the lane.
  function draw(metronome, getState) {
    resize();
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    ctx2d.clearRect(0, 0, w, h);

    const { pattern, beatsPerMeasure } = getState();
    const chars = parsePattern(pattern);
    if (!chars.length) {
      ctx2d.fillStyle = DIM;
      ctx2d.font = '13px Inter, sans-serif';
      ctx2d.fillText('No fixed strum pattern for this section (fingerpicked / free rhythm).', 12, h / 2 + 4);
      return;
    }

    const secondsPerMeasure = beatsPerMeasure * metronome.secondsPerBeat();
    const t = metronome.running ? metronome.elapsedSeconds() % secondsPerMeasure : 0;
    const visibleSeconds = secondsPerMeasure * 1.15;
    const pxPerSecond = w / visibleSeconds;
    const hitLineX = w * 0.16;

    // hit line
    ctx2d.strokeStyle = ACCENT;
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    ctx2d.moveTo(hitLineX, 4);
    ctx2d.lineTo(hitLineX, h - 4);
    ctx2d.stroke();

    const blockW = 40, blockH = h - 20;
    chars.forEach((c, i) => {
      const eventTime = (i / chars.length) * secondsPerMeasure;
      [-1, 0, 1].forEach((k) => {
        const actualTime = eventTime + k * secondsPerMeasure;
        const deltaT = actualTime - t;
        const x = hitLineX + deltaT * pxPerSecond;
        if (x < -blockW || x > w + blockW) return;

        const isHit = Math.abs(deltaT) < 0.09 && metronome.running;
        const isRest = c === '.';
        ctx2d.save();
        const scale = isHit ? 1.18 : 1;
        const cx = x, cy = h / 2;
        ctx2d.translate(cx, cy);
        ctx2d.scale(scale, scale);

        if (!isRest) {
          ctx2d.fillStyle = isHit ? ACCENT : (c === 'D' ? ACCENT2 : DIM);
          roundRect(ctx2d, -blockW / 2, -blockH / 2, blockW, blockH, 8);
          ctx2d.fill();
          ctx2d.fillStyle = isHit ? '#241503' : (c === 'D' ? '#052420' : TEXT);
          ctx2d.font = '700 20px Sora, sans-serif';
          ctx2d.textAlign = 'center';
          ctx2d.textBaseline = 'middle';
          ctx2d.fillText(c === 'D' ? '↓' : '↑', 0, 1);
        } else {
          ctx2d.strokeStyle = DIM;
          ctx2d.lineWidth = 1.5;
          ctx2d.beginPath();
          ctx2d.arc(0, 0, 4, 0, Math.PI * 2);
          ctx2d.stroke();
        }
        ctx2d.restore();
      });
    });
  }

  function roundRect(c, x, y, width, height, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + width, y, x + width, y + height, r);
    c.arcTo(x + width, y + height, x, y + height, r);
    c.arcTo(x, y + height, x, y, r);
    c.arcTo(x, y, x + width, y, r);
    c.closePath();
  }

  return { draw };
}
