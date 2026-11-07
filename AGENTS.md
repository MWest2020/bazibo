# AGENTS.md

**What this is:** Bubbels, a bubble shooter for young children. Static web game in `web/`
(plain HTML/CSS/JS, canvas, ES modules), later wrapped as an Android app.

**Hard rules**
- No ads, no trackers, no analytics, no accounts, no third-party SDKs. Ever. Zero network
  requests outside the game's own origin; the CSP in `web/index.html` stays strict.
- No CDN and no build step. Any library is vendored with its licence and listed in `CREDITS.md`.
  Only CC0, MIT, BSD or Apache-2.0 assets.
- Relative URLs only. Dutch UI text, short and friendly. Big touch targets.
- Levels 11-30 stay behind `web/js/unlock.js`. Never fake a purchase; billing comes later.
- `localStorage` access goes through `web/js/storage.js` (try/catch).

**Run:** `python3 -m http.server 8080 --directory web`, open http://127.0.0.1:8080/

**Test:** `npm test` (unit tests for `web/js/grid.js` and the level data) and
`uv run --with playwright python tests/smoke.py` (5 shots on desktop and 390x844, a sideways
844x390 check, screenshots in `shots/`). Look at the screenshots before claiming something looks
right. The test hook `window.__bubbels` only exists with `?test` in the address.

**When you change things:** grid rules go in `grid.js` with a test. Level changes go through
`tools/gen-levels.mjs`, not by hand-editing the JSON. After changing anything under `web/`, run
`npm run stamp`: it writes a content hash into `VERSION` in `web/sw.js` so installed copies update.
`npm test` fails if you forget, or if a new file is missing from the service worker's `ASSETS`.
The flying bubble follows the path planned by `planShot` in `grid.js` (the same trace as the
aiming guide), so it always lands in the ghost cell; keep it that way.
