// The website's unlock code (web/js/unlock-code.js): strict parsing, the Ed25519 signature checked
// offline, the revocation list, the deep link, the one activation call, the adapter that opens the
// games through createUnlock like a purchase, the transfer round trip, and that none of it can run
// in the app. Every code here is signed with a key made in this test: the real private key is never
// read (the verifier takes the public key as a parameter).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  CODE_PREFIX,
  CODE_CHARS,
  MAX_INPUT,
  UNLOCK_PUBLIC_KEY,
  BMC_URL,
  ACTIVATE_URL,
  DEVICE_KEY,
  b64urlEncode,
  b64urlDecode,
  extractCode,
  looksLikeCode,
  parseCode,
  verifyCode,
  takeUnlockParam,
  webCodeAllowed,
  activate,
  deviceId,
  createCodeBilling,
} from '../web/js/unlock-code.js';
import { REVOKED } from '../web/js/revoked.js';
import { createUnlock } from '../web/js/unlock.js';
import { inApp } from '../web/js/store-links.js';
import { encodeSave, decodeText, sanitizePayload, mergeTransfer, replaceTransfer, payloadOf } from '../web/js/transfer.js';
import * as storage from '../web/js/storage.js';

const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const subtle = globalThis.crypto.subtle;
const ED = { name: 'Ed25519' };
const CONTEXT = new TextEncoder().encode('bazibo-unlock-v1');

const keys = await subtle.generateKey(ED, true, ['sign', 'verify']);
const PUB = b64urlEncode(new Uint8Array(await subtle.exportKey('raw', keys.publicKey)));
const other = await subtle.generateKey(ED, true, ['sign', 'verify']);
const OTHER_PUB = b64urlEncode(new Uint8Array(await subtle.exportKey('raw', other.publicKey)));

function payloadBytes({ version = 1, product = 1, day = 20419, id = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } = {}) {
  const p = new Uint8Array(16);
  p[0] = version;
  p[1] = product;
  p[2] = (day >>> 24) & 0xff;
  p[3] = (day >>> 16) & 0xff;
  p[4] = (day >>> 8) & 0xff;
  p[5] = day & 0xff;
  p.set(id, 6);
  return p;
}

async function sign(payload, key = keys.privateKey) {
  const data = new Uint8Array(CONTEXT.length + payload.length);
  data.set(CONTEXT);
  data.set(payload, CONTEXT.length);
  return new Uint8Array(await subtle.sign(ED, key, data));
}

async function makeCode(opts = {}, key) {
  const p = payloadBytes(opts);
  return `${CODE_PREFIX}${b64urlEncode(p)}.${b64urlEncode(await sign(p, key))}`;
}

const verify = (code, opts = {}) => verifyCode(code, { publicKey: PUB, ...opts });
const VALID = await makeCode();
const ID_HEX = '0102030405060708090a';

test('base64url: round trip, one spelling only, no padding', () => {
  for (const n of [16, 32, 64]) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff);
    const text = b64urlEncode(bytes);
    assert.equal(text.length, Math.ceil((n * 4) / 3));
    assert.deepEqual(b64urlDecode(text, n), bytes);
  }
  const t16 = b64urlEncode(new Uint8Array(16));
  assert.equal(b64urlDecode(`${t16}==`, 16), null); // padding
  assert.equal(b64urlDecode(t16.slice(0, -1) + 'B', 16), null); // unused bits set: another spelling
  assert.equal(b64urlDecode(t16.slice(0, -1) + '+', 16), null); // plain base64
  assert.equal(b64urlDecode(t16.slice(0, -1) + '/', 16), null);
  assert.equal(b64urlDecode(t16 + 'A', 16), null);
  assert.equal(b64urlDecode(123, 16), null);
});

test('the real public key is a raw 32-byte key; the BMC and activation addresses are fixed', () => {
  assert.equal(b64urlDecode(UNLOCK_PUBLIC_KEY, 32)?.length, 32);
  assert.equal(BMC_URL, 'https://buymeacoffee.com/mark.westerweel/e/603413');
  assert.equal(ACTIVATE_URL, 'https://api.westerweel.work/bazibo/activate');
  assert.equal(CODE_CHARS, 114);
  assert.equal(VALID.length, CODE_CHARS);
});

