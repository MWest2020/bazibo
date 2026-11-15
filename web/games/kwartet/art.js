// Kwartet's cards, drawn in code (SVG). Eight sets of four, each card with its own picture:
// the Picturedoku fruit, the coloured-in Kleurplaten pictures (as Letters uses them), the
// Dogudoku puppies, and new pictures drawn here in the Picturedoku style (viewBox 48×48, a soft
// dark outline). Within a set the pictures differ by shape and colour; every set has its own
// colour and its name on the card, so colour is never the only cue.
import { pictureSvg as fruitSvg } from '../picturedoku/art.js';
import { wordPictureSvg } from '../letters/art.js';
import { dogSvg } from '../dogudoku/art.js';

const INK = '#3b2a22';
const LINE = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const SHINE = 'fill="#fff" opacity="0.55"';
const eyes = (x1, x2, y, r = 1.8) => `<circle cx="${x1}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x2}" cy="${y}" r="${r}" fill="${INK}"/>`;

const NEW = {
  train:
    `<path d="M3 39.5h42" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` +
    `<rect x="9" y="7" width="6" height="11" rx="1.5" fill="#5c4a40" ${LINE}/>` +
    `<rect x="5" y="17" width="23" height="16" rx="4" fill="#e5484d" ${LINE}/>` +
    `<rect x="26" y="10" width="16" height="23" rx="2.5" fill="#4c95f5" ${LINE}/>` +
    `<rect x="29.5" y="13.5" width="9" height="8" rx="2" fill="#d6ecff" ${LINE}/>` +
    `<path d="M5 25h23" stroke="#ffd23f" stroke-width="2.6"/>` +
    [11, 22, 35].map((x) => `<circle cx="${x}" cy="35" r="4.6" fill="${INK}"/><circle cx="${x}" cy="35" r="1.6" fill="#c8c0b8"/>`).join(''),
  ladybug:
    `<path d="M17 12.5 13 6.5M31 12.5l4-6" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M14.5 17a9.5 8 0 0 1 19 0z" fill="${INK}"/>` +
    `<circle cx="24" cy="28" r="15" fill="#e5484d" ${LINE}/>` +
    `<path d="M24 13v30" stroke="${INK}" stroke-width="2"/>` +
    [[16.5, 24, 3], [31.5, 24, 3], [17, 34, 2.6], [31, 34, 2.6], [24, 39.5, 0]].filter((d) => d[2]).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`).join('') +
    `<circle cx="20.5" cy="13.5" r="1.4" fill="#fff"/><circle cx="27.5" cy="13.5" r="1.4" fill="#fff"/>`,
  lion:
    Array.from({ length: 12 }, (_, k) => {
      const a = (k * 30 * Math.PI) / 180;
      return `<circle cx="${(24 + Math.cos(a) * 14.5).toFixed(1)}" cy="${(25 + Math.sin(a) * 14.5).toFixed(1)}" r="6.6" fill="#d9822b" ${LINE}/>`;
    }).join('') +
    `<circle cx="24" cy="25" r="14" fill="#d9822b"/>` +
    `<circle cx="24" cy="25.5" r="11.5" fill="#ffd27a" ${LINE}/>` +
    eyes(19.5, 28.5, 23) +
    `<path d="M21.6 28.2h4.8L24 31z" fill="${INK}"/><path d="M24 31v2M24 33c-1.2 1.6-3.4 1.6-4.4.4M24 33c1.2 1.6 3.4 1.6 4.4.4" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
  giraffe:
    `<path d="M14.5 44 19 18.5h7.5L24.5 44z" fill="#ffc94d" ${LINE}/>` +
    `<circle cx="20" cy="27" r="1.8" fill="#b9772e"/><circle cx="22.5" cy="35" r="2.2" fill="#b9772e"/><circle cx="19" cy="40" r="1.6" fill="#b9772e"/>` +
    `<path d="M24 9.5V4.5M31 9.5V4.5" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="4.2" r="2" fill="#b9772e"/><circle cx="31" cy="4.2" r="2" fill="#b9772e"/>` +
    `<path d="M16.5 15.5c0-4.4 3.6-7.4 9-7.4h3.4c5.6 0 10.6 3.4 10.6 8 0 3.6-2.8 5.4-6.2 5.4H22c-3.4 0-5.5-2.2-5.5-6z" fill="#ffc94d" ${LINE}/>` +
    `<path d="M16.8 13.5 11 11.2l1.6 5" fill="#ffc94d" ${LINE}/>` +
    `<circle cx="26" cy="13.5" r="1.9" fill="${INK}"/><circle cx="36.5" cy="17" r="1" fill="${INK}"/>`,
  cloud:
    `<path d="M12.5 36.5a8 8 0 0 1-1.4-15.9A11 11 0 0 1 31.5 15a9 9 0 0 1 9.5 9.4 6.6 6.6 0 0 1-2.4 12.1z" fill="#f2f7ff" ${LINE}/>` +
    `<path d="M15 24.5a6.5 6.5 0 0 1 6-4.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M14 37.5h24" stroke="#9cc3f0" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
  rainbow:
    ['#e5484d', '#ff8a3d', '#ffd23f', '#4cc38a', '#4c95f5', '#8e5bd6']
      .map((c, k) => `<path d="M${5 + k * 2.6} 35a${19 - k * 2.6} ${19 - k * 2.6} 0 0 1 ${38 - k * 5.2} 0" fill="none" stroke="${c}" stroke-width="2.8"/>`)
      .join('') +
    `<path d="M3 38.5a4.5 4.5 0 0 1 3.5-6.5 5 5 0 0 1 8.8 1.4A3.6 3.6 0 0 1 14.6 38.5z" fill="#fff" ${LINE}/>` +
    `<path d="M33.4 38.5a3.6 3.6 0 0 1-.7-5.1 5 5 0 0 1 8.8-1.4A4.5 4.5 0 0 1 45 38.5z" fill="#fff" ${LINE}/>`,
  snowman:
    `<circle cx="24" cy="33" r="11" fill="#fff" ${LINE}/>` +
    `<circle cx="24" cy="17.5" r="8" fill="#fff" ${LINE}/>` +
    `<path d="M16 23.5c5 2.6 11 2.6 16 0l1 3.4c-6 2.4-12 2.4-18 0z" fill="#e5484d" ${LINE}/>` +
    `<rect x="17" y="3.5" width="14" height="7" rx="1.5" fill="${INK}"/><rect x="14" y="9.5" width="20" height="3" rx="1.5" fill="${INK}"/>` +
    eyes(21, 27, 16.5, 1.5) +
    `<path d="M24 19l6 1.6-6 1.2z" fill="#ff8a3d" stroke="#c95f17" stroke-width="1" stroke-linejoin="round"/>` +
    `<circle cx="24" cy="31" r="1.5" fill="${INK}"/><circle cx="24" cy="36.5" r="1.5" fill="${INK}"/>`,
  teddy:
    `<circle cx="13.5" cy="11.5" r="5.5" fill="#b0723a" ${LINE}/><circle cx="34.5" cy="11.5" r="5.5" fill="#b0723a" ${LINE}/>` +
    `<circle cx="13.5" cy="11.5" r="2.4" fill="#e9b98a"/><circle cx="34.5" cy="11.5" r="2.4" fill="#e9b98a"/>` +
    `<ellipse cx="24" cy="38" rx="11" ry="8" fill="#b0723a" ${LINE}/>` +
    `<circle cx="24" cy="20" r="12.5" fill="#b0723a" ${LINE}/>` +
    `<ellipse cx="24" cy="25" rx="6" ry="4.6" fill="#e9b98a"/>` +
    eyes(19.2, 28.8, 17.8) +
    `<ellipse cx="24" cy="23.2" rx="2.4" ry="1.7" fill="${INK}"/><path d="M24 25v1.8M24 26.8c-1 1.2-2.6 1.2-3.4.2M24 26.8c1 1.2 2.6 1.2 3.4.2" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M17.5 33.5 24 36.5l6.5-3-1 4-5.5 1-5.5-1z" fill="#e5484d" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`,
  kite:
    `<path d="M26 26c-2 6 4 8 1 13s-6 3-8 6" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M24.5 34.5l-3.4-1.2 1 3.4zM22 41l-3.6-.4 1.6 3.2z" fill="#4cc38a" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M26 3.5 39 15 26 27 13 15z" fill="#ffd23f" ${LINE}/>` +
    `<path d="M26 3.5 39 15H26zM26 15v12L13 15z" fill="#4c95f5"/>` +
    `<path d="M26 3.5 39 15 26 27 13 15zM26 3.5V27M13 15h26" fill="none" ${LINE}/>`,
  blocks:
    `<rect x="5" y="25" width="18" height="18" rx="2.5" fill="#e5484d" ${LINE}/>` +
    `<rect x="25" y="25" width="18" height="18" rx="2.5" fill="#4c95f5" ${LINE}/>` +
    `<rect x="15" y="6" width="18" height="18" rx="2.5" fill="#ffd23f" ${LINE}/>` +
    `<path d="M24 9.5l2 4.2 4.6.6-3.4 3.2.9 4.5L24 19.8 19.9 22l.9-4.5-3.4-3.2 4.6-.6z" fill="#fff" opacity=".9"/>` +
    `<circle cx="14" cy="34" r="4.6" fill="#fff" opacity=".9"/>` +
    `<path d="M34 29.6 38.4 38h-8.8z" fill="#fff" opacity=".9"/>`,
};

