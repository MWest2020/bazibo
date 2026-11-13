import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ALPHABET, LETTER_SETS, WORDS, BUILD, firstWords, pictureOf, confusable, lookalike, caseClash, LOOKALIKE } from '../web/games/letters/words.js';
import { MODES, TIER_IDS, ROUND_LEN, OPTIONS, EXTRA_TILES, TAP_CASE, BUILD_HINT, LOOKALIKE_QS, makeRound, starsFor, nextLetterOk, hashSeed, tapGlyphs, gapped } from '../web/games/letters/round.js';
import { PICTURE_IDS, wordPictureSvg } from '../web/games/letters/art.js';
import { meta } from '../web/games/letters/meta.js';

const WEB = new URL('../web/', import.meta.url).pathname;
const rounds = (mode, tier, lang, n = 100) => Array.from({ length: n }, (_, s) => makeRound({ mode, tier, lang, seed: hashSeed(`${lang}${mode}${tier}:${s}`) }));

test('every word has a picture that is drawn, and both languages use the same pictures', () => {
  for (const lang of ['nl', 'en']) {
    for (const [word, pic] of WORDS[lang]) {
      assert.ok(PICTURE_IDS.includes(pic), `${lang} ${word}: picture ${pic} is not drawn`);
      assert.match(wordPictureSvg(pic), /^<svg/, `${lang} ${word}: no svg`);
      assert.equal(pictureOf(lang, word), pic);
    }
  }
  assert.deepEqual(WORDS.nl.map(([, p]) => p).sort(), WORDS.en.map(([, p]) => p).sort());
});

test('words use plain letters only, and build words are short', () => {
  for (const lang of ['nl', 'en']) {
    for (const [word] of WORDS[lang]) assert.match(word, /^[a-z]+$/, `${lang} ${word}`);
    for (const tier of TIER_IDS) {
      for (const w of BUILD[lang][tier]) {
        assert.ok(WORDS[lang].some(([x]) => x === w), `${lang} build word ${w} has no picture`);
        assert.ok(w.length >= 3 && w.length <= 4, `${lang} ${w}`);
      }
    }
    for (const w of BUILD[lang].t1) assert.equal(w.length, 3, `${lang} t1 ${w}`);
  }
  for (const set of Object.values(LETTER_SETS)) for (const l of set) assert.ok(ALPHABET.includes(l));
});

test('no voice: no clips, no voice module, and nothing in the app asks for them', () => {
  assert.ok(!existsSync(`${WEB}games/letters/voice`), 'the voice clips are gone');
  assert.ok(!existsSync(`${WEB}games/letters/voice.js`), 'voice.js is gone');
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
  for (const f of files(WEB).filter((x) => /\.(js|html|css|json|webmanifest)$/.test(x))) {
    const text = readFileSync(f, 'utf8');
    assert.ok(!/\.mp3\b|letters\/voice|voice\.js/.test(text), `${f.slice(WEB.length)} still refers to the voice`);
  }
});

test('rounds: the answer is always there, the choices differ, the same seed gives the same round', () => {
  for (const lang of ['nl', 'en']) {
    for (const mode of MODES) {
      for (const tier of TIER_IDS) {
        for (let s = 0; s < 40; s++) {
          const seed = hashSeed(`${lang}${mode}${tier}${s}`);
          const qs = makeRound({ mode, tier, lang, seed });
          assert.equal(qs.length, ROUND_LEN[mode]);
          assert.deepEqual(qs, makeRound({ mode, tier, lang, seed }));
          qs.forEach((q, i) => {
            const key = (x) => (mode === 'tap' ? x.letter : x.word);
            if (i > 0) assert.notEqual(key(q), key(qs[i - 1]), 'the same question twice in a row');
            if (mode === 'build') {
              assert.equal(q.tiles.length, q.word.length + EXTRA_TILES[tier]);
              for (const l of q.word) assert.ok(q.tiles.includes(l));
              for (const x of q.tiles.filter((l) => !q.word.includes(l))) for (const l of q.word) assert.ok(!confusable(lang, l).includes(x), `${lang} build ${q.word}: extra ${x} sounds like ${l}`);
              assert.ok(BUILD[lang][tier].includes(q.word));
              assert.equal(q.hint, BUILD_HINT[tier]);
            } else {
              assert.equal(q.options.length, OPTIONS[tier]);
              assert.equal(new Set(q.options).size, q.options.length, 'choices are distinct');
              const answer = mode === 'tap' ? q.letter : q.word[0];
              assert.equal(q.options.filter((o) => o === answer).length, 1);
              if (mode === 'first') assert.equal(q.letter, q.word[0]);
              if (mode === 'tap') assert.ok(LETTER_SETS[tier].includes(q.letter));
              if (mode === 'first') assert.ok(firstWords(lang, tier).some(([w]) => w === q.word));
            }
          });
        }
      }
    }
  }
});

