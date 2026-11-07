// Dogudoku's rules, pure so they can be tested and used by the puzzle generator
// (tools/gen-dogudoku.mjs). A puzzle is an n×n board; a solution has exactly one dog per row and
// per column, plus, depending on the tier:
//   tiny  (4×4, ages 3-5): no regions; some cells are bushes where no dog can sit
//   small (5×5, ages 5-7): one dog per colour region as well
//   full  (6×6-8×8, 7-10): one dog per region, and dogs never touch, not even diagonally
// Puzzle data: { id, n, tier, regions: ['AABB', ...] | null, bushes: [[r, c], ...], solution: [col per row] }

export const TIERS = Object.freeze({
  tiny: Object.freeze({ regions: false, touch: false }),
  small: Object.freeze({ regions: true, touch: false }),
  full: Object.freeze({ regions: true, touch: true }),
});

export const rulesOf = (puzzle) => TIERS[puzzle.tier];

/** Region index per cell (rows of numbers), or null when the tier has no regions. */
export function regionGrid(puzzle) {
  if (!puzzle.regions) return null;
  const letters = [...new Set(puzzle.regions.join(''))].sort();
  return puzzle.regions.map((row) => [...row].map((ch) => letters.indexOf(ch)));
}

export function bushSet(puzzle) {
  return new Set((puzzle.bushes || []).map(([r, c]) => r * puzzle.n + c));
}

const touching = (a, b) => Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;

/**
 * Which placed dogs break which rule. dogs: [[r, c], ...].
 * Returns [{ rule: 'row'|'col'|'region'|'touch'|'bush', cells: [[r, c], ...] }, ...].
 */
export function conflicts(puzzle, dogs) {
  const rules = rulesOf(puzzle);
  const regions = regionGrid(puzzle);
  const bushes = bushSet(puzzle);
  const out = [];
  const group = (rule, keyOf) => {
    const by = new Map();
    for (const d of dogs) {
      const k = keyOf(d);
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(d);
    }
    for (const cells of by.values()) if (cells.length > 1) out.push({ rule, cells });
  };
  group('row', (d) => d[0]);
  group('col', (d) => d[1]);
  if (rules.regions && regions) group('region', (d) => regions[d[0]][d[1]]);
  if (rules.touch) {
    for (let i = 0; i < dogs.length; i++) {
      for (let j = i + 1; j < dogs.length; j++) {
        // same row is already a row conflict; only report touching across rows
        if (dogs[i][0] !== dogs[j][0] && touching(dogs[i], dogs[j])) out.push({ rule: 'touch', cells: [dogs[i], dogs[j]] });
      }
    }
  }
  for (const d of dogs) if (bushes.has(d[0] * puzzle.n + d[1])) out.push({ rule: 'bush', cells: [d] });
  return out;
}

/** n dogs and no conflicts: the board is solved (the puzzles have one solution, so this is it). */
export function isSolved(puzzle, dogs) {
  return dogs.length === puzzle.n && conflicts(puzzle, dogs).length === 0;
}

/** Can a dog sit at (r, c) given these other dogs? Used for auto-cross and hints. */
export function attacked(puzzle, dogs, r, c) {
  const rules = rulesOf(puzzle);
  const regions = regionGrid(puzzle);
  if (bushSet(puzzle).has(r * puzzle.n + c)) return true;
  for (const [dr, dc] of dogs) {
    if (dr === r && dc === c) continue;
    if (dr === r || dc === c) return true;
    if (rules.regions && regions && regions[dr][dc] === regions[r][c]) return true;
    if (rules.touch && Math.abs(dr - r) <= 1 && Math.abs(dc - c) <= 1) return true;
  }
  return false;
}

/**
 * Count solutions, stopping at `limit`. Also returns the search effort (nodes), a rough measure
 * of how hard the puzzle is. Row by row: one dog per row is built in.
 */
