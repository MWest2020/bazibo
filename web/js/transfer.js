// "Voortgang overzetten": the progress of one device, as QR codes, read by another device.
// No server and no internet: the codes go from one screen to the other camera (or as text).
//
// What travels: the games' sections and the settings of the save document (storage.js). Never the
// purchase: the full version is always restored from the store on the other device.
//
// The code (all text in the QR "alphanumeric" alphabet, so the QR codes stay small):
//   blob  = [format version 1][flags: bit 0 = deflated][CRC-32 of the JSON, 4 bytes][body]
//   text  = base45(blob)                                     (RFC 9285)
//   parts = 'BZ1' + set id (4 hex) + part (2 digits) + of (2 digits) + ':' + a slice of text
// A receiver collects the parts of one set in any order. Everything that comes in is checked
// (size, format, checksum, the shape of every value) before it can touch the save.
import { mergeSaves, VERSION, DRAWING_MAX, DRAWING_RE, DRAWINGS_KEEP } from './storage.js';

export const FORMAT = 1;
// Characters per QR code. A multiple of 3 (a base45 group), so no part ends inside one. With the
// 12-character header that is 612 alphanumeric characters: QR version 13 (69x69) at error
// correction L, which a phone camera reads easily from another screen.
export const PART_CHARS = 600;
export const MAX_CHUNK = 1200; // what a receiver accepts per part (room for other senders' sizes)
export const MAX_PARTS = 30;
export const MAX_JSON = 512 * 1024; // the most a code may unpack to (a "zip bomb" stops here)
const PREFIX = 'BZ1';
const PART_RE = /^BZ1([0-9A-F]{4})(\d{2})(\d{2}):([0-9A-Z $%*+\-./:]+)$/;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

// ---------- base45 (RFC 9285) ----------

const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

export function base45Encode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      let x = bytes[i] * 256 + bytes[i + 1];
      const c = x % 45;
      x = (x - c) / 45;
      const d = x % 45;
      const e = (x - d) / 45;
      out += B45[c] + B45[d] + B45[e];
    } else {
      const x = bytes[i];
      out += B45[x % 45] + B45[Math.floor(x / 45)];
    }
  }
  return out;
}

export function base45Decode(text) {
  const out = [];
  const val = (ch) => {
    const v = B45.indexOf(ch);
    if (v < 0) throw new Error('bad character');
    return v;
  };
  for (let i = 0; i < text.length; i += 3) {
    const rest = text.length - i;
    if (rest >= 3) {
      const x = val(text[i]) + val(text[i + 1]) * 45 + val(text[i + 2]) * 2025;
      if (x > 0xffff) throw new Error('bad triple');
      out.push(x >> 8, x & 0xff);
    } else if (rest === 2) {
      const x = val(text[i]) + val(text[i + 1]) * 45;
      if (x > 0xff) throw new Error('bad pair');
      out.push(x);
    } else throw new Error('bad length');
  }
  return Uint8Array.from(out);
}

// ---------- CRC-32 ----------

let CRC_TABLE = null;
export function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------- deflate (CompressionStream where there is one) ----------

const canCompress = () => typeof globalThis.CompressionStream === 'function';
const canDecompress = () => typeof globalThis.DecompressionStream === 'function';

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Unpack, but never more than `limit` bytes: a hostile code cannot fill the memory. Browsers
 * without DecompressionStream (iOS before 16.4) use the vendored fflate, into a fixed buffer.
 */
