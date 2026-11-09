# Bazibo

An app of play-and-learn games for children of 3 to 10. No ads, no trackers, no accounts, one
€1 purchase that opens every game. It is a plain web app (HTML, CSS and JavaScript on a canvas),
wrapped with Capacitor as an Android and an iOS app. The games: the bubble shooter
("Bubbels schieten" / "Bubble Shooter"), Dogudoku (a logic puzzle with puppies), Picturedoku (a
sudoku with pictures), Vier op een rij ("Four in a Row", together or against the computer) and
Slangetje ("Snake", a snake that eats numbers in order, the letters of a word or one colour) and
Kleurplaten ("Colouring", pictures for the youngest and mandalas for older children); more
learning games follow (`docs/reference/roadmap.yml`). The brand name lives in
`web/js/brand.js` (issue #2): Bazibo, from "bāzi", the Persian word for play; it rhymes with
gazebo, and a garden gazebo with a bubble under its roof is the logo (`web/js/logo.js`, also
the source of every app icon). The repository (`MWest2020/bazibo`, renamed from `bubbels` on 2026-11-09), the package id
(`work.westerweel.bazibo`) and the website path (`/bazibo/`) carry the brand name; the first game
and the storage keys keep the name `bubbels`.

- Home screen with a tile per game (a game that is not ready yet can show a "binnenkort" /
  "coming soon" tile) and a
  settings screen: language (Dutch or English; it follows the device and Dutch is the fallback),
  sound, the full version, privacy, terms.

Play it: https://bazibo.nl/ (also at https://mwest2020.github.io/bazibo/). Every merge to `main` runs the tests and publishes `web/` to GitHub Pages through GitHub Actions, and a GitHub webhook makes Plesk (Yourhosting) pull `main` and serve `web/` on bazibo.nl. Releases to the stores: `docs/release.md`.

### Dogudoku

A Queens / Star Battle puzzle with puppies, in `web/games/dogudoku/` (rules in `rules.js`,
pictures drawn as SVG in `art.js`, the screen in `dogudoku.js`).

- On every size: one puppy per row and per column, and puppies never touch, not even
  diagonally. 4×4 (ages 3-5) has bushes instead of colours and needs no reading; from 5×5 also
  one puppy per colour; 6×6 to 8×8 (ages 7-10) are the same rules on bigger boards.
- Tap a square: the youngest boards toggle a puppy; the others cycle empty, cross, puppy. Drag
  over empty squares to cross them. Auto-cross (optional, from 5×5) shows the squares a puppy
  rules out. A broken rule outlines the puppies in red and lights up the rule's picture.
- A hint marks one square that must be crossed or must get a puppy (unlimited on 4×4, 3 on 5×5,
  2 from 6×6). Stars: 3 without hints, 2 with one, 1 with more. A solved board hops and woofs.
- 60 puzzles in `puzzles.json`, made by `npm run puzzles` (`tools/gen-dogudoku.mjs`, seeded);
  every puzzle has exactly one solution and `npm test` solves them all again. 10 are free, the
  easiest of every size.

### Picturedoku

A sudoku with pictures, in `web/games/picturedoku/` (rules in `rules.js`, pictures drawn as SVG
in `art.js`, the screen in `picturedoku.js`).

- Every picture once in every row, column and box. 4×4 with 2×2 boxes (ages 3-6, pictures only:
  apple, banana, grapes, carrot), 6×6 with 2×3 boxes (6-8), 9×9 with 3×3 boxes (8-10). The nine
  pictures differ by shape and colour; on 6×6 and 9×9 a button switches to numbers.
- Tap a square, then a picture in the palette; or (from 6×6) pick a picture first and tap empty
  squares with it: the picture lifts with a pulsing ring and the board's edge turns gold. A picture
  tap never changes a filled square the child did not just choose (`input.js`, tested): tapping
  another picture only switches the armed one, and a filled square tapped while armed is chosen,
  so the next picture replaces it on purpose. After a placement nothing stays chosen. On 4×4 a
  picture tapped without a square makes the empty squares wiggle. Fixed pictures sit on a lilac
  plate. Pencil notes (from 6×6), an eraser and undo. A clash
  outlines both pictures in red, tints the row, column or box and lights up the rule's picture.
- A hint takes out a wrong picture, or fills a square (one where only one picture fits, when
  there is one): unlimited on 4×4, 3 on 6×6 and 9×9. Stars: 3 without hints, 2 with one, 1
  with more. A solved board hops and chimes; every picture has its own soft note.
- 60 puzzles in `puzzles.json`, made by `npm run puzzles` (`tools/gen-picturedoku.mjs`,
  seeded): each has exactly one solution and can be solved with singles only (no guessing);
  within a size they go from easy to hard (fewer pictures to start with). `npm test` solves them
  all again. 10 are free, the easiest of every size (4 / 4 / 2).

### Vier op een rij

Four in a row, in `web/games/vier/` (rules in `rules.js`, the computer in `ai.js`, tokens and
pictures drawn as SVG in `art.js`, the screens in `vier.js`). Our own name and look: a lilac frame
with round holes and picture tokens, never "Connect Four" or its blue frame with red and yellow.

- Two boards: the big board, 7×6, four in a row wins (ages 6+), and the kleuterbord, 5×4, three
  in a row wins (ages 3+, no reading needed).
- Play together on one screen, taking turns, or against the computer at three levels. Easy plays
  near the middle and only sometimes takes a win or blocks one, so a young child can beat it;
  medium always wins or blocks when it can and otherwise avoids handing over a win; hard looks a
  few moves ahead (minimax with alpha-beta, depth 4 on the big board, 5 on the kleuterbord). On
  the big board a child who sets up two threats at once can beat hard. The kleuterbord is a
  forced win for whoever starts, and hard plays it perfectly; so against the computer the child
  always starts there, and beats hard only with exact play. The computer only ever plays a legal
  move, one per turn (`npm test` checks every level, and that hard and medium never miss a win or
  a block).
- Tap anywhere in a column: the token drops with a little bounce and a soft "tok". A row lights
  up with gold rings and hops; a draw gets a friendly card. Against the computer a move can be
  taken back (also after the computer won, or while it is still thinking); together it cannot.
  Who starts takes turns: together per board (remembered), against the computer from game to game
  (the child starts the first one, and always on the kleuterbord).
- Each player picks a token (puppy, bubble, apple, flower, fish, pug); the chips under the board
  show whose turn it is with pictures, not text alone. Leaving a game for the menu keeps it for
  as long as the app stays open ("keep playing"); it is not saved, so closing the app ends it.
- Free: playing together on both boards and the easy and medium computer. Hard is in the full
  version (`meta.js`). The child's wins against the computer are counted per board and level
  (never lowered, `storage.js`); games played together are not counted.

### Kleurplaten

Colouring pages in `web/games/kleuren/`: pick a colour, tap a part, and it is coloured. Everything
is drawn in code as SVG, one closed path per part ("region"), so colouring is just a fill and no
flood fill is needed. Parts are layered (later ones on top), so no shape is cut out of another.

- **Pictures** (`pictures.js`, ages 3-6): 13 friendly pictures from a sun (9 parts) to a gazebo
  (15 parts); eyes and smiles are details on top that taps ignore. The first 6 are free.
- **Mandalas** (`mandala.js`, ages 7-10): made from a seed (the same seed always gives the same
  mandala), 6- to 12-fold, rings of petals, drops, scallops, dots and chequered bands around a
  centre. Every shape knows its group (its copies around the circle), and the mirror button colours
  the whole group at once (on by default for 7-8). Three fixed mandalas are free; the full version
  makes endless new ones ("New (7+)", "New (9+)").
- **Saving:** every page is saved while it is coloured (`saveArt` in `storage.js`: colour per
  region, when it last changed, and whether it is done). "Mijn kleurplaten" lists them, newest
  first. Pictures and the free mandalas are always kept; of the generated mandalas the newest 30.
  A page cleared to blank is kept as a small "gone" marker, so after a failed read the merge
  carries the clear over; otherwise the newer version wins per region and the other regions are
  kept. A new mandala counts as "done" once, however often it is finished.
- Tools: undo, start over (with a question first; undo brings the colours back), mirror
  (mandalas), zoom (opens on the middle), and done (only once something is coloured: a little
  sparkle and a chime, then the page is in "my pictures"). A page without colour is never saved.
- **Big enough to tap:** after a mandala is built, `raster.js` fills it into a grid (no canvas, so
  it runs in node too) and `prune()` takes out whole symmetry groups that would show less than the
  tier's minimum (a shape that is small itself, or the shapes covering a background left as a
  sliver). `npm test` checks over 200 seeds per tier that every part shows at least 12×12 px:
  7-8 at phone size, 9-10 zoomed in 2.2×.