const svg48 = (inner, cls) => `<svg class="pic ${cls}" viewBox="0 0 48 48" aria-hidden="true">${inner}</svg>`;

/** The sets in their order on the menu and in a hand. `free`: in the free game of 4 sets. */
export const SETS = Object.freeze([
  { id: 'fruit', color: '#e5484d', free: true, cards: ['apple', 'banana', 'grapes', 'pear'] },
  { id: 'pets', color: '#ff8a3d', free: true, cards: ['dog', 'cat', 'bird', 'fish'] },
  { id: 'vehicles', color: '#3d7fe0', free: true, cards: ['car', 'boat', 'train', 'rocket'] },
  { id: 'garden', color: '#2f9e5b', free: true, cards: ['flower', 'mushroom', 'ladybug', 'carrot'] },
  { id: 'puppies', color: '#a8652c', free: false, cards: ['beagle', 'dalmatian', 'poodle', 'pug'] },
  { id: 'zoo', color: '#d49b00', free: false, cards: ['elephant', 'lion', 'giraffe', 'turtle'] },
  { id: 'weather', color: '#1f9e93', free: false, cards: ['sun', 'cloud', 'rainbow', 'snowman'] },
  { id: 'toys', color: '#8e5bd6', free: false, cards: ['teddy', 'kite', 'blocks', 'ball'] },
].map((s) => Object.freeze({ ...s, cards: Object.freeze(s.cards) })));
export const SET_IDS = Object.freeze(SETS.map((s) => s.id));
export const setById = (id) => SETS.find((s) => s.id === id);

