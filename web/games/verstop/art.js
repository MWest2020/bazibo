// Verstoppertje's pictures, all drawn in code (no image files), in Bazibo's soft style: round
// shapes, a dark outline in each figure's own colour, big friendly eyes. The animals to find, the
// creatures that live behind the other spots and wave, the three features that tell look-alikes
// apart (a red scarf, a yellow bow, a pink flower), the hints (a bit of a hidden animal peeking out
// over its spot), the hiding spots, the four scenes, the home
// tile and the how-to picture. Every animal, creature and spot differs from the others by shape and
// by colour (COLORS, checked in tests/verstop.test.js).
//
// Figures and spots live in a 100 x 100 box, standing on y = 94. A figure's waving arm (or wing, or
// eye stalk) is its `vz-arm` group, drawn from the shoulder up and to the right, so CSS can wave it
// round the bottom-left corner of its box. No ids and no url(#) (several copies share a page).
import { SPOTS } from './rules.js';

const INK = '#2b1a2a';
const eye = (x, y, r = 3.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${(x + r * 0.35).toFixed(1)}" cy="${(y - r * 0.38).toFixed(1)}" r="${(r * 0.36).toFixed(1)}" fill="#fff"/>`;
const eyes = (x1, x2, y, r) => eye(x1, y, r) + eye(x2, y, r);
const cheek = (x, y, c = '#ff9fb8') => `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.6" fill="${c}" opacity=".7"/>`;
const smile = (x, y, w = 5, c = INK) => `<path d="M${x - w} ${y}q${w} ${(w * 0.8).toFixed(1)} ${w * 2} 0" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`;
const ring = (fill, line, w = 2.4) => `fill="${fill}" stroke="${line}" stroke-width="${w}"`;

/** The waving arm: shoulder at (x, y), hand at (x + dx, y + dy), dx > 0 and dy < 0. */
function arm(x, y, dx, dy, color, line, paw = color, w = 6) {
  const d = `M${x} ${y}q${(dx * 0.7).toFixed(1)} ${(dy * 0.15).toFixed(1)} ${dx} ${dy}`;
  return `<g class="vz-arm"><path d="${d}" fill="none" stroke="${line}" stroke-width="${w + 3.4}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>` +
    `<circle cx="${x + dx}" cy="${y + dy}" r="5" ${ring(paw, line, 1.8)}/></g>`;
}

// ---------- the features (tier 3) ----------

export const FEATURE_COLORS = Object.freeze({ scarf: '#e5413b', bow: '#ffcf2e', flower: '#ff7ec4' });

const FEATURES = {
  scarf: ({ x, y, w }) => `<g class="vz-feat"><path d="M${x + w * 0.16} ${y + 2}l-2 15 8 1 1-14z" ${ring(FEATURE_COLORS.scarf, '#a3201b', 1.8)} stroke-linejoin="round"/>` +
    `<rect x="${x - w / 2}" y="${y - 4.5}" width="${w}" height="9" rx="4.5" ${ring(FEATURE_COLORS.scarf, '#a3201b', 1.8)}/>` +
    `<path d="M${x - w * 0.25} ${y - 4}v8M${x + w * 0.05} ${y - 4}v8" stroke="#ff8a80" stroke-width="2"/></g>`,
  bow: ({ x, y }) => `<g class="vz-feat"><path d="M${x} ${y}l-12-7.5v15zM${x} ${y}l12-7.5v15z" ${ring(FEATURE_COLORS.bow, '#a87d00', 1.8)} stroke-linejoin="round"/>` +
    `<circle cx="${x}" cy="${y}" r="3.8" ${ring('#ffe27a', '#a87d00', 1.8)}/></g>`,
  flower: ({ x, y }) => {
    const petals = [0, 1, 2, 3, 4].map((k) => {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      return `<circle cx="${(x + Math.cos(a) * 5.2).toFixed(1)}" cy="${(y + Math.sin(a) * 5.2).toFixed(1)}" r="4" ${ring(FEATURE_COLORS.flower, '#c2408a', 1.5)}/>`;
    });
    return `<g class="vz-feat">${petals.join('')}<circle cx="${x}" cy="${y}" r="3.2" ${ring('#ffe066', '#c98f00', 1.3)}/></g>`;
  },
};

// ---------- the animals to find ----------
// Each: `color` (its main colour, for the tests), `anchor` (where the features sit) and `draw()`.

function spikes(cx, cy, rx, ry, n, out) {
  const pts = [];
  for (let k = 0; k <= n * 2; k++) {
    const a = Math.PI + (k / (n * 2)) * Math.PI;
    const f = k % 2 ? out : 1;
    pts.push(`${(cx + Math.cos(a) * rx * f).toFixed(1)} ${(cy + Math.sin(a) * ry * f).toFixed(1)}`);
  }
  return `M${pts.join('L')}z`;
}

export const ANIMALS = Object.freeze({
  hedgehog: {
    color: '#8a5a3b',
    anchor: { neck: { x: 50, y: 88, w: 40 }, head: { x: 50, y: 33 }, ear: { x: 31, y: 47 } },
    draw: () => {
      const c = { b: '#8a5a3b', d: '#4f2d17', f: '#f3d2a2' };
      return arm(76, 76, 11, -16, c.b, c.d, c.f) +
        `<path d="${spikes(50, 68, 34, 32, 9, 1.22)}" fill="${c.d}"/>` +
        `<ellipse cx="50" cy="68" rx="32" ry="27" ${ring(c.b, c.d)}/>` +
        `<path d="M30 56q8-9 18-10M54 46q10 1 16 9" fill="none" stroke="#a8714a" stroke-width="2.2" stroke-linecap="round"/>` +
        `<circle cx="34" cy="51" r="5" ${ring(c.f, c.d, 2)}/><circle cx="66" cy="51" r="5" ${ring(c.f, c.d, 2)}/>` +
        `<ellipse cx="50" cy="73" rx="21" ry="17" ${ring(c.f, c.d, 2)}/>` +
        eyes(42, 58, 68, 3.4) + `<ellipse cx="50" cy="76" rx="3.6" ry="2.8" fill="${INK}"/>` + cheek(37, 76) + cheek(63, 76) + smile(50, 80, 4) +
        `<ellipse cx="39" cy="93" rx="6" ry="3.4" fill="${c.d}"/><ellipse cx="61" cy="93" rx="6" ry="3.4" fill="${c.d}"/>`;
    },
  },
  rabbit: {
    color: '#c3c0dc',
    anchor: { neck: { x: 50, y: 70, w: 30 }, head: { x: 50, y: 37 }, ear: { x: 35, y: 44 } },
    draw: () => {
      const c = { b: '#c3c0dc', d: '#625d8c', w: '#f4f2fa', p: '#f7b6c8' };
      return arm(66, 80, 12, -15, c.b, c.d, c.w) +
        `<ellipse cx="41" cy="24" rx="7.5" ry="19" transform="rotate(-9 41 24)" ${ring(c.b, c.d)}/><ellipse cx="41" cy="25" rx="3.4" ry="13" transform="rotate(-9 41 25)" fill="${c.p}"/>` +
        `<ellipse cx="59" cy="24" rx="7.5" ry="19" transform="rotate(9 59 24)" ${ring(c.b, c.d)}/><ellipse cx="59" cy="25" rx="3.4" ry="13" transform="rotate(9 59 25)" fill="${c.p}"/>` +
        `<ellipse cx="50" cy="81" rx="20" ry="14" ${ring(c.b, c.d)}/><ellipse cx="50" cy="83" rx="12" ry="9" fill="${c.w}"/>` +
        `<circle cx="50" cy="55" r="18" ${ring(c.b, c.d)}/>` +
        eyes(43, 57, 53, 3.2) + `<path d="M47 59.5h6l-3 3z" fill="${c.p}" stroke="${c.d}" stroke-width="1.2" stroke-linejoin="round"/>` +
        `<path d="M50 62.5v2.5M50 65q-3 2-5 0M50 65q3 2 5 0" fill="none" stroke="${c.d}" stroke-width="1.6" stroke-linecap="round"/>` +
        `<path d="M41 60h-9M41 63l-8 2M59 60h9M59 63l8 2" stroke="${c.d}" stroke-width="1.2" stroke-linecap="round"/>` + cheek(39, 60) + cheek(61, 60) +
        `<ellipse cx="40" cy="94" rx="7" ry="3.4" ${ring(c.w, c.d, 1.8)}/><ellipse cx="60" cy="94" rx="7" ry="3.4" ${ring(c.w, c.d, 1.8)}/>`;
    },
  },
  puppy: {
    color: '#e6b265',
    anchor: { neck: { x: 50, y: 72, w: 30 }, head: { x: 50, y: 29 }, ear: { x: 34, y: 34 } },
    draw: () => {
      // floppy ears: Bazibo's dogs never have pointy ears
      const c = { b: '#e6b265', d: '#8a5a2b', e: '#a8672e', m: '#fbe7c6' };
      return arm(64, 81, 12, -15, c.b, c.d, c.m) +
        `<ellipse cx="50" cy="83" rx="18" ry="12" ${ring(c.b, c.d)}/><ellipse cx="50" cy="85" rx="10" ry="7" fill="${c.m}"/>` +
        `<circle cx="50" cy="51" r="21" ${ring(c.b, c.d)}/>` +
        `<ellipse cx="29" cy="53" rx="8" ry="15" transform="rotate(16 29 53)" ${ring(c.e, c.d)}/>` +
        `<ellipse cx="71" cy="53" rx="8" ry="15" transform="rotate(-16 71 53)" ${ring(c.e, c.d)}/>` +
        `<ellipse cx="50" cy="60" rx="11" ry="8" ${ring(c.m, c.d, 1.8)}/>` +
        eyes(42, 58, 47, 3.4) + `<ellipse cx="50" cy="56" rx="4.2" ry="3" fill="${INK}"/>` +
        `<path d="M50 59v2.5M45 62q5 4 10 0" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` +
        `<path d="M48 63.5q2 4 4 0z" fill="#ff7b8a"/>` + cheek(38, 57) + cheek(62, 57) +
        `<ellipse cx="41" cy="94" rx="6.5" ry="3.4" ${ring(c.m, c.d, 1.8)}/><ellipse cx="59" cy="94" rx="6.5" ry="3.4" ${ring(c.m, c.d, 1.8)}/>`;
    },
  },
  squirrel: {
    color: '#d4692a',
    anchor: { neck: { x: 46, y: 66, w: 26 }, head: { x: 46, y: 33 }, ear: { x: 59, y: 37 } },
    draw: () => {
      const c = { b: '#d4692a', d: '#8a3d12', t: '#e8843f', w: '#f6d3a8' };
      return `<path d="M42 90C18 92 6 72 12 52 16 38 24 26 36 22c8-3 14 2 12 8-2 6-10 4-14 10-6 10-4 26 6 36z" ${ring(c.t, c.d)} stroke-linejoin="round"/>` +
        `<path d="M20 52c2-10 8-18 16-22M18 66c0-6 2-10 4-14" fill="none" stroke="#f6a868" stroke-width="2.4" stroke-linecap="round"/>` +
        arm(58, 76, 13, -15, c.b, c.d, c.w) +
        `<ellipse cx="47" cy="80" rx="16" ry="14" ${ring(c.b, c.d)}/><ellipse cx="48" cy="82" rx="9" ry="9" fill="${c.w}"/>` +
        `<path d="M33 40l1-11 9 7zM59 40l-1-11-9 7z" ${ring(c.b, c.d, 2)} stroke-linejoin="round"/>` +
        `<path d="M34 29l-1-5M58 29l1-5" stroke="${c.d}" stroke-width="2" stroke-linecap="round"/>` +
        `<circle cx="46" cy="51" r="15.5" ${ring(c.b, c.d)}/><ellipse cx="46" cy="57" rx="9" ry="6.5" fill="${c.w}"/>` +
        eyes(40, 52, 49, 3.1) + `<circle cx="46" cy="55" r="2.4" fill="${INK}"/>` + smile(46, 58, 3) + cheek(36, 56) + cheek(56, 56) +
        `<ellipse cx="40" cy="94" rx="6" ry="3.2" ${ring(c.b, c.d, 1.8)}/><ellipse cx="55" cy="94" rx="6" ry="3.2" ${ring(c.b, c.d, 1.8)}/>`;
    },
  },
  owl: {
    color: '#8e6fb3',
    anchor: { neck: { x: 50, y: 68, w: 40 }, head: { x: 50, y: 32 }, ear: { x: 33, y: 38 } },
    draw: () => {
      const c = { b: '#8e6fb3', d: '#4e3473', w: '#e6dcf2', k: '#f59f3a' };
      return `<g class="vz-arm"><path d="M70 72c6-4 12-12 14-22 2 6 1 14-4 20z" ${ring(c.b, c.d, 2.2)} stroke-linejoin="round"/></g>` +
        `<path d="M26 40l4-16 10 11zM74 40l-4-16-10 11z" ${ring(c.b, c.d, 2.2)} stroke-linejoin="round"/>` +
        `<ellipse cx="50" cy="63" rx="26" ry="30" ${ring(c.b, c.d)}/>` +
        `<ellipse cx="50" cy="74" rx="16" ry="17" fill="${c.w}"/>` +
        `<path d="M42 70q3 3 6 0M52 70q3 3 6 0M47 78q3 3 6 0M42 85q3 3 6 0M52 85q3 3 6 0" fill="none" stroke="#b9a5d6" stroke-width="1.8" stroke-linecap="round"/>` +
        `<circle cx="40" cy="50" r="9.5" ${ring('#fff', c.d, 2)}/><circle cx="60" cy="50" r="9.5" ${ring('#fff', c.d, 2)}/>` +
        eyes(41, 59, 51, 4.6) + `<path d="M46 56h8l-4 7z" ${ring(c.k, '#a85f10', 1.6)} stroke-linejoin="round"/>` +
        `<path d="M40 94l3-5 3 5M54 94l3-5 3 5" fill="none" stroke="${c.k}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    },
  },
  crab: {
    color: '#f26b5b',
    anchor: { neck: { x: 50, y: 62, w: 42 }, head: { x: 50, y: 33 }, ear: { x: 68, y: 40 } },
    draw: () => {
      const c = { b: '#f26b5b', d: '#a33024', l: '#ffb1a5' };
      return `<path d="M26 80l-12 6M27 86l-10 9M74 80l12 6M73 86l10 9" stroke="${c.d}" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M30 68c-10-2-16-8-16-16" fill="none" stroke="${c.d}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M14 54c-6-2-8-10-3-15 2 4 6 6 10 5-1-6 2-10 7-10-1 8-4 18-14 20z" ${ring(c.b, c.d, 2)} stroke-linejoin="round"/>` +
        `<g class="vz-arm"><path d="M72 68c8-2 12-8 12-16" fill="none" stroke="${c.d}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M86 54c6-2 8-10 3-15-2 4-6 6-10 5 1-6-2-10-7-10 1 8 4 18 14 20z" ${ring(c.b, c.d, 2)} stroke-linejoin="round"/></g>` +
        `<path d="M42 62l-3-16M58 62l3-16" stroke="${c.d}" stroke-width="3.4" stroke-linecap="round"/>` +
        `<circle cx="38" cy="44" r="6.5" ${ring('#fff', c.d, 2)}/><circle cx="62" cy="44" r="6.5" ${ring('#fff', c.d, 2)}/>` + eyes(39, 61, 45, 3.2) +
        `<ellipse cx="50" cy="74" rx="28" ry="17" ${ring(c.b, c.d)}/>` +
        `<path d="M34 66q4-4 9-4" fill="none" stroke="${c.l}" stroke-width="2.6" stroke-linecap="round"/>` +
        smile(50, 77, 6) + cheek(36, 76) + cheek(64, 76);
    },
  },
  turtle: {
    color: '#3f9a6b',
    anchor: { neck: { x: 50, y: 55, w: 24 }, head: { x: 50, y: 25 }, ear: { x: 37, y: 31 } },
    draw: () => {
      const c = { b: '#3f9a6b', d: '#1f5c3c', s: '#b8d86b', l: '#6cc08f' };
      return arm(73, 74, 12, -15, c.s, c.d) +
        `<ellipse cx="29" cy="90" rx="8" ry="5" ${ring(c.s, c.d, 2)}/><ellipse cx="71" cy="90" rx="8" ry="5" ${ring(c.s, c.d, 2)}/>` +
        `<circle cx="50" cy="40" r="15" ${ring(c.s, c.d)}/>` + eyes(44, 56, 38, 3.1) + smile(50, 44, 4) + cheek(40, 44) + cheek(60, 44) +
        `<path d="M19 86c0-20 13-32 31-32s31 12 31 32z" ${ring(c.b, c.d)} stroke-linejoin="round"/>` +
        `<path d="M43 64h14l5 9-5 9H43l-5-9z" ${ring(c.l, c.d, 1.8)} stroke-linejoin="round"/>` +
        `<path d="M43 64l-6-6M57 64l6-6M38 73H24M62 73h14M43 82l-4 4M57 82l4 4" stroke="${c.d}" stroke-width="1.8" stroke-linecap="round"/>` +
        `<path d="M17 86h66" stroke="${c.d}" stroke-width="3" stroke-linecap="round"/>`;
    },
  },
  piglet: {
    color: '#f7b0c4',
    anchor: { neck: { x: 50, y: 73, w: 30 }, head: { x: 50, y: 31 }, ear: { x: 32, y: 38 } },
    draw: () => {
      const c = { b: '#f7b0c4', d: '#b8506f', s: '#f489a8' };
      return arm(64, 82, 12, -15, c.b, c.d, c.s) +
        `<ellipse cx="50" cy="84" rx="19" ry="12" ${ring(c.b, c.d)}/>` +
        `<path d="M32 42l-2-14 13 6zM68 42l2-14-13 6z" ${ring(c.s, c.d, 2)} stroke-linejoin="round"/>` +
        `<circle cx="50" cy="53" r="20" ${ring(c.b, c.d)}/>` + eyes(42, 58, 48, 3.3) +
        `<ellipse cx="50" cy="60" rx="9.5" ry="7" ${ring(c.s, c.d, 2)}/><ellipse cx="46.5" cy="60" rx="1.8" ry="2.6" fill="${c.d}"/><ellipse cx="53.5" cy="60" rx="1.8" ry="2.6" fill="${c.d}"/>` +
        `<path d="M45 68q5 3 10 0" fill="none" stroke="${c.d}" stroke-width="1.8" stroke-linecap="round"/>` + cheek(36, 58, '#ff7aa2') + cheek(64, 58, '#ff7aa2') +
        `<ellipse cx="41" cy="94" rx="6" ry="3.2" ${ring(c.s, c.d, 1.8)}/><ellipse cx="59" cy="94" rx="6" ry="3.2" ${ring(c.s, c.d, 1.8)}/>`;
    },
  },
  lamb: {
    color: '#fbf8f0',
    anchor: { neck: { x: 50, y: 67, w: 28 }, head: { x: 50, y: 28 }, ear: { x: 34, y: 41 } },
    draw: () => {
      const c = { w: '#fbf8f0', o: '#a99e8c', f: '#4a4048' };
      const puffs = [[30, 74, 12], [44, 70, 13], [58, 70, 13], [70, 76, 12], [38, 85, 11], [62, 85, 11], [50, 84, 12]];
      return `<path d="M42 94v-8M58 94v-8" stroke="${c.f}" stroke-width="6" stroke-linecap="round"/>` +
        arm(68, 74, 12, -15, c.f, '#2b242a', c.f) +
        puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${ring(c.w, c.o, 2)}/>`).join('') +
        puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r - 2.2}" fill="${c.w}"/>`).join('') +
        `<ellipse cx="34" cy="45" rx="8" ry="4" transform="rotate(-18 34 45)" fill="${c.f}"/><ellipse cx="66" cy="45" rx="8" ry="4" transform="rotate(18 66 45)" fill="${c.f}"/>` +
        `<ellipse cx="50" cy="51" rx="12.5" ry="15" fill="${c.f}"/>` +
        `<circle cx="44" cy="37" r="6" ${ring(c.w, c.o, 1.6)}/><circle cx="56" cy="37" r="6" ${ring(c.w, c.o, 1.6)}/><circle cx="50" cy="33" r="6.5" ${ring(c.w, c.o, 1.6)}/>` +
        `<circle cx="45" cy="49" r="3.4" fill="#fff"/><circle cx="55" cy="49" r="3.4" fill="#fff"/><circle cx="45.5" cy="49.5" r="1.9" fill="${INK}"/><circle cx="55.5" cy="49.5" r="1.9" fill="${INK}"/>` +
        `<path d="M47 58q3 3 6 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>` + cheek(42, 56, '#ff9fb8');
    },
  },
});

