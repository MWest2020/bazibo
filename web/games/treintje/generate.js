// Treintje's puzzles, made on the device from a seed (pure; tested in tests/treintje.test.js, 200
// seeds per age: solvable, exactly one way through, within a time budget).
//
// How a puzzle is made:
//   1. a random railway through every square (a Hamiltonian path), by "backbiting" a zig-zag path
//      many times (each move keeps it a path through every square);
//   2. for the oldest children a few fences, each across two squares the railway does not join
//      (never two fences on one square, so they stay "a few" and spread out);
//   3. plenty of stations on the railway (about every second square; 1 at its start, the last at
//      its end), checked by a solver that counts the ways through (up to 2) and adds a station
//      where another way goes differently until there is only one;
//   4. then stations are taken away again, one at a time in a random order, as long as there is
//      still only one way through and the age keeps at least `keep` of them.
// The solver has a node budget per count (NODE_BUDGET) and per puzzle (PUZZLE_BUDGET), so making
// one never takes long on a phone: a count that runs out means "not proven unique", so the station
// stays (or, before any station is taken away, every square becomes a station).
import { gridNeighbours, wallKey, isValidPath } from './rules.js';

/**
 * The ages in the menu (tuned for fun, see AGENTS.md): the grid sizes as [columns, rows, fences]
 * (one picked per puzzle) and the fewest stations to keep.
 *   3-5:  4x4, no fences, at least 4 stations (4 to 6): short, and the stations show the way
 *   6-7:  5x5 or 6x6, no fences, at least 6 stations (6 to 11)
 *   8-10: 6x6 with 3 fences or 7x7 with 5, as few stations as stay unique (about 6 to 12)
 */
export const AGES = Object.freeze({
  a3: Object.freeze({ age: '3-5', sizes: [[4, 4, 0]], keep: 4 }),
  a6: Object.freeze({ age: '6-7', sizes: [[5, 5, 0], [6, 6, 0]], keep: 6 }),
  a8: Object.freeze({ age: '8-10', sizes: [[6, 6, 3], [7, 7, 5]], keep: 4 }),
});
export const AGE_IDS = Object.freeze(Object.keys(AGES));

/** Search nodes for one count of the ways through; past it a puzzle counts as not unique. */
export const NODE_BUDGET = 8000;
/** Search nodes for one whole puzzle; past it no more stations are taken away. */
export const PUZZLE_BUDGET = 100000;

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

/** A random path through every square of a w x h grid. */
export function randomPath(w, h, rand) {
  const n = w * h;
  const path = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) path.push(r * w + (r % 2 ? w - 1 - c : c));
  if (n < 3) return path;
  const at = new Int32Array(n);
  path.forEach((cell, k) => (at[cell] = k));
  const nbrs = Array.from({ length: n }, (_, i) => gridNeighbours(w, h, i));
  const moves = 12 * n * Math.ceil(Math.sqrt(n));
  for (let m = 0; m < moves; m++) {
    if (rand() < 0.5) {
      // the end bites a neighbour x = path[k]: reverse path[k+1 .. n-1], path[k+1] is the new end
      const k = at[pick(nbrs[path[n - 1]], rand)];
      if (k !== n - 2) reverse(path, at, k + 1, n - 1);
    } else {
      const k = at[pick(nbrs[path[0]], rand)];
      if (k !== 1) reverse(path, at, 0, k - 1);
    }
  }
  return path;
}

function reverse(path, at, i, j) {
  while (i < j) {
    const a = path[i];
    path[i] = path[j];
    path[j] = a;
    at[path[i]] = i;
    at[path[j]] = j;
    i++;
    j--;
  }
}

/**
 * Count the ways through (0, 1 or 2 = "more than one"), within `budget` search nodes. Returns
 * { count, first, other, out, nodes }: `other` a second way when there is one, `out` true when the
 * budget ran out (count is then 2: not proven unique).
 */
