// Vier op een rij on two phones (spike, ?test&coop): the code that travels as a QR code
// (coop-codec.js) and the messages that travel over the data channel (coop-proto.js).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import qrcode from '../web/vendor/qrcode-generator/qrcode.min.js';
import { base45Encode, crc32 } from '../web/js/transfer.js';
import {
  fieldsFromSdp,
  encodeSignal,
  decodeSignal,
  buildSdp,
  parseCandidate,
  candidateAddress,
  localIPv4,
  localIPv6,
  MAX_TEXT,
  MAX_CANDIDATES,
  PREFIX,
} from '../web/games/vier/coop-codec.js';
import { parseMessage, judgeMove, judgeAgain, starterFor, createGuard, moveMessage, againMessage, BYE, RATE_LIMIT, RATE_WINDOW, BAD_LIMIT } from '../web/games/vier/coop-proto.js';
import { BOARDS, emptyBoard, drop, winAt, isFull, other, validCols } from '../web/games/vier/rules.js';
import { TOKENS } from '../web/games/vier/art.js';
import { coopEnabled } from '../web/games/vier/vier.js';
import { CHROME_OFFER, CHROME_ANSWER, withCandidates } from './coop-fixtures.js';

const ERRORS = new Set(['not-ours', 'version', 'checksum', 'content', 'wrong-kind']);
const SETUP = { board: 'big', tokens: ['pup', 'bubble'] };

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const qrVersion = (text) => {
  const qr = qrcode(0, 'L');
  qr.addData(text, 'Alphanumeric');
  qr.make();
  return (qr.getModuleCount() - 17) / 4;
};

/** A code from raw bytes, with a right checksum (to reach the checks behind it). */
const craft = (bytes) => {
  const crc = crc32(Uint8Array.from(bytes));
  return PREFIX + base45Encode(Uint8Array.from([...bytes, crc >>> 24, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff]));
};

/** The bytes of a valid answer, to change one thing at a time. */
function answerBytes({ head = 0x12, ufrag = 'q8Zr', pwd = '3iC7Xx1u0n6tq0Yh0b9w+H2P', count = 1, cands = [[4, 192, 168, 1, 20, 0xc3, 0x50]], extra = [] } = {}) {
  const out = [head, 1, 2, 3, 4];
  out.push(ufrag.length, ...[...ufrag].map((c) => c.charCodeAt(0)));
  out.push(pwd.length, ...[...pwd].map((c) => c.charCodeAt(0)));
  out.push(...new Array(32).fill(7));
  out.push(count);
  for (const c of cands) out.push(...c);
  out.push(...extra);
  return out;
}

const throwsWith = (fn, msg) =>
  assert.throws(fn, (e) => {
    assert.equal(e.message, msg);
    return true;
  });

// ---------- the code (coop-codec.js) ----------

test('codec: a real Chrome offer and answer go through and come back with every field', () => {
  for (const [sdp, kind] of [
    [CHROME_OFFER, 'offer'],
    [CHROME_ANSWER, 'answer'],
  ]) {
    const f = fieldsFromSdp(sdp);
    const text = encodeSignal({ kind, session: 0xdeadbeef, ...f, ...SETUP });
    const back = decodeSignal(text, kind);
    assert.equal(back.kind, kind);
    assert.equal(back.session, 0xdeadbeef);
    assert.equal(back.ufrag, f.ufrag);
    assert.equal(back.pwd, f.pwd);
    assert.deepEqual(back.fingerprint, f.fingerprint);
    assert.deepEqual(back.candidates, f.candidates);
    if (kind === 'offer') {
      assert.equal(back.board, 'big');
      assert.deepEqual(back.tokens, ['pup', 'bubble']);
    } else assert.equal(back.board, undefined);
    // the rebuilt SDP says the same as the original on everything that matters
    const sdp2 = buildSdp(back);
    for (const line of sdp.split('\r\n').filter((l) => /^a=(ice-ufrag|ice-pwd|fingerprint|setup|mid|sctp-port)/.test(l))) assert.ok(sdp2.includes(line), line);
    const cand = sdp.split('\r\n').find((l) => l.startsWith('a=candidate:')).split(' ');
    assert.ok(sdp2.includes(` ${cand[4]} ${cand[5]} typ host`), 'the candidate address and port');
    // and reading it again gives the same fields (what the other phone's browser will see)
    const again = fieldsFromSdp(sdp2);
    assert.deepEqual({ ...again, setup: undefined }, { ...f, setup: undefined });
  }
});

