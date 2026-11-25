// Winkeltje's drawings, in code (no image files): our own simplified euro coins and notes, the
// things in the shop, the home tile and the picture on the how-to card.
// The money is ours, never a copy of the real designs: no national side, no map of Europe, no
// stars, no banknote architecture, no ECB marks. What is kept is what a child needs to tell them
// apart: the colours (copper 1, 2 and 5 cent; gold 10, 20 and 50 cent; two metals for € 1 and € 2,
// the other way round), the sizes relative to each other (SIZE_MM) and the value, large.
// No ids or url(#) anywhere: a drawing is used many times on one page.
import { SIZE_MM, isNote } from './rules.js';

const METAL = {
  copper: { face: '#d98a55', rim: '#a8582b', ink: '#5a250b', shine: '#f3b48a' },
  gold: { face: '#ecc85e', rim: '#b98e22', ink: '#5a4310', shine: '#fbe7a2' },
  silver: { face: '#d5dae0', rim: '#8e97a3', ink: '#2f3742', shine: '#f4f6f8' },
};
const NOTE = {
  500: { face: '#dfe1e4', band: '#a9adb3', ink: '#3a3f46', mark: '#c4c8cd' },
  1000: { face: '#f7d4cb', band: '#d9796a', ink: '#6b2219', mark: '#efb3a6' },
  2000: { face: '#d3e3f6', band: '#6f9ad6', ink: '#1d3a66', mark: '#adc8ec' },
};
const metalOf = (d) => (d < 10 ? 'copper' : d < 100 ? 'gold' : 'bi');

/** The biggest coin's diameter in mm: a coin is drawn at SIZE_MM[d] / BIG of its box. */
export const BIG = SIZE_MM[200];

/** The number on the face: 50 for 50 cent, 2 for € 2. */
export const faceValue = (d) => String(d >= 100 ? d / 100 : d);

/**
 * A coin as SVG, drawn in a 100 x 100 box at its real size relative to € 2 (which fills it).
 * `unit` is the small word under the value ('cent' or 'euro', from t()).
 */
export function coinSvg(d, { unit = d >= 100 ? 'euro' : 'cent', cls = '' } = {}) {
  const r = (48 * SIZE_MM[d]) / BIG;
  const kind = metalOf(d);
  // € 1: a gold ring round a silver middle; € 2: a silver ring round a gold middle
  const outer = kind === 'bi' ? METAL[d === 100 ? 'gold' : 'silver'] : METAL[kind];
  const inner = kind === 'bi' ? METAL[d === 100 ? 'silver' : 'gold'] : METAL[kind];
  const size = String(faceValue(d)).length > 1 ? r * 0.82 : r * 1.02;
  const parts = [
    `<circle cx="50" cy="50" r="${r.toFixed(2)}" fill="${outer.face}" stroke="${outer.rim}" stroke-width="${(r * 0.09).toFixed(2)}"/>`,
  ];
  if (kind === 'bi') parts.push(`<circle cx="50" cy="50" r="${(r * 0.7).toFixed(2)}" fill="${inner.face}" stroke="${inner.rim}" stroke-width="${(r * 0.05).toFixed(2)}"/>`);
  else parts.push(`<circle cx="50" cy="50" r="${(r * 0.8).toFixed(2)}" fill="none" stroke="${outer.rim}" stroke-width="${(r * 0.035).toFixed(2)}" opacity="0.6"/>`);
  parts.push(`<path d="M${(50 - r * 0.6).toFixed(2)} ${(50 - r * 0.5).toFixed(2)}A${(r * 0.78).toFixed(2)} ${(r * 0.78).toFixed(2)} 0 0 1 ${(50 + r * 0.25).toFixed(2)} ${(50 - r * 0.74).toFixed(2)}" fill="none" stroke="${inner.shine}" stroke-width="${(r * 0.08).toFixed(2)}" stroke-linecap="round" opacity="0.8"/>`);
  parts.push(`<text x="50" y="${(50 + size * 0.24).toFixed(2)}" font-size="${size.toFixed(2)}" text-anchor="middle" font-weight="900" fill="${inner.ink}" class="wk-face">${faceValue(d)}</text>`);
  if (unit) parts.push(`<text x="50" y="${(50 + r * 0.62).toFixed(2)}" font-size="${(r * 0.27).toFixed(2)}" text-anchor="middle" font-weight="800" fill="${inner.ink}" class="wk-unit">${unit}</text>`);
  return `<svg class="wk-coin ${cls}" viewBox="0 0 100 100" aria-hidden="true">${parts.join('')}</svg>`;
}

