// The Bazibo logo: a round garden gazebo with a green onion roof and a bubble resting
// under it. Drawn as SVG markup (presentation attributes only, so the page's CSP, which
// allows no inline styles, still applies). Used on the home screen, by tools/icons.html for
// every app icon and splash, and by tools/feature.html.
//
// gazeboSvg({ outline }) returns an <svg> string with viewBox 0 0 100 100.
//   outline: true draws dark ink lines (light backgrounds); false uses softer lines that read
//   on the purple icon background.

const INK = '#2E2470';

export function gazeboSvg({ outline = true, title = '' } = {}) {
  const line = outline ? INK : '#241C5E';
  const w = 2.6; // stroke width in viewBox units
  const t = title ? `<title>${title}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${title ? 'role="img"' : 'aria-hidden="true"'} focusable="false">${t}
  <defs>
    <radialGradient id="gz-bub" cx="0.36" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#E9F4FF"/>
      <stop offset="0.35" stop-color="#7FC0FF"/>
      <stop offset="1" stop-color="#2F7FE0"/>
    </radialGradient>
    <linearGradient id="gz-roof" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5DD39A"/>
      <stop offset="1" stop-color="#25996A"/>
    </linearGradient>
  </defs>
  <!-- shadow and floor -->
  <ellipse cx="50" cy="88.5" rx="36" ry="5" fill="#000" fill-opacity="0.12"/>
  <path d="M17 80 h66 a4 4 0 0 1 4 4 v1.5 a3 3 0 0 1 -3 3 h-68 a3 3 0 0 1 -3 -3 v-1.5 a4 4 0 0 1 4 -4z" fill="#FFF3D9" stroke="${line}" stroke-width="${w}" stroke-linejoin="round"/>
  <!-- back rail -->
  <path d="M26 64 h48" stroke="${line}" stroke-width="${w}" stroke-linecap="round"/>
  <!-- the bubble under the roof -->
  <circle cx="50" cy="66.5" r="13" fill="url(#gz-bub)" stroke="${line}" stroke-width="${w * 0.8}"/>
  <ellipse cx="45" cy="61.5" rx="4" ry="2.6" fill="#fff" fill-opacity="0.9" transform="rotate(-30 45 61.5)"/>
  <!-- pillars -->
  <rect x="20.5" y="50" width="7" height="31" rx="2.5" fill="#FFFFFF" stroke="${line}" stroke-width="${w}"/>
  <rect x="72.5" y="50" width="7" height="31" rx="2.5" fill="#FFFFFF" stroke="${line}" stroke-width="${w}"/>
  <!-- roof: an onion dome with three stripes -->
  <path d="M50 9 C 56 18, 74 26, 81 42 C 82.5 45.5, 80 48, 76 48 H 24 C 20 48, 17.5 45.5, 19 42 C 26 26, 44 18, 50 9 Z" fill="url(#gz-roof)" stroke="${line}" stroke-width="${w}" stroke-linejoin="round"/>
  <path d="M50 10 C 47 22, 40 34, 38 48 H 46 C 47 34, 49 22, 50 10 Z" fill="#B6F0D2" fill-opacity="0.75"/>
  <path d="M50 10 C 53 22, 60 34, 62 48 H 54 C 53 34, 51 22, 50 10 Z" fill="#B6F0D2" fill-opacity="0.75"/>
  <path d="M50 9 C 56 18, 74 26, 81 42 C 82.5 45.5, 80 48, 76 48 H 24 C 20 48, 17.5 45.5, 19 42 C 26 26, 44 18, 50 9 Z" fill="none" stroke="${line}" stroke-width="${w}" stroke-linejoin="round"/>
  <!-- scalloped eave -->
  <path d="M19 48 h62 v3 q-5.2 5 -10.3 0 q-5.2 5 -10.3 0 q-5.2 5 -10.4 0 q-5.2 5 -10.3 0 q-5.2 5 -10.3 0 q-5.2 5 -10.4 0 z" fill="#FFD25A" stroke="${line}" stroke-width="${w * 0.85}" stroke-linejoin="round"/>
  <!-- finial -->
  <path d="M50 9 V 3.5" stroke="${line}" stroke-width="${w}" stroke-linecap="round"/>
  <circle cx="50" cy="3.6" r="3.2" fill="#FFD25A" stroke="${line}" stroke-width="${w * 0.8}"/>
</svg>`;
}
