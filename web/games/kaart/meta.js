// What the shell needs to know about Kaartpuzzel (Map Puzzle), without loading the game or a map.
// Free: the whole Continents pack (every tier), and tier 1 (the puzzle with the borders) of every
// other pack. "Waar ligt...?", the capitals and the maps without borders of Europe and the countries
// are part of the full version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'kaart',
  titleKey: 'games.kaart',
  group: 'learning', // the section on the home screen (GROUPS in js/games.js)
  freeTiers: Object.freeze(['t1']),
  freePacks: Object.freeze(['continents']),
  /** Is this round (`{ pack, tier }`) behind the full version? */
  isLocked(round, owned) {
    if (owned) return false;
    return !this.freePacks.includes(round.pack) && !this.freeTiers.includes(round.tier);
  },
});
