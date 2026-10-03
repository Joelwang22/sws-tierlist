# Sleeping With Sirens song tier list

A static personal tier list. Open `index.html` to start, or host it on GitHub Pages. No install, build, account, or server is needed for the site.

## Add and rank songs

The site starts with 134 verified Sleeping With Sirens recordings. Click **Add songs** to add demos, guest appearances, or anything else you want to rank. Paste one title per line, then optionally give the batch an album name and recording type. The library supports up to 5,000 entries.

Drag songs into S, A, B, C, D, or F. Dropping on another song inserts before it; dropping on a tier's empty space appends. Use the tier dropdown on each song for touch and keyboard ranking. Earlier/later buttons reorder songs inside a tier. Select **Unranked** to return a song to the library.

Search titles, album names, or recording types. Album and search filters affect the unranked pool only, so the ranking board stays visible.

## Saving and backups

Each change saves automatically in this browser using localStorage. Refreshing restores your list, including custom songs and ordering. The status beside the ranking heading reports whether saving worked.

- **Export JSON** downloads a complete backup of your song library and rankings.
- **Import JSON** validates a backup and asks before replacing your current list.
- **Reset rankings** returns every song to unranked and keeps the library.

Browser storage belongs to the browser and site origin. It does not sync across devices. Clearing site data or using private browsing can remove it. Moving from local files to GitHub Pages gives the site a new storage location; export from the old location and import at the new one. Some browsers restrict storage for local files; use GitHub Pages or a local server if the save status warns you.

If an existing browser save is unreadable, the site pauses autosave and lets you download the old bytes before replacing them. If browser saving fails, you can keep ranking during the session and export JSON.

Imports must be version 1 save files, under 5 MB, with at most 5,000 songs. Library additions also check the backup size so an exported file can always be imported again. Invalid imports leave the current list intact. Imported text displays literally.

## Publish on GitHub Pages

1. Create a GitHub repository and upload this folder's files. Keep `index.html`, `styles.css`, `catalog.js`, `state.js`, `app.js`, and `.nojekyll` at the repository root.
2. Open the repository's **Settings → Pages**.
3. Set the source to **Deploy from a branch**, choose **main**, select **/ (root)**, and save.
4. Open the Pages URL shown by GitHub after deployment.

All asset paths are relative, so repository URLs such as `https://yourname.github.io/sws-tierlist/` work. Your rankings stay in your browser; they are never written into the GitHub repository.

## Catalog coverage

The built-in catalog covers the band's eight studio albums through *An Ending In Itself*, deluxe-only tracks, the 2012 acoustic EP, *Live and Unplugged*, *Live & Acoustic from NYC*, the Audiotree and Apple Music Radio sessions, and the officially released non-album singles through September 2026. Alternate acoustic and live recordings appear as separate items so you can rank the recording you heard.

The catalog was checked on October 3, 2026 against the [band's website](https://sirensmusic.co/), [Apple Music artist releases](https://music.apple.com/us/artist/sleeping-with-sirens/360773035), [MusicBrainz](https://musicbrainz.org/artist/3267d5a3-c72c-4c3b-bafe-ec8a569c0b74), and the [label track list for Complete Collapse Deluxe](https://sumerianrecords.bandcamp.com/album/complete-collapse-deluxe). Unreleased demos and songs credited only to Kellin Quinn as a guest are outside the catalog. One explicit-titled compilation cover could not be preloaded because the catalog-writing step was blocked by a content filter; the Add songs form remains available for personal additions.

To maintain a built-in catalog yourself, edit `SWS.catalog` in `catalog.js` with records containing `id`, `title`, `album`, `year`, and `type`. Types are `studio`, `acoustic`, `live`, `single`, `cover`, and `custom`. IDs must be unique and permanent. Newly added catalog IDs appear in the unranked pool without changing existing rankings.

## Development checks

Requires Node.js only for checks, not for using the site:

```sh
node --test tests/state.test.cjs tests/catalog.test.cjs
```

The browser integration test uses an installed Playwright and Chromium:

```sh
npm install --no-save @playwright/test
npx playwright install chromium
node --test tests/browser.test.cjs
```

Alternatively, set `PLAYWRIGHT_MODULE` to the absolute path of an existing `@playwright/test` installation. The test starts and stops its own local server and writes desktop/mobile screenshots in `tests/`.

This is an unofficial personal fan project. It hosts no audio, lyrics, or album artwork.
