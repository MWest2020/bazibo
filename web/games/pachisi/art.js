// Pachisi's pictures, all our own and drawn in code (SVG), in Bazibo's style: round shapes, the
// app's ink outline, soft colours. The board is an Indian-inspired cloth: a warm madder cloth
// with gold stitching, cream squares on the four arms, the twelve castle squares in saffron with
// the traditional stitched cross, paisley (buta) motifs in the corners and a lotus on the
// Charkoni in the middle. It is not a copy of any publisher's board.
//   pawns   the traditional beehive-shaped pawn, one colour AND one symbol per player (sun, moon,
//           star, lotus), so the players can be told apart without seeing colours
//   shells  cowrie shells: open (mouth up: the toothed slit) or closed (the spotted back)
import { SIZE, TRACK, CASTLES, PATHS, rowOf, colOf, isCastle } from './rules.js';

const INK = '#2b2370';
const CLOTH = '#a63d4f';
const CLOTH_DARK = '#7f2a3c';
const GOLD = '#f2c35b';
const SQUARE = '#fff4df';

/** The players' looks: colour, a darker rim, a light tint for their lane, and their symbol. */
export const LOOKS = Object.freeze([
  Object.freeze({ id: 'sun', fill: '#ff9f1c', dark: '#c46a00', light: '#ffe2b8' }),
  Object.freeze({ id: 'moon', fill: '#8f6be8', dark: '#5a3fb5', light: '#e3d9ff' }),
  Object.freeze({ id: 'star', fill: '#22b8a8', dark: '#12796f', light: '#c8f1ec' }),
  Object.freeze({ id: 'lotus', fill: '#ff6f9f', dark: '#c23f6d', light: '#ffd6e4' }),
]);

/** A player's symbol, drawn in a 100×100 box round (50, 50) with radius about 20. */
function symbol(id, colour) {
  if (id === 'sun') {
    let rays = '';
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      rays += `M${(50 + Math.cos(a) * 12).toFixed(1)} ${(50 + Math.sin(a) * 12).toFixed(1)}L${(50 + Math.cos(a) * 19).toFixed(1)} ${(50 + Math.sin(a) * 19).toFixed(1)}`;
    }
    return `<circle cx="50" cy="50" r="8" fill="${colour}"/><path d="${rays}" stroke="${colour}" stroke-width="4.4" stroke-linecap="round"/>`;
  }
  if (id === 'moon') return `<path d="M57 31a20 20 0 1 0 0 38 16 16 0 1 1 0-38z" fill="${colour}"/>`;
  if (id === 'star') return `<path d="M50 29l6 13 14 1.6-10.5 9.6 3 14L50 60l-12.5 7.2 3-14L30 43.6l14-1.6z" fill="${colour}" stroke="${colour}" stroke-width="2" stroke-linejoin="round"/>`;
  // lotus: three petals on a little bowl
  return (
    `<path d="M50 30c7 7 8 17 0 28-8-11-7-21 0-28z" fill="${colour}"/>` +
    `<path d="M31 41c9 1 15 8 17 17-10 1-17-6-17-17zM69 41c-9 1-15 8-17 17 10 1 17-6 17-17z" fill="${colour}"/>` +
    `<path d="M34 62h32c-2 6-8 9-16 9s-14-3-16-9z" fill="${colour}"/>`
  );
}

/** A player's beehive pawn (`k` 0-3), seen a little from the front. */
export function pawnSvg(k = 0, { cls = '' } = {}) {
  const l = LOOKS[((k % 4) + 4) % 4];
  return (
    `<svg class="ppawn-svg ${cls}" data-look="${l.id}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<ellipse cx="50" cy="90" rx="34" ry="7" fill="#000" opacity=".22"/>` +
    `<path d="M16 86c0-9 3-14 8-17 1-27 11-52 26-55 15 3 25 28 26 55 5 3 8 8 8 17z" fill="${l.fill}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>` +
    `<path d="M26 66c15 5 33 5 48 0M30 44c13 4 27 4 40 0" fill="none" stroke="${l.dark}" stroke-width="3.4" stroke-linecap="round" opacity=".55"/>` +
    `<path d="M38 26c-5 8-8 20-8 32" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".45"/>` +
    `<circle cx="50" cy="13" r="6" fill="${l.fill}" stroke="${INK}" stroke-width="3.6"/>` +
    `<circle cx="50" cy="62" r="19" fill="#fff" stroke="${l.dark}" stroke-width="3"/>` +
    `<g transform="translate(50 62) scale(.78) translate(-50 -50)">${symbol(l.id, l.dark)}</g>` +
    `</svg>`
  );
}