// ---------- the hints: a bit of the animal peeking out ----------
// What peeks out over the top of the spot an animal hides behind (`clueFor` in rules.js): the top
// of its head, the bit that tells it apart (spines, long ears, floppy ears, tufts, eye stalks...).
// Drawn round (0, 0), the cover's edge, pointing up; everything below y = 2 sits behind the cover,
// so the drawing reaches down to y = 16 and slides away behind it. In its own colours (ANIMALS).

const PEEKS = {
  hedgehog: () => {
    const c = { b: '#8a5a3b', d: '#4f2d17', f: '#f3d2a2' };
    return `<path d="${spikes(0, 6, 13, 13, 6, 1.4)}" fill="${c.d}"/>` +
      `<ellipse cx="0" cy="7" rx="12" ry="11" ${ring(c.b, c.d, 2)}/>` +
      `<circle cx="-8" cy="-2" r="3" ${ring(c.f, c.d, 1.6)}/><circle cx="8" cy="-2" r="3" ${ring(c.f, c.d, 1.6)}/>` +
      `<path d="M-14 16h28" stroke="${c.b}" stroke-width="4"/>` + eyes(-4, 4, 2, 2.3);
  },
  rabbit: () => {
    const c = { b: '#c3c0dc', d: '#625d8c', p: '#f7b6c8' };
    return `<ellipse cx="-5" cy="-9" rx="4.2" ry="11" transform="rotate(-12 -5 -9)" ${ring(c.b, c.d, 2)}/><ellipse cx="-5" cy="-8" rx="1.8" ry="7" transform="rotate(-12 -5 -8)" fill="${c.p}"/>` +
      `<ellipse cx="5" cy="-9" rx="4.2" ry="11" transform="rotate(12 5 -9)" ${ring(c.b, c.d, 2)}/><ellipse cx="5" cy="-8" rx="1.8" ry="7" transform="rotate(12 5 -8)" fill="${c.p}"/>` +
      `<ellipse cx="0" cy="8" rx="12" ry="10" ${ring(c.b, c.d, 2)}/>` + eyes(-4, 4, 3, 2.2);
  },
  puppy: () => {
    const c = { b: '#e6b265', d: '#8a5a2b', e: '#a8672e' };
    // floppy ears from the top of the head, so they show over the edge
    return `<rect x="-11" y="2" width="22" height="14" fill="${c.b}"/><ellipse cx="0" cy="3" rx="11" ry="10" ${ring(c.b, c.d, 2)}/>` +
      `<ellipse cx="-10" cy="0" rx="4.6" ry="8" transform="rotate(34 -10 0)" ${ring(c.e, c.d, 2)}/>` +
      `<ellipse cx="10" cy="0" rx="4.6" ry="8" transform="rotate(-34 10 0)" ${ring(c.e, c.d, 2)}/>` +
      `<path d="M-3-5q3-3 6 0" fill="none" stroke="${c.d}" stroke-width="1.6" stroke-linecap="round"/>` + eyes(-4, 4, 2, 2.2);
  },
  squirrel: () => {
    const c = { b: '#d4692a', d: '#8a3d12', t: '#e8843f' };
    return `<path d="M-12 16c-8-4-10-14-6-22 3-6 9-8 12-6-4 3-5 8-3 13z" ${ring(c.t, c.d, 1.8)} stroke-linejoin="round"/>` +
      `<path d="M-10 1l1-12 8 7zM10 1l-1-12-8 7z" ${ring(c.b, c.d, 1.8)} stroke-linejoin="round"/>` +
      `<path d="M-9-11l-1-4M9-11l1-4" stroke="${c.d}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<ellipse cx="0" cy="8" rx="11" ry="10" ${ring(c.b, c.d, 2)}/>` + eyes(-4, 4, 3, 2.2);
  },
  owl: () => {
    const c = { b: '#8e6fb3', d: '#4e3473' };
    return `<path d="M-13 2l3-12 8 7zM13 2l-3-12-8 7z" ${ring(c.b, c.d, 1.8)} stroke-linejoin="round"/>` +
      `<ellipse cx="0" cy="8" rx="14" ry="11" ${ring(c.b, c.d, 2)}/>` +
      `<circle cx="-5.5" cy="3" r="5" ${ring('#fff', c.d, 1.6)}/><circle cx="5.5" cy="3" r="5" ${ring('#fff', c.d, 1.6)}/>` + eyes(-5, 6, 3.4, 2.6);
  },
  crab: () => {
    const c = { b: '#f26b5b', d: '#a33024' };
    return `<path d="M-5 14l-3-17M5 14l3-17" stroke="${c.d}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="-8" cy="-4" r="4.6" ${ring('#fff', c.d, 1.6)}/><circle cx="8" cy="-4" r="4.6" ${ring('#fff', c.d, 1.6)}/>` + eyes(-7.5, 8.5, -3.6, 2.3) +
      `<g transform="translate(12 -7) rotate(-10) scale(.55) translate(-82 -46)"><path d="M86 54c6-2 8-10 3-15-2 4-6 6-10 5 1-6-2-10-7-10 1 8 4 18 14 20z" ${ring(c.b, c.d, 3)} stroke-linejoin="round"/></g>` +
      `<path d="M10 14q4-8 3-16" fill="none" stroke="${c.d}" stroke-width="3.4" stroke-linecap="round"/>` +
      `<ellipse cx="0" cy="12" rx="14" ry="7" ${ring(c.b, c.d, 2)}/>`;
  },
  turtle: () => {
    const c = { b: '#3f9a6b', d: '#1f5c3c', s: '#b8d86b', l: '#6cc08f' };
    return `<circle cx="7" cy="-1" r="7.5" ${ring(c.s, c.d, 2)}/>` + eyes(4.5, 10, -2, 1.9) +
      `<path d="M-14 16c0-14 6-20 13-20s13 6 13 20z" ${ring(c.b, c.d, 2)} stroke-linejoin="round"/>` +
      `<path d="M-6 4h8l3 5-3 5h-8l-3-5z" fill="${c.l}" stroke="${c.d}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M-6 4l-4-4M2 4l4-4" stroke="${c.d}" stroke-width="1.4" stroke-linecap="round"/>`;
  },
  piglet: () => {
    const c = { b: '#f7b0c4', d: '#b8506f', s: '#f489a8' };
    return `<path d="M-10 2l-3-12 11 5zM10 2l3-12-11 5z" ${ring(c.s, c.d, 1.8)} stroke-linejoin="round"/>` +
      `<ellipse cx="0" cy="8" rx="12" ry="10" ${ring(c.b, c.d, 2)}/>` + eyes(-4, 4, 3, 2.2);
  },
  lamb: () => {
    const c = { w: '#fbf8f0', o: '#a99e8c', f: '#4a4048' };
    return `<ellipse cx="-11" cy="5" rx="6.5" ry="3.2" transform="rotate(-18 -11 5)" fill="${c.f}"/><ellipse cx="11" cy="5" rx="6.5" ry="3.2" transform="rotate(18 11 5)" fill="${c.f}"/>` +
      `<ellipse cx="0" cy="9" rx="9" ry="11" fill="${c.f}"/>` +
      `<circle cx="-5.5" cy="-3" r="5" ${ring(c.w, c.o, 1.5)}/><circle cx="5.5" cy="-3" r="5" ${ring(c.w, c.o, 1.5)}/><circle cx="0" cy="-6" r="5.5" ${ring(c.w, c.o, 1.5)}/>` +
      `<circle cx="-3.5" cy="4" r="2.4" fill="#fff"/><circle cx="3.5" cy="4" r="2.4" fill="#fff"/><circle cx="-3.2" cy="4.3" r="1.4" fill="${INK}"/><circle cx="3.8" cy="4.3" r="1.4" fill="${INK}"/>`;
  },
};

