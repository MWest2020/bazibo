# AGENTS.md

**What this is:** Bazibo (repo and package still called bubbels), one app of play-and-learn
games for children of 3 to 10, with one €1 purchase for everything. Static web app in `web/` (plain HTML/CSS/JS, canvas, ES modules): the
shell in `web/js/` (home tiles in sections, settings, offer, parental gate, save data), each game in
`web/games/<id>/` (the bubble shooter `bubbels`, the puppy puzzle `dogudoku`, the picture sudoku `picturedoku`, finding pairs `memory` (shown as Paartjes / Pairs), the jigsaw `legpuzzel`, hide and seek `verstop` (shown as Verstoppertje / Hide and Seek), the railway path puzzle `treintje` (shown as Treintje / Train Tracks), four in a row `vier`, checkers `dammen`, tigers and goats `baghchal` (shown as Tijgers en geitjes (Bagh-Chal) / Tigers and Goats (Bagh-Chal)), chess `schaak` (shown as Schaken / Chess), the game of the goose `ganzen`, the race game `pachisi` (shown as Ludo with the line "met één dobbelsteen" / "with one die" under it; Ludo is the default mode, Pachisi, the original from India, the second), the quartets card game `kwartet`, the learning snake `slang`, colouring pages and mandalas `kleuren`, free drawing with a mirror mode `tekenen`, the toy piano `piano`, the drum kit `drums` (shown as Drumstel / Drums), telling time `klok`, learning the letters by sight `letters`, the garden maze `doolhof` (shown as Egeltje / Little Hedgehog), adding and taking away on a number line `kangoeroe` (shown as Kangoeroe op de getallenlijn / Kangaroo Hops), what goes into bread and other dishes `keuken` (shown as Keukentje / Little Kitchen), counting money in a little shop `winkel` (shown as Winkeltje / Little Shop), topography with map packs `kaart` (shown as Kaartpuzzel / Map Puzzle), recording your voice for a parrot to say back `papegaai` (shown as Papegaai / Parrot)). Wrapped with Capacitor as Android and iOS
apps (`android/`, `ios/`; release steps in `docs/release.md`). Roadmap:
`docs/reference/roadmap.yml` (shown on westerweel.work/nu/; mark an item done only with
evidence, in the same PR). Design: `docs/design/` (the style audit and the 2.0 proposal, approved by
Mark 21 Nov 2026 and built in phases; `tools/design_audit.py` re-measures contrast and touch targets
with screenshots). The design tokens are the `--bz-*` custom properties at the top of
`web/css/style.css`: colours (the brand of round 3 from `design/brand/tokens.json`, Mark 24 Nov
2026: paper `--bz-base` page, ink, soft ink, brand violet; `tests/brand.test.js` checks them against
that file and the contrast rules below), type scale, spacing, radii, touch sizes, depth. New CSS uses the `--bz-*` names; the old ones
(`--primary`, `--ink`, `--gold`, `--sky`...) are aliases. Text never sits white on the warm accent (ink
instead), locked text is `--bz-ink-quiet`, an empty star is an outline (`--bz-star-empty`), and
Bubbels shows no points. Every game menu is built from the shell's menu components (phase 2):
`web/js/menu.js` makes them (`menuHead`, `menuLine`, `optionCard`, `optionBox`, `segCard`,
`levelCell`, `starsHtml`, and for a list of the child's own pictures `withTrash` and `askThrowAway`) and `web/css/style.css` styles them (`.menu`, `.option-card` with its
`.wide`, `.pic` and `.lead` forms, `.option-box` and `.seg-card` for the computer's levels,
`.player-slot` for who plays, `.level-cell` in a `.level-grid`, the random card, `.menu-actions` for
the Play bar with `.with-actions` on its scroll area, `.bar-title` for a bar with a line under its
title). Use the helpers; a few parts are still built in the game with the same classes (the
computer's level segments and the player slots of the board games, Kwartet's set counts,
Paartjes' cards, Ganzenbord's counting cards): keep their picture `aria-hidden="true"`, so a
button's name is its words only. A game adds its own hook classes (`puzzel-opt size-p9`) and art,
never its own button look. Every option has a picture from the
game's own art; a level cell shows its stars only once played (quiet stars). The selected option,
segment, player and the next level are the group's tint with a 3 px border in the group's accent:
each group has three colours in `style.css` (`--bz-learning-acc`, `-tint`, `-ink`, and the same for
puzzles, board, creative, action, the five scraps of the logo; an accent is 3:1 or more on white and
on the paper page, the ink 4.5:1 or more on its tint, text sits on the tint or in the ink, never on
the accent), and
`main.js` gives every game screen its group (`data-group`, from `meta.group`), which sets
`--bz-group-acc/-tint/-ink`. Touch targets in a menu are 48 px or more. Locked choices never sit between the free ones: every game menu ends its
render with `foldLocked(box)` (`web/js/fold.js`), which moves each button with the class `locked`
into one closed "Volledige versie" fold at the end of the menu, under a copy of its section's
heading (or the `data-fold-head` name of a group inside a card, like the computer's levels). The
buttons are moved, not copied, so their own click still offers the full version (OK on the web,
`offerUnlock` in the app); with the full version nothing is locked and there is no fold. A new menu
choice that is locked gets the class `locked` and nothing else. Exceptions: the play screens of
Tekenen (mirror, stamps) and Papegaai (voices), which are tools, not menus. The smoke test opens
the fold by a real tap (`choose`, `unfold` in `tests/smoke.py`). What the fold empties gets the class
`fold-emptied` (display none) and comes back on the next call, so a menu kept in the page shows
again after a purchase or a restore; the smoke test buys in the session and checks Bubbels and Dogudoku.

The home screen builds one tile per game in `GAMES` (`web/js/games.js`), in the section its
`meta.js` names with `group` (the sections and their order are `GROUPS` in the same file, ordered by
audience: Leren first for teachers, then Puzzels, Bordspellen, Creatief, Actie; a new game picks
one); each section sits on its group's tint with its name in the group's ink; an optional `subKey`
puts a small second line under the name (Ludo); a section's name stands beside its group mark.

**The brand** (round 3, `design/brand/`, CC0; Mark 24 Nov 2026): the cut-paper b on five coloured
scraps and the drawn name "bazibo". `web/js/logo.js` draws them inline from the same paths as
`design/brand/logo/` (`markSvg(group)`, the b on that group's scrap; `wordmarkSvg()`, the letters in
`currentColor`): presentation attributes only, no ids, `url(#)` or `<use>`, aria-hidden;
`tests/brand.test.js` fails if a path drifts from the SVG files. The home header is the mark beside
the wordmark, with the name as visually hidden words in `#brand-text` (from `brand.js`). Change the
art in `design/brand/` first, then `logo.js`. Every icon and launch screen comes from
`design/brand/icon/`, `adaptive/` and `logo/mark.svg` through `tools/make_icons.py --native`
(favicon, apple-touch-icon, web and maskable icons, Android legacy, round, adaptive foreground and
monochrome on an ink background, iOS AppIcon, launch screens on paper, `store/play-icon-512.png`);
the feature graphics are the brand's own SVGs (`design/brand/store/feature-graphic{,-en}.svg`, the
English one assembled from the English screenshot frame's outlines, the Dutch line likewise from the
Dutch frame: "Spelen en leren, zonder reclame", never a game count that goes stale) through
`tools/feature.html` (`tools/store_shots.py --feature`), which also writes `web/img/share.png`, the
link-preview image of bazibo.nl (the Dutch feature graphic centred on 1200x630); `--share` remakes
only that one. After either, `npm run stamp`; never edit `share.png` by hand. The store
screenshots (`store/screenshots/<nl|en>/<size>/`, the same 8 per size) are the real app, shot by
`tools/store_shots.py` on a real device's shape (360x640, 430x932, 768x1024) scaled into the frame's screen area and set in the brand's screenshot
frame of that language (`design/brand/store/screenshot-frame-{nl,en}.svg`: the mark and the caption
on top, the trust row below, on paper); every shot after the first has its own caption naming the game as the app does
(`tools/store_captions.py` sets them in Fredoka as outlines into `design/brand/store/captions.json`; run it before
`store_shots.py` when a caption or a scene changes); for the App Store sizes the frame's top and trust row are
scaled as one and the screen takes the rest. Never put a locked choice in a shot. Each section is a CSS grid with `auto-fill`/`minmax`: 3 tiles a row on most
phones, 2 at 320 px, the sections side by side on wider screens; a section wider than the screen wraps its tiles (`.home-inner` keeps `max-width: 100%`), so there is never sideways scroll from 320 to 1400 px.

**Hard rules**
- No ads, no trackers, no analytics, no accounts, no third-party SDKs. Ever. Zero network
  requests outside the game's own origin; the CSP in `web/index.html` stays strict. The only
  native additions are Capacitor, `@capacitor/preferences`, `@capacitor/app` (back button) and
  `cordova-plugin-purchase` (all MIT), with the store's own billing library. Never add a receipt server, RevenueCat or anything like it.
