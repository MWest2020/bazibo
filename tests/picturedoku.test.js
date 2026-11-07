import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TIERS, tierOf, boxOf, units, peers, boxIndex, parse, format, conflicts, candidates, solve, solveWithSingles, nextHint, starsFor, isSolved, validate,
} from '../web/games/picturedoku/rules.js';
import { generate, PLAN } from '../tools/gen-picturedoku.mjs';
import { PICTURES } from '../web/games/picturedoku/art.js';
import { AGE, HINTS } from '../web/games/picturedoku/picturedoku.js';
import * as store from '../web/js/storage.js';

const PUZZLES = JSON.parse(readFileSync(new URL('../web/games/picturedoku/puzzles.json', import.meta.url), 'utf8'));
const givensOf = (p) => [...p.givens].filter((ch) => ch !== '.').length;

test('every committed puzzle is well formed, has exactly one solution (the stored one) and needs only singles', () => {
  for (const p of PUZZLES) {
    assert.deepEqual(validate(p), [], `puzzle ${p.id}`);
    const { count, solution } = solve(p.n, p.givens, 3);
    assert.equal(count, 1, `puzzle ${p.id} has ${count} solutions`);
    assert.equal(solution, p.solution, `puzzle ${p.id}: stored solution differs`);
    assert.ok(solveWithSingles(p.n, p.givens).solved, `puzzle ${p.id} needs more than singles`);
  }
});

test('the age ladder: 4×4 with 2×2 boxes, 6×6 with 2×3, 9×9 with 3×3', () => {
  assert.deepEqual(TIERS.tiny, { n: 4, box: [2, 2] });
  assert.deepEqual(TIERS.small, { n: 6, box: [2, 3] });
  assert.deepEqual(TIERS.full, { n: 9, box: [3, 3] });
  for (const p of PUZZLES) assert.equal(p.tier, tierOf(p.n), `puzzle ${p.id}`);
  assert.deepEqual(boxOf(6), [2, 3]);
  assert.deepEqual(AGE, { 4: 3, 6: 6, 9: 8 });
  assert.equal(HINTS.tiny, Infinity);
  assert.ok(Number.isFinite(HINTS.small) && Number.isFinite(HINTS.full));
  assert.ok(PICTURES.length >= 9, 'a picture for every symbol of a 9×9');
});

test('60 puzzles, ids 1..60 in order, 10 free with a taste of every size, easy to hard within a size', () => {
  assert.equal(PUZZLES.length, 60);
  PUZZLES.forEach((p, i) => assert.equal(p.id, i + 1));
  const free = PUZZLES.filter((p) => p.free);
  assert.equal(free.length, 10);
  for (const n of [4, 6, 9]) {
    const ofSize = PUZZLES.filter((p) => p.n === n);
    const k = ofSize.filter((p) => p.free).length;
    assert.ok(k > 0, `no free ${n}×${n}`);
    assert.ok(ofSize.slice(0, k).every((p) => p.free), `${n}×${n}: the free ones come first`);
    for (let i = 1; i < ofSize.length; i++) assert.ok(givensOf(ofSize[i]) <= givensOf(ofSize[i - 1]), `${n}×${n}: puzzle ${ofSize[i].id} is easier than the one before`);
  }
  assert.deepEqual(PUZZLES.map((p) => p.n).filter((n, i, a) => a.indexOf(n) === i), [4, 6, 9]);
});

test('puzzles.json is exactly what tools/gen-picturedoku.mjs makes (no hand edits)', () => {
  assert.deepEqual(generate(), PUZZLES);
  assert.equal(PLAN.reduce((s, x) => s + x.count, 0), PUZZLES.length);
});

test('units and peers: rows, columns and boxes of the right size', () => {
  for (const n of [4, 6, 9]) {
    const u = units(n);
    assert.equal(u.length, 3 * n);
    for (const x of u) assert.equal(new Set(x.cells).size, n);
    const p = peers(n);
    const [bh, bw] = boxOf(n);
    assert.equal(p[0].length, 2 * (n - 1) + (bh - 1) * (bw - 1));
  }
  // 6×6 boxes are two rows high and three columns wide
  assert.equal(boxIndex(6, 0), 0);
  assert.equal(boxIndex(6, 2), 0);
  assert.equal(boxIndex(6, 3), 1);
  assert.equal(boxIndex(6, 6 * 2), 2);
});

