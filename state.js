(function (root) {
  'use strict';
  const tiers = ['S', 'A', 'B', 'C', 'D', 'F', 'unranked'];
  const types = ['studio', 'acoustic', 'live', 'single', 'cover', 'custom'];
  const fail = message => { throw new Error(message); };
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function text(value, label, max = 300) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label} must be text between 1 and ${max} characters.`);
    return value;
  }
  function validateState(value) {
    if (!isObject(value) || value.version !== 1) fail('This is not a supported tier list save. Expected version 1.');
    if (!Array.isArray(value.songs) || value.songs.length > 5000) fail('The save must contain at most 5,000 songs.');
    const ids = new Set();
    const songs = value.songs.map(song => {
      if (!isObject(song)) fail('A song is missing its metadata.');
      const id = text(song.id, 'Song ID', 150);
      if (ids.has(id)) fail('The save contains duplicate song IDs.');
      ids.add(id);
      if (!Number.isInteger(song.year) || song.year < 1900 || song.year > 2100) fail('A song has an invalid year.');
      if (!types.includes(song.type)) fail('A song has an unknown recording type.');
      return { id, title: text(song.title, 'Song title'), album: text(song.album, 'Album'), year: song.year, type: song.type };
    });
    if (!isObject(value.tiers) || Object.keys(value.tiers).length !== tiers.length || Object.keys(value.tiers).some(key => !tiers.includes(key))) fail('The save must contain S, A, B, C, D, F, and unranked tiers.');
    const seen = new Set();
    const placements = {};
    for (const tier of tiers) {
      if (!Array.isArray(value.tiers[tier])) fail(`The ${tier} tier is invalid.`);
      placements[tier] = value.tiers[tier].map(id => {
        if (!ids.has(id)) fail('A tier references a song that is missing.');
        if (seen.has(id)) fail('A song appears in more than one position.');
        seen.add(id);
        return id;
      });
    }
    if (seen.size !== ids.size) fail('Some songs are missing from the tiers.');
    const clean = { version: 1, songs, tiers: placements };
    // Reserve room for an export timestamp so every accepted state is portable.
    if (new TextEncoder().encode(JSON.stringify(clean)).length > 5 * 1024 * 1024 - 256) fail('This library would exceed the 5 MB backup limit. Use fewer songs or shorter titles.');
    if (value.exportedAt !== undefined) {
      if (typeof value.exportedAt !== 'string' || value.exportedAt.length > 50 || !Number.isFinite(Date.parse(value.exportedAt))) fail('The export date is invalid.');
      clean.exportedAt = value.exportedAt;
    }
    return clean;
  }
  function createState(catalog) {
    return validateState({ version: 1, songs: catalog, tiers: Object.fromEntries(tiers.map(t => [t, t === 'unranked' ? catalog.map(s => s.id) : []])) });
  }
  function moveSong(save, id, tier, index) {
    const next = validateState(save);
    if (!tiers.includes(tier) || !next.songs.some(s => s.id === id)) fail('That song or tier does not exist.');
    for (const name of tiers) next.tiers[name] = next.tiers[name].filter(item => item !== id);
    const target = next.tiers[tier];
    const at = index === undefined ? target.length : index;
    if (!Number.isInteger(at) || at < 0 || at > target.length) fail('That position does not exist.');
    target.splice(at, 0, id);
    return next;
  }
  function addSong(save, song) {
    const next = validateState(save);
    next.songs.push(song);
    next.tiers.unranked.push(song.id);
    return validateState(next);
  }
  function mergeCatalog(save, catalog, retiredIds = []) {
    let next = validateState(save);
    const verified = createState(catalog);
    const retired = new Set(retiredIds);
    if (retired.size) {
      next.songs = next.songs.filter(song => !retired.has(song.id));
      for (const tier of tiers) next.tiers[tier] = next.tiers[tier].filter(id => !retired.has(id));
    }
    const ids = new Set(next.songs.map(s => s.id));
    for (const song of verified.songs) if (!ids.has(song.id)) {
      next.songs.push(song);
      next.tiers.unranked.push(song.id);
      ids.add(song.id);
    }
    return validateState(next);
  }
  function resetRanks(save) { return createState(validateState(save).songs); }
  const api = { tiers, createState, validateState, moveSong, addSong, mergeCatalog, resetRanks };
  root.SWS = root.SWS || {};
  root.SWS.state = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