test('codec: every board and every pair of different tokens travels in an offer', () => {
  const f = fieldsFromSdp(CHROME_OFFER);
  for (const board of ['big', 'small'])
    for (const a of TOKENS)
      for (const b of TOKENS) {
        if (a === b) {
          assert.throws(() => encodeSignal({ kind: 'offer', session: 1, ...f, board, tokens: [a.id, b.id] }));
          continue;
        }
        const back = decodeSignal(encodeSignal({ kind: 'offer', session: 1, ...f, board, tokens: [a.id, b.id] }), 'offer');
        assert.equal(back.board, board);
        assert.deepEqual(back.tokens, [a.id, b.id]);
      }
});

test('codec: the codes are small, one QR code of version 7 or less (45x45 modules)', () => {
  const sizes = {};
  for (const [label, sdp, kind] of [
    ['offer-1', CHROME_OFFER, 'offer'],
    ['answer-1', CHROME_ANSWER, 'answer'],
    ['offer-2', withCandidates(CHROME_OFFER, ['mdns', 'mdns']), 'offer'],
    ['offer-4', withCandidates(CHROME_OFFER, ['mdns', 'mdns', 'ipv4', 'ipv6']), 'offer'],
  ]) {
    const text = encodeSignal({ kind, session: 7, ...fieldsFromSdp(sdp), ...SETUP });
    sizes[label] = [text.length, qrVersion(text)];
    assert.ok(text.length <= MAX_TEXT);
  }
  assert.deepEqual(sizes, { 'offer-1': [141, 5], 'answer-1': [140, 5], 'offer-2': [170, 6], 'offer-4': [209, 7] });
  // the biggest code decodeSignal accepts still fits one easy QR code
  assert.ok(qrVersion('BZV' + 'A'.repeat(MAX_TEXT - 3)) <= 10);
  // the whole SDP would need version 17 in byte mode
  const qr = qrcode(0, 'L');
  qr.addData(CHROME_OFFER, 'Byte');
  qr.make();
  assert.equal((qr.getModuleCount() - 17) / 4, 17);
});

test('codec: only local host candidates travel (no public address, no relay, no TCP)', () => {
  const sdp = CHROME_OFFER.replace(
    'a=ice-ufrag:',
    [
      'a=candidate:1 1 udp 2122260223 8.8.8.8 5000 typ host generation 0',
      'a=candidate:2 1 udp 2122260223 100.90.159.10 5001 typ host generation 0', // CGNAT / tailnet
      'a=candidate:3 1 udp 2122260223 2001:db8::1 5002 typ host generation 0',
      'a=candidate:4 1 udp 1686052607 192.168.1.5 5003 typ srflx raddr 0.0.0.0 rport 0 generation 0',
      'a=candidate:5 1 tcp 1518280447 192.168.1.5 9 typ host tcptype active generation 0',
      'a=candidate:6 1 udp 41885439 192.168.1.5 5004 typ relay raddr 0.0.0.0 rport 0 generation 0',
      'a=candidate:7 1 udp 2122260223 127.0.0.1 5005 typ host generation 0',
      'a=candidate:8 1 udp 2122260223 10.1.2.3 5006 typ host generation 0',
      'a=candidate:9 1 udp 2122260223 fd12:3456::9 5007 typ host generation 0',
      'a=candidate:10 2 udp 2122260223 10.1.2.4 5008 typ host generation 0', // RTCP component
      'a=ice-ufrag:',
    ].join('\r\n'),
  );
  const f = fieldsFromSdp(sdp);
  assert.deepEqual(
    f.candidates.map((c) => `${candidateAddress(c)} ${c.port}`),
    ['f39d5ed5-7a4e-49a2-847a-3140a68bf322.local 36446', '10.1.2.3 5006', 'fd12:3456:0:0:0:0:0:9 5007'],
  );
  // at most MAX_CANDIDATES, IPv6 last
  const many = withCandidates(CHROME_OFFER, ['ipv6', 'mdns', 'ipv4', 'mdns', 'ipv4']);
  const g = fieldsFromSdp(many);
  assert.equal(g.candidates.length, MAX_CANDIDATES);
  assert.ok(g.candidates.every((c) => c.kind !== 6));
  // nothing local: no network
  throwsWith(() => fieldsFromSdp(CHROME_OFFER.replace(/a=candidate:.*\r\n/, '')), 'no-network');
  throwsWith(() => fieldsFromSdp('v=0\r\n'), 'sdp');
  throwsWith(() => fieldsFromSdp(CHROME_OFFER.replace('a=ice-pwd:mJMiCYKyfUCG/gHS18jiZ/uV', 'a=ice-pwd:short')), 'sdp');
  throwsWith(() => fieldsFromSdp(CHROME_OFFER.replace('sha-256', 'sha-1')), 'sdp');
});

