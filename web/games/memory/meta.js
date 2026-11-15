// What the shell needs to know about Memory, without loading the game.
// Free: the two smallest boards (2×3 and 3×4) with the fruit cards, alone, together or against
// the computer. The full version (the one app-wide purchase) adds the 4×4 and 4×5 boards and the
// picture-book and shapes cards.
export const meta = Object.freeze({
  id: 'memory',
  titleKey: 'games.memory',
  group: 'puzzles', // the section on the home screen (GROUPS in js/games.js)
  freeSizes: Object.freeze(['2x3', '3x4']),
  freeThemes: Object.freeze(['fruit']),
  /** Is this game setup behind the full version? `setup`: { size, theme, mode }. */
  isLocked(setup, owned) {
    if (owned) return false;
    return !this.freeSizes.includes(setup.size) || !this.freeThemes.includes(setup.theme);
  },
});
