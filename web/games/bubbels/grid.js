// Pure hex-grid logic for Bubbels. No DOM, no globals: runs in the browser and under `node --test`.
//
// Layout: rows are hex-packed. Even rows hold `cols` cells, odd rows are shifted right by one
// radius and hold `cols - 1` cells. Coordinates are grid-local: the ceiling is at y = 0 and the
// left wall at x = 0, so the board is `cols * 2R` wide.

export const SQRT3 = Math.sqrt(3);

export function rowWidth(r, cols) {
  return r & 1 ? cols - 1 : cols;
}

/** Parse level rows: '.' (or anything not 0-9) is empty, a digit is a colour index. */
export function parseRows(rows, cols) {
  return rows.map((line, r) => {
    const w = rowWidth(r, cols);
    const out = new Array(w).fill(null);
    for (let c = 0; c < w; c++) {
      const ch = line[c];
      if (ch !== undefined && ch >= '0' && ch <= '9') out[c] = ch.charCodeAt(0) - 48;
    }
    return out;
  });
}

export function makeGrid(rows, cols) {
  return { cols, cells: parseRows(rows, cols) };
}

export function toRows(grid) {
  return grid.cells.map((row) => row.map((v) => (v === null ? '.' : String(v))).join(''));
}

export function get(grid, r, c) {
  if (r < 0 || r >= grid.cells.length) return null;
  const row = grid.cells[r];
  if (c < 0 || c >= row.length) return null;
  return row[c];
}

export function set(grid, r, c, v) {
  while (grid.cells.length <= r) {
    grid.cells.push(new Array(rowWidth(grid.cells.length, grid.cols)).fill(null));
  }
  grid.cells[r][c] = v;
}

const EVEN_DIRS = [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
const ODD_DIRS = [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];

/** The (up to) six neighbours of a cell that exist on the board (row >= 0, column in range). */
export function neighbors(r, c, cols) {
  const dirs = r & 1 ? ODD_DIRS : EVEN_DIRS;
  const out = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nc >= rowWidth(nr, cols)) continue;
    out.push([nr, nc]);
  }
  return out;
}

export function cellCenter(r, c, R) {
  return { x: R + c * 2 * R + (r & 1 ? R : 0), y: R + r * SQRT3 * R };
}

export function pixelToCell(x, y, R, cols) {
  const r = Math.max(0, Math.round((y - R) / (SQRT3 * R)));
  const off = r & 1 ? R : 0;
  const c = Math.round((x - R - off) / (2 * R));
  return { r, c: Math.min(rowWidth(r, cols) - 1, Math.max(0, c)) };
}

const key = (r, c) => r * 64 + c;

/** All cells connected to (r, c) with the same colour, including (r, c). Empty start -> []. */
export function findMatches(grid, r, c) {
  const colour = get(grid, r, c);
  if (colour === null) return [];
  const seen = new Set([key(r, c)]);
  const out = [];
  const queue = [[r, c]];
  while (queue.length) {
    const [cr, cc] = queue.pop();
    out.push([cr, cc]);
    for (const [nr, nc] of neighbors(cr, cc, grid.cols)) {
      const k = key(nr, nc);
      if (seen.has(k) || get(grid, nr, nc) !== colour) continue;
      seen.add(k);
      queue.push([nr, nc]);
    }
  }
  return out;
}

/** Occupied cells that are no longer connected (through any colour) to the ceiling row. */
export function findFloating(grid) {
  const seen = new Set();
  const queue = [];
  const top = grid.cells[0] || [];
  top.forEach((v, c) => {
    if (v !== null) {
      seen.add(key(0, c));
      queue.push([0, c]);
    }
  });
  while (queue.length) {
    const [cr, cc] = queue.pop();
    for (const [nr, nc] of neighbors(cr, cc, grid.cols)) {
      const k = key(nr, nc);
      if (seen.has(k) || get(grid, nr, nc) === null) continue;
      seen.add(k);
      queue.push([nr, nc]);
    }
  }
  const out = [];
  grid.cells.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v !== null && !seen.has(key(r, c))) out.push([r, c]);
    }),
  );
  return out;
}

export function removeCells(grid, list) {
  for (const [r, c] of list) if (r < grid.cells.length) grid.cells[r][c] = null;
}

export function count(grid) {
  let n = 0;
  for (const row of grid.cells) for (const v of row) if (v !== null) n++;
  return n;
}

export function colorsPresent(grid) {
  const s = new Set();
  for (const row of grid.cells) for (const v of row) if (v !== null) s.add(v);
  return [...s].sort((a, b) => a - b);
}

export function lowestRow(grid) {
  for (let r = grid.cells.length - 1; r >= 0; r--) {
    if (grid.cells[r].some((v) => v !== null)) return r;
  }
  return -1;
}

export function isAttached(grid, r, c) {
  if (r === 0) return true;
  return neighbors(r, c, grid.cols).some(([nr, nc]) => get(grid, nr, nc) !== null);
}

