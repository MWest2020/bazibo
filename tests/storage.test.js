import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../web/js/storage.js';

// a tiny localStorage stand-in, as the browser and the app's WebView have it
function fakeLocalStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

// Capacitor Preferences as the plugin exposes it: async get({key}) -> {value}, set({key, value})
function fakePreferences(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    get: async ({ key }) => ({ value: m.has(key) ? m.get(key) : null }),
    set: async ({ key, value }) => void m.set(key, value),
    dump: () => Object.fromEntries(m),
  };
}

const LEGACY = {
  'bubbels.v1': JSON.stringify({ stars: { 1: 3, 2: 2, 10: 1 }, muted: true }),
  'bubbels.full.v1': '1',
};

test('migrate: the single-game format becomes a version-1 save', () => {
  const legacy = store.readLegacy(fakeLocalStorage(LEGACY));
  const { save, write, note } = store.migrate(null, legacy, '2026-11-07T00:00:00Z');
  assert.equal(note, 'migrated');
  assert.equal(write, true);
  assert.deepEqual(save, {
    version: 1,
    games: { bubbels: { stars: { 1: 3, 2: 2, 10: 1 } } },
    settings: { muted: true, lang: null },
    purchase: { owned: true },
    migrated: { from: 'localStorage', at: '2026-11-07T00:00:00Z' },
  });
});

test('migrate: the first shell format (separate settings key) keeps the language too', () => {
  const legacy = store.readLegacy(
    fakeLocalStorage({ 'bubbels.v1': JSON.stringify({ stars: { 1: 1 } }), 'bubbels.settings.v1': JSON.stringify({ muted: false, lang: 'en' }) }),
  );
  const { save } = store.migrate(null, legacy);
  assert.deepEqual(save.settings, { muted: false, lang: 'en' });
  assert.equal(save.purchase.owned, false);
});

test('migrate: nothing stored means a fresh save, nothing written yet', () => {
  const { save, write, note } = store.migrate(null, null);
  assert.equal(note, 'new');
  assert.equal(write, false);
  assert.deepEqual(save, store.emptySave());
});

test('migrate: a save from a newer version is kept, with the parts it does not know', () => {
  const future = { version: 7, games: { bubbels: { stars: { 3: 2 } }, sudoku: { solved: [1, 2] } }, settings: { muted: true, lang: 'en', theme: 'dark' }, cloud: { x: 1 } };
  const { save, write, note } = store.migrate(JSON.stringify(future));
  assert.equal(note, 'newer');
  assert.equal(write, false);
  assert.equal(save.version, 7);
  assert.deepEqual(save.games.sudoku, { solved: [1, 2] });
  assert.deepEqual(save.cloud, { x: 1 });
  assert.equal(save.settings.theme, 'dark');
});

test('migrate: corrupt values fall back without throwing', () => {
  for (const raw of ['{not json', '42', '"text"', 'null', '[]', JSON.stringify({ version: 'x' }), JSON.stringify({ version: 0 })]) {
    const r = store.migrate(raw, null);
    assert.equal(r.note, 'corrupt', raw);
    assert.deepEqual(r.save, store.emptySave(), raw);
  }
  // a document with broken sections is repaired, not dropped
  const r = store.migrate(JSON.stringify({ version: 1, games: { bubbels: { stars: 'x' } }, settings: [], purchase: { owned: 'yes' } }));
  assert.equal(r.note, 'ok');
  assert.deepEqual(r.save.games.bubbels.stars, {});
  assert.deepEqual(r.save.settings, { muted: false, lang: null });
  assert.equal(r.save.purchase.owned, false); // only a real `true` counts
});

