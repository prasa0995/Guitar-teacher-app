import { api, h } from '../app.js';
import { Metronome } from '../components/metronome.js';
import { Tuner, TUNINGS, closestString } from '../components/tuner.js';
import { setScreenContext } from '../components/aiChat.js';

export function register(registerRoute) {
  registerRoute('practice', render);
}

async function render(main) {
  setScreenContext({ screen: 'practice' });
  main.innerHTML = '';
  main.appendChild(h('h1', {}, 'Practice'));

  const tabs = h('div', { class: 'section-nav' });
  const body = h('div', { style: 'margin-top:16px;' });
  main.appendChild(tabs);
  main.appendChild(body);

  const TABS = { session: 'Today\'s Session', metronome: 'Metronome', tuner: 'Tuner' };
  let active = 'session';
  Object.entries(TABS).forEach(([key, label]) => {
    const btn = h('button', { class: active === key ? 'active' : '' }, label);
    btn.onclick = () => { active = key; drawTabs(); drawBody(); };
    tabs.appendChild(btn);
  });
  function drawTabs() {
    Array.from(tabs.children).forEach((c, i) => c.classList.toggle('active', Object.keys(TABS)[i] === active));
  }
  async function drawBody() {
    body.innerHTML = '';
    if (active === 'session') await renderSession(body);
    else if (active === 'metronome') renderMetronomeTool(body);
    else if (active === 'tuner') renderTunerTool(body);
  }
  drawBody();
}

async function renderSession(body) {
  const { plan } = await api('/practice/generate', { method: 'POST', body: {} });
  const card = h('div', { class: 'card' });
  card.appendChild(h('h3', {}, `${plan.totalMinutes}-minute session`));
  card.appendChild(h('p', { class: 'muted' }, plan.rationale));

  let blockIndex = 0;
  const blockView = h('div', { style: 'margin-top:14px;' });
  card.appendChild(blockView);

  function drawBlock() {
    blockView.innerHTML = '';
    if (blockIndex >= plan.blocks.length) {
      blockView.appendChild(h('h3', {}, '🎉 Session complete!'));
      blockView.appendChild(h('button', { class: 'primary', onclick: async () => {
        await api('/practice/log', { method: 'POST', body: { durationMin: plan.totalMinutes, blocks: plan.blocks, source: 'generated' } });
        blockView.appendChild(h('p', { class: 'muted' }, 'Logged! Your streak and progress dashboard are updated.'));
      } }, 'Log this session'));
      return;
    }
    const b = plan.blocks[blockIndex];
    blockView.appendChild(h('div', { class: 'pill' }, `Block ${blockIndex + 1} of ${plan.blocks.length} · ${b.minutes} min`));
    blockView.appendChild(h('h2', { style: 'margin-top:8px;' }, b.label));
    blockView.appendChild(h('button', { class: 'primary', style: 'margin-top:10px;', onclick: () => { blockIndex++; drawBlock(); } }, 'Mark block done →'));
  }
  drawBlock();
  body.appendChild(card);
}

