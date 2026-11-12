// Drawing the items of drawing.js on a canvas: the big page, the thumbnails in "my drawings" and
// the home tile all use drawItems. Strokes are smoothed with curves through the midpoints; every
// item is drawn once per copy of its mirror group (symmetry.js). Stamps are vectors in code, in a
// box of -50..50 around their middle, filled with the chosen colour and outlined in ink.
import { PALETTE } from '../kleuren/art.js';
import { INK } from '../kleuren/pictures.js';
import { GRID, SIZES, STAMP_SIZES, STAMPS, visible } from './drawing.js';
import { transforms } from './symmetry.js';

const HALF = GRID / 2;
const CORNER = 100; // grid units (about 9 px on a 360 px page)

// ---------- stamps ----------

/** Mix a colour #rrggbb with another (t = 0: the first, 1: the second). */
export function mix(a, b, t) {
  const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0')).join('')}`;
}

const starPath = (() => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 21 : 48;
    const t = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(r * Math.cos(t)).toFixed(1)} ${(r * Math.sin(t) + 3).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
})();
const HEART = 'M0 42C-26 24-48 6-46-16C-44-38-14-44 0-22C14-44 44-38 46-16C48 6 26 24 0 42Z';
// floppy ears that hang down beside the face (a puppy, never a cat: no pointed ears)
const EAR_L = 'M-20-26C-38-34-52-20-50 2C-48 20-40 30-31 26C-24 22-24 8-22-6Z';
const EAR_R = 'M20-26C38-34 52-20 50 2C48 20 40 30 31 26C24 22 24 8 22-6Z';

let paths = null;
function P(d) {
  return new Path2D(d);
}
function stampPaths() {
  if (paths) return paths;
  const circle = (x, y, r) => {
    const p = new Path2D();
    p.arc(x, y, r, 0, Math.PI * 2);
    return p;
  };
  const petals = new Path2D();
  for (let i = 0; i < 5; i++) {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    petals.addPath(circle(27 * Math.cos(t), 27 * Math.sin(t), 19));
  }
  paths = { star: P(starPath), heart: P(HEART), earL: P(EAR_L), earR: P(EAR_R), circle, petals };
  return paths;
}

function eyes(ctx, y, gap, r) {
  for (const x of [-gap, gap]) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y - r * 0.38, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
}

function smile(ctx, y, w) {
  ctx.beginPath();
  ctx.moveTo(-w, y);
  ctx.quadraticCurveTo(0, y + w * 0.9, w, y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.stroke();
}

/** One stamp in its -50..50 box, in colour `col`. */
export function drawStamp(ctx, kind, col) {
  const p = stampPaths();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const fillOut = (path, fill) => {
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.stroke(path);
  };
  if (kind === 'star') fillOut(p.star, col);
  else if (kind === 'heart') fillOut(p.heart, col);
  else if (kind === 'sun') {
    for (let i = 0; i < 8; i++) {
      const t = (i * Math.PI) / 4;
      const ray = new Path2D();
      ray.moveTo(31 * Math.cos(t), 31 * Math.sin(t));
      ray.lineTo(46 * Math.cos(t), 46 * Math.sin(t));
      ctx.lineWidth = 10;
      ctx.strokeStyle = INK;
      ctx.stroke(ray);
      ctx.lineWidth = 5;
      ctx.strokeStyle = col;
      ctx.stroke(ray);
    }
    fillOut(p.circle(0, 0, 26), col);
    eyes(ctx, -5, 9, 3.6);
    smile(ctx, 7, 9);
  } else if (kind === 'flower') {
    fillOut(p.petals, col);
    fillOut(p.circle(0, 0, 15), col === PALETTE[2] ? PALETTE[1] : PALETTE[2]);
  } else if (kind === 'puppy') {
    const ear = mix(col, INK, 0.35);
    fillOut(p.circle(0, 4, 31), col);
    fillOut(p.earL, ear);
    fillOut(p.earR, ear);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 15, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    eyes(ctx, 0, 11, 4.6);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(0, 13, 6.5, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 17);
    ctx.lineTo(0, 22);
    ctx.moveTo(-6, 24);
    ctx.quadraticCurveTo(0, 28, 6, 24);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
}

// ---------- strokes ----------

function strokeLine(ctx, pts, width, col) {
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (pts.length === 1) {
    ctx.arc(pts[0][0], pts[0][1], width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // straight between the points, a small curve at each bend: at most CORNER from the point and
  // at most half of either line, so straight lines stay straight and dense curves stay smooth
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const a = Math.hypot(x - px, y - py) || 1;
    const b = Math.hypot(nx - x, ny - y) || 1;
    const r = Math.min(CORNER, a / 2, b / 2);
    ctx.lineTo(x - ((x - px) / a) * r, y - ((y - py) / a) * r);
    ctx.quadraticCurveTo(x, y, x + ((nx - x) / b) * r, y + ((ny - y) / b) * r);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}

/** One item with all its mirror copies; the canvas is already scaled to grid units. */
export function drawItem(ctx, it) {
  const col = PALETTE[it.c] || PALETTE[0];
  for (const m of transforms(it.a)) {
    ctx.save();
    if (it.a) {
      ctx.translate(HALF, HALF);
      ctx.transform(m.a, m.b, m.c, m.d, 0, 0);
      ctx.translate(-HALF, -HALF);
    }
    if (it.k === 'p') {
      const s = STAMP_SIZES[it.z] / 100;
      ctx.translate(it.x, it.y);
      ctx.scale(s, s);
      drawStamp(ctx, STAMPS[it.s], col);
    } else if (it.k === 's') strokeLine(ctx, it.pts, SIZES[it.z], col);
    ctx.restore();
  }
}

/** The whole page on a canvas of `px` × `px` pixels: white, then every visible item. */
export function drawItems(ctx, items, px) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, px, px);
  const s = px / GRID;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  for (const it of visible(items)) drawItem(ctx, it);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** A thumbnail canvas (for "my drawings", the done card and the home tile). */
export function thumbCanvas(items, cssSize, cls = '') {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.round(cssSize * dpr);
  c.width = px;
  c.height = px;
  if (cls) c.className = cls;
  c.setAttribute('aria-hidden', 'true');
  drawItems(c.getContext('2d'), items, px);
  return c;
}

/** A stamp on its own small canvas (the stamp button and the row of stamps). */
export function stampIcon(kind, col, cssSize = 40) {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.round(cssSize * dpr);
  c.width = px;
  c.height = px;
  c.setAttribute('aria-hidden', 'true');
  const ctx = c.getContext('2d');
  const s = px / 108;
  ctx.setTransform(s, 0, 0, s, px / 2, px / 2);
  drawStamp(ctx, kind, col);
  return c;
}
