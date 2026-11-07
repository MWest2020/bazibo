// Offline play: precache the whole (small) game, then serve cache-first.
// VERSION is a hash of every file in ASSETS, written by `npm run stamp` (tools/stamp-sw.mjs).
// `npm test` fails when it does not match, so a release cannot leave players on an old build.
const VERSION = 'bubbels-f4c489596a';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/game.js',
  'js/grid.js',
  'js/bubble-art.js',
  'js/audio.js',
  'js/storage.js',
  'js/levels.js',
  'js/unlock.js',
  'levels/levels.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
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
