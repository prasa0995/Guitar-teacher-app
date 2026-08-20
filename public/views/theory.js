import { api, h } from '../app.js';
import { setScreenContext } from '../components/aiChat.js';

export function register(registerRoute) {
  registerRoute('theory', render);
}

async function render(main, [openId]) {
  setScreenContext({ screen: 'theory' });
  const { theory } = await api('/theory');
  main.innerHTML = '';
  main.appendChild(h('h1', {}, 'Guitar Theory'));
  main.appendChild(h('p', { class: 'muted' }, 'Starts from absolute basics. Simple explanation first — go as deep as you want.'));

  ['beginner', 'intermediate', 'advanced'].forEach((tier) => {
    const topics = theory.filter((t) => t.tier === tier);
    if (!topics.length) return;
    main.appendChild(h('h2', { style: 'margin-top:20px;text-transform:capitalize;' }, tier));
    const list = h('div', { class: 'grid', style: 'gap:10px;' });
    topics.forEach((t) => list.appendChild(topicCard(t, t.id === openId)));
    main.appendChild(list);
  });
}

function topicCard(topic, startOpen) {
  let open = startOpen;
  const card = h('div', { class: 'card' });

  function draw() {
    card.innerHTML = '';
    const header = h('div', { style: 'cursor:pointer;' }, [h('h3', {}, topic.title)]);
    header.onclick = () => { open = !open; draw(); };
    card.appendChild(header);

    if (open) {
      card.appendChild(h('p', {}, topic.explanation));
      card.appendChild(h('p', { class: 'muted' }, `Fretboard example: ${topic.fretboardExample}`));

      const quizWrap = h('div', { style: 'margin-top:10px;' });
      topic.quiz.forEach((q, qi) => {
        const qBox = h('div', { style: 'margin-bottom:8px;' });
        qBox.appendChild(h('p', {}, q.q));
        const optRow = h('div', { class: 'row wrap' });
        q.options.forEach((opt, oi) => {
          const btn = h('button', { class: 'ghost' }, opt);
          btn.onclick = () => {
            btn.classList.add(oi === q.answer ? 'primary' : 'danger');
            btn.textContent = opt + (oi === q.answer ? ' ✓' : ' ✗ (correct: ' + q.options[q.answer] + ')');
            optRow.querySelectorAll('button').forEach((b) => (b.disabled = true));
          };
          optRow.appendChild(btn);
        });
        qBox.appendChild(optRow);
        quizWrap.appendChild(qBox);
      });
      card.appendChild(quizWrap);

      card.appendChild(h('button', { class: 'ghost', onclick: () => document.getElementById('ai-fab').click() }, '✨ Ask AI to explain this differently'));
    }
  }
  draw();
  return card;
}
