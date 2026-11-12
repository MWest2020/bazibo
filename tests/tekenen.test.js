// Tekenen: the mirror maths, a drawing as text (encode, decode, simplify, the size cap), the free
// cap, the save section in storage.js and its rule for Voortgang overzetten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AXES, axisAngles, transforms, apply, copies } from '../web/games/tekenen/symmetry.js';
import { GRID, STAMPS, SIZES, FREE_DRAWINGS, MAX_DRAWINGS, encode, decode, visible, simplify, pack, mayKeep, newId, isDrawingText } from '../web/games/tekenen/drawing.js';
import { createSession } from '../web/games/tekenen/session.js';
import { meta } from '../web/games/tekenen/meta.js';
import * as store from '../web/js/storage.js';
import { sanitizePayload, mergeTransfer, replaceTransfer, payloadOf, hasArt, countDrawings, droppedDrawings, summarize, encodeSave, decodeText, fitParts, saveToParts, DRAWINGS_BUDGET } from '../web/js/transfer.js';
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
const fresh = () => store.init({ backend: store.preferencesBackend(fakePreferences()), legacyStorage: noLegacy });
const dot = (c = 0) => `s${'ABCDEFGHIJKLMNOP'[c]}AAAAAA`; // one dot in colour c: the smallest drawing

test('storage: drawings are kept in their own section; an empty one is deleted; bad text is refused', async () => {
  const prefs = fakePreferences();
  await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: noLegacy });
  const text = encode(sample());
  assert.equal(store.saveDrawing('tekenen', 'd1', text, 1000), true);
  assert.equal(store.saveDrawing('tekenen', 'd2', dot(), 2000), true);
  assert.equal(store.countDrawings('tekenen'), 2);
  assert.deepEqual(store.loadDrawing('tekenen', 'd1'), { s: text, t: 1000 });
  for (const bad of ['no spaces!', 'A'.repeat(store.DRAWING_MAX + 1), 'sAAA.', '....', 'zzzzzzzz', 42, null]) {
    assert.equal(store.saveDrawing('tekenen', 'd3', bad, 3000), false, `stored ${String(bad).slice(0, 12)}`);
  }
  assert.equal(isDrawingText('sAAA.'), false, 'a text without a stroke is no drawing');
  assert.equal(store.loadDrawing('tekenen', 'd3'), null);
  assert.equal(store.saveDrawing('tekenen', 'd2', '', 4000), true); // deleted
  assert.equal(store.loadDrawing('tekenen', 'd2'), null);
  assert.deepEqual(Object.keys(store.loadDrawings('tekenen')), ['d1']);
  assert.equal(store.saveDrawing('tekenen', 'never', '', 5000), true); // nothing to delete: no marker
  await store.flushed();
  const saved = JSON.parse(prefs.dump()[store.SAVE_KEY]);
  assert.deepEqual(saved.games.tekenen, { drawings: { d1: { s: text, t: 1000 }, d2: { t: 4000, gone: true } } });
  assert.equal(store.loadGameOption('tekenen', 'drawings', 'none'), 'none');
  assert.throws(() => store.saveGameOption('tekenen', 'drawings', {}), /saveDrawing/);
});

test('storage: a drawing keeps fields a newer version wrote', async () => {
  const prefs = fakePreferences();
  await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: noLegacy });
  store.saveDrawing('tekenen', 'd1', dot(1), 10);
  // a newer app added a field; this version must not drop it
  store.snapshot(); // (read-only copy)
  const doc = { version: 1, games: { tekenen: { drawings: { d1: { s: dot(1), t: 10, title: 'Zon' } } } }, settings: {}, purchase: {} };
  await store.init({ backend: store.preferencesBackend({ get: async () => ({ value: JSON.stringify(doc) }), set: async () => {} }), legacyStorage: noLegacy });
  store.saveDrawing('tekenen', 'd1', dot(2), 20);
  assert.deepEqual(store.snapshot().games.tekenen.drawings.d1, { s: dot(2), t: 20, title: 'Zon' });
  store.saveDrawing('tekenen', 'd1', '', 30);
  assert.deepEqual(store.snapshot().games.tekenen.drawings.d1, { t: 30, gone: true, title: 'Zon' });
});

