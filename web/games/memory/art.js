// Memory's cards, drawn in code (SVG). Three sets of pictures ("themes"), each with at least 10
// pictures so every board can be dealt (4×5 needs 10 pairs):
//   fruit   the Picturedoku fruit (apple, banana, grapes, carrot, pear, mushroom) and four new
//           ones drawn here in the same style (strawberry, cherries, lemon, melon)       (free)
//   book    the coloured-in Kleurplaten pictures that Letters uses (sun, house, fish …)
//   shapes  ten friendly shapes, each its own shape AND colour (heart, star, circle …)
// Every picture differs from the others in its theme by shape and colour, so children who see
// colours differently can still find the pairs.
import { pictureSvg as fruitSvg } from '../picturedoku/art.js';
import { wordPictureSvg } from '../letters/art.js';

const INK = '#3b2a22';
const LINE = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const SHINE = 'fill="#fff" opacity="0.55"';

// the new fruit, viewBox 48×48 like Picturedoku's
const NEW_FRUIT = {
  strawberry:
    `<path d="M24 42.5C12.5 35 7.5 25 10.5 18.2 13 12.6 19.6 12.4 24 15.4c4.4-3 11-2.8 13.5 2.8 3 6.8-2 16.8-13.5 24.3z" fill="#e5484d" ${LINE}/>` +
    `<path d="M24 16.5l-4.6-5.6 1.4 6.2-6.6-1.4 5.4 3.6M24 16.5l4.6-5.6-1.4 6.2 6.6-1.4-5.4 3.6M24 16.5V7" fill="#4cc38a" stroke="#2f9e5b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    [[17, 24], [24, 23], [31, 24], [20, 30], [28, 30], [24, 36]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.3" ry="1.9" fill="#ffe08a"/>`).join(''),
  cherries:
    `<path d="M15.5 30.5C17 21 21 12 27.5 7.5M32.5 32C31 22 29.5 13 27.5 7.5" fill="none" stroke="#3f8a3a" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M27.5 8c3.6-3.4 9.6-3.2 12.6.2-3.8 3.4-9.2 3.4-12.6-.2z" fill="#4cc38a" ${LINE}/>` +
    `<circle cx="15" cy="34" r="8" fill="#c81e3a" ${LINE}/><circle cx="12.4" cy="31.2" r="2" ${SHINE}/>` +
    `<circle cx="33" cy="35" r="8" fill="#c81e3a" ${LINE}/><circle cx="30.4" cy="32.2" r="2" ${SHINE}/>`,
  lemon:
    `<path d="M7 27.5c-1.6-.4-2-2.4-.6-3.4l1.6-1.2C10.6 14 18 10 26 10.4c7.6.4 13.6 5 15.4 11.6l1.4 1.6c1.2 1.2.4 3.2-1.2 3.2-2.4 8.2-10 12.6-18 12.4-8-.2-14.8-4.6-16.6-11.7z" fill="#fff06b" ${LINE}/>` +
    `<ellipse cx="17" cy="20" rx="4.4" ry="2.4" transform="rotate(-25 17 20)" ${SHINE}/>` +
    [[20, 27], [26, 24], [31, 29]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="#d8c43a"/>`).join(''),
  melon:
    `<path d="M5 18.5h38c0 12-8.4 21.5-19 21.5S5 30.5 5 18.5z" fill="#2f9e5b" ${LINE}/>` +
    `<path d="M9 18.5h30c0 9.4-6.6 17-15 17s-15-7.6-15-17z" fill="#ff6b7a"/>` +
    `<path d="M9 18.5h30" stroke="#d7f5c2" stroke-width="2"/>` +
    [[16, 23], [24, 25], [32, 23], [20, 30], [28, 30]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.3" ry="2" fill="${INK}"/>`).join(''),
};
const FRUIT_IDS = { apple: 1, banana: 2, grapes: 3, carrot: 4, pear: 5, mushroom: 6 };

// the shapes, viewBox 48×48, each with a little face
const face = (y = 24, x = 24) =>
  `<circle cx="${x - 4.5}" cy="${y}" r="2.1" fill="${INK}"/><circle cx="${x + 4.5}" cy="${y}" r="2.1" fill="${INK}"/>` +
  `<path d="M${x - 4} ${y + 4.6}q4 3.6 8 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
const SHAPES = {
  heart: `<path d="M24 41C10 31 5 23 7 16c2-7 11-8 17-1 6-7 15-6 17 1 2 7-3 15-17 25z" fill="#e5484d" ${LINE}/>${face(22)}`,
  star: `<path d="M24 6.5l5.1 12 13 1.1-9.9 8.6 3 12.7L24 34.1l-11.2 6.8 3-12.7-9.9-8.6 13-1.1z" fill="#ffd23f" ${LINE}/>${face(25)}`,
  circle: `<circle cx="24" cy="24" r="17" fill="#4c95f5" ${LINE}/>${face(23)}`,
  triangle: `<path d="M24 6.5 42 39.5H6z" fill="#4cc38a" ${LINE}/>${face(29)}`,
  square: `<rect x="8" y="8" width="32" height="32" rx="5" fill="#ff8a3d" ${LINE}/>${face(23)}`,
  diamond: `<path d="M24 4 43 24 24 44 5 24z" fill="#8e5bd6" ${LINE}/>${face(23)}`,
  moon:
    `<path d="M20.76 6.04A18 18 0 1 0 39.1 29.63 15 15 0 0 1 20.76 6.04z" fill="#ff9ccf" ${LINE}/>` +
    `<path d="M10 23q2.2 2 4.4 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M11 30q3 2.6 6 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
  cloud: `<path d="M13 37a8 8 0 0 1-1.6-15.8A10.5 10.5 0 0 1 31 15.5a8.5 8.5 0 0 1 9 8.6A6.6 6.6 0 0 1 37.4 37z" fill="#d6ecff" ${LINE}/>${face(27)}`,
  drop: `<path d="M24 5S9 21.5 9 30.5a15 15 0 0 0 30 0C39 21.5 24 5 24 5z" fill="#2bb3a6" ${LINE}/>${face(30)}`,
  hexagon: `<path d="M42 24 33 39.6H15L6 24l9-15.6h18z" fill="#b0723a" ${LINE}/>${face(23)}`,
};

