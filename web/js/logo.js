// The Bazibo logo (brand round 3, Mark 24 Nov 2026): a lowercase b cut from cream paper on a
// scrap in one game group's colour, with the other four groups' scraps peeking out from under it,
// and the drawn name "bazibo" with a bead as the dot on the i. The source of truth is
// design/brand/logo/ (CC0, design/brand/LICENSES.md); this file draws the same paths inline, so
// the page's CSP (no inline styles) and the "no ids or url(#)" rule hold: presentation
// attributes only, the wordmark's <use> copies written out. tests/brand.test.js checks every
// path against the SVG files. The brand name itself stays in brand.js: these drawings are
// aria-hidden, the words beside them carry the name.

// one scrap per kind of play, and the ring the group marks turn: the big scrap is the group's,
// the four under it are the next four in the ring (top left, top right, left, bottom right)
const SCRAP = Object.freeze({
  board: '#d9663f',
  action: '#3f86d0',
  puzzles: '#2a8f88',
  learning: '#b97f0a',
  creative: '#c8508a',
});
const RING = ['board', 'action', 'puzzles', 'learning', 'creative'];
const CREAM = '#fbf7f0';

// the four small scraps, each cut with five strokes of the scissors
const UNDER = [
  'M3 10L32 2L45.5 14L40 25.5L8 27Z',
  'M58 2L92 8.5L96 30L88.5 45L63 39Z',
  'M1 33L13 29.5L17.5 84L9 93.5L2.5 76Z',
  'M46 82.5L84 74.5L94 85.5L85 96L50 96Z',
];
const BIG = 'M9 13L52 8.5L89 12L92.5 60L86 89L40 92L11 87.5L6.5 50Z';
const STEM = 'M27 20L41.5 18.5L43 76L28.5 77.5Z';
const BOWL = 'M11.4 0C11.4 4.97 6.3 9 0 9C-5.52 9-10 4.97-10 0C-10-5.97-5.52-10.8 0-10.8C6.3-10.8 11.4-5.97 11.4 0Z';
const ROOF = 'M56 49L69.5 65.5L45 66Z'; // the counter of the b, cut as a little roof: the gazebo

export const GROUP_COLOURS = SCRAP;

// The mark (viewBox 0 0 96 96). group: whose scrap the b lies on; 'board' is the brand mark.
export function markSvg(group = 'board') {
  const at = RING.indexOf(group);
  if (at < 0) throw new Error(`no such group: ${group}`);
  const big = SCRAP[group];
  const under = UNDER.map((d, i) => `<path d="${d}" fill="${SCRAP[RING[(at + 1 + i) % RING.length]]}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true" focusable="false">${under}` +
    `<g transform="translate(4.8 4.8) scale(0.9)"><path d="${BIG}" fill="${big}"/>` +
    `<g transform="translate(-6.5 -1.5) scale(1.06)"><path d="${STEM}" fill="${CREAM}"/>` +
    `<path transform="translate(55.5 58.5) scale(2.05)" d="${BOWL}" fill="${CREAM}"/>` +
    `<path d="${ROOF}" fill="${big}" stroke="${big}" stroke-width="3" stroke-linejoin="round"/></g></g></svg>`;
}

// The drawn letters (design/brand/logo/wordmark.svg), each placed as there: a dancing baseline,
// every letter turned a few degrees. They are drawn in currentColor (the ink, set in CSS).
const LETTER = {
  b: '<path d="M10 -88.5L10.6 -8.5" fill="none" stroke-width="19.5" stroke-linecap="round"/>' +
    '<path fill-rule="evenodd" d="M65 -31C65 -13.05 50.67 1.5 33 1.5C15.6 1.5 1.5 -13.05 1.5 -31C1.5 -48.12 15.6 -62 33 -62C50.67 -62 65 -48.12 65 -31ZM46.5 -30.5C46.5 -23.04 40.68 -17 33.5 -17C25.77 -17 19.5 -23.04 19.5 -30.5C19.5 -37.96 25.77 -44 33.5 -44C41.23 -44 46.5 -37.96 46.5 -30.5Z"/>',
  a: '<path fill-rule="evenodd" d="M59.5 -31C59.5 -13.33 46.29 1 30 1C13.43 1 0 -13.33 0 -31C0 -48.12 13.43 -62 30 -62C46.29 -62 59.5 -48.12 59.5 -31ZM42 -30.5C42 -23.32 36.4 -17.5 29.5 -17.5C22.04 -17.5 16 -23.32 16 -30.5C16 -37.68 22.04 -43.5 29.5 -43.5C36.4 -43.5 42 -37.68 42 -30.5Z"/>' +
    '<path d="M53.5 -52L54.2 -8.5" fill="none" stroke-width="19" stroke-linecap="round"/>',
  z: '<path stroke-width="3.5" stroke-linejoin="round" d="M3 -61.5L58 -62.5L58.5 -46.5L26 -17.8L59 -18.3L59.5 -2L1.5 -1L1 -18L33.5 -46.5L3.5 -46Z"/>',
  i: '<path d="M9.75 -54L10.3 -8.5" fill="none" stroke-width="19.5" stroke-linecap="round"/>',
  o: '<path fill-rule="evenodd" d="M62.5 -31C62.5 -13.05 48.4 1.5 31 1.5C13.88 1.5 0 -13.05 0 -31C0 -48.4 13.88 -62.5 31 -62.5C48.4 -62.5 62.5 -48.4 62.5 -31ZM45 -30.5C45 -23.32 38.96 -17.5 31.5 -17.5C23.66 -17.5 17.3 -23.32 17.3 -30.5C17.3 -38.12 23.66 -44.3 31.5 -44.3C38.96 -44.3 45 -38.12 45 -30.5Z"/>',
};
export const WORDMARK_LETTERS = Object.freeze([
  ['b', 'translate(10 114) rotate(-2 33 -31)'],
  ['a', 'translate(86 117) rotate(2.2 32 -31)'],
  ['z', 'translate(159 111.5) rotate(-1.6 30 -31)'],
  ['i', 'translate(231 116.5) rotate(2.5 10 -31)'],
  ['b', 'translate(262 111) rotate(1.2 33 -31)'],
  ['o', 'translate(336 115.5) rotate(-2.2 31 -31)'],
]);
const BEAD = 'M9.2 0C9.2 6.19 5.08 11.2 0 11.2C-6.08 11.2-11 6.19-11 0C-11-5.14-6.08-9.3 0-9.3C5.08-9.3 9.2-5.14 9.2 0Z';

// The wordmark (viewBox 0 0 410 130): the letters in currentColor, the bead in the board scrap's
// terracotta, so the name and the mark hold each other.
export function wordmarkSvg() {
  const letters = WORDMARK_LETTERS.map(([l, tf]) => `<g transform="${tf}">${LETTER[l]}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 410 130" aria-hidden="true" focusable="false">` +
    `<g fill="currentColor" stroke="currentColor">${letters}</g>` +
    `<path transform="translate(241.8 37.5) rotate(-18) scale(0.98)" d="${BEAD}" fill="${SCRAP.board}"/></svg>`;
}
