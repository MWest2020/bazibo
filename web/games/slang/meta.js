// What the shell needs to know about Slangetje, without loading the game.
export const meta = Object.freeze({
  id: 'slang',
  titleKey: 'games.slang',
  group: 'action', // the section on the home screen (GROUPS in js/games.js)
  free: 10, // 10 of the 30 levels are free, some of every kind (`free: true` in levels.json)
});
