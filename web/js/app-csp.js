// The app's own Content-Security-Policy. index.html allows one address outside the origin for the
// website (connect-src https://api.westerweel.work/bazibo/activate: the one activation call of a web unlock code,
// unlock-code.js). The Android and iOS apps ship the same index.html, so here, as the first script
// of the page and before any other runs, the app adds a second policy with connect-src 'self'.
// Two policies are both enforced, so in the app nothing outside the origin can be fetched at all.
// A classic script (not a module) so it runs at once, while the head is parsed. The test of "is
// this the app" is store-links.js `inApp`, repeated here (tests/unlock-code.test.js keeps them equal).
(function (win, doc) {
  var loc = win.location || {};
  var app = !!(win.Capacitor && win.Capacitor.isNativePlatform && win.Capacitor.isNativePlatform()) ||
    loc.protocol === 'capacitor:' || (loc.protocol === 'https:' && loc.hostname === 'localhost');
  if (!app || !doc || !doc.head) return;
  var meta = doc.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = "connect-src 'self'";
  meta.setAttribute('data-app-csp', '');
  doc.head.appendChild(meta);
})(window, document);
