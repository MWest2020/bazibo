// Drawing of glossy soap/glass bubbles on a 2D canvas, plus a sprite cache so the game
// draws each colour once per size instead of rebuilding gradients every frame.

const TAU = Math.PI * 2;

// Based on the Okabe-Ito colour-blind-safe palette, brightened a little for children.
// Every colour also carries its own symbol, so colour is never the only cue.
export const COLORS = [
  { name: 'blauw', base: '#1E80D6', light: '#A9DAFF', dark: '#0A3D78', symbol: 'circle' },
  { name: 'oranje', base: '#F29A0E', light: '#FFE1A6', dark: '#8F4E00', symbol: 'star' },
  { name: 'groen', base: '#12AE7E', light: '#A6F2D6', dark: '#04604A', symbol: 'triangle' },
  { name: 'geel', base: '#F5DF2E', light: '#FFFBCF', dark: '#8A7700', symbol: 'diamond' },
  { name: 'roze', base: '#D877B3', light: '#FFD9EF', dark: '#7E2B66', symbol: 'heart' },
  { name: 'lucht', base: '#5CC2F2', light: '#DAF3FF', dark: '#16648F', symbol: 'square' },
];

export function symbolPath(ctx, kind, x, y, s) {
  ctx.beginPath();
  switch (kind) {
    case 'circle':
      ctx.arc(x, y, s * 0.78, 0, TAU);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? s * 0.46 : s * 1.02;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      break;
    case 'triangle':
      ctx.moveTo(x, y - s * 0.95);
      ctx.lineTo(x + s * 0.95, y + s * 0.7);
      ctx.lineTo(x - s * 0.95, y + s * 0.7);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.78, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.78, y);
      ctx.closePath();
      break;
    case 'heart': {
      const t = y - s * 0.35;
      ctx.moveTo(x, y + s * 0.85);
      ctx.bezierCurveTo(x - s * 1.15, y + s * 0.05, x - s * 0.95, t - s * 0.75, x, t - s * 0.05);
      ctx.bezierCurveTo(x + s * 0.95, t - s * 0.75, x + s * 1.15, y + s * 0.05, x, y + s * 0.85);
      ctx.closePath();
      break;
    }
    case 'square': {
      const h = s * 0.72;
      const rr = s * 0.22;
      ctx.moveTo(x - h + rr, y - h);
      ctx.arcTo(x + h, y - h, x + h, y + h, rr);
      ctx.arcTo(x + h, y + h, x - h, y + h, rr);
      ctx.arcTo(x - h, y + h, x - h, y - h, rr);
      ctx.arcTo(x - h, y - h, x + h, y - h, rr);
      ctx.closePath();
      break;
    }
  }
}

/** Draw one bubble centred at (cx, cy) with radius r. */
export function drawBubble(ctx, cx, cy, r, col, { shadow = true, symbol = true } = {}) {
  ctx.save();

  // body with a soft drop shadow
  if (shadow) {
    ctx.shadowColor = 'rgba(30, 30, 80, 0.28)';
    ctx.shadowBlur = r * 0.38;
    ctx.shadowOffsetY = r * 0.16;
  }
  const body = ctx.createRadialGradient(cx - r * 0.34, cy - r * 0.4, r * 0.05, cx, cy, r);
  body.addColorStop(0, col.light);
  body.addColorStop(0.48, col.base);
  body.addColorStop(0.86, col.base);
  body.addColorStop(1, col.dark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();

  // inner depth: a little darker towards the lower right
  const depth = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.4, cx, cy, r * 1.05);
  depth.addColorStop(0, 'rgba(0,0,0,0)');
  depth.addColorStop(1, 'rgba(10,10,50,0.22)');
  ctx.fillStyle = depth;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);

  // symbol, embossed
  if (symbol && col.symbol) {
    const s = r * 0.36;
    const sy = cy + r * 0.05;
    symbolPath(ctx, col.symbol, cx, sy + r * 0.04, s);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    symbolPath(ctx, col.symbol, cx, sy, s);
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = col.dark;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // reflected light along the bottom edge
  const refl = ctx.createRadialGradient(cx + r * 0.15, cy + r * 0.78, 0, cx + r * 0.15, cy + r * 0.78, r * 0.62);
  refl.addColorStop(0, 'rgba(255,255,255,0.55)');
  refl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = refl;
  ctx.fillRect(cx - r, cy, 2 * r, r);

  // fresnel rim: bubbles are brighter at the edge
  const rim = ctx.createRadialGradient(cx, cy, r * 0.68, cx, cy, r);
  rim.addColorStop(0, 'rgba(255,255,255,0)');
  rim.addColorStop(0.85, 'rgba(255,255,255,0.10)');
  rim.addColorStop(1, 'rgba(255,255,255,0.5)');
  ctx.fillStyle = rim;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);

  // faint soap-film rainbow on the rim
  if (typeof ctx.createConicGradient === 'function') {
    const film = ctx.createConicGradient(-0.6, cx, cy);
    ['#ff7ad9', '#ffe36e', '#7dffb2', '#6ed6ff', '#b18cff', '#ff7ad9'].forEach((c, i, a) => film.addColorStop(i / (a.length - 1), c));
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = film;
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.9, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  ctx.save();
  // subtle darker outline
  ctx.strokeStyle = col.dark;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // big glossy highlight
  ctx.translate(cx - r * 0.33, cy - r * 0.43);
  ctx.rotate(-0.6);
  const gloss = ctx.createLinearGradient(0, -r * 0.22, 0, r * 0.24);
  gloss.addColorStop(0, 'rgba(255,255,255,0.95)');
  gloss.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.4, r * 0.22, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // sparkles
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(cx + r * 0.12, cy - r * 0.64, r * 0.07, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(cx + r * 0.55, cy + r * 0.35, r * 0.06, 0, TAU);
  ctx.fill();
}

const cache = new Map();

/** A pre-rendered bubble sprite with radius `px` device pixels (canvas is padded for the shadow). */
export function getSprite(colorIndex, px) {
  const k = `${colorIndex}:${Math.round(px * 4)}`;
  let c = cache.get(k);
  if (c) return c;
  const size = Math.ceil(px * 2 * 1.36);
  c = document.createElement('canvas');
  c.width = c.height = size;
  drawBubble(c.getContext('2d'), size / 2, size / 2, px, COLORS[colorIndex]);
  cache.set(k, c);
  return c;
}

export function clearSprites() {
  cache.clear();
}
