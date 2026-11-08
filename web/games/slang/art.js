// Slangetje's pictures: the snake, the fruits and letters it eats (drawn on the board canvas), and
// the small SVG pictures for the tile, the menu and the "eat this" panel. Everything is drawn in
// code; no image files. Colours come from the colour-blind-safe bubble palette, where every colour
// has its own shape (circle, star, triangle, diamond, heart, square), so colour is never the only cue.
import { COLORS, drawBubble } from '../../js/bubble-art.js';
import { pictureSvg } from '../picturedoku/art.js';
import { dogSvg } from '../dogudoku/art.js';

const TAU = Math.PI * 2;

// The colours to eat: the bubble palette, but with purple (and its own square) instead of light
// blue, so no round ever asks a child to tell blue from light blue (review of PR #12).
export const FRUIT_COLORS = Object.freeze([
  ...COLORS.slice(0, 5),
  Object.freeze({ name: 'paars', base: '#8E5BD6', light: '#E6D8FF', dark: '#4A2A85', symbol: 'square' }),
]);

// How big things are drawn, as a part of a board square (review of PR #12: two-digit numbers were
// 5-7 px tall on small phones). `glyphSizes` says what that comes to in pixels.
export const ITEM_R = 0.47; // the radius of a fruit or a letter tile
export const LETTER_PX = 0.7; // the letter's font size
export const NUMBER_PX = { one: 0.72, two: 0.6 }; // a one- or two-digit number's font size
export function glyphSizes(cell) {
  return { letter: cell * LETTER_PX, number: cell * NUMBER_PX.one, number2: cell * NUMBER_PX.two };
}
export const SNAKE = Object.freeze({ body: '#58c27d', dark: '#2a7f50', light: '#b7f0c8', cheek: '#ff9fb8', tongue: '#e5484d' });
const INK = '#2b2370';

// ---------- SVG ----------

/** The friendly snake, for the home tile and the menu. */
export function snakeSvg({ cls = '' } = {}) {
  return `<svg class="snake-pic ${cls}" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M10 50c8 6 20 4 22-4s-10-10-8-18 14-8 20-4" fill="none" stroke="${SNAKE.dark}" stroke-width="13" stroke-linecap="round"/>
    <path d="M10 50c8 6 20 4 22-4s-10-10-8-18 14-8 20-4" fill="none" stroke="${SNAKE.body}" stroke-width="9" stroke-linecap="round"/>
    <path d="M12 51c7 4 16 3 18-3M27 30c1-4 7-6 12-5" fill="none" stroke="${SNAKE.light}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M54 22l6-1.5M54 22l5.5 2.5" stroke="${SNAKE.tongue}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="47" cy="22" r="9" fill="${SNAKE.body}" stroke="${SNAKE.dark}" stroke-width="2.4"/>
    <circle cx="45.5" cy="18.5" r="3" fill="#fff"/><circle cx="51.5" cy="19.5" r="3" fill="#fff"/>
    <circle cx="46.2" cy="18.8" r="1.5" fill="${INK}"/><circle cx="52.2" cy="19.8" r="1.5" fill="${INK}"/>
    <path d="M45 25.5c2 1.6 5 1.6 7 0" fill="none" stroke="${SNAKE.dark}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="42.5" cy="23.5" r="1.6" fill="${SNAKE.cheek}"/>
  </svg>`;
}

/** The path of a colour's own shape, centred at (x, y) with size s (the canvas version is symbolPath). */
export function symbolD(kind, x, y, s) {
  const f = (n) => n.toFixed(2);
  switch (kind) {
    case 'circle':
      return `M${f(x - s * 0.78)} ${f(y)}a${f(s * 0.78)} ${f(s * 0.78)} 0 1 0 ${f(s * 1.56)} 0a${f(s * 0.78)} ${f(s * 0.78)} 0 1 0 ${f(-s * 1.56)} 0z`;
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? s * 0.46 : s * 1.02;
        pts.push(`${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`);
      }
      return `M${pts.join('L')}z`;
    }
    case 'triangle':
      return `M${f(x)} ${f(y - s * 0.95)}L${f(x + s * 0.95)} ${f(y + s * 0.7)}L${f(x - s * 0.95)} ${f(y + s * 0.7)}z`;
    case 'diamond':
      return `M${f(x)} ${f(y - s)}L${f(x + s * 0.78)} ${f(y)}L${f(x)} ${f(y + s)}L${f(x - s * 0.78)} ${f(y)}z`;
    case 'heart': {
      const t = y - s * 0.35;
      return `M${f(x)} ${f(y + s * 0.85)}C${f(x - s * 1.15)} ${f(y + s * 0.05)} ${f(x - s * 0.95)} ${f(t - s * 0.75)} ${f(x)} ${f(t - s * 0.05)}C${f(x + s * 0.95)} ${f(t - s * 0.75)} ${f(x + s * 1.15)} ${f(y + s * 0.05)} ${f(x)} ${f(y + s * 0.85)}z`;
    }
    default: {
      const h = s * 0.72;
      return `M${f(x - h)} ${f(y - h)}h${f(2 * h)}v${f(2 * h)}h${f(-2 * h)}z`;
    }
  }
}

