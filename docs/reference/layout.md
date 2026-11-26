# Layout

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
| `web/js/random.js`, `web/js/gen-worker.js` | random play: seeds, the "Random" cards, running a game's generator in a worker |
| `web/js/bubble-art.js`, `web/js/audio.js` | the bubble look and the synthesised sounds (shared) |
| `web/games/papegaai/` | Papegaai (Parrot): `meta.js` (free part), `effects.js` (pure), `sound.js` (microphone and voices), `capture-worklet.js`, `art.js` (the parrot), `papegaai.js` (the screen) |
| `web/games/doolhof/` | Egeltje (garden maze): `meta.js` (free part), `maze.js` and `rules.js` (pure), `art.js` (garden, hedgehog, crows), `doolhof.js` (the screens) |
| `web/games/treintje/` | Treintje (Train Tracks): `meta.js` (free part), `generate.js` (the puzzles, pure and seeded), `rules.js` (pure: steps, drags, the track's shape), `art.js` (grass, railway, stations, fences, the train, the tile), `treintje.js` (the screens) |
| `web/games/keuken/` | Keukentje (Little Kitchen): `meta.js` (free part), `dishes.js` (the dishes, ingredients, sources, groups and recipes), `rules.js` (pure: rounds, taps, stars), `art.js` (every picture and the kitchen), `keuken.js` (the screens) |
| `web/games/winkel/` | Winkeltje (Little Shop): `meta.js` (free part), `rules.js` (pure: the rounds, `fewest`, what is missing or over, in cents), `art.js` (coins, notes, the things, the tile), `winkel.js` (the screens) |
| `web/games/kermis/` | Kleurenkermis (Colour Fair): `meta.js` (free part), `colours.js` (the inks, the things of 3-5 and the button shapes), `rules.js` (pure: rounds, taps, stars, the race and the turtle), `art.js` (every drawing, the chameleon and the stall), `kermis.js` (the screens) |
| `web/games/verstop/` | Verstoppertje (Hide and Seek): `meta.js` (free part), `rules.js` (pure: rounds, looks, stars, where the spots stand), `art.js` (animals, creatures, spots, scenes), `verstop.js` (the screens) |
| `web/games/memory/` | Paartjes (Memory): `meta.js` (free part), `rules.js` (pure), `ai.js` (the gentle computer), `art.js` (the cards), `memory.js` (the screens) |
| `web/games/kwartet/` | Kwartet: `meta.js` (free part), `rules.js` (pure), `ai.js` (the computer players), `art.js` (the sets and cards), `kwartet.js` (the screens) |
| `web/games/legpuzzel/` | Legpuzzel (jigsaw): `meta.js` (free part), `rules.js` (pure geometry and layout), `pictures.js` (the scenes), `legpuzzel.js` (the screens) |
| `web/games/bubbels/` | the bubble shooter: `meta.js` (free tier), `strings.js`, `bubbels.js` (levels, HUD), `game.js` (state, input, physics, drawing), `grid.js` (pure hex-grid logic), `levels.json`, `bubbels.css` |
| `web/nl/privacy/`, `web/en/privacy/` | privacy policy, Dutch and English |
| `web/nl/voorwaarden/`, `web/en/terms/` | terms of service, Dutch and English; linked from Settings and the privacy pages |
| `web/nl/plannen/`, `web/en/roadmap/` | for parents: what is in Bazibo now and what comes next (in order, no dates); linked from Settings, the privacy and terms pages |
| `web/privacy/`, `web/terms/`, `web/voorwaarden/`, `web/roadmap/`, `web/plannen/` | old and language-neutral URLs: they forward to the page in the reader's language (`js/legal-redirect.js`) |
| `web/css/legal.css` | style of the legal pages |
| `web/sw.js`, `web/manifest.webmanifest`, `web/icons/` | PWA basics |
| `tools/` | level generator, icon renderer (`make_icons.py --native` also does the app icons and launch screens), store screenshots (`store_shots.py`), service-worker cache stamp (`stamp-sw.mjs`) |
| `android/`, `ios/`, `capacitor.config.json` | the Capacitor app projects (app ID `work.westerweel.bazibo`) |
| `store/` | store texts (NL/EN), answers for the store forms, screenshots per language, feature graphics |
| `docs/release.md` | step-by-step release to Google Play and the App Store, signing, save data |
| `docs/reference/roadmap.yml` | phases and what "done" means, for westerweel.work/nu/ |
| `docs/README.md` | the index of the docs: a page per game (`docs/games/<id>.md`), how-to, reference, explanation, design, marketing |

Levels: `node tools/gen-levels.mjs` regenerates them deterministically. Icons:
`uv run --with playwright python tools/make_icons.py` renders them with the game's own bubble code.
After changing any file under `web/`, run `npm run stamp`: it sets `VERSION` in `web/sw.js` to a
hash of the cached files so installed copies update (`npm test` checks it).
