import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIERS,
  WORDS,
  MODES,
  START_LENGTH,
  createRound,
  turn,
  step,
  expected,
  total,
  countSequence,
  letterSequence,
  colorTargets,
  gridSize,
  wallCells,
  startSnake,
  spawnCell,
  refill,
  wanted,
  currentWord,
  starsFor,
  parSeconds,
  pathDirection,
} from '../web/games/slang/rules.js';
import { meta } from '../web/games/slang/meta.js';

const LEVELS = JSON.parse(readFileSync(new URL('../web/games/slang/levels.json', import.meta.url), 'utf8'));
const LANGS = ['nl', 'en'];
const key = (r, c) => `${r},${c}`;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A level to test the rules with: a 7×9 board, wrap and self-hit as asked, nothing on it yet. */
function bare({ wrap = true, tier = 'tiny', mode = 'count', ...rest } = {}) {
  const level = { id: 99, mode, tier, size: [7, 9], speed: 3, wrap, from: 1, to: 3, ...rest };
  const s = createRound(level, { rng: mulberry32(1) });
  s.items = [];
  return s;
}

// ---------- the level data ----------

test('levels: 30 in total, 12 counting, 10 letters, 8 colours, ids 1-30 in order', () => {
  assert.equal(LEVELS.length, 30);
  assert.deepEqual(
    LEVELS.map((l) => l.id),
    Array.from({ length: 30 }, (_, i) => i + 1),
  );
  const per = Object.fromEntries(MODES.map((m) => [m, LEVELS.filter((l) => l.mode === m).length]));
  assert.deepEqual(per, { count: 12, letters: 10, colors: 8 });
  for (const l of LEVELS) {
    assert.ok(TIERS[l.tier], `level ${l.id}: unknown tier ${l.tier}`);
    assert.ok(Array.isArray(l.size) && l.size.length === 2 && l.size[0] <= l.size[1], `level ${l.id}: size`);
    assert.ok(l.speed > 0 && l.speed < 8, `level ${l.id}: speed`);
  }
});

test('levels: easy to hard within every kind (age tier and speed never go down)', () => {
  const order = Object.keys(TIERS);
  for (const m of MODES) {
    const ls = LEVELS.filter((l) => l.mode === m);
    for (let i = 1; i < ls.length; i++) {
      const [a, b] = [ls[i - 1], ls[i]];
      assert.ok(order.indexOf(b.tier) >= order.indexOf(a.tier), `${m}: level ${b.id} is a younger tier than ${a.id}`);
      if (a.tier === b.tier) assert.ok(b.speed >= a.speed, `${m}: level ${b.id} is slower than ${a.id}`);
    }
  }
});

test('levels: 10 free, a few of every kind, the first ones of each kind', () => {
  const free = LEVELS.filter((l) => l.free);
  assert.equal(free.length, 10);
  assert.equal(meta.free, 10);
  for (const m of MODES) {
    const ls = LEVELS.filter((l) => l.mode === m);
    const n = ls.filter((l) => l.free).length;
    assert.ok(n >= 3, `${m}: only ${n} free`);
    assert.ok(ls.slice(0, n).every((l) => l.free), `${m}: the free levels are not the first ones`);
  }
});

test('levels: the youngest tier wraps around and never ends in a bump', () => {
  for (const l of LEVELS.filter((x) => x.tier !== 'big')) {
    const s = createRound(l, { rng: mulberry32(l.id) });
    assert.equal(s.wrap, true, `level ${l.id} has edges`);
    assert.equal(s.selfHit, false, `level ${l.id} bumps into itself`);
    assert.equal(s.walls.size, 0, `level ${l.id} has walls`);
  }
});

test('levels: every word exists in both languages and only uses the letters A-Z', () => {
  for (const [id, w] of Object.entries(WORDS)) for (const lang of LANGS) assert.match(w[lang], /^[A-Z]{2,7}$/, `${id} in ${lang}`);
  for (const l of LEVELS.filter((x) => x.mode === 'letters')) {
    assert.ok(l.words.length >= 1);
    for (const w of l.words) assert.ok(WORDS[w], `level ${l.id}: no word "${w}"`);
    for (const lang of LANGS) assert.equal(letterSequence(l, lang).length, l.words.reduce((n, w) => n + WORDS[w][lang].length, 0));
  }
});

test('levels: counting and colours rounds are well formed', () => {
  for (const l of LEVELS.filter((x) => x.mode === 'count')) {
    const seq = countSequence(l);
    assert.ok(seq.length >= 3 && seq.length <= 20, `level ${l.id}: ${seq.length} numbers`);
    assert.ok(Math.max(...seq) <= 20 && Math.min(...seq) >= 1, `level ${l.id}: numbers 1-20`);
  }
  for (const l of LEVELS.filter((x) => x.mode === 'colors')) {
    assert.ok(l.palette >= 3 && l.palette <= 6, `level ${l.id}: palette ${l.palette}`);
    assert.ok(l.eat >= 4, `level ${l.id}: eat ${l.eat}`);
  }
});