test('a valid code passes, with its id and day; the same code in a link or wrapped by a mail too', async () => {
  const r = await verify(VALID);
  assert.deepEqual(r, { ok: true, code: VALID, id: ID_HEX, day: 20419 });
  assert.equal((await verify(`  ${VALID}\n`)).ok, true);
  assert.equal((await verify(`${VALID.slice(0, 50)}\n${VALID.slice(50)}`)).ok, true);
  assert.equal((await verify(`${VALID.slice(0, 50)}\u200B${VALID.slice(50)}\uFEFF`)).ok, true); // zero-width spaces from a mail
  assert.equal((await verify(`https://bazibo.nl/?unlock=${VALID}`)).ok, true);
  assert.equal((await verify(`https://bazibo.nl/#unlock=${VALID}`)).ok, true);
  assert.equal(looksLikeCode(`https://bazibo.nl/#unlock=${VALID}`), true);
  assert.equal((await verify(`https://mwest2020.github.io/bazibo/?lang=nl&unlock=${VALID}#x`)).ok, true);
  assert.equal(extractCode(`https://bazibo.nl/?other=${VALID}`), null);
  assert.equal(looksLikeCode(VALID), true);
  assert.equal(looksLikeCode(`https://bazibo.nl/?unlock=${VALID}`), true);
  assert.equal(looksLikeCode('BZ1ABCD0101:XYZ'), false); // a transfer part
});

test('every byte flip fails: payload and signature, each bit position of each byte', async () => {
  const p = payloadBytes();
  const sig = await sign(p);
  const bytes = new Uint8Array([...p, ...sig]);
  for (let i = 0; i < bytes.length; i++) {
    for (const bit of [0x01, 0x80]) {
      const b = bytes.slice();
      b[i] ^= bit;
      const code = `${CODE_PREFIX}${b64urlEncode(b.subarray(0, 16))}.${b64urlEncode(b.subarray(16))}`;
      const r = await verify(code);
      assert.equal(r.ok, false, `byte ${i} bit ${bit} still passes`);
      assert.ok(['signature', 'version', 'product'].includes(r.reason), r.reason);
    }
  }
});

test('every changed character of the code fails', async () => {
  for (let i = 0; i < VALID.length; i++) {
    const ch = VALID[i];
    const alt = ch === 'A' ? 'B' : ch === '.' ? '-' : 'A';
    const r = await verify(VALID.slice(0, i) + alt + VALID.slice(i + 1));
    assert.equal(r.ok, false, `character ${i} changed still passes`);
  }
});

test('wrong version, product, prefix or length fails; padding and oversized input are refused', async () => {
  assert.deepEqual(await verify(await makeCode({ version: 2 })), { ok: false, reason: 'version' });
  assert.deepEqual(await verify(await makeCode({ version: 0 })), { ok: false, reason: 'version' });
  assert.deepEqual(await verify(await makeCode({ product: 2 })), { ok: false, reason: 'product' });
  const body = VALID.slice(CODE_PREFIX.length);
  for (const bad of [`BZB2.${body}`, `bzb1.${body}`, `BZ1.${body}`, `BZB1${body}`, body]) {
    assert.equal((await verify(bad)).reason, 'format', bad.slice(0, 8));
  }
  assert.equal((await verify(VALID + 'A')).reason, 'format');
  assert.equal((await verify(VALID.slice(0, -1))).reason, 'format');
  assert.equal((await verify(VALID + '=')).reason, 'format');
  const [pre, pay, sig] = VALID.split('.');
  assert.equal((await verify(`${pre}.${pay}==.${sig}`)).reason, 'format');
  assert.equal((await verify(`${pre}.${pay}.${sig}==`)).reason, 'format');
  assert.equal((await verify(`${pre}.${pay.replace(/-/g, '+')}.${sig.replace(/_/g, '/')}`)).ok, pay.includes('-') || sig.includes('_') ? false : true);
  assert.equal((await verify(VALID + ' '.repeat(MAX_INPUT))).reason, 'format');
  assert.equal((await verify('x'.repeat(10_000))).reason, 'format');
  for (const odd of [null, undefined, 42, {}, [], '', 'BZB1.', 'BZB1..']) assert.equal((await verify(odd)).ok, false);
  assert.deepEqual(parseCode(VALID + '\u0000'), { ok: false, reason: 'format' });
});

