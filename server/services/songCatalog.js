// Merges the seed song library with each user's own added songs, so every
// consumer (routes, recommendation engine, AI tutor) sees one consistent catalog.
const seedSongs = require('../data/songs.json');
const store = require('../store');

function getAllSongs(userId) {
  return [...seedSongs, ...store.getCustomSongs(userId)];
}

function findSong(userId, songId) {
  return getAllSongs(userId).find((s) => s.id === songId) || null;
}

module.exports = { getAllSongs, findSong };
