// Tijgers en geitjes' pictures, drawn in code (SVG). Friendly, never scary:
//   goat   a white disc with a goat's face: little curved horns, ears out to the sides, a pink
//          nose and a smile
//   tiger  an orange disc with a cartoon tiger's face: round ears, a few soft stripes, a white
//          muzzle, a smile and no teeth or claws
// White against orange AND horns against round ears with stripes, so the sides are easy to tell
// apart, also for children who see colours differently. A captured goat is never eaten: it hops
// off to the meadow beside the board and falls asleep there (`sleepyGoatSvg`, closed eyes and a
// "z"). The board is a grassy field with the 5×5 lines drawn on it.
import { SIZE, SEGMENTS, rowOf, colOf } from './rules.js';

const INK = '#2b2370';

const GOAT_FACE = (sleeping) =>
  // horns, ears, head
  '<path d="M38 30c-2-9 2-15 8-17-3 5-3 10-1 15z" fill="#e9d3a8" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M62 30c2-9-2-15-8-17 3 5 3 10 1 15z" fill="#e9d3a8" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M30 40c-10-1-16 3-17 8 6 2 13 1 19-3z" fill="#f4ede0" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M70 40c10-1 16 3 17 8-6 2-13 1-19-3z" fill="#f4ede0" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M34 41c0-9 7-15 16-15s16 6 16 15v12c0 11-7 19-16 19s-16-8-16-19z" fill="#fffdf8" stroke="' + INK + '" stroke-width="2.4"/>' +
  '<path d="M18.5 46.5c3 0.8 6 0.6 9-0.6M81.5 46.5c-3 0.8-6 0.6-9-0.6" stroke="#ffb3c6" stroke-width="2.4" stroke-linecap="round"/>' +
  (sleeping
    ? '<path d="M39 47c2 2.4 5 2.4 7 0M54 47c2 2.4 5 2.4 7 0" fill="none" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>'
    : '<ellipse cx="42.5" cy="46" rx="3.4" ry="4" fill="' + INK + '"/><ellipse cx="57.5" cy="46" rx="3.4" ry="4" fill="' + INK + '"/>' +
      '<circle cx="43.6" cy="44.6" r="1.2" fill="#fff"/><circle cx="58.6" cy="44.6" r="1.2" fill="#fff"/>') +
  '<ellipse cx="50" cy="60" rx="10" ry="7.5" fill="#ffe3ea"/>' +
  '<ellipse cx="46.5" cy="58.5" rx="1.6" ry="1.2" fill="' + INK + '"/><ellipse cx="53.5" cy="58.5" rx="1.6" ry="1.2" fill="' + INK + '"/>' +
  '<path d="M45 63.5c3 2.6 7 2.6 10 0" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M47 71.5c1 4 5 4 6 0" fill="#f4ede0" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/>' +
  '<circle cx="37" cy="56" r="3" fill="#ff9db5" opacity=".55"/><circle cx="63" cy="56" r="3" fill="#ff9db5" opacity=".55"/>';

const TIGER_FACE =
  // round ears, head, stripes, muzzle
  '<circle cx="29" cy="32" r="9" fill="#ff9f43" stroke="' + INK + '" stroke-width="2.2"/><circle cx="29" cy="32" r="4.4" fill="#ffd9b0"/>' +
  '<circle cx="71" cy="32" r="9" fill="#ff9f43" stroke="' + INK + '" stroke-width="2.2"/><circle cx="71" cy="32" r="4.4" fill="#ffd9b0"/>' +
  '<ellipse cx="50" cy="52" rx="26" ry="23" fill="#ffad5c" stroke="' + INK + '" stroke-width="2.4"/>' +
  '<path d="M44 30.5c1 3 1 6 0 8M50 29.5v9M56 30.5c-1 3-1 6 0 8" fill="none" stroke="#6b3d1e" stroke-width="2.4" stroke-linecap="round"/>' +
  '<path d="M25 47c3 0 6 1 8 2.6M25.5 55c3-.4 5.5 0 7.5 1M75 47c-3 0-6 1-8 2.6M74.5 55c-3-.4-5.5 0-7.5 1" fill="none" stroke="#6b3d1e" stroke-width="2.2" stroke-linecap="round"/>' +
  '<ellipse cx="50" cy="62" rx="13" ry="9.5" fill="#fff7ec"/>' +
  '<ellipse cx="41" cy="48" rx="3.6" ry="4.2" fill="' + INK + '"/><ellipse cx="59" cy="48" rx="3.6" ry="4.2" fill="' + INK + '"/>' +
  '<circle cx="42.2" cy="46.6" r="1.3" fill="#fff"/><circle cx="60.2" cy="46.6" r="1.3" fill="#fff"/>' +
  '<path d="M46 57.5h8l-4 4z" fill="#ff7a9c" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/>' +
  '<path d="M50 61.5c-1 3-4.5 3.6-6.4 1.6M50 61.5c1 3 4.5 3.6 6.4 1.6" fill="none" stroke="' + INK + '" stroke-width="1.9" stroke-linecap="round"/>' +
  '<circle cx="34" cy="60" r="3.2" fill="#ff7a9c" opacity=".45"/><circle cx="66" cy="60" r="3.2" fill="#ff7a9c" opacity=".45"/>';