async function inflate(bytes, limit) {
  if (!canDecompress()) {
    const { unzlibSync } = await import('../vendor/fflate/fflate.min.js');
    const out = unzlibSync(bytes, { out: new Uint8Array(limit + 1) }); // stops at the end of the buffer
    if (out.length > limit) throw new Error('too-big');
    return out;
  }
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      reader.cancel().catch(() => {});
      throw new Error('too-big');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// ---------- what travels ----------

/** The part of a save that travels: games and settings, never the purchase. */
export function payloadOf(save, { withArt = true } = {}) {
  const games = clone(isObj(save?.games) ? save.games : {});
  if (!withArt) {
    for (const g of Object.values(games)) {
      if (!isObj(g)) continue;
      delete g.art;
      delete g.drawings;
    }
  }
  const s = isObj(save?.settings) ? save.settings : {};
  const out = { v: VERSION, games, settings: { muted: !!s.muted, lang: typeof s.lang === 'string' ? s.lang : null } };
  if (!withArt) out.noArt = true; // replace then keeps the receiver's own colouring pages and drawings
  return out;
}

/** Whether a save has colouring pages or drawings (then a smaller code without them can be offered). */
export function hasArt(save) {
  const some = (o) => isObj(o) && Object.keys(o).length > 0;
  return Object.values(isObj(save?.games) ? save.games : {}).some((g) => some(g?.art) || some(g?.drawings));
}

/** A save as one long code text. */
export async function encodeSave(save, opts = {}) {
  const json = new TextEncoder().encode(JSON.stringify(payloadOf(save, opts)));
  let flags = 0;
  let body = json;
  if (canCompress()) {
    const packed = await deflate(json);
    if (packed.length < json.length) {
      flags = 1;
      body = packed;
    }
  }
  const crc = crc32(json);
  const blob = new Uint8Array(6 + body.length);
  blob[0] = FORMAT;
  blob[1] = flags;
  blob[2] = crc >>> 24;
  blob[3] = (crc >>> 16) & 0xff;
  blob[4] = (crc >>> 8) & 0xff;
  blob[5] = crc & 0xff;
  blob.set(body, 6);
  return base45Encode(blob);
}

/** One code text as QR parts. `id` keeps two different sends apart. Throws 'too-big'. */
export function splitParts(text, id = randomId(), size = PART_CHARS) {
  const n = Math.max(1, Math.ceil(text.length / size));
  if (n > MAX_PARTS) throw new Error('too-big');
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(`${PREFIX}${id}${String(i + 1).padStart(2, '0')}${String(n).padStart(2, '0')}:${text.slice(i * size, (i + 1) * size)}`);
  return parts;
}

export function randomId() {
  const c = globalThis.crypto;
  const n = c?.getRandomValues ? c.getRandomValues(new Uint16Array(1))[0] : Math.floor(Math.random() * 65536);
  return n.toString(16).toUpperCase().padStart(4, '0');
}

/** The QR parts of a save. Throws 'too-big' when it needs more than MAX_PARTS codes. */
export async function saveToParts(save, opts = {}) {
  return splitParts(await encodeSave(save, opts));
}

/** Read one part; null when the text is not a part of ours. */
export function parsePart(text) {
  const m = PART_RE.exec(String(text || '').trim());
  if (!m) return null;
  const i = Number(m[2]);
  const n = Number(m[3]);
  if (n < 1 || n > MAX_PARTS || i < 1 || i > n || m[4].length > MAX_CHUNK) return null;
  return { id: m[1], i, n, chunk: m[4] };
}

/**
 * Collects the parts of one set, in any order. add(text) answers:
 *   'not-ours' | 'other-set' (a part of a different send: ignored) | 'dup' | 'added' | 'complete'
 */
export function createCollector() {
  let id = null;
  let n = 0;
  const chunks = new Map();
  return {
    add(text) {
      const p = parsePart(text);
      if (!p) return 'not-ours';
      if (id === null) {
        id = p.id;
        n = p.n;
      } else if (p.id !== id || p.n !== n) return 'other-set';
      if (chunks.has(p.i)) return 'dup';
      chunks.set(p.i, p.chunk);
      return chunks.size === n ? 'complete' : 'added';
    },
    get have() {
      return chunks.size;
    },
    get total() {
      return n;
    },
    missing() {
      const out = [];
      for (let i = 1; i <= n; i++) if (!chunks.has(i)) out.push(i);
      return out;
    },
    text() {
      if (!n || chunks.size !== n) return null;
      let s = '';
      for (let i = 1; i <= n; i++) s += chunks.get(i);
      return s;
    },
    reset() {
      id = null;
      n = 0;
      chunks.clear();
    },
  };
}

/** Read pasted text: one or more parts, one per line (or separated by spaces between parts). */
export function partsFromText(text) {
  const out = [];
  for (const line of String(text || '').split(/[\r\n]+/)) {
    // a part header starts a new part, also mid-line; split with a fixed-width lookahead only
    for (const piece of line.split(/(?=BZ1[0-9A-F]{4}\d{4}:)/)) {
      const p = piece.trim();
      if (p) out.push(p);
    }
  }
  return out;
}

/**
 * The code text back to a checked payload { games, settings }. Throws an Error whose message is
 * one of: 'format', 'version', 'checksum', 'too-big', 'content'.
 */
export async function decodeText(text) {
  let blob;
  try {
    blob = base45Decode(text);
  } catch {
    throw new Error('format');
  }
  if (blob.length < 7) throw new Error('format');
  if (blob[0] !== FORMAT) throw new Error('version');
  const flags = blob[1];
  if (flags & ~1) throw new Error('format');
  const want = ((blob[2] << 24) | (blob[3] << 16) | (blob[4] << 8) | blob[5]) >>> 0;
  let json = blob.subarray(6);
  if (flags & 1) {
    try {
      json = await inflate(json, MAX_JSON);
    } catch (e) {
      throw new Error(e?.message === 'too-big' ? 'too-big' : 'format');
    }
  } else if (json.length > MAX_JSON) throw new Error('too-big');
  if (crc32(json) !== want) throw new Error('checksum');
  let doc;
  try {
    doc = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json));
  } catch {
    throw new Error('format');
  }
  if (!isObj(doc) || !Number.isInteger(doc.v) || doc.v < 1) throw new Error('content');
  if (doc.v > VERSION) throw new Error('version');
  return sanitizePayload(doc);
}

