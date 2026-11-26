# Treintje (Train Tracks)

A path puzzle of our own, in `web/games/treintje/` (id `treintje`; ages 3-10). The child drags one
railway with a finger from station 1 through every square exactly once, past the numbered stations
in order; the last station is the last square. Then the little train (a locomotive and two wagons,
drawn in code) rides the track to the last station. Nothing is ever wrong and there are no timers:
a step that is not allowed simply does not happen, and a short line says why. Nothing is spoken.

- Only random puzzles, per age: the menu is three age cards, each an endless stream. 3-5: 4x4, 4 to
  6 stations, no fences (free). 6-7: 5x5 or 6x6, 6 to 12 stations. 8-10: 6x6 or 7x7 with a few
  fences and as few stations as keep it unique (full version).
- Every puzzle has exactly one solution: `generate.js` (pure, seeded) makes a random path through
  every square, puts stations (and fences) on it and proves with a budgeted solver that there is
  only one way, then takes stations away while it stays so. Made in the shell's worker, one ahead.
- What a finger means is pure in `rules.js`: dragging on lays track, dragging back takes it back, a
  tap on the track takes it back to there; a fast finger walks the squares in between. Squares are
  44 px or more on every screen. "Andere puzzel" gives a new puzzle of the same age.
- Saved under `games.treintje`: puzzles solved per age, the how-to cards seen and the last age.