### Slangetje

A snake game that teaches, in `web/games/slang/` (rules in `rules.js`, pictures in `art.js`, the
screens in `slang.js`, 30 levels in `levels.json`). Our own name and look: a friendly cartoon
snake on a grass board, everything drawn in code.

- Three kinds of round, each in three age tiers:
  - **Tellen / Counting:** numbered oranges, eaten in order: 1-3 for the youngest, up to 1-20,
    counting in twos (2, 4 … 20) and counting down (10 … 1) for the oldest.
  - **Letters:** spell a short word that comes with a picture, letter by letter (EI/EGG, ZON/SUN,
    BAL/BALL … WORTEL/CARROT). The words differ per language (`WORDS` in `rules.js`).
  - **Kleuren / Colours:** eat only the fruit of the shown colour; every colour also has its own
    shape (the bubble palette, with purple instead of light blue, so no round asks a child to tell
    blue from light blue). In the older levels the colour changes every few fruits.
- Ages 3-5: slow, the edges wrap around and the snake passes through itself, so a round can never
  be lost; the next thing to eat has a soft gold ring. Ages 5-7: faster, more on the board at once,
  still no way to lose. Ages 7-10: faster again, a fence around the board in most levels, stone
  walls in some, and bumping into a wall or yourself ends the round ("try again").
