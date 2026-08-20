import { api, h } from '../app.js';

export async function render(root, onDone) {
  const { chords } = await api('/chords');
  const { techniques } = await api('/techniques');

  const answers = {
    hasPlayedBefore: null,
    guitarType: null,
    daysPerWeek: 3,
    minutesPerDay: 20,
    goalSongTitles: '',
    knownChordIds: [],
    knownTechniqueIds: [],
  };

  let step = 0;
  const wrap = h('div', { class: 'onboard-wrap', style: 'max-width:620px;margin:50px auto;padding:0 16px;' });
  root.appendChild(wrap);

  const steps = [
    () => h('div', {}, [
      h('h2', {}, "Have you played guitar before?"),
      chipRow(['No, never', 'A little', 'Yes, some experience'], answers.hasPlayedBefore, (v) => { answers.hasPlayedBefore = v !== 'No, never'; }),
    ]),
    () => h('div', {}, [
      h('h2', {}, 'What type of guitar do you have?'),
      chipRow(['Acoustic', 'Electric', 'Classical/Nylon', "Don't have one yet"], answers.guitarType, (v) => { answers.guitarType = v; }),
    ]),
    () => h('div', {}, [
      h('h2', {}, 'How many days per week can you practice?'),
      numberField(answers.daysPerWeek, 1, 7, (v) => { answers.daysPerWeek = v; }),
    ]),
    () => h('div', {}, [
      h('h2', {}, 'How many minutes per day?'),
      numberField(answers.minutesPerDay, 5, 120, (v) => { answers.minutesPerDay = v; }),
    ]),
    () => h('div', {}, [
      h('h2', {}, 'Any songs you want to learn eventually?'),
      h('p', { class: 'muted' }, "Optional — we'll factor this in as your recommendations grow."),
      h('input', { type: 'text', placeholder: 'e.g. Wonderwall, Riptide', oninput: (e) => { answers.goalSongTitles = e.target.value; } }),
    ]),
    () => h('div', {}, [
      h('h2', {}, 'Which chords do you already know?'),
      h('p', { class: 'muted' }, "It's okay to select none — we'll start from the very beginning."),
      multiChip(chords.map((c) => ({ id: c.id, label: c.name })), answers.knownChordIds),
    ]),
    () => h('div', {}, [
      h('h2', {}, 'Which techniques do you already know?'),
      multiChip(techniques.map((t) => ({ id: t.id, label: t.name })), answers.knownTechniqueIds),
    ]),
  ];

  function chipRow(options, selected, onSelect) {
    const row = h('div', { class: 'chip-select' });
    options.forEach((opt) => {
      const chip = h('div', { class: 'chip' + (selected === opt ? ' selected' : '') }, opt);
      chip.onclick = () => { onSelect(opt); Array.from(row.children).forEach((c) => c.classList.remove('selected')); chip.classList.add('selected'); };
      row.appendChild(chip);
    });
    return row;
  }

  function numberField(val, min, max, onChange) {
    const input = h('input', { type: 'number', min, max, value: val });
    input.oninput = () => onChange(parseInt(input.value || min, 10));
    return input;
  }

  function multiChip(items, selectedArr) {
    const row = h('div', { class: 'chip-select' });
    items.forEach((item) => {
      const chip = h('div', { class: 'chip' }, item.label);
      chip.onclick = () => {
        const idx = selectedArr.indexOf(item.id);
        if (idx >= 0) { selectedArr.splice(idx, 1); chip.classList.remove('selected'); }
        else { selectedArr.push(item.id); chip.classList.add('selected'); }
      };
      row.appendChild(chip);
    });
    return row;
  }

  function draw() {
    wrap.innerHTML = '';
    const card = h('div', { class: 'card' });
    card.appendChild(h('p', { class: 'muted' }, `Step ${step + 1} of ${steps.length}`));
    card.appendChild(steps[step]());

    const nav = h('div', { class: 'row', style: 'margin-top:20px;' });
    if (step > 0) nav.appendChild(h('button', { class: 'ghost', onclick: () => { step--; draw(); } }, 'Back'));
    if (step < steps.length - 1) {
      nav.appendChild(h('button', { class: 'primary', onclick: () => { step++; draw(); } }, 'Next'));
    } else {
      nav.appendChild(h('button', { class: 'primary', onclick: finish }, "Build my learning plan"));
    }
    card.appendChild(nav);
    wrap.appendChild(card);
  }

  async function finish() {
    const goalSongTitles = answers.goalSongTitles.split(',').map((s) => s.trim()).filter(Boolean);
    const res = await api('/profile/onboarding', { method: 'POST', body: { ...answers, goalSongTitles } });
    wrap.innerHTML = '';
    const card = h('div', { class: 'card' });
    card.appendChild(h('h2', {}, 'Your plan is ready 🎉'));
    card.appendChild(h('p', {}, res.starterPlan.summary));
    card.appendChild(h('button', { class: 'primary', onclick: onDone }, 'Go to my dashboard'));
    wrap.appendChild(card);
  }

  draw();
}
