// The Bazibo logo: a plain garden gazebo (a warm terracotta cone roof on two white pillars,
// with a low railing) and a bubble resting on its floor. Drawn as SVG markup with
// presentation attributes only, so the page's CSP (no inline styles) still applies. Used on
// the home screen, by tools/icons.html for every app icon and splash, and by tools/feature.html.
//
// gazeboSvg({ outline }) returns an <svg> string with viewBox 0 0 100 100. Both variants use
// the same dark ink lines; `outline: false` only softens them a little for the purple icon
// background.

export function gazeboSvg({ outline = true } = {}) {
  const line = outline ? '#2E2470' : '#241C5E';
  const w = 2.8; // stroke width in viewBox units
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="gz-bub" cx="0.36" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#E9F4FF"/>
      <stop offset="0.35" stop-color="#7FC0FF"/>
      <stop offset="1" stop-color="#2F7FE0"/>
    </radialGradient>
    <linearGradient id="gz-roof" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FF9A62"/>
      <stop offset="1" stop-color="#E8603C"/>
    </linearGradient>
  </defs>
  <!-- shadow and floor -->
  <ellipse cx="50" cy="89" rx="38" ry="4.5" fill="#000" fill-opacity="0.12"/>
  <rect x="12" y="79" width="76" height="9" rx="3.5" fill="#FFF3D9" stroke="${line}" stroke-width="${w}"/>
  <!-- the bubble resting on the floor, behind the railing -->
  <circle cx="50" cy="65" r="13.5" fill="url(#gz-bub)" stroke="${line}" stroke-width="${w * 0.8}"/>
  <ellipse cx="45" cy="60" rx="4.2" ry="2.7" fill="#fff" fill-opacity="0.9" transform="rotate(-30 45 60)"/>
  <!-- pillars -->
  <rect x="17" y="44" width="8" height="36" rx="2.5" fill="#FFFFFF" stroke="${line}" stroke-width="${w}"/>
  <rect x="75" y="44" width="8" height="36" rx="2.5" fill="#FFFFFF" stroke="${line}" stroke-width="${w}"/>
  <!-- low railing: a top rail and short posts between the pillars -->
  <path d="M25 70 H75" stroke="${line}" stroke-width="${w}" stroke-linecap="round"/>
  <path d="M33 70 V79 M41.5 70 V79 M58.5 70 V79 M67 70 V79" stroke="${line}" stroke-width="${w * 0.9}" stroke-linecap="round"/>
  <!-- roof: a plain cone with a straight eave and a small tip -->
  <path d="M50 10 L86 41 Q88 46 83 46 H17 Q12 46 14 41 Z" fill="url(#gz-roof)" stroke="${line}" stroke-width="${w}" stroke-linejoin="round"/>
  <path d="M50 13 L30 43 H40 Z" fill="#FFC4A3" fill-opacity="0.65"/>
  <path d="M50 10 V5" stroke="${line}" stroke-width="${w * 1.1}" stroke-linecap="round"/>
</svg>`;
}
