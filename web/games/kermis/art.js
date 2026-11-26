// Kleurenkermis (Colour Fair): every drawing is ours, made in code (SVG strings): the things of tier
// 1, the chameleon who runs the stall, the little turtle that races a child alone, the corner
// symbols, the shapes on the colour buttons, Ja and Nee, the stall and the tile. No ids, no url(#),
// no style attributes and no text in any drawing (tested).
//
// A thing's body is drawn with the class `kk-body` (filled) or `kk-line` (stroked): its colour is
// the CSS variable --kk-ink on its box, so the thing can turn to its own colour after an answer
// (a slow CSS transition). Details keep their own colours (a green stalk, black spots), never close
// to the thing's own colour (tested), so a "Nee" picture never shows the right colour somewhere.
import { INKS, SHAPES } from './colours.js';

const OUT = '#3b2f2f';
const LEAF = '#3f8f3a';
const STALK = '#6b4a2b';
const line = (w = 2.4) => `stroke="${OUT}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const SHADE = 'fill="#000000" fill-opacity="0.14"';
const SHINE = 'fill="#ffffff" fill-opacity="0.45"';

/** The drawings of tier 1 in a 64 x 64 box; `B` is the body (filled), `L` a body line (stroked). */
const THING_ART = {
  banaan: (B) => `
    <path d="M13 17c-4 17 5 33 23 36 8 1 15-2 18-7-4 1-10 0-16-3-12-6-18-17-18-28z" ${B} ${line()}/>
    <path d="M19 23c1 9 6 17 14 23" fill="none" stroke="#000000" stroke-opacity="0.16" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M12 18l-1-7 6 1 1 5z" fill="${STALK}" ${line(2)}/>
    <circle cx="53.5" cy="46.5" r="2.2" fill="${STALK}"/>`,
  citroen: (B) => `
    <path d="M5 33l5-3c5-10 13-16 23-16s18 6 22 16l5 3-5 3c-4 10-12 16-22 16S15 46 10 36z" ${B} ${line()}/>
    <path d="M16 28c4-6 10-8 16-8" fill="none" ${SHINE.replace('fill=', 'stroke=').replace('fill-opacity', 'stroke-opacity')} stroke-width="3" stroke-linecap="round"/>
    <g ${SHADE}><circle cx="26" cy="38" r="1.2"/><circle cx="36" cy="40" r="1.2"/><circle cx="42" cy="32" r="1.2"/><circle cx="31" cy="30" r="1.2"/></g>`,
  kuiken: (B) => `
    <path d="M22 56l-3 5M22 56l2 5M42 56l-2 5M42 56l3 5" fill="none" stroke="#f08c00" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="32" cy="41" r="16" ${B} ${line()}/>
    <circle cx="32" cy="22" r="11" ${B} ${line()}/>
    <path d="M30 13c0-4 2-6 4-6M33 12c2-3 4-4 6-3" fill="none" ${line(2)}/>
    <path d="M24 40c4 6 10 7 14 3" fill="none" stroke="#000000" stroke-opacity="0.18" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="28" cy="20" r="2" fill="${OUT}"/><circle cx="36" cy="20" r="2" fill="${OUT}"/>
    <path d="M29 25l3 4 3-4z" fill="#f08c00" ${line(1.6)}/>`,
  zon: (B) => `
    <g ${B} ${line(2)}>
      <path d="M32 3l4 9h-8z"/><path d="M32 61l-4-9h8z"/><path d="M3 32l9-4v8z"/><path d="M61 32l-9 4v-8z"/>
      <path d="M11.5 11.5l9 3.5-5.5 5.5z"/><path d="M52.5 52.5l-9-3.5 5.5-5.5z"/><path d="M52.5 11.5l-3.5 9-5.5-5.5z"/><path d="M11.5 52.5l3.5-9 5.5 5.5z"/>
    </g>
    <circle cx="32" cy="32" r="16" ${B} ${line()}/>
    <circle cx="26.5" cy="29" r="2.2" fill="${OUT}"/><circle cx="37.5" cy="29" r="2.2" fill="${OUT}"/>
    <path d="M25 36c4 4 10 4 14 0" fill="none" ${line(2.2)}/>`,
  aardbei: (B) => `
    <path d="M32 57C18 49 10 37 12 25c2-8 10-10 20-6 10-4 18-2 20 6 2 12-6 24-20 32z" ${B} ${line()}/>
    <g ${SHINE}><ellipse cx="24" cy="30" rx="1.3" ry="2"/><ellipse cx="33" cy="28" rx="1.3" ry="2"/><ellipse cx="41" cy="31" rx="1.3" ry="2"/><ellipse cx="28" cy="39" rx="1.3" ry="2"/><ellipse cx="37" cy="40" rx="1.3" ry="2"/><ellipse cx="32" cy="48" rx="1.3" ry="2"/></g>
    <path d="M32 20l-9-5 6-1-2-6 5 4 5-4-2 6 6 1z" fill="${LEAF}" ${line(2)}/>`,
  lieveheersbeestje: (B) => `
    <path d="M24 13l-5-6M40 13l5-6" fill="none" ${line(2)}/>
    <path d="M20 22a12 9 0 0 1 24 0z" fill="#2b2422" ${line()}/>
    <ellipse cx="32" cy="38" rx="21" ry="19" ${B} ${line()}/>
    <path d="M32 20v37" ${line()}/>
    <g fill="#2b2422"><circle cx="22" cy="31" r="4"/><circle cx="42" cy="31" r="4"/><circle cx="20" cy="44" r="3.5"/><circle cx="44" cy="44" r="3.5"/><circle cx="27" cy="52" r="2.6"/><circle cx="37" cy="52" r="2.6"/></g>
    <circle cx="27" cy="18" r="1.6" fill="#ffffff"/><circle cx="37" cy="18" r="1.6" fill="#ffffff"/>`,
  wortel: (B) => `
    <path d="M27 14c-4-6-8-8-12-7 3 4 7 6 11 8M33 13c0-6 2-9 5-11 1 5 0 9-3 12M37 15c4-5 8-6 12-5-3 4-7 6-11 7" fill="${LEAF}" ${line(2)}/>
    <path d="M22 17c6-4 15-4 20 0L34 58c-1 3-3 3-4 0z" ${B} ${line()}/>
    <path d="M26 26h6M29 35h6M28 44h5M31 51h3" fill="none" stroke="#000000" stroke-opacity="0.2" stroke-width="2.2" stroke-linecap="round"/>`,
  sinaasappel: (B) => `
    <circle cx="32" cy="37" r="21" ${B} ${line()}/>
    <g ${SHADE}><circle cx="24" cy="32" r="1.2"/><circle cx="31" cy="44" r="1.2"/><circle cx="40" cy="36" r="1.2"/><circle cx="36" cy="27" r="1.2"/><circle cx="23" cy="44" r="1.2"/><circle cx="43" cy="46" r="1.2"/></g>
    <ellipse cx="23" cy="28" rx="4" ry="6" transform="rotate(30 23 28)" ${SHINE}/>
    <path d="M32 16v-4" stroke="${STALK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M33 13c4-6 11-7 15-5-3 5-9 7-15 5z" fill="${LEAF}" ${line(2)}/>`,
  kikker: (B) => `
    <path d="M10 54c0-16 10-26 22-26s22 10 22 26c0 4-4 6-22 6S10 58 10 54z" ${B} ${line()}/>
    <circle cx="20" cy="26" r="9" ${B} ${line()}/>
    <circle cx="44" cy="26" r="9" ${B} ${line()}/>
    <circle cx="20" cy="25" r="5" fill="#ffffff" ${line(1.6)}/><circle cx="44" cy="25" r="5" fill="#ffffff" ${line(1.6)}/>
    <circle cx="21" cy="26" r="2.4" fill="${OUT}"/><circle cx="43" cy="26" r="2.4" fill="${OUT}"/>
    <path d="M19 41c7 6 19 6 26 0" fill="none" ${line(2.2)}/>
    <path d="M14 58c3-4 7-5 10-3M50 58c-3-4-7-5-10-3" fill="none" ${line(2)}/>
    <ellipse cx="32" cy="52" rx="10" ry="5" ${SHINE}/>`,
  blad: (B) => `
    <path d="M10 55C9 31 25 12 55 9c1 29-16 46-45 46z" ${B} ${line()}/>
    <path d="M6 59L46 19M22 43l-1-12M30 35l-1-11M38 27l-1-8M22 43l12 1M30 35l12 0M38 27l10-1" fill="none" ${line(2)}/>`,
  komkommer: (B) => `
    <path d="M13 47c-4-4-2-10 4-14l26-18c6-4 12-3 14 1s0 9-6 13L26 47c-6 4-9 4-13 0z" ${B} ${line()}/>
    <path d="M18 40l27-19" fill="none" ${SHINE.replace('fill=', 'stroke=').replace('fill-opacity', 'stroke-opacity')} stroke-width="3" stroke-linecap="round"/>
    <g ${SHADE}><circle cx="24" cy="42" r="1.3"/><circle cx="32" cy="38" r="1.3"/><circle cx="40" cy="31" r="1.3"/><circle cx="47" cy="27" r="1.3"/><circle cx="30" cy="30" r="1.3"/><circle cx="39" cy="22" r="1.3"/></g>`,
  broccoli: (B) => `
    <path d="M26 36h12l-2 22h-8z" ${B} ${line()}/>
    <path d="M26 36h12l-2 22h-8z" ${SHINE}/>
    <g ${B} ${line()}><circle cx="20" cy="30" r="10"/><circle cx="44" cy="30" r="10"/><circle cx="32" cy="22" r="12"/><circle cx="26" cy="34" r="8"/><circle cx="38" cy="34" r="8"/></g>
    <g ${SHADE}><circle cx="28" cy="18" r="2"/><circle cx="37" cy="21" r="2"/><circle cx="18" cy="28" r="2"/><circle cx="46" cy="29" r="2"/></g>`,
  varken: (B) => `
    <path d="M14 22l-2-14 12 7z" ${B} ${line()}/><path d="M50 22l2-14-12 7z" ${B} ${line()}/>
    <circle cx="32" cy="35" r="21" ${B} ${line()}/>
    <ellipse cx="32" cy="41" rx="10" ry="7.5" ${B} ${line()}/>
    <ellipse cx="32" cy="41" rx="10" ry="7.5" ${SHADE}/>
    <ellipse cx="28.5" cy="41" rx="1.8" ry="2.8" fill="${OUT}"/><ellipse cx="35.5" cy="41" rx="1.8" ry="2.8" fill="${OUT}"/>
    <circle cx="24" cy="29" r="2.3" fill="${OUT}"/><circle cx="40" cy="29" r="2.3" fill="${OUT}"/>`,
  flamingo: (B, L) => `
    <path d="M30 42l-2 20M30 50l8-4" fill="none" ${L} stroke-width="3" stroke-linecap="round"/>
    <path d="M14 34c2-8 12-12 22-10 8 2 12 8 10 14-2 6-10 8-18 6-8-1-15-4-14-10z" ${B} ${line()}/>
    <path d="M40 30c6-4 8-10 6-16-2-5-8-6-11-3" fill="none" stroke="${OUT}" stroke-width="7.6" stroke-linecap="round"/>
    <path d="M40 30c6-4 8-10 6-16-2-5-8-6-11-3" fill="none" ${L} stroke-width="3.6" stroke-linecap="round"/>
    <circle cx="35" cy="12" r="5.5" ${B} ${line()}/>
    <path d="M31 13l-6 3 2 4 4-3z" fill="#2b2422" ${line(1.6)}/>
    <circle cx="36" cy="11" r="1.5" fill="${OUT}"/>
    <path d="M22 34c4 2 10 2 14 0" fill="none" stroke="#000000" stroke-opacity="0.18" stroke-width="2.4" stroke-linecap="round"/>`,
  bosbes: (B) => `
    <circle cx="22" cy="40" r="13" ${B} ${line()}/>
    <circle cx="42" cy="42" r="12" ${B} ${line()}/>
    <circle cx="32" cy="23" r="12" ${B} ${line()}/>
    <g ${SHADE}><path d="M32 14l2 3h3l-2 2 1 3-4-2-4 2 1-3-2-2h3z"/><path d="M22 31l2 3h3l-2 2 1 3-4-2-4 2 1-3-2-2h3z"/><path d="M42 33l2 3h3l-2 2 1 3-4-2-4 2 1-3-2-2h3z"/></g>
    <circle cx="18" cy="44" r="2.6" ${SHINE}/><circle cx="38" cy="46" r="2.4" ${SHINE}/><circle cx="27" cy="27" r="2.4" ${SHINE}/>`,
  kastanje: (B) => `
    <path d="M32 11c3 4 7 5 11 7 7 4 11 11 11 19 0 12-10 20-22 20S10 49 10 37c0-8 4-15 11-19 4-2 8-3 11-7z" ${B} ${line()}/>
    <path d="M14 46c4 6 10 9 18 9s14-3 18-9c-6 2-12 3-18 3s-12-1-18-3z" fill="#eadbb8" ${line(2)}/>
    <ellipse cx="23" cy="30" rx="4" ry="7" transform="rotate(30 23 30)" ${SHINE}/>`,
};

/**
 * A thing of tier 1 (64 x 64). Without `ink` the body takes --kk-ink from its box (the game);
 * with an ink id or a colour it is drawn in that colour (the tile, the menu).
 */
export function thingSvg(id, ink = null, cls = '') {
  const fill = ink ? INKS[ink] || ink : null;
  const B = fill ? `fill="${fill}"` : 'class="kk-body"';
  const L = fill ? `stroke="${fill}"` : 'class="kk-line"';
  return `<svg class="kk-thing${cls ? ` ${cls}` : ''}" viewBox="0 0 64 64" aria-hidden="true">${THING_ART[id](B, L)}</svg>`;
}
export const ART_IDS = Object.freeze(Object.keys(THING_ART));

// ---------- the chameleon and the turtle ----------

/**
 * The chameleon who runs the stall: teal, never one of the game's colours, so it never hints at an
 * answer; a curled tail, a turret eye, a smile, on a branch (96 x 80). Our own: nothing from a
 * franchise. The tail is its own group, so CSS can curl it when the chameleon is happy.
 */
export const HOST = Object.freeze({ skin: '#2fb3a6', dark: '#1f6f68', belly: '#b9ece5', cheek: '#f4a9a0', branch: '#8a6a4a' });

export function hostSvg(cls = '') {
  const c = HOST;
  const l = `stroke="${c.dark}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  return `<svg class="kk-host-svg${cls ? ` ${cls}` : ''}" viewBox="0 0 96 80" aria-hidden="true">
    <path d="M6 72h86" stroke="${c.branch}" stroke-width="6" stroke-linecap="round"/>
    <path d="M70 72l6-6" stroke="${c.branch}" stroke-width="4" stroke-linecap="round"/>
    <g class="kk-host-tail">
      <path d="M62 52c14 1 24-6 23-17-1-9-11-12-16-6-4 5 0 11 5 9" fill="none" stroke="${c.dark}" stroke-width="9" stroke-linecap="round"/>
      <path d="M62 52c14 1 24-6 23-17-1-9-11-12-16-6-4 5 0 11 5 9" fill="none" stroke="${c.skin}" stroke-width="4.6" stroke-linecap="round"/>
    </g>
    <g class="kk-host-body">
      <path d="M30 56l-3 14M52 56l3 14" stroke="${c.dark}" stroke-width="7" stroke-linecap="round"/>
      <path d="M30 56l-3 14M52 56l3 14" stroke="${c.skin}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M18 46c0-14 14-22 30-20 12 2 18 10 18 20 0 8-6 12-16 12H30c-8 0-12-4-12-12z" fill="${c.skin}" ${l}/>
      <path d="M26 54c6 3 18 3 26 0" fill="none" stroke="${c.belly}" stroke-width="4" stroke-linecap="round"/>
      <path d="M30 28c3-4 6-4 8 0 3-4 6-4 8 0 3-3 6-3 8 1" fill="none" ${l}/>
      <path d="M5 41c2-10 10-17 21-17 8 0 13 6 13 14 0 8-7 13-17 13-9 0-18-3-17-10z" fill="${c.skin}" ${l}/>
      <path d="M14 26l3-7 4 5 3-6 3 6" fill="none" ${l}/>
      <circle cx="24" cy="35" r="7.5" fill="${c.skin}" ${l}/>
      <circle cx="24" cy="35" r="4.4" fill="#ffffff"/>
      <circle cx="22.4" cy="35.4" r="2.3" fill="#1d2b2a"/>
      <circle cx="14" cy="44" r="2.6" fill="${c.cheek}" opacity="0.7"/>
      <path d="M7 44c4 3 9 4 14 2" fill="none" ${l}/>
    </g>
  </svg>`;
}

/** The little turtle that races a child who plays alone: slow and friendly (64 x 48). */
export const TURTLE_LOOK = Object.freeze({ shell: '#9a7b4f', rim: '#5c4630', skin: '#cdb98f' });

export function turtleSvg() {
  const c = TURTLE_LOOK;
  const l = `stroke="${c.rim}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
  return `<svg class="kk-turtle-svg" viewBox="0 0 64 48" aria-hidden="true">
    <path d="M14 38l-2 6M24 40l-1 5M42 40l1 5M52 38l2 6" stroke="${c.rim}" stroke-width="6" stroke-linecap="round"/>
    <path d="M14 38l-2 6M24 40l-1 5M42 40l1 5M52 38l2 6" stroke="${c.skin}" stroke-width="3" stroke-linecap="round"/>
    <path d="M2 30c0-6 4-10 9-10s8 4 8 9-4 8-9 8-8-2-8-7z" fill="${c.skin}" ${l}/>
    <circle cx="8" cy="27" r="1.8" fill="${c.rim}"/>
    <path d="M4 32c2 1 4 1 6 0" fill="none" ${l}/>
    <path d="M12 38c0-16 10-28 22-28s22 12 22 28z" fill="${c.shell}" ${l}/>
    <path d="M24 22l10-6 10 6v10l-10 5-10-5zM24 22l-8 6M44 22l8 6M24 32l-6 6M44 32l6 6M34 37v1" fill="none" ${l}/>
    <path d="M10 38h48" ${l}/>
  </svg>`;
}