- A wrong bite is never a game over: a gentle "boop", the snake gets one part shorter and the fruit
  hops to another spot. A right bite gives a soft munch; the end of a round a chime.
- The snake waits for the child: a round (and a round coming back from the pause or the menu)
  starts with the first swipe or arrow. Steer by swiping on the board, by tapping where the snake
  should go, with the big arrow pad, or with the arrow keys on a computer.
- Stars: the youngest tier counts only mistakes (no clock for three-year-olds); the older tiers
  also want the round inside a time (`starsFor`, `parSeconds` in `rules.js`; the snake's own time,
  pauses not counted).
- Free: 10 of the 30 levels, the first ones of every kind (`free: true` in `levels.json`).
  `npm test` checks the level data (walls on the board, never on the start, no walled-off pockets,
  every word spellable) and plays every level to the end in both languages, upright and sideways,
  without a mistake.
- Readable on small phones: things are drawn at almost a whole square, numbers and letters at
  0.6-0.7 of a square, and when a 13-wide board would give squares under 20 px (small phones,
  short sideways phones) the round uses the same level two squares smaller each way, with the
  corner walls moved in (`sizeOf`, `wallCells`). The smoke test measures every number and letter
  at 11 px or more on 320×568, 568×320 and 640×360.
- Things never appear right in front of the head (also after a turn typed ahead), next to another
  thing or in a pocket, so a needed thing is never fenced in by wrong ones.
- The board only animates while something moves (the snake, an effect, the youngest tier's help
  ring); a snake waiting for a swipe costs no frames.
- How-to cards follow the level: counting shows its own numbers (1, 2, 3 … or 2, 4, 6 … or
  10, 9, 8 …), and the oldest tier says that bumping into a fence, a stone or yourself counts.
- Leaving a round for the menu keeps it while the app stays open ("keep playing"); it is not saved.
  A kept letters round spells the new language's word after a language switch.

### Bubbels schieten

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
checks that a returning player keeps their progress, and opens the privacy and terms pages.

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
| `web/js/random.js`, `web/js/gen-worker.js` | random play: seeds, the "Random" cards, running a game's generator in a worker |
| `web/js/bubble-art.js`, `web/js/audio.js` | the bubble look and the synthesised sounds (shared) |
| `web/games/bubbels/` | the bubble shooter: `meta.js` (free tier), `strings.js`, `bubbels.js` (levels, HUD), `game.js` (state, input, physics, drawing), `grid.js` (pure hex-grid logic), `levels.json`, `bubbels.css` |
| `web/nl/privacy/`, `web/en/privacy/` | privacy policy, Dutch and English |
| `web/nl/voorwaarden/`, `web/en/terms/` | terms of service, Dutch and English; linked from Settings and the privacy pages |
| `web/privacy/`, `web/terms/`, `web/voorwaarden/` | old and language-neutral URLs: they forward to the page in the reader's language (`js/legal-redirect.js`) |
| `web/css/legal.css` | style of the legal pages |
| `web/sw.js`, `web/manifest.webmanifest`, `web/icons/` | PWA basics |
| `tools/` | level generator, icon renderer (`make_icons.py --native` also does the app icons and launch screens), store screenshots (`store_shots.py`), service-worker cache stamp (`stamp-sw.mjs`) |
| `android/`, `ios/`, `capacitor.config.json` | the Capacitor app projects (app ID `work.westerweel.bazibo`) |
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

### Random play (full version)

With the full version, every game except Vier op een rij (which is endless already) gets a
"Willekeurig" / "Random" card per difficulty in its level list: Bubbels easy, medium and hard;
Dogudoku 4×4 to 8×8; Picturedoku 4×4, 6×6 and 9×9; Slangetje per kind of round and age. Each tap
makes a new board or puzzle on the device from a fresh seed (`crypto.getRandomValues`), with the
same generators that make the fixed levels (`web/games/<id>/generate.js`, also used by `tools/`),
so a random one passes the same checks: Dogudoku and Picturedoku have exactly one solution
(Picturedoku solvable without guessing), Bubbels boards have no loose bubbles and every colour at
least twice, Slangetje walls come from the tested wall layouts. Big puzzles are made in a worker
(`web/js/gen-worker.js`, falling back to the page) so the screen never freezes, and Dogudoku makes
the next one ahead. Random boards keep no stars; the save counts how many were solved per tier
(`games.<id>.random`, only ever going up). After a loss in Bubbels or Slangetje, "Zelfde nog eens"
replays the same board. `tests/random.test.js` checks 200 seeds per tier and prints the timing.

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
part of the phone's own backup and survives a new phone (Android: Auto Backup and, from Android 12,
the phone-to-phone transfer, through explicit rules that include `shared_prefs`); on the web in
localStorage. Older save
data is migrated once and kept. Details in `docs/release.md`, section 5.

## Licence

MIT, see `LICENSE`. Third-party material is listed in `CREDITS.md`.