test('building: only the next letter is accepted, repeated letters work', () => {
  assert.ok(nextLetterOk('boot', [], 'b'));
  assert.ok(!nextLetterOk('boot', [], 'o'));
  assert.ok(nextLetterOk('boot', ['b'], 'o'));
  assert.ok(nextLetterOk('boot', ['b', 'o'], 'o'));
  assert.ok(!nextLetterOk('boot', ['b', 'o', 'o', 't'], 't'));
});

test('stars and the free part', () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(2), 2);
  assert.equal(starsFor(3), 1);
  for (const mode of MODES) {
    assert.equal(meta.isLocked({ mode, tier: 't1' }, false), false);
    assert.equal(meta.isLocked({ mode, tier: 't2' }, false), true);
    assert.equal(meta.isLocked({ mode, tier: 't3' }, true), false);
  }
});

test('tap, tier 1: the big letter is drawn exactly like its tile, from the first letters only', () => {
  for (const lang of ['nl', 'en']) {
    for (const qs of rounds('tap', 't1', lang)) {
      for (const q of qs) {
        assert.equal(q.cross, false);
        for (const o of q.options) assert.ok(LETTER_SETS.t1.includes(o), `t1 tile ${o}`);
        for (const upper of [false, true]) {
          const { big, tiles } = tapGlyphs(q, upper);
          assert.equal(tiles.filter((x) => x === big).length, 1, `t1 ${upper}: the big ${big} matches one tile exactly`);
          assert.equal(big, upper ? q.letter.toUpperCase() : q.letter);
        }
      }
    }
  }
});

test('tap, tier 2: a capital to match with its small letter (the other way round with capitals on)', () => {
  for (const lang of ['nl', 'en']) {
    for (const qs of rounds('tap', 't2', lang)) {
      for (const q of qs) {
        assert.equal(q.cross, true);
        assert.ok(LETTER_SETS.t2.includes(q.letter));
        const small = tapGlyphs(q, false);
        assert.equal(small.big, q.letter.toUpperCase());
        assert.deepEqual(small.tiles, q.options);
        const caps = tapGlyphs(q, true);
        assert.equal(caps.big, q.letter);
        assert.deepEqual(caps.tiles, q.options.map((o) => o.toUpperCase()));
        for (const o of q.options) if (o !== q.letter) assert.ok(!lookalike(q.letter).includes(o), `t2: ${q.letter} next to its look-alike ${o}`);
      }
    }
  }
});

test('tap, tier 3: mixed cases, and a mirrored look-alike next to b, d, p, q, n, u, m and w', () => {
  for (const lang of ['nl', 'en']) {
    for (const qs of rounds('tap', 't3', lang)) {
      assert.equal(new Set(qs.map((q) => q.letter)).size, qs.length, 'no letter twice in a round');
      assert.equal(qs.filter((q) => q.cross).length, ROUND_LEN.tap / 2, 'half of the questions cross the case');
      assert.equal(qs.filter((q) => lookalike(q.letter).length).length, LOOKALIKE_QS);
      for (const q of qs) {
        const twins = q.options.filter((o) => lookalike(q.letter).includes(o));
        assert.equal(twins.length, lookalike(q.letter).length ? 1 : 0, `t3 ${q.letter}: ${q.options}`);
        if (q.cross) for (const o of q.options) assert.ok(!caseClash(q.letter).includes(o), `capital ${q.letter.toUpperCase()} next to ${o}`);
      }
    }
  }
  assert.deepEqual(TAP_CASE, { t1: 'same', t2: 'other', t3: 'mixed' });
  for (const [l, list] of Object.entries(LOOKALIKE)) for (const x of list) assert.ok(LOOKALIKE[x].includes(l), `${l}/${x} both ways`);
});