test('a code signed by another key fails; a browser without Ed25519 is told so, not "wrong"', async () => {
  assert.deepEqual(await verify(await makeCode({}, other.privateKey)), { ok: false, reason: 'signature' });
  assert.equal((await verifyCode(VALID, { publicKey: OTHER_PUB })).reason, 'signature');
  assert.equal((await verifyCode(VALID)).reason, 'signature'); // the real key never signed this test code
  const old = { importKey: async () => Promise.reject(new DOMException('Unrecognized name', 'NotSupportedError')), verify: async () => true };
  assert.deepEqual(await verify(VALID, { subtle: old }), { ok: false, reason: 'unsupported' });
  assert.deepEqual(await verify(VALID, { subtle: null }), { ok: false, reason: 'unsupported' });
  // a garbled code is "wrong" even in an old browser: the shape is checked first
  assert.equal((await verify('BZB1.nope', { subtle: old })).reason, 'format');
});

test('revocation: a revoked id is refused (after the signature), the list holds only ids', async () => {
  assert.deepEqual(await verify(VALID, { revoked: [ID_HEX] }), { ok: false, reason: 'revoked' });
  assert.deepEqual(await verify(VALID, { revoked: [ID_HEX.toUpperCase()] }), { ok: false, reason: 'revoked' });
  assert.equal((await verify(VALID, { revoked: ['ffffffffffffffffffff'] })).ok, true);
  // a forged code with a revoked id is "wrong", not "revoked"
  assert.equal((await verify(await makeCode({}, other.privateKey), { revoked: [ID_HEX] })).reason, 'signature');
  assert.ok(Array.isArray(REVOKED) && Object.isFrozen(REVOKED));
  for (const id of REVOKED) assert.match(id, /^[0-9a-f]{20}$/);
});

// ---------- the deep link ----------

function standIn(href, extra = {}) {
  const calls = [];
  const win = {
    location: new URL(href),
    history: {
      state: { k: 1 },
      replaceState(state, title, url) {
        calls.push(url);
        win.location = new URL(url, win.location.href);
      },
    },
    ...extra,
  };
  return { win, calls };
}

test('the deep link: #unlock= (the mail) and ?unlock= (before) are taken and removed, the rest stays', () => {
  const frag = standIn(`https://bazibo.nl/#unlock=${VALID}`);
  assert.equal(takeUnlockParam(frag.win), VALID);
  assert.deepEqual(frag.calls, ['/']);
  const fragTest = standIn(`https://bazibo.nl/?test&lang=en#unlock=${VALID}`);
  assert.equal(takeUnlockParam(fragTest.win), VALID);
  assert.deepEqual(fragTest.calls, ['/?test&lang=en']);
  const fragMore = standIn(`https://mwest2020.github.io/bazibo/#x=1&unlock=${VALID}`);
  assert.equal(takeUnlockParam(fragMore.win), VALID);
  assert.deepEqual(fragMore.calls, ['/bazibo/#x=1']);
  const { win, calls } = standIn(`https://bazibo.nl/?test&unlock=${VALID}&lang=en#top`);
  assert.equal(takeUnlockParam(win), VALID);
  assert.deepEqual(calls, ['/?test&lang=en#top']);
  assert.equal(win.location.href.includes('unlock'), false);
  // both: the fragment wins, both are removed
  const both = standIn(`https://bazibo.nl/?unlock=old#unlock=${VALID}`);
  assert.equal(takeUnlockParam(both.win), VALID);
  assert.deepEqual(both.calls, ['/']);
  assert.equal(takeUnlockParam(standIn('https://bazibo.nl/#top').win), null);
  const alone = standIn(`https://mwest2020.github.io/bazibo/?unlock=${VALID}`);
  assert.equal(takeUnlockParam(alone.win), VALID);
  assert.deepEqual(alone.calls, ['/bazibo/']);
  const none = standIn('https://bazibo.nl/?lang=nl');
  assert.equal(takeUnlockParam(none.win), null);
  assert.deepEqual(none.calls, []);
  const empty = standIn('https://bazibo.nl/?unlock=');
  assert.equal(takeUnlockParam(empty.win), '');
  assert.deepEqual(empty.calls, ['/']);
  const long = standIn(`https://bazibo.nl/?unlock=${'A'.repeat(5000)}`);
  assert.equal(takeUnlockParam(long.win).length, MAX_INPUT);
});

