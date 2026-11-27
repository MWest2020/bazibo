// The full version on the website: a signed code bought through Buy Me a Coffee (Mark, 27 Nov 2026:
// "dat via een code doen en buy me a coffee? … ook 1 euro"). WEB ONLY: inside the Android or iOS
// app none of this is shown or run (Google Play's payments policy: no external payment for digital
// goods in the app). main.js only builds the code adapter when `webCodeAllowed(window)` is true.
//
// The code (format v1, shared with the issuer; FORMAT.md beside the private key, never in a repo):
//   code    = "BZB1." + b64url(payload) + "." + b64url(sig)          (base64url, no padding)
//   payload = 16 bytes: [0] version 1, [1] product 1 (full version), [2..5] issued day (uint32 BE,
//             days since 1970-01-01 UTC), [6..15] 10 random bytes: the code id
//   sig     = Ed25519 over "bazibo-unlock-v1" || payload                (64 bytes)
// The mail links to https://bazibo.nl/#unlock=<code> (the fragment never reaches a web server's log);
// `?unlock=` works too. Checked offline with WebCrypto Ed25519 against the public key below. A browser without Ed25519 in
// WebCrypto gets a kind "too old" message; no crypto library is vendored (docs/reference/full-version.md).
//
// After a code passes the offline check, one POST to ACTIVATE_URL with the code and a random device
// id counts on how many devices it is used (Mark, 27 Nov 2026: "geen moeite met 10x gedeeld of op
// 10 devices, maar 100x een streep"). Our server being away never blocks a child: only an explicit
// 409 (limit), 403 "revoked" or 400 "invalid" refuses; anything else (429, 503 "off", 5xx, 403
// "origin", no network, 5 s without an answer) unlocks and is retried once on a later start.
// After that, starting re-checks the stored code offline only.
import { inApp } from './store-links.js';

export const CODE_PREFIX = 'BZB1.';
export const PAYLOAD_BYTES = 16;
export const SIG_BYTES = 64;
const PAYLOAD_CHARS = 22; // 16 bytes in base64url without padding
const SIG_CHARS = 86; // 64 bytes
export const CODE_CHARS = CODE_PREFIX.length + PAYLOAD_CHARS + 1 + SIG_CHARS; // 114
/** The most text we look at (a code wrapped in a mail line or a deep link); longer is refused. */
export const MAX_INPUT = 400;
const CODE_RE = /^BZB1\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{86})$/;
const CONTEXT = 'bazibo-unlock-v1';

/** The issuer's public key (raw 32 bytes, base64url). The private key never comes near this repo. */
export const UNLOCK_PUBLIC_KEY = 'Dpnm6nFTwx1A-kFUf7IMoz4SVUF-O_biI-edjvzpP_4';
/** Where a parent buys the code (a Buy Me a Coffee "Extra"); opened in a new tab, never fetched. */
export const BMC_URL = 'https://buymeacoffee.com/mark.westerweel/extras';
/** The one request outside the origin, web only: counts devices per code. */
export const ACTIVATE_URL = 'https://api.westerweel.work/bazibo/activate';
export const ACTIVATE_TIMEOUT_MS = 5000;
/** localStorage key of the random device id (next to the save; never in it, never transferred). */
export const DEVICE_KEY = 'bubbels.device';

/** True on the website, false inside the Android or iOS app (or anything that looks like it). */
export function webCodeAllowed(win) {
  return !!win && !inApp(win);
}

// ---------- base64url, strict ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function b64urlEncode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

/** base64url without padding to bytes; null for anything else, also for unused bits that are not
 *  zero (so one code has exactly one spelling and every changed character changes the bytes). */
export function b64urlDecode(text, bytes) {
  if (typeof text !== 'string' || text.length !== Math.ceil((bytes * 4) / 3)) return null;
  const out = new Uint8Array(bytes);
  let acc = 0;
  let bits = 0;
  let at = 0;
  for (const ch of text) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (at < bytes) out[at++] = (acc >> bits) & 0xff;
      acc &= (1 << bits) - 1;
    }
  }
  if (at !== bytes || acc !== 0) return null;
  return out;
}

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

// ---------- parsing ----------

/**
 * The code out of what a parent pasted or scanned: the bare code, or a link with `?unlock=<code>`.
 * Spaces and line breaks inside are dropped (a mail may wrap the line). Null when it is neither.
 */