/** The glimpse of a feature that peeks out with the head in tier 3: a bow on top, a flower at the ear, a scarf's end. */
const PEEK_FEATURES = {
  bow: () => `<g transform="translate(6 -12) rotate(-12) scale(.75)">${FEATURES.bow({ x: 0, y: 0 })}</g>`,
  flower: () => `<g transform="translate(-9 -11) scale(.78)">${FEATURES.flower({ x: 0, y: 0 })}</g>`,
  scarf: () => `<g class="vz-feat" transform="translate(-2 -2) scale(1.1)"><path d="M9 14q2-12 9-20l6 3q-6 8-7 18z" ${ring(FEATURE_COLORS.scarf, '#a3201b', 1.6)} stroke-linejoin="round"/>` +
    `<path d="M18-6l-2-4M21-4.5l-1-4.5M24-3l0-4" stroke="#a3201b" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M13 8q2-6 6-11" fill="none" stroke="#ff8a80" stroke-width="1.8" stroke-linecap="round"/></g>`,
};

// ---------- the creatures that wave ----------

export const CREATURES = Object.freeze({
  snail: {
    color: '#e9a23b',
    draw: () => {
      const c = { s: '#e9a23b', d: '#9a5a12', b: '#f1d9a8', bd: '#a8814a' };
      return `<path d="M14 92c0-6 6-8 14-8h40c6-2 8-8 8-16v-6c0-6 4-10 9-10s9 4 9 10c0 14-6 30-20 30H18c-3 0-4 0-4 0z" ${ring(c.b, c.bd)} stroke-linejoin="round"/>` +
        `<path d="M80 56l-4-14" stroke="${c.bd}" stroke-width="3" stroke-linecap="round"/><circle cx="76" cy="41" r="4.5" ${ring('#fff', c.bd, 1.6)}/><circle cx="76.5" cy="41.5" r="2.2" fill="${INK}"/>` +
        `<g class="vz-arm"><path d="M88 56l5-14" stroke="${c.bd}" stroke-width="3" stroke-linecap="round"/><circle cx="93" cy="41" r="4.5" ${ring('#fff', c.bd, 1.6)}/><circle cx="93.5" cy="41.5" r="2.2" fill="${INK}"/></g>` +
        `<circle cx="44" cy="62" r="24" ${ring(c.s, c.d)}/>` +
        `<path d="M44 62m-3 0a3 3 0 1 1 6 0a8 8 0 1 1-14 0a13 13 0 1 1 24 0a18 18 0 1 1-33 2" fill="none" stroke="${c.d}" stroke-width="2.4" stroke-linecap="round"/>` +
        smile(85, 66, 3, c.bd) + cheek(80, 63);
    },
  },
  ladybug: {
    color: '#e23a3a',
    draw: () => {
      const c = { r: '#e23a3a', d: '#8e1c1c', k: '#2b2b33' };
      return `<path d="M30 92l-4 4M70 92l4 4M24 80l-8 2" stroke="${c.k}" stroke-width="3.4" stroke-linecap="round"/>` +
        arm(72, 74, 11, -15, c.k, '#000', c.k, 4) +
        `<path d="M44 38l-6-10M56 38l6-10" stroke="${c.k}" stroke-width="2.4" stroke-linecap="round"/><circle cx="38" cy="27" r="3" fill="${c.k}"/><circle cx="62" cy="27" r="3" fill="${c.k}"/>` +
        `<circle cx="50" cy="47" r="13" fill="${c.k}"/>` +
        `<circle cx="45" cy="45" r="3.6" fill="#fff"/><circle cx="55" cy="45" r="3.6" fill="#fff"/><circle cx="45.5" cy="45.5" r="2" fill="${INK}"/><circle cx="55.5" cy="45.5" r="2" fill="${INK}"/>` +
        `<path d="M46 52q4 3 8 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>` +
        `<circle cx="50" cy="72" r="24" ${ring(c.r, c.d)}/>` +
        `<path d="M50 49v47" stroke="${c.k}" stroke-width="2.6"/>` +
        `<circle cx="38" cy="64" r="4.6" fill="${c.k}"/><circle cx="62" cy="64" r="4.6" fill="${c.k}"/><circle cx="36" cy="80" r="4" fill="${c.k}"/><circle cx="64" cy="80" r="4" fill="${c.k}"/><circle cx="50" cy="88" r="3" fill="${c.k}" opacity="0"/>` +
        `<path d="M34 56q4-4 9-5" fill="none" stroke="#ff8f8f" stroke-width="2.4" stroke-linecap="round"/>`;
    },
  },
  mouse: {
    color: '#b49a86',
    draw: () => {
      const c = { b: '#b49a86', d: '#6e5544', p: '#f7b6c8', w: '#efe3d8' };
      return `<path d="M34 90c-14 0-20-8-16-14" fill="none" stroke="${c.d}" stroke-width="2.6" stroke-linecap="round"/>` +
        arm(62, 80, 12, -15, c.b, c.d, c.p) +
        `<ellipse cx="50" cy="83" rx="15" ry="12" ${ring(c.b, c.d)}/><ellipse cx="50" cy="85" rx="8" ry="7" fill="${c.w}"/>` +
        `<circle cx="33" cy="40" r="12" ${ring(c.b, c.d)}/><circle cx="33" cy="40" r="7" fill="${c.p}"/>` +
        `<circle cx="67" cy="40" r="12" ${ring(c.b, c.d)}/><circle cx="67" cy="40" r="7" fill="${c.p}"/>` +
        `<path d="M34 58c0-10 7-16 16-16s16 6 16 16c0 6-7 12-16 14-9-2-16-8-16-14z" ${ring(c.b, c.d)}/>` +
        eyes(44, 56, 55, 3) + `<circle cx="50" cy="64" r="2.8" fill="${c.p}" stroke="${c.d}" stroke-width="1.2"/>` +
        `<path d="M44 64h-10M44 67l-9 3M56 64h10M56 67l9 3" stroke="${c.d}" stroke-width="1.1" stroke-linecap="round"/>` +
        `<ellipse cx="42" cy="94" rx="5.5" ry="3" fill="${c.p}"/><ellipse cx="58" cy="94" rx="5.5" ry="3" fill="${c.p}"/>`;
    },
  },
  frog: {
    color: '#78c850',
    draw: () => {
      const c = { g: '#78c850', d: '#3a7d22', w: '#d9f2b0' };
      return arm(68, 78, 13, -16, c.g, c.d) +
        `<path d="M28 94c-6 0-8-4-4-6M72 94c6 0 8-4 4-6" fill="none" stroke="${c.d}" stroke-width="3" stroke-linecap="round"/>` +
        `<ellipse cx="50" cy="80" rx="22" ry="15" ${ring(c.g, c.d)}/><ellipse cx="50" cy="83" rx="13" ry="9" fill="${c.w}"/>` +
        `<ellipse cx="50" cy="58" rx="26" ry="17" ${ring(c.g, c.d)}/>` +
        `<circle cx="36" cy="44" r="10" ${ring(c.g, c.d)}/><circle cx="64" cy="44" r="10" ${ring(c.g, c.d)}/>` +
        `<circle cx="36" cy="44" r="6" fill="#fff"/><circle cx="64" cy="44" r="6" fill="#fff"/>` + eyes(37, 63, 45, 3.4) +
        `<path d="M34 62q16 12 32 0" fill="none" stroke="${c.d}" stroke-width="2.4" stroke-linecap="round"/>` + cheek(30, 60) + cheek(70, 60);
    },
  },
  bird: {
    color: '#5aa9e6',
    draw: () => {
      const c = { b: '#5aa9e6', d: '#2a6aa3', w: '#d6ecfb', k: '#f59f3a' };
      return `<path d="M42 94l2-6M58 94l-2-6" stroke="${c.k}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M48 40c-2-8 2-12 6-12-1 4 2 6 0 12z" ${ring(c.b, c.d, 2)}/>` +
        `<g class="vz-arm"><path d="M70 70c8-4 14-12 16-22 3 8 0 18-8 26z" ${ring(c.b, c.d, 2.2)} stroke-linejoin="round"/></g>` +
        `<path d="M28 74c-8 2-14 0-16-4 6 0 10-2 14-6z" ${ring(c.b, c.d, 2)} stroke-linejoin="round"/>` +
        `<circle cx="50" cy="66" r="24" ${ring(c.b, c.d)}/><ellipse cx="50" cy="74" rx="15" ry="13" fill="${c.w}"/>` +
        eyes(42, 58, 58, 3.4) + `<path d="M45 64h10l-5 7z" ${ring(c.k, '#a85f10', 1.6)} stroke-linejoin="round"/>` + cheek(37, 66) + cheek(63, 66);
    },
  },
  bee: {
    color: '#f7d33c',
    draw: () => {
      const c = { y: '#f7d33c', d: '#9a7a00', k: '#2b2b33', w: '#e3f4ff' };
      return `<ellipse cx="33" cy="54" rx="13" ry="9" transform="rotate(-25 33 54)" ${ring(c.w, '#8fb5d6', 2)}/>` +
        `<ellipse cx="67" cy="54" rx="13" ry="9" transform="rotate(25 67 54)" ${ring(c.w, '#8fb5d6', 2)}/>` +
        arm(68, 76, 11, -15, c.k, '#000', c.k, 4) +
        `<ellipse cx="50" cy="76" rx="21" ry="18" ${ring(c.y, c.d)}/>` +
        `<path d="M31 70h38M30 80h40" stroke="${c.k}" stroke-width="6"/><path d="M50 94v4" stroke="${c.k}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M45 34l-5-9M55 34l5-9" stroke="${c.k}" stroke-width="2.2" stroke-linecap="round"/><circle cx="40" cy="24" r="2.8" fill="${c.k}"/><circle cx="60" cy="24" r="2.8" fill="${c.k}"/>` +
        `<circle cx="50" cy="46" r="13" ${ring(c.y, c.d)}/>` + eyes(45, 55, 45, 2.8) + smile(50, 50, 3) + cheek(42, 51) + cheek(58, 51);
    },
  },
  butterfly: {
    color: '#ff5ea8',
    draw: () => {
      const c = { w: '#ff5ea8', d: '#b02a6c', l: '#ffc2df', b: '#5b3f80' };
      return `<ellipse cx="33" cy="52" rx="16" ry="14" transform="rotate(-15 33 52)" ${ring(c.w, c.d)}/><ellipse cx="34" cy="76" rx="12" ry="10" ${ring(c.w, c.d)}/>` +
        `<circle cx="31" cy="51" r="5" fill="${c.l}"/><circle cx="34" cy="77" r="3.6" fill="${c.l}"/>` +
        `<g class="vz-arm"><ellipse cx="67" cy="52" rx="16" ry="14" transform="rotate(15 67 52)" ${ring(c.w, c.d)}/><ellipse cx="66" cy="76" rx="12" ry="10" ${ring(c.w, c.d)}/>` +
        `<circle cx="69" cy="51" r="5" fill="${c.l}"/><circle cx="66" cy="77" r="3.6" fill="${c.l}"/></g>` +
        `<rect x="45" y="44" width="10" height="44" rx="5" fill="${c.b}"/>` +
        `<path d="M47 36l-6-10M53 36l6-10" stroke="${c.b}" stroke-width="2" stroke-linecap="round"/><circle cx="41" cy="25" r="2.6" fill="${c.b}"/><circle cx="59" cy="25" r="2.6" fill="${c.b}"/>` +
        `<circle cx="50" cy="39" r="8" fill="${c.b}"/><circle cx="47" cy="38" r="1.8" fill="#fff"/><circle cx="53" cy="38" r="1.8" fill="#fff"/>` +
        `<path d="M47.5 42q2.5 2 5 0" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>`;
    },
  },
  mole: {
    color: '#5a5060',
    draw: () => {
      const c = { b: '#5a5060', d: '#2e2733', n: '#ff8fb0', h: '#f4c7b0' };
      return arm(70, 74, 13, -15, c.b, c.d, c.h) +
        `<path d="M22 78c-6 2-8 8-6 12 4-2 8-2 10-6z" ${ring(c.h, '#b88570', 1.8)}/>` +
        `<ellipse cx="50" cy="68" rx="25" ry="27" ${ring(c.b, c.d)}/>` +
        `<ellipse cx="50" cy="74" rx="15" ry="16" fill="#77697e"/>` +
        `<path d="M38 56q4 3 8 0M54 56q4 3 8 0" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>` +
        `<ellipse cx="50" cy="64" rx="6" ry="4.6" ${ring(c.n, '#c25a7c', 1.6)}/>` + smile(50, 70, 4, '#fff') + cheek(39, 64) + cheek(61, 64) +
        `<ellipse cx="40" cy="94" rx="6" ry="3" fill="${c.h}"/><ellipse cx="60" cy="94" rx="6" ry="3" fill="${c.h}"/>`;
    },
  },
});

