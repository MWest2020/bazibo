// What the shell needs to know about Treintje (Train Tracks), without loading the game.
// Free: the puzzles for ages 3-5, endless. The bigger puzzles for 6-7 and 8-10 are part of the full
// version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'treintje',
  titleKey: 'games.treintje',
  group: 'puzzles', // the section on the home screen (GROUPS in js/games.js): a path puzzle
  freeAges: Object.freeze(['a3']),
  /** Is this age (`{ age }`) behind the full version? */
  isLocked(choice, owned) {
    if (owned) return false;
    return !this.freeAges.includes(choice.age);
  },
});
