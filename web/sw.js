// Offline play: precache the whole (small) app with all its games, then serve cache-first.
// VERSION is a hash of every file in ASSETS, written by `npm run stamp` (tools/stamp-sw.mjs).
// `npm test` fails when it does not match, so a release cannot leave players on an old build.
const VERSION = 'bubbels-8803e8b3cb';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/brand.js',
  'js/i18n.js',
  'js/games.js',
  'js/bubble-art.js',
  'js/audio.js',
  'js/storage.js',
  'js/unlock.js',
  'js/billing-native.js',
  'js/parental-gate.js',
  'js/back.js',
  'games/bubbels/bubbels.css',
  'games/bubbels/bubbels.js',
  'games/bubbels/game.js',
  'games/bubbels/grid.js',
  'games/bubbels/levels.js',
  'games/bubbels/levels.json',
  'games/bubbels/meta.js',
  'games/bubbels/strings.js',
  'games/dogudoku/art.js',
  'games/dogudoku/dogudoku.css',
  'games/dogudoku/dogudoku.js',
  'games/dogudoku/meta.js',
  'games/dogudoku/puzzles.json',
  'games/dogudoku/rules.js',
  'games/dogudoku/strings.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'privacy/index.html',
  'privacy/en.html',
  'privacy/privacy.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