test('codec: the address checks', () => {
  for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.43.1', '169.254.10.20']) assert.ok(localIPv4(ip.split('.').map(Number)), ip);
  for (const ip of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '127.0.0.1', '0.0.0.0', '255.255.255.255', '224.0.0.251', '100.64.0.1', '169.254.0.1', '169.254.255.1', '192.169.0.1'])
    assert.ok(!localIPv4(ip.split('.').map(Number)), ip);
  const v6 = (s) => parseCandidate(`a=candidate:1 1 udp 1 ${s} 9 typ host`);
  assert.equal(v6('fe80::1')?.kind, 6);
  assert.equal(v6('fdab::1:2')?.kind, 6);
  assert.equal(v6('fe80::1%eth0'), null); // zone ids never
  assert.equal(v6('2a02:a45::1'), null);
  assert.equal(v6('::1'), null);
  assert.equal(v6('::ffff:192.168.1.1'), null);
  assert.equal(v6('fe80::1::2'), null);
  assert.ok(localIPv6([0xfe, 0x80, ...new Array(14).fill(0)]));
  assert.ok(!localIPv6([0xfe, 0xc0, ...new Array(14).fill(0)]));
  assert.equal(parseCandidate('a=candidate:1 1 udp 1 10.0.0.1 0 typ host'), null); // port 0
  assert.equal(parseCandidate('a=candidate:1 1 udp 1 10.0.0.1 70000 typ host'), null);
  assert.equal(parseCandidate('a=candidate:1 1 udp 1 evil.example.com 5000 typ host'), null); // never a DNS name
  assert.equal(parseCandidate('a=candidate:1 1 udp 1 not-a-uuid.local 5000 typ host'), null);
});

test('codec: what is not ours, or the wrong kind, or another version, is refused', () => {
  const f = fieldsFromSdp(CHROME_OFFER);
  const offer = encodeSignal({ kind: 'offer', session: 1, ...f, ...SETUP });
  const answer = encodeSignal({ kind: 'answer', session: 1, ...fieldsFromSdp(CHROME_ANSWER) });
  throwsWith(() => decodeSignal(offer, 'answer'), 'wrong-kind');
  throwsWith(() => decodeSignal(answer, 'offer'), 'wrong-kind');
  for (const t of [null, undefined, 42, {}, '', 'https://example.com/', 'BZ1ABCD0101:XYZ', offer.toLowerCase(), 'BZV', 'BZV' + 'A'.repeat(MAX_TEXT), offer + '\u0000', 'BZV%%%']) {
    assert.throws(
      () => decodeSignal(t, 'offer'),
      (e) => ['not-ours', 'content'].includes(e.message),
      String(t).slice(0, 30),
    );
  }
  throwsWith(() => decodeSignal(craft(answerBytes({ head: 0x22 })), 'answer'), 'version');
  throwsWith(() => decodeSignal(craft(answerBytes({ head: 0x13 })), 'answer'), 'content');
  assert.equal(decodeSignal(craft(answerBytes()), 'answer').candidates[0].port, 50000);
  assert.equal(decodeSignal(' ' + craft(answerBytes()) + '\n', 'answer').kind, 'answer'); // spaces around are fine
});

