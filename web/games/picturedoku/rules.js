// Picturedoku's rules, pure so they can be tested and used by the puzzle generator
// (tools/gen-picturedoku.mjs). A sudoku with pictures: every row, every column and every box holds
// each picture once.
//   tiny  (4×4, 2×2 boxes, 4 pictures, ages 3-6): pictures only
//   small (6×6, 2×3 boxes, 6 pictures, ages 6-8)
//   full  (9×9, 3×3 boxes, 9 pictures, ages 8-10)
// Puzzle data: { id, n, tier, givens: '1..3....', solution: '1243...', free }
//   one character per cell, row by row; '1'-'9' is a picture, '.' is an empty cell.
// A board in play is an array of n*n numbers: 0 for empty, 1..n for a picture.

export const TIERS = Object.freeze({
  tiny: Object.freeze({ n: 4, box: [2, 2] }),
  small: Object.freeze({ n: 6, box: [2, 3] }),
  full: Object.freeze({ n: 9, box: [3, 3] }),
});

export const tierOf = (n) => (n === 4 ? 'tiny' : n === 6 ? 'small' : 'full');

/** Box height and width for an n×n board: 4 → 2×2, 6 → 2×3 (two rows, three columns), 9 → 3×3. */
export function boxOf(n) {
  return TIERS[tierOf(n)].box;
}

export function parse(str) {
  return [...str].map((ch) => (ch === '.' ? 0 : Number(ch)));
}

export function format(board) {
  return board.map((v) => (v ? String(v) : '.')).join('');
}

/** The cell indexes of every row, column and box ("units"), each tagged with its kind. */
export function units(n) {
  const [bh, bw] = boxOf(n);
  const out = [];
  for (let r = 0; r < n; r++) out.push({ kind: 'row', index: r, cells: [...Array(n).keys()].map((c) => r * n + c) });
  for (let c = 0; c < n; c++) out.push({ kind: 'col', index: c, cells: [...Array(n).keys()].map((r) => r * n + c) });
  for (let br = 0; br < n; br += bh) {
    for (let bc = 0; bc < n; bc += bw) {
      const cells = [];
      for (let r = br; r < br + bh; r++) for (let c = bc; c < bc + bw; c++) cells.push(r * n + c);
      out.push({ kind: 'box', index: out.length - 2 * n, cells });
    }
  }
  return out;
}

const UNITS = new Map();
const unitsOf = (n) => {
  if (!UNITS.has(n)) UNITS.set(n, units(n));
  return UNITS.get(n);
};

/** For every cell, the other cells that share its row, column or box. */
const PEERS = new Map();
export function peers(n) {
  if (!PEERS.has(n)) {
    const sets = Array.from({ length: n * n }, () => new Set());
    for (const u of unitsOf(n)) for (const a of u.cells) for (const b of u.cells) if (a !== b) sets[a].add(b);
    PEERS.set(n, sets.map((s) => [...s]));
  }
  return PEERS.get(n);
}

export function boxIndex(n, i) {
  const [bh, bw] = boxOf(n);
  const r = Math.floor(i / n);
  const c = i % n;
  return Math.floor(r / bh) * (n / bw) + Math.floor(c / bw);
}

/**
 * Which pictures clash: the same picture twice in a row, column or box.
 * Returns [{ rule: 'row'|'col'|'box', value, cells: [cell index, ...] }, ...].
 */
export function conflicts(n, board) {
  const out = [];
  for (const u of unitsOf(n)) {
    const by = new Map();
    for (const i of u.cells) {
      const v = board[i];
      if (!v) continue;
      if (!by.has(v)) by.set(v, []);
      by.get(v).push(i);
    }
    for (const [value, cells] of by) if (cells.length > 1) out.push({ rule: u.kind, value, cells });
  }
  return out;
}

/** The pictures that could still go in cell i, given the rest of the board. */
export function candidates(n, board, i) {
  if (board[i]) return [];
  const used = new Set(peers(n)[i].map((j) => board[j]));
  const out = [];
  for (let v = 1; v <= n; v++) if (!used.has(v)) out.push(v);
  return out;
}

export function isSolved(puzzle, board) {
  return format(board) === puzzle.solution;
}

/**
 * Count solutions (stops at `limit`). Bitmask backtracking on the cell with the fewest options.
 * Returns { count, solution } where solution is the first one found, as a string.
 */