/** A figure's inner drawing: an animal (with its feature) or a creature, as a `vz-fig` group. */
export function figureG(who) {
  if (who.kind === 'creature') return `<g class="vz-fig">${CREATURES[who.id].draw()}</g>`;
  const a = ANIMALS[who.id];
  const feat = who.feature ? FEATURES[who.feature](a.anchor[{ scarf: 'neck', bow: 'head', flower: 'ear' }[who.feature]]) : '';
  return `<g class="vz-fig">${a.draw()}${feat}</g>`;
}

/** A figure on its own (the prompt, the cards). */
export function figureSvg(who, cls = '') {
  return `<svg class="vz-pic ${cls}" viewBox="0 0 100 100" aria-hidden="true">${figureG(who)}</svg>`;
}

// ---------- the hiding spots ----------
// Each: `color` (for the tests) and `draw(n)` -> { under, frame, cover }: `under` is drawn before the
// figure (the shadow, and the dark inside of a doorway), `frame` after it and never moves (a door's
// tree or panel, with the doorway cut out), `cover` last: the part that lifts, slides or swings.
// `hole` is a doorway's box: the figure is shrunk into it.

const shadow = (rx = 40) => `<ellipse cx="50" cy="95" rx="${rx}" ry="5" fill="#000" opacity=".13"/>`;

