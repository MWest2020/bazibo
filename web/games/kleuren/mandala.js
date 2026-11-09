// Mandalas for the colouring game, made in code from a seed: the same seed always gives the same
// mandala. A mandala is rings of shapes around a centre, repeated k times around the circle
// (rotational symmetry). Every shape is one closed path ("region") that a tap colours. Shapes are
// layered (a ring's background wedges first, its petals and dots on top), so no shape needs to be
// cut out of another: the one on top is the one that is tapped and seen.
//
// A region: { id, d, g } where g is its symmetry group: the same shape in every one of the k copies
// shares a group, so "colour all copies" fills the whole group at once.
//
// Every part that shows must be big enough to tap and to see: after building, the mandala is
// rasterised (raster.js) and a group of shapes that shows less than MIN_AREA is taken out (a shape
// that is small itself), or the shapes that cover it are (a background left as a sliver). Taking
// out whole groups keeps the symmetry.
import { visibleAreas, maskOf, rasterize } from './raster.js';

/** Mandala tiers: m1 for ages 7-8 (fewer, larger shapes), m2 for ages 9-10. */
export const MANDALA_TIERS = Object.freeze({
  // minArea: the least a part may show, in square units of the 200-unit drawing. m1 is tapped at
  // phone size (a 390 px phone shows the page about 366 px wide: 12 px is 6.6 units); m2 is
  // meant to be zoomed in on (2.2×: 12 px is 3 units). minDot: the smallest dot radius.
  m1: Object.freeze({ age: 7, folds: [6, 8], bands: [3, 4], regions: [24, 160], symmetry: true, minArea: 43, minDot: 3.8 }),
  m2: Object.freeze({ age: 9, folds: [8, 10, 12], bands: [5, 6], regions: [50, 340], symmetry: false, minArea: 9, minDot: 2 }),
});

/** The free mandalas: fixed seeds, the same for everyone. */
export const FREE_MANDALAS = Object.freeze([
  Object.freeze({ tier: 'm1', seed: 1101 }),
  Object.freeze({ tier: 'm1', seed: 2207 }),
  Object.freeze({ tier: 'm2', seed: 3313 }),
]);

/** A small seeded random generator (mulberry32): a function returning numbers in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = 96; // the outer radius; the drawing spans -100..100
const f = (n) => Math.round(n * 100) / 100;
const pt = (r, a) => `${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`;

/** An annulus sector from angle a1 to a2 between radii r1 < r2 (r1 may be 0: a pie slice). */
export function sector(r1, r2, a1, a2) {
  const large = a2 - a1 > Math.PI ? 1 : 0;
  if (r1 <= 0) return `M0 0L${pt(r2, a1)}A${f(r2)} ${f(r2)} 0 ${large} 1 ${pt(r2, a2)}Z`;
  return `M${pt(r1, a1)}L${pt(r2, a1)}A${f(r2)} ${f(r2)} 0 ${large} 1 ${pt(r2, a2)}L${pt(r1, a2)}A${f(r1)} ${f(r1)} 0 ${large} 0 ${pt(r1, a1)}Z`;
}

/** A pointed petal (a lens) from radius r1 to r2 along angle a, w radians wide at its middle. */
export function petal(r1, r2, a, w) {
  const m = (r1 + r2) / 2;
  const reach = m / Math.cos(w); // the control points sit a little further out, so the petal is full
  return `M${pt(r1, a)}Q${pt(reach, a + w)} ${pt(r2, a)}Q${pt(reach, a - w)} ${pt(r1, a)}Z`;
}

/** A drop: pointed at r1, round at r2, w radians wide at its widest. */
export function drop(r1, r2, a, w) {
  const hr = Math.min((r2 - r1) * 0.32, r2 * Math.sin(w)); // the round head
  const hc = r2 - hr; // its centre's radius
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const at = (along, across) => `${f(along * ca - across * sa)} ${f(along * sa + across * ca)}`; // along the ray, across it
  return `M${at(r1, 0)}C${at(r1 + (hc - r1) * 0.55, hr * 0.35)} ${at(hc - hr * 0.4, hr * 1.05)} ${at(hc, hr)}` +
    `A${f(hr)} ${f(hr)} 0 0 0 ${at(hc, -hr)}` +
    `C${at(hc - hr * 0.4, -hr * 1.05)} ${at(r1 + (hc - r1) * 0.55, -hr * 0.35)} ${at(r1, 0)}Z`;
}

