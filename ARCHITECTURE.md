# AI Guitar Teacher — Architecture

## 1. Product Architecture

The product is **not** "songs + chatbot" — it's a teacher. The single unifying model is a
**Learner Profile** (skill level, learned chords/techniques, practice history, weak areas)
that every feature reads from and writes to:

```
                     ┌─────────────────────┐
                     │   Learner Profile    │  ← single source of truth
                     │  (skills, history)    │
                     └──────────┬───────────┘
        ┌───────────┬───────────┼───────────┬────────────┬───────────┐
        ▼           ▼           ▼           ▼            ▼           ▼
   Curriculum   Chord Lib   Song Player   Practice     AI Tutor   Progress
   (what next)  (reference) (apply skill) Mode (drill) (Q&A +     Dashboard
                                                        context)   (reflect)
```

Every feature both **reads** the profile (to personalize) and **writes** to it (to keep it
current) — the recommendation engine, the AI tutor, and the practice-plan generator all sit
on top of the same data instead of being separate silos.

## 2. User Flows

**Onboarding (new user):**
`Signup → 7 onboarding questions → generated starter plan (chords/techniques to learn first) → Home`

**Daily use:**
`Home ("what to practice today") → Practice Mode (generated session) → log results → Progress updates → AI suggests next step`

**Learning a chord:** `Chord Library → chord detail (diagram, audio, mistakes) → "I can play this" → marked Learning → practiced in Practice Mode → promoted to Comfortable/Mastered`

**Learning a song:** `Songs → filtered by "ready for you" / "almost ready" → Song detail → Interactive Player (loop a section at low BPM) → BPM progression tracked → song marked learned`

**Ask the AI anywhere:** floating AI Tutor button on every screen → chat pulls current screen + profile context → simple-first answer, "want more detail?" for theory depth.

## 3. Feature Breakdown (MVP vs later)

**MVP (built now):** auth, onboarding, curriculum, chord library, technique tracker, song
library + interactive player with BPM control, metronome, strumming visualizer, practice-mode
generator, AI tutor (context-aware, Anthropic-backed with rule-based fallback), progress
dashboard, tuner (mic-based, client-side pitch detection), fretboard explorer, theory section.

**Post-MVP (architected for, not built):** real-time chord-accuracy detection from audio,
automatic strum/rhythm scoring, expanded song catalog (hundreds+), licensed lyric provider
integration, adaptive spaced-repetition scheduling, social/sharing.

## 4. Database Schema (JSON-document store now, maps 1:1 to relational tables later)

```
User            { id, email, passwordHash, securityQuestion, securityAnswerHash, createdAt }
Profile         { userId, skillLevel, hasPlayedBefore, guitarType, daysPerWeek, minutesPerDay,
                  goalSongIds[], onboardingComplete, streak, lastPracticeDate }
UserChord       { userId, chordId, status: not_learned|learning|comfortable|mastered, updatedAt }
UserTechnique   { userId, techniqueId, status, updatedAt, custom: bool }
PracticeSession { id, userId, date, durationMin, blocks:[{type, targetId, minutes, bpmReached}],
                  source: generated|manual }
SongProgress    { userId, songId, status, currentBpm, sectionsLooped[], lastPracticed,
                  accuracyLog:[{date, bpm, missedChanges}] }
LessonProgress  { userId, lessonId, status, quizScore, completedAt }
AIConversation  { id, userId, messages:[{role, content, screenContext, ts}] }
Chord           { id, name, family, positions[fret/string/finger], mutedStrings[], audioUrl,
                  commonMistakes[], beginnerVariant, altFingerings[], relatedChordIds[], songIds[] }
Technique       { id, name, category, description, difficulty }
Song            { id, title, artist, key, bpmOriginal, bpmLevels[], timeSignature, capo,
                  difficulty, requiredChordIds[], requiredTechniqueIds[], sections[], chordProgression,
                  strummingPattern, lyricsSource: none|public_domain|user_provided|licensed, lyrics? }
TheoryTopic     { id, tier: beginner|intermediate|advanced, title, explanation, diagram,
                  example, exerciseId, quizId }
```

Users, and all *User*-prefixed records, are scoped by `userId` — mirrors the pattern already
used in the sibling banking-dashboard project (per-user data isolation).

## 5. AI Architecture

The AI tutor is a **context-injecting service**, not a bare chatbot:

```
Client chat message + screenContext
        │
        ▼
 buildContext(userId) ──> { skillLevel, learnedChords, learnedTechniques,
                             currentSong, currentLesson, weakAreas,
                             recentQuestions, practiceHistory summary }
        │
        ▼
 systemPrompt = teacher persona + context JSON + "explain simply first, offer depth on request"
        │
        ▼
 ANTHROPIC_API_KEY set? ──yes──> call Claude Messages API (server-side only, key never
        │                        reaches the browser) with systemPrompt + message
        no
        │
        ▼
 ruleBasedTutor(message, context) — pattern-matched answers for the common beginner
 questions (chord meaning, muted strings, transition speed, 4/4, downstroke, barre
 chords, practice-session generation, quiz-me), still context-aware (reads real
 learnedChords/currentSong), so the app is fully functional with zero API key.
```

