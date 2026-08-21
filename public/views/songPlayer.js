import { api, h } from '../app.js';
import { Metronome } from '../components/metronome.js';
import { setScreenContext } from '../components/aiChat.js';
import { createRhythmLane } from '../components/rhythmLane.js';
import { getCachedSong } from '../components/songCache.js';

export function register(registerRoute) {
  registerRoute('song', render);
}

async function render(main, [id]) {
  // Prefer a just-created/generated song already held client-side — avoids
  // a brief write-then-read lag in the backing storage right after saving.
  const cached = getCachedSong(id);
  const { song, progress } = cached ? { song: cached, progress: null } : await api(`/songs/${id}`);
  setScreenContext({ screen: 'song', songId: id });

  const view = {
    sectionIndex: 0,
    loopOnly: null, // { chords, label } when practicing an isolated loop
    beatInCycle: 0,
    beatsPerMeasure: parseInt(song.timeSignature.split('/')[0], 10) || 4,
    bpm: (progress && progress.currentBpm) || song.bpmLevels[0],
    hideLyrics: false,
    hideChords: false,
    strumOnly: false,
    metronomeSound: true,
    speakBeats: false,
    playing: false,
  };

  const met = new Metronome({ bpm: view.bpm, beatsPerMeasure: view.beatsPerMeasure, onBeat: onBeat });
  let lane = null;
  let laneCanvas = null;

  function animateLane() {
    // Self-terminates once this page's canvas is no longer in the DOM
    // (e.g. the user navigated away), so no rAF loop leaks across pages.
    if (!laneCanvas || !document.body.contains(laneCanvas)) return;
    if (lane) {
      lane.draw(met, () => ({
        pattern: currentSection().strummingPattern,
        beatsPerMeasure: view.beatsPerMeasure,
      }));
    }
    requestAnimationFrame(animateLane);
  }
  requestAnimationFrame(animateLane);

  main.innerHTML = '';
  main.appendChild(h('a', { href: '#songs' }, '← Back to Songs'));
  main.appendChild(h('h1', {}, song.title));
  main.appendChild(h('p', { class: 'muted' }, `${song.artist} · Key of ${song.key} · ${song.timeSignature} · Capo ${song.capo || 'none'} · Original ${song.bpmOriginal} BPM`));

  const chordsCard = h('div', { class: 'card' });
  chordsCard.appendChild(h('h3', {}, 'Chords you need'));
  chordsCard.appendChild(h('div', { class: 'row wrap' }, song.requiredChordIds.map((c) => h('a', { href: `#chord/${encodeURIComponent(c)}`, class: 'pill' }, c))));
  main.appendChild(chordsCard);

  if (song.lyricsSource === 'none') {
    main.appendChild(h('div', { class: 'card', style: 'margin-top:12px;border-color:var(--accent);' }, [
      h('p', {}, `🔒 ${song.lyricsNote || 'Lyrics are not shown for this song due to licensing — chords and rhythm only.'}`),
    ]));
  }

  const videoCard = h('div', { class: 'card', style: 'margin-top:16px;' });
  main.appendChild(videoCard);
  drawVideoCard(progress && progress.videoId);

  function drawVideoCard(videoId) {
    videoCard.innerHTML = '';
    videoCard.appendChild(h('h3', {}, '🎧 Listen along'));
    if (videoId) {
      videoCard.appendChild(h('p', { class: 'muted' }, 'The actual recording, embedded from YouTube — use its own controls to play/pause/seek while you follow the chord and strum guide below.'));
      const wrap = h('div', { style: 'position:relative;padding-top:56.25%;border-radius:10px;overflow:hidden;' });
      wrap.appendChild(h('iframe', {
        src: `https://www.youtube.com/embed/${videoId}`,
        style: 'position:absolute;top:0;left:0;width:100%;height:100%;border:0;',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: 'true',
      }));
      videoCard.appendChild(wrap);
      videoCard.appendChild(h('button', { class: 'ghost', style: 'margin-top:10px;', onclick: () => drawVideoCard(null) }, 'Change link'));
    } else {
      videoCard.appendChild(h('p', { class: 'muted' }, "This app can't stream copyrighted recordings itself, but you can paste a YouTube link to the actual song here to play it alongside the practice view."));
      const input = h('input', { placeholder: 'Paste a YouTube link, e.g. https://youtu.be/...' });
      const row = h('div', { class: 'row', style: 'margin-top:8px;' });
      row.appendChild(input);
      row.appendChild(h('button', { class: 'primary', onclick: async () => {
        const vid = extractYouTubeId(input.value);
        if (!vid) { alert('Could not read a video ID from that link — paste a full YouTube URL.'); return; }
        await api(`/songs/${song.id}/progress`, { method: 'POST', body: { videoId: vid } });
        drawVideoCard(vid);
      } }, 'Attach'));
      videoCard.appendChild(row);
    }
  }

  function extractYouTubeId(url) {
    if (!url) return null;
    const patterns = [/youtu\.be\/([\w-]{11})/, /[?&]v=([\w-]{11})/, /embed\/([\w-]{11})/];
    for (const re of patterns) {
      const m = url.match(re);
      if (m) return m[1];
    }
    return null;
  }

  const sectionNav = h('div', { class: 'section-nav' });
  song.sections.forEach((sec, i) => {
    const btn = h('button', { class: view.sectionIndex === i ? 'active' : '' }, sec.label);
    btn.onclick = () => { view.sectionIndex = i; view.loopOnly = null; view.beatInCycle = 0; refreshNav(); drawStage(); };
    sectionNav.appendChild(btn);
  });
  main.appendChild(h('h3', { style: 'margin-top:16px;' }, 'Song sections'));
  main.appendChild(sectionNav);
  function refreshNav() {
    Array.from(sectionNav.children).forEach((c, i) => c.classList.toggle('active', i === view.sectionIndex && !view.loopOnly));
  }

  const stage = h('div', { class: 'player-stage', style: 'margin-top:16px;' });
  main.appendChild(stage);

  const controls = h('div', { class: 'card', style: 'margin-top:16px;' });
  main.appendChild(controls);

  const loopsCard = h('div', { class: 'card', style: 'margin-top:16px;' });
  loopsCard.appendChild(h('h3', {}, 'Practice loops'));
  const loopRow = h('div', { class: 'row wrap' });
  (song.practiceLoops || []).forEach((loop) => {
    const btn = h('button', { class: 'ghost' }, loop.label);
    btn.onclick = () => {
      view.loopOnly = { chords: loop.chords || currentSection().chordProgression, label: loop.label };
      view.beatInCycle = 0;
      view.bpm = loop.recommendedBpm || view.bpm;
      met.setBpm(view.bpm);
      refreshNav();
      drawStage();
      drawControls();
    };
    loopRow.appendChild(btn);
  });
  loopsCard.appendChild(loopRow);
  main.appendChild(loopsCard);

  if (song.beginnerVersion) {
    main.appendChild(h('div', { class: 'card', style: 'margin-top:16px;' }, [
      h('h3', {}, 'Beginner-friendly version'),
      h('p', {}, song.beginnerVersion),
    ]));
  }

  function currentSection() { return song.sections[view.sectionIndex]; }
  function activeProgression() { return view.loopOnly ? view.loopOnly.chords : currentSection().chordProgression; }
  function beatsPerChord() { return view.loopOnly ? view.beatsPerMeasure : currentSection().beatsPerChord || view.beatsPerMeasure; }

  function onBeat({ beatNumber, isDownbeat }) {
    if (!isDownbeat) return;
    view.beatInCycle++;
    const totalBeats = activeProgression().length * beatsPerChord();
    if (view.beatInCycle >= totalBeats) view.beatInCycle = 0;
    if (view.speakBeats && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(String((view.beatInCycle % view.beatsPerMeasure) + 1));
      utter.rate = 1.4; utter.volume = 0.6;
      speechSynthesis.speak(utter);
    }
    drawStage();
  }

  function drawStage() {
    stage.innerHTML = '';
    const prog = activeProgression();
    const bpc = beatsPerChord();
    const chordIndex = Math.floor(view.beatInCycle / bpc) % prog.length;
    const nextChord = prog[(chordIndex + 1) % prog.length];

    if (view.loopOnly) {
      stage.appendChild(h('p', { class: 'muted' }, `Practice loop: ${view.loopOnly.label}`));
    } else {
      stage.appendChild(h('p', { class: 'muted' }, currentSection().label));
    }

    if (!view.strumOnly && !view.hideChords) {
      stage.appendChild(h('div', { class: 'chord-now' }, prog[chordIndex]));
      stage.appendChild(h('div', { class: 'chord-next' }, `Next: ${nextChord}`));
    }

    const dots = h('div', { class: 'beat-dots' });
    for (let i = 0; i < view.beatsPerMeasure; i++) {
      dots.appendChild(h('div', { class: 'beat-dot' + (i === (view.beatInCycle % view.beatsPerMeasure) ? ' active' : '') }));
    }
    stage.appendChild(dots);

    if (!view.hideChords) {
      const canvas = h('canvas', { style: 'width:100%;height:90px;display:block;margin-top:14px;border-radius:10px;background:var(--bg-elev-2);' });
      stage.appendChild(canvas);
      lane = createRhythmLane(canvas);
      laneCanvas = canvas;
      stage.appendChild(h('p', { class: 'muted', style: 'font-size:11.5px;margin-top:6px;' }, 'Strums scroll toward the line — hit down/up when a block crosses it. Loops the current measure.'));
    } else {
      lane = null;
    }

    if (!view.hideLyrics && !view.strumOnly && !view.loopOnly && currentSection().lyrics) {
      stage.appendChild(h('p', { style: 'margin-top:14px;font-style:italic;' }, currentSection().lyrics));
    }

    const bar = h('div', { class: 'progress-bar' });
    const fill = h('div', { class: 'fill', style: `width:${Math.round(((view.beatInCycle % (prog.length * bpc)) / (prog.length * bpc)) * 100)}%` });
    bar.appendChild(fill);
    stage.appendChild(bar);
  }

  function drawControls() {
    controls.innerHTML = '';
    controls.appendChild(h('h3', {}, 'Player controls'));
    if (!progress || !progress.currentBpm) {
      controls.appendChild(h('p', { class: 'muted' }, `👉 Suggested starting speed: ${song.bpmLevels[0]} BPM — don't jump to the original tempo yet.`));
    }

    const bpmRow = h('div', { class: 'row wrap' });
    bpmRow.appendChild(h('span', { class: 'pill' }, `${view.bpm} BPM`));
    bpmRow.appendChild(h('button', { onclick: () => setBpm(view.bpm - 5) }, '− 5 BPM (slower)'));
    bpmRow.appendChild(h('button', { onclick: () => setBpm(view.bpm + 5) }, '+ 5 BPM (faster)'));
    song.bpmLevels.forEach((lvl, i) => {
      const label = i === song.bpmLevels.length - 1 && lvl === song.bpmOriginal
        ? `Original (${lvl})`
        : i === 0 ? `Suggested start (${lvl})` : `Level ${i + 1} (${lvl})`;
      bpmRow.appendChild(h('button', { class: 'ghost', onclick: () => setBpm(lvl) }, label));
    });
    controls.appendChild(bpmRow);

    const playRow = h('div', { class: 'row wrap', style: 'margin-top:12px;' });
    playRow.appendChild(h('button', { class: 'primary', onclick: togglePlay }, view.playing ? '⏸ Pause' : '▶ Play'));
    playRow.appendChild(toggleBtn('Metronome sound', view.metronomeSound, (v) => { view.metronomeSound = v; met.audible = v; }));
    playRow.appendChild(toggleBtn('Count beats aloud', view.speakBeats, (v) => { view.speakBeats = v; }));
    playRow.appendChild(h('button', { class: 'ghost', onclick: async () => {
      await api(`/songs/${song.id}/progress`, { method: 'POST', body: { currentBpm: view.bpm, sectionLooped: view.loopOnly ? view.loopOnly.label : currentSection().id } });
    } }, 'Log this practice'));
    controls.appendChild(playRow);

    const visRow = h('div', { class: 'row wrap', style: 'margin-top:12px;' });
    visRow.appendChild(toggleBtn('Hide lyrics', view.hideLyrics, (v) => { view.hideLyrics = v; drawStage(); }));
    visRow.appendChild(toggleBtn('Hide chords', view.hideChords, (v) => { view.hideChords = v; drawStage(); }));
    visRow.appendChild(toggleBtn('Show only strumming', view.strumOnly, (v) => { view.strumOnly = v; drawStage(); }));
    if (view.loopOnly) visRow.appendChild(h('button', { class: 'ghost', onclick: () => { view.loopOnly = null; refreshNav(); drawStage(); } }, 'Exit loop mode'));
    controls.appendChild(visRow);

    controls.appendChild(h('p', { class: 'muted', style: 'margin-top:10px;' },
      "This player doesn't stream copyrighted recordings — practice along with the metronome, or with your own recording playing separately."));
  }

  function toggleBtn(label, value, onChange) {
    const btn = h('button', { class: value ? 'primary' : 'ghost' }, label);
    btn.onclick = () => { onChange(!value); drawControls(); };
    return btn;
  }

  function setBpm(n) {
    view.bpm = Math.max(30, Math.min(220, n));
    met.setBpm(view.bpm);
    drawControls();
  }

  function togglePlay() {
    view.playing = !view.playing;
    if (view.playing) met.start(); else met.stop();
    drawControls();
  }

  refreshNav();
  drawStage();
  drawControls();
}
