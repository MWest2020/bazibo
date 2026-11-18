// Letters' rounds, pure (no DOM, no sound) so the tests can play them. Everything is seen, nothing
// is spoken (Mark, 13 Nov 2026: no voice). What makes a tier harder is never the number of tiles
// (Mark, 18 Nov: "3 or 6 letters doesn't matter to a 4-year-old") but what the child must tell
// apart, and how much of the word is given.
//   tap    one big letter: tap the same letter. Tier 1 the same shape with a look-alike among the
//          tiles (m next to n, i next to l), tier 2 a capital to match with its small letter, again
//          with a look-alike, tier 3 mixed cases with two look-alikes, mirrored ones (b/d/p/q, n/u,
//          m/w) for half the round
//   first  a picture with its word below it, the first letter left out ("_oon"): tap that letter
//   middle the same, with a letter inside the word left out ("ma_n"), never the first or last.
//          Tier 1 a vowel in a short word, tier 2 a look-alike among the choices, tier 3 two
//   build  a picture: put the word's letters in order. Tier 1 sees the word for a moment (a tap on
//          the picture shows it again) with one extra tile, tier 2 the picture only with two extra
//          tiles, one a look-alike of a letter in the word, tier 3 two look-alikes, mirrored first
import { ALPHABET, LETTER_SETS, WORDS, BUILD, firstWords, middleWords, middleAlso, confusable, lookalike, similar, caseClash, alsoAWord, LOOKALIKE } from './words.js';

export const MODES = Object.freeze(['tap', 'first', 'middle', 'build']);
export const TIER_IDS = Object.freeze(['t1', 't2', 't3']);
export const ROUNDS_PER_TIER = 3;
export const ROUND_LEN = Object.freeze({ tap: 8, first: 8, middle: 8, build: 5 });
export const OPTIONS = Object.freeze({ t1: 3, t2: 4, t3: 6 }); // tiles to choose from
export const EXTRA_TILES = Object.freeze({ t1: 1, t2: 2, t3: 2 }); // extra letters when building
/** Tap: is the big letter drawn in the tiles' case ('same'), the other case, or a mix per question? */
export const TAP_CASE = Object.freeze({ t1: 'same', t2: 'other', t3: 'mixed' });
/**
 * Look-alike tiles per question (tap and middle) or per word (build's extra tiles): letters that
 * are the same shape mirrored (tier 3, small letters only) or simply look alike (SIMILAR).
 */
export const LOOKALIKES = Object.freeze({
  tap: Object.freeze({ t1: 1, t2: 1, t3: 2 }),
  middle: Object.freeze({ t1: 0, t2: 1, t3: 2 }),
  build: Object.freeze({ t1: 0, t2: 1, t3: 2 }),
});
/** Tap, tier 3: how many questions of a round are letters with a mirrored look-alike. */
export const LOOKALIKE_QS = 4;
/** Build: how the word is shown. ghost: always, faint, to trace; flash: for a moment; none. */
export const BUILD_HINT = Object.freeze({ t1: 'flash', t2: 'none', t3: 'none' });

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
 * Up to `n` look-alikes of `letter` as the tiles draw it, none of `not`. Mirror images (b/d/p/q,
 * n/u, m/w) come first when `mirrors` is on and the tiles are small letters: capital B, D, P and Q
 * are not mirror images of each other.
 */
function lookalikes(letter, n, { upper = false, mirrors = false, not = [] }, rand) {
  if (n <= 0) return [];
  const twins = mirrors && !upper ? pick(lookalike(letter), n, not, rand) : [];
  return [...twins, ...pick(similar(letter, upper), n - twins.length, [...not, ...twins], rand)];
}

/** Every look-alike of `letter`, mirrored or not, in both cases: kept out of the plain choices. */
const allLookalikes = (letter) => [...lookalike(letter), ...similar(letter, false), ...similar(letter, true)];

/**
 * A round: ROUND_LEN[mode] questions, the same for the same seed and capitals option (`upper`: the
 * look-alikes are picked for the case the tiles are drawn in).
 *   tap:    { letter, cross, options }   cross: the big letter is in the other case than the tiles
 *   first:  { word, letter, options }
 *   middle: { word, at, letter, options }   at: the index of the missing letter
 *   build:  { word, hint, tiles }         hint: BUILD_HINT of the tier
 */