/** A circle of radius s around the point at radius r, angle a. */
export function dot(r, a, s) {
  const cx = f(r * Math.cos(a));
  const cy = f(r * Math.sin(a));
  return `M${f(cx - s)} ${cy}A${f(s)} ${f(s)} 0 1 0 ${f(cx + s)} ${cy}A${f(s)} ${f(s)} 0 1 0 ${f(cx - s)} ${cy}Z`;
}

/** A sector whose outer edge is a shallow round bump (a scallop) that just reaches r2. */
export function scallop(r1, r2, a1, a2) {
  const h = Math.min((r2 - r1) * 0.45, r2 * (a2 - a1) * 0.28); // how far the bump stands out
  const base = r2 - h;
  const c = 2 * base * Math.sin((a2 - a1) / 2); // the chord between the bump's ends
  const br = f((c * c) / 4 / (2 * h) + h / 2); // the circle through both ends and the top
  return `M${pt(r1, a1)}L${pt(base, a1)}A${br} ${br} 0 0 1 ${pt(base, a2)}L${pt(r1, a2)}A${f(r1)} ${f(r1)} 0 0 0 ${pt(r1, a1)}Z`;
}

/** A dot's radius: what the design wants, at least minDot, and 0 (no dots) when that does not fit in `room`. */
const dotSize = (want, room, minDot) => {
  const r = Math.max(want, minDot);
  return r <= room ? r : 0;
};

/** Pick one element of a list. */
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// The ring designs. Each fills the band r1..r2 with k copies; `push(part, j, d)` adds a region.
const BANDS = {
  // plain wedges with a petal on top of every wedge
  petals(push, k, r1, r2, step, off, rand) {
    const w = step * (0.32 + rand() * 0.1);
    for (let j = 0; j < k; j++) push('w', j, sector(r1, r2, off + j * step, off + (j + 1) * step));
    for (let j = 0; j < k; j++) push('p', j, petal(r1 + 1, r2 - 1, off + (j + 0.5) * step, w));
  },
  // two rings of petals, the second between the first: a woven look
  lattice(push, k, r1, r2, step, off, rand) {
    const w = step * (0.4 + rand() * 0.08);
    for (let j = 0; j < k; j++) push('w', j, sector(r1, r2, off + j * step, off + (j + 1) * step));
    for (let j = 0; j < k; j++) push('p', j, petal(r1 + 1, r2 - 1, off + j * step, w));
    for (let j = 0; j < k; j++) push('q', j, petal(r1 + (r2 - r1) * 0.25, r2 - 1, off + (j + 0.5) * step, w * 0.62));
  },
  // scalloped edge with a dot in every scallop
  scallops(push, k, r1, r2, step, off, rand, minDot) {
    const n = rand() < 0.5 ? k : 2 * k; // one or two scallops per copy
    const s = (2 * Math.PI) / n;
    // the band's own background first, so the corners between the bumps can be coloured too
    for (let j = 0; j < k; j++) push('w', j, sector(r1, r2, off + j * step, off + (j + 1) * step));
    for (let j = 0; j < n; j++) push(n === k ? 's' : j % 2 ? 't' : 's', n === k ? j : Math.floor(j / 2), scallop(r1, r2, off + j * s, off + (j + 1) * s));
    const size = dotSize(Math.min((r2 - r1) * 0.2, ((r1 + r2) / 2) * s * 0.22), Math.min((r2 - r1) * 0.3, ((r1 + r2) / 2) * s * 0.3), minDot);
    if (size) for (let j = 0; j < n; j++) push(n === k ? 'd' : j % 2 ? 'e' : 'd', n === k ? j : Math.floor(j / 2), dot(r1 + (r2 - r1) * 0.42, off + (j + 0.5) * s, size));
  },
  // drops pointing outwards, with dots between them
  drops(push, k, r1, r2, step, off, rand, minDot) {
    const w = step * (0.26 + rand() * 0.05);
    for (let j = 0; j < k; j++) push('w', j, sector(r1, r2, off + j * step, off + (j + 1) * step));
    for (let j = 0; j < k; j++) push('p', j, drop(r1 + 1.5, r2 - 1.5, off + (j + 0.5) * step, w));
    const size = dotSize(Math.min((r2 - r1) * 0.13, r2 * step * 0.09), Math.min((r2 - r1) * 0.2, r2 * step * 0.16), minDot);
    if (size) for (let j = 0; j < k; j++) push('d', j, dot(r2 - (r2 - r1) * 0.28, off + j * step, size));
  },
  // a band of small wedges, two per copy, like a chequered ribbon
  checks(push, k, r1, r2, step, off) {
    const m = (r1 + r2) / 2;
    for (let j = 0; j < k; j++) {
      const a = off + j * step;
      push('a', j, sector(r1, m, a, a + step / 2));
      push('b', j, sector(r1, m, a + step / 2, a + step));
      push('c', j, sector(m, r2, a, a + step / 2));
      push('e', j, sector(m, r2, a + step / 2, a + step));
    }
  },
};
const BAND_KINDS = Object.keys(BANDS);

