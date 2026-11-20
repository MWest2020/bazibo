// Papegaai's pictures, drawn in code (SVG): the parrot on its branch with a lower beak that opens
// with the sound and three sound waves in front of it, the voice buttons' signs and the home tile.
// No ids and no url(#...) references, so several copies can sit on one page.

/** The hinge of the lower beak, in the parrot's own units: papegaai.js turns the beak round it. */
export const BEAK_HINGE = Object.freeze([149, 95]);

/** The friendly parrot: green with a yellow belly, an orange crest and a big round eye. */
export function parrotSvg(cls = 'pg-parrot-svg') {
  return `<svg class="${cls}" viewBox="0 0 220 240" aria-hidden="true">
  <path d="M14 206c40-7 150-8 196-2" fill="none" stroke="#8a5a34" stroke-width="13" stroke-linecap="round"/>
  <path d="M30 205c-8-10-6-20 4-24 3 9 2 17-4 24z" fill="#6cc04a"/>
  <path d="M82 170 52 236l18-2 26-58z" fill="#3a7bd5"/>
  <path d="M94 174 78 238l16-3 14-60z" fill="#e8483f"/>
  <ellipse cx="100" cy="140" rx="48" ry="58" fill="#2fb55a"/>
  <ellipse cx="114" cy="152" rx="27" ry="40" fill="#ffd23f"/>
  <path d="M60 116c-12 26-8 58 14 74 8-22 10-50 2-76z" fill="#1f8f45"/>
  <path d="M62 168c2 10 6 18 12 22 2-8 3-14 2-22z" fill="#3a7bd5"/>
  <ellipse cx="90" cy="202" rx="9" ry="6" fill="#f59d2a"/>
  <ellipse cx="116" cy="202" rx="9" ry="6" fill="#f59d2a"/>
  <path d="M98 44c-6-14-2-26 6-32 2 12 4 22 2 32z" fill="#ff7a2f"/>
  <path d="M108 40c0-14 8-24 18-26-4 10-8 20-12 28z" fill="#ffb02e"/>
  <path d="M90 50c-12-8-16-20-12-28 6 8 12 16 16 26z" fill="#e8483f"/>
  <circle cx="116" cy="78" r="44" fill="#2fb55a"/>
  <ellipse cx="128" cy="70" rx="18" ry="20" fill="#fff"/>
  <circle cx="131" cy="71" r="9.5" fill="#2b2340"/>
  <circle cx="134.5" cy="66.5" r="3.2" fill="#fff"/>
  <ellipse cx="116" cy="98" rx="9" ry="6" fill="#ff8fa3" opacity="0.75"/>
  <g class="pg-beak-low"><path d="M149 92c13 0 23 5 23 12-8 9-19 8-25-1z" fill="#e57f00" stroke="#b86100" stroke-width="2" stroke-linejoin="round"/></g>
  <path d="M145 70c22-8 40 6 34 32-5-6-15-10-30-9z" fill="#ffae1f" stroke="#c97c00" stroke-width="2" stroke-linejoin="round"/>
  <g class="pg-waves" fill="none" stroke="#5b4bdb" stroke-width="5" stroke-linecap="round">
    <path class="pg-wave" d="M192 86a14 14 0 0 1 0 20"/>
    <path class="pg-wave" d="M200 78a24 24 0 0 1 0 36"/>
    <path class="pg-wave" d="M208 70a34 34 0 0 1 0 52"/>
  </g>
</svg>`;
}

/** The home tile: the parrot itself. */
export function tileSvg() {
  return parrotSvg('papegaai-tile-svg');
}

