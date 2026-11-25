// Treintje (Little Train): the rules and what a drag means, pure (tested in tests/treintje.test.js).
//
// A puzzle is a grid of w x h squares with numbered stations and, for the oldest children, a few
// fences between squares. The child lays ONE railway that starts on station 1, goes through every
// square exactly once and passes the stations in order (1, 2, 3, ...); the last station is the last
// square. Nothing is ever "wrong": a step that is not allowed simply does not happen.
//
//   puzzle = { w, h, nums, walls, solution }
//     nums:     one number per square (index = row * w + col): 0, or the station's number
//     walls:    fences as [a, b] pairs of neighbouring squares, a < b
//     solution: the one way through (the generator proves it is the only one)
//   path   = the squares laid so far, in order; it always starts on station 1 (never empty)

/** The square's neighbours in the grid (up, right, down, left), ignoring fences. */
export function gridNeighbours(w, h, i) {
  const r = Math.floor(i / w);
  const c = i % w;
  const out = [];
  if (r > 0) out.push(i - w);
  if (c < w - 1) out.push(i + 1);
  if (r < h - 1) out.push(i + w);
  if (c > 0) out.push(i - 1);
  return out;
}

export const wallKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

const wallSets = new WeakMap();
function wallSet(p) {
  let s = wallSets.get(p);
  if (!s) {
    s = new Set((p.walls || []).map(([a, b]) => wallKey(a, b)));
    wallSets.set(p, s);
  }
  return s;
}

/** Is there a fence between squares a and b? */
export function hasWall(p, a, b) {
  return wallSet(p).has(wallKey(a, b));
}

/** Are a and b side by side (not diagonal), with no fence between them? */
export function linked(p, a, b) {
  if (a === b) return false;
  const ra = Math.floor(a / p.w);
  const rb = Math.floor(b / p.w);
  const side = (ra === rb && Math.abs(a - b) === 1) || Math.abs(a - b) === p.w;
  return side && !hasWall(p, a, b);
}

/** The neighbours the railway may go to from square i (no fence in between). */
export function neighbours(p, i) {
  return gridNeighbours(p.w, p.h, i).filter((j) => !hasWall(p, i, j));
}

export const cellCount = (p) => p.w * p.h;
export const stationCount = (p) => p.nums.reduce((m, v) => Math.max(m, v), 0);
export const stationCell = (p, k) => p.nums.indexOf(k);

/** The path at the start of a puzzle: only station 1. */
export const startPath = (p) => [stationCell(p, 1)];

/** How many stations the path has passed (they are always 1..k, in order). */
export function passed(p, path) {
  let k = 0;
  for (const i of path) if (p.nums[i] > 0) k = Math.max(k, p.nums[i]);
  return k;
}

/** The station to reach next (or 0 when the last one is passed). */
export function nextStation(p, path) {
  const k = passed(p, path) + 1;
  return k <= stationCount(p) ? k : 0;
}

/**
 * Why the railway cannot go from the end of `path` to square j, or null when it can:
 *   'done'  the track is finished
 *   'far'   j is not next to the end of the track (or it is the end itself)
 *   'wall'  a fence is in the way
 *   'used'  j already has track
 *   'order' j is a station that is not the next one
 *   'early' j is the last station and there are still squares without track
 */
export function whyNot(p, path, j) {
  if (isSolved(p, path)) return 'done';
  const end = path[path.length - 1];
  if (!Number.isInteger(j) || j < 0 || j >= cellCount(p)) return 'far';
  const g = gridNeighbours(p.w, p.h, end);
  if (!g.includes(j)) return 'far';
  if (hasWall(p, end, j)) return 'wall';
  if (path.includes(j)) return 'used';
  const k = p.nums[j];
  const last = stationCount(p);
  if (k > 0 && k === last && path.length !== cellCount(p) - 1) return 'early';
  if (k > 0 && k !== passed(p, path) + 1) return 'order';
  return null;
}

/** One step onto square j if it is allowed; otherwise the same path. */
export function step(p, path, j) {
  return whyNot(p, path, j) ? path : [...path, j];
}

/** Take the track back to square j (j stays the end); the same path when j has no track. */
export function cutTo(path, j) {
  const k = path.indexOf(j);
  return k < 0 ? path : path.slice(0, k + 1);
}

/** Every square has track and the track ends on the last station. */
export function isSolved(p, path) {
  return path.length === cellCount(p) && p.nums[path[path.length - 1]] === stationCount(p) && isValidPath(p, path);
}

