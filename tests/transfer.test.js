import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  base45Encode,
  base45Decode,
  crc32,
  encodeSave,
  decodeText,
  splitParts,
  saveToParts,
  createCollector,
  partsFromText,
  parsePart,
  sanitizePayload,
  mergeTransfer,
  replaceTransfer,
  summarize,
  payloadOf,
  MAX_PARTS,
  PART_CHARS,
  MAX_CHUNK,
} from '../web/js/transfer.js';
import { emptySave } from '../web/js/storage.js';

const typical = () => ({
  version: 1,
  games: {
    bubbels: { stars: { 1: 3, 2: 2, 3: 1 }, random: { easy: 4 } },
    dogudoku: { stars: { 1: 3, 13: 2 }, autoCross: true, howSeen: { tiny: true } },
    vier: { stars: { 'cpu-big-1': 5 }, setup: { board: 'big', mode: 'cpu', level: 1 }, tokens: ['pup', 'bubble'] },
    kleuren: { art: { 'p:zon': { f: { face: 7, ray0: 2 }, t: 1000, done: true }, 'm:m1:1101': { t: 2000, gone: true, c: 1 } } },
    klok: { stars: { 'set-t1-1': 3 } },
  },
  settings: { muted: true, lang: 'en' },
  purchase: { owned: true },
});

/** A big save: many mandalas with many regions, like a busy colouring gallery. */
function big(pages = 30, regions = 250) {
  const s = typical();
  const art = {};
  for (let p = 0; p < pages; p++) {
    const f = {};
    for (let r = 0; r < regions; r++) f[`b${r % 9}w${r}`] = (r * 7 + p) % 16;
    art[`m:m2:${100000 + p * 7919}`] = { f, t: 1e12 + p, done: p % 2 === 0 };
  }
  s.games.kleuren.art = art;
  return s;
}

test('base45 round-trips every byte value (RFC 9285 examples too)', () => {
  assert.equal(base45Encode(new TextEncoder().encode('AB')), 'BB8');
  assert.equal(base45Encode(new TextEncoder().encode('Hello!!')), '%69 VD92EX0');
  assert.equal(new TextDecoder().decode(base45Decode('QED8WEX0')), 'ietf!');
  const all = Uint8Array.from({ length: 257 }, (_, i) => i % 256);
  assert.deepEqual(base45Decode(base45Encode(all)), all);
  assert.throws(() => base45Decode('GGW'), /bad triple/); // 65535 + 1: over the top
  assert.throws(() => base45Decode('a'), /bad character|bad length/);
});

test('crc32 matches the known check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('empty, typical and large saves survive the trip; the purchase never travels', async () => {
  for (const save of [emptySave(), typical(), big(12, 120)]) {
    const text = await encodeSave(save);
    assert.match(text, /^[0-9A-Z $%*+\-./:]+$/);
    const back = await decodeText(text);
    assert.deepEqual(back.games, sanitizePayload(payloadOf(save)).games);
    assert.equal('purchase' in back, false);
  }
});

test('a save is split into parts and joined again in any order', async () => {
  const parts = await saveToParts(big(12, 120));
  assert.ok(parts.length > 1, `expected more than one part, got ${parts.length}`);
  for (const p of parts) assert.ok(parsePart(p), p.slice(0, 20));
  const shuffled = parts.slice().reverse();
  shuffled.splice(1, 0, shuffled[0]); // a duplicate scan
  const c = createCollector();
  let last;
  for (const p of shuffled) last = c.add(p);
  assert.equal(last, 'complete');
  const back = await decodeText(c.text());
  assert.equal(Object.keys(back.games.kleuren.art).length, 12);
});

test('parts of another send are refused; strangers are ignored', async () => {
  const a = splitParts('A'.repeat(PART_CHARS * 2), 'AAAA');
  const b = splitParts('B'.repeat(PART_CHARS * 2), 'BBBB');
  const c = createCollector();
  assert.equal(c.add(a[0]), 'added');
  assert.equal(c.add(b[1]), 'other-set');
  assert.equal(c.add('https://example.com'), 'not-ours');
  assert.equal(c.add(a[0]), 'dup');
  assert.deepEqual(c.missing(), [2]);
  assert.equal(c.add(a[1]), 'complete');
});

test('pasted text: one part per line, or parts separated by spaces', () => {
  const parts = splitParts('X'.repeat(PART_CHARS * 3), '0F0F');
  assert.deepEqual(partsFromText(parts.join('\n')), parts);
  assert.deepEqual(partsFromText(parts.join(' ')), parts);
  assert.deepEqual(partsFromText(`  ${parts[0]}  \r\n\r\n${parts[1]}`), parts.slice(0, 2));
});

test('too big for MAX_PARTS codes, and a smaller code without colouring pages', async () => {
  assert.throws(() => splitParts('Z'.repeat(PART_CHARS * MAX_PARTS + 1)), /too-big/);
  const huge = big(30, 1000);
  await assert.rejects(saveToParts(huge), /too-big/);
  const parts = await saveToParts(huge, { withArt: false });
  assert.ok(parts.length <= 2);
});

