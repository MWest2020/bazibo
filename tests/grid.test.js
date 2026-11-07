import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../web/games/bubbels/grid.js';
import { readFileSync } from 'node:fs';

const R = 25;
const COLS = 8;
const sortCells = (l) => l.map(([r, c]) => `${r},${c}`).sort();

test('row widths alternate: even rows full, odd rows one shorter', () => {
  assert.equal(G.rowWidth(0, COLS), 8);
  assert.equal(G.rowWidth(1, COLS), 7);
  assert.equal(G.rowWidth(2, COLS), 8);
});

test('hex neighbours of an even-row cell in the middle', () => {
  assert.deepEqual(sortCells(G.neighbors(2, 3, COLS)), sortCells([[2, 2], [2, 4], [1, 2], [1, 3], [3, 2], [3, 3]]));
});

test('hex neighbours of an odd-row cell in the middle', () => {
  assert.deepEqual(sortCells(G.neighbors(1, 3, COLS)), sortCells([[1, 2], [1, 4], [0, 3], [0, 4], [2, 3], [2, 4]]));
});

test('neighbours are clipped at the ceiling and the walls', () => {
  assert.deepEqual(sortCells(G.neighbors(0, 0, COLS)), sortCells([[0, 1], [1, 0]]));
  assert.deepEqual(sortCells(G.neighbors(0, 7, COLS)), sortCells([[0, 6], [1, 6]]));
  // odd row, last cell: (r-1, c+1) = (0, 7) exists, (1, 7) does not
  assert.deepEqual(sortCells(G.neighbors(1, 6, COLS)), sortCells([[1, 5], [0, 6], [0, 7], [2, 6], [2, 7]]));
});

test('neighbours really touch: centre distance is exactly 2R', () => {
  for (const [r, c] of [[0, 0], [1, 3], [2, 5], [3, 6]]) {
    const a = G.cellCenter(r, c, R);
    for (const [nr, nc] of G.neighbors(r, c, COLS)) {
      const b = G.cellCenter(nr, nc, R);
      assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 2 * R) < 1e-9, `${r},${c} -> ${nr},${nc}`);
    }
  }
});

test('pixelToCell inverts cellCenter', () => {
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < G.rowWidth(r, COLS); c++) {
      const p = G.cellCenter(r, c, R);
      assert.deepEqual(G.pixelToCell(p.x + 3, p.y - 3, R, COLS), { r, c });
    }
  }
});

test('flood fill finds the connected same-colour group only', () => {
  const g = G.makeGrid(['00112233', '0.11222', '..1.....'], COLS);
  assert.deepEqual(sortCells(G.findMatches(g, 0, 2)), sortCells([[0, 2], [0, 3], [1, 2], [1, 3], [2, 2]]));
  assert.deepEqual(sortCells(G.findMatches(g, 0, 0)), sortCells([[0, 0], [0, 1], [1, 0]]));
  assert.deepEqual(G.findMatches(g, 1, 1), []); // empty cell
});

test('flood fill follows the hex shape, not a square grid', () => {
  // (0,0) and (1,0) touch in a hex grid with odd rows shifted right; (0,1)/(1,1) too
  const g = G.makeGrid(['1.......', '1.......', '.1......'], COLS);
  // (2,1) touches (1,0)? even row 2, col 1: up-neighbours are (1,0) and (1,1) -> yes
  assert.equal(G.findMatches(g, 2, 1).length, 3);
});

test('floating detection: groups cut off from the ceiling fall', () => {
  const g = G.makeGrid(['0.......', '.1......', '..2.....', '........', '33......'], COLS);
  // (0,0) holds (1,0)? row 1 is '.1' so (1,1)=1: neighbours of (1,1) up are (0,1),(0,2): empty -> floating
  const floating = sortCells(G.findFloating(g));
  assert.deepEqual(floating, sortCells([[1, 1], [2, 2], [4, 0], [4, 1]]));
});

test('floating detection: anything attached through other colours stays', () => {
  const g = G.makeGrid(['01......', '2.......', '3.......'], COLS);
  assert.deepEqual(G.findFloating(g), []);
  G.removeCells(g, [[1, 0]]);
  assert.deepEqual(sortCells(G.findFloating(g)), sortCells([[2, 0]]));
});

test('snapCell picks the nearest empty attached cell', () => {
  const g = G.makeGrid(['00000000'], COLS);
  const below = G.cellCenter(1, 3, R);
  assert.deepEqual(G.snapCell(g, below.x + 2, below.y + 4, R), { r: 1, c: 3 });
  // at the ceiling of an empty board it snaps into row 0
  const e = G.makeGrid([], COLS);
  assert.deepEqual(G.snapCell(e, 3 * 2 * R + R, R - 2, R), { r: 0, c: 3 });
});

