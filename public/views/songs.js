import { api, h, navigate } from '../app.js';
import { setScreenContext } from '../components/aiChat.js';

export function register(registerRoute) {
  registerRoute('songs', render);
}

async function render(main) {
  setScreenContext({ screen: 'songs' });
  const { chords } = await api('/chords');

  main.innerHTML = '';
  main.appendChild(h('h1', {}, 'Songs'));
  main.appendChild(h('p', { class: 'muted' }, 'Structured, progressive song lessons — not just chord sheets. Recommendations are based on what you have actually learned.'));

  const searchRow = h('div', { class: 'row', style: 'margin:16px 0;' });
  const searchInput = h('input', { placeholder: 'Search songs by title or artist…', style: 'max-width:340px;' });
  const addBtn = h('button', { class: 'secondary' }, '+ Add a song');
  searchRow.appendChild(searchInput);
  searchRow.appendChild(addBtn);
  main.appendChild(searchRow);

  const formHost = h('div');
  main.appendChild(formHost);
  addBtn.onclick = () => { formHost.innerHTML = ''; formHost.appendChild(addSongForm(chords, () => { formHost.innerHTML = ''; loadAndDraw(''); })); };

  const generateHost = h('div');
  main.appendChild(generateHost);

  const grid = h('div', { class: 'grid grid-3' });
  main.appendChild(grid);

  let debounceTimer;
  searchInput.oninput = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { drawGenerateCard(searchInput.value); loadAndDraw(searchInput.value); }, 200);
  };

  function drawGenerateCard(q) {
    generateHost.innerHTML = '';
    if (!q || !q.trim()) return;
    const card = h('div', { class: 'card', style: 'margin:12px 0;border-color:var(--accent-2);' });
    const btn = h('button', { class: 'secondary' }, `✨ Generate "${q}" with AI`);
    const msg = h('p', { class: 'muted', style: 'margin-top:8px;display:none;' });
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Generating full lesson…';
      msg.style.display = 'none';
      try {
        const res = await api('/songs/generate', { method: 'POST', body: { title: q } });
        if (!res.available) {
          msg.textContent = `Not available: ${res.reason}`;
          msg.style.display = 'block';
        } else {
          navigate(`#song/${res.song.id}`);
          return;
        }
      } catch (e) {
        msg.textContent = `Error: ${e.message}`;
        msg.style.display = 'block';
      }
      btn.disabled = false; btn.textContent = `✨ Generate "${q}" with AI`;
    };
    card.appendChild(h('p', {}, "Don't see it below? Any song, any language — the AI builds a full chord/rhythm lesson for it (no lyrics, chords/rhythm only)."));
    card.appendChild(btn);
    card.appendChild(msg);
    generateHost.appendChild(card);
  }

  async function loadAndDraw(q) {
    const [{ songs }, rec] = await Promise.all([
      api(`/songs${q ? `?q=${encodeURIComponent(q)}` : ''}`),
      api('/songs/recommended'),
    ]);
    const readyIds = new Set(rec.ready.map((s) => s.id));
    const almostMap = new Map(rec.almostReady.map((a) => [a.song.id, a.missing]));

    grid.innerHTML = '';
    if (!songs.length) {
      grid.appendChild(h('p', { class: 'muted' }, q ? `No songs match "${q}" in the library yet — try generating it with AI above, or "+ Add a song" yourself.` : 'No songs yet.'));
      return;
    }
    songs.forEach((s) => {
      const readiness = readyIds.has(s.id)
        ? { label: 'Ready for you', cls: 'status-mastered' }
        : almostMap.has(s.id)
          ? { label: `Almost ready — needs ${almostMap.get(s.id).join(', ')}`, cls: 'status-learning' }
          : { label: 'Not yet — build more skills first', cls: 'status-not_learned' };

      const card = h('div', { class: 'card', style: 'cursor:pointer;' });
      card.onclick = () => navigate(`#song/${s.id}`);
      card.appendChild(h('h3', {}, s.title + (s.aiGenerated ? ' ✨' : s.custom ? ' ✏️' : '')));
      card.appendChild(h('p', { class: 'muted' }, `${s.artist} · ${s.difficulty} · Key of ${s.key} · ${s.timeSignature}`));
      card.appendChild(h('span', { class: `pill ${readiness.cls}` }, readiness.label));
      grid.appendChild(card);
    });
  }

  loadAndDraw('');
}

