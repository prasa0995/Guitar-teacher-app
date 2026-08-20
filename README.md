# AI Guitar Teacher

A personal AI guitar teacher — not just a chord/song library. Structured curriculum,
chord library, technique tracking, an interactive song player with BPM progression,
practice-mode generation, a tuner, a metronome, an interactive fretboard, and an
AI tutor that's aware of what you've actually learned.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full product/technical design.

## Setup

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:
- `SESSION_SECRET` — set a fixed random value (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) so logins survive restarts.
- `ANTHROPIC_API_KEY` — optional. Without it, the AI Tutor runs on its built-in
  rule-based engine (still fully context-aware — reads your real learned chords,
  techniques, and current song). With it, the tutor calls Claude for open-ended
  questions.

Start the server:

```bash
npm start
```

Open http://localhost:3000, sign up (email/password + a security question for
password recovery), and go through onboarding.

## What's real vs. what's a stub

Everything in the MVP is functionally wired up against real data — not a static
prototype:

- Auth, per-user data isolation, and password recovery are fully implemented.
- The onboarding flow generates a real starter plan and pre-marks chords/techniques
  you say you already know.
- The Chord Library and My Techniques pages read/write real per-user status and
  drive the recommendation engine and AI tutor context.
- The Songs recommendation engine ("ready" / "almost ready, missing X") is computed
  live from your tracked skills against each song's `requiredChordIds` /
  `requiredTechniqueIds`.
- The interactive Song Player runs a real Web Audio metronome, highlights the
  current/next chord and strum direction live, supports BPM ramping, section
  looping, and isolated practice loops.
- The Tuner does real client-side pitch detection (autocorrelation) from your
  microphone — nothing is uploaded.
- The Metronome, Practice Mode session generator, and Progress dashboard are all
  driven by the same stored practice history.
- The AI Tutor is context-aware either way (Anthropic-backed or rule-based
  fallback) — see `server/services/aiTutor.js`.

## Lyrics & copyright

Only one seed song (traditional, public-domain "Amazing Grace") ships with full
lyrics. The other two are original teaching songs written for this app. A third
pattern — `lyricsSource: "none"` — is included to show how the schema supports a
real copyrighted song: chords, sections, and rhythm are shown, but lyrics are
withheld with a note, ready to be filled in from a licensed source or your own
supplied text (`lyricsSource: "user_provided"`/`"licensed"`) without any UI change.

## Deploying

Ships with a `Dockerfile` and `docker-compose.yml`. Mount a volume at `/app/data`
so user accounts and progress survive redeploys, and set `SESSION_SECRET` /
`ANTHROPIC_API_KEY` as environment variables on the host.
