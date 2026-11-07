// Generate Picturedoku's puzzles into web/games/picturedoku/puzzles.json. Deterministic (seeded),
// so running it again gives the same file. Every puzzle has exactly one solution and can be solved
// with singles only: a cell where just one picture fits, or a picture that fits in just one cell of
// a row, column or box. No guessing, no advanced tricks; harder means fewer pictures to start with
// and more of the "only one place for this picture" kind of step. Within a size the puzzles go
// from easy to hard.
//   npm run puzzles
import { writeFileSync } from 'node:fs';
import { solve, solveWithSingles, format, peers, validate, tierOf } from '../web/games/picturedoku/rules.js';

const OUT = new URL('../web/games/picturedoku/puzzles.json', import.meta.url).pathname;

// size, how many, how many free (10 free in total, a taste of every size), givens from easy to hard
export const PLAN = [
  { n: 4, count: 20, free: 4, givens: [11, 6] },
  { n: 6, count: 22, free: 4, givens: [24, 13] },
  { n: 9, count: 18, free: 2, givens: [44, 28] },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffle = (arr, rand) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/** A random full board: backtracking, trying the pictures in a random order per cell. */
function fullBoard(n, rand) {
  const board = new Array(n * n).fill(0);
  const peer = peers(n);
  const fill = (i) => {
    if (i === board.length) return true;
    for (const v of shuffle([...Array(n).keys()].map((k) => k + 1), rand)) {
      if (peer[i].some((j) => board[j] === v)) continue;
      board[i] = v;
      if (fill(i + 1)) return true;
    }
    board[i] = 0;
    return false;
  };
  fill(0);
  return board;
}

/** Take pictures away, one at a time in random order, while the puzzle stays unique and singles-solvable. */
function dig(n, solution, target, rand) {
  const board = solution.slice();
  let givens = board.length;
  for (const i of shuffle([...board.keys()], rand)) {
    if (givens <= target) break;
    const v = board[i];
    board[i] = 0;
    if (solve(n, board, 2).count === 1 && solveWithSingles(n, board).solved) givens--;
    else board[i] = v;
  }
  return board;
}

function makePuzzle(n, target, rand, seen) {
  let best = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const solution = fullBoard(n, rand);
    const board = dig(n, solution, target, rand);
    const givens = format(board);
    if (seen.has(givens)) continue;
    const count = board.filter(Boolean).length;
    const { hidden } = solveWithSingles(n, board);
    const candidate = { n, tier: tierOf(n), givens, solution: format(solution), count, hidden };
    if (!best || Math.abs(count - target) < Math.abs(best.count - target)) best = candidate;
    if (count <= target) break;
  }
  if (!best) throw new Error(`no ${n}×${n} puzzle found`);
  seen.add(best.givens);
  return best;
}

export function generate(seed = 20261108) {
  const rand = mulberry32(seed);
  const seen = new Set();
  const out = [];
  for (const step of PLAN) {
    const [easy, hard] = step.givens;
    const batch = [];
    for (let i = 0; i < step.count; i++) {
      const target = Math.round(easy + ((hard - easy) * i) / Math.max(1, step.count - 1));
      batch.push(makePuzzle(step.n, target, rand, seen));
    }
    // easy to hard: more pictures to start with first, then fewer "only place" steps
    batch.sort((a, b) => b.count - a.count || a.hidden - b.hidden);
    batch.forEach((p, i) => {
      const { count, hidden, ...rest } = p;
      out.push({ id: out.length + 1, ...rest, free: i < step.free });
    });
  }
  for (const p of out) {
    const problems = validate(p);
    if (problems.length) throw new Error(`puzzle ${p.id}: ${problems.join(', ')}`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const puzzles = generate();
  const lines = puzzles.map((p) => '  ' + JSON.stringify(p));
  writeFileSync(OUT, `[\n${lines.join(',\n')}\n]\n`);
  const bySize = {};
  for (const p of puzzles) {
    const k = `${p.n}×${p.n}`;
    const g = [...p.givens].filter((ch) => ch !== '.').length;
    bySize[k] ??= { count: 0, givens: [] };
    bySize[k].count++;
    bySize[k].givens.push(g);
  }
  for (const v of Object.values(bySize)) v.givens = `${v.givens[0]}..${v.givens.at(-1)}`;
  console.log(`wrote ${puzzles.length} puzzles (${puzzles.filter((p) => p.free).length} free):`, bySize);
}
