// Vier op een rij on two phones (spike, only with ?test&coop): the code one phone shows as a QR
// and the other scans, so two WebRTC peers find each other with no server, no internet and no
// STUN or TURN. Pure, so it can be tested without a browser.
//
// Not the whole SDP travels, only what cannot be guessed (docs/design/coop-qr-webrtc.md):
//   blob = [version 1 << 4 | kind (1 offer, 2 answer)]
//          [session id, 4 bytes]                       (the answer repeats the offer's)
//          offer only: [board bit 0 | token 1 << 1 (3 bits) | token 2 << 4 (3 bits)]
//          [ufrag length][ufrag][pwd length][pwd]     (ice-char only)
//          [DTLS fingerprint, sha-256, 32 bytes]
//          [candidate count 1..4] then per candidate [kind 1 = mDNS name, 4 = IPv4, 6 = IPv6]
//          [16 or 4 bytes of address][port, 2 bytes]
//          [CRC-32 of everything before it, 4 bytes]
//   text = 'BZV' + base45(blob)                        (QR alphanumeric, like transfer.js)
// The receiver rebuilds a full SDP from these fields alone (`buildSdp`). Everything that comes in
// through the camera is untrusted: `decodeSignal` checks the length, the checksum and the shape of
// every field and drops anything else. Only host candidates on the local network get through: an
// mDNS name, a private or link-local IPv4 address, a link-local or unique-local IPv6 address. So a
// code can never make the phone send a packet to an address on the internet.
import { base45Encode, base45Decode, crc32 } from '../../js/transfer.js';
import { TOKENS } from './art.js';

export const SIGNAL_VERSION = 1;
export const KIND = Object.freeze({ offer: 1, answer: 2 });
export const PREFIX = 'BZV';
export const MAX_CANDIDATES = 4;
const UFRAG_RE = /^[A-Za-z0-9+/]{4,32}$/; // RFC 8839 ice-char, the lengths Chrome and Firefox use
const PWD_RE = /^[A-Za-z0-9+/]{22,64}$/;
const FP_BYTES = 32;
const BOARD_IDS = ['big', 'small'];
// the longest blob: header 5, setup 1, ufrag 33, pwd 65, fingerprint 32, count 1, 4 IPv6/mDNS
// candidates of 19, CRC 4
export const MAX_BLOB = 5 + 1 + 33 + 65 + FP_BYTES + 1 + MAX_CANDIDATES * 19 + 4;
export const MAX_TEXT = PREFIX.length + Math.ceil(MAX_BLOB / 2) * 3;
// the shortest: an answer with a 4-character ufrag, a 22-character pwd and one IPv4 candidate
export const MIN_BLOB = 5 + 5 + 23 + FP_BYTES + 1 + 7 + 4;
const TEXT_RE = /^BZV[0-9A-Z $%*+\-./:]+$/;

// ---------- reading our own SDP ----------

const UUID_RE = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i;

