// Keukentje's drawings, all in code (no image files, no ids, no url(#), no style attributes): every
// ingredient, dish, source (where it comes from) and recipe step on a 64 x 64 box, the home tile
// and the little kitchen on the menu and the how-to card. Every ingredient differs from the others
// by shape and colour (`LOOK`, tested), so a child can tell them apart without reading.

const OL = '#4a3426'; // the outline
const g = (inner) => `<g stroke="${OL}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;
const svg = (inner, cls = '') => `<svg class="ke-pic${cls ? ` ${cls}` : ''}" viewBox="0 0 64 64" aria-hidden="true">${g(inner)}</svg>`;
const dots = (pts, r, fill, stroke = 'none') => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}"/>`).join('');
const PLATE = '<ellipse cx="32" cy="48" rx="28" ry="9" fill="#ffffff"/><ellipse cx="32" cy="47" rx="19" ry="5.5" fill="#f1eee8" stroke="none"/>';
const WHEAT = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 14V-12" fill="none" stroke="#b8862b"/>${[-9, -3, 3].map((dy) => `<ellipse cx="-3" cy="${dy}" rx="2.6" ry="4" transform="rotate(-25 -3 ${dy})" fill="#e8b84a" stroke="#b8862b" stroke-width="1.2"/><ellipse cx="3" cy="${dy}" rx="2.6" ry="4" transform="rotate(25 3 ${dy})" fill="#e8b84a" stroke="#b8862b" stroke-width="1.2"/>`).join('')}<ellipse cx="0" cy="-14" rx="2.4" ry="3.6" fill="#e8b84a" stroke="#b8862b" stroke-width="1.2"/></g>`;

// ---------- ingredients ----------

/** The main colour and the kind of shape of every ingredient (the test keeps them apart). */
export const LOOK = Object.freeze({
  bloem: { color: '#f3ece0', shape: 'bag' },
  water: { color: '#5fb4f0', shape: 'glass' },
  gist: { color: '#f3e3b6', shape: 'cube' },
  zout: { color: '#ffffff', shape: 'shaker' },
  melk: { color: '#3b7fd9', shape: 'carton' },
  ei: { color: '#f0c896', shape: 'egg' }, // a brown egg, as most in Dutch shops
  brood: { color: '#9c5f2a', shape: 'loaf' }, // a dark crust: never the onion's colour
  kaas: { color: '#f6c431', shape: 'wedge' },
  ham: { color: '#f29bb0', shape: 'slice' },
  tomaat: { color: '#e8412f', shape: 'round' },
  boter: { color: '#f9e27d', shape: 'block' },
  suiker: { color: '#fafafa', shape: 'cubes' },
  appel: { color: '#7cc242', shape: 'round' },
  kaneel: { color: '#a0522d', shape: 'sticks' },
  sla: { color: '#9bd45a', shape: 'leafy' },
  komkommer: { color: '#2f8f3a', shape: 'long' },
  yoghurt: { color: '#b9a6e8', shape: 'pot' },
  aardbei: { color: '#e8364f', shape: 'berry' },
  banaan: { color: '#f5d132', shape: 'curve' },
  hagelslag: { color: '#5a3420', shape: 'box' },
  pindakaas: { color: '#b9773a', shape: 'jar' },
  rijst: { color: '#f4f1e8', shape: 'heap' },
  pasta: { color: '#f0c36a', shape: 'bows' },
  wortel: { color: '#f08a24', shape: 'cone' },
  prei: { color: '#7fb54a', shape: 'stalk' },
  ui: { color: '#d9862a', shape: 'bulb' },
  knoflook: { color: '#f2ede4', shape: 'bulb' },
  paprika: { color: '#f7b500', shape: 'pepper' },
  broccoli: { color: '#3f9b3a', shape: 'tree' },
  aardappel: { color: '#c9a066', shape: 'potato' },
  boerenkool: { color: '#2e6b2f', shape: 'leafy' },
  kipvlees: { color: '#d4893b', shape: 'drumstick' },
  boontjes: { color: '#5bb33b', shape: 'pods' },
});

