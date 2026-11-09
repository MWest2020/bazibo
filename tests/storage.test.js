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
  assert.equal(await store.init({ backend: failing, legacyStorage: null, retryDelayMs: 0 }), 'read-failed');
  store.saveProgress('bubbels', { stars: {} });
  await store.flushed();
});

// Review of PR #3, finding 1: a failed read must never be taken for "nothing stored".
test('app: a Preferences read that fails never overwrites the real save', async () => {
  const real = JSON.stringify({ version: 1, games: { bubbels: { stars: { 1: 3, 20: 2 } } }, settings: {}, purchase: { owned: true } });
  const prefs = fakePreferences({ [store.SAVE_KEY]: real });
  let sets = 0;
  const flaky = {
    name: 'flaky',
    get: async () => Promise.reject(new Error('bridge')),
    set: async (k, v) => {
      sets++;
      await prefs.set({ key: k, value: v });
    },
  };
  assert.equal(await store.init({ backend: flaky, legacyStorage: fakeLocalStorage(LEGACY), retryDelayMs: 0 }), 'read-failed');
  store.saveProgress('bubbels', { stars: { 1: 1 } });
  store.saveSettings({ muted: false, lang: 'en' });
  store.fullCache.set(false);
  await store.flushed();
  assert.equal(sets, 0);
  assert.equal(prefs.dump()[store.SAVE_KEY], real); // untouched
});

test('app: a read that fails once and then works loads the save normally', async () => {
  const real = JSON.stringify({ version: 1, games: { bubbels: { stars: { 5: 3 } } }, settings: {}, purchase: { owned: true } });
  const prefs = fakePreferences({ [store.SAVE_KEY]: real });
  let calls = 0;
  const backend = store.preferencesBackend({
    get: async (a) => (++calls === 1 ? Promise.reject(new Error('cold start')) : prefs.get(a)),
    set: prefs.set,
  });
  assert.equal(await store.init({ backend, legacyStorage: fakeLocalStorage(LEGACY), retryDelayMs: 0 }), 'ok');
  assert.deepEqual(store.loadProgress('bubbels').stars, { 5: 3 });
  assert.equal(store.fullCache.get(), true);
});

// Finding 2: nothing is written while init() is still reading.
test('app: changes made before init() finished are never written', async () => {
  const real = JSON.stringify({ version: 1, games: { bubbels: { stars: { 1: 3 } } }, settings: {}, purchase: { owned: true } });
  const prefs = fakePreferences({ [store.SAVE_KEY]: real });
  let release;
  const gate = new Promise((r) => (release = r));
  const slow = store.preferencesBackend({ get: async (a) => (await gate, prefs.get(a)), set: prefs.set });
  const done = store.init({ backend: slow, legacyStorage: null });
  store.saveSettings({ muted: true, lang: 'en' }); // a tap during the read
  await store.flushed();
  assert.equal(prefs.dump()[store.SAVE_KEY], real);
  release();
  assert.equal(await done, 'ok');
  assert.deepEqual(store.loadProgress('bubbels').stars, { 1: 3 });
});

// Finding 5: a failed write is retried with the latest save.
test('app: a failed write warns and the latest save is written on the next chance', async () => {
  const prefs = fakePreferences();
  let failNext = false;
  const backend = store.preferencesBackend({
    get: prefs.get,
    set: async (a) => {
      if (failNext) {
        failNext = false;
        throw new Error('disk full');
      }
      return prefs.set(a);
    },
  });
  await store.init({ backend, legacyStorage: null });
  const warn = console.warn;
  const warnings = [];
  console.warn = (...a) => warnings.push(a.join(' '));
  try {
    failNext = true;
    store.saveProgress('bubbels', { stars: { 1: 2 } });
    await store.flushed();
    assert.equal(warnings.length, 1);
    store.retryFailedWrite(); // what visibilitychange does
    await store.flushed();
    assert.deepEqual(JSON.parse(prefs.dump()[store.SAVE_KEY]).games.bubbels.stars, { 1: 2 });
  } finally {
    console.warn = warn;
  }
});

// Review of PR #4, I3: a read that failed at startup is tried again; a good read merges the session in.
test('app: after a failed startup read, a later good read merges the session and starts saving', async () => {
  const real = JSON.stringify({ version: 1, games: { bubbels: { stars: { 1: 3, 2: 1, 20: 2 } }, other: { x: 1 } }, settings: { muted: true, lang: 'nl' }, purchase: { owned: true }, extra: 'kept' });
  const prefs = fakePreferences({ [store.SAVE_KEY]: real });
  let broken = true;
  const backend = store.preferencesBackend({ get: async (a) => (broken ? Promise.reject(new Error('bridge')) : prefs.get(a)), set: prefs.set });
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await store.init({ backend, legacyStorage: null, retryDelayMs: 0 }), 'read-failed');
    store.saveProgress('bubbels', { stars: { 1: 1, 2: 3, 3: 2 } }); // played in memory
    await store.adopted();
    assert.equal(prefs.dump()[store.SAVE_KEY], real); // still failing: nothing written
    broken = false;
    store.retryFailedWrite(); // what visibilitychange does
    assert.equal(await store.adopted(), true);
    await store.flushed();
    const saved = JSON.parse(prefs.dump()[store.SAVE_KEY]);
    assert.deepEqual(saved.games.bubbels.stars, { 1: 3, 2: 3, 3: 2, 20: 2 }); // best per level
    assert.deepEqual(saved.games.other, { x: 1 });
    assert.equal(saved.purchase.owned, true);
    assert.deepEqual(saved.settings, { muted: true, lang: 'nl' }); // not touched in the session
    assert.equal(saved.extra, 'kept');
  } finally {
    console.warn = warn;
  }
});

