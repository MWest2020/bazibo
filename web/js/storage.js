// Save data: everything is remembered only on this device, in one versioned document.
//
//   { version: 1,
//     games:    { bubbels: { stars: {1: 3, ...} },
//                 dogudoku: { stars: {puzzle id: 1-3}, autoCross: false, howSeen: {tiny: true} },
//                 vier: { stars: {'cpu-big-1': wins, 'duo-small-2': wins}, setup, tokens },
//                 <later games add their own section> },
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
let pending = null; // a backend whose read failed; tried again later (adopt), never written blindly
let legacySource = null;
let queue = Promise.resolve();
let writeFailed = false;
let settingsTouched = false; // the child changed a setting this session
let adopting = null;

function persist() {
  if (!backend) {
    if (pending) adopt(); // the read failed at startup: try again, write only after a good read
    return;
  }
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

/** Write the latest save again after a failed write; retry a failed read (also on visibilitychange). */
export function retryFailedWrite() {
  if (writeFailed) persist();
  else if (!backend && pending) adopt();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), ms))),
  ]).finally(() => clearTimeout(timer));
}

/** get() with retries and a timeout. {ok:false} means the read failed, which is not "nothing stored". */
async function readSave(b, tries, delayMs, timeoutMs) {
  for (let i = 0; i < tries; i++) {
    try {
      return { ok: true, raw: await withTimeout(Promise.resolve().then(() => b.get(SAVE_KEY)), timeoutMs) };
    } catch {
      if (i < tries - 1) await sleep(delayMs);
    }
  }
  return { ok: false, raw: null };
}

/**
 * What was stored, combined with what happened in a session that could not read it: the best
 * stars per level, the full version if either says so, and the session's settings only if the
 * child changed them. Everything else (unknown fields, a newer version's data) comes from storage.
 */
export function mergeSaves(stored, session, sessionSettingsChanged) {
  const out = clone(stored);
  for (const [id, g] of Object.entries(session.games || {})) {
    const mine = isObj(out.games[id]) ? out.games[id] : (out.games[id] = {});
    const stars = isObj(mine.stars) ? mine.stars : (mine.stars = {});
    for (const [level, n] of Object.entries(isObj(g?.stars) ? g.stars : {})) stars[level] = Math.max(stars[level] || 0, n || 0);
  }
  out.purchase = { ...out.purchase, owned: out.purchase?.owned === true || session.purchase?.owned === true };
  if (sessionSettingsChanged) out.settings = { ...out.settings, muted: !!session.settings.muted, lang: session.settings.lang || null };
  return out;
}

/** Turn a successful read into the live save; false if the broken copy could not be kept. */
async function take(b, raw, now) {
  const result = migrate(raw, raw == null || isCorrupt(raw) ? readLegacy(legacySource) : null, now);
  if (result.note === 'corrupt' || result.note === 'corrupt-legacy') {
    try {
      await b.set(`${SAVE_KEY}.corrupt`, String(raw)); // keep the broken copy for a look later
    } catch {
      return { ok: false, result }; // could not keep it: do not overwrite it either
    }
  }
  return { ok: true, result };
}

/** A later attempt after a failed read: on success, merge this session in and start writing. */
function adopt({ timeoutMs = 3000 } = {}) {
  if (adopting || !pending) return adopting;
  const b = pending;
  adopting = (async () => {
    const read = await readSave(b, 1, 0, timeoutMs);
    if (!read.ok || pending !== b) return false;
    const { ok, result } = await take(b, read.raw, new Date().toISOString());
    if (!ok) return false;
    save = mergeSaves(result.save, save, settingsTouched);
    pending = null;
    backend = b;
    persist();
    return true;
  })().finally(() => {
    if (adopting === attempt) adopting = null; // a later init() may have started its own
  });
  const attempt = adopting;
  return adopting;
}

/** Resolves when a running read-again attempt has finished (for tests). */
export function adopted() {
  return adopting || Promise.resolve(false);
}

/**
 * Load (and if needed migrate) the save. Resolves to the migrate() note, or 'read-failed'; never rejects.
 * A failed (or hanging) read never counts as an empty save: the session then runs in memory and
 * writes nothing until a later read succeeds (on visibilitychange or the next save), and then
 * merges what happened in between (mergeSaves).
 */
export async function init({
  backend: b = defaultBackend(),
  legacyStorage = globalThis.window?.localStorage,
  now = new Date().toISOString(),
  tries = 3,
  retryDelayMs = 150,
  timeoutMs = 3000,
} = {}) {
  backend = null;
  pending = null;
  adopting = null; // an attempt left over from an earlier init() belongs to its own backend
  writeFailed = false;
  settingsTouched = false;
  legacySource = legacyStorage;
  watchVisibility();
  const read = await readSave(b, tries, retryDelayMs, timeoutMs);
  if (!read.ok) {
    console.warn('storage: could not read the save; playing without saving until a read works');
    save = migrate(null, readLegacy(legacyStorage), now).save; // shown, never written as it is
    pending = b;
    return 'read-failed';
  }
  const { ok, result } = await take(b, read.raw, now);
  save = result.save;
  if (!ok) {
    console.warn('storage: could not keep a copy of a broken save; playing without saving');
    pending = b;
    return 'read-failed';
  }
  backend = b;
  if (result.write) persist();
  await queue;
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
  settingsTouched = true;
  persist();
}

export function loadProgress(gameId) {
  const g = save.games[gameId];
  return { stars: isObj(g?.stars) ? clone(g.stars) : {} };
}

/**
 * Store a game's stars. Never lowers a level's stars: the game's own copy can be older than the
 * save (after a failed read that a later read merged in, review of PR #5), so per level the best
 * of both is kept.
 */
export function saveProgress(gameId, progress) {
  const g = isObj(save.games[gameId]) ? save.games[gameId] : {};
  const stars = isObj(g.stars) ? clone(g.stars) : {};
  for (const [id, n] of Object.entries(isObj(progress?.stars) ? progress.stars : {})) stars[id] = Math.max(stars[id] || 0, n || 0);
  save.games[gameId] = { ...g, stars };
  persist();
}

/** One result: level or puzzle `id` got `n` stars (kept only if better). */
export function recordStars(gameId, id, n) {
  saveProgress(gameId, { stars: { [id]: n } });
}

/** A game's own option (e.g. Dogudoku's auto-cross), kept in its section next to `stars`. */
export function loadGameOption(gameId, key, fallback) {
  const g = save.games[gameId];
  return isObj(g) && key in g && key !== 'stars' ? clone(g[key]) : fallback;
}

export function saveGameOption(gameId, key, value) {
  if (key === 'stars') throw new Error('stars go through saveProgress');
  save.games[gameId] = { ...(isObj(save.games[gameId]) ? save.games[gameId] : {}), [key]: clone(value) };
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
