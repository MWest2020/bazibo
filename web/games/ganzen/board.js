// Where the squares sit: a winding path of 64 stepping stones (the start, 0, and the squares 1-63)
// over a landscape. The path is a rounded spiral, like the classic board: it starts in the
// bottom-left corner, goes round along the edge and inwards, and ends at 63 beside the pond in the
// middle. The stones keep clear space between them, also between one lap and the next. Pure (no
// screen), so it can be tested; the drawing is in scene.js and ganzen.js.

export const STONES = 64; // the start (0) and the squares 1..63
export const STONE = 0.74; // a stone's diameter, in steps (the rest is grass between the stones)
const LAP = 1.08; // the distance between one lap of the spiral and the next, in steps
const MARGIN = 0.66; // from the edge of the board to the middle of the outer lap, in steps
const POND = 1.7; // the free middle (the pond) is at least this many laps wide and high

/** The corners of a square spiral inside [l, r] × [t, b], `q` apart, ending when a leg gets too short. */
function corners(l, t, r, b, q) {
  const pts = [[l, b]];
  for (let guard = 0; guard < 200; guard++) {
    if (r - l < q * 0.5) break;
    pts.push([r, b]);
    b -= q;
    if (b - t < q * 0.5) break;
    pts.push([r, t]);
    r -= q;
    if (r - l < q * 0.5) break;
    pts.push([l, t]);
    t += q;
    if (b - t < q * 0.5) break;
    pts.push([l, b]);
    l += q;
  }
  return pts;
}

/** The spiral as a dense list of points [x, y, s] (s = length so far), its corners rounded. */
function smooth(pts, q) {
  const out = [];
  const add = (x, y) => {
    const last = out[out.length - 1];
    const s = last ? last[2] + Math.hypot(x - last[0], y - last[1]) : 0;
    if (!last || s > last[2] + 1e-9) out.push([x, y, s]);
  };
  add(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i === pts.length - 1) {
      add(x, y);
      break;
    }
    const [px, py] = pts[i - 1];
    const [nx, ny] = pts[i + 1];
    const lin = Math.hypot(x - px, y - py);
    const lout = Math.hypot(nx - x, ny - y);
    // the outer laps turn wide (room for a tree in the corner), the inner ones tighter
    const lap = Math.floor((i - 1) / 4);
    const want = Math.max(0.8 * q, (1.9 - lap) * q);
    const rad = Math.min(want, lin / 2, lout / 2);
    const ux = (x - px) / lin;
    const uy = (y - py) / lin;
    const vx = (nx - x) / lout;
    const vy = (ny - y) / lout;
    const ax = x - ux * rad;
    const ay = y - uy * rad;
    add(ax, ay);
    // a quarter circle from (ax, ay) to (x + v*rad), around the centre (ax + v*rad)
    const cx = ax + vx * rad;
    const cy = ay + vy * rad;
    const a0 = Math.atan2(ay - cy, ax - cx);
    const turn = ux * vy - uy * vx > 0 ? 1 : -1;
    for (let k = 1; k <= 12; k++) {
      const a = a0 + (turn * (Math.PI / 2) * k) / 12;
      add(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
  }
  return out;
}

/** The point at length `s` along a dense path. */
function at(path, s) {
  let lo = 0;
  let hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid][2] <= s) lo = mid;
    else hi = mid;
  }
  const [x0, y0, s0] = path[lo];
  const [x1, y1, s1] = path[hi];
  const f = s1 > s0 ? Math.min(1, Math.max(0, (s - s0) / (s1 - s0))) : 0;
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
}

/** The spiral for one step size `p` in a `w`×`h` board, or null when 64 stones do not fit. */
function attempt(w, h, p) {
  const q = p * LAP;
  const m = p * MARGIN;
  const pts = corners(m, m, w - m, h - m, q);
  const path = smooth(pts, q);
  const need = (STONES - 1) * p;
  const total = path[path.length - 1][2];
  if (total < need) return null;
  const stones = [];
  for (let k = 0; k < STONES; k++) stones.push(at(path, k * p));
  return { p, q, path, stones, need };
}

/** The largest free rectangle in the middle, clear of every stone by `clear`. */
function pondBox(stones, w, h, clear) {
  // start from the centre of the last stones and grow while no stone is inside
  const last = stones.slice(-20);
  let cx = last.reduce((a, s) => a + s[0], 0) / last.length;
  let cy = last.reduce((a, s) => a + s[1], 0) / last.length;
  const hit = (l, t, r, b) => stones.some(([x, y]) => x > l - clear && x < r + clear && y > t - clear && y < b + clear);
  let l = cx;
  let r = cx;
  let t = cy;
  let b = cy;
  if (hit(l, t, r, b)) return null;
  const step = Math.max(1, Math.min(w, h) / 120);
  for (let grow = true, guard = 0; grow && guard < 2000; guard++) {
    grow = false;
    if (!hit(l - step, t, r, b)) (l -= step), (grow = true);
    if (!hit(l, t, r + step, b)) (r += step), (grow = true);
    if (!hit(l, t - step, r, b)) (t -= step), (grow = true);
    if (!hit(l, t, r, b + step)) (b += step), (grow = true);
  }
  cx = (l + r) / 2;
  cy = (t + b) / 2;
  return { l, t, r, b, cx, cy };
}

/**
 * The board for a space of `w`×`h` px: the biggest step that fits 64 stones on the spiral and
 * leaves a pond in the middle, no more than `maxStep`. Returns { w, h, step, size (a stone's
 * diameter), stones: [[x, y], ...] (centres, 0..63), trail: [[x, y], ...] (the path from the start
 * to 63, for drawing), pond: { l, t, r, b, cx, cy } }.
 */
export function boardLayout(w, h, maxStep = 72) {
  w = Math.max(120, w);
  h = Math.max(120, h);
  // a very long, thin space makes long thin laps: keep the board between 3:5 and 5:3
  w = Math.min(w, Math.floor(h * 1.67));
  h = Math.min(h, Math.floor(w * 1.67));
  let lo = 4;
  let hi = Math.min(w, h) / 4;
  let best = null;
  for (let i = 0; i < 18; i++) {
    const p = (lo + hi) / 2;
    const a = attempt(w, h, p);
    const pond = a && pondBox(a.stones, w, h, p * 0.62);
    if (a && pond && pond.r - pond.l >= POND * a.q * 0.62 && pond.b - pond.t >= POND * a.q * 0.62) {
      best = { a, pond };
      lo = p;
    } else hi = p;
  }
  if (!best) {
    // too small for a pond: stones only (never happens at phone sizes)
    for (let p = Math.min(w, h) / 4; p > 2; p *= 0.97) {
      const a = attempt(w, h, p);
      if (a) {
        best = { a, pond: null };
        break;
      }
    }
  }
  let { a, pond } = best;
  if (a.p > maxStep) {
    // a big screen: keep the steps at most maxStep and make the board smaller instead
    const k = maxStep / a.p;
    return boardLayout(Math.floor(w * k), Math.floor(h * k), Infinity);
  }
  const trail = a.path.filter((pt) => pt[2] <= a.need).map(([x, y]) => [x, y]);
  trail.push(a.stones[STONES - 1].slice());
  return { w, h, step: a.p, size: a.p * STONE, stones: a.stones, trail, pond };
}

/** Count yourself: the next square to tap after `done` taps along `path`, or -1 when all are done. */
export const nextTap = (path, done) => (done < path.length ? path[done] : -1);
