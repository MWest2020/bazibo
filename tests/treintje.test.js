// Treintje (Train Tracks): the rules, what a finger means, the track's shape, and the generator
// (200 seeds per age: solvable, exactly one way through, the sizes per age, within the budget).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  linked,
  hasWall,
  neighbours,
  startPath,
  passed,
  nextStation,
  whyNot,
  step,
  cutTo,
  isSolved,
  isValidPath,
  dragOnto,
  dragAlong,
  cellsOnMove,
  cellAt,
  pressAt,
  trackPieces,
  route,
  routeLength,
  pointAt,
} from '../web/games/treintje/rules.js';
import { AGES, AGE_IDS, NODE_BUDGET, PUZZLE_BUDGET, makePuzzle, randomPath, countSolutions, checkPuzzle, rng } from '../web/games/treintje/generate.js';
import { meta } from '../web/games/treintje/meta.js';
import { sanitizePayload } from '../web/js/transfer.js';

// a 3x3 puzzle with one way through: 0 1 2 / 5 4 3 / 6 7 8 (a snake), stations 1 on 0, 2 on 4, 3 on 8
//   1 . .
//   . 2 .
//   . . 3
const SNAKE = [0, 1, 2, 5, 4, 3, 6, 7, 8];
function snake(walls = []) {
  const nums = new Array(9).fill(0);
  nums[0] = 1;
  nums[4] = 2;
  nums[8] = 3;
  return { w: 3, h: 3, nums, walls, solution: SNAKE };
}

test('neighbours, fences and linked squares', () => {
  const p = snake([[1, 4]]);
  assert.ok(linked(p, 0, 1));
  assert.ok(!linked(p, 2, 3), 'the end of a row is not next to the start of the next');
  assert.ok(!linked(p, 0, 4), 'diagonal');
  assert.ok(hasWall(p, 4, 1) && !linked(p, 1, 4), 'a fence blocks both ways');
  assert.deepEqual(neighbours(p, 4).sort(), [3, 5, 7]);
  assert.deepEqual(neighbours(p, 0).sort(), [1, 3]);
});

test('a step only to a neighbour, never through a fence, never onto track, stations in order', () => {
  const p = snake([[3, 6]]);
  let path = startPath(p);
  assert.deepEqual(path, [0]);
  assert.equal(nextStation(p, path), 2);
  assert.equal(whyNot(p, path, 2), 'far');
  assert.equal(whyNot(p, path, 4), 'far', 'diagonal');
  assert.equal(whyNot(p, path, 0), 'far', 'the end itself');
  assert.equal(whyNot(p, path, 99), 'far');
  path = step(p, path, 1);
  assert.deepEqual(path, [0, 1]);
  assert.equal(whyNot(p, path, 4), null, 'station 2 is next');
  path = step(p, [0, 3], 4);
  assert.deepEqual(path, [0, 3, 4]);
  assert.equal(whyNot(p, [0, 3], 6), 'wall');
  assert.equal(whyNot(p, [0, 1, 2, 5, 4, 3], 4), 'used');
  assert.equal(whyNot(p, [0, 1, 2, 5, 4], 1), 'used');
  // station 3 before station 2: not allowed
  const q = snake();
  q.nums[2] = 2;
  q.nums[4] = 3;
  q.nums[8] = 4;
  assert.equal(whyNot(q, [0, 1], 4), 'order');
  assert.equal(whyNot(q, [0, 1], 2), null);
  assert.equal(whyNot(q, [0, 1, 2, 5], 4), null);
});

test('the last station only as the last square; solved means every square in order', () => {
  const p = snake();
  assert.equal(whyNot(p, [0, 1, 2, 5, 4, 3, 6, 7], 8), null);
  assert.equal(whyNot(p, [0, 1, 4, 5], 8), 'early');
  assert.ok(isSolved(p, SNAKE));
  assert.ok(!isSolved(p, SNAKE.slice(0, 8)));
  assert.ok(isValidPath(p, SNAKE));
  assert.ok(!isValidPath(p, [0, 1, 2, 3]), 'not neighbours');
  assert.ok(!isValidPath(p, [1, 0]), 'must start on station 1');
  assert.equal(passed(p, [0, 1, 4]), 2);
  assert.equal(nextStation(p, SNAKE), 0);
  assert.equal(whyNot(p, SNAKE, 7), 'done');
});