/** A path that keeps every rule (used by the tests and to check a solution). */
export function isValidPath(p, path) {
  if (!path.length || p.nums[path[0]] !== 1) return false;
  const seen = new Set([path[0]]);
  let k = 1;
  for (let n = 1; n < path.length; n++) {
    const a = path[n - 1];
    const b = path[n];
    if (!linked(p, a, b) || seen.has(b)) return false;
    seen.add(b);
    if (p.nums[b] > 0) {
      if (p.nums[b] !== k + 1) return false;
      k++;
      if (k === stationCount(p) && n !== cellCount(p) - 1) return false;
    }
  }
  return true;
}

// ---------- what a finger means ----------

/**
 * The finger came onto square j while dragging the track:
 *   the square before the end -> the track is taken back one square
 *   a square next to the end  -> one step on, if the rules allow it
 *   anything else             -> nothing happens
 * Returns { path, why }: why is null when something happened (or j is the end), else whyNot's reason.
 */
export function dragOnto(p, path, j) {
  const end = path[path.length - 1];
  if (j === end) return { path, why: null };
  if (path.length > 1 && j === path[path.length - 2]) return { path: path.slice(0, -1), why: null };
  const why = whyNot(p, path, j);
  return why ? { path, why } : { path: [...path, j], why: null };
}

/**
 * The finger went from square a to square b in one move (a fast finger skips squares, or crosses a
 * corner). The squares in between are walked in order, each with dragOnto. Across a corner (a
 * square diagonal to the end) the square beside it that lets the track go on is taken first.
 * Returns { path, why } with the last reason a step did not happen (or null).
 */
export function dragAlong(p, path, cells) {
  let why = null;
  for (const j of cells) {
    const end = path[path.length - 1];
    if (j === end) continue;
    const er = Math.floor(end / p.w);
    const ec = end % p.w;
    const jr = Math.floor(j / p.w);
    const jc = j % p.w;
    if (Math.abs(er - jr) === 1 && Math.abs(ec - jc) === 1) {
      // a corner: through a square beside it that works, a square without track first (laying
      // on is what a finger cutting a corner means most often), then the way back
      const sides = [er * p.w + jc, jr * p.w + ec].sort((a, b) => path.includes(a) - path.includes(b));
      let done = false;
      for (const s of sides) {
        const r1 = dragOnto(p, path, s);
        if (r1.path === path) continue;
        const r2 = dragOnto(p, r1.path, j);
        if (r2.path !== r1.path) {
          path = r2.path;
          done = true;
          break;
        }
      }
      if (!done) why = whyNot(p, path, j) || why;
      continue;
    }
    const r = dragOnto(p, path, j);
    if (r.why) why = r.why;
    path = r.path;
  }
  return { path, why };
}

/**
 * The squares a straight finger move from point (x0, y0) to (x1, y1) passes, in order, in board
 * units where a square is 1 x 1. Only points well inside a square count (`inset` of its side kept
 * free at every edge), so a finger sliding along the line between two squares does not flicker
 * between them. Squares listed once per visit; off the board nothing.
 */
export function cellsOnMove(w, h, x0, y0, x1, y1, inset = 0.18) {
  const out = [];
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(d / 0.2));
  for (let k = 1; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    const y = y0 + ((y1 - y0) * k) / n;
    const i = cellAt(w, h, x, y, inset);
    if (i >= 0 && out[out.length - 1] !== i) out.push(i);
  }
  return out;
}

/** The square under a point in board units, or -1 (off the board, or in the edge margin `inset`). */
export function cellAt(w, h, x, y, inset = 0) {
  if (!(x >= 0 && y >= 0 && x < w && y < h)) return -1;
  const c = Math.floor(x);
  const r = Math.floor(y);
  const fx = x - c;
  const fy = y - r;
  if (fx < inset || fx > 1 - inset || fy < inset || fy > 1 - inset) return -1;
  return r * w + c;
}

/**
 * Where a finger that goes down at a square starts dragging from:
 *   on the track            -> the track is taken back to that square, the drag goes on from there
 *   next to the end, allowed -> one step on, the drag goes on from there
 *   elsewhere               -> no drag yet (it starts once the finger reaches the end of the track)
 * Returns { path, grabbed, why }.
 */
