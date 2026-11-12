// A drawing as data: a list of strokes and stamps on a square page of GRID × GRID units, and the
// short text it is saved as (storage.js saveDrawing). Pure, tested in tests/tekenen.test.js.
//
//   stroke: { k: 's', c: colour, z: size, a: mirror lines, pts: [[x, y], ...] }
//   stamp:  { k: 'p', s: stamp, c: colour, z: size, a: mirror lines, x, y }
//   clear:  { k: 'c' }   (only while drawing, so undo can bring the page back; never saved)
//
// Saved as text: items joined by '.', every number in the URL-safe base64 alphabet, a coordinate
// in two characters (0-4095):
//   's' colour size lines (x y)*      'p' stamp colour size lines x y
// That is about 4 characters per point. The text is checked against DRAWING_RE and capped at
// DRAWING_MAX characters; a drawing that would not fit even with coarser strokes is "full".
import { DRAWING_MAX } from '../../js/storage.js';
import { PALETTE, WHITE } from '../kleuren/art.js';
import { AXES } from './symmetry.js';

export const GRID = 4096;
/** Brush widths in grid units: thin, medium, thick (about 3, 6 and 12 px on a 360 px page). */
export const SIZES = Object.freeze([30, 66, 140]);
/** Stamp sizes (the width of a stamp) for the same three choices. */
export const STAMP_SIZES = Object.freeze([340, 540, 820]);
export const STAMPS = Object.freeze(['star', 'heart', 'sun', 'flower', 'puppy']);
export const ERASER = WHITE; // the eraser paints the white of the page
/** The free version keeps this many drawings; the full version up to MAX_DRAWINGS. */
export const FREE_DRAWINGS = 3;
export const MAX_DRAWINGS = 100;
/** How much a finished stroke is smoothed (grid units); invisible, but far fewer points. */
export const STROKE_TOLERANCE = 4;
/** Coarser and coarser, until a drawing fits DRAWING_MAX (see pack). */
export const TOLERANCES = Object.freeze([0, 8, 16, 32]);

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const VAL = Object.fromEntries([...B64].map((ch, i) => [ch, i]));
const LINES = new Set([0, ...AXES]);

/** A grid coordinate: a whole number from 0 to GRID - 1. */
export const clampCoord = (v) => Math.min(GRID - 1, Math.max(0, Math.round(Number(v) || 0)));

const num = (v) => {
  const n = clampCoord(v);
  return B64[n >> 6] + B64[n & 63];
};
const read2 = (s, i) => {
  const hi = VAL[s[i]];
  const lo = VAL[s[i + 1]];
  return hi === undefined || lo === undefined ? null : hi * 64 + lo;
};

const okColour = (c) => Number.isInteger(c) && c >= 0 && c < PALETTE.length;
const okSize = (z) => Number.isInteger(z) && z >= 0 && z < SIZES.length;

/** The items after the last "clear": what is on the page. */
export function visible(items) {
  let from = 0;
  items.forEach((it, i) => {
    if (it.k === 'c') from = i + 1;
  });
  return items.slice(from);
}

function encodeItem(it) {
  if (it.k === 'p') return `p${B64[it.s]}${B64[it.c]}${B64[it.z]}${B64[it.a]}${num(it.x)}${num(it.y)}`;
  return `s${B64[it.c]}${B64[it.z]}${B64[it.a]}${it.pts.map(([x, y]) => num(x) + num(y)).join('')}`;
}

/** The text for a list of items (a "clear" and everything before it are left out). */
export function encode(items) {
  return visible(items)
    .filter((it) => it.k === 's' || it.k === 'p')
    .map(encodeItem)
    .join('.');
}

/** Items from a saved text. Never throws; a damaged item is skipped, the rest is kept. */
export function decode(text) {
  const out = [];
  if (typeof text !== 'string' || !text) return out;
  for (const part of text.slice(0, DRAWING_MAX).split('.')) {
    if (part[0] === 'p' && part.length === 9) {
      const [s, c, z, a] = [VAL[part[1]], VAL[part[2]], VAL[part[3]], VAL[part[4]]];
      const x = read2(part, 5);
      const y = read2(part, 7);
      if (s < STAMPS.length && okColour(c) && okSize(z) && LINES.has(a) && x !== null && y !== null) out.push({ k: 'p', s, c, z, a, x, y });
    } else if (part[0] === 's' && part.length >= 8 && (part.length - 4) % 4 === 0) {
      const [c, z, a] = [VAL[part[1]], VAL[part[2]], VAL[part[3]]];
      if (!okColour(c) || !okSize(z) || !LINES.has(a)) continue;
      const pts = [];
      for (let i = 4; i < part.length; i += 4) {
        const x = read2(part, i);
        const y = read2(part, i + 2);
        if (x === null || y === null) {
          pts.length = 0;
          break;
        }
        pts.push([x, y]);
      }
      if (pts.length) out.push({ k: 's', c, z, a, pts });
    }
  }
  return out;
}

function lineDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Fewer points for the same line (Ramer-Douglas-Peucker): no point moves more than `tol` grid units
 * from the line that is kept. The first and last points always stay; repeated points go.
 */
export function simplify(pts, tol = STROKE_TOLERANCE) {
  const dedup = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  if (dedup.length <= 2 || tol <= 0) return dedup;
  const keep = new Uint8Array(dedup.length);
  keep[0] = 1;
  keep[dedup.length - 1] = 1;
  const stack = [[0, dedup.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let worst = -1;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = lineDist(dedup[k], dedup[i], dedup[j]);
      if (d > worst) {
        worst = d;
        at = k;
      }
    }
    if (at > 0 && worst > tol) {
      keep[at] = 1;
      stack.push([i, at], [at, j]);
    }
  }
  return dedup.filter((_, i) => keep[i]);
}

/**
 * The text to save, at most `max` characters: as drawn if it fits, else with coarser strokes
 * (TOLERANCES). null when even the coarsest does not fit: the page is full.
 */
export function pack(items, max = DRAWING_MAX) {
  const vis = visible(items);
  for (const tol of TOLERANCES) {
    const text = encode(tol ? vis.map((it) => (it.k === 's' ? { ...it, pts: simplify(it.pts, tol) } : it)) : vis);
    if (text.length <= max) return text;
  }
  return null;
}

/**
 * May this drawing be kept? A drawing that is already in "my drawings" always; a new one while
 * there is room: FREE_DRAWINGS in the free version, MAX_DRAWINGS in the full version.
 */
export function mayKeep({ owned, count, saved }) {
  if (saved) return true;
  return count < (owned ? MAX_DRAWINGS : FREE_DRAWINGS);
}

/** A new id for a drawing (time first, so ids sort roughly by age). */
export function newId(now = Date.now(), rnd = Math.random()) {
  return `d${Math.floor(now).toString(36)}${Math.floor(rnd * 1296).toString(36).padStart(2, '0')}`;
}
