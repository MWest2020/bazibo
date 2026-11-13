// Letters' rounds, pure (no DOM, no sound) so the tests can play them. Everything is seen, nothing
// is spoken.
//   tap    one big letter: tap the same letter among 3-6 tiles. Tier 1 the same shape, tier 2 a
//          capital to match with its small letter, tier 3 mixed, with a mirrored look-alike (b/d)
//   first  a picture with its word below it, the first letter left out ("_oon"): tap that letter
//   build  a picture: put the word's letters in order. Tier 1 traces a faint word, tier 2 sees the
//          word for a moment (a tap on the picture shows it again), tier 3 has the picture only
import { ALPHABET, LETTER_SETS, WORDS, BUILD, firstWords, confusable, lookalike, caseClash, alsoAWord, LOOKALIKE } from './words.js';

export const MODES = Object.freeze(['tap', 'first', 'build']);
export const TIER_IDS = Object.freeze(['t1', 't2', 't3']);
export const ROUNDS_PER_TIER = 3;
export const ROUND_LEN = Object.freeze({ tap: 8, first: 8, build: 5 });
export const OPTIONS = Object.freeze({ t1: 3, t2: 4, t3: 6 }); // tiles to choose from
export const EXTRA_TILES = Object.freeze({ t1: 0, t2: 0, t3: 2 }); // extra letters when building
/** Tap: is the big letter drawn in the tiles' case ('same'), the other case, or a mix per question? */
export const TAP_CASE = Object.freeze({ t1: 'same', t2: 'other', t3: 'mixed' });
/** Tap, tier 3: how many questions of a round are letters with a mirrored look-alike. */
export const LOOKALIKE_QS = 3;
/** Build: how the word is shown. ghost: always, faint, to trace; flash: for a moment; none. */
export const BUILD_HINT = Object.freeze({ t1: 'ghost', t2: 'flash', t3: 'none' });

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
 * A round: ROUND_LEN[mode] questions, the same for the same seed (and capitals option: with
 * capitals on, tap's tier 3 adds no mirrored twin, since capital B, D, P and Q are not mirrors).
 *   tap:   { letter, cross, options }   cross: the big letter is in the other case than the tiles
 *   first: { word, letter, options }
 *   build: { word, hint, tiles }         hint: BUILD_HINT of the tier
 */
export function makeRound({ mode, tier, lang = 'nl', seed, upper = false }) {
  const rand = rng(seed);
  const n = ROUND_LEN[mode];
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
      const pool = set.length > OPTIONS[tier] ? set : ALPHABET;
      const not = [letter, ...lookalike(letter), ...(cross ? caseClash(letter) : [])];
      // the mirrored twin only when the tiles are small letters: B/D/P/Q are not mirror images
      const twin = tier === 't3' && !upper && lookalike(letter).length ? [pick(lookalike(letter), 1, [], rand)[0]] : [];
      const rest = pick(pool, OPTIONS[tier] - 1 - twin.length, not, rand);
      return { letter, cross, options: shuffle([letter, ...twin, ...rest], rand) };
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
  const words = (BUILD[lang] || BUILD.nl)[tier];
  return sequence(words, n, rand).map((word) => {
    const letters = word.split('');
    // tier 3's extra letters may be mirror letters (a d next to "bal"): on purpose, as in tap
    const extra = pick(ALPHABET, EXTRA_TILES[tier], [...letters, ...letters.flatMap((l) => confusable(lang, l))], rand);
    return { word, hint: BUILD_HINT[tier], tiles: shuffle([...word.split(''), ...extra], rand) };
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

/** Building a word: is `letter` right as the next letter? (Repeated letters: any matching tile.) */
export const nextLetterOk = (word, placed, letter) => word[placed.length] === letter;

export { WORDS };
