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
  assert.deepEqual(P.SONG_IDS, ['jacob', 'kortjakje', 'maan', 'vreugde']);
  assert.equal(new Set(P.SONG_IDS).size, P.SONG_IDS.length);
  const whites = new Set(P.WHITE_KEYS.map((k) => k.id));
  for (const s of P.SONGS) {
    assert.ok(s.notes.length >= 20 && s.notes.length <= 60, `${s.id}: ${s.notes.length} notes`);
    for (const n of s.notes) assert.ok(whites.has(n.key), `${s.id} uses ${n.key}: songs stay on the coloured keys`);
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

test('free part: free play and Vader Jacob; every other song only with the full version', () => {
  assert.equal(meta.id, 'piano');
  assert.equal(meta.group, 'creative');
  assert.deepEqual([...meta.freeSongs], [P.SONG_IDS[0]]);
  assert.equal(meta.isLocked('jacob', false), false);
  for (const id of P.SONG_IDS.slice(1)) {
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
        const wrong = n.key === 'c' ? 'd' : 'c';
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
  for (const svg of [tileSvg(), cardSvg('free'), ...P.SONG_IDS.map(cardSvg)]) {
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
  const moved = sanitizePayload({ v: 1, games: { piano: saved.games.piano }, settings: {} });
  assert.deepEqual(moved.games.piano, { stars: { jacob: 3, kortjakje: 2 } });
});