/** Every free cell can reach every other one (no walled-off pockets). */
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

test('levels: walls stay on the board, off the start and its first moves, and never wall off a pocket (both orientations)', () => {
  for (const l of LEVELS) {
    for (const landscape of [false, true]) {
      const { cols, rows } = gridSize(l, landscape);
      const walls = new Set(wallCells(l, landscape).map(([r, c]) => key(r, c)));
      for (const k of walls) {
        const [r, c] = k.split(',').map(Number);
        assert.ok(r >= 0 && c >= 0 && r < rows && c < cols, `level ${l.id}: wall ${k} is off the board`);
      }
      const { dir, snake } = startSnake(cols, rows, landscape);
      const [dr, dc] = { up: [-1, 0], right: [0, 1] }[dir];
      const head = snake[0];
      const cells = [...snake, ...[1, 2, 3, 4].map((k) => [head[0] + dr * k, head[1] + dc * k])];
      for (const [r, c] of cells) assert.ok(!walls.has(key(r, c)), `level ${l.id}: a wall on the start (${r},${c}), ${landscape ? 'sideways' : 'upright'}`);
      assert.ok(connected(cols, rows, walls, createRound(l).wrap), `level ${l.id}: walls close off part of the board`);
      // room for the longest snake, all the things on the board and some space to move
      const longest = START_LENGTH + (l.mode === 'colors' ? l.eat : Math.max(...LANGS.map((lang) => createRound(l, { lang }).seq.length)));
      assert.ok(cols * rows - walls.size - longest - 8 > 20, `level ${l.id}: too crowded`);
    }
  }
});

// ---------- sequences ----------

test('sequences: counting up, in steps of two, and counting down', () => {
  assert.deepEqual(countSequence({ from: 1, to: 5 }), [1, 2, 3, 4, 5]);
  assert.deepEqual(countSequence({ from: 2, to: 10, step: 2 }), [2, 4, 6, 8, 10]);
  assert.deepEqual(countSequence({ from: 5, to: 1, step: -1 }), [5, 4, 3, 2, 1]);
});

test('sequences: the letters differ per language, word after word', () => {
  const l = { mode: 'letters', words: ['fish', 'sun'] };
  assert.deepEqual(letterSequence(l, 'nl'), [...'VISZON']);
  assert.deepEqual(letterSequence(l, 'en'), [...'FISHSUN']);
});

test('sequences: colours switch every few fruits, always to a different colour', () => {
  const rng = mulberry32(7);
  for (let k = 0; k < 50; k++) {
    const seq = colorTargets({ palette: 5, eat: 12, switchEvery: 3 }, rng);
    assert.equal(seq.length, 12);
    for (let i = 1; i < seq.length; i++) {
      if (i % 3 === 0) assert.notEqual(seq[i], seq[i - 1]);
      else assert.equal(seq[i], seq[i - 1]);
    }
    assert.ok(seq.every((v) => v >= 0 && v < 5));
  }
  assert.equal(new Set(colorTargets({ palette: 3, eat: 6, switchEvery: 0 }, rng)).size, 1);
});

// ---------- moving ----------

test('moving: nothing happens before the first swipe; the first swipe starts the snake', () => {
  const s = bare();
  const head = s.snake[0].slice();
  assert.deepEqual(step(s), []);
  assert.deepEqual(s.snake[0], head);
  assert.equal(turn(s, 'down'), false, 'straight back into the body is not a start');
  assert.equal(s.started, false);
  assert.equal(turn(s, 'up'), true);
  step(s);
  assert.deepEqual(s.snake[0], [head[0] - 1, head[1]]);
  assert.equal(s.snake.length, START_LENGTH);
});

test('moving: never straight back, at most two turns typed ahead', () => {
  const s = bare();
  turn(s, 'up');
  assert.equal(turn(s, 'down'), false);
  assert.equal(turn(s, 'left'), true);
  assert.equal(turn(s, 'right'), false, 'back from the queued left');
  assert.equal(turn(s, 'down'), true);
  assert.equal(turn(s, 'right'), false, 'the queue is full');
  step(s);
  assert.equal(s.dir, 'left');
  step(s);
  assert.equal(s.dir, 'down');
});

