// What the shell needs to know about Klok kijken, without loading the game.
// Free: every round of the two youngest tiers (whole and half hours) and the daily rhythm. The
// older tiers and random practice are part of the full version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'klok',
  titleKey: 'games.klok',
  freeTiers: Object.freeze(['t1', 't2']),
  /** Is this round (`{ mode, tier }`) behind the full version? */
  isLocked(round, owned) {
    if (owned) return false;
    return round.mode !== 'day' && !this.freeTiers.includes(round.tier);
  },
});
