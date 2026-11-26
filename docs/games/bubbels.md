# Bubbels schieten

- Glossy bubbles that look like soap or glass, each colour with its own symbol (circle, star,
  triangle, diamond, heart, square), so colour-blind children can play too.
- Drag to aim and release to fire. A dotted guide line shows one bounce off the wall and a ghost
  circle where the bubble will land; the shot always lands exactly there. Tap the small bubble
  next to the launcher to swap it with the loaded one. Level 1 shows an animated hand ("Sleep
  omhoog en laat los!") until the first shot, and any level shows it again after 9 idle seconds.
- Three or more of the same colour pop, with a pop sound made by the Web Audio API (no sound
  files). Bubbles that lose their hold fall, bounce and pop.
- The ceiling drops a row after a number of misses (the dots next to the launcher, with a small
  ceiling-and-arrow picture that blinks red when one or two are left). Clear the
  board to win, with 1 to 3 stars depending on the number of shots.
- 30 levels as data in `web/games/bubbels/levels.json`. Levels 1-10 are free; 11-30 are part of
  the "volledige versie" (see [Full version](../reference/full-version.md)).
- Dutch and English UI, portrait phone and desktop, works offline (service worker) and makes
  zero network requests to anywhere but its own origin (a Content Security Policy enforces it).
