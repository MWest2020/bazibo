// What the shell needs to know about Tijgers en geitjes (Bagh-Chal), without loading the game.
// Free: two players on one screen, and the easy computer on either side (the child plays the
// goats or the tigers). The medium and hard computer are part of the full version (the one
// app-wide purchase), as in Dammen.
export const meta = Object.freeze({
  id: 'baghchal',
  titleKey: 'games.baghchal',
  group: 'board', // the section on the home screen (GROUPS in js/games.js)
  freeLevels: Object.freeze([1]),
  /** Is this game setup behind the full version? `setup`: { mode: 'duo'|'cpu', level, side: 'goats'|'tigers' }. */
  isLocked(setup, owned) {
    return !owned && setup.mode === 'cpu' && !this.freeLevels.includes(setup.level);
  },
});
