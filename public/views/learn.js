import { api, h } from '../app.js';
import { setScreenContext } from '../components/aiChat.js';

export function register(registerRoute) {
  registerRoute('learn', render);
}

async function render(main) {
  setScreenContext({ screen: 'learn' });
  const { curriculum } = await api('/curriculum');
  main.innerHTML = '';
  main.appendChild(h('h1', {}, 'Learn'));
  main.appendChild(h('p', { class: 'muted' }, 'Your structured path from zero to your first songs. Complete lessons in order — each one unlocks the next.'));

  let openId = null;
  const list = h('div', { class: 'grid', style: 'gap:10px;' });
  main.appendChild(list);

  function draw() {
    list.innerHTML = '';
    curriculum.forEach((lesson, i) => {
      const prevDone = i === 0 || curriculum[i - 1].progress.status === 'completed';
      const status = lesson.progress.status;
      const card = h('div', { class: 'card', style: prevDone ? '' : 'opacity:0.5;' });
      const header = h('div', { class: 'row', style: 'justify-content:space-between;cursor:pointer;' }, [
        h('div', {}, [h('h3', {}, `${lesson.order}. ${lesson.title}`), h('p', { class: 'muted' }, lesson.summary)]),
        h('span', { class: `pill status-${status === 'completed' ? 'mastered' : status === 'in_progress' ? 'learning' : 'not_learned'}` }, status.replace('_', ' ')),
      ]);
      header.onclick = () => { if (!prevDone) return; openId = openId === lesson.id ? null : lesson.id; draw(); };
      card.appendChild(header);

      if (openId === lesson.id) {
        card.appendChild(h('p', { style: 'margin-top:10px;' }, lesson.content));
        const actions = h('div', { class: 'row', style: 'margin-top:10px;' });
        if (status !== 'completed') {
          actions.appendChild(h('button', { class: 'secondary', onclick: async () => {
            await api(`/curriculum/${lesson.id}/status`, { method: 'PUT', body: { status: 'in_progress' } });
            lesson.progress.status = 'in_progress'; draw();
          } }, 'Mark in progress'));
          actions.appendChild(h('button', { class: 'primary', onclick: async () => {
            await api(`/curriculum/${lesson.id}/status`, { method: 'PUT', body: { status: 'completed' } });
            lesson.progress.status = 'completed';
            if (curriculum[i + 1]) openId = curriculum[i + 1].id; else openId = null;
            draw();
          } }, 'Mark complete'));
        } else {
          actions.appendChild(h('span', { class: 'muted' }, '✓ Completed'));
        }
        card.appendChild(actions);
      }
      list.appendChild(card);
    });
  }
  draw();
}
