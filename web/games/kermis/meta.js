// What the shell needs to know about Kleurenkermis (Colour Fair), without loading the game.
// Free: every round for ages 3-5 in Rustig (calm), alone or together. Ages 6-7 and 8-10, random
// rounds and the race are part of the full version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'kermis',
  titleKey: 'games.kermis',
  group: 'learning', // the section on the home screen (GROUPS in js/games.js)
  freeTiers: Object.freeze(['t1']),
  freeModes: Object.freeze(['calm']),
  /** Is this round (`{ tier, mode }`) behind the full version? */
  isLocked(round, owned) {
    if (owned) return false;
    return !this.freeTiers.includes(round.tier) || !this.freeModes.includes(round.mode || 'calm');
  },
});