/** A fruit of colour i (with its shape), as an SVG: the "eat only this colour" picture. */
export function colorFruitSvg(i, { cls = '' } = {}) {
  const col = FRUIT_COLORS[i % FRUIT_COLORS.length];
  return `<svg class="fruit-pic ${cls}" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M24 12c1-4 3.5-6.5 7-7.5" fill="none" stroke="#7a4a26" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M25 10c3-4 9-5 12-2.6-2.6 4.2-8.4 5.2-12 2.6z" fill="#4cc38a" stroke="#2a7f50" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="24" cy="27" r="16" fill="${col.base}" stroke="${col.dark}" stroke-width="2.2"/>
    <ellipse cx="17.5" cy="20.5" rx="4.4" ry="3" transform="rotate(-30 17.5 20.5)" fill="#fff" opacity="0.6"/>
    <path d="${symbolD(col.symbol, 24, 28, 7.2)}" fill="${col.dark}" opacity="0.78"/>
  </svg>`;
}

/** A numbered fruit (an orange with a leaf) as an SVG, for the "eat this" panel. */
export function numberFruitSvg(n, { cls = '' } = {}) {
  const size = String(n).length > 1 ? 17 : 21;
  return `<svg class="fruit-pic ${cls}" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M25 10c3-4 9-5 12-2.6-2.6 4.2-8.4 5.2-12 2.6z" fill="#4cc38a" stroke="#2a7f50" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="24" cy="27" r="17" fill="#ff9f43" stroke="#c95f17" stroke-width="2.2"/>
    <text x="24" y="28.5" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="900" fill="#fff" stroke="#8f3f06" stroke-width="2.4" paint-order="stroke">${n}</text>
  </svg>`;
}

const SUN = `<circle cx="24" cy="24" r="10" fill="#ffd23f" stroke="#3b2a22" stroke-width="2"/>
  ${[0, 45, 90, 135, 180, 225, 270, 315]
    .map((a) => {
      const r = (a * Math.PI) / 180;
      const p = (d) => `${(24 + Math.cos(r) * d).toFixed(1)} ${(24 + Math.sin(r) * d).toFixed(1)}`;
      return `<path d="M${p(14)}L${p(20)}" stroke="#ff9f1a" stroke-width="3.2" stroke-linecap="round"/>`;
    })
    .join('')}
  <circle cx="20.5" cy="22" r="1.4" fill="#3b2a22"/><circle cx="27.5" cy="22" r="1.4" fill="#3b2a22"/>
  <path d="M20 26.5c2.2 2 5.8 2 8 0" fill="none" stroke="#3b2a22" stroke-width="1.8" stroke-linecap="round"/>`;
const EGG = `<path d="M24 6c-8 0-14 11-14 21s6 15 14 15 14-5 14-15S32 6 24 6z" fill="#fff7e6" stroke="#3b2a22" stroke-width="2"/>
  <ellipse cx="18" cy="20" rx="3" ry="5" transform="rotate(20 18 20)" fill="#fff" opacity="0.9"/>
  <path d="M16 31c3 3 13 3 16 0" fill="none" stroke="#f1d9a8" stroke-width="2" stroke-linecap="round"/>`;

/** The picture for a word of a letters round. */
export function wordPictureSvg(id, { cls = '' } = {}) {
  const fromPicturedoku = { apple: 1, banana: 2, grapes: 3, carrot: 4, pear: 5, flower: 7, fish: 8, ball: 9 };
  if (id === 'dog') return dogSvg(0, { cls: `word-pic ${cls}` });
  if (fromPicturedoku[id]) return pictureSvg(fromPicturedoku[id], { cls: `word-pic ${cls}` });
  const art = id === 'sun' ? SUN : EGG;
  return `<svg class="pic word-pic ${cls}" viewBox="0 0 48 48" aria-hidden="true">${art}</svg>`;
}

