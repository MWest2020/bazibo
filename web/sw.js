// Offline play: precache the whole (small) app with all its games, then serve cache-first.
// VERSION is a hash of every file in ASSETS, written by `npm run stamp` (tools/stamp-sw.mjs).
// `npm test` fails when it does not match, so a release cannot leave players on an old build.
const VERSION = 'bubbels-153b48bf19';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/brand.js',
  'js/logo.js',
  'js/i18n.js',
  'js/games.js',
  'js/bubble-art.js',
  'js/audio.js',
  'js/storage.js',
  'js/unlock.js',
  'js/billing-native.js',
  'js/parental-gate.js',
  'js/back.js',
  'js/random.js',
  'js/transfer.js',
  'js/transfer-ui.js',
  'vendor/README.md',
  'vendor/qrcode-generator/qrcode.min.js',
  'vendor/qrcode-generator/LICENSE',
  'vendor/jsqr/jsqr.min.js',
  'vendor/jsqr/LICENSE',
  'vendor/fflate/fflate.min.js',
  'vendor/fflate/LICENSE',
  'js/gen-worker.js',
  'games/bubbels/bubbels.css',
  'games/bubbels/bubbels.js',
  'games/bubbels/game.js',
  'games/bubbels/grid.js',
  'games/bubbels/levels.js',
  'games/bubbels/levels.json',
  'games/bubbels/meta.js',
  'games/bubbels/generate.js',
  'games/bubbels/strings.js',
  'games/dogudoku/art.js',
  'games/dogudoku/dogudoku.css',
  'games/dogudoku/dogudoku.js',
  'games/dogudoku/meta.js',
  'games/dogudoku/generate.js',
  'games/dogudoku/puzzles.json',
  'games/dogudoku/rules.js',
  'games/dogudoku/strings.js',
  'games/picturedoku/art.js',
  'games/picturedoku/input.js',
  'games/picturedoku/meta.js',
  'games/picturedoku/generate.js',
  'games/picturedoku/picturedoku.css',
  'games/picturedoku/picturedoku.js',
  'games/picturedoku/puzzles.json',
  'games/picturedoku/rules.js',
  'games/picturedoku/strings.js',
  'games/vier/ai.js',
  'games/vier/art.js',
  'games/vier/meta.js',
  'games/vier/rules.js',
  'games/vier/strings.js',
  'games/vier/vier.css',
  'games/vier/vier.js',
  'games/slang/art.js',
  'games/slang/levels.json',
  'games/slang/meta.js',
  'games/slang/generate.js',
  'games/slang/rules.js',
  'games/slang/slang.css',
  'games/slang/slang.js',
  'games/slang/strings.js',
  'games/kleuren/art.js',
  'games/kleuren/kleuren.css',
  'games/kleuren/kleuren.js',
  'games/kleuren/mandala.js',
  'games/kleuren/meta.js',
  'games/kleuren/pages.js',
  'games/kleuren/pictures.js',
  'games/kleuren/raster.js',
  'games/kleuren/strings.js',
  'games/kleuren/tile.js',
  'games/tekenen/drawing.js',
  'games/tekenen/meta.js',
  'games/tekenen/render.js',
  'games/tekenen/session.js',
  'games/tekenen/strings.js',
  'games/tekenen/symmetry.js',
  'games/tekenen/tekenen.css',
  'games/tekenen/tekenen.js',
  'games/tekenen/tile.js',
  'games/klok/art.js',
  'games/klok/klok.css',
  'games/klok/klok.js',
  'games/klok/meta.js',
  'games/klok/strings.js',
  'games/klok/time.js',
  'games/letters/art.js',
  'games/letters/letters.css',
  'games/letters/letters.js',
  'games/letters/meta.js',
  'games/letters/round.js',
  'games/letters/strings.js',
  'games/letters/words.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'css/legal.css',
  'js/legal-redirect.js',
  'nl/privacy/index.html',
  'en/privacy/index.html',
  'nl/voorwaarden/index.html',
  'en/terms/index.html',
  'privacy/index.html',
  'privacy/en.html',
  'terms/index.html',
  'voorwaarden/index.html',
  'nl/plannen/index.html',
  'en/roadmap/index.html',
  'plannen/index.html',
  'roadmap/index.html',
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
