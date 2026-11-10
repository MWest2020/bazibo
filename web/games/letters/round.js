// Letters' rounds, pure (no DOM, no sound) so the tests can play them.
//   tap    hear a letter, tap it among 3-6 tiles
//   first  see a picture and hear its word, tap the letter it starts with
//   build  hear a word, put its letters in order
import { ALPHABET, LETTER_SETS, WORDS, BUILD, firstWords, confusable } from './words.js';

export const MODES = Object.freeze(['tap', 'first', 'build']);
export const TIER_IDS = Object.freeze(['t1', 't2', 't3']);
export const ROUNDS_PER_TIER = 3;
export const ROUND_LEN = Object.freeze({ tap: 8, first: 8, build: 5 });
export const OPTIONS = Object.freeze({ t1: 3, t2: 4, t3: 6 }); // tiles to choose from
export const EXTRA_TILES = Object.freeze({ t1: 0, t2: 0, t3: 2 }); // extra letters when building

/** Stars by mistakes: none 3, one or two 2, more 1. */
export const starsFor = (mistakes) => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);

export function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `n` distinct letters from `pool` without any of `not`. */
function pick(pool, n, not, rand) {
  return shuffle(pool.filter((l) => !not.includes(l)), rand).slice(0, n);
}

/** A sequence of `n` items from `list` with no item twice in a row (and each used before repeats). */
function sequence(list, n, rand) {
  const out = [];
  let bag = [];
  while (out.length < n) {
    if (!bag.length) bag = shuffle(list, rand);
    let k = bag.findIndex((x) => x !== out[out.length - 1]);
    if (k < 0) k = 0;
    out.push(bag.splice(k, 1)[0]);
  }
  return out;
}

/**
 * A round: ROUND_LEN[mode] questions, the same for the same seed.
 *   tap:   { letter, options }
 *   first: { word, letter, options }
 *   build: { word, tiles }
 */
export function makeRound({ mode, tier, lang = 'nl', seed }) {
  const rand = rng(seed);
  const n = ROUND_LEN[mode];
  if (mode === 'tap') {
    const set = LETTER_SETS[tier];
    return sequence(set, n, rand).map((letter) => ({
      letter,
      options: shuffle([letter, ...pick(set.length > OPTIONS[tier] ? set : ALPHABET, OPTIONS[tier] - 1, [letter, ...confusable(lang, letter)], rand)], rand),
    }));
  }
  if (mode === 'first') {
    const words = firstWords(lang, tier).map(([w]) => w);
    return sequence(words, n, rand).map((word) => {
      const letter = word[0];
      // tier 1: only the tier-1 letters around the answer; tier 2: the tier-2 letters and the
      // first letters of its words; tier 3: the alphabet. Never a letter that sounds the same.
      const pool = tier === 't3' ? ALPHABET : tier === 't1' ? LETTER_SETS.t1 : LETTER_SETS.t2.concat(words.map((w) => w[0]));
      const uniq = [...new Set(pool)];
      return { word, letter, options: shuffle([letter, ...pick(uniq, OPTIONS[tier] - 1, [letter, ...confusable(lang, letter)], rand)], rand) };
    });
  }
  const words = (BUILD[lang] || BUILD.nl)[tier];
  return sequence(words, n, rand).map((word) => {
    const letters = word.split('');
    const extra = pick(ALPHABET, EXTRA_TILES[tier], [...letters, ...letters.flatMap((l) => confusable(lang, l))], rand);
    return { word, tiles: shuffle([...word.split(''), ...extra], rand) };
  });
}

/** Building a word: is `letter` right as the next letter? (Repeated letters: any matching tile.) */
export const nextLetterOk = (word, placed, letter) => word[placed.length] === letter;

export { WORDS };
