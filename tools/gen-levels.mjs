// Generates web/levels/levels.json deterministically (seeded). Run: node tools/gen-levels.mjs
// Levels get more colours, more rows and denser, less clustered boards as they go up.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rowWidth, makeGrid, findFloating, removeCells, count, colorsPresent, toRows, set, get, neighbors } from '../web/js/grid.js';

const COLS = 8;
const TOTAL = 30;

function mulberry32(seed) {
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

function level(i, attempt) {
  const rnd = mulberry32(1000 + i * 7919 + attempt * 104729);
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
function balance(l) {
  const counts = {};
  for (const ch of l.rows.join('')) if (ch !== '.') counts[ch] = (counts[ch] || 0) + 1;
  const n = Object.values(counts).reduce((a, b) => a + b, 0);
  return Math.max(...Object.values(counts)) / n;
}
function bestLevel(i) {
  let best = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const l = level(i, attempt);
    const n = l.rows.join('').replace(/\./g, '').length;
    if (n < 10) continue;
    if (!best || balance(l) < balance(best)) best = l;
  }
  return best;
}
const levels = Array.from({ length: TOTAL }, (_, k) => bestLevel(k + 1));
for (const l of levels) {
  const n = l.rows.join('').replace(/\./g, '').length;
  if (n < 10) throw new Error(`level ${l.id} too sparse (${n})`);
}
const out = { version: 1, cols: COLS, levels };
const file = fileURLToPath(new URL('../web/levels/levels.json', import.meta.url));
writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${levels.length} levels to ${file}`);
for (const l of levels) console.log(String(l.id).padStart(2), l.shape.padEnd(8), `colours=${l.colors}`, `rows=${l.rows.length}`, `par=${l.par}`);
