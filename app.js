(function () {
  'use strict';
  const api = SWS.state;
  const KEY = 'sws-tierlist-v1';
  const MAX_BYTES = 5 * 1024 * 1024;
  const $ = id => document.getElementById(id);
  const labels = { S: 'On repeat', A: 'Love it', B: 'Solid', C: 'Sometimes', D: 'Rarely', F: 'Skip' };
  let state = api.createState(SWS.catalog);
  let protectedSave = null;
  let storageAvailable = true;
  let dragId = null;
  let selectedId = null;
  let importBusy = false;

  function announce(text, error = false) {
    $('message').textContent = text;
    $('message').classList.toggle('error', error);
    $('message').hidden = false;
  }
  function saveStatus(text, warning) {
    const status = $('save-status');
    if (!status) return;
    status.textContent = text;
    status.parentElement.classList.toggle('warning', warning);
  }
  function persist() {
    if (protectedSave !== null) { saveStatus('Autosave paused. Export a backup.', true); return; }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storageAvailable = true;
      saveStatus('Saved', false);
    } catch {
      storageAvailable = false;
      saveStatus('Browser saving unavailable. Export JSON.', true);
    }
  }
  function restore() {
    let raw;
    try { raw = localStorage.getItem(KEY); }
    catch { storageAvailable = false; saveStatus('Browser saving unavailable. Export JSON.', true); return; }
    if (raw === null) { saveStatus('Autosave ready', false); return; }
    try {
      const previous = api.validateState(JSON.parse(raw));
      state = api.mergeCatalog(previous, SWS.catalog, SWS.retiredCatalogIds);
      persist();
    } catch {
      protectedSave = raw;
      $('recovery').hidden = false;
      saveStatus('Autosave paused. Previous save unreadable.', true);
    }
  }
  function download(content, filename) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function commit(next, message, focusId, action = 'tier') {
    state = next;
    persist();
    render();
    if (message) announce(message);
    if (focusId) {
      const card = [...document.querySelectorAll('.song')].find(el => el.dataset.songId === focusId);
      const control = card?.querySelector(`[data-action="${action}"]`);
      if (control && !control.disabled) control.focus({ preventScroll: true });
      else card?.focus({ preventScroll: true });
    }
  }
  function makeButton(name, direction, disabled, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'order-button';
    button.setAttribute('aria-label', name);
    button.title = name;
    button.disabled = disabled;
    button.dataset.action = direction < 0 ? 'earlier' : 'later';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(svg.namespaceURI, 'path');
    line.setAttribute('d', direction < 0 ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '1.6');
    svg.append(line);
    button.append(svg);
    button.addEventListener('click', handler);
    return button;
  }
  function songCard(song, tier, index) {
    const card = document.createElement('article');
    card.className = 'song';
    card.dataset.songId = song.id;
    card.draggable = true;
    card.tabIndex = 0;
    card.setAttribute('aria-label', `${song.title}, ${song.album}. Select to move.`);
    if (selectedId === song.id) {
      card.classList.add('selected');
      card.setAttribute('aria-current', 'true');
    }
    const title = document.createElement('h4');
    title.className = 'song-title';
    title.textContent = song.title;
    const meta = document.createElement('p');
    meta.className = 'song-meta';
    meta.textContent = `${song.album} · ${song.type}`;
    const controls = document.createElement('div');
    controls.className = 'song-controls';
    if (tier !== 'unranked') {
      for (const direction of [-1, 1]) {
        const action = direction < 0 ? 'earlier' : 'later';
        const disabled = direction < 0 ? index === 0 : index === state.tiers[tier].length - 1;
        controls.append(makeButton(`Move ${action}: ${song.title}`, direction, disabled, () => {
          commit(api.moveSong(state, song.id, tier, index + direction), `${song.title} moved ${action}.`, song.id, action);
        }));
      }
    }
    card.append(title, meta);
    if (controls.childElementCount) card.append(controls);
    const toggleSelection = () => {
      selectedId = selectedId === song.id ? null : song.id;
      render();
      document.querySelector(`.song[data-song-id="${CSS.escape(song.id)}"]`)?.focus({ preventScroll: true });
      announce(selectedId ? `${song.title} selected. Choose a tier.` : `${song.title} unselected.`);
    };
    card.addEventListener('click', event => {
      if (!event.target.closest('button')) toggleSelection();
    });
    card.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === card) {
        event.preventDefault();
        toggleSelection();
      }
    });
    card.addEventListener('dragstart', event => {
      if (event.target.closest('button')) { event.preventDefault(); return; }
      dragId = song.id;
      event.dataTransfer.setData('text/plain', song.id);
      event.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => { dragId = null; clearDropStyles(); });
    card.addEventListener('dragover', event => {
      if (!dragId || dragId === song.id) return;
      event.preventDefault();
      card.classList.add('drop-before');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drop-before'));
    card.addEventListener('drop', event => {
      if (!dragId) return;
      event.preventDefault();
      event.stopPropagation();
      if (dragId !== song.id) {
        const remaining = state.tiers[tier].filter(id => id !== dragId);
        const at = remaining.indexOf(song.id);
        commit(api.moveSong(state, dragId, tier, at), 'Song moved.');
      }
      dragId = null;
      clearDropStyles();
    });
    return card;
  }
  function clearDropStyles() {
    document.querySelectorAll('.drop-over, .drop-before, .dragging').forEach(el => el.classList.remove('drop-over', 'drop-before', 'dragging'));
  }
  function dropTarget(element, tier) {
    element.addEventListener('dragover', event => {
      if (!dragId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      element.classList.add('drop-over');
    });
    element.addEventListener('dragleave', event => {
      if (!element.contains(event.relatedTarget)) element.classList.remove('drop-over');
    });
    element.addEventListener('drop', event => {
      if (!dragId) return;
      event.preventDefault();
      commit(api.moveSong(state, dragId, tier), 'Song moved.');
      dragId = null;
      clearDropStyles();
    });
  }
  function selectionTarget(element, tier) {
    element.tabIndex = 0;
    element.setAttribute('aria-label', tier === 'unranked' ? 'Move selected song to unranked' : `Move selected song to ${tier} tier`);
    const moveSelected = event => {
      if (!selectedId || event.target.closest('.song, button, input, select, textarea')) return;
      const song = state.songs.find(item => item.id === selectedId);
      if (!song) return;
      event.preventDefault();
      selectedId = null;
      commit(api.moveSong(state, song.id, tier), `${song.title} moved to ${tier === 'unranked' ? 'unranked' : tier + ' tier'}.`, song.id);
    };
    element.addEventListener('click', moveSelected);
    element.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === element) moveSelected(event);
    });
  }
  function render() {
    if (selectedId && !state.songs.some(song => song.id === selectedId)) selectedId = null;
    const byId = new Map(state.songs.map(s => [s.id, s]));
    const board = $('board');
    board.replaceChildren();
    for (const tier of api.tiers.filter(t => t !== 'unranked')) {
      const row = document.createElement('section');
      row.className = 'tier-row';
      row.dataset.tier = tier;
      row.setAttribute('aria-label', `${tier} tier`);
      row.style.setProperty('--tier-color', `var(--${tier.toLowerCase()})`);
      const label = document.createElement('div');
      label.className = 'tier-label';
      const heading = document.createElement('h3'); heading.textContent = tier;
      const description = document.createElement('span'); description.textContent = labels[tier];
      const count = document.createElement('small'); count.textContent = state.tiers[tier].length;
      count.setAttribute('aria-label', `${state.tiers[tier].length} songs`);
      label.append(heading, description, count);
      const songs = document.createElement('div'); songs.className = 'tier-songs';
      state.tiers[tier].forEach((id, index) => songs.append(songCard(byId.get(id), tier, index)));
      if (!state.tiers[tier].length) {
        const hint = document.createElement('p'); hint.className = 'empty-tier'; hint.textContent = 'Drop songs here'; songs.append(hint);
      }
      row.append(label, songs);
      dropTarget(row, tier);
      selectionTarget(row, tier);
      board.append(row);
    }
    const previousAlbum = $('album').value;
    $('album').replaceChildren(new Option('All albums', ''));
    const albums = [...new Set(state.songs.map(song => song.album))];
    for (const album of albums) $('album').append(new Option(album, album));
    if (albums.includes(previousAlbum)) $('album').value = previousAlbum;
    renderPool(byId);
    const total = state.songs.length;
    const ranked = total - state.tiers.unranked.length;
    $('progress-text').textContent = `${ranked} of ${total} songs ranked`;
    $('progress').max = total || 1;
    $('progress').value = ranked;
    $('reset').disabled = ranked === 0;
  }
  function renderPool(byId = new Map(state.songs.map(s => [s.id, s]))) {
    const query = $('search').value.trim().toLocaleLowerCase();
    const album = $('album').value;
    const ids = state.tiers.unranked.filter(id => {
      const song = byId.get(id);
      return (!album || song.album === album) && (!query || `${song.title} ${song.album} ${song.type}`.toLocaleLowerCase().includes(query));
    });
    $('pool').replaceChildren(...ids.map(id => songCard(byId.get(id), 'unranked', state.tiers.unranked.indexOf(id))));
    $('pool-count').textContent = `${ids.length}${query || album ? ' / ' + state.tiers.unranked.length : ''}`;
    $('pool-empty').hidden = ids.length > 0;
    if (!ids.length) {
      $('pool-empty').replaceChildren();
      if (!state.songs.length) {
        $('pool-empty').append('Your library starts here. Paste song titles, one per line, to begin.');
        const add = document.createElement('button'); add.textContent = 'Add your first songs'; add.className = 'primary'; add.addEventListener('click', openAdd); $('pool-empty').append(add);
      } else if (query || album) $('pool-empty').textContent = 'No unranked songs match. Try another search or clear the filters.';
      else $('pool-empty').textContent = 'Everything is ranked. Return a song to Unranked whenever you want to listen again.';
    }
  }
  function openAdd() { $('add-form').hidden = false; $('song-titles').focus(); }
  $('add-toggle').addEventListener('click', openAdd);
  function closeAdd() { $('add-form').hidden = true; $('add-toggle').focus(); }
  $('add-close').addEventListener('click', closeAdd);
  $('add-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const titles = $('song-titles').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (!titles.length) throw new Error('Enter at least one song title.');
      if (state.songs.length + titles.length > 5000) throw new Error('Your library can hold up to 5,000 songs.');
      const album = $('song-album').value.trim() || 'Other songs';
      const type = $('song-type').value;
      const ids = new Set(state.songs.map(s => s.id));
      const songs = titles.map(title => {
        let id;
        do { id = `custom-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)}`; } while (ids.has(id));
        ids.add(id);
        return { id, title, album, year: new Date().getFullYear(), type };
      });
      const next = api.validateState({ version: 1, songs: [...state.songs, ...songs], tiers: { ...state.tiers, unranked: [...state.tiers.unranked, ...songs.map(s => s.id)] } });
      commit(next, `${songs.length} ${songs.length === 1 ? 'song added' : 'songs added'} to your library.`);
      $('add-form').reset();
      $('add-error').hidden = true;
      closeAdd();
    } catch (error) {
      $('add-error').textContent = error.message;
      $('add-error').hidden = false;
    }
  });
  $('export').addEventListener('click', () => {
    const save = { ...api.validateState(state), exportedAt: new Date().toISOString() };
    download(JSON.stringify(save), `sws-tierlist-${new Date().toISOString().slice(0, 10)}.json`);
    announce('JSON backup exported. Keep it somewhere safe.');
  });
  $('import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async () => {
    const file = $('import-file').files[0];
    $('import-file').value = '';
    if (!file || importBusy) return;
    importBusy = true;
    $('import').disabled = true;
    try {
      if (file.size > MAX_BYTES) throw new Error('That file is too large. Choose a JSON backup under 5 MB.');
      const imported = api.mergeCatalog(api.validateState(JSON.parse(await file.text())), SWS.catalog, SWS.retiredCatalogIds);
      if (!confirm(`Replace your current list with this backup of ${imported.songs.length} songs? Export first if you want to keep your current list.`)) return;
      protectedSave = null;
      $('recovery').hidden = true;
      $('search').value = '';
      $('album').value = '';
      commit(imported, 'Backup restored.');
    } catch (error) {
      announce(error instanceof SyntaxError ? 'This file is not valid JSON. Choose an exported tier list backup.' : error.message, true);
    } finally { importBusy = false; $('import').disabled = false; }
  });
  $('reset').addEventListener('click', () => {
    if (confirm('Return every song to Unranked? Your song library will stay intact. Export a backup first if you want to keep these rankings.')) commit(api.resetRanks(state), 'Rankings reset. All songs are unranked.');
  });
  $('download-old').addEventListener('click', () => download(protectedSave || '', 'sws-unreadable-save.json'));
  $('replace-old').addEventListener('click', () => {
    if (!confirm('Replace the unreadable browser save with your current list? Download the previous save first if you want to keep it.')) return;
    protectedSave = null;
    $('recovery').hidden = true;
    persist();
    announce(storageAvailable ? 'Browser saving resumed.' : 'Browser saving is still unavailable. Export a JSON backup.', !storageAvailable);
  });
  $('search').addEventListener('input', () => renderPool());
  $('album').addEventListener('change', () => renderPool());
  $('clear-filters').addEventListener('click', () => { $('search').value = ''; $('album').value = ''; renderPool(); });
  dropTarget($('library'), 'unranked');
  selectionTarget($('library'), 'unranked');
  restore();
  render();
})();
