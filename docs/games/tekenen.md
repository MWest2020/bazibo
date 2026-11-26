# Tekenen (Drawing)

Free drawing with a finger, in `web/games/tekenen/` (the drawing as data in `drawing.js`, pure and
tested; the mirror lines in `symmetry.js`; drawing it again at any size in `render.js`; what is kept
when in `session.js`, tested without a screen; the screen in `tekenen.js`).

- Every colour of Kleurplaten's palette, three brushes, an eraser, undo and "clear the page".
- Mirror mode (full version): 2, 4, 6 or 8 mirror lines through the middle, so every stroke becomes
  a mandala. Stamps are in the full version too.
- A drawing is a list of strokes and stamps, saved as a short text through `saveDrawing` in
  `storage.js`. Undo never goes back past the drawing as it was opened; an empty page deletes a
  drawing only when the child leaves, never from the autosave.
- "My drawings" keeps the drawings; each has a small bin on its corner that asks "Weggooien?" first
  (no parental gate: it is the child's own).
- Free: drawing with every colour, brush and undo, and 3 kept drawings (`FREE_DRAWINGS`). The full
  version adds mirror mode, stamps and an album of up to 100 drawings (`MAX_DRAWINGS`).
- Saved under `games.tekenen.drawings`: every kept drawing as text, and a small "gone" marker for one thrown away.