/**
 * A note as SVG in a 140 x 76 box at its real size relative to € 20 (which fills it): a plain
 * coloured note with a band, a few soft circles and the value large. Never a building, a bridge,
 * a map, a flag of stars or a bank's mark.
 */
export function noteSvg(d, { unit = 'euro', cls = '' } = {}) {
  const [mw, mh] = SIZE_MM[d];
  const [bw, bh] = SIZE_MM[2000];
  const w = (136 * mw) / bw;
  const h = (72 * mh) / bh;
  const x = (140 - w) / 2;
  const y = (76 - h) / 2;
  const c = NOTE[d];
  const v = faceValue(d);
  return `<svg class="wk-note ${cls}" viewBox="0 0 140 76" aria-hidden="true">
    <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="5" fill="${c.face}" stroke="${c.band}" stroke-width="2.4"/>
    <rect x="${(x + 4).toFixed(2)}" y="${(y + 4).toFixed(2)}" width="${(w * 0.2).toFixed(2)}" height="${(h - 8).toFixed(2)}" rx="3" fill="${c.band}" opacity="0.55"/>
    <circle cx="${(x + w * 0.78).toFixed(2)}" cy="${(y + h * 0.5).toFixed(2)}" r="${(h * 0.34).toFixed(2)}" fill="${c.mark}"/>
    <circle cx="${(x + w * 0.78).toFixed(2)}" cy="${(y + h * 0.5).toFixed(2)}" r="${(h * 0.2).toFixed(2)}" fill="none" stroke="${c.band}" stroke-width="1.6" opacity="0.7"/>
    <text x="${(x + w * 0.14).toFixed(2)}" y="${(y + h * 0.36).toFixed(2)}" font-size="${(h * 0.26).toFixed(2)}" text-anchor="middle" font-weight="900" fill="#fff" class="wk-face">${v}</text>
    <text x="${(x + w * 0.5).toFixed(2)}" y="${(y + h * 0.6).toFixed(2)}" font-size="${(h * 0.5).toFixed(2)}" text-anchor="middle" font-weight="900" fill="${c.ink}" class="wk-face">${v}</text>
    ${unit ? `<text x="${(x + w * 0.5).toFixed(2)}" y="${(y + h * 0.86).toFixed(2)}" font-size="${(h * 0.17).toFixed(2)}" text-anchor="middle" font-weight="800" fill="${c.ink}" class="wk-unit">${unit}</text>` : ''}
  </svg>`;
}

/** A coin or a note. */
export const moneySvg = (d, opts = {}) => (isNote(d) ? noteSvg(d, opts) : coinSvg(d, opts));

// ---------- the things in the shop (64 x 64, each a different shape and colour) ----------

const INK = '#4a3424';
const S = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;

