// Klok kijken: the clock and the pictures, drawn in code (SVG). The clock is a friendly alarm clock:
// a purple rim with two little bells, numbers 1-12, minute marks, a short orange hour hand and a
// long blue minute hand. The interactive clock keeps its hands as elements, so a drag only turns
// them (setHands); the small clocks for answers and the home tile are plain strings.
import { hourAngle, minuteAngle, isDay } from './time.js';

const INK = '#2b2370';
const RIM = '#5b4bdb';
const FACE = '#fffaf0';
const HOUR = '#ff7a3d';
const MINUTE = '#3b82f6';
const GOLD = '#ffc531';

function ticks() {
  let s = '';
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    const a = (i * 6 * Math.PI) / 180;
    const r1 = big ? 72 : 76;
    const r2 = 81;
    const x1 = 100 + r1 * Math.sin(a);
    const y1 = 100 - r1 * Math.cos(a);
    const x2 = 100 + r2 * Math.sin(a);
    const y2 = 100 - r2 * Math.cos(a);
    s += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${big ? INK : '#b9b2e6'}" stroke-width="${big ? 3 : 1.6}" stroke-linecap="round"/>`;
  }
  return s;
}

function numbers(size = 17) {
  let s = '';
  for (let n = 1; n <= 12; n++) {
    const a = (n * 30 * Math.PI) / 180;
    const r = 60;
    const x = 100 + r * Math.sin(a);
    const y = 100 - r * Math.cos(a);
    // drawn over the hands, with a halo in the face colour, so a hand never hides a number
    s += `<text x="${x.toFixed(1)}" y="${(y + size * 0.36).toFixed(1)}" text-anchor="middle" font-size="${size}" font-weight="900" fill="${INK}" stroke="${FACE}" stroke-width="4" stroke-linejoin="round" paint-order="stroke" font-family="ui-rounded, Nunito, system-ui, sans-serif">${n}</text>`;
  }
  return s;
}

function bells() {
  // two little alarm bells on top and two feet below, peeking out from behind the rim
  const part = (deg, d, shape) => {
    const a = (deg * Math.PI) / 180;
    return `<g transform="translate(${(100 + d * Math.sin(a)).toFixed(2)} ${(100 - d * Math.cos(a)).toFixed(2)}) rotate(${deg})">${shape}</g>`;
  };
  const bell = `<path d="M-19 4 a19 19 0 0 1 38 0 z" fill="${GOLD}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-8 -9 a12 12 0 0 1 9 -4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`;
  const foot = `<path d="M-7 -4 h14 l-3 12 h-8 z" fill="${RIM}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  return part(-38, 96, bell) + part(38, 96, bell) + part(-148, 96, foot) + part(148, 96, foot);
}

/**
 * A sun (day) or a moon (night) on a little white badge on top of the clock, between the bells,
 * where the hands never come.
 */
export function dayPartSvg(day, cx = 100, cy = -5, r = 12) {
  const badge = `<circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
  if (day) {
    let rays = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * 45 * Math.PI) / 180;
      rays += `<line x1="${(cx + (r - 1) * Math.sin(a)).toFixed(1)}" y1="${(cy - (r - 1) * Math.cos(a)).toFixed(1)}" x2="${(cx + (r + 3) * Math.sin(a)).toFixed(1)}" y2="${(cy - (r + 3) * Math.cos(a)).toFixed(1)}" stroke="${HOUR}" stroke-width="2.6" stroke-linecap="round"/>`;
    }
    return `<g class="klok-daypart" data-day="1">${badge}${rays}<circle cx="${cx}" cy="${cy}" r="${r - 3}" fill="${GOLD}" stroke="${HOUR}" stroke-width="2"/></g>`;
  }
  const k = r - 1;
  return `<g class="klok-daypart" data-day="0">${badge}<path d="M${cx + 2} ${cy - k} a${k} ${k} 0 1 0 ${k - 1} ${2 * k - 3} a${k - 2} ${k - 2} 0 1 1 ${-k + 1} ${-2 * k + 3} z" fill="#8f86e8" stroke="${RIM}" stroke-width="2" stroke-linejoin="round"/><circle cx="${cx + k}" cy="${cy - 4}" r="1.8" fill="${GOLD}"/></g>`;
}

