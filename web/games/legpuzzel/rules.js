// Legpuzzel's rules and geometry, pure so they can be tested without a screen.
//   - a picture is cut into cols × rows square pieces with round tabs (`makeEdges`, `piecePath`)
//   - the pieces lie scattered on a tray next to the board (`scatter`); the child drags them
//   - a piece dropped near its own place snaps in and stays there (`snaps`); no turning, and a
//     piece never snaps to another piece's place
//   - when every piece is in, the puzzle is done
// Units: `s` is the side of a piece's square; a piece's drawing is (s + 2m) wide, with room `m`
// (`margin`) on every side for the tabs that stick out.

// `age`: from what age a size is about right. Mark (17 Nov 2026, issue #45): his four-year-old laid
// the 30 pieces then marked 9+ with ease, so the scale moved down and 48 and 60 pieces came in.
export const SIZES = Object.freeze({
  p4: Object.freeze({ cols: 2, rows: 2, age: 2 }),
  p6: Object.freeze({ cols: 3, rows: 2, age: 2 }),
  p9: Object.freeze({ cols: 3, rows: 3, age: 3 }),
  p12: Object.freeze({ cols: 4, rows: 3, age: 3 }),
  p20: Object.freeze({ cols: 5, rows: 4, age: 4 }),
  p30: Object.freeze({ cols: 6, rows: 5, age: 5 }),
  p48: Object.freeze({ cols: 8, rows: 6, age: 7 }),
  p60: Object.freeze({ cols: 10, rows: 6, age: 9 }),
});
export const SIZE_IDS = Object.freeze(Object.keys(SIZES));
export const piecesOf = (size) => SIZES[size].cols * SIZES[size].rows;

export const TAB = 0.3; // how far a tab sticks out, in pieces
export const margin = (s) => Math.ceil(s * (TAB + 0.02));
export const SNAP = 0.4; // how near (in pieces) a drop must be to its place to snap in

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Which way every inner edge's tab points: h[r][c] for the edge under piece (c, r) (+1: the tab
 * sticks down out of it), v[r][c] for the edge right of it (+1: the tab sticks out to the right).
 */
export function makeEdges(cols, rows, rand = Math.random) {
  const sign = () => (rand() < 0.5 ? -1 : 1);
  return {
    h: Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, sign)),
    v: Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, sign)),
  };
}

/** The four sides of piece (c, r): 0 straight (the border), +1 a tab out, -1 a hole in. */
export function sidesOf(edges, cols, rows, c, r) {
  return {
    top: r === 0 ? 0 : -edges.h[r - 1][c],
    right: c === cols - 1 ? 0 : edges.v[r][c],
    bottom: r === rows - 1 ? 0 : edges.h[r][c],
    left: c === 0 ? 0 : -edges.v[r][c - 1],
  };
}

// one side, as points along it (u: 0-1 along, v: outwards), cubic segments after a line in
const TAB_CURVE = [
  [0.34, 0],
  [[0.4, 0], [0.42, 0.05], [0.38, 0.12]],
  [[0.32, 0.22], [0.4, 0.3], [0.5, 0.3]],
  [[0.6, 0.3], [0.68, 0.22], [0.62, 0.12]],
  [[0.58, 0.05], [0.6, 0], [0.66, 0]],
];
const f = (x) => Math.round(x * 100) / 100;

/**
 * The outline of a piece as an SVG path (also for a canvas Path2D), in the piece's own drawing:
 * its square is at (m, m) to (m + s, m + s). Clockwise: top, right, bottom, left.
 */
export function piecePath(sides, s, m = margin(s)) {
  const corners = [
    [m, m],
    [m + s, m],
    [m + s, m + s],
    [m, m + s],
  ];
  const out = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const kinds = [sides.top, sides.right, sides.bottom, sides.left];
  let d = `M${f(m)} ${f(m)}`;
  for (let k = 0; k < 4; k++) {
    const [x0, y0] = corners[k];
    const [x1, y1] = corners[(k + 1) % 4];
    const ux = (x1 - x0) / s;
    const uy = (y1 - y0) / s;
    const [nx, ny] = out[k];
    const at = (u, v) => `${f(x0 + ux * u * s + nx * v * s * kinds[k])} ${f(y0 + uy * u * s + ny * v * s * kinds[k])}`;
    if (kinds[k]) {
      d += `L${at(...TAB_CURVE[0])}`;
      for (const seg of TAB_CURVE.slice(1)) d += `C${seg.map((p) => at(...p)).join(' ')}`;
    }
    d += `L${f(x1)} ${f(y1)}`;
  }
  return `${d}Z`;
}

/**
 * Where the board and the tray go on a stage of w × h px, and how big a piece is. Upright the tray
 * is under the board, sideways beside it. The tray must hold the pieces with at most a little
 * overlap; the board takes what is left. Returns { s, m, board: {x, y, w, h}, tray: {x, y, w, h}, side }.
 */