test('moving: with wrap-around the snake comes back on the other side', () => {
  const s = bare({ wrap: true });
  s.snake = [[0, 3], [1, 3], [2, 3]];
  turn(s, 'up');
  step(s);
  assert.deepEqual(s.snake[0], [s.rows - 1, 3]);
  assert.equal(s.over, null);
  s.snake = [[4, s.cols - 1], [4, s.cols - 2], [4, s.cols - 3]];
  s.dir = 'right';
  step(s);
  assert.deepEqual(s.snake[0], [4, 0]);
});

test('moving: without wrap-around the edge is a bump', () => {
  const s = bare({ tier: 'big', wrap: false });
  s.snake = [[0, 3], [1, 3], [2, 3]];
  turn(s, 'up');
  const ev = step(s);
  assert.deepEqual(ev.map((e) => e.type), ['crash']);
  assert.equal(s.over, 'crash');
  assert.deepEqual(step(s), [], 'nothing moves after the end');
});

test('moving: a wall is a bump', () => {
  const s = bare({ tier: 'big', wrap: true });
  s.walls.add(key(3, 3));
  s.snake = [[4, 3], [5, 3], [6, 3]];
  turn(s, 'up');
  assert.equal(step(s)[0].type, 'crash');
});

/** A snake curled so that going left bites its own body. */
function curled(tier) {
  const s = bare({ tier, wrap: true });
  s.snake = [[4, 4], [4, 5], [5, 5], [5, 4], [5, 3], [4, 3], [3, 3]];
  s.dir = 'up';
  s.started = true;
  return s;
}

test('moving: bumping into yourself ends the round in the oldest tier', () => {
  const s = curled('big');
  turn(s, 'left');
  assert.equal(step(s)[0].type, 'crash');
});

test('moving: the youngest tier passes through itself', () => {
  const s = curled('tiny');
  turn(s, 'left');
  assert.deepEqual(step(s), []);
  assert.deepEqual(s.snake[0], [4, 3]);
  assert.equal(s.over, null);
});

test('moving: the tail moving away is not a bump', () => {
  const s = bare({ tier: 'big', wrap: true });
  s.snake = [[4, 4], [4, 5], [5, 5], [5, 4]]; // the head goes down onto the tail, which leaves
  s.dir = 'left';
  s.started = true;
  turn(s, 'down');
  assert.deepEqual(step(s), []);
  assert.equal(s.over, null);
});

// ---------- eating ----------

test('eating: the right one grows the snake and moves on to the next', () => {
  const s = bare({ from: 1, to: 3 });
  s.snake = [[4, 3], [5, 3], [6, 3]];
  s.items = [{ id: 1, r: 3, c: 3, value: 1 }];
  turn(s, 'up');
  const ev = step(s, mulberry32(2));
  assert.deepEqual(ev, [{ type: 'eat', value: 1 }]);
  assert.equal(s.idx, 1);
  assert.equal(expected(s), 2);
  assert.equal(s.snake.length, START_LENGTH + 1);
  assert.ok(s.items.some((it) => it.value === 2) && s.items.some((it) => it.value === 3), 'the next ones are on the board');
});

test('eating: the wrong one is an oops: one shorter, the fruit hops elsewhere, no game over', () => {
  const s = bare({ from: 1, to: 3 });
  s.snake = [[4, 3], [5, 3], [6, 3], [6, 4]];
  s.items = [{ id: 1, r: 3, c: 3, value: 2 }, { id: 2, r: 0, c: 0, value: 1 }];
  turn(s, 'up');
  const ev = step(s, mulberry32(3));
  assert.deepEqual(ev, [{ type: 'oops', value: 2 }]);
  assert.equal(s.mistakes, 1);
  assert.equal(s.idx, 0);
  assert.equal(s.snake.length, 3);
  const two = s.items.find((it) => it.value === 2);
  assert.ok(two && !(two.r === 3 && two.c === 3), 'the 2 moved to another spot');
  assert.equal(s.over, null);
  // the snake never gets shorter than two
  s.snake = [[4, 3], [5, 3]];
  s.items = [{ id: 9, r: 3, c: 3, value: 3 }];
  step(s, mulberry32(4));
  assert.equal(s.snake.length, 2);
});

test('eating: a letters round goes word by word; the next word appears when the first is done', () => {
  const level = { id: 98, mode: 'letters', tier: 'tiny', size: [7, 9], speed: 3, words: ['egg', 'sun'] };
  for (const lang of LANGS) {
    const s = createRound(level, { lang, rng: mulberry32(5) });
    const first = WORDS.egg[lang];
    assert.equal(currentWord(s).id, 'egg');
    assert.deepEqual(s.items.map((it) => it.value).sort(), [...first].sort());
    s.idx = first.length; // the first word spelled
    s.items = [];
    refill(s, mulberry32(6));
    assert.equal(currentWord(s).id, 'sun');
    assert.deepEqual(s.items.map((it) => it.value).sort(), [...WORDS.sun[lang]].sort());
  }
});

