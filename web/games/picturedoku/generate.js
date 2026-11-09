// Picturedoku's puzzle generator, shared by the build tool (tools/gen-picturedoku.mjs, which writes
// the fixed puzzles.json) and the game itself (random puzzles in the full version). Seeded, so a
// seed always gives the same puzzle. Every puzzle has exactly one solution and is solvable with
// singles only (no guessing).
import { solve, solveWithSingles, format, peers, validate, tierOf } from './rules.js';

// The random-play tiers: one per board size, with the range of starting pictures the fixed
// puzzles of that size use (easy..hard). A random puzzle picks a target inside that range.
export const RANDOM_TIERS = Object.freeze([
  Object.freeze({ key: 's4', n: 4, givens: Object.freeze([11, 6]) }),
  Object.freeze({ key: 's6', n: 6, givens: Object.freeze([24, 13]) }),
  Object.freeze({ key: 's9', n: 9, givens: Object.freeze([44, 28]) }),
]);

export function mulberry32(seed) {
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

export function makePuzzle(n, target, rand, seen) {
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

/** One random puzzle for a tier key ('s4', 's6', 's9'), from a 32-bit seed. Checked before it is returned. */
export function randomPuzzle(key, seed) {
  const spec = RANDOM_TIERS.find((t) => t.key === key);
  if (!spec) throw new Error(`unknown tier ${key}`);
  const rand = mulberry32(seed);
  const [easy, hard] = spec.givens;
  const target = hard + Math.floor(rand() * (easy - hard + 1));
  const { count, hidden, ...p } = makePuzzle(spec.n, target, rand, new Set());
  const puzzle = { id: `r-${key}-${seed >>> 0}`, ...p, free: false, seed: seed >>> 0 };
  const problems = validate(puzzle);
  if (problems.length) throw new Error(`random puzzle ${puzzle.id}: ${problems.join(', ')}`);
  return puzzle;
}