// ---------- the players' corners, the colour buttons, Ja and Nee ----------

/** A player's symbol (24 x 24), drawn in ink only: the corners never bring in a colour of their own. */
const PLAYER_ART = {
  zon: '<circle cx="12" cy="12" r="4.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  maan: '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.5 7 7 0 0 1-5-13.5z"/>',
  wolk: '<path d="M7 18.5h10.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6-1.2A4.6 4.6 0 0 0 7 18.5z"/>',
  bloem: '<circle cx="12" cy="12" r="2.6"/><path d="M12 9.4c-2.2-3.4-.6-6.4 0-6.9.6.5 2.2 3.5 0 6.9zM14.5 11.2c1-3.9 4.4-4.5 5.1-4.3 0 .8-1.3 3.9-5.1 4.3zM13.5 14.2c3.7 1.5 3.6 4.9 3.2 5.5-.7-.2-3.6-1.9-3.2-5.5zM10.5 14.2c.4 3.6-2.5 5.3-3.2 5.5-.4-.6-.5-4 3.2-5.5zM9.5 11.2c-3.8-.4-5.1-3.5-5.1-4.3.7-.2 4.1.4 5.1 4.3z"/>',
};
export const PLAYER_ART_IDS = Object.freeze(Object.keys(PLAYER_ART));

