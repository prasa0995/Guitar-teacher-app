import { api, h } from '../app.js';
import { setScreenContext } from '../components/aiChat.js';

export function register(registerRoute) {
  registerRoute('skills', render);
}

const STATUSES = ['not_learned', 'learning', 'comfortable', 'mastered'];

async function render(main) {
  setScreenContext({ screen: 'skills' });
  const { techniques } = await api('/techniques');

  main.innerHTML = '';
  main.appendChild(h('h1', {}, 'My Techniques'));
  main.appendChild(h('p', { class: 'muted' }, 'Track every technique you know. The AI uses this to decide which songs to recommend.'));

  const grid = h('div', { class: 'grid grid-3' });
  main.appendChild(grid);

  function draw() {
    grid.innerHTML = '';
    techniques.forEach((t) => {
      const card = h('div', { class: 'card' });
      card.appendChild(h('h3', {}, t.name + (t.custom ? ' ✏️' : '')));
      card.appendChild(h('p', { class: 'muted' }, t.description));
      const row = h('div', { class: 'row wrap' });
      STATUSES.forEach((s) => {
        const btn = h('button', { class: t.status === s ? 'primary' : 'ghost', style: 'font-size:12px;padding:6px 10px;' }, s.replace('_', ' '));
        btn.onclick = async () => {
          await api(`/techniques/${t.id}/status`, { method: 'PUT', body: { status: s } });
          t.status = s; draw();
        };
        row.appendChild(btn);
      });
      card.appendChild(row);
      grid.appendChild(card);
    });
  }
  draw();

  const addCard = h('div', { class: 'card', style: 'margin-top:16px;' });
  addCard.appendChild(h('h3', {}, 'Add a custom technique'));
  const name = h('input', { placeholder: 'Technique name, e.g. "Travis picking"' });
  const desc = h('input', { placeholder: 'Short description (optional)' });
  addCard.appendChild(h('div', { class: 'grid', style: 'gap:8px;margin:10px 0;' }, [name, desc]));
  addCard.appendChild(h('button', { class: 'primary', onclick: async () => {
    if (!name.value.trim()) return;
    const { technique } = await api('/techniques', { method: 'POST', body: { name: name.value.trim(), description: desc.value.trim() } });
    techniques.push({ ...technique, status: 'learning' });
    name.value = ''; desc.value = '';
    draw();
  } }, 'Add technique'));
  main.appendChild(addCard);
}
