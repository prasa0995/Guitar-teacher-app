import { h } from '../app.js';
import { setScreenContext } from '../components/aiChat.js';

export function register(registerRoute) {
  registerRoute('fretboard', render);
}

const SHARP_NOTES = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];
const FLAT_NOTES = ['E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb'];
// Open strings low->high: E A D G B E. Index into chromatic array above (rooted at E).
const OPEN_OFFSETS = [0, 5, 10, 3, 7, 0]; // semitone offset from E for each open string
const FRETS = 12;

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
};
const CHORDS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dom7: [0, 4, 7, 10],
};
const ROOTS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

function noteAt(stringIdx, fret, useFlats) {
  const names = useFlats ? FLAT_NOTES : SHARP_NOTES;
  const idx = (OPEN_OFFSETS[stringIdx] + fret) % 12;
  return names[idx];
}
function semitone(noteLetter) {
  const idx = SHARP_NOTES.indexOf(noteLetter);
  if (idx >= 0) return idx;
  return FLAT_NOTES.indexOf(noteLetter);
}

function render(main) {
  setScreenContext({ screen: 'fretboard' });
  const view = { mode: 'notes', root: 'A', scaleType: 'major', chordType: 'major', useFlats: false, findNote: null, quiz: null };

  main.innerHTML = '';
  main.appendChild(h('h1', {}, 'Interactive Fretboard'));
  main.appendChild(h('p', { class: 'muted' }, 'Click any fret to see the note. Switch modes to overlay scales, chords, or practice note ID.'));

  const controls = h('div', { class: 'card' });
  const boardWrap = h('div', { class: 'fretboard-wrap card', style: 'margin-top:16px;' });
  const infoBox = h('div', { class: 'card', style: 'margin-top:16px;' });
  main.appendChild(controls);
  main.appendChild(boardWrap);
  main.appendChild(infoBox);

  function drawControls() {
    controls.innerHTML = '';
    const modeRow = h('div', { class: 'section-nav' });
    ['notes', 'scale', 'chord', 'find', 'quiz'].forEach((m) => {
      const btn = h('button', { class: view.mode === m ? 'active' : '' }, m);
      btn.onclick = () => { view.mode = m; view.quiz = m === 'quiz' ? newQuiz() : null; drawControls(); drawBoard(); };
      modeRow.appendChild(btn);
    });
    controls.appendChild(modeRow);

    const optRow = h('div', { class: 'row wrap', style: 'margin-top:10px;' });
    optRow.appendChild(toggle('Show flats (♭) instead of sharps (♯)', view.useFlats, (v) => { view.useFlats = v; drawControls(); drawBoard(); }));

    if (view.mode === 'scale' || view.mode === 'chord' || view.mode === 'find') {
      const rootSel = h('select', {});
      ROOTS.forEach((r) => rootSel.appendChild(h('option', { value: r, selected: r === view.root ? 'selected' : undefined }, r)));
      rootSel.onchange = () => { view.root = rootSel.value; drawBoard(); };
      optRow.appendChild(h('label', { style: 'margin:0;' }, ['Root: ', rootSel]));
    }
    if (view.mode === 'scale') {
      const sel = h('select', {});
      Object.keys(SCALES).forEach((s) => sel.appendChild(h('option', { value: s, selected: s === view.scaleType ? 'selected' : undefined }, s)));
      sel.onchange = () => { view.scaleType = sel.value; drawBoard(); };
      optRow.appendChild(h('label', { style: 'margin:0;' }, ['Scale: ', sel]));
    }
    if (view.mode === 'chord') {
      const sel = h('select', {});
      Object.keys(CHORDS).forEach((s) => sel.appendChild(h('option', { value: s, selected: s === view.chordType ? 'selected' : undefined }, s)));
      sel.onchange = () => { view.chordType = sel.value; drawBoard(); };
      optRow.appendChild(h('label', { style: 'margin:0;' }, ['Chord: ', sel]));
    }
    controls.appendChild(optRow);
  }

  function toggle(label, val, onChange) {
    const btn = h('button', { class: val ? 'primary' : 'ghost' }, label);
    btn.onclick = () => { onChange(!val); };
    return btn;
  }

  function highlightSet() {
    if (view.mode === 'scale') {
      const rootSemi = semitone(view.root);
      return new Set(SCALES[view.scaleType].map((iv) => (rootSemi + iv) % 12));
    }
    if (view.mode === 'chord') {
      const rootSemi = semitone(view.root);
      return new Set(CHORDS[view.chordType].map((iv) => (rootSemi + iv) % 12));
    }
    if (view.mode === 'find' && view.findNote) {
      return new Set([semitone(view.findNote)]);
    }
    return null;
  }

  function newQuiz() {
    const stringIdx = Math.floor(Math.random() * 6);
    const fret = Math.floor(Math.random() * (FRETS + 1));
    return { stringIdx, fret, answered: false };
  }

  function drawBoard() {
    boardWrap.innerHTML = '';
    const highlight = highlightSet();
    const cellW = 56, cellH = 40, labelW = 50;
    const width = labelW + cellW * (FRETS + 1);
    const height = cellH * 6 + 20;
    let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
    for (let f = 0; f <= FRETS; f++) {
      const x = labelW + f * cellW;
      svg += `<line x1="${x}" y1="10" x2="${x}" y2="${height - 10}" stroke="#2a323d"/>`;
    }
    for (let s = 0; s < 6; s++) {
      const y = 10 + s * cellH + cellH / 2;
      svg += `<text x="10" y="${y + 4}" font-size="11" fill="#9aa5b1">${['E','A','D','G','B','E'][s]}</text>`;
    }
    boardWrap.innerHTML = svg + '</svg>';
    const svgEl = boardWrap.querySelector('svg');

    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= FRETS; f++) {
        const x = labelW + f * cellW + cellW / 2;
        const y = 10 + s * cellH + cellH / 2;
        const semi = (OPEN_OFFSETS[s] + f) % 12;
        const note = noteAt(s, f, view.useFlats);
        const isHighlighted = highlight && highlight.has(semi);
        const isQuizTarget = view.mode === 'quiz' && view.quiz && view.quiz.stringIdx === s && view.quiz.fret === f;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.style.cursor = 'pointer';
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', 14);
        circle.setAttribute('fill', isQuizTarget ? '#4fb0a5' : isHighlighted ? '#e8a33d' : 'transparent');
        circle.setAttribute('stroke', '#3a4553');
        g.appendChild(circle);
        if (view.mode !== 'quiz' || isQuizTarget === false) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', x); text.setAttribute('y', y + 4);
          text.setAttribute('font-size', '10'); text.setAttribute('text-anchor', 'middle');
          text.setAttribute('fill', isHighlighted ? '#1a1305' : '#eef1f5');
          text.textContent = (view.mode === 'notes' || isHighlighted) ? note : '';
          g.appendChild(text);
        }
        g.addEventListener('click', () => onCellClick(s, f, note));
        svgEl.appendChild(g);
      }
    }
  }

  function onCellClick(stringIdx, fret, note) {
    if (view.mode === 'quiz' && view.quiz && !view.quiz.answered) {
      const correctNote = noteAt(view.quiz.stringIdx, view.quiz.fret, view.useFlats);
      infoBox.innerHTML = '';
      if (stringIdx === view.quiz.stringIdx && fret === view.quiz.fret) {
        infoBox.appendChild(h('p', {}, `That's the target — now name it! It's ${correctNote}.`));
      } else {
        infoBox.appendChild(h('p', {}, `Click the highlighted target square, then check the note name below.`));
      }
      return;
    }
    infoBox.innerHTML = '';
    infoBox.appendChild(h('p', {}, `String ${stringIdx + 1} (${['low E','A','D','G','B','high E'][stringIdx]}), fret ${fret}:`));
    infoBox.appendChild(h('h3', {}, note));
    if (view.mode === 'find') {
      view.findNote = note;
      drawBoard();
    }
  }

  drawControls();
  drawBoard();
  infoBox.appendChild(h('p', { class: 'muted' }, 'Click a fret to see its note name.'));
}
