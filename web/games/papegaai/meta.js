// What the shell needs to know about Papegaai (Parrot), without loading the game.
// Free: recording, the parrot saying it back in the child's own voice, and two voices (the mouse
// and the bear). The other voices (backwards, echo, the choir, the balloon) come with the full
// version (the one app-wide purchase).
export const meta = Object.freeze({
  id: 'papegaai',
  titleKey: 'games.papegaai',
  group: 'creative', // the section on the home screen (GROUPS in js/games.js)
  freeVoices: Object.freeze(['gewoon', 'muis', 'beer']),
  /** Is this voice behind the full version? Recording and playing back are never locked. */
  isLocked(voiceId, owned) {
    if (owned) return false;
    return !this.freeVoices.includes(voiceId);
  },
});