test('storage: a new drawing beyond DRAWINGS_KEEP is refused, never one of the kept ones dropped', async () => {
  await fresh();
  for (let i = 0; i < store.DRAWINGS_KEEP; i++) assert.equal(store.saveDrawing('tekenen', `d${i}`, dot(), 1000 + i), true);
  assert.equal(store.saveDrawing('tekenen', 'one-more', dot(), 5000), false);
  assert.equal(store.countDrawings('tekenen'), store.DRAWINGS_KEEP);
  assert.ok(store.loadDrawing('tekenen', 'd0'), 'the oldest is still there');
  assert.equal(store.saveDrawing('tekenen', 'd0', dot(3), 6000), true, 'a kept one can still change');
});

test('storage: a full or blocked web storage is reported (writeFailing), and the save stays in memory', async () => {
  let full = true;
  const m = new Map();
  const ls = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (full) {
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      }
      m.set(k, v);
    },
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    await store.init({ backend: store.localStorageBackend(ls), legacyStorage: noLegacy });
    store.saveDrawing('tekenen', 'd1', dot(), 1);
    await store.flushed();
    assert.equal(store.writeFailing(), true);
    assert.ok(store.loadDrawing('tekenen', 'd1'), 'still in memory');
    full = false;
    store.retryFailedWrite();
    await store.flushed();
    assert.equal(store.writeFailing(), false);
    assert.ok(JSON.parse(m.get(store.SAVE_KEY)).games.tekenen.drawings.d1);
  } finally {
    console.warn = warn;
  }
});

test('mergeSaves: per drawing the newer one wins, a later delete stays deleted', () => {
  const stored = { version: 1, games: { tekenen: { drawings: { a: { s: 'sAAAAAAA', t: 10 }, b: { s: 'sBAAAAAA', t: 30 }, c: { s: 'sCAAAAAA', t: 5 } } } }, settings: {}, purchase: {} };
  const session = { games: { tekenen: { drawings: { a: { s: 'sDAAAAAA', t: 20 }, b: { s: 'sEAAAAAA', t: 25 }, c: { t: 8, gone: true }, d: { s: 'sFAAAAAA', t: 1 } } } }, purchase: {}, settings: {} };
  const out = store.mergeSaves(stored, session, false).games.tekenen.drawings;
  assert.deepEqual(out, { a: { s: 'sDAAAAAA', t: 20 }, b: { s: 'sBAAAAAA', t: 30 }, c: { t: 8, gone: true }, d: { s: 'sFAAAAAA', t: 1 } });
});