export function playerSvg(id) {
  return `<svg class="kk-who" viewBox="0 0 24 24" aria-hidden="true"><g fill="#ffffff" stroke="#2b2422" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${PLAYER_ART[id]}</g></svg>`;
}

const SHAPE_ART = {
  circle: '<circle cx="20" cy="20" r="15"/>',
  square: '<rect x="6" y="6" width="28" height="28" rx="4"/>',
  triangle: '<path d="M20 4l16 29H4z"/>',
  diamond: '<path d="M20 3l16 17-16 17L4 20z"/>',
  hexagon: '<path d="M12 5h16l8 15-8 15H12L4 20z"/>',
  star: '<path d="M20 3l4.9 10.3 11.1 1.4-8.2 7.7 2.1 11.1L20 28l-9.9 5.5 2.1-11.1L4 14.7l11.1-1.4z"/>',
};
export const SHAPE_IDS = Object.freeze(Object.keys(SHAPE_ART));

/** A colour button's swatch: the colour in its own shape (40 x 40), outlined. */
export function swatchSvg(colour) {
  return `<svg class="kk-swatch" viewBox="0 0 40 40" aria-hidden="true"><g fill="${INKS[colour]}" stroke="#2b2422" stroke-width="2.6" stroke-linejoin="round">${SHAPE_ART[SHAPES[colour]]}</g></svg>`;
}

