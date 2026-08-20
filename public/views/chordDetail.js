import { api, h, navigate } from '../app.js';
import { chordDiagramSVG } from '../components/chordDiagram.js';
import { setScreenContext } from '../components/aiChat.js';
import { playChord } from '../components/guitarSynth.js';

export function register(registerRoute) {
  registerRoute('chord', render);
}

const STRING_NAMES = ['E (low/thick)', 'A', 'D', 'G', 'B', 'E (high/thin)'];
const STATUSES = ['not_learned', 'learning', 'comfortable', 'mastered'];

async function render(main, [id]) {
  const { chord, related } = await api(`/chords/${encodeURIComponent(id)}`);
  setScreenContext({ screen: 'chord', chordId: id });

  main.innerHTML = '';
  main.appendChild(h('a', { href: '#chords' }, '← Back to Chord Library'));
  main.appendChild(h('h1', {}, chord.name));

  const top = h('div', { class: 'grid grid-2' });
  const diagramCard = h('div', { class: 'card', style: 'text-align:center;' });
  diagramCard.innerHTML = chordDiagramSVG(chord, { width: 200 });
  diagramCard.appendChild(h('button', { class: 'secondary', style: 'margin-top:12px;', onclick: () => playChord(chord) }, '🔊 Play chord'));
  top.appendChild(diagramCard);

  const infoCard = h('div', { class: 'card' });
  infoCard.appendChild(h('p', {}, chord.audioNote));
  const statusRow = h('div', { class: 'row wrap' });
  STATUSES.forEach((s) => {
    const btn = h('button', { class: chord.status === s ? 'primary' : 'ghost' }, s.replace('_', ' '));
    btn.onclick = async () => {
      await api(`/chords/${encodeURIComponent(chord.id)}/status`, { method: 'PUT', body: { status: s } });
      chord.status = s; render(main, [id]);
    };
    statusRow.appendChild(btn);
  });
  infoCard.appendChild(h('label', { style: 'margin-top:10px;' }, 'Your status'));
  infoCard.appendChild(statusRow);
  top.appendChild(infoCard);
  main.appendChild(top);

  const stringCard = h('div', { class: 'card', style: 'margin-top:16px;' });
  stringCard.appendChild(h('h3', {}, 'String by string'));
  const table = h('table', { class: 'data-table' });
  table.innerHTML = '<tr><th>String</th><th>What to play</th></tr>';
  chord.frets.forEach((f, i) => {
    const desc = f === null ? "Don't play (muted/skipped)" : f === 0 ? 'Open (no finger)' : `Fret ${f}, finger ${chord.fingers[i]}`;
    table.appendChild(h('tr', {}, [h('td', {}, STRING_NAMES[i]), h('td', {}, desc)]));
  });
  stringCard.appendChild(table);
  main.appendChild(stringCard);

  const mistakesCard = h('div', { class: 'card', style: 'margin-top:16px;' });
  mistakesCard.appendChild(h('h3', {}, 'Common mistakes'));
  mistakesCard.appendChild(h('ul', {}, chord.commonMistakes.map((m) => h('li', {}, m))));
  if (chord.beginnerVariant) {
    mistakesCard.appendChild(h('p', {}, [h('strong', {}, 'Beginner version: '), chord.beginnerVariant.label]));
  }
  main.appendChild(mistakesCard);

  if (related.length) {
    const relCard = h('div', { class: 'card', style: 'margin-top:16px;' });
    relCard.appendChild(h('h3', {}, 'Related chords'));
    relCard.appendChild(h('div', { class: 'row wrap' }, related.map((r) =>
      h('button', { class: 'ghost', onclick: () => navigate(`#chord/${encodeURIComponent(r.id)}`) }, r.name)
    )));
    main.appendChild(relCard);
  }
}
