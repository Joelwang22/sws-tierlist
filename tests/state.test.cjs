const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const api = fs.existsSync('state.js') ? require('../state.js') : {};
const catalog = ['one', 'two', 'three'].map(id => ({ id, title: id, album: 'Test', year: 2010, type: 'studio' }));

test('ranking moves exactly one song and preserves input', () => {
  assert.equal(typeof api.createState, 'function', 'state implementation is missing');
  const original = api.createState(catalog);
  const next = api.moveSong(original, 'two', 'S');
  assert.deepEqual(next.tiers.S, ['two']);
  assert.deepEqual(next.tiers.unranked, ['one', 'three']);
  assert.deepEqual(original.tiers.unranked, ['one', 'two', 'three']);
});
test('insertion ordering works within and between tiers', () => {
  let s = api.createState(catalog);
  for (const id of ['one', 'two', 'three']) s = api.moveSong(s, id, 'A');
  s = api.moveSong(s, 'three', 'A', 0);
  assert.deepEqual(s.tiers.A, ['three', 'one', 'two']);
  s = api.moveSong(s, 'three', 'A', 2);
  assert.deepEqual(s.tiers.A, ['one', 'two', 'three']);
  assert.throws(() => api.moveSong(s, 'missing', 'A'));
  assert.throws(() => api.moveSong(s, 'one', 'bogus'));
});
test('JSON round trips and reset retain custom songs', () => {
  let s = api.addSong(api.createState(catalog), { id: 'custom-1', title: '<script>literal</script>', album: 'Custom', year: 2026, type: 'custom' });
  s = api.moveSong(s, 'custom-1', 'F');
  assert.deepEqual(api.validateState(JSON.parse(JSON.stringify(s))), s);
  const reset = api.resetRanks(s);
  assert.equal(reset.songs.length, 4);
  assert.deepEqual(reset.tiers.unranked, ['one', 'two', 'three', 'custom-1']);
});
test('catalog upgrades append new songs and keep custom ranks', () => {
  let s = api.moveSong(api.createState(catalog.slice(0, 2)), 'two', 'S');
  s = api.addSong(s, { id: 'custom', title: 'Mine', album: 'Custom', year: 2026, type: 'custom' });
  const next = api.mergeCatalog(s, catalog);
  assert.deepEqual(next.tiers.S, ['two']);
  assert.deepEqual(next.tiers.unranked, ['one', 'custom', 'three']);
  assert.equal(next.songs.length, 4);
});
test('catalog upgrades remove retired recording variants', () => {
  const oldCatalog = [...catalog, { id: 'old-live', title: 'One (Live)', album: 'Live', year: 2016, type: 'live' }];
  let s = api.moveSong(api.createState(oldCatalog), 'old-live', 'A');
  s = api.mergeCatalog(s, catalog, ['old-live']);
  assert.equal(s.songs.some(song => song.id === 'old-live'), false);
  assert.equal(s.tiers.A.includes('old-live'), false);
});

test('recovery restores the catalog and keeps recognizable rankings from an invalid save', () => {
  const item = id => ({ id, title: id, album: 'Test', year: 2010, type: 'studio' });
  const recoveryCatalog = [item('one'), item('two')];
  const broken = {
    version: 1,
    songs: [item('one'), item('retired'), { id: 'bad' }],
    tiers: { S: ['one', 'missing'], A: [], B: [], C: [], D: [], F: [], unranked: ['retired'] }
  };
  const recovered = api.recoverState(broken, recoveryCatalog, ['retired']);
  assert.deepEqual(recovered.songs.map(item => item.id), ['one', 'two']);
  assert.deepEqual(recovered.tiers.S, ['one']);
  assert.deepEqual(recovered.tiers.unranked, ['two']);
});
test('named saves keep their name and compare tier changes', () => {
  let left = api.createState(catalog);
  left.name = 'First pass';
  left = api.moveSong(left, 'one', 'S');
  let right = api.createState(catalog);
  right.name = 'Second pass';
  right = api.moveSong(right, 'one', 'A');
  right = api.moveSong(right, 'two', 'S');
  const result = api.compareStates(left, right);
  assert.equal(result.leftName, 'First pass');
  assert.equal(result.rightName, 'Second pass');
  assert.equal(result.summary.moved, 2);
  assert.equal(result.summary.same, 1);
  assert.equal(result.rows.find(row => row.id === 'one').rightTier, 'A');
  assert.equal(api.resetRanks(left).name, 'First pass');
});
test('rejects a library whose backup would exceed the import byte limit', () => {
  const large = Array.from({ length: 3000 }, (_, i) => ({ id: 'large-' + i, title: '曲'.repeat(300), album: '曲'.repeat(300), year: 2026, type: 'custom' }));
  assert.throws(() => api.createState(large), /5 MB/i);
});
test('a large accepted library produces a portable backup under 5 MB', () => {
  const large = Array.from({ length: 1000 }, (_, i) => ({ id: 'large-' + i, title: '曲'.repeat(300), album: '曲'.repeat(300), year: 2026, type: 'custom' }));
  const s = api.createState(large);
  const json = JSON.stringify({ ...s, exportedAt: '2026-10-03T12:00:00.000Z' });
  assert.ok(Buffer.byteLength(json, 'utf8') < 5 * 1024 * 1024);
  assert.deepEqual(api.validateState(JSON.parse(json)).tiers, s.tiers);
});
for (const [name, mutate] of [
  ['unknown version', s => s.version = 2],
  ['duplicate IDs', s => s.songs.push(s.songs[0])],
  ['duplicate placements', s => s.tiers.S.push('one')],
  ['missing placement', s => s.tiers.unranked.pop()],
  ['unknown reference', s => s.tiers.S.push('missing')],
  ['unknown tier', s => s.tiers.X = []],
  ['invalid title', s => s.songs[0].title = null],
  ['too long title', s => s.songs[0].title = 'x'.repeat(301)],
  ['too many songs', s => s.songs = Array(5001).fill(s.songs[0])]
]) test(`rejects ${name} without mutating incoming data`, () => {
  const s = api.createState(catalog); mutate(s);
  const before = JSON.stringify(s);
  assert.throws(() => api.validateState(s));
  assert.equal(JSON.stringify(s), before);
});