function hands(t, id = '') {
  const hid = id ? ` id="${id}-hour"` : '';
  const mid = id ? ` id="${id}-minute"` : '';
  return (
    `<g class="klok-hand hour"${hid} transform="rotate(${hourAngle(t).toFixed(2)} 100 100)">` +
    `<path class="hit" d="M100 100 L100 46" stroke="transparent" stroke-width="30" stroke-linecap="round"/>` + // a wider grip
    `<path d="M100 100 L100 52" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="M100 100 L100 52" stroke="${HOUR}" stroke-width="8" stroke-linecap="round"/></g>` +
    `<g class="klok-hand minute"${mid} transform="rotate(${minuteAngle(t).toFixed(2)} 100 100)">` +
    `<path d="M100 104 L100 26" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M100 104 L100 26" stroke="${MINUTE}" stroke-width="4.6" stroke-linecap="round"/></g>` +
    ''
  );
}
const CAP = `<circle cx="100" cy="100" r="8" fill="${GOLD}" stroke="${INK}" stroke-width="3"/>`;

/**
 * The whole clock as an SVG string. `id` names the hand groups (for the interactive clock),
 * `dayPart` draws a sun or a moon, `numbers` false leaves the numbers off (tiny clocks).
 */
export function clockSvg(t, { id = '', dayPart = false, small = false, cls = '' } = {}) {
  return (
    `<svg class="klok-svg ${cls}" viewBox="-10 -24 220 238" aria-hidden="true">` +
    bells() +
    `<circle cx="100" cy="100" r="97" fill="${RIM}" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="100" cy="100" r="86" fill="${FACE}"/>` +
    `<circle cx="100" cy="100" r="86" fill="none" stroke="#e7e0ff" stroke-width="5"/>` +
    ticks() +
    hands(t, id) +
    numbers(small ? 19 : 17) +
    CAP +
    `<g class="klok-daypart-slot">${dayPart ? dayPartSvg(isDay(t)) : ''}</g>` +
    `</svg>`
  );
}

/** Turn the hands of an interactive clock (made with clockSvg(..., { id })). */
export function setHands(root, id, t, { dayPart = false } = {}) {
  const h = root.querySelector(`#${id}-hour`);
  const m = root.querySelector(`#${id}-minute`);
  if (h) h.setAttribute('transform', `rotate(${hourAngle(t).toFixed(2)} 100 100)`);
  if (m) m.setAttribute('transform', `rotate(${minuteAngle(t).toFixed(2)} 100 100)`);
  const slot = root.querySelector('.klok-daypart-slot');
  if (slot) {
    const want = dayPart ? (isDay(t) ? '1' : '0') : '';
    const have = slot.firstElementChild?.getAttribute('data-day') || '';
    if (want !== have) slot.innerHTML = dayPart ? dayPartSvg(isDay(t)) : '';
  }
}

/** The home tile: the clock at ten past ten, the friendliest time there is. */
export function tileSvg() {
  return clockSvg(10 * 60 + 10, { small: true, cls: 'klok-tile-svg' });
}

