// What the shell needs to know about Tekenen, without loading the game.
export const meta = Object.freeze({
  id: 'tekenen',
  titleKey: 'games.tekenen',
  group: 'creative', // the section on the home screen (GROUPS in js/games.js)
  free: 3, // drawing with every colour, brush and undo is free; 3 drawings are kept (FREE_DRAWINGS)
});
