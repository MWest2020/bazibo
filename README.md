# Bazibo

An app of play-and-learn games for children of 3 to 10. No ads, no trackers, no accounts, one
€1 purchase that opens every game. It is a plain web app (HTML, CSS and JavaScript on a canvas),
wrapped with Capacitor as an Android and an iOS app. The games: the bubble shooter
("Bubbels schieten" / "Bubble Shooter"), Dogudoku (a logic puzzle with puppies), Picturedoku (a
sudoku with pictures), Paartjes ("Pairs", turn over two cards and find the pairs), Legpuzzel ("Jigsaw", 9 to 60 pieces), Vier op een rij ("Four in a Row", together or against the computer), Dammen ("Checkers"), Ganzenbord ("Game of the Goose"), Kwartet ("Quartets", the Dutch card game of asking for cards),
Slangetje ("Snake", a snake that eats numbers in order, the letters of a word or one colour) and
Kleurplaten ("Colouring", pictures for the youngest and mandalas for older children), Klok
kijken ("Telling Time", read and set an analogue clock), Letters (learn the letters by sight:
match a letter, the first or a middle letter of a word, build a word), Egeltje ("Little
Hedgehog", walk a hedgehog through a garden maze and pick up the alphabet, a word or numbers in
order), Kangoeroe op de getallenlijn ("Kangaroo Hops", adding and taking away by hops
on a number line) and Kaartpuzzel ("Map Puzzle", topography: the continents, Europe and your own
country as a puzzle and as "where is...?"); more
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

### Paartjes (Memory)

Find the pairs, in `web/games/memory/` (rules in `rules.js`, the computer in `ai.js`, the cards in
`art.js`, the screens in `memory.js`). On screen it is "Paartjes" / "Pairs", never "Memory" (a
Ravensburger trademark, as "Connect Four" is for Vier op een rij).

- Four boards: 6 cards (2 × 3, ages 3+), 12 (3 × 4, 4+), 16 (4 × 4, 5+) and 20 (4 × 5, 6+). The
  grid turns to fit the screen (`bestGrid`): tall on an upright phone, wide on a sideways one;
  20 cards on a 320 × 568 phone are still over 60 px.
- Three sets of cards, all drawn in code: fruit (the Picturedoku fruit plus a strawberry, cherries,
  a lemon and a melon drawn in the same style), the picture book (the coloured-in Kleurplaten
  pictures Letters uses: sun, house, cat …) and shapes (ten friendly shapes, each its own shape
  and colour). Within a set every picture differs by shape and colour.
- Tap a card and it flips over. The same picture twice is a pair: it stays up with a gold ring and
  a hop, and the same player goes on (the classic rule). Two different pictures stay up for a
  moment and turn back by themselves; a tap meanwhile does nothing.
