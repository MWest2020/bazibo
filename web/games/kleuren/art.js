// Drawing a colouring page as SVG: the regions (filled from the saved colours, white when empty),
// the outlines, and the details on top. The same function draws the big page and the thumbnails.
import { INK } from './pictures.js';

/** The palette: friendly colours, three skin tones, and white last (white = empty, the eraser). */
export const PALETTE = Object.freeze([
  '#e5484d', // red
  '#ff8a3d', // orange
  '#ffd23f', // yellow
  '#9be15d', // light green
  '#2fae5b', // green
  '#2ec4b6', // teal
  '#7cc6fe', // light blue
  '#3a6fe8', // blue
  '#8e5bd6', // purple
  '#ff8fc7', // pink
  '#a0643b', // brown
  '#f6d0b1', // skin, light
  '#c98b5e', // skin, medium
  '#6b4428', // skin, dark
  '#3b3b4a', // almost black
  '#ffffff', // white: makes a part empty again
]);
export const WHITE = PALETTE.length - 1;

/** The colour names, for screen readers (in strings.js as kleur.colour.<i>). */
export const COLOUR_KEYS = PALETTE.map((_, i) => `kleur.colour.${i}`);

/**
 * The SVG for a page. `page`: { regions: [{id, d}], deco?, viewBox, stroke }. `fills`: region id ->
 * palette index. `live`: the big page (regions get data-r so taps find them) or a thumbnail.
 */
export function pageSvg(page, fills = {}, { live = false, cls = '' } = {}) {
  const paths = page.regions
    .map((r) => {
      const c = fills[r.id];
      const fill = Number.isInteger(c) && PALETTE[c] ? PALETTE[c] : '#ffffff';
      return `<path${live ? ` data-r="${r.id}"` : ''} d="${r.d}" fill="${fill}"/>`;
    })
    .join('');
  const deco = page.deco ? `<g class="kleur-deco" pointer-events="none">${page.deco}</g>` : '';
  return (
    `<svg class="${cls}" viewBox="${page.viewBox}" aria-hidden="true">` +
    `<g stroke="${INK}" stroke-width="${page.stroke}" stroke-linejoin="round" stroke-linecap="round">${paths}</g>${deco}</svg>`
  );
}

// tool icons (24×24)
export const ICONS = {
  undo: '<path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  restart:
    '<path d="M5 12a7 7 0 1 0 2.2-5.1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M4.5 3.5v4.5H9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  mirror:
    '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  done: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  brush:
    '<path d="M14.5 3.5 20.5 9.5 11 19c-1.6 1.6-4.2 1.6-5.8 0l-.2-.2c-1.6-1.6-1.6-4.2 0-5.8z" fill="#ffd23f" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 19c-.8 1.6-2 2-3 2 0-1 .4-2.2 2-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};
