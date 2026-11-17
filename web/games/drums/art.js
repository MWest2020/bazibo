// Drumstel pictures, drawn in code: every pad (a drum seen from the stool, the kick from the front,
// the cymbals as gold plates), the small pad signs in the strip of steps to come, the home tile and
// the cards in the rhythm list. Each pad differs by shape as well as colour: drums have a white head
// and a coloured shell, the snare a ring of wires, the cymbals rings and a bell (the crash rays,
// the ride a big bell, the hi-hat two plates).
import { padById, rhythmById } from './kit.js';

const INK = '#2b2370';
const HEAD = '#fff8e7';
const METAL = '#c9cde0';

const f = (n) => Math.round(n * 10) / 10;

/** A drum seen from above: shell rim, white head, little tension lugs around it. */
function drumTop(cx, cy, r, color, extra = '') {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="${INK}" stroke-width="${f(r * 0.07)}"/>`;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const x = cx + Math.cos(a) * r * 0.91;
    const y = cy + Math.sin(a) * r * 0.91;
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.06)}" fill="${METAL}" stroke="${INK}" stroke-width="${f(r * 0.03)}"/>`;
  }
  s += `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.78)}" fill="${HEAD}" stroke="${INK}" stroke-width="${f(r * 0.045)}"/>`;
  s += `<ellipse cx="${f(cx - r * 0.28)}" cy="${f(cy - r * 0.32)}" rx="${f(r * 0.22)}" ry="${f(r * 0.1)}" transform="rotate(-35 ${f(cx - r * 0.28)} ${f(cy - r * 0.32)})" fill="#fff" opacity="0.9"/>`;
  return s + extra;
}

/** A cymbal: a gold plate with grooves and a bell. */
function cymbal(cx, cy, r, color, groove, bell, extra = '') {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="${INK}" stroke-width="${f(r * 0.06)}"/>`;
  for (const k of [0.78, 0.58]) s += `<circle cx="${cx}" cy="${cy}" r="${f(r * k)}" fill="none" stroke="${groove}" stroke-width="${f(r * 0.045)}"/>`;
  s += extra;
  s += `<circle cx="${cx}" cy="${cy}" r="${f(r * bell)}" fill="${groove}" stroke="${INK}" stroke-width="${f(r * 0.045)}"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.06)}" fill="${INK}"/>`;
  return s;
}

/** The drawing of one pad, in a 100x100 box with some room around it. */
function padShape(id) {
  const p = padById(id);
  if (!p) return '';
  if (id === 'kick') {
    // the bass drum from the front: a big coloured hoop, a white head with a star, two little feet
    let s = `<path d="M24 86 L14 97 M76 86 L86 97" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    s += `<circle cx="50" cy="50" r="46" fill="${p.color}" stroke="${INK}" stroke-width="3.4"/>`;
    s += `<circle cx="50" cy="50" r="38" fill="${HEAD}" stroke="${INK}" stroke-width="2.4"/>`;
    s += `<path d="M50 30l5.6 11.6 12.7 1.6-9.3 8.8 2.4 12.6L50 58.4l-11.4 6.2 2.4-12.6-9.3-8.8 12.7-1.6z" fill="${p.color}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    s += `<ellipse cx="36" cy="30" rx="9" ry="4" transform="rotate(-35 36 30)" fill="#fff"/>`;
    return s;
  }
  if (id === 'snare') {
    // the snare: a dashed ring on the head (the wires showing through)
    return drumTop(50, 50, 42, p.color, `<circle cx="50" cy="50" r="22" fill="none" stroke="#e7d9b8" stroke-width="3" stroke-dasharray="5 4"/>`);
  }
  if (p.kind === 'tom') {
    const r = { tom1: 38, tom2: 41, floor: 45 }[id];
    const dots = { tom1: 1, tom2: 2, floor: 3 }[id]; // one, two or three dots: high, middle, floor tom
    let mark = '';
    for (let k = 0; k < dots; k++) mark += `<circle cx="${50 + (k - (dots - 1) / 2) * 11}" cy="50" r="4.2" fill="${p.color}" stroke="${INK}" stroke-width="1.6"/>`;
    return drumTop(50, 50, r, p.color, mark);
  }
  if (id === 'crash') {
    let rays = '';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      rays += `<path d="M${f(50 + Math.cos(a) * 16)} ${f(50 + Math.sin(a) * 16)} L${f(50 + Math.cos(a) * 34)} ${f(50 + Math.sin(a) * 34)}" stroke="#fff3b0" stroke-width="3" stroke-linecap="round"/>`;
    }
    return cymbal(50, 50, 44, p.color, '#e0a400', 0.2, rays);
  }
  if (id === 'ride') {
    return cymbal(50, 50, 46, p.color, '#c56f0c', 0.32);
  }
  if (id === 'hihat') {
    // two plates, the top one a little higher
    let s = `<ellipse cx="50" cy="60" rx="42" ry="30" fill="#b9bfd6" stroke="${INK}" stroke-width="3"/>`;
    s += cymbal(50, 45, 40, p.color, '#a3aac4', 0.24);
    return s;
  }
  return '';
}

/** A pad's picture: the whole box, centred, scaled to fit. */
export function padSvg(id) {
  return `<svg class="dpad-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${padShape(id)}</svg>`;
}