- Alone (stars by turns: 3 within two turns a pair, 2 within three; no clock), together on one
  screen taking turns (the pairs take the finder's colour), or against a gentle computer that
  remembers a card it saw only now and then and forgets some of it each turn (`ai.js`). Its turn
  is slow and visible: the robot chip wobbles, "the computer is choosing", a card, then the next.
  A child who remembers what was shown beats it almost always (`npm test` plays 200 games).
  Together and against the computer, who starts takes turns from game to game.
- Free: 6 and 12 cards with the fruit, in every way to play. The full version adds 16 and 20 cards
  and the picture-book and shapes cards (`meta.js`). The end card of a 12-card game offers "More
  cards" (the shell's `offerUnlock`).
- Saved under `games.memory`: the best stars alone per board and set, the child's wins against the
  computer per board (counters that only go up), and the last menu choice. A game in progress is
  kept while the app stays open ("keep playing").

### Legpuzzel

A jigsaw puzzle, in `web/games/legpuzzel/` (rules and geometry in `rules.js`, the pictures in
`pictures.js`, the screens in `legpuzzel.js`). Chosen over a sliding puzzle because it works from
age 3 (9 big pieces) up to 10 (60 pieces). A sliding puzzle is hard below about 7.

- Six sizes: 9 pieces (3×3, age 3+), 16 (4×4, 4+), 25 (5×5, 5+), 30 (6×5, 6+), 48 (8×6, 7+), 60
  (10×6, 9+). The ages moved down in issue #45: Mark's four-year-old laid the 30 pieces, then
  marked 9+, with ease. The same day Mark dropped the sizes for two-year-olds (17 Nov 2026: 9
  pieces from 3, 16 from 4, 25 from 5); 4, 6, 12 and 20 pieces left the menu. Their ticks stay in
  the save, unseen, and a saved last size that is gone opens on 9 (`knownSize`). Square pieces with round tabs (`piecePath`). A tab on one piece is a hole in its neighbour; the border is
  straight. No turning.
- Eight pictures, whole scenes drawn in code, so every piece shows something: the house in the
  garden, the boat at sea, the fruit bowl (free), the rocket, the elephant, six puppies, the street
  and the meadow (full version). They are made from the app's own drawings (Kleurplaten pictures,
  Picturedoku fruit, Dogudoku puppies) on a sky, grass, sea, space or table-cloth background. A
  scene fills any board shape, from 1:1 to 5:3.
- The loose pieces lie scattered on a tray under the board (beside it on a sideways screen;
  `layout`, `scatter`). Drag a piece; dropped within 0.4 of a piece of its own place it snaps in
  with a soft note (one higher for each piece) and stays. It never snaps into another piece's
  place, and a drop anywhere else leaves it there. A touch on the see-through corner of a piece's
  drawing goes to the piece underneath.
- The magnifier (48 and 60 pieces on a phone, 25 and 30 on a small one of 320-360 wide): when a piece's square is under
  56 px the HUD shows a magnifier button. It scales the board and the tray together to about 66 px
  a piece (`zoomFor`); a finger on an empty spot moves the view, and a piece held near the edge of
  the view moves it along, so a piece from the tray reaches a place out of view in one drag. It is
  only a view: positions, layout and snapping stay in stage units. Chosen over a scrolling tray
  because upright the board's width is the limit (10 columns across a 390 px phone give 36 px
  squares, whatever the tray does), and over pinch-zoom because one big button is easier for a
  child and never fights with dragging. Turning it on is remembered.
- A faint example picture on the board helps; the eye button turns it off (remembered). When the
  last piece is in, the board glows and a chime plays, then the end card: next picture, again,
  menu.
- The picture is drawn once into an image the size of the board. Every piece is its own small
  canvas cut out with a `Path2D`, moved with a CSS transform, so dragging redraws nothing.
- Free: 9, 16 and 25 pieces with the first three pictures. The full version adds 30, 48 and 60
  pieces and five more pictures (`meta.js`). The end card of a 25-piece puzzle offers "More
  puzzles".
- Saved under `games.legpuzzel`: every picture and size laid at least once (a tick in the menu),
  the last size, the example picture on or off and the magnifier on or off. A puzzle in progress is kept while the app
  stays open ("keep puzzling").

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


### Dammen

Checkers, in `web/games/dammen/` (rules in `rules.js`, the computer in `ai.js` and
`ai-worker.js`, pieces and boards drawn as SVG in `art.js`, the screens in `dammen.js`).

- The 8×8 board with Dutch rules made small (free): a man steps one square diagonally forward,
  capturing is compulsory and a man may also capture backwards, a capture goes on as long as it
  can, a man that ends its move on the far row is crowned, and a king moves one step in every
  direction. Any capture may be chosen.
- The international 10×10 board (full version): flying kings, and you must take the most pieces.
- On both: pieces jumped in a multi-capture stay until the move ends; a man that passes the far
  row during a capture and goes on stays a man. A player who cannot move loses; the same position
  for the third time, or 25 king moves each without a capture, is a draw.
