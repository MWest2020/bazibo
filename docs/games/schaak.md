# Schaken

Chess, in `web/games/schaak/` (rules in `rules.js` after the FIDE Laws of Chess, the computer in
`ai.js` and `ai-worker.js` through Dammen's `think.js`, the pieces drawn as SVG in `art.js`, the
screens in `schaak.js`).

- Every rule: all piece moves, check, checkmate, stalemate, castling (not out of, through or into
  check, king and rook unmoved), en passant, promotion (the child picks; the queen first). Draws
  are automatic: the third repetition, 50 moves each without a capture or pawn move, and too little
  material to mate. The move generator is checked with perft against the known numbers.
- Tap a piece and only its legal squares glow (a dot, or a ring for a capture), then tap one or
  drag the piece; an illegal try simply does not happen. A king in check glows softly. On a 320 px
  phone the squares are 38 px: a tap near a piece picks it up, but with a piece picked up a tap
  inside a square always means that square, so a move never happens by accident.
- Together on one screen, or against the computer as white: easy (free, with a hint button) plays
  mostly at random and takes a free piece now and then; medium and hard (full version) search
  with alpha-beta, 2 and up to 6 moves deep with captures after that, within a budget of positions
  and a time limit, in a worker. Take-back (against the computer with its answer). Wins against
  the computer are counted per level.