export const SPOT_ART = Object.freeze({
  stone: {
    color: '#a9a4b8',
    draw: () => ({
      under: shadow(42),
      frame: '',
      cover: `<path d="M8 94c-4-22 6-46 26-54 14-6 28-6 40 2 16 10 22 32 18 52z" ${ring('#a9a4b8', '#6c6680', 2.6)} stroke-linejoin="round"/>` +
        `<path d="M24 56c6-8 14-12 24-12" fill="none" stroke="#d4d0e0" stroke-width="4" stroke-linecap="round"/>` +
        `<circle cx="62" cy="70" r="3" fill="#8d879f"/><circle cx="34" cy="80" r="2.4" fill="#8d879f"/><circle cx="74" cy="84" r="2" fill="#8d879f"/>`,
    }),
  },
  bush: {
    color: '#7fcf5a',
    draw: () => {
      const puffs = [[26, 74, 20], [74, 74, 20], [38, 54, 20], [62, 52, 21], [50, 70, 24], [50, 38, 15]];
      return {
        under: shadow(44),
        frame: '',
        cover: puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${ring('#7fcf5a', '#3f8a2a', 2.6)}/>`).join('') +
          puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r - 2.4}" fill="#7fcf5a"/>`).join('') +
          `<path d="M8 94h84v-8H8z" fill="#7fcf5a"/><path d="M8 94h84" stroke="#3f8a2a" stroke-width="2.6" stroke-linecap="round"/>` +
          `<path d="M30 60q4-6 10-6M58 44q4-4 9-3M60 74q4-5 10-4M22 80q3-4 8-4" fill="none" stroke="#b5ec8f" stroke-width="3" stroke-linecap="round"/>` +
          `<circle cx="40" cy="78" r="3" fill="#ff5a6e"/><circle cx="66" cy="62" r="3" fill="#ff5a6e"/><circle cx="48" cy="46" r="2.6" fill="#ff5a6e"/>`,
      };
    },
  },
  tree: {
    color: '#2f7d3f',
    draw: () => ({
      under: shadow(34),
      frame: '',
      cover: `<path d="M41 96l2-36h14l2 36z" ${ring('#9b6a43', '#5e3b20', 2.4)} stroke-linejoin="round"/>` +
        `<path d="M50 70v20M46 80l-6-6" stroke="#5e3b20" stroke-width="2" stroke-linecap="round"/>` +
        `<circle cx="30" cy="50" r="19" ${ring('#2f7d3f', '#1a4f25', 2.6)}/><circle cx="70" cy="50" r="19" ${ring('#2f7d3f', '#1a4f25', 2.6)}/>` +
        `<circle cx="50" cy="32" r="25" ${ring('#2f7d3f', '#1a4f25', 2.6)}/><circle cx="50" cy="56" r="18" ${ring('#2f7d3f', '#1a4f25', 2.6)}/>` +
        `<circle cx="30" cy="50" r="16.6" fill="#2f7d3f"/><circle cx="70" cy="50" r="16.6" fill="#2f7d3f"/><circle cx="50" cy="32" r="22.6" fill="#2f7d3f"/>` +
        `<path d="M36 24q6-8 16-8M20 48q2-6 8-8" fill="none" stroke="#56a865" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="62" cy="40" r="3.4" fill="#ff8a3d"/><circle cx="38" cy="58" r="3.4" fill="#ff8a3d"/>`,
    }),
  },
  pot: {
    color: '#d9734a',
    draw: () => ({
      under: shadow(42),
      frame: '',
      // a flowerpot upside down, a sprout of moss on top
      cover: `<path d="M27 46h46l11 38H16z" ${ring('#d9734a', '#8e3e1c', 2.6)} stroke-linejoin="round"/>` +
        `<rect x="10" y="80" width="80" height="15" rx="4" ${ring('#e4875f', '#8e3e1c', 2.6)}/>` +
        `<ellipse cx="50" cy="46" rx="8" ry="2.6" fill="#7a3416"/>` +
        `<path d="M34 54l-6 24" stroke="#f0a283" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="M58 44c0-8 4-12 10-12-1 6-4 10-10 12zM58 44c-2-6-6-8-11-7 1 5 5 7 11 7z" ${ring('#7fcf5a', '#3f8a2a', 1.6)}/>`,
    }),
  },
  bucket: {
    color: '#4a90d9',
    draw: () => ({
      under: shadow(36),
      frame: '',
      // a bucket upside down, its handle hanging
      cover: `<path d="M24 92c-6 8 4 8 26 8s32 0 26-8" fill="none" stroke="#7a8696" stroke-width="2.6"/>` +
        `<path d="M29 32h42l9 62H20z" ${ring('#4a90d9', '#1f5d9e', 2.6)} stroke-linejoin="round"/>` +
        `<path d="M27 44h46M24 70h52" stroke="#2f72b8" stroke-width="3"/>` +
        `<rect x="25" y="28" width="50" height="8" rx="4" ${ring('#6eaae6', '#1f5d9e', 2.4)}/>` +
        `<path d="M36 50l-4 30" stroke="#9cc8f2" stroke-width="3.4" stroke-linecap="round"/>` +
        `<circle cx="21" cy="90" r="3" fill="#7a8696"/><circle cx="79" cy="90" r="3" fill="#7a8696"/>`,
    }),
  },
  hay: {
    color: '#f0c24b',
    draw: () => ({
      under: shadow(44),
      frame: '',
      cover: `<path d="M6 95c0-36 18-64 44-66 26 2 44 30 44 66z" ${ring('#f0c24b', '#a8781a', 2.6)} stroke-linejoin="round"/>` +
        `<path d="M20 90c2-20 8-36 18-46M34 92c0-22 4-40 12-54M56 92c2-24 0-40-4-54M72 92c0-20-4-34-12-46M84 90c-2-14-6-26-14-36" fill="none" stroke="#c99a2a" stroke-width="2.2" stroke-linecap="round"/>` +
        `<path d="M44 26l-6-8M52 26l2-10M58 28l7-6" stroke="#c99a2a" stroke-width="2.2" stroke-linecap="round"/>` +
        `<path d="M14 76h72" stroke="#d64545" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>`,
    }),
  },
  shell: {
    color: '#f7a8b8',
    draw: () => {
      const ribs = [-62, -38, -14, 14, 38, 62].map((d) => {
        const a = ((d - 90) * Math.PI) / 180;
        return `M50 90L${(50 + Math.cos(a) * 42).toFixed(1)} ${(90 + Math.sin(a) * 52).toFixed(1)}`;
      });
      return {
        under: shadow(42),
        frame: '',
        cover: `<path d="M50 92L10 62C10 30 30 30 50 30s40 0 40 32z" ${ring('#f7a8b8', '#c2566e', 2.6)} stroke-linejoin="round"/>` +
          `<path d="M50 92L10 62C10 30 30 30 50 30s40 0 40 32z" fill="none"/>` +
          `<path d="${ribs.join('')}" stroke="#d97790" stroke-width="2.2" stroke-linecap="round"/>` +
          `<path d="M38 94h24l-4-8H42z" ${ring('#f9c3cf', '#c2566e', 2.2)} stroke-linejoin="round"/>` +
          `<path d="M22 50q6-10 18-12" fill="none" stroke="#ffd8e1" stroke-width="3.4" stroke-linecap="round"/>`,
      };
    },
  },
  castle: {
    color: '#e8cf96',
    draw: () => ({
      under: shadow(44),
      frame: '',
      cover: `<path d="M10 95V56h10v-6h8v6h8V40h8v-6h12v6h8v16h8v-6h8v6h10v39z" ${ring('#e8cf96', '#a88848', 2.6)} stroke-linejoin="round"/>` +
        `<path d="M44 95V80a6 6 0 0 1 12 0v15z" fill="#b89a5a"/>` +
        `<path d="M50 34V18" stroke="#7a5a2a" stroke-width="2.2"/><path d="M50 18l12 4-12 4z" fill="#ff5a5a"/>` +
        `<circle cx="22" cy="72" r="2" fill="#c9ad6e"/><circle cx="78" cy="68" r="2" fill="#c9ad6e"/><circle cx="66" cy="84" r="2" fill="#c9ad6e"/><circle cx="30" cy="86" r="2" fill="#c9ad6e"/>`,
    }),
  },
  log: {
    color: '#9b6a43',
    draw: () => ({
      under: shadow(44),
      frame: '',
      cover: `<path d="M14 58h66v36H14a8 18 0 0 1 0-36z" ${ring('#9b6a43', '#5a3a1e', 2.6)} stroke-linejoin="round"/>` +
        `<path d="M22 68h40M18 80h50M30 88h30" stroke="#7a4f2c" stroke-width="2.2" stroke-linecap="round"/>` +
        `<ellipse cx="80" cy="76" rx="11" ry="18" ${ring('#e2bd86', '#5a3a1e', 2.6)}/>` +
        `<ellipse cx="80" cy="76" rx="6.5" ry="11" fill="none" stroke="#b58a52" stroke-width="2"/><ellipse cx="80" cy="76" rx="2.6" ry="4.6" fill="#b58a52"/>` +
        `<path d="M36 58v-6M36 52c-6 0-8-6-8-6h16s-2 6-8 6z" ${ring('#ff7070', '#a83636', 1.6)}/><circle cx="34" cy="48" r="1.4" fill="#fff"/>`,
    }),
  },
  door: {
    color: '#d94a4a',
    hole: { x: 28, y: 44, w: 44, h: 52 },
    draw: () => {
      // a fat old tree stump with a little red door in it
      const doorway = 'M28 96V64a22 22 0 0 1 44 0v32z';
      return {
        under: shadow(44) + `<path d="${doorway}" fill="#3b2a24"/>`,
        frame: `<path d="M8 96c4-10 4-30 4-52 0-16 16-26 38-26s38 10 38 26c0 22 0 42 4 52z${doorway}" fill-rule="evenodd" ${ring('#8f7460', '#4f3a2a', 2.6)} stroke-linejoin="round"/>` +
          `<path d="M14 24c10-8 24-10 36-10s26 2 36 10" fill="none" stroke="#4f3a2a" stroke-width="2.6"/><ellipse cx="50" cy="24" rx="34" ry="8" fill="#d9b88f" stroke="#4f3a2a" stroke-width="2.2"/>` +
          `<ellipse cx="50" cy="24" rx="20" ry="4.2" fill="none" stroke="#b08a60" stroke-width="1.8"/>` +
          `<path d="M16 50v30M84 52v28" stroke="#6e5644" stroke-width="2.2" stroke-linecap="round"/>`,
        cover: `<path d="${doorway}" ${ring('#d94a4a', '#8a2020', 2.4)}/>` +
          `<circle cx="50" cy="60" r="7" ${ring('#ffe9a8', '#8a2020', 2)}/><path d="M50 53v14M43 60h14" stroke="#8a2020" stroke-width="1.6"/>` +
          `<path d="M34 76h32M34 86h32" stroke="#b23434" stroke-width="2"/><circle cx="64" cy="80" r="2.6" fill="#ffd23f" stroke="#8a6400" stroke-width="1.2"/>`,
      };
    },
  },
  flap: {
    color: '#7b61d1',
    hole: { x: 18, y: 32, w: 64, h: 56 },
    draw: (n = 1) => {
      // a little window of an advent calendar, with its number
      const doorway = 'M18 32h64v56H18z';
      return {
        under: shadow(44) + `<path d="${doorway}" fill="#2f2650"/>`,
        frame: `<path d="M6 30a10 10 0 0 1 10-10h68a10 10 0 0 1 10 10v56a10 10 0 0 1-10 10H16A10 10 0 0 1 6 86z${doorway}" fill-rule="evenodd" ${ring('#7b61d1', '#43308f', 2.6)}/>` +
          `<circle cx="12" cy="26" r="2" fill="#ffd23f"/><circle cx="88" cy="26" r="2" fill="#ffd23f"/><circle cx="12" cy="90" r="2" fill="#ffd23f"/><circle cx="88" cy="90" r="2" fill="#ffd23f"/>`,
        cover: `<path d="${doorway}" ${ring('#fff3d6', '#43308f', 2.4)}/>` +
          `<path d="M66 40l2 4 4 .6-3 2.8.7 4.2-3.7-2-3.7 2 .7-4.2-3-2.8 4-.6z" fill="#ffcf2e" stroke="#a87d00" stroke-width="1"/>` +
          `<text x="44" y="72" text-anchor="middle" font-size="30" font-weight="900" fill="#43308f" font-family="system-ui, sans-serif">${n}</text>` +
          `<rect x="73" y="54" width="4.4" height="14" rx="2.2" fill="#43308f"/>`,
      };
    },
  },
});

