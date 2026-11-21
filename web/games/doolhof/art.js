// Egeltje's pictures, all drawn in code (no image files): the garden with its hedges, the letter
// stones, the hedgehog (walking, or curled up into a spiky ball for a surprised moment) and the
// friendly crows (walking, or fluttering off) on the board canvas, and small SVG pictures for the
// home tile, the menu and the cards. A brown hedgehog seen from the side and black-blue birds with
// an orange beak, in a green garden: nothing round and yellow, no ghosts.
const TAU = Math.PI * 2;
export const INK = '#2b2370';
export const HOG = Object.freeze({ spines: '#7a4a2a', spinesDark: '#4f2d17', spinesLight: '#a8714a', face: '#f3d2a2', nose: '#2b1a10', cheek: '#ff9fb8' });
export const CROW = Object.freeze({ body: '#3a4258', belly: '#69728f', beak: '#f59f3a', eye: '#fff' });
export const GARDEN = Object.freeze({ grass: '#e3f2cf', grass2: '#d7ebbf', hedge: '#2f7d3f', hedgeLight: '#4fae5b', leaf: '#7fcf7a' });
/** The tile's radius and the glyph's size, as parts of a cell. */
export const TILE_R = 0.36;
export const GLYPH = Object.freeze({ one: 0.5, two: 0.4 });
export const glyphPx = (cell, value) => cell * (String(value).length > 1 ? GLYPH.two : GLYPH.one);

// ---------- SVG ----------

/** The hedgehog, for the tile, the menu and the cards (looking right). */
export function hogSvg({ cls = '' } = {}) {
  const spikes = [];
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI * (0.98 + (k / 8) * 1.04);
    const x = 30 + Math.cos(a) * 21;
    const y = 40 + Math.sin(a) * 18;
    const x2 = 30 + Math.cos(a) * 30;
    const y2 = 40 + Math.sin(a) * 27;
    spikes.push(`<path d="M${(x - Math.sin(a) * 5).toFixed(1)} ${(y + Math.cos(a) * 5).toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${(x + Math.sin(a) * 5).toFixed(1)} ${(y - Math.cos(a) * 5).toFixed(1)}z"/>`);
  }
  return `<svg class="hog-pic ${cls}" viewBox="0 0 64 56" aria-hidden="true">
    <g fill="${HOG.spinesDark}">${spikes.join('')}</g>
    <ellipse cx="30" cy="40" rx="22" ry="13" fill="${HOG.spines}" stroke="${HOG.spinesDark}" stroke-width="2.2"/>
    <path d="M17 34q6-6 14-6M22 40q7-5 15-4" fill="none" stroke="${HOG.spinesLight}" stroke-width="2" stroke-linecap="round"/>
    <path d="M40 31c8-2 15 4 19 10-5 4-13 6-20 4z" fill="${HOG.face}" stroke="${HOG.spinesDark}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="59" cy="41" r="2.6" fill="${HOG.nose}"/>
    <circle cx="49" cy="36" r="2.1" fill="${HOG.nose}"/><circle cx="49.7" cy="35.3" r=".7" fill="#fff"/>
    <circle cx="50" cy="41" r="2" fill="${HOG.cheek}" opacity=".8"/>
    <ellipse cx="42" cy="30.5" rx="2.6" ry="3" fill="${HOG.face}" stroke="${HOG.spinesDark}" stroke-width="1.6"/>
    <path d="M18 52v-3M27 53v-3M38 52v-3" stroke="${HOG.spinesDark}" stroke-width="3.4" stroke-linecap="round"/>
  </svg>`;
}

/** A letter stone with a glyph (for the menu pictures and the tile). */
function stoneSvg(x, y, r, ch, fill = '#fff8e1') {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#b58a3c" stroke-width="2.4"/>` +
    `<text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="central" font-size="${r * 1.25}" font-weight="900" fill="${INK}" font-family="system-ui, sans-serif">${ch}</text>`;
}

const hedgeSvg = (d) => `<path d="${d}" fill="none" stroke="${GARDEN.hedge}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${GARDEN.hedgeLight}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;

/** The home tile: the hedgehog in a corner of the garden, with two letter stones. */
export function tileSvg() {
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <rect x="4" y="4" width="92" height="92" rx="18" fill="${GARDEN.grass}"/>
    ${hedgeSvg('M10 10h80v80M10 10v34M58 10v24M90 60H64')}
    ${stoneSvg(36, 30, 13, 'a')}${stoneSvg(76, 40, 11, 'b')}
    <g transform="translate(4 40) scale(1.05)">${hogSvg().replace(/<\/?svg[^>]*>/g, '')}</g>
  </svg>`;
}

