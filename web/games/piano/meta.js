// What the shell needs to know about Piano, without loading the game.
// Free: playing freely on every key of both pianos (4-6 and 7-10), and playing along with the
// first song of each level (Vader Jacob; the whole Ode to Joy), with its listen button. The other
// songs come with the full version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'piano',
  titleKey: 'games.piano',
  group: 'creative', // the section on the home screen (GROUPS in js/games.js)
  freeSongs: Object.freeze(['jacob', 'ode']),
  /** Is this song behind the full version? Free play is never locked. */
  isLocked(songId, owned) {
    if (owned) return false;
    return !this.freeSongs.includes(songId);
  },
});
