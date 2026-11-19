// What the shell needs to know about Schaken (chess), without loading the game.
// Free: two players on one screen, and the easy computer (with its hint button). The medium and
// hard computer are part of the full version (the one app-wide purchase), as in Dammen.
export const meta = Object.freeze({
  id: 'schaak',
  titleKey: 'games.schaak',
  group: 'board', // the section on the home screen (GROUPS in js/games.js)
  freeLevels: Object.freeze([1]),
  /** Is this game setup behind the full version? `setup`: { mode: 'duo'|'cpu', level }. */
  isLocked(setup, owned) {
    return !owned && setup.mode === 'cpu' && !this.freeLevels.includes(setup.level);
  },
});
