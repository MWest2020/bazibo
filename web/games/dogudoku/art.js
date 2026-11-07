// Dogudoku's pictures, drawn in code as SVG (no image files): six dog faces (floppy or rounded
// ears only, so none of them reads as a cat), the bush, the cross,
// and a colour plus a pattern per region (so colour is never the only cue).

const INK = '#3b2a22'; // the soft outline every dog shares

const eye = (x, y, iris = INK) =>
  `<circle cx="${x}" cy="${y}" r="5.2" fill="${iris}"/><circle cx="${x + 1.8}" cy="${y - 1.9}" r="1.8" fill="#fff"/>`;

const snout = (y = 63) =>
  `<path d="M44.5 ${y - 3}c0-2.6 11-2.6 11 0 0 3-3.4 5.6-5.5 5.6s-5.5-2.6-5.5-5.6z" fill="${INK}"/>` +
  `<path d="M50 ${y + 2.4}v3.6M50 ${y + 6}c-1.7 2.6-5.4 2.8-7 .6M50 ${y + 6}c1.7 2.6 5.4 2.8 7 .6" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;

const tongue = (y = 70) => `<path d="M46.6 ${y}h6.8v3.4a3.4 3.4 0 0 1-6.8 0z" fill="#ff8aa1" stroke="${INK}" stroke-width="1.6"/>`;

const cheeks = (y = 62) =>
  `<ellipse cx="31" cy="${y}" rx="5" ry="3.2" fill="#ff9fb4" opacity=".55"/><ellipse cx="69" cy="${y}" rx="5" ry="3.2" fill="#ff9fb4" opacity=".55"/>`;

const head = (fill, rx = 28, ry = 26, cy = 55) =>
  `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${INK}" stroke-width="2.6"/>`;