/** The kinds of round, as menu pictures. */
export function modeSvg(mode) {
  const values = mode === 'count' ? ['1', '2', '3'] : mode === 'word' ? ['k', 'a', 't'] : ['a', 'b', 'c'];
  const stones = values.map((v, k) => stoneSvg(52 + k * 22, 26 + (k % 2) * 8, 11, v)).join('');
  return `<svg viewBox="0 0 120 70" aria-hidden="true">${hedgeSvg('M6 64h108')}<g transform="translate(-2 18) scale(.78)">${hogSvg().replace(/<\/?svg[^>]*>/g, '')}</g>${stones}</svg>`;
}

/** A friendly crow, for the how-to card. */
export function crowSvg() {
  return `<svg viewBox="0 0 64 56" aria-hidden="true">
    <path d="M14 36c0-12 9-20 20-20s18 8 18 18-8 16-19 16S14 46 14 36z" fill="${CROW.body}"/>
    <path d="M22 40c4 6 16 7 22 0" fill="${CROW.belly}"/>
    <path d="M20 30c6-4 14-3 18 3-6 3-13 2-18-3z" fill="${CROW.belly}"/>
    <path d="M50 28l11 4-11 4z" fill="${CROW.beak}"/>
    <circle cx="42" cy="26" r="4.4" fill="#fff"/><circle cx="43.4" cy="26" r="2.2" fill="${INK}"/>
    <path d="M28 50v4M36 50v4" stroke="${CROW.beak}" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`;
}

// ---------- canvas ----------

