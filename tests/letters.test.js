import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ALPHABET, LETTER_SETS, WORDS, BUILD, firstWords, pictureOf, confusable, lookalike, similar, SIMILAR, SIMILAR_UPPER, caseClash, LOOKALIKE, ALSO_A_WORD, alsoAWord, MIDDLE, middleWords, middleAlso } from '../web/games/letters/words.js';
import { MODES, TIER_IDS, ROUND_LEN, OPTIONS, EXTRA_TILES, TAP_CASE, BUILD_HINT, LOOKALIKES, LOOKALIKE_QS, makeRound, starsFor, nextLetterOk, hashSeed, tapGlyphs, gapped, around } from '../web/games/letters/round.js';
import { PICTURE_IDS, wordPictureSvg } from '../web/games/letters/art.js';
import { meta } from '../web/games/letters/meta.js';

const WEB = new URL('../web/', import.meta.url).pathname;
const rounds = (mode, tier, lang, n = 100, upper = false) => Array.from({ length: n }, (_, s) => makeRound({ mode, tier, lang, upper, seed: hashSeed(`${lang}${mode}${tier}${upper}:${s}`) }));
/** Every look-alike of a letter, mirrored or not, small or capital. */
const anyLook = (l) => [...lookalike(l), ...similar(l, false), ...similar(l, true)];
/** The look-alikes a round may put next to `l` on purpose: in the tiles' case, mirrors in tier 3 on small letters. */
const meantLook = (l, tier, upper) => [...(tier === 't3' && !upper ? lookalike(l) : []), ...similar(l, upper)];

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
            if (mode === 'middle') assert.ok(q.at >= 1 && q.at <= q.word.length - 2, `${lang} middle ${q.word}: gap at ${q.at}`);
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
              assert.equal(q.options.filter((o) => o === q.letter).length, 1);
              if (mode === 'first') assert.equal(q.letter, q.word[0]);
              if (mode === 'middle') assert.equal(q.letter, q.word[q.at]);
              if (mode === 'middle') assert.ok(middleWords(lang, tier).some(([w, at]) => w === q.word && at.includes(q.at)));
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

test('tap, tier 1: the big letter is drawn exactly like its tile, next to one look-alike (m and n, i and l)', () => {
  for (const lang of ['nl', 'en']) {
    for (const upper of [false, true]) {
      for (const qs of rounds('tap', 't1', lang, 100, upper)) {
        for (const q of qs) {
          assert.equal(q.cross, false);
          assert.ok(LETTER_SETS.t1.includes(q.letter));
          const looks = q.options.filter((o) => anyLook(q.letter).includes(o));
          assert.equal(looks.length, 1, `t1 ${q.letter}: one look-alike in ${q.options}`);
          assert.ok(similar(q.letter, upper).includes(looks[0]), `t1 ${upper}: ${looks[0]} looks like ${q.letter} in the tiles' case`);
          for (const o of q.options) if (o !== q.letter && o !== looks[0]) assert.ok(LETTER_SETS.t1.includes(o), `t1 tile ${o}`);
          const { big, tiles } = tapGlyphs(q, upper);
          assert.equal(tiles.filter((x) => x === big).length, 1, `t1 ${upper}: the big ${big} matches one tile exactly`);
          assert.equal(big, upper ? q.letter.toUpperCase() : q.letter);
        }
      }
    }
  }
});

test('tap, tier 2: a capital to match with its small letter (the other way round with capitals on), with a look-alike', () => {
  for (const lang of ['nl', 'en']) {
    for (const upper of [false, true]) {
      for (const qs of rounds('tap', 't2', lang, 100, upper)) {
        for (const q of qs) {
          assert.equal(q.cross, true);
          assert.ok(LETTER_SETS.t2.includes(q.letter));
          const g = tapGlyphs(q, upper);
          assert.equal(g.big, upper ? q.letter : q.letter.toUpperCase());
          assert.deepEqual(g.tiles, q.options.map((o) => (upper ? o.toUpperCase() : o)));
          const looks = q.options.filter((o) => anyLook(q.letter).includes(o));
          assert.equal(looks.length, 1, `t2 ${q.letter}: one look-alike in ${q.options}`);
          assert.ok(similar(q.letter, upper).includes(looks[0]));
          assert.ok(!looks.some((o) => lookalike(q.letter).includes(o)) || similar(q.letter, upper).includes(looks[0]), 'no mirror twin before tier 3');
          for (const o of q.options) assert.ok(!caseClash(q.letter).includes(o), `capital ${q.letter.toUpperCase()} next to ${o}`);
        }
      }
    }
  }
});

