# Kleurplaten

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
