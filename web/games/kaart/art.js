// Kaartpuzzel's drawings, in code (no image files): the home tile and the picture on the menu and
// the how-to card. A little island of three coloured regions on the sea, with one region lifted out
// like a puzzle piece and a dashed outline where it goes, and a map pin.

const SEA = '#bfe3f5';
const WAVE = '#8ccbe8';
const LINE = '#3d3470';

function island() {
  return `
    <path d="M22 40c4-10 16-16 28-14 6-6 18-6 24 2 10 0 16 8 14 18 6 6 4 18-6 22-4 8-16 10-24 6-8 6-22 4-26-4-10-2-16-12-12-20-4-4-2-8 2-10z" fill="#fff6dc" stroke="${LINE}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M24 42c3-8 14-13 26-11l2 18-14 8c-6-1-12-4-14-9z" fill="#ffb4a2" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M50 31c6-5 16-5 22 2 9 1 14 8 12 16l-20 4-12-4z" fill="#b5e48c" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M52 49l12 4 20-4c5 5 3 15-6 19-4 7-14 8-21 4l-5-11z" fill="none" stroke="${LINE}" stroke-width="2" stroke-dasharray="4 3" stroke-linejoin="round"/>
    <path d="M38 57l14-8 0 12-5 11c-8 4-18 1-21-6l12-9z" fill="#ffd166" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>`;
}

function piece(dx, dy) {
  return `<g transform="translate(${dx} ${dy}) rotate(-8 68 60)">
    <path d="M52 49l12 4 20-4c5 5 3 15-6 19-4 7-14 8-21 4l-5-11z" fill="rgba(43,35,112,0.18)" transform="translate(3 4)"/>
    <path d="M52 49l12 4 20-4c5 5 3 15-6 19-4 7-14 8-21 4l-5-11z" fill="#a8dadc" stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round"/>
  </g>`;
}

function pin(x, y) {
  return `<g transform="translate(${x} ${y})"><path d="M0 0c-6-8-10-12-10-18a10 10 0 0 1 20 0c0 6-4 10-10 18z" fill="#e5484d" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/><circle cx="0" cy="-18" r="3.8" fill="#fff"/></g>`;
}

/** The home tile (square). */
export function tileSvg() {
  return `<svg class="km-tile-svg" viewBox="0 0 110 110" aria-hidden="true">
    <rect x="4" y="8" width="102" height="94" rx="20" fill="${SEA}"/>
    <path d="M12 92q6-4 12 0t12 0M76 22q6-4 12 0t12 0" fill="none" stroke="${WAVE}" stroke-width="2.4" stroke-linecap="round"/>
    ${island()}
    ${piece(14, 16)}
    ${pin(36, 44)}
  </svg>`;
}

/** The picture on the menu and the how-to card (wide). */
export function howSvg() {
  return `<svg viewBox="0 0 170 110" aria-hidden="true">
    <rect x="2" y="6" width="166" height="98" rx="20" fill="${SEA}"/>
    <path d="M14 94q6-4 12 0t12 0M120 20q6-4 12 0t12 0M130 92q6-4 12 0" fill="none" stroke="${WAVE}" stroke-width="2.4" stroke-linecap="round"/>
    <g transform="translate(16 0)">${island()}</g>
    <g transform="translate(16 0)">${piece(48, 4)}</g>
    <g transform="translate(16 0)">${pin(36, 44)}</g>
    <path d="M132 76c0-6 2-10 6-10s4 4 4 4v-8c0-3 4-3 4 0v6c0-3 4-3 4 0v4c0-3 4-3 4 0v8c0 8-4 12-10 12h-4c-5 0-8-4-8-8z" fill="#ffe0c2" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}
