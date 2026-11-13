// What the shell needs to know about Bubbels, without loading the game.
export const meta = Object.freeze({
  id: 'bubbels',
  titleKey: 'bubbels.title',
  group: 'action', // the section on the home screen (GROUPS in js/games.js)
  free: 10, // levels 1-10 are free; the rest come with the full version
});