test('mergeDrawings: the receiver never loses its own drawings; the oldest that came in are left out', () => {
  const many = (prefix, n, t0) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i}`, { s: dot(i % 16), t: t0 + i }]));
  // a full album receives 100 newer drawings: all of its own stay, none of the new ones fit
  const full = many('mine', 100, 1000);
  const fullBefore = JSON.parse(JSON.stringify(full));
  assert.equal(store.mergeDrawings(full, many('new', 100, 9000)), 100);
  assert.deepEqual(full, fullBefore);
  // a free device with 3 receives 100: its 3 stay, the 97 newest come in, the 3 oldest stay out
  const three = many('mine', 3, 50000);
  assert.equal(store.mergeDrawings(three, many('new', 100, 1)), 3);
  assert.equal(Object.keys(three).length, 100);
  for (const id of ['mine0', 'mine1', 'mine2', 'new3', 'new99']) assert.ok(three[id], id);
  for (const id of ['new0', 'new1', 'new2']) assert.equal(three[id], undefined, id);
  // a drawing deleted here that comes back newer, but does not fit: the delete marker stays
  const mine = { ...many('k', 100, 10), gone1: { t: 5, gone: true } };
  assert.equal(store.mergeDrawings(mine, { gone1: { s: dot(), t: 6 } }), 1);
  assert.deepEqual(mine.gone1, { t: 5, gone: true });
  // and the transfer summary card can say how many will not fit
  const stored = { games: { tekenen: { drawings: many('mine', 98, 1000) } } };
  assert.equal(droppedDrawings(stored, { games: { tekenen: { drawings: many('new', 5, 1) } } }), 3);
  assert.equal(droppedDrawings(stored, { games: {} }), 0);
});

// ---------- the drawing on the page (session.js) ----------

/** A stand-in for storage.js with only the drawing calls, so the session can be tested alone. */
function fakeStore(drawings = {}) {
  const d = JSON.parse(JSON.stringify(drawings));
  const live = (e) => e && !e.gone && e.s;
  return {
    d,
    writes: 0,
    loadDrawing: (g, id) => (live(d[id]) ? { s: d[id].s, t: d[id].t } : null),
    countDrawings: () => Object.values(d).filter(live).length,
    saveDrawing(g, id, s, t) {
      this.writes++;
      d[id] = s ? { s, t } : { t, gone: true };
      return true;
    },
  };
}
const line = (c = 0) => ({ k: 's', c, z: 1, a: 0, pts: [[100, 100], [900, 900]] });
const fourKept = () => Object.fromEntries([1, 2, 3, 4].map((i) => [`k${i}`, { s: encode([line(i)]), t: i }]));

test('session: clear, the autosave, then undo keeps the drawing on a locked device with 4 drawings', () => {
  const st = fakeStore(fourKept());
  const s = createSession({ store: st, gameId: 'tekenen', owned: () => false, now: () => 100 });
  s.open('k2');
  assert.equal(s.kept(), true);
  assert.equal(s.clear(), true);
  assert.equal(s.write(), 'empty', 'the autosave never writes an empty page');
  assert.ok(st.loadDrawing('tekenen', 'k2'), 'still kept after the autosave');
  assert.equal(s.undo(), true);
  assert.equal(s.write(), 'saved', 'kept again, although the free album is over its 3');
  assert.deepEqual(decode(st.d.k2.s), [line(2)]);
  // and leaving after the clear (no undo) does delete it
  s.clear();
  assert.equal(s.write({ final: true }), 'deleted');
  assert.equal(st.loadDrawing('tekenen', 'k2'), null);
});

test('session: undo stops at the drawing as it was opened, so it can never empty a kept drawing', () => {
  const st = fakeStore({ k1: { s: encode([line(1), line(2)]), t: 1 } });
  const s = createSession({ store: st, gameId: 'tekenen', owned: () => false });
  s.open('k1');
  assert.equal(s.canUndo(), false);
  assert.equal(s.undo(), false);
  assert.equal(s.add(line(3)), true);
  assert.equal(s.canUndo(), true);
  assert.equal(s.undo(), true);
  assert.equal(s.undo(), false);
  assert.equal(s.items.length, 2);
  assert.equal(s.write({ final: true }), 'saved');
  assert.equal(decode(st.d.k1.s).length, 2);
});

test('session: a new drawing is kept while the album has room; the 4th waits for the full version', () => {
  const st = fakeStore(Object.fromEntries(Object.entries(fourKept()).slice(0, 3)));
  let full = false;
  const s = createSession({ store: st, gameId: 'tekenen', owned: () => full, now: () => 500 });
  s.open(null);
  assert.equal(s.write(), 'empty');
  assert.equal(st.writes, 0);
  s.add(line(5));
  assert.equal(s.write(), 'nospace');
  assert.equal(s.id, null);
  full = true;
  assert.equal(s.write(), 'saved');
  assert.ok(s.id && st.loadDrawing('tekenen', s.id));
  // the free version again (a refund): the drawing it just kept may still be kept
  full = false;
  s.add(line(6));
  assert.equal(s.write(), 'saved');
});

test('session: a new drawing undone to nothing is deleted when the child leaves, not before', () => {
  const st = fakeStore();
  const s = createSession({ store: st, gameId: 'tekenen', owned: () => false });
  s.open(null);
  s.add(line(1));
  assert.equal(s.write(), 'saved');
  const id = s.id;
  s.undo();
  assert.equal(s.write(), 'empty');
  assert.ok(st.loadDrawing('tekenen', id));
  assert.equal(s.write({ final: true }), 'deleted');
  assert.equal(st.loadDrawing('tekenen', id), null);
});

test('session: a page too full to save is never taken for an empty one', () => {
  const st = fakeStore({ k1: { s: encode([line(1)]), t: 1 } });
  const s = createSession({ store: st, gameId: 'tekenen', owned: () => true });
  s.open('k1');
  const dots = Array.from({ length: 4000 }, (_, i) => ({ k: 's', c: 0, z: 0, a: 0, pts: [[i, i]] }));
  let added = 0;
  for (const d of dots) if (s.add(d)) added++;
  assert.ok(added < dots.length, 'add refuses once the page is full');
  assert.equal(s.write({ final: true }), 'saved');
  assert.ok(st.loadDrawing('tekenen', 'k1'), 'not deleted');
  s.items.push(...dots.slice(added)); // as if something slipped past add()
  assert.equal(s.write({ final: true }), 'full');
  assert.ok(st.loadDrawing('tekenen', 'k1'), 'still not deleted');
});

// ---------- Voortgang overzetten ----------

test('transfer: drawings pass sanitizePayload only in their own shape, and only for Tekenen', () => {
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
          dz: { s: 'sAAA.zzzz', t: 1 },
          __proto__x: { s: ok, t: 1 },
          'bad key!': { s: ok, t: 1 },
          d8: { s: ok, t: 9e15 },
          d9: { s: ok, t: -4, extra: '<script>' },
        },
        stars: { 1: 3 },
      },
      bubbels: { drawings: { d1: { s: ok, t: 1 } }, stars: { 1: 2 } },
      zzz: { drawings: { d1: { s: ok, t: 1 } } },
    },
  };
  const out = sanitizePayload(doc).games;
  assert.deepEqual(Object.keys(out.tekenen.drawings).sort(), ['__proto__x', 'd1', 'd2', 'd8', 'd9']);
  assert.deepEqual(out.tekenen.drawings.d2, { t: 200, gone: true });
  assert.deepEqual(out.tekenen.drawings.d9, { s: ok, t: 0 });
  assert.ok(out.tekenen.drawings.d8.t <= Date.now() + 864e5, 'a far-future time is clamped');
  assert.equal(out.bubbels.drawings, undefined, 'drawings only in the Tekenen section');
  assert.deepEqual(out.bubbels.stars, { 1: 2 });
  assert.equal(out.zzz.drawings, undefined);
  assert.deepEqual(sanitizePayload({ games: { tekenen: { drawings: [1, 2] } } }).games.tekenen.drawings, {});
});

test('transfer: at most DRAWINGS_BUDGET characters of drawings come in, the newest first', () => {
  const big = encode([{ k: 's', c: 1, z: 1, a: 0, pts: Array.from({ length: 5000, }, (_, i) => [i % 4000, (i * 7) % 4000]) }]);
  assert.ok(big.length > 19000 && big.length <= store.DRAWING_MAX);
  const drawings = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`d${i}`, { s: big, t: 1000 + i }]));
  const out = sanitizePayload({ games: { tekenen: { drawings } } }).games.tekenen.drawings;
  const kept = Object.keys(out);
  assert.equal(kept.length, Math.floor(DRAWINGS_BUDGET / big.length));
  assert.ok(kept.includes('d39') && !kept.includes('d0'), 'the newest are kept');
});

test('transfer: drawings travel, merge, count in the summary, and have their own "without drawings"', async () => {
  const text = encode(sample());
  const sender = {
    version: 1,
    games: { tekenen: { drawings: { d1: { s: text, t: 100 }, d2: { t: 50, gone: true } } }, kleuren: { art: { 'p:zon': { f: { face: 2 }, t: 1, done: false } } } },
    settings: {},
    purchase: { owned: true },
  };
  assert.equal(hasArt(sender), true);
  assert.equal(countDrawings(sender), 1);
  assert.equal(hasArt({ games: { kleuren: { art: { 'p:zon': { t: 1, gone: true } } } } }), false, 'only delete markers: nothing to leave out');
  assert.equal(countDrawings({ games: { tekenen: { drawings: { x: { t: 1, gone: true } } } } }), 0);
  const back = await decodeText(await encodeSave(sender));
  assert.deepEqual(back.games.tekenen.drawings, sender.games.tekenen.drawings);
  assert.deepEqual(summarize(back), [{ id: 'tekenen', n: 1 }, { id: 'kleuren', n: 1 }]);
  const mine = { version: 1, games: { tekenen: { drawings: { d0: { s: 'sAAAAAAA', t: 1 }, d2: { s: 'sBAAAAAA', t: 10 } } }, kleuren: { art: { 'p:huis': { f: { roof: 1 }, t: 2 } } } }, settings: {}, purchase: { owned: false } };
  const merged = mergeTransfer(mine, back).games.tekenen.drawings;
  assert.deepEqual(Object.keys(merged).sort(), ['d0', 'd1', 'd2']);
  assert.deepEqual(merged.d2, { t: 50, gone: true }, 'the newer delete wins');
  // without drawings: the colouring pages still go, and replace keeps the receiver's drawings
  const p = payloadOf(sender, { withDrawings: false });
  assert.equal(p.games.tekenen.drawings, undefined);
  assert.ok(p.games.kleuren.art['p:zon']);
  const noDraw = await decodeText(await encodeSave(sender, { withDrawings: false }));
  assert.equal(noDraw.noDrawings, true);
  assert.equal(noDraw.noArt, false);
  const out = replaceTransfer(mine, noDraw);
  assert.deepEqual(out.games.tekenen.drawings, mine.games.tekenen.drawings);
  assert.deepEqual(out.games.kleuren.art, sender.games.kleuren.art);
  // without colouring pages: the drawings still go
  const noArt = await decodeText(await encodeSave(sender, { withArt: false }));
  assert.deepEqual(noArt.games.tekenen.drawings, sender.games.tekenen.drawings);
  assert.deepEqual(replaceTransfer(mine, noArt).games.kleuren.art, mine.games.kleuren.art);
  assert.deepEqual(replaceTransfer(mine, back).games.tekenen.drawings, sender.games.tekenen.drawings);
});

test('transfer: when the drawings do not fit the codes, the oldest stay behind and that is said', async () => {
  // drawings of random-looking strokes hardly compress
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const drawing = () => encode([{ k: 's', c: 1, z: 1, a: 0, pts: Array.from({ length: 600 }, () => [Math.floor(rnd() * 4096), Math.floor(rnd() * 4096)]) }]);
  const drawings = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`d${i}`, { s: drawing(), t: 1000 + i }]));
  const save = { version: 1, games: { tekenen: { drawings }, bubbels: { stars: { 1: 3 } } }, settings: {}, purchase: {} };
  await assert.rejects(saveToParts(save), /too-big/);
  const { parts, leftOut } = await fitParts(save);
  assert.ok(leftOut > 0 && leftOut < 12, `${leftOut} left out`);
  const got = await decodeText(parts.map((p) => p.slice(p.indexOf(':') + 1)).join(''));
  const ids = Object.keys(got.games.tekenen.drawings);
  assert.equal(ids.length, 12 - leftOut);
  assert.ok(ids.includes('d11') && !ids.includes('d0'), 'the newest go along');
  assert.deepEqual(got.games.bubbels.stars, { 1: 3 });
  // small enough: nothing is left out
  assert.equal((await fitParts({ ...save, games: { tekenen: { drawings: { d0: drawings.d0 } } } })).leftOut, 0);
});
