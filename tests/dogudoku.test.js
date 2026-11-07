import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIERS, conflicts, isSolved, attacked, solve, validate, nextHint, starsFor, regionGrid } from '../web/games/dogudoku/rules.js';
import { generate, PLAN } from '../tools/gen-dogudoku.mjs';
import * as store from '../web/js/storage.js';

const PUZZLES = JSON.parse(readFileSync(new URL('../web/games/dogudoku/puzzles.json', import.meta.url), 'utf8'));
const TIER_OF = { 4: 'tiny', 5: 'small', 6: 'full', 7: 'full', 8: 'full' };

test('every committed puzzle is well formed and has exactly one solution, the stored one', () => {
  for (const p of PUZZLES) {
    assert.deepEqual(validate(p), [], `puzzle ${p.id}`);
    const { count, solution } = solve(p, 3);
    assert.equal(count, 1, `puzzle ${p.id} has ${count} solutions`);
    assert.deepEqual(solution, p.solution, `puzzle ${p.id}: stored solution differs`);
  }
});

test('the age ladder: never touching on every size; 4×4 with bushes, from 5×5 colours too', () => {
  for (const p of PUZZLES) {
    assert.equal(p.tier, TIER_OF[p.n], `puzzle ${p.id}`);
    if (p.tier === 'tiny') {
      assert.equal(p.regions, null);
      assert.ok(p.bushes.length > 0);
    } else {
      assert.equal(new Set(p.regions.join('')).size, p.n, `puzzle ${p.id} needs ${p.n} colours`);
      assert.deepEqual(p.bushes, []);
    }
  }
  assert.deepEqual(TIERS.tiny, { regions: false, touch: true });
  assert.deepEqual(TIERS.small, { regions: true, touch: true });
  assert.deepEqual(TIERS.full, { regions: true, touch: true });
});

test('about 60 puzzles, ids 1..n in order, 10 free with a taste of every size', () => {
  assert.equal(PUZZLES.length, 60);
  PUZZLES.forEach((p, i) => assert.equal(p.id, i + 1));
  const free = PUZZLES.filter((p) => p.free);
  assert.equal(free.length, 10);
  for (const n of [4, 5, 6, 7, 8]) assert.ok(free.some((p) => p.n === n), `no free ${n}×${n}`);
  // within a size the free ones come first (they are the easiest)
  for (const n of [4, 5, 6, 7, 8]) {
    const ofSize = PUZZLES.filter((p) => p.n === n);
    const k = ofSize.filter((p) => p.free).length;
    assert.ok(ofSize.slice(0, k).every((p) => p.free));
  }
});

test('puzzles.json is exactly what tools/gen-dogudoku.mjs makes (no hand edits)', () => {
  assert.deepEqual(generate(), PUZZLES);
  assert.equal(PLAN.reduce((s, x) => s + x.count, 0), PUZZLES.length);
});

const small = { n: 5, tier: 'small', regions: ['AABBB', 'AACBB', 'DDCCE', 'DDCEE', 'DDDEE'], bushes: [], solution: [1, 3, 0, 2, 4] };
const full = { n: 4, tier: 'full', regions: ['AABB', 'AABB', 'CCDD', 'CCDD'], bushes: [], solution: [1, 3, 0, 2] };
const tiny = { n: 4, tier: 'tiny', regions: null, bushes: [[0, 0], [1, 1]], solution: [1, 3, 0, 2] };

test('conflicts: same row, column, colour, touching, and a puppy in a bush', () => {
  assert.deepEqual(conflicts(small, [[0, 0], [0, 3]]).map((c) => c.rule), ['row']);
  assert.deepEqual(conflicts(small, [[0, 1], [3, 1]]).map((c) => c.rule), ['col']);
  assert.deepEqual(conflicts(small, [[0, 0], [1, 1]]).map((c) => c.rule), ['region', 'touch']);
  assert.deepEqual(conflicts(small, [[2, 2], [4, 0]]), []); // apart and other colours
  // never touching, not even diagonally, on every size (Mark, 2026-11-07)
  assert.deepEqual(conflicts(small, [[2, 2], [3, 3]]).map((c) => c.rule), ['touch']);
  assert.deepEqual(conflicts(tiny, [[0, 1], [1, 2]]).map((c) => c.rule), ['touch']);
  assert.deepEqual(conflicts(tiny, [[2, 0], [3, 1]]).map((c) => c.rule), ['touch']);
  assert.deepEqual(conflicts(tiny, [[0, 1], [2, 0]]), []); // two rows apart: fine
  assert.deepEqual(conflicts(full, [[1, 1], [2, 2]]).map((c) => c.rule), ['touch']);
  assert.deepEqual(conflicts(tiny, [[0, 0]]).map((c) => c.rule), ['bush']);
  assert.deepEqual(conflicts(small, []), []);
});

