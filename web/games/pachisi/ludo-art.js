// Ludo's pictures, all our own and drawn in code (SVG), in Bazibo's soft style: rounded squares,
// the app's ink outline, soft colours. The board is the public-domain cross of 40 squares with four
// yards and four home rows, drawn on a pale sky with a flower in the middle. It is not a copy of
// any publisher's board or artwork (no yellow board with round holes, no red/yellow/green/blue
// corners). The pawns, their colours and their symbols (sun, moon, star, lotus) are Pachisi's
// (art.js), so a player looks the same in both modes and can be told apart without colours.
import { SIZE, TRACK, STARTS, WAYS, TRACK_LEN, rowOf, colOf } from './ludo-rules.js';
import { LOOKS, pawnSvg } from './art.js';

const INK = '#2b2370';
const SKY = '#e4f1ff';
const SQUARE = '#fffaf0';
const NEUTRAL = '#ece8fb';

/** A player's symbol, small, round (cx, cy) with radius r (the same shapes as on the pawns). */
function mark(id, cx, cy, r, colour) {
  const s = r / 20;
  const at = `transform="translate(${cx} ${cy}) scale(${s.toFixed(3)}) translate(-50 -50)"`;
  if (id === 'sun') {
    let rays = '';
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      rays += `M${(50 + Math.cos(a) * 12).toFixed(1)} ${(50 + Math.sin(a) * 12).toFixed(1)}L${(50 + Math.cos(a) * 19).toFixed(1)} ${(50 + Math.sin(a) * 19).toFixed(1)}`;
    }
    return `<g ${at}><circle cx="50" cy="50" r="8" fill="${colour}"/><path d="${rays}" stroke="${colour}" stroke-width="4.4" stroke-linecap="round"/></g>`;
  }
  if (id === 'moon') return `<g ${at}><path d="M57 31a20 20 0 1 0 0 38 16 16 0 1 1 0-38z" fill="${colour}"/></g>`;
  if (id === 'star') return `<g ${at}><path d="M50 29l6 13 14 1.6-10.5 9.6 3 14L50 60l-12.5 7.2 3-14L30 43.6l14-1.6z" fill="${colour}" stroke="${colour}" stroke-width="2" stroke-linejoin="round"/></g>`;
  return (
    `<g ${at}><path d="M50 30c7 7 8 17 0 28-8-11-7-21 0-28z" fill="${colour}"/>` +
    `<path d="M31 41c9 1 15 8 17 17-10 1-17-6-17-17zM69 41c-9 1-15 8-17 17 10 1 17-6 17-17z" fill="${colour}"/>` +
    `<path d="M34 62h32c-2 6-8 9-16 9s-14-3-16-9z" fill="${colour}"/></g>`
  );
}

/** The yard of a seat: its corner (in cells), [x0, y0] of the 4×4 block. */
export function yardCorner(seat) {
  return [[0, 7], [0, 0], [7, 0], [7, 7]][seat];
}

/** The middle of a seat's yard, in cell units. */
export function yardCentre(seat) {
  const [x, y] = yardCorner(seat);
  return [x + 2, y + 2];
}

/** The four nests in a yard (cell units): where waiting pawns stand. */
export function yardNests(seat) {
  const [cx, cy] = yardCentre(seat);
  return [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]].map(([dx, dy]) => [cx + dx, cy + dy]);
}

/** A flower of four petals in the players' colours, in the free middle. */
function flower(cx, cy, r, seatLooks) {
  let out = '';
  for (let seat = 0; seat < 4; seat++) {
    const a = 90 + seat * 90; // seat 0 below the middle, then clockwise
    const l = seatLooks[seat];
    const x = cx + Math.cos((a * Math.PI) / 180) * r * 0.5;
    const y = cy + Math.sin((a * Math.PI) / 180) * r * 0.5;
    out += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${(r * 0.5).toFixed(2)}" ry="${(r * 0.3).toFixed(2)}" transform="rotate(${a} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${l ? l.fill : NEUTRAL}" stroke="${INK}" stroke-width=".6"/>`;
  }
  return out + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.28).toFixed(2)}" fill="#ffd27a" stroke="${INK}" stroke-width=".6"/>`;
}

/**
 * The whole board, 11×11 cells of 10 units. `seats`: the seat of each player; their yard, start
 * square and home squares get their colour, the others stay a soft neutral.
 */
