// Treintje's drawings, all in code and all our own: the grass squares, the railway (a bed of
// gravel, wooden sleepers and two rails, straight or in a quarter curve), the station signs, the
// fences, the little train (a locomotive with two wagons, seen from the side) and the home tile.
// Presentation attributes only (no ids, url(#) or style attributes: the CSP blocks inline styles).
// Board units: a square is 100 x 100.
import { route } from './rules.js';

export const U = 100;
const GRASS = ['#dcefc9', '#d0e8bb'];
const BED = '#efe3c6';
const SLEEPER = '#a8743f';
const RAIL = '#5b6274';
const FENCE = '#8a5527';
const INK = '#28245c';
const ACC = '#2a8f88'; // the puzzles group's accent (style.css --bz-puzzles-acc)
const TINT = '#bfe6df';
const GAP = 0.15; // half the distance between the rails, in squares

const f = (v) => Math.round(v * U * 10) / 10;

/** The centre line as an SVG path (board units scaled by U). */
function centreLine(segs) {
  if (!segs.length) return '';
  let d = `M${f(segs[0].x0)} ${f(segs[0].y0)}`;
  for (const g of segs) {
    if (g.kind === 'line') d += `L${f(g.x1)} ${f(g.y1)}`;
    else d += `A${f(g.r)} ${f(g.r)} 0 0 ${g.a1 > g.a0 ? 1 : 0} ${f(g.x1)} ${f(g.y1)}`;
  }
  return d;
}

/** One rail: the centre line moved `off` squares to the left of the way it runs. */
function railLine(segs, off) {
  let d = '';
  for (const g of segs) {
    if (g.kind === 'line') {
      const len = Math.hypot(g.x1 - g.x0, g.y1 - g.y0) || 1;
      const nx = -(g.y1 - g.y0) / len;
      const ny = (g.x1 - g.x0) / len;
      d += `M${f(g.x0 + nx * off)} ${f(g.y0 + ny * off)}L${f(g.x1 + nx * off)} ${f(g.y1 + ny * off)}`;
    } else {
      // left of the way: towards the centre on a turn with a1 > a0 (clockwise on screen)
      const r = g.r + (g.a1 > g.a0 ? off : -off);
      const p0 = [g.cx + r * Math.cos(g.a0), g.cy + r * Math.sin(g.a0)];
      const p1 = [g.cx + r * Math.cos(g.a1), g.cy + r * Math.sin(g.a1)];
      d += `M${f(p0[0])} ${f(p0[1])}A${f(r)} ${f(r)} 0 0 ${g.a1 > g.a0 ? 1 : 0} ${f(p1[0])} ${f(p1[1])}`;
    }
  }
  return d;
}

/** Sleepers across the track, about three to a square. */
function sleepers(segs) {
  let d = '';
  for (const g of segs) {
    const n = Math.max(1, Math.round(g.len * 3));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      let x;
      let y;
      let nx;
      let ny;
      if (g.kind === 'line') {
        x = g.x0 + (g.x1 - g.x0) * t;
        y = g.y0 + (g.y1 - g.y0) * t;
        const len = Math.hypot(g.x1 - g.x0, g.y1 - g.y0) || 1;
        nx = -(g.y1 - g.y0) / len;
        ny = (g.x1 - g.x0) / len;
      } else {
        const a = g.a0 + (g.a1 - g.a0) * t;
        x = g.cx + g.r * Math.cos(a);
        y = g.cy + g.r * Math.sin(a);
        nx = Math.cos(a);
        ny = Math.sin(a);
      }
      const e = GAP + 0.08;
      d += `M${f(x - nx * e)} ${f(y - ny * e)}L${f(x + nx * e)} ${f(y + ny * e)}`;
    }
  }
  return d;
}

/** The railway along `path` (a list of squares) on a board `w` squares wide. */
export function trackSvg(w, path) {
  const segs = route(w, path);
  if (!segs.length) return '';
  const line = centreLine(segs);
  return (
    `<path d="${line}" fill="none" stroke="${BED}" stroke-width="${f(0.5)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${sleepers(segs)}" fill="none" stroke="${SLEEPER}" stroke-width="${f(0.085)}" stroke-linecap="round"/>` +
    `<path d="${railLine(segs, GAP)}${railLine(segs, -GAP)}" fill="none" stroke="${RAIL}" stroke-width="${f(0.055)}" stroke-linecap="round"/>`
  );
}

