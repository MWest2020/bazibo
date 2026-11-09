// Every colouring page has a key, which is also its key in the save:
//   p:<picture id>        a picture for the youngest (pictures.js)
//   f:<tier>:<seed>       one of the free mandalas (FREE_MANDALAS)
//   m:<tier>:<seed>       a new mandala made in the full version (endless; the save keeps the last 30)
// pageFor(key) turns a key into what the screen draws.
import { PICTURES, FREE_PICTURES } from './pictures.js';
import { makeMandala, groupOf, MANDALA_TIERS, FREE_MANDALAS } from './mandala.js';

export const pictureKey = (id) => `p:${id}`;
export const mandalaKey = (tier, seed, free = false) => `${free ? 'f' : 'm'}:${tier}:${seed}`;
export const FREE_MANDALA_KEYS = FREE_MANDALAS.map((m) => mandalaKey(m.tier, m.seed, true));

const cache = new Map(); // mandalas are made once per session

/** Parse a key; null when it is not one of ours. */
export function parseKey(key) {
  const m = /^(p):([a-z]+)$|^([fm]):(m[12]):(\d{1,10})$/.exec(String(key));
  if (!m) return null;
  if (m[1]) {
    const index = PICTURES.findIndex((p) => p.id === m[2]);
    return index < 0 ? null : { kind: 'picture', id: m[2], index };
  }
  const seed = Number(m[5]);
  if (!Number.isSafeInteger(seed)) return null;
  const free = m[3] === 'f';
  if (free && !FREE_MANDALAS.some((x) => x.tier === m[4] && x.seed === seed)) return null;
  return { kind: 'mandala', tier: m[4], seed, free };
}

/** What the screen draws for `key`: { key, kind, regions, deco, viewBox, stroke, ... }, or null. */
export function pageFor(key) {
  const k = parseKey(key);
  if (!k) return null;
  if (k.kind === 'picture') {
    const p = PICTURES[k.index];
    return { key, kind: 'picture', id: p.id, name: p.name, index: k.index, free: k.index < FREE_PICTURES, regions: p.regions, deco: p.deco, viewBox: '0 0 200 200', stroke: 3 };
  }
  const id = `${k.tier}:${k.seed}`;
  if (!cache.has(id)) cache.set(id, makeMandala(k.tier, k.seed));
  const m = cache.get(id);
  return { key, kind: 'mandala', tier: k.tier, seed: k.seed, free: k.free, random: !k.free, mandala: m, regions: m.regions, deco: '', viewBox: '-100 -100 200 200', stroke: k.tier === 'm1' ? 1.5 : 1.15, symmetry: MANDALA_TIERS[k.tier].symmetry };
}

/** The region ids a tap on `id` colours: just `id`, or all its copies when `mirror` is on (mandalas). */
export function targets(page, id, mirror) {
  if (!page.regions.some((r) => r.id === id)) return [];
  return page.kind === 'mandala' && mirror ? groupOf(page.mandala, id) : [id];
}

/** Every page key in the list order: the pictures, then the free mandalas. */
export const LIST_KEYS = [...PICTURES.map((p) => pictureKey(p.id)), ...FREE_MANDALA_KEYS];
