// The Android back button (Capacitor App plugin's `backButton` event). Pure decision, so it can be
// tested: what one press does, given where the child is.
//   a card being busy with the store   -> nothing (the purchase is in flight)
//   a card on the game screen          -> back to the level list (leaves the level)
//   a card on the Slangetje board      -> its menu (the pause card, the end card, the how-to card)
//   any other card or the parental gate -> close it
//   playing a level                    -> pause it (a second press then leaves the level)
//   a Dogudoku or Picturedoku puzzle   -> its puzzle list (the board is kept for this session)
//   a Vier op een rij game             -> its menu (the game is kept: "keep playing")
//   a Dammen game                      -> its menu (the game is kept: "keep playing")
//   a Ganzenbord game                  -> its menu (the game is kept: "keep playing")
//   a Slangetje round                  -> its menu (the round is kept: "keep playing")
//   a colouring page                   -> the list of pages (the page is saved)
//   a drawing                          -> an open row of stamps or mirror choices closes; else
//                                         "my drawings" (the drawing is saved, or a card asks first)
//   a Klok kijken round (or its card)  -> its menu (the round is kept: "keep playing")
//   the Klok kijken menu               -> from one kind of round to the kinds, then home
//   a Letters round (or its card)      -> its menu (the round is kept: "keep playing")
//   the Letters menu                   -> from one kind of round to the kinds, then home
//   Voortgang overzetten               -> the settings (a card there: cancel, or reload after "Klaar")
//   a level or puzzle list, settings   -> the home screen
//   the home screen                    -> leave the app
export function backAction({ screen, overlay = 'none' }) {
  if (overlay === 'busy') return 'ignore';
  if (overlay === 'card') return screen === 'game' ? 'levels' : screen === 'slang' ? 'slang-menu' : screen === 'klok' ? 'klok-menu' : screen === 'letters' ? 'letters-menu' : screen === 'transfer' ? 'transfer-card' : 'close';
  if (screen === 'game') return 'pause';
  if (screen === 'dogudoku') return 'dogudoku-levels';
  if (screen === 'picturedoku') return 'picturedoku-levels';
  if (screen === 'vier') return 'vier-menu';
  if (screen === 'dammen') return 'dammen-menu';
  if (screen === 'ganzen') return 'ganzen-menu';
  if (screen === 'slang') return 'slang-menu';
  if (screen === 'kleuren') return 'kleuren-list';
  if (screen === 'tekenen') return 'tekenen-list';
  if (screen === 'klok') return 'klok-menu';
  if (screen === 'klok-menu') return 'klok-menu-back';
  if (screen === 'letters') return 'letters-menu';
  if (screen === 'letters-menu') return 'letters-menu-back';
  if (screen === 'transfer') return 'settings';
  if (screen === 'home') return 'exit';
  return 'home';
}