test('tap, tier 3: mixed cases, two look-alikes, mirrored ones next to b, d, p, q, n, u, m and w in half the round', () => {
  for (const lang of ['nl', 'en']) {
    for (const qs of rounds('tap', 't3', lang)) {
      assert.equal(new Set(qs.map((q) => q.letter)).size, qs.length, 'no letter twice in a round');
      assert.equal(qs.filter((q) => q.cross).length, ROUND_LEN.tap / 2, 'half of the questions cross the case');
      assert.equal(qs.filter((q) => lookalike(q.letter).length).length, LOOKALIKE_QS);
      for (const q of qs) {
        const looks = q.options.filter((o) => anyLook(q.letter).includes(o));
        assert.equal(looks.length, LOOKALIKES.tap.t3, `t3 ${q.letter}: ${q.options}`); // i and l have a third, for the case clash
        for (const o of looks) assert.ok(meantLook(q.letter, 't3', false).includes(o));
        if (lookalike(q.letter).length) assert.ok(looks.some((o) => lookalike(q.letter).includes(o)), `t3 ${q.letter}: no mirrored twin in ${q.options}`);
        if (q.cross) for (const o of q.options) assert.ok(!caseClash(q.letter).includes(o), `capital ${q.letter.toUpperCase()} next to ${o}`);
      }
    }
  }
  assert.deepEqual(TAP_CASE, { t1: 'same', t2: 'other', t3: 'mixed' });
  for (const [l, list] of Object.entries(LOOKALIKE)) for (const x of list) assert.ok(LOOKALIKE[x].includes(l), `${l}/${x} both ways`);
});

