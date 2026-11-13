// Ganzenbord's pictures, all our own and drawn in code (SVG): the geese, the special squares, the
// die and the three boards' looks (classic meadow, winter, sea). No publisher's art is copied.
import { boardLayout } from './board.js';
import { sceneSvg } from './scene.js';
import { kindOf } from './rules.js';

const INK = '#2b2370';

/** The geese a player can be: body colour, scarf colour and the number on the scarf. */
export const GEESE_LOOK = Object.freeze([
  { id: 'white', body: '#ffffff', wing: '#e6e2f2', scarf: '#ff6b6b' },
  { id: 'yellow', body: '#ffe27a', wing: '#f3c843', scarf: '#5b4bdb' },
  { id: 'blue', body: '#bfe0ff', wing: '#8fc3f2', scarf: '#ff9f1c' },
  { id: 'pink', body: '#ffc8dd', wing: '#f59ebf', scarf: '#2a9d8f' },
]);

/** A goose seen from the side, facing right: `k` 0-3 picks the colours; `num` shows on its scarf. */
export function gooseSvg(k = 0, { num = 0, cls = '', plain = false } = {}) {
  const c = GEESE_LOOK[((k % 4) + 4) % 4];
  return (
    `<svg class="goose ${cls}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<ellipse cx="48" cy="90" rx="30" ry="5" fill="#000" opacity=".15"/>` +
    `<path d="M40 80v8M54 80v8" stroke="#ff9f1c" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M34 89h10M48 89h10" stroke="#ff9f1c" stroke-width="4" stroke-linecap="round"/>` +
    // body and tail
    `<path d="M16 58c-4-4-4-10 0-12 6 2 10 2 14 0 10-6 34-6 40 4 6 10 2 28-18 31-20 2-32-8-36-23z" fill="${c.body}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    // wing
    `<path d="M32 56c8-6 22-6 28 2-4 10-18 14-28 8z" fill="${c.wing}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    // neck and head
    `<path d="M60 52c4-10 2-22 4-30 2-8 16-10 20-2 3 6-2 10-6 12-4 3-4 10-2 22z" fill="${c.body}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M83 22l12 3-12 5z" fill="#ff9f1c" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<circle cx="74" cy="20" r="3.2" fill="${INK}"/><circle cx="75" cy="19" r="1" fill="#fff"/>` +
    `<circle cx="78" cy="27" r="2.6" fill="#ff9db5" opacity=".6"/>` +
    // scarf with the player's number (a goose on a square has none: it is not a player)
    (plain
      ? ''
      : `<path d="M59 40c6 3 14 3 20-1l1 8c-6 4-15 4-22 0z" fill="${c.scarf}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
        `<path d="M62 46l-4 12 7-2 1-9z" fill="${c.scarf}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`) +
    (num ? `<circle cx="30" cy="40" r="13" fill="#fff" stroke="${c.scarf}" stroke-width="4"/><text x="30" y="46.5" text-anchor="middle" font-size="18" font-weight="900" fill="${INK}" font-family="system-ui, sans-serif">${num}</text>` : '') +
    `</svg>`
  );
}

/** A friendly robot goose helper badge, for the computer geese. */
export function robotBadge() {
  return (
    `<svg class="robot-badge" viewBox="0 0 24 24" aria-hidden="true">` +
    `<rect x="4" y="6" width="16" height="13" rx="4" fill="#b9e3ff" stroke="${INK}" stroke-width="1.6"/>` +
    `<path d="M12 6V3" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="2.6" r="1.6" fill="#ffc531"/>` +
    `<circle cx="9" cy="12" r="1.6" fill="${INK}"/><circle cx="15" cy="12" r="1.6" fill="${INK}"/>` +
    `<path d="M9 15.5c2 1.4 4 1.4 6 0" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** A child, for the player picker. */
export function kidSvg() {
  return (
    `<svg class="kid" viewBox="0 0 48 48" aria-hidden="true">` +
    `<path d="M14 44c0-8 4-13 10-13s10 5 10 13z" fill="#4cc38a" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="24" cy="20" r="9" fill="#ffd9b8" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M15 18.6c.6-5.6 4.6-8.8 9-8.8s8.4 3.2 9 8.8c-3.2-2.8-6.4-3.6-9-3.6s-5.8.8-9 3.6z" fill="#7a4a26" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<circle cx="21" cy="21" r="1.3" fill="${INK}"/><circle cx="27" cy="21" r="1.3" fill="${INK}"/>` +
    `<path d="M21.4 24.6c1.6 1.4 3.6 1.4 5.2 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>` +
    `</svg>`
  );
}

// ---------- the special squares (100×100) ----------

const ICONS = {
  goose: () => gooseSvg(0, { plain: true }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''),
  bridge: () =>
    `<path d="M8 72h84" stroke="#4aa3df" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="M12 64c10-30 66-30 76 0" fill="none" stroke="#a8652f" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M26 48v18M40 40v26M60 40v26M74 48v18" stroke="#a8652f" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M12 64c10-30 66-30 76 0" fill="none" stroke="${INK}" stroke-width="2.4"/>`,
  inn: () =>
    `<path d="M18 50 50 22l32 28" fill="#ff8a65" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<rect x="24" y="48" width="52" height="38" rx="4" fill="#fff3d6" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="44" y="62" width="14" height="24" rx="3" fill="#a8652f" stroke="${INK}" stroke-width="2.4"/>` +
    `<rect x="30" y="56" width="10" height="10" rx="2" fill="#bfe0ff" stroke="${INK}" stroke-width="2"/>` +
    `<text x="74" y="30" font-size="16" font-weight="900" fill="#5b4bdb" font-family="system-ui, sans-serif">z</text><text x="84" y="18" font-size="12" font-weight="900" fill="#5b4bdb" font-family="system-ui, sans-serif">z</text>`,
  well: () =>
    `<path d="M24 30h52" stroke="${INK}" stroke-width="3"/><path d="M20 32 50 14l30 18z" fill="#ff8a65" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M28 32v26M72 32v26" stroke="#a8652f" stroke-width="5"/>` +
    `<path d="M50 32v14" stroke="${INK}" stroke-width="2"/><rect x="44" y="44" width="12" height="9" rx="2" fill="#a8652f" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M20 58h60v24a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6z" fill="#c9c6d6" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M20 68h60M38 58v10M58 68v10M30 78v10M70 78v10" stroke="#8e89a8" stroke-width="2"/>`,
  maze: () =>
    `<rect x="14" y="14" width="72" height="72" rx="8" fill="#b9e6a7" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M14 30h56M30 30v26h40M30 70h56M50 44v12" fill="none" stroke="#3f8f4a" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cx="22" cy="78" r="5" fill="#ffc531" stroke="${INK}" stroke-width="2"/>`,
  prison: () =>
    `<rect x="18" y="20" width="64" height="66" rx="10" fill="#c9c6d6" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="30" y="34" width="40" height="38" rx="6" fill="#4a4370" stroke="${INK}" stroke-width="2.4"/>` +
    `<path d="M40 34v38M50 34v38M60 34v38" stroke="#e8e6f0" stroke-width="4"/>` +
    `<path d="M18 20l6-10h52l6 10" fill="#8e89a8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  woods: () =>
    `<path d="M30 16 12 50h10L8 76h44L38 50h10z" fill="#3f8f4a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
    `<path d="M68 24 52 54h9L48 78h40L75 54h9z" fill="#57a85a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
    `<path d="M30 76v12M68 78v10" stroke="#a8652f" stroke-width="6" stroke-linecap="round"/>` +
    `<text x="46" y="30" font-size="20" font-weight="900" fill="#5b4bdb" font-family="system-ui, sans-serif">?</text>`,
  end: () =>
    `<ellipse cx="50" cy="74" rx="34" ry="12" fill="#a8652f" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M20 72c6-8 54-8 60 0" fill="none" stroke="#d9a066" stroke-width="5"/>` +
    `<ellipse cx="50" cy="52" rx="20" ry="25" fill="#ffc531" stroke="${INK}" stroke-width="3"/>` +
    `<ellipse cx="43" cy="42" rx="5" ry="8" fill="#fff" opacity=".7"/>` +
    `<path d="M20 22l4 6 7 1-5 5 1 7-7-3-6 3 1-7-5-5 7-1z" fill="#fff" stroke="#ffc531" stroke-width="2"/>`,
  start: () =>
    `<path d="M30 88V14" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M32 16h44l-10 14 10 14H32z" fill="#4cc38a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
};

export function iconSvg(kind, { cls = '' } = {}) {
  const f = ICONS[kind];
  return f ? `<svg class="sq-icon ${cls}" viewBox="0 0 100 100" aria-hidden="true">${f()}</svg>` : '';
}

// ---------- the die ----------

const PIPS = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};

export function dieSvg(n) {
  const pips = (PIPS[n] || PIPS[1]).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${INK}"/>`).join('');
  return `<svg class="die-face" viewBox="0 0 100 100" aria-hidden="true"><rect x="5" y="5" width="90" height="90" rx="20" fill="#fff" stroke="${INK}" stroke-width="5"/>${pips}</svg>`;
}

