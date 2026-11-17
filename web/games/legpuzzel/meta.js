// What the shell needs to know about Legpuzzel, without loading the game.
// Free: puzzles of 9, 16 and 25 pieces with the first three pictures (the garden, the sea, the
// fruit bowl). The full version (the one app-wide purchase) adds 30, 48 and 60 pieces and five more
// pictures.
import { PICTURES } from './pictures.js';

export const meta = Object.freeze({
  id: 'legpuzzel',
  titleKey: 'games.legpuzzel',
  group: 'puzzles', // the section on the home screen (GROUPS in js/games.js)
  freeSizes: Object.freeze(['p9', 'p16', 'p25']),
  freePictures: Object.freeze(PICTURES.filter((p) => p.free).map((p) => p.id)),
  /** Is this puzzle (`{ picture, size }`) behind the full version? */
  isLocked(puzzle, owned) {
    if (owned) return false;
    return !this.freeSizes.includes(puzzle.size) || !this.freePictures.includes(puzzle.picture);
  },
});
