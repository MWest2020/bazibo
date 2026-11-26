// What the shell needs to know about Legpuzzel, without loading the game.
// Free: puzzles of 9, 25 and 36 pieces with the first three pictures (the garden, the sea, the
// fruit bowl). The full version (the one app-wide purchase) adds 48, 60, 80 and 100 pieces and five
// more pictures (Mark, 26 Nov 2026).
import { PICTURES } from './pictures.js';

export const meta = Object.freeze({
  id: 'legpuzzel',
  titleKey: 'games.legpuzzel',
  group: 'puzzles', // the section on the home screen (GROUPS in js/games.js)
  freeSizes: Object.freeze(['p9', 'p25', 'p36']),
  freePictures: Object.freeze(PICTURES.filter((p) => p.free).map((p) => p.id)),
  /** Is this puzzle (`{ picture, size }`) behind the full version? */
  isLocked(puzzle, owned) {
    if (owned) return false;
    return !this.freeSizes.includes(puzzle.size) || !this.freePictures.includes(puzzle.picture);
  },
});