/** The pictures for the modes in the menu. */
export function modeSvg(mode) {
  if (mode === 'set') {
    return `<svg viewBox="0 0 70 52" aria-hidden="true"><circle cx="30" cy="27" r="22" fill="${FACE}" stroke="${RIM}" stroke-width="4"/><path d="M30 27 L30 13" stroke="${MINUTE}" stroke-width="4" stroke-linecap="round"/><path d="M30 27 L40 31" stroke="${HOUR}" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="27" r="3" fill="${GOLD}"/><path d="M52 14 l10 6 -5 2 4 8 -3 1 -4 -8 -4 4 z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }
  if (mode === 'read') {
    return `<svg viewBox="0 0 70 52" aria-hidden="true"><circle cx="26" cy="27" r="22" fill="${FACE}" stroke="${RIM}" stroke-width="4"/><path d="M26 27 L26 12" stroke="${MINUTE}" stroke-width="4" stroke-linecap="round"/><path d="M26 27 L16 33" stroke="${HOUR}" stroke-width="5" stroke-linecap="round"/><circle cx="26" cy="27" r="3" fill="${GOLD}"/><text x="58" y="36" text-anchor="middle" font-size="26" font-weight="900" fill="${RIM}" font-family="ui-rounded, Nunito, system-ui, sans-serif">?</text></svg>`;
  }
  return `<svg viewBox="0 0 70 52" aria-hidden="true"><circle cx="20" cy="22" r="11" fill="${GOLD}" stroke="${HOUR}" stroke-width="2.5"/><path d="M50 10 a14 14 0 1 0 12 22 a11 11 0 1 1 -12 -22 z" fill="#8f86e8" stroke="${RIM}" stroke-width="2.5" stroke-linejoin="round"/><path d="M6 46 Q35 32 64 46" fill="none" stroke="#7cc46f" stroke-width="4" stroke-linecap="round"/></svg>`;
}

// ---------- the daily rhythm pictures ----------

const ICONS = {
  breakfast:
    '<path d="M14 40 h52 a26 20 0 0 1 -52 0 z" fill="#fff" stroke="#2b2370" stroke-width="3" stroke-linejoin="round"/><path d="M18 40 h44" stroke="#2b2370" stroke-width="3"/><circle cx="30" cy="36" r="4" fill="#ffc531"/><circle cx="40" cy="34" r="4" fill="#ff8a3d"/><circle cx="50" cy="36" r="4" fill="#ffc531"/><path d="M58 16 l-12 22" stroke="#9aa3b5" stroke-width="5" stroke-linecap="round"/><ellipse cx="60" cy="13" rx="5" ry="7" fill="#9aa3b5" transform="rotate(30 60 13)"/>',
  school:
    '<rect x="16" y="20" width="48" height="46" rx="10" fill="#ff8a3d" stroke="#2b2370" stroke-width="3"/><path d="M26 20 v-6 a14 10 0 0 1 28 0 v6" fill="none" stroke="#2b2370" stroke-width="3"/><rect x="24" y="38" width="32" height="18" rx="5" fill="#ffc531" stroke="#2b2370" stroke-width="3"/><path d="M24 46 h32" stroke="#2b2370" stroke-width="2.5"/>',
  lunch:
    '<path d="M12 46 q28 -26 56 0 z" fill="#f2c27a" stroke="#2b2370" stroke-width="3" stroke-linejoin="round"/><path d="M14 46 h52 l-4 6 h-44 z" fill="#7cc46f" stroke="#2b2370" stroke-width="3" stroke-linejoin="round"/><path d="M16 52 h48 l-4 6 h-40 z" fill="#ff7a6b" stroke="#2b2370" stroke-width="3" stroke-linejoin="round"/><path d="M18 58 h44 a6 6 0 0 1 -6 6 h-32 a6 6 0 0 1 -6 -6 z" fill="#f2c27a" stroke="#2b2370" stroke-width="3" stroke-linejoin="round"/>',
  play:
    '<circle cx="64" cy="13" r="8" fill="#ffc531" stroke="#ff8a3d" stroke-width="2"/><path d="M2 66 q38 -16 76 0 v6 h-76 z" fill="#7cc46f" stroke="#2b2370" stroke-width="3" stroke-linejoin="round"/><path d="M14 60 l-2 -6 M20 58 l1 -6 M58 58 l2 -6 M66 61 l3 -5" stroke="#2f8f46" stroke-width="2.4" stroke-linecap="round"/><g transform="translate(36 38)"><circle r="18" fill="#fff"/><path d="M0 -18 a18 18 0 0 1 15.6 9 L0 0 z" fill="#ff7a6b"/><path d="M15.6 9 a18 18 0 0 1 -15.6 9 L0 0 z" fill="#3b82f6"/><path d="M-15.6 9 a18 18 0 0 1 0 -18 L0 0 z" fill="#ffc531"/><circle r="18" fill="none" stroke="#2b2370" stroke-width="3"/><circle r="3.5" fill="#fff" stroke="#2b2370" stroke-width="2"/><path d="M-9 -11 a11 11 0 0 1 6 -3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.9"/></g><path d="M12 30 q-4 5 0 10 M8 26 q-6 9 0 18" fill="none" stroke="#9aa3b5" stroke-width="2.2" stroke-linecap="round"/>',
  dinner:
    '<circle cx="40" cy="42" r="22" fill="#fff" stroke="#2b2370" stroke-width="3"/><circle cx="40" cy="42" r="14" fill="#fff6e3" stroke="#e7e0ff" stroke-width="3"/><circle cx="35" cy="40" r="4" fill="#7cc46f"/><circle cx="44" cy="45" r="5" fill="#ff8a3d"/><path d="M10 22 v18 M6 22 v8 a4 4 0 0 0 8 0 v-8" fill="none" stroke="#9aa3b5" stroke-width="3" stroke-linecap="round"/><path d="M70 22 q-6 8 0 16 v24" fill="none" stroke="#9aa3b5" stroke-width="3" stroke-linecap="round"/>',
  bath:
    '<path d="M8 38 h64 v6 a18 16 0 0 1 -18 16 h-28 a18 16 0 0 1 -18 -16 z" fill="#fff" stroke="#2b2370" stroke-width="3" stroke-linejoin="round"/><path d="M14 64 l-3 6 M66 64 l3 6" stroke="#2b2370" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="32" r="7" fill="#d6eeff" stroke="#5b4bdb" stroke-width="2"/><circle cx="36" cy="28" r="9" fill="#d6eeff" stroke="#5b4bdb" stroke-width="2"/><circle cx="50" cy="31" r="6" fill="#d6eeff" stroke="#5b4bdb" stroke-width="2"/><path d="M14 38 v-22 a6 6 0 0 1 12 0" fill="none" stroke="#9aa3b5" stroke-width="3" stroke-linecap="round"/>',
  bed:
    '<rect x="8" y="40" width="64" height="16" rx="4" fill="#8f86e8" stroke="#2b2370" stroke-width="3"/><rect x="8" y="26" width="10" height="38" rx="3" fill="#ff8a3d" stroke="#2b2370" stroke-width="3"/><rect x="62" y="34" width="10" height="30" rx="3" fill="#ff8a3d" stroke="#2b2370" stroke-width="3"/><ellipse cx="28" cy="38" rx="9" ry="6" fill="#fff" stroke="#2b2370" stroke-width="3"/><path d="M58 10 a9 9 0 1 0 8 14 a7 7 0 1 1 -8 -14 z" fill="#ffc531" stroke="#2b2370" stroke-width="2"/><text x="44" y="22" font-size="10" font-weight="900" fill="#5b4bdb" font-family="ui-rounded, Nunito, system-ui, sans-serif">z</text><text x="50" y="14" font-size="8" font-weight="900" fill="#5b4bdb" font-family="ui-rounded, Nunito, system-ui, sans-serif">z</text>',
};

export function activitySvg(id) {
  return `<svg class="klok-activity" viewBox="0 0 80 72" aria-hidden="true">${ICONS[id] || ''}</svg>`;
}
export const ACTIVITY_IDS = Object.keys(ICONS);
