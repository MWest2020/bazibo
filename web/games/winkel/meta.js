// What the shell needs to know about Winkeltje, without loading the game.
// Free: every round of the first tier (whole euros, ages 3-5). The other tiers and random
// practice are part of the full version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'winkel',
  titleKey: 'games.winkel',
  group: 'learning', // the section on the home screen (GROUPS in js/games.js)
  freeTiers: Object.freeze(['t1']),
  /** Is this round (`{ tier }`) behind the full version? */
  isLocked(round, owned) {
    if (owned) return false;
    return !this.freeTiers.includes(round.tier);
  },
});