/**
 * Where a hint peeks out over each kind of spot: the point on the cover's (or frame's) top edge,
 * a little tilt, clear of the moss on the pot and the log's mushroom; round the castle's side wall.
 */
export const PEEK_AT = Object.freeze({
  stone: { x: 66, y: 37, a: 10 },
  bush: { x: 69, y: 31, a: 12 },
  tree: { x: 80, y: 35, a: 22 },
  pot: { x: 38, y: 45, a: -8 },
  bucket: { x: 60, y: 27, a: 6 },
  hay: { x: 68, y: 35, a: 16 },
  shell: { x: 62, y: 30, a: 8 },
  castle: { x: 91, y: 75, a: 74 },
  log: { x: 62, y: 57, a: 6 },
  door: { x: 68, y: 17, a: 10 },
  flap: { x: 70, y: 19, a: 6 },
});

/**
 * A hint as SVG (`vz-clue`), drawn behind the cover: the animal's peek (with its feature's glimpse)
 * at the spot's PEEK_AT. CSS slides `vz-peek` up and away (`data-show`, `data-beat`).
 */
export function clueG(kind, clue) {
  if (!clue) return '';
  const at = PEEK_AT[kind];
  const feat = clue.feature ? PEEK_FEATURES[clue.feature]() : '';
  return `<g class="vz-clue" data-show="${clue.show}" data-beat="${clue.beat || 0}" data-animal="${clue.animal}" data-feature="${clue.feature || ''}">` +
    `<g transform="translate(${at.x} ${at.y}) rotate(${at.a}) scale(.9)"><g class="vz-peek">${PEEKS[clue.animal]()}${feat}</g></g></g>`;
}

