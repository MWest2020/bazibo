// Random play (full version): every generator, 200 seeds per tier, must give a valid board or
// puzzle. Timing per tier is printed so a slow generator shows up (target on a slow phone: a few
// hundred ms; phones are roughly 10x slower than this machine, and the game runs them in a worker).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bubbels from '../web/games/bubbels/generate.js';
import * as dogu from '../web/games/dogudoku/generate.js';
import * as pdoku from '../web/games/picturedoku/generate.js';
import * as slang from '../web/games/slang/generate.js';
import { solve as doguSolve, validate as doguValidate } from '../web/games/dogudoku/rules.js';
import { solve as pdokuSolve, solveWithSingles, parse, validate as pdokuValidate } from '../web/games/picturedoku/rules.js';
import { makeGrid, findFloating, count } from '../web/games/bubbels/grid.js';
import {
  MODES,
  WORDS,
  START_LENGTH,
  createRound,
  gridSize,
  wallCells,
  startSnake,
  canCompact,
  countSequence,
  letterSequence,
  turn,
  step,
  total,
  pathDirection,
} from '../web/games/slang/rules.js';

const SEEDS = 200;
const seedOf = (i) => (Math.imul(i + 1, 2654435761) >>> 0) || 1;

function timed(label, fn) {
  const times = [];
  for (let i = 0; i < SEEDS; i++) {
    const a = performance.now();
    fn(seedOf(i), i);
    times.push(performance.now() - a);
  }
  times.sort((a, b) => a - b);
  const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))].toFixed(1);
  console.log(`# timing ${label}: median ${q(0.5)} ms, p90 ${q(0.9)} ms, max ${q(1)} ms`);
}

test('the same seed gives the same board or puzzle', () => {
  assert.deepEqual(bubbels.randomLevel('medium', 42), bubbels.randomLevel('medium', 42));
  assert.deepEqual(dogu.randomPuzzle('s6', 42), dogu.randomPuzzle('s6', 42));
  assert.deepEqual(pdoku.randomPuzzle('s9', 42), pdoku.randomPuzzle('s9', 42));
  assert.deepEqual(slang.randomLevel('letters', 'big', 42), slang.randomLevel('letters', 'big', 42));
  assert.notDeepEqual(dogu.randomPuzzle('s6', 42).regions, dogu.randomPuzzle('s6', 43).regions);
});

test('Bubbels: every random board has at least 10 bubbles, nothing loose, and every colour twice or more', () => {
  for (const tier of bubbels.RANDOM_TIERS) {
    timed(`bubbels ${tier.key}`, (seed) => {
      const l = bubbels.randomLevel(tier.key, seed);
      const where = `${tier.key} seed ${seed}`;
      assert.ok(bubbels.validBoard(l), `${where}: not playable`);
      const grid = makeGrid(l.rows, bubbels.COLS);
      assert.ok(count(grid) >= 10, `${where}: too few bubbles`);
      assert.equal(findFloating(grid).length, 0, `${where}: loose bubbles`);
      assert.ok(l.recipe >= tier.from && l.recipe <= tier.to, `${where}: recipe ${l.recipe} outside the tier`);
      assert.ok(l.colors >= 3 && l.colors <= 6, `${where}: ${l.colors} colours`);
      assert.ok(l.missesPerDrop >= 4 && l.par >= 4, `${where}: settings`);
    });
  }
});

test('Dogudoku: every random puzzle passes the checks and has exactly one solution (independent solve)', () => {
  for (const tier of dogu.RANDOM_TIERS) {
    timed(`dogudoku ${tier.key}`, (seed) => {
      const p = dogu.randomPuzzle(tier.key, seed);
      const where = `${tier.key} seed ${seed}`;
      assert.equal(p.n, tier.n, where);
      assert.equal(p.tier, tier.tier, where);
      assert.deepEqual(doguValidate(p), [], where);
      const { count: solutions } = doguSolve(p, 3);
      assert.equal(solutions, 1, `${where}: ${solutions} solutions`);
      assert.equal(p.free, false, where);
    });
  }
});

test('Picturedoku: every random puzzle is unique, solvable with singles, and inside its tier', () => {
  for (const tier of pdoku.RANDOM_TIERS) {
    const [easy, hard] = tier.givens;
    timed(`picturedoku ${tier.key}`, (seed) => {
      const p = pdoku.randomPuzzle(tier.key, seed);
      const where = `${tier.key} seed ${seed}`;
      assert.equal(p.n, tier.n, where);
      assert.deepEqual(pdokuValidate(p), [], where);
      const board = parse(p.givens);
      assert.equal(pdokuSolve(p.n, board, 3).count, 1, `${where}: not unique`);
      assert.ok(solveWithSingles(p.n, board).solved, `${where}: needs guessing`);
      const givens = board.filter(Boolean).length;
      // the digging stops at the target, or earlier when no more pictures can go
      assert.ok(givens <= easy + 2, `${where}: ${givens} givens, easier than the tier`);
      assert.ok(givens >= hard - 2 || tier.n === 4, `${where}: ${givens} givens, harder than the tier`);
    });
  }
});