// ---------- checking what came in ----------

const ID_RE = /^[a-z][a-z0-9_-]{0,31}$/; // game ids
const KEY_SHAPE = /^[A-Za-z0-9:_.\-]{1,64}$/; // level, puzzle, page, region and option keys
// never a name that Object.prototype already has (__proto__, constructor, toString, hasOwnProperty…)
const NOT_KEYS = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
const KEY_RE = { test: (k) => KEY_SHAPE.test(k) && !NOT_KEYS.has(k) };
const MAX_KEYS = 2000;

const count = (v) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), 1e6) : null);

function cleanCounts(obj) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const [k, v] of Object.entries(obj).slice(0, MAX_KEYS)) {
    const n = count(v);
    if (KEY_RE.test(k) && n !== null) out[k] = n;
  }
  return out;
}

function cleanFlags(obj) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const [k, v] of Object.entries(obj).slice(0, 100)) if (KEY_RE.test(k) && v === true) out[k] = true; // only 'seen'
  return out;
}

// a time in the far future would win every later merge
const cleanTime = (t) => (Number.isFinite(t) && t >= 0 ? Math.min(t, Date.now() + 864e5) : 0);

function cleanArt(obj) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const [page, e] of Object.entries(obj).slice(0, 200)) {
    if (!KEY_RE.test(page) || !isObj(e)) continue;
    const t = cleanTime(e.t);
    const c = e.c ? { c: 1 } : {};
    if (e.gone === true) {
      out[page] = { t, gone: true, ...c };
      continue;
    }
    const f = {};
    for (const [r, col] of Object.entries(isObj(e.f) ? e.f : {}).slice(0, 1000)) if (KEY_RE.test(r) && Number.isInteger(col) && col >= 0 && col < 64) f[r] = col;
    if (Object.keys(f).length) out[page] = { f, t, done: e.done === true, ...c };
  }
  return out;
}

/** Drawings (Tekenen): a text of the drawing alphabet, not too long, or a "deleted" marker. */
function cleanDrawings(obj) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const [id, e] of Object.entries(obj).slice(0, 2 * DRAWINGS_KEEP)) {
    if (!KEY_RE.test(id) || !isObj(e)) continue;
    const t = cleanTime(e.t);
    if (e.gone === true) out[id] = { t, gone: true };
    else if (typeof e.s === 'string' && e.s.length > 0 && e.s.length <= DRAWING_MAX && DRAWING_RE.test(e.s)) out[id] = { s: e.s, t };
  }
  return out;
}

const prim = (v) => typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 64);

/** A game option (autoCross, numbers, setup, tokens, lastTier, duoStarter…): small and flat. */
function cleanOption(v) {
  if (prim(v)) return v;
  if (Array.isArray(v)) return v.length <= 16 && v.every(prim) ? v.slice() : undefined;
  if (isObj(v)) {
    const out = {};
    const entries = Object.entries(v);
    if (entries.length > 32) return undefined;
    for (const [k, x] of entries) {
      if (!KEY_RE.test(k)) continue;
      if (prim(x)) out[k] = x;
      else if (Array.isArray(x) && x.length <= 16 && x.every(prim)) out[k] = x.slice();
    }
    return out;
  }
  return undefined;
}