- Tap a piece, then a dot. The pieces that must capture glow softly; when only one can, it is
  picked up for the child. A multi-capture is tapped jump by jump until only one way is left, then
  the rest goes by itself. Taps go to the nearest useful square, so the small 10×10 squares still
  have a finger-sized target.
- Together on one screen, or against the computer: easy (free) plays mostly at random; medium and
  hard (full version) search with alpha-beta, 3 and up to 8 moves deep, within a budget of
  positions, in a worker so the screen never freezes. Against the computer a move can be taken
  back. Wins against the computer are counted per board and level.
- Puppy against kitten, or a classic white and black look. A king wears a crown.

### Ganzenbord

The game of the goose, in `web/games/ganzen/` (rules in `rules.js`, the spiral in `board.js`, the
geese, the special squares, a die face and the three boards drawn as SVG in `art.js`, the screens in
`ganzen.js`). Our own board, never a publisher's art.

- 63 squares in a spiral with big numbers. Geese on 5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54
  and 59 (move again by the same amount, in the same direction); the bridge 6 → 12; the inn 19
  (miss a turn); the well 31 and the prison 52 (wait until another goose lands there and takes
  your place, but never more than two turns); the maze 42 → 37; 58 "lost in the woods", back to
  the start; 63 exactly, the rest bounces back. Two dice, added up (Mark, 2026-11-14), with the
  classic first throw: 6 and 3 from the start goes to 26, 5 and 4 to 53 (also after the woods). Geese may share a square.
- "Zelf tellen" / "Count yourself": after the throw the child taps every square the goose walks
  to; the square to tap glows and the count pops up big. Otherwise the goose walks by itself with
  the same big numbers. No voice.
- Free: the classic meadow board with 2 players (a child against a computer goose, or two
  children). Full version: up to 4 players in any mix, and a winter and a sea board.
### Kwartet

The Dutch quartets card game, in `web/games/kwartet/` (rules in `rules.js`, the computer players in
`ai.js`, the cards in `art.js`, the screens in `kwartet.js`).

- Eight sets of four cards, each card with its picture and its name: fruit, pets, vehicles, the
  garden, puppies, the zoo, the weather and toys. The pictures are the app's own: the Picturedoku
  fruit, the coloured-in Kleurplaten drawings, the Dogudoku puppies, and ten new ones drawn in the
  Picturedoku style (train, ladybird, lion, giraffe, cloud, rainbow, snowman, teddy bear, kite,
  blocks). Every set has its own colour, and its name above its row.
- With three or four players all cards are dealt. With two (where every question would get a
  yes) each gets 5, 6 or 7 cards (4, 6 or 8 sets) and the rest lies face down as the pile
  (de stapel). On your turn you ask another player for a card of a set you hold. You get it: ask
  again. You do not: with two players you take the top card of the pile (tap the glowing pile; if
  it is the very card you asked for, you may ask again), then the turn goes to the next player
  round the table; an empty pile just passes the turn. Four of a set are laid down at once as a
  kwartet (also straight after the deal). A hand that runs empty takes a card from the pile; with
  no pile left that player sits out. When every set is down, the most kwartetten wins (the same
  number is a draw). The menu says which rule applies.
- Readable for young children: your hand is shown per set as its four places, and the missing
  ones are the big buttons to ask with. Tap a player first when there is more than one. Every
  question and answer is a speech bubble with the card's picture ("Robo, heb jij de trein?", "Ja!
  Alsjeblieft."). The computers take their turns slowly, one question at a time, with the asking
  robot wobbling.
- The computers (`ai.js`) only use what everyone at the table could know (who asked for what, so
  holds a card of that set; who gave what; who said no; a card shown after a lucky draw), never
  the pile. They remember each of those things only now and then. A child who pays attention wins
  or shares about half of the games against two of them, and more than half against one with the
  pile (`npm test`). The computer draws from the pile by itself, slowly, a card back flying to it.
