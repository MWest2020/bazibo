# AGENTS.md

**What this is:** Bazibo (repo and package still called bubbels), one app of play-and-learn
games for children of 3 to 10, with one €1 purchase for everything. Static web app in `web/` (plain HTML/CSS/JS, canvas, ES modules): the
shell in `web/js/` (home tiles, settings, offer, parental gate, save data), each game in
`web/games/<id>/` (the bubble shooter `bubbels`, the puppy puzzle `dogudoku`, the picture sudoku `picturedoku`). Wrapped with Capacitor as Android and iOS
apps (`android/`, `ios/`; release steps in `docs/release.md`). Roadmap:
`docs/reference/roadmap.yml` (shown on westerweel.work/nu/; mark an item done only with
evidence, in the same PR).

**Hard rules**
- No ads, no trackers, no analytics, no accounts, no third-party SDKs. Ever. Zero network
  requests outside the game's own origin; the CSP in `web/index.html` stays strict. The only
  native additions are Capacitor, `@capacitor/preferences`, `@capacitor/app` (back button) and
  `cordova-plugin-purchase` (all MIT), with the store's own billing library. Never add a receipt server, RevenueCat or anything like it.
- No CDN and no build step. Any library is vendored with its licence and listed in `CREDITS.md`.
  Only CC0, MIT, BSD or Apache-2.0 assets.
- Relative URLs only. Every visible string goes through `t()` (`web/js/i18n.js`, a game's own in
  `web/games/<id>/strings.js`) in Dutch and English; `npm test` fails on a missing key. Short and
  friendly. Big touch targets. Brand name and tagline only in `web/js/brand.js`.
- One purchase (`unlock_all`) opens every game; each game declares its free part in its
  `meta.js` (Bubbels: levels 1-10) and offers the full version at the end of it through the
  shell's `offerUnlock`. Never fake a purchase: "owned" only comes from the
  store (`web/js/billing-native.js`), and the web build can never unlock.
- Buying, restoring and any link that leaves the app go through the parental gate
  (`askParent` in `main.js`, logic in `web/js/parental-gate.js`). Store rules for kids' apps
  require it. The privacy page shows the email address as plain text, not as a link.
- Save data only through `web/js/storage.js`: one versioned document (Preferences in the apps,
  localStorage on the web). A new game adds a section under `games`; a format change raises
  `version` and adds a step to `migrate()`. Never drop fields you do not know (a newer app
  version may have written them), never delete the old keys.

**Run:** `python3 -m http.server 8080 --directory web`, open http://127.0.0.1:8080/

**Test:** `npm test` (grid, shots, levels, service-worker cache, gate, purchase, i18n, save data,
native config) and `uv run --with playwright python tests/smoke.py` (home → Dogudoku: a wrong puppy lights up, puzzle 1 solved by tapping, 3 stars saved;
home → Picturedoku: a wrong picture lights up, puzzle 1 solved square-first and picture-first, 3 stars saved;
home → Bubbels, 5 shots on
desktop and 390x844 in Dutch and in English, settings and the language switch, the free-tier
offer, a returning player, a sideways 844x390 check, screenshots in `shots/`). Look at the screenshots before claiming something looks
right. The test hook `window.__bubbels` only exists with `?test` in the address.

**Apps:** `. ~/.local/opt/android-env.sh`, then `npx cap sync` after every change in `web/`
(the copies inside `android/` and `ios/` are gitignored). Run `cd android && ./gradlew
assembleDebug` for an APK. There is no emulator or Mac here; purchases are tested on the Play
internal track or in TestFlight. Never create, print or commit a signing key: the upload key and
its properties file live in `~/.config/bubbels/` (backup in OpenBao), `build.gradle` reads them
from `$BUBBELS_KEYSTORE_PROPERTIES` or that path, and `*.jks` / `keystore.properties` are
gitignored. The Android back button: `web/js/back.js` decides, `main.js` wires it (apps only).

**Release and CI:** `.github/workflows/ci.yml` runs `npm test` and a fastlane check on every push
and PR, and on `main` publishes `web/` to GitHub Pages. Store releases go through the lanes in
`fastlane/Fastfile` (table in `docs/release.md`, section 6); store texts and images stay in
`store/`, `tools/store-to-fastlane.mjs` converts them and `npm test` checks the store limits.
Push over SSH (`git@github.com:MWest2020/bubbels.git`): the gh token cannot push workflow files.

**When you change things:** Dogudoku's rules go in `web/games/dogudoku/rules.js` with a test;
puzzles only through `npm run puzzles` (`tools/gen-dogudoku.mjs`; `npm test` fails if
`puzzles.json` differs from what it generates, or if a puzzle has more than one solution). Its
dogs must never look like cats (floppy or rounded ears only). Picturedoku the same way:
`web/games/picturedoku/rules.js` with a test, what a tap does in `input.js` with a test (a picture
tap never changes a filled square the child did not just choose), puzzles through `tools/gen-picturedoku.mjs` (also
`npm run puzzles`; every puzzle unique and solvable with singles only); its pictures must stay
different by shape and colour. Grid rules go in `web/games/bubbels/grid.js` with a test. Level changes go through
`tools/gen-levels.mjs`, not by hand-editing the JSON. After changing anything under `web/`, run
`npm run stamp`: it writes a content hash into `VERSION` in `web/sw.js` so installed copies update.
`npm test` fails if you forget, or if a new file is missing from the service worker's `ASSETS`.
The flying bubble follows the path planned by `planShot` in `grid.js` (the same trace as the
aiming guide), so it always lands in the ghost cell; keep it that way.