function renderMetronomeTool(body) {
  const state = { bpm: 80, beatsPerMeasure: 4, subdivision: 1, sound: 'click' };
  const met = new Metronome({ bpm: state.bpm, beatsPerMeasure: state.beatsPerMeasure, onBeat: onBeat });
  const card = h('div', { class: 'card' });
  card.appendChild(h('h3', {}, 'Metronome'));

  const dots = h('div', { class: 'beat-dots' });
  card.appendChild(dots);
  function onBeat({ beatNumber, isAccent }) {
    Array.from(dots.children).forEach((d, i) => d.classList.toggle('active', i === beatNumber));
  }
  function drawDots() {
    dots.innerHTML = '';
    for (let i = 0; i < state.beatsPerMeasure; i++) dots.appendChild(h('div', { class: 'beat-dot' }));
  }
  drawDots();

  const bpmRow = h('div', { class: 'row wrap' });
  const bpmLabel = h('span', { class: 'pill' }, `${state.bpm} BPM`);
  bpmRow.appendChild(bpmLabel);
  bpmRow.appendChild(h('button', { onclick: () => setBpm(state.bpm - 5) }, '−5'));
  bpmRow.appendChild(h('button', { onclick: () => setBpm(state.bpm + 5) }, '+5'));
  const slider = h('input', { type: 'range', min: '30', max: '220', value: String(state.bpm) });
  slider.oninput = () => setBpm(parseInt(slider.value, 10));
  bpmRow.appendChild(slider);
  bpmRow.appendChild(h('button', { onclick: () => { const bpm = met.tapTempo(); state.bpm = bpm; slider.value = bpm; bpmLabel.textContent = `${bpm} BPM`; } }, 'Tap tempo'));
  card.appendChild(bpmRow);

  function setBpm(n) {
    state.bpm = Math.max(30, Math.min(220, n));
    met.setBpm(state.bpm);
    bpmLabel.textContent = `${state.bpm} BPM`;
    slider.value = state.bpm;
  }

  const optRow = h('div', { class: 'row wrap', style: 'margin-top:10px;' });
  const tsSel = h('select', {});
  ['4/4', '3/4', '6/8', '2/4'].forEach((ts) => tsSel.appendChild(h('option', { value: ts }, ts)));
  tsSel.onchange = () => { state.beatsPerMeasure = parseInt(tsSel.value.split('/')[0], 10); met.beatsPerMeasure = state.beatsPerMeasure; drawDots(); };
  optRow.appendChild(h('label', { style: 'margin:0;' }, ['Time signature: ', tsSel]));

  const subSel = h('select', {});
  [['1', 'Quarter notes'], ['2', 'Eighth notes']].forEach(([v, l]) => subSel.appendChild(h('option', { value: v }, l)));
  subSel.onchange = () => { met.subdivision = parseInt(subSel.value, 10); };
  optRow.appendChild(h('label', { style: 'margin:0;' }, ['Subdivision: ', subSel]));

  const soundSel = h('select', {});
  [['click', 'Click'], ['beep', 'Beep'], ['wood', 'Woodblock']].forEach(([v, l]) => soundSel.appendChild(h('option', { value: v }, l)));
  soundSel.onchange = () => { met.sound = soundSel.value; };
  optRow.appendChild(h('label', { style: 'margin:0;' }, ['Sound: ', soundSel]));
  card.appendChild(optRow);

  const playBtn = h('button', { class: 'primary', style: 'margin-top:12px;', onclick: () => {
    if (met.running) { met.stop(); playBtn.textContent = '▶ Start'; }
    else { met.start(); playBtn.textContent = '⏸ Stop'; }
  } }, '▶ Start');
  card.appendChild(playBtn);
  body.appendChild(card);
}