test('isSolved and attacked follow the tier rules', () => {
  const dogs = (p) => p.solution.map((c, r) => [r, c]);
  assert.ok(isSolved(small, dogs(small)));
  assert.ok(isSolved(tiny, dogs(tiny)));
  assert.ok(!isSolved(small, dogs(small).slice(1)));
  assert.equal(attacked(full, [[0, 1]], 1, 2), true); // diagonal neighbour
  assert.equal(attacked(small, [[0, 1]], 1, 2), true); // a diagonal neighbour, on 5×5 too
  assert.equal(attacked(tiny, [[0, 1]], 1, 0), true); // and on 4×4
  assert.equal(attacked(small, [[0, 0]], 1, 1), true); // same colour
  assert.equal(attacked(small, [[0, 0]], 2, 3), false);
  assert.equal(attacked(tiny, [], 1, 1), true); // a bush
  assert.deepEqual(regionGrid(full), [[0, 0, 1, 1], [0, 0, 1, 1], [2, 2, 3, 3], [2, 2, 3, 3]]);
});

test('hints: a wrong puppy goes, a wrong cross is cleared, a ruled-out square is crossed, else a puppy is placed', () => {
  assert.deepEqual(nextHint(small, { '0,0': 'dog' }), { r: 0, c: 0, to: 'cross', why: 'wrong-dog' });
  assert.deepEqual(nextHint(tiny, { '0,2': 'dog' }), { r: 0, c: 2, to: 'empty', why: 'wrong-dog' });
  assert.deepEqual(nextHint(small, { '0,1': 'cross' }), { r: 0, c: 1, to: 'empty', why: 'wrong-cross' });
  const ruled = nextHint(small, { '0,1': 'dog' });
  assert.equal(ruled.to, 'cross');
  assert.equal(ruled.why, 'ruled-out');
  assert.equal(nextHint(small, { '0,1': 'dog' }, { autoCross: true }).to, 'dog'); // auto-cross already shows those
  assert.equal(nextHint(tiny, {}).to, 'dog'); // the youngest never get crosses
  assert.equal(nextHint(small, Object.fromEntries(small.solution.map((c, r) => [`${r},${c}`, 'dog']))), null);
});

test('following the hints alone solves every puzzle', () => {
  for (const p of PUZZLES) {
    for (const autoCross of [false, true]) {
      const marks = new Map();
      let steps = 0;
      for (let h = nextHint(p, marks, { autoCross }); h; h = nextHint(p, marks, { autoCross })) {
        if (h.to === 'empty') marks.delete(`${h.r},${h.c}`);
        else marks.set(`${h.r},${h.c}`, h.to);
        assert.ok(++steps <= p.n * p.n + p.n, `puzzle ${p.id}: hints loop`);
      }
      const dogs = [...marks].filter(([, v]) => v === 'dog').map(([k]) => k.split(',').map(Number));
      assert.ok(isSolved(p, dogs), `puzzle ${p.id} not solved by hints`);
    }
  }
});

test('stars: 3 without hints, 2 with one, 1 with more', () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(1), 2);
  assert.equal(starsFor(2), 1);
  assert.equal(starsFor(9), 1);
});

// a minimal in-memory backend for storage.init
function memoryBackend(initial = null) {
  let value = initial;
  return { name: 'memory', get: async () => value, set: async (k, v) => void (value = v), dump: () => value };
}

test('save: Dogudoku keeps its own section (stars and options) next to Bubbels', async () => {
  const stored = JSON.stringify({ version: 1, games: { bubbels: { stars: { 1: 3 } } }, settings: {}, purchase: { owned: false } });
  const b = memoryBackend(stored);
  await store.init({ backend: b, legacyStorage: null });
  assert.deepEqual(store.loadProgress('dogudoku'), { stars: {} });
  assert.equal(store.loadGameOption('dogudoku', 'autoCross', false), false);
  store.saveProgress('dogudoku', { stars: { 1: 3, 27: 2 } });
  store.saveGameOption('dogudoku', 'autoCross', true);
  store.saveGameOption('dogudoku', 'howSeen', { tiny: true });
  await store.flushed();
  const saved = JSON.parse(b.dump());
  assert.deepEqual(saved.games.bubbels, { stars: { 1: 3 } });
  assert.deepEqual(saved.games.dogudoku, { stars: { 1: 3, 27: 2 }, autoCross: true, howSeen: { tiny: true } });
  // saving stars keeps the options, and options never overwrite stars
  store.saveProgress('dogudoku', { stars: { 1: 3, 27: 3 } });
  await store.flushed();
  assert.deepEqual(JSON.parse(b.dump()).games.dogudoku.autoCross, true);
  assert.throws(() => store.saveGameOption('dogudoku', 'stars', {}));
  assert.equal(store.loadGameOption('dogudoku', 'stars', 'no'), 'no');
});

test('save: a recovered session merges Dogudoku stars like Bubbels stars', () => {
  const storedSave = { version: 1, games: { dogudoku: { stars: { 1: 1, 2: 3 }, autoCross: true } }, settings: {}, purchase: { owned: false } };
  const session = { games: { dogudoku: { stars: { 1: 3, 5: 2 } } }, settings: { muted: false, lang: null }, purchase: { owned: false } };
  const out = store.mergeSaves(storedSave, session, false);
  assert.deepEqual(out.games.dogudoku, { stars: { 1: 3, 2: 3, 5: 2 }, autoCross: true });
});
