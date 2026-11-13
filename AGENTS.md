# AGENTS.md

**What this is:** Bazibo (repo and package still called bubbels), one app of play-and-learn
games for children of 3 to 10, with one €1 purchase for everything. Static web app in `web/` (plain HTML/CSS/JS, canvas, ES modules): the
shell in `web/js/` (home tiles, settings, offer, parental gate, save data), each game in
`web/games/<id>/` (the bubble shooter `bubbels`, the puppy puzzle `dogudoku`, the picture sudoku `picturedoku`, four in a row `vier`, checkers `dammen`, the learning snake `slang`, colouring pages and mandalas `kleuren`, free drawing with a mirror mode `tekenen`, telling time `klok`, letters with a read-aloud voice `letters`). Wrapped with Capacitor as Android and iOS
apps (`android/`, `ios/`; release steps in `docs/release.md`). Roadmap:
`docs/reference/roadmap.yml` (shown on westerweel.work/nu/; mark an item done only with
evidence, in the same PR).

**Hard rules**
- No ads, no trackers, no analytics, no accounts, no third-party SDKs. Ever. Zero network
  requests outside the game's own origin; the CSP in `web/index.html` stays strict. The only
  native additions are Capacitor, `@capacitor/preferences`, `@capacitor/app` (back button) and
  `cordova-plugin-purchase` (all MIT), with the store's own billing library. Never add a receipt server, RevenueCat or anything like it.
