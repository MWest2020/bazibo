// Save data: everything is remembered only on this device, in one versioned document.
//
//   { version: 1,
//     games:    { bubbels: { stars: {1: 3, ...} }, <later games add their own section> },
//     settings: { muted: false, lang: 'nl' | 'en' | null },
//     purchase: { owned: false },          // last store answer, only a cache (see unlock.js)
//     migrated: { from, at } }             // set once, when older save data was copied in
//
// Where it lives:
//   - in the Android and iOS apps: Capacitor Preferences (SharedPreferences / UserDefaults). The
//     WebView's localStorage can be cleared by iOS when space runs low; Preferences is not, and
//     it is part of the phone's own backup (Android Auto Backup, iOS device backup).
//   - on the web: localStorage.
// Both under the key SAVE_KEY. call `await init()` once at startup; after that every read is
// synchronous from memory and every write is queued to the backend.
//
// Older save data (the single-game version and the first shell) used these localStorage keys:
//   bubbels.v1 {stars, muted}, bubbels.settings.v1 {muted, lang}, bubbels.full.v1 '1'.
// On the first start without a save document they are copied in once and left in place.

export const SAVE_KEY = 'bubbels.save';
export const VERSION = 1;
const LEGACY = { progress: 'bubbels.v1', settings: 'bubbels.settings.v1', full: 'bubbels.full.v1' };

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

export function emptySave() {
  return { version: VERSION, games: {}, settings: { muted: false, lang: null }, purchase: { owned: false } };
}

/** Read the old localStorage keys; null when there were none. Never throws. */
export function readLegacy(ls) {
  const get = (k) => {
    try {
      return ls?.getItem(k) ?? null;
    } catch {
      return null;
    }
  };
  const json = (k) => {
    try {
      const v = JSON.parse(get(k));
      return isObj(v) ? v : null;
    } catch {
      return null;
    }
  };
  const progress = json(LEGACY.progress);
  const settings = json(LEGACY.settings);
  const full = get(LEGACY.full) === '1';
  if (!progress && !settings && !full) return null;
  return {
    stars: isObj(progress?.stars) ? progress.stars : {},
    muted: typeof settings?.muted === 'boolean' ? settings.muted : !!progress?.muted,
    lang: typeof settings?.lang === 'string' ? settings.lang : null,
    full,
  };
}

/**
 * Turn whatever is stored into a usable save document. Pure, never throws.
 * raw: the stored text (or null); legacy: readLegacy() of the old keys (or null).
 * Returns { save, write, note }: `write` says the result should be stored, `note` says why.
 * A document from a newer version is kept as it is (only the parts this version knows are read
 * and later updated), so opening an older copy of the app never wipes a newer save.
 */
export function migrate(raw, legacy = null, now = '') {
  let doc = null;
  let corrupt = false;
  if (raw != null) {
    try {
      doc = JSON.parse(raw);
    } catch {
      corrupt = true;
    }
    if (!corrupt && (!isObj(doc) || !Number.isInteger(doc.version) || doc.version < 1)) corrupt = true;
  }
  if (doc && !corrupt) {
    const save = clone(doc);
    if (!isObj(save.games)) save.games = {};
    if (!isObj(save.settings)) save.settings = {};
    if (!isObj(save.purchase)) save.purchase = {};
    save.settings.muted = !!save.settings.muted;
    if (typeof save.settings.lang !== 'string') save.settings.lang = null;
    save.purchase.owned = save.purchase.owned === true;
    for (const [id, g] of Object.entries(save.games)) {
      if (!isObj(g)) save.games[id] = {};
      else if ('stars' in g && !isObj(g.stars)) g.stars = {};
    }
    return { save, write: false, note: doc.version > VERSION ? 'newer' : 'ok' };
  }
  const save = emptySave();
  if (legacy) {
    save.games.bubbels = { stars: clone(legacy.stars) };
    save.settings = { muted: !!legacy.muted, lang: legacy.lang || null };
    save.purchase = { owned: !!legacy.full };
    save.migrated = { from: 'localStorage', at: now };
    return { save, write: true, note: corrupt ? 'corrupt-legacy' : 'migrated' };
  }
  return { save, write: corrupt, note: corrupt ? 'corrupt' : 'new' };
}

// ---------- backends: { name, get(key) -> Promise<string|null>, set(key, text) -> Promise } ----------

export function localStorageBackend(ls = globalThis.window?.localStorage) {
  return {
    name: 'localStorage',
    async get(key) {
      try {
        return ls.getItem(key);
      } catch {
        return null;
      }
    },
    async set(key, text) {
      try {
        ls.setItem(key, text);
      } catch {
        /* not available: the save stays in memory for this session */
      }
    },
  };
}

