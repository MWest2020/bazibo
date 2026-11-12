// Tekenen: the mirror maths, a drawing as text (encode, decode, simplify, the size cap), the free
// cap, the save section in storage.js and its rule for Voortgang overzetten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AXES, axisAngles, transforms, apply, copies } from '../web/games/tekenen/symmetry.js';
import { GRID, STAMPS, SIZES, FREE_DRAWINGS, MAX_DRAWINGS, encode, decode, visible, simplify, pack, mayKeep, newId } from '../web/games/tekenen/drawing.js';
import { meta } from '../web/games/tekenen/meta.js';
import * as store from '../web/js/storage.js';
import { sanitizePayload, mergeTransfer, replaceTransfer, payloadOf, hasArt, summarize, encodeSave, decodeText } from '../web/js/transfer.js';
import { backAction } from '../web/js/back.js';
import { GAMES } from '../web/js/games.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;
const sameMap = (m, n) => near(m.a, n.a) && near(m.b, n.b) && near(m.c, n.c) && near(m.d, n.d);
const compose = (m, n) => ({ a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b, c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d });

// ---------- symmetry ----------

test('symmetry: n mirror lines give the 2n maps of the dihedral group, closed and distinct', () => {
  assert.deepEqual([...AXES], [2, 4, 6, 8]);
  assert.deepEqual(transforms(0), [{ a: 1, b: 0, c: 0, d: 1 }]);
  for (const n of AXES) {
    const g = transforms(n);
    assert.equal(g.length, 2 * n);
    assert.ok(sameMap(g[0], { a: 1, b: 0, c: 0, d: 1 }), 'the first copy is the stroke as drawn');
    for (const m of g) {
      const det = m.a * m.d - m.b * m.c;
      assert.ok(near(Math.abs(det), 1), 'no stretching');
      assert.ok(near(m.a * m.a + m.b * m.b, 1) && near(m.a * m.c + m.b * m.d, 0), 'turns and mirrors only');
    }
    assert.equal(g.filter((m) => near(m.a * m.d - m.b * m.c, -1)).length, n, 'n mirror images');
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) assert.ok(!sameMap(g[i], g[j]), `n=${n}: maps ${i} and ${j} are the same`);
    for (const m of g) for (const k of g) assert.ok(g.some((x) => sameMap(x, compose(m, k))), `n=${n}: not closed`);
  }
});

test('symmetry: the first line is upright (left and right mirror), every line is a fixed line of its mirror', () => {
  for (const n of AXES) {
    const angles = axisAngles(n);
    assert.equal(angles.length, n);
    assert.ok(near(angles[0], Math.PI / 2));
    const g = transforms(n);
    assert.ok(g.some((m) => sameMap(m, { a: -1, b: 0, c: 0, d: 1 })), `n=${n}: no left-right mirror`);
    angles.forEach((th, k) => {
      const [x, y] = apply(g[n + k], 100 * Math.cos(th), 100 * Math.sin(th));
      assert.ok(near(x, 100 * Math.cos(th)) && near(y, 100 * Math.sin(th)), `n=${n}: line ${k} moves`);
    });
    // lines at equal angles, all different
    for (let k = 1; k < n; k++) assert.ok(near(angles[k] - angles[k - 1], Math.PI / n));
  }
});