test('a damaged code is refused by its checksum; other versions and garbage are refused', async () => {
  const text = await encodeSave(typical());
  // flip one byte of the body
  const bytes = base45Decode(text);
  bytes[bytes.length - 1] ^= 0x5a;
  await assert.rejects(decodeText(base45Encode(bytes)), /checksum|format/);
  const raw = base45Decode(text);
  raw[0] = 9;
  await assert.rejects(decodeText(base45Encode(raw)), /version/);
  await assert.rejects(decodeText('NOT BASE45 at all'), /format/);
  await assert.rejects(decodeText('00'), /format/);
});

test('a code that unpacks to a mountain is refused (zip bomb)', async () => {
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, games: { bubbels: { stars: {} } }, pad: 'x'.repeat(2_000_000) }));
  const packed = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const crc = crc32(json);
  const blob = new Uint8Array(6 + packed.length);
  blob.set([1, 1, crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255]);
  blob.set(packed, 6);
  await assert.rejects(decodeText(base45Encode(blob)), /too-big/);
});

test('a code from a newer save version is refused, not misread', async () => {
  const json = new TextEncoder().encode(JSON.stringify({ v: 99, games: {} }));
  const crc = crc32(json);
  const blob = new Uint8Array(6 + json.length);
  blob.set([1, 0, crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255]);
  blob.set(json, 6);
  await assert.rejects(decodeText(base45Encode(blob)), /version/);
});

test('sanitizing drops anything of the wrong shape and never throws', () => {
  const evil = {
    v: 1,
    games: {
      bubbels: { stars: { 1: 3, 2: 'x', 3: -1, 4: 1e99, '__proto__': 3, 'a b': 2 }, random: { easy: NaN } },
      'Bad Id': { stars: { 1: 3 } },
      kleuren: { art: { 'p:zon': { f: { face: 7, ray: 999, 'x y': 1 }, t: 'soon' }, 'p:x': 'nope', 'p:empty': { f: {} } } },
      vier: { setup: { board: 'big', deep: { no: 1 } }, tokens: Array(40).fill('a'), fn: () => 1 },
      klok: 'not an object',
    },
    settings: { muted: 'yes', lang: 'de' },
  };
  const clean = sanitizePayload(evil);
  assert.deepEqual(clean.games.bubbels.stars, { 1: 3, 4: 1e6 });
  assert.deepEqual(clean.games.bubbels.random, {});
  assert.equal('Bad Id' in clean.games, false);
  assert.equal('klok' in clean.games, false);
  assert.deepEqual(clean.games.kleuren.art, { 'p:zon': { f: { face: 7 }, t: 0, done: false } });
  assert.deepEqual(clean.games.vier.setup, { board: 'big' });
  assert.equal('tokens' in clean.games.vier, false);
  assert.deepEqual(clean.settings, { muted: false, lang: null });
  assert.equal(Object.getPrototypeOf(clean.games.bubbels.stars), Object.prototype);
  for (const odd of [null, 1, 'x', [], { games: 'x' }, { games: { a: [] } }]) assert.doesNotThrow(() => sanitizePayload(odd || {}));
  const proto = sanitizePayload(JSON.parse('{"v":1,"games":{"kleuren":{"art":{"__proto__":{"f":{"a":1},"t":1}},"stars":{"__proto__":3,"constructor":2}}}}'));
  assert.deepEqual(Object.keys(proto.games.kleuren.art), []);
  assert.equal(Object.getPrototypeOf(proto.games.kleuren.art), Object.prototype);
  assert.deepEqual(proto.games.kleuren.stars, {});
});

test('merge keeps the best of both; settings and purchase stay this device\'s', () => {
  const mine = {
    version: 1,
    games: {
      bubbels: { stars: { 1: 1, 2: 3, 9: 2 }, random: { easy: 10 } },
      dogudoku: { stars: { 1: 1 }, autoCross: false },
      kleuren: { art: { 'p:zon': { f: { face: 1, ray1: 4 }, t: 500, done: false } } },
    },
    settings: { muted: false, lang: 'nl' },
    purchase: { owned: false },
  };
  const incoming = sanitizePayload(payloadOf(typical()));
  const out = mergeTransfer(mine, incoming);
  assert.deepEqual(out.games.bubbels.stars, { 1: 3, 2: 3, 3: 1, 9: 2 });
  assert.deepEqual(out.games.bubbels.random, { easy: 10 }); // the higher count, not the sum
  assert.equal(out.games.dogudoku.autoCross, false); // this device's option stays
  assert.deepEqual(out.games.dogudoku.howSeen, { tiny: true });
  assert.deepEqual(out.games.vier.tokens, ['pup', 'bubble']); // a missing option is taken
  assert.deepEqual(out.games.kleuren.art['p:zon'].f, { face: 7, ray0: 2, ray1: 4 }); // newer wins per region
  assert.equal(out.games.kleuren.art['m:m1:1101'].gone, true);
  assert.deepEqual(out.settings, { muted: false, lang: 'nl' });
  assert.equal(out.purchase.owned, false);
  // merging the same code twice changes nothing more
  assert.deepEqual(mergeTransfer(out, incoming), out);
});

