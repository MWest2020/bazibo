# Tijgers en geitjes (Bagh-Chal)

Tigers and Goats, the traditional game from Nepal, in `web/games/baghchal/` (rules in `rules.js`,
the computer in `ai.js` and `ai-worker.js` through Dammen's `think.js`, pieces, the field and the
meadow drawn as SVG in `art.js`, the screens in `baghchal.js`). Rules as on Wikipedia's
"Bagh-Chal" page (cited in `rules.js`).

- A 5×5 grid of 25 points; lines along the rows and columns, diagonals through the points where
  row + col is even. The 4 tigers start on the corners; the goats have 20 goats and move first.
- The goats place one goat per turn on a free point and walk only when all 20 are placed, one
  step along a line. A tiger steps along a line or jumps over one adjacent goat to the free point
  just beyond (one per move, never compulsory, also while goats are still being placed).
- The tigers win with 5 goats captured; the goats win when no tiger can move. A goat player who
  cannot move loses. Instead of Wikipedia's "no repeated position" rule (hidden from a child) the
  same position for the third time is a draw, and so are 50 moves each without a capture after the
  last goat is placed, so every game ends.
- Gentle: a captured goat is never eaten, it hops off to the meadow beside the field and falls
  asleep there (counted visibly); friendly cartoon tigers; no timers.
- Tap a piece to see its dots (and the goat a tiger would jump), then a dot, or drag the piece
  there; while placing, every free point shows a soft dot. Every point is 44 px or more.
- Together on one screen, or against the computer as the goats or the tigers: easy (free) plays
  mostly at random (as tigers it takes a goat only now and then), medium and hard (full version)
  search with alpha-beta, 3 and up to 8 moves deep, within a budget of positions, in a worker so
  the screen never freezes. The last move can be taken back. Wins against the computer are
  counted per side and level.
