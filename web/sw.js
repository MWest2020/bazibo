// Offline play: precache the whole (small) app with all its games, then serve cache-first.
// VERSION is a hash of every file in ASSETS, written by `npm run stamp` (tools/stamp-sw.mjs).
// `npm test` fails when it does not match, so a release cannot leave players on an old build.
const VERSION = 'bubbels-8e0bc7be6f';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'fonts/bazibo-sans.woff2',
  'fonts/OFL.txt',
  'js/main.js',
  'js/brand.js',
  'js/logo.js',
  'js/i18n.js',
  'js/games.js',
  'js/home-grid.js',
  'js/bubble-art.js',
  'js/audio.js',
  'js/storage.js',
  'js/unlock.js',
  'js/billing-native.js',
  'js/parental-gate.js',
  'js/back.js',
  'js/random.js',
  'js/fold.js',
  'js/menu.js',
  'js/transfer.js',
  'js/transfer-ui.js',
  'js/seo.js',
  'js/unlock-code.js',
  'js/revoked.js',
  'js/app-csp.js',
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
  'games/memory/ai.js',
  'games/memory/art.js',
  'games/memory/memory.css',
  'games/memory/memory.js',
  'games/memory/meta.js',
  'games/memory/rules.js',
  'games/memory/strings.js',
  'games/legpuzzel/art.js',
  'games/legpuzzel/legpuzzel.css',
  'games/legpuzzel/legpuzzel.js',
  'games/legpuzzel/meta.js',
  'games/legpuzzel/pictures.js',
  'games/legpuzzel/rules.js',
  'games/legpuzzel/strings.js',
  'games/vier/ai.js',
  'games/vier/art.js',
  'games/vier/coop.js',
  'games/vier/coop-codec.js',
  'games/vier/coop-proto.js',
  'games/vier/meta.js',
  'games/vier/rules.js',
  'games/vier/strings.js',
  'games/vier/vier.css',
  'games/vier/vier.js',
  'games/dammen/ai.js',
  'games/dammen/ai-worker.js',
  'games/dammen/art.js',
  'games/dammen/dammen.css',
  'games/dammen/dammen.js',
  'games/dammen/meta.js',
  'games/dammen/rules.js',
  'games/dammen/strings.js',
  'games/dammen/think.js',
  'games/baghchal/ai.js',
  'games/baghchal/ai-worker.js',
  'games/baghchal/art.js',
  'games/baghchal/baghchal.css',
  'games/baghchal/baghchal.js',
  'games/baghchal/meta.js',
  'games/baghchal/rules.js',
  'games/baghchal/strings.js',
  'games/schaak/ai.js',
  'games/schaak/ai-worker.js',
  'games/schaak/art.js',
  'games/schaak/meta.js',
  'games/schaak/rules.js',
  'games/schaak/schaak.css',
  'games/schaak/schaak.js',
  'games/schaak/strings.js',
  'games/ganzen/art.js',
  'games/ganzen/board.js',
  'games/ganzen/ganzen.css',
  'games/ganzen/ganzen.js',
  'games/ganzen/meta.js',
  'games/ganzen/rules.js',
  'games/ganzen/scene.js',
  'games/ganzen/strings.js',
  'games/pachisi/ai.js',
  'games/pachisi/art.js',
  'games/pachisi/ludo-ai.js',
  'games/pachisi/ludo-art.js',
  'games/pachisi/ludo-rules.js',
  'games/pachisi/meta.js',
  'games/pachisi/modes.js',
  'games/pachisi/pachisi.css',
  'games/pachisi/pachisi.js',
  'games/pachisi/rules.js',
  'games/pachisi/strings.js',
  'games/kwartet/ai.js',
  'games/kwartet/art.js',
  'games/kwartet/kwartet.css',
  'games/kwartet/kwartet.js',
  'games/kwartet/meta.js',
  'games/kwartet/rules.js',
  'games/kwartet/strings.js',
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
  'games/verstop/art.js',
  'games/verstop/meta.js',
  'games/verstop/rules.js',
  'games/verstop/strings.js',
  'games/verstop/verstop.css',
  'games/verstop/verstop.js',
  'games/treintje/art.js',
  'games/treintje/generate.js',
  'games/treintje/meta.js',
  'games/treintje/rules.js',
  'games/treintje/strings.js',
  'games/treintje/treintje.css',
  'games/treintje/treintje.js',
  'games/kermis/art.js',
  'games/kermis/colours.js',
  'games/kermis/kermis.css',
  'games/kermis/kermis.js',
  'games/kermis/meta.js',
  'games/kermis/rules.js',
  'games/kermis/strings.js',
  'games/keuken/art.js',
  'games/keuken/dishes.js',
  'games/keuken/keuken.css',
  'games/keuken/keuken.js',
  'games/keuken/meta.js',
  'games/keuken/rules.js',
  'games/keuken/strings.js',
  'games/kangoeroe/art.js',
  'games/kangoeroe/hops.js',
  'games/kangoeroe/kangoeroe.css',
  'games/kangoeroe/kangoeroe.js',
  'games/kangoeroe/meta.js',
  'games/kangoeroe/strings.js',
  'games/winkel/art.js',
  'games/winkel/meta.js',
  'games/winkel/rules.js',
  'games/winkel/strings.js',
  'games/winkel/winkel.css',
  'games/winkel/winkel.js',
  'games/kaart/art.js',
  'games/kaart/kaart.css',
  'games/kaart/kaart.js',
  'games/kaart/map.js',
  'games/kaart/meta.js',
  'games/kaart/packs.js',
  'games/kaart/packs/continents.js',
  'games/kaart/packs/europe.js',
  'games/kaart/packs/nl.js',
  'games/kaart/packs/uk.js',
  'games/kaart/packs/us.js',
  'games/kaart/rounds.js',
  'games/kaart/strings.js',
  'games/doolhof/art.js',
  'games/doolhof/doolhof.css',
  'games/doolhof/doolhof.js',
  'games/doolhof/maze.js',
  'games/doolhof/meta.js',
  'games/doolhof/rules.js',
  'games/doolhof/strings.js',
  'games/piano/art.js',
  'games/piano/meta.js',
  'games/piano/piano.css',
  'games/piano/piano.js',
  'games/piano/songs.js',
  'games/piano/strings.js',
  'games/drums/art.js',
  'games/drums/drums.css',
  'games/drums/drums.js',
  'games/drums/kit.js',
  'games/drums/meta.js',
  'games/drums/sound.js',
  'games/drums/strings.js',
  'games/papegaai/art.js',
  'games/papegaai/capture-worklet.js',
  'games/papegaai/effects.js',
  'games/papegaai/meta.js',
  'games/papegaai/papegaai.css',
  'games/papegaai/papegaai.js',
  'games/papegaai/sound.js',
  'games/papegaai/strings.js',
  'manifest.webmanifest',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'img/share.png',
  'robots.txt',
  'sitemap.xml',
  'css/legal.css',
  'js/legal-redirect.js',
  'js/store-links.js',
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