test('look-alike tables: every letter has two, never itself, never a mirror image (those are tier 3 only)', () => {
  for (const table of [SIMILAR, SIMILAR_UPPER]) {
    assert.deepEqual(Object.keys(table).sort(), ALPHABET);
    for (const [l, list] of Object.entries(table)) {
      assert.ok(list.length >= 2, `${l}: ${list}`);
      for (const x of list) assert.ok(ALPHABET.includes(x) && x !== l, `${l}: ${x}`);
    }
  }
  for (const [l, list] of Object.entries(SIMILAR)) for (const x of list) assert.ok(!lookalike(l).includes(x), `SIMILAR ${l}: ${x} is a mirror`);
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

test('build: the word for a moment in tier 1, the picture only from tier 2, extra tiles that look like the word', () => {
  assert.deepEqual(BUILD_HINT, { t1: 'flash', t2: 'none', t3: 'none' });
  for (const lang of ['nl', 'en']) {
    for (const tier of TIER_IDS) {
      for (const upper of [false, true]) {
        let mirrored = 0;
        for (const qs of rounds('build', tier, lang, 60, upper)) {
          for (const q of qs) {
            assert.equal(q.hint, BUILD_HINT[tier]);
            assert.ok(pictureOf(lang, q.word), `${lang} ${q.word} has a picture`);
            assert.equal(q.tiles.length, q.word.length + EXTRA_TILES[tier]);
            assert.ok(q.tiles.length <= 6, 'at most six tiles: they fit two rows of three');
            const extra = [...q.tiles];
            for (const l of q.word) extra.splice(extra.indexOf(l), 1);
            for (const x of extra) assert.ok(!q.word.includes(x), `${q.word}: extra ${x} is in the word`);
            const looks = extra.filter((x) => [...q.word].some((l) => anyLook(l).includes(x)));
            const can = new Set([...q.word].flatMap((l) => meantLook(l, tier, upper)).filter((x) => !q.word.includes(x) && ![...q.word].some((w) => confusable(lang, w).includes(x))));
            assert.equal(looks.length, Math.min(LOOKALIKES.build[tier], can.size), `${lang} ${tier} ${q.word}: look-alikes ${looks} in ${q.tiles}`);
            if (tier !== 't1') assert.ok(looks.length >= 1, `${lang} ${tier} ${q.word}: no look-alike`);
            for (const x of looks) assert.ok([...q.word].some((l) => meantLook(l, tier, upper).includes(x)), `${q.word}: ${x} in the tiles' case`);
            const canMirror = [...q.word].some((l) => lookalike(l).some((m) => !q.word.includes(m) && ![...q.word].some((w) => confusable(lang, w).includes(m))));
            if (tier === 't3' && !upper && canMirror) {
              assert.ok(extra.some((x) => [...q.word].some((l) => lookalike(l).includes(x))), `${lang} t3 ${q.word}: no mirrored letter in ${q.tiles}`);
              mirrored++;
            }
            if (tier !== 't3' || upper) assert.ok(!looks.some((x) => ![...q.word].some((l) => similar(l, upper).includes(x))), `${tier} ${q.word}: a mirror twin before tier 3 (${q.tiles})`);
          }
        }
        if (tier === 't3' && !upper) assert.ok(mirrored > 50, `${lang}: tier 3 rarely has a mirrored tile (${mirrored})`);
      }
    }
  }
});

test('middle letter: the gap is inside the word, never a letter that spells another word or sounds the same', () => {
  for (const lang of ['nl', 'en']) {
    const words = new Set(WORDS[lang].map(([w]) => w));
    for (const [word, gaps] of Object.entries(MIDDLE[lang])) {
      assert.ok(words.has(word), `${lang}: ${word} is not a Letters word`);
      for (const [at, others] of Object.entries(gaps)) {
        assert.ok(Number(at) >= 1 && Number(at) <= word.length - 2, `${lang} ${word}: gap ${at} is the first or last letter`);
        for (const w of others) {
          assert.equal(w.length, word.length, `${lang} ${w}`);
          assert.equal(w.slice(0, at) + w.slice(Number(at) + 1), word.slice(0, at) + word.slice(Number(at) + 1), `${lang}: ${w} must differ from ${word} at ${at} only`);
          assert.notEqual(w[at], word[at]);
        }
      }
    }
    for (const tier of TIER_IDS) {
      const list = middleWords(lang, tier);
      assert.ok(list.length >= 4, `${lang} ${tier}: ${list.length} words`);
      for (const [w, at] of list) {
        if (tier === 't1') assert.ok(w.length <= 4 && at.every((k) => 'aeiou'.includes(w[k])), `${lang} t1 ${w} ${at}`);
        if (tier === 't2') assert.ok(w.length <= 6, `${lang} t2 ${w}`);
      }
      for (const upper of [false, true]) {
        for (const qs of rounds('middle', tier, lang, 120, upper)) {
          for (const q of qs) {
            const [head, tail] = around(q.word, q.at);
            assert.equal(head + q.letter + tail, q.word);
            assert.ok(head.length >= 1 && tail.length >= 1);
            const also = middleAlso(lang, q.word, q.at);
            for (const o of q.options) {
              if (o === q.letter) continue;
              assert.ok(!also.includes(o), `${lang} ${tier}: ${o} in "${head}_${tail}" spells another word`);
              assert.ok(!confusable(lang, q.letter).includes(o), `${lang} ${tier}: ${o} sounds like ${q.letter}`);
            }
            const looks = q.options.filter((o) => anyLook(q.letter).includes(o));
            // as many as asked for, unless the word list or the sounds leave fewer (bal: no e, o; paddenstoel: s looks like z and c, which sound like it)
            const can = new Set(meantLook(q.letter, tier, upper).filter((x) => !also.includes(x) && !confusable(lang, q.letter).includes(x)));
            assert.equal(looks.length, Math.min(LOOKALIKES.middle[tier], can.size), `${lang} ${tier} ${q.word}/${q.letter}: look-alikes ${looks} in ${q.options}`);
            for (const o of looks) assert.ok(meantLook(q.letter, tier, upper).includes(o));
          }
        }
      }
    }
  }
  assert.deepEqual(around('maan', 2), ['ma', 'n']);
  assert.deepEqual(middleAlso('nl', 'kat', 1), ['i', 'o', 'u']);
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

test('choices in "first letter" never pair letters that sound alike, and tier 1 does not give the answer away', () => {
  for (const lang of ['nl', 'en']) {
    for (const tier of TIER_IDS) {
      const starts = new Set(firstWords(lang, tier).map(([w]) => w[0]));
      let outside = 0; // tier 1: questions where a wrong choice is a first letter from outside the tier-1 set
      for (let s = 0; s < 200; s++) {
        for (const q of makeRound({ mode: 'first', tier, lang, seed: hashSeed(`c${lang}first${tier}${s}`) })) {
          for (const o of q.options) {
            if (o !== q.letter) assert.ok(!confusable(lang, q.letter).includes(o), `${lang} first ${tier}: ${q.letter} next to ${o}`);
          }
          if (tier === 't1') {
            for (const o of q.options) assert.ok(LETTER_SETS.t1.includes(o) || starts.has(o), `${lang} t1 first: ${o} is not a tier-1 letter or first letter`);
            if (q.options.some((o) => o !== q.letter && !LETTER_SETS.t1.includes(o))) outside++;
          }
        }
      }
      if (tier === 't1') assert.ok(outside > 200, `${lang} t1: the answer is too often the only letter from outside a i o m s k (${outside})`);
    }
  }
  assert.ok(!firstWords('nl', 't3').some(([w]) => w === 'auto'), '"auto" does not start with the a sound');
});

test('"first letter" never offers a letter that spells another word in the gap (kat: no m for "mat")', () => {
  for (const lang of ['nl', 'en']) {
    const words = new Set(WORDS[lang].map(([w]) => w));
    for (const [word, others] of Object.entries(ALSO_A_WORD[lang])) {
      assert.ok(words.has(word), `${lang}: ${word} is not a Letters word`);
      for (const w of others) assert.equal(w.slice(1), word.slice(1), `${lang}: ${w} must differ from ${word} in the first letter only`);
    }
    for (const tier of TIER_IDS) {
      for (let s = 0; s < 300; s++) {
        for (const q of makeRound({ mode: 'first', tier, lang, seed: hashSeed(`w${lang}${tier}${s}`) })) {
          const others = ALSO_A_WORD[lang][q.word] || [];
          for (const o of q.options) {
            if (o !== q.letter) assert.ok(!others.includes(o + q.word.slice(1)), `${lang} ${tier}: ${o} in "_${q.word.slice(1)}" spells ${o + q.word.slice(1)}`);
          }
        }
      }
    }
  }
  assert.deepEqual(alsoAWord('nl', 'kat').slice(0, 2), ['m', 'l']);
});

test('with capitals on, tap tier 3 adds no mirrored twin (capital B, D, P and Q are not mirrors), only capital look-alikes', () => {
  for (const lang of ['nl', 'en']) {
    for (let s = 0; s < 100; s++) {
      for (const q of makeRound({ mode: 'tap', tier: 't3', lang, seed: hashSeed(`u${lang}${s}`), upper: true })) {
        const looks = q.options.filter((o) => anyLook(q.letter).includes(o));
        assert.equal(looks.length, LOOKALIKES.tap.t3);
        for (const o of looks) assert.ok(similar(q.letter, true).includes(o), `capitals: ${q.letter} next to ${o} (${q.options})`);
      }
    }
  }
});

test('building: every placed letter plays a real note, also the 4th and later (a 4-letter word lost its last letter)', async () => {
  // A stand-in AudioContext that is as strict as a browser: a frequency that is not a finite number
  // throws. plink(1.1) used to look up PENTA[0.1] (undefined) and throw, so placeTile stopped
  // before it drew the letter or finished the word.
  const freqs = [];
  const param = (isFreq) => ({
    value: 0,
    setValueAtTime(v) {
      if (!Number.isFinite(v)) throw new TypeError(`non-finite value ${v}`);
      if (isFreq) freqs.push(v);
    },
    exponentialRampToValueAtTime(v) {
      if (!Number.isFinite(v)) throw new TypeError(`non-finite value ${v}`);
    },
    setTargetAtTime() {},
  });
  const node = (extra = {}) => ({ connect: (n) => n, ...extra });
  class Ctx {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.state = 'running';
      this.destination = node();
    }
    resume() {
      return Promise.resolve();
    }
    createGain() {
      return node({ gain: param(false) });
    }
    createWaveShaper() {
      return node({});
    }
    createOscillator() {
      return node({ frequency: param(true), type: '', start() {}, stop() {} });
    }
    createBuffer(ch, len) {
      const d = new Float32Array(len);
      return { getChannelData: () => d };
    }
  }
  const hadWindow = 'window' in globalThis;
  const hadNavigator = 'navigator' in globalThis;
  if (!hadWindow) globalThis.window = { AudioContext: Ctx };
  if (!hadNavigator) globalThis.navigator = {};
  try {
    const sfx = await import('../web/js/audio.js');
    sfx.setMuted(false);
    sfx.unlock();
    // the values Letters passed before the fix (0.7 + placed * 0.1), and whole notes 1 to 12
    for (const v of [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, ...Array.from({ length: 12 }, (_, k) => k + 1)]) {
      assert.doesNotThrow(() => sfx.plink(v), `plink(${v})`);
    }
    assert.ok(freqs.length > 0 && freqs.every(Number.isFinite), 'every note has a real frequency');
  } finally {
    if (!hadWindow) delete globalThis.window;
    if (!hadNavigator) delete globalThis.navigator;
  }
});