- Children together on one phone: a "pass the phone" card comes between their turns and hides
  every hand until the next child taps "Show my cards". While a computer plays, no hand is shown.
- Free: 4 sets (fruit, pets, vehicles, garden) with up to 3 players, any mix of children and
  computers. The full version adds a 4th player and games with 6 and 8 sets, picked from all eight
  sets. The end card offers "More sets" on a device without the full version.
- Saved under `games.kwartet`: the child's wins against the computer per number of sets (only
  games with one child, counters that only go up) and the last menu choice. A game in progress is
  kept while the app stays open ("keep playing"); a question on screen when the child leaves is
  answered at once on return.

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

### Klok kijken

Learn to tell the time, in `web/games/klok/` (the time logic in `time.js`, pure and tested; the
clock and pictures in `art.js`; the screens in `klok.js`). A friendly alarm clock drawn in code: a
purple rim with two gold bells, numbers 1-12, minute marks, a short orange hour hand and a long
blue minute hand that are easy to tell apart.

- The menu first shows the four kinds of round (the daily rhythm first, for the youngest, the
  digital clock last), then the rounds of one kind by age, with one "Random" card per kind (at the
  tier last played).
- Four kinds of round:
  - **Zet de klok / Set the clock:** turn the hands to a time shown in words and digits ("half
    drie", 2:30). Drag a hand (beyond the short hand's reach a finger always takes the long
    hand; near the centre the short hand wins when it is within 20 degrees, as at 12:00; the long
    hand follows the finger the shortest way round, so passing 12 moves the hour on, also with
    big steps or a fast flick) or tap + and - per hand, then Klaar / Done.
  - **Hoe laat is het? / What time is it?:** pick the time the clock shows from 3 or 4 answers.
    The wrong answers are the mistakes children really make: an hour off ("half drie" is 2:30, not
    3:30), the hands swapped, a step off, and for the oldest the twelve-hour flip (3:47 vs 15:47).
    Each comes from a different kind, never an hour too early and too late together, and the right
    answer is as often the earliest as a middle or the latest time (`npm test` checks no simple rule
    wins more than about 40%).
  - **Dagritme / Daily rhythm** (youngest, whole hours): a picture (breakfast, school, lunch,
    playing outside, dinner, bath, bed) and three clocks with a sun (day) or a moon (evening).
  - **Digitaal / Digital** (ages 7-10, as Dutch schools teach it in groep 4-5), three tiers of
    10 mixed questions: (1) a digital time such as 03:30 to its analogue clock and back, whole
    hours then half hours, 12-hour; (2) quarters then five minutes: set a digital clock with big
    + and − buttons for the hour and the minutes to an analogue clock or to words ("kwart over
    vier"; the clock follows along), and say a digital time in words ("04:25" is "vijf voor half
    vijf"); (3) the 24-hour clock: "14:25" to and from "vijf voor half drie ’s middags" / "twenty-five
    past two in the afternoon", an analogue clock with its part of the day to the 24-hour time, and
    which is later (09:40 or 21:15), with a strip of the day. Parts of the day: 0-6 night, 6-12
    morning, 12-18 afternoon, 18-24 evening. The digital clock is drawn in seven segments (no
    fonts), the hour orange like the short hand and the minutes blue like the long hand; its colon
    blinks calmly. A mistake shows the clock and the digital clock side by side and explains it.
- Five tiers: whole hours (5-6), half hours (6-7), quarters (7-8), five minutes (8-9), single minutes
  and the 24-hour clock with a sun or moon on the face (9-10).
- Dutch phrasing follows the half hour: "vijf voor half drie" (2:25), "tien over half drie"
  (2:40), "kwart voor drie" (2:45); single minutes "acht minuten voor half vier" (3:22). English
  counts past and to the hour. `npm test` checks every 5-minute step of every hour in both
  languages, and that all 720 positions read differently.
- A round is 10 questions; stars by mistakes (none 3, one or two 2, more 1). A mistake shows the
  right time on the clock and explains it ("De grote wijzer staat op de 6 en de kleine wijzer
  staat tussen de 2 en de 3"). The hint lights up the hand to look at.
- Free: every round of whole and half hours (on the clock and on the digital clock), and the daily
  rhythm. Quarters, minutes and the 24-hour clock, and random practice per tier, are in the full
  version (`meta.js`).
- Saved under `games.klok`: stars per round (`dig-t1-1` and so on for the digital rounds), random
  rounds done per mode and tier, the last tier per kind and which how-to cards were seen. A round in progress is kept while the app stays open ("keep playing").

### Letters

Learn the letters by sight, in `web/games/letters/` (ages 4-7; the rounds in `round.js` and the
words in `words.js`, pure and tested; the pictures in `art.js`, which colours in the Kleurplaten
drawings and reuses the Picturedoku fruit; the screens in `letters.js`). Nothing is spoken: every
question is a big letter, a picture or a word to look at. (Until 13 Nov 2026 a Piper voice read
the questions aloud; Mark dropped it because children did not like the robot voice.)

- What makes a tier harder is never the number of tiles (Mark, 18 Nov 2026: "3 or 6 letters
  doesn't matter to a 4-year-old") but what the child must tell apart and how much of the word is
  given. Look-alikes come from two tables in `words.js`: `SIMILAR` (small letters that look alike
  without being mirrors: m/n, i/l/j, o/c/a, s/z; `SIMILAR_UPPER` for capitals: E/F, P/R/B, O/Q/C)
  and `LOOKALIKE` (mirror images: b/d/p/q, n/u, m/w), used from tier 3 and only on small letters
  (capital B, D, P and Q are not mirror images). Look-alikes are picked in the case the tiles are
  drawn in (the capitals option).
- Four kinds of round:
  - **Tik de letter / Tap the letter**: one big letter, tap the same one. Tier 1 draws it exactly
    like its tile, with one look-alike among the tiles (an n next to the m); tier 2 shows the
    capital, find the small letter (with the capitals option on, the other way round), again with
    a look-alike; tier 3 mixes both cases and puts two look-alikes next to every letter, a mirrored
    one for b, d, p, q, n, u, m and w (half of every round). A capital I is never offered next to a
    small l. The case is fixed when a round starts.
  - **Beginletter / First letter**: a picture with its word underneath, the first letter left
    out ("_on"); tap the missing letter. The word is shown in every tier, so a picture that could
    be two words (puppy or dog) is never a guess. Unchanged: Mark's children like it as it is.
  - **Middenletter / Middle letter**: the same with a letter inside the word left out ("k_t"),
    never the first or last letter and never one half of a pair that makes one sound (ui, oo, ee,
    sh, ck), so the gap is a sound of its own (`MIDDLE` in `words.js`, with per gap the words a
    wrong letter would spell: k_t never offers i, o or u for kit, kot, kut). Tier 1 a vowel in a
    short word; tier 2 words up to 6 letters, any listed gap, with a look-alike among the
    choices; tier 3 every word with two look-alikes, mirrored first.
  - **Woordje maken / Build a word**: a picture, tap the word's letters in order. Tier 1 shows the
    word for 2 seconds (a tap on the picture, the eye, shows it again) and has one extra tile;
    tier 2 has the picture only, with two extra tiles of which one looks like a letter of the
    word; tier 3 the same with two look-alikes, one of them mirrored when the word has b, d, p,
    q, n, u, m or w (a d next to "bal"). Extra tiles never sound like a letter of the word.
- Three tiers: the first letters (a i o m s k), more letters, the whole alphabet. Lowercase by
  default, as Dutch schools start; the "aA" button in the menu bar switches to capitals.
- "First letter" never offers letters that sound alike at the start of a word (`CONFUSABLE` in
  `words.js`: English c/k/s, Dutch k/c/q, v/f, z/s), nor a letter that would spell another word in
  the gap (`ALSO_A_WORD`: kat/mat, huis/muis, pear/bear). A new word goes on that list too. The
  wrong choices come from the tier's letters plus the first letters of its words, so in tier 1
  the answer is not simply the one letter from outside a i o m s k.
- Sounds are ambient (`AVAudioSession` `.ambient` in `ios/App/App/AppDelegate.swift`,
  `audioSession.type = 'ambient'` in `audio.js`): the iPhone's silent switch mutes them and a
  parent's music keeps playing.
- A wrong tap is gentle: the tile shakes and fades, "Probeer het nog eens"; after two wrong tries
  the right letter lights up (building: the next letter goes in by itself). Stars by mistakes per
  question (counted once). The only sounds are the app's own effects (a plink per placed letter, a
  soft boop, the end chime), muted by the sound setting.
- Free: every round of the first tier, in all four kinds. The other tiers and random practice are
  in the full version (`meta.js`).
- Saved under `games.letters`: stars per round, random rounds done, how-to cards seen, the last
  tier per kind and the capitals option.

### Kangoeroe op de getallenlijn

Adding and taking away on a number line, the way Dutch schools teach it in groep 3-4, in
`web/games/kangoeroe/` (ages 5-8; the questions and hops in `hops.js`, pure and tested; the
kangaroo in `art.js`; the screens in `kangoeroe.js`). A kangaroo stands on the line and the child
decides the hops: +1 / −1 (and +10 / −10, or 2s and 5s, on 0-100), each drawn as an arc, or a tap
on the line for one big jump; then **Hier!** ("Here!"). "How many hops?" questions are answered by
picking the number. No timers and no losing: a wrong answer bounces the kangaroo back to the start
and draws the way as dashed arcs (over 10: to the ten, then on); after a second one the kangaroo
hops the way itself. Nothing is spoken.

- t1 (5-6): 0-10, forward only. "Van 3 naar 7: hoeveel sprongen?" and "3 + 4 = ?" with the four
  hops as pips.
- t2 (6-7): 0-20, forward and back, mostly over 10, and the missing number ("5 + ? = 12").
- t3 (7-8): 0-100 with the tens marked: hops of ten, over a ten, two steps ("37 + 20 + 5"),
  counting by 2s and 5s, + and − mixed. A phone shows a window of the line with a map above it.
- Rounds of 8 with stars by mistakes. Free: tier 1; tiers 2-3 and random rounds in the full
  version.
- Saved under `games.kangoeroe`: stars per round, random rounds per tier, the how-to cards seen
  and the last tier.

### Kaartpuzzel (Map Puzzle)

Topography with map packs, in `web/games/kaart/` (id `kaart`, ages 6-12). The maps come from
Natural Earth (public domain), projected, clipped and simplified by `tools/gen-kaart.mjs` into one
small ES module per pack (`packs/<id>.js`: SVG paths, a centre per region, names in Dutch and
English, capitals or oceans); the raw data is not committed (the tool's header says how to fetch
it). What a tap or a drop means is pure in `map.js`, the rounds in `rounds.js` (both tested in
`tests/kaart.test.js`); the screens in `kaart.js`.

- Packs: Werelddelen / Continents (seven, with the five oceans as labels) and Europe (41
  countries, the Dutch point of view: Natural Earth's NLD edition) for everyone; the Netherlands
  (12 provinces, the IJsselmeer as water), the United States (50 states, Alaska and Hawaii in
  boxes) and the United Kingdom (4 nations) as own-country packs. The menu shows the country the
  device's language says (`navigator.language`, exact: nl-NL or nl → the Netherlands, en-US → the
  US, en-GB → the UK, anything else none, nl-BE too); "Ander land…" picks another or none (saved).
- t1 (6-8): a puzzle with every border drawn, up to 8 pieces a round, the biggest first. Drag a
  piece from the row onto the map (a finger's piece is drawn above the finger); inside its outline
  or close to its centre it snaps in (never half way to another centre), on another region's
  place it bounces back. Puzzles (with borders) whose pieces are too small to drop on a phone start with the magnifier. A tap on a piece, then on its place, works too.
- t2 (7-10): "Waar ligt Utrecht?": tap the region. Small regions (Luxembourg, Rhode Island) are
  picked by a tap on or right by their outline (inside a neighbour only within a fifth of a
  finger), and get a dashed ring when tiny.
- t3 (9-12): the whole puzzle without borders (the land only; for the continents an empty sea),
  then the capitals as dots ("Waar ligt Utrecht (stad)?") or, on the world map, the oceans.
- Calm: no timers. A wrong drop or tap is a bounce and says what was tapped; it counts once per
  piece or question, and after two the right place glows. Stars by mistakes. Nothing is spoken.
- Phones with tiny regions (Europe, the US) get a magnifier (3x) and the map pans with a finger.
- Free: the whole Continents pack and tier 1 of every pack (`meta.js`); the rest in the full
  version. Saved under `games.kaart`: stars per round (`nl-t2-1`), the last pack, the country and
  the how-to cards seen.
- Adding a country: a block in `tools/gen-kaart.mjs`, an entry in `packs.js` and its name
  `kaart.pack.<id>` in `strings.js`.

### Egeltje (Little Hedgehog)

A garden maze, in `web/games/doolhof/` (id `doolhof`; ages 4-8): a little hedgehog walks between
hedges and picks up letters in alphabetical order, the letters of a pictured word, or numbers in
order. Mark asked for "a maze chase like eating an alphabet" that must not look or sound like
Pac-Man: a brown hedgehog seen from the side, black-blue birds with an orange beak, a green garden
with hedges between the cells, no chomping, no arcade sounds, no ghosts, no dying, no timer.

- `maze.js` (pure): a seeded depth-first maze on 5x6, 5x7 or 6x8 cells (lying down on a sideways
  screen), then every dead end opened and a few more gaps cut, so there are loops everywhere.
- `rules.js` (pure): the rounds, the steps, the crows. A swipe, an arrow on the pad, an arrow key
  or a tap beside the hedgehog walks it to the next crossing; it goes round bends by itself and
  stops at a hedge, on the right letter, and in front of a crow or a wrong letter (also a crow that
  stepped in during the walk): only a step the child chooses bumps or touches.
- Only the next few values are on the board (`WINDOW`), one tile per value (a letter that comes
  twice, the p in "appel", appears when the first is picked up). A tile is never placed where it
  would cut the garden in two (`placementOk`), so every letter can be reached without walking over
  another, after every step.
- A chosen step onto a wrong letter is a soft bump: the hedgehog stays, the letter stays ("Boink!
  Dat is de d. Zoek de c."), one mistake per letter; after two bumps the right one glows. Tier 1
  wrong letters never look like the letters asked for (`plainOk`, either way round; when a word is
  done, the old word's wrong tiles that look like the new word's letters are taken away).
- The crows are friendly and slow (a step a second, walking only after the first step, never onto
  the hedgehog). A walk stops in front of one; a chosen step straight into one makes the hedgehog curl up
  for a moment and roll back to the start of its corridor (at most 3 cells, `ROLLBACK`), and the
  crow flies to the far side of the garden. No letters are lost, and stars count wrong letters
  only (Letters' `starsFor`), never crows and never time.
- Three kinds and three tiers, harder by what must be told apart, not by speed:
  - **Het alfabet / The alphabet**: a-e (4-5, plain wrong letters such as an x or an s, one crow),
    ten in a row (5-6, look-alikes of the letters on the board: a d or a q next to the b), the whole
    alphabet (6-8, mirrored b/d/p/q first, two crows).
  - **Woordjes / Words**: three pictured words a round, from Letters' word lists and pictures.
    Tier 1 three-letter words with every letter shown faintly and the next one big, tier 2 the
    word shown with look-alike wrong letters, tier 3 long words with the picture only (empty
    slots) and mirrored look-alikes.
  - **Tellen / Counting**: 1-5, 1-10 with look-alike numbers (6/9, 1/7, 12/21), and counting in
    twos to 20 with the odd numbers in between as the wrong ones.
- Free: every round of tier 1 in all three kinds; tiers 2 and 3 and random gardens are in the full
  version (`meta.js`). Nothing is spoken; the only sounds are the app's own effects (a plink per
  letter, a soft boop, a soft thud for a crow, the end chime).
- Saved under `games.doolhof`: stars per round, random rounds done per kind and tier, how-to cards
  seen and the last tier per kind. A round in progress is kept while the app stays open ("keep
  playing"); the garden then waits for the next step.

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
uv run --with playwright python tests/smoke.py offers   # only the end-of-free-part offers (bubbels: Bubbels alone)
```

The smoke test uses the headless Chromium at the path in `CHROME` (default: the Playwright
cache on the dev machine, else Playwright's own browser) and fails on page errors or on any
request outside the local server. It also checks that the web build sells nothing, that the end
of the free levels leads to the offer, walks through the parental gate in both languages, switches
the language in settings, checks that a returning player keeps their progress, and opens the
privacy and terms pages. A name after `smoke.py` runs only that part: `dammen`, `ganzen`, `doolhof`,
`offers` (every game's free part ended and its offer closed, and for Bubbels every way out of the
offer in a stand-in app, from "Later" to a purchase; the player always lands on the game's list
with the save kept) or `bubbels` (that Bubbels part alone, about 20 s).

CI runs the whole smoke test on every push and PR (the `smoke` job in `.github/workflows/ci.yml`,
Playwright 1.65.2 and its headless Chromium installed on the runner; the screenshots are kept as
an artifact when it fails).

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
| `web/games/doolhof/` | Egeltje (garden maze): `meta.js` (free part), `maze.js` and `rules.js` (pure), `art.js` (garden, hedgehog, crows), `doolhof.js` (the screens) |
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

### Voortgang overzetten (move progress)

Settings › Voortgang overzetten, behind the parental gate. One device shows its progress (the
games' sections and the settings, never the purchase) as QR codes; the other scans them with the
camera or takes the code as pasted text. No server and no internet.

- `web/js/transfer.js` (pure, tested in `tests/transfer.test.js`): the save as JSON, deflated
  (`CompressionStream` where there is one; unpacked with `DecompressionStream` or, on iOS before
  16.4, the vendored fflate), with a format byte and a CRC-32, in base45 (so the QR
  codes use alphanumeric mode), split into parts of 600 characters `BZ1<set><i><n>:…` (QR version 13, level L), at most
  30. The receiver collects the parts of one set in any order, checks size (at most 512 kB
  unpacked), checksum and the shape of every value before anything touches the save. Merge keeps
  the best of both (stars and counts the higher value, colouring pages per region, how-to cards
  seen stay seen); replace takes the code's progress and settings. The purchase stays the
  device's own either way. When a code would need more than 30 QR codes, the sender offers one
  without colouring pages.
- `web/js/transfer-ui.js`: the screen. QR codes are drawn with qrcode-generator, read with the
  browser's `BarcodeDetector` or, without it, jsQR (both vendored in `web/vendor/`). The camera
  runs only while the Receive tab is open. Android declares `CAMERA` (not required), iOS
  `NSCameraUsageDescription`.
- `storage.applyTransfer()` stores the result, only when the save could be read at startup.

## Licence

MIT, see `LICENSE`. Third-party material is listed in `CREDITS.md`.
