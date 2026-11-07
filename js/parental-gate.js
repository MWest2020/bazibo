// Parental gate: an adult question before buying, restoring or leaving the app. Google's
// Families policy and Apple's Kids category both ask for one. The sum is written out in words
// ("zeven keer acht"), so a child who cannot read yet cannot even see what is asked, and the
// answer is typed, so tapping around never gets through. Every wrong answer brings a new
// question; after MAX_TRIES wrong answers the gate closes.

export const MAX_TRIES = 3;
const WORDS = ['nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf'];

/** A random number in [0, 1), from the crypto source when there is one. */
export function secureRandom() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  return Math.random();
}

/** a x b with a in 6..12 and b in 3..9: answers 18..108, never a one-digit guess. */
export function makeQuestion(rand = secureRandom) {
  const a = 6 + Math.floor(rand() * 7);
  const b = 3 + Math.floor(rand() * 7);
  return { a, b, text: `Hoeveel is ${WORDS[a]} keer ${WORDS[b]}?`, answer: a * b };
}

/** check(input) -> 'pass' | 'retry' (new question) | 'closed'. */
export function createGate({ rand = secureRandom, maxTries = MAX_TRIES } = {}) {
  let q = makeQuestion(rand);
  let wrong = 0;
  return {
    get question() {
      return q.text;
    },
    get triesLeft() {
      return maxTries - wrong;
    },
    check(input) {
      if (wrong >= maxTries) return 'closed';
      const s = String(input ?? '').trim();
      if (/^\d{1,3}$/.test(s) && Number(s) === q.answer) return 'pass';
      wrong += 1;
      if (wrong >= maxTries) return 'closed';
      q = makeQuestion(rand);
      return 'retry';
    },
  };
}
