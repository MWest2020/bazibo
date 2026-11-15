// What the shell needs to know about Kwartet, without loading the game.
// Free: 4 sets with up to 3 players (the child and two more, computer or children). The full
// version (the one app-wide purchase) adds a 4th player and games with 6 and 8 sets.
export const meta = Object.freeze({
  id: 'kwartet',
  titleKey: 'games.kwartet',
  group: 'board', // the section on the home screen (GROUPS in js/games.js)
  freeSets: 4,
  freePlayers: 3,
  /** Is this game setup behind the full version? `setup`: { sets: 4|6|8, players: ['kid'|'cpu', ...] }. */
  isLocked(setup, owned) {
    if (owned) return false;
    return setup.sets > this.freeSets || (setup.players?.length || 0) > this.freePlayers;
  },
});
