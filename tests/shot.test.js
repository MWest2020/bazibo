import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from '../web/games/bubbels/grid.js';

// The game's constants (web/games/bubbels/game.js)
const R = 25;
const W = 400;
const SHOOTER = { x: 200, y: 760 - 86 };
const HIT = 2 * R * 0.84;
const MIN = (9 * Math.PI) / 180;
const data = JSON.parse(readFileSync(new URL('../web/games/bubbels/levels.json', import.meta.url), 'utf8'));

function ghost(grid, angle, gridTop) {
  const tr = G.traceGuide(grid, SHOOTER.x, SHOOTER.y, angle, { R, width: W, gridTop, maxBounces: 1, hitDist: HIT });
  if (tr.hit !== 'bubble' && tr.hit !== 'ceiling') return null;
  return G.snapCell(grid, tr.end.x, tr.end.y - gridTop, R);
}

// Regression: the flying bubble used a different step size than the guide and landed one cell
// next to the ghost circle in about 2% of shots. Now the shot is planned with the guide's trace.
test('a shot lands exactly in the ghost cell, for every angle on every level', () => {
  let checked = 0;
  for (const l of data.levels) {
    const grid = G.makeGrid(l.rows, data.cols);
    for (const gridTop of [12, 12 + R * G.SQRT3]) {
      for (let a = MIN; a <= Math.PI - MIN; a += 0.013) {
        const g = ghost(grid, a, gridTop);
        if (!g) continue;
        const plan = G.planShot(grid, SHOOTER.x, SHOOTER.y, a, { R, width: W, gridTop, hitDist: HIT });
        assert.deepEqual(plan.cell, g, `level ${l.id}, angle ${((a * 180) / Math.PI).toFixed(2)}`);
        assert.ok(plan.bounces <= 1);
        checked++;
      }
    }
  }
  assert.ok(checked > 3000, `only ${checked} shots checked`);
});

test('a planned shot with several bounces still ends in an empty attached cell', () => {
  const grid = G.makeGrid(data.levels[0].rows, data.cols);
  const plan = G.planShot(grid, SHOOTER.x, SHOOTER.y, MIN, { R, width: W, gridTop: 12, hitDist: HIT });
  assert.ok(plan.bounces >= 2, `expected several bounces, got ${plan.bounces}`);
  assert.notEqual(plan.hit, 'none');
  assert.equal(G.get(grid, plan.cell.r, plan.cell.c), null);
  assert.ok(G.isAttached(grid, plan.cell.r, plan.cell.c));
});

test('pointAlong walks a polyline and reports the segment and the end', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  assert.deepEqual(G.pointAlong(pts, 5), { x: 5, y: 0, seg: 1, done: false });
  assert.deepEqual(G.pointAlong(pts, 15), { x: 10, y: 5, seg: 2, done: false });
  assert.deepEqual(G.pointAlong(pts, 99), { x: 10, y: 10, seg: 2, done: true });
});