Same context object powers the **recommendation engine** (`services/recommendation.js`):
songs are scored against `requiredChordIds`/`requiredTechniqueIds` vs. the user's
`comfortable|mastered` set → "ready now" / "almost ready, missing X" / "not yet" buckets.

## 6. Song Data Schema

See `Song` above. Example shape used by the seed data (`server/data/songs.json`):

```json
{
  "id": "amazing-grace",
  "title": "Amazing Grace",
  "artist": "Traditional",
  "difficulty": "beginner",
  "key": "G",
  "bpmOriginal": 76,
  "bpmLevels": [50, 60, 70, 76],
  "timeSignature": "3/4",
  "capo": 0,
  "requiredChordIds": ["G", "C", "D", "Em"],
  "requiredTechniqueIds": ["down-strum", "up-strum"],
  "lyricsSource": "public_domain",
  "sections": [
    { "id": "verse-1", "label": "Verse 1", "chordProgression": ["G","G","C","G","G","D","G"],
      "strummingPattern": "D-D-U-D", "lyrics": "Amazing grace, how sweet the sound..." }
  ]
}
```

For copyrighted songs (e.g. a pop song), `lyricsSource` is `"none"` and the player shows
chords/rhythm/sections only, with a note that lyrics require a licensed source or the user's
own supplied text (`lyricsSource: "user_provided"`) — the schema supports both without any
UI rewrite.

## 7. API Architecture

REST, JSON, session-cookie auth (mirrors the sibling project's `cookie-session` + `bcryptjs`
pattern). All routes except `/api/auth/*` require a session.

```
POST   /api/auth/signup | login | logout | forgot-password | reset-password
GET    /api/profile                    PUT /api/profile            POST /api/profile/onboarding
GET    /api/chords            GET /api/chords/:id
GET    /api/techniques        POST /api/techniques  (custom)   PUT /api/techniques/:id/status
GET    /api/songs             GET /api/songs/:id     GET /api/songs/recommended
POST   /api/songs/:id/progress                     (bpm, section loop, accuracy log)
GET    /api/theory            GET /api/theory/:id
POST   /api/practice/generate                        (today's session)
POST   /api/practice/log
GET    /api/progress                                  (dashboard aggregate)
POST   /api/ai/chat                                    (context-aware tutor)
GET    /api/ai/conversation
```

Business logic lives in `services/` (recommendation, practice-plan generator, AI context
builder) — routes stay thin. `plaidClient.js`-style pattern: any external key
(`ANTHROPIC_API_KEY`) is read server-side from `.env` only, never shipped to the client.

## 8. Tech Stack

- **Frontend:** vanilla JS SPA (ES modules, hash router), no build step — same low-friction
  choice as the sibling banking project, keeps the whole app runnable with just `npm start`.
  Web Audio API for metronome, strumming click track, and client-side pitch detection (tuner).
- **Backend:** Node + Express, `cookie-session` + `bcryptjs` auth, `express-rate-limit`.
- **Storage:** JSON file store (`data/store.json`) for MVP — schema above maps directly to
  Postgres tables when the catalog grows past a few hundred songs.
- **AI:** Anthropic Messages API (server-side), with a full rule-based fallback so the app
  works with no key configured.
- **Deploy:** Dockerfile + docker-compose, same shape as the sibling project.

## 9. Folder Structure

```
guitar-teacher-app/
  server/
    index.js            express app, mounts routes
    store.js             JSON persistence, per-user scoping
    auth.js               signup/login/session middleware
    routes/                auth, profile, chords, techniques, songs, theory, practice, progress, ai
    services/
      recommendation.js    song readiness scoring
      practicePlan.js      daily session generator
      aiTutor.js            context builder + Claude call + rule-based fallback
    data/                   seed JSON: chords.json, techniques.json, songs.json, theory.json, curriculum.json
  public/
    index.html, styles.css, app.js (router + shared state)
    views/                 one module per screen (home, learn, chords, theory, fretboard,
                            songs, songPlayer, practice, skills, progress, onboarding)
    components/             metronome.js, tuner.js, chordDiagram.js, aiChat.js (used across views)
  data/                     runtime store.json (gitignored)
  Dockerfile, docker-compose.yml, README.md
```

## 10. MVP Development Plan

1. Server skeleton + auth + store (mirrors sibling project patterns) ✅ this build
2. Seed data: chords, techniques, curriculum, theory, 3 songs (1 public-domain w/ lyrics, 2
   chord/rhythm-only to respect copyright)
3. Onboarding → starter plan generation
4. Chord library + technique tracker (read/write real data)
5. Recommendation engine + Songs list ("ready" / "almost ready")
6. Interactive song player: BPM control, metronome, strum visualizer, section loop
7. Practice mode generator + logging
8. Progress dashboard
9. AI tutor: context builder + rule-based engine + optional Claude call
10. Tuner + fretboard explorer + theory pages
11. Responsive polish, Docker

Everything below is the actual working build of the above.
