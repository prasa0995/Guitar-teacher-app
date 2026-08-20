const https = require('https');
const store = require('../store');
const chords = require('../data/chords.json');
const techniques = require('../data/techniques.json');
const theory = require('../data/theory.json');
const { generatePlan } = require('./practicePlan');
const { findSong } = require('./songCatalog');

function chordName(id) {
  const c = chords.find((x) => x.id === id);
  return c ? c.name : id;
}
function techName(id) {
  const t = techniques.find((x) => x.id === id);
  return t ? t.name : id;
}

// Builds the structured context the AI (or rule engine) reasons over —
// this is what makes answers personalized instead of generic.
function buildContext(userId, screenContext) {
  const profile = store.getProfile(userId);
  const userChords = store.getUserChords(userId);
  const userTechniques = store.getUserTechniques(userId);
  const sessions = store.getPracticeSessions(userId).slice(-10);
  const songProgress = store.getAllSongProgress(userId);

  const learnedChords = Object.entries(userChords)
    .filter(([, v]) => v.status === 'comfortable' || v.status === 'mastered')
    .map(([id]) => id);
  const learningChords = Object.entries(userChords)
    .filter(([, v]) => v.status === 'learning')
    .map(([id]) => id);
  const learnedTechniques = Object.entries(userTechniques)
    .filter(([, v]) => v.status === 'comfortable' || v.status === 'mastered')
    .map(([id]) => id);

  const weakAreas = [];
  learningChords.forEach((id) => weakAreas.push(`${chordName(id)} chord (still learning)`));
  Object.entries(songProgress).forEach(([songId, p]) => {
    if (p.accuracyLog && p.accuracyLog.length) {
      const last = p.accuracyLog[p.accuracyLog.length - 1];
      if (last.missedChanges > 0) weakAreas.push(`missed chord changes in ${songId}`);
    }
  });

  return {
    skillLevel: profile.skillLevel,
    learnedChords,
    learningChords,
    learnedTechniques,
    currentSong: screenContext && screenContext.songId,
    currentLesson: screenContext && screenContext.lessonId,
    weakAreas,
    recentPracticeMinutes: sessions.reduce((s, x) => s + (x.durationMin || 0), 0),
    practiceStreak: profile.streak,
    screen: screenContext && screenContext.screen,
  };
}

const GREETINGS = /^(hi|hey|hello|yo|sup)\b/i;