test('conflicts: the same picture twice in a row, a column or a box', () => {
  const b = parse('1..1' + '....' + '....' + '....');
  assert.deepEqual(conflicts(4, b).map((c) => c.rule), ['row']);
  assert.deepEqual(conflicts(4, parse('1...' + '....' + '1...' + '....')).map((c) => c.rule), ['col']);
  assert.deepEqual(conflicts(4, parse('1...' + '.1..' + '....' + '....')).map((c) => c.rule), ['box']);
  const both = conflicts(4, parse('12..' + '1...' + '....' + '....'));
  assert.deepEqual(both.map((c) => c.rule).sort(), ['box', 'col']);
  assert.deepEqual(conflicts(4, parse('1234341221434321')), []);
});

test('candidates, singles and the solver', () => {
  const b = parse('123.' + '....' + '....' + '....');
  assert.deepEqual(candidates(4, b, 3), [4]);
  assert.deepEqual(candidates(4, b, 0), []);
  assert.equal(solve(4, '................', 2).count, 2); // an empty board has many
  assert.equal(solve(4, '11..............', 2).count, 0); // a clash has none
  const p = PUZZLES[0];
  assert.equal(format(parse(p.solution)), p.solution);
  assert.ok(isSolved(p, parse(p.solution)));
  assert.ok(!isSolved(p, parse(p.givens)));
});

test('hints: a wrong picture is taken out first, then a square where only one picture fits', () => {
  const p = PUZZLES[0];
  const sol = parse(p.solution);
  const board = parse(p.givens);
  const empty = board.findIndex((v) => !v);
  board[empty] = (sol[empty] % 4) + 1; // a wrong picture
  assert.deepEqual(nextHint(p, board), { cell: empty, to: 0, why: 'wrong' });
  board[empty] = 0;
  const h = nextHint(p, board);
  assert.equal(h.to, sol[h.cell]);
  assert.equal(h.why, 'only'); // the easiest 4×4 always has a square with one option
  assert.equal(nextHint(p, sol.slice()), null);
  // following hints from the start always ends solved
  for (const q of PUZZLES) {
    const bd = parse(q.givens);
    for (let k = 0; k < q.n * q.n; k++) {
      const x = nextHint(q, bd);
      if (!x) break;
      bd[x.cell] = x.to;
    }
    assert.ok(isSolved(q, bd), `hints do not finish puzzle ${q.id}`);
  }
});

test('stars: 3 without hints, 2 with one, 1 with more', () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(1), 2);
  assert.equal(starsFor(4), 1);
});

function memoryBackend(initial = null) {
  let value = initial;
  return { name: 'memory', get: async () => value, set: async (k, v) => void (value = v), dump: () => value };
}

test('save: Picturedoku keeps its own section next to the other games', async () => {
  const stored = JSON.stringify({ version: 1, games: { bubbels: { stars: { 1: 3 } }, dogudoku: { stars: { 2: 2 }, autoCross: true } }, settings: {}, purchase: { owned: true } });
  const b = memoryBackend(stored);
  await store.init({ backend: b, legacyStorage: null });
  assert.deepEqual(store.loadProgress('picturedoku'), { stars: {} });
  assert.equal(store.loadGameOption('picturedoku', 'numbers', false), false);
  store.recordStars('picturedoku', 1, 3);
  store.recordStars('picturedoku', 43, 1);
  store.recordStars('picturedoku', 43, 2);
  store.recordStars('picturedoku', 1, 1); // a worse replay never lowers it
  store.saveGameOption('picturedoku', 'numbers', true);
  store.saveGameOption('picturedoku', 'howSeen', { tiny: true });
  await store.flushed();
  const saved = JSON.parse(b.dump());
  assert.deepEqual(saved.games.bubbels, { stars: { 1: 3 } });
  assert.deepEqual(saved.games.dogudoku, { stars: { 2: 2 }, autoCross: true });
  assert.deepEqual(saved.games.picturedoku, { stars: { 1: 3, 43: 2 }, numbers: true, howSeen: { tiny: true } });
  assert.equal(saved.purchase.owned, true);
});