test('eating: in a colours round at least two fruits of the right colour are always on the board', () => {
  const level = { id: 97, mode: 'colors', tier: 'small', size: [9, 11], speed: 3, palette: 4, eat: 30, switchEvery: 3 };
  const rng = mulberry32(8);
  const s = createRound(level, { rng });
  turn(s, 'up');
  for (let k = 0; k < 400 && !s.over; k++) {
    assert.ok(s.items.filter((it) => it.value === expected(s)).length >= 2, `step ${k}: too few of colour ${expected(s)}`);
    assert.ok(s.items.length >= 5);
    const d = pathDirection(s);
    if (d) turn(s, d);
    step(s, rng);
  }
  assert.equal(s.over, 'done');
});

test('eating: counting shows only the next few numbers on the bigger boards, all of them for the youngest', () => {
  const big = createRound({ id: 96, mode: 'count', tier: 'small', size: [11, 13], speed: 3, from: 1, to: 10 }, { rng: mulberry32(9) });
  assert.deepEqual(big.items.map((it) => it.value).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  assert.deepEqual(wanted(big), [1, 2, 3, 4, 5]);
  const tiny = createRound({ id: 95, mode: 'count', tier: 'tiny', size: [9, 11], speed: 2, from: 1, to: 5 }, { rng: mulberry32(9) });
  assert.equal(tiny.items.length, 5);
});

test('spawning: never on a wall, the snake or another thing, and not right in front of the head', () => {
  const level = { id: 94, mode: 'count', tier: 'big', size: [7, 9], speed: 3, wrap: false, from: 1, to: 3, walls: [[1, 1], [1, 2], [7, 5]] };
  const rng = mulberry32(10);
  for (let k = 0; k < 300; k++) {
    const s = createRound(level, { rng });
    const [r, c] = spawnCell(s, rng);
    assert.ok(!s.walls.has(key(r, c)));
    assert.ok(!s.snake.some(([a, b]) => a === r && b === c));
    assert.ok(!s.items.some((it) => it.r === r && it.c === c));
    const [hr, hc] = s.snake[0];
    assert.ok(!(c === hc && (r === hr - 1 || r === hr - 2)), 'right in front of the head');
  }
});

// ---------- stars ----------

test('stars: the youngest only count mistakes; older children also want it inside the time', () => {
  assert.equal(starsFor({ tier: 'tiny', mistakes: 0, seconds: 999, par: 10 }), 3);
  assert.equal(starsFor({ tier: 'tiny', mistakes: 2, seconds: 1 }), 2);
  assert.equal(starsFor({ tier: 'tiny', mistakes: 5 }), 1);
  assert.equal(starsFor({ tier: 'small', mistakes: 0, seconds: 10, par: 20 }), 3);
  assert.equal(starsFor({ tier: 'small', mistakes: 0, seconds: 25, par: 20 }), 2);
  assert.equal(starsFor({ tier: 'big', mistakes: 1, seconds: 31, par: 20 }), 2);
  assert.equal(starsFor({ tier: 'big', mistakes: 1, seconds: 40, par: 20 }), 1);
  assert.equal(starsFor({ tier: 'big', mistakes: 3, seconds: 1, par: 20 }), 1);
  for (const l of LEVELS) {
    const { cols, rows } = gridSize(l);
    assert.ok(parSeconds(l, cols, rows) > 5, `level ${l.id}: par`);
  }
});

// ---------- every level can be played to the end ----------

test('every level, in both languages and both orientations, can be eaten up without a single mistake or bump', () => {
  for (const l of LEVELS) {
    for (const lang of LANGS) {
      for (const landscape of [false, true]) {
        for (const seed of [1, 2, 3]) {
          const rng = mulberry32(l.id * 100 + seed);
          const s = createRound(l, { lang, rng, landscape });
          const where = `level ${l.id} ${lang} ${landscape ? 'sideways' : 'upright'} seed ${seed}`;
          assert.equal(s.items.length > 0, true, `${where}: nothing on the board`);
          let steps = 0;
          while (!s.over && steps < 3000) {
            const d = pathDirection(s);
            assert.ok(d, `${where}: no safe move at step ${steps}`);
            turn(s, d) || (s.started = true);
            step(s, rng);
            steps++;
          }
          assert.equal(s.over, 'done', `${where}: ended ${s.over} after ${steps} steps (${s.idx}/${total(s)})`);
          assert.equal(s.mistakes, 0, `${where}: mistakes`);
          assert.equal(s.snake.length, START_LENGTH + total(s), `${where}: the snake grew by one per bite`);
        }
      }
    }
  }
});