export function makeRound({ mode, tier, lang = 'nl', seed, upper = false }) {
  const rand = rng(seed);
  const n = ROUND_LEN[mode];
  const mirrors = tier === 't3';
  if (mode === 'tap') {
    const set = LETTER_SETS[tier];
    let letters;
    if (tier === 't3') {
      const look = Object.keys(LOOKALIKE);
      letters = shuffle([...sequence(look, LOOKALIKE_QS, rand), ...sequence(ALPHABET.filter((l) => !look.includes(l)), n - LOOKALIKE_QS, rand)], rand);
    } else letters = sequence(set, n, rand);
    const crosses = TAP_CASE[tier] === 'mixed' ? shuffle(Array.from({ length: n }, (_, k) => k % 2 === 0), rand) : null;
    return letters.map((letter, k) => {
      const cross = crosses ? crosses[k] : TAP_CASE[tier] === 'other';
      // a capital I is never offered next to a small l when the cases differ: the same stroke
      const clash = cross ? caseClash(letter) : [];
      const twins = lookalikes(letter, LOOKALIKES.tap[tier], { upper, mirrors, not: clash }, rand);
      const pool = set.length > OPTIONS[tier] ? set : ALPHABET;
      const rest = pick(pool, OPTIONS[tier] - 1 - twins.length, [letter, ...allLookalikes(letter), ...clash], rand);
      return { letter, cross, options: shuffle([letter, ...twins, ...rest], rand) };
    });
  }
  if (mode === 'first') {
    const words = firstWords(lang, tier).map(([w]) => w);
    return sequence(words, n, rand).map((word) => {
      const letter = word[0];
      // tiers 1 and 2: the tier's letters and the first letters of its words (so the answer is not
      // the only letter from outside the set); tier 3: the alphabet. Never a letter that sounds the
      // same, and never one that spells another word in the gap (kat: no m for "mat").
      const pool = tier === 't3' ? ALPHABET : LETTER_SETS[tier].concat(words.map((w) => w[0]));
      const uniq = [...new Set(pool)];
      const not = [letter, ...confusable(lang, letter), ...alsoAWord(lang, word)];
      return { word, letter, options: shuffle([letter, ...pick(uniq, OPTIONS[tier] - 1, not, rand)], rand) };
    });
  }
  if (mode === 'middle') {
    const items = middleWords(lang, tier);
    const gaps = Object.fromEntries(items);
    return sequence(items.map(([w]) => w), n, rand).map((word) => {
      const at = gaps[word][Math.floor(rand() * gaps[word].length)];
      const letter = word[at];
      // never a letter that sounds the same or that spells another word in the gap (k_t: no i for
      // "kit"); from tier 2 on, look-alikes of the missing letter among the choices
      const not = [letter, ...confusable(lang, letter), ...middleAlso(lang, word, at)];
      const twins = lookalikes(letter, LOOKALIKES.middle[tier], { upper, mirrors, not }, rand);
      const pool = tier === 't3' ? ALPHABET : [...new Set(LETTER_SETS[tier].concat(items.flatMap(([w, ks]) => ks.map((k) => w[k]))))];
      const rest = pick(pool, OPTIONS[tier] - 1 - twins.length, [...not, ...twins, ...allLookalikes(letter)], rand);
      return { word, at, letter, options: shuffle([letter, ...twins, ...rest], rand) };
    });
  }
  const words = (BUILD[lang] || BUILD.nl)[tier];
  return sequence(words, n, rand).map((word) => {
    const letters = word.split('');
    // extra tiles: never a letter of the word or one that sounds like one; from tier 2 on some are
    // look-alikes of the word's letters (a d next to "bal", mirrored first in tier 3)
    const not = [...letters, ...letters.flatMap((l) => confusable(lang, l))];
    const want = LOOKALIKES.build[tier];
    const mirrored = mirrors && !upper ? [...new Set(letters.flatMap(lookalike))].filter((x) => !not.includes(x)) : [];
    const shaped = [...new Set(letters.flatMap((l) => similar(l, upper)))].filter((x) => !not.includes(x));
    const twins = pick(mirrored, Math.min(1, want), [], rand); // tier 3: one mirrored letter first
    twins.push(...pick([...new Set([...shaped, ...mirrored])], want - twins.length, twins, rand));
    const extra = [...twins, ...pick(ALPHABET, EXTRA_TILES[tier] - twins.length, [...not, ...twins, ...letters.flatMap(allLookalikes)], rand)];
    return { word, hint: BUILD_HINT[tier], tiles: shuffle([...letters, ...extra], rand) };
  });
}

/**
 * How a tap question is drawn: the big letter and the tiles. The tiles follow the player's case
 * option (`upper`); a cross question draws the big letter in the other case.
 */
export function tapGlyphs(q, upper = false) {
  const tile = (l) => (upper ? l.toUpperCase() : l);
  const other = (l) => (upper ? l : l.toUpperCase());
  return { big: q.cross ? other(q.letter) : tile(q.letter), tiles: q.options.map(tile) };
}

/** First letter: the word with its first letter left out, as [gap, rest] ("_", "oon"). */
export const gapped = (word) => ['_', word.slice(1)];

/** First or middle letter: the word around its gap, as [before, after] ("m", "an" for "ma_n"). */
export const around = (word, at = 0) => [word.slice(0, at), word.slice(at + 1)];

/** Building a word: is `letter` right as the next letter? (Repeated letters: any matching tile.) */
export const nextLetterOk = (word, placed, letter) => word[placed.length] === letter;

export { WORDS };