export function boardSvg(seats = [0, 2], { cls = '', U = 10 } = {}) {
  const seatLooks = [null, null, null, null];
  seats.forEach((seat, k) => (seatLooks[seat] = LOOKS[k]));
  const sq = (cell, fill, stroke = INK, w = 0.7) => `<rect x="${colOf(cell) * U + 0.7}" y="${rowOf(cell) * U + 0.7}" width="${U - 1.4}" height="${U - 1.4}" rx="${U * 0.26}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
  let yards = '';
  for (let seat = 0; seat < 4; seat++) {
    const l = seatLooks[seat];
    const [x, y] = yardCorner(seat);
    yards += `<rect x="${x * U + 3}" y="${y * U + 3}" width="${4 * U - 6}" height="${4 * U - 6}" rx="${U * 1.1}" fill="${l ? l.light : NEUTRAL}" stroke="${l ? l.dark : '#c9c2ee'}" stroke-width="1.2"/>`;
    for (const [nx, ny] of yardNests(seat)) yards += `<circle cx="${nx * U}" cy="${ny * U}" r="${U * 0.62}" fill="#fff" stroke="${l ? l.fill : '#c9c2ee'}" stroke-width="1.4" opacity=".9"/>`;
  }
  let cells = '';
  for (const cell of TRACK) cells += sq(cell, SQUARE);
  let colour = '';
  for (let seat = 0; seat < 4; seat++) {
    const l = seatLooks[seat];
    for (let pos = TRACK_LEN + 1; pos <= TRACK_LEN + 4; pos++) colour += sq(WAYS[seat][pos], l ? l.light : NEUTRAL, l ? l.dark : '#c9c2ee', 0.9);
    const start = STARTS[seat];
    colour += sq(start, l ? l.fill : NEUTRAL, INK, 0.8);
    if (l) colour += mark(l.id, colOf(start) * U + U / 2, rowOf(start) * U + U / 2, U * 0.3, '#fff');
  }
  const S = SIZE * U;
  return (
    `<svg class="pachisi-cloth ludo-board ${cls}" viewBox="0 0 ${S} ${S}" aria-hidden="true">` +
    `<rect x="0" y="0" width="${S}" height="${S}" rx="${U * 1.2}" fill="${SKY}"/>` +
    `<rect x="1.5" y="1.5" width="${S - 3}" height="${S - 3}" rx="${U * 1.1}" fill="none" stroke="#bcd9f7" stroke-width="1.6"/>` +
    yards +
    `<g>${cells}</g>` +
    colour +
    flower(5.5 * U, 5.5 * U, U * 0.85, seatLooks) +
    `</svg>`
  );
}

/** A die face with `value` pips (1-6), drawn in a 100×100 box. */
export function dieSvg(value = 6, { cls = '' } = {}) {
  const pips = PIPS[value] || PIPS[6];
  return (
    `<svg class="die-svg ${cls}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<rect x="7" y="7" width="86" height="86" rx="22" fill="#fff" stroke="${INK}" stroke-width="5"/>` +
    pips.map(([c, r]) => `<circle cx="${28 + c * 22}" cy="${28 + r * 22}" r="9" fill="${INK}"/>`).join('') +
    `</svg>`
  );
}

/** Where the pips of every face lie on a 3×3 grid, [col, row], in reading order. */
export const PIPS = Object.freeze({
  1: [[1, 1]],
  2: [[2, 0], [0, 2]],
  3: [[2, 0], [1, 1], [0, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
});

/** A small board for the menu and the home tile, with a few pawns. */
export function miniBoardSvg({ cls = '', pawns = true } = {}) {
  const U = 10;
  const at = (k, cell, s = 16) => pawnSvg(k).replace('<svg ', `<svg x="${colOf(cell) * U + 5 - s / 2}" y="${rowOf(cell) * U + 3 - s / 2}" width="${s}" height="${s}" `);
  const board = boardSvg([0, 1, 2, 3]).replace('<svg ', '<svg x="0" y="0" width="110" height="110" ');
  return (
    `<svg class="mini-pachisi mini-ludo ${cls}" viewBox="0 0 110 110" aria-hidden="true">` +
    board +
    (pawns ? at(0, WAYS[0][8]) + at(1, WAYS[1][20]) + at(2, WAYS[2][5]) + at(3, WAYS[3][31]) : '') +
    `</svg>`
  );
}

/** The home tile: the board with a sun pawn and a lotus pawn, and the die. */
export function tileSvg() {
  const place = (svg, x, y, w, h = w) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
  return (
    `<svg class="pachisi-tile ludo-tile" viewBox="0 0 100 100" aria-hidden="true">` +
    place(miniBoardSvg({ pawns: false }), 0, 0, 100) +
    place(pawnSvg(0), 14, 44, 32) +
    place(pawnSvg(3), 52, 44, 32) +
    place(dieSvg(5), 64, 8, 26) +
    `</svg>`
  );
}
