// What the shell needs to know about Klok kijken, without loading the game.
// Free: every round of the two youngest tiers (whole and half hours), the daily rhythm and the
// first digital tier (whole and half hours again, on a digital clock). Quarters, minutes, the
// 24-hour clock (analogue and digital) and random practice are part of the full version (the one
// app-wide purchase).
export const meta = Object.freeze({
  id: 'klok',
  titleKey: 'games.klok',
  group: 'learning', // the section on the home screen (GROUPS in js/games.js)
  freeTiers: Object.freeze(['t1', 't2']),
  freeDigTiers: Object.freeze(['t1']),
  /** Is this round (`{ mode, tier }`) behind the full version? */
  isLocked(round, owned) {
    if (owned) return false;
    if (round.mode === 'day') return false;
    if (round.mode === 'dig') return !this.freeDigTiers.includes(round.tier);
    return !this.freeTiers.includes(round.tier);
  },
});
