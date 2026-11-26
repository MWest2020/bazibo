# Picturedoku

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