/** Where a figure sits in a spot: shrunk into the doorway of a door or flap, else the whole box. */
export function figureFit(kind) {
  const h = SPOT_ART[kind].hole;
  if (!h) return { k: 1, x: 0, y: 0 };
  const k = Math.min(h.w / 70, h.h / 72);
  // the figure's feet (50, 94) on the doorway's floor, in its middle
  return { k, x: h.x + h.w / 2 - 50 * k, y: h.y + h.h - 94 * k };
}

/**
 * One spot as an SVG: the shadow and doorway, the hint (`clue`, from `cluesOf` in rules.js; none on a
 * friend's spot), the figure behind it (`vz-who`, shown only while the spot is open), the frame and
 * the cover (`vz-cover`). `n` is its number (on a flap).
 */
export function spotSvg(kind, who, n = 1, clue = null) {
  const art = SPOT_ART[kind].draw(n);
  const fit = figureFit(kind);
  const fig = fit.k === 1 ? figureG(who) : `<g transform="translate(${fit.x.toFixed(2)} ${fit.y.toFixed(2)}) scale(${fit.k.toFixed(3)})">${figureG(who)}</g>`;
  const sparks = [[14, 24], [86, 20], [92, 60], [8, 62], [50, 6]].map(([x, y]) => `<path class="vz-spark" d="M${x} ${y - 6}l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" fill="#ffcf2e" stroke="#c99a00" stroke-width="1"/>`).join('');
  return `<svg class="vz-svg" viewBox="0 0 100 100" aria-hidden="true" data-open="${SPOTS[kind]}">${art.under}${clueG(kind, clue)}<g class="vz-who">${fig}</g>` +
    `${art.frame ? `<g class="vz-frame">${art.frame}</g>` : ''}<g class="vz-cover">${art.cover}</g>${sparks}</svg>`;
}

/** A spot alone, closed (the menu and how-to pictures). */
function spotOnly(kind, n = 1) {
  const art = SPOT_ART[kind].draw(n);
  return `${art.under}${art.frame}${art.cover}`;
}

