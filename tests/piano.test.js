import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../web/games/piano/songs.js';
import { meta } from '../web/games/piano/meta.js';
import { tileSvg, cardSvg } from '../web/games/piano/art.js';
import * as store from '../web/js/storage.js';
import { sanitizePayload } from '../web/js/transfer.js';

test('the keyboard: 8 coloured keys from C to the high C and 5 black keys, each with its own colour', () => {
  assert.equal(P.KEYS.length, 13);
  assert.deepEqual(P.WHITE_KEYS.map((k) => k.id), ['c', 'd', 'e', 'f', 'g', 'a', 'b', 'c2']);
  assert.deepEqual(P.KEYS.filter((k) => !k.white).map((k) => k.id), ['cis', 'dis', 'fis', 'gis', 'ais']);
  const colours = P.WHITE_KEYS.map((k) => k.color);
  assert.equal(new Set(colours).size, colours.length, 'two keys share a colour');
  for (const c of colours) assert.match(c, /^#[0-9a-f]{6}$/);
  // black keys sit on the edge between two white keys, never past the last one
  assert.deepEqual(P.KEYS.filter((k) => !k.white).map((k) => P.blackSlot(k.id)), [1, 2, 4, 5, 6]);
  assert.equal(P.blackSlot('c'), null);
});

test('the keys are an equal-tempered octave from C5 (523 Hz) to C6, a semitone apart', () => {
  assert.ok(Math.abs(P.frequency(69) - 440) < 1e-9);
  assert.ok(Math.abs(P.keyFrequency('c') - 523.2511) < 0.01);
  assert.ok(Math.abs(P.keyFrequency('a') - 880) < 1e-9);
  assert.ok(Math.abs(P.keyFrequency('c2') / P.keyFrequency('c') - 2) < 1e-9);
  for (let i = 1; i < P.KEYS.length; i++) {
    const r = P.keyFrequency(P.KEYS[i].id) / P.keyFrequency(P.KEYS[i - 1].id);
    assert.ok(Math.abs(r - 2 ** (1 / 12)) < 1e-9);
  }
  assert.equal(P.keyFrequency('h'), null);
});

test('parseSong reads note names with lengths and refuses notes the keyboard does not have', () => {
  assert.deepEqual(P.parseSong("C D:2 | E:.5 F# C':4"), [
    { key: 'c', beats: 1 },
    { key: 'd', beats: 2 },
    { key: 'e', beats: 0.5 },
    { key: 'fis', beats: 1 },
    { key: 'c2', beats: 4 },
  ]);
  assert.throws(() => P.parseSong('C H'), /unknown note/);
  assert.throws(() => P.parseSong("D'"), /unknown note/); // only the high C exists
  assert.throws(() => P.parseSong('E#'), /unknown note/);
  assert.throws(() => P.parseSong('C:0'), /odd length/);
  assert.throws(() => P.parseSong('C:8'), /odd length/);
});

test('the songs: Vader Jacob first and free, every note on a coloured key, whole bars', () => {
  assert.deepEqual(P.SONG_IDS, ['jacob', 'kortjakje', 'maan', 'vreugde', 'ode', 'wilhelmus', 'bergkoning', 'turks', 'elise']);
  assert.equal(new Set(P.SONG_IDS).size, P.SONG_IDS.length, 'song ids are unique over both levels');
  assert.deepEqual(P.songsFor('small').map((s) => s.id), ['jacob', 'kortjakje', 'maan', 'vreugde']);
  const whites = new Set(P.WHITE_KEYS.map((k) => k.id));
  for (const s of P.songsFor('small')) {
    assert.ok(s.notes.length >= 20 && s.notes.length <= 60, `${s.id}: ${s.notes.length} notes`);
    for (const n of s.notes) assert.ok(whites.has(n.key), `${s.id} uses ${n.key}: songs stay on the coloured keys`);
    for (const n of s.notes) assert.equal(n.rest, undefined, `${s.id}: no rests on the toy piano`);
    const beats = s.notes.reduce((a, n) => a + n.beats, 0);
    assert.equal(beats % 4, 0, `${s.id}: ${beats} beats is not whole 4/4 bars`);
    assert.ok(s.bpm >= 80 && s.bpm <= 130, `${s.id}: ${s.bpm} bpm`);
    assert.ok(['c', 'c2'].includes(s.notes[s.notes.length - 1].key), `${s.id} ends on C`);
    assert.ok(P.songLength(s) < 40000, `${s.id} takes ${P.songLength(s)} ms to listen to`);
  }
  // Frère Jacques as every child knows it: the opening and the "bim bam bom"
  const jacob = P.songById('jacob').notes.map((n) => n.key);
  assert.deepEqual(jacob.slice(0, 8), ['c', 'd', 'e', 'c', 'c', 'd', 'e', 'c']);
  assert.deepEqual(jacob.slice(-3), ['c2', 'g', 'c2']);
  assert.equal(jacob.length, 32);
  // Twinkle: C C G G A A G
  assert.deepEqual(P.songById('kortjakje').notes.slice(0, 7).map((n) => n.key), ['c', 'c', 'g', 'g', 'a', 'a', 'g']);
  assert.equal(P.songById('nope'), null);
});

test('7-10: two octaves from middle C, every C red, the black keys between, a semitone apart', () => {
  const B = P.BIG;
  assert.equal(B.keys.length, 25);
  assert.equal(B.whites.length, 15);
  assert.equal(B.ids[0], 'c4');
  assert.equal(B.ids[24], 'c6');
  assert.deepEqual(B.keys.filter((k) => !k.white).map((k) => k.id), ['cis4', 'dis4', 'fis4', 'gis4', 'ais4', 'cis5', 'dis5', 'fis5', 'gis5', 'ais5']);
  assert.deepEqual(B.keys.filter((k) => !k.white).map((k) => B.blackSlot(k.id)), [1, 2, 4, 5, 6, 8, 9, 11, 12, 13]);
  for (const k of B.whites) assert.equal(k.color, P.WHITE_KEYS.find((w) => w.pc === k.pc && w.id !== 'c2').color, `${k.id} has the colour of its note`);
  assert.ok(Math.abs(B.frequency('c4') - 261.6256) < 0.01, 'middle C');
  assert.ok(Math.abs(B.frequency('a4') - 440) < 1e-9);
  assert.ok(Math.abs(B.frequency('c6') - P.keyFrequency('c2')) < 1e-9, 'the top C is the toy piano\'s high C');
  for (let i = 1; i < B.keys.length; i++) assert.ok(Math.abs(B.frequency(B.ids[i]) / B.frequency(B.ids[i - 1]) - 2 ** (1 / 12)) < 1e-9);
  assert.deepEqual(B.span('c4'), [0, 1]);
  assert.deepEqual(B.span('fis5'), [11 - 0.35, 11 + 0.35]);
  assert.equal(B.span('h4'), null);
  // the computer keyboard: Z to M the low octave, Q to I the high one; every key once
  assert.deepEqual([...new Set(Object.values(B.keymap))].sort(), [...B.ids].sort());
  assert.equal(B.keymap.z, 'c4');
  assert.equal(B.keymap.q, 'c5');
  assert.equal(B.keymap.i, 'c6');
  assert.deepEqual(P.LEVELS.map((l) => [l.id, l.ages, l.board.id]), [['small', '4-6', 'small'], ['big', '7-10', 'big']]);
  assert.equal(P.levelById('big').board, B);
  assert.equal(P.levelById('huge'), null);
});

test('7-10 notation: octaves, sharps and flats, rests that lengthen the note before', () => {
  assert.deepEqual(P.parseSong('C4 F#4:.5 Bb4 R:.5 C6:2 E#5', P.BIG), [
    { key: 'c4', beats: 1 },
    { key: 'fis4', beats: 0.5 },
    { key: 'ais4', beats: 1.5, rest: 0.5 },
    { key: 'c6', beats: 2 },
    { key: 'f5', beats: 1 },
  ]);
  assert.throws(() => P.parseSong('B3', P.BIG), /unknown note/); // below the keyboard
  assert.throws(() => P.parseSong('C#6', P.BIG), /unknown note/); // above it
  assert.throws(() => P.parseSong('C', P.BIG), /unknown note/); // no octave
  assert.throws(() => P.parseSong("C'", P.BIG), /unknown note/);
  assert.throws(() => P.parseSong('R C4', P.BIG), /start with a rest/);
  assert.throws(() => P.parseSong('C4 R:5', P.BIG), /odd length/);
  assert.throws(() => P.parseSong('C4', P.SMALL), /unknown note/);
});

test('7-10 songs: longer, wider, with black keys; the free one first; each true to its score', () => {
  const big = P.songsFor('big');
  assert.deepEqual(big.map((s) => s.id), ['ode', 'wilhelmus', 'bergkoning', 'turks', 'elise']);
  const ids = new Set(P.BIG.ids);
  for (const s of big) {
    assert.ok(s.notes.length >= 30 && s.notes.length <= 90, `${s.id}: ${s.notes.length} notes`);
    for (const n of s.notes) assert.ok(ids.has(n.key), `${s.id} uses ${n.key}`);
    assert.ok(s.notes.some((n) => !P.BIG.keyById(n.key).white), `${s.id} uses no black key`);
    const midis = s.notes.map((n) => P.BIG.keyById(n.key).midi);
    assert.ok(Math.max(...midis) - Math.min(...midis) >= 12, `${s.id} spans less than an octave`);
    const beats = s.notes.reduce((a, n) => a + n.beats, 0);
    assert.equal((beats * 4) % 1, 0, `${s.id}: ${beats} beats is not whole sixteenths`);
    assert.ok(s.bpm >= 60 && s.bpm <= 140, `${s.id}: ${s.bpm} bpm`);
    assert.ok(P.songLength(s) < 60000, `${s.id} takes ${P.songLength(s)} ms to listen to`);
  }
  const keys = (id, n) => P.songById(id).notes.slice(0, n).map((x) => x.key);
  // the openings everyone knows, written out so a slip in the data shows
  assert.deepEqual(keys('ode', 15), ['fis5', 'fis5', 'g5', 'a5', 'a5', 'g5', 'fis5', 'e5', 'd5', 'd5', 'e5', 'fis5', 'fis5', 'e5', 'e5']);
  assert.deepEqual(keys('wilhelmus', 8), ['d4', 'g4', 'g4', 'a4', 'b4', 'c5', 'a4', 'b4']);
  assert.deepEqual(keys('bergkoning', 13), ['b4', 'cis5', 'd5', 'e5', 'fis5', 'd5', 'fis5', 'f5', 'cis5', 'f5', 'e5', 'c5', 'e5']);
  assert.deepEqual(keys('turks', 10), ['b4', 'a4', 'gis4', 'a4', 'c5', 'd5', 'c5', 'b4', 'c5', 'e5']);
  assert.deepEqual(keys('elise', 12), ['e5', 'dis5', 'e5', 'dis5', 'e5', 'b4', 'd5', 'c5', 'a4', 'c4', 'e4', 'a4']);
  // the tied F# in bar 12 of the Ode: two beats, then the A section again
  const ode = P.songById('ode').notes;
  assert.deepEqual(ode.slice(44, 48).map((n) => [n.key, n.beats]), [['d5', 1], ['e5', 1], ['a4', 1], ['fis5', 2]]);
  assert.equal(P.songById('ode').notes.reduce((a, n) => a + n.beats, 0), 64);
  // Für Elise: the eighth note, the rest, then three sixteenths up
  assert.deepEqual([P.songById('elise').notes[8]], [{ key: 'a4', beats: 0.75, rest: 0.25 }]);
  // and where they end: on the key note, Bergkoning on the A that leads back into its theme
  assert.deepEqual(big.map((s) => s.notes.at(-1).key), ['d5', 'g4', 'a5', 'a4', 'a4']);
});

test('following the song on a keyboard that does not fit: stays put while the next keys are in sight', () => {
  const B = P.BIG;
  const spans = (keys) => keys.map((k) => B.span(k));
  // all keys fit: never moves
  assert.equal(P.followView(spans(['c4', 'c6']), 0, 15, 15), 0);
  // in sight with the next few: stays
  assert.equal(P.followView(spans(['d4', 'e4', 'g4']), 0, 8, 15), 0);
  // out of sight: moves so the key and the next ones are in the middle
  const v = P.followView(spans(['a5', 'g5', 'fis5', 'e5']), 0, 8, 15);
  assert.ok(v > 0 && v <= 7);
  for (const k of ['a5', 'g5', 'fis5', 'e5']) {
    const [a, b] = B.span(k);
    assert.ok(a >= v && b <= v + 8, `${k} in sight from ${v}`);
  }
  // a leap wider than the screen: the key to press always wins
  for (const [first, then] of [['c4', 'c6'], ['c6', 'c4'], ['fis5', 'c4']]) {
    const w = P.followView(spans([first, then]), 3, 7, 15);
    const [a, b] = B.span(first);
    assert.ok(a >= w && b <= w + 7, `${first} in sight from ${w}`);
  }
  // never past either end
  assert.equal(P.followView(spans(['c4']), 5, 8, 15), 0);
  assert.equal(P.followView(spans(['c6']), 0, 8, 15), 7);
  // every 7-10 song played through on 7 and 8 keys: the key to press is always in sight
  for (const s of P.songsFor('big')) {
    for (const visible of [7, 8, 12]) {
      let view = 0;
      let moves = 0;
      s.notes.forEach((n, i) => {
        const next = P.followView(spans(s.notes.slice(i).map((x) => x.key)), view, visible, 15);
        if (next !== view) moves++;
        view = next;
        const [a, b] = B.span(n.key);
        assert.ok(a >= view && b <= view + visible, `${s.id} note ${i} (${n.key}) out of sight at ${view}+${visible}`);
      });
      assert.ok(moves <= s.notes.length / 3, `${s.id} on ${visible} keys moves ${moves} times`);
    }
  }
});

test('free part: free play, Vader Jacob and the whole Ode; every other song only with the full version', () => {
  assert.equal(meta.id, 'piano');
  assert.equal(meta.group, 'creative');
  assert.deepEqual([...meta.freeSongs], P.LEVELS.map((l) => P.songsFor(l.id)[0].id), 'the first song of each level is free');
  assert.equal(meta.isLocked('jacob', false), false);
  assert.equal(meta.isLocked('ode', false), false);
  for (const id of P.SONG_IDS.filter((x) => !meta.freeSongs.includes(x))) {
    assert.equal(meta.isLocked(id, false), true, id);
    assert.equal(meta.isLocked(id, true), false, id);
  }
});

test('playing along: the right key moves on, another key only counts as a miss, the last note ends it', () => {
  for (const s of P.SONGS) {
    const run = P.createRun(s);
    let misses = 0;
    s.notes.forEach((n, i) => {
      assert.equal(run.target(), n.key);
      if (i % 5 === 0) {
        const wrong = s.notes.find((x) => x.key !== n.key).key;
        assert.equal(run.press(wrong), 'wrong');
        misses++;
        assert.equal(run.index, i, 'a wrong key never moves the song on');
      }
      assert.equal(run.press(n.key), i === s.notes.length - 1 ? 'done' : 'right');
    });
    assert.equal(run.done, true);
    assert.equal(run.target(), null);
    assert.equal(run.misses, misses);
    assert.equal(run.press('c'), 'over');
    assert.equal(run.misses, misses, 'nothing counts after the end');
    run.restart();
    assert.equal(run.index, 0);
    assert.equal(run.misses, 0);
    assert.equal(run.target(), s.notes[0].key);
  }
});

test('stars are gentle and only about wrong keys: a few slips still give three', () => {
  assert.equal(P.starsFor(0), 3);
  assert.equal(P.starsFor(3), 3);
  assert.equal(P.starsFor(4), 2);
  assert.equal(P.starsFor(10), 2);
  assert.equal(P.starsFor(11), 1);
  assert.equal(P.starsFor(500), 1);
});

test('listening: the notes follow each other by their lengths, each held shorter than its step', () => {
  for (const s of P.SONGS) {
    const steps = P.schedule(s);
    assert.equal(steps.length, s.notes.length);
    const beat = 60000 / s.bpm;
    assert.equal(steps[0].at, 0);
    for (let i = 1; i < steps.length; i++) {
      const gap = steps[i].at - steps[i - 1].at;
      assert.ok(Math.abs(gap - s.notes[i - 1].beats * beat) <= 1, `${s.id} note ${i}`);
      assert.ok(steps[i - 1].hold > 0 && steps[i - 1].hold < gap, `${s.id} note ${i - 1} is held through the next one`);
      const rest = (s.notes[i - 1].rest || 0) * beat;
      if (rest) assert.ok(steps[i - 1].hold < gap - rest, `${s.id} note ${i - 1} is let go before its rest`);
    }
    // half speed takes twice as long
    assert.ok(Math.abs(P.songLength(s, 0.5) - 2 * P.songLength(s)) <= 1);
  }
});

test('a computer keyboard: the middle row is the coloured keys, the row above the black ones', () => {
  const ids = Object.values(P.KEYBOARD_MAP);
  assert.deepEqual([...new Set(ids)].sort(), [...P.KEY_IDS].sort());
  assert.deepEqual(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'].map((c) => P.KEYBOARD_MAP[c]), P.WHITE_KEYS.map((k) => k.id));
});

test('the pictures are self-contained SVG (no ids, no links)', () => {
  for (const svg of [tileSvg(), cardSvg('free'), cardSvg('free-big'), ...P.SONG_IDS.map(cardSvg)]) {
    assert.match(svg, /^<svg [^>]*viewBox=/);
    assert.doesNotMatch(svg, /\bid=|url\(|href|NaN|undefined/);
  }
});

test('save: stars per song only go up, in its own section, and survive a transfer', async () => {
  const m = new Map();
  const prefs = { get: async ({ key }) => ({ value: m.has(key) ? m.get(key) : null }), set: async ({ key, value }) => void m.set(key, value) };
  await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  store.recordStars(meta.id, 'jacob', 2);
  store.recordStars(meta.id, 'jacob', 1); // never lowered
  store.recordStars(meta.id, 'jacob', 3);
  store.recordStars(meta.id, 'kortjakje', 2);
  await store.flushed();
  const saved = JSON.parse(m.get(store.SAVE_KEY));
  assert.deepEqual(saved.games.piano, { stars: { jacob: 3, kortjakje: 2 } });
  // the chosen level is a game option next to the stars
  store.recordStars(meta.id, 'elise', 1);
  store.saveGameOption(meta.id, 'level', 'big');
  await store.flushed();
  const again = JSON.parse(m.get(store.SAVE_KEY));
  assert.deepEqual(again.games.piano, { stars: { jacob: 3, kortjakje: 2, elise: 1 }, level: 'big' });
  const moved = sanitizePayload({ v: 1, games: { piano: again.games.piano }, settings: {} });
  assert.deepEqual(moved.games.piano, { stars: { jacob: 3, kortjakje: 2, elise: 1 }, level: 'big' });
  // odd values from another device are dropped or kept small; the game reads only a known level
  const odd = sanitizePayload({ v: 1, games: { piano: { stars: { ode: 'x', turks: 2 }, level: { a: { b: 1 } } } }, settings: {} });
  assert.deepEqual(odd.games.piano, { stars: { turks: 2 }, level: {} });
  assert.equal(P.levelById(odd.games.piano.level), null);
});
