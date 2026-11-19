// Drumstel pictures, drawn in code: every pad (a drum seen a little from the front and above, the
// kick from the front, the cymbals as tilted gold plates), the stands and the rug behind them, the
// small pad signs in the strip of steps to come, the home tile and the cards in the rhythm list.
// Each pad differs by shape as well as colour: drums have a white head and a coloured shell, the
// snare a ring of wires, the cymbals rings and a bell (the crash rays, the ride a big bell, the
// hi-hat two plates on a rod).
import { padById, rhythmById } from './kit.js';

const INK = '#2b2370';
const HEAD = '#fff8e7';
const METAL = '#c9cde0';

const f = (n) => Math.round(n * 10) / 10;

/** A drum seen a little from above and in front: a coloured shell with lugs, a white head on top. */
function drumSide(cx, top, rx, ry, depth, color, extra = '') {
  const l = cx - rx;
  const r = cx + rx;
  const bottom = top + depth;
  let s = `<path d="M${l} ${top} V${bottom} A${rx} ${ry} 0 0 0 ${r} ${bottom} V${top} Z" fill="${color}" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>`;
  s += `<path d="M${f(l + rx * 0.22)} ${f(top + ry * 0.9)} V${f(bottom + ry * 0.55)}" stroke="#fff" stroke-width="${f(rx * 0.12)}" stroke-linecap="round" opacity="0.35"/>`;
  // the lugs on the shell
  for (const k of [-0.62, 0, 0.62]) {
    const x = cx + k * rx;
    const y = top + ry * Math.sqrt(1 - k * k) + depth * 0.18;
    s += `<rect x="${f(x - 3.4)}" y="${f(y)}" width="6.8" height="${f(Math.max(8, depth * 0.38))}" rx="3.4" fill="${METAL}" stroke="${INK}" stroke-width="1.8"/>`;
  }
  // the hoop and the head
  s += `<ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="${color}" stroke="${INK}" stroke-width="3.2"/>`;
  s += `<ellipse cx="${cx}" cy="${top}" rx="${f(rx * 0.86)}" ry="${f(ry * 0.78)}" fill="${HEAD}" stroke="${INK}" stroke-width="2.2"/>`;
  s += `<ellipse cx="${f(cx - rx * 0.4)}" cy="${f(top - ry * 0.32)}" rx="${f(rx * 0.18)}" ry="${f(ry * 0.16)}" fill="#fff"/>`;
  return s + extra;
}

/** A cymbal tilted towards you: a gold plate with grooves and a bell, on its stand's tip. */
function plate(cx, cy, rx, ry, tilt, color, groove, bell, extra = '') {
  let s = `<g transform="rotate(${tilt} ${cx} ${cy})">`;
  s += `<ellipse cx="${cx}" cy="${f(cy + ry * 0.12)}" rx="${rx}" ry="${ry}" fill="${groove}" stroke="${INK}" stroke-width="3"/>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" stroke="${INK}" stroke-width="3"/>`;
  for (const k of [0.76, 0.54]) s += `<ellipse cx="${cx}" cy="${cy}" rx="${f(rx * k)}" ry="${f(ry * k)}" fill="none" stroke="${groove}" stroke-width="2.4"/>`;
  s += extra;
  s += `<ellipse cx="${cx}" cy="${f(cy - ry * 0.08)}" rx="${f(rx * bell)}" ry="${f(ry * bell * 1.1)}" fill="${groove}" stroke="${INK}" stroke-width="2.2"/>`;
  s += `<circle cx="${cx}" cy="${f(cy - ry * 0.12)}" r="3" fill="${INK}"/>`;
  return `${s}</g>`;
}

/** The size of each pad's drawing (its viewBox), close to the shape of its touch area. */
const VIEW = { crash: [150, 100], ride: [160, 100], hihat: [120, 100], snare: [110, 100], tom1: [100, 100], tom2: [100, 100], floor: [100, 100], kick: [100, 100] };

/** The drawing of one pad, in its own box (`VIEW`) with some room around it. */
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
    // a shallow drum with a dashed ring on its head (the wires showing through)
    return drumSide(55, 40, 50, 18, 26, p.color, `<ellipse cx="55" cy="40" rx="26" ry="9" fill="none" stroke="#d9c79e" stroke-width="3" stroke-dasharray="5 4"/>`);
  }
  if (p.kind === 'tom') {
    const dots = { tom1: 1, tom2: 2, floor: 3 }[id]; // one, two or three dots: high, middle, floor tom
    let mark = '';
    const top = { tom1: 30, tom2: 28, floor: 22 }[id];
    for (let k = 0; k < dots; k++) mark += `<ellipse cx="${50 + (k - (dots - 1) / 2) * 12}" cy="${top}" rx="4.6" ry="3.4" fill="${p.color}" stroke="${INK}" stroke-width="1.6"/>`;
    if (id === 'floor') {
      // the floor tom stands on three legs
      const legs = `<path d="M12 50 L5 97 M88 50 L95 97 M50 80 L50 97" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M12 50 L5 97 M88 50 L95 97" stroke="${METAL}" stroke-width="1.8" stroke-linecap="round"/>`;
      return legs + drumSide(50, top, 44, 15, 50, p.color, mark);
    }
    return id === 'tom1' ? drumSide(50, top, 40, 14, 36, p.color, mark) : drumSide(50, top, 44, 15, 40, p.color, mark);
  }
  if (id === 'crash') {
    let rays = '';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      rays += `<path d="M${f(75 + Math.cos(a) * 20)} ${f(50 + Math.sin(a) * 8.5)} L${f(75 + Math.cos(a) * 46)} ${f(50 + Math.sin(a) * 19.5)}" stroke="#fff3b0" stroke-width="3" stroke-linecap="round"/>`;
    }
    return plate(75, 50, 70, 30, -8, p.color, '#e0a400', 0.18, rays);
  }
  if (id === 'ride') {
    return plate(80, 50, 75, 32, 7, p.color, '#c56f0c', 0.27);
  }
  if (id === 'hihat') {
    // two plates on a rod, the top one a little apart from the bottom one
    let s = `<path d="M60 10 V100" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>`;
    s += `<ellipse cx="60" cy="66" rx="55" ry="17" fill="#b9bfd6" stroke="${INK}" stroke-width="3"/>`;
    s += plate(60, 50, 55, 19, 0, p.color, '#a3aac4', 0.22);
    s += `<rect x="54" y="20" width="12" height="9" rx="3" fill="${METAL}" stroke="${INK}" stroke-width="2"/>`;
    return s;
  }
  return '';
}

