// The Android back button (Capacitor App plugin's `backButton` event). Pure decision, so it can be
// tested: what one press does, given where the child is.
//   a card being busy with the store   -> nothing (the purchase is in flight)
//   a card on the game screen          -> back to the level list (leaves the level)
//   any other card or the parental gate -> close it
//   playing a level                    -> pause it (a second press then leaves the level)
//   the level list or the settings     -> the home screen
//   the home screen                    -> leave the app
export function backAction({ screen, overlay = 'none' }) {
  if (overlay === 'busy') return 'ignore';
  if (overlay === 'card') return screen === 'game' ? 'levels' : 'close';
  if (screen === 'game') return 'pause';
  if (screen === 'home') return 'exit';
  return 'home';
}