- No CDN and no build step. Any library is vendored with its licence and listed in `CREDITS.md`.
  Only CC0, MIT, BSD, Apache-2.0, or CC BY 4.0 with attribution shown in the app and on bazibo.nl
  (on the privacy pages; issue #22). Fonts may also be SIL OFL 1.1 (Mark, 21 Nov 2026): vendored
  in `web/fonts/` with `OFL.txt`, loaded by `@font-face` from that local file, listed in `CREDITS.md`.
  The one font now is Nunito as "Bazibo Sans" (`web/fonts/bazibo-sans.woff2`, made by
  `tools/subset_font.py`; budget 150 KB for all fonts).
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
- The store links on bazibo.nl ("Download in Google Play", "App Store: binnenkort"; on the home
  screen under the tiles and on Plannen / Roadmap) are for parents on the website only: they ship
  `hidden` inside a `data-store-links` block and `web/js/store-links.js` shows them only when it is
  not the app (`inApp`: the Capacitor bridge, https://localhost or capacitor://localhost). The
  home screen's link goes through the parental gate too. `tests/store-links.test.js` checks that
  every Play link in `web/` ships hidden; an App Store link waits until the app is live there.
- Save data only through `web/js/storage.js`: one versioned document (Preferences in the apps,
  localStorage on the web). A new game adds a section under `games`; a format change raises
  `version` and adds a step to `migrate()`. Never drop fields you do not know (a newer app
  version may have written them), never delete the old keys.
- Voortgang overzetten (`web/js/transfer.js`): anything that comes in through a QR code or pasted
  text is untrusted. It is checked (size, checksum, the shape of every value; `sanitizePayload`)
  before it reaches the save, and the purchase never travels. A new game section with new kinds
  of values needs a rule in `sanitizePayload`, or that part is dropped on transfer.
- Papegaai's recording never leaves the device and is never saved (Mark, 20 Nov 2026). It lives in
  memory only (`web/games/papegaai/sound.js`) and is dropped when the child leaves the game or the
  app goes to the background. Nothing in `web/games/papegaai/` may use `storage.js`, browser
  storage, the network, the transfer code, files or analytics (`tests/papegaai.test.js` fails on
  it). The microphone is asked for only when the child presses record, the first time on a device
  behind a one-line card and `askParent`; only that yes is kept (`settings.micGate`, never
  transferred). The microphone is on only while recording. A refused or missing microphone gives a
  calm card and nothing else changes. No speech synthesis and no recorded voices of others: every
  voice is the child's own recording, changed on the device.

**Search engines** (`web/js/seo.js`, `tests/seo.test.js`): `web/robots.txt`, `web/sitemap.xml`, and in
the heads of `index.html` and the six parents' pages a title, a description, the canonical address,
hreflang (Dutch, English, x-default) and on the home page and Plannen / Roadmap Open Graph with
`web/img/share.png` (the Dutch feature graphic on 1200x630, made by `tools/store_shots.py`). The home page also carries one
schema.org `MobileApplication` block (`application/ld+json`: a data block, never run, so the CSP
needs no change). These name `https://bazibo.nl/` absolutely because crawlers need that; the page
never loads any of them, and that is the only exception to "relative URLs only". The home screen
is one page in two languages, so `?lang=nl` and `?lang=en` give search engines an address per
language (a saved choice still wins); its canonical link is set by `seo.js`, not in the HTML. The
home's title and description go through `t()` (`meta.title`, `meta.description`); the Dutch copy
in `index.html` must equal them, and the brand name in these static copies must equal
`brand.js` (the test checks both). The redirect pages (`/privacy/`, `/plannen/`, ...) are `noindex`
and stay out of the sitemap. A new parents' page gets the same head and a sitemap entry.
Search Console is verified by a DNS record, never a script (`docs/marketing/search-console.md`).

**Run:** `python3 -m http.server 8080 --directory web`, open http://127.0.0.1:8080/

**Test:** `npm test` (grid, shots, levels, service-worker cache, gate, purchase, i18n, save data,
native config, Papegaai's privacy rule, the brand's paths and colours, Treintje's rules and 200 puzzles per age, Keukentje's dishes, 200 rounds per tier and the cook's lines, Winkeltje's money maths, every way of paying exactly and the shopkeeper's lines, 200 rounds per tier) and `uv run --with playwright python tests/smoke.py` (home → Dogudoku: a wrong puppy lights up, puzzle 1 solved by tapping, 3 stars saved;
home → Picturedoku: a wrong picture lights up, puzzle 1 solved square-first and picture-first, 3 stars saved;
home → Paartjes: the bigger boards and the other cards offer only OK on the web, a game alone on 2×3 with one miss (a third tap does nothing) won with 3 stars saved, a game together on 3×4 won by player 1 with back + keep playing during a miss and "More cards" at the end of the free part, a game against the computer whose turn is slow and visible, won and counted; the layout at 320x568, sideways and on desktop with 12 and 20 cards (`tests/smoke.py memory`);
home → Legpuzzel: the sizes as level cells, 9, 16 and 25 pieces free with their age and 30, 48 and 60 locked in the fold (no 4, 6, 12 or 20), a save from before with the last size on 12 opening on 9 and keeping its old ticks, 30, 48, 60 pieces and the other pictures offer only OK on the web, the 9-piece garden laid by real drags (a drop on another piece's place does not snap, a drop near its own does), saved and ticked off, the 16-piece sea with the example picture off and back + keep puzzling halfway, the 16 and the 25 pieces finished by the test hook and a last real drag, "More puzzles" at the end of the free part; the layout at 320x568, sideways and on desktop with 9 to 60 pieces, every piece on screen and 44 px or more with its tabs, the magnifier only for small pieces; 48 and 60 pieces at 390x844 and 844x390 in Dutch and English: a real drag without and through the magnifier (the view moving along to a place out of view), a finger on an empty spot moving the view, the rest by the test hook and the last by a real drag, saved and ticked off (`tests/smoke.py legpuzzel`);
home → Vier op een rij: hard is locked on the web, a two-player game on the kleuterbord played to a win, a game against easy with one take-back;
home → Dammen: medium, hard and the 10×10 board offer only OK on the web, a two-player 8×8 game played to a win by taps, a move against easy with the take-back and "keep playing", the glow on the pieces that must capture and a double jump by taps; the layout at 320x568, sideways and on desktop, the 10×10 board with near taps, and the hard computer thinking in a worker while the page keeps drawing (run only these with `tests/smoke.py dammen`);
home → Tijgers en geitjes (`tests/smoke.py baghchal`): the tile in Bordspellen, medium and hard offer only OK on the web; two players: a goat placed next to a tiger shows the tiger's dots and the goat it would jump, jumped by a real drag (the goat hops to the meadow), taken back, then the tigers capture five and win (not counted); against easy as the goats whole games by real taps and drags (placing, tap-tap, a drag dropped off the field keeps the piece picked up) until the goats win, with a take-back, back + keep playing and the win counted; the layout at 320x568, 844x390, 568x320, 390x844 in English and desktop, every point 44 px or more, and hard (as the goats, it starts) thinking in a worker while the page keeps drawing;
home → Schaken (`tests/smoke.py schaak`): the tile in Bordspellen, medium and hard offer only OK on the web; two players by real taps and drags with en passant (shown as a ring on d6), a promotion (the picker with the queen first, "not yet", then a knight), castling and a mate on f7 (the king glows, not counted), a drag dropped off the board keeping the piece picked up; against easy a move and its answer taken back, a drag, the hint, back + keep playing, a king in check glowing with a gentle message, and a counted mate; the layout at 320x568, 568x320, 390x844 in English, 844x390 and desktop (the board the phone's full width, a near tap reaching a piece under 44 px) and hard thinking in a worker while the page keeps drawing;
home → Ganzenbord: the winter and sea boards and a 3rd and 4th goose offer only OK on the web, a game against the computer goose played to a win by "count yourself" taps (a wrong tap only shows where), the goose chain and the win card, back + keep playing halfway a throw, the Android back button, no voice clip loaded; the layout at 320x568, sideways and on desktop, four geese on the winter and sea boards, a near tap counts and a tap on the next stone does not (`tests/smoke.py ganzen`);
home → Ludo (`tests/smoke.py ludo`): the tile "Ludo / met één dobbelsteen" in Bordspellen with Ludo picked, a 3rd and 4th player and medium offer only OK on the web; two children: two throws that cannot be used keep the turn (three tries), a 6 counted by tapping the die's pips brings a pawn out by real taps and throws again, a pawn picked with its square glowing and dots on the way, a capture by real taps (the other pawn walks back to its yard), taken back and made again, a tap on a pawn that would land on its own pawn says why (not counted); against easy with 2 pawns whole seeded games by real taps with "count yourself" to the child's win, with a take-back, back + keep playing and the Android back button, the win counted as Ludo's (`ludo-cpu-1`); back during the winning walk still ends with the win card; two computers play a whole game; the layout at 320x568, 568x320, 390x844 in English, 844x390, desktop and four players in the full version, every tap area (the die, pawns, the target, the HUD) 44 px or more;
home → Ludo → Pachisi (`tests/smoke.py pachisi`): the mode picked by a tap in the menu, a 3rd and 4th player and medium offer only OK on the web; two children: the shells thrown by a tap and counted by taps (a closed shell does not count), the picked pawn's square glowing with dots on the way, a capture by real taps (the other pawn walks back to the middle), taken back and made again (not counted); against easy with 2 pawns a whole seeded game by real taps with "count yourself" to the child's win, with a take-back, back + keep playing and the Android back button, the win counted as Pachisi's (`cpu-1`); the layout at 320x568, 568x320 and four players in the full version (its board is unchanged since PR #73), every tap area (shells, pawns, the target, the HUD) 44 px or more, no voice clip loaded;
home → Kwartet: 6 and 8 sets and a 4th player offer only OK on the web, a seeded game against two computers (a question that gets "no", the computers' turns slow and visible with speech bubbles, back + keep playing during a question, then won by asking well and counted, "More sets" offers only OK), two children with the pass-the-phone card hiding the cards (also after keep playing); a seeded game against one computer with the pile (5 cards each and 6 on the pile, a "no" makes the pile glow, a tap draws its top card with a card flying into the hand, the computer draws slowly and visibly, back + keep playing while drawing, played to the end with an empty pile); the layout at 320x568, sideways and on desktop with 4, 6 and 8 sets, two to four players and the pile (`tests/smoke.py kwartet`);
home → Slangetje: a locked level offers only OK on the web, counting level 1 and letters level 13 played to the end (a swipe and the arrow pad), the pause card and "keep playing"; also 320x568 and sideways;
home → Kleurplaten (`tests/smoke.py kleuren`): a locked page offers only OK on the web, the sun coloured by tapping, undo, done, "my pictures", kept after a reload; a mirrored new mandala at 320x568, 568x320 and 844x390, every colour 44 px or more (6 a row on upright phones narrower than 425 px); the bins in "my pictures" by real taps (48 px, none on a locked page, clear of the card's middle third, other cards and Ja at 320x568, 390x844 and 844x390; a tap on the card's middle opens the page): the card with the page and Nee focused, Nee keeps it, Ja throws it away (the sun blank again in Pictures), gone after a reload, the last one takes the section with it;
home → Tekenen: a real stroke, undo, mirror mode and stamps locked on the web (only OK), done, "my drawings", kept after a reload, clear then undo after the autosave, a 4th drawing offers only OK; in the full version 8 mirror lines (a 45-degree copy, by pixel) against 6, a stamp and 44 px targets (colours and tools, upright too) at 320x568, 844x390 and 568x320; a locked device with 4 drawings keeps all 4 after clear and undo; throwing away (`tests/smoke.py tekenen`): 2 drawings by real input, the bin (48 px, on screen) asks "Weggooien?" with the drawing, a double tap deletes nothing, Nee keeps it, Ja throws it away, gone after a reload with the other kept; at the free limit of 3 a bin opens "+" again and a new drawing is kept; the list and card at 320x568, 390x844, 844x390 and in English (Nee first and focused, no bin over its card's middle third, another card or Ja; a tap on the card's centre and near the bin opens the drawing) (screenshots `shots/teken-delete-*`, `shots/kleur-delete-*`);
home → Piano (`tests/smoke.py piano`): a tap sounds (oscillators counted), two fingers hold two keys, a slide plays every key it passes, a black key; a locked song offers only OK on the web and stays on the list; Vader Jacob played along by tapping the glowing key with one wrong key first (the song waits), 3 stars saved and "More songs" (the offer over the list); Listen lights the keys and a tap stops it; the sound setting followed ("Geluid aan" on the piano); the back arrows and the Android back button; the layout at 320x568, 360x740, 568x320, 844x390 (full version, every song open), 390x844 in English and desktop, every key on screen and the coloured keys 44 px from 390 wide, about 42 at 360, 37 at 320; leaving the app stops Listen and lets go of every key; 7-10: the age buttons, its locked songs offer only OK on the web, free play with a window of 8 of the 15 coloured keys, the map and the turn line, the map slid to the top C, the whole Ode played to the end by taps while the window follows (3 stars, "More songs"), the age kept after a reload and back to 4-6; in the full version Für Elise played to the end by taps on 390x844 and 844x390 (all 15 keys in sight, no map) with every lit key of Listen in sight, and the window at 320x568 and 568x320;
home → Drumstel (`tests/smoke.py drums`): the tile in Creatief, a tap sounds (oscillators counted), two fingers hit two pads at once; a locked rhythm offers only OK on the web and stays on the list; Rock (4-6) played to the end by tapping the glowing pad after Begin and the count-in, with one wrong pad first (the rhythm waits), 3 stars saved and "More rhythms" (the offer over the list); Rock (7-10) played on the beat with two fingers at once (at least 2 stars); Listen lights the pads, and the background stops it, sends a rhythm back to Begin and lets go of every pad; the back arrows and the Android back button; the sound setting followed; the layout at 320x568, 390x844 in English, 844x390 (full version), 568x320 and desktop, the pads standing like a drum kit (never the grid there) with the stands drawn, standing on the bottom of the stage, a tap in every pad's corner hitting that pad, every pad on screen, 80 px or more and none overlapping, the strip above the kit;
home → Klok kijken: a locked round offers only OK on the web, a set-the-clock round by dragging the hour hand, a what-time-is-it round with one mistake and its explanation card, a daily-rhythm round, + and -, the hint and "keep playing"; the layout at 320x568 and sideways; Digitaal (`tests/smoke.py klok`): a locked digital tier offers only OK on the web, dig-t1-1 played to the end by real taps with one wrong answer (the card shows both clocks, 2 stars saved), in the full version dig-t2-1 (the digital clock set by real taps on its + and −, to a clock and to words with the clock following, the hint) and dig-t3-1 on the 24-hour clock with 3 stars, analogue and digital agreeing on every question; every kind at 320x568, 390x844 in English, 568x320, 844x390 and desktop, every button 48 px or more;
home → Letters: one round of each kind played by taps in Dutch and English (the big letter matches its tile, the word with a gap at the start, the word with a gap inside it, the build word shown for a moment), a gentle wrong tap, a locked tier stays locked, tier 1 shows the build word for a moment and again on a tap on the picture, tiers 2 and 3 the picture only with extra tiles; a round with four-letter words built by real taps with the sound on (every word fills its last slot and finishes, no page errors); the layout at 320x568 and sideways (`tests/smoke.py letters`);
home → Verstoppertje (`tests/smoke.py verstop`): the tile in Puzzels, a locked place (the beach), a locked tier and the random card offer only OK on the web; garden-t1-1 played to the end by real taps with two wrong spots first (each creature peeks out and waves with its hello, then the spot settles back ajar; a second look at a spot is not counted), then the hedgehog (found, it stays in sight), the stars by extra looks saved, the next round (the animal behind another kind of spot), back (the Android back button) + keep playing with the looked spot still ajar, the end of the free part offers only OK and lands on the menu with the save kept, no voice; the layout at 320x568, 390x844 in English, 568x320, 844x390 and desktop for one animal, two animals, look-alikes and the memory question, every spot on screen, 64 px or more and none overlapping; a tier 3 memory round by real taps (a look-alike says what it lacks, every spot closes, the first creature met is asked and answered, no hint shows); the hints at 390x844 and 844x390 (`verstop_hints`): only on the hidden animals' spots (in t3 the look-alikes too, each with its own feature) and inside that spot's button, t1 still and in sight from the start, t2 and t3 coming and going (watched 14 s: each seen and gone, never on a friend's spot), with reduced motion every hint still and in sight, hidden (computed visibility) on a found spot while the other animal's goes on, on an opened look-alike and in the memory question, screenshots `shots/verstop-hint-*`; the pixel matrix of every hint (`verstop_hint_pixels`, numbers in `shots/verstop-hint-pixels.json`);
home → Treintje (`tests/smoke.py treintje`): the tile in Puzzels, 6-7 and 8-10 in the fold offering only OK on the web; a 3-5 puzzle (after the how-to card) laid by real drags with one blocked step first (nothing happens, the line says why) and one take-back by dragging back, the rest by a finger (touch events); a tap on the track takes it back to there; one fast move over station 2 onto station 4 says "Eerst station 3!" and a new puzzle clears that line; the little train rides to the last station, the end card, saved per age with the last age, "Nog een" gives a new puzzle; back + keep playing with the track kept, the Android back button; the layout at 320x568, 390x844 in English (Train Tracks), 568x320, 844x390 and desktop for every age on its biggest board, every square 44 px or more and on screen, a first step by a real drag; a puzzle laid and ridden under the real CSP (no violation, `shots/treintje-csp-*`); screenshots `shots/treintje-*`;
home → Kangoeroe op de getallenlijn (`tests/smoke.py kangoeroe`): the tile in Leren, a locked tier offers only OK on the web; round t1-1 played to the end by real taps with one wrong answer first (back to the start, the way as dashed arcs, counted once), "how many hops?" by +1 taps to the flag (numbered arcs, +1 greyed there) then the number, "3 + 4" with the pips filling then Hier!, one sum by a tap on the line; 2 stars saved; the next round, the Android back button and "keep playing"; the end of the free part offers only OK and lands on the menu with the save kept; the layout at 320x568, 390x844 in English, 568x320, 844x390 and desktop for tiers 1-3, every button 48 px or more and on screen, 0-100 a window with a map on phones that follows the kangaroo, all of it on desktop;
home → Keukentje (`tests/smoke.py keuken`): the tile in Leren, a locked tier offers only OK on the web (6-7 and 8-10 in the fold); round t1-1 (after the how-to card; the cook greets with the task, "Hoi! We maken ... Wat hebben we nodig?", in its bubble beside it, `shots/keuken-greet-*`) played to the end by real taps with one wrong ingredient first (it bounces back, greyed, counted once, the cook saying "Hmm, <ingredient>? Dat hoort bij ...", `shots/keuken-wrong-*`), the bowls filling one by one, each right one said ("Fijn! Nu hebben we de ...") with the cook bobbing, and the dish ready ("Klaar! Eet smakelijk!", the cook stirring with its hat wobbling, `shots/keuken-ready-*`), later questions without the greeting, 2 stars saved; the next round with two wrong taps (the help glows on what is left), the Android back button and "keep playing" with the bowl kept; the end of the free part offers only OK and lands on the menu with the save kept; no voice; in the full version a 6-7 round (eight pictures, "which dish?" under the cover with one wrong dish first) and an 8-10 round (where from, the steps in order with a later step first, the odd one out) by real taps, each kind asked by the cook with its own question, and a random round saved per tier with the last tier and the how-to card; the layout at 320x568, 390x844 in English (Little Kitchen), 568x320, 844x390 and desktop for every kind of question, every target 48 px or more, on screen and not overlapping, the dish and every bowl or slot inside the kitchen, no label spilling, the cook (48 px or more) and its bubble inside the kitchen covering no picture, bowl, slot, the dish, its name, the back button or each other, the line inside the bubble at the start, after two taps that do not fit (with the help) and after a right "where from?" (its fact), and the four lines pinned from every line of 60 rounds per tier said in every kind's kitchen through the test hook (the two longest, the yeast fact among them, and the two with the longest word, the boerenkoolstamppot lines in Dutch) inside the bubble, covering nothing, with the dish still 48 px or more (`KE_LONG_JS`, `shots/keuken-long-*`); the cook bobbing on a right ingredient and stirring when the dish is ready, and still with reduced motion (`keuken_motion`); t1-1 played by real taps under the real CSP (no violation, `shots/keuken-csp-*`); screenshots `shots/keuken-*`;
home → Winkeltje (`tests/smoke.py winkel`): the tile in Leren, a locked tier (in the fold) offers only OK on the web; round t1-1 (after the how-to card; the shopkeeper greets with the price, "Goedemorgen! Een stuk kaas, dat is € 2.", `shots/winkel-greet-*`) paid by real taps on the purse with one too-few payment first (the missing euro a dashed ghost on the counter, the shopkeeper says "Nog € 1, alsjeblieft.", counted once, a second tap on Betalen counts nothing, a coin more and the price again without a greeting), one euro too many marked by its dot and taken back by a tap on the counter, one coin laid and one taken back by a real drag with the mouse and with a finger (touch events), a drop back on the coin's own button doing nothing, a dot per euro filling, every right payment thanked ("Dank je wel! ... je <thing>!") with the thing in a bag and the shopkeeper bobbing (`shots/winkel-paid-*`); 2 stars saved; the next round, back (the Android back button) + keep playing with the counter kept; one euro too many paid ("Dat is € 1 te veel. Pak die maar terug.", the coin marked), two wrong tries and away in the pause, then "Verder spelen" still shows how to pay; in t1-3 € 3 or € 5 with both of the twos purse's € 1 coins laid marks one € 1 to take back with € 2 ghosts ("Nog € 1, alsjeblieft. Pak eerst € 1 terug en ruil.", `shots/winkel-swap-*`); the end of the free part offers only OK and lands on the menu with the save kept, no voice; in the full version round t2-1 paid exactly by real taps (notes too, the counter's total in Dutch money) with 3 stars, in t1-3 also € 3 or € 5 paid with € 2 coins only ("Dat is € 1 te veel. Kun je het precies betalen?", one € 2 marked, a € 1 ghost, `shots/winkel-overswap-*`); in t2-3 the shopkeeper asking "Kun je betalen met zo min mogelijk munten en briefjes?" up front and the right amount with more pieces answered "Het klopt! Kan het ook met minder munten en briefjes?", an 8-10 change question by real taps on the till counting up from the price (one coin too many first: its pile marked, taken back by a tap; right: "Dat klopt! Dit krijg je terug.") and a budget question (a pair over the budget, then one that fits); the layout at 320x568 in Dutch and English, 390x844 in English (Little Shop, € 2.50), 568x320, 844x390 and desktop for every kind (two things too) with the counter as full as it gets, every coin, note, pile, thing and button 48 px or more, on screen and not covered, the shopkeeper and its bubble on screen, overlapping no coin, ghost, thing or button, the line inside the bubble, and per kind a short payment with as many piles as can lie there, every ghost in sight on the counter; the shopkeeper bobbing on a right payment and still (the bag too) with reduced motion (`winkel_motion`); a question paid by taps and a drag under the real CSP (`shots/winkel-csp-*`); screenshots `shots/winkel-*`;
home → Kaartpuzzel (`tests/smoke.py kaart`): the tile in Leren, the menu on the device's own country (Nederland on nl-NL, the United States on en-US, the United Kingdom on en-GB, none on nl-BE and de-DE), "Ander land…" picking another (kept after a reload), a locked round offers only OK on the web; nl-t1-1 played to the end by real input (a wrong drop on another province's place bounces, counts once and makes the piece's place glow after two, mouse drags, a finger drag with the piece above the finger, tap-tap), 2 stars saved, the next round, back + keep playing, the end of the free part offers only OK; "Waar ligt…?" on the continents with two wrong taps (the right one glows) and the rest by real taps; the layout at 320x568, 390x844 in English, 568x320, 844x390 and desktop for a puzzle, "where is", the capitals and the whole puzzle without lines, pieces 64 px and buttons 44 px or more on screen, the magnifier only for the US and Europe on phones (on from the start for the smallest states at 320 px), a real tap on a state's centre at 320 px finds it;
home → Egeltje (`tests/smoke.py doolhof`): the tile in Leren, a locked tier offers only OK on the web, the alphabet a-e played to the end by real input (a swipe, the arrow pad and the arrow keys) with a wrong letter bumped (it stays, one mistake, 2 stars saved) and a crow walked into (it flutters off, the hedgehog stays, nothing lost, the next step walks on), no frames while the garden waits, back + keep playing (nothing moves before a step), the Android back button, the end of the free part ("More rounds" offers only OK over the list); the layout at 390x844 in Dutch and English, 320x568, 844x390, 568x320 and desktop, the arrows 48 px or more;
home → Papegaai (`tests/smoke.py papegaai`, Chromium's fake microphone: `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`): the tile in Creatief; a voice before any recording asks for one; the first press shows the why card, then the parental gate (cancelling either asks no microphone), after the gate the system is asked once and the microphone closed again; a held recording said back and Gewoon, Muis and Beer played (sources counted); a locked voice offers only OK on the web; a tap records until the 10 s cap; the back arrow, the background and the Android back button (also mid-recording) drop the recording and close the microphone; a voice tapped while recording does nothing; a passed gate with the system answering 'prompt' goes through the card and the gate again, with 'granted' it records at once; a refused microphone (also after a reload, without the gate again) and none at all give the calm card and the rest of the app works; the layout at 320x568, 390x844 in English, 568x320, 844x390 (full version: the other voices played, the choir three sources) and desktop, every button 64 px or more, on screen and not overlapping;
home → Bubbels, 5 shots on
desktop and 390x844 in Dutch and in English, settings and the language switch, the free-tier
offer, a returning player, a sideways 844x390 check, screenshots in `shots/`;
the offers: Bubbels level 10 ended for real on the game screen (`window.__bubbels.clear()`), then every way out of the offer (the web's OK; in a stand-in app Later, the gate cancelled or failed, the store cancelled, an error, pending, a restore that finds nothing, a purchase) lands on the level list with level 10 saved and 11 locked or, once bought, open; the pause button on a finished board without its card leads there too; the same OK at the end of the free part of Dogudoku, Picturedoku, Slangetje, Klok kijken and Letters lands on their list with the save kept, and a locked part in Vier, Dammen, Tijgers en geitjes, Ganzenbord, Ludo, Kleurplaten and Tekenen leaves the player where they were (`tests/smoke.py offers`, Bubbels alone with `tests/smoke.py bubbels`);
the store links, the home layout and the menus (`tests/smoke.py store`): Google Play and "App Store: coming soon" on the home screen, Plannen and Roadmap at 390, 320 (Dutch and English), 568x320, tablets upright (600x960, 768x1024, 820x1180, 900x1200) and sideways (960x600, 1024x768, 1180x820) and desktop, 44 px or more and no sideways scroll (on the home screen every tile in sight), the home link only after the parental gate (cancelled: nothing opens), and none of them in a stand-in app; every game's first screen and the settings at 320x568 (Dutch and English) and 390x844 with the back button 60 px (never squeezed by a long title) and Bubbels' "Willekeurig" 48 px tall; the home sections in the order Leren, Puzzels, Bordspellen, Creatief, Actie, every game screen in its tile's group, the chosen option and the next level bordered in the group's accent, and every menu button (the fold opened too) 48 px or more, all under the real CSP (any violation fails); Piano's and Drumstel's bar 100 px or less at 320x568 in Dutch and English with every song and rhythm (`piano_bars`, `drums_bars`); the home screen calm at 390x844 and 844x390 (`home_calm`): no `#home-bg` canvas (the floating bubbles of 1.0 are gone, Mark 23 Nov 2026) and no animation frames while it is shown, after loading and after a game and back.
CI runs both on every PR (the `smoke` job). A win card that offers the full version shows the
offer over the game's list (`shell.show(<list>)`, then the offer), never over the finished board. Look at the screenshots before claiming something looks
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

**Release and CI:** `.github/workflows/ci.yml` runs `npm test`, the Playwright smoke test and a fastlane check on every push
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
Paartjes (Memory, id `memory`): never call it "Memory" on screen (a Ravensburger trademark). Rules in
`web/games/memory/rules.js` (pure, tested: a deal has every picture exactly twice, a pair keeps the
turn, a miss waits for `hide` and passes the turn, most pairs wins, `starsFor` counts turns and
never time, `bestGrid` turns the grid to fit). The computer in `ai.js` (pure, seeded in the tests:
only legal cards, every game ends, a child who remembers beats it in at least 85% of games and one
who remembers a third of the cards in at least 30%); keep it gentle. Cards in `art.js`: every set
needs at least as many pictures as the biggest board has pairs, each different by shape and colour
within its set, with a name `memory.pic.<id>` in both languages. Free: 2×3 and 3×4 with the fruit;
the full version adds 4×4, 4×5 and the picture-book and shapes cards.
Legpuzzel (jigsaw): geometry and rules in `web/games/legpuzzel/rules.js` (pure, tested: neighbouring
pieces fit, the border is straight, an outline stays inside its drawing, the layout fits board
and tray on every screen with a piece of 44 px or more with its tabs, the scatter stays on the
tray, a piece snaps only near its own place, the magnifier's view never shows past the stage).
Ages per size are in `SIZES` (Mark, 17 Nov 2026: 9 pieces 3+, 16 4+, 25 5+, 30 6+, 48 7+, 60 9+;
nothing for two-year-olds). Sizes that left the menu (`RETIRED_SIZES`: 4, 6, 12, 20) keep their
ticks in the save, unseen; a saved last size that is gone opens on 9 (`knownSize`). Pieces under 56 px get the magnifier (`zoomFor`): the board and the pieces live in one layer
(`#legpuzzel-world`) that is scaled and moved; positions stay in stage units, only the pointer is
converted (`toWorld`), so never put page coordinates into `game.pos`. Pictures in `pictures.js`: whole scenes so every
piece shows something, no `id`s or `url(#)` (they go into a canvas through a `data:` URL, which
the CSP allows; `blob:` is not allowed). The pieces are canvases moved with transforms; keep
dragging free of redraws. Free: 9, 16 and 25 pieces with the first three pictures; the full version
adds 30, 48 and 60 pieces and five more pictures.
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
Tijgers en geitjes (Bagh-Chal, id `baghchal`): the traditional Nepali game (public domain). Rules in
`web/games/baghchal/rules.js` (pure, source cited there: Wikipedia's "Bagh-Chal"; tested: the lines
(diagonals only where row + col is even), placing one goat a turn with goats walking only after all
20, tiger steps and single jumps (no multi-jumps, never compulsory, also while placing), 5 captures
win for the tigers, a trapped set of tigers wins for the goats, goats that cannot move lose, a draw
on the third repetition or after `QUIET_LIMIT` plies without a capture, 200 seeded games that all
end). The computer in `ai.js` (pure, seeded in the tests; plays either side; easy loses often to a
sensible child on both sides, medium and hard never leave a goat to be taken for nothing as the
goats and never let a free goat go as the tigers); medium and hard search with a node budget in
`ai-worker.js` through Dammen's `think.js`, on the page with `PAGE_NODES` when a worker cannot
start. Keep it gentle: a captured goat is never eaten or hurt, it hops off to the meadow and
sleeps; tigers stay friendly cartoons (round ears, a smile, no teeth or claws); no timers. Free:
together and easy on both sides (`meta.freeLevels`); the full version adds medium and hard. Saved:
wins per side and level (`cpu-<side>-<level>`) and the last setup.
Schaken (Chess, id `schaak`): public domain. Rules in `web/games/schaak/rules.js` after the FIDE
Laws of Chess (pure, tested: every piece, check, pins, mate, stalemate, castling with all its
conditions, en passant (also the pin along the row), promotion to any of four, the draws, and perft
against the known numbers for the start position (depth 4), Kiwipete (depth 3) and three more
positions; keep perft green after any change). The draws are automatic so a game always ends: the
third repetition (`positionKey`, an en passant square only when the capture is possible), 50 moves
each without a capture or pawn move (`FIFTY_PLIES`), too little material to mate. The board is
index 0 = a8 .. 63 = h1, white (player 1) at the bottom; against the computer the child is white.
The computer in `ai.js` (pure, seeded in the tests: only legal moves, medium and hard find a mate in
one and never leave the queen hanging, a simple greedy player beats easy in most games, every game
ends); medium and hard search with a node budget and `THINK_MS` in `ai-worker.js` through Dammen's
`think.js` (a FEN and the repetition keys go in), on the page with `PAGE_NODES` when a worker cannot
start. Only legal targets glow (a dot, a ring for a capture, en passant too); a promotion asks with
the queen first. Squares are 38 px at 320: with a piece picked up a tap inside a square is that
square (never a snap to a neighbouring target, so no accidental move); only picking a piece up, or
a tap on the frame, snaps within `TOUCH_REACH` (`resolveTap`, tested). The pieces in `art.js` keep the classic shapes (children learn the real pieces); no clocks.
Free: together and easy with its hint (`meta.freeLevels`); the full version adds medium and hard.
Saved: wins per level (`cpu-<level>`) and the last setup.
Ganzenbord: rules in `web/games/ganzen/rules.js` (pure, tested with a seeded die: every special
square, the goose chain, the bounce at 63, waiting in the inn, the well and the prison, 200 whole
games that always end). The well and prison follow the classic rule (wait until another goose
lands there and takes your place) made kind: never more than `WAIT_TURNS` (2) missed turns. One
die, no special first throws; 58 is "lost in the woods" (back to the start), never "death"; geese
may share a square. The board is our own, drawn in code: 64 round stepping stones on a winding path
(a rounded spiral to a pond in the middle; `board.js`, pure and tested: a step apart, clear space
between all stones, round tap areas of 44 px or more) over a landscape per board (`scene.js`: the
meadow, winter, the sea); never copy a publisher's board. No voice in this game (Mark, 13 Nov: the child does not like the
robot voice): "count yourself" is visual only (the square to tap glows, the count pops up big),
and the only sounds are the shell's effects, which follow the sound setting. Free: the classic
board with 2 players; the full version adds 3-4 players and the winter and sea boards.
Ludo (id `pachisi`, kept so saves, transfer codes and older app versions keep working; never rename
it): one race game in two modes, played by `pachisi.js` through `modes.js` (pure: each mode's rules,
geometry, board, computer and what the child counts); Ludo is the default, Pachisi the second mode,
picked in the game's menu (`setup.mode`; a setup saved without a mode opens Ludo). Mark (19 Nov 2026,
after playtesting Pachisi): the main game is Ludo, with the rules Dutch children know. "Ludo" is a
generic public-domain name and may be used; never use the names "Mens erger je niet", "Mensch
ärgere Dich nicht" or "Parcheesi" anywhere (code, strings, store texts), and never copy a
publisher's board or artwork (no yellow board with round holes, no red/yellow/green/blue corners).
Players are Zon, Maan, Ster, Lotus (Sun, Moon, Star, Lotus) in both modes: beehive pawns in saffron,
violet, teal and rose, each with its own symbol (`art.js`).
Ludo: rules in `web/games/pachisi/ludo-rules.js` (pure, source cited there: Wikipedia's "Ludo",
played the way Dutch families play; tested in `tests/ludo.test.js`: a cross of 40 squares on an
11×11 grid with 4 home squares per player and a free middle, every step a neighbour, starts 10
apart; one die; only a 6 brings a pawn onto its start square and throws again; a 6 must bring a
pawn out when the yard has pawns and the start square is free of your own (Schmidt's official
rules and Wikipedia NL); while pawns wait in the yard, your own pawn on the start square must move
first whenever it can (`whyNot` 'clear', also on the throw right after it came out); every 6 throws
again (no three-sixes rule); three tries (`TRIES`) only when no pawn can move at all (`canMoveAtAll`:
all in the yard, or only pawns in the home squares that cannot move up; one that can means one
ordinary throw);
landing on an opponent sends it to its yard, no safe squares (start squares neither); never onto
your own pawn (walking past is fine; no blockades); the home squares need an exact throw; a throw
nobody can use is lost; 200 seeded games with 2-4 players and 2 or 4 pawns all end, never two pawns
on one square; `MAX_THROWS` as the fallback). The board in `ludo-art.js`: our own, rounded squares
on a pale sky, soft yards with nests, a flower in the middle. The die: one face with tappable pips;
"Zelf tellen" taps the pips (a tap anywhere on the die counts the nearest pip not counted yet).
The computer in `ludo-ai.js` (pure, seeded: only legal moves; easy picks at random and takes a
capture only now and then, so a sensible child wins at least 3 in 4 games with 4 pawns; medium
weighs captures, the home squares, a new pawn out, danger (a pawn 1-6 behind) and progress, and
beats easy in at least 70 of 100). Saved wins: `ludo-cpu-<level>`.
Pachisi (mode `pachisi`): the traditional race game from India (public domain), our own version made
for children. Our board is an
Indian-inspired cloth drawn in code (`art.js`: madder cloth, gold stitching, cream squares, saffron
castles with the stitched cross, paisleys, a lotus on the Charkoni). Rules in `web/games/pachisi/rules.js` (pure, source cited there: Wikipedia's "Pachisi";
tested: the 3×8 arms round the Charkoni, the 84-step path down the own middle column, round
counter-clockwise and back up, the 12 castles (the 25-from-home one too), the six-shell table
(2-6 open shells = 2-6 steps, 1 open = 10, none = 25; 6, 10 and 25 throw again), captures outside a
castle sending every opponent pawn there back, no landing on a castle an opponent holds, a lost
throw, the win, 200 seeded games with 2-4 players and 2 or 4 pawns that all end). Made simpler for
children, each in `rules.js`: a pawn leaves the Charkoni with any throw (no grace needed); coming
home needs no exact throw; a usable throw must be used; no extra throw for a capture; no
partnerships; 2 pawns each as a short game besides the traditional 4; after `MAX_THROWS` the
player furthest along wins (never reached in the tests). "Zelf tellen": the child taps
the open shells one by one (a closed one only wiggles). The computer in `ai.js` (pure, seeded
in the tests: only legal moves; easy picks at random and takes a capture only now and then, so a
sensible child wins at least 3 in 4 games with 4 pawns; medium weighs captures, home, castles and
danger and beats easy in at least 80 of 100). Saved wins: `cpu-<level>` (its keys from before Ludo).
Both modes: keep it calm: a captured pawn walks back and starts again, nothing is beaten; no timers,
no voice. After the count the steps show; a tap on a glowing pawn makes its target square glow with
dots on the way, a tap there walks it with the count on every square; with one possible move it is
picked already. The squares are small on a phone (Pachisi 12-20 px), so taps go to the nearest thing
that can be tapped now (`buildHits`/`pickHit`, pure and tested for both modes: each movable pawn
where the mode's `pawnSpots` draws it, so two pawns on one square are two hits; the selected pawn's
glowing target wins over a pawn standing on or next to it; a second tap on the selected pawn switches
to one beside it on the same square; invisible buttons of `MIN_HIT` 44 px or more for the keyboard and
screen readers). The smoke test taps where a pawn is drawn, never a hit centre. Inline `style`
attributes are blocked by the CSP: position things through `el.style`, never in an HTML string.
Take-back: the child's last move with the same throw. Free (both modes): two players (a child
against easy, or two children) with 2 or 4 pawns; the full version adds a 3rd and 4th player and
medium. Saved: wins against the computer per mode and level and the last setup (with its mode).
Kwartet: rules in `web/games/kwartet/rules.js` (pure, tested: every card dealt once, asking only
for a missing card of a set you hold and only someone with cards, a yes keeps the turn and a no
passes it round the table, a whole set is laid down at once (also after the deal), players without
cards are skipped, most kwartetten wins). Two players play with a pile (Mark, 17 Nov 2026: without
one every question gets a yes): `handSize` cards each (5, 6, 7 for 4, 6, 8 sets), the rest face
down; a no means `draw` (the top card; the very card asked for keeps the turn), a hand that runs
empty takes a card from the pile at once, an empty pile just passes the turn. Three or four players
share every card, no pile. The computers in `ai.js` use only what the table saw (never hidden cards
or the pile: who asked for what, who gave what, who said no, a lucky draw), remember it only now and
then, and stay gentle: 200 seeded games check that every ask is legal, every game ends, an attentive
child wins or shares at least 95 of 200 against two computers and 115 of 200 against one with the
pile. Sets in `art.js`: four cards each, each picture unique, a name and an ask
form (`kwartet.card.<id>`, `kwartet.the.<id>`: "de appel", "het lieveheersbeestje") in both
languages; long Dutch names get a soft hyphen. With more than one child the hands stay hidden
between turns (the pass card); never show one child's cards to the next (a child who draws sees
the new card until the pass card, the card is not named in the status). Free: 4 sets, up to 3
players; the full version adds 6 and 8 sets and a 4th player.
Slangetje: rules in `web/games/slang/rules.js` (pure; `pathDirection` is the path finder the tests
and the smoke test play with), 30 levels in `levels.json` (`size` is [short, long]; walls are
given for the upright board and turned on a sideways one). `npm test` plays every level to the
end in both languages and orientations; a new level or word must pass that. The youngest tiers
must never be losable (wrap-around, no bump into yourself, no walls). New words go in `WORDS` for
every language, with a picture in `art.js`.
Kleurplaten: every region must be one closed path with a unique id (`npm test` checks every
picture and hundreds of mandala seeds); a mandala region's `g` is its symmetry group. New pictures
go in `PICTURES` in difficulty order (few large parts first) with a name in `strings.js`. Pages are
saved through `saveArt`/`loadArt` only (never `saveGameOption`). A page in "my pictures" has a bin
(below); `deleteArt` in storage.js throws its colours away as a `{t, gone}` marker newer than the
page (unknown fields kept), so a merge never brings it back; a picture or free mandala goes back to
its section blank, a new mandala is gone; a locked page there (after a refund) has no bin.
Throwing away (Mark, 24 Nov 2026): Tekenen's "my drawings" and Kleurplaten's "my pictures" give each
picture a small separate bin of 48 px on its corner (`withTrash`), hanging out below the card into
the wider row gap of `.keep-grid` and a little to the right, so the card's middle third (88 px cards
at 320 wide) stays free for opening it and the bin never reaches the next card; it asks a short
card with the picture, "Weggooien?" and big Nee / Ja (`askThrowAway`): Nee first, where a second
tap on the bin lands, and focused, so a second or held Enter only closes the card; "Ja" does
nothing in its first `THROW_AWAY_WAIT` ms, so a double tap never deletes. No parental gate: it is
the child's own.
Tekenen: a drawing is a list of strokes and stamps (`web/games/tekenen/drawing.js`, pure, with a
test), saved as a short text through `saveDrawing`/`loadDrawings` only (never `saveGameOption`);
the text stays under `DRAWING_MAX` (coarser strokes first, then "the page is full") and must be
`isDrawingText`, which storage.js and `sanitizePayload` check too (drawings only in the `tekenen`
section, at most `DRAWINGS_BUDGET` characters per code). What is kept when lives in `session.js`
(tested without a screen): undo never goes back past the drawing as it was opened, a drawing that
was kept when opened may always be kept again, and an empty page deletes a drawing only when the
child leaves, never from the autosave. The bin in "my drawings" goes through `session.remove`, which
uses storage.js `deleteDrawing` (a `{t, gone}` marker newer than the drawing, unknown fields kept);
if the page still holds that drawing it forgets it, so no autosave, leaving or undo brings it back,
and its place in the album is free at once (a 4th drawing after a delete on the free version). A merge or transfer never pushes the receiver's own
drawings out: the oldest incoming ones are left out and the card says how many. The mirror maths
is in `symmetry.js` (the dihedral group of 2, 4, 6 or 8 lines, tested); stamps are vectors in
`render.js` (the puppy keeps floppy ears); the stroke under the finger is drawn only by its new
points. Free: every colour, brush, the eraser, undo and `FREE_DRAWINGS` (3) kept drawings; the full
version adds mirror mode, stamps and up to `MAX_DRAWINGS` (100). Touch targets stay 44 px or more.
Klok kijken: the time logic in `web/games/klok/time.js` (pure). Dutch phrasing works around the
half hour ("vijf voor half drie" = 2:25); every 5-minute step of every hour is tested in both
languages, so a change to `phrase()` must keep those tests green. Answer options stay on the
tier's grid and never show the same clock twice. Stars through `recordStars`, random rounds
through `recordRandomSolved`. Digitaal (mode `dig`, three tiers in `DIG_TIERS`, as groep 4-5 learns
it): t1 a 12-hour digital time ("03:30", always two digits) to its analogue clock and back, whole
then half hours; t2 quarters then five minutes: set a digital clock with hour and minute steppers
(`stepDigit`: the hour goes round 1-12, the minutes round on their own) to a clock or to words,
and say a digital time in words ("04:25" is "vijf voor half vijf"); t3 the 24-hour clock with
`phrase24` ("14:25" is "vijf voor half drie ’s middags"), a clock with its part of the day to the
24-hour time, and which of two times is later (half the pairs mislead on a 12-hour reading). The
parts of the day are `dayPart`: 00:00-05:59 night, 06:00-11:59 morning, 12:00-17:59 afternoon,
18:00-23:59 evening; every 5-minute step of all 24 hours is tested in both languages. Options come
from the same generator (`optionsOn`), so they never show a time twice, and every clock, digital
face and option is drawn from the one time, so analogue and digital always agree (tested per
kind). The digital clock is seven segments in `art.js` (no fonts), hours orange like the short
hand, minutes blue like the long hand, the colon blinking calmly. Every target 48 px or more. No
voice. Free: digital tier 1 (`meta.freeDigTiers`), like the whole and half hours on the clock.
Letters: nothing is spoken, every question is seen (a big letter, a picture with its word and a
gap at the start or inside it, a word to build); the rounds are pure in
`web/games/letters/round.js`, tested per mode and tier. Four kinds: `tap`, `first`, `middle`,
`build`. A tier is harder by what must be told apart (look-alikes in `SIMILAR`/`SIMILAR_UPPER`,
mirrors in `LOOKALIKE` from tier 3, the other case) and how much of the word is given, never by
the number of tiles (Mark, 18 Nov 2026). Keep `first` as it is (Mark's children like it). A word
in `middle` needs its gaps in `MIDDLE` with the words a wrong letter would spell there. The Piper voice was removed on Mark's word (13 Nov 2026: children did not like the robot
voice); do not add speech back, recorded or generated, without him. New words go in `WORDS` (both
languages, with a picture that exists in `art.js`).
Verstoppertje (Hide and Seek, id `verstop`): Mark's search game (20 Nov 2026: "find a little animal
and where it can be, lift a little stone or look behind a little tree; if it is not there another
little figure waves"). "Verstoppertje" / "Hide and Seek" are generic words; never use "Waar is
Wally", "Where's Waldo/Wally", "Kiekeboe" or any other franchise name (code, strings, store texts),
and never draw a striped red-and-white figure with glasses and a bobble hat or anything like that
franchise. All art is ours, in `art.js`: every animal, creature and spot differs by shape and colour
(`COLORS`, tested), no ids or `url(#)` in the drawings; a figure's `vz-arm` group is drawn from the
shoulder up and to the right (CSS waves it round that corner); a door's or flap's figure is shrunk
into its doorway (`figureFit`) and grows back to full size once found. The rounds and what a tap
means are pure in `rules.js` (tested in `tests/verstop.test.js`, 200 seeds per scene and tier: the
animal behind exactly one spot, no occupant twice in a round, look-alikes the same animal with
another feature or none, never a feature close to the animal's own colour (`NOT_WORN`; every
feature an animal may wear 90 or more apart in RGB, at least two per animal), every round ends when every spot is opened in any order, straight to the
animal is 3 stars). The animal moves on (Mark's playtest, 20 Nov 2026: the hedgehog 5 times in the
same spot, because every round was seeded alone and "again" replayed it exactly): `placeAnimals`
never hides an animal behind the kind of spot or in the place on screen (`samePlace`, judged in
`PLACE_BOXES`) of an animal of the round before, and no kind or cell more than `MAX_SAME_SPOT` (2)
times in a tier's 6 rounds (tested over the menu's rounds and 200 seeded runs per scene and tier,
the centres apart in every measured box); a round played again (`fixedRound(id, after)`, the same
friends) and a random round avoid the round just played too. A round id keeps its number and
animal, so saved stars stay with it. Tiers are harder by what the child must do, never by speed: t1 4-5 spots and
one animal, t2 6-7 spots and two animals, t3 7-8 spots with two look-alikes and on even rounds the
memory question (`memoryAsk`: the first creature met; none met, no question). Never "wrong": a
look is a hello ('friend' or 'lookalike'), the spot settles back ajar so the child sees where they
looked, the memory question closes every spot. Hints (Mark's playtest, 23 Nov 2026: "otherwise it is
just guessing"): a bit of the animal peeks out over the top of its own spot (`clueFor`/`cluesOf` in
`rules.js`, tested over the same 200 seeds per scene and tier: every animal's spot gives its own
clue, never a friend's spot; the peeks are `PEEKS` in `art.js`, the head-top that tells it apart
(spines, long ears, floppy ears, tufts, eye stalks...), all about as high, drawn behind the cover at
the spot's `PEEK_AT` (for a door out of the stump's hollow, under the stump's `front`, which every
door draws with or without a hint), in its own colours; a whole peek stays inside its spot's box, and
`vz-clue` holds nothing but the peek, so between two peeks a spot with a hint draws exactly the same
pixels as one without). The sandcastle's flag is `CASTLE_FLAG` (sky blue): never a feature's colour
(a red flag read as the red scarf) and far from every animal's (tested). Harder by tier (`TIERS[t].clue`), never by speed: t1 `always` (a
little of it from the start, still), t2 `sometimes` (each animal's head comes up now and then and
goes back, each clue spot on its own beat), t3 `rarely` (less often, only a little) and the
look-alikes peek too, each with a glimpse of its own feature's colour (or none), so "a hedgehog is
here" is not enough and the colour tells the real one apart (the glimpses in `PEEK_FEATURES` sit as
high as the head, so they show over every kind of spot). Slow CSS slides only, no flash, no arrow or
glow; gone once the spot is opened, in the memory question and at the end; with
`prefers-reduced-motion` every clue stands still and in sight, as far out as at its peak. Seen is
measured in pixels, not CSS state (`verstop_hint_pixels`, `tests/smoke.py verstop-pixels`): every
animal over every kind of spot with every feature, still, at the peak and with reduced motion, adds
at least `VZ_HINT_MIN` pixels to a spot drawn 200 px wide (t1 400, t2 600, t3 200), a feature at
least `VZ_FEATURE_MIN` (150) in its colour, and nothing outside the spot; with the peek slid away,
every kind of spot with a hint draws 0 pixels different from one without (a hint must never give
the spot away by itself); a new animal, spot or feature must pass it. `starsFor` counts extra looks only, each spot once
in a round (a second look at a spot counts nothing, also in the memory question), never time; a hint changes nothing there. No timers, no voice; sounds are the shell's
`plink` and `chime`. Spots are buttons placed by `spotLayout` (pure, tested over every box from 260 x
290 up and the measured smoke-test boxes: `MIN_SPOT` 64 px or more, inside the box, never
overlapping); only CSS transforms move the cover and the figure inside them. Free: tier 1 in the
garden (`meta.freeScenes`, `meta.freeTiers`); the full version adds the forest, beach and farm,
tiers 2-3 and random rounds. Saved: stars per round (`<scene>-<tier>-<n>`), random rounds per tier,
`howSeen`, `lastScene` and `lastTier` (all shapes `sanitizePayload` already knows). New animals or
creatures need a drawing, a unique colour and `verstop.the.<id>` (animals also `verstop.an.<id>`)
in both languages.
Treintje (Train Tracks, id `treintje`; Mark, 25 Nov 2026): a path puzzle of our own. The child lays ONE railway with a
finger that starts on station 1, goes through every square exactly once and passes the numbered
stations in order (the last station is the last square); then the little train (a locomotive and two
wagons, side view) rides it to the last station. Never use the names "Zip", "Zip Unlimited",
"LinkedIn" or any LinkedIn game name (code, strings, store texts) and never copy their look: grass
squares, a railway with sleepers and rails, round station signs and wooden fences, all drawn in code
(`art.js`). Only random puzzles, per age (Mark: "per leeftijd enkel een randomized versie"); the menu
is three age cards, each an endless stream. The puzzles come from `generate.js` (pure, seeded; in the
shell's worker through `random.js`, one made ahead while the child plays): a random Hamiltonian path
by backbiting, fences (8-10 only) across squares the railway does not join, stations about every
second square, a solver (`countSolutions`: parity, dead ends and connectivity pruning, a node budget
per count and per puzzle) that adds a station where another way differs until there is one way only,
then takes stations away while it stays unique down to `keep`. `AGES` (tuned for fun): 3-5 4x4
without fences, 4 to 6 stations (enough to show the way); 6-7 5x5 or 6x6, 6 to 12 stations; 8-10 6x6
with 3 fences or 7x7 with 5, as few stations as stay unique (about 4 to 14; 4 to 13 over 3000 seeds). Tested in
`tests/treintje.test.js` over 200 seeds per age: solvable, exactly one way (checked again without a
budget), the age's sizes, within `PUZZLE_BUDGET` and in time. The rules and what a finger means are
pure in `rules.js` (tested): a step only to a side neighbour, never through a fence, never onto track,
a station only in its turn, the last station only as the last square (`whyNot`); dragging back onto
the square before the end takes one back, a finger put down on the track takes it back to there
(`pressAt`), a fast finger walks the squares in between and across a corner (`dragAlong`), only
points well inside a square count (`cellsOnMove`, so a finger on a line between squares does not
flicker). Nothing is ever wrong and there are no timers: a step that is not allowed just does not
happen, with a short line why ("Eerst station 3!", made from the path after the move, so a fast move
over station 2 onto station 4 names 3; a new puzzle clears it). "Andere puzzel" (the round arrow in
the HUD; at the bottom of the HUD column on short sideways phones, away from the back button) gives
a new puzzle of the same age at any time: nothing is counted or lost by it, there is nothing to
gain by it either. Pointer events on the whole board with
`touch-action: none`; squares 44 px or more on every screen (88 at most), the HUD a column on short
sideways phones. No voice; the shell's `plink` at a station and `chime` at the end. Free: ages 3-5
(`meta.freeAges`); 6-7 and 8-10 in the full version. Saved: puzzles solved per age (`random`,
`recordRandomSolved`), `howSeen` and `lastAge` (all shapes `sanitizePayload` already knows; tested).
Kangoeroe op de getallenlijn (Kangaroo Hops, id `kangoeroe`): the questions, the hops and the
view on the line are pure in `web/games/kangoeroe/hops.js` (tested over 200 seeds per tier: every
number on the line and never below 0, the way (`hint`) joins up from the start to the answer, over
10 it is two arcs via the ten, every question solvable with the buttons it offers, a "how many
hops?" question reached in exactly its answer). Three tiers by the maths, never by speed (Mark, 18
Nov 2026): t1 0-10 forward only ("from 3 to 7, how many hops?", "3 + 4" with pips), t2 0-20 forward
and back with the missing number and "via 10", t3 0-100 with hops of 10, via a ten, two steps
("37 + 20 + 5") and counting by 2s and 5s. A question is `land` (hop there, then Hier!) or `count`
(pick the number; only the hop towards the flag, which stops there). A tap on the line moves the
kangaroo there in one jump, it never answers by itself. No timers, no losing: a wrong answer
bounces the kangaroo to the start and draws the way dashed (over the kangaroo, so never hidden);
after `MAX_TRIES` it hops the way itself. `starsFor` counts mistakes only. On 0-100 a phone shows a
window of 20-100 numbers (`viewSize`, 8 px or more apart) with a map above it; `followView` keeps
the kangaroo in sight. Nothing is spoken; the sounds are the shell's (`plink`, `boop`, `chime`).
Every target 48 px or more. Free: tier 1; the full version adds tiers 2 and 3 and random rounds.
Saved: stars per round, random rounds per tier, the how-to cards seen and the last tier.
Keukentje (Little Kitchen, id `keuken`; Mark, 25 Nov 2026: "een spelletje met wat er in brood zit,
of gerechten, zodat kids dat ook leren"): the child cooks in a little kitchen drawn in code (a tiled
wall with a shelf, the counter, bowls) with a cook (Mark, 25 Nov 2026: "little kitchen kan ook een
diertje gebruiken"): a round little bear in a white chef's hat and a teal apron with a wooden spoon
(`cookSvg`, its colours `COOK`: caramel fur and a cream muzzle, no shirt, no scarf, no other hat;
never a famous chef rat or a well-known bear in a hat or a scarf, nothing from a franchise; its
colours differ from Winkeltje's mouse, tested), at the top of the kitchen, which says every line in a
speech bubble beside it (the bubble replaced the old lead and status line). The lines are pure
(`cookLine` gives a key and its values, `lineText` the text through `t()`, the soft hyphens dropped
and every sentence with a capital; tested in both languages for every kind and outcome over 200
seeds per tier, with exact texts): the task at the start of a question, "Hoi!" only on the first
("Hoi! We maken pannenkoeken. Wat hebben we nodig?", the dish as said in a sentence
`keuken.make.<dish>`, long words with a soft hyphen so a narrow bubble can break them; 6-7 "Zoek alles wat erin hoort."; "Wat kunnen we hiermee maken?"; "Weet jij waar
melk vandaan komt?" with `keuken.some.<ing>`; "We maken pizza. Wat doen we eerst?"; "Welke hoort er
niet bij?"), each right ingredient ("Fijn! Nu hebben we de melk.", `keuken.art.<ing>` with de or
het; "Fijn", never "Lekker", for flour, salt or yeast), a right step ("Ja! En wat doen we dan?"), the dish named ("Ja! Daar maken we pannenkoeken
van."), the dish ready ("Klaar! Eet smakelijk!"), the facts and groups below, and every tap that does
not fit. Lines about a tapped ingredient agree with it: `keuken.form.<ing>` per language is `sg`, `n`
(a het-word) or `pl`, and such a line has a key per form ("Hmm, boontjes? Die horen bij de roti!",
"Dat maak je ook van graan!" for bread, "Those belong with ..." for sprinkles). On a right answer the cook bobs slowly; when a dish is ready it stirs and its hat wobbles
(CSS only on its `ke-cook-hat` and `ke-cook-spoon` groups, still with reduced motion; no flashing, no
timers, no voice). The cook has no ids, `url(#)`, styles or text (tested); it is 48 px or more and
never covers a picture, bowl, slot, the dish or a button (smoke-tested at five sizes). The data is in `web/games/keuken/dishes.js`: 16 dishes Dutch
children know and others know too, each with `need` (every ingredient, the 6-7 bowls), `key` (the
two or three a young child knows it by, the 3-5 bowls; never yeast) and `maybe` (often in it but not always: ham
on a tosti, an egg in apple pie, apple or cheese in pancakes, pasta in soup, any of `VEGETABLES` with
rice), which is never offered and never a distractor; when in doubt, add it to `maybe`. Keep the ingredients correct and simple, the way children know them: no amounts, no
brands (never a brand of peanut butter or sprinkles, in code, strings or art), nothing about
allergies or diets, and never "good" or "bad", "healthy" or "unhealthy" food. Where things come from
is `ORIGINS` (the answer and an explicit `not` list of wrong options that are plainly wrong: cheese
never gets the sea, there is salt in it), the odd one out is `GROUPS` (members and an explicit `odd`
list: no peanut among "under the ground"), the recipes are `RECIPES` (steps whose order is the only
sensible one); Mark checks these lists. The rounds and what a tap means are pure in `rules.js`
(tested in `tests/keuken.test.js`: every ingredient exists, has a name in both languages and a
picture and belongs to a dish; 200 seeds per tier: every answer among the options, no duplicate
option, no distractor that is in the dish (`need` or `maybe`), 3-5 distractors never a look-alike,
6-7 fills always with a look-alike, every "which dish?" with one dish only that has all the shown
ingredients, every wrong source from the `not` list, one odd one only, steps never already in order;
the menu rounds fixed, the three 3-5 rounds showing all 16 dishes). Tiers are harder by what the
child must know, never by speed: t1 (3-5) "Wat hoort erbij?" (`key`, six pictures); t2 (6-7) every
ingredient of a dish with four or more from eight pictures with `LOOKALIKES`, and "which dish?" (the
dish under a cover until named, one of 3); t3 (8-10) where it comes from, the steps in order, the odd
one out. A "which dish?" never offers a dish beside the answer that could be made from the shown bowls
(`canMake`: nothing shown missing, or all it needs or is known by in the bowls; pancakes beside
poffertjes). Yeast is "piepkleine schimmeltjes" (a tiny fungus), never "cells". Nothing is ever wrong: a tap that does not fit bounces back with the cook's short line (`belongsTo`, the dish a
child thinks of first from `PREFERRED`, a potato says stamppot:
"Hmm, een aardappel? Dat hoort bij de boerenkoolstamppot!"; `missingIn`: "Hmm, geen ei in de pizza!", the first
shown ingredient really not in the picked dish in any form (`hasIn`: what it needs or may have, the
dish itself, and what those are made of, `MADE_OF` in `dishes.js`: bread of flour, water, yeast and
salt, cheese and butter of milk; so never "geen bloem in de tosti" or "geen brood in het brood";
tested over every dish and ingredient), which also keeps such a dish out of a "which dish?"; what the picked source gives; "Dat
komt later!"; "Die komt ook van de koe!"), counts once per question, and after `MAX_TRIES` the
answer glows. `starsFor` counts mistakes only. No timers, no voice; the shell's `plink`, `boop` and
`chime`. Every picture is ours (`art.js`): every ingredient unique by shape and colour (`LOOK`,
the colour drawn; round lumpy shapes 60 or more apart in RGB, yeast and potato 90; tested), no ids, `url(#)` or style attributes; a new ingredient, dish or source needs a picture and
`keuken.ing.` + `keuken.some.` + `keuken.art.` + `keuken.form.`/`keuken.dish.` + `keuken.the.` + `keuken.make.`/`keuken.src.` + `keuken.gives.` in both languages. Every
target 48 px or more. Free: tier 1 (`meta.freeTiers`); the full version adds tiers 2 and 3 and random
rounds. Saved: stars per round, random rounds per tier, the how-to cards seen and the last tier (all
shapes `sanitizePayload` already knows; tested through a transfer).
Winkeltje (Little Shop, id `winkel`; Mark, 25 Nov 2026, the "Geld tellen" of the parents' page): a little
shop drawn in code: an awning over a shelf with the things and their price tags, the shopkeeper
behind the counter and a till on the counter (hidden only on narrow sideways phones, where the
counter has no room for it). The child buys a thing by laying coins (and later notes) from the purse on the
counter until the price is paid, then taps Betalen; a tap on a coin lays it, a tap on the counter takes
it back, and both can be dragged (a copy of the coin follows the finger, moved by `el.style`; a drop on
the counter lays it, a coin from the counter dropped anywhere else goes back). Taps are handled on
pointerup (Chrome sends no click for the first touch after a drag), the click after a tap or drag is
eaten, and a click without a pointer before it (the keyboard) still taps. The money maths is pure in `web/games/winkel/rules.js`, in whole cents, never floats (tested
in `tests/winkel.test.js`: every round's answer payable from what the round offers and judged right,
`fewest` against a brute force and against the greedy euro with plenty of coins, change counting up
to what was paid, 200 seeds per tier). Tiers by age, harder by the maths, never by speed: t1 (3-5)
whole euros up to € 5 with € 1 coins (a dot per euro fills as they are laid), then € 2 coins "two at
once"; t2 (6-7) up to € 20 with € 1, € 2, € 5, € 10 and 50 cent, paying exactly and then with as few
pieces as possible (`goal: 'fewest'`); t3 (8-10) cents with every coin, change from the till (paid € 5
or € 10, prices in 5 cents like cash in the Netherlands, counted up from the price: "€ 3,40 → € 3,50 →
€ 4,00 → € 5,00"), two things together, and a budget (pick two things that fit; at least one pair
fits and at least two do not). What lies in a purse or the till is `WALLETS` (every amount a kind asks
is payable, tested); the things and the prices they may have are `ITEMS` (an apple never costs € 18;
every price a tier asks has two things, tested). When the amount is exact, every way of making it is right (Mark's playtest, 25 Nov 2026: "€ 4 kan met
2*1 plus 2 of 2*2"): tested exhaustively, every set of coins and notes from the purse or till that
makes the price, over the menu's rounds and 200 seeds per tier, is judged right (in a `fewest`
question right with the fewest pieces, otherwise "fewer, please", never too little or too much);
3-5 never asks for the fewest, and the twos purse holds two € 1 coins so € 4 is 1 + 1 + 2 as well
as 2 + 2 (before it held one, so 1 + 1 + 2 could not be laid). The shopkeeper (Mark: "feedback is
iets meer shop en als het kan een diertje als winkelier") is a mouse in a sage apron (`keeperSvg`,
its colours `KEEPER`: taupe with pink ears, never black round ears, shorts or gloves; nothing from a
franchise), standing behind the counter, and says everything in a speech bubble beside it, as a shop
would; the lines are pure (`shopLine` gives a key and its values, `lineText` the text through `t()`,
every sentence with a capital; tested in both languages for every kind): a greeting with the price
at the start of a question ("Goedemorgen! Een vlieger, dat is € 6.", `winkel.hi.*` in turn and the
thing with its article `winkel.a.<id>`; after a try the price again without a greeting), in a
`fewest` question plainly up front ("Kun je betalen met zo min mogelijk munten en briefjes?"), in change "Tel jij
wat je terugkrijgt?", for a budget "Welke twee neem je mee?". Nothing is ever wrong (`judge`): too
little shows what is missing (the coins that would make it as dashed ghosts, "Nog € 1, alsjeblieft.";
when the purse cannot make the rest, like € 3 from the twos purse with both € 1 laid, `swapFor`
marks the fewest pieces to take back and shows the ghosts of a right answer: "Pak eerst € 1 terug en
ruil."), too much marks what is over (the pieces that make it, if any: "Dat is € 1 te veel. Pak die
maar terug."; none, like € 3 paid 2 + 2: "Dat is € 1 te veel. Kun je het precies betalen?" with
`swapFor` marking what to take back and ghosting what goes on instead, the simplest swap among the
fewest pieces back; change: "... Dat mag terug in de kassa."), the right amount with too many pieces
says "Het klopt! Kan het ook met minder munten en briefjes?";
right is thanked ("Dank je wel! Veel plezier met je vlieger!", food `ITEMS[].food`: "Smullen maar
van je appel!"; change: "Dat klopt! Dit krijg je terug.") while the thing goes into a paper bag on
the shelf (`bagSvg`) and the shopkeeper bobs slowly (CSS only, still with reduced motion; no
flashing, no voice); the same counter paid again counts nothing; after `MAX_TRIES` the shop lays the right
money (small coins first) or picks a pair that fits; a child who leaves in the pause before that
sees it on "Verder spelen" before the next question. An amount comes back in a round only when its
kind has run out of others (tested). `starsFor` counts mistakes only. The money is our
own (`art.js`): copper 1, 2 and 5 cent, gold 10, 20 and 50 cent, € 1 a gold ring round silver and € 2 a
silver ring round gold, the real sizes relative to each other (`SIZE_MM`), notes grey, red and blue with a band and
soft circles, the value large; never the real designs (no national side, no map or stars, no banknote
architecture, no ECB marks; tested). Prices through `money()`: "€ 2,50" in Dutch, "€ 2.50" in English,
whole euros "€ 3" (8-10 always with cents). The youngest see every coin on the counter on its own; 6-7
and 8-10 see a pile per coin with its count (so the counter never outgrows a phone), and the
ghosts as a small ghost per coin with its count, first on the counter so they stay in sight. Sideways phones
put the shop over the whole width (shelf left, shopkeeper right over the counter) and the sum of two
things on the counter (`#wk-sum-side`). The keeper, the till and the bag have no ids, `url(#)`,
styles or text (tested). No timers, no voice;
the sounds are the shell's (`plink`, `click`, `boop`, `bounce`, `chime`). Every coin, note, thing and
button 48 px or more. Free: tier 1 (`meta.freeTiers`); the full version adds tiers 2 and 3 and random
rounds (`randomCard`, `recordRandomSolved`). Saved: stars per round, random rounds per tier, the how-to
cards seen and the last tier (all shapes `sanitizePayload` already knows; a transfer round trip is
tested). New things need a drawing in `ITEM_ART`, a price range in `ITEMS` (and `food` if eaten),
`winkel.item.<id>` and `winkel.a.<id>` in both languages.
Egeltje (id `doolhof`): a garden maze. The maze in `web/games/doolhof/maze.js`, the rounds,
steps and crows in `rules.js` (both pure, tested: every garden one piece without dead ends, every
board keeps every letter reachable without walking over another after every step (`placementOk`),
200 seeds per kind, tier, language and orientation played to the end with the crows walking by a
greedy child, a cautious one that never steps into a crow and one that keeps to the short way and
turns back to it after a detour, each within a step budget, the
wrong-letter and crow rules, crows never onto the hedgehog, next to it, a tile or each other).
There must always be a way for the hedgehog (Mark, 19 Nov 2026): after every step there is a way to
the right tile that no crow stands on (`hasFreeWay`, checked on every step of every tested round).
A crow never takes a step that makes that way longer or cuts it (`freeDistance`) and never steps
next to the hedgehog; a crow that has stood still `STILL_FLY` crow steps on the hedgehog's short
way (crows ignored) or next to it flies off; when a new letter lands behind a crow, the nearest
blocking crow flies off at once (`keepWay`); a garden with no room left for a crow off the way
sends it out of the garden for a while (`cell` -1, tested) until there is. A crow lands off both
ways. The controller restarts the crows' step clock when a flight starts, so a crow never walks
during its flight or hops on as it lands. It must never
look or sound like Pac-Man (Mark, 18 Nov 2026): no Pac-like name, no yellow round chomping figure,
no ghosts, no waka or arcade sounds, no classic maze layout. It stays calm: no dying, no game over,
no timer. Only a step the child chooses can bump or touch: a walk going on by itself (round a bend,
`stepHog(..., { auto: true })`) stops in front of a wrong letter and in front of a crow, also one
that stepped in between two steps. A chosen step onto a wrong letter is a soft bump (it stays, one
mistake per letter, help after two); a chosen step into a crow only makes it flutter off to a free
cell far away and off the hedgehog's way: the hedgehog stays where it is (a short surprised curl,
drawn only), no step back, nothing lost, no mistake; crows never cost stars.
Tier 1 wrong tiles are plain (`plainOk`: never a look-alike either way round of what is asked, also
after a word changes; tested on every step). Tiers are harder by
what must be told apart (Letters' `SIMILAR`/`LOOKALIKE`, `NUMBER_LOOKALIKE`) and how much of a word
is shown (`WORD_HINT`), not by speed. Words and pictures come from Letters (`BUILD`, `LONG_WORDS`
must have a picture in Letters' `art.js`). No voice. Free: tier 1 of every kind (`meta.freeTiers`).
Kaartpuzzel (Map Puzzle, id `kaart`): the maps are data made by `tools/gen-kaart.mjs` from
Natural Earth (public domain; source, version and files in CREDITS.md); never hand-edit
`web/games/kaart/packs/*.js` and never commit the raw GeoJSON. Europe uses Natural Earth's Dutch
point of view (the NLD edition). What a tap or drop means is pure in `map.js` (`hitRegion`: the
region under the finger, unless the tap is within `EDGE_SHARE` of a finger of a small region's
outline; off every region, the nearest small outline or centre within a finger; `hitPoint`;
`snaps`: inside its own outline or near its own centre, never more than half way to the next
region's centre, at any scale, with no floor beating that; a puzzle with pieces that would be
`fiddly` on the phone starts with the magnifier on, when it has borders), the rounds in
`rounds.js` (t1 a puzzle with the borders, biggest first; t2 "where is" per region; t3 the whole
puzzle without borders, then the capitals or oceans; harder by the task, never by speed; no
timers); all tested in `tests/kaart.test.js` (every region a path, a centre inside it, Dutch and
English names, no duplicates, a tap on every centre picks it at phone, magnifier and desktop
scale, and a tap 8 px inside any border picks the region it is in). A pack stays under 80 KB, all of them under 200 KB. Region and point names go through
`t()` by `addStrings` when a pack loads (`kaart.r.<pack>.<id>`, `kaart.p.<pack>.<id>`); check the
Dutch names by hand for a new pack. The own-country pack follows `navigator.language`
(`defaultCountry`, exact tags: nl-NL or plain nl, en-US, en-GB; anything else none, nl-BE too, so
nobody is pushed another country's provinces); "Ander land…" saves `country`. In the menu each map is
a picture card with that pack's own regions as its picture (`packSvg`, drawn once the pack is loaded). A wrong drop or tap counts once per piece or question,
after `MAX_TRIES` the place glows; `starsFor` counts mistakes only. No voice. Free: the whole
Continents pack and tier 1 of every pack (`meta.freePacks`, `meta.freeTiers`). Adding a country: a
block in the tool, an entry in `packs.js`, `kaart.pack.<id>` in `strings.js`.
Piano: two levels by age, picked with two segments at the top of the song list and saved as
`games.piano.level` (`small` or `big`; a new player gets `small`, the tile always opens free play).
The keyboards, the songs and playing along are pure in `web/games/piano/songs.js` (tested). 4-6
(`SMALL`, unchanged since PR #42): 8 coloured keys C to the high C and 5 black ones, sounding
C5-C6; its songs stay on the coloured keys in whole 4/4 bars. 7-10 (`BIG`): C4-C6, 15 coloured
keys (every C red, the same colours per note name) with their names on them and 10 black keys;
when the coloured keys do not all fit 44 px wide (46 with the gap; 42 at 320 px) it shows a
window of 7 to 14 of them: the map of the whole keyboard above the keys moves it (fingers on the
keys only ever play), playing along and Listen move it with `followView` (pure, tested: the key to
press is always in sight, every 7-10 song played through on 7, 8 and 12 keys), and an upright
phone gets a line asking to turn it; sideways on a phone all 15 fit. The window never moves under a
finger: following waits until every finger is up (a wrong key brings the glowing key back then), and a
finger that was down when the map moved plays nothing more until lifted. The window is `overflow: clip`
and only its transform moves the keys (a tap focuses a key, and a browser scrolls a hidden overflow to it). A song is a string of notes
with lengths in beats: the toy piano's notation (`C D:2 C'`) or, for 7-10, note and octave
(`F#5:.5 Bb4`), with `R:.5` rests folded into the note before (`rest`, so Listen lets go in time).
New 7-10 songs must be public domain and checked note for note against a real score; say which in
a comment (the five now: Wikipedia's and the Mutopia Project's LilyPond sources), leaving out only
grace notes and trills. A wrong key never moves a song on; `starsFor` counts wrong keys only,
gently, never time (also for 7-10: the song waits for the key, so there is no rhythm to judge).
The sound is `pianoNote` in `web/js/audio.js` (synthesised, follows the sound setting); no voice
and no recordings. Pointers are handled on the whole keyboard (`elementFromPoint`), so several
fingers and slides work; keep `touch-action: none` there and on the map. New songs go at the end
of their level in `RAW`/`RAW_BIG` with a unique id (stars are per id) and a name
`piano.song.<id>` in both languages. Free: free play on both pianos and the first song of each
level (Vader Jacob; the whole Ode to Joy in D, with F#: `meta.freeSongs`); the full version adds
the other songs (4-6: Kortjakje, Au clair de la lune, Ode to Joy; 7-10: Wilhelmus, In the Hall of
the Mountain King, the Rondo alla turca opening, Für Elise). Saved: stars per song and the level.
Drumstel (Drums, id `drums`): the kit, the rhythms and playing along are pure in `web/games/drums/kit.js`
(tested: 8 pads standing like a real drum kit (Mark, 19 Nov 2026): `KITS` gives every pad's touch
area in the kit's own units, `wide` for sideways phones and desktop (the kick big and low in the
middle with the two toms on it, the snare left of it, the hi-hat on its stand far left, the floor
tom right, crash and ride above) and `tall` for upright phones (cymbals, toms, hi-hat / snare /
floor tom, kick at the bottom); `kitLayout` scales it to the box (x and y at most `STRETCH` apart), centred across and standing
on the bottom of the box (close to the thumbs), and falls back to the plain grid (`GRIDS`) only when a pad would drop under `MIN_PAD` (80 px) and
the grid does better; tested at every smoke-test size: the kit shape, 80 px or more, on screen,
no two touch areas overlapping. The stands and the rug are drawn behind the pads by `standsSvg`
in `art.js` and are never hit. A pad's button is square (a rounded button drops taps in its
corners); only the glow and lit light behind it (`::before`) is rounded; a rhythm is a string of steps
like `K+H S:.5 .` in whole 4/4 bars; two levels by age: `small` (4-6) one pad at a time, slower,
in your own pace (the next pad glows on the beat after the count-in but the rhythm waits; only
the order counts, `starsFor` counts wrong pads only), `big` (7-10) two pads at once too, faster,
on the beat (a step counts within `WINDOW_MS` of its beat, never past the middle to the next;
a missed step passes; `timedStars` by the share in time, 0 means "try again" and saves nothing).
Time is passed in, so the tests play every rhythm without waiting. The sound is synthesised in
the game's own `sound.js` (its own audio context; no files, no samples), which follows the app's
sound setting through `audio.js` (`unlock`, `isMuted`, `softClipCurve`); no voice. One voice per
pad: a new hit chokes the pad's last one in about 10 ms, so a mash never stacks tails (at most
`MAX_VOICES` ring; tested with a fake AudioContext), and a limiter (`LIMIT`) keeps headroom before
the clipper. `sound.unlock()` runs inside the tile and card clicks and on every pointerup (WebKit
does not count a pointerdown as a gesture); the context is suspended in the background. Hits are
judged by the event's `timeStamp`; the cue is the ring on screen, so audio output latency does not
shift the windows. Pointers are handled on the whole kit with pointer capture; keep
`touch-action: none` there. New rhythms go at
the end of their level, public domain only, with a name `drums.rhythm.<id>` in both languages.
Free: free play and the first rhythm of each level (`meta.freeRhythms`: both rock beats); the full
version adds the others. Saved: stars per rhythm only.
Papegaai (Parrot, id `papegaai`): the child holds the big button (or taps it, then taps again) and
talks for up to `MAX_SECONDS` (10); the parrot says it back and then in other voices. The voices,
the cap, trimming the quiet ends, the take's gain (`TARGET_PEAK`, never more than `MAX_BOOST`), the
level, the beak and the waves are pure in `web/games/papegaai/effects.js` (tested: every voice's
numbers, `playSeconds` (the balloon's glide uses the take up exactly), `worstGain` 1.5 or less so
layers and echoes never pile up, the cap at every sample rate). `sound.js` keeps its own audio
context and follows the sound setting; capture goes through `capture-worklet.js` (a ScriptProcessor
where there is no AudioWorklet); every voice reaches the speakers only through the limiter
(`LIMIT`) and the shell's soft clipper, an echo feeds back under 1 (tested with a fake
AudioContext). Never call `shell.tap()` or `sfx.unlock()` while recording: it puts iOS back in its
ambient session; while the microphone is (being) opened the voice and sound buttons do nothing at
all (no offer card over a live microphone). If starting to listen fails, `startCapture` closes the
stream itself. After the gate was passed once, a press asks the Permissions API first and sends a
'prompt' (Android's "only this time", a permission taken back) through the card and the gate again
(`askFirst`); a microphone that opened is not re-checked until the app has been in the background. A card that a press brings up waits until the finger lifts (`afterRelease`), and
the system question after the gate waits a task, so the browser's own click or the gate's Enter
never presses its button. Beer is a cuddly bear, not a monster (Mark's playtest, 20 Nov 2026:
slowed right down it scared): 0.8 times the pitch at 0.9 times the pace (`shift`, made apart by
`pitchShift`: a WSOLA `stretch`, then read faster; never louder than the take) and a low-pass at
2800 Hz; before it was the take at rate 0.62 (pitch and pace both) through 2400 Hz. Voices: Gewoon, Muis, Beer (free, `meta.freeVoices`), Achteruit, Echo,
Koor (three parrots: low, middle, high), Ballon (rising pitch) in the full version; new voices are
processing of the child's own recording only, with a name `papegaai.voice.<id>` and a sign in
`art.js`. Calm: no timers, no scores, nothing to lose. Saved: nothing (only the shell's
`settings.micGate`). Android: `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` (Capacitor's
`BridgeWebChromeClient` asks for both when the page asks for the microphone, and denies it unless
both are granted), the microphone feature not required; iOS: `NSMicrophoneUsageDescription` in
Dutch and English; `tests/native.test.js` checks both.
The flying bubble follows the path planned by `planShot` in `grid.js` (the same trace as the
aiming guide), so it always lands in the ghost cell; keep it that way.