/** The picture for a kind of round in the menu. */
export function modeSvg(mode) {
  if (mode === 'count') {
    return `<svg viewBox="0 0 64 48" aria-hidden="true">
      <g transform="translate(-4 0) scale(0.85)">${inner(numberFruitSvg(1))}</g>
      <g transform="translate(22 6) scale(0.85)">${inner(numberFruitSvg(2))}</g>
    </svg>`;
  }
  if (mode === 'letters') {
    const tile = (x, y, ch) =>
      `<rect x="${x}" y="${y}" width="24" height="24" rx="6" fill="#fff8e1" stroke="#c9a14a" stroke-width="2"/><text x="${x + 12}" y="${y + 13}" text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="900" fill="${INK}">${ch}</text>`;
    return `<svg viewBox="0 0 64 48" aria-hidden="true">${tile(4, 8, 'A')}${tile(22, 18, 'B')}${tile(38, 4, 'C')}</svg>`;
  }
  return `<svg viewBox="0 0 64 48" aria-hidden="true">
    <g transform="translate(-6 4) scale(0.8)">${inner(colorFruitSvg(0))}</g>
    <g transform="translate(14 -2) scale(0.8)">${inner(colorFruitSvg(1))}</g>
    <g transform="translate(34 6) scale(0.8)">${inner(colorFruitSvg(2))}</g>
  </svg>`;
}
const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// ---------- canvas ----------

/** The board: soft grass squares; a fence around a board without wrap-around. */
export function drawBoard(ctx, { cols, rows, cell, wrap, walls }) {
  ctx.fillStyle = '#e6f4d8';
  ctx.fillRect(0, 0, cols * cell, rows * cell);
  ctx.fillStyle = '#dcefc9';
  for (let r = 0; r < rows; r++) for (let c = (r % 2); c < cols; c += 2) ctx.fillRect(c * cell, r * cell, cell, cell);
  for (const k of walls) {
    const [r, c] = k.split(',').map(Number);
    drawStone(ctx, c * cell, r * cell, cell);
  }
  ctx.lineWidth = Math.max(3, cell * 0.16);
  if (wrap) {
    // the snake comes back on the other side: a soft dashed edge
    ctx.setLineDash([cell * 0.35, cell * 0.3]);
    ctx.strokeStyle = 'rgba(42, 127, 80, 0.35)';
  } else {
    ctx.setLineDash([]);
    ctx.strokeStyle = '#a0724a';
  }
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, cols * cell - ctx.lineWidth, rows * cell - ctx.lineWidth);
  ctx.setLineDash([]);
}

function drawStone(ctx, x, y, s) {
  const p = s * 0.08;
  const r = s * 0.28;
  ctx.fillStyle = '#9aa3b5';
  ctx.strokeStyle = '#5f6b86';
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  ctx.beginPath();
  rrect(ctx, x + p, y + p, s - 2 * p, s - 2 * p, r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.36, y + s * 0.34, s * 0.14, s * 0.09, -0.5, 0, TAU);
  ctx.fill();
}

