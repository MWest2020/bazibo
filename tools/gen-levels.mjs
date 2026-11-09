// Generates web/games/bubbels/levels.json deterministically (seeded). Run: node tools/gen-levels.mjs
// Levels get more colours, more rows and denser, less clustered boards as they go up.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COLS, TOTAL, bestLevel } from '../web/games/bubbels/generate.js';

const levels = Array.from({ length: TOTAL }, (_, k) => bestLevel(k + 1));
for (const l of levels) {
  const n = l.rows.join('').replace(/\./g, '').length;
  if (n < 10) throw new Error(`level ${l.id} too sparse (${n})`);
}
const out = { version: 1, cols: COLS, levels };
const file = fileURLToPath(new URL('../web/games/bubbels/levels.json', import.meta.url));
writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${levels.length} levels to ${file}`);
for (const l of levels) console.log(String(l.id).padStart(2), l.shape.padEnd(8), `colours=${l.colors}`, `rows=${l.rows.length}`, `par=${l.par}`);