test('symmetry: copies of a point keep their distance to the middle and are all different', () => {
  for (const n of AXES) {
    const pts = copies(3000, 1200, n, GRID);
    assert.equal(pts.length, 2 * n);
    const r = Math.hypot(3000 - GRID / 2, 1200 - GRID / 2);
    for (const [x, y] of pts) assert.ok(near(Math.hypot(x - GRID / 2, y - GRID / 2), r));
    assert.equal(new Set(pts.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`)).size, 2 * n);
    // the middle stays the middle
    for (const [x, y] of copies(GRID / 2, GRID / 2, n, GRID)) assert.ok(near(x, GRID / 2) && near(y, GRID / 2));
  }
  assert.deepEqual(copies(10, 20, 0, GRID), [[10, 20]]);
  // two lines: the four corners of a rectangle around the middle
  const four = copies(2048 + 300, 2048 - 100, 2, GRID).map(([x, y]) => [Math.round(x), Math.round(y)]);
  assert.deepEqual(four.sort(), [[1748, 1948], [1748, 2148], [2348, 1948], [2348, 2148]].sort());
});

// ---------- a drawing as text ----------

const sample = () => [
  { k: 's', c: 7, z: 1, a: 0, pts: [[10, 20], [400, 380], [4095, 0]] },
  { k: 'p', s: 4, c: 10, z: 2, a: 6, x: 2048, y: 3000 },
  { k: 's', c: 15, z: 0, a: 8, pts: [[1000, 1000]] },
];

test('drawing: encode and decode give the same items back; a "clear" hides what came before', () => {
  const items = sample();
  const text = encode(items);
  assert.match(text, store.DRAWING_RE);
  assert.deepEqual(decode(text), items);
  assert.deepEqual(decode(encode([...items, { k: 'c' }, items[1]])), [items[1]]);
  assert.deepEqual(visible([...items, { k: 'c' }]), []);
  assert.equal(encode([]), '');
  assert.deepEqual(decode(''), []);
  // coordinates stay on the page
  assert.deepEqual(decode(encode([{ k: 'p', s: 0, c: 0, z: 0, a: 0, x: -50, y: 99999 }]))[0], { k: 'p', s: 0, c: 0, z: 0, a: 0, x: 0, y: GRID - 1 });
});

test('drawing: damaged items are skipped and decode never throws', () => {
  const good = encode(sample());
  for (const bad of ['x', '....', 'sAAA', 'sHB', 'sHBdAAAA', 'p9AAAAAAA', 'pAAAZAAAA', 'sZZAAAAA', 'sHBAAA', 'sHBA!!AA', null, 42, {}, 'p'.repeat(1e5)]) {
    assert.doesNotThrow(() => decode(bad));
  }
  assert.deepEqual(decode(`zz.${good}.sHB`), sample()); // the good ones are kept
  assert.equal(decode('sHBdAAAA').length, 0, 'a mirror of 3 lines does not exist');
  assert.equal(STAMPS.length, 5);
});

test('drawing: simplify keeps the shape with fewer points', () => {
  const line = Array.from({ length: 200 }, (_, i) => [i * 10, i * 10]);
  assert.deepEqual(simplify(line, 4), [[0, 0], [1990, 1990]]);
  const zig = [[0, 0], [100, 300], [200, 0], [300, 300]];
  assert.deepEqual(simplify(zig, 4), zig);
  assert.deepEqual(simplify([[5, 5], [5, 5], [5, 5]], 4), [[5, 5]]);
  const wave = Array.from({ length: 400 }, (_, i) => [i * 8, Math.round(2000 + 600 * Math.sin(i / 20))]);
  const s = simplify(wave, 4);
  assert.ok(s.length < wave.length / 3, `${s.length} points left`);
  for (const p of wave) {
    // every original point stays close to the kept line
    const d = Math.min(...s.slice(1).map((q, i) => segDist(p, s[i], q)));
    assert.ok(d <= 4.0001, `a point moved ${d}`);
  }
});

function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

test('drawing: pack stays under the cap, coarser if needed, and says when the page is full', () => {
  assert.equal(pack(sample()), encode(sample()));
  // a long wobbly scribble: too big as drawn, fits when coarser
  const wobble = Array.from({ length: 1500 }, (_, i) => [100 + (i % 400) * 9, 200 + Math.floor(i / 400) * 900 + (i % 2) * 12]);
  const items = Array.from({ length: 4 }, () => ({ k: 's', c: 1, z: 1, a: 0, pts: wobble }));
  assert.ok(encode(items).length > store.DRAWING_MAX);
  const text = pack(items);
  assert.ok(text && text.length <= store.DRAWING_MAX);
  assert.equal(decode(text).length, 4);
  // thousands of dots cannot get coarser: full
  const dots = Array.from({ length: 4000 }, (_, i) => ({ k: 's', c: 0, z: 0, a: 0, pts: [[i, i]] }));
  assert.equal(pack(dots), null);
  assert.equal(pack([]), '');
  assert.equal(SIZES.length, 3);
});

test('drawing: the free version keeps 3 drawings, the full version up to MAX_DRAWINGS', () => {
  assert.equal(FREE_DRAWINGS, 3);
  assert.equal(meta.free, FREE_DRAWINGS);
  assert.equal(mayKeep({ owned: false, count: 0, saved: false }), true);
  assert.equal(mayKeep({ owned: false, count: 2, saved: false }), true);
  assert.equal(mayKeep({ owned: false, count: 3, saved: false }), false);
  assert.equal(mayKeep({ owned: false, count: 7, saved: true }), true, 'a kept drawing can always be changed');
  assert.equal(mayKeep({ owned: true, count: 3, saved: false }), true);
  assert.equal(mayKeep({ owned: true, count: MAX_DRAWINGS - 1, saved: false }), true);
  assert.equal(mayKeep({ owned: true, count: MAX_DRAWINGS, saved: false }), false);
  assert.equal(MAX_DRAWINGS, store.DRAWINGS_KEEP);
  const id = newId(1.7e12, 0.5);
  assert.match(id, /^d[0-9a-z]+$/);
  assert.notEqual(newId(1.7e12, 0.1), newId(1.7e12, 0.9));
});

test('the game is registered after Kleurplaten, and back on a drawing goes to "my drawings"', () => {
  const ids = GAMES.map((g) => g.id);
  assert.equal(ids.indexOf('tekenen'), ids.indexOf('kleuren') + 1);
  assert.equal(GAMES.find((g) => g.id === 'tekenen').status, 'ready');
  assert.equal(backAction({ screen: 'tekenen' }), 'tekenen-list');
  assert.equal(backAction({ screen: 'tekenen', overlay: 'card' }), 'close');
  assert.equal(backAction({ screen: 'tekenen-list' }), 'home');
});

// ---------- the save ----------

function fakePreferences() {
  const m = new Map();
  return { get: async ({ key }) => ({ value: m.has(key) ? m.get(key) : null }), set: async ({ key, value }) => void m.set(key, value), dump: () => Object.fromEntries(m) };
}
const noLegacy = { getItem: () => null };

test('storage: drawings are kept in their own section; an empty one is deleted; bad text is refused', async () => {
  const prefs = fakePreferences();
  await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: noLegacy });
  const text = encode(sample());
  assert.equal(store.saveDrawing('tekenen', 'd1', text, 1000), true);
  assert.equal(store.saveDrawing('tekenen', 'd2', 'sAAA.', 2000), true);
  assert.equal(store.countDrawings('tekenen'), 2);
  assert.deepEqual(store.loadDrawing('tekenen', 'd1'), { s: text, t: 1000 });
  assert.equal(store.saveDrawing('tekenen', 'd3', 'no spaces!', 3000), false);
  assert.equal(store.saveDrawing('tekenen', 'd3', 'A'.repeat(store.DRAWING_MAX + 1), 3000), false);
  assert.equal(store.loadDrawing('tekenen', 'd3'), null);
  assert.equal(store.saveDrawing('tekenen', 'd2', '', 4000), true); // cleared: deleted
  assert.equal(store.loadDrawing('tekenen', 'd2'), null);
  assert.deepEqual(Object.keys(store.loadDrawings('tekenen')), ['d1']);
  assert.equal(store.saveDrawing('tekenen', 'never', '', 5000), true); // nothing to delete: no marker
  await store.flushed();
  const saved = JSON.parse(prefs.dump()[store.SAVE_KEY]);
  assert.deepEqual(saved.games.tekenen, { drawings: { d1: { s: text, t: 1000 }, d2: { t: 4000, gone: true } } });
  assert.equal(store.loadGameOption('tekenen', 'drawings', 'none'), 'none');
  assert.throws(() => store.saveGameOption('tekenen', 'drawings', {}), /saveDrawing/);
});

test('storage: at most DRAWINGS_KEEP drawings and deleted markers, the newest stay', async () => {
  await store.init({ backend: store.preferencesBackend(fakePreferences()), legacyStorage: noLegacy });
  for (let i = 0; i < store.DRAWINGS_KEEP + 5; i++) store.saveDrawing('tekenen', `d${i}`, 'sAAAAAAA', 1000 + i);
  const ids = Object.keys(store.loadDrawings('tekenen'));
  assert.equal(ids.length, store.DRAWINGS_KEEP);
  assert.ok(!ids.includes('d0') && ids.includes(`d${store.DRAWINGS_KEEP + 4}`));
});

test('mergeSaves: per drawing the newer one wins, a later delete stays deleted', () => {
  const stored = { version: 1, games: { tekenen: { drawings: { a: { s: 'sAAAAAAA', t: 10 }, b: { s: 'sBAAAAAA', t: 30 }, c: { s: 'sCAAAAAA', t: 5 } } } }, settings: {}, purchase: {} };
  const session = { games: { tekenen: { drawings: { a: { s: 'sDAAAAAA', t: 20 }, b: { s: 'sEAAAAAA', t: 25 }, c: { t: 8, gone: true }, d: { s: 'sFAAAAAA', t: 1 } } } }, purchase: {}, settings: {} };
  const out = store.mergeSaves(stored, session, false).games.tekenen.drawings;
  assert.deepEqual(out, { a: { s: 'sDAAAAAA', t: 20 }, b: { s: 'sBAAAAAA', t: 30 }, c: { t: 8, gone: true }, d: { s: 'sFAAAAAA', t: 1 } });
});

// ---------- Voortgang overzetten ----------

test('transfer: drawings pass sanitizePayload only in their own shape', () => {
  const ok = encode(sample());
  const doc = {
    games: {
      tekenen: {
        drawings: {
          d1: { s: ok, t: 100 },
          d2: { t: 200, gone: true, s: 'ignored' },
          d3: { s: 'has spaces', t: 1 },
          d4: { s: 'A'.repeat(store.DRAWING_MAX + 1), t: 1 },
          d5: { s: '', t: 1 },
          d6: { s: { evil: true }, t: 1 },
          d7: 'nope',
          __proto__x: { s: ok, t: 1 },
          'bad key!': { s: ok, t: 1 },
          d8: { s: ok, t: 9e15 },
          d9: { s: ok, t: -4, extra: '<script>' },
        },
        stars: { 1: 3 },
      },
    },
  };
  const out = sanitizePayload(doc).games.tekenen;
  assert.deepEqual(Object.keys(out.drawings).sort(), ['__proto__x', 'd1', 'd2', 'd8', 'd9']);
  assert.deepEqual(out.drawings.d2, { t: 200, gone: true });
  assert.deepEqual(out.drawings.d9, { s: ok, t: 0 });
  assert.ok(out.drawings.d8.t <= Date.now() + 864e5, 'a far-future time is clamped');
  assert.deepEqual(sanitizePayload({ games: { tekenen: { drawings: [1, 2] } } }).games.tekenen.drawings, {});
});

test('transfer: drawings travel, merge, count in the summary, and stay behind in a code without pictures', async () => {
  const text = encode(sample());
  const sender = { version: 1, games: { tekenen: { drawings: { d1: { s: text, t: 100 }, d2: { t: 50, gone: true } } } }, settings: {}, purchase: { owned: true } };
  assert.equal(hasArt(sender), true);
  const back = await decodeText(await encodeSave(sender));
  assert.deepEqual(back.games.tekenen.drawings, sender.games.tekenen.drawings);
  assert.deepEqual(summarize(back), [{ id: 'tekenen', n: 1 }]);
  const mine = { version: 1, games: { tekenen: { drawings: { d0: { s: 'sAAAAAAA', t: 1 }, d2: { s: 'sBAAAAAA', t: 10 } } } }, settings: {}, purchase: { owned: false } };
  const merged = mergeTransfer(mine, back).games.tekenen.drawings;
  assert.deepEqual(Object.keys(merged).sort(), ['d0', 'd1', 'd2']);
  assert.deepEqual(merged.d2, { t: 50, gone: true }, 'the newer delete wins');
  assert.equal(payloadOf(sender, { withArt: false }).games.tekenen.drawings, undefined);
  const noArt = await decodeText(await encodeSave(sender, { withArt: false }));
  assert.deepEqual(replaceTransfer(mine, noArt).games.tekenen.drawings, mine.games.tekenen.drawings);
  assert.deepEqual(replaceTransfer(mine, back).games.tekenen.drawings, sender.games.tekenen.drawings);
});