/** The sign of every voice, on its button (48 × 48). */
const SIGNS = {
  gewoon: `<circle cx="22" cy="25" r="15" fill="#2fb55a"/><circle cx="26" cy="21" r="6" fill="#fff"/><circle cx="27" cy="21" r="3" fill="#2b2340"/><path d="M35 22c7-1 10 5 7 11-3-3-6-4-9-4z" fill="#ffae1f"/><path d="M18 11c-1-5 1-8 4-9 0 4 0 7-1 9z" fill="#ff7a2f"/>`,
  muis: `<circle cx="13" cy="15" r="9" fill="#9aa0b4"/><circle cx="35" cy="15" r="9" fill="#9aa0b4"/><circle cx="13" cy="15" r="5" fill="#ffb3c4"/><circle cx="35" cy="15" r="5" fill="#ffb3c4"/><ellipse cx="24" cy="29" rx="13" ry="12" fill="#b4b9ca"/><circle cx="19" cy="27" r="2.3" fill="#2b2340"/><circle cx="29" cy="27" r="2.3" fill="#2b2340"/><circle cx="24" cy="33" r="2.6" fill="#ff7b9c"/><path d="M14 33l-8-1M14 36l-7 2M34 33l8-1M34 36l7 2" stroke="#6b7088" stroke-width="1.5" stroke-linecap="round"/>`,
  beer: `<circle cx="12" cy="14" r="7" fill="#a0673a"/><circle cx="36" cy="14" r="7" fill="#a0673a"/><circle cx="12" cy="14" r="3.5" fill="#d9a46e"/><circle cx="36" cy="14" r="3.5" fill="#d9a46e"/><circle cx="24" cy="27" r="16" fill="#a0673a"/><ellipse cx="24" cy="33" rx="8" ry="6" fill="#e3b98c"/><ellipse cx="24" cy="30.5" rx="3.4" ry="2.4" fill="#3a2418"/><circle cx="18" cy="23" r="2.4" fill="#2b2340"/><circle cx="30" cy="23" r="2.4" fill="#2b2340"/>`,
  achteruit: `<path d="M23 12v24L6 24z" fill="#7a5af5"/><path d="M41 12v24L24 24z" fill="#a58cff"/>`,
  echo: `<circle cx="10" cy="24" r="5" fill="#13a89e"/><g fill="none" stroke="#13a89e" stroke-width="4" stroke-linecap="round"><path d="M19 16a11 11 0 0 1 0 16"/><path d="M27 10a19 19 0 0 1 0 28" opacity="0.65"/><path d="M35 5a27 27 0 0 1 0 38" opacity="0.35"/></g>`,
  koor: `<circle cx="11" cy="31" r="8" fill="#2fb55a"/><circle cx="24" cy="18" r="8.5" fill="#3a7bd5"/><circle cx="37" cy="31" r="8" fill="#e8483f"/><circle cx="13" cy="29" r="2" fill="#2b2340"/><circle cx="26" cy="16" r="2" fill="#2b2340"/><circle cx="39" cy="29" r="2" fill="#2b2340"/><path d="M18 30l5 2-5 2z" fill="#ffae1f"/><path d="M31.5 17l5 2-5 2z" fill="#ffae1f"/><path d="M44 30l3.5 2-3.5 2z" fill="#ffae1f"/>`,
  ballon: `<ellipse cx="24" cy="18" rx="12" ry="14" fill="#ff5a7a"/><ellipse cx="19" cy="12" rx="3.5" ry="5" fill="#fff" opacity="0.55"/><path d="M21 33h6l-3-3z" fill="#e0405f"/><path d="M24 33c-4 4 4 7 0 13" fill="none" stroke="#6b7088" stroke-width="1.8" stroke-linecap="round"/>`,
};
export const SIGN_IDS = Object.keys(SIGNS);

export function voiceSvg(id) {
  return `<svg class="pg-sign" viewBox="0 0 48 48" aria-hidden="true">${SIGNS[id] || ''}</svg>`;
}

/** The record button's microphone, and the square it shows while it listens after a tap. */
export const MIC = '<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 17v3.5M8.5 21h7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';
export const STOP = '<rect x="6" y="6" width="12" height="12" rx="2.5"/>';
export const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
