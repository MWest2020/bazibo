// Vier op een rij's pictures, drawn in code (SVG). A token is a round disc with a picture on it;
// every token differs by picture AND disc colour, so the two players are easy to tell apart, also
// for children who see colours differently. The pictures come from the other games (a puppy from
// Dogudoku, fruit and a fish from Picturedoku) plus a bubble drawn here.
// The look is our own: a lilac frame with round holes (no blue frame with red and yellow discs).
import { dogSvg } from '../dogudoku/art.js';
import { pictureSvg } from '../picturedoku/art.js';

const INK = '#2b2370';

// a glossy bubble without gradients (inline SVGs share one id space, so no <defs> here)
const BUBBLE =
  '<svg viewBox="0 0 48 48" aria-hidden="true">' +
  '<circle cx="24" cy="24" r="19" fill="#6aa8ff" stroke="#2b5fb8" stroke-width="2.2"/>' +
  '<circle cx="26.5" cy="27" r="13.5" fill="#8fc0ff"/>' +
  '<circle cx="28" cy="29" r="8" fill="#b3d6ff" opacity=".9"/>' +
  '<ellipse cx="17" cy="15.5" rx="6" ry="3.6" transform="rotate(-35 17 15.5)" fill="#fff" opacity=".92"/>' +
  '<circle cx="31.5" cy="34" r="2" fill="#fff" opacity=".7"/>' +
  '</svg>';

/** The tokens a player can pick, in the order the picker cycles through them. */
export const TOKENS = Object.freeze([
  { id: 'pup', disc: '#ffe2ad', rim: '#d99a3b', art: () => dogSvg(0) },
  { id: 'bubble', disc: '#d4e8ff', rim: '#5a8fd6', art: () => BUBBLE },
  { id: 'apple', disc: '#d2f3dc', rim: '#4fae74', art: () => pictureSvg(1) },
  { id: 'flower', disc: '#f6dcff', rim: '#b46ad1', art: () => pictureSvg(7) },
  { id: 'fish', disc: '#cdf3ef', rim: '#3aa79a', art: () => pictureSvg(8) },
  { id: 'pug', disc: '#ffe0d2', rim: '#cf7c5a', art: () => dogSvg(4) },
]);

export const tokenById = (id) => TOKENS.find((k) => k.id === id) || TOKENS[0];

/** The next token after `id` that is not `taken` (the other player's). */
export function nextToken(id, taken) {
  const i = TOKENS.findIndex((k) => k.id === id);
  for (let step = 1; step <= TOKENS.length; step++) {
    const k = TOKENS[(i + step) % TOKENS.length];
    if (k.id !== taken) return k.id;
  }
  return id;
}

/** A token: a disc with its picture, the picture placed inside as a nested <svg>. */
export function tokenSvg(id, { cls = '' } = {}) {
  const k = tokenById(id);
  const inner = k.art().replace(/^<svg\b[^>]*?(viewBox="[^"]*")[^>]*>/, '<svg x="17" y="17" width="66" height="66" $1>');
  return (
    `<svg class="token ${cls}" data-token="${k.id}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<circle cx="50" cy="53" r="44" fill="#000" opacity=".12"/>` +
    `<circle cx="50" cy="50" r="44" fill="${k.disc}" stroke="${k.rim}" stroke-width="5"/>` +
    `<circle cx="50" cy="50" r="36" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>` +
    inner +
    `</svg>`
  );
}

/** A friendly robot face: the computer. */
export function robotSvg({ cls = '' } = {}) {
  return (
    `<svg class="robot ${cls}" viewBox="0 0 48 48" aria-hidden="true">` +
    `<path d="M24 5v6" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="5" r="2.6" fill="#ffc531" stroke="${INK}" stroke-width="1.8"/>` +
    `<rect x="9" y="11" width="30" height="26" rx="9" fill="#b9e3ff" stroke="${INK}" stroke-width="2.4"/>` +
    `<rect x="5" y="20" width="4" height="9" rx="2" fill="#8cc9f0" stroke="${INK}" stroke-width="1.8"/><rect x="39" y="20" width="4" height="9" rx="2" fill="#8cc9f0" stroke="${INK}" stroke-width="1.8"/>` +
    `<circle cx="18" cy="22" r="4" fill="#fff" stroke="${INK}" stroke-width="1.8"/><circle cx="30" cy="22" r="4" fill="#fff" stroke="${INK}" stroke-width="1.8"/>` +
    `<circle cx="18.6" cy="22.6" r="1.8" fill="${INK}"/><circle cx="30.6" cy="22.6" r="1.8" fill="${INK}"/>` +
    `<path d="M18 30c3.6 3 8.4 3 12 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="13.5" cy="29" r="2.2" fill="#ff9db5" opacity=".7"/><circle cx="34.5" cy="29" r="2.2" fill="#ff9db5" opacity=".7"/>` +
    `<rect x="16" y="37" width="16" height="6" rx="2" fill="#8cc9f0" stroke="${INK}" stroke-width="1.8"/>` +
    `</svg>`
  );
}

/** Two children side by side: playing together. */
export function duoSvg({ cls = '' } = {}) {
  const kid = (x, hair, shirt) =>
    `<path d="M${x - 9} 44c0-8 4-13 9-13s9 5 9 13z" fill="${shirt}" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${x}" cy="21" r="8.5" fill="#ffd9b8" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M${x - 8.4} 19.5c.6-5.4 4.4-8.4 8.4-8.4s7.8 3 8.4 8.4c-3-2.6-6-3.4-8.4-3.4s-5.4.8-8.4 3.4z" fill="${hair}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<circle cx="${x - 3}" cy="22" r="1.3" fill="${INK}"/><circle cx="${x + 3}" cy="22" r="1.3" fill="${INK}"/>` +
    `<path d="M${x - 2.6} 25.6c1.6 1.4 3.6 1.4 5.2 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
  return `<svg class="duo ${cls}" viewBox="0 0 48 48" aria-hidden="true">${kid(14, '#7a4a26', '#ff8a3d')}${kid(34, '#2b2370', '#4cc38a')}</svg>`;
}

/** A small board picture for the menu: `cols`×`rows` holes with a few tokens. */
export function boardSvg(cols, rows, { cls = '' } = {}) {
  const cell = 10;
  const w = cols * cell + 6;
  const h = rows * cell + 6;
  let holes = '';
  const filled = { [`${rows - 1},${Math.floor(cols / 2)}`]: '#ffe2ad', [`${rows - 1},${Math.floor(cols / 2) - 1}`]: '#d4e8ff', [`${rows - 2},${Math.floor(cols / 2)}`]: '#d4e8ff' };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fill = filled[`${r},${c}`] || '#f4f0ff';
      holes += `<circle cx="${3 + c * cell + cell / 2}" cy="${3 + r * cell + cell / 2}" r="3.6" fill="${fill}"/>`;
    }
  }
  return `<svg class="mini-vier ${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><rect x="0" y="0" width="${w}" height="${h}" rx="5" fill="#7b6cf0" stroke="${INK}" stroke-width="1.4"/>${holes}</svg>`;
}

/** A trophy, for the number of wins. */
export const TROPHY =
  '<path d="M7 4h10v4a5 5 0 0 1-10 0z" fill="#ffc531" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
  '<path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.4M17 6h2.5a2.5 2.5 0 0 1-2.6 3.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  '<path d="M12 13v3.5M8.5 20h7l-1-3.5h-5z" fill="#ffc531" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