const muzzle = (fill, cy = 64, rx = 14, ry = 10.5) => `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;

/** Each breed: a function returning the inner SVG of a 100×100 face. */
const BREEDS = [
  {
    id: 'beagle',
    svg: () =>
      // long floppy brown ears behind a tan head with a white blaze
      `<path d="M27 38c-12 2-15 22-11 34 2 6 9 7 12 2 3-6 4-21 4-31z" fill="#8a5530" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M73 38c12 2 15 22 11 34-2 6-9 7-12 2-3-6-4-21-4-31z" fill="#8a5530" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      head('#dfa065') +
      `<path d="M46 30c1-3 7-3 8 0l2 22h-12z" fill="#fff8ef"/>` +
      muzzle('#fff8ef', 64, 15, 11) +
      eye(39, 50) + eye(61, 50) + cheeks() + snout() + tongue(),
  },
  {
    id: 'dalmatian',
    svg: () =>
      `<path d="M28 34c-9 0-14 12-11 22 2 5 8 5 10 1 3-6 4-15 5-21z" fill="#2f2a2a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M72 34c9 0 14 12 11 22-2 5-8 5-10 1-3-6-4-15-5-21z" fill="#2f2a2a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      head('#fbfaf6') +
      `<circle cx="36" cy="38" r="3.4" fill="#2f2a2a"/><circle cx="60" cy="35" r="2.6" fill="#2f2a2a"/><circle cx="68" cy="45" r="2.2" fill="#2f2a2a"/>` +
      `<circle cx="30" cy="52" r="2" fill="#2f2a2a"/><circle cx="66" cy="70" r="2.4" fill="#2f2a2a"/><circle cx="34" cy="71" r="1.8" fill="#2f2a2a"/>` +
      `<ellipse cx="61" cy="50" rx="7.5" ry="6.5" fill="#2f2a2a" opacity=".16"/>` +
      eye(39, 50) + eye(61, 50) + cheeks() + snout() + tongue(),
  },
  {
    id: 'labrador',
    svg: () =>
      // golden with soft floppy ears and a light muzzle
      `<path d="M26 36c-11 1-14 16-11 27 2 6 9 6 11 1 3-6 4-17 5-25z" fill="#d9a24a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M74 36c11 1 14 16 11 27-2 6-9 6-11 1-3-6-4-17-5-25z" fill="#d9a24a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      head('#f3c972') +
      muzzle('#fde6b4', 64, 15.5, 11.5) +
      `<path d="M41 41c2-2 5-2 6 0M53 41c1-2 4-2 6 0" fill="none" stroke="#c99a46" stroke-width="2" stroke-linecap="round"/>` +
      eye(39, 50) + eye(61, 50) + cheeks() + snout() + tongue(),
  },
  {
    id: 'corgi',
    svg: () =>
      // big rounded ears (not pointy: a corgi, never a fox or a cat), orange with a white blaze
      `<path d="M26 47C17 34 18 17 28 13c8-3 17 9 20 19z" fill="#ee9a45" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M74 47C83 34 82 17 72 13c-8-3-17 9-20 19z" fill="#ee9a45" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<path d="M30 38c-4-7-4-15 0-18 4-1 9 5 11 11z" fill="#ffd2b0"/><path d="M70 38c4-7 4-15 0-18-4-1-9 5-11 11z" fill="#ffd2b0"/>` +
      head('#ee9a45', 29, 26) +
      `<path d="M45 31c2-3 8-3 10 0 1 8 2 14 9 20 4 4 5 8 4 12-3 7-10 10-18 10s-15-3-18-10c-1-4 0-8 4-12 7-6 8-12 9-20z" fill="#fffaf2"/>` +
      eye(38, 50) + eye(62, 50) + cheeks() + snout() + tongue(),
  },
  {
    id: 'pug',
    svg: () =>
      // round fawn face, black mask and little folded ears, a forehead wrinkle
      `<path d="M25 33c-6 2-8 10-4 15l9-6z" fill="#3a2f2b" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<path d="M75 33c6 2 8 10 4 15l-9-6z" fill="#3a2f2b" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
      head('#e9c79a', 29, 26) +
      `<path d="M42 37c4-2 12-2 16 0M44 42c3-1.4 9-1.4 12 0" fill="none" stroke="#b08a5c" stroke-width="2" stroke-linecap="round"/>` +
      `<ellipse cx="50" cy="63" rx="16" ry="12" fill="#4a3b34"/>` +
      `<circle cx="38" cy="51" r="8" fill="#4a3b34" opacity=".35"/><circle cx="62" cy="51" r="8" fill="#4a3b34" opacity=".35"/>` +
      eye(38, 51) + eye(62, 51) +
      `<path d="M44.5 60c0-2.6 11-2.6 11 0 0 3-3.4 5.6-5.5 5.6s-5.5-2.6-5.5-5.6z" fill="#1d1513"/>` +
      `<path d="M50 65.4v3.2M50 68.6c-1.7 2.6-5.4 2.8-7 .6M50 68.6c1.7 2.6 5.4 2.8 7 .6" fill="none" stroke="#f3e2c8" stroke-width="2" stroke-linecap="round"/>` +
      tongue(72),
  },
  {
    id: 'poodle',
    svg: () => {
      // a cream puff: top-knot and ear puffs out of circles
      const puff = (pts, fill) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="2.4"/>`).join('');
      const fill = '#f1d3a8';
      return (
        puff([[22, 52, 10], [20, 64, 9], [24, 75, 8]], '#e7b985') +
        puff([[78, 52, 10], [80, 64, 9], [76, 75, 8]], '#e7b985') +
        head(fill, 25, 25, 57) +
        puff([[38, 32, 9], [50, 27, 10.5], [62, 32, 9]], fill) +
        `<path d="M30 36c6-4 34-4 40 0v6H30z" fill="${fill}"/>` +
        muzzle('#fbead1', 66, 12.5, 9.5) +
        eye(40, 53) + eye(60, 53) + cheeks(64) + snout(64) + tongue(71)
      );
    },
  },
];

export const BREED_COUNT = BREEDS.length;

