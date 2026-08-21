// Short-lived client-side cache for songs the current session already has
// the full object for (just-added or just-AI-generated) — lets the player
// open instantly without an immediate re-fetch, which sidesteps a brief
// write-then-read propagation lag in the underlying storage on Netlify.
const cache = new Map();

export function cacheSong(song) {
  cache.set(song.id, song);
}

export function getCachedSong(id) {
  return cache.get(id) || null;
}
