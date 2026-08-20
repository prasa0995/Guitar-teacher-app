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
  card.appendChild(h('p', { class: 'muted' }, "Uses your microphone — audio never leaves your device. Pluck one string at a time."));

  const tuningSel = h('select', {});
  Object.entries(TUNINGS).forEach(([key, t]) => tuningSel.appendChild(h('option', { value: key }, t.label)));
  card.appendChild(h('label', {}, 'Tuning'));
  card.appendChild(tuningSel);

  const readout = h('div', { style: 'text-align:center;margin-top:20px;' });
  const noteBig = h('div', { style: 'font-size:48px;font-weight:800;' }, '—');
  const centsText = h('div', { class: 'muted' }, 'Play a string');
  const meter = h('div', { style: 'height:10px;background:var(--bg-elev-2);border-radius:6px;margin-top:10px;position:relative;' });
  const needle = h('div', { style: 'position:absolute;top:-4px;left:50%;width:4px;height:18px;background:var(--accent);border-radius:2px;transform:translateX(-50%);' });
  meter.appendChild(needle);
  readout.appendChild(noteBig);
  readout.appendChild(centsText);
  readout.appendChild(meter);
  card.appendChild(readout);

  let tuner = null;
  const btn = h('button', { class: 'primary', style: 'margin-top:14px;' }, '🎤 Start tuner');
  btn.onclick = async () => {
    if (tuner) { tuner.stop(); tuner = null; btn.textContent = '🎤 Start tuner'; noteBig.textContent = '—'; return; }
    try {
      tuner = new Tuner((freq) => {
        if (!freq) { centsText.textContent = 'Listening…'; return; }
        const { string, cents } = closestString(freq, tuningSel.value);
        noteBig.textContent = string.name.replace(/\d/, '');
        const inTune = Math.abs(cents) < 5;
        noteBig.style.color = inTune ? 'var(--good)' : Math.abs(cents) < 15 ? 'var(--accent)' : 'var(--danger)';
        centsText.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(0)} cents ${inTune ? '— in tune!' : cents > 0 ? '(flatten it)' : '(tighten it)'}`;
        const pct = Math.max(-50, Math.min(50, cents));
        needle.style.left = `${50 + pct}%`;
      });
      await tuner.start();
      btn.textContent = '⏹ Stop tuner';
    } catch (e) {
      centsText.textContent = 'Microphone access denied or unavailable.';
    }
  };
  card.appendChild(btn);
  body.appendChild(card);
}