const ING = {
  bloem: () =>
    `<path d="M16 22h32l3 34H13z" fill="#f3ece0"/><path d="M16 22l5-9h22l5 9" fill="#e4d8c3"/><path d="M24 13c2 3 6 3 8 0 2 3 6 3 8 0" fill="none"/>${WHEAT(32, 40, 0.8)}<path d="M8 58c3-3 7-3 9 0" fill="#ffffff" stroke-width="1.4"/>`,
  water: () =>
    `<path d="M17 12h30l-4 44H21z" fill="#e9f5ff"/><path d="M19.5 26h25l-2.8 30H22.3z" fill="#5fb4f0" stroke="none"/><path d="M17 12h30l-4 44H21z" fill="none"/><path d="M19.6 26c4 2 8-2 12.5 0s8.5 2 12.5 0" fill="none" stroke="#2a78b8" stroke-width="1.6"/><path d="M25 32v16" stroke="#ffffff" stroke-width="3" opacity="0.7"/>`,
  gist: () =>
    `<ellipse cx="32" cy="52" rx="24" ry="6" fill="#ffffff"/><path d="M14 30l12-8h26l-12 8z" fill="#faf0d2"/><path d="M14 30h26v20H14z" fill="#f3e3b6"/><path d="M40 30l12-8v20l-12 8z" fill="#ddc78f"/>${dots([[20, 38], [28, 43], [34, 36], [22, 46], [46, 34]], 1.3, '#cdb27a')}<path d="M44 54l3-2 2 2M50 50l2-1" fill="none" stroke="#ddc78f" stroke-width="2"/>${dots([[50, 14], [55, 8], [45, 9]], 2.4, '#ffffff', '#ddc78f')}`,
  zout: () =>
    `<path d="M21 26h22l3 30H18z" fill="#ffffff"/><path d="M22 26c0-8 4-14 10-14s10 6 10 14z" fill="#b9c3cc"/>${dots([[28, 18], [32, 16], [36, 18], [30, 22], [34, 22]], 1.2, OL)}<path d="M22 38h20" stroke="#7fb7e8" stroke-width="3"/>${dots([[50, 40], [53, 46], [48, 50]], 1, '#ffffff', '#b9c3cc')}`,
  melk: () =>
    `<path d="M18 22h28v34H18z" fill="#ffffff"/><path d="M18 22l6-10h16l6 10z" fill="#3b7fd9"/><path d="M28 12V7h8v5" fill="#3b7fd9"/><path d="M18 30h28v8H18z" fill="#3b7fd9"/><path d="M24 48c2-4 6-4 8 0 2-4 6-4 8 0" fill="none" stroke="#3b7fd9"/>`,
  ei: () => `<path d="M32 8c11 0 19 16 19 30 0 11-8 18-19 18s-19-7-19-18C13 24 21 8 32 8z" fill="#f0c896"/><path d="M24 22c2-5 5-8 8-8" fill="none" stroke="#ffffff" stroke-width="3"/>`,
  brood: () =>
    `<path d="M8 50c0-12 4-26 24-26s24 14 24 26c0 4-2 6-6 6H14c-4 0-6-2-6-6z" fill="#9c5f2a"/><path d="M20 30c2 4 2 8 0 12M30 27c2 4 2 9 0 14M40 28c2 4 2 9 0 13" fill="none" stroke="#f1c77f" stroke-width="2.6"/>`,
  kaas: () =>
    `<path d="M8 44l40-24 8 6v18z" fill="#f6c431"/><path d="M8 44h48v10H8z" fill="#f6c431"/><path d="M8 44l40-24 8 6" fill="#ffd95c"/>${dots([[20, 49], [34, 50], [46, 48]], 2.6, '#e0a514', 'none')}<ellipse cx="40" cy="31" rx="2.6" ry="1.6" fill="#e0a514" stroke="none"/>`,
  ham: () =>
    `<path d="M10 34c0-12 10-22 24-22 13 0 22 9 22 20 0 13-11 22-25 22C18 54 10 46 10 34z" fill="#ffffff"/><path d="M15 34c0-9 8-17 19-17 10 0 17 7 17 15 0 10-8 17-19 17-10 0-17-6-17-15z" fill="#f29bb0" stroke="none"/><path d="M22 30c4-3 9-3 13 0M26 40c4-2 8-2 12 1" fill="none" stroke="#e07a95" stroke-width="1.6"/>`,
  tomaat: () =>
    `<circle cx="32" cy="36" r="20" fill="#e8412f"/><path d="M32 18l-4-6 4 3 4-3-4 6 8-2-6 5 7 3-9-1 1 5-4-4-4 4 1-5-9 1 7-3-6-5z" fill="#3c9a3c" stroke-width="1.4"/><path d="M20 32c1-4 4-7 7-8" fill="none" stroke="#ffffff" stroke-width="2.6" opacity="0.8"/>`,
  boter: () =>
    `<path d="M8 36l14-12h34l-14 12z" fill="#fff3b8"/><path d="M8 36h34v16H8z" fill="#f9e27d"/><path d="M42 36l14-12v16l-14 12z" fill="#e8c95a"/><path d="M26 52V36l12-6v0" fill="none" stroke="none"/><path d="M8 44h34v8H8z" fill="#c8d6e4"/><path d="M42 44l14-12v8l-14 12z" fill="#a9bccd"/>`,
  suiker: () =>
    `<path d="M10 40l10-5 10 5v14l-10 5-10-5z" fill="#fafafa"/><path d="M10 40l10 5 10-5M20 45v14" fill="none"/><path d="M34 40l10-5 10 5v14l-10 5-10-5z" fill="#fafafa"/><path d="M34 40l10 5 10-5M44 45v14" fill="none"/><path d="M22 22l10-5 10 5v14l-10 5-10-5z" fill="#fafafa"/><path d="M22 22l10 5 10-5M32 27v14" fill="none"/>${dots([[16, 48], [26, 50], [40, 49], [49, 51], [28, 32], [37, 33]], 0.9, '#c9cdd2')}`,
  appel: () =>
    `<path d="M32 20c-6-5-20-4-20 12 0 14 10 24 20 22 10 2 20-8 20-22 0-16-14-17-20-12z" fill="#7cc242"/><path d="M32 20c0-5 1-9 4-12" fill="none" stroke-width="2.6"/><path d="M36 13c5-5 12-4 14-2-3 5-9 6-14 2z" fill="#3c9a3c"/><path d="M19 30c1-4 3-6 6-7" fill="none" stroke="#ffffff" stroke-width="2.6" opacity="0.8"/>`,
  kaneel: () =>
    `<g transform="rotate(-30 32 32)"><rect x="8" y="22" width="48" height="9" rx="4.5" fill="#a0522d"/><path d="M12 26.5h40" stroke="#6e3417" stroke-width="1.4"/></g><g transform="rotate(20 32 32)"><rect x="8" y="34" width="48" height="9" rx="4.5" fill="#b8693a"/><path d="M12 38.5h40" stroke="#6e3417" stroke-width="1.4"/></g>`,
  sla: () =>
    `<path d="M10 40c-2-10 6-16 10-14-2-8 8-14 12-10 4-4 14 2 12 10 6-2 12 6 10 14-2 10-12 16-22 16S12 50 10 40z" fill="#9bd45a"/><path d="M32 54V26M32 40l-10-8M32 36l10-8M32 48l-12-6M32 46l12-6" fill="none" stroke="#5e9a2a" stroke-width="1.8"/>`,
  komkommer: () =>
    `<path d="M10 42c0-6 6-10 14-12l22-6c6-2 10 2 10 6s-4 8-10 10l-22 8c-8 2-14 0-14-6z" fill="#2f8f3a"/><path d="M20 38l20-6" fill="none" stroke="#6cc070" stroke-width="2"/><circle cx="48" cy="50" r="9" fill="#bfe6a8"/><circle cx="48" cy="50" r="6" fill="#e6f7d9" stroke="#8cc97a" stroke-width="1.2"/>${dots([[46, 48], [50, 49], [47, 52], [50, 52]], 0.8, '#8cc97a')}`,
  yoghurt: () =>
    `<path d="M14 20h36l-5 36H19z" fill="#ffffff"/><path d="M12 14h40v6H12z" fill="#b9a6e8"/><path d="M17 32h30l-1.5 12H18.5z" fill="#b9a6e8" stroke="none"/><path d="M26 38c2-2 4-2 6 0s4 2 6 0" fill="none" stroke="#ffffff" stroke-width="2"/>`,
  aardbei: () =>
    `<path d="M32 56C20 48 12 38 12 28c0-6 5-10 11-9 3 1 6 2 9 2s6-1 9-2c6-1 11 3 11 9 0 10-8 20-20 28z" fill="#e8364f"/><path d="M22 18l4 4 6-8 6 8 4-4 2 6-12 2-12-2z" fill="#3c9a3c" stroke-width="1.6"/>${dots([[22, 30], [30, 32], [38, 30], [42, 38], [26, 40], [34, 42], [30, 50], [20, 34]], 1.2, '#ffe07a')}`,
  banaan: () =>
    `<path d="M10 22c4 18 18 30 38 28 4 0 6-2 6-4-14 0-26-8-32-22-2-4-6-6-8-6s-4 2-4 4z" fill="#f5d132"/><path d="M14 22c6 14 18 22 32 24" fill="none" stroke="#d9a91f" stroke-width="1.6"/><path d="M8 18l4 4" stroke-width="3"/><path d="M52 44l4 2" stroke-width="3"/>`,
  hagelslag: () =>
    `<path d="M16 10h28v34H16z" fill="#7a4a2a"/><path d="M16 10h28v8H16z" fill="#5a3420"/><path d="M22 26h16v10H22z" fill="#f3e2c6" stroke-width="1.4"/><path d="M26 31h2M31 29h2M33 33h2" stroke="#5a3420" stroke-width="2"/><ellipse cx="32" cy="54" rx="22" ry="5" fill="#ffffff"/>${[[16, 52, 20], [22, 55, -30], [28, 52, 60], [34, 56, 10], [40, 53, -50], [46, 55, 30], [25, 50, -10], [37, 50, 40]].map(([x, y, r]) => `<rect x="${x}" y="${y}" width="5" height="2" rx="1" transform="rotate(${r} ${x + 2.5} ${y + 1})" fill="#5a3420" stroke="none"/>`).join('')}`,
  pindakaas: () =>
    `<path d="M16 22h32v30c0 3-2 5-5 5H21c-3 0-5-2-5-5z" fill="#b9773a"/><path d="M14 12h36v10H14z" fill="#e05a47"/><path d="M20 30h24v16H20z" fill="#fff1d9" stroke-width="1.4"/><path d="M27 34c-2 2 0 4 2 4 1 0 2 1 2 2 1 2 5 1 5-1 1-3-2-4-3-4s-2-1-2-2c-1-2-3-1-4 1z" fill="#d9a35b" stroke-width="1.2"/>`,
  rijst: () =>
    `<path d="M8 50c2-16 12-26 24-26s22 10 24 26z" fill="#f4f1e8"/><path d="M6 50h52" stroke-width="2.4"/>${[[18, 44, 30], [26, 38, -20], [34, 34, 40], [42, 42, -30], [30, 46, 10], [22, 48, -40], [40, 48, 20], [46, 46, 60], [36, 40, 0], [28, 30, 70]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="1.4" transform="rotate(${r} ${x} ${y})" fill="#ffffff" stroke="#c7c0ad" stroke-width="1"/>`).join('')}`,
  pasta: () =>
    [[20, 22, -20], [42, 30, 15], [26, 46, 5]]
      .map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><path d="M${x} ${y}l-14-9 -2 4 2 3 -2 3 2 3 -2 4 2 1zM${x} ${y}l14-9 2 4-2 3 2 3-2 3 2 3-2 2z" fill="#f0c36a"/><path d="M${x - 2} ${y - 4}c2 2 2 6 0 8M${x + 2} ${y - 4}c-2 2-2 6 0 8" fill="none" stroke="#cf9a3a" stroke-width="1.6"/><ellipse cx="${x}" cy="${y}" rx="3" ry="4.5" fill="#e6b354" stroke-width="1.6"/></g>`)
      .join(''),
  wortel: () =>
    `<path d="M26 20c4-2 10-2 14 2L22 58c-2 2-4 1-4-1z" fill="#f08a24"/><path d="M27 30l5 2M24 38l5 2M22 46l4 2" stroke="#c4621a" stroke-width="1.6"/><path d="M33 20c-2-6 0-12 4-14 0 6-1 10-4 14zM34 20c2-6 8-10 14-8-3 5-8 8-14 8zM35 21c6-2 12 0 14 4-5 2-10 0-14-4z" fill="#4fae46" stroke-width="1.6"/>`,
  prei: () =>
    `<path d="M14 54l20-26 6 4-20 26c-2 2-5 0-6-4z" fill="#f6f8ee"/><path d="M34 28l12-20 4 3-8 22zM40 32l14-14 2 4-12 14z" fill="#7fb54a"/><path d="M30 30l6-18 5 2-1 18z" fill="#a6d16e"/><path d="M14 54l-4 4M17 57l-4 4M12 51l-4 2" stroke-width="1.6"/>`,
  ui: () =>
    `<path d="M32 16c-4 8-20 14-20 26 0 9 9 14 20 14s20-5 20-14c0-12-16-18-20-26z" fill="#d9862a"/><path d="M32 16c-6 10-10 22-6 40M32 16c6 10 10 22 6 40" fill="none" stroke="#9a6224" stroke-width="1.6"/><path d="M30 16c0-4 1-8 2-10 1 2 2 6 2 10" fill="#7fb54a" stroke-width="1.6"/>`,
  knoflook: () =>
    `<path d="M32 14c-4 8-18 14-18 26 0 9 8 15 18 15s18-6 18-15c0-12-14-18-18-26z" fill="#f2ede4"/><path d="M32 14c-6 10-10 22-4 41M32 14c6 10 10 22 4 41M32 20v35" fill="none" stroke="#b49ac4" stroke-width="1.6"/><path d="M28 55l-3 4M32 55v5M36 55l3 4" stroke-width="1.4"/><path d="M31 14c0-3 0-6 1-8 1 2 1 5 1 8" fill="#e4dccd" stroke-width="1.4"/>`,
  paprika: () =>
    `<path d="M20 22c-4 2-6 8-6 14 0 8 2 16 6 19 3 2 6 0 8-1 2 2 6 2 8 0 2 1 5 3 8 1 4-3 6-11 6-19 0-6-2-12-6-14-3-2-7-1-9 1-1-1-3-1-5-1s-4 0-5 1c-2-2-6-3-9-1z" fill="#f7b500"/><path d="M28 24c-3 8-3 22 0 30M36 24c3 8 3 22 0 30" fill="none" stroke="#d48f00" stroke-width="1.6"/><path d="M24 22c2-3 5-4 8-4s6 1 8 4c-3 2-13 2-16 0z" fill="#3c9a3c" stroke-width="1.6"/><path d="M32 18c0-5 2-9 6-11" fill="none" stroke="#3c9a3c" stroke-width="4"/><path d="M19 32c0-3 1-6 3-7" fill="none" stroke="#ffffff" stroke-width="2.4" opacity="0.8"/>`,
  broccoli: () =>
    `<path d="M26 36h12l2 20h-16z" fill="#b6dc8c"/>${dots([[22, 26], [32, 20], [42, 26], [27, 33], [38, 33], [32, 28]], 9, '#3f9b3a', OL)}${dots([[22, 26], [32, 20], [42, 26]], 3, '#2f7a2c')}`,
  aardappel: () =>
    `<path d="M12 36c0-10 8-18 20-18 12-1 22 5 22 16 0 12-10 20-22 20-12 0-20-8-20-18z" fill="#c9a066"/>${dots([[22, 30], [38, 28], [44, 42], [28, 44]], 1.6, '#8c6a3a')}<path d="M20 26c2-3 4-4 7-5" fill="none" stroke="#e8cc98" stroke-width="2.4"/>`,
  boerenkool: () =>
    `<path d="M32 60V50" stroke="#8fbf6a" stroke-width="4"/><path d="M32 50c-4 0-6-3-9-3-2-2-6-2-7-5 1-2-2-4-1-6 2-1 0-4 1-6 2 0 1-4 3-5 2 1 2-3 4-3 1 2 3-2 5-1 0 2 3 0 4 1 0-2 4-1 4 0 1-2 4 0 4 0 2-1 3 2 4 2 1 2 4 2 4 4-1 2 2 3 1 5-2 1 1 4-1 6 0 2-2 3-3 4-1 2-4 2-5 4-2 0-5 3-8 3z" fill="#2e6b2f"/><path d="M32 50V16M32 42l-9-7M32 34l-8-7M32 26l-6-5M32 42l9-7M32 34l8-7M32 26l6-5" fill="none" stroke="#7fbf6a" stroke-width="1.8"/>`,
  kipvlees: () =>
    `<path d="M34 14c10-4 20 4 18 16-2 10-12 14-20 12l-12 10c-2 2-6 2-8 0s-2-6 0-8l10-12c-2-8 2-16 12-18z" fill="#d4893b"/><path d="M18 46l-6 6" stroke="#ffffff" stroke-width="5"/><circle cx="10" cy="51" r="3.2" fill="#ffffff"/><circle cx="13" cy="55" r="3.2" fill="#ffffff"/><path d="M38 20c4 0 8 3 9 7" fill="none" stroke="#f0b770" stroke-width="2.4"/>`,
  boontjes: () =>
    [[-28, 0], [-14, 6], [0, 12]]
      .map(([r, dy]) => `<g transform="rotate(${r} 32 32) translate(0 ${dy})"><path d="M8 28c8-3 16-4 24-4s16 1 24 4c-8 3-16 4-24 4s-16-1-24-4z" fill="#5bb33b"/><path d="M14 28h36" stroke="#3e8a26" stroke-width="1.2"/></g>`)
      .join(''),
};