/** The empty cell, attached to the ceiling or a bubble, whose centre is nearest to (x, y). */
export function snapCell(grid, x, y, R) {
  const guess = pixelToCell(x, y, R, grid.cols);
  const maxRow = Math.max(lowestRow(grid) + 1, guess.r);
  let best = null;
  let bestD = Infinity;
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c < rowWidth(r, grid.cols); c++) {
      if (get(grid, r, c) !== null || !isAttached(grid, r, c)) continue;
      const p = cellCenter(r, c, R);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { r, c };
      }
    }
  }
  return best || guess;
}

/**
 * Does a flying bubble at grid-local (x, y) touch something? Returns {type:'ceiling'},
 * {type:'bubble', r, c} or null. `hitDist` is the centre distance that counts as touching.
 */
export function collides(grid, x, y, R, hitDist = 2 * R) {
  if (y <= R) return { type: 'ceiling' };
  const h2 = hitDist * hitDist;
  for (let r = 0; r < grid.cells.length; r++) {
    const row = grid.cells[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === null) continue;
      const p = cellCenter(r, c, R);
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < h2) return { type: 'bubble', r, c };
    }
  }
  return null;
}

/** Fold a position that went past a wall back inside and point the velocity away from it. */
export function bounceX(x, vx, minX, maxX) {
  if (x < minX) return { x: 2 * minX - x, vx: Math.abs(vx), bounced: true };
  if (x > maxX) return { x: 2 * maxX - x, vx: -Math.abs(vx), bounced: true };
  return { x, vx, bounced: false };
}

/** Where a ray from (x, y) along (dx, dy) reaches the wall it is heading for, or null if vertical. */
export function firstWallHit(x, y, dx, dy, minX, maxX) {
  if (dx === 0) return null;
  const t = dx < 0 ? (minX - x) / dx : (maxX - x) / dx;
  return { t, x: x + dx * t, y: y + dy * t };
}

/**
 * Trace the aiming guide from (ox, oy) at `angle` (radians, 0 = right, PI/2 = straight up) in
 * board coordinates. The grid sits `gridTop` pixels below the board top. Stops at a bubble, at
 * the ceiling, or at the wall after `maxBounces` bounces.
 * Returns { points: [{x,y}...], end: {x,y}, hit: 'bubble' | 'ceiling' | 'wall' | 'none' }.
 */
export function traceGuide(grid, ox, oy, angle, opts) {
  const { R, width, gridTop = 0, maxBounces = 1, step = R / 4, maxLen = 3000 } = opts;
  const hitDist = opts.hitDist ?? 2 * R;
  let dx = Math.cos(angle);
  const dy = -Math.sin(angle);
  let x = ox;
  let y = oy;
  let travelled = 0;
  let bounces = 0;
  const points = [{ x, y }];
  while (travelled < maxLen) {
    let nx = x + dx * step;
    let ny = y + dy * step;
    if (nx < R || nx > width - R) {
      const w = firstWallHit(x, y, dx, dy, R, width - R);
      x = w.x;
      y = w.y;
      travelled += w.t;
      points.push({ x, y });
      if (bounces >= maxBounces) return { points, end: { x, y }, hit: 'wall' };
      bounces++;
      dx = -dx;
      continue;
    }
    x = nx;
    y = ny;
    travelled += step;
    const hit = collides(grid, x, y - gridTop, R, hitDist);
    if (hit) {
      points.push({ x, y });
      return { points, end: { x, y }, hit: hit.type };
    }
  }
  points.push({ x, y });
  return { points, end: { x, y }, hit: 'none' };
}

/**
 * Plan a whole shot before it flies: the exact path (the same trace the aiming guide draws,
 * with any number of wall bounces) and the cell the bubble will stick in. The game animates
 * the bubble along `points` and puts it in `cell`, so it always lands where the ghost circle
 * showed. Returns { points, cell: {r, c}, bounces, hit }.
 */
export function planShot(grid, ox, oy, angle, opts) {
  const { R, gridTop = 0 } = opts;
  const tr = traceGuide(grid, ox, oy, angle, { maxLen: 20000, ...opts, maxBounces: Infinity });
  const cell = snapCell(grid, tr.end.x, tr.end.y - gridTop, R);
  return { points: tr.points, cell, bounces: tr.points.length - 2, hit: tr.hit };
}

/** Walk `dist` pixels along a polyline. Returns {x, y, seg} (seg = index of the segment's end). */
export function pointAlong(points, dist) {
  let left = dist;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len) {
      const f = len ? left / len : 0;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, seg: i, done: false };
    }
    left -= len;
  }
  const end = points[points.length - 1];
  return { x: end.x, y: end.y, seg: points.length - 1, done: true };
}

/** 3 stars at or under par, 2 stars up to 1.5x par, otherwise 1. */
export function starsFor(shots, par) {
  if (shots <= par) return 3;
  if (shots <= Math.ceil(par * 1.5)) return 2;
  return 1;
}
