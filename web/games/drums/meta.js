// What the shell needs to know about Drumstel, without loading the game.
// Free: playing freely on every pad, and the first rhythm of each level (the rock beat for 4-6 and
// for 7-10), with its listen button. The other rhythms come with the full version (the one
// app-wide purchase).
export const meta = Object.freeze({
  id: 'drums',
  titleKey: 'games.drums',
  group: 'creative', // the section on the home screen (GROUPS in js/games.js)
  freeRhythms: Object.freeze(['rock1', 'rock2']),
  /** Is this rhythm behind the full version? Free play is never locked. */
  isLocked(rhythmId, owned) {
    if (owned) return false;
    return !this.freeRhythms.includes(rhythmId);
  },
});