// Rule-based tutor: pattern-matches common beginner questions and answers
// using REAL context data, so the app is fully functional with no API key.
function ruleBasedAnswer(message, ctx) {
  const m = message.toLowerCase().trim();

  if (GREETINGS.test(m)) {
    return `Hey! I'm your AI guitar teacher. You're at the ${ctx.skillLevel.replace('_', ' ')} level, ` +
      `with ${ctx.learnedChords.length} chord(s) comfortable${ctx.learnedChords.length ? ' (' + ctx.learnedChords.map(chordName).join(', ') + ')' : ''}. ` +
      `Ask me anything — a chord, a technique, "test me", or "give me a practice session."`;
  }

  if (/what is a?n? (\w+7?) chord|explain (\w+7?) chord/.test(m)) {
    const match = m.match(/what is a?n? (\w+7?) chord|explain (\w+7?) chord/);
    const guess = (match[1] || match[2] || '').toUpperCase();
    const chord = chords.find((c) => c.id.toUpperCase() === guess || c.name.toUpperCase().startsWith(guess));
    if (chord) {
      return `${chord.name}: ${chord.audioNote} Finger it as shown in the Chord Library, watch out for: ${chord.commonMistakes[0]}. ` +
        `Want the deeper music-theory explanation of what notes make it up?`;
    }
    return `I don't have that exact chord in the library yet — check the Chord Library search, or tell me the chord name again (e.g. "G", "Am7").`;
  }

  if (/why (does|is) my (\w+) chord.*mut|(\w+) chord sound(s)? (bad|muted|buzz)/.test(m)) {
    const idMatch = m.match(/\b(am|em|c|g|d|a|e|f|g7|am7)\b/i);
    const chord = idMatch && chords.find((c) => c.id.toLowerCase() === idMatch[1].toLowerCase());
    if (chord) {
      return `Common causes for a muted/buzzing ${chord.name}: ${chord.commonMistakes.join('; ')}. ` +
        `Press just behind the fret wire (not on top of it), arch your fingers so neighboring strings aren't touched, and check each string one at a time.`;
    }
    return `Muted or buzzing notes almost always come down to: pressing too far from the fret wire, not enough finger arch (touching a neighboring string), or too little pressure. Which chord is it — I can give specifics.`;
  }

  if (/transition.*faster|faster.*transition|switch (chords|between)/.test(m)) {
    return `Fast transitions come from three things: (1) move your fingers as one shape, not finger-by-finger, (2) keep a "landing" reference finger near the fretboard between chords, (3) practice the pair alone, slowly, with a metronome — speed is a side-effect of accuracy, not the goal. ` +
      (ctx.learningChords.length ? `Since you're still learning ${ctx.learningChords.map(chordName).join(', ')}, drill just that one pair for a few minutes before mixing it into a full song.` : `Try Practice Mode — it can generate a transition drill for two of your chords.`);
  }

  if (/4\/4|four four|time signature/.test(m)) {
    return `4/4 ("common time") means 4 beats per measure, and a quarter note gets one beat. Count "1 2 3 4" evenly and repeat — most pop/rock songs use it. 3/4 (like a waltz, or "Amazing Grace") has 3 beats per measure instead.`;
  }

  if (/downstroke|down stroke/.test(m)) {
    return `A downstroke is strumming down through the strings toward the floor — it's the foundation of most strumming patterns and usually lands on the numbered beats (1, 2, 3, 4).`;
  }
  if (/upstroke|up stroke/.test(m)) {
    return `An upstroke is strumming up through the strings toward the ceiling — usually lighter, hitting fewer strings, and landing on the "and"s between beats (the "&" in "1 & 2 &").`;
  }

  if (/struggl(e|ing) with (this|the) chord|why (can't|cant) i (play|get)/.test(m)) {
    return `Struggling with a new chord for the first days is completely normal — it's building finger independence and calluses. Break it down: place one finger at a time and check each string rings clean before adding the next. If it's still buzzing after that, tell me which chord and which string, and I'll pinpoint it.`;
  }

  if (/barre chord/.test(m) && /beginner|simple|easy|explain/.test(m)) {
    return `Think of a barre chord as using your index finger like a movable capo across all (or several) strings, while your other 3 fingers build a chord shape behind it — usually the shape of an E or A chord. It needs more hand strength than open chords, so start with just 10-30 seconds at a time, several times a day, rather than one long session. The classic first one is F (index across fret 1).`;
  }

  if (/practice session|15.?minute|20.?minute|give me a (practice|session)/.test(m)) {
    const minutesMatch = m.match(/(\d+)\s*-?\s*min/);
    const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 20;
    const plan = generatePlan(ctx.userId, minutes);
    const lines = plan.blocks.map((b) => `${b.minutes} min — ${b.label}`).join('\n');
    return `Here's a ${minutes}-minute session:\n${lines}\n\n${plan.rationale}`;
  }

  if (/test me|quiz me/.test(m)) {
    if (ctx.learnedChords.length === 0) {
      return `You haven't marked any chords as comfortable yet — learn a couple in the Chord Library first, then come back and I'll quiz you!`;
    }
    const target = ctx.learnedChords[Math.floor(Math.random() * ctx.learnedChords.length)];
    const chord = chords.find((c) => c.id === target);
    return `Quick check: which strings do you mute or skip when playing ${chord.name}? (Answer: ${chord.mutedStrings.length ? 'string(s) #' + chord.mutedStrings.map((i) => i + 1).join(', ') + ' from the low E side' : 'none — all 6 strings ring'}). Head to the Chord Library page for ${chord.name} to double check your fretting.`;
  }

  if (/can i (learn|play) (this|the) song|ready for (this|the) song|am i ready/.test(m)) {
    if (ctx.currentSong) {
      const song = findSong(ctx.userId, ctx.currentSong);
      if (song) {
        const learned = new Set(ctx.learnedChords);
        const missingChords = song.requiredChordIds.filter((c) => !learned.has(c));
        const learnedT = new Set(ctx.learnedTechniques);
        const missingTech = song.requiredTechniqueIds.filter((t) => !learnedT.has(t));
        if (!missingChords.length && !missingTech.length) {
          return `Yes — you already know every chord and technique "${song.title}" needs. Start it at the beginner BPM (${song.bpmLevels[0]}) and work up.`;
        }
        const missing = [...missingChords.map(chordName), ...missingTech.map(techName)];
        return `Not quite yet. "${song.title}" needs ${missing.join(', ')}, which you haven't marked as learned. Learn those first, or try the beginner version${song.beginnerVersion ? ': ' + song.beginnerVersion : '.'}`;
      }
    }
    return `Open a song page and ask me again — I'll compare it against exactly what you've learned so far.`;
  }

  // Generic theory lookup fallback
  const theoryHit = theory.find((t) => m.includes(t.title.toLowerCase().split(' ')[0]));
  if (theoryHit) {
    return `${theoryHit.title}: ${theoryHit.explanation} Want a fretboard example, or a quick quiz question on this?`;
  }

  return `Good question. Here's the simple version: could you tell me a bit more — which chord, technique, or song this is about? (I answer based on your actual progress: ${ctx.learnedChords.length} chords comfortable, ${ctx.learnedTechniques.length} technique(s) learned.) If you want deeper music theory on this, just ask "explain the theory."`;
}

function callAnthropic(apiKey, systemPrompt, message, history) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message },
      ],
    });
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            // Extended-thinking models put a "thinking" block before the actual
            // "text" reply block, so find the text block rather than assuming index 0.
            const textBlock = parsed.content && parsed.content.find((b) => b.type === 'text');
            if (textBlock && textBlock.text) {
              resolve(textBlock.text);
            } else {
              reject(new Error(parsed.error ? parsed.error.message : 'Unexpected AI response'));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function answer(userId, message, screenContext) {
  const ctx = buildContext(userId, screenContext);
  ctx.userId = userId;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const systemPrompt =
      `You are a warm, encouraging AI guitar teacher inside a learning app. ` +
      `Explain concepts simply first (beginner-friendly), and only go into deeper music theory if asked. ` +
      `Never overwhelm a beginner. Here is the learner's real current state as JSON — use it to personalize your answer, ` +
      `and never claim they know something not listed:\n${JSON.stringify(ctx)}`;
    try {
      const history = store.getAIConversation(userId);
      const text = await callAnthropic(apiKey, systemPrompt, message, history);
      return { reply: text, source: 'anthropic' };
    } catch (err) {
      console.error('Anthropic call failed, falling back to rule engine:', err.message);
    }
  }
  return { reply: ruleBasedAnswer(message, ctx), source: 'rule-based' };
}