// ---------- the boards ----------

/** The three looks: the same squares and rules, other colours and decorations. */
export const THEMES = Object.freeze({
  classic: { frame: '#5aa95e', bg: '#dff3d0', a: '#fffaf0', b: '#ffe9b8', special: '#ffd1dc', end: '#ffe27a', ink: '#2b2370', deco: 'flowers' },
  winter: { frame: '#5b7fd6', bg: '#e6f0ff', a: '#ffffff', b: '#d6e8ff', special: '#d8d0ff', end: '#fff1a8', ink: '#22306b', deco: 'snow' },
  sea: { frame: '#2a8fb8', bg: '#d6f3ff', a: '#fff6e0', b: '#c9f0ea', special: '#ffd8c2', end: '#ffe27a', ink: '#163a5c', deco: 'waves' },
});
export const BOARDS = Object.freeze(['classic', 'winter', 'sea']);

/** The stones of a little board picture: circles in the board's colours, 63 the golden egg. */
function miniStones(lay, th, kindOf) {
  return lay.stones
    .map(([x, y], sq) => {
      const kind = kindOf(sq);
      const fill = kind === 'end' || kind === 'start' ? th.end : kind ? th.special : sq % 2 ? th.b : th.a;
      const r = (lay.size / 2) * (kind === 'end' ? 1.3 : kind ? 1.1 : 1);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" stroke="${th.ink}" stroke-opacity=".5" stroke-width="${(lay.size * 0.08).toFixed(1)}"/>`;
    })
    .join('');
}

