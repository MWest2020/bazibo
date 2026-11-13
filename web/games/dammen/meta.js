// What the shell needs to know about Dammen, without loading the game.
// Free: the 8×8 board, two players or the easy computer. The full version (the one app-wide
// purchase) adds the medium and hard computer and the international 10×10 board.
export const meta = Object.freeze({
  id: 'dammen',
  titleKey: 'games.dammen',
  group: 'board', // the section on the home screen (GROUPS in js/games.js)
  freeLevels: Object.freeze([1]),
  freeVariants: Object.freeze(['small']),
  /** Is this game setup behind the full version? `setup`: { variant, mode: 'duo'|'cpu', level }. */
  isLocked(setup, owned) {
    if (owned) return false;
    if (!this.freeVariants.includes(setup.variant)) return true;
    return setup.mode === 'cpu' && !this.freeLevels.includes(setup.level);
  },
});