/** The garden: grass, a soft check on the paths and the hedges between the cells. */
export function drawGarden(ctx, maze, cell) {
  const { cols, rows, open } = maze;
  ctx.fillStyle = GARDEN.grass;
  ctx.fillRect(0, 0, cols * cell, rows * cell);
  ctx.fillStyle = GARDEN.grass2;
  for (let r = 0; r < rows; r++) for (let c = r % 2; c < cols; c += 2) ctx.fillRect(c * cell, r * cell, cell, cell);
  const half = Math.max(2, cell * 0.07);
  const segs = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const o = open[r * cols + c];
      const x = c * cell;
      const y = r * cell;
      if (!(o & 1)) segs.push([x, y, x + cell, y]);
      if (!(o & 8)) segs.push([x, y, x, y + cell]);
      if (c === cols - 1 && !(o & 2)) segs.push([x + cell, y, x + cell, y + cell]);
      if (r === rows - 1 && !(o & 4)) segs.push([x, y + cell, x + cell, y + cell]);
    }
  }
  ctx.lineCap = 'round';
  const pass = (color, w) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segs) {
      ctx.moveTo(clamp(x1, half, cols * cell - half), clamp(y1, half, rows * cell - half));
      ctx.lineTo(clamp(x2, half, cols * cell - half), clamp(y2, half, rows * cell - half));
    }
    ctx.stroke();
  };
  pass(GARDEN.hedge, half * 2);
  pass(GARDEN.hedgeLight, half * 1.1);
  // little leaves along the hedges
  ctx.fillStyle = GARDEN.leaf;
  for (const [x1, y1, x2, y2] of segs) {
    for (const f of [0.3, 0.7]) {
      ctx.beginPath();
      ctx.arc(clamp(x1 + (x2 - x1) * f, half, cols * cell - half), clamp(y1 + (y2 - y1) * f, half, rows * cell - half), half * 0.45, 0, TAU);
      ctx.fill();
    }
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** A letter (or number) stone at x, y. `glow` (0..1 animation time, or null) rings the right one. */
export function drawStone(ctx, x, y, cell, value, glow = null) {
  const r = cell * TILE_R;
  if (glow !== null) {
    const pulse = 1 + 0.1 * Math.sin(glow * 5);
    ctx.strokeStyle = 'rgba(255, 197, 49, 0.95)';
    ctx.lineWidth = Math.max(2.5, r * 0.22);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3 * pulse, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(42, 90, 40, 0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.18, r * 1.02, r * 0.98, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff8e1';
  ctx.strokeStyle = '#b58a3c';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.font = `900 ${Math.round(glyphPx(cell, value))}px "Bazibo Sans", ui-rounded, "Nunito", "Varela Round", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(String(value), x, y + r * 0.06);
}

/**
 * The hedgehog at x, y, looking `face` (left or right). `walk` (0..1) bobs it while walking;
 * `curl` (0..1) rolls it into a spiky ball.
 */
export function drawHog(ctx, x, y, cell, face = 'right', { walk = 0, curl = 0 } = {}) {
  const s = cell / 64;
  ctx.save();
  ctx.translate(x, y - Math.abs(Math.sin(walk * Math.PI)) * cell * 0.05);
  if (face === 'left') ctx.scale(-1, 1);
  ctx.scale(s, s);
  if (curl > 0.5) {
    // a spiky ball with a nose peeking out
    ctx.fillStyle = HOG.spinesDark;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.22) * 17, Math.sin(a - 0.22) * 17);
      ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26);
      ctx.lineTo(Math.cos(a + 0.22) * 17, Math.sin(a + 0.22) * 17);
      ctx.fill();
    }
    ctx.fillStyle = HOG.spines;
    ctx.strokeStyle = HOG.spinesDark;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = HOG.face;
    ctx.beginPath();
    ctx.arc(9, 7, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = HOG.nose;
    ctx.beginPath();
    ctx.arc(13, 8, 2.4, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  // spines: a fan of points over the back
  ctx.fillStyle = HOG.spinesDark;
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI * (0.98 + (k / 8) * 1.04);
    const bx = -4 + Math.cos(a) * 19;
    const by = 6 + Math.sin(a) * 15;
    ctx.beginPath();
    ctx.moveTo(bx - Math.sin(a) * 5, by + Math.cos(a) * 5);
    ctx.lineTo(-4 + Math.cos(a) * 27, 6 + Math.sin(a) * 23);
    ctx.lineTo(bx + Math.sin(a) * 5, by - Math.cos(a) * 5);
    ctx.fill();
  }
  ctx.fillStyle = HOG.spines;
  ctx.strokeStyle = HOG.spinesDark;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(-4, 6, 20, 12, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // the face: a pointed snout to the right
  ctx.fillStyle = HOG.face;
  ctx.beginPath();
  ctx.moveTo(6, -2);
  ctx.bezierCurveTo(14, -5, 22, 1, 26, 7);
  ctx.bezierCurveTo(21, 11, 13, 13, 6, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = HOG.nose;
  ctx.beginPath();
  ctx.arc(26, 7, 2.6, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(16, 2.5, 2.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(16.7, 1.8, 0.7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = HOG.cheek;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(17, 7.5, 2, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  // little feet, stepping
  ctx.strokeStyle = HOG.spinesDark;
  ctx.lineWidth = 3.4;
  const lift = Math.sin(walk * TAU) * 2;
  for (const [fx, k] of [[-14, 1], [-2, -1], [8, 1]]) {
    ctx.beginPath();
    ctx.moveTo(fx, 16);
    ctx.lineTo(fx, 19 - lift * k);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A friendly crow at x, y, looking `face`; `hop` (0..1) lifts it while it walks. `flap` (a clock in
 * seconds, or null) spreads its wings and flutters them while it flies off.
 */
export function drawCrow(ctx, x, y, cell, face = 'left', hop = 0, flap = null) {
  const s = cell / 64;
  ctx.save();
  ctx.translate(x, y - Math.sin(hop * Math.PI) * cell * 0.12);
  if (face === 'left') ctx.scale(-1, 1);
  ctx.scale(s, s);
  ctx.translate(-32, -32);
  ctx.fillStyle = 'rgba(30, 50, 30, 0.16)';
  ctx.beginPath();
  ctx.ellipse(33, 54, 14, 3.5, 0, 0, TAU);
  ctx.fill();
  if (flap !== null) {
    // two wings up and down behind the body, a quick flutter
    const lift = Math.sin(flap * 26) * 0.7;
    ctx.fillStyle = CROW.body;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(32, 30);
      ctx.rotate(side * (0.5 + lift));
      ctx.beginPath();
      ctx.ellipse(side * 15, -4, 15, 6, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = CROW.body;
  ctx.beginPath();
  ctx.moveTo(14, 36);
  ctx.bezierCurveTo(14, 24, 23, 16, 34, 16);
  ctx.bezierCurveTo(45, 16, 52, 24, 52, 34);
  ctx.bezierCurveTo(52, 44, 44, 50, 33, 50);
  ctx.bezierCurveTo(22, 50, 14, 46, 14, 36);
  ctx.fill();
  ctx.fillStyle = CROW.belly;
  ctx.beginPath();
  ctx.moveTo(22, 40);
  ctx.quadraticCurveTo(33, 50, 44, 40);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, 30);
  ctx.quadraticCurveTo(28, 25, 36, 33);
  ctx.quadraticCurveTo(26, 37, 18, 30);
  ctx.fill();
  ctx.fillStyle = CROW.beak;
  ctx.beginPath();
  ctx.moveTo(50, 28);
  ctx.lineTo(61, 32);
  ctx.lineTo(50, 36);
  ctx.fill();
  ctx.fillStyle = CROW.eye;
  ctx.beginPath();
  ctx.arc(42, 26, 4.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(43.4, 26, 2.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = CROW.beak;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(28, 50);
  ctx.lineTo(28, 54);
  ctx.moveTo(36, 50);
  ctx.lineTo(36, 54);
  ctx.stroke();
  ctx.restore();
}
