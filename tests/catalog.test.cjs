const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('verified catalog boots without a network request', () => {
  assert.ok(fs.existsSync('catalog.js'), 'catalog is missing');
  const context = {};
  vm.runInNewContext(fs.readFileSync('catalog.js', 'utf8'), context);
  const songs = context.SWS.catalog;
  assert.ok(Array.isArray(songs));
  assert.equal(songs.length, 104);
  assert.equal(new Set(songs.map(s => s.id)).size, songs.length);
  for (const song of songs) {
    for (const field of ['id', 'title', 'album', 'type']) assert.ok(song[field]?.trim());
    assert.ok(Number.isInteger(song.year) && song.year >= 2010 && song.year <= 2026);
  }
  assert.ok(songs.some(song => song.title === 'Storm Clouds' && song.album === 'An Ending In Itself'));
  assert.ok(songs.some(song => song.title === "I'm Coming Home (Big Gulps)"));
  assert.equal(songs.filter(song => song.album === 'Complete Collapse (Deluxe)').length, 13);
  assert.equal(songs.filter(song => song.type === 'live').length, 0);
  assert.equal(songs.filter(song => song.title === 'Iris').length, 1);
});