test('app: the first start copies the WebView data into Preferences once and keeps the old copy', async () => {
  const ls = fakeLocalStorage(LEGACY);
  const prefs = fakePreferences();
  assert.equal(await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: ls, now: 'T1' }), 'migrated');
  assert.deepEqual(store.loadProgress('bubbels').stars, { 1: 3, 2: 2, 10: 1 });
  assert.equal(store.loadSettings().muted, true);
  assert.equal(store.fullCache.get(), true);
  const saved = JSON.parse(prefs.dump()[store.SAVE_KEY]);
  assert.equal(saved.version, 1);
  assert.deepEqual(saved.migrated, { from: 'localStorage', at: 'T1' });
  assert.deepEqual(ls.dump(), LEGACY); // the old keys stay

  // later starts read Preferences only, even if the WebView storage was cleared or changed
  const cleared = fakeLocalStorage({ 'bubbels.v1': JSON.stringify({ stars: { 1: 1 } }) });
  assert.equal(await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: cleared }), 'ok');
  assert.deepEqual(store.loadProgress('bubbels').stars, { 1: 3, 2: 2, 10: 1 });
  assert.equal(store.fullCache.get(), true);
});

test('saves reach the backend; each game has its own section; settings keep the language', async () => {
  const prefs = fakePreferences();
  await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: fakeLocalStorage() });
  store.saveProgress('bubbels', { stars: { 1: 2 } });
  store.saveProgress('sudoku', { stars: { 4: 1 } });
  store.saveSettings({ muted: false, lang: 'en' });
  store.fullCache.set(true);
  await store.flushed();
  const saved = JSON.parse(prefs.dump()[store.SAVE_KEY]);
  assert.deepEqual(saved.games, { bubbels: { stars: { 1: 2 } }, sudoku: { stars: { 4: 1 } } });
  assert.deepEqual(saved.settings, { muted: false, lang: 'en' });
  assert.equal(saved.purchase.owned, true);
  store.fullCache.set(false); // a refund: the store said "not owned"
  await store.flushed();
  assert.equal(JSON.parse(prefs.dump()[store.SAVE_KEY]).purchase.owned, false);
});

test('a newer save is not wiped when this version writes to it', async () => {
  const future = { version: 9, games: { bubbels: { stars: { 1: 1 } }, letters: { done: 4 } }, extra: true };
  const prefs = fakePreferences({ [store.SAVE_KEY]: JSON.stringify(future) });
  assert.equal(await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: fakeLocalStorage(LEGACY) }), 'newer');
  store.saveProgress('bubbels', { stars: { 1: 3 } });
  await store.flushed();
  const saved = JSON.parse(prefs.dump()[store.SAVE_KEY]);
  assert.equal(saved.version, 9);
  assert.equal(saved.extra, true);
  assert.deepEqual(saved.games.letters, { done: 4 });
  assert.deepEqual(saved.games.bubbels.stars, { 1: 3 });
});

test('a corrupt save is kept aside, the old keys are used if there are any', async () => {
  const ls = fakeLocalStorage({ [store.SAVE_KEY]: '{broken', ...LEGACY });
  assert.equal(await store.init({ backend: store.localStorageBackend(ls), legacyStorage: ls }), 'corrupt-legacy');
  assert.deepEqual(store.loadProgress('bubbels').stars, { 1: 3, 2: 2, 10: 1 });
  assert.equal(ls.dump()[`${store.SAVE_KEY}.corrupt`], '{broken');
  assert.equal(JSON.parse(ls.dump()[store.SAVE_KEY]).version, 1);
});

test('web: blocked or throwing storage never breaks the game', async () => {
  const blocked = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(await store.init({ backend: store.localStorageBackend(blocked), legacyStorage: blocked }), 'new');
  store.saveProgress('bubbels', { stars: { 1: 1 } });
  store.saveSettings({ muted: true });
  await store.flushed();
  assert.deepEqual(store.loadProgress('bubbels').stars, { 1: 1 }); // kept in memory for the session

  const failing = { name: 'x', get: async () => Promise.reject(new Error('io')), set: async () => Promise.reject(new Error('io')) };
  assert.equal(await store.init({ backend: failing, legacyStorage: null }), 'new');
  store.saveProgress('bubbels', { stars: {} });
  await store.flushed();
});