export function solve(n, start, limit = 2) {
  const board = typeof start === 'string' ? parse(start) : start.slice();
  const peer = peers(n);
  const full = (1 << (n + 1)) - 2; // bits 1..n
  let count = 0;
  let first = null;
  const optionsOf = (i) => {
    let used = 0;
    for (const j of peer[i]) used |= 1 << board[j];
    return full & ~used;
  };
  // a given that clashes means no solution at all
  for (let i = 0; i < board.length; i++) {
    if (board[i] && peer[i].some((j) => board[j] === board[i])) return { count: 0, solution: null };
  }
  const rec = () => {
    let best = -1;
    let bestMask = 0;
    let bestN = 99;
    for (let i = 0; i < board.length; i++) {
      if (board[i]) continue;
      const m = optionsOf(i);
      let k = 0;
      for (let x = m; x; x &= x - 1) k++;
      if (k === 0) return;
      if (k < bestN) {
        best = i;
        bestMask = m;
        bestN = k;
        if (k === 1) break;
      }
    }
    if (best < 0) {
      count++;
      if (!first) first = format(board);
      return;
    }
    for (let v = 1; v <= n && count < limit; v++) {
      if (!(bestMask & (1 << v))) continue;
      board[best] = v;
      rec();
      board[best] = 0;
    }
  };
  rec();
  return { count, solution: first };
}

/**
 * Solve with what a child can see: a cell with only one possible picture ("naked single"), or a
 * picture that fits in only one cell of a row, column or box ("hidden single"). Returns how far
 * that gets: { solved, steps, hidden } (hidden = how many steps needed a hidden single).
 */
export function solveWithSingles(n, start) {
  const board = typeof start === 'string' ? parse(start) : start.slice();
  let steps = 0;
  let hidden = 0;
  for (;;) {
    let moved = false;
    for (let i = 0; i < board.length; i++) {
      if (board[i]) continue;
      const c = candidates(n, board, i);
      if (c.length === 0) return { solved: false, steps, hidden };
      if (c.length === 1) {
        board[i] = c[0];
        steps++;
        moved = true;
      }
    }
    if (moved) continue;
    for (const u of unitsOf(n)) {
      for (let v = 1; v <= n && !moved; v++) {
        if (u.cells.some((i) => board[i] === v)) continue;
        const spots = u.cells.filter((i) => !board[i] && candidates(n, board, i).includes(v));
        if (spots.length === 1) {
          board[spots[0]] = v;
          steps++;
          hidden++;
          moved = true;
        }
      }
      if (moved) break;
    }
    if (!moved) break;
  }
  return { solved: board.every(Boolean), steps, hidden };
}

/**
 * The next hint for a board in play:
 *   a wrong picture first        -> { cell, to: 0, why: 'wrong' }   (take it out)
 *   else an empty cell where only one picture fits, else the empty cell with the fewest options
 *                                -> { cell, to: picture, why: 'only' | 'fill' }
 * null when the board is full and right.
 */
export function nextHint(puzzle, board) {
  const sol = parse(puzzle.solution);
  const wrong = board.findIndex((v, i) => v && v !== sol[i]);
  if (wrong >= 0) return { cell: wrong, to: 0, why: 'wrong' };
  let best = -1;
  let bestN = 99;
  for (let i = 0; i < board.length; i++) {
    if (board[i]) continue;
    const k = candidates(puzzle.n, board, i).length;
    if (k < bestN) {
      best = i;
      bestN = k;
    }
  }
  if (best < 0) return null;
  return { cell: best, to: sol[best], why: bestN === 1 ? 'only' : 'fill' };
}

/** 3 stars without hints, 2 with one, 1 with more. */
export function starsFor(hintsUsed) {
  return hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1;
}

/** Problems with a puzzle's data (empty when it is fine). Checks shape, givens vs solution, rules. */
export function validate(p) {
  const errs = [];
  const n = p.n;
  if (![4, 6, 9].includes(n)) errs.push(`size ${n}`);
  if (p.tier !== tierOf(n)) errs.push(`tier ${p.tier} for ${n}×${n}`);
  if (typeof p.givens !== 'string' || p.givens.length !== n * n || !new RegExp(`^[.1-${n}]+$`).test(p.givens)) errs.push('givens');
  if (typeof p.solution !== 'string' || p.solution.length !== n * n || !new RegExp(`^[1-${n}]+$`).test(p.solution)) errs.push('solution');
  if (errs.length) return errs;
  for (let i = 0; i < n * n; i++) if (p.givens[i] !== '.' && p.givens[i] !== p.solution[i]) errs.push(`given ${i} differs from the solution`);
  if (conflicts(n, parse(p.solution)).length) errs.push('the solution breaks a rule');
  return errs;
}