/** A cowrie shell: `open` shows its toothed mouth, closed its spotted back. */
export function shellSvg(open, { cls = '' } = {}) {
  const body = '<ellipse cx="30" cy="40" rx="21" ry="31" fill="#fff6e6" stroke="' + INK + '" stroke-width="3"/>';
  if (open) {
    let teeth = '';
    for (let k = 0; k < 7; k++) {
      const y = 20 + k * 6.6;
      teeth += `M24 ${y.toFixed(1)}h4.5M31.5 ${(y + 3).toFixed(1)}h4.5`;
    }
    return (
      `<svg class="shell-svg open ${cls}" viewBox="0 0 60 80" aria-hidden="true">` +
      body +
      `<ellipse cx="30" cy="40" rx="15" ry="25" fill="#ffe6c2"/>` +
      `<path d="M30 13c-4 9-5 18-5 27s1 18 5 27c4-9 5-18 5-27s-1-18-5-27z" fill="#6b3d22"/>` +
      `<path d="${teeth}" stroke="#fff6e6" stroke-width="2.4" stroke-linecap="round"/>` +
      `</svg>`
    );
  }
  return (
    `<svg class="shell-svg shut ${cls}" viewBox="0 0 60 80" aria-hidden="true">` +
    `<ellipse cx="30" cy="40" rx="21" ry="31" fill="#e9c48d" stroke="${INK}" stroke-width="3"/>` +
    `<ellipse cx="30" cy="38" rx="15" ry="24" fill="#f3d6a6"/>` +
    `<g fill="#b9824a" opacity=".75"><circle cx="24" cy="26" r="3"/><circle cx="35" cy="33" r="2.6"/><circle cx="27" cy="45" r="3.2"/><circle cx="37" cy="52" r="2.4"/><circle cx="22" cy="58" r="2.2"/><circle cx="33" cy="20" r="2"/></g>` +
    `<path d="M22 20c-3 6-4 13-3 20" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".6"/>` +
    `</svg>`
  );
}

/** A paisley (buta) motif in a 40×40 box. */
const BUTA = '<path d="M20 36c-9 0-15-6-15-14S11 6 22 4c-4 4-4 9-1 12 6 0 12 4 12 10s-5 10-13 10z" fill="none" stroke="' + GOLD + '" stroke-width="1.8"/><circle cx="18" cy="24" r="4" fill="none" stroke="' + GOLD + '" stroke-width="1.4"/><circle cx="18" cy="24" r="1.4" fill="' + GOLD + '"/>';

/** The lotus on the Charkoni, drawn round (cx, cy) with radius r. */
function lotus(cx, cy, r) {
  let petals = '';
  for (let k = 0; k < 8; k++) {
    const a = (k * 45 * Math.PI) / 180;
    const x = cx + Math.cos(a) * r * 0.5;
    const y = cy + Math.sin(a) * r * 0.5;
    petals += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${(r * 0.42).toFixed(2)}" ry="${(r * 0.2).toFixed(2)}" transform="rotate(${k * 45} ${x.toFixed(2)} ${y.toFixed(2)})"/>`;
  }
  return `<g fill="#ffd27a" stroke="${GOLD}" stroke-width=".5" opacity=".9">${petals}</g><circle cx="${cx}" cy="${cy}" r="${(r * 0.26).toFixed(2)}" fill="${GOLD}" stroke="#fff4df" stroke-width=".6"/>`;
}

/**
 * The whole cloth, 19×19 cells of 10 units. `seats`: the seat of each player (their middle column
 * gets their light colour and the Charkoni's triangle in front of it their colour).
 */
