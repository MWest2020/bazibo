// What the shell needs to know about Ganzenbord, without loading the game.
// Free: the classic board with 2 players (a child against a computer goose, or two children). The
// full version (the one app-wide purchase) adds up to 4 players and the winter and sea boards.
export const meta = Object.freeze({
  id: 'ganzen',
  titleKey: 'games.ganzen',
  freeBoards: Object.freeze(['classic']),
  freePlayers: 2,
  /** Is this game setup behind the full version? `setup`: { board, players: ['kid'|'cpu', ...] }. */
  isLocked(setup, owned) {
    if (owned) return false;
    return !this.freeBoards.includes(setup.board) || (setup.players?.length || 0) > this.freePlayers;
  },
});
