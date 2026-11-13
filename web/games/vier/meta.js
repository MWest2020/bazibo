// What the shell needs to know about Vier op een rij, without loading the game.
// Free: two players on both boards, and the easy and medium computer. The hard computer is part
// of the full version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'vier',
  titleKey: 'games.vier',
  group: 'board', // the section on the home screen (GROUPS in js/games.js)
  freeLevels: Object.freeze([1, 2]),
  /** Is this game setup behind the full version? `setup`: { mode: 'duo'|'cpu', level }. */
  isLocked(setup, owned) {
    return !owned && setup.mode === 'cpu' && !this.freeLevels.includes(setup.level);
  },
});
