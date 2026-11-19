// What the shell needs to know about Pachisi, without loading the game.
// Free: two players (a child against the easy computer, or two children on one screen), with 2 or
// 4 pawns. The full version (the one app-wide purchase) adds a 3rd and 4th player and the medium
// computer, as in Ganzenbord (players) and Tijgers en geitjes (levels).
export const meta = Object.freeze({
  id: 'pachisi',
  titleKey: 'games.pachisi',
  subKey: 'pachisi.subtitle', // a small line under the name on the tile
  group: 'board', // the section on the home screen (GROUPS in js/games.js)
  freePlayers: 2,
  freeLevels: Object.freeze([1]),
  /** Is this setup behind the full version? `setup`: { players: ['kid'|'cpu', ...], level }. */
  isLocked(setup, owned) {
    if (owned) return false;
    const players = setup.players || [];
    return players.length > this.freePlayers || (players.includes('cpu') && !this.freeLevels.includes(setup.level));
  },
});
