// The landscape under Ganzenbord's stepping stones, drawn in code (SVG) and our own: the meadow
// ("Het weiland": grass, a pond, trees and flowers), winter (snow, pine trees, a frozen pond) and
// the sea (sand, a lagoon, shells and starfish). The stones themselves are buttons (ganzen.js);
// this is only the picture behind them: the ground, the trail from stone to stone, the pond in the
// middle and things in the grass, placed where no stone or trail is.
const INK = '#2b2370';

/** The colours of each landscape. */
export const SCENES = Object.freeze({
  classic: { top: '#d3f0b4', bottom: '#a7da88', trail: '#f3dfae', edge: '#d8b878', water: '#7ccaf2', rim: '#4f9fd1', shine: '#c8ecff' },
  winter: { top: '#f7fbff', bottom: '#dbe8fb', trail: '#ffffff', edge: '#b9cbea', water: '#d7f1fc', rim: '#93bfe0', shine: '#ffffff' },
  sea: { top: '#fcedc8', bottom: '#f2d49a', trail: '#e9c27f', edge: '#cfa15b', water: '#5fc4e8', rim: '#2a8fb8', shine: '#b8ecff' },
});

/** A small seeded random generator, so a landscape looks the same every time it is drawn. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f1 = (n) => Math.round(n * 10) / 10;
let drawings = 0;

// ---------- the things in the landscape, each at (x, y) with size s (px) ----------

const PARTS = {
  tree: (x, y, s) =>
    `<ellipse cx="${f1(x)}" cy="${f1(y + s * 0.46)}" rx="${f1(s * 0.34)}" ry="${f1(s * 0.08)}" fill="#000" opacity=".12"/>` +
    `<rect x="${f1(x - s * 0.07)}" y="${f1(y + s * 0.08)}" width="${f1(s * 0.14)}" height="${f1(s * 0.38)}" rx="${f1(s * 0.04)}" fill="#a8652f" stroke="${INK}" stroke-width="${f1(s * 0.03)}"/>` +
    `<circle cx="${f1(x)}" cy="${f1(y - s * 0.1)}" r="${f1(s * 0.34)}" fill="#4fa457" stroke="${INK}" stroke-width="${f1(s * 0.035)}"/>` +
    `<circle cx="${f1(x - s * 0.1)}" cy="${f1(y - s * 0.2)}" r="${f1(s * 0.12)}" fill="#7cc66f"/>` +
    `<circle cx="${f1(x + s * 0.12)}" cy="${f1(y - s * 0.02)}" r="${f1(s * 0.05)}" fill="#ff6b6b"/>` +
    `<circle cx="${f1(x - s * 0.14)}" cy="${f1(y + s * 0.04)}" r="${f1(s * 0.05)}" fill="#ff6b6b"/>`,
  bush: (x, y, s) =>
    `<path d="M${f1(x - s * 0.45)} ${f1(y + s * 0.2)}a${f1(s * 0.22)} ${f1(s * 0.22)} 0 0 1 ${f1(s * 0.25)}-${f1(s * 0.32)}a${f1(s * 0.26)} ${f1(s * 0.26)} 0 0 1 ${f1(s * 0.44)} 0a${f1(s * 0.22)} ${f1(s * 0.22)} 0 0 1 ${f1(s * 0.21)} ${f1(s * 0.32)}z" fill="#5fb35f" stroke="${INK}" stroke-width="${f1(s * 0.04)}" stroke-linejoin="round"/>`,
  flower: (x, y, s, r) => {
    const col = ['#ff8fab', '#ffffff', '#ffc531', '#b9a6ff'][Math.floor(r() * 4)];
    let petals = '';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      petals += `<circle cx="${f1(x + Math.cos(a) * s * 0.22)}" cy="${f1(y + Math.sin(a) * s * 0.22)}" r="${f1(s * 0.18)}" fill="${col}"/>`;
    }
    return `<path d="M${f1(x)} ${f1(y + s * 0.2)}v${f1(s * 0.3)}" stroke="#3f8f4a" stroke-width="${f1(s * 0.08)}" stroke-linecap="round"/>${petals}<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * 0.13)}" fill="${col === '#ffc531' ? '#ff8a3d' : '#ffc531'}"/>`;
  },
  tuft: (x, y, s) =>
    `<path d="M${f1(x - s * 0.3)} ${f1(y + s * 0.2)}l${f1(s * 0.12)}-${f1(s * 0.4)}M${f1(x)} ${f1(y + s * 0.2)}v-${f1(s * 0.5)}M${f1(x + s * 0.3)} ${f1(y + s * 0.2)}l-${f1(s * 0.12)}-${f1(s * 0.4)}" stroke="#6cb85a" stroke-width="${f1(Math.max(1.2, s * 0.09))}" stroke-linecap="round" fill="none"/>`,
  pine: (x, y, s) =>
    `<ellipse cx="${f1(x)}" cy="${f1(y + s * 0.48)}" rx="${f1(s * 0.3)}" ry="${f1(s * 0.07)}" fill="#5a6f9a" opacity=".15"/>` +
    `<rect x="${f1(x - s * 0.06)}" y="${f1(y + s * 0.26)}" width="${f1(s * 0.12)}" height="${f1(s * 0.2)}" fill="#8a5a2f"/>` +
    `<path d="M${f1(x)} ${f1(y - s * 0.5)}l${f1(s * 0.22)} ${f1(s * 0.3)}h-${f1(s * 0.08)}l${f1(s * 0.2)} ${f1(s * 0.26)}h-${f1(s * 0.08)}l${f1(s * 0.2)} ${f1(s * 0.24)}h-${f1(s * 0.92)}l${f1(s * 0.2)}-${f1(s * 0.24)}h-${f1(s * 0.08)}l${f1(s * 0.2)}-${f1(s * 0.26)}h-${f1(s * 0.08)}z" fill="#2f7a5a" stroke="${INK}" stroke-width="${f1(s * 0.03)}" stroke-linejoin="round"/>` +
    `<path d="M${f1(x)} ${f1(y - s * 0.5)}l${f1(s * 0.13)} ${f1(s * 0.18)}q-${f1(s * 0.13)} ${f1(s * 0.06)}-${f1(s * 0.26)} 0z" fill="#fff"/>` +
    `<path d="M${f1(x - s * 0.24)} ${f1(y - s * 0.02)}q${f1(s * 0.24)} ${f1(s * 0.08)} ${f1(s * 0.48)} 0M${f1(x - s * 0.34)} ${f1(y + s * 0.24)}q${f1(s * 0.34)} ${f1(s * 0.08)} ${f1(s * 0.68)} 0" stroke="#fff" stroke-width="${f1(s * 0.07)}" stroke-linecap="round" fill="none"/>`,
  snowman: (x, y, s) =>
    `<circle cx="${f1(x)}" cy="${f1(y + s * 0.2)}" r="${f1(s * 0.26)}" fill="#fff" stroke="${INK}" stroke-width="${f1(s * 0.03)}"/>` +
    `<circle cx="${f1(x)}" cy="${f1(y - s * 0.2)}" r="${f1(s * 0.18)}" fill="#fff" stroke="${INK}" stroke-width="${f1(s * 0.03)}"/>` +
    `<path d="M${f1(x)} ${f1(y - s * 0.19)}l${f1(s * 0.16)} ${f1(s * 0.04)}-${f1(s * 0.16)} ${f1(s * 0.03)}z" fill="#ff8a3d"/>` +
    `<circle cx="${f1(x - s * 0.06)}" cy="${f1(y - s * 0.25)}" r="${f1(s * 0.025)}" fill="${INK}"/><circle cx="${f1(x + s * 0.05)}" cy="${f1(y - s * 0.25)}" r="${f1(s * 0.025)}" fill="${INK}"/>` +
    `<path d="M${f1(x - s * 0.17)} ${f1(y - s * 0.06)}h${f1(s * 0.34)}" stroke="#ff6b6b" stroke-width="${f1(s * 0.07)}" stroke-linecap="round"/>`,
  flake: (x, y, s) =>
    `<path d="M${f1(x)} ${f1(y - s * 0.4)}v${f1(s * 0.8)}M${f1(x - s * 0.35)} ${f1(y - s * 0.2)}l${f1(s * 0.7)} ${f1(s * 0.4)}M${f1(x - s * 0.35)} ${f1(y + s * 0.2)}l${f1(s * 0.7)}-${f1(s * 0.4)}" stroke="#a9c3ee" stroke-width="${f1(Math.max(1, s * 0.08))}" stroke-linecap="round"/>`,
  drift: (x, y, s) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(s * 0.5)}" ry="${f1(s * 0.16)}" fill="#fff" opacity=".9"/>`,
  palm: (x, y, s) =>
    `<ellipse cx="${f1(x + s * 0.06)}" cy="${f1(y + s * 0.48)}" rx="${f1(s * 0.3)}" ry="${f1(s * 0.07)}" fill="#000" opacity=".12"/>` +
    `<path d="M${f1(x + s * 0.06)} ${f1(y + s * 0.48)}q-${f1(s * 0.02)}-${f1(s * 0.4)}-${f1(s * 0.08)}-${f1(s * 0.7)}" stroke="#a8652f" stroke-width="${f1(s * 0.1)}" stroke-linecap="round" fill="none"/>` +
    [[-1, -0.1], [1, -0.1], [-0.6, 0.2], [0.6, 0.2], [0, -0.3]]
      .map(([dx, dy]) => `<path d="M${f1(x - s * 0.02)} ${f1(y - s * 0.22)}q${f1(dx * s * 0.2)} ${f1((dy - 0.2) * s * 0.4)} ${f1(dx * s * 0.42)} ${f1((dy + 0.12) * s * 0.6)}" stroke="#3f9a5a" stroke-width="${f1(s * 0.11)}" stroke-linecap="round" fill="none"/>`)
      .join('') +
    `<circle cx="${f1(x - s * 0.04)}" cy="${f1(y - s * 0.18)}" r="${f1(s * 0.05)}" fill="#8a5a2f"/><circle cx="${f1(x + s * 0.04)}" cy="${f1(y - s * 0.16)}" r="${f1(s * 0.05)}" fill="#8a5a2f"/>`,
  shell: (x, y, s, r) => {
    const col = ['#ffb4a2', '#ffd6e0', '#fff1d0'][Math.floor(r() * 3)];
    const rot = Math.floor(r() * 60) - 30;
    return `<g transform="rotate(${rot} ${f1(x)} ${f1(y)})"><path d="M${f1(x - s * 0.4)} ${f1(y + s * 0.1)}a${f1(s * 0.4)} ${f1(s * 0.4)} 0 0 1 ${f1(s * 0.8)} 0l-${f1(s * 0.3)} ${f1(s * 0.24)}h-${f1(s * 0.2)}z" fill="${col}" stroke="#c97a62" stroke-width="${f1(s * 0.05)}" stroke-linejoin="round"/><path d="M${f1(x)} ${f1(y + s * 0.3)}v-${f1(s * 0.5)}M${f1(x)} ${f1(y + s * 0.3)}l-${f1(s * 0.22)}-${f1(s * 0.42)}M${f1(x)} ${f1(y + s * 0.3)}l${f1(s * 0.22)}-${f1(s * 0.42)}" stroke="#c97a62" stroke-width="${f1(s * 0.04)}"/></g>`;
  },
  star: (x, y, s, r) => {
    let d = '';
    const rot = r() * Math.PI;
    for (let k = 0; k < 10; k++) {
      const a = rot + (k / 10) * Math.PI * 2;
      const rr = k % 2 ? s * 0.18 : s * 0.45;
      d += `${k ? 'L' : 'M'}${f1(x + Math.cos(a) * rr)} ${f1(y + Math.sin(a) * rr)}`;
    }
    return `<path d="${d}z" fill="#ff9f5a" stroke="#d9673a" stroke-width="${f1(s * 0.05)}" stroke-linejoin="round"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * 0.06)}" fill="#ffd2a8"/>`;
  },
  pebble: (x, y, s, r) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(s * 0.3)}" ry="${f1(s * 0.2)}" fill="${r() < 0.5 ? '#d9c6a5' : '#c9d3dc'}"/>`,
  weed: (x, y, s) =>
    `<path d="M${f1(x)} ${f1(y + s * 0.4)}q-${f1(s * 0.2)}-${f1(s * 0.3)} 0-${f1(s * 0.5)}t0-${f1(s * 0.3)}M${f1(x + s * 0.18)} ${f1(y + s * 0.4)}q${f1(s * 0.16)}-${f1(s * 0.26)} 0-${f1(s * 0.44)}" stroke="#3f9a5a" stroke-width="${f1(s * 0.09)}" stroke-linecap="round" fill="none"/>`,
  wave: (x, y, s) =>
    `<path d="M${f1(x - s * 0.5)} ${f1(y)}q${f1(s * 0.25)}-${f1(s * 0.22)} ${f1(s * 0.5)} 0t${f1(s * 0.5)} 0" stroke="#fff" stroke-width="${f1(Math.max(1.2, s * 0.08))}" stroke-linecap="round" fill="none" opacity=".85"/>`,
};

/** What grows in each landscape: big things first (corners and wide gaps), then small ones. */
const PLAN = {
  classic: { big: ['tree', 'tree', 'bush'], small: ['flower', 'flower', 'tuft', 'flower', 'tuft'] },
  winter: { big: ['pine', 'pine', 'snowman'], small: ['flake', 'drift', 'flake', 'drift'] },
  sea: { big: ['palm', 'palm', 'star'], small: ['shell', 'pebble', 'star', 'shell', 'weed'] },
};

