// Generate Dogudoku's puzzles into web/games/dogudoku/puzzles.json. Deterministic (seeded), so
// running it again gives the same file. Every puzzle is checked to have exactly one solution;
// within a size the puzzles are sorted from easy to hard (by the solver's search effort).
//   npm run puzzles
import { writeFileSync } from 'node:fs';
import { validate } from '../web/games/dogudoku/rules.js';
import { mulberry32, makePuzzle } from '../web/games/dogudoku/generate.js';

const OUT = new URL('../web/games/dogudoku/puzzles.json', import.meta.url).pathname;

// size, tier, how many, how many of them are free (10 free in total, a taste of every size)
export const PLAN = [
  { n: 4, tier: 'tiny', count: 12, free: 4 },
  { n: 5, tier: 'small', count: 14, free: 3 },
  { n: 6, tier: 'full', count: 12, free: 1 },
  { n: 7, tier: 'full', count: 12, free: 1 },
  { n: 8, tier: 'full', count: 10, free: 1 },
];

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
