// Kangoeroe's drawings, in code (no image files): the kangaroo (with a joey in the pouch), the
// home tile and the picture on the how-to card. The kangaroo faces right; its feet stand on
// (0, 0) of KANGAROO, so the line can put it on any number with one translate.

const BODY = '#e08a45';
const BELLY = '#f8d7ae';
const LINE = '#7a3d17';
const EAR = '#f4a7a0';

/**
 * The kangaroo as an SVG group, 64 wide and 72 high, feet on (0, 0). `face` -1 turns it to the left.
 */
export function kangaroo(face = 1, cls = '') {
  return `<g class="kg-roo ${cls}"><g transform="scale(${face < 0 ? -1 : 1} 1) translate(-32 -71)">
    <path d="M21 52c-6 2-12 6-19 15 5 1 10-1 15-5 4-3 7-5 9-7z" fill="${BODY}" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M14 70c0-3 3-5 7-5h20c5 0 8 2 8 4 0 1-1 2-3 2H16c-1 0-2 0-2-1z" fill="${BODY}" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M18 50c0-14 8-24 18-25 9 0 13 8 12 20-1 12-7 21-17 21-8 0-13-6-13-16z" fill="${BODY}" stroke="${LINE}" stroke-width="1.6"/>
    <ellipse cx="25" cy="56" rx="10" ry="9" fill="${BODY}" stroke="${LINE}" stroke-width="1.6"/>
    <path d="M33 33c6 1 10 6 10 14 0 8-4 14-10 15-5-1-7-6-7-14s2-15 7-15z" fill="${BELLY}"/>
    <path d="M29 50c2 4 9 4 12 0" fill="none" stroke="${LINE}" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="35" cy="47.5" r="3.6" fill="${BODY}" stroke="${LINE}" stroke-width="1.2"/>
    <circle cx="34" cy="44.6" r="1.4" fill="${BODY}" stroke="${LINE}" stroke-width="1"/>
    <circle cx="36.4" cy="44.8" r="1.4" fill="${BODY}" stroke="${LINE}" stroke-width="1"/>
    <circle cx="36.4" cy="47.2" r="0.7" fill="${LINE}"/>
    <path d="M42 35c3 2 5 5 5 8" fill="none" stroke="${LINE}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M42 35c3 2 5 5 5 8" fill="none" stroke="${BODY}" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="37" cy="9" rx="3.6" ry="9" transform="rotate(-14 37 9)" fill="${BODY}" stroke="${LINE}" stroke-width="1.6"/>
    <ellipse cx="37" cy="9.5" rx="1.6" ry="6" transform="rotate(-14 37 9.5)" fill="${EAR}"/>
    <ellipse cx="44" cy="8" rx="3.6" ry="9" transform="rotate(12 44 8)" fill="${BODY}" stroke="${LINE}" stroke-width="1.6"/>
    <ellipse cx="44" cy="8.5" rx="1.6" ry="6" transform="rotate(12 44 8.5)" fill="${EAR}"/>
    <path d="M32 23c0-6 5-9 10-9 5 0 8 3 10 6 2 2 6 3 7 5 1 3-1 5-4 5h-9c-7 0-14-1-14-7z" fill="${BODY}" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M47 27c2 1 6 1 9 0" fill="none" stroke="${BELLY}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="44" cy="19.5" r="2.1" fill="#2b2370"/>
    <circle cx="44.7" cy="18.8" r="0.7" fill="#fff"/>
    <ellipse cx="58" cy="24.4" rx="1.8" ry="1.4" fill="#2b2370"/>
    <circle cx="40" cy="25" r="2" fill="#ff9e9e" opacity="0.6"/>
  </g></g>`;
}

/** The home tile: the kangaroo hopping over a short number line with two arcs. */
export function tileSvg() {
  return `<svg class="kg-tile-svg" viewBox="0 0 120 100" aria-hidden="true">
    <path d="M10 82h100" stroke="#5b4bdb" stroke-width="3.5" stroke-linecap="round"/>
    ${[18, 38, 58, 78, 98].map((x) => `<path d="M${x} 76v12" stroke="#5b4bdb" stroke-width="3" stroke-linecap="round"/>`).join('')}
    <path d="M18 76Q28 52 38 76" fill="none" stroke="#ff8a3d" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M38 76Q48 52 58 76" fill="none" stroke="#ff8a3d" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M58 76Q68 40 78 66" fill="none" stroke="#ff8a3d" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 7"/>
    <g transform="translate(84 74) scale(0.78)">${kangaroo(1)}</g>
  </svg>`;
}

/** The picture on the how-to card: a bigger kangaroo between two arcs. */
export function howSvg() {
  return `<svg class="kg-how-svg" viewBox="0 0 160 110" aria-hidden="true">
    <path d="M8 96h144" stroke="#5b4bdb" stroke-width="4" stroke-linecap="round"/>
    ${[20, 50, 80, 110, 140].map((x) => `<path d="M${x} 90v12" stroke="#5b4bdb" stroke-width="3" stroke-linecap="round"/>`).join('')}
    <path d="M20 90Q35 62 50 90" fill="none" stroke="#ff8a3d" stroke-width="4" stroke-linecap="round"/>
    <path d="M50 90Q65 62 80 90" fill="none" stroke="#ff8a3d" stroke-width="4" stroke-linecap="round"/>
    <g transform="translate(112 88) scale(1.05)">${kangaroo(1)}</g>
  </svg>`;
}