export function ingredientSvg(id, cls = '') {
  const f = ING[id];
  return f ? svg(f(), `ing ${cls}`) : '';
}

// ---------- dishes ----------

const DISH = {
  brood: () =>
    `<path d="M4 52h56v6H4z" fill="#d9a86b"/><path d="M10 48c0-12 4-26 22-26s22 14 22 26c0 3-2 4-5 4H15c-3 0-5-1-5-4z" fill="#9c5f2a"/><path d="M21 28c2 4 2 9 0 13M31 25c2 4 2 10 0 15M41 27c2 4 2 9 0 13" fill="none" stroke="#f1c77f" stroke-width="2.6"/>`,
  pannenkoeken: () => `${PLATE}${[44, 39, 34].map((y) => `<ellipse cx="32" cy="${y}" rx="20" ry="5.5" fill="#f2c35b"/>`).join('')}<path d="M18 33c4 2 8 1 12 2M36 34c3 1 7 0 10-1" fill="none" stroke="#d99a2b" stroke-width="1.4"/><path d="M27 28h10l-2 4h-6z" fill="#fff3b8" stroke-width="1.6"/>`,
  tosti: () =>
    `${PLATE}<path d="M12 46L32 14l20 32z" fill="#d99a4a"/><path d="M17 44L32 20l15 24z" fill="#efc072" stroke="none"/><path d="M22 38l12-12M26 44l14-14M18 34l8-8" stroke="#b5762b" stroke-width="2"/><path d="M14 46c4 3 8-1 12 2s8-1 12 2 8-1 12-2" fill="#f6c431" stroke-width="1.6"/>`,
  pizza: () =>
    `<circle cx="32" cy="34" r="26" fill="#e3b06a"/><circle cx="32" cy="34" r="21" fill="#e2462f" stroke="none"/>${dots([[24, 26], [40, 28], [30, 40], [42, 42], [22, 40], [34, 22]], 4.5, '#ffe08a', 'none')}${dots([[32, 32], [20, 33], [38, 46]], 2.6, '#3c9a3c', 'none')}<path d="M32 8v52M6 34h52M14 16l36 36M50 16L14 52" stroke="#c98a43" stroke-width="1.2" opacity="0.6"/>`,
  groentesoep: () =>
    `<path d="M6 30h52c0 14-10 24-26 24S6 44 6 30z" fill="#5b8fd6"/><ellipse cx="32" cy="30" rx="26" ry="6" fill="#e8763a"/>${dots([[20, 30], [38, 29], [46, 31]], 2.8, '#f6a24a', '#c4621a')}${dots([[28, 31], [33, 28]], 2.6, '#a6d16e', '#5e9a2a')}`,
  appeltaart: () =>
    `<path d="M6 40h52l-4 14H10z" fill="#c98a43"/><ellipse cx="32" cy="40" rx="26" ry="9" fill="#e9b45a"/><ellipse cx="32" cy="40" rx="21" ry="6.5" fill="#f3dc8a" stroke="none"/>${dots([[24, 39], [34, 41], [40, 38], [29, 42]], 2.4, '#b8d36a', 'none')}<path d="M14 38l10 6M22 35l14 8M32 34l14 8M40 34l10 5M14 42l12-7M24 45l16-10M36 46l14-8" stroke="#c98a43" stroke-width="2.6"/>`,
  salade: () =>
    `<path d="M6 34h52c0 12-10 20-26 20S6 46 6 34z" fill="#d9a86b"/><path d="M8 34c2-8 8-12 12-10 2-6 10-8 14-4 4-4 12-2 14 4 4-1 9 3 8 10z" fill="#9bd45a"/><circle cx="24" cy="28" r="5" fill="#e8412f" stroke-width="1.6"/><circle cx="24" cy="28" r="2.6" fill="#f6a090" stroke="none"/><circle cx="40" cy="27" r="5" fill="#bfe6a8" stroke-width="1.6"/><circle cx="40" cy="27" r="3" fill="#e6f7d9" stroke="none"/><circle cx="32" cy="22" r="4.4" fill="#e8412f" stroke-width="1.6"/>`,
  yoghurtfruit: () =>
    `<path d="M8 30h48c0 14-10 24-24 24S8 44 8 30z" fill="#dff0fb"/><ellipse cx="32" cy="30" rx="24" ry="6" fill="#ffffff"/><path d="M24 26c-4-3-6-8-2-9 2 0 3 1 4 2 1-1 2-2 4-2 4 1 2 6-2 9z" fill="#e8364f" stroke-width="1.6"/><path d="M20 18l2 2 4-4 4 4 2-2" fill="none" stroke="#3c9a3c" stroke-width="1.6"/>${dots([[38, 29], [45, 31]], 4, '#fbeeb0', '#d9a91f')}<path d="M32 54v4M22 58h20" stroke-width="2.4"/>`,
  hagelslagbrood: () =>
    `<path d="M12 56V26c0-10 6-14 12-14 4 0 6 2 8 2s4-2 8-2c6 0 12 4 12 14v30z" fill="#e9c38a"/><path d="M16 54V28c0-8 4-11 9-11 3 0 5 2 7 2s4-2 7-2c5 0 9 3 9 11v26z" fill="#fff3b8" stroke="none"/>${[[20, 26, 20], [28, 30, -30], [36, 24, 60], [42, 32, 10], [22, 38, -50], [30, 42, 30], [40, 44, -10], [24, 48, 70], [34, 50, 0], [44, 38, 45], [32, 34, -70], [38, 30, 0]].map(([x, y, r]) => `<rect x="${x}" y="${y}" width="5" height="2" rx="1" transform="rotate(${r} ${x + 2.5} ${y + 1})" fill="#5a3420" stroke="none"/>`).join('')}`,
  poffertjes: () =>
    `${PLATE}${[[20, 42], [32, 44], [44, 42], [26, 36], [38, 36], [32, 30]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="5" fill="#e6a85a"/><ellipse cx="${x - 1}" cy="${y - 1.5}" rx="3" ry="1.5" fill="#f6d39a" stroke="none"/>`).join('')}${dots([[24, 34], [30, 28], [36, 34], [40, 40], [22, 40], [33, 42], [28, 38]], 1, '#ffffff')}<path d="M28 24h8l-1 3h-6z" fill="#fff3b8" stroke-width="1.4"/>`,
  roti: () =>
    `${PLATE}<path d="M10 44c4-12 14-18 24-18 8 0 14 4 18 10-8-2-14 0-20 6-6 4-14 6-22 2z" fill="#f2d7a2"/>${dots([[22, 38], [30, 33], [38, 32], [26, 42]], 1.6, '#c9934a')}<path d="M34 46c0-4 4-6 8-6s8 2 8 6-4 5-8 5-8-1-8-5z" fill="#e8c26a"/><path d="M14 48l14-4M16 51l14-3" stroke="#5bb33b" stroke-width="3"/><path d="M44 30c4-2 9 1 8 6-1 4-5 5-8 4l-3 3" fill="#d4893b" stroke-width="1.6"/>`,
  rijstgroente: () =>
    `${PLATE}<path d="M12 46c2-10 10-16 20-16s18 6 20 16z" fill="#ffffff"/>${[[20, 42, 30], [26, 37, -20], [34, 36, 40], [42, 42, -30], [30, 43, 10], [38, 40, 0]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="1.1" transform="rotate(${r} ${x} ${y})" fill="#ffffff" stroke="#c7c0ad" stroke-width="0.9"/>`).join('')}${dots([[18, 34], [24, 31]], 4, '#3f9b3a', OL)}<path d="M38 32l6-2 2 5-6 2zM44 38l6-1 1 5-6 1z" fill="#f7b500" stroke-width="1.6"/>${dots([[30, 30], [48, 46]], 3, '#f08a24', '#c4621a')}`,
  pastasaus: () =>
    `${PLATE}<path d="M12 46c0-10 9-17 20-17s20 7 20 17z" fill="#f0c36a"/><path d="M15 44c4-8 10-11 16-8s8 8 14 5M17 40c5-6 11-7 16-3s10 5 15 1M22 34c4-3 9-3 13 1s8 4 12 1M14 46c6-2 10 0 14-3s10-3 14 0 6 2 9 0" fill="none" stroke="#d9a23f" stroke-width="1.6"/><path d="M22 34c2-5 8-7 12-6 5 0 9 3 9 7 0 3-4 4-8 4-3 2-8 2-11 0-3-1-3-3-2-5z" fill="#e2462f" stroke-width="1.6"/><path d="M34 28c2-3 6-3 7-1-2 2-5 2-7 1z" fill="#3c9a3c" stroke-width="1.2"/>${dots([[28, 33], [36, 35]], 1.4, '#c33e3e')}`,
  stamppot: () =>
    `${PLATE}<path d="M12 46c0-12 8-22 20-22s20 10 20 22z" fill="#f3e3a6"/>${dots([[20, 40], [26, 34], [34, 30], [40, 36], [44, 42], [30, 42], [36, 44], [24, 44], [38, 28], [28, 28]], 1.8, '#2e6b2f')}<path d="M28 28c2-3 6-3 8 0-2 2-6 2-8 0z" fill="#f9e27d" stroke-width="1.4"/>`,
  smoothie: () =>
    `<path d="M18 16h28l-4 42H22z" fill="#ffffff"/><path d="M19.4 24h25.2l-3.4 32H22.8z" fill="#f28aa5" stroke="none"/><path d="M18 16h28l-4 42H22z" fill="none"/><path d="M36 22l8-18h4" fill="none" stroke="#3b7fd9" stroke-width="3"/><path d="M14 18c-4-3-6-8-2-9 2 0 3 1 4 2 1-1 2-2 4-2 4 1 2 6-2 9z" fill="#e8364f" stroke-width="1.6"/>`,
  pindakaasbrood: () =>
    `<path d="M12 56V26c0-10 6-14 12-14 4 0 6 2 8 2s4-2 8-2c6 0 12 4 12 14v30z" fill="#e9c38a"/><path d="M16 54V28c0-8 4-11 9-11 3 0 5 2 7 2s4-2 7-2c5 0 9 3 9 11v26z" fill="#b9773a" stroke="none"/><path d="M20 30c6-3 12 2 20-2M20 42c8-3 14 2 22-1" fill="none" stroke="#d9a35b" stroke-width="2"/>`,
};

/** A dish under a silver cover with a question mark: "which dish can you make with these?" */
export function clocheSvg(cls = '') {
  return svg(
    `${PLATE}<path d="M8 46c0-14 10-26 24-26s24 12 24 26z" fill="#d7dee6"/><path d="M14 44c0-10 6-18 16-20" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.8"/><circle cx="32" cy="17" r="4" fill="#b9c3cc"/><path d="M27 30c0-4 2-6 5-6s5 2 5 5c0 4-5 4-5 8M32 41v1" fill="none" stroke="#5b4bdb" stroke-width="3.2"/>`,
    `dish cloche ${cls}`,
  );
}

/** Where each dish's top is (in its 64 box), so the steam or sparkles sit just above it. */
export const DISH_TOP = Object.freeze({
  brood: 22, pannenkoeken: 28, tosti: 14, pizza: 8, groentesoep: 24, appeltaart: 31, salade: 20, yoghurtfruit: 18,
  hagelslagbrood: 12, poffertjes: 25, roti: 26, rijstgroente: 30, pastasaus: 28, stamppot: 24, smoothie: 14, pindakaasbrood: 12,
});

export function dishSvg(id, cls = '') {
  const f = DISH[id];
  return f ? svg(f(), `dish ${cls}`) : '';
}

// ---------- where things come from ----------

const SRC = {
  koe: () =>
    `<path d="M10 22c-6-2-8-8-4-10 4 0 8 4 10 8zM54 22c6-2 8-8 4-10-4 0-8 4-10 8z" fill="#ffffff"/><path d="M14 18c0-6 8-10 18-10s18 4 18 10v18c0 10-8 20-18 20s-18-10-18-20z" fill="#ffffff"/><path d="M14 22c4 0 8-4 8-10-4 0-8 4-8 10zM40 10c2 6 6 10 10 10v-4c-2-4-6-6-10-6z" fill="#3a2e2a" stroke="none"/><path d="M20 40h24c2 0 4 3 4 7 0 6-6 9-16 9s-16-3-16-9c0-4 2-7 4-7z" fill="#f7b0c0"/>${dots([[26, 47], [38, 47]], 2.2, OL)}${dots([[24, 28], [40, 28]], 2.6, OL)}<path d="M22 8l-2-5M42 8l2-5" stroke="#e2c38a" stroke-width="3"/>`,
  kip: () =>
    `<path d="M12 36c0-10 8-18 20-16 4-8 14-8 16-2 4 0 6 4 4 8 4 12-4 26-20 26-12 0-20-6-20-16z" fill="#ffffff"/><path d="M38 14c0-4 2-6 4-6 0-3 4-3 4 0 2-2 5 0 4 3 2 1 2 4 0 5z" fill="#e8412f"/><path d="M54 26l6 2-6 3z" fill="#f6b23a"/><circle cx="46" cy="22" r="2" fill="${OL}"/><path d="M50 28c1 3 0 6-2 6" fill="#e8412f" stroke-width="1.4"/><path d="M18 38c6 0 12 4 14 10-8 0-14-4-14-10z" fill="#efe4d0"/><path d="M28 56v4M36 56v4" stroke="#f6b23a" stroke-width="2.4"/>`,
  graan: () => `${WHEAT(20, 34, 1.15)}${WHEAT(32, 30, 1.25)}${WHEAT(44, 34, 1.15)}<path d="M6 56h52" stroke="#8c6a3a" stroke-width="3"/>`,
  schimmel: () =>
    `<circle cx="28" cy="28" r="20" fill="#f6efe2"/>${[[20, 22, 6], [32, 20, 5], [26, 34, 6.5], [38, 32, 5], [18, 34, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e3c992" stroke="#a88247" stroke-width="1.4"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.3}" fill="#c9a46a" stroke="none"/>`).join('')}<circle cx="28" cy="28" r="20" fill="none" stroke-width="3.4"/><path d="M42 42l14 14" stroke-width="6"/>${dots([[50, 18], [54, 12]], 2, '#ffffff', '#a88247')}`,
  rijstveld: () =>
    `<path d="M2 44h60v18H2z" fill="#7cc0e8"/><path d="M2 48c6 2 10-2 16 0s10 2 16 0 10-2 16 0 8 2 12 0" fill="none" stroke="#4a96c8" stroke-width="1.6"/>${[12, 32, 52].map((x) => `<path d="M${x} 50V24M${x} 44c-4-6-8-10-10-18M${x} 44c4-6 8-10 10-18M${x} 36c-2-6-4-12-2-20" fill="none" stroke="#4fae46" stroke-width="2.2"/><path d="M${x + 6} 26c2 2 2 5 0 7" fill="none" stroke="#d9c26a" stroke-width="2.4"/>`).join('')}`,
  boom: () =>
    `<path d="M28 60V36h8v24z" fill="#8c5a2b"/><path d="M32 6c12 0 22 8 22 18 0 10-10 16-22 16S10 34 10 24C10 14 20 6 32 6z" fill="#4fae46"/>${dots([[22, 22], [38, 16], [44, 28], [28, 30]], 3.6, '#e8412f', OL)}<path d="M6 60h52" stroke="#5e9a2a" stroke-width="3"/>`,
  grond: () =>
    `<path d="M2 28h60v34H2z" fill="#9a6a3c"/><path d="M2 28h60" stroke-width="2.6"/><path d="M32 28v-6M32 22c-6-6-14-6-16-2 6 4 12 4 16 2zM32 22c6-6 14-6 16-2-6 4-12 4-16 2zM32 22c-2-8 0-14 4-16 2 6 0 12-4 16z" fill="#4fae46" stroke-width="1.6"/><path d="M32 28v8M32 36c-4 4-8 6-12 6M32 36c4 6 8 8 14 8" fill="none" stroke="#d9c29a" stroke-width="1.4"/><ellipse cx="20" cy="46" rx="8" ry="6" fill="#c9a066"/><ellipse cx="44" cy="48" rx="9" ry="6.5" fill="#c9a066"/>${dots([[10, 36], [54, 36], [30, 56], [8, 54]], 1.4, '#6e4a26')}`,
  zee: () =>
    `<circle cx="46" cy="16" r="8" fill="#ffd84a" stroke="#e0a514"/><path d="M2 34c6-6 10-6 16 0s10 6 16 0 10-6 16 0 10 6 12 2v28H2z" fill="#3b8fd9"/><path d="M2 46c6-6 10-6 16 0s10 6 16 0 10-6 16 0 10 6 12 2" fill="none" stroke="#a7d4f5" stroke-width="2"/><path d="M2 56c6-4 10-4 16 0s10 4 16 0 10-4 16 0 10 4 12 0" fill="none" stroke="#a7d4f5" stroke-width="2"/>`,
  suikerbiet: () =>
    `<path d="M20 26c0-4 6-6 12-6s12 2 12 6c0 14-6 26-12 34-6-8-12-20-12-34z" fill="#f2e8d6"/><path d="M24 34c4 1 10 1 16 0M26 44c3 1 9 1 12 0" fill="none" stroke="#c9b48c" stroke-width="1.4"/><path d="M32 20c-4-8-12-12-18-10 2 8 10 12 18 10zM32 20c4-8 12-12 18-10-2 8-10 12-18 10zM32 20c-2-8 0-14 4-16 2 6 0 12-4 16z" fill="#4fae46" stroke-width="1.6"/>`,
  cacao: () =>
    `<path d="M32 6c10 4 16 14 16 26s-6 22-16 26c-10-4-16-14-16-26S22 10 32 6z" fill="#c9792b"/><path d="M32 8v48M24 12c-4 10-4 30 0 40M40 12c4 10 4 30 0 40" fill="none" stroke="#9a5418" stroke-width="1.6"/><ellipse cx="50" cy="50" rx="5" ry="3.4" fill="#6e3a1e" transform="rotate(-30 50 50)"/><ellipse cx="14" cy="52" rx="5" ry="3.4" fill="#6e3a1e" transform="rotate(30 14 52)"/>`,
  pinda: () =>
    `<path d="M22 14c-8 0-12 8-10 14 1 4 4 6 4 9-1 4-4 6-2 12 2 6 8 9 14 8 6-1 9-6 8-11 0-3-2-5-1-8 2-3 6-5 6-10 0-8-8-14-19-14z" transform="rotate(-25 32 32) translate(8 2)" fill="#e3b97a"/><path d="M26 22c2 2 6 2 8 0M24 32c3 2 6 2 9 0M26 44c2 1 5 1 7 0" transform="rotate(-25 32 32) translate(8 2)" fill="none" stroke="#b88a4a" stroke-width="1.4"/>${dots([[46, 50], [52, 54]], 3.4, '#f2c78f', '#b88a4a')}`,
  melk: () => ING.melk(),
};

export function sourceSvg(id, cls = '') {
  const f = SRC[id];
  return f ? svg(f(), `src ${cls}`) : '';
}

// ---------- the steps of a recipe ----------

const PAN = (y = 40) => `<path d="M8 ${y}h36c0 8-4 12-18 12S8 ${y + 8} 8 ${y}z" fill="#55606e"/><path d="M44 ${y + 2}h16" stroke-width="5"/>`;
const BOWL = `<path d="M8 32h48c0 14-10 24-24 24S8 46 8 32z" fill="#7fb7e8"/><ellipse cx="32" cy="32" rx="24" ry="5" fill="#f6e7c4"/>`;
const POT = (fill = '#7fb7e8') => `<path d="M10 28h44v22c0 4-3 6-6 6H16c-3 0-6-2-6-6z" fill="#c33e3e"/><ellipse cx="32" cy="28" rx="22" ry="4.5" fill="${fill}"/><path d="M4 32h6M54 32h6" stroke-width="4"/>`;
const OVEN = `<rect x="8" y="8" width="48" height="50" rx="6" fill="#e4e8ee"/><rect x="14" y="22" width="36" height="28" rx="4" fill="#ffb347"/><path d="M14 22h36" stroke-width="2"/>${dots([[18, 15], [26, 15], [34, 15]], 2.6, '#55606e')}<path d="M20 44c3-6 6-6 9 0s6 6 9 0 6-6 8-2" fill="none" stroke="#e0601e" stroke-width="2"/>`;
const BLENDER = (fill) => `<path d="M18 8h28l-3 34H21z" fill="#eef6ff"/>${fill ? `<path d="M19.6 20h24.8l-2 22H21.6z" fill="${fill}" stroke="none"/>` : ''}<path d="M18 8h28l-3 34H21z" fill="none"/><path d="M16 42h32l3 16H13z" fill="#55606e"/><circle cx="32" cy="50" r="3" fill="#ffd84a"/>`;

const ACT = {
  mix: () => `${BOWL}<path d="M40 6L30 34" stroke-width="3"/><path d="M28 30c-4 2-6 8-2 10s8-2 8-6M30 32c-6 0-10 4-6 8" fill="none" stroke="#8a96a3" stroke-width="2"/>`,
  pour: () => `${PAN(44)}<path d="M38 8l16 6-4 10-14-2z" fill="#eef6ff"/><path d="M38 20c-6 4-10 12-10 22" fill="none" stroke="#f2c35b" stroke-width="5"/><ellipse cx="26" cy="44" rx="14" ry="3" fill="#f2c35b" stroke="none"/>`,
  flip: () => `${PAN(46)}<ellipse cx="26" cy="22" rx="14" ry="4.5" fill="#f2c35b" transform="rotate(-18 26 22)"/><path d="M8 34c0-14 10-24 22-26" fill="none" stroke="#3b7fd9" stroke-width="2.6"/><path d="M26 4l6 4-6 4" fill="none" stroke="#3b7fd9" stroke-width="2.6"/>`,
  knead: () => `<path d="M4 50h56v8H4z" fill="#d9a86b"/><path d="M12 50c0-10 8-16 20-16s20 6 20 16z" fill="#f3e3c3"/><path d="M22 30c0-8 4-14 10-14s10 6 10 14l-2 6H24z" fill="#f7c9a8"/><path d="M27 20v8M32 18v10M37 20v8" stroke="#d99a7a" stroke-width="1.6"/>`,
  rise: () => `${BOWL}<path d="M12 32c0-14 10-22 20-22s20 8 20 22" fill="#f3e3c3"/><path d="M6 24V8M2 12l4-4 4 4M58 24V8M54 12l4-4 4 4" fill="none" stroke="#3b7fd9" stroke-width="2.4"/>`,
  oven: () => `${OVEN}<path d="M22 36c0-6 4-10 10-10s10 4 10 10z" fill="#c98a43"/>`,
  roll: () => `<path d="M4 50h56v8H4z" fill="#d9a86b"/><ellipse cx="32" cy="48" rx="24" ry="4" fill="#f3e3c3"/><rect x="10" y="30" width="44" height="10" rx="5" fill="#e0b67a"/><path d="M4 35h6M54 35h6" stroke-width="5"/>`,
  top: () => `<circle cx="32" cy="34" r="24" fill="#f3e3c3"/><circle cx="32" cy="34" r="18" fill="#e2462f" stroke="none"/>${dots([[26, 28], [38, 30], [30, 40], [40, 40]], 4, '#ffe08a', 'none')}<path d="M48 6l-6 14" stroke-width="3"/><circle cx="40" cy="22" r="3" fill="#ffe08a"/>`,
  tin: () => `<path d="M6 34h52l-4 18H10z" fill="#b9c3cc"/><ellipse cx="32" cy="34" rx="26" ry="7" fill="#e9c38a"/><ellipse cx="32" cy="34" rx="20" ry="5" fill="#f3e3c3" stroke="none"/><path d="M22 18l10 10 10-10" fill="none" stroke="#3b7fd9" stroke-width="2.6"/>`,
  apples: () => `<path d="M6 34h52l-4 18H10z" fill="#b9c3cc"/><ellipse cx="32" cy="34" rx="26" ry="7" fill="#e9c38a"/>${[[20, 33], [30, 35], [40, 32], [26, 30], [36, 37], [44, 35]].map(([x, y]) => `<path d="M${x - 5} ${y}c2-4 8-4 10 0z" fill="#f3f0b8" stroke-width="1.4"/>`).join('')}<path d="M44 8c-6-4-14-2-14 6 0 6 4 10 7 9 3 1 7-3 7-9 0-2 0-4 0-6z" fill="#7cc242"/>`,
  cut: () => `<rect x="4" y="38" width="44" height="20" rx="4" fill="#d9a86b"/>${dots([[16, 46], [26, 48], [36, 46]], 4.6, '#f08a24', '#c4621a')}<path d="M40 8l18 18-6 4-16-16z" fill="#b9c3cc"/><path d="M36 14l-6-6" stroke-width="5"/>`,
  pot: () => `${POT('#7fb7e8')}${dots([[22, 27], [32, 29], [42, 27]], 3, '#f6a24a', '#c4621a')}<path d="M44 6v14M40 16l4 4 4-4" fill="none" stroke="#3b7fd9" stroke-width="2.4"/>`,
  boil: () => `${POT('#e8763a')}${dots([[22, 24], [30, 22], [38, 25], [44, 22]], 2.4, '#ffffff', '#c4621a')}<path d="M24 16c-2-3 2-5 0-8M34 14c-2-3 2-5 0-8M44 16c-2-3 2-5 0-8" fill="none" stroke="#b9b2c9" stroke-width="1.8"/><path d="M16 60h32" stroke="#e0601e" stroke-width="3"/>`,
  serve: () => `<path d="M10 34h44c0 12-8 20-22 20S10 46 10 34z" fill="#ffffff"/><ellipse cx="32" cy="34" rx="22" ry="5" fill="#e8763a"/><path d="M40 10l-6 18" stroke-width="3"/><ellipse cx="33" cy="30" rx="6" ry="3" fill="#b9c3cc"/><path d="M20 24c-2-3 2-5 0-8M28 22c-2-3 2-5 0-8" fill="none" stroke="#b9b2c9" stroke-width="1.8"/>`,
  blendIn: () => `${BLENDER(null)}<path d="M24 14c-4-3-6-8-2-9 2 0 3 1 4 2 1-1 2-2 4-2 4 1 2 6-2 9z" fill="#e8364f" stroke-width="1.4"/><path d="M34 20c4 2 8 2 10-2" fill="none" stroke="#d9a91f" stroke-width="4"/><path d="M52 4v12M48 12l4 4 4-4" fill="none" stroke="#3b7fd9" stroke-width="2.4"/>`,
  blend: () => `${BLENDER('#f28aa5')}<path d="M26 30c4-6 10-6 12 0s-6 8-8 4" fill="none" stroke="#ffffff" stroke-width="2.4"/><path d="M6 20l4 2M6 30h5M6 40l4-2M58 20l-4 2M58 30h-5M58 40l-4-2" stroke="#3b7fd9" stroke-width="2.4"/>`,
  glass: () => `<path d="M20 12h24l-3 46H23z" fill="#ffffff"/><path d="M21.2 20h21.6l-2.6 36H23.8z" fill="#f28aa5" stroke="none"/><path d="M20 12h24l-3 46H23z" fill="none"/><path d="M36 18l6-14h4" fill="none" stroke="#3b7fd9" stroke-width="3"/>`,
  cheese: () => `<rect x="10" y="30" width="44" height="22" rx="5" fill="#e9c38a"/><rect x="14" y="26" width="36" height="8" rx="2" fill="#f6c431"/><path d="M32 6v14M27 16l5 5 5-5" fill="none" stroke="#3b7fd9" stroke-width="2.4"/>`,
  close: () => `<rect x="10" y="38" width="44" height="16" rx="5" fill="#e9c38a"/><rect x="12" y="34" width="40" height="5" rx="2" fill="#f6c431"/><rect x="10" y="16" width="44" height="16" rx="5" fill="#e9c38a" transform="rotate(-8 32 24)"/><path d="M56 10v12M52 18l4 4 4-4" fill="none" stroke="#3b7fd9" stroke-width="2.4"/>`,
  iron: () => `<rect x="6" y="30" width="52" height="22" rx="8" fill="#55606e"/><rect x="6" y="16" width="52" height="14" rx="7" fill="#7a8696"/><path d="M14 30h36" stroke="#f6c431" stroke-width="3"/><rect x="26" y="8" width="12" height="8" rx="3" fill="#3a3f48"/><circle cx="48" cy="44" r="2.6" fill="#7cdc6a"/>`,
  peel: () => `<path d="M10 34c0-10 8-16 18-16 10-1 18 4 18 14 0 10-8 16-18 16-10 0-18-6-18-14z" fill="#f3e3a6"/><path d="M38 22c4-2 8 0 10 4" fill="none" stroke="#c9a066" stroke-width="4"/><path d="M44 20l12-12" stroke-width="4"/><rect x="40" y="16" width="10" height="6" rx="2" fill="#b9c3cc" transform="rotate(-45 45 19)"/><path d="M8 52c6 4 14 2 18 6M30 56c4-2 10-2 14 2" fill="none" stroke="#c9a066" stroke-width="3"/>`,
  mash: () => `${POT('#f3e3a6')}${dots([[22, 27], [30, 29], [40, 27]], 1.8, '#2e6b2f')}<path d="M32 4v20" stroke-width="3.4"/><path d="M22 24h20" stroke-width="3"/><path d="M24 28h16" stroke-width="1.6"/>`,
};

export const ACT_IDS = Object.freeze(Object.keys(ACT));

export function actSvg(act, cls = '') {
  const f = ACT[act];
  return f ? svg(f(), `act ${cls}`) : '';
}

// ---------- the kitchen: tile, menu and how-to card ----------

/** A little stove with a pot that steams, a pan with a pancake and a carrot and a tomato beside it. */
function kitchen() {
  return `<path d="M0 74h120v6H0z" fill="#d9a86b"/>
    <rect x="34" y="40" width="52" height="34" rx="5" fill="#e4e8ee" stroke="${OL}" stroke-width="2"/>
    <rect x="41" y="50" width="38" height="18" rx="3" fill="#ffb347" stroke="${OL}" stroke-width="2"/>
    ${dots([[42, 45], [50, 45], [70, 45], [78, 45]], 2, '#55606e')}
    <g stroke="${OL}" stroke-width="2" stroke-linejoin="round">
      <path d="M38 26h22v12c0 2-1 3-3 3H41c-2 0-3-1-3-3z" fill="#c33e3e"/><ellipse cx="49" cy="26" rx="11" ry="2.6" fill="#e8763a"/>
      <path d="M62 36h18c0 4-2 5-9 5s-9-1-9-5z" fill="#55606e"/><path d="M80 37h9" stroke-width="3.4"/>
      <ellipse cx="71" cy="30" rx="8" ry="2.4" fill="#f2c35b" transform="rotate(-12 71 30)"/>
    </g>
    <path d="M44 20c-2-3 2-5 0-8M52 18c-2-3 2-5 0-8" fill="none" stroke="#b9b2c9" stroke-width="2" stroke-linecap="round"/>
    <g transform="translate(2 44) scale(0.48)">${g(ING.wortel())}</g>
    <g transform="translate(90 46) scale(0.44)">${g(ING.tomaat())}</g>`;
}

/** The wall of the little kitchen on the question screen: a shelf with jars, a plant and hanging spoons. */
export function wallSvg() {
  const jar = (x, h, body, lid) => `<rect x="${x}" y="${46 - h}" width="22" height="${h}" rx="5" fill="${body}" stroke="${OL}" stroke-width="2"/><rect x="${x - 2}" y="${42 - h}" width="26" height="6" rx="2" fill="${lid}" stroke="${OL}" stroke-width="2"/>`;
  return `<svg class="ke-wall-svg" viewBox="0 0 320 64" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <path d="M14 47h176" stroke="#b77a3e" stroke-width="6" stroke-linecap="round"/>
    <path d="M30 50v8M174 50v8" stroke="#b77a3e" stroke-width="4" stroke-linecap="round"/>
    ${jar(26, 26, '#f3ece0', '#e05a47')}${jar(58, 32, '#fde3a7', '#3b7fd9')}${jar(90, 22, '#e6f2dc', '#4fae46')}
    <path d="M128 46h20l-3-14h-14z" fill="#e0855a" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M138 32c-2-8-8-12-12-12 0 6 6 10 12 12zM138 32c2-10 8-14 12-14 0 6-6 12-12 14zM138 32c0-8 0-14 0-18" fill="#4fae46" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M160 44c0-6 4-10 10-10s10 4 10 10z" fill="#c98a43" stroke="${OL}" stroke-width="2"/>
    <path d="M212 8h92" stroke="#8a96a3" stroke-width="4" stroke-linecap="round"/>
    <g stroke="${OL}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M228 8v30" /><ellipse cx="228" cy="44" rx="7" ry="6" fill="#b9c3cc"/>
      <path d="M256 8v28"/><path d="M256 36c-6 2-8 10-6 18 2 4 10 4 12 0 2-8 0-16-6-18z" fill="none" stroke="#8a96a3"/>
      <path d="M284 8v26"/><rect x="278" y="34" width="12" height="20" rx="3" fill="#d9a86b"/>
    </g>
  </svg>`;
}

export function tileSvg() {
  return `<svg class="ke-tile-svg" viewBox="0 0 120 84" aria-hidden="true">${kitchen()}</svg>`;
}

export function howSvg() {
  return `<svg class="ke-how-svg" viewBox="0 0 120 84" aria-hidden="true">${kitchen()}</svg>`;
}

// ---------- the cook ----------

/**
 * The cook's colours: a round little bear of caramel brown with a cream muzzle, a white chef's hat
 * and a teal apron over its fur, holding a wooden spoon. Our own: no shirt, no scarf, no hat but the
 * chef's hat, nothing from a franchise (never a famous chef rat or a well-known bear).
 */
export const COOK = Object.freeze({
  fur: '#c4895a',
  furDark: '#6b4423',
  muzzle: '#f4dfc4',
  ear: '#eab08e',
  eye: '#2e1d12',
  nose: '#4a2c17',
  cheek: '#f19d8a',
  hat: '#fffdf7',
  hatShade: '#e4ded2',
  apron: '#86c9bf',
  apronDark: '#3f8a80',
  spoon: '#d9a35f',
});

/**
 * The cook: a bear in a chef's hat and an apron, seen from the front, a spoon in its paw (80 x 96).
 * The hat and the spoon are their own groups, so CSS can wobble the hat and stir the spoon when a
 * dish is ready; the whole bear bobs on a right answer.
 */
export function cookSvg(cls = '') {
  const c = COOK;
  const line = `stroke="${c.furDark}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
  return `<svg class="ke-cook-svg${cls ? ` ${cls}` : ''}" viewBox="0 0 80 96" aria-hidden="true">
    <g class="ke-cook-body">
      <path d="M17 96c0-22 10-37 23-37s23 15 23 37z" fill="${c.fur}" ${line}/>
      <path d="M30 70c0-5 4-8 10-8s10 3 10 8v4c5 1 9 3 10 6l-3 16H23l-3-16c1-3 5-5 10-6z" fill="${c.apron}" stroke="${c.apronDark}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M31 66c-1-3 0-6 3-8M49 66c1-3 0-6-3-8" fill="none" stroke="${c.apronDark}" stroke-width="2.2" stroke-linecap="round"/>
      <rect x="33" y="80" width="14" height="9" rx="3" fill="none" stroke="${c.apronDark}" stroke-width="2"/>
      <circle cx="22" cy="32" r="7.5" fill="${c.fur}" ${line}/>
      <circle cx="22" cy="32" r="3.8" fill="${c.ear}"/>
      <circle cx="58" cy="32" r="7.5" fill="${c.fur}" ${line}/>
      <circle cx="58" cy="32" r="3.8" fill="${c.ear}"/>
      <circle cx="40" cy="42" r="18" fill="${c.fur}" ${line}/>
      <ellipse cx="40" cy="49.5" rx="9.5" ry="7.5" fill="${c.muzzle}"/>
      <circle cx="32.5" cy="39" r="3" fill="${c.eye}"/><circle cx="33.6" cy="37.9" r="1" fill="#ffffff"/>
      <circle cx="47.5" cy="39" r="3" fill="${c.eye}"/><circle cx="48.6" cy="37.9" r="1" fill="#ffffff"/>
      <circle cx="27" cy="48" r="3.2" fill="${c.cheek}" opacity="0.6"/><circle cx="53" cy="48" r="3.2" fill="${c.cheek}" opacity="0.6"/>
      <ellipse cx="40" cy="46" rx="3.8" ry="2.8" fill="${c.nose}"/>
      <path d="M40 48.6v2.2M35.6 51c2.4 2.6 6.4 2.6 8.8 0" fill="none" ${line}/>
      <ellipse cx="20" cy="86" rx="7" ry="6" fill="${c.fur}" ${line}/>
      <g class="ke-cook-spoon">
        <path d="M60 88L69 62" stroke="${c.furDark}" stroke-width="5.4" stroke-linecap="round"/>
        <path d="M60 88L69 62" stroke="${c.spoon}" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="70.5" cy="57" rx="4.6" ry="6.6" transform="rotate(20 70.5 57)" fill="${c.spoon}" stroke="${c.furDark}" stroke-width="2"/>
        <ellipse cx="60" cy="86" rx="7" ry="6" fill="${c.fur}" ${line}/>
      </g>
    </g>
    <g class="ke-cook-hat">
      <path d="M28 27c-8 0-9-12-1-14 0-8 10-10 13-5 3-5 13-3 13 5 8 2 7 14-1 14z" fill="${c.hat}" stroke="${c.furDark}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M34 14c1 3 1 6 0 9M46 14c-1 3-1 6 0 9" fill="none" stroke="${c.hatShade}" stroke-width="2" stroke-linecap="round"/>
      <rect x="27" y="22" width="26" height="8" rx="2.5" fill="${c.hat}" stroke="${c.furDark}" stroke-width="2.2"/>
    </g>
  </svg>`;
}