export const THEMES = Object.freeze({
  fruit: Object.freeze(['apple', 'banana', 'grapes', 'carrot', 'pear', 'mushroom', 'strawberry', 'cherries', 'lemon', 'melon']),
  book: Object.freeze(['sun', 'house', 'fish', 'flower', 'dog', 'car', 'cat', 'bird', 'boat', 'turtle', 'elephant', 'rocket']),
  shapes: Object.freeze(Object.keys(SHAPES)),
});
export const THEME_IDS = Object.freeze(Object.keys(THEMES));
/** The picture a theme shows on its menu button. */
export const THEME_SAMPLE = Object.freeze({ fruit: 'strawberry', book: 'turtle', shapes: 'star' });

/** A card's picture as SVG (square). */
export function cardPictureSvg(id, { cls = '' } = {}) {
  if (FRUIT_IDS[id]) return fruitSvg(FRUIT_IDS[id], { cls: `mpic ${cls}` });
  const inner = NEW_FRUIT[id] || SHAPES[id];
  if (inner) return `<svg class="pic mpic ${cls}" viewBox="0 0 48 48" aria-hidden="true">${inner}</svg>`;
  return wordPictureSvg(id, { cls: `mpic ${cls}` });
}

/** The back of a card: lilac with soft bubbles and a white rim (the same on every card). */
export function cardBackSvg() {
  const dots = [
    [26, 28, 9], [62, 22, 6], [78, 50, 10], [40, 60, 12], [70, 80, 7], [22, 78, 6], [50, 40, 4],
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".22"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.28}" fill="#fff" opacity=".5"/>`)
    .join('');
  return `<svg class="mback" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="100" height="100" fill="#7b6cf0"/>${dots}<rect x="7" y="7" width="86" height="86" rx="12" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/></svg>`;
}

/** A board's shape for the menu: cols × rows little cards, two of them turned over. */
export function sizeSvg(cols, rows) {
  const s = 12;
  const g = 3;
  const w = cols * s + (cols - 1) * g;
  const h = rows * s + (rows - 1) * g;
  let out = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const up = (r === 0 && c === 0) || (r === rows - 1 && c === cols - 1);
      out += `<rect x="${c * (s + g)}" y="${r * (s + g)}" width="${s}" height="${s}" rx="3" fill="${up ? '#fff' : '#7b6cf0'}" stroke="${up ? '#e5484d' : '#5b4bd6'}" stroke-width="1.6"/>`;
      if (up) out += `<circle cx="${c * (s + g) + s / 2}" cy="${r * (s + g) + s / 2}" r="3.2" fill="#e5484d"/>`;
    }
  }
  return `<svg class="msize" viewBox="-2 -2 ${w + 4} ${h + 4}" aria-hidden="true">${out}</svg>`;
}

/** The home-screen tile: a pair of strawberries turned over and one card still face down. */
export function tileSvg() {
  const card = (x, y, r, inner) =>
    `<g transform="rotate(${r} ${x + 22} ${y + 28})"><rect x="${x}" y="${y}" width="44" height="56" rx="9" fill="#fff" stroke="#5b4bd6" stroke-width="3"/>${inner(x, y)}</g>`;
  const fruit = (x, y) => `<svg x="${x + 4}" y="${y + 10}" width="36" height="36" viewBox="0 0 48 48">${NEW_FRUIT.strawberry}</svg>`;
  const back = (x, y) =>
    `<rect x="${x + 4}" y="${y + 4}" width="36" height="48" rx="6" fill="#7b6cf0"/><circle cx="${x + 16}" cy="${y + 18}" r="6" fill="#fff" opacity=".3"/><circle cx="${x + 28}" cy="${y + 36}" r="8" fill="#fff" opacity=".3"/>`;
  return `<svg viewBox="0 0 130 100" aria-hidden="true">${card(6, 26, -12, fruit)}${card(43, 10, 2, back)}${card(80, 28, 12, fruit)}</svg>`;
}