let mini = null; // the little pictures: the real path, small (worked out once, when first drawn)
const miniLayout = () => (mini ||= boardLayout(240, 240, Infinity));

/** A little picture of a board for the menu: its landscape with the path of stones. */
const thumbs = new Map(); // theme -> svg: the menu is drawn again on every visit and language change
export function boardThumb(theme) {
  if (!thumbs.has(theme)) thumbs.set(theme, drawThumb(theme));
  return thumbs.get(theme);
}
function drawThumb(theme) {
  const th = THEMES[theme] || THEMES.classic;
  const lay = miniLayout();
  return sceneSvg(theme, lay, { cls: 'mini-ganzen', sized: false, extra: miniStones(lay, th, kindOf) });
}

/** The home tile: the meadow board with a goose on it. */
let tile = '';
export function tileSvg() {
  return (tile ||= drawTile());
}
function drawTile() {
  const th = THEMES.classic;
  const lay = miniLayout();
  // a big goose in the middle, so the tile reads at a glance
  const s = lay.w * 0.56;
  const goose = gooseSvg(0).replace('<svg ', `<svg x="${(lay.w / 2 - s / 2).toFixed(1)}" y="${(lay.h / 2 - s * 0.55).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" `);
  return sceneSvg('classic', lay, { cls: 'ganzen-tile', sized: false, extra: miniStones(lay, th, kindOf) + goose });
}