export function boardSvg(seats = [0, 2], { cls = '' } = {}) {
  const U = 10;
  const lane = {}; // cell -> tint for the players' middle columns
  const seatTint = {};
  seats.forEach((seat, k) => {
    seatTint[seat] = LOOKS[k];
    for (let pos = 1; pos <= 8; pos++) lane[PATHS[seat][pos]] = LOOKS[k].light;
  });
  let cells = '';
  let crosses = '';
  for (const cell of TRACK) {
    const x = colOf(cell) * U;
    const y = rowOf(cell) * U;
    const castle = isCastle(cell);
    const fill = castle ? '#ffd27a' : lane[cell] || SQUARE;
    cells += `<rect x="${x + 0.6}" y="${y + 0.6}" width="${U - 1.2}" height="${U - 1.2}" rx="1.6" fill="${fill}"/>`;
    if (castle) crosses += `M${x + 2.6} ${y + 2.6}L${x + 7.4} ${y + 7.4}M${x + 7.4} ${y + 2.6}L${x + 2.6} ${y + 7.4}`;
  }
  // the Charkoni: four triangles, one in front of each arm, the lotus in the middle
  const c0 = 8 * U;
  const c1 = 11 * U;
  const m = 9.5 * U;
  const tri = [
    [0, `M${c0} ${c1}L${c1} ${c1}L${m} ${m}z`],
    [1, `M${c1} ${c1}L${c1} ${c0}L${m} ${m}z`],
    [2, `M${c1} ${c0}L${c0} ${c0}L${m} ${m}z`],
    [3, `M${c0} ${c0}L${c0} ${c1}L${m} ${m}z`],
  ]
    .map(([seat, d]) => `<path d="${d}" fill="${seatTint[seat] ? seatTint[seat].fill : '#4a3a9a'}" opacity="${seatTint[seat] ? 0.5 : 0.25}"/>`)
    .join('');
  // butas in the four corners of the cloth, turned towards the middle
  const corners = [
    [16, 16, 0],
    [134, 16, 90],
    [134, 134, 180],
    [16, 134, 270],
  ]
    .map(([x, y, a]) => `<g transform="translate(${x + 20} ${y + 20}) rotate(${a}) translate(-20 -20)">${BUTA}<g transform="translate(14 14) scale(.45)">${BUTA}</g></g>`)
    .join('');
  return (
    `<svg class="pachisi-cloth ${cls}" viewBox="0 0 ${SIZE * U} ${SIZE * U}" aria-hidden="true">` +
    `<rect x="0" y="0" width="${SIZE * U}" height="${SIZE * U}" rx="12" fill="${CLOTH}"/>` +
    `<rect x="3" y="3" width="${SIZE * U - 6}" height="${SIZE * U - 6}" rx="9" fill="none" stroke="${GOLD}" stroke-width="1" stroke-dasharray="2.4 1.8" opacity=".85"/>` +
    corners +
    // the arms: a darker band under the squares and a gold stitch round them
    `<path d="M${8 * U - 1} -1h${3 * U + 2}v${8 * U + 1}h${8 * U + 1}v${3 * U + 2}h-${8 * U + 1}v${8 * U + 1}h-${3 * U + 2}v-${8 * U + 1}h-${8 * U + 1}v-${3 * U + 2}h${8 * U + 1}z" fill="${CLOTH_DARK}" transform="translate(0 0)" opacity=".55"/>` +
    `<g stroke="${GOLD}" stroke-width=".7">${cells}</g>` +
    `<path d="${crosses}" stroke="${CLOTH}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<rect x="${c0}" y="${c0}" width="${3 * U}" height="${3 * U}" fill="#3b2f8f"/>` +
    tri +
    `<path d="M${c0} ${c0}L${c1} ${c1}M${c1} ${c0}L${c0} ${c1}" stroke="${GOLD}" stroke-width=".7" opacity=".8"/>` +
    lotus(m, m, 7) +
    `<rect x="${c0}" y="${c0}" width="${3 * U}" height="${3 * U}" fill="none" stroke="${GOLD}" stroke-width="1.2"/>` +
    `</svg>`
  );
}

/** A small cloth for the menu and the home tile: the cross, the castles, a few pawns. */
export function miniBoardSvg({ cls = '', pawns = true } = {}) {
  const U = 10;
  let cells = '';
  for (const cell of TRACK) {
    const castle = CASTLES.includes(cell);
    cells += `<rect x="${colOf(cell) * U + 0.8}" y="${rowOf(cell) * U + 0.8}" width="8.4" height="8.4" rx="2" fill="${castle ? '#ffd27a' : SQUARE}"/>`;
  }
  const at = (k, cell, s = 22) => pawnSvg(k).replace('<svg ', `<svg x="${colOf(cell) * U + 5 - s / 2}" y="${rowOf(cell) * U + 4 - s / 2}" width="${s}" height="${s}" `);
  return (
    `<svg class="mini-pachisi ${cls}" viewBox="0 0 190 190" aria-hidden="true">` +
    `<rect x="0" y="0" width="190" height="190" rx="26" fill="${CLOTH}"/>` +
    `<g>${cells}</g>` +
    `<rect x="80" y="80" width="30" height="30" fill="#3b2f8f"/>` +
    lotus(95, 95, 9) +
    (pawns ? at(0, PATHS[0][20], 30) + at(1, PATHS[2][30], 30) + at(2, PATHS[0][45], 30) + at(3, PATHS[2][60], 30) : '') +
    `</svg>`
  );
}

/** The home tile: the cloth with a sun pawn and a lotus pawn, and two shells. */
export function tileSvg() {
  const place = (svg, x, y, w, h = w) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
  return (
    `<svg class="pachisi-tile" viewBox="0 0 100 100" aria-hidden="true">` +
    place(miniBoardSvg({ pawns: false }), 0, 0, 100) +
    place(pawnSvg(0), 18, 40, 34) +
    place(pawnSvg(3), 50, 40, 34) +
    place(shellSvg(true), 60, 6, 14, 19) +
    place(shellSvg(false), 76, 8, 14, 19) +
    `</svg>`
  );
}