/** Capacitor Preferences (the plugin object: get({key}) -> {value}, set({key, value})). */
export function preferencesBackend(prefs) {
  return {
    name: 'preferences',
    async get(key) {
      return (await prefs.get({ key }))?.value ?? null;
    },
    async set(key, text) {
      await prefs.set({ key, value: text });
    },
  };
}

function defaultBackend() {
  const cap = globalThis.window?.Capacitor;
  const native = !!cap?.isNativePlatform?.();
  const prefs = native && cap.Plugins?.Preferences;
  if (native && !prefs) console.warn('storage: Preferences plugin missing, falling back to localStorage');
  return prefs ? preferencesBackend(prefs) : localStorageBackend();
}

// ---------- the live save ----------

let save = emptySave();
let backend = null; // set only once a read has succeeded: until then nothing is ever written
let queue = Promise.resolve();
let writeFailed = false;

function persist() {
  if (!backend) return;
  const text = JSON.stringify(save); // always the whole, latest save
  const b = backend;
  queue = queue
    .then(() => b.set(SAVE_KEY, text))
    .then(() => {
      writeFailed = false;
    })
    .catch((e) => {
      // kept in memory; the next persist() or a visibilitychange writes the latest save again
      writeFailed = true;
      console.warn('storage: saving failed, will retry', e?.message || e);
    });
}

/** Write the latest save again after a failed write (also called on visibilitychange). */
export function retryFailedWrite() {
  if (writeFailed) persist();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** get() with retries. Returns {ok, raw}: ok=false means the read failed, which is not "nothing stored". */
async function readSave(b, tries, delayMs) {
  for (let i = 0; i < tries; i++) {
    try {
      return { ok: true, raw: await b.get(SAVE_KEY) };
    } catch {
      if (i < tries - 1) await sleep(delayMs);
    }
  }
  return { ok: false, raw: null };
}

/**
 * Load (and if needed migrate) the save. Resolves to the migrate() note, or 'read-failed'; never rejects.
 * A failed read never counts as an empty save: the session then runs in memory only and writes nothing,
 * so a real save that could not be read this time is never overwritten.
 */
export async function init({
  backend: b = defaultBackend(),
  legacyStorage = globalThis.window?.localStorage,
  now = new Date().toISOString(),
  tries = 3,
  retryDelayMs = 150,
} = {}) {
  backend = null;
  writeFailed = false;
  const read = await readSave(b, tries, retryDelayMs);
  if (!read.ok) {
    console.warn('storage: could not read the save; playing without saving this session');
    save = migrate(null, readLegacy(legacyStorage), now).save; // shown, never written
    return 'read-failed';
  }
  const raw = read.raw;
  const result = migrate(raw, raw == null || isCorrupt(raw) ? readLegacy(legacyStorage) : null, now);
  save = result.save;
  backend = b;
  if (result.note === 'corrupt' || result.note === 'corrupt-legacy') {
    try {
      await b.set(`${SAVE_KEY}.corrupt`, String(raw)); // keep the broken copy for a look later
    } catch {
      /* ignore */
    }
  }
  if (result.write) persist();
  await queue;
  watchVisibility();
  return result.note;
}

let watching = false;
function watchVisibility() {
  const doc = globalThis.document;
  if (watching || !doc?.addEventListener) return;
  watching = true;
  doc.addEventListener('visibilitychange', retryFailedWrite);
}

function isCorrupt(raw) {
  return migrate(raw).note === 'corrupt';
}

/** The whole document, for tests and debugging. */
export function snapshot() {
  return clone(save);
}

/** Resolves when every queued write has reached the backend. */
export function flushed() {
  return queue;
}

export function loadSettings() {
  return { muted: !!save.settings.muted, lang: save.settings.lang || null };
}

export function saveSettings(settings) {
  save.settings = { ...save.settings, muted: !!settings.muted, lang: settings.lang || null };
  persist();
}

export function loadProgress(gameId) {
  const g = save.games[gameId];
  return { stars: isObj(g?.stars) ? clone(g.stars) : {} };
}

export function saveProgress(gameId, progress) {
  save.games[gameId] = { ...(isObj(save.games[gameId]) ? save.games[gameId] : {}), stars: clone(progress.stars) };
  persist();
}

export const fullCache = {
  get() {
    return save.purchase?.owned === true;
  },
  set(owned) {
    if (save.purchase.owned === !!owned) return;
    save.purchase = { ...save.purchase, owned: !!owned };
    persist();
  },
};
