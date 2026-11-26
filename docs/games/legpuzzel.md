# Legpuzzel

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
