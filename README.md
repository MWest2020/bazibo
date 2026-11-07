# Bubbels

An app of play-and-learn games for children of 3 to 10. No ads, no trackers, no accounts, one
€1 purchase that opens every game. It is a plain web app (HTML, CSS and JavaScript on a canvas),
wrapped with Capacitor as an Android and an iOS app. The first game is the bubble shooter
("Bubbels schieten" / "Bubble Shooter"); a picture sudoku, "Dogudoku" (a logic puzzle with dogs) and more learning games follow
(`docs/reference/roadmap.yml`). The brand name lives in `web/js/brand.js` (issue #2).

- Home screen with a tile per game (a "binnenkort" / "coming soon" tile for the next one) and a
  settings screen: language (Dutch or English; it follows the device and Dutch is the fallback),
  sound, the full version, privacy.

Play it: https://mwest2020.github.io/bubbels/ (served from the `gh-pages` branch; publish with `npm test && git subtree push --prefix web origin gh-pages`).

- Glossy bubbles that look like soap or glass, each colour with its own symbol (circle, star,
  triangle, diamond, heart, square), so colour-blind children can play too.
- Drag to aim and release to fire. A dotted guide line shows one bounce off the wall and a ghost
  circle where the bubble will land; the shot always lands exactly there. Tap the small bubble
  next to the launcher to swap it with the loaded one. Level 1 shows an animated hand ("Sleep
  omhoog en laat los!") until the first shot, and any level shows it again after 9 idle seconds.
- Three or more of the same colour pop, with a pop sound made by the Web Audio API (no sound
  files). Bubbles that lose their hold fall, bounce and pop.
- The ceiling drops a row after a number of misses (the dots next to the launcher, with a small
  ceiling-and-arrow picture that blinks red when one or two are left). Clear the
  board to win, with 1 to 3 stars depending on the number of shots.
- 30 levels as data in `web/games/bubbels/levels.json`. Levels 1-10 are free; 11-30 are part of
  the "volledige versie" (see below).
- Dutch and English UI, portrait phone and desktop, works offline (service worker) and makes
  zero network requests to anywhere but its own origin (a Content Security Policy enforces it).

## Run

```sh
python3 -m http.server 8080 --directory web
# open http://127.0.0.1:8080/
```

No build step and no dependencies at runtime. Opening `index.html` straight from disk does not
work, because ES modules and service workers need http.

## Test

```sh
npm test                                         # node --test: grid, shots, levels, sw cache, gate, purchase, i18n, save data
uv run --with playwright python tests/smoke.py   # serves web/, plays in NL and EN, screenshots in shots/
```

The smoke test uses the headless Chromium at the path in `CHROME` (default: the Playwright
cache on the dev machine) and fails on page errors or on any request outside the local server.
It also checks that the web build sells nothing, that the end of the free levels leads to the
offer, walks through the parental gate in both languages, switches the language in settings,
checks that a returning player keeps their progress, and opens the privacy pages.

## Layout

| Path | What |
|---|---|
| `web/index.html` | the page: home, settings, the game screens and the overlay card |
| `web/js/main.js` | the shell: screens, tiles, settings, the offer, the parental gate, service worker registration |
| `web/js/brand.js` | brand name and tagline (the one place to change them) |
| `web/js/games.js` | the games in the app and their tiles (ready or coming soon) |
| `web/js/i18n.js` | Dutch and English strings, language choice |
| `web/js/storage.js` | the save document, migration, Preferences in the apps, localStorage on the web |
| `web/js/unlock.js` | the purchase state (store answer, offline cache) and free tiers |
| `web/js/billing-native.js` | billing adapter for the apps (cordova-plugin-purchase: Play Billing and StoreKit) |
| `web/js/parental-gate.js` | the adult question before buying or restoring |
| `web/js/bubble-art.js`, `web/js/audio.js` | the bubble look and the synthesised sounds (shared) |
| `web/games/bubbels/` | the bubble shooter: `meta.js` (free tier), `strings.js`, `bubbels.js` (levels, HUD), `game.js` (state, input, physics, drawing), `grid.js` (pure hex-grid logic), `levels.json`, `bubbels.css` |
| `web/privacy/` | privacy policy, Dutch (`index.html`) and English (`en.html`) |
| `web/sw.js`, `web/manifest.webmanifest`, `web/icons/` | PWA basics |
| `tools/` | level generator, icon renderer (`make_icons.py --native` also does the app icons and launch screens), store screenshots (`store_shots.py`), service-worker cache stamp (`stamp-sw.mjs`) |
| `android/`, `ios/`, `capacitor.config.json` | the Capacitor app projects (app ID `work.westerweel.bubbels`) |
| `store/` | store texts (NL/EN), answers for the store forms, screenshots per language, feature graphics |
| `docs/release.md` | step-by-step release to Google Play and the App Store, signing, save data |
| `docs/reference/roadmap.yml` | phases and what "done" means, for westerweel.work/nu/ |

Levels: `node tools/gen-levels.mjs` regenerates them deterministically. Icons:
`uv run --with playwright python tools/make_icons.py` renders them with the game's own bubble code.
After changing any file under `web/`, run `npm run stamp`: it sets `VERSION` in `web/sw.js` to a
hash of the cached files so installed copies update (`npm test` checks it).

## Full version

Every game has a free part (Bubbels: levels 1-10, declared in `web/games/bubbels/meta.js`). One
non-consumable in-app product, `unlock_all` (€ 1), opens everything in every game, in the
Android and iOS apps only. The offer appears at the end of a free part and in Settings. `web/js/unlock.js` keeps the purchase state. It only becomes "owned" when Google Play
or the App Store says so. The last answer is cached so a bought game keeps working offline. The
store calls go through the open-source `cordova-plugin-purchase` (`web/js/billing-native.js`);
there is no receipt server.

Buying and restoring sit behind a parental gate (`web/js/parental-gate.js`): a multiplication
written in words (Dutch or English), with a typed answer. On the website nothing can be bought, and a locked
level only shows a friendly card.

## Apps

```sh
. ~/.local/opt/android-env.sh       # on the agent host: Node 22, JDK 21, Android SDK
npm ci && npx cap sync              # copy web/ and the plugin into android/ and ios/
cd android && ./gradlew assembleDebug    # app/build/outputs/apk/debug/app-debug.apk
cd android && ./gradlew bundleRelease    # app/build/outputs/bundle/release/app-release.aab, signed if the upload key is set up
```

iOS needs a Mac with Xcode, or the GitHub Actions example in `docs/ci/`. The full release steps
for both stores, including signing, are in `docs/release.md`.

## Save data

One versioned document (`web/js/storage.js`): in the apps in Capacitor Preferences, so it is
part of the phone's own backup and survives a new phone; on the web in localStorage. Older save
data is migrated once and kept. Details in `docs/release.md`, section 5.

## Licence

MIT, see `LICENSE`. Third-party material is listed in `CREDITS.md`.