// ---------- the scenes ----------
// 400 x 300, drawn behind the spots (sliced to fill the box): mostly ground, so spots in any row
// stand on something, with a strip of sky or sea at the top.

export const SCENE_COLORS = Object.freeze({ garden: '#bfe59a', forest: '#a9d28c', beach: '#f6e2b0', farm: '#dbe8a2' });

function flowers(list) {
  return list.map(([x, y, c]) => `<g transform="translate(${x} ${y})"><circle r="3.4" cx="-3.4" fill="${c}"/><circle r="3.4" cx="3.4" fill="${c}"/><circle r="3.4" cy="-3.4" fill="${c}"/><circle r="3.4" cy="3.4" fill="${c}"/><circle r="2.4" fill="#ffe066"/></g>`).join('');
}

export function sceneSvg(scene) {
  const body = {
    garden: `<rect width="400" height="300" fill="${SCENE_COLORS.garden}"/>` +
      `<rect width="400" height="46" fill="#cfeeff"/><circle cx="352" cy="18" r="14" fill="#ffe066"/>` +
      `<path d="M0 30h400M0 44h400" stroke="#fff" stroke-width="4"/>` +
      Array.from({ length: 21 }, (_, k) => `<path d="M${k * 20 + 4} 50V24l6-6 6 6v26z" fill="#fff" stroke="#d8d2ee" stroke-width="1.5"/>`).join('') +
      `<path d="M0 50h400v8H0z" fill="#a8d982"/>` +
      `<path d="M150 300c10-60 70-90 60-150s30-80 40-92" fill="none" stroke="#f1dfb8" stroke-width="34" stroke-linecap="round"/>` +
      `<path d="M30 120q20-10 40 0M290 220q20-10 40 0M70 250q14-8 28 0M320 110q14-8 28 0" fill="none" stroke="#a6d77e" stroke-width="5" stroke-linecap="round"/>` +
      flowers([[40, 80, '#ff8fb8'], [110, 200, '#ffffff'], [360, 160, '#ff8fb8'], [280, 280, '#c4a7ff'], [20, 270, '#ffffff'], [380, 250, '#ffd23f'], [230, 70, '#c4a7ff']]),
    forest: `<rect width="400" height="300" fill="${SCENE_COLORS.forest}"/>` +
      `<rect width="400" height="52" fill="#dff3e6"/>` +
      Array.from({ length: 9 }, (_, k) => `<path d="M${k * 48 - 8} 64l24-58 24 58z" fill="${k % 2 ? '#5f9e6c' : '#4f8c5d'}"/>`).join('') +
      `<path d="M0 60h400v10H0z" fill="#8cc070"/>` +
      `<path d="M40 140q10-6 20 0M300 120q10-6 20 0M120 260q10-6 20 0M350 240q10-6 20 0" fill="none" stroke="#86bb6c" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M60 200l8-6 4 8zM260 280l8-6 4 8zM340 90l8-6 4 8zM180 110l8-6 4 8z" fill="#e08a3c"/>` +
      `<path d="M210 230c0-6 4-8 8-8s8 2 8 8zM30 260c0-6 4-8 8-8s8 2 8 8z" fill="#ff7070"/><path d="M216 230h4v6h-4zM36 260h4v6h-4z" fill="#fff3d6"/>`,
    beach: `<rect width="400" height="300" fill="${SCENE_COLORS.beach}"/>` +
      `<rect width="400" height="30" fill="#bfe6ff"/><circle cx="50" cy="16" r="12" fill="#ffe066"/>` +
      `<path d="M0 28h400v34H0z" fill="#6cc3e8"/>` +
      `<path d="M0 62q25-12 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0v8H0z" fill="#fff" opacity=".9"/>` +
      `<path d="M30 42q10-6 20 0M150 38q10-6 20 0M300 44q10-6 20 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="60" cy="150" r="3" fill="#e2c890"/><circle cx="300" cy="200" r="3" fill="#e2c890"/><circle cx="180" cy="270" r="3" fill="#e2c890"/><circle cx="350" cy="120" r="3" fill="#e2c890"/>` +
      `<path d="M120 220l4 9 10 1-8 6 3 10-9-6-9 6 3-10-8-6 10-1z" fill="#ff9a5a" opacity=".85"/>`,
    farm: `<rect width="400" height="300" fill="${SCENE_COLORS.farm}"/>` +
      `<rect width="400" height="56" fill="#d4ecff"/>` +
      `<path d="M300 58V24l30-18 30 18v34z" fill="#d84a3a" stroke="#962a1e" stroke-width="2"/><path d="M318 58V38h24v20z" fill="#fff3d6"/>` +
      `<path d="M0 58h400" stroke="#b07a46" stroke-width="5"/><path d="M0 46h290" stroke="#b07a46" stroke-width="4"/>` +
      Array.from({ length: 15 }, (_, k) => `<path d="M${k * 20 + 6} 62V38" stroke="#b07a46" stroke-width="5" stroke-linecap="round"/>`).join('') +
      `<path d="M0 62h400v8H0z" fill="#c4d98a"/>` +
      `<path d="M260 300c0-60-60-80-50-140s60-70 70-90" fill="none" stroke="#e6cf9c" stroke-width="30" stroke-linecap="round"/>` +
      `<path d="M40 130q12-8 24 0M100 260q12-8 24 0M330 200q12-8 24 0" fill="none" stroke="#b6cf76" stroke-width="5" stroke-linecap="round"/>` +
      flowers([[60, 210, '#ffffff'], [360, 280, '#ffd23f'], [150, 100, '#ffffff']]),
  }[scene];
  return `<svg class="vz-bg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${body}</svg>`;
}

/** A scene as a small card for the menu: the scene with one of its spots and a peeking animal. */
export function sceneCardSvg(scene, kind, animal) {
  const fig = figureG({ kind: 'animal', id: animal, feature: null });
  return `<svg class="vz-scene-pic" viewBox="0 0 120 84" aria-hidden="true">
    <g transform="scale(.3 .28)">${sceneSvg(scene).replace(/<\/?svg[^>]*>/g, '')}</g>
    <g transform="translate(22 30) scale(.5)">${fig}</g>
    <g transform="translate(52 22) scale(.58)"><g transform="translate(8 -4) rotate(8 50 96)">${spotOnly(kind, 1)}</g></g>
  </svg>`;
}

/** The home tile: a hedgehog peeking out from behind a stone, a little bird waving from a flap. */
export function tileSvg() {
  return `<svg class="vz-tile-svg" viewBox="0 0 100 100" aria-hidden="true">
    <rect x="4" y="4" width="92" height="92" rx="18" fill="${SCENE_COLORS.garden}"/>
    <path d="M4 22a18 18 0 0 1 18-18h56a18 18 0 0 1 18 18v6H4z" fill="#cfeeff"/>
    <g transform="translate(52 10) scale(.42)">${spotOnly('flap', 3)}<g transform="translate(19.7 31.1) scale(.617)">${figureG({ kind: 'creature', id: 'bird' })}</g></g>
    <g transform="translate(4 44) scale(.5)">${figureG({ kind: 'animal', id: 'hedgehog', feature: null })}</g>
    <g transform="translate(30 50) scale(.5)"><g transform="translate(14 -6) rotate(14 50 96)">${spotOnly('stone')}</g></g>
  </svg>`;
}

/** The how-to picture: a lifted stone with a waving snail, and the hedgehog found behind a bush. */
export function howSvg() {
  return `<svg class="vz-how-svg" viewBox="0 0 180 110" aria-hidden="true">
    <rect width="180" height="110" rx="18" fill="${SCENE_COLORS.garden}"/>
    <g transform="translate(6 18) scale(.86)">${figureG({ kind: 'creature', id: 'snail' })}<g transform="translate(10 -40) rotate(-14 50 96)">${spotOnly('stone')}</g></g>
    <g transform="translate(80 26) scale(.78)"><g transform="translate(36 8) rotate(12 50 96)">${spotOnly('bush')}</g>${figureG({ kind: 'animal', id: 'hedgehog', feature: null })}</g>
  </svg>`;
}

/** Every colour that tells figures and spots apart, for the tests. */
export const COLORS = Object.freeze({
  animal: Object.freeze(Object.fromEntries(Object.entries(ANIMALS).map(([k, v]) => [k, v.color]))),
  creature: Object.freeze(Object.fromEntries(Object.entries(CREATURES).map(([k, v]) => [k, v.color]))),
  spot: Object.freeze(Object.fromEntries(Object.entries(SPOT_ART).map(([k, v]) => [k, v.color]))),
  feature: FEATURE_COLORS,
});
