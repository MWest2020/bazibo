import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assets, currentVersion, expectedVersion, webFiles } from '../tools/sw-version.mjs';

test('the service worker caches every file the game ships', () => {
  const listed = new Set(assets());
  for (const f of webFiles()) assert.ok(listed.has(f), `web/${f} is missing from ASSETS in web/sw.js`);
  assert.ok(listed.has('./'));
});

test('the cache name matches the content (run `npm run stamp` after changing web/)', () => {
  assert.equal(currentVersion(), expectedVersion());
});

// A new version must reach a returning visitor at once (27 Nov 2026: a browser that had visited
// bazibo.nl before kept the old cached build, without the code entry, until a second reload).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadWorker({ cacheNames = [] } = {}) {
  const listeners = {};
  const added = [];
  const deleted = [];
  const pages = [];
  const names = new Set(cacheNames);
  const self = {
    location: { origin: 'https://bazibo.test' },
    addEventListener: (type, fn) => (listeners[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => pages },
  };
  const caches = {
    open: async (name) => (names.add(name), { addAll: async (reqs) => added.push(...reqs), put: async () => {} }),
    keys: async () => [...names],
    delete: async (name) => (deleted.push(name), names.delete(name)),
    match: async () => undefined,
  };
  class Request {
    constructor(url, init = {}) {
      this.url = url;
      this.cache = init.cache;
    }
  }
  const ctx = { self, caches, Request, MessageChannel, setTimeout, clearTimeout, Promise, URL, URLSearchParams };
  vm.runInNewContext(readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8'), ctx);
  const fire = async (type) => {
    let wait = Promise.resolve();
    listeners[type]({ waitUntil: (p) => (wait = p) });
    await wait;
  };
  return { fire, added, deleted, pages, ctx };
}

function page(url, { answers, visible = true }) {
  const p = { url, navigated: [], messages: [], visibilityState: visible ? 'visible' : 'hidden' };
  p.navigate = async (u) => p.navigated.push(u);
  p.postMessage = (data, [port]) => {
    p.messages.push(data);
    if (answers) port.postMessage('later');
  };
  return p;
}

test('the worker fills its cache past the browser\'s HTTP cache', async () => {
  const w = loadWorker();
  await w.fire('install');
  assert.ok(w.added.length > 10);
  for (const r of w.added) assert.equal(r.cache, 'reload', `${r.url} may come from the HTTP cache`);
});

test('a first install reloads nothing; an update tells every page, and reloads the pages too old to answer', async () => {
  const first = loadWorker();
  const fresh = page('https://bazibo.test/', { answers: false });
  first.pages.push(fresh);
  await first.fire('activate');
  assert.deepEqual(fresh.messages, []);
  assert.deepEqual(fresh.navigated, []);

  const w = loadWorker({ cacheNames: ['bubbels-old'] });
  const current = page('https://bazibo.test/?x', { answers: true });
  const old = page('https://bazibo.test/#unlock=BZB1.x', { answers: false });
  const asleep = page('https://bazibo.test/', { answers: false, visible: false });
  const safari = page('https://bazibo.test/', { answers: false });
  safari.navigate = undefined; // no WindowClient.navigate: nothing breaks
  w.pages.push(current, old, asleep, safari);
  await w.fire('activate');
  assert.deepEqual(w.deleted, ['bubbels-old']);
  assert.deepEqual(old.messages, [], 'the pages are told after activation, not inside it');
  await new Promise((r) => setTimeout(r, 3300));
  assert.equal(current.messages[0]?.type, 'bazibo-updated');
  assert.deepEqual(current.navigated, [], 'a page that answers reloads itself, at a calm moment');
  assert.deepEqual(old.navigated, ['https://bazibo.test/?unlock=BZB1.x'], 'an old page is reloaded, its #unlock= as ?unlock=');
  assert.deepEqual(asleep.navigated, [], 'a hidden page is left alone');
});

test('the reload address never keeps a #fragment (that would not reload)', () => {
  const { ctx } = loadWorker();
  assert.equal(ctx.reloadUrl('https://bazibo.nl/'), 'https://bazibo.nl/');
  assert.equal(ctx.reloadUrl('https://bazibo.nl/#unlock=BZB1.a.b'), 'https://bazibo.nl/?unlock=BZB1.a.b');
  assert.equal(ctx.reloadUrl('https://x.github.io/bazibo/index.html?test#unlock=BZB1.c'), 'https://x.github.io/bazibo/index.html?test&unlock=BZB1.c');
  assert.equal(ctx.reloadUrl('https://bazibo.nl/#other'), 'https://bazibo.nl/');
});

test('main.js reloads after an update only at a calm moment, never while a code is checked', () => {
  const main = readFileSync(new URL('../web/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /e\.data\?\.type !== 'bazibo-updated'/);
  assert.match(main, /e\.ports\?\.\[0\]\?\.postMessage\('later'\)/);
  assert.match(main, /if \(!updateReady \|\| redeeming\) return;/);
  assert.match(main, /const calm = currentScreen\(\) === 'home' && \$\('#overlay'\)\.hidden;/);
  assert.doesNotMatch(main, /document\.hidden/, 'a hidden tab is no calm moment');
  // a code taken from the address holds the reload until it is being checked
  assert.match(main, /if \(holdForCode\) redeeming \+= 1;/);
  assert.match(main, /redeeming \+= 1; \/\/ gone from the address/);
  assert.match(main, /function hideOverlay\(\) \{\s*\$\('#overlay'\)\.hidden = true;\s*reloadIfUpdated\(\);/);
});
