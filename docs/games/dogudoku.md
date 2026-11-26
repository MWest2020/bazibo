# Dogudoku

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
