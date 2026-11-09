// A small rasteriser for the colouring pages' paths (no canvas needed, so it runs in node too):
// turns each region's path into polygons and fills a grid in drawing order, so the grid says which
// region is on top at every point. Used to keep mandalas free of parts too small to tap, and by the
// tests to check that. Paths use absolute M, L, H, V, Q, T, C, A and Z.

const NUM = /[MLHVQTCAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi;

/** A path as a list of closed polygons [[x, y], ...]; curves and arcs are sampled. */
export function flatten(d, tol = 0.6) {
  const tok = String(d).match(NUM) || [];
  const polys = [];
  let poly = null;
  let x = 0;
  let y = 0;
  let qx = null; // the last quadratic control point, for T
  let qy = null;
  let i = 0;
  let cmd = '';
  const num = () => Number(tok[i++]);
  const steps = (len) => Math.max(2, Math.min(64, Math.ceil(len / tol)));
  while (i < tok.length) {
    if (/[a-z]/i.test(tok[i])) cmd = tok[i++].toUpperCase();
    if (cmd === 'Z') {
      if (poly && poly.length > 2) polys.push(poly);
      poly = null;
      qx = qy = null;
      continue;
    }
    if (cmd === 'M') {
      if (poly && poly.length > 2) polys.push(poly);
      x = num();
      y = num();
      poly = [[x, y]];
      cmd = 'L'; // extra pairs after M are lines
      qx = qy = null;
      continue;
    }
    if (!poly) poly = [[x, y]];
    if (cmd === 'L' || cmd === 'H' || cmd === 'V') {
      if (cmd !== 'V') x = num();
      if (cmd !== 'H') y = num();
      poly.push([x, y]);
      qx = qy = null;
    } else if (cmd === 'Q' || cmd === 'T') {
      let cx;
      let cy;
      if (cmd === 'Q') {
        cx = num();
        cy = num();
      } else {
        cx = qx == null ? x : 2 * x - qx;
        cy = qy == null ? y : 2 * y - qy;
      }
      const ex = num();
      const ey = num();
      const n = steps(Math.hypot(cx - x, cy - y) + Math.hypot(ex - cx, ey - cy));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        poly.push([u * u * x + 2 * u * t * cx + t * t * ex, u * u * y + 2 * u * t * cy + t * t * ey]);
      }
      qx = cx;
      qy = cy;
      x = ex;
      y = ey;
    } else if (cmd === 'C') {
      const c1x = num();
      const c1y = num();
      const c2x = num();
      const c2y = num();
      const ex = num();
      const ey = num();
      const n = steps(Math.hypot(c1x - x, c1y - y) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(ex - c2x, ey - c2y));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        poly.push([
          u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
          u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey,
        ]);
      }
      x = ex;
      y = ey;
      qx = qy = null;
    } else if (cmd === 'A') {
      let r = Math.abs(num());
      num(); // the second radius: our arcs are circular
      num(); // rotation
      const large = num() !== 0;
      const sweep = num() !== 0;
      const ex = num();
      const ey = num();
      // endpoint to centre (SVG implementation notes, F.6.5) for a circle
      const hx = (x - ex) / 2;
      const hy = (y - ey) / 2;
      const d2 = hx * hx + hy * hy;
      if (r * r < d2) r = Math.sqrt(d2);
      const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (r * r - d2) / (d2 || 1)));
      const cx = k * hy + (x + ex) / 2;
      const cy = -k * hx + (y + ey) / 2;
      const a1 = Math.atan2(y - cy, x - cx);
      let da = Math.atan2(ey - cy, ex - cx) - a1;
      if (sweep && da < 0) da += 2 * Math.PI;
      if (!sweep && da > 0) da -= 2 * Math.PI;
      if (Math.abs(da) < 1e-9 && d2 < 1e-12) da = sweep ? 2 * Math.PI : -2 * Math.PI;
      const n = steps(Math.abs(da) * r);
      for (let j = 1; j <= n; j++) poly.push([cx + r * Math.cos(a1 + (da * j) / n), cy + r * Math.sin(a1 + (da * j) / n)]);
      x = ex;
      y = ey;
      qx = qy = null;
    } else {
      i++; // something we do not draw with: skip it
    }
  }
  if (poly && poly.length > 2) polys.push(poly);
  return polys;
}

/**
 * Fill the regions, in order, into a grid over the box (x0, y0, size) with `res` units per cell.
 * Returns { top: Int32Array (region index on top, -1 for none), n (cells per side), cell (res) }.
 */
export function rasterize(regions, { x0 = -100, y0 = -100, size = 200, res = 0.5 } = {}) {
  const n = Math.round(size / res);
  const top = new Int32Array(n * n).fill(-1);
  regions.forEach((r, idx) => fillPath(r.d, (row, a, b) => top.fill(idx, row * n + a, row * n + b), { x0, y0, n, res }));
  return { top, n, cell: res };
}

/** The cells a single path covers, as a Uint8Array mask of the same grid. */
export function maskOf(d, { x0 = -100, y0 = -100, size = 200, res = 0.5 } = {}) {
  const n = Math.round(size / res);
  const mask = new Uint8Array(n * n);
  fillPath(d, (row, a, b) => mask.fill(1, row * n + a, row * n + b), { x0, y0, n, res });
  return mask;
}

/** Scanline fill (even-odd) of a path; span(row, from, to) per run of cells whose centres are inside. */
function fillPath(d, span, { x0, y0, n, res }) {
  const rows = new Map();
  for (const poly of flatten(d)) {
    for (let k = 0; k < poly.length; k++) {
      const [ax, ay] = poly[k];
      const [bx, by] = poly[(k + 1) % poly.length];
      if (ay === by) continue;
      const lo = Math.min(ay, by);
      const hi = Math.max(ay, by);
      // rows whose centre line y0 + (row + .5) * res lies in [lo, hi)
      const r0 = Math.max(0, Math.ceil((lo - y0) / res - 0.5));
      const r1 = Math.min(n - 1, Math.ceil((hi - y0) / res - 0.5) - 1);
      for (let row = r0; row <= r1; row++) {
        const yc = y0 + (row + 0.5) * res;
        const xc = ax + ((yc - ay) * (bx - ax)) / (by - ay);
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push(xc);
      }
    }
  }
  for (const [row, xs] of rows) {
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil((xs[k] - x0) / res - 0.5));
      const b = Math.min(n, Math.ceil((xs[k + 1] - x0) / res - 0.5));
      if (b > a) span(row, a, b);
    }
  }
}

/** How much of each region shows (area in square units), given the drawing order. */
export function visibleAreas(regions, opts = {}) {
  const { top, cell } = rasterize(regions, opts);
  const count = new Float64Array(regions.length);
  for (let c = 0; c < top.length; c++) if (top[c] >= 0) count[top[c]]++;
  return Array.from(count, (v) => v * cell * cell);
}