/** A dog face as a complete <svg>. `breed` is any integer; `mood` 'happy' adds a little bounce class. */
export function dogSvg(breed, { label = '', cls = '' } = {}) {
  const b = BREEDS[((breed % BREEDS.length) + BREEDS.length) % BREEDS.length];
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="dog ${cls}" viewBox="6 6 88 88" ${aria}>${b.svg()}</svg>`;
}

export function bushSvg() {
  const leaf = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  return (
    `<svg class="bush" viewBox="0 0 100 100" aria-hidden="true">` +
    `<ellipse cx="50" cy="82" rx="34" ry="6" fill="#000" opacity=".08"/>` +
    leaf(30, 62, 18, '#57a85a') + leaf(70, 62, 18, '#57a85a') + leaf(50, 46, 22, '#68b968') +
    leaf(36, 44, 14, '#7cc87a') + leaf(64, 46, 14, '#7cc87a') + leaf(50, 66, 20, '#4f9b52') +
    `<circle cx="38" cy="40" r="3.2" fill="#ffd166"/><circle cx="62" cy="52" r="3.2" fill="#ff8fab"/><circle cx="48" cy="62" r="3.2" fill="#fff"/>` +
    `<path d="M24 60c4-8 12-12 20-12M58 36c6 0 12 4 14 10" fill="none" stroke="#9fdc9a" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>` +
    `</svg>`
  );
}

/** A cross the child set; `auto` is a fainter, thinner one that auto-cross shows by itself. */
export function crossSvg(kind = '') {
  return `<svg class="cross ${kind}" viewBox="0 0 100 100" aria-hidden="true"><path d="M36 36l28 28M64 36 36 64" stroke="currentColor" stroke-width="9" stroke-linecap="round"/></svg>`;
}

// Region colours: light, friendly, apart in lightness as well as hue, each with its own pattern.
export const REGIONS = [
  { fill: '#cdebc6', ink: '#79b56f', pattern: 'dots' },
  { fill: '#ffd8a6', ink: '#e19a4c', pattern: 'stripes' },
  { fill: '#c4dcfb', ink: '#6b9be0', pattern: 'plus' },
  { fill: '#ffc8d8', ink: '#e384a3', pattern: 'rings' },
  { fill: '#f8ec9c', ink: '#cfb335', pattern: 'zigzag' },
  { fill: '#dccfff', ink: '#9a84e6', pattern: 'diamonds' },
  { fill: '#bdeee3', ink: '#53b9a6', pattern: 'waves' },
  { fill: '#e9dfcc', ink: '#b09c78', pattern: 'backstripes' },
];
export const GARDEN = { fill: '#e6f4d8', ink: '#a9d290', pattern: 'grass' }; // the youngest tier: no regions

const MOTIF = {
  dots: (c) => `<circle cx="6" cy="6" r="1.9" fill="${c}"/><circle cx="18" cy="18" r="1.9" fill="${c}"/>`,
  stripes: (c) => `<path d="M-6 6 6-6M0 24 24 0M18 30 30 18" stroke="${c}" stroke-width="2.4"/>`,
  plus: (c) => `<path d="M12 7v10M7 12h10" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`,
  rings: (c) => `<circle cx="12" cy="12" r="4.4" fill="none" stroke="${c}" stroke-width="2"/>`,
  zigzag: (c) => `<path d="M0 15l6-6 6 6 6-6 6 6" fill="none" stroke="${c}" stroke-width="2.2"/>`,
  diamonds: (c) => `<path d="M12 6l5 6-5 6-5-6z" fill="${c}"/>`,
  waves: (c) => `<path d="M0 12c4-5 8-5 12 0s8 5 12 0" fill="none" stroke="${c}" stroke-width="2.2"/>`,
  backstripes: (c) => `<path d="M-6 18 6 30M0 0 24 24M18-6 30 6" stroke="${c}" stroke-width="2.4"/>`,
  grass: (c) => `<path d="M6 16l1.5-5M9 16l-.5-6M17 8l1.5-5M20 8l-.5-6" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`,
};

const patternCache = new Map();
/** A CSS background value for a region (colour + a faint repeating motif as a data: SVG). */
export function regionBackground(region) {
  const key = region.pattern + region.fill;
  if (!patternCache.has(key)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g opacity=".42">${MOTIF[region.pattern](region.ink)}</g></svg>`;
    patternCache.set(key, `url("data:image/svg+xml,${encodeURIComponent(svg)}") 0 0 / 24px 24px, ${region.fill}`);
  }
  return patternCache.get(key);
}