/** A pad's picture: its own box, centred, scaled to fit the touch area. */
export function padSvg(id) {
  const [w, h] = VIEW[id] || [100, 100];
  return `<svg class="dpad-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${padShape(id)}</svg>`;
}

/**
 * What holds the kit together, behind the pads: a rug under it, the stands of the cymbals, the
 * hi-hat (with its pedal) and the snare, and the holder that carries the toms on the bass drum.
 * `layout` is `kitLayout(w, h)` from kit.js for a box of `w`x`h`; a plain grid gets nothing.
 */
export function standsSvg(layout, w, h) {
  const { cells: c, box, shape } = layout;
  let s = '';
  if (shape === 'wide' || shape === 'tall') {
    const u = Math.min(c.kick.w, c.kick.h) / 20; // one "unit" of hardware, from the size of the kick
    const floor = c.kick.y + c.kick.h - u * 0.6;
    const mid = (r) => r.x + r.w / 2;
    const pole = (x1, y1, x2, y2) => `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`;
    const tripod = (x, spread) => `${pole(x, floor - spread * 0.9, x - spread, floor)} ${pole(x, floor - spread * 0.9, x + spread, floor)}`;
    // the rug, under the lower half of the kit
    const top = shape === 'wide' ? Math.min(c.snare.y, c.floor.y) + c.snare.h * 0.45 : c.hihat.y + c.hihat.h * 0.5;
    const rugX = box.x - u;
    s += `<rect x="${f(rugX)}" y="${f(top)}" width="${f(box.w + u * 2)}" height="${f(floor + u * 1.6 - top)}" rx="${f(u * 4)}" fill="#8f7fe8" opacity="0.16"/>`;
    s += `<rect x="${f(rugX + u * 1.2)}" y="${f(top + u * 1.2)}" width="${f(box.w - u * 0.4)}" height="${f(floor + u * 0.4 - top)}" rx="${f(u * 3)}" fill="none" stroke="#8f7fe8" stroke-width="${f(u * 0.5)}" stroke-dasharray="${f(u * 1.4)} ${f(u * 1)}" opacity="0.3"/>`;
    let d = '';
    // the crash stands just right of the hi-hat, the ride leans in from further out
    const crashFoot = c.hihat.x + c.hihat.w * 0.85;
    const rideFoot = Math.min(box.x + box.w - u * 2.5, mid(c.ride) + u * 2.5);
    d += `${pole(mid(c.crash), c.crash.y + c.crash.h * 0.5, crashFoot, floor - u * 2)} ${tripod(crashFoot, u * 2.2)}`;
    d += ` ${pole(mid(c.ride), c.ride.y + c.ride.h * 0.5, rideFoot, floor - u * 2)} ${tripod(rideFoot, u * 2.2)}`;
    const hx = mid(c.hihat);
    d += ` ${pole(hx, c.hihat.y + c.hihat.h * 0.6, hx, floor - u * 2)} ${tripod(hx, u * 2)}`;
    const sx = mid(c.snare);
    d += ` ${pole(sx, c.snare.y + c.snare.h * 0.6, sx, floor - u * 1.8)} ${tripod(sx, u * 1.8)}`;
    // the tom holder: up from the bass drum, an arm to each tom
    const kx = mid(c.kick);
    const armY = Math.max(c.tom1.y, c.tom2.y) + Math.max(c.tom1.h, c.tom2.h) * 0.62;
    d += ` ${pole(kx, c.kick.y + c.kick.h * 0.3, kx, armY)} ${pole(mid(c.tom1), armY, mid(c.tom2), armY)}`;
    const sw = f(Math.max(3, u * 0.55));
    s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(sw * 1.9)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
    s += `<path d="${d}" fill="none" stroke="${METAL}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    // the hi-hat pedal
    s += `<rect x="${f(hx - u * 1.3)}" y="${f(floor - u * 0.3)}" width="${f(u * 2.6)}" height="${f(u * 1.1)}" rx="${f(u * 0.4)}" fill="${METAL}" stroke="${INK}" stroke-width="${f(sw * 0.6)}"/>`;
  }
  return `<svg class="drums-stands-svg" viewBox="0 0 ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}" aria-hidden="true">${s}</svg>`;
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
