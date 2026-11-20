// What the shell needs to know about Verstoppertje (Hide and Seek), without loading the game.
// Free: every round of the first tier in the first scene (the garden). The other scenes (forest,
// beach, farm), tiers 2 and 3 and random rounds are part of the full version (the one app-wide
// purchase).
export const meta = Object.freeze({
  id: 'verstop',
  titleKey: 'games.verstop',
  group: 'puzzles', // the section on the home screen (GROUPS in js/games.js): a looking game, next to Paartjes
  freeScenes: Object.freeze(['garden']),
  freeTiers: Object.freeze(['t1']),
  /** Is this round (`{ scene, tier }`) behind the full version? */
  isLocked(round, owned) {
    if (owned) return false;
    return !this.freeScenes.includes(round.scene) || !this.freeTiers.includes(round.tier);
  },
});
