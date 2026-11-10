import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { ALPHABET, LETTER_SETS, WORDS, BUILD, firstWords, pictureOf } from '../web/games/letters/words.js';
import { MODES, TIER_IDS, ROUND_LEN, OPTIONS, EXTRA_TILES, makeRound, starsFor, nextLetterOk, hashSeed } from '../web/games/letters/round.js';
import { PICTURE_IDS, wordPictureSvg } from '../web/games/letters/art.js';
import { meta } from '../web/games/letters/meta.js';

const WEB = new URL('../web/', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(`${WEB}games/letters/voice/manifest.json`, 'utf8'));
const PHRASES = ['find', 'first', 'build', 'good', 'again', 'thisIs', 'done'];

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

test('every clip the game can ask for exists and is not empty', () => {
  for (const lang of ['nl', 'en']) {
    const keys = [...ALPHABET.map((l) => `l-${l}`), ...WORDS[lang].map(([w]) => `w-${w}`), ...PHRASES.map((p) => `p-${p}`)];
    for (const k of keys) {
      assert.ok(manifest[lang][k], `${lang}: ${k} missing from the manifest`);
      const size = statSync(`${WEB}games/letters/voice/${lang}/${k}.mp3`).size;
      assert.ok(size > 500, `${lang}/${k}.mp3 is ${size} bytes`);
      assert.ok(manifest[lang][k].ms > 100 && manifest[lang][k].ms < 4000, `${lang}/${k}: ${manifest[lang][k].ms} ms`);
    }
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
              assert.ok(BUILD[lang][tier].includes(q.word));
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