/** A small sign of a pad, for the strip of steps to come: its colour and its shape, simplified. */
export function padGlyph(id) {
  const p = padById(id);
  if (!p) return '';
  let s;
  if (p.kind === 'cymbal' || p.kind === 'ride' || p.kind === 'hihat') {
    const groove = { crash: '#e0a400', ride: '#c56f0c', hihat: '#a3aac4' }[id];
    s = `<circle cx="12" cy="12" r="10" fill="${p.color}" stroke="${INK}" stroke-width="2"/><circle cx="12" cy="12" r="${id === 'ride' ? 4.2 : 3}" fill="${groove}"/>`;
    if (id === 'hihat') s = `<ellipse cx="12" cy="15" rx="10" ry="6.5" fill="#b9bfd6" stroke="${INK}" stroke-width="2"/><circle cx="12" cy="10.5" r="9" fill="${p.color}" stroke="${INK}" stroke-width="2"/><circle cx="12" cy="10.5" r="2.6" fill="${groove}"/>`;
    if (id === 'crash') s += `<path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" stroke="#fff3b0" stroke-width="2" stroke-linecap="round"/>`;
  } else {
    s = `<circle cx="12" cy="12" r="10" fill="${p.color}" stroke="${INK}" stroke-width="2"/><circle cx="12" cy="12" r="6.4" fill="${HEAD}"/>`;
    if (id === 'kick') s += `<path d="M12 7.6l1.4 2.9 3.2.4-2.3 2.2.6 3.1-2.9-1.5-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z" fill="${p.color}"/>`;
    const dots = { tom1: 1, tom2: 2, floor: 3 }[id] || 0;
    for (let k = 0; k < dots; k++) s += `<circle cx="${12 + (k - (dots - 1) / 2) * 3.6}" cy="12" r="1.5" fill="${p.color}"/>`;
    if (id === 'snare') s += `<circle cx="12" cy="12" r="3.6" fill="none" stroke="#d9c79e" stroke-width="1.4" stroke-dasharray="2 1.6"/>`;
  }
  return `<svg class="dglyph" viewBox="0 0 24 24" aria-hidden="true">${s}</svg>`;
}

/** A little drum kit: the kick in front, a tom on top, the snare and the hi-hat left, a cymbal right. */
function miniKit() {
  let s = '';
  // stands
  s += `<path d="M16 34 V78 M10 82 L16 74 L22 82 M78 22 V78 M72 82 L78 74 L84 82" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;
  // cymbals (seen a little from the side)
  s += `<ellipse cx="78" cy="22" rx="17" ry="5" fill="#ffc531" stroke="${INK}" stroke-width="2.4"/><circle cx="78" cy="20" r="2.6" fill="#e0a400" stroke="${INK}" stroke-width="1.4"/>`;
  s += `<ellipse cx="16" cy="38" rx="13" ry="4" fill="#b9bfd6" stroke="${INK}" stroke-width="2.2"/><ellipse cx="16" cy="33" rx="13" ry="4" fill="#dfe3f0" stroke="${INK}" stroke-width="2.2"/>`;
  // the tom on the kick
  s += `<rect x="36" y="22" width="22" height="14" rx="3" fill="#4aa8ff" stroke="${INK}" stroke-width="2.4"/><ellipse cx="47" cy="22" rx="11" ry="3.6" fill="${HEAD}" stroke="${INK}" stroke-width="2.2"/>`;
  // the snare
  s += `<rect x="14" y="50" width="22" height="12" rx="3" fill="#ff8a3d" stroke="${INK}" stroke-width="2.4"/><ellipse cx="25" cy="50" rx="11" ry="3.6" fill="${HEAD}" stroke="${INK}" stroke-width="2.2"/>`;
  // the kick from the front
  s += `<circle cx="50" cy="60" r="24" fill="#ff5d6c" stroke="${INK}" stroke-width="3"/><circle cx="50" cy="60" r="18.5" fill="${HEAD}" stroke="${INK}" stroke-width="2.2"/>`;
  s += `<path d="M50 49.5l3.1 6.3 7 .9-5.1 4.8 1.3 6.9-6.3-3.4-6.3 3.4 1.3-6.9-5.1-4.8 7-.9z" fill="#ff5d6c" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
  // two sticks
  s += `<path d="M62 8 L74 40 M70 6 L66 40" stroke="#c98a4b" stroke-width="3.4" stroke-linecap="round"/><path d="M62 8 L74 40 M70 6 L66 40" stroke="${INK}" stroke-width="0.9" stroke-linecap="round" opacity="0.4"/>`;
  return s;
}

export function tileSvg() {
  return `<svg class="drums-tile-svg" viewBox="0 0 92 92" aria-hidden="true"><g transform="translate(-1 2)">${miniKit()}</g></svg>`;
}

/** The picture on a card in the rhythm list: free play shows the kit, a rhythm its first steps. */
export function cardSvg(id) {
  if (id === 'free') return `<svg viewBox="0 0 92 70" aria-hidden="true"><g transform="translate(4 -10) scale(0.88)">${miniKit()}</g></svg>`;
  const r = rhythmById(id);
  const steps = r ? r.steps.slice(0, 5) : [];
  let s = '';
  steps.forEach((st, i) => {
    const x = 2 + i * 17;
    st.pads.forEach((pad, k) => {
      const y = st.pads.length === 1 ? 23 : 12 + k * 22;
      s += `<g transform="translate(${x} ${y}) scale(0.7)">${padGlyph(pad).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`;
    });
  });
  return `<svg viewBox="0 0 92 62" aria-hidden="true">${s}</svg>`;
}
