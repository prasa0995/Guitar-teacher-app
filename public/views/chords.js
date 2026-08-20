import { api, h, navigate } from '../app.js';
import { chordDiagramSVG } from '../components/chordDiagram.js';
import { setScreenContext } from '../components/aiChat.js';
import { playChord } from '../components/guitarSynth.js';

export function register(registerRoute) {
  registerRoute('chords', render);
}

const FAMILIES = ['all', 'major', 'minor', '7th', 'major7', 'minor7', 'sus', 'add', 'power', 'barre'];

async function render(main) {
  setScreenContext({ screen: 'chords' });
  const { chords } = await api('/chords');
  let filter = 'all';
  let query = '';

  main.innerHTML = '';
  main.appendChild(h('h1', {}, 'Chord Library'));
  main.appendChild(h('p', { class: 'muted' }, `All ${chords.length} chords — every root note across major, minor, 7th, maj7, min7, sus4, and power-chord shapes. Click 🔊 to hear it strummed.`));

  const searchInput = h('input', { placeholder: 'Search chords, e.g. "C#m7" or "barre"', style: 'max-width:320px;margin-bottom:12px;' });
  main.appendChild(searchInput);

  const tabs = h('div', { class: 'section-nav' });
  const grid = h('div', { class: 'grid grid-3' });
  main.appendChild(tabs);
  main.appendChild(grid);

  searchInput.oninput = () => { query = searchInput.value.trim().toLowerCase(); draw(); };

  function draw() {
    tabs.innerHTML = '';
    FAMILIES.forEach((f) => {
      const btn = h('button', { class: filter === f ? 'active' : '' }, f);
      btn.onclick = () => { filter = f; draw(); };
      tabs.appendChild(btn);
    });

    grid.innerHTML = '';
    const list = chords.filter((c) =>
      (filter === 'all' || c.family === filter) &&
      (!query || c.id.toLowerCase().includes(query) || c.name.toLowerCase().includes(query))
    );
    if (!list.length) {
      grid.appendChild(h('p', { class: 'muted' }, 'No chords match.'));
      return;
    }
    list.forEach((c) => {
      const card = h('div', { class: 'card', style: 'cursor:pointer;text-align:center;position:relative;' });
      card.onclick = () => navigate(`#chord/${encodeURIComponent(c.id)}`);
      card.innerHTML = chordDiagramSVG(c);
      const playBtn = h('button', { class: 'ghost', style: 'position:absolute;top:12px;right:12px;padding:4px 9px;font-size:14px;', title: 'Play chord' }, '🔊');
      playBtn.onclick = (e) => { e.stopPropagation(); playChord(c); };
      card.appendChild(playBtn);
      card.appendChild(h('h3', {}, c.name));
      card.appendChild(h('span', { class: `pill status-${c.status}` }, c.status.replace('_', ' ')));
      grid.appendChild(card);
    });
  }
  draw();
}
