# Dammen

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
