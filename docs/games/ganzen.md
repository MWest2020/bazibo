# Ganzenbord

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