test('codec: every changed character, every cut and anything after the end is refused', () => {
  const text = encodeSignal({ kind: 'answer', session: 99, ...fieldsFromSdp(CHROME_ANSWER) });
  const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  for (let i = PREFIX.length; i < text.length; i++) {
    for (const ch of [B45[(B45.indexOf(text[i]) + 1) % 45], B45[(B45.indexOf(text[i]) + 17) % 45]]) {
      const bad = text.slice(0, i) + ch + text.slice(i + 1);
      assert.throws(
        () => decodeSignal(bad, 'answer'),
        (e) => ERRORS.has(e.message),
        `position ${i}`,
      );
    }
  }
  for (let n = PREFIX.length; n < text.length; n++) assert.throws(() => decodeSignal(text.slice(0, n), 'answer'), (e) => ERRORS.has(e.message));
  throwsWith(() => decodeSignal(craft(answerBytes({ extra: [0] })), 'answer'), 'content');
});

test('codec: each field is checked for its shape, also behind a right checksum', () => {
  const bad = (opts) => throwsWith(() => decodeSignal(craft(answerBytes(opts)), 'answer'), 'content');
  bad({ ufrag: 'ab"d' }); // not an ice-char
  bad({ ufrag: 'abc' }); // too short
  bad({ pwd: 'x'.repeat(21) });
  bad({ pwd: 'x'.repeat(22) + ' ' });
  bad({ count: 0, cands: [] });
  bad({ count: 5, cands: new Array(5).fill([4, 10, 0, 0, 1, 1, 1]) });
  bad({ count: 2 }); // says two, has one
  bad({ cands: [[9, 10, 0, 0, 1, 1, 1]] }); // unknown kind
  bad({ cands: [[4, 10, 0, 0, 1, 0, 0]] }); // port 0
  bad({ cands: [[4, 8, 8, 8, 8, 1, 1]] }); // a public address
  bad({ cands: [[4, 127, 0, 0, 1, 1, 1]] }); // loopback
  bad({ cands: [[6, 0x20, 0x01, 0x0d, 0xb8, ...new Array(12).fill(0), 1, 1]] }); // global IPv6
  // offers: the setup byte
  const offerHead = (v) => {
    const b = answerBytes({ head: 0x11 });
    b.splice(5, 0, v);
    return craft(b);
  };
  assert.equal(decodeSignal(offerHead(0 | (2 << 1) | (5 << 4)), 'offer').tokens.join(), 'apple,pug');
  for (const v of [0x80, 0 | (1 << 1) | (1 << 4), 0 | (6 << 1), 0 | (7 << 4)]) throwsWith(() => decodeSignal(offerHead(v), 'offer'), 'content');
});

test('codec: 20 000 random and mutated codes never get past the checks with a bad field', () => {
  const rnd = mulberry32(2026);
  const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  const good = answerBytes();
  let passed = 0;
  for (let i = 0; i < 20000; i++) {
    let text;
    if (i % 2) {
      const n = Math.floor(rnd() * 260);
      text = 'BZV' + Array.from({ length: n }, () => B45[Math.floor(rnd() * 45)]).join('');
    } else {
      // a valid code with random bytes changed, the checksum made right again
      const b = good.slice();
      for (let k = 0; k < 1 + Math.floor(rnd() * 4); k++) b[Math.floor(rnd() * b.length)] = Math.floor(rnd() * 256);
      text = craft(b);
    }
    let f;
    try {
      f = decodeSignal(text);
    } catch (e) {
      assert.ok(ERRORS.has(e.message), e.message);
      continue;
    }
    passed++;
    assert.match(f.ufrag, /^[A-Za-z0-9+/]{4,32}$/);
    assert.match(f.pwd, /^[A-Za-z0-9+/]{22,64}$/);
    assert.equal(f.fingerprint.length, 32);
    assert.ok(f.candidates.length >= 1 && f.candidates.length <= MAX_CANDIDATES);
    for (const c of f.candidates) {
      assert.ok(c.port >= 1 && c.port <= 65535);
      assert.ok(c.kind === 1 || (c.kind === 4 && localIPv4(c.addr)) || (c.kind === 6 && localIPv6(c.addr)));
    }
    // and the SDP made from it has nothing else in it
    const sdp = buildSdp(f);
    assert.equal(sdp.split('\r\n').filter((l) => l.startsWith('a=candidate:')).length, f.candidates.length);
    assert.ok(!/[\r\n]{3}|[^\x20-\x7e\r\n]/.test(sdp));
  }
  assert.ok(passed > 100, `${passed} mutated codes were still valid codes`); // the test reached the checks behind the checksum
});