/** Ja: a tick in a round; Nee: a cross in a square. Shapes, not colours, tell them apart. */
export const YES_SVG = '<svg class="kk-yn" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M9.5 16.5l4.5 4.5 8.5-9.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const NO_SVG = '<svg class="kk-yn" viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="3.5" width="25" height="25" rx="5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M11 11l10 10M21 11L11 21" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>';

/** The race: a little chequered flag (48 x 48), in ink only. */
export function flagSvg() {
  let sq = '';
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) if ((r + k) % 2 === 0) sq += `<rect x="${14 + k * 7}" y="${8 + r * 7}" width="7" height="7"/>`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 6v38" stroke="#2b2422" stroke-width="3" stroke-linecap="round"/><rect x="14" y="8" width="28" height="21" fill="#ffffff" stroke="#2b2422" stroke-width="2"/><g fill="#2b2422">${sq}</g></svg>`;
}

/** Who plays: the corner symbols, as many as `n`. */
export function playersSvg(n) {
  const ids = ['zon', 'maan', 'wolk', 'bloem'].slice(0, n);
  const pos = [[2, 24], [24, 2], [24, 24], [2, 2]];
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${ids.map((id, k) => `<g transform="translate(${pos[k][0]} ${pos[k][1]}) scale(0.92)"><g fill="#ffffff" stroke="#2b2422" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${PLAYER_ART[id]}</g></g>`).join('')}</svg>`;
}

// ---------- the stall, the tile ----------

/** The stall: a calm awning, a sign with a blue banana, and the chameleon beside it (160 x 112). */
export function stallSvg() {
  let stripes = '';
  for (let k = 0; k < 8; k++) stripes += `<path d="M${8 + k * 18} 10h18v14c0 5-4 8-9 8s-9-3-9-8z" fill="${k % 2 ? '#f3e6cc' : '#ffffff'}" stroke="#8a6a4a" stroke-width="2"/>`;
  return `<svg viewBox="0 0 160 112" aria-hidden="true">
    <path d="M14 30v76M146 30v76" stroke="#8a6a4a" stroke-width="5" stroke-linecap="round"/>
    <rect x="6" y="6" width="148" height="8" rx="4" fill="#d9b88a" stroke="#8a6a4a" stroke-width="2"/>
    ${stripes}
    <rect x="10" y="84" width="140" height="22" rx="6" fill="#d9b88a" stroke="#8a6a4a" stroke-width="2.4"/>
    <rect x="26" y="38" width="58" height="46" rx="8" fill="#ffffff" stroke="#8a6a4a" stroke-width="2.4"/>
    <g transform="translate(35 41) scale(0.62)">${THING_ART.banaan(`fill="${INKS.blauw}"`)}</g>
    <g transform="translate(86 40) scale(0.62)">${hostSvg().replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
  </svg>`;
}

/** The home tile: a sign with a blue banana and the chameleon peeking from the side. */
export function tileSvg() {
  return `<svg class="kk-tile-svg" viewBox="0 0 120 100" aria-hidden="true">
    <rect x="8" y="10" width="76" height="70" rx="12" fill="#ffffff" stroke="#8a6a4a" stroke-width="3"/>
    <path d="M30 80v14M62 80v14" stroke="#8a6a4a" stroke-width="5" stroke-linecap="round"/>
    <g transform="translate(16 14) scale(0.95)">${THING_ART.banaan(`fill="${INKS.blauw}"`)}</g>
    <g transform="translate(58 46) scale(0.62)">${hostSvg().replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
  </svg>`;
}