- No CDN and no build step. Any library is vendored with its licence and listed in `CREDITS.md`.
  Only CC0, MIT, BSD, Apache-2.0, or CC BY 4.0 with attribution shown in the app and on bazibo.nl
  (the privacy pages' voice section; issue #22).
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
- Voortgang overzetten (`web/js/transfer.js`): anything that comes in through a QR code or pasted
  text is untrusted. It is checked (size, checksum, the shape of every value; `sanitizePayload`)
  before it reaches the save, and the purchase never travels. A new game section with new kinds
  of values needs a rule in `sanitizePayload`, or that part is dropped on transfer.

**Run:** `python3 -m http.server 8080 --directory web`, open http://127.0.0.1:8080/

**Test:** `npm test` (grid, shots, levels, service-worker cache, gate, purchase, i18n, save data,
native config) and `uv run --with playwright python tests/smoke.py` (home → Dogudoku: a wrong puppy lights up, puzzle 1 solved by tapping, 3 stars saved;
home → Picturedoku: a wrong picture lights up, puzzle 1 solved square-first and picture-first, 3 stars saved;
home → Vier op een rij: hard is locked on the web, a two-player game on the kleuterbord played to a win, a game against easy with one take-back;
home → Dammen: medium, hard and the 10×10 board offer only OK on the web, a two-player 8×8 game played to a win by taps, a move against easy with the take-back and "keep playing", the glow on the pieces that must capture and a double jump by taps; the layout at 320x568, sideways and on desktop, the 10×10 board with near taps, and the hard computer thinking in a worker while the page keeps drawing (run only these with `tests/smoke.py dammen`);
home → Slangetje: a locked level offers only OK on the web, counting level 1 and letters level 13 played to the end (a swipe and the arrow pad), the pause card and "keep playing"; also 320x568 and sideways;
home → Kleurplaten: a locked page offers only OK on the web, the sun coloured by tapping, undo, done, "my pictures", kept after a reload; a mirrored new mandala at 320x568, 568x320 and 844x390;
home → Tekenen: a real stroke, undo, mirror mode and stamps locked on the web (only OK), done, "my drawings", kept after a reload, clear then undo after the autosave, a 4th drawing offers only OK; in the full version 8 mirror lines (a 45-degree copy, by pixel) against 6, a stamp and 44 px targets at 320x568, 844x390 and 568x320; a locked device with 4 drawings keeps all 4 after clear and undo;
home → Klok kijken: a locked round offers only OK on the web, a set-the-clock round by dragging the hour hand, a what-time-is-it round with one mistake and its explanation card, a daily-rhythm round, + and -, the hint and "keep playing"; the layout at 320x568 and sideways;
home → Letters: one round of each kind played by taps in Dutch and English, the voice asked for every question, a gentle wrong tap, a locked tier stays locked; the layout at 320x568 and sideways;
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
Backup: `android/app/src/main/res/xml/backup_rules.xml` (Android 6-11) and
`data_extraction_rules.xml` (12+, cloud backup and device transfer) must keep including the
`sharedpref` domain, where Capacitor Preferences keeps the save; `tests/native.test.js` checks it.

**Release and CI:** `.github/workflows/ci.yml` runs `npm test` and a fastlane check on every push
and PR, and on `main` publishes `web/` to GitHub Pages. Store releases go through the lanes in
`fastlane/Fastfile` (table in `docs/release.md`, section 6); store texts and images stay in
`store/`, `tools/store-to-fastlane.mjs` converts them and `npm test` checks the store limits.
Push over SSH (`git@github.com:MWest2020/bazibo.git`): the gh token cannot push workflow files.

**When you change things:** Dogudoku's rules go in `web/games/dogudoku/rules.js` with a test;
puzzles only through `npm run puzzles` (`tools/gen-dogudoku.mjs`; `npm test` fails if
`puzzles.json` differs from what it generates, or if a puzzle has more than one solution). Its
dogs must never look like cats (floppy or rounded ears only). Picturedoku the same way:
`web/games/picturedoku/rules.js` with a test, what a tap does in `input.js` with a test (a picture
tap never changes a filled square the child did not just choose), puzzles through `tools/gen-picturedoku.mjs` (also
`npm run puzzles`; every puzzle unique and solvable with singles only); its pictures must stay
different by shape and colour. Grid rules go in `web/games/bubbels/grid.js` with a test. Level changes go through
`tools/gen-levels.mjs`, not by hand-editing the JSON. The generators themselves live in
`web/games/<id>/generate.js` and serve both the tools and random play in the full version
(`web/js/random.js`); keep a tool's output byte for byte the same when you change one, and keep
`tests/random.test.js` green (200 seeds per tier). After changing anything under `web/`, run
`npm run stamp`: it writes a content hash into `VERSION` in `web/sw.js` so installed copies update.
`npm test` fails if you forget, or if a new file is missing from the service worker's `ASSETS`.
Vier op een rij: rules in `web/games/vier/rules.js`, the computer in `ai.js` (pure, seeded in the
tests: hard and medium never miss a win or a block, easy loses often to a simple strategy, every
level plays only legal moves). Never call it "Connect Four" and never use its blue frame with red
and yellow discs. Win counters go through `recordStars` (they only go up).
Dammen: rules in `web/games/dammen/rules.js` (pure, with a test for every rule: compulsory capture,
men capturing backwards, multi-captures that must go on, crowning only when a move ends on the far
row, one-step kings on 8×8, flying kings and "take the most" on 10×10, a draw by repetition or by
`QUIET_LIMIT` king moves, and a player who cannot move loses). The computer in `ai.js` (pure,
seeded in the tests; easy loses most games to a child who looks one move ahead, medium and hard
never give a piece away for nothing); medium and hard search with a node budget in
`ai-worker.js`, and on the page with `PAGE_NODES` when a worker cannot start, so the screen never
freezes. A tap goes to the nearest square that can be tapped right now (the 10×10 squares are
under 44 px on a phone). Free: 8×8, together or against easy; the full version adds medium, hard
and 10×10. Puppies keep floppy ears, kittens pointy ones.
Slangetje: rules in `web/games/slang/rules.js` (pure; `pathDirection` is the path finder the tests
and the smoke test play with), 30 levels in `levels.json` (`size` is [short, long]; walls are
given for the upright board and turned on a sideways one). `npm test` plays every level to the
end in both languages and orientations; a new level or word must pass that. The youngest tiers
must never be losable (wrap-around, no bump into yourself, no walls). New words go in `WORDS` for
every language, with a picture in `art.js`.
Kleurplaten: every region must be one closed path with a unique id (`npm test` checks every
picture and hundreds of mandala seeds); a mandala region's `g` is its symmetry group. New pictures
go in `PICTURES` in difficulty order (few large parts first) with a name in `strings.js`. Pages are
saved through `saveArt`/`loadArt` only (never `saveGameOption`).
Tekenen: a drawing is a list of strokes and stamps (`web/games/tekenen/drawing.js`, pure, with a
test), saved as a short text through `saveDrawing`/`loadDrawings` only (never `saveGameOption`);
the text stays under `DRAWING_MAX` (coarser strokes first, then "the page is full") and must be
`isDrawingText`, which storage.js and `sanitizePayload` check too (drawings only in the `tekenen`
section, at most `DRAWINGS_BUDGET` characters per code). What is kept when lives in `session.js`
(tested without a screen): undo never goes back past the drawing as it was opened, a drawing that
was kept when opened may always be kept again, and an empty page deletes a drawing only when the
child leaves, never from the autosave. A merge or transfer never pushes the receiver's own
drawings out: the oldest incoming ones are left out and the card says how many. The mirror maths
is in `symmetry.js` (the dihedral group of 2, 4, 6 or 8 lines, tested); stamps are vectors in
`render.js` (the puppy keeps floppy ears); the stroke under the finger is drawn only by its new
points. Free: every colour, brush, the eraser, undo and `FREE_DRAWINGS` (3) kept drawings; the full
version adds mirror mode, stamps and up to `MAX_DRAWINGS` (100). Touch targets stay 44 px or more.
Klok kijken: the time logic in `web/games/klok/time.js` (pure). Dutch phrasing works around the
half hour ("vijf voor half drie" = 2:25); every 5-minute step of every hour is tested in both
languages, so a change to `phrase()` must keep those tests green. Answer options stay on the
tier's grid and never show the same clock twice. Stars through `recordStars`, random rounds
through `recordRandomSolved`.
Letters: everything a child needs is spoken. The only recorded audio in the app is the voice in
`web/games/letters/voice/`, made offline by `tools/make_voice.py` (Piper); never add a runtime
TTS, a cloud voice or a voice whose licence forbids commercial use. New words go in `WORDS` (both
languages, with a picture that exists in `art.js`) and in `tools/make_voice.py`; `npm test` checks
that every word, letter and phrase has a clip.
The flying bubble follows the path planned by `planShot` in `grid.js` (the same trace as the
aiming guide), so it always lands in the ghost cell; keep it that way.