test('first letter: the word with a gap where the answer goes, in every tier', () => {
  for (const lang of ['nl', 'en']) {
    for (const tier of TIER_IDS) {
      for (const qs of rounds('first', tier, lang, 40)) {
        for (const q of qs) {
          const [gap, rest] = gapped(q.word);
          assert.equal(gap, '_');
          assert.equal(q.letter + rest, q.word);
          if (tier === 't1') assert.ok(q.word.length <= 4, `t1 ${q.word}`);
        }
      }
    }
  }
  assert.deepEqual(gapped('maan'), ['_', 'aan']);
});

test('build: traced in tier 1, seen for a moment in tier 2, picture only in tier 3', () => {
  assert.deepEqual(BUILD_HINT, { t1: 'ghost', t2: 'flash', t3: 'none' });
  for (const lang of ['nl', 'en']) {
    for (const tier of TIER_IDS) {
      for (const qs of rounds('build', tier, lang, 40)) {
        for (const q of qs) {
          assert.equal(q.hint, BUILD_HINT[tier]);
          assert.ok(pictureOf(lang, q.word), `${lang} ${q.word} has a picture`);
          if (tier !== 't3') assert.equal(q.tiles.length, q.word.length, 'no extra letters before tier 3');
        }
      }
    }
  }
});

test('old saves still load: stars per round stay, the old how-to flags and options are kept', async () => {
  const store = await import('../web/js/storage.js');
  const letters = { stars: { 'tap-t1-1': 3, 'first-t1-2': 2, 'build-t2-1': 1 }, random: { 'tap-t2': 4 }, howSeen: { tap: true, build: true }, lastTier: { tap: 't2' }, upper: true };
  const doc = { ...store.emptySave(), games: { letters } };
  const mem = new Map([[store.SAVE_KEY, JSON.stringify(doc)]]);
  const ls = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  await store.init({ backend: store.localStorageBackend(ls), legacyStorage: ls });
  assert.deepEqual(store.loadProgress('letters').stars, letters.stars);
  assert.equal(store.loadGameOption('letters', 'upper', false), true);
  assert.deepEqual(store.loadGameOption('letters', 'lastTier', {}), { tap: 't2' });
  // the new how-to cards are kept under their own keys, next to the old ones
  store.saveGameOption('letters', 'howSeen', { ...store.loadGameOption('letters', 'howSeen', {}), tap2: true });
  assert.deepEqual(store.loadGameOption('letters', 'howSeen', {}), { tap: true, build: true, tap2: true });
  store.recordStars('letters', 'tap-t1-1', 2); // stars only go up
  assert.equal(store.loadProgress('letters').stars['tap-t1-1'], 3);
});

test('choices in "first letter" never pair letters that sound alike, and tier 1 stays within its letters', () => {
  for (const lang of ['nl', 'en']) {
    for (const mode of ['first']) {
      for (const tier of TIER_IDS) {
        for (let s = 0; s < 200; s++) {
          for (const q of makeRound({ mode, tier, lang, seed: hashSeed(`c${lang}${mode}${tier}${s}`) })) {
            const answer = mode === 'tap' ? q.letter : q.word[0];
            for (const o of q.options) {
              if (o !== answer) assert.ok(!confusable(lang, answer).includes(o), `${lang} ${mode} ${tier}: ${answer} next to ${o}`);
            }
            if (mode === 'first' && tier === 't1') {
              for (const o of q.options) assert.ok(o === answer || LETTER_SETS.t1.includes(o), `${lang} t1 first: ${o} is not a tier-1 letter`);
            }
          }
        }
      }
    }
  }
  assert.ok(!firstWords('nl', 't3').some(([w]) => w === 'auto'), '"auto" does not start with the a sound');
});
