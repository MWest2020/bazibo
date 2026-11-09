// Bubbels' board generator, shared by the build tool (tools/gen-levels.mjs, which writes the fixed
// levels.json) and the game itself (random boards in the full version). Seeded, so a seed always
// gives the same board. Levels get more colours, more rows and denser, less clustered boards as
// they go up; a random board borrows the recipe of a level inside its tier.
import { rowWidth, makeGrid, findFloating, removeCells, count, colorsPresent, toRows, set, get, neighbors } from './grid.js';

export const COLS = 8;
export const TOTAL = 30;

// The random-play tiers, each the recipe range of ten fixed levels.
export const RANDOM_TIERS = Object.freeze([
  Object.freeze({ key: 'easy', from: 1, to: 10 }),
  Object.freeze({ key: 'medium', from: 11, to: 20 }),
  Object.freeze({ key: 'hard', from: 21, to: 30 }),
]);

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shape masks: (r, c, w, rows) -> keep this cell?
const MASKS = {
  full: () => true,
  hanging: (r, c, w, rows) => Math.abs(c - (w - 1) / 2) <= (rows - r) * 0.75 + 0.6,
  holes: (r, c) => r < 2 || !((r % 3 === 2) && c % 3 === 1),
  columns: (r, c) => r < 2 || c % 3 !== 2,
  zigzag: (r, c) => r < 2 || (r % 2 === 0 ? c % 4 !== 3 : c % 4 !== 1),
  sides: (r, c, w, rows) => r < 2 || c < 3 || c >= w - 3 || r < rows - 3,
  vee: (r, c, w) => r < 2 || Math.abs(c - (w - 1) / 2) >= r * 0.45 - 0.5,
};
const CYCLE = ['full', 'hanging', 'holes', 'columns', 'zigzag', 'sides', 'vee'];

export function level(i, attempt, seed = 1000 + i * 7919 + attempt * 104729) {
  const rnd = mulberry32(seed);
  const t = (i - 1) / (TOTAL - 1);
  const colors = i <= 3 ? 3 : i <= 8 ? 4 : i <= 16 ? 5 : 6;
  const rows = Math.min(9, 4 + Math.floor((i - 1) / 4));
  const density = 0.62 + 0.38 * t;
  const cluster = 0.5 - 0.22 * t;
  const maskName = i <= 3 ? 'full' : CYCLE[(i - 1) % CYCLE.length];
  const mask = MASKS[maskName];

  const grid = makeGrid([], COLS);
  for (let r = 0; r < rows; r++) {
    const w = rowWidth(r, COLS);
    for (let c = 0; c < w; c++) {
      if (!mask(r, c, w, rows)) continue;
      if (r > 0 && rnd() > density) continue;
      const near = [get(grid, r, c - 1), get(grid, r - 1, c), get(grid, r - 1, r & 1 ? c + 1 : c - 1)].filter((v) => v !== null);
      const colour = near.length && rnd() < cluster ? near[Math.floor(rnd() * near.length)] : Math.floor(rnd() * colors);
      set(grid, r, c, colour);
    }
    // keep every row as long as the others even if it ends up empty
    if (!grid.cells[r]) set(grid, r, 0, null);
  }
  removeCells(grid, findFloating(grid));
  // make sure every colour of the level is really on the board (as a pair, so it can be matched)
  for (let colour = 0; colour < colors; colour++) {
    if (colorsPresent(grid).includes(colour)) continue;
    const cells = [];
    grid.cells.forEach((row, r) => row.forEach((v, c) => v !== null && cells.push([r, c])));
    for (let tries = 0; tries < 50; tries++) {
      const [r, c] = cells[Math.floor(rnd() * cells.length)];
      const others = colorsPresent(grid).filter((x) => x !== get(grid, r, c));
      if (!others.length) break;
      const nb = neighbors(r, c, COLS).find(([nr, nc]) => get(grid, nr, nc) !== null);
      if (!nb) continue;
      set(grid, r, c, colour);
      set(grid, nb[0], nb[1], colour);
      break;
    }
  }
  const n = count(grid);
  const par = Math.max(4, Math.ceil(n / 3.4));
  return {
    id: i,
    colors: colorsPresent(grid).length,
    missesPerDrop: i <= 10 ? 6 : i <= 20 ? 5 : 4,
    par,
    shape: maskName,
    rows: toRows(grid),
  };
}

// Try a few seeds per level and keep the board whose colours are most evenly mixed,
// so no level is one big blob of a single colour.
export function balance(l) {
  const counts = {};
  for (const ch of l.rows.join('')) if (ch !== '.') counts[ch] = (counts[ch] || 0) + 1;
  const n = Object.values(counts).reduce((a, b) => a + b, 0);
  return Math.max(...Object.values(counts)) / n;
}
export function bestLevel(i) {
  let best = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const l = level(i, attempt);
    const n = l.rows.join('').replace(/\./g, '').length;
    if (n < 10) continue;
    if (!best || balance(l) < balance(best)) best = l;
  }
  return best;
}
/** A board is playable when it has at least 10 bubbles, nothing hangs loose, and every colour on it occurs at least twice. */
export function validBoard(l) {
  const grid = makeGrid(l.rows, COLS);
  if (count(grid) < 10) return false;
  if (findFloating(grid).length) return false;
  const counts = {};
  for (const ch of l.rows.join('')) if (ch !== '.') counts[ch] = (counts[ch] || 0) + 1;
  return Object.values(counts).every((n) => n >= 2) && Object.keys(counts).length === l.colors;
}

/** One random board for a tier key ('easy', 'medium', 'hard'), from a 32-bit seed. */
export function randomLevel(key, seed) {
  const spec = RANDOM_TIERS.find((t) => t.key === key);
  if (!spec) throw new Error(`unknown tier ${key}`);
  const rand = mulberry32(seed);
  const i = spec.from + Math.floor(rand() * (spec.to - spec.from + 1));
  let best = null;
  // keep the most mixed of 8 playable boards; draw up to 64 before giving up
  for (let attempt = 0, good = 0; attempt < 64 && good < 8; attempt++) {
    const l = level(i, attempt, (Math.floor(rand() * 4294967296) ^ (seed >>> 0)) >>> 0);
    if (!validBoard(l)) continue;
    good++;
    if (!best || balance(l) < balance(best)) best = l;
  }
  if (!best) throw new Error(`no playable ${key} board for seed ${seed}`);
  return { ...best, id: `r-${key}-${seed >>> 0}`, recipe: i, seed: seed >>> 0 };
}
