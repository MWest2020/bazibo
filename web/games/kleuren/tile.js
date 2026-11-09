// The home tile: a small mandala, already coloured (drawn once at start).
import { pageFor, mandalaKey } from './pages.js';
import { FREE_MANDALAS } from './mandala.js';
import { pageSvg } from './art.js';

const COLOURS = [0, 2, 9, 7, 3, 1, 8, 5, 6, 4];

export function tileMandalaSvg() {
  const { tier, seed } = FREE_MANDALAS[0];
  const page = pageFor(mandalaKey(tier, seed, true));
  const groups = [...new Set(page.regions.map((r) => r.g))];
  const fills = Object.fromEntries(page.regions.map((r) => [r.id, COLOURS[groups.indexOf(r.g) % COLOURS.length]]));
  return pageSvg({ ...page, stroke: 2.2 }, fills, { cls: 'mini-mandala' });
}