export function pressAt(p, path, j) {
  if (j < 0) return { path, grabbed: false, why: null };
  if (path.includes(j)) return { path: cutTo(path, j), grabbed: true, why: null };
  const why = whyNot(p, path, j);
  if (!why) return { path: [...path, j], grabbed: true, why: null };
  return { path, grabbed: false, why };
}

/**
 * Each square of the path with the sides its track leaves through: 'n', 'e', 's', 'w'.
 * The first and the last square have one side (a lone station 1 none).
 */
export function trackPieces(p, path) {
  const side = (a, b) => (b === a - p.w ? 'n' : b === a + p.w ? 's' : b === a + 1 ? 'e' : 'w');
  return path.map((i, k) => {
    const s = [];
    if (k > 0) s.push(side(i, path[k - 1]));
    if (k < path.length - 1) s.push(side(i, path[k + 1]));
    return { i, sides: s };
  });
}

// ---------- the railway as drawn (and ridden) ----------

const MID = { n: [0, -0.5], s: [0, 0.5], e: [0.5, 0], w: [-0.5, 0] };

/**
 * The centre line of the track through the path, in board units (a square is 1 x 1, square (r, c)
 * spans x c..c+1, y r..r+1): straight pieces and quarter circles through the middle of each
 * square's sides, from the middle of the first square to the middle of the last. Each segment is
 * { kind: 'line', x0, y0, x1, y1, len } or { kind: 'arc', cx, cy, r, a0, a1, x0, y0, x1, y1, len }
 * (angles in radians, a1 - a0 is a quarter turn either way).
 */
export function route(w, path) {
  if (path.length < 2) return [];
  const p = { w, h: Infinity };
  const pieces = trackPieces(p, path);
  const segs = [];
  pieces.forEach(({ i, sides }, k) => {
    const cx = (i % w) + 0.5;
    const cy = Math.floor(i / w) + 0.5;
    const at = (s) => [cx + MID[s][0], cy + MID[s][1]];
    if (k === 0) {
      const [x1, y1] = at(sides[0]);
      segs.push({ kind: 'line', x0: cx, y0: cy, x1, y1, len: 0.5 });
    } else if (k === pieces.length - 1) {
      const [x0, y0] = at(sides[0]);
      segs.push({ kind: 'line', x0, y0, x1: cx, y1: cy, len: 0.5 });
    } else {
      const [a, b] = sides;
      const [x0, y0] = at(a);
      const [x1, y1] = at(b);
      if (x0 === x1 || y0 === y1) segs.push({ kind: 'line', x0, y0, x1, y1, len: 1 });
      else {
        // the corner both sides touch is the circle's centre
        const ccx = MID[a][0] !== 0 ? x0 : x1;
        const ccy = MID[a][1] !== 0 ? y0 : y1;
        const a0 = Math.atan2(y0 - ccy, x0 - ccx);
        let a1 = Math.atan2(y1 - ccy, x1 - ccx);
        while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
        while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
        segs.push({ kind: 'arc', cx: ccx, cy: ccy, r: 0.5, a0, a1, x0, y0, x1, y1, len: Math.PI / 4 });
      }
    }
  });
  return segs;
}

/** The length of the whole track. */
export const routeLength = (segs) => segs.reduce((s, g) => s + g.len, 0);

/**
 * The point at distance `s` along the track (clamped to its ends) and the way it is heading there:
 * { x, y, dx, dy } with (dx, dy) a unit vector.
 */
export function pointAt(segs, s) {
  if (!segs.length) return null;
  let d = Math.max(0, s);
  for (let k = 0; k < segs.length; k++) {
    const g = segs[k];
    if (d <= g.len || k === segs.length - 1) {
      const f = Math.min(1, d / g.len);
      if (g.kind === 'line') {
        const len = Math.hypot(g.x1 - g.x0, g.y1 - g.y0) || 1;
        return { x: g.x0 + (g.x1 - g.x0) * f, y: g.y0 + (g.y1 - g.y0) * f, dx: (g.x1 - g.x0) / len, dy: (g.y1 - g.y0) / len };
      }
      const a = g.a0 + (g.a1 - g.a0) * f;
      const turn = Math.sign(g.a1 - g.a0);
      return { x: g.cx + g.r * Math.cos(a), y: g.cy + g.r * Math.sin(a), dx: -Math.sin(a) * turn, dy: Math.cos(a) * turn };
    }
    d -= g.len;
  }
  return null;
}