test('mergeSaves: settings from the session only when the child changed them; owned is OR-ed', () => {
  const stored = { version: 1, games: {}, settings: { muted: false, lang: 'nl' }, purchase: { owned: false } };
  const session = { games: { bubbels: { stars: { 4: 2 } } }, settings: { muted: true, lang: 'en' }, purchase: { owned: true } };
  assert.deepEqual(store.mergeSaves(stored, session, false).settings, { muted: false, lang: 'nl' });
  assert.deepEqual(store.mergeSaves(stored, session, true).settings, { muted: true, lang: 'en' });
  assert.equal(store.mergeSaves(stored, session, false).purchase.owned, true);
  assert.deepEqual(store.mergeSaves(stored, session, false).games.bubbels.stars, { 4: 2 });
});

// M2: a broken save whose copy cannot be kept is not overwritten.
test('app: a corrupt save is not overwritten when its backup copy cannot be written', async () => {
  const prefs = fakePreferences({ [store.SAVE_KEY]: '{not json' });
  const backend = store.preferencesBackend({
    get: prefs.get,
    set: async (a) => (a.key.endsWith('.corrupt') ? Promise.reject(new Error('disk full')) : prefs.set(a)),
  });
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await store.init({ backend, legacyStorage: null }), 'read-failed');
    store.saveProgress('bubbels', { stars: { 1: 1 } });
    await store.adopted();
    await store.flushed();
    assert.equal(prefs.dump()[store.SAVE_KEY], '{not json');
  } finally {
    console.warn = warn;
  }
});

// M3: a read that never answers counts as failed, not as "nothing stored".
test('app: a hanging read times out and nothing is written', async () => {
  const prefs = fakePreferences({ [store.SAVE_KEY]: JSON.stringify({ version: 1, games: {}, settings: {}, purchase: { owned: true } }) });
  let sets = 0;
  const backend = { name: 'hang', get: () => new Promise(() => {}), set: async () => void sets++ };
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await store.init({ backend, legacyStorage: null, tries: 2, retryDelayMs: 0, timeoutMs: 20 }), 'read-failed');
    store.saveSettings({ muted: true });
    await store.flushed();
    assert.equal(sets, 0);
  } finally {
    console.warn = warn;
  }
});

// Review of PR #5: after a failed read that a later read merges in, the games' own copy of their
// stars is older than the save; saving it must never lower or drop stars.
for (const game of ['bubbels', 'dogudoku', 'picturedoku']) {
  test(`stars survive a failed read, the merge, and two later wins (${game})`, async () => {
    let value = JSON.stringify({ version: 1, games: { [game]: { stars: { 1: 3, 2: 3, 3: 3 } } }, settings: {}, purchase: { owned: false } });
    let fails = 3;
    const b = {
      name: 'flaky',
      get: async () => {
        if (fails-- > 0) throw new Error('not yet');
        return value;
      },
      set: async (k, v) => void (value = v),
    };
    assert.equal(await store.init({ backend: b, legacyStorage: null, retryDelayMs: 0 }), 'read-failed');
    const copy = store.loadProgress(game); // what the game holds: nothing, the read failed
    copy.stars[4] = 2;
    store.saveProgress(game, copy); // win 1: triggers the read again and the merge
    await store.adopted();
    await store.flushed();
    assert.deepEqual(JSON.parse(value).games[game].stars, { 1: 3, 2: 3, 3: 3, 4: 2 });
    copy.stars[5] = 1; // win 2 from the same, now stale, copy
    store.saveProgress(game, copy);
    store.recordStars(game, 2, 1); // and a worse replay never lowers a level
    await store.flushed();
    assert.deepEqual(JSON.parse(value).games[game].stars, { 1: 3, 2: 3, 3: 3, 4: 2, 5: 1 });
    assert.deepEqual(store.loadProgress(game).stars, { 1: 3, 2: 3, 3: 3, 4: 2, 5: 1 });
  });
}

test('random play: solved counts go up per game and tier, are saved, and are not options', async () => {
  const prefs = fakePreferences();
  await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: fakeLocalStorage() });
  assert.deepEqual(store.loadRandomSolved('dogudoku'), {});
  assert.equal(store.recordRandomSolved('dogudoku', 's8'), 1);
  assert.equal(store.recordRandomSolved('dogudoku', 's8'), 2);
  store.recordRandomSolved('slang', 'count-big');
  store.saveProgress('dogudoku', { stars: { 3: 2 } }); // stars and counts live side by side
  await store.flushed();
  const saved = JSON.parse(prefs.dump()[store.SAVE_KEY]);
  assert.deepEqual(saved.games.dogudoku, { random: { s8: 2 }, stars: { 3: 2 } });
  assert.deepEqual(saved.games.slang, { random: { 'count-big': 1 } });
  assert.equal(store.loadGameOption('dogudoku', 'random', 'none'), 'none');
  assert.throws(() => store.saveGameOption('dogudoku', 'random', {}), /recordRandomSolved/);
});

test('mergeSaves: random counts keep the higher number per tier', () => {
  const stored = { version: 1, games: { dogudoku: { random: { s4: 5, s8: 1 } } }, settings: {}, purchase: { owned: true } };
  const session = { games: { dogudoku: { random: { s8: 3, s6: 1 } } }, settings: {}, purchase: { owned: false } };
  assert.deepEqual(store.mergeSaves(stored, session, false).games.dogudoku.random, { s4: 5, s8: 3, s6: 1 });
});