/** Only known shapes get through; anything else is dropped. Never throws on odd input. */
export function sanitizePayload(doc) {
  const games = {};
  for (const [id, g] of Object.entries(isObj(doc.games) ? doc.games : {}).slice(0, 32)) {
    if (!ID_RE.test(id) || NOT_KEYS.has(id) || !isObj(g)) continue;
    const out = {};
    for (const [k, v] of Object.entries(g).slice(0, 32)) {
      if (!KEY_RE.test(k)) continue;
      if (k === 'stars' || k === 'random') out[k] = cleanCounts(v);
      else if (k === 'howSeen') out[k] = cleanFlags(v);
      else if (k === 'art') out[k] = cleanArt(v);
      else if (k === 'drawings') out[k] = cleanDrawings(v);
      else {
        const o = cleanOption(v);
        if (o !== undefined) out[k] = o;
      }
    }
    games[id] = out;
  }
  const s = isObj(doc.settings) ? doc.settings : {};
  const lang = s.lang === 'nl' || s.lang === 'en' ? s.lang : null;
  return { games, settings: { muted: s.muted === true, lang }, noArt: doc.noArt === true };
}

// ---------- what the other device does with it ----------

/** For the summary card: per game, how many levels, puzzles or pages have progress. */
export function summarize(payload) {
  const out = [];
  for (const [id, g] of Object.entries(payload.games || {})) {
    let n = 0;
    for (const v of Object.values(isObj(g.stars) ? g.stars : {})) if (v > 0) n++;
    for (const e of Object.values(isObj(g.art) ? g.art : {})) if (!e.gone) n++;
    for (const e of Object.values(isObj(g.drawings) ? g.drawings : {})) if (!e.gone) n++;
    for (const v of Object.values(isObj(g.random) ? g.random : {})) n += v;
    if (n > 0) out.push({ id, n });
  }
  return out;
}

const SPECIAL = new Set(['stars', 'random', 'howSeen', 'art', 'drawings']);

/**
 * Merge: what this device has, plus what came in. Stars and counts keep the higher value, colouring
 * pages merge per region (newer wins), how-to cards seen in either stay seen; a game option this
 * device already has stays, a missing one is taken. Settings and the purchase stay this device's.
 */
export function mergeTransfer(stored, payload) {
  const incoming = clone(payload.games || {});
  const randoms = {};
  for (const [id, g] of Object.entries(incoming)) {
    if (isObj(g.random)) randoms[id] = g.random;
    delete g.random; // mergeSaves adds random counts (made for a session that started at 0)
  }
  const out = mergeSaves(stored, { games: incoming, purchase: { owned: false }, settings: {} }, false);
  for (const [id, r] of Object.entries(randoms)) {
    const mine = out.games[id];
    const random = isObj(mine.random) ? mine.random : (mine.random = {});
    for (const [tier, n] of Object.entries(r)) random[tier] = Math.max(Number(random[tier]) || 0, n);
  }
  for (const [id, g] of Object.entries(payload.games || {})) {
    const mine = out.games[id];
    for (const [k, v] of Object.entries(g)) if (!SPECIAL.has(k) && !(k in mine)) mine[k] = clone(v);
  }
  return out;
}

/**
 * Replace: the progress and settings that came in; this device keeps its purchase. A code made
 * "without colouring pages" leaves this device's colouring pages and drawings as they are.
 */
export function replaceTransfer(stored, payload) {
  const out = clone(stored);
  out.games = clone(payload.games || {});
  if (payload.noArt) {
    for (const [id, g] of Object.entries(isObj(stored.games) ? stored.games : {})) {
      if (!isObj(g?.art) && !isObj(g?.drawings)) continue;
      const mine = isObj(out.games[id]) ? out.games[id] : (out.games[id] = {});
      if (isObj(g.art)) mine.art = clone(g.art);
      if (isObj(g.drawings)) mine.drawings = clone(g.drawings);
    }
  }
  out.settings = { ...out.settings, ...clone(payload.settings || {}) };
  return out;
}
