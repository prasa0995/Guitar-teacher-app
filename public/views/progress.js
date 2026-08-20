import { api, h } from '../app.js';
import { setScreenContext } from '../components/aiChat.js';

export function register(registerRoute) {
  registerRoute('progress', render);
}

const STATUSES = ['not_learned', 'learning', 'comfortable', 'mastered'];

async function render(main) {
  setScreenContext({ screen: 'progress' });
  const [{ stats, weakAreas, songBpmProgress }, { sessions }, { chords }, { techniques }] = await Promise.all([
    api('/progress'),
    api('/practice/history'),
    api('/chords'),
    api('/techniques'),
  ]);

  main.innerHTML = '';
  main.appendChild(h('h1', {}, 'Progress'));
  main.appendChild(h('p', { class: 'muted' }, 'A real picture of where you are — not badges for badges\' sake.'));

  const grid = h('div', { class: 'grid grid-3' });
  [
    [stats.streak, 'Day streak'],
    [stats.daysPracticed, 'Days practiced'],
    [stats.totalMinutes, 'Total minutes'],
    [`${stats.chordsLearned}/${stats.chordsTotal}`, 'Chords learned'],
    [`${stats.techniquesLearned}/${stats.techniquesTotal}`, 'Techniques learned'],
    [`${stats.songsLearned}/${stats.songsTotal}`, 'Songs learned'],
    [stats.lessonsCompleted, 'Lessons completed'],
    [stats.avgQuizScore != null ? stats.avgQuizScore + '%' : '—', 'Avg quiz score'],
  ].forEach(([num, label]) => grid.appendChild(statTile(num, label)));
  main.appendChild(grid);

  const editCard = h('div', { class: 'card', style: 'margin-top:16px;' });
  editCard.appendChild(h('h3', {}, 'Your chords & techniques'));
  editCard.appendChild(h('p', { class: 'muted' }, "Everything you've marked so far — fix anything that's wrong, or set what you've picked up since."));

  const tabs = h('div', { class: 'section-nav' });
  const body = h('div', { style: 'margin-top:10px;' });
  editCard.appendChild(tabs);
  editCard.appendChild(body);
  let active = 'chords';

  function statusButtons(item, endpoint, onUpdated) {
    const row = h('div', { class: 'row wrap' });
    STATUSES.forEach((s) => {
      const btn = h('button', { class: item.status === s ? 'primary' : 'ghost', style: 'font-size:11.5px;padding:5px 10px;' }, s.replace('_', ' '));
      btn.onclick = async () => {
        await api(`${endpoint}/${item.id}/status`, { method: 'PUT', body: { status: s } });
        item.status = s;
        onUpdated();
      };
      row.appendChild(btn);
    });
    return row;
  }

  function drawEditBody() {
    body.innerHTML = '';
    const items = active === 'chords' ? chords : techniques;
    const endpoint = active === 'chords' ? '/chords' : '/techniques';
    const list = h('div', { class: 'grid', style: 'gap:8px;' });
    items.forEach((item) => {
      const line = h('div', { class: 'row wrap', style: 'justify-content:space-between;background:var(--bg-elev-2);padding:10px 12px;border-radius:9px;' }, [
        h('strong', { style: 'min-width:110px;' }, item.name),
        statusButtons(item, endpoint, drawEditBody),
      ]);
      list.appendChild(line);
    });
    body.appendChild(list);
  }

  ['chords', 'techniques'].forEach((key) => {
    const btn = h('button', { class: active === key ? 'active' : '' }, key === 'chords' ? 'Chords' : 'Techniques');
    btn.onclick = () => { active = key; Array.from(tabs.children).forEach((c) => c.classList.remove('active')); btn.classList.add('active'); drawEditBody(); };
    tabs.appendChild(btn);
  });
  tabs.firstChild.classList.add('active');
  drawEditBody();
  main.appendChild(editCard);

  if (weakAreas.length) {
    const weak = h('div', { class: 'card', style: 'margin-top:16px;' });
    weak.appendChild(h('h3', {}, 'Weak areas to focus on'));
    weak.appendChild(h('ul', {}, weakAreas.map((w) => h('li', {}, w))));
    main.appendChild(weak);
  }

  if (songBpmProgress.length) {
    const bpmCard = h('div', { class: 'card', style: 'margin-top:16px;' });
    bpmCard.appendChild(h('h3', {}, 'Song tempo progress'));
    const table = h('table', { class: 'data-table' });
    table.innerHTML = '<tr><th>Song</th><th>Current BPM</th><th>Status</th></tr>';
    songBpmProgress.forEach((s) => table.appendChild(h('tr', {}, [h('td', {}, s.songId), h('td', {}, String(s.currentBpm || '—')), h('td', {}, s.status)])));
    bpmCard.appendChild(table);
    main.appendChild(bpmCard);
  }

  const histCard = h('div', { class: 'card', style: 'margin-top:16px;' });
  histCard.appendChild(h('h3', {}, 'Recent practice sessions'));
  if (sessions.length) {
    const table = h('table', { class: 'data-table' });
    table.innerHTML = '<tr><th>Date</th><th>Minutes</th><th>Source</th></tr>';
    sessions.slice(-10).reverse().forEach((s) => table.appendChild(h('tr', {}, [
      h('td', {}, new Date(s.date).toLocaleDateString()), h('td', {}, String(s.durationMin)), h('td', {}, s.source),
    ])));
    histCard.appendChild(table);
  } else {
    histCard.appendChild(h('p', { class: 'muted' }, 'No sessions logged yet — head to Practice to start one.'));
  }
  main.appendChild(histCard);
}

function statTile(num, label) {
  return h('div', { class: 'stat-tile' }, [h('div', { class: 'num' }, String(num)), h('div', { class: 'label' }, label)]);
}