// ---------- Slangetje ----------

const key = (r, c) => `${r},${c}`;

function connected(cols, rows, walls, wrap) {
  const free = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!walls.has(key(r, c))) free.push([r, c]);
  const seen = new Set([key(...free[0])]);
  const queue = [free[0]];
  while (queue.length) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nr = r + dr;
      let nc = c + dc;
      if (wrap) {
        nr = (nr + rows) % rows;
        nc = (nc + cols) % cols;
      } else if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const k = key(nr, nc);
      if (walls.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push([nr, nc]);
    }
  }
  return seen.size === free.length;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('Slangetje: every random round has a safe start, no walled-off pockets, room to move, and a correct sequence', () => {
  for (const mode of MODES) {
    for (const tier of slang.RANDOM_TIERS) {
      timed(`slang ${mode} ${tier}`, (seed) => {
        const l = slang.randomLevel(mode, tier, seed);
        const where = `${mode} ${tier} seed ${seed}`;
        assert.equal(l.mode, mode, where);
        assert.equal(l.tier, tier, where);
        if (tier !== 'big') assert.ok(!l.walls, `${where}: walls below the oldest tier`);
        if (mode === 'count') assert.ok(countSequence(l).length >= 3, `${where}: sequence ${countSequence(l)}`);
        if (mode === 'letters') {
          for (const lang of ['nl', 'en']) {
            const letters = letterSequence(l, lang);
            assert.ok(letters.length >= 2, `${where}: no letters in ${lang}`);
            assert.ok(letters.every((ch) => /^[A-Z]$/.test(ch)), `${where}: odd letter in ${lang}`);
          }
          for (const w of l.words) assert.ok(WORDS[w], `${where}: unknown word ${w}`);
        }
        if (mode === 'colors') assert.ok(l.palette >= 3 && l.palette <= 6 && l.eat >= 4, `${where}: colours`);
        for (const [landscape, compact] of [[false, false], [true, false], [false, true], [true, true]]) {
          if (compact && !canCompact(l)) continue;
          const { cols, rows } = gridSize(l, landscape, compact);
          const walls = new Set(wallCells(l, landscape, compact).map(([r, c]) => key(r, c)));
          for (const k of walls) {
            const [r, c] = k.split(',').map(Number);
            assert.ok(r >= 0 && c >= 0 && r < rows && c < cols, `${where}: wall ${k} off the board`);
          }
          const { dir, snake } = startSnake(cols, rows, landscape);
          const [dr, dc] = { up: [-1, 0], right: [0, 1] }[dir];
          const head = snake[0];
          for (const [r, c] of [...snake, ...[1, 2, 3, 4].map((k) => [head[0] + dr * k, head[1] + dc * k])]) {
            assert.ok(!walls.has(key(r, c)), `${where}: a wall on the start`);
          }
          const round = createRound(l, { landscape, compact, rng: mulberry32(seed) });
          assert.ok(connected(cols, rows, walls, round.wrap), `${where}: walls close off part of the board`);
          for (const it of round.items) {
            assert.ok(!walls.has(key(it.r, it.c)), `${where}: an item in a wall`);
            assert.ok(!round.snake.some(([r, c]) => r === it.r && c === it.c), `${where}: an item on the snake`);
          }
          const longest = START_LENGTH + (mode === 'colors' ? l.eat : Math.max(...['nl', 'en'].map((lang) => createRound(l, { lang }).seq.length)));
          assert.ok(cols * rows - walls.size - longest - 8 > 20, `${where}: too crowded`);
        }
      });
    }
  }
});

test('Slangetje: random rounds can be played to the end (autopilot; young tiers always, the oldest nearly always)', () => {
  // The autopilot is a test tool, not part of the game: on the oldest tier (walls, bumping into
  // yourself) it can box itself in on a few seeds, as it does on the fixed levels. So the young
  // tiers must always finish and the oldest must finish on at least 90% of the seeds.
  for (const mode of MODES) {
    for (const tier of slang.RANDOM_TIERS) {
      let done = 0;
      const runs = 40;
      for (let i = 0; i < runs; i++) {
        const seed = seedOf(i);
        const l = slang.randomLevel(mode, tier, seed);
        const lang = i % 2 ? 'en' : 'nl';
        const rng = mulberry32(seed ^ 0x5bd1e995);
        const s = createRound(l, { lang, rng, landscape: i % 3 === 0 });
        let steps = 0;
        while (!s.over && steps < 4000) {
          const d = pathDirection(s);
          if (!d) break;
          turn(s, d) || (s.started = true);
          step(s, rng);
          steps++;
        }
        if (s.over === 'done' && s.mistakes === 0 && s.idx === total(s)) done++;
      }
      const need = tier === 'big' ? Math.ceil(runs * 0.9) : runs;
      assert.ok(done >= need, `${mode} ${tier}: ${done}/${runs} finished`);
    }
  }
});
