# Ludo (with Pachisi)

One race game in two modes, in `web/games/pachisi/` (the id stays `pachisi` so saves and transfer
codes keep working; on screen it is Ludo). The screens are `pachisi.js`, which plays either mode
through `modes.js`; Ludo is the default.

**Ludo**: rules in `ludo-rules.js` (Wikipedia's "Ludo", cited there), the computer in `ludo-ai.js`,
the board and the die in `ludo-art.js`. Played the way Dutch families play this kind of game:

- One die. A 6 brings a pawn from the yard onto your start square and gives another throw; with
  pawns waiting and your start square free, a 6 must bring one out. Every 6 throws again.
- While pawns wait in the yard, your pawn on the start square must move off it first (when it can).
- When no pawn can move at all (all in the yard, or stuck in the home squares) you get three
  throws to throw a 6.
- A cross of 40 squares round a free middle; every player walks clockwise once round and then up
  into their own 4 home squares, which need an exact throw (too high: that pawn stays).
- Landing on an opponent sends it walking back to its yard. No safe squares. You never land on
  your own pawn, but you may walk past it. A throw nobody can use is lost.
- 2 to 4 players, 4 pawns each or 2 as a short game. The board is our own, drawn in code: rounded
  squares on a pale sky, soft yards with nests, a flower in the middle, the players' sun, moon,
  star and lotus pawns.
- The child counts the die's pips by tapping them ("Zelf tellen"), or the die counts itself.

**Pachisi**, the original race game from India (rules in `rules.js`, the computer in `ai.js`, the
cloth, the pawns and the cowrie shells drawn as SVG in `art.js`). Rules as on Wikipedia's
"Pachisi" page (cited in `rules.js`), with every simplification listed there.

- A cross-shaped cloth: four arms of 3×8 squares round the Charkoni in the middle, 12 castle
  squares (marked with a stitched cross). Every pawn starts in the Charkoni, walks down its own
  arm's middle column, counter-clockwise round the whole board and back up into the middle: 84
  steps.
- Six cowrie shells: the shells that land open give the steps (2 to 6 open: that many; 1 open: 10;
  none open: 25, "pachisi"); a 6, 10 or 25 throws again. The child counts the open shells by
  tapping them ("Zelf tellen"), or they count themselves.
- Landing on another player's pawn outside a castle sends it walking back to the middle, where it
  starts again; on a castle nobody can be captured, and nobody may land on a castle someone else
  holds. The first to bring every pawn home wins.
- Made simpler for children: a pawn leaves the middle with any throw, home needs no exact throw,
  no extra throw for a capture, no teams, and 2 pawns each as a short game (4 is traditional).
- In both modes: tap a glowing pawn: the square it would reach glows, with dots on the way; tap
  that square and it walks there, with the count on every square. The last move can be taken back.
- Free, in both modes: two players, a child against the easy computer or two children. Full
  version: a 3rd and 4th player and the medium computer.
