// Generate Dogudoku's puzzles into web/games/dogudoku/puzzles.json. Deterministic (seeded), so
// running it again gives the same file. Every puzzle is checked to have exactly one solution;
// within a size the puzzles are sorted from easy to hard (by the solver's search effort).
//   npm run puzzles
import { writeFileSync } from 'node:fs';
import { solve, validate } from '../web/games/dogudoku/rules.js';

const OUT = new URL('../web/games/dogudoku/puzzles.json', import.meta.url).pathname;

// size, tier, how many, how many of them are free (10 free in total, a taste of every size)
export const PLAN = [
  { n: 4, tier: 'tiny', count: 12, free: 4 },
  { n: 5, tier: 'small', count: 14, free: 3 },
  { n: 6, tier: 'full', count: 12, free: 1 },
  { n: 7, tier: 'full', count: 12, free: 1 },
  { n: 8, tier: 'full', count: 10, free: 1 },
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

/** A random column per row; with `touch`, neighbouring rows' dogs are at least two columns apart. */
function randomSolution(n, touch, rand) {
  for (;;) {
    const cols = [];
    const used = new Set();
    let ok = true;
    for (let r = 0; r < n && ok; r++) {
      const options = shuffle([...Array(n).keys()], rand).filter((c) => !used.has(c) && (!touch || r === 0 || Math.abs(cols[r - 1] - c) > 1));
      if (!options.length) ok = false;
      else {
        cols.push(options[0]);
        used.add(options[0]);
      }
    }
    if (ok) return cols;
  }
}

/** Grow n regions from the dogs' cells, one random neighbour at a time, until the board is full. */
function growRegions(n, solution, rand) {
  const grid = Array.from({ length: n }, () => new Array(n).fill(-1));
  solution.forEach((c, r) => (grid[r][c] = r));
  let left = n * n - n;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (left > 0) {
    const region = Math.floor(rand() * n);
    const frontier = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c] !== region) continue;
        for (const [dr, dc] of DIRS) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < n && cc < n && grid[rr][cc] === -1) frontier.push([rr, cc]);
        }
      }
    }
    if (!frontier.length) continue;
    const [rr, cc] = frontier[Math.floor(rand() * frontier.length)];
    grid[rr][cc] = region;
    left--;
  }
  const letters = 'ABCDEFGH';
  return grid.map((row) => row.map((v) => letters[v]).join(''));
}

/**
 * Bushes for the youngest tier. With no-touch, a 4×4 board has only two solutions, so one well
 * placed bush already makes it unique; a few more (never on the solution) give the boards
 * variety. Keep a random 1-4 bushes, as long as the solution stays the only one.
 */
function placeBushes(n, solution, rand) {
  const cells = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (solution[r] !== c) cells.push([r, c]);
  for (;;) {
    const want = 1 + Math.floor(rand() * 4);
    const bushes = shuffle(cells.slice(), rand).slice(0, want);
    if (solve({ n, tier: 'tiny', regions: null, bushes }).count === 1) return bushes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
}

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function connected(grid, n, id) {
  let start = null;
  let total = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (grid[r][c] === id) (total++, start ??= [r, c]);
  if (!start) return false;
  const seen = new Set([start[0] * n + start[1]]);
  const stack = [start];
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of DIRS4) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n || grid[rr][cc] !== id || seen.has(rr * n + cc)) continue;
      seen.add(rr * n + cc);
      stack.push([rr, cc]);
    }
  }
  return seen.size === total;
}

/**
 * Random region growth alone seldom gives one solution on bigger boards. Hill-climb: move one
 * border cell (never a dog's own cell) to a neighbouring region, keeping every region in one
 * piece, and keep the move when the number of solutions does not go up.
 */
function refineRegions(puzzle, rand, steps = 3000) {
  const { n, solution } = puzzle;
  const letters = 'ABCDEFGH';
  const grid = puzzle.regions.map((row) => [...row].map((ch) => letters.indexOf(ch)));
  const asPuzzle = () => ({ ...puzzle, regions: grid.map((row) => row.map((v) => letters[v]).join('')) });
  let count = solve(asPuzzle(), 400).count;
  for (let i = 0; i < steps && count > 1; i++) {
    const r = Math.floor(rand() * n);
    const c = Math.floor(rand() * n);
    if (solution[r] === c) continue;
    const [dr, dc] = DIRS4[Math.floor(rand() * 4)];
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
    const from = grid[r][c];
    const to = grid[rr][cc];
    if (from === to) continue;
    grid[r][c] = to;
    if (!connected(grid, n, from)) {
      grid[r][c] = from;
      continue;
    }
    const next = solve(asPuzzle(), 400).count;
    if (next <= count) count = next;
    else grid[r][c] = from;
  }
  return count === 1 ? asPuzzle().regions : null;
}

function makePuzzle({ n, tier }, rand, seen) {
  for (let attempt = 0; attempt < 20000; attempt++) {
    const touch = true; // every size: puppies never touch
    const solution = randomSolution(n, touch, rand);
    const puzzle = { n, tier, regions: null, bushes: [], solution };
    if (tier === 'tiny') puzzle.bushes = placeBushes(n, solution, rand);
    else {
      puzzle.regions = growRegions(n, solution, rand);
      puzzle.regions = refineRegions(puzzle, rand);
      if (!puzzle.regions) continue;
    }
    const key = JSON.stringify([puzzle.regions, puzzle.bushes]);
    if (seen.has(key)) continue;
    const { count, nodes } = solve(puzzle);
    if (count !== 1) continue;
    // a region of one cell gives its dog away; allow at most one per puzzle
    if (puzzle.regions) {
      const sizes = {};
      for (const ch of puzzle.regions.join('')) sizes[ch] = (sizes[ch] || 0) + 1;
      if (Object.values(sizes).filter((s) => s === 1).length > 1) continue;
    }
    seen.add(key);
    return { ...puzzle, effort: nodes };
  }
  throw new Error(`no unique ${n}×${n} ${tier} puzzle found`);
}

export function generate(seed = 20261107) {
  const rand = mulberry32(seed);
  const seen = new Set();
  const out = [];
  for (const step of PLAN) {
    const batch = [];
    for (let i = 0; i < step.count; i++) batch.push(makePuzzle(step, rand, seen));
    batch.sort((a, b) => a.effort - b.effort);
    batch.forEach((p, i) => {
      const { effort, ...rest } = p;
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
  for (const p of puzzles) bySize[`${p.n}×${p.n}`] = (bySize[`${p.n}×${p.n}`] || 0) + 1;
  console.log(`wrote ${puzzles.length} puzzles (${puzzles.filter((p) => p.free).length} free):`, bySize);
}
