// Letters' words and letters. Every word has a picture (art.js), shared by both languages.
// Lowercase throughout: Dutch schools start with lowercase letters. The capitals option and the
// case-matching rounds only change how the letters are drawn.

export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** Letters by tier: the first two sets are the letters children meet first, then the rest. */
export const LETTER_SETS = Object.freeze({
  t1: ['a', 'i', 'o', 'm', 's', 'k'],
  t2: ['a', 'i', 'o', 'm', 's', 'k', 'b', 'd', 'e', 'p', 'r', 't'],
  t3: ALPHABET,
});

/**
 * [word, picture] per language. The picture names one drawing in art.js, shared by both languages
 * (the Dutch "hond" and the English "dog" are the same puppy).
 */
export const WORDS = Object.freeze({
  nl: [
    ['zon', 'sun'], ['huis', 'house'], ['vis', 'fish'], ['bloem', 'flower'], ['hond', 'dog'],
    ['auto', 'car'], ['kat', 'cat'], ['vogel', 'bird'], ['boot', 'boat'], ['schildpad', 'turtle'],
    ['olifant', 'elephant'], ['raket', 'rocket'], ['appel', 'apple'], ['banaan', 'banana'],
    ['druiven', 'grapes'], ['wortel', 'carrot'], ['peer', 'pear'], ['paddenstoel', 'mushroom'],
    ['bal', 'ball'],
  ],
  en: [
    ['sun', 'sun'], ['house', 'house'], ['fish', 'fish'], ['flower', 'flower'], ['dog', 'dog'],
    ['car', 'car'], ['cat', 'cat'], ['bird', 'bird'], ['boat', 'boat'], ['tortoise', 'turtle'],
    ['elephant', 'elephant'], ['rocket', 'rocket'], ['apple', 'apple'], ['banana', 'banana'],
    ['grapes', 'grapes'], ['carrot', 'carrot'], ['pear', 'pear'], ['mushroom', 'mushroom'],
    ['ball', 'ball'],
  ],
});

/**
 * Words to build letter by letter: short and as regular as the pictures allow. Tier 1 has three
 * letters only. Not every word is spelled the way it sounds: English "car" (an r-controlled vowel)
 * is kept because it is one of only four three-letter words with a picture; "bird" and "pear" were
 * left out for that reason. Dutch "auto" (au) is left out too.
 */
export const BUILD = Object.freeze({
  nl: { t1: ['zon', 'vis', 'kat', 'bal'], t2: ['zon', 'vis', 'kat', 'bal', 'huis', 'boot', 'hond', 'peer'] },
  en: { t1: ['sun', 'cat', 'dog', 'car'], t2: ['sun', 'cat', 'dog', 'car', 'fish', 'boat', 'ball'] },
});
BUILD.nl.t3 = BUILD.nl.t2;
BUILD.en.t3 = BUILD.en.t2;

/**
 * Letters that sound alike at the start of a word, per language. In "first letter" they are never
 * offered as a wrong choice next to each other: "cat" starts with a sound a child could fairly
 * write as k, and Dutch v/f and z/s are hard to hear apart.
 */
export const CONFUSABLE = Object.freeze({
  nl: { k: ['c', 'q'], c: ['k', 's'], q: ['k'], v: ['f'], f: ['v'], z: ['s'], s: ['z', 'c'] },
  en: { c: ['k', 's'], k: ['c'], s: ['c'] },
});
export const confusable = (lang, letter) => (CONFUSABLE[lang] || CONFUSABLE.nl)[letter] || [];

/**
 * Small letters that are the same shape turned or mirrored. "Tap the letter" in tier 3 puts one of
 * them next to the answer on purpose: telling b from d is part of learning them.
 */
export const LOOKALIKE = Object.freeze({
  b: ['d', 'p', 'q'], d: ['b', 'q', 'p'], p: ['q', 'b', 'd'], q: ['p', 'd', 'b'],
  n: ['u'], u: ['n'], m: ['w'], w: ['m'],
});
export const lookalike = (letter) => LOOKALIKE[letter] || [];

/**
 * Letters that cannot be told apart once one is a capital and the other is not: a capital I and a
 * small l are the same stroke in most fonts. Never offered together when the cases differ.
 */
const CASE_CLASH = Object.freeze({ i: ['l'], l: ['i'] });
export const caseClash = (letter) => CASE_CLASH[letter] || [];

/**
 * "First letter": other common words a wrong letter in the gap would spell (kat -> mat). Those
 * letters are never offered for that word, or a wrong tap would be a fair answer. Every listed
 * word differs from its key in the first letter only (tested).
 */
export const ALSO_A_WORD = Object.freeze({
  nl: {
    zon: ['bon', 'kon', 'ton', 'won'],
    huis: ['muis', 'luis', 'buis', 'ruis'],
    hond: ['mond', 'bond', 'rond', 'pond'],
    kat: ['mat', 'lat', 'rat', 'zat', 'wat', 'nat', 'gat', 'vat', 'dat', 'pat'],
    vogel: ['kogel'],
    boot: ['noot', 'poot', 'goot', 'loot'],
    peer: ['beer', 'meer', 'veer', 'keer', 'heer', 'weer', 'teer', 'leer'],
    bal: ['aal', 'dal', 'mal', 'val', 'zal', 'wal', 'hal', 'pal'],
  },
  en: {
    sun: ['bun', 'fun', 'gun', 'nun', 'run', 'pun'],
    house: ['mouse', 'louse', 'rouse'],
    fish: ['dish', 'wish'],
    flower: ['glower', 'slower'],
    dog: ['log', 'fog', 'hog', 'jog', 'bog', 'cog'],
    car: ['bar', 'ear', 'far', 'jar', 'mar', 'oar', 'par', 'tar', 'war'],
    cat: ['bat', 'eat', 'fat', 'hat', 'mat', 'oat', 'pat', 'rat', 'sat', 'vat'],
    boat: ['coat', 'goat', 'moat'],
    rocket: ['locket', 'pocket', 'socket', 'docket'],
    grapes: ['drapes'],
    carrot: ['parrot'],
    pear: ['bear', 'dear', 'fear', 'gear', 'hear', 'near', 'rear', 'sear', 'tear', 'wear', 'year'],
    ball: ['call', 'fall', 'gall', 'hall', 'mall', 'tall', 'wall'],
  },
});
/** The letters that would turn `word` into another word on the list. */
export const alsoAWord = (lang, word) => ((ALSO_A_WORD[lang] || ALSO_A_WORD.nl)[word] || []).map((w) => w[0]);

/** Words that do not start with the sound of their first letter on its own (au, ...). */
const NOT_FOR_FIRST = Object.freeze({ nl: ['auto'], en: [] });

/** Words for "first letter" by tier: tier 1 the short ones, then all of them. */
export function firstWords(lang, tier) {
  const all = (WORDS[lang] || WORDS.nl).filter(([w]) => !(NOT_FOR_FIRST[lang] || []).includes(w));
  return tier === 't1' ? all.filter(([w]) => w.length <= 4) : all;
}

export const pictureOf = (lang, word) => (WORDS[lang] || WORDS.nl).find(([w]) => w === word)?.[1] || null;