export function countSolutions(p, { limit = 2, budget = NODE_BUDGET } = {}) {
  const { w, h, nums } = p;
  const n = w * h;
  const walls = new Set((p.walls || []).map(([a, b]) => wallKey(a, b)));
  const adj = Array.from({ length: n }, (_, i) => gridNeighbours(w, h, i).filter((j) => !walls.has(wallKey(i, j))));
  const last = nums.reduce((m, v) => Math.max(m, v), 0);
  const lastCell = nums.indexOf(last);
  const start = nums.indexOf(1);
  const colour = (i) => (Math.floor(i / w) + (i % w)) % 2;
  const used = new Uint8Array(n);
  const left = [0, 0]; // squares without track, per colour of the chessboard
  for (let i = 0; i < n; i++) left[colour(i)]++;
  const path = [start];
  used[start] = 1;
  left[colour(start)]--;
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  let nodes = 0;
  let count = 0;
  let first = null;
  let other = null;
  let out = false;

  // the rest of the way alternates colours from the head and ends on the last station; every square
  // without track still has a way in and out (only the old head's neighbours can have lost one), and
  // all of them can be reached from the head
  const degreeOk = (u, head) => {
    let d = 0;
    for (const v of adj[u]) if (!used[v] || v === head) d++;
    return d >= (u === lastCell ? 1 : 2);
  };
  function ok(prev, head, m) {
    const c = colour(head);
    if (left[1 - c] !== Math.ceil(m / 2) || left[c] !== Math.floor(m / 2)) return false;
    if (m > 0 && colour(lastCell) !== (m % 2 ? 1 - c : c)) return false;
    for (const u of adj[prev]) if (!used[u] && !degreeOk(u, head)) return false;
    seen.fill(0);
    let qh = 0;
    let qt = 0;
    for (const v of adj[head]) {
      if (!used[v] && !seen[v]) {
        seen[v] = 1;
        queue[qt++] = v;
      }
    }
    while (qh < qt) {
      const u = queue[qh++];
      for (const v of adj[u]) {
        if (!used[v] && !seen[v]) {
          seen[v] = 1;
          queue[qt++] = v;
        }
      }
    }
    return qt === m;
  }

  function dfs(head, next) {
    if (++nodes > budget) {
      out = true;
      return;
    }
    if (path.length === n) {
      count++;
      if (count === 1) first = path.slice();
      else if (count === 2) other = path.slice();
      return;
    }
    for (const v of adj[head]) {
      if (used[v]) continue;
      const k = nums[v];
      if (k > 0 && k !== next) continue;
      if (v === lastCell && path.length !== n - 1) continue;
      used[v] = 1;
      left[colour(v)]--;
      path.push(v);
      if (ok(head, v, n - path.length)) dfs(v, k > 0 ? next + 1 : next);
      path.pop();
      left[colour(v)]++;
      used[v] = 0;
      if (count >= limit || out) return;
    }
  }
  if (n === 1) return { count: 1, first: [start], other: null, out: false, nodes };
  for (let u = 0; u < n; u++) if (!used[u] && !degreeOk(u, start)) return { count: 0, first: null, other: null, out: false, nodes };
  dfs(start, 2);
  if (out) count = Math.max(count, 2);
  return { count, first, other, out, nodes };
}

function shuffle(arr, rand) {
  for (let k = arr.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [arr[k], arr[j]] = [arr[j], arr[k]];
  }
  return arr;
}

/**
 * The puzzle for an age and a seed: { age, seed, w, h, nums, walls, solution, nodes }. The same seed
 * always gives the same puzzle; `nodes` is the search it took (the tests hold it to the budget).
 */
export function makePuzzle(ageId, seed) {
  const age = AGES[ageId];
  if (!age) throw new Error(`unknown age ${ageId}`);
  const rand = rng(seed);
  const [w, h, fences] = pick(age.sizes, rand);
  const n = w * h;
  const solution = randomPath(w, h, rand);
  const onPath = new Set();
  for (let k = 1; k < n; k++) onPath.add(wallKey(solution[k - 1], solution[k]));
  const walls = [];
  if (fences) {
    const edges = [];
    for (let i = 0; i < n; i++) for (const j of gridNeighbours(w, h, i)) if (i < j && !onPath.has(wallKey(i, j))) edges.push([i, j]);
    const touched = new Set();
    for (const [a, b] of shuffle(edges, rand)) {
      if (walls.length >= fences) break;
      if (touched.has(a) || touched.has(b)) continue;
      walls.push([a, b]);
      touched.add(a).add(b);
    }
  }
  const at = new Set([0, n - 1]); // station positions on the railway (indexes into it)
  for (let k = 2; k < n - 1; k += 2) at.add(Math.min(n - 2, k + Math.floor(rand() * 2)));
  const build = () => {
    const nums = new Array(n).fill(0);
    [...at].sort((a, b) => a - b).forEach((k, idx) => (nums[solution[k]] = idx + 1));
    return { w, h, nums, walls: walls.map((x) => x.slice()) };
  };
  let left = PUZZLE_BUDGET;
  const count = () => {
    const r = countSolutions(build(), { budget: Math.max(1, Math.min(NODE_BUDGET, left)) });
    left -= r.nodes;
    return r;
  };
  // one way only, with the stations as placed (or more)
  for (;;) {
    const r = left > 0 ? count() : null;
    if (r && r.count === 1) break;
    const free = [];
    for (let k = 1; k < n - 1; k++) if (!at.has(k) && (!r?.other || r.other[k] !== solution[k])) free.push(k);
    if (!r || !free.length) {
      for (let k = 0; k < n; k++) at.add(k); // a station on every square: one way only
      break;
    }
    at.add(pick(free, rand));
  }
  // take stations away while it stays one way only (fewer stations is harder)
  for (const k of shuffle([...at].filter((k) => k !== 0 && k !== n - 1), rand)) {
    if (at.size <= age.keep || left <= 0) break;
    at.delete(k);
    if (count().count !== 1) at.add(k);
  }
  return { age: ageId, seed: seed >>> 0, ...build(), solution, nodes: PUZZLE_BUDGET - left };
}

/** A puzzle checked once more by the rules, with no budget (used by the tests). */
export function checkPuzzle(p) {
  return isValidPath(p, p.solution) && p.solution.length === p.w * p.h && countSolutions(p, { budget: Infinity }).count === 1;
}