test('dragging: on to a neighbour, back over the track takes it back, anything else does nothing', () => {
  const p = snake();
  let r = dragOnto(p, [0, 1, 2], 5);
  assert.deepEqual(r, { path: [0, 1, 2, 5], why: null });
  r = dragOnto(p, [0, 1, 2, 5], 2);
  assert.deepEqual(r.path, [0, 1, 2], 'back one square');
  r = dragOnto(p, [0, 1, 2, 5], 5);
  assert.deepEqual(r.path, [0, 1, 2, 5], 'the end itself: nothing');
  r = dragOnto(p, [0, 1, 4, 3], 0);
  assert.deepEqual(r, { path: [0, 1, 4, 3], why: 'used' }, 'older track is not taken back by a drag');
  r = dragOnto(p, [0], 4);
  assert.equal(r.why, 'far');
  assert.deepEqual(cutTo([0, 1, 2, 5], 1), [0, 1]);
  assert.deepEqual(cutTo([0, 1], 7), [0, 1]);
});

test('a fast finger walks the squares in between, also across a corner', () => {
  const p = snake();
  assert.deepEqual(dragAlong(p, [0], [1, 2, 5]).path, [0, 1, 2, 5]);
  // across a corner from 2 to 4: through 5 (1 is track), so 2 -> 5 -> 4
  assert.deepEqual(dragAlong(p, [0, 1, 2], [4]).path, [0, 1, 2, 5, 4]);
  // and back across the same corner takes both back
  assert.deepEqual(dragAlong(p, [0, 1, 2, 5, 4], [2]).path, [0, 1, 2]);
  // a blocked square in the middle: the rest is still tried from the end
  // the last station is too early; then 7, across the corner from 5, goes back through 4
  const r = dragAlong(p, [0, 1, 4, 5], [8, 7]);
  assert.deepEqual(r.path, [0, 1, 4, 7]);
  assert.equal(r.why, 'early');
  // a square two away (the finger skipped a whole square's middle): nothing
  assert.deepEqual(dragAlong(p, [0], [2]), { path: [0], why: 'far' });
});

test('a fast move onto station 2 and on to station 4 lays station 2, and then station 3 is next', () => {
  // 4 x 3:  1 2 4 .  /  . . . .  /  . 3 . 5   (the way: 0 1 5 4 8 9 10 6 2 3 7 11)
  const nums = new Array(12).fill(0);
  nums[0] = 1;
  nums[1] = 2;
  nums[9] = 3;
  nums[2] = 4;
  nums[11] = 5;
  const p = { w: 4, h: 3, nums, walls: [] };
  assert.ok(isValidPath(p, [0, 1, 5, 4, 8, 9, 10, 6, 2, 3, 7, 11]));
  assert.equal(nextStation(p, [0]), 2);
  const r = dragAlong(p, [0], cellsOnMove(4, 3, 0.5, 0.5, 2.5, 0.5));
  assert.deepEqual(r, { path: [0, 1], why: 'order' });
  // the line under the board is made from the path after the move (treintje.js): station 3
  assert.equal(nextStation(p, r.path), 3);
});

