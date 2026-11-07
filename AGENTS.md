# AGENTS.md

**What this is:** Bubbels, a bubble shooter for young children. Static web game in `web/`
(plain HTML/CSS/JS, canvas, ES modules), wrapped with Capacitor as Android and iOS apps
(`android/`, `ios/`; release steps in `docs/release.md`).

**Hard rules**
- No ads, no trackers, no analytics, no accounts, no third-party SDKs. Ever. Zero network
  requests outside the game's own origin; the CSP in `web/index.html` stays strict. The only
  native additions are Capacitor and `cordova-plugin-purchase` (both MIT), with the store's own
  billing library. Never add a receipt server, RevenueCat or anything like it.
- No CDN and no build step. Any library is vendored with its licence and listed in `CREDITS.md`.
  Only CC0, MIT, BSD or Apache-2.0 assets.
- Relative URLs only. Dutch UI text, short and friendly. Big touch targets.
- Levels 11-30 stay behind `web/js/unlock.js`. Never fake a purchase: "owned" only comes from the
  store (`web/js/billing-native.js`), and the web build can never unlock.
- Buying, restoring and any link that leaves the app go through the parental gate
  (`askParent` in `main.js`, logic in `web/js/parental-gate.js`). Store rules for kids' apps
  require it. The privacy page shows the email address as plain text, not as a link.
- `localStorage` access goes through `web/js/storage.js` (try/catch).

**Run:** `python3 -m http.server 8080 --directory web`, open http://127.0.0.1:8080/

**Test:** `npm test` (unit tests for `web/js/grid.js` and the level data) and
`uv run --with playwright python tests/smoke.py` (5 shots on desktop and 390x844, a sideways
844x390 check, screenshots in `shots/`). Look at the screenshots before claiming something looks
right. The test hook `window.__bubbels` only exists with `?test` in the address.

**Apps:** `. ~/.local/opt/android-env.sh`, then `npx cap sync` after every change in `web/`
(the copies inside `android/` and `ios/` are gitignored). Run `cd android && ./gradlew
assembleDebug` for an APK. There is no emulator or Mac here; purchases are tested on the Play
internal track or in TestFlight. Never create or commit a signing key: `android/keystore.properties`
and `*.jks` are gitignored, and Mark holds the upload key.

**When you change things:** grid rules go in `grid.js` with a test. Level changes go through
`tools/gen-levels.mjs`, not by hand-editing the JSON. After changing anything under `web/`, run
`npm run stamp`: it writes a content hash into `VERSION` in `web/sw.js` so installed copies update.
`npm test` fails if you forget, or if a new file is missing from the service worker's `ASSETS`.
The flying bubble follows the path planned by `planShot` in `grid.js` (the same trace as the
aiming guide), so it always lands in the ghost cell; keep it that way.