test('replace takes the progress and settings that came in, never the purchase', () => {
  const mine = { version: 1, games: { bubbels: { stars: { 1: 3, 2: 3 } } }, settings: { muted: false, lang: 'nl' }, purchase: { owned: true } };
  const incoming = sanitizePayload({ v: 1, games: { klok: { stars: { 'set-t1-1': 2 } } }, settings: { muted: true, lang: 'en' } });
  const out = replaceTransfer(mine, incoming);
  assert.deepEqual(out.games, { klok: { stars: { 'set-t1-1': 2 } } });
  assert.deepEqual(out.settings, { muted: true, lang: 'en' });
  assert.equal(out.purchase.owned, true);
});

test('the summary counts levels, pages and random rounds per game', () => {
  const s = summarize(sanitizePayload(payloadOf(typical())));
  assert.deepEqual(s, [
    { id: 'bubbels', n: 7 },
    { id: 'dogudoku', n: 2 },
    { id: 'vier', n: 1 },
    { id: 'kleuren', n: 1 },
    { id: 'klok', n: 1 },
  ]);
});

test('without DecompressionStream (iOS before 16.4) the vendored fflate unpacks, with the same cap', async () => {
  const text = await encodeSave(typical());
  const saved = globalThis.DecompressionStream;
  globalThis.DecompressionStream = undefined;
  try {
    const back = await decodeText(text);
    assert.deepEqual(back.games.bubbels.stars, { 1: 3, 2: 2, 3: 1 });
    const json = new TextEncoder().encode(JSON.stringify({ v: 1, games: {}, pad: 'x'.repeat(2_000_000) }));
    const packed = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    const crc = crc32(json);
    const blob = new Uint8Array(6 + packed.length);
    blob.set([1, 1, crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255]);
    blob.set(packed, 6);
    await assert.rejects(decodeText(base45Encode(blob)), /too-big/);
  } finally {
    globalThis.DecompressionStream = saved;
  }
});

test('a part is a whole number of base45 groups, and fits a version-13 QR code at level L', () => {
  assert.equal(PART_CHARS % 3, 0);
  const [p] = splitParts('A'.repeat(PART_CHARS), 'ABCD');
  assert.ok(p.length <= 619, `part is ${p.length} characters`); // alphanumeric capacity of 13-L
  assert.ok(MAX_CHUNK >= PART_CHARS);
  assert.equal(parsePart(`BZ1ABCD0101:${'A'.repeat(MAX_CHUNK + 1)}`), null);
});

test('replace with a code made without colouring pages keeps the receiver\'s pages', async () => {
  const mine = { version: 1, games: { kleuren: { art: { 'p:zon': { f: { face: 2 }, t: 5, done: true } } }, bubbels: { stars: { 1: 1 } } }, settings: {}, purchase: { owned: false } };
  const back = await decodeText(await encodeSave(typical(), { withArt: false }));
  assert.equal(back.noArt, true);
  const out = replaceTransfer(mine, back);
  assert.deepEqual(out.games.kleuren.art, mine.games.kleuren.art);
  assert.deepEqual(out.games.bubbels.stars, { 1: 3, 2: 2, 3: 1 });
  const full = await decodeText(await encodeSave(typical()));
  assert.equal(full.noArt, false);
  assert.equal('p:zon' in replaceTransfer(mine, full).games.kleuren.art, true); // the code's own page
});

test('paste parsing is linear on long blanks and splits at an embedded header only', () => {
  const t0 = Date.now();
  assert.deepEqual(partsFromText(' '.repeat(60000)), []);
  assert.deepEqual(partsFromText('x' + ' '.repeat(60000) + 'y'), ['x' + ' '.repeat(60000) + 'y'].map((s) => s.trim()));
  assert.ok(Date.now() - t0 < 500, 'too slow');
  const [a, b] = splitParts('Q'.repeat(PART_CHARS + 3), 'C0DE');
  assert.deepEqual(partsFromText(`${a} ${b}`), [a, b]);
  assert.deepEqual(partsFromText(`${a}  hello BZ1 not a header`), [`${a}  hello BZ1 not a header`]);
});

test('sanitizing: names that Object.prototype has are dropped, flags keep only true, far-future times are clamped', () => {
  const clean = sanitizePayload({
    v: 1,
    games: {
      dogudoku: { howSeen: { tiny: true, small: false, toString: true }, stars: { constructor: 3, valueOf: 2, hasOwnProperty: 1, 7: 2 } },
      vier: { setup: { board: 'constructor' } },
      kleuren: { art: { 'p:zon': { f: { face: 1 }, t: 9e15 } } },
    },
  });
  assert.deepEqual(clean.games.dogudoku.howSeen, { tiny: true });
  assert.deepEqual(clean.games.dogudoku.stars, { 7: 2 });
  assert.ok(clean.games.kleuren.art['p:zon'].t <= Date.now() + 864e5);
});
