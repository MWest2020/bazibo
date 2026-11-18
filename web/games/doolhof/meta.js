// What the shell needs to know about Egeltje (the garden maze), without loading the game.
// Free: every round of the first tier in every kind (abc, word, count). The other tiers and random
// rounds are part of the full version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'doolhof',
  titleKey: 'games.doolhof',
  group: 'learning', // the section on the home screen (GROUPS in js/games.js)
  freeTiers: Object.freeze(['t1']),
  /** Is this round (`{ mode, tier }`) behind the full version? */
  isLocked(round, owned) {
    if (owned) return false;
    return !this.freeTiers.includes(round.tier);
  },
});
