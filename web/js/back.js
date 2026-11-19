// The Android back button (Capacitor App plugin's `backButton` event). Pure decision, so it can be
// tested: what one press does, given where the child is.
//   a card being busy with the store   -> nothing (the purchase is in flight)
//   a card on the game screen          -> back to the level list (leaves the level)
//   a card on the Slangetje board      -> its menu (the pause card, the end card, the how-to card)
//   any other card or the parental gate -> close it
//   playing a level                    -> pause it (a second press then leaves the level)
//   a Dogudoku or Picturedoku puzzle   -> its puzzle list (the board is kept for this session)
//   a Paartjes (Memory) game           -> its menu (the game is kept: "keep playing")
//   a jigsaw (Legpuzzel)               -> its menu (the puzzle is kept: "keep puzzling")
//   a Vier op een rij game             -> its menu (the game is kept: "keep playing")
//   a Dammen game                      -> its menu (the game is kept: "keep playing")
//   a Tijgers en geitjes game          -> its menu (the game is kept: "keep playing")
//   a Ganzenbord game                  -> its menu (the game is kept: "keep playing")
//   a Pachisi game                     -> its menu (the game is kept: "keep playing")
//   a Kwartet game (or its pass card)  -> its menu (the game is kept: "keep playing")
//   a Slangetje round                  -> its menu (the round is kept: "keep playing")
//   a colouring page                   -> the list of pages (the page is saved)
//   a drawing                          -> an open row of stamps or mirror choices closes; else
//                                         "my drawings" (the drawing is saved, or a card asks first)
//   a Klok kijken round (or its card)  -> its menu (the round is kept: "keep playing")
//   the Klok kijken menu               -> from one kind of round to the kinds, then home
//   a Letters round (or its card)      -> its menu (the round is kept: "keep playing")
//   the Letters menu                   -> from one kind of round to the kinds, then home
//   a Kangoeroe round (or its card)    -> its menu (the round is kept: "keep playing")
//   a Kaartpuzzel round (or its card)  -> its menu (the round is kept: "keep playing")
//   an Egeltje garden (or its card)    -> its menu (the round is kept: "keep playing")
//   the Egeltje menu                   -> from one kind of round to the kinds, then home
//   the piano                        -> a song goes to the song list, free play to the home screen
//   the piano's song list            -> free play (the piano)
//   the end card of a song           -> the song list
//   the drum kit                       -> a rhythm goes to the rhythm list, free play to the home screen
//   the drums' rhythm list             -> free play (the kit)
//   the end card of a rhythm           -> the rhythm list
//   Voortgang overzetten               -> the settings (a card there: cancel, or reload after "Klaar")
//   a level or puzzle list, settings   -> the home screen
//   the home screen                    -> leave the app
export function backAction({ screen, overlay = 'none' }) {
  if (overlay === 'busy') return 'ignore';
  if (overlay === 'card') return screen === 'game' ? 'levels' : screen === 'slang' ? 'slang-menu' : screen === 'kwartet' ? 'kwartet-menu' : screen === 'klok' ? 'klok-menu' : screen === 'letters' ? 'letters-menu' : screen === 'doolhof' ? 'doolhof-menu' : screen === 'kangoeroe' ? 'kangoeroe-menu' : screen === 'kaart' ? 'kaart-menu' : screen === 'piano' ? 'piano-songs' : screen === 'drums' ? 'drums-list' : screen === 'transfer' ? 'transfer-card' : 'close';
  if (screen === 'game') return 'pause';
  if (screen === 'dogudoku') return 'dogudoku-levels';
  if (screen === 'picturedoku') return 'picturedoku-levels';
  if (screen === 'memory') return 'memory-menu';
  if (screen === 'legpuzzel') return 'legpuzzel-menu';
  if (screen === 'vier') return 'vier-menu';
  if (screen === 'dammen') return 'dammen-menu';
  if (screen === 'baghchal') return 'baghchal-menu';
  if (screen === 'ganzen') return 'ganzen-menu';
  if (screen === 'pachisi') return 'pachisi-menu';
  if (screen === 'kwartet') return 'kwartet-menu';
  if (screen === 'slang') return 'slang-menu';
  if (screen === 'kleuren') return 'kleuren-list';
  if (screen === 'tekenen') return 'tekenen-list';
  if (screen === 'klok') return 'klok-menu';
  if (screen === 'klok-menu') return 'klok-menu-back';
  if (screen === 'letters') return 'letters-menu';
  if (screen === 'letters-menu') return 'letters-menu-back';
  if (screen === 'kangoeroe') return 'kangoeroe-menu';
  if (screen === 'kaart') return 'kaart-menu';
  if (screen === 'doolhof') return 'doolhof-menu';
  if (screen === 'doolhof-menu') return 'doolhof-menu-back';
  if (screen === 'piano') return 'piano-back';
  if (screen === 'piano-songs') return 'piano-songs-back';
  if (screen === 'drums') return 'drums-back';
  if (screen === 'drums-list') return 'drums-list-back';
  if (screen === 'transfer') return 'settings';
  if (screen === 'home') return 'exit';
  return 'home';
}
