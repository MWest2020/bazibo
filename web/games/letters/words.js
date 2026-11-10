// Letters' words and letters. Every word has a picture (art.js) and a spoken clip per language
// (voice/<lang>/w-<word>.mp3, made by tools/make_voice.py; keep the lists in step with it).
// Lowercase throughout: Dutch schools start with lowercase letters. The uppercase option only
// changes how the letters are drawn.

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
 * Letters that sound alike at the start of a word, per language. They are never offered as a wrong
 * choice next to each other: "cat" starts with a sound a child could fairly write as k, and Dutch
 * v/f and z/s are hard to hear apart. b, d and p are kept as choices next to each other from tier 2
 * on, on purpose: telling those mirrored shapes apart is part of learning them (tier 1 has none).
 */
export const CONFUSABLE = Object.freeze({
  nl: { k: ['c', 'q'], c: ['k', 's'], q: ['k'], v: ['f'], f: ['v'], z: ['s'], s: ['z', 'c'] },
  en: { c: ['k', 's'], k: ['c'], s: ['c'] },
});
export const confusable = (lang, letter) => (CONFUSABLE[lang] || CONFUSABLE.nl)[letter] || [];

/** Words that do not start with the sound of their first letter on its own (au, ...). */
const NOT_FOR_FIRST = Object.freeze({ nl: ['auto'], en: [] });

/** Words for "first letter" by tier: tier 1 the short ones, then all of them. */
export function firstWords(lang, tier) {
  const all = (WORDS[lang] || WORDS.nl).filter(([w]) => !(NOT_FOR_FIRST[lang] || []).includes(w));
  return tier === 't1' ? all.filter(([w]) => w.length <= 4) : all;
}

export const pictureOf = (lang, word) => (WORDS[lang] || WORDS.nl).find(([w]) => w === word)?.[1] || null;