// Every file is fetched past the browser's HTTP cache (`cache: 'reload'`): otherwise a new worker
// could fill its new cache with a stale copy that the HTTP cache still held from the old version.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// A page that answers within this long reloads itself at a calm moment (main.js); a visible one that
// does not (a build from before this worker, 27 Nov 2026) is reloaded by the worker, so it never keeps
// running old code. A hidden page is left alone (it may be a new build that is merely suspended).
// The fallback can go once the builds from before the handshake are gone.
const ANSWER_MS = 3000;

/** The address to reload: a #fragment would make it a same-document jump, not a reload, so it is
 *  dropped; the mail's `#unlock=<code>` travels as `?unlock=` (main.js takes either, and this worker
 *  serves the page from its cache, so it reaches no server log). */
function reloadUrl(href) {
  const url = new URL(href);
  if (!url.hash) return url.href;
  const code = new URLSearchParams(url.hash.slice(1)).get('unlock');
  url.hash = '';
  if (code) url.search = `${url.search ? `${url.search}&` : '?'}unlock=${encodeURIComponent(code)}`;
  return url.href.replace(/#$/, '');
}

function tellOrReload(client) {
  return new Promise((done) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      if (client.visibilityState === 'visible') {
        // not awaited: the reload's own fetch must not wait on this worker's event
        Promise.resolve()
          .then(() => client.navigate(reloadUrl(client.url)))
          .catch(() => {});
      }
      done();
    }, ANSWER_MS);
    channel.port1.onmessage = () => {
      clearTimeout(timer);
      channel.port1.close();
      done();
    };
    try {
      client.postMessage({ type: 'bazibo-updated', version: VERSION }, [channel.port2]);
    } catch {
      /* the timer reloads it */
    }
  });
}

// The pages are told after activation has finished, never inside it: until `activate` settles, the
// browser holds every fetch, so a reload started from within it would wait minutes for this worker.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const old = (await caches.keys()).filter((k) => k !== VERSION);
      await Promise.all(old.map((k) => caches.delete(k)));
      await self.clients.claim();
      if (!old.length) return; // the first install: the open page already runs this version
      setTimeout(() => {
        self.clients
          .matchAll({ type: 'window' })
          .then((pages) => Promise.all(pages.map(tellOrReload)))
          .catch(() => {});
      }, 0);
    })(),
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
