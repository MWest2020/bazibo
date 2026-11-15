// Legpuzzel's home-screen tile: four jigsaw pieces of the garden picture, one lifted out.
import { piecePath, margin } from './rules.js';
import { pictureSvg } from './pictures.js';

export function tileSvg() {
  const s = 40;
  const m = margin(s);
  const scene = pictureSvg('garden', 2 * s, 2 * s).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const sides = [
    { top: 0, right: 1, bottom: -1, left: 0 },
    { top: 0, right: 0, bottom: 1, left: -1 },
    { top: 1, right: -1, bottom: 0, left: 0 },
    { top: -1, right: 0, bottom: 0, left: 1 },
  ];
  const piece = (i, dx, dy) => {
    const c = i % 2;
    const r = Math.floor(i / 2);
    const d = piecePath(sides[i], s, m);
    return (
      `<g transform="translate(${c * s - m + dx} ${r * s - m + dy})">` +
      `<clipPath id="tile-puzzel-${i}"><path d="${d}"/></clipPath>` +
      `<g clip-path="url(#tile-puzzel-${i})"><g transform="translate(${m - c * s} ${m - r * s})">${scene}</g></g>` +
      `<path d="${d}" fill="none" stroke="#fff" stroke-width="2.4"/><path d="${d}" fill="none" stroke="#3a2f6b" stroke-width="1"/></g>`
    );
  };
  return `<svg viewBox="-14 -14 110 110" aria-hidden="true">${piece(0, 0, 0)}${piece(1, 0, 0)}${piece(2, 0, 0)}${piece(3, 12, 10)}</svg>`;
}