const DISCS = {
  goat: { disc: '#e7f7d8', rim: '#6aa84f', ring: '#c4e7a8' },
  tiger: { disc: '#fff1d6', rim: '#d9772b', ring: '#ffd79a' },
};

/** A goat (`kind` 'goat') or a tiger ('tiger') on its disc. */
export function pieceSvg(kind, { cls = '' } = {}) {
  const k = kind === 'tiger' ? 'tiger' : 'goat';
  const d = DISCS[k];
  return (
    `<svg class="piece ${k} ${cls}" data-kind="${k}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<circle cx="50" cy="55" r="44" fill="#000" opacity=".18"/>` +
    `<circle cx="50" cy="50" r="44" fill="${d.disc}" stroke="${d.rim}" stroke-width="5"/>` +
    `<circle cx="50" cy="50" r="37.5" fill="none" stroke="${d.ring}" stroke-width="3"/>` +
    (k === 'tiger' ? TIGER_FACE : GOAT_FACE(false)) +
    `</svg>`
  );
}

/** A goat asleep in the meadow (a captured goat): closed eyes and a little "z". */
export function sleepyGoatSvg({ cls = '' } = {}) {
  return (
    `<svg class="sleepy ${cls}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<ellipse cx="50" cy="86" rx="38" ry="9" fill="#7cc46a" opacity=".55"/>` +
    `<g transform="translate(4 8) scale(.92)">${GOAT_FACE(true)}</g>` +
    `<path d="M74 14h9l-9 10h9" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M86 2h6l-6 7h6" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>` +
    `</svg>`
  );
}

/** An empty spot in the meadow: a tuft of grass. */
export function grassSvg({ cls = '' } = {}) {
  return (
    `<svg class="grass ${cls}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<ellipse cx="50" cy="80" rx="30" ry="7" fill="#7cc46a" opacity=".35"/>` +
    `<path d="M36 80c0-10-4-16-8-20M46 80c0-14 0-20 2-26M56 80c1-12 4-18 9-22M64 80c1-6 3-10 6-12" fill="none" stroke="#5fa04e" stroke-width="4" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** Where point i sits in the board's viewBox (0..100, points 10 apart from 10 to 90). */
export const pointXY = (i) => [10 + colOf(i) * 20, 10 + rowOf(i) * 20];

/** The board's field and lines (the points are buttons laid over it by the screen). */
export function boardSvg({ cls = '' } = {}) {
  const lines = SEGMENTS.map(([a, b]) => {
    const [x1, y1] = pointXY(a);
    const [x2, y2] = pointXY(b);
    return `M${x1} ${y1}L${x2} ${y2}`;
  }).join('');
  let dots = '';
  for (let i = 0; i < SIZE * SIZE; i++) {
    const [x, y] = pointXY(i);
    dots += `<circle cx="${x}" cy="${y}" r="1.7"/>`;
  }
  return (
    `<svg class="bagh-lines ${cls}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">` +
    `<rect x="0" y="0" width="100" height="100" rx="7" fill="#a8dc8a"/>` +
    `<rect x="3" y="3" width="94" height="94" rx="5" fill="#bfe8a3"/>` +
    `<path d="${lines}" fill="none" stroke="#7a5a2e" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>` +
    `<g fill="#7a5a2e" opacity=".8">${dots}</g>` +
    `</svg>`
  );
}

/** A small board for the menu and the home tile, with the four tigers and a few goats. */
export function miniBoardSvg({ cls = '', goats = [7, 11, 13, 17] } = {}) {
  const lines = SEGMENTS.map(([a, b]) => {
    const [x1, y1] = pointXY(a);
    const [x2, y2] = pointXY(b);
    return `M${x1} ${y1}L${x2} ${y2}`;
  }).join('');
  const at = (i, svg, s = 17) => {
    const [x, y] = pointXY(i);
    return svg.replace('<svg ', `<svg x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" `);
  };
  return (
    `<svg class="mini-bagh ${cls}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<rect x="0" y="0" width="100" height="100" rx="12" fill="#a8dc8a"/><rect x="3" y="3" width="94" height="94" rx="10" fill="#bfe8a3"/>` +
    `<path d="${lines}" fill="none" stroke="#7a5a2e" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>` +
    [0, 4, 20, 24].map((i) => at(i, pieceSvg('tiger'))).join('') +
    goats.map((i) => at(i, pieceSvg('goat'))).join('') +
    `</svg>`
  );
}

/** The home tile: a friendly tiger and a goat side by side on the grass. */
export function tileSvg() {
  const place = (svg, x, y, s) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${s}" height="${s}" `);
  return (
    `<svg class="bagh-tile" viewBox="0 0 100 100" aria-hidden="true">` +
    `<rect x="0" y="0" width="100" height="100" rx="16" fill="#a8dc8a"/>` +
    `<path d="M12 50H88M50 12V88M12 12 88 88M88 12 12 88" stroke="#7a5a2e" stroke-width="2" opacity=".45" stroke-linecap="round"/>` +
    place(pieceSvg('tiger'), 4, 10, 54) +
    place(pieceSvg('goat'), 44, 40, 52) +
    `</svg>`
  );
}