// ---------- the messages (coop-proto.js) ----------

test('proto: only the three known messages get through, with exact shapes', () => {
  assert.deepEqual(parseMessage(moveMessage(0, 3)), { t: 'm', n: 0, c: 3 });
  assert.deepEqual(parseMessage(againMessage(2)), { t: 'again', g: 2 });
  assert.deepEqual(parseMessage(BYE), { t: 'bye' });
  for (const raw of [
    null,
    undefined,
    7,
    new ArrayBuffer(4),
    '',
    'm3',
    '[]',
    'null',
    '"m"',
    '{"t":"m","n":0}',
    '{"t":"m","n":0,"c":3,"x":1}',
    '{"t":"m","n":0.5,"c":3}',
    '{"t":"m","n":-1,"c":3}',
    '{"t":"m","n":0,"c":16}',
    '{"t":"m","n":0,"c":"3"}',
    '{"t":"m","n":100,"c":3}',
    '{"t":"again","g":1}',
    '{"t":"again","g":"2"}',
    '{"t":"bye","why":"x"}',
    '{"t":"win","p":1}',
    '{"t":"board","b":[1,1,1,1]}',
    '{"__proto__":{"t":"m"},"t":"m","n":0,"c":3}',
    `{"t":"m","n":0,"c":3${' '.repeat(60)}}`,
    '{"t":"m","n":0,"c":3',
  ])
    assert.equal(parseMessage(raw), null, String(raw));
});

/** One phone's view of a game, and a move played on it. */
const newView = (cfg, g = 1) => ({ cfg, board: emptyBoard(cfg), turn: starterFor(g), over: null, moves: 0, game: g });
function play(view, c) {
  const d = drop(view.board, view.cfg, c, view.turn);
  const line = winAt(d.board, view.cfg, d.index);
  return { ...view, board: d.board, moves: view.moves + 1, turn: other(view.turn), over: line ? { winner: view.turn } : isFull(d.board) ? { draw: true } : null };
}

test('proto: a move is judged against the turn, the order, the board and the end', () => {
  const cfg = BOARDS.small;
  let v = newView(cfg);
  assert.equal(judgeMove(v, { t: 'm', n: 0, c: 2 }, 2), 'turn'); // phone 1 starts game 1
  assert.equal(judgeMove(v, { t: 'm', n: 1, c: 2 }, 1), 'seq');
  assert.equal(judgeMove(v, { t: 'm', n: 0, c: 5 }, 1), 'col'); // the kleuterbord has 5 columns
  assert.equal(judgeMove(v, { t: 'm', n: 0, c: 4 }, 1), 'ok');
  for (let k = 0; k < cfg.rows; k++) v = play(v, 0); // fill column 0 (no three in a row in one column? 1,2,1,2)
  assert.equal(judgeMove(v, { t: 'm', n: v.moves, c: 0 }, v.turn), 'full');
  assert.equal(judgeMove(v, { t: 'm', n: v.moves - 1, c: 1 }, v.turn), 'seq'); // a repeat of the last move
  v = { ...v, over: { winner: 1 } };
  assert.equal(judgeMove(v, { t: 'm', n: v.moves, c: 1 }, v.turn), 'over');
});

test('proto: "again" only starts the next game once this one is over; both tapping at once is fine', () => {
  assert.equal(judgeAgain({ game: 1, over: true }, { g: 2 }), 'ok');
  assert.equal(judgeAgain({ game: 1, over: null }, { g: 2 }), 'early');
  assert.equal(judgeAgain({ game: 2, over: null }, { g: 2 }), 'stale'); // we started it ourselves
  assert.equal(judgeAgain({ game: 1, over: true }, { g: 5 }), 'skip');
  assert.equal(judgeAgain({ game: 3, over: true }, { g: 2 }), 'skip');
  assert.deepEqual([1, 2, 3, 4].map(starterFor), [1, 2, 1, 2]);
});

