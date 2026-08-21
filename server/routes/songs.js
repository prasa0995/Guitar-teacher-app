const express = require('express');
const store = require('../store');
const { newId } = require('../auth');
const chords = require('../data/chords.json');
const techniques = require('../data/techniques.json');
const { recommendSongs } = require('../services/recommendation');
const { getAllSongs, findSong } = require('../services/songCatalog');
const { suggestSongChords, generateFullSong } = require('../services/aiTutor');

const router = express.Router();

router.get('/', (req, res) => {
  const progress = store.getAllSongProgress(req.userId);
  const { q } = req.query;
  let list = getAllSongs(req.userId);
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    list = list.filter((s) => s.title.toLowerCase().includes(needle) || s.artist.toLowerCase().includes(needle));
  }
  res.json({ songs: list.map((s) => ({ ...s, progress: progress[s.id] || null })) });
});

router.get('/recommended', (req, res) => {
  res.json(recommendSongs(req.userId));
});

router.post('/suggest', async (req, res) => {
  const { title, artist } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Song title required' });
  const result = await suggestSongChords(title.trim(), artist);
  res.json(result);
});

// Generates a full multi-section lesson for ANY song title/artist (any
// language, not limited to a fixed catalog) and saves it as a custom song —
// this is what powers "search any song" without needing licensed tab data.
router.post('/generate', async (req, res) => {
  const { title, artist } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Song title required' });

  const result = await generateFullSong(title.trim(), artist);
  if (!result.available) return res.status(200).json(result);

  const g = result.song;
  const bpm = parseInt(g.bpmOriginal, 10) || 90;
  const allChords = [...new Set(g.sections.flatMap((s) => s.chordProgression))];
  const barreChordRequired = allChords.some((id) => chords.find((c) => c.id === id)?.family === 'barre');

  const song = {
    id: newId('song'),
    title: g.title || title.trim(),
    artist: g.artist || artist || 'Unknown',
    difficulty: barreChordRequired || g.confidence === 'low' ? 'intermediate' : 'beginner',
    key: g.key || 'C',
    timeSignature: g.timeSignature || '4/4',
    capo: parseInt(g.capo, 10) || 0,
    bpmOriginal: bpm,
    bpmLevels: [Math.max(30, bpm - 30), Math.max(40, bpm - 20), Math.max(50, bpm - 10), bpm],
    requiredChordIds: allChords,
    requiredTechniqueIds: g.requiredTechniqueIds || [],
    strummingComplexity: 'ai-generated',
    fingerpickingRequired: (g.requiredTechniqueIds || []).includes('fingerpicking'),
    barreChordRequired,
    lyricsSource: 'none',
    lyricsNote: `AI-generated lesson (confidence: ${g.confidence || 'unknown'}) — chords and rhythm only, no lyrics. Treat this as a helpful starting point, not a guaranteed-accurate transcription; adjust by ear as needed.`,
    custom: true,
    aiGenerated: true,
    confidence: g.confidence || 'unknown',
    sections: g.sections.map((s, i) => ({
      id: `section-${i}`, label: s.label || `Part ${i + 1}`,
      chordProgression: s.chordProgression, strummingPattern: s.strummingPattern || 'D D U U D U',
      beatsPerChord: parseInt(s.beatsPerChord, 10) || 4, lyrics: null,
    })),
    practiceLoops: g.sections.slice(0, 2).map((s) => ({
      label: `${s.label} chord loop`, chords: s.chordProgression.slice(0, 2), recommendedBpm: Math.max(30, bpm - 30),
    })),
    beginnerVersion: g.beginnerVersion || null,
  };

  store.addCustomSong(req.userId, song);
  res.json({ available: true, song });
});

// Add a song of your own — any title/artist. Chords are just letter names
// (not copyrightable), and lyrics are optional and only stored if you supply
// them yourself (lyricsSource becomes "user_provided"), so this never pulls in
// or reproduces anyone else's copyrighted lyrics automatically.
router.post('/custom', (req, res) => {
  const {
    title, artist, key, timeSignature, capo, bpmOriginal,
    requiredChordIds = [], requiredTechniqueIds = [],
    chordProgression = [], strummingPattern = '', beatsPerChord = 4,
    lyrics = '',
  } = req.body || {};

  if (!title || !title.trim()) return res.status(400).json({ error: 'Song title required' });
  if (!chordProgression.length) return res.status(400).json({ error: 'At least one chord in the progression required' });

  const validChordIds = requiredChordIds.filter((id) => chords.some((c) => c.id === id));
  const validTechIds = requiredTechniqueIds.filter((id) => techniques.some((t) => t.id === id));
  const bpm = parseInt(bpmOriginal, 10) || 80;

  const song = {
    id: newId('song'),
    title: title.trim(),
    artist: (artist || 'Unknown').trim(),
    difficulty: validChordIds.some((id) => chords.find((c) => c.id === id)?.family === 'barre') ? 'intermediate' : 'beginner',
    key: key || 'C',
    timeSignature: timeSignature || '4/4',
    capo: parseInt(capo, 10) || 0,
    bpmOriginal: bpm,
    bpmLevels: [Math.max(30, bpm - 30), Math.max(40, bpm - 20), Math.max(50, bpm - 10), bpm],
    requiredChordIds: validChordIds.length ? validChordIds : chordProgression.filter((c) => chords.some((ch) => ch.id === c)),
    requiredTechniqueIds: validTechIds,
    strummingComplexity: 'custom',
    fingerpickingRequired: validTechIds.includes('fingerpicking'),
    barreChordRequired: validChordIds.some((id) => chords.find((c) => c.id === id)?.family === 'barre'),
    lyricsSource: lyrics && lyrics.trim() ? 'user_provided' : 'none',
    lyricsNote: lyrics && lyrics.trim() ? undefined : 'No lyrics supplied for this song — chords and rhythm only.',
    custom: true,
    sections: [
      {
        id: 'full-song', label: 'Full song',
        chordProgression, strummingPattern: strummingPattern || 'D D D D',
        beatsPerChord: parseInt(beatsPerChord, 10) || 4,
        lyrics: lyrics && lyrics.trim() ? lyrics.trim() : null,
      },
    ],
    practiceLoops: [
      { label: `${chordProgression[0]} to ${chordProgression[1] || chordProgression[0]} transition`, chords: chordProgression.slice(0, 2), recommendedBpm: Math.max(30, bpm - 30) },
    ],
    beginnerVersion: null,
  };

  store.addCustomSong(req.userId, song);
  res.json({ song });
});

router.get('/:id', (req, res) => {
  const song = findSong(req.userId, req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  const progress = store.getSongProgress(req.userId, song.id);
  res.json({ song, progress });
});

router.post('/:id/progress', (req, res) => {
  const song = findSong(req.userId, req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  const { currentBpm, sectionLooped, status, accuracyEntry, videoId } = req.body || {};
  const patch = { lastPracticed: new Date().toISOString() };
  if (currentBpm) patch.currentBpm = currentBpm;
  if (status) patch.status = status;
  if (videoId !== undefined) patch.videoId = videoId;

  const existing = store.getSongProgress(req.userId, song.id) || { sectionsLooped: [], accuracyLog: [] };
  if (sectionLooped && !existing.sectionsLooped.includes(sectionLooped)) {
    patch.sectionsLooped = [...existing.sectionsLooped, sectionLooped];
  }
  if (accuracyEntry) {
    patch.accuracyLog = [...(existing.accuracyLog || []), { ...accuracyEntry, date: new Date().toISOString() }];
  }
  const progress = store.updateSongProgress(req.userId, song.id, patch);
  res.json({ progress });
});

module.exports = router;