test('the finger on the board: squares well inside only, pressing on the track takes it back to there', () => {
  assert.equal(cellAt(3, 3, 1.5, 1.5), 4);
  assert.equal(cellAt(3, 3, 1.05, 1.5, 0.18), -1, 'in the margin');
  assert.equal(cellAt(3, 3, -0.1, 1), -1);
  assert.equal(cellAt(3, 3, 3, 1), -1);
  assert.deepEqual(cellsOnMove(3, 3, 0.5, 0.5, 2.5, 0.5), [0, 1, 2]);
  assert.deepEqual(cellsOnMove(3, 3, 0.5, 0.5, 0.5, 0.5), [0]);
  // along the line between two rows nothing flickers
  assert.deepEqual(cellsOnMove(3, 3, 0.5, 1.0, 2.5, 1.0), []);
  const p = snake();
  assert.deepEqual(pressAt(p, [0, 1, 2, 5], 1), { path: [0, 1], grabbed: true, why: null });
  assert.deepEqual(pressAt(p, [0, 1, 2], 5), { path: [0, 1, 2, 5], grabbed: true, why: null });
  assert.deepEqual(pressAt(p, [0, 1, 2], 7), { path: [0, 1, 2], grabbed: false, why: 'far' });
  assert.deepEqual(pressAt(p, [0], -1), { path: [0], grabbed: false, why: null });
});

test('the track pieces and the route the train rides', () => {
  const p = snake();
  assert.deepEqual(trackPieces(p, [0, 1, 4]).map((x) => x.sides), [['e'], ['w', 's'], ['n']]);
  assert.deepEqual(trackPieces(p, [0]).map((x) => x.sides), [[]]);
  const segs = route(3, SNAKE);
  assert.equal(segs.length, 9);
  assert.deepEqual(segs.map((s) => s.kind), ['line', 'line', 'arc', 'arc', 'line', 'arc', 'arc', 'line', 'line']);
  // every segment starts where the one before ended
  for (let k = 1; k < segs.length; k++) {
    assert.ok(Math.abs(segs[k].x0 - segs[k - 1].x1) < 1e-9 && Math.abs(segs[k].y0 - segs[k - 1].y1) < 1e-9, `gap before segment ${k}`);
  }
  const len = routeLength(segs);
  assert.ok(Math.abs(len - (0.5 + 1 + Math.PI / 4 + Math.PI / 4 + 1 + Math.PI / 4 + Math.PI / 4 + 1 + 0.5)) < 1e-9);
  assert.deepEqual([pointAt(segs, 0).x, pointAt(segs, 0).y], [0.5, 0.5]);
  const end = pointAt(segs, len + 5);
  assert.ok(Math.abs(end.x - 2.5) < 1e-9 && Math.abs(end.y - 2.5) < 1e-9, 'clamped to the last square');
  // the way stays on the track and the heading is a unit vector
  for (let s = 0; s <= len; s += 0.05) {
    const q = pointAt(segs, s);
    assert.ok(q.x >= 0.5 - 1e-9 && q.x <= 2.5 + 1e-9 && q.y >= 0.5 - 1e-9 && q.y <= 2.5 + 1e-9);
    assert.ok(Math.abs(Math.hypot(q.dx, q.dy) - 1) < 1e-9);
  }
  assert.deepEqual(route(3, [0]), []);
});

test('a random path goes through every square once, one step at a time', () => {
  for (const [w, h] of [[4, 4], [5, 5], [6, 6], [7, 7], [3, 4]]) {
    for (let s = 1; s <= 20; s++) {
      const path = randomPath(w, h, rng(s * 7919));
      assert.equal(new Set(path).size, w * h);
      for (let k = 1; k < path.length; k++) assert.ok(linked({ w, h, walls: [] }, path[k - 1], path[k]));
    }
  }
});

test('the solver counts the ways through', () => {
  // only stations 1 and 3 on the 3x3: several ways (e.g. the snake by rows or by columns)
  const p = snake();
  p.nums[4] = 0;
  p.nums[8] = 2;
  assert.equal(countSolutions(p).count, 2);
  assert.equal(countSolutions(snake()).count, 2, 'the snake by rows and by columns');
  const one = snake();
  one.nums[2] = 2;
  one.nums[4] = 3;
  one.nums[8] = 4;
  const r1 = countSolutions(one);
  assert.equal(r1.count, 1);
  assert.deepEqual(r1.first, SNAKE);
  // a fence that blocks the only way: none
  one.walls = [[4, 5]];
  assert.equal(countSolutions(one).count, 0);
  // the node budget: a search that runs out is "not proven unique"
  const big = { w: 7, h: 7, nums: new Array(49).fill(0), walls: [] };
  big.nums[0] = 1;
  big.nums[48] = 2;
  const r = countSolutions(big, { budget: 50 });
  assert.equal(r.count, 2);
});

