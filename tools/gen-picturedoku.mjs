// Generate Picturedoku's puzzles into web/games/picturedoku/puzzles.json. Deterministic (seeded),
// so running it again gives the same file. Every puzzle has exactly one solution and can be solved
// with singles only: a cell where just one picture fits, or a picture that fits in just one cell of
// a row, column or box. No guessing, no advanced tricks.
// Difficulty: each puzzle gets a target number of starting pictures, falling evenly from the size's
// easiest to its hardest value (PLAN.givens); pictures are taken away while the puzzle stays unique
// and singles-solvable. Within a size the puzzles are then sorted by starting pictures (most first),
// ties broken by fewer "only one place for this picture" steps.
//   npm run puzzles
import { writeFileSync } from 'node:fs';
import { validate } from '../web/games/picturedoku/rules.js';
import { mulberry32, makePuzzle } from '../web/games/picturedoku/generate.js';

const OUT = new URL('../web/games/picturedoku/puzzles.json', import.meta.url).pathname;

// size, how many, how many free (10 free in total, a taste of every size), givens from easy to hard
export const PLAN = [
  { n: 4, count: 20, free: 4, givens: [11, 6] },
  { n: 6, count: 22, free: 4, givens: [24, 13] },
  { n: 9, count: 18, free: 2, givens: [44, 28] },
];

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