test('proto: 200 seeded games between an honest phone and one that also sends garbage stay the same on both', () => {
  const rnd = mulberry32(42);
  const junk = () => {
    const r = rnd();
    if (r < 0.2) return moveMessage(Math.floor(rnd() * 50), Math.floor(rnd() * 16)); // a move with a wrong number or column
    if (r < 0.4) return againMessage(2 + Math.floor(rnd() * 5));
    if (r < 0.6) return JSON.stringify({ t: 'm', n: 0, c: 0, board: [1, 1, 1, 1] });
    if (r < 0.8) return String.fromCharCode(...Array.from({ length: Math.floor(rnd() * 80) }, () => Math.floor(rnd() * 128)));
    return '{"t":"m","n":' + Math.floor(rnd() * 3) + ',"c":' + Math.floor(rnd() * 9) + '}';
  };
  let ignored = 0;
  for (let game = 0; game < 200; game++) {
    const cfg = game % 2 ? BOARDS.small : BOARDS.big;
    let honest = newView(cfg); // phone 1's view (the honest phone)
    let truth = newView(cfg); // the game as it really goes
    while (!truth.over) {
      const legal = validCols(truth.board, cfg);
      const c = legal[Math.floor(rnd() * legal.length)];
      if (truth.turn === 1) {
        honest = play(honest, c); // phone 1 plays on its own board
      } else {
        // phone 2 cheats now and then before its real move
        for (let k = 0; k < Math.floor(rnd() * 3); k++) {
          const msg = parseMessage(junk());
          if (!msg) {
            ignored++;
            continue;
          }
          if (msg.t !== 'm' || judgeMove(honest, msg, 2) !== 'ok') {
            ignored++;
            continue;
          }
          // a legal move is a real move: the game goes on with it
          honest = play(honest, msg.c);
          truth = play(truth, msg.c);
          break;
        }
        if (truth.turn === 2 && !truth.over) {
          const msg = parseMessage(moveMessage(honest.moves, c));
          assert.equal(judgeMove(honest, msg, 2), 'ok');
          honest = play(honest, c);
        } else continue;
      }
      truth = play(truth, c);
      // the other phone's move out of turn is never taken
      if (honest.turn === 1) assert.notEqual(judgeMove(honest, { t: 'm', n: honest.moves, c: 0 }, 2), 'ok');
      assert.deepEqual(honest.board, truth.board);
    }
    assert.deepEqual(honest.over, truth.over);
  }
  assert.ok(ignored > 500, `${ignored} bad messages ignored`);
});

test('proto: a flood or a run of bad messages closes the connection', () => {
  const g = createGuard();
  for (let i = 0; i < RATE_LIMIT; i++) assert.equal(g.take(1000 + i), 'ok');
  assert.equal(g.take(1000 + RATE_LIMIT), 'close');
  const h = createGuard();
  for (let i = 0; i < 5 * RATE_LIMIT; i++) assert.equal(h.take(i * (RATE_WINDOW / 4)), 'ok'); // 4 a second is fine
  const b = createGuard();
  for (let i = 1; i < BAD_LIMIT; i++) assert.equal(b.bad(), 'ok');
  assert.equal(b.bad(), 'close');
});

test('coop mode is hidden: only with both ?test and ?coop', () => {
  assert.equal(coopEnabled(''), false);
  assert.equal(coopEnabled('?coop'), false);
  assert.equal(coopEnabled('?test'), false);
  assert.equal(coopEnabled('?test&coop'), true);
  assert.equal(coopEnabled('?coop&test&lang=en'), true);
});

test('no STUN, no TURN, no other ICE server anywhere in the app; one RTCPeerConnection, with iceServers: []', () => {
  const files = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|html)$/.test(n)) files.push(p);
    }
  };
  walk(new URL('../web', import.meta.url).pathname);
  const uses = [];
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/\b(stuns?|turns?):[^\s'"`]/i.test(s.replace(/\/\/.*$/gm, '')) || f.includes('vendor'), `${f} names an ICE server`);
    if (/new RTCPeerConnection\(/.test(s)) uses.push([f, s.match(/new RTCPeerConnection\(([^)]*)\)/)[1]]);
  }
  assert.equal(uses.length, 1);
  assert.ok(uses[0][0].endsWith('games/vier/coop.js'));
  assert.equal(uses[0][1].trim(), '{ iceServers: [] }');
  // the CSP stays as strict as it was: nothing was added for WebRTC
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  assert.match(html, /content="default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'"/);
});