/** The grass squares (a soft chequer) and a frame. */
export function groundSvg(w, h) {
  let s = '';
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) s += `<rect x="${c * U}" y="${r * U}" width="${U}" height="${U}" fill="${GRASS[(r + c) % 2]}"/>`;
  return s + `<rect x="2" y="2" width="${w * U - 4}" height="${h * U - 4}" rx="14" fill="none" stroke="#9fc58a" stroke-width="4"/>`;
}

/** A fence between two neighbouring squares a and b: a little wooden fence on their shared side. */
export function fenceSvg(w, a, b) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const r = Math.floor(lo / w);
  const c = lo % w;
  let x0;
  let y0;
  let x1;
  let y1;
  if (hi === lo + 1) {
    x0 = x1 = (c + 1) * U;
    y0 = r * U + 8;
    y1 = (r + 1) * U - 8;
  } else {
    y0 = y1 = (r + 1) * U;
    x0 = c * U + 8;
    x1 = (c + 1) * U - 8;
  }
  const posts = [0, 0.5, 1].map((t) => `<circle cx="${x0 + (x1 - x0) * t}" cy="${y0 + (y1 - y0) * t}" r="8" fill="${FENCE}" stroke="#5e3612" stroke-width="3"/>`).join('');
  return `<g class="tj-fence"><path d="M${x0} ${y0}L${x1} ${y1}" stroke="#5e3612" stroke-width="16" stroke-linecap="round"/><path d="M${x0} ${y0}L${x1} ${y1}" stroke="${FENCE}" stroke-width="9" stroke-linecap="round"/>${posts}</g>`;
}

/**
 * A station sign on square i: a round board on a little post with its number. `state`: 'todo'
 * (white), 'next' (the one to reach now: a ring in the group's colour), 'done' (passed: the group's
 * tint). The first station is green, the last a golden end station.
 */
export function stationSvg(w, i, num, last, state) {
  const cx = (i % w) * U + U / 2;
  const cy = Math.floor(i / w) * U + U / 2;
  const fill = state === 'done' ? TINT : num === 1 ? '#c8ecbf' : num === last ? '#ffe28a' : '#ffffff';
  const ring = state === 'next' ? `<circle class="tj-next-ring" cx="${cx}" cy="${cy}" r="40" fill="none" stroke="${ACC}" stroke-width="6"/>` : '';
  const size = num >= 10 ? 30 : 36;
  return (
    `<g class="tj-station tj-${state}" data-num="${num}">${ring}` +
    `<circle cx="${cx}" cy="${cy}" r="28" fill="${fill}" stroke="${state === 'todo' ? '#7d779e' : ACC}" stroke-width="5"/>` +
    `<text class="tj-num" x="${cx}" y="${cy + size * 0.36}" font-size="${size}" text-anchor="middle" fill="${INK}">${num}</text></g>`
  );
}

/** The end of the track that is laid so far: a soft ring to drag on from. */
export function headSvg(w, i) {
  const cx = (i % w) * U + U / 2;
  const cy = Math.floor(i / w) * U + U / 2;
  return `<circle class="tj-head" cx="${cx}" cy="${cy}" r="44" fill="none" stroke="${ACC}" stroke-width="5" stroke-dasharray="12 9"/>`;
}

/** Every station of a puzzle for the path laid so far. */
export function stationsSvg(p, path, next) {
  const last = Math.max(...p.nums);
  const on = new Set(path);
  let s = '';
  p.nums.forEach((num, i) => {
    if (!num) return;
    const state = on.has(i) ? 'done' : num === next ? 'next' : 'todo';
    s += stationSvg(p.w, i, num, last, state);
  });
  return s;
}

// ---------- the little train (side view, about 90 x 70 units, wheels on y = 0, front to the right) ----------

const LOCO = `<g class="tj-loco">
  <rect x="-44" y="-62" width="34" height="46" rx="6" fill="#3a6fd8" stroke="${INK}" stroke-width="3"/>
  <rect x="-37" y="-55" width="20" height="17" rx="4" fill="#cfe8ff" stroke="${INK}" stroke-width="2.5"/>
  <rect x="-50" y="-68" width="46" height="10" rx="5" fill="#e4553f" stroke="${INK}" stroke-width="3"/>
  <rect x="-12" y="-44" width="50" height="28" rx="12" fill="#e4553f" stroke="${INK}" stroke-width="3"/>
  <rect x="14" y="-60" width="11" height="18" rx="3" fill="#3a3550" stroke="${INK}" stroke-width="2.5"/>
  <circle cx="2" cy="-44" r="6" fill="#ffd25e" stroke="${INK}" stroke-width="2.5"/>
  <circle cx="35" cy="-30" r="4" fill="#fff6c8" stroke="${INK}" stroke-width="2"/>
  <rect x="-48" y="-18" width="90" height="7" rx="3.5" fill="#3a3550"/>
  <circle cx="-30" cy="-7" r="9" fill="#3a3550" stroke="${INK}" stroke-width="2.5"/><circle cx="-30" cy="-7" r="3" fill="#c9c4e0"/>
  <circle cx="0" cy="-7" r="9" fill="#3a3550" stroke="${INK}" stroke-width="2.5"/><circle cx="0" cy="-7" r="3" fill="#c9c4e0"/>
  <circle cx="26" cy="-7" r="9" fill="#3a3550" stroke="${INK}" stroke-width="2.5"/><circle cx="26" cy="-7" r="3" fill="#c9c4e0"/>
  <g class="tj-puff"><circle cx="22" cy="-72" r="7" fill="#ffffff" opacity="0.9"/><circle cx="12" cy="-80" r="5" fill="#ffffff" opacity="0.8"/></g>
</g>`;

