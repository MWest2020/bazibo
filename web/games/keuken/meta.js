// What the shell needs to know about Keukentje (Little Kitchen), without loading the game.
// Free: every round for ages 3-5 ("Wat hoort erbij?"). Ages 6-7 and 8-10 and random rounds are part
// of the full version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'keuken',
  titleKey: 'games.keuken',
  group: 'learning', // the section on the home screen (GROUPS in js/games.js)
  freeTiers: Object.freeze(['t1']),
  /** Is this round (`{ tier }`) behind the full version? */
  isLocked(round, owned) {
    if (owned) return false;
    return !this.freeTiers.includes(round.tier);
  },
});