const FRUIT = { apple: 1, banana: 2, grapes: 3, carrot: 4, pear: 5, mushroom: 6, flower: 7, ball: 9 };
const DOGS = { beagle: 0, dalmatian: 1, pug: 4, poodle: 5 };

/** The picture id of a card ('fruit:2' -> 'grapes'). */
export function pictureOf(card) {
  const i = card.lastIndexOf(':');
  return setById(card.slice(0, i))?.cards[Number(card.slice(i + 1))] || '';
}

/** A picture as SVG (square). */
export function pictureSvg(id, { cls = '' } = {}) {
  if (NEW[id]) return svg48(NEW[id], `kpic ${cls}`);
  if (id in DOGS) return dogSvg(DOGS[id], { cls: `kpic ${cls}` });
  // the Kleurplaten flower and fish go to the coloured pages; the Picturedoku ones elsewhere
  if (FRUIT[id] && id !== 'flower') return fruitSvg(FRUIT[id], { cls: `kpic ${cls}` });
  return wordPictureSvg(id, { cls: `kpic ${cls}` }) || (FRUIT[id] ? fruitSvg(FRUIT[id], { cls: `kpic ${cls}` }) : '');
}

/** A computer player's face: the robot, in its own colour. */
export const CPU_COLORS = Object.freeze(['#b9e3ff', '#ffd6a8', '#d4f5c4']);
export function robotSvg(color = CPU_COLORS[0], { cls = '' } = {}) {
  return (
    `<svg class="robot ${cls}" viewBox="0 0 48 48" aria-hidden="true">` +
    `<path d="M24 5v6" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="5" r="2.6" fill="#ffc531" stroke="${INK}" stroke-width="1.8"/>` +
    `<rect x="9" y="11" width="30" height="26" rx="9" fill="${color}" stroke="${INK}" stroke-width="2.4"/>` +
    `<circle cx="18" cy="22" r="4" fill="#fff" stroke="${INK}" stroke-width="1.8"/><circle cx="30" cy="22" r="4" fill="#fff" stroke="${INK}" stroke-width="1.8"/>` +
    `<circle cx="18.6" cy="22.6" r="1.8" fill="${INK}"/><circle cx="30.6" cy="22.6" r="1.8" fill="${INK}"/>` +
    `<path d="M18 30c3.6 3 8.4 3 12 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<rect x="16" y="37" width="16" height="6" rx="2" fill="${color}" stroke="${INK}" stroke-width="1.8"/>` +
    `</svg>`
  );
}

/** The back of a card, for the card counts next to the players. */
export const CARD_BACK = `<svg class="kback" viewBox="0 0 30 40" aria-hidden="true"><rect x="1.5" y="1.5" width="27" height="37" rx="5" fill="#7b6cf0" stroke="#5b4bd6" stroke-width="2"/><circle cx="11" cy="13" r="4" fill="#fff" opacity=".35"/><circle cx="19" cy="26" r="6" fill="#fff" opacity=".3"/></svg>`;

/** The home-screen tile: a fan of four fruit cards. */
export function tileSvg() {
  const card = (r, x, pic, color) =>
    `<g transform="rotate(${r} 60 96)"><rect x="${x}" y="22" width="40" height="56" rx="7" fill="#fff" stroke="${color}" stroke-width="3"/>` +
    `<rect x="${x + 1.5}" y="23.5" width="37" height="10" rx="5" fill="${color}"/>` +
    `<svg x="${x + 5}" y="36" width="30" height="30" viewBox="0 0 48 48">${pic}</svg></g>`;
  const inner = (id) => fruitSvg(FRUIT[id]).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  return `<svg viewBox="0 0 120 100" aria-hidden="true">${card(-24, 22, inner('apple'), '#e5484d')}${card(-8, 32, inner('banana'), '#e5484d')}${card(8, 46, inner('grapes'), '#e5484d')}${card(24, 56, inner('pear'), '#e5484d')}</svg>`;
}
