// Egeltje's garden maze, pure (no DOM), so the tests can walk it. A grid of cells; the walls are the
// hedges between cells, kept per cell as a bit mask of the open sides. Made with a seeded
// depth-first walk (one way to every cell), then every dead end gets a second way out and a few
// extra gaps are cut, so there are loops everywhere: a friendly crow can always be walked around and
// nobody ever gets stuck at the end of a corridor.
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
/** [row step, col step, this side, the side seen from the neighbour] per direction. */
export const DIRS = Object.freeze({
  up: Object.freeze([-1, 0, N, S]),
  right: Object.freeze([0, 1, E, W]),
  down: Object.freeze([1, 0, S, N]),
  left: Object.freeze([0, -1, W, E]),
});
export const DIR_NAMES = Object.freeze(['up', 'right', 'down', 'left']);
export const OPPOSITE = Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' });
/** Extra gaps cut after the dead ends are gone, as a part of the cells. */
export const EXTRA_GAPS = 0.08;

export const rowOf = (maze, cell) => Math.floor(cell / maze.cols);
export const colOf = (maze, cell) => cell % maze.cols;

/** The cell one step `dir` from `cell`, or -1 at the edge of the garden (hedges ignored). */
export function beside(maze, cell, dir) {
  const [dr, dc] = DIRS[dir];
  const r = rowOf(maze, cell) + dr;
  const c = colOf(maze, cell) + dc;
  return r < 0 || c < 0 || r >= maze.rows || c >= maze.cols ? -1 : r * maze.cols + c;
}

/** Is there a gap in the hedge on side `dir` of `cell`? */
export const isOpen = (maze, cell, dir) => (maze.open[cell] & DIRS[dir][2]) !== 0;

/** Where one step `dir` leads, or -1 when a hedge is in the way. */
export const stepFrom = (maze, cell, dir) => (isOpen(maze, cell, dir) ? beside(maze, cell, dir) : -1);

/** The open directions of a cell. */
export const exits = (maze, cell) => DIR_NAMES.filter((d) => isOpen(maze, cell, d));

/** The cells you can step to from `cell`. */
export const neighbours = (maze, cell) => exits(maze, cell).map((d) => beside(maze, cell, d));

function cut(maze, cell, dir) {
  const to = beside(maze, cell, dir);
  if (to < 0) return;
  maze.open[cell] |= DIRS[dir][2];
  maze.open[to] |= DIRS[dir][3];
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A garden maze of cols × rows cells, the same for the same `rand` sequence. */
export function makeMaze(cols, rows, rand) {
  const maze = { cols, rows, open: new Uint8Array(cols * rows) };
  const n = cols * rows;
  const seen = new Uint8Array(n);
  const first = Math.floor(rand() * n);
  const stack = [first];
  seen[first] = 1;
  while (stack.length) {
    const cell = stack[stack.length - 1];
    const ways = shuffle(DIR_NAMES, rand).filter((d) => {
      const to = beside(maze, cell, d);
      return to >= 0 && !seen[to];
    });
    if (!ways.length) {
      stack.pop();
      continue;
    }
    const to = beside(maze, cell, ways[0]);
    cut(maze, cell, ways[0]);
    seen[to] = 1;
    stack.push(to);
  }
  // no dead ends: each gets a second way out, to another dead end when there is one
  for (const cell of shuffle([...Array(n).keys()], rand)) {
    if (exits(maze, cell).length !== 1) continue;
    const closed = DIR_NAMES.filter((d) => !isOpen(maze, cell, d) && beside(maze, cell, d) >= 0);
    const toDead = closed.filter((d) => exits(maze, beside(maze, cell, d)).length === 1);
    const pick = (toDead.length ? toDead : closed)[Math.floor(rand() * (toDead.length || closed.length))];
    if (pick) cut(maze, cell, pick);
  }
  // a few more gaps, so even a small garden has choices
  const inner = [];
  for (let cell = 0; cell < n; cell++) for (const d of ['right', 'down']) if (beside(maze, cell, d) >= 0 && !isOpen(maze, cell, d)) inner.push([cell, d]);
  for (const [cell, d] of shuffle(inner, rand).slice(0, Math.round(n * EXTRA_GAPS))) cut(maze, cell, d);
  return maze;
}

// The neighbours of every cell, worked out once per garden (the crows ask a lot): kept with the
// open sides they were made from, and made again if those ever change.
const LINKS = new WeakMap();
function linksOf(maze) {
  const known = LINKS.get(maze);
  if (known && known.open.every((v, c) => v === maze.open[c])) return known.adj;
  const adj = Array.from({ length: maze.cols * maze.rows }, (_, c) => neighbours(maze, c));
  LINKS.set(maze, { open: Uint8Array.from(maze.open), adj });
  return adj;
}

/**
 * Steps from `from` to every cell (-1: out of reach), not through the cells in `blocked` (a Set or
 * a function). `from` itself is never blocked.
 */
export function distances(maze, from, blocked = null) {
  const isBlocked = typeof blocked === 'function' ? blocked : blocked ? (c) => blocked.has(c) : () => false;
  const n = maze.cols * maze.rows;
  const adj = linksOf(maze);
  const dist = new Int16Array(n).fill(-1);
  dist[from] = 0;
  const queue = [from];
  for (let k = 0; k < queue.length; k++) {
    const cell = queue[k];
    for (const to of adj[cell]) {
      if (dist[to] >= 0 || isBlocked(to)) continue;
      dist[to] = dist[cell] + 1;
      queue.push(to);
    }
  }
  return dist;
}

/** The first direction of a shortest way from `from` to `to`, not through `blocked`; null if none. */
export function firstStep(maze, from, to, blocked = null) {
  if (from === to) return null;
  const isBlocked = typeof blocked === 'function' ? blocked : blocked ? (c) => blocked.has(c) : () => false;
  const back = distances(maze, to, (c) => c !== from && isBlocked(c));
  if (back[from] < 0) return null;
  for (const d of exits(maze, from)) {
    const next = beside(maze, from, d);
    if (back[next] === back[from] - 1 && (next === to || !isBlocked(next))) return d;
  }
  return null;
}