/** The pond in the middle: a meadow pond with lily pads, a frozen pond, or a lagoon. */
function pondSvg(theme, pond, step, c) {
  if (!pond) return '';
  const pad = step * 0.08;
  const rx = Math.max(4, (pond.r - pond.l) / 2 - pad);
  const ry = Math.max(4, (pond.b - pond.t) / 2 - pad);
  const { cx, cy } = pond;
  let out =
    `<ellipse cx="${f1(cx)}" cy="${f1(cy + ry * 0.06)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${c.rim}" opacity=".55"/>` +
    `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx * 0.96)}" ry="${f1(ry * 0.94)}" fill="${c.water}" stroke="${c.rim}" stroke-width="${f1(Math.max(1.5, step * 0.06))}"/>`;
  const m = Math.min(rx, ry);
  if (theme === 'classic') {
    out += `<path d="M${f1(cx - rx * 0.5)} ${f1(cy - ry * 0.45)}q${f1(rx * 0.25)}-${f1(ry * 0.15)} ${f1(rx * 0.5)} 0" stroke="${c.shine}" stroke-width="${f1(Math.max(1.5, m * 0.08))}" stroke-linecap="round" fill="none"/>`;
    for (const [dx, dy, k] of [[0.35, 0.25, 0.32], [-0.3, 0.3, 0.24]]) {
      const x = cx + dx * rx;
      const y = cy + dy * ry;
      const r = m * k;
      out += `<path d="M${f1(x)} ${f1(y)}L${f1(x + r)} ${f1(y - r * 0.35)}A${f1(r)} ${f1(r)} 0 1 1 ${f1(x + r)} ${f1(y + r * 0.35)}z" fill="#5fb35f" stroke="#3f8f4a" stroke-width="1"/>`;
    }
    out += `<circle cx="${f1(cx + rx * 0.3)}" cy="${f1(cy + ry * 0.2)}" r="${f1(m * 0.09)}" fill="#ff8fab"/>`;
    // reeds at the edge
    const ex = cx - rx * 0.86;
    const ey = cy + ry * 0.2;
    out += `<path d="M${f1(ex)} ${f1(ey)}v-${f1(m * 0.6)}M${f1(ex + m * 0.12)} ${f1(ey)}v-${f1(m * 0.45)}" stroke="#3f8f4a" stroke-width="${f1(Math.max(1.4, m * 0.06))}" stroke-linecap="round"/><rect x="${f1(ex - m * 0.05)}" y="${f1(ey - m * 0.6)}" width="${f1(m * 0.1)}" height="${f1(m * 0.2)}" rx="${f1(m * 0.05)}" fill="#8a5a2f"/>`;
  } else if (theme === 'winter') {
    const sw = f1(Math.max(1.2, m * 0.05));
    out +=
      `<path d="M${f1(cx - rx * 0.55)} ${f1(cy - ry * 0.3)}l${f1(rx * 0.3)} ${f1(ry * 0.15)}l${f1(rx * 0.1)} ${f1(ry * 0.3)}M${f1(cx - rx * 0.25)} ${f1(cy - ry * 0.15)}l${f1(rx * 0.3)}-${f1(ry * 0.2)}" stroke="#9cc9e6" stroke-width="${sw}" stroke-linecap="round" fill="none"/>` +
      `<path d="M${f1(cx + rx * 0.1)} ${f1(cy + ry * 0.35)}l${f1(rx * 0.4)}-${f1(ry * 0.2)}M${f1(cx + rx * 0.2)} ${f1(cy - ry * 0.45)}l${f1(rx * 0.25)} ${f1(ry * 0.1)}" stroke="${c.shine}" stroke-width="${f1(Math.max(2, m * 0.1))}" stroke-linecap="round"/>`;
  } else {
    for (const [dx, dy] of [[-0.35, -0.3], [0.25, 0.05], [-0.2, 0.4]]) out += PARTS.wave(cx + dx * rx, cy + dy * ry, m * 0.55);
  }
  return out;
}