function addSongForm(chords, onDone) {
  const card = h('div', { class: 'card', style: 'margin-bottom:16px;' });
  card.appendChild(h('h3', {}, 'Add a song'));
  card.appendChild(h('p', { class: 'muted' }, "Any song — enter its chord progression and (optionally) lyrics you have the rights to use. It'll show up in search and get the full interactive player."));

  const title = h('input', { placeholder: 'Song title' });
  const artist = h('input', { placeholder: 'Artist' });
  const key = h('input', { placeholder: 'Key, e.g. G' });
  const bpm = h('input', { type: 'number', placeholder: 'BPM, e.g. 90', value: '90' });
  const ts = h('input', { placeholder: 'Time signature, e.g. 4/4', value: '4/4' });
  const capo = h('input', { type: 'number', placeholder: 'Capo fret (0 = none)', value: '0' });
  const progression = h('input', { placeholder: 'Chord progression, comma-separated, e.g. G, C, D, Em' });
  const strum = h('input', { placeholder: 'Strumming, space-separated D/U, e.g. D D U U D U', value: 'D D U U D U' });
  const lyrics = h('textarea', { placeholder: 'Lyrics (optional — only include text you have the rights to use)', rows: '4' });

  const grid = h('div', { class: 'grid grid-2', style: 'gap:10px;margin:14px 0;' }, [
    field('Title', title), field('Artist', artist), field('Key', key), field('BPM', bpm),
    field('Time signature', ts), field('Capo', capo),
  ]);
  card.appendChild(grid);

  const suggestMsg = h('p', { class: 'muted', style: 'display:none;' });
  const suggestBtn = h('button', { class: 'ghost' }, '✨ AI: suggest chords for this song');
  suggestBtn.onclick = async () => {
    if (!title.value.trim()) { alert('Enter a song title first.'); return; }
    suggestBtn.disabled = true; suggestBtn.textContent = 'Asking AI…';
    try {
      const res = await api('/songs/suggest', { method: 'POST', body: { title: title.value, artist: artist.value } });
      if (!res.available) {
        suggestMsg.textContent = `Not available: ${res.reason}`;
        suggestMsg.style.display = 'block';
      } else {
        const s = res.suggestion;
        key.value = s.key || key.value;
        ts.value = s.timeSignature || ts.value;
        capo.value = s.capo != null ? s.capo : capo.value;
        bpm.value = s.bpmOriginal || bpm.value;
        progression.value = (s.chordProgression || []).join(', ');
        strum.value = s.strummingPattern || strum.value;
        suggestMsg.textContent = `AI suggestion filled in (confidence: ${s.confidence || 'unknown'}) — review and correct before saving.`;
        suggestMsg.style.display = 'block';
      }
    } catch (e) {
      suggestMsg.textContent = `Error: ${e.message}`;
      suggestMsg.style.display = 'block';
    }
    suggestBtn.disabled = false; suggestBtn.textContent = '✨ AI: suggest chords for this song';
  };
  card.appendChild(suggestBtn);
  card.appendChild(suggestMsg);

  card.appendChild(field('Chord progression', progression));
  card.appendChild(field('Strumming pattern', strum));
  card.appendChild(field('Lyrics (optional)', lyrics));

  const errorBox = h('p', { style: 'color:#ef6461;display:none;' });
  card.appendChild(errorBox);

  const row = h('div', { class: 'row', style: 'margin-top:10px;' });
  row.appendChild(h('button', { class: 'primary', onclick: async () => {
    errorBox.style.display = 'none';
    const chordProgression = progression.value.split(',').map((c) => c.trim()).filter(Boolean);
    if (!title.value.trim() || !chordProgression.length) {
      errorBox.textContent = 'Title and at least one chord are required.';
      errorBox.style.display = 'block';
      return;
    }
    try {
      await api('/songs/custom', { method: 'POST', body: {
        title: title.value, artist: artist.value, key: key.value, bpmOriginal: bpm.value,
        timeSignature: ts.value, capo: capo.value, chordProgression,
        requiredChordIds: chordProgression.filter((c) => chords.some((ch) => ch.id === c)),
        strummingPattern: strum.value, lyrics: lyrics.value,
      } });
      onDone();
    } catch (e) { errorBox.textContent = e.message; errorBox.style.display = 'block'; }
  } }, 'Add song'));
  row.appendChild(h('button', { class: 'ghost', onclick: onDone }, 'Cancel'));
  card.appendChild(row);
  return card;
}

function field(label, input) {
  return h('div', {}, [h('label', {}, label), input]);
}