test('native hidden: in the app the deep link, the code and the BMC link do not exist', () => {
  const apps = [
    { Capacitor: { isNativePlatform: () => true }, href: `https://bazibo.nl/?unlock=${VALID}` },
    { Capacitor: { isNativePlatform: () => true }, href: `https://bazibo.nl/#unlock=${VALID}` },
    { href: `https://localhost/#unlock=${VALID}` },
    { href: `https://localhost/?unlock=${VALID}` },
    { href: `capacitor://localhost/?unlock=${VALID}` },
  ];
  for (const a of apps) {
    const { win, calls } = standIn(a.href, a.Capacitor ? { Capacitor: a.Capacitor } : {});
    assert.equal(webCodeAllowed(win), false, a.href);
    assert.equal(takeUnlockParam(win), null);
    assert.deepEqual(calls, [], 'the app leaves its address alone');
  }
  for (const href of ['https://bazibo.nl/', 'https://mwest2020.github.io/bazibo/', 'http://127.0.0.1:8080/']) {
    assert.equal(webCodeAllowed(standIn(href).win), true, href);
  }
  assert.equal(webCodeAllowed(null), false);
});

test('native hidden: main.js builds the code adapter only on the website, and the code UI only from it', () => {
  const main = readFileSync(join(WEB, 'js/main.js'), 'utf8');
  // the store in the app, the code only when not the app, otherwise nothing
  assert.match(main, /const billing = isNativeApp\(\)\s*\?\s*createNativeBilling\(\)\s*:\s*WEB_CODE\s*\?\s*createCodeBilling\(/);
  assert.match(main, /const WEB_CODE = webCodeAllowed\(window\);/);
  assert.equal(main.match(/createCodeBilling\(/g).length, 1);
  // every way to the code UI and the BMC link hangs on the code adapter
  assert.match(main, /if \(unlock\.kind === 'code'\) \{\s*\/\/ the website/);
  assert.match(main, /onCode: unlock\.kind === 'code' \?/);
  assert.match(main, /if \(unlock\.kind === 'code'\) \{\s*\/\/ the mail's link first/);
  assert.equal(main.match(/showWebFull\b/g).length, 2, 'showWebFull is defined once and reached once (behind askParent)');
  assert.match(main, /askParent\(showWebFull\)/);
  assert.equal(main.match(/openBuyMeACoffee\b/g).length, 2);
  // the static page has none of it: the parents' button and the BMC link exist only once JS puts them there
  const html = readFileSync(join(WEB, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /buymeacoffee|ik heb een code|BZB1/i);
  assert.match(html, /<div id="ov-parents" class="ov-parents" hidden><\/div>/);
  // Settings has a lasting way in for a parent with a code, built by JS for the code adapter only
  assert.match(main, /if \(unlock\.kind === 'code'\) codeButton\(\)\.hidden = unlock\.owned;/);
  assert.match(main, /askParent\(\(\) => askCode\(\)\)/);
  assert.doesNotMatch(html, /btn-code|settings\.haveCode/);
  // the mail's link in an open tab: listened to from the start, redeemed once ready, web only
  assert.match(main, /if \(WEB_CODE\) \{\s*window\.addEventListener\('hashchange'/);
});

test('only unlock-code.js names Buy Me a Coffee and the activation endpoint (and the CSP its host)', () => {
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|html|css|json|webmanifest)$/.test(f)) files.push(p);
    }
  };
  walk(WEB);
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    const rel = f.slice(WEB.length);
    if (/buymeacoffee\.com/i.test(s)) assert.equal(rel, 'js/unlock-code.js', `${rel} names Buy Me a Coffee's address`);
    const outsideWebOnly = s.replace(/<(section|li)\b[^>]*\bdata-web-only hidden>[\s\S]*?<\/\1>/g, '');
    if (/api\.westerweel\.work/.test(outsideWebOnly)) assert.ok(['js/unlock-code.js', 'index.html', 'js/app-csp.js'].includes(rel), `${rel} names the activation host`);
  }
});

test('native hidden: the parents\' pages speak of the web code only in data-web-only blocks, shown by store-links.js', () => {
  const pages = ['nl/privacy/index.html', 'en/privacy/index.html', 'nl/voorwaarden/index.html', 'en/terms/index.html'];
  for (const page of pages) {
    const s = readFileSync(join(WEB, page), 'utf8');
    assert.match(s, /data-web-only hidden/, `${page} has its web-only part`);
    assert.match(s, /<script type="module" src="\.\.\/\.\.\/js\/store-links\.js"><\/script>/, `${page} loads store-links.js`);
    assert.match(s, /script-src 'self'/);
    // every element that says data-web-only also ships hidden
    for (const m of s.matchAll(/<[a-z]+\b[^>]*data-web-only[^>]*>/g)) assert.match(m[0], /\bhidden\b/, `${page}: ${m[0]}`);
    const rest = s.replace(/<(section|li)\b[^>]*\bdata-web-only hidden>[\s\S]*?<\/\1>/g, '');
    assert.doesNotMatch(rest, /Buy Me a Coffee|buymeacoffee|api\.westerweel|met een code|with a .?1 code|code van/i, `${page}: the web code is mentioned where the app shows it`);
  }
});

test('the app\'s own CSP: app-csp.js adds connect-src \'self\' exactly where inApp is true', () => {
  const src = readFileSync(join(WEB, 'js/app-csp.js'), 'utf8');
  const cases = [
    { Capacitor: { isNativePlatform: () => true }, location: { protocol: 'https:', hostname: 'bazibo.nl' } },
    { location: { protocol: 'https:', hostname: 'localhost' } },
    { location: { protocol: 'capacitor:', hostname: 'localhost' } },
    { location: { protocol: 'https:', hostname: 'bazibo.nl' } },
    { location: { protocol: 'https:', hostname: 'mwest2020.github.io' } },
    { location: { protocol: 'http:', hostname: '127.0.0.1' } },
    { Capacitor: { isNativePlatform: () => false }, location: { protocol: 'https:', hostname: 'bazibo.nl' } },
  ];
  for (const win of cases) {
    const added = [];
    const document = {
      head: { appendChild: (el) => added.push(el) },
      createElement: () => ({ setAttribute() {} }),
    };
    vm.runInNewContext(src, { window: win, document });
    assert.equal(added.length, inApp(win) ? 1 : 0, JSON.stringify(win.location));
    if (added.length) {
      assert.equal(added[0].httpEquiv, 'Content-Security-Policy');
      assert.equal(added[0].content, "connect-src 'self'");
    }
  }
  const html = readFileSync(join(WEB, 'index.html'), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  const csp = head.indexOf('http-equiv="Content-Security-Policy"');
  const appCsp = head.indexOf('<script src="js/app-csp.js"></script>');
  assert.ok(csp > 0 && appCsp > csp, 'app-csp.js comes right after the CSP');
  assert.equal(head.slice(0, appCsp).includes('<script'), false, 'no script runs before app-csp.js');
  assert.match(head, /connect-src 'self' https:\/\/api\.westerweel\.work\/bazibo\/activate;/); // the one address, not the whole host
});

// ---------- activation ----------

function fakeFetch(answer) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (answer === 'throw') throw new TypeError('Failed to fetch');
    if (answer === 'hang') return new Promise(() => {});
    const [status, body] = Array.isArray(answer) ? answer : [answer, null];
    return { status, json: async () => (body === null ? Promise.reject(new SyntaxError('not JSON')) : body) };
  };
  fn.calls = calls;
  return fn;
}

test('activation: one POST with the code and the device id; 200, 409, 403 revoked and 400 count, anything else is "offline"', async () => {
  const f = fakeFetch([200, { status: 'ok' }]);
  assert.equal(await activate(VALID, 'd'.repeat(32), { fetchFn: f }), 'ok');
  assert.equal(f.calls.length, 1);
  const [{ url, init, body }] = f.calls;
  assert.equal(url, ACTIVATE_URL);
  assert.equal(init.method, 'POST');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.referrerPolicy, 'no-referrer');
  assert.deepEqual(body, { code: VALID, device: 'd'.repeat(32) });
  assert.deepEqual(Object.keys(body).sort(), ['code', 'device']);
  // the server's contract (internetnl-cli, 27 Nov 2026)
  assert.equal(await activate(VALID, 'x', { fetchFn: fakeFetch([409, { error: 'limit' }]) }), 'limit');
  assert.equal(await activate(VALID, 'x', { fetchFn: fakeFetch([403, { error: 'revoked' }]) }), 'revoked');
  assert.equal(await activate(VALID, 'x', { fetchFn: fakeFetch([400, { error: 'invalid' }]) }), 'invalid');
  for (const a of [[403, { error: 'origin' }], 403, [429, { error: 'rate' }], [503, { error: 'off' }], 503, 500, 502, 404, 'throw']) {
    assert.equal(await activate(VALID, 'x', { fetchFn: fakeFetch(a) }), 'offline', JSON.stringify(a));
  }
  const t0 = Date.now();
  assert.equal(await activate(VALID, 'x', { fetchFn: fakeFetch('hang'), timeoutMs: 60 }), 'offline');
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(await activate(VALID, 'x', { fetchFn: null }), 'offline'); // null, not undefined: undefined takes the default, the real fetch to our live server
});

test('the device id is random, 128 bits, made once and kept; never derived from the device', () => {
  const store = new Map();
  const ls = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const a = deviceId(ls);
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(store.get(DEVICE_KEY), a);
  assert.equal(deviceId(ls), a);
  store.set(DEVICE_KEY, 'not-an-id');
  const b = deviceId(ls);
  assert.match(b, /^[0-9a-f]{32}$/);
  assert.notEqual(b, a);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.match(deviceId(blocked), /^[0-9a-f]{32}$/);
  assert.equal(deviceId(ls, (n) => new Uint8Array(n).fill(0xab)), b, 'a kept id is reused');
});

// ---------- the adapter: the same path as a purchase ----------

function harness({ stored = null, answer = 'ok', online = true, revoked = [] } = {}) {
  let entry = stored;
  const acts = [];
  const refused = [];
  const billing = createCodeBilling({
    load: () => (entry ? { ...entry } : null),
    keep: (e) => (entry = e ? { ...e } : null),
    verify: (code) => verify(code, { revoked }),
    activate: async (code) => (acts.push(code), typeof answer === 'function' ? answer() : answer),
    online: () => online,
    onRefused: (r) => refused.push(r),
  });
  const unlock = createUnlock({ billing, cache: { get: () => false, set() {} } });
  return { billing, unlock, acts, refused, entry: () => entry };
}

test('entry: a valid code opens everything through createUnlock, like a purchase', async () => {
  const h = harness();
  assert.equal(h.unlock.kind, 'code');
  assert.equal(h.unlock.owned, false);
  const seen = [];
  h.unlock.onChange((o) => seen.push(o));
  const r = await h.unlock.redeem(VALID);
  assert.equal(r.ok, true);
  assert.equal(h.unlock.owned, true);
  assert.deepEqual(seen, [true]);
  assert.deepEqual(h.entry(), { code: VALID, activated: true, retried: false });
  assert.deepEqual(h.acts, [VALID]);
  // the same code again: counted already, no second call
  await h.unlock.redeem(VALID);
  assert.equal(h.acts.length, 1);
  // someone else's valid code (an ungated link) never replaces the device's own, nor calls
  const OTHER = await makeCode({ id: [7, 7, 7, 7, 7, 7, 7, 7, 7, 7] });
  assert.deepEqual(await h.unlock.redeem(OTHER), { ok: true, owned: true, already: true });
  assert.equal(h.entry().code, VALID);
  assert.equal(h.acts.length, 1);
  assert.deepEqual(await harness().unlock.buy(), { ok: false, reason: 'external' }); // bought in a new tab
});

test('entry: wrong, revoked, over the limit or too old a browser never opens and keeps nothing', async () => {
  for (const [code, opts, reason] of [
    ['BZB1.garbled', {}, 'format'],
    [VALID.slice(0, -2) + 'AA', {}, 'signature'],
    [VALID, { revoked: [ID_HEX] }, 'revoked'],
    [VALID, { answer: 'limit' }, 'limit'],
    [VALID, { answer: 'revoked' }, 'revoked'],
    [VALID, { answer: 'invalid' }, 'invalid'],
  ]) {
    const h = harness(opts);
    const r = await h.unlock.redeem(code);
    assert.deepEqual(r, { ok: false, reason }, reason);
    assert.equal(h.unlock.owned, false);
    assert.equal(h.entry(), null);
    if (reason === 'format' || reason === 'signature' || opts.revoked) assert.equal(h.acts.length, 0, 'no call for a code that fails offline');
  }
});

test('entry: our server away (network, timeout, 5xx, switched off) still opens; activated: false', async () => {
  const h = harness({ answer: 'offline' });
  const r = await h.unlock.redeem(VALID);
  assert.equal(r.ok, true);
  assert.equal(h.unlock.owned, true);
  assert.deepEqual(h.entry(), { code: VALID, activated: false, retried: false });
});

test('start: a kept, activated code is checked offline only and opens; nothing kept stays locked', async () => {
  const h = harness({ stored: { code: VALID, activated: true, retried: false } });
  await h.unlock.start();
  await h.billing.retrying;
  assert.equal(h.unlock.owned, true);
  assert.equal(h.acts.length, 0, 'no call after a successful activation');
  const none = harness();
  assert.deepEqual(await none.unlock.start(), { ok: true, owned: false });
  assert.equal(none.acts.length, 0, 'no call on a plain start');
});

test('start: a tampered kept code is refused and cleared; a revoked one says so', async () => {
  for (const bad of [VALID.slice(0, 20) + (VALID[20] === 'A' ? 'B' : 'A') + VALID.slice(21), 'BZB1.x', await makeCode({}, other.privateKey)]) {
    const h = harness({ stored: { code: bad, activated: true } });
    const r = await h.unlock.start();
    assert.equal(r.owned, false);
    assert.equal(h.unlock.owned, false);
    assert.equal(h.entry(), null);
    assert.equal(h.acts.length, 0);
  }
  const rv = harness({ stored: { code: VALID, activated: true }, revoked: [ID_HEX] });
  const r = await rv.unlock.start();
  assert.deepEqual(r, { ok: true, owned: false, reason: 'revoked' });
  assert.equal(rv.unlock.owned, false);
  assert.equal(rv.entry(), null);
});

test('start: a browser without Ed25519 keeps the code for a newer one, but does not open', async () => {
  let entry = { code: VALID, activated: true };
  const billing = createCodeBilling({
    load: () => entry,
    keep: (e) => (entry = e),
    verify: (code) => verifyCode(code, { publicKey: PUB, subtle: null }),
    activate: async () => 'ok',
  });
  const u = createUnlock({ billing, cache: { get: () => false, set() {} } });
  await u.start();
  assert.equal(u.owned, false);
  assert.equal(entry.code, VALID);
});

test('start: one quiet retry of an activation that could not reach the server', async () => {
  // opened while our server was away; now it answers
  const ok = harness({ stored: { code: VALID, activated: false, retried: false }, answer: 'ok' });
  await ok.unlock.start();
  assert.equal(ok.unlock.owned, true, 'open at once, the retry does not hold the start up');
  await ok.billing.retrying;
  assert.deepEqual(ok.entry(), { code: VALID, activated: true, retried: true });
  await ok.unlock.start();
  await ok.billing.retrying;
  assert.equal(ok.acts.length, 1, 'no more calls after that');

  // a parent's own entry counted it while the retry was out: the retry keeps activated
  let raceEntry = { code: VALID, activated: false, retried: false };
  const raceBilling = createCodeBilling({
    load: () => raceEntry,
    keep: (e) => (raceEntry = e),
    verify: (code) => verify(code),
    activate: async () => ((raceEntry = { code: VALID, activated: true, retried: false }), 'offline'),
  });
  await raceBilling.start();
  await raceBilling.retrying;
  assert.equal(raceEntry.activated, true);

  // a late 400 "invalid" never closes a child out: like away, given up
  const inv = harness({ stored: { code: VALID, activated: false, retried: false }, answer: 'invalid' });
  await inv.unlock.start();
  await inv.billing.retrying;
  assert.equal(inv.unlock.owned, true);
  assert.deepEqual(inv.entry(), { code: VALID, activated: false, retried: true });

  // still away: stays open, never tried again
  const away = harness({ stored: { code: VALID, activated: false, retried: false }, answer: 'offline' });
  await away.unlock.start();
  await away.billing.retrying;
  assert.equal(away.unlock.owned, true);
  assert.deepEqual(away.entry(), { code: VALID, activated: false, retried: true });
  await away.unlock.start();
  await away.billing.retrying;
  assert.equal(away.acts.length, 1);

  // offline at start: not tried, not used up
  const off = harness({ stored: { code: VALID, activated: false, retried: false }, online: false });
  await off.unlock.start();
  await off.billing.retrying;
  assert.equal(off.acts.length, 0);
  assert.equal(off.entry().retried, false);
  assert.equal(off.unlock.owned, true);

  // the server says the limit is reached (or revoked): closed again, and the shell says why
  for (const answer of ['limit', 'revoked']) {
    const h = harness({ stored: { code: VALID, activated: false, retried: false }, answer });
    const seen = [];
    h.unlock.onChange((o) => seen.push(o));
    await h.unlock.start();
    await h.billing.retrying;
    assert.equal(h.unlock.owned, false, answer);
    assert.deepEqual(seen, [true, false]);
    assert.equal(h.entry(), null);
    assert.deepEqual(h.refused, [answer]);
  }
});

// ---------- the save and Voortgang overzetten ----------

function memoryBackend(initial = null) {
  const data = new Map(initial ? [[storage.SAVE_KEY, initial]] : []);
  return { name: 'memory', get: async (k) => data.get(k) ?? null, set: async (k, v) => data.set(k, v), data };
}

test('the save keeps the code with its activation state, and a merge after a failed read keeps it', async () => {
  const b = memoryBackend();
  await storage.init({ backend: b, legacyStorage: null });
  assert.equal(storage.loadWebUnlock(), null);
  storage.saveWebUnlock({ code: VALID, activated: true, retried: false });
  await storage.flushed();
  assert.deepEqual(JSON.parse(b.data.get(storage.SAVE_KEY)).webUnlock, { code: VALID, activated: true, retried: false });
  await storage.init({ backend: b, legacyStorage: null });
  assert.deepEqual(storage.loadWebUnlock(), { code: VALID, activated: true, retried: false });
  storage.saveWebUnlock(null);
  await storage.flushed();
  assert.equal('webUnlock' in JSON.parse(b.data.get(storage.SAVE_KEY)), false);
  const merged = storage.mergeSaves(storage.emptySave(), { ...storage.emptySave(), webUnlock: { code: VALID, activated: false } }, false);
  assert.equal(merged.webUnlock.code, VALID);
});

test('transfer round trip: the code travels, is checked for shape, counts as a new device; the purchase never', async () => {
  const sender = { ...storage.emptySave(), games: { bubbels: { stars: { 1: 3 } } }, purchase: { owned: true }, webUnlock: { code: VALID, activated: true, retried: false } };
  const payload = await decodeText(await encodeSave(sender));
  assert.equal(payload.unlockCode, VALID);
  assert.equal('purchase' in payload, false);
  assert.equal('webUnlock' in payload, false, 'the activation state stays with the sender');

  const receiver = storage.emptySave();
  for (const out of [mergeTransfer(receiver, payload), replaceTransfer(receiver, payload)]) {
    assert.deepEqual(out.webUnlock, { code: VALID, activated: false, retried: false });
    assert.deepEqual(out.purchase, { owned: false });
    // ...and it opens there through the normal start (the one activation for that device)
    const h = harness({ stored: out.webUnlock });
    await h.unlock.start();
    await h.billing.retrying;
    assert.equal(h.unlock.owned, true);
    assert.deepEqual(h.acts, [VALID]);
  }
  // a device with its own code keeps it
  const OTHER = await makeCode({ id: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9] });
  const own = { ...storage.emptySave(), webUnlock: { code: OTHER, activated: true, retried: false } };
  assert.equal(mergeTransfer(own, payload).webUnlock.code, OTHER);
  assert.equal(replaceTransfer(own, payload).webUnlock.code, OTHER);
  // the app neither keeps nor sends on a web code (transfer-ui.js passes withCode: false there)
  assert.equal('webUnlock' in mergeTransfer(receiver, payload, { withCode: false }), false);
  assert.equal('webUnlock' in replaceTransfer(receiver, payload, { withCode: false }), false);
  // without a code nothing is added
  const plain = await decodeText(await encodeSave(storage.emptySave()));
  assert.equal('unlockCode' in plain, false);
  assert.equal('webUnlock' in mergeTransfer(storage.emptySave(), plain), false);
});

test('sanitizePayload: only a code of the exact shape gets through; a forged one is stopped at start', async () => {
  const base = payloadOf(storage.emptySave());
  for (const bad of ['BZB1.x', `${VALID}A`, ` ${VALID}`, `https://bazibo.nl/?unlock=${VALID}`, 42, { code: VALID }, ['x'], 'x'.repeat(5000), VALID.replace('BZB1', 'BZB2')]) {
    assert.equal('unlockCode' in sanitizePayload({ ...base, unlockCode: bad }), false, String(bad).slice(0, 20));
  }
  assert.equal(sanitizePayload({ ...base, unlockCode: VALID }).unlockCode, VALID);
  // the shape is right but the signature is not: it travels, and never opens anything
  const forged = await makeCode({}, other.privateKey);
  const p = sanitizePayload({ ...base, unlockCode: forged });
  const h = harness({ stored: mergeTransfer(storage.emptySave(), p).webUnlock });
  await h.unlock.start();
  assert.equal(h.unlock.owned, false);
  assert.equal(h.entry(), null);
});
