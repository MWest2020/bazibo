// Random rounds for Slangetje's full version: a new layout per mode and age tier, from a 32-bit
// seed. Everything is drawn from the same ranges the fixed levels (levels.json) use, and the walls
// of the oldest tier reuse the fixed levels' wall layouts, which are tested for a safe start and
// no walled-off pockets in both orientations and on compact boards.
import { MODES, WORDS } from './rules.js';

export const RANDOM_TIERS = Object.freeze(['tiny', 'small', 'big']);

const SIZE = { tiny: [9, 11], small: [11, 13], big: [13, 16] };
const SPEED = { tiny: [2.2, 2.6], small: [3.2, 3.8], big: [4.4, 5.2] };
// The fixed levels' wall layouts (upright board), and whether the edges may wrap with them.
export const WALL_LAYOUTS = Object.freeze([
  Object.freeze({ walls: [[2, 2], [2, 3], [3, 2], [2, 10], [2, 9], [3, 10], [13, 2], [13, 3], [12, 2], [13, 10], [13, 9], [12, 10]], wrapOk: true }),
  Object.freeze({ walls: [[4, 2], [4, 3], [4, 4], [4, 8], [4, 9], [4, 10], [12, 2], [12, 3], [12, 4], [12, 8], [12, 9], [12, 10]], wrapOk: false }),
]);
const WORDS_BY_TIER = {
  tiny: ['egg', 'sun', 'ball'],
  small: ['fish', 'dog', 'pear', 'sun', 'apple', 'ball', 'egg'],
  big: Object.keys(WORDS),
};
const MAX_LETTERS = { tiny: 4, small: 8, big: 13 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi, rand) => lo + Math.floor(rand() * (hi - lo + 1));
const longest = (w) => Math.max(WORDS[w].nl.length, WORDS[w].en.length);

function words(tier, rand) {
  const want = tier === 'tiny' ? 1 : tier === 'small' ? between(1, 2, rand) : between(1, 3, rand);
  const out = [];
  let letters = 0;
  for (let tries = 0; tries < 40 && out.length < want; tries++) {
    const w = pick(WORDS_BY_TIER[tier], rand);
    if (out.includes(w) || letters + longest(w) > MAX_LETTERS[tier]) continue;
    out.push(w);
    letters += longest(w);
  }
  return out.length ? out : [WORDS_BY_TIER[tier][0]];
}

function counting(tier, rand) {
  if (tier === 'tiny') return { from: 1, to: between(3, 5, rand) };
  if (tier === 'small') return { from: 1, to: between(6, 10, rand) };
  const kind = between(0, 2, rand);
  if (kind === 1) return { from: 2, to: 20, step: 2 };
  if (kind === 2) return { from: 10, to: 1, step: -1 };
  return { from: 1, to: between(10, 20, rand) };
}

function colours(tier, rand) {
  if (tier === 'tiny') return { palette: 3, eat: between(4, 5, rand), switchEvery: 0 };
  if (tier === 'small') return { palette: between(4, 5, rand), eat: between(6, 8, rand), switchEvery: pick([0, 3, 4], rand) };
  return { palette: between(5, 6, rand), eat: between(8, 12, rand), switchEvery: between(2, 3, rand) };
}

/** One random round for a mode ('count', 'letters', 'colors') and a tier ('tiny', 'small', 'big'). */
export function randomLevel(mode, tier, seed) {
  if (!MODES.includes(mode)) throw new Error(`unknown mode ${mode}`);
  if (!RANDOM_TIERS.includes(tier)) throw new Error(`unknown tier ${tier}`);
  const rand = mulberry32(seed);
  const [lo, hi] = SPEED[tier];
  const speed = Math.round((lo + rand() * (hi - lo)) * 10) / 10;
  const level = { id: `r-${mode}-${tier}-${seed >>> 0}`, mode, tier, size: SIZE[tier].slice(), speed, free: false, seed: seed >>> 0 };
  if (mode === 'count') Object.assign(level, counting(tier, rand));
  else if (mode === 'letters') level.words = words(tier, rand);
  else Object.assign(level, colours(tier, rand));
  if (tier === 'big') {
    const layout = between(0, 2, rand); // 0: open board, 1-2: one of the fixed wall layouts
    if (layout > 0) {
      const { walls, wrapOk } = WALL_LAYOUTS[layout - 1];
      level.walls = walls.map((w) => w.slice());
      if (wrapOk && rand() < 0.5) level.wrap = true;
    } else if (rand() < 0.5) level.wrap = true;
  }
  return level;
}
