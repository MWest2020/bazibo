// Picturedoku's pictures, drawn in code (SVG, viewBox 48×48). Every picture differs from the others
// by shape AND colour, so children who see colours differently can still tell them apart:
//   1 apple (red, round)       2 banana (yellow, curved)    3 grapes (purple, cluster)
//   4 carrot (orange, long)    5 pear (green, pear-shaped)  6 mushroom (brown cap, dots)
//   7 flower (pink, petals)    8 fish (blue, with a tail)   9 ball (black and white)
// 4×4 uses 1-4, 6×6 uses 1-6, 9×9 uses all nine.

const INK = '#3b2a22';
const LINE = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const SHINE = 'fill="#fff" opacity="0.55"';

export const PICTURES = [
  // 1 apple
  `<path d="M29 13.5c2-3.5 1.5-6.5 0-8.5" fill="none" stroke="#7a4a26" stroke-width="2.6" stroke-linecap="round"/>
   <path d="M29.5 11c2.5-4.5 8-6 11.5-4-1.8 4.6-7.4 6.4-11.5 4z" fill="#4cc38a" ${LINE}/>
   <path d="M24 15.5c-3.5-3-9.5-4-13.6.2-5.2 5.4-4.3 15.6 1 21.6 3 3.4 6.6 5.7 9.2 4.5 1.2-.6 2.2-1 3.4-1s2.2.4 3.4 1c2.6 1.2 6.2-1.1 9.2-4.5 5.3-6 6.2-16.2 1-21.6-4.1-4.2-10.1-3.2-13.6-.2z" fill="#e5484d" ${LINE}/>
   <ellipse cx="15.5" cy="23" rx="3" ry="5" transform="rotate(20 15.5 23)" ${SHINE}/>`,
  // 2 banana
  `<path d="M9.5 8.5c-3 .4-4 3-3.4 5.8 3 14.6 14.6 25 31 23.4 3-.3 4.6-3 2.8-5.2-12.6.6-20.4-7.6-23.4-19.2-1-3.4-3.6-5.2-7-4.8z" fill="#ffd23f" ${LINE}/>
   <path d="M12 15.5c3.4 10.4 10.4 17 21 18.2" fill="none" stroke="#e0a800" stroke-width="2" stroke-linecap="round"/>
   <path d="M8 10.2 6 6.5" stroke="#7a4a26" stroke-width="3" stroke-linecap="round"/>
   <circle cx="38.6" cy="34.5" r="1.8" fill="#7a4a26"/>`,
  // 3 grapes
  `<path d="M24 11V5.5" stroke="#7a4a26" stroke-width="2.6" stroke-linecap="round"/>
   <path d="M24.5 8.5c3-3.6 8.4-4.2 11.4-1.6-2.4 4-8 5-11.4 1.6z" fill="#4cc38a" ${LINE}/>
   ${[[15.5, 16], [24, 16], [32.5, 16], [19.8, 24], [28.2, 24], [15.5, 32] , [24, 32], [32.5, 32], [24, 40]]
     .filter((_, i) => i !== 5 && i !== 7)
     .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.6" fill="#8e5bd6" ${LINE}/><circle cx="${x - 1.8}" cy="${y - 1.9}" r="1.6" ${SHINE}/>`)
     .join('')}`,
  // 4 carrot
  `<path d="M31 14.5c1-4.5-.5-8.5-3-10M33 15c3.5-3 8-3.4 10.5-1.6M32.5 14.5c1.8-4.6 5.6-7.4 9-7" fill="none" stroke="#2f9e5b" stroke-width="3" stroke-linecap="round"/>
   <path d="M27.5 13.5c3.6-1.4 7.6.4 8.4 3.8.4 1.6-.2 3.2-1.2 4.4L13.6 42.4c-1.4 1.4-3.6.2-3-1.6l9-22.4c1.4-3.2 4.6-4.4 7.9-4.9z" fill="#ff8a3d" ${LINE}/>
   <path d="M20.5 24.5l4 2M17.5 31.5l3.2 1.6M24 19.5l3.4 1.6" stroke="#c95f17" stroke-width="2" stroke-linecap="round"/>`,
  // 5 pear
  `<path d="M24 11.5c.2-3 1.4-5.2 3.4-6.6" fill="none" stroke="#7a4a26" stroke-width="2.6" stroke-linecap="round"/>
   <path d="M25.5 9.5c2.8-3 7.4-3.4 10-1.2-2 3.4-6.8 4.2-10 1.2z" fill="#2f9e5b" ${LINE}/>
   <path d="M24 10.5c-3.4 0-4.8 3-4.8 6.4 0 3.2-2 5.4-5 9.2-4.6 6-2.4 17.4 9.8 17.4s14.4-11.4 9.8-17.4c-3-3.8-5-6-5-9.2 0-3.4-1.4-6.4-4.8-6.4z" fill="#8bd448" ${LINE}/>
   <ellipse cx="17.5" cy="31" rx="2.6" ry="4.6" transform="rotate(15 17.5 31)" ${SHINE}/>`,
  // 6 mushroom
  `<path d="M18.5 28.5h11l1.4 9.2c.4 3.2-3 4.8-6.9 4.8s-7.3-1.6-6.9-4.8z" fill="#f6e7c8" ${LINE}/>
   <path d="M5.5 27c0-10.4 8.2-18 18.5-18s18.5 7.6 18.5 18c0 1.8-1.6 2.8-3.6 2.8H9.1c-2 0-3.6-1-3.6-2.8z" fill="#b0723a" ${LINE}/>
   <circle cx="15" cy="20" r="3" fill="#fff4dc"/><circle cx="26" cy="15.5" r="2.6" fill="#fff4dc"/><circle cx="33.5" cy="23" r="3.2" fill="#fff4dc"/><circle cx="22.5" cy="24" r="2" fill="#fff4dc"/>`,
  // 7 flower
  `${[0, 72, 144, 216, 288]
    .map((a) => {
      const r = (a - 90) * (Math.PI / 180);
      return `<circle cx="${(24 + Math.cos(r) * 9.5).toFixed(2)}" cy="${(24 + Math.sin(r) * 9.5).toFixed(2)}" r="7.6" fill="#ff7eb6" ${LINE}/>`;
    })
    .join('')}
   <circle cx="24" cy="24" r="6.4" fill="#ffd23f" ${LINE}/>
   <circle cx="22" cy="22" r="1.6" ${SHINE}/>`,
  // 8 fish
  `<path d="M12.5 24 4.5 15.5c-.8-.8-2.2-.2-2 .9l1.2 7.6-1.2 7.6c-.2 1.1 1.2 1.7 2 .9z" fill="#2f6fd6" ${LINE}/>
   <path d="M10.5 24c4-7.6 11.4-11.2 18.8-11.2 7.6 0 13 5 15 11.2-2 6.2-7.4 11.2-15 11.2-7.4 0-14.8-3.6-18.8-11.2z" fill="#4c95f5" ${LINE}/>
   <path d="M24 13.5c2.6-4 7-5.4 10.4-4.4-1 3-3.6 5-6.6 5.6" fill="#2f6fd6" ${LINE}/>
   <path d="M22 19c2.4 3 2.4 7 0 10" fill="none" stroke="#2f6fd6" stroke-width="2" stroke-linecap="round"/>
   <circle cx="36" cy="21.5" r="3.2" fill="#fff" ${LINE}/><circle cx="36.8" cy="21.5" r="1.5" fill="${INK}"/>`,
  // 9 ball
  `<circle cx="24" cy="24" r="17.5" fill="#fff" ${LINE}/>
   <path d="M24 16.5l7 5.1-2.7 8.2h-8.6L17 21.6z" fill="${INK}"/>
   <path d="M24 6.5v10M31 21.6l9.5-3.1M28.3 29.8l5.9 8M19.7 29.8l-5.9 8M17 21.6l-9.5-3.1" fill="none" stroke="${INK}" stroke-width="1.8"/>
   <path d="M19 7.4 24 6.5l5 .9-1.8 3.4h-6.4zM39.6 15.6l1.6 5-1 4.6-3.4-2.4 1-6.4zM8.4 15.6l2.8 0.8 1 6.4-3.4 2.4-1-4.6zM14.2 39.4l1.8-3.6 6.2.4.6 4.6-5-.2zM33.8 39.4l-3.6 1.2-5 .2.6-4.6 6.2-.4z" fill="${INK}"/>`,
];

/** Picture v (1..9) as an SVG string. */
export function pictureSvg(v, { cls = '' } = {}) {
  return `<svg class="pic ${cls}" viewBox="0 0 48 48" aria-hidden="true">${PICTURES[v - 1]}</svg>`;
}

/** The number for picture v, for older children who switched to numbers. */
export function numberSvg(v, { cls = '' } = {}) {
  return `<svg class="pic num ${cls}" viewBox="0 0 48 48" aria-hidden="true"><text x="24" y="25" text-anchor="middle" dominant-baseline="central" font-size="34" font-weight="900" fill="currentColor">${v}</text></svg>`;
}