/** Is this IPv4 address on a local network (private or link-local)? `b`: four numbers. */
export function localIPv4(b) {
  if (b.length !== 4 || b.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  return b[0] === 10 || (b[0] === 172 && b[1] >= 16 && b[1] <= 31) || (b[0] === 192 && b[1] === 168) || (b[0] === 169 && b[1] === 254 && b[2] > 0 && b[2] < 255);
}

/** Is this IPv6 address link-local (fe80::/10) or unique-local (fc00::/7)? `b`: sixteen bytes. */
export function localIPv6(b) {
  if (b.length !== 16) return false;
  return (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) || (b[0] & 0xfe) === 0xfc;
}

function parseIPv4(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  return m ? m.slice(1).map(Number) : null;
}

function parseIPv6(s) {
  if (!/^[0-9a-f:]+$/i.test(s) || s.length > 39) return null; // no zone ids, no embedded IPv4
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const words = (h) => (h ? h.split(':') : []);
  const head = words(halves[0]);
  const tail = halves.length === 2 ? words(halves[1]) : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return null;
  const all = [...head, ...new Array(halves.length === 2 ? fill : 0).fill('0'), ...tail];
  if (all.some((w) => !/^[0-9a-f]{1,4}$/i.test(w))) return null;
  const out = [];
  for (const w of all) {
    const n = parseInt(w, 16);
    out.push(n >> 8, n & 0xff);
  }
  return out;
}

const hex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');

function formatIPv6(b) {
  const words = [];
  for (let i = 0; i < 16; i += 2) words.push(((b[i] << 8) | b[i + 1]).toString(16));
  return words.join(':'); // uncompressed is valid SDP and needs no care with '::'
}

/** One `a=candidate:` line -> { kind, addr (bytes), port } when it is a local UDP host candidate. */
export function parseCandidate(line) {
  const m = /^a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ host(?: |$)/i.exec(line.trim());
  if (!m) return null;
  const port = Number(m[2]);
  if (!(port >= 1 && port <= 65535)) return null;
  const u = UUID_RE.exec(m[1]);
  if (u) {
    const h = u.slice(1).join('');
    const addr = [];
    for (let i = 0; i < 32; i += 2) addr.push(parseInt(h.slice(i, i + 2), 16));
    return { kind: 1, addr, port };
  }
  const v4 = parseIPv4(m[1]);
  if (v4) return localIPv4(v4) ? { kind: 4, addr: v4, port } : null;
  const v6 = parseIPv6(m[1]);
  if (v6) return localIPv6(v6) ? { kind: 6, addr: v6, port } : null;
  return null;
}

/**
 * Our own local description -> the fields that travel. Throws 'no-network' when there is no local
 * host candidate (no Wi-Fi), 'sdp' when the description is not one we can describe.
 */
export function fieldsFromSdp(sdp) {
  const lines = String(sdp || '').split(/\r?\n/);
  const get = (re) => {
    for (const l of lines) {
      const m = re.exec(l);
      if (m) return m[1];
    }
    return null;
  };
  const ufrag = get(/^a=ice-ufrag:(\S+)$/);
  const pwd = get(/^a=ice-pwd:(\S+)$/);
  const fp = get(/^a=fingerprint:sha-256 ([0-9A-Fa-f:]+)$/);
  const setup = get(/^a=setup:(\S+)$/);
  if (!ufrag || !UFRAG_RE.test(ufrag) || !pwd || !PWD_RE.test(pwd) || !fp || !setup) throw new Error('sdp');
  const fingerprint = fp.split(':').map((h) => parseInt(h, 16));
  if (fingerprint.length !== FP_BYTES || fingerprint.some((x) => !(x >= 0 && x <= 255))) throw new Error('sdp');
  const seen = new Set();
  const candidates = [];
  for (const l of lines) {
    const c = l.startsWith('a=candidate:') ? parseCandidate(l) : null;
    if (!c) continue;
    const key = `${c.kind}/${hex(c.addr)}/${c.port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(c);
  }
  // mDNS names and IPv4 first: they work on most home Wi-Fi
  candidates.sort((a, b) => (a.kind === 6) - (b.kind === 6));
  if (!candidates.length) throw new Error('no-network');
  return { ufrag, pwd, fingerprint, setup, candidates: candidates.slice(0, MAX_CANDIDATES) };
}

// ---------- the code ----------

/**
 * Fields -> the QR text. `msg`: { kind: 'offer'|'answer', session (uint32), ufrag, pwd,
 * fingerprint (32 bytes), candidates, board?, tokens? } (board and tokens for an offer).
 */
export function encodeSignal(msg) {
  const k = KIND[msg.kind];
  if (!k) throw new Error('kind');
  const out = [(SIGNAL_VERSION << 4) | k];
  const s = msg.session >>> 0;
  out.push(s >>> 24, (s >>> 16) & 0xff, (s >>> 8) & 0xff, s & 0xff);
  if (k === KIND.offer) {
    const b = BOARD_IDS.indexOf(msg.board);
    const t1 = TOKENS.findIndex((x) => x.id === msg.tokens?.[0]);
    const t2 = TOKENS.findIndex((x) => x.id === msg.tokens?.[1]);
    if (b < 0 || t1 < 0 || t2 < 0 || t1 === t2) throw new Error('setup');
    out.push(b | (t1 << 1) | (t2 << 4));
  }
  if (!UFRAG_RE.test(msg.ufrag) || !PWD_RE.test(msg.pwd)) throw new Error('ice');
  for (const str of [msg.ufrag, msg.pwd]) {
    out.push(str.length);
    for (const ch of str) out.push(ch.charCodeAt(0));
  }
  if (msg.fingerprint?.length !== FP_BYTES) throw new Error('fingerprint');
  out.push(...msg.fingerprint);
  const cands = (msg.candidates || []).slice(0, MAX_CANDIDATES);
  if (!cands.length) throw new Error('no-network');
  out.push(cands.length);
  for (const c of cands) {
    const len = c.kind === 4 ? 4 : 16;
    if (![1, 4, 6].includes(c.kind) || c.addr.length !== len) throw new Error('candidate');
    out.push(c.kind, ...c.addr, c.port >> 8, c.port & 0xff);
  }
  const crc = crc32(Uint8Array.from(out));
  out.push(crc >>> 24, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff);
  return PREFIX + base45Encode(Uint8Array.from(out));
}

/**
 * The QR text -> checked fields, or throws an Error whose message is one of 'not-ours' (some other
 * QR code), 'version', 'checksum', 'content'. `want`: 'offer' or 'answer'; the other kind throws
 * 'wrong-kind' (the child scanned the wrong phone's code). Never trusts a length it did not check.
 */
export function decodeSignal(text, want) {
  const s = typeof text === 'string' ? text.trim() : '';
  if (s.length > MAX_TEXT || !TEXT_RE.test(s)) throw new Error('not-ours');
  let blob;
  try {
    blob = base45Decode(s.slice(PREFIX.length));
  } catch {
    throw new Error('not-ours');
  }
  if (blob.length < MIN_BLOB || blob.length > MAX_BLOB) throw new Error('content');
  const body = blob.subarray(0, blob.length - 4);
  const want32 = ((blob[blob.length - 4] << 24) | (blob[blob.length - 3] << 16) | (blob[blob.length - 2] << 8) | blob[blob.length - 1]) >>> 0;
  if (crc32(body) !== want32) throw new Error('checksum');
  let at = 0;
  const need = (n) => {
    if (at + n > body.length) throw new Error('content');
    const part = body.subarray(at, at + n);
    at += n;
    return part;
  };
  const head = need(1)[0];
  if (head >> 4 !== SIGNAL_VERSION) throw new Error('version');
  const kind = head & 0x0f;
  if (kind !== KIND.offer && kind !== KIND.answer) throw new Error('content');
  const kindName = kind === KIND.offer ? 'offer' : 'answer';
  if (want && want !== kindName) throw new Error('wrong-kind');
  const sb = need(4);
  const out = { kind: kindName, session: ((sb[0] << 24) | (sb[1] << 16) | (sb[2] << 8) | sb[3]) >>> 0 };
  if (kind === KIND.offer) {
    const v = need(1)[0];
    const t1 = (v >> 1) & 7;
    const t2 = (v >> 4) & 7;
    if (v & 0x80 || t1 >= TOKENS.length || t2 >= TOKENS.length || t1 === t2) throw new Error('content');
    out.board = BOARD_IDS[v & 1];
    out.tokens = [TOKENS[t1].id, TOKENS[t2].id];
  }
  const str = (re) => {
    const n = need(1)[0];
    const v = String.fromCharCode(...need(n));
    if (!re.test(v)) throw new Error('content');
    return v;
  };
  out.ufrag = str(UFRAG_RE);
  out.pwd = str(PWD_RE);
  out.fingerprint = Array.from(need(FP_BYTES));
  const n = need(1)[0];
  if (n < 1 || n > MAX_CANDIDATES) throw new Error('content');
  out.candidates = [];
  for (let i = 0; i < n; i++) {
    const ck = need(1)[0];
    if (ck !== 1 && ck !== 4 && ck !== 6) throw new Error('content');
    const addr = Array.from(need(ck === 4 ? 4 : 16));
    const pb = need(2);
    const port = (pb[0] << 8) | pb[1];
    if (port < 1) throw new Error('content');
    if (ck === 4 && !localIPv4(addr)) throw new Error('content');
    if (ck === 6 && !localIPv6(addr)) throw new Error('content');
    out.candidates.push({ kind: ck, addr, port });
  }
  if (at !== body.length) throw new Error('content'); // nothing may trail
  return out;
}

/** The address a candidate is written with in SDP. */
export function candidateAddress(c) {
  if (c.kind === 4) return c.addr.join('.');
  if (c.kind === 6) return formatIPv6(c.addr);
  const h = hex(c.addr);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}.local`;
}

/**
 * Checked fields -> a whole SDP for setRemoteDescription. Only the fields that were checked go
 * in; everything else is fixed: one data channel (mid 0, SCTP over DTLS), DTLS role actpass in an
 * offer and active in an answer (what Chrome answers), host UDP candidates.
 */
export function buildSdp(f) {
  const fp = f.fingerprint.map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(':');
  const lines = [
    'v=0',
    `o=- ${(f.session >>> 0) + 1} 2 IN IP4 127.0.0.1`,
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
  ];
  f.candidates.forEach((c, i) => {
    lines.push(`a=candidate:${i + 1} 1 udp ${2113937151 - i * 256} ${candidateAddress(c)} ${c.port} typ host generation 0`);
  });
  lines.push(
    'a=end-of-candidates',
    `a=ice-ufrag:${f.ufrag}`,
    `a=ice-pwd:${f.pwd}`,
    `a=fingerprint:sha-256 ${fp}`,
    `a=setup:${f.kind === 'offer' ? 'actpass' : 'active'}`,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  );
  return lines.join('\r\n') + '\r\n';
}

/** A fresh session id (uint32). */
export function newSession() {
  const c = globalThis.crypto;
  return c?.getRandomValues ? c.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 2 ** 32) >>> 0;
}
