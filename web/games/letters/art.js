// Letters' pictures: the coloured-in drawings from Kleurplaten and the fruit from Picturedoku,
// so the whole app shares one drawing style. Nothing new is loaded.
import { PICTURES as PAGES } from '../kleuren/pictures.js';
import { pageSvg } from '../kleuren/art.js';
import { pictureSvg as fruitSvg } from '../picturedoku/art.js';

// palette indices from Kleurplaten: 0 red, 1 orange, 2 yellow, 3 light green, 4 green, 5 teal,
// 6 light blue, 7 blue, 8 purple, 9 pink, 10 brown, 11-13 skin, 14 almost black, 15 white
const all = (ids, c) => Object.fromEntries(ids.map((id) => [id, c]));
const PAGE_PICTURES = {
  sun: ['zon', { ...all(['ray0', 'ray1', 'ray2', 'ray3', 'ray4', 'ray5', 'ray6', 'ray7'], 1), face: 2 }],
  house: ['huis', { ground: 3, chimney: 0, wall: 2, roof: 0, door: 10, win1: 6, win2: 6 }],
  fish: ['vis', { fin1: 1, fin2: 1, tail: 1, body: 6, stripe1: 7, stripe2: 7, bub1: 6, bub2: 6, bub3: 6 }],
  flower: ['bloem', { stem: 4, leaf1: 3, leaf2: 3, pot: 1, rim: 0, ...all(['petal0', 'petal1', 'petal2', 'petal3', 'petal4', 'petal5'], 9), heart: 2 }],
  dog: ['puppy', { tail: 10, body: 12, spot: 10, leg1: 12, leg2: 12, collar: 0, tag: 2, head: 12, ear1: 10, ear2: 10, muzzle: 11 }],
  car: ['auto', { road: 3, cabin: 0, win1: 6, win2: 6, body: 0, light: 2, wheel1: 14, wheel2: 14 }],
  cat: ['kat', { tail: 1, body: 1, belly: 11, paw1: 11, paw2: 11, ear1: 1, ear2: 1, head: 1, inner1: 9, inner2: 9, nose: 9 }],
  bird: ['vogel', { branch: 10, leafa: 4, leafb: 3, tail: 7, body: 7, belly: 2, wing: 6, head: 7, beak: 1 }],
  boat: ['boot', { sun: 2, flag: 0, mast: 10, sail2: 2, hull: 0, port1: 6, port2: 6, port3: 6, sea: 7 }],
  turtle: ['schildpad', { ground: 3, ...all(['leg1', 'leg2', 'leg3', 'leg4', 'tail', 'head'], 3), shell: 4, plate1: 3, plate2: 3, plate3: 3, rim: 2 }],
  elephant: ['olifant', { ground: 3, ...all(['leg1', 'leg2', 'leg3', 'leg4', 'tail', 'body', 'trunk', 'head', 'ear'], 6) }],
  rocket: ['raket', { star1: 2, star2: 2, star3: 2, flame1: 1, flame2: 0, flame3: 1, fin1: 0, fin2: 0, fin3: 0, nose: 0, band: 7, ring: 14, glass: 6 }],
};
const FRUIT = { apple: 1, banana: 2, grapes: 3, carrot: 4, pear: 5, mushroom: 6, ball: 9 };

export const PICTURE_IDS = Object.freeze([...Object.keys(PAGE_PICTURES), ...Object.keys(FRUIT)]);

/** The picture for a word, as SVG (square). */
export function wordPictureSvg(picture, { cls = '' } = {}) {
  if (FRUIT[picture]) return fruitSvg(FRUIT[picture], { cls: `letters-pic ${cls}` });
  const p = PAGE_PICTURES[picture];
  const page = p && PAGES.find((x) => x.id === p[0]);
  if (!page) return '';
  return pageSvg({ ...page, viewBox: '0 0 200 200', stroke: 4 }, p[1], { cls: `letters-pic ${cls}` });
}

/** The three kinds of round, as menu pictures. */
export function modeSvg(mode) {
  const tile = (x, y, ch, fill) =>
    `<rect x="${x}" y="${y}" width="30" height="30" rx="8" fill="${fill}" stroke="#3a2f6b" stroke-width="2.4"/>` +
    `<text x="${x + 15}" y="${y + 16}" text-anchor="middle" dominant-baseline="central" font-size="21" font-weight="800" fill="#3a2f6b">${ch}</text>`;
  if (mode === 'tap') {
    return `<svg viewBox="0 0 100 70" aria-hidden="true">${tile(4, 20, 'a', '#ffe9a8')}${tile(35, 20, 'b', '#c9f0d8')}${tile(66, 20, 'k', '#d8e6ff')}
      <path d="M50 64c6-1 10-6 9-12" fill="none" stroke="#3a2f6b" stroke-width="3" stroke-linecap="round"/>
      <path d="M44 6c4 2 6 6 6 10M56 6c-4 2-6 6-6 10" fill="none" stroke="#5b4bd6" stroke-width="3" stroke-linecap="round"/></svg>`;
  }
  if (mode === 'first') {
    return `<svg viewBox="0 0 100 70" aria-hidden="true"><g transform="translate(2 6) scale(.29)">${(wordPictureSvg('sun').match(/<g[\s\S]*<\/g>/) || [''])[0]}</g>${tile(64, 20, 'z', '#ffe9a8')}</svg>`;
  }
  return `<svg viewBox="0 0 100 70" aria-hidden="true">${tile(4, 20, 'k', '#ffd9c2')}${tile(35, 20, 'a', '#ffd9c2')}${tile(66, 20, 't', '#ffd9c2')}
    <path d="M10 60h80" stroke="#3a2f6b" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 6"/></svg>`;
}

/** The home-screen tile: three letter blocks. */
export function tileSvg() {
  const block = (x, y, r, ch, fill) =>
    `<g transform="rotate(${r} ${x + 22} ${y + 22})"><rect x="${x}" y="${y}" width="44" height="44" rx="10" fill="${fill}" stroke="#3a2f6b" stroke-width="3"/>` +
    `<text x="${x + 22}" y="${y + 24}" text-anchor="middle" dominant-baseline="central" font-size="30" font-weight="800" fill="#3a2f6b" font-family="system-ui, sans-serif">${ch}</text></g>`;
  return `<svg viewBox="0 0 120 100" aria-hidden="true">${block(8, 40, -8, 'a', '#ffd23f')}${block(40, 12, 4, 'b', '#7cc6fe')}${block(68, 44, 10, 'c', '#ff8fc7')}</svg>`;
}
