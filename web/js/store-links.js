// The store links on bazibo.nl ("Download in Google Play", "App Store: coming soon"). They are for
// parents on the website only: inside the Android or iOS app a child must never get a link to a
// store. So every element marked `data-store-links` ships `hidden` and is only shown when this
// script runs on the website. In the app (Capacitor's bridge, or the app's own address
// https://localhost on Android and capacitor://localhost on iOS) it stays hidden, and with
// scripts off it stays hidden too.
// Used as a module by the home screen (main.js) and by the parents' pages (Plannen, Roadmap).

export const PLAY_URL = 'https://play.google.com/store/apps/details?id=work.westerweel.bazibo';

/** True inside the Android or iOS app (pure: pass a stand-in window in the tests). */
export function inApp(win) {
  if (!win) return false;
  if (win.Capacitor?.isNativePlatform?.()) return true;
  const loc = win.location || {};
  if (loc.protocol === 'capacitor:') return true;
  return loc.protocol === 'https:' && loc.hostname === 'localhost';
}

/** Shows the store links on the website; leaves them hidden in the app. Returns whether shown. */
export function showStoreLinks(doc, win) {
  if (!doc || inApp(win)) return false;
  for (const el of doc.querySelectorAll('[data-store-links]')) el.hidden = false;
  return true;
}

if (globalThis.document && globalThis.window) showStoreLinks(document, window);
