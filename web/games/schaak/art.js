// Schaken's pictures, drawn in code (SVG, no fonts or images). The six pieces are clear, rounded
// silhouettes in the classic shapes, so a child learns the real pieces: white is warm ivory with a
// dark ink outline, black a deep indigo with a near-black outline and light details, so the two
// sides differ in brightness (also for children who see colours differently). The board uses the
// app's own cream and lilac.
import { WHITE, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from './rules.js';

const INK = '#2b2370';
const SIDES = {
  [WHITE]: { fill: '#fffaf0', line: INK, detail: '#8d80d8', shine: '#ffffff' },
  2: { fill: '#3b2f8a', line: '#130e3a', detail: '#b9adff', shine: '#6a5cc4' },
};

export const LIGHT_SQUARE = '#fdf3e1';
export const DARK_SQUARE = '#a495ee';

const BASE = 'M24 89h52a5 5 0 0 0 5-5v-2a6 6 0 0 0-6-6H25a6 6 0 0 0-6 6v2a5 5 0 0 0 5 5z';

// every shape: [path or element, 'body' | 'detail' | 'dot']
const SHAPES = {
  [PAWN]: [
    ['M36 77c0-12 6-20 9-28h10c3 8 9 16 9 28z', 'body'],
    ['<ellipse cx="50" cy="47" rx="15" ry="4.6"/>', 'body'],
    ['<circle cx="50" cy="29" r="13.5"/>', 'body'],
    ['M44 24a7 7 0 0 1 6-4', 'shine'],
  ],
  [ROOK]: [
    ['M31 77l3-34h32l3 34z', 'body'],
    ['M25 43V21a2.5 2.5 0 0 1 2.5-2.5H36v8h7.5v-8h13v8H64v-8h8.5A2.5 2.5 0 0 1 75 21v22z', 'body'],
    ['M33 43h34', 'detail'],
    ['M38 58h24', 'detail'],
  ],
  [BISHOP]: [
    ['M38 77c1-8 5-14 6-20h12c1 6 5 12 6 20z', 'body'],
    ['<ellipse cx="50" cy="57" rx="16" ry="4.6"/>', 'body'],
    ['M50 15c-11 9-18 19-18 29 0 7 6 11 18 11s18-4 18-11c0-10-7-20-18-29z', 'body'],
    ['<circle cx="50" cy="12" r="5.2"/>', 'body'],
    ['M57 27 46 40', 'detail'],
  ],
  [KNIGHT]: [
    ['M71 77c-1-17 2-32-5-45l-3-14-7 9c-11-1-22 5-28 14l-8 12c-2 4 2 9 7 8l12-5c4 0 6 2 3 6-6 6-10 10-11 15z', 'body'],
    ['M64 30c4 8 4 18 3 30', 'detail'],
    ['<circle cx="45" cy="37" r="3.6"/>', 'dot'],
    ['<circle cx="27.5" cy="52" r="2.1"/>', 'dot'],
  ],
  [QUEEN]: [
    ['M35 77c1-6 3-10 4-14h22c1 4 3 8 4 14z', 'body'],
    ['M29 62 21 31l11 15 3-22 9 20 6-26 6 26 9-20 3 22 11-15-8 31z', 'body'],
    ['<ellipse cx="50" cy="63" rx="22" ry="5"/>', 'body'],
    ['<circle cx="21" cy="29" r="4.5"/><circle cx="35" cy="22" r="4.5"/><circle cx="50" cy="16" r="4.5"/><circle cx="65" cy="22" r="4.5"/><circle cx="79" cy="29" r="4.5"/>', 'body'],
  ],
  [KING]: [
    ['M35 77c1-6 3-10 4-14h22c1 4 3 8 4 14z', 'body'],
    ['M28 62c-7-10-7-23 5-27 7-2 13 1 17 7 4-6 10-9 17-7 12 4 12 17 5 27z', 'body'],
    ['<ellipse cx="50" cy="63" rx="22" ry="5"/>', 'body'],
    ['M46 8h8v7h7v7.5h-7V31h-8v-8.5h-7V15h7z', 'body'],
    ['M50 42v14', 'detail'],
  ],
};

function shape([d, kind], side) {
  const isEl = d.startsWith('<');
  let attrs;
  if (kind === 'body') attrs = `fill="${side.fill}" stroke="${side.line}" stroke-width="4" stroke-linejoin="round"`;
  else if (kind === 'dot') attrs = `fill="${side.line === INK ? INK : side.detail}"`;
  else if (kind === 'shine') attrs = `fill="none" stroke="${side.shine}" stroke-width="3" stroke-linecap="round" opacity=".9"`;
  else attrs = `fill="none" stroke="${side.detail}" stroke-width="3.2" stroke-linecap="round"`;
  if (!isEl) return `<path d="${d}" ${attrs}/>`;
  return d.replace(/<(\w+) /g, `<$1 ${attrs} `);
}

/** A piece: `color` 1 (white) or 2 (black), `kind` PAWN .. KING. */
export function pieceSvg(color, kind, { cls = '' } = {}) {
  const side = SIDES[color === WHITE ? WHITE : 2];
  const parts = (SHAPES[kind] || SHAPES[PAWN]).map((s) => shape(s, side)).join('');
  return `<svg class="piece ${cls}" viewBox="0 0 100 100" aria-hidden="true" data-kind="${kind}" data-color="${color}"><path d="${BASE}" fill="${side.fill}" stroke="${side.line}" stroke-width="4" stroke-linejoin="round"/>${parts}</svg>`;
}

/** The home tile: a corner of the board with a white knight and a black king. */
export function tileSvg() {
  const cell = 25;
  let sq = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) sq += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="${(r + c) % 2 ? DARK_SQUARE : LIGHT_SQUARE}"/>`;
  const at = (x, y, s, svg) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${s}" height="${s}" `);
  return (
    `<svg class="schaak-tile" viewBox="-4 -4 108 108" aria-hidden="true"><rect x="-4" y="-4" width="108" height="108" rx="14" fill="#6f5fe6"/>${sq}` +
    at(48, 2, 50, pieceSvg(2, KING)) +
    at(2, 46, 54, pieceSvg(WHITE, KNIGHT)) +
    at(54, 54, 40, pieceSvg(WHITE, PAWN)) +
    `</svg>`
  );
}