/**
 * The mandala for `seed` in tier `tier`: { tier, seed, folds, regions: [{ id, d, g }] }.
 * Deterministic: the same seed and tier always give the same mandala.
 */
export function makeMandala(tier, seed) {
  const spec = MANDALA_TIERS[tier];
  if (!spec) throw new Error(`unknown mandala tier ${tier}`);
  const rand = rng(seed * 31 + (tier === 'm2' ? 7 : 3));
  const k = pick(rand, spec.folds);
  const nb = pick(rand, spec.bands);
  const step = (2 * Math.PI) / k;
  const r0 = tier === 'm1' ? 18 + rand() * 4 : 13 + rand() * 4; // the centre
  // band edges from r0 to R, a little uneven so not every mandala looks alike
  const weights = Array.from({ length: nb }, () => 0.8 + rand() * 0.5);
  const sum = weights.reduce((a, b) => a + b, 0);
  const edges = [r0];
  for (const w of weights) edges.push(edges[edges.length - 1] + ((R - r0) * w) / sum);
  edges[edges.length - 1] = R;
  const regions = [];
  const push = (prefix) => (part, j, d) => regions.push({ id: `${prefix}${part}${j}`, d, g: `${prefix}${part}` });
  // the centre: a disc with a small flower on top (few petals, so they stay big enough to tap)
  regions.push({ id: 'c0', d: dot(0, 0, r0), g: 'c0' });
  const cp = k > (tier === 'm1' ? 6 : 8) ? k / 2 : k;
  const cstep = (2 * Math.PI) / cp;
  for (let j = 0; j < cp; j++) push('c')('p', j, petal(r0 * 0.18, r0 * 0.92, j * cstep - Math.PI / 2, Math.min(cstep * 0.4, 0.55)));
  regions.push({ id: 'c1', d: dot(0, 0, Math.max(r0 * 0.24, spec.minDot)), g: 'c1' });
  let last = '';
  for (let b = 0; b < nb; b++) {
    let kind = pick(rand, BAND_KINDS);
    if (kind === last) kind = BAND_KINDS[(BAND_KINDS.indexOf(kind) + 1) % BAND_KINDS.length]; // no two alike in a row
    last = kind;
    const off = -Math.PI / 2 + (b % 2 ? step / 2 : 0); // every other ring turned half a step
    BANDS[kind](push(`b${b}`), k, edges[b], edges[b + 1], step, off, rand, spec.minDot);
  }
  return { tier, seed, folds: k, regions: prune(regions, spec.minArea) };
}

/**
 * Take out groups until every part that shows shows at least `minArea` (and nothing is fully
 * hidden). A group that is small itself goes; a group that is big but mostly covered keeps its
 * place and the group covering it most goes instead, so no uncolourable sliver is left behind.
 */
export function prune(regions, minArea, res = 0.5) {
  let list = regions;
  for (let pass = 0; pass < 40; pass++) {
    const vis = visibleAreas(list, { res });
    const groups = new Map();
    list.forEach((r, i) => groups.set(r.g, [...(groups.get(r.g) || []), i]));
    let worst = null;
    for (const [g, idx] of groups) {
      const v = Math.min(...idx.map((i) => vis[i]));
      if (v < minArea && (!worst || v < worst.v)) worst = { g, idx, v };
    }
    if (!worst) return list;
    let drop = worst.g;
    const first = worst.idx[0];
    const own = maskOf(list[first].d, { res });
    const ownArea = own.reduce((a, b) => a + b, 0) * res * res;
    if (worst.v > 0 && ownArea >= minArea * 1.5) {
      // a big shape shown as a sliver: take out what covers it most
      const { top } = rasterize(list, { res });
      const cover = new Map();
      for (let c = 0; c < own.length; c++) {
        if (own[c] && top[c] !== first && top[c] >= 0 && list[top[c]].g !== worst.g) cover.set(list[top[c]].g, (cover.get(list[top[c]].g) || 0) + 1);
      }
      let best = 0;
      for (const [g, n] of cover) if (n > best) [best, drop] = [n, g];
    }
    list = list.filter((r) => r.g !== drop);
  }
  return list;
}

/** The regions of the same group as `id` (its copies around the circle), for "colour all copies". */
export function groupOf(mandala, id) {
  const r = mandala.regions.find((x) => x.id === id);
  return r ? mandala.regions.filter((x) => x.g === r.g).map((x) => x.id) : [];
}