export function extractCode(input) {
  if (typeof input !== 'string' || input.length > MAX_INPUT) return null;
  const text = input.replace(/\s+/g, '');
  if (text.startsWith(CODE_PREFIX)) return text;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const code = new URLSearchParams(url.hash.replace(/^#/, '')).get('unlock') ?? url.searchParams.get('unlock');
      return typeof code === 'string' && code.startsWith(CODE_PREFIX) ? code : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Does this text look like an unlock code (or its link) rather than a transfer part? */
export const looksLikeCode = (text) => /^\s*(BZB1\.|https?:\/\/\S*[?&#]unlock=BZB1\.)/.test(String(text || ''));

/**
 * Check the shape of a code (no signature yet): { ok: true, code, payload, sig, id, day } or
 * { ok: false, reason }, reason 'format' | 'version' | 'product'. Never throws.
 */
export function parseCode(input) {
  const code = extractCode(input);
  if (!code || code.length !== CODE_CHARS) return { ok: false, reason: 'format' };
  const m = CODE_RE.exec(code);
  if (!m) return { ok: false, reason: 'format' };
  const payload = b64urlDecode(m[1], PAYLOAD_BYTES);
  const sig = b64urlDecode(m[2], SIG_BYTES);
  if (!payload || !sig) return { ok: false, reason: 'format' };
  if (payload[0] !== 1) return { ok: false, reason: 'version' };
  if (payload[1] !== 1) return { ok: false, reason: 'product' };
  const day = ((payload[2] << 24) | (payload[3] << 16) | (payload[4] << 8) | payload[5]) >>> 0;
  return { ok: true, code, payload, sig, id: hex(payload.subarray(6)), day };
}

// ---------- the signature ----------

/**
 * Parse and verify a code offline. Resolves { ok: true, code, id, day } or { ok: false, reason }:
 * 'format' | 'version' | 'product' (not a code of ours), 'signature' (not signed by our key),
 * 'revoked' (on the revocation list), 'unsupported' (this browser has no Ed25519 in WebCrypto).
 * `publicKey` is a parameter so the tests sign with a key of their own.
 */
export async function verifyCode(input, { publicKey = UNLOCK_PUBLIC_KEY, revoked = [], subtle = globalThis.crypto?.subtle } = {}) {
  const p = parseCode(input);
  if (!p.ok) return p;
  const raw = b64urlDecode(publicKey, 32);
  if (!raw) return { ok: false, reason: 'unsupported' };
  let key;
  try {
    if (!subtle?.importKey || !subtle?.verify) throw new Error('no WebCrypto');
    key = await subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']);
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
  const context = new TextEncoder().encode(CONTEXT);
  const data = new Uint8Array(context.length + p.payload.length);
  data.set(context);
  data.set(p.payload, context.length);
  let good = false;
  try {
    good = await subtle.verify({ name: 'Ed25519' }, key, p.sig, data);
  } catch {
    good = false;
  }
  if (!good) return { ok: false, reason: 'signature' };
  const list = new Set(Array.from(revoked, (id) => String(id).toLowerCase()));
  if (list.has(p.id)) return { ok: false, reason: 'revoked' };
  return { ok: true, code: p.code, id: p.id, day: p.day };
}

// ---------- the deep link ----------

/**
 * The mail's link on the website: `#unlock=<code>` (the code stays out of web-server logs) or, from
 * before, `?unlock=<code>`. Takes the code and removes it from the address at once
 * (history.replaceState; every other parameter stays). Null when there is none, or in the app,
 * where the address is left alone. Never logs the code.
 */
export function takeUnlockParam(win) {
  if (!webCodeAllowed(win)) return null;
  let url;
  try {
    url = new URL(win.location.href);
  } catch {
    return null;
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const inHash = url.hash.length > 1 && hash.has('unlock');
  const inQuery = url.searchParams.has('unlock');
  if (!inHash && !inQuery) return null;
  const code = inHash ? hash.get('unlock') : url.searchParams.get('unlock');
  url.searchParams.delete('unlock');
  hash.delete('unlock');
  // `?test` stays `?test` (URLSearchParams would write `test=`)
  const bare = (q) => q.replace(/=(?=&|$)/g, '');
  const search = bare(url.search);
  const rest = inHash ? bare(hash.toString()) : url.hash.replace(/^#/, '');
  try {
    win.history.replaceState(win.history.state, '', `${url.pathname}${search}${rest ? `#${rest}` : ''}`);
  } catch {
    /* a page without history: the code is still taken */
  }
  return code ? code.slice(0, MAX_INPUT) : '';
}

// ---------- activation (web only, once) ----------

/** A random 128-bit device id, made once and kept in localStorage. Never derived from the device. */
export function deviceId(ls = globalThis.localStorage, rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  try {
    const had = ls?.getItem(DEVICE_KEY);
    if (typeof had === 'string' && /^[0-9a-f]{32}$/.test(had)) return had;
  } catch {
    /* blocked storage: a fresh id for this call */
  }
  const id = hex(rand(16));
  try {
    ls?.setItem(DEVICE_KEY, id);
  } catch {
    /* not kept: the next activation sends another random id */
  }
  return id;
}

/**
 * One POST to the activation endpoint. Resolves:
 *   'ok'       200 {"status":"ok"}
 *   'limit'    409 {"error":"limit"}: used on 10 devices already
 *   'revoked'  403 {"error":"revoked"}
 *   'invalid'  400 {"error":"invalid"}: not accepted (cannot happen for a code that passed offline)
 *   'offline'  anything else: no network, a timeout, 429 (rate), 403 {"error":"origin"}, 5xx,
 *              503 {"error":"off"} (switched off): never a reason to keep a child out.
 * Never throws.
 */
export async function activate(code, device, { fetchFn = globalThis.fetch, timeoutMs = ACTIVATE_TIMEOUT_MS } = {}) {
  if (typeof fetchFn !== 'function') return 'offline';
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      ctrl?.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const res = await fetchFn(ACTIVATE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, device }),
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          signal: ctrl?.signal,
        });
        const status = res?.status;
        if (status === 200) return 'ok';
        if (status === 409) return 'limit';
        if (status === 400) return 'invalid';
        if (status === 403) {
          // 403 is "revoked" or "origin" (a page on an address the server does not know): only the
          // first keeps the code out; an unreadable answer counts as our problem, not the parent's
          let error = null;
          try {
            error = (await res.json())?.error;
          } catch {
            error = null;
          }
          return error === 'revoked' ? 'revoked' : 'offline';
        }
        return 'offline';
      })(),
      timeout,
    ]);
  } catch {
    return 'offline';
  } finally {
    clearTimeout(timer);
  }
}

// ---------- the billing adapter for the website ----------

/**
 * The website's adapter for createUnlock (unlock.js), so a code opens the games through the same
 * path as a store purchase. `kind: 'code'` tells the shell to offer the code instead of the store.
 *   load() -> { code, activated, retried } | null      the code kept in the save
 *   keep(entry | null)                                  store or clear it
 *   verify(code) -> verifyCode result                   (main.js passes the key and revocation list)
 *   activate(code) -> 'ok' | 'limit' | 'revoked' | 'offline'
 *   online() -> boolean                                 navigator.onLine
 *   onRefused(reason)                                   a kept code refused by the late retry
 */
export function createCodeBilling({ load, keep, verify, activate: act, online = () => true, onRefused = () => {} }) {
  const listeners = [];
  let retrying = Promise.resolve();

  /** The one quiet retry of an activation that could not reach our server; never awaited by start. */
  async function retry(code) {
    const a = await act(code);
    if (load()?.code !== code) return; // a parent entered another code meanwhile
    if (a === 'limit' || a === 'revoked') {
      keep(null);
      for (const fn of listeners) fn(false);
      onRefused(a);
      return;
    }
    keep({ code, activated: a === 'ok', retried: true });
  }

  return {
    available: true,
    kind: 'code',
    /** At every start: the kept code checked offline (no network). A code that was opened while our
     *  server could not be reached is activated once more in the background, if online. */
    async start() {
      const entry = load();
      if (!entry?.code) return { ok: true, owned: false };
      const r = await verify(entry.code);
      if (!r.ok) {
        if (r.reason === 'unsupported') return { ok: false, reason: 'unsupported' }; // kept for a newer browser
        keep(null); // tampered, garbled or revoked: never opens again
        return { ok: true, owned: false, reason: r.reason };
      }
      if (entry.activated !== true && !entry.retried && online()) {
        // after this start has been answered (a macrotask later), so a refusal always comes last
        retrying = new Promise((done) => setTimeout(done, 0)).then(() => retry(r.code)).catch(() => {});
      }
      return { ok: true, owned: true };
    },
    /** Resolves when a background retry has finished (for the tests). */
    get retrying() {
      return retrying;
    },
    async restore() {
      return this.start();
    },
    async buy() {
      return { ok: false, reason: 'external' }; // bought on Buy Me a Coffee, in a new tab
    },
    /** A code a parent entered, scanned or opened from the mail. */
    async redeem(input) {
      const r = await verify(input);
      if (!r.ok) return { ok: false, reason: r.reason };
      const had = load();
      if (had?.code === r.code && had.activated === true) return { ok: true, owned: true, activated: true }; // counted already
      const a = await act(r.code);
      if (a === 'limit' || a === 'revoked' || a === 'invalid') return { ok: false, reason: a };
      keep({ code: r.code, activated: a === 'ok', retried: false });
      return { ok: true, owned: true, activated: a === 'ok' };
    },
    price() {
      return '€ 1';
    },
    onOwnedChange(fn) {
      listeners.push(fn);
    },
  };
}