export function layout(w, h, cols, rows, { gap = 12, maxPiece = 150 } = {}) {
  const side = w > h * 1.15;
  const n = cols * rows;
  let best = null;
  for (let s = Math.min(maxPiece, Math.floor(side ? h / rows : w / cols)); s >= 16; s--) {
    const m = margin(s);
    const bw = cols * s;
    const bh = rows * s;
    const tray = side ? { x: bw + gap, y: 0, w: w - bw - gap, h } : { x: 0, y: bh + gap, w, h: h - bh - gap };
    if (bw > w || bh > h || tray.w < s + 2 * m || tray.h < s + 2 * m) continue;
    // how many pieces fit side by side on the tray, a piece's square apart (tabs may overlap)
    const fit = Math.floor((tray.w - 2 * m) / s) * Math.floor((tray.h - 2 * m) / s);
    best = { s, m, side, board: { x: 0, y: 0, w: bw, h: bh }, tray };
    if (fit >= n * 0.75) break;
  }
  if (!best) return null;
  // centre the board and tray together on the stage
  const { s, board, tray } = best;
  if (side) {
    const used = board.w + gap + Math.min(tray.w, Math.ceil(Math.sqrt(n * 1.4)) * s + 2 * best.m);
    const dx = Math.max(0, (w - used) / 2);
    board.x += dx;
    board.y = Math.max(0, (h - board.h) / 2);
    tray.x += dx;
    tray.w = Math.min(tray.w, w - tray.x);
  } else {
    board.x = (w - board.w) / 2;
  }
  return { ...best, s, board, tray };
}

/**
 * Where each loose piece lies at the start: spread over the tray on a jittered grid, in a shuffled
 * order, every piece's drawing (with its tabs) inside the tray. Returns top-left corners of the
 * drawings, one per piece.
 */
export function scatter(count, tray, s, m, rand = Math.random) {
  const size = s + 2 * m;
  const cols = Math.max(1, Math.floor((tray.w - 2 * m) / s));
  const rows = Math.max(1, Math.ceil(count / cols));
  const stepX = cols > 1 ? (tray.w - size) / (cols - 1) : 0;
  const stepY = rows > 1 ? (tray.h - size) / (rows - 1) : 0;
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const out = new Array(count);
  order.forEach((piece, k) => {
    const gx = k % cols;
    const gy = Math.floor(k / cols);
    const jx = (rand() - 0.5) * Math.min(stepX, s) * 0.3;
    const jy = (rand() - 0.5) * Math.min(stepY || s, s) * 0.3;
    const x = Math.min(Math.max(tray.x + gx * stepX + (cols > 1 ? jx : (tray.w - size) / 2), tray.x), tray.x + tray.w - size);
    const y = Math.min(Math.max(tray.y + gy * stepY + jy, tray.y), tray.y + tray.h - size);
    out[piece] = { x, y };
  });
  return out;
}

/** The top-left corner of piece i's drawing when it is in its place on the board. */
export function home(i, cols, board, s, m) {
  return { x: board.x + (i % cols) * s - m, y: board.y + Math.floor(i / cols) * s - m };
}

/** Is the puzzle done: every piece in its place? */
export const isComplete = (placed) => placed.length > 0 && placed.every(Boolean);

/**
 * After the stage changed size (a phone turned, a browser toolbar sliding in), where every piece
 * goes: placed pieces to their place on the new board; loose pieces stay where the child left them,
 * only moved back inside the stage, unless the pieces changed size (`resized`): then they are
 * spread on the tray again (`spread`). `w`, `h`: the stage; returns the new top-left corners.
 */
export function rearrange({ pos, placed, cols, board, s, m, w, h, resized, spread }) {
  const size = s + 2 * m;
  return placed.map((done, i) => {
    if (done) return home(i, cols, board, s, m);
    if (resized || !pos?.[i]) return spread[i];
    return { x: Math.min(Math.max(pos[i].x, 0), Math.max(0, w - size)), y: Math.min(Math.max(pos[i].y, 0), Math.max(0, h - size)) };
  });
}

// The magnifier (issue #45). With 48 or 60 pieces the board on a phone gets pieces of 30-45 px; a
// child of 7-9 can drag them, but sees little of the picture on them. Then the HUD shows a
// magnifier: the whole stage (board and tray together) is drawn ZOOM_TARGET px a piece and the
// child moves the view with a finger on an empty spot, or by holding a piece near the edge. The
// geometry stays the same: the zoom is only a view on it.
export const ZOOM_FROM = 56; // a piece's square smaller than this: the magnifier is offered
export const ZOOM_TARGET = 66; // what a square becomes with the magnifier on
export const ZOOM_MAX = 2.5;

/** How far the magnifier enlarges for pieces of `s` px: 1 means no magnifier. */
export const zoomFor = (s) => (s >= ZOOM_FROM ? 1 : Math.min(ZOOM_MAX, Math.max(1.4, ZOOM_TARGET / s)));

/**
 * Keep a zoomed view on the stage: the view (`w` × `h`) shows the stage drawn `z` times bigger,
 * moved by `pan` ({x, y}, px, never positive); the stage's edges never come inside the view.
 */
export function clampPan(pan, w, h, z) {
  return { x: Math.min(0, Math.max(w - w * z, pan.x)), y: Math.min(0, Math.max(h - h * z, pan.y)) };
}

/**
 * Zooming in or out around a point of the view (cx, cy): the stage point under it stays put.
 * Returns the new pan.
 */
export function zoomAround(pan, z0, z1, cx, cy, w, h) {
  const wx = (cx - pan.x) / z0;
  const wy = (cy - pan.y) / z0;
  return clampPan({ x: cx - wx * z1, y: cy - wy * z1 }, w, h, z1);
}

/** Does a piece dropped with its drawing at (x, y) snap into its place at `at`? */
export const snaps = (x, y, at, s) => Math.hypot(x - at.x, y - at.y) <= s * SNAP;