/** A rounded rectangle path (ctx.roundRect is missing on older iOS). */
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function leaf(ctx, x, y, r) {
  ctx.fillStyle = '#4cc38a';
  ctx.strokeStyle = '#2a7f50';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.ellipse(x + r * 0.3, y - r * 0.92, r * 0.42, r * 0.2, -0.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

/** A numbered fruit (an orange) on the board; `cell` sets the size of the number. */
export function drawNumberFruit(ctx, x, y, r, n, cell = r / ITEM_R) {
  leaf(ctx, x, y, r);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffd2a1');
  g.addColorStop(0.55, '#ff9f43');
  g.addColorStop(1, '#e0741c');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#c95f17';
  ctx.lineWidth = Math.max(1.2, r * 0.1);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const two = String(n).length > 1;
  label(ctx, x, y + r * 0.04, String(n), cell * (two ? NUMBER_PX.two : NUMBER_PX.one), '#fff', '#8f3f06', two ? 0.09 : 0.13);
}

/** A letter tile on the board; `cell` sets the size of the letter. */
export function drawLetterTile(ctx, x, y, r, letter, cell = r / ITEM_R) {
  ctx.fillStyle = '#fff8e1';
  ctx.strokeStyle = '#c9a14a';
  ctx.lineWidth = Math.max(1.4, r * 0.12);
  ctx.beginPath();
  rrect(ctx, x - r, y - r, 2 * r, 2 * r, r * 0.35);
  ctx.fill();
  ctx.stroke();
  label(ctx, x, y + r * 0.06, letter, cell * LETTER_PX, INK, null);
}

/** A fruit of colour i (a glossy berry with the colour's own shape and a leaf). */
export function drawColorFruit(ctx, x, y, r, i) {
  leaf(ctx, x, y, r);
  drawBubble(ctx, x, y, r, FRUIT_COLORS[i % FRUIT_COLORS.length], { shadow: false });
}

function label(ctx, x, y, text, size, fill, outline, weight = 0.16) {
  ctx.font = `900 ${Math.round(size)}px ui-rounded, "Nunito", "Varela Round", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineWidth = Math.max(1.5, size * weight);
    ctx.strokeStyle = outline;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** The soft ring around the next thing to eat (youngest tier). `t` animates it (0 when reduced motion). */
export function drawHelpRing(ctx, x, y, r, t) {
  const pulse = 1 + 0.12 * Math.sin(t * 5);
  ctx.strokeStyle = 'rgba(255, 197, 49, 0.95)';
  ctx.lineWidth = Math.max(2, r * 0.18);
  ctx.beginPath();
  ctx.arc(x, y, r * 1.28 * pulse, 0, TAU);
  ctx.stroke();
}

/**
 * The snake. `pts`: the centres of its parts in pixels, head first. A jump of more than a cell
 * (going round the edge) breaks the body into pieces. `dir` turns the face; `flash` tints it red
 * for a mistake; `tongue` shows the forked tongue; `squash` (0..1) makes the head bulge after a bite.
 */
export function drawSnake(ctx, pts, cell, dir, { flash = 0, tongue = false, squash = 0 } = {}) {
  if (!pts.length) return;
  const w = cell * 0.72;
  const runs = [];
  let run = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    if (Math.abs(ax - bx) > cell * 1.5 || Math.abs(ay - by) > cell * 1.5) {
      runs.push(run);
      run = [pts[i]];
    } else run.push(pts[i]);
  }
  runs.push(run);
  const stroke = (color, width) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const p of runs) {
      if (p.length === 1) {
        ctx.beginPath();
        ctx.arc(p[0][0], p[0][1], width / 2, 0, TAU);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.stroke();
    }
  };
  stroke(SNAKE.dark, w + Math.max(3, cell * 0.12));
  stroke(SNAKE.body, w);
  stroke(SNAKE.light, w * 0.3);
  // little spots along the back
  ctx.fillStyle = 'rgba(42, 127, 80, 0.45)';
  for (let i = 2; i < pts.length; i += 2) {
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], w * 0.13, 0, TAU);
    ctx.fill();
  }

  // the head
  const [hx, hy] = pts[0];
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir] || [0, -1];
  const px = -dy;
  const py = dx; // perpendicular
  const hr = cell * 0.5 * (1 + squash * 0.18);
  if (tongue) {
    const tx = hx + dx * hr * 1.5;
    const ty = hy + dy * hr * 1.5;
    ctx.strokeStyle = SNAKE.tongue;
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx + dx * hr * 0.8, hy + dy * hr * 0.8);
    ctx.lineTo(tx, ty);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + (dx + px) * hr * 0.3, ty + (dy + py) * hr * 0.3);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + (dx - px) * hr * 0.3, ty + (dy - py) * hr * 0.3);
    ctx.stroke();
  }
  ctx.fillStyle = flash > 0 ? mix(SNAKE.body, '#ff6b6b', flash) : SNAKE.body;
  ctx.strokeStyle = SNAKE.dark;
  ctx.lineWidth = Math.max(1.6, cell * 0.08);
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // cheeks
  ctx.fillStyle = SNAKE.cheek;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(hx + px * s * hr * 0.55 - dx * hr * 0.05, hy + py * s * hr * 0.55 - dy * hr * 0.05, hr * 0.14, 0, TAU);
    ctx.fill();
  }
  // eyes, looking where it goes
  for (const s of [-1, 1]) {
    const ex = hx + px * s * hr * 0.4 + dx * hr * 0.22;
    const ey = hy + py * s * hr * 0.4 + dy * hr * 0.22;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, ey, hr * 0.27, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + dx * hr * 0.1, ey + dy * hr * 0.1, hr * 0.14, 0, TAU);
    ctx.fill();
  }
  // a smile, towards the front
  ctx.strokeStyle = SNAKE.dark;
  ctx.lineWidth = Math.max(1.2, cell * 0.06);
  ctx.beginPath();
  const mx = hx + dx * hr * 0.55;
  const my = hy + dy * hr * 0.55;
  const a = Math.atan2(dy, dx);
  ctx.arc(mx - dx * hr * 0.3, my - dy * hr * 0.3, hr * 0.32, a - 0.9, a + 0.9);
  ctx.stroke();
}

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}