test('snapCell never returns an occupied or unattached cell', () => {
  const g = G.makeGrid(['0.0.0.0.', '.......'], COLS);
  for (let i = 0; i < 200; i++) {
    const x = R + Math.random() * (COLS * 2 * R - 2 * R);
    const y = Math.random() * 200;
    const { r, c } = G.snapCell(g, x, y, R);
    assert.equal(G.get(g, r, c), null);
    assert.ok(G.isAttached(g, r, c));
  }
});

test('collides: ceiling, bubble and free space', () => {
  const g = G.makeGrid(['...0....'], COLS);
  assert.deepEqual(G.collides(g, 100, R - 1, R), { type: 'ceiling' });
  const p = G.cellCenter(0, 3, R);
  assert.deepEqual(G.collides(g, p.x, p.y + 2 * R - 1, R), { type: 'bubble', r: 0, c: 3 });
  assert.equal(G.collides(g, p.x, p.y + 2 * R + 1, R), null);
});

test('wall bounce folds the position back and flips the velocity', () => {
  assert.deepEqual(G.bounceX(20, -5, 25, 375), { x: 30, vx: 5, bounced: true });
  assert.deepEqual(G.bounceX(380, 7, 25, 375), { x: 370, vx: -7, bounced: true });
  assert.deepEqual(G.bounceX(200, 3, 25, 375), { x: 200, vx: 3, bounced: false });
});

test('first wall hit is where the ray meets the wall', () => {
  const a = Math.PI / 4; // 45 degrees up-right
  const w = G.firstWallHit(200, 600, Math.cos(a), -Math.sin(a), 25, 375);
  assert.ok(Math.abs(w.x - 375) < 1e-9);
  assert.ok(Math.abs(w.y - (600 - 175)) < 1e-9); // 45 degrees: rise == run
  assert.equal(G.firstWallHit(200, 600, 0, -1, 25, 375), null);
});

test('guide line bounces once and keeps the mirrored angle', () => {
  const empty = G.makeGrid([], COLS);
  const a = Math.PI / 3; // 60 degrees, heading right
  const tr = G.traceGuide(empty, 200, 680, a, { R, width: 400, maxBounces: 1, step: 2 });
  const [start, wall, ...rest] = tr.points;
  assert.ok(Math.abs(wall.x - 375) < 1e-9, 'first point after the start is on the right wall');
  const end = rest.at(-1);
  // after the bounce dx flips sign but the slope stays the same
  const slopeIn = (wall.y - start.y) / (wall.x - start.x);
  const slopeOut = (end.y - wall.y) / (end.x - wall.x);
  assert.ok(Math.abs(slopeIn + slopeOut) < 1e-6);
  assert.ok(['ceiling', 'wall'].includes(tr.hit));
});

test('guide line stops at the first bubble in its way', () => {
  const g = G.makeGrid(['........', '.......', '....0...'], COLS);
  const target = G.cellCenter(2, 4, R);
  const ox = target.x;
  const tr = G.traceGuide(g, ox, 680, Math.PI / 2, { R, width: 400, step: 1 });
  assert.equal(tr.hit, 'bubble');
  assert.ok(Math.abs(tr.end.y - (target.y + 2 * R)) <= 1.01);
});

test('stars: 3 at par, 2 up to 1.5x par, else 1', () => {
  assert.equal(G.starsFor(8, 10), 3);
  assert.equal(G.starsFor(10, 10), 3);
  assert.equal(G.starsFor(15, 10), 2);
  assert.equal(G.starsFor(16, 10), 1);
});

test('levels.json: 30 levels, nothing floating, colours and size grow', () => {
  const data = JSON.parse(readFileSync(new URL('../web/games/bubbels/levels.json', import.meta.url), 'utf8'));
  assert.equal(data.levels.length, 30);
  let prevColours = 0;
  for (const l of data.levels) {
    const g = G.makeGrid(l.rows, data.cols);
    assert.deepEqual(G.findFloating(g), [], `level ${l.id} has floating bubbles`);
    assert.equal(G.colorsPresent(g).length, l.colors);
    assert.ok(l.colors >= prevColours, `level ${l.id} has fewer colours than the one before`);
    prevColours = l.colors;
    assert.ok(l.par > 0 && l.missesPerDrop > 0);
    l.rows.forEach((row, r) => assert.equal(row.length, G.rowWidth(r, data.cols)));
  }
  const first = data.levels.slice(0, 5).reduce((n, l) => n + l.rows.length, 0);
  const last = data.levels.slice(-5).reduce((n, l) => n + l.rows.length, 0);
  assert.ok(last > first);
});
