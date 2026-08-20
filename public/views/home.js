import { api, h, navigate } from '../app.js';
import { setScreenContext } from '../components/aiChat.js';

export function register(registerRoute) {
  registerRoute('home', render);
}

async function render(main) {
  setScreenContext({ screen: 'home' });
  const [{ stats, todaysPlan, weakAreas }, { ready, almostReady }] = await Promise.all([
    api('/progress'),
    api('/songs/recommended'),
  ]);

  main.innerHTML = '';
  main.appendChild(h('h1', {}, 'Home'));
  main.appendChild(h('p', { class: 'muted' }, `${stats.streak}-day streak · ${stats.chordsLearned}/${stats.chordsTotal} chords · ${stats.totalMinutes} min practiced total`));

  const planCard = h('div', { class: 'card' });
  planCard.appendChild(h('h2', {}, "What should I practice today?"));
  planCard.appendChild(h('p', { class: 'muted' }, todaysPlan.rationale));
  const blockList = h('div', { class: 'grid', style: 'gap:8px;margin:10px 0;' });
  todaysPlan.blocks.forEach((b) => {
    blockList.appendChild(h('div', { class: 'row', style: 'justify-content:space-between;background:var(--bg-elev-2);padding:10px 12px;border-radius:8px;' }, [
      h('span', {}, b.label), h('span', { class: 'pill' }, `${b.minutes} min`),
    ]));
  });
  planCard.appendChild(blockList);
  planCard.appendChild(h('button', { class: 'primary', onclick: () => navigate('#practice') }, 'Start practice session'));

  const grid = h('div', { class: 'grid grid-3', style: 'margin-top:16px;' });
  grid.appendChild(statTile(stats.chordsLearned + '/' + stats.chordsTotal, 'Chords learned'));
  grid.appendChild(statTile(stats.techniquesLearned + '/' + stats.techniquesTotal, 'Techniques learned'));
  grid.appendChild(statTile(stats.songsLearned + '/' + stats.songsTotal, 'Songs learned'));

  main.appendChild(planCard);
  main.appendChild(grid);

  if (weakAreas.length) {
    const weak = h('div', { class: 'card', style: 'margin-top:16px;' });
    weak.appendChild(h('h3', {}, 'Weak areas'));
    weak.appendChild(h('ul', {}, weakAreas.map((w) => h('li', {}, w))));
    main.appendChild(weak);
  }

  const songsCard = h('div', { class: 'card', style: 'margin-top:16px;' });
  songsCard.appendChild(h('h3', {}, "You're ready for these songs"));
  if (ready.length) {
    songsCard.appendChild(h('div', { class: 'row wrap' }, ready.map((s) =>
      h('button', { onclick: () => navigate(`#song/${s.id}`) }, s.title)
    )));
  } else {
    songsCard.appendChild(h('p', { class: 'muted' }, 'None yet — keep building your chord skills.'));
  }
  if (almostReady.length) {
    songsCard.appendChild(h('p', { class: 'muted', style: 'margin-top:10px;' },
      `Almost ready: ${almostReady.map((a) => `${a.song.title} (needs ${a.missing.join(', ')})`).join('; ')}`));
  }
  main.appendChild(songsCard);
}

function statTile(num, label) {
  return h('div', { class: 'stat-tile' }, [h('div', { class: 'num' }, String(num)), h('div', { class: 'label' }, label)]);
}