function renderTunerTool(body) {
  const card = h('div', { class: 'card' });
  card.appendChild(h('h3', {}, 'Tuner'));
  card.appendChild(h('p', { class: 'muted' }, 'Uses your microphone — audio never leaves your device. Pluck one string at a time and let it ring; the needle settles once it locks onto a clear pitch.'));

  const tuningSel = h('select', {});
  Object.entries(TUNINGS).forEach(([key, t]) => tuningSel.appendChild(h('option', { value: key }, t.label)));
  card.appendChild(h('label', {}, 'Tuning'));
  card.appendChild(tuningSel);

  // Six string-select buttons — shows which string you're on at a glance,
  // and lets you tap one to see its target note before you even play it.
  const stringRow = h('div', { class: 'row wrap', style: 'margin-top:14px;justify-content:center;gap:8px;' });
  card.appendChild(stringRow);

  function drawStrings(activeIdx) {
    stringRow.innerHTML = '';
    TUNINGS[tuningSel.value].strings.forEach((s, i) => {
      stringRow.appendChild(h('div', {
        style: `width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
          background:${i === activeIdx ? 'var(--accent)' : 'var(--bg-elev-2)'};
          color:${i === activeIdx ? '#241503' : 'var(--text-dim)'};
          border:1px solid ${i === activeIdx ? 'transparent' : 'var(--border)'};
          transition:all 0.15s ease;`,
      }, s.name.replace(/\d/, '')));
    });
  }
  drawStrings(-1);
  tuningSel.onchange = () => drawStrings(-1);

  // Gauge: horizontal track from -50 to +50 cents, with a green "in tune"
  // center zone and tick marks, so the reading is legible at a glance.
  const readout = h('div', { style: 'text-align:center;margin-top:22px;' });
  const noteBig = h('div', { style: 'font-size:56px;font-weight:800;font-family:var(--font-display);transition:color 0.15s ease;', class: '' }, '—');
  const statusText = h('div', { class: 'muted', style: 'font-size:14px;font-weight:600;min-height:20px;margin-top:2px;' }, 'Pluck a string to begin');

  const gaugeWrap = h('div', { style: 'position:relative;max-width:340px;margin:18px auto 4px;height:54px;' });
  const track = h('div', { style: 'position:absolute;top:22px;left:0;right:0;height:8px;background:var(--bg-elev-3);border-radius:5px;overflow:hidden;' });
  const inTuneZone = h('div', { style: 'position:absolute;left:46%;width:8%;top:0;bottom:0;background:rgba(79,192,127,0.35);' });
  track.appendChild(inTuneZone);
  const needle = h('div', { style: 'position:absolute;top:10px;left:50%;width:3px;height:34px;background:var(--text-dim);border-radius:2px;transform:translateX(-50%);transition:left 0.08s ease-out, background 0.15s ease;' });
  const ticks = h('div', { style: 'position:absolute;top:32px;left:0;right:0;display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);' });
  ['♭ -50', '-25', '0', '+25', '+50 ♯'].forEach((t) => ticks.appendChild(h('span', {}, t)));
  gaugeWrap.appendChild(track);
  gaugeWrap.appendChild(needle);
  gaugeWrap.appendChild(ticks);

  readout.appendChild(noteBig);
  readout.appendChild(statusText);
  readout.appendChild(gaugeWrap);
  card.appendChild(readout);

  let tuner = null;
  let smoothedCents = 0;
  let silenceTimer = null;
  const btn = h('button', { class: 'primary', style: 'margin-top:10px;' }, '🎤 Start tuner');

  function setIdle() {
    noteBig.textContent = '—';
    noteBig.style.color = 'var(--text-dim)';
    statusText.textContent = tuner ? '🎧 Listening — pluck a string' : 'Pluck a string to begin';
    needle.style.left = '50%';
    needle.style.background = 'var(--text-dim)';
    drawStrings(-1);
  }

  btn.onclick = async () => {
    if (tuner) {
      tuner.stop(); tuner = null;
      clearTimeout(silenceTimer);
      btn.textContent = '🎤 Start tuner';
      setIdle();
      return;
    }
    try {
      tuner = new Tuner((freq) => {
        clearTimeout(silenceTimer);
        if (!freq) {
          // Brief gap is normal (string decaying); only go idle after real silence.
          silenceTimer = setTimeout(setIdle, 900);
          return;
        }
        const { string, cents } = closestString(freq, tuningSel.value);
        // Exponential smoothing so the needle settles instead of jittering
        // frame-to-frame from natural pitch-detection noise.
        smoothedCents = smoothedCents * 0.7 + cents * 0.3;

        const idx = TUNINGS[tuningSel.value].strings.indexOf(string);
        drawStrings(idx);

        noteBig.textContent = string.name.replace(/\d/, '');
        const abs = Math.abs(smoothedCents);
        const inTune = abs < 5;
        const close = abs < 15;
        const color = inTune ? 'var(--good)' : close ? 'var(--accent)' : 'var(--danger)';
        noteBig.style.color = color;
        needle.style.background = color;

        statusText.textContent = inTune
          ? '🎯 Perfectly in tune!'
          : smoothedCents > 0
            ? `Slightly sharp — loosen the string ↓ (${smoothedCents.toFixed(0)}¢)`
            : `Slightly flat — tighten the string ↑ (${smoothedCents.toFixed(0)}¢)`;

        const pct = Math.max(-50, Math.min(50, smoothedCents));
        needle.style.left = `${50 + pct}%`;
      });
      await tuner.start();
      btn.textContent = '⏹ Stop tuner';
      statusText.textContent = '🎧 Listening — pluck a string';
    } catch (e) {
      statusText.textContent = 'Microphone access denied or unavailable.';
    }
  };
  card.appendChild(btn);
  body.appendChild(card);
}