const CHORD_IDS = chords.map((c) => c.id);

// Suggests a starting-point chord progression/key/BPM for a song title so
// "Add a song" isn't a blank form — the user still reviews and edits it.
// Only runs if ANTHROPIC_API_KEY is set; otherwise reports unavailable.
async function suggestSongChords(title, artist) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { available: false, reason: 'No ANTHROPIC_API_KEY configured on the server — add one to enable AI chord suggestions.' };
  }
  const systemPrompt =
    `You suggest a plausible beginner-friendly chord progression for a song, given only its title and artist. ` +
    `Use only these chord ids (standard shapes): ${CHORD_IDS.join(', ')}. ` +
    `Reply with ONLY compact JSON, no prose, no markdown fences: ` +
    `{"key":"G","timeSignature":"4/4","capo":0,"bpmOriginal":90,"chordProgression":["G","C","D","Em"],"strummingPattern":"D D U U D U","confidence":"low|medium|high"}. ` +
    `If you don't actually know the song, still return your best generic guess for that genre/era and set confidence to "low".`;
  try {
    const text = await callAnthropic(apiKey, systemPrompt, `Song: "${title}" by ${artist || 'unknown artist'}`, []);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    parsed.chordProgression = (parsed.chordProgression || []).filter((c) => CHORD_IDS.includes(c));
    if (!parsed.chordProgression.length) throw new Error('No usable chords in AI response');
    return { available: true, suggestion: parsed };
  } catch (err) {
    return { available: false, reason: `AI suggestion failed: ${err.message}` };
  }
}

module.exports = { buildContext, answer, ruleBasedAnswer, suggestSongChords };