/** True when a thing of radius `rad` at (x, y) is clear of the trail, the pond, the edge and the others. */
function clearAt(x, y, rad, lay, taken, trailClear) {
  if (x - rad < 2 || y - rad < 2 || x + rad > lay.w - 2 || y + rad > lay.h - 2) return false;
  const p = lay.pond;
  if (p && x + rad > p.l - lay.step * 0.1 && x - rad < p.r + lay.step * 0.1 && y + rad > p.t - lay.step * 0.1 && y - rad < p.b + lay.step * 0.1) return false;
  for (const [tx, ty] of lay.near) if (Math.hypot(tx - x, ty - y) < rad + trailClear) return false;
  for (const o of taken) if (Math.hypot(o.x - x, o.y - y) < rad + o.rad) return false;
  return true;
}

/**
 * The landscape for a board layout (board.js) as one SVG, `theme` 'classic' | 'winter' | 'sea'.
 * `cls`: the svg's class; `sized`: false leaves out width and height (a small picture that CSS
 * sizes); `extra`: more SVG drawn on top (the stones of a little picture).
 */
export function sceneSvg(theme, lay, { cls = 'ganzen-scene', sized = true, extra = '' } = {}) {
  const c = SCENES[theme] || SCENES.classic;
  const plan = PLAN[theme] || PLAN.classic;
  const r = rng({ classic: 11, winter: 23, sea: 37 }[theme] || 11);
  const { w, h, step } = lay;
  const id = `gz-${theme}-${++drawings}`; // ids are page-wide: the menu's little boards draw scenes too
  let out =
    `<svg class="${cls}" viewBox="0 0 ${f1(w)} ${f1(h)}"${sized ? ` width="${f1(w)}" height="${f1(h)}"` : ''} aria-hidden="true">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="1" stop-color="${c.bottom}"/></linearGradient></defs>` +
    `<rect width="${f1(w)}" height="${f1(h)}" fill="url(#${id})"/>`;
  // the trail from stone to stone, under everything else
  const d = lay.trail.map(([x, y], k) => `${k ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join('');
  out +=
    `<path d="${d}" fill="none" stroke="${c.edge}" stroke-width="${f1(step * 0.5)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${c.trail}" stroke-width="${f1(step * 0.38)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  out += pondSvg(theme, lay.pond, step, c);
  // things in the landscape, seeded: the big ones where there is room, then the small ones
  const taken = [];
  const stoneR = lay.size / 2;
  // the stones and the points halfway between them: what must stay clear (the trail runs there)
  const near = lay.stones.flatMap(([x, y], k) => (k ? [[(x + lay.stones[k - 1][0]) / 2, (y + lay.stones[k - 1][1]) / 2], [x, y]] : [[x, y]]));
  lay = { ...lay, near };
  const place = (kinds, size, tries, trailClear) => {
    for (let n = 0; n < tries; n++) {
      const kind = kinds[n % kinds.length];
      const x = r() * w;
      const y = r() * h;
      const rad = size / 2;
      if (!clearAt(x, y, rad, lay, taken, trailClear)) continue;
      taken.push({ x, y, rad, kind, size });
    }
  };
  place(plan.big, step * 1.15, 200, stoneR + 1);
  place(plan.big, step * 0.85, 200, stoneR + 1);
  place(plan.small, Math.max(8, step * 0.36), 700, stoneR - step * 0.02);
  // back to front, so lower things stand in front of higher ones
  taken.sort((a, b) => a.y - b.y);
  for (const o of taken) out += PARTS[o.kind](o.x, o.y, o.size, r);
  return `${out}${extra}</svg>`;
}