export const ITEM_ART = Object.freeze({
  apple: `<path d="M32 20c-6-5-20-4-21 11-1 13 9 26 15 26 3 0 4-2 6-2s3 2 6 2c6 0 16-13 15-26-1-15-15-16-21-11z" fill="#e5483b" ${S}/><path d="M32 20c0-5 1-9 4-12" fill="none" ${S}/><path d="M35 12c4-4 10-4 12-2-3 4-8 5-12 2z" fill="#5cb85c" ${S}/><path d="M19 30c1-4 4-6 7-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`,
  banana: `<path d="M12 22c4 18 18 30 38 28 4 0 6-3 4-5-16 2-28-8-34-25-1-3-8-2-8 2z" fill="#f6d33c" ${S}/><path d="M12 22l-3-6 5-1 2 5" fill="#8a6a2a" ${S}/><path d="M54 45l3 1" ${S}/>`,
  carrot: `<path d="M22 24l24 6c3 1 3 5 0 7L16 56c-3 2-6-1-5-4l7-25c1-3 2-4 4-3z" fill="#f28a2e" ${S}/><path d="M42 26c2-8 8-14 14-14-1 7-6 12-14 14zM40 25c-3-7-2-15 3-19 2 6 1 13-3 19z" fill="#5cb85c" ${S}/><path d="M24 36l5 2M20 46l5 1" ${S}/>`,
  lolly: `<path d="M32 36v24" stroke="#c9a36b" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="24" r="17" fill="#f06aa8" ${S}/><path d="M32 24m-10 0a10 10 0 1 1 10 10a6 6 0 1 1 6-6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`,
  cookie: `<circle cx="32" cy="33" r="22" fill="#d9a15b" ${S}/><circle cx="24" cy="26" r="3" fill="${INK}"/><circle cx="38" cy="24" r="2.6" fill="${INK}"/><circle cx="40" cy="38" r="3" fill="${INK}"/><circle cx="26" cy="41" r="2.6" fill="${INK}"/><circle cx="32" cy="33" r="2" fill="${INK}"/>`,
  milk: `<path d="M20 20l6-10h12l6 10v36c0 2-1 3-3 3H23c-2 0-3-1-3-3z" fill="#fff" ${S}/><path d="M20 20h24" ${S}/><rect x="24" y="30" width="16" height="16" rx="3" fill="#5aa7e8"/><path d="M28 38h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  pencil: `<path d="M14 50l30-30 6 6-30 30-9 3z" fill="#f2c230" ${S}/><path d="M44 20l4-4c2-2 4-2 6 0s2 4 0 6l-4 4z" fill="#f48aa0" ${S}/><path d="M11 59l3-9 6 6z" fill="#e7c9a0" ${S}/><path d="M18 46l26-26" stroke="#d29c12" stroke-width="2"/>`,
  balloon: `<path d="M32 46c-11 0-18-11-18-21 0-10 8-17 18-17s18 7 18 17c0 10-7 21-18 21z" fill="#8f6bf0" ${S}/><path d="M29 46l3 4 3-4z" fill="#8f6bf0" ${S}/><path d="M32 50c-4 4 4 6 0 12" fill="none" ${S}/><path d="M22 20c2-4 5-6 8-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`,
  bread: `<path d="M10 30c0-10 10-14 22-14s22 4 22 14c0 3-2 4-4 5v17c0 2-1 3-3 3H17c-2 0-3-1-3-3V35c-2-1-4-2-4-5z" fill="#e0a45a" ${S}/><path d="M24 26l-3 6M33 25l-3 6M42 26l-3 6" stroke="#b5762f" stroke-width="2.4" stroke-linecap="round"/>`,
  icecream: `<path d="M22 32l10 28 10-28z" fill="#e3b06a" ${S}/><path d="M25 38l12 8M28 46l7-6" stroke="#b5762f" stroke-width="1.8"/><circle cx="32" cy="22" r="12" fill="#ffb3c7" ${S}/><path d="M20 30c4 3 20 3 24 0" fill="#ffb3c7" ${S}/><circle cx="32" cy="9" r="3.5" fill="#e5483b" ${S}/>`,
  cheese: `<path d="M8 42l30-24 18 12v18H8z" fill="#f7c948" ${S}/><path d="M8 42h48" ${S}/><circle cx="22" cy="50" r="3" fill="#e0a92a"/><circle cx="40" cy="47" r="4" fill="#e0a92a"/><circle cx="34" cy="34" r="2.6" fill="#e0a92a"/>`,
  car: `<path d="M8 42v-6c0-3 2-5 5-5h6l6-9h16l8 9h4c3 0 5 2 5 5v6z" fill="#3fb3a5" ${S}/><path d="M27 25h6v6h-11zM37 25h3l6 6h-9z" fill="#d8f3ff" ${S}/><circle cx="20" cy="44" r="6" fill="#4a3424"/><circle cx="46" cy="44" r="6" fill="#4a3424"/><circle cx="20" cy="44" r="2.4" fill="#ccc"/><circle cx="46" cy="44" r="2.4" fill="#ccc"/>`,
  ball: `<circle cx="32" cy="32" r="22" fill="#ff6b5b" ${S}/><path d="M10 32h44" stroke="#fff" stroke-width="5"/><path d="M32 10c-8 7-8 37 0 44" fill="none" stroke="#ffd34d" stroke-width="5"/><circle cx="32" cy="32" r="22" fill="none" ${S}/>`,
  book: `<path d="M10 16c8-3 16-3 22 2v38c-6-5-14-5-22-2z" fill="#4f8fe6" ${S}/><path d="M54 16c-8-3-16-3-22 2v38c6-5 14-5 22-2z" fill="#6aa5f2" ${S}/><path d="M15 26c4-1 8-1 12 1M15 33c4-1 8-1 12 1M37 27c4-2 8-2 12-1M37 34c4-2 8-2 12-1" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  teddy: `<circle cx="18" cy="16" r="7" fill="#b47a46" ${S}/><circle cx="46" cy="16" r="7" fill="#b47a46" ${S}/><ellipse cx="32" cy="46" rx="16" ry="14" fill="#b47a46" ${S}/><circle cx="32" cy="26" r="15" fill="#c98b52" ${S}/><ellipse cx="32" cy="31" rx="6" ry="4.5" fill="#f0d1a8"/><circle cx="26" cy="23" r="2" fill="${INK}"/><circle cx="38" cy="23" r="2" fill="${INK}"/><circle cx="32" cy="29" r="2" fill="${INK}"/><ellipse cx="32" cy="48" rx="8" ry="7" fill="#f0d1a8"/>`,
  kite: `<path d="M32 6l18 20-18 24-18-24z" fill="#3fb35f" ${S}/><path d="M32 6v44M14 26h36" stroke="#fff" stroke-width="2.2"/><path d="M32 50c-5 3 5 5 0 8s5 4 1 6" fill="none" ${S}/><path d="M30 55l-5-2v5zM33 61l5-2v5z" fill="#ffd34d"/>`,
});

/** One thing from the shop as an SVG. */
export function itemSvg(id, cls = '') {
  return `<svg class="wk-item-art ${cls}" viewBox="0 0 64 64" aria-hidden="true">${ITEM_ART[id] || ''}</svg>`;
}

/** The striped awning over the shop. */
function awning(x, y, w, n = 6) {
  const step = w / n;
  const out = [];
  for (let k = 0; k < n; k++) {
    const x0 = x + k * step;
    out.push(`<path d="M${x0} ${y}h${step}v12a${step / 2} ${step / 2} 0 0 1 ${-step} 0z" fill="${k % 2 ? '#fff' : '#ff8a3d'}" stroke="#c2410c" stroke-width="2"/>`);
  }
  return out.join('');
}

/** The home tile: a little shop with an awning, an apple on the counter and two coins. */
export function tileSvg() {
  return `<svg class="wk-tile-svg" viewBox="0 0 120 100" aria-hidden="true">
    <rect x="14" y="22" width="92" height="66" rx="6" fill="#fff6e6" stroke="#8a5a2b" stroke-width="3"/>
    ${awning(10, 14, 100, 6)}
    <rect x="10" y="62" width="100" height="16" rx="4" fill="#c98b52" stroke="#8a5a2b" stroke-width="3"/>
    <g transform="translate(20 30) scale(0.5)">${ITEM_ART.apple}</g>
    <g transform="translate(58 40)"><svg width="26" height="26" viewBox="0 0 100 100">${inner(coinSvg(200, { unit: '' }))}</svg></g>
    <g transform="translate(80 44)"><svg width="22" height="22" viewBox="0 0 100 100">${inner(coinSvg(50, { unit: '' }))}</svg></g>
  </svg>`;
}

/** The how-to picture: the counter with a price tag, coins on it and the purse. */
export function howSvg() {
  return `<svg class="wk-how-svg" viewBox="0 0 160 110" aria-hidden="true">
    ${awning(8, 6, 144, 8)}
    <rect x="8" y="70" width="144" height="18" rx="5" fill="#c98b52" stroke="#8a5a2b" stroke-width="3"/>
    <g transform="translate(14 22) scale(0.72)">${ITEM_ART.icecream}</g>
    <rect x="62" y="30" width="44" height="26" rx="6" fill="#fff" stroke="#5b4bdb" stroke-width="3"/>
    <circle cx="72" cy="43" r="5" fill="#ecc85e" stroke="#b98e22" stroke-width="2"/><circle cx="84" cy="43" r="5" fill="#ecc85e" stroke="#b98e22" stroke-width="2"/><circle cx="96" cy="43" r="5" fill="#ecc85e" stroke="#b98e22" stroke-width="2"/>
    <g transform="translate(110 40)"><svg width="30" height="30" viewBox="0 0 100 100">${inner(coinSvg(100, { unit: '' }))}</svg></g>
    <g transform="translate(124 52)"><svg width="30" height="30" viewBox="0 0 100 100">${inner(coinSvg(200, { unit: '' }))}</svg></g>
    <g transform="translate(40 88)"><svg width="80" height="22" viewBox="0 0 140 76">${inner(noteSvg(500, { unit: '' }))}</svg></g>
  </svg>`;
}

/** The inside of an <svg>...</svg> string (to nest a drawing in another one). */
function inner(svg) {
  return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}