export function solve(puzzle, limit = 2) {
  const { n } = puzzle;
  const rules = rulesOf(puzzle);
  const regions = regionGrid(puzzle);
  const bushes = bushSet(puzzle);
  const usedCol = new Array(n).fill(false);
  const usedRegion = new Array(n).fill(false);
  const cols = new Array(n).fill(-1);
  let count = 0;
  let nodes = 0;
  let first = null;
  const place = (r) => {
    if (count >= limit) return;
    if (r === n) {
      count++;
      if (!first) first = cols.slice();
      return;
    }
    for (let c = 0; c < n; c++) {
      if (usedCol[c] || bushes.has(r * n + c)) continue;
      const reg = regions ? regions[r][c] : -1;
      if (rules.regions && regions && usedRegion[reg]) continue;
      if (rules.touch && r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
      nodes++;
      usedCol[c] = true;
      if (reg >= 0) usedRegion[reg] = true;
      cols[r] = c;
      place(r + 1);
      usedCol[c] = false;
      if (reg >= 0) usedRegion[reg] = false;
      cols[r] = -1;
    }
  };
  place(0);
  return { count, nodes, solution: first };
}

/** Structural checks on puzzle data (used by the tests). Returns a list of problems. */
export function validate(puzzle) {
  const problems = [];
  const { n, tier } = puzzle;
  const rules = TIERS[tier];
  if (!rules) return [`unknown tier ${tier}`];
  if (!Array.isArray(puzzle.solution) || puzzle.solution.length !== n) problems.push('solution length');
  if (rules.regions) {
    if (!Array.isArray(puzzle.regions) || puzzle.regions.length !== n || puzzle.regions.some((row) => row.length !== n)) {
      problems.push('regions shape');
    } else if (new Set(puzzle.regions.join('')).size !== n) {
      problems.push(`needs ${n} regions`);
    } else if (!regionsConnected(puzzle)) {
      problems.push('a region is split in two');
    }
  } else if (puzzle.regions) {
    problems.push('tier has no regions');
  }
  if (!rules.regions && !(puzzle.bushes || []).length && n > 1) problems.push('tiny puzzle without bushes cannot be unique');
  if (problems.length) return problems;
  const dogs = puzzle.solution.map((c, r) => [r, c]);
  if (!isSolved(puzzle, dogs)) problems.push('stored solution breaks a rule');
  return problems;
}

function regionsConnected(puzzle) {
  const regions = regionGrid(puzzle);
  const { n } = puzzle;
  const seen = new Set();
  const regionsSeen = new Set();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (seen.has(r * n + c)) continue;
      const id = regions[r][c];
      if (regionsSeen.has(id)) return false; // a second patch of the same region
      regionsSeen.add(id);
      const stack = [[r, c]];
      seen.add(r * n + c);
      while (stack.length) {
        const [y, x] = stack.pop();
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= n || xx >= n || seen.has(yy * n + xx) || regions[yy][xx] !== id) continue;
          seen.add(yy * n + xx);
          stack.push([yy, xx]);
        }
      }
    }
  }
  return true;
}

/**
 * The next hint for a board. marks: Map/obj key 'r,c' -> 'dog' | 'cross'.
 * Returns { r, c, to: 'dog' | 'cross' | 'empty', why } or null when solved.
 *   1. a dog in the wrong place: it must go (to 'cross'; in the youngest tier to 'empty')
 *   2. a cross on a cell that needs a dog: clear it (to 'empty'), the next hint places the dog
 *   3. an empty cell that a correct dog already rules out: cross it (not in the youngest tier, and
 *      not with auto-cross on: those cells already show as crossed)
 *   4. otherwise: place a dog from the solution, in the row with the fewest open cells
 */
export function nextHint(puzzle, marks, { autoCross = false } = {}) {
  const { n, solution } = puzzle;
  const get = (r, c) => (marks instanceof Map ? marks.get(`${r},${c}`) : marks[`${r},${c}`]);
  const isSol = (r, c) => solution[r] === c;
  const crosses = puzzle.tier !== 'tiny'; // the youngest tier has no crosses: a tap places or lifts a dog
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (get(r, c) === 'dog' && !isSol(r, c)) return { r, c, to: crosses ? 'cross' : 'empty', why: 'wrong-dog' };
  }
  for (let r = 0; r < n; r++) if (get(r, solution[r]) === 'cross') return { r, c: solution[r], to: 'empty', why: 'wrong-cross' };
  const correct = [];
  for (let r = 0; r < n; r++) if (get(r, solution[r]) === 'dog') correct.push([r, solution[r]]);
  if (correct.length === n) return null;
  const bushes = bushSet(puzzle);
  for (let r = 0; crosses && !autoCross && r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (get(r, c) || bushes.has(r * n + c)) continue;
      if (attacked(puzzle, correct, r, c)) return { r, c, to: 'cross', why: 'ruled-out' };
    }
  }
  let best = null;
  for (let r = 0; r < n; r++) {
    if (get(r, solution[r]) === 'dog') continue;
    let open = 0;
    for (let c = 0; c < n; c++) if (!get(r, c) && !bushes.has(r * n + c)) open++;
    if (!best || open < best.open) best = { r, open };
  }
  return { r: best.r, c: solution[best.r], to: 'dog', why: 'place' };
}

/** Stars for a solved puzzle: 3 without hints, 2 with one, 1 with more. */
export function starsFor(hintsUsed) {
  return hintsUsed <= 0 ? 3 : hintsUsed === 1 ? 2 : 1;
}
