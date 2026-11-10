// What the shell needs to know about Letters, without loading the game.
// Free: every round of the first tier in all three kinds. The other tiers and random practice are
// part of the full version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'letters',
  titleKey: 'games.letters',
  freeTiers: Object.freeze(['t1']),
  /** Is this round (`{ mode, tier }`) behind the full version? */
  isLocked(round, owned) {
    if (owned) return false;
    return !this.freeTiers.includes(round.tier);
  },
});