const wagon = (body, top) => `<g class="tj-wagon">
  <rect x="-34" y="-40" width="68" height="26" rx="7" fill="${body}" stroke="${INK}" stroke-width="3"/>
  <rect x="-28" y="-48" width="56" height="10" rx="5" fill="${top}" stroke="${INK}" stroke-width="2.5"/>
  <rect x="-38" y="-17" width="76" height="6" rx="3" fill="#3a3550"/>
  <circle cx="-20" cy="-7" r="8" fill="#3a3550" stroke="${INK}" stroke-width="2.5"/><circle cx="-20" cy="-7" r="2.6" fill="#c9c4e0"/>
  <circle cx="20" cy="-7" r="8" fill="#3a3550" stroke="${INK}" stroke-width="2.5"/><circle cx="20" cy="-7" r="2.6" fill="#c9c4e0"/>
</g>`;

/** The train's parts in order, front first: each an SVG group with its wheels on (0, 0). */
export const TRAIN = [LOCO, wagon('#ffc93c', '#ff8a3d'), wagon('#4cbf86', '#2a8f88')];
/** How far behind each other the parts ride, in squares. */
export const TRAIN_GAP = 0.9;

/** The train standing still, for the end card and the how-to card. */
export function trainSvg() {
  return `<svg viewBox="-150 -92 250 100" aria-hidden="true">
    <path d="M-150 -2H100" stroke="${RAIL}" stroke-width="4"/>
    <g transform="translate(-112 0)">${TRAIN[2]}</g><g transform="translate(-36 0)">${TRAIN[1]}</g><g transform="translate(48 0)">${TRAIN[0]}</g></svg>`;
}

// ---------- the tile and the menu cards ----------

/** A small board with a railway, its stations and maybe fences (the menu cards and the tile). */
export function miniBoardSvg(w, h, path, stations, fences = [], cls = 'tj-mini') {
  const p = { w, h, nums: new Array(w * h).fill(0) };
  stations.forEach((i, k) => (p.nums[i] = k + 1));
  let s = groundSvg(w, h) + trackSvg(w, path);
  for (const [a, b] of fences) s += fenceSvg(w, a, b);
  const last = stations.length;
  stations.forEach((i, k) => (s += stationSvg(w, i, k + 1, last, 'todo')));
  return `<svg class="${cls}" viewBox="0 0 ${w * U} ${h * U}" aria-hidden="true">${s}</svg>`;
}

/** The picture on each age card: a finished little railway of that age's kind. */
export function ageArt(age) {
  if (age === 'a3') return miniBoardSvg(3, 3, [0, 1, 2, 5, 4, 3, 6, 7, 8], [0, 4, 8]);
  if (age === 'a6') return miniBoardSvg(4, 4, [0, 4, 8, 12, 13, 9, 5, 1, 2, 3, 7, 6, 10, 14, 15, 11], [0, 9, 3, 14, 11]);
  return miniBoardSvg(4, 4, [0, 1, 2, 3, 7, 6, 5, 4, 8, 12, 13, 9, 10, 14, 15, 11], [0, 5, 11], [[9, 13], [6, 10]]);
}

/** The home tile: a curving railway on the grass with the little train on it. */
export function tileSvg() {
  const path = [6, 7, 8, 5, 4, 3, 0, 1, 2];
  let s = groundSvg(3, 3) + trackSvg(3, path);
  s += stationSvg(3, 6, 1, 3, 'done') + stationSvg(3, 2, 3, 3, 'done');
  s += `<g transform="translate(150 172) scale(-0.95 0.95)">${TRAIN[0]}</g>`;
  return `<svg class="tj-tile-svg" viewBox="0 0 300 300" aria-hidden="true">${s}</svg>`;
}