const SEEDS = 200;
const seedOf = (i) => (Math.imul(i + 1, 2654435761) >>> 0) || 1;

for (const age of AGE_IDS) {
  test(`${age}: 200 puzzles, each solvable with exactly one way through, the age's size, in time`, () => {
    const times = [];
    const stations = {};
    for (let i = 0; i < SEEDS; i++) {
      const seed = seedOf(i);
      const a = performance.now();
      const p = makePuzzle(age, seed);
      times.push(performance.now() - a);
      assert.ok(AGES[age].sizes.some(([w, h, f]) => w === p.w && h === p.h && p.walls.length <= f), `${age} seed ${seed}: ${p.w}x${p.h} with ${p.walls.length} fences`);
      assert.ok(isSolved(p, p.solution), `${age} seed ${seed}: the solution breaks the rules`);
      assert.ok(checkPuzzle(p), `${age} seed ${seed}: not exactly one way through`);
      for (const [a2, b2] of p.walls) assert.ok(linked({ w: p.w, h: p.h, walls: [] }, a2, b2), 'a fence between neighbours');
      const k = Math.max(...p.nums);
      assert.ok(k >= Math.min(AGES[age].keep, p.w * p.h) && k <= p.w * p.h, `${age} seed ${seed}: ${k} stations`);
      stations[k] = (stations[k] || 0) + 1;
      assert.ok(p.nodes <= PUZZLE_BUDGET + NODE_BUDGET, `${age} seed ${seed}: searched ${p.nodes} nodes`);
      assert.deepEqual(makePuzzle(age, seed), p, 'the same seed gives the same puzzle');
    }
    times.sort((a, b) => a - b);
    const median = times[SEEDS / 2];
    const max = times[SEEDS - 1];
    console.log(`treintje ${age}: median ${median.toFixed(1)} ms, max ${max.toFixed(1)} ms; stations ${JSON.stringify(stations)}`);
    // phones are about 10x slower than this machine; the game makes them in a worker, one ahead
    assert.ok(median < 30, `${age}: median ${median.toFixed(1)} ms`);
    assert.ok(max < 400, `${age}: max ${max.toFixed(1)} ms`);
    if (age === 'a3') assert.ok(Object.keys(stations).every((k) => k <= 6), 'small children: at most 6 stations on 4x4');
    if (age === 'a8') assert.ok(Object.keys(stations).every((k) => k <= 14), 'older children: few stations');
  });
}

test('free: ages 3-5; 6-7 and 8-10 in the full version', () => {
  assert.equal(meta.group, 'puzzles');
  assert.ok(!meta.isLocked({ age: 'a3' }, false));
  assert.ok(meta.isLocked({ age: 'a6' }, false));
  assert.ok(meta.isLocked({ age: 'a8' }, false));
  for (const age of AGE_IDS) assert.ok(!meta.isLocked({ age }, true));
});

test('what is saved travels with Voortgang overzetten, and nothing odd gets through', () => {
  const out = sanitizePayload(
    JSON.parse('{"games":{"treintje":{"random":{"a3":12,"a6":3,"a8":-1,"__proto__":4},"howSeen":{"a3":true,"a6":"yes"},"lastAge":"a6","junk":{"deep":{"er":1}}}}}'),
  );
  assert.deepEqual(out.games.treintje.random, { a3: 12, a6: 3 });
  assert.deepEqual(out.games.treintje.howSeen, { a3: true });
  assert.equal(out.games.treintje.lastAge, 'a6');
  assert.deepEqual(out.games.treintje.junk, { }, 'a nested object loses its inner objects');
});
