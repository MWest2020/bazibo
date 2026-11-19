import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMaze, distances, exits, beside, isOpen, neighbours, DIR_NAMES, OPPOSITE, firstStep } from '../web/games/doolhof/maze.js';
import * as R from '../web/games/doolhof/rules.js';
import { hogSvg, crowSvg, modeSvg, tileSvg, glyphPx } from '../web/games/doolhof/art.js';
import { meta } from '../web/games/doolhof/meta.js';
import { rng } from '../web/games/letters/round.js';
import { ALPHABET, lookalike, similar, pictureOf } from '../web/games/letters/words.js';
import { PICTURE_IDS } from '../web/games/letters/art.js';

const SEEDS = 200;
const LANGS = ['nl', 'en'];
const cells = (s) => [...Array(s.cols * s.rows).keys()];
const anyLook = (l) => [...lookalike(l), ...similar(l)];

/**
 * Every round we test: each kind, tier and language, upright and sideways, fixed and random.
 * `both`: every seed upright and sideways (n per orientation) instead of taking turns.
 */
function* rounds(n = SEEDS, both = false) {
  for (const mode of R.MODES) {
    for (const tier of R.TIER_IDS) {
      for (const lang of LANGS) {
        for (let seed = 1; seed <= n; seed++) {
          for (const landscape of both ? [false, true] : [seed % 2 === 0]) yield { mode, tier, lang, seed, landscape, round: seed % 4 };
        }
      }
    }
  }
}

/** The board's promises, checked after every step of a round. */
function checkBoard(s, where) {
  const n = s.cols * s.rows;
  const seen = new Set();
  const values = new Set();
  for (const t of s.tiles) {
    assert.ok(Number.isInteger(t.cell) && t.cell >= 0 && t.cell < n, `${where}: a tile outside the garden (${t.cell})`);
    assert.ok(exits(s.maze, t.cell).length >= 2, `${where}: a tile in a cell without a way in and out`);
    assert.ok(!seen.has(t.cell), `${where}: two tiles on one cell`);
    assert.ok(!values.has(t.value), `${where}: ${t.value} twice on the board`);
    assert.notEqual(t.cell, s.hog, `${where}: a tile under the hedgehog`);
    seen.add(t.cell);
    values.add(t.value);
  }
  const landed = s.crows.filter((c) => c.cell >= 0); // -1: out of the garden for a while
  for (const c of landed) {
    assert.ok(c.cell < n, `${where}: a crow outside the garden (${c.cell})`);
    assert.ok(!seen.has(c.cell), `${where}: a crow on a tile`);
    assert.notEqual(c.cell, s.hog, `${where}: a crow on the hedgehog`);
  }
  for (const c of s.crows) assert.ok(Number.isInteger(c.cell) && c.cell >= -1, `${where}: a crow at ${c.cell}`);
  assert.equal(new Set(landed.map((c) => c.cell)).size, landed.length, `${where}: two crows on one cell`);
  // the promise: always a way to the right tile that no crow stands on
  if (!s.over) assert.ok(R.hasFreeWay(s), `${where}: no crow-free way to ${R.expected(s)} (hedgehog ${s.hog}, crows ${s.crows.map((c) => c.cell)})`);
  // every cell without a tile can be reached without walking over a tile, and every tile from such a cell
  assert.ok(R.placementOk(s), `${where}: a tile cuts the garden in two`);
  if (!s.over) assert.ok(R.targetTile(s), `${where}: the letter to find (${R.expected(s)}) is not on the board`);
}

/** A sane number of steps for a whole round: a few gardens' worth per letter. */
const budgetFor = (s) => 40 * s.seq.length + 40;

/**
 * Play a round to the end like a child. `greedy` knows the way: it walks (to the next crossing)
 * towards the right tile, around the crows when that is not much longer, and else straight into
 * them. `cautious` never steps into a crow: it only takes a way no crow stands on. The crows step
 * every other hedgehog step (faster than in the game). Every step keeps the board's promises and
 * the round must end within `budgetFor`.
 */
function play(s, where, policy = 'greedy') {
  const budget = budgetFor(s);
  let steps = 0;
  let away = 0; // crow steps in a row with a crow out of the garden
  let walked = 0; // crow steps that went somewhere
  let crowSteps = 0;
  const events = [];
  const choose = () => {
    if (policy === 'greedy') return R.pathDirection(s);
    const target = R.targetTile(s);
    const blocked = new Set([...s.tiles.filter((t) => t !== target).map((t) => t.cell), ...s.crows.map((c) => c.cell)]);
    return firstStep(s.maze, s.hog, target.cell, blocked);
  };
  checkBoard(s, where);
  while (!s.over && steps < budget) {
    const d = choose();
    assert.ok(d, `${where}: no ${policy === 'cautious' ? 'crow-free ' : ''}way to ${R.expected(s)}`);
    let dir = d;
    let auto = false;
    while (dir) {
      if (policy === 'cautious') assert.equal(R.crowAt(s, beside(s.maze, s.hog, dir)), -1, `${where}: the cautious child's way runs into a crow`);
      const e = R.stepHog(s, dir, { auto });
      events.push(e.type);
      steps++;
      if (steps % 2 === 0) {
        const was = s.crows.map((c) => c.cell);
        R.stepCrows(s);
        walked += s.crows.filter((c, k) => c.cell >= 0 && c.cell !== was[k]).length;
        crowSteps += s.crows.length;
        away = s.crows.some((c) => c.cell < 0) ? away + 1 : 0;
        assert.ok(away < 40, `${where}: a crow stayed out of the garden for 40 steps`);
      }
      checkBoard(s, where);
      if (e.type !== 'move') break;
      dir = R.continueDir(s, dir); // like the game: a walk goes on to the next crossing
      auto = true;
    }
  }
  assert.ok(s.over, `${where}: the ${policy} child did not finish in ${budget} steps (${s.i} of ${s.seq.length})`);
  return { steps, events, walked, crowSteps };
}

// ---------- the garden ----------

test('maze: every garden is one piece, without dead ends, with matching hedges on both sides', () => {
  for (const tier of R.TIER_IDS) {
    for (const landscape of [false, true]) {
      const [short, long] = R.SIZES[tier];
      const [cols, rows] = landscape ? [long, short] : [short, long];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const maze = makeMaze(cols, rows, rng(seed));
        const where = `${tier} ${cols}x${rows} seed ${seed}`;
        const dist = distances(maze, 0);
        for (let c = 0; c < cols * rows; c++) {
          assert.ok(dist[c] >= 0, `${where}: cell ${c} cannot be reached`);
          assert.ok(exits(maze, c).length >= 2, `${where}: cell ${c} is a dead end`);
          for (const d of DIR_NAMES) {
            const to = beside(maze, c, d);
            if (to < 0) assert.ok(!isOpen(maze, c, d), `${where}: cell ${c} opens out of the garden (${d})`);
            else assert.equal(isOpen(maze, c, d), isOpen(maze, to, OPPOSITE[d]), `${where}: the hedge between ${c} and ${to} differs per side`);
          }
        }
        // not an open field: there are hedges inside the garden
        const inner = cols * rows * 4 - 2 * (cols + rows);
        const gaps = Array.from({ length: cols * rows }, (_, c) => exits(maze, c).length).reduce((a, b) => a + b, 0);
        assert.ok(gaps < inner * 0.9, `${where}: hardly any hedges (${gaps} of ${inner})`);
      }
    }
  }
});

test('maze: the same seed makes the same garden; firstStep finds a shortest way around blocked cells', () => {
  const a = makeMaze(5, 7, rng(42));
  const b = makeMaze(5, 7, rng(42));
  assert.deepEqual([...a.open], [...b.open]);
  const dist = distances(a, 0);
  for (let to = 1; to < 35; to++) {
    const d = firstStep(a, 0, to);
    const next = beside(a, 0, d);
    assert.ok(isOpen(a, 0, d));
    assert.equal(distances(a, next)[to], dist[to] - 1, `the way to ${to} is not a shortest one`);
  }
});

// ---------- rounds ----------

test('rounds: what each kind and tier asks for', () => {
  const seq = (mode, tier, round, lang = 'nl') => R.createRound({ mode, tier, lang, seed: 7, round }).seq;
  assert.deepEqual(seq('abc', 't1', 1), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(seq('abc', 't2', 1), ALPHABET.slice(0, 10));
  assert.deepEqual(seq('abc', 't2', 2), ALPHABET.slice(10, 20));
  assert.deepEqual(seq('abc', 't2', 3), ALPHABET.slice(16, 26));
  assert.deepEqual(seq('abc', 't3', 2), ALPHABET);
  for (let s = 1; s <= SEEDS; s++) {
    const r = R.createRound({ mode: 'abc', tier: 't2', seed: s, round: 0 }).seq; // random: any 10 in a row
    assert.equal(r.length, 10);
    assert.equal(r.join(''), ALPHABET.join('').slice(ALPHABET.indexOf(r[0]), ALPHABET.indexOf(r[0]) + 10));
  }
  assert.deepEqual(seq('count', 't1', 1), ['1', '2', '3', '4', '5']);
  assert.deepEqual(seq('count', 't2', 2), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  assert.deepEqual(seq('count', 't3', 3), ['2', '4', '6', '8', '10', '12', '14', '16', '18', '20']);
  for (const lang of LANGS) {
    for (const tier of R.TIER_IDS) {
      const list = R.wordList(lang, tier);
      assert.ok(list.length >= R.WORDS_PER_ROUND, `${lang} ${tier}: too few words`);
      for (const w of list) {
        assert.ok(PICTURE_IDS.includes(pictureOf(lang, w)), `${lang} ${w}: no picture`);
        assert.match(w, /^[a-z]+$/);
        if (tier === 't1') assert.equal(w.length, 3, `${lang} ${w}: tier 1 words have three letters`);
        if (tier === 't3') assert.ok(w.length >= 5, `${lang} ${w}: tier 3 words are long`);
      }
      for (let s = 1; s <= 50; s++) {
        const r = R.createRound({ mode: 'word', tier, lang, seed: s });
        assert.equal(r.words.length, R.WORDS_PER_ROUND);
        assert.equal(new Set(r.words.map((w) => w.word)).size, R.WORDS_PER_ROUND, 'a word twice in one round');
        assert.equal(r.seq.join(''), r.words.map((w) => w.word).join(''));
        assert.equal(R.currentWord(r).word, r.words[0].word);
      }
    }
  }
});

test('rounds: the same seed and orientation give the same round; fixed rounds differ per orientation', () => {
  const a = R.createRound({ mode: 'word', tier: 't2', lang: 'en', seed: R.roundSeed('word-t2-1', 'en', false), round: 1 });
  const b = R.createRound({ mode: 'word', tier: 't2', lang: 'en', seed: R.roundSeed('word-t2-1', 'en', false), round: 1 });
  assert.deepEqual([a.seq, a.tiles, a.crows, a.hog], [b.seq, b.tiles, b.crows, b.hog]);
  assert.notEqual(R.roundSeed('abc-t1-1', 'nl', false), R.roundSeed('abc-t1-1', 'nl', true));
  const side = R.createRound({ mode: 'abc', tier: 't3', seed: 3, landscape: true });
  assert.deepEqual([side.cols, side.rows], [R.SIZES.t3[1], R.SIZES.t3[0]]);
});

test('rounds: every board keeps its promises at the start (letters reachable, none in a hedge, crows far away)', () => {
  for (const r of rounds()) {
    const s = R.createRound(r);
    const where = `${r.mode} ${r.tier} ${r.lang} seed ${r.seed}`;
    checkBoard(s, where);
    assert.equal(s.crows.length, R.CROWS[r.tier], `${where}: crows`);
    const dist = distances(s.maze, s.hog);
    for (const c of s.crows) assert.ok(dist[c.cell] >= 2, `${where}: a crow starts next to the hedgehog`);
    for (const t of s.tiles) assert.ok(dist[t.cell] >= 1, `${where}: a tile on the start`);
    // the window: the next letters are all there, the wrong ones are the tier's number
    const end = R.windowEnd(s);
    const win = new Set(s.seq.slice(0, end));
    for (const v of win) assert.ok(s.tiles.some((t) => t.value === v), `${where}: ${v} of the window is missing`);
    const wrong = s.tiles.filter((t) => !win.has(t.value));
    assert.equal(wrong.length, R.DECOYS[r.mode][r.tier], `${where}: ${wrong.length} wrong tiles`);
  }
});

test('rounds: wrong tiles by tier: plain in tier 1, look-alikes in tier 2, mirrored ones first in tier 3', () => {
  let looks2 = 0;
  let mirrors3 = 0;
  let odd3 = 0;
  for (const lang of LANGS) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const mode of ['abc', 'word']) {
        const t1 = R.createRound({ mode, tier: 't1', lang, seed });
        const win1 = t1.seq.slice(0, R.windowEnd(t1));
        for (const t of t1.tiles.filter((x) => !win1.includes(x.value))) {
          assert.ok(!win1.includes(t.value), `t1 ${mode}: ${t.value} is part of the word`);
          assert.ok(!win1.some((l) => anyLook(l).includes(t.value) || anyLook(t.value).includes(l)), `t1 ${mode}: ${t.value} looks like a letter of ${win1.join('')}`);
        }
        const t2 = R.createRound({ mode, tier: 't2', lang, seed });
        const win2 = t2.seq.slice(0, R.windowEnd(t2));
        const wrong2 = t2.tiles.filter((x) => !win2.includes(x.value)).map((x) => x.value);
        if (wrong2.some((v) => win2.some((l) => anyLook(l).includes(v)))) looks2++;
        const t3 = R.createRound({ mode, tier: 't3', lang, seed });
        const win3 = t3.seq.slice(0, R.windowEnd(t3));
        const wrong3 = t3.tiles.filter((x) => !win3.includes(x.value)).map((x) => x.value);
        if (wrong3.some((v) => win3.some((l) => lookalike(l).includes(v)))) mirrors3++;
      }
      const c3 = R.createRound({ mode: 'count', tier: 't3', lang, seed });
      if (c3.tiles.some((t) => Number(t.value) % 2 === 1)) odd3++;
      for (const t of c3.tiles) assert.match(t.value, /^[1-9][0-9]?$/, `count: ${t.value} is not a plain number`);
    }
  }
  const total = LANGS.length * SEEDS * 2;
  assert.ok(looks2 >= total * 0.95, `tier 2: look-alikes in only ${looks2} of ${total} rounds`);
  assert.ok(mirrors3 >= total * 0.6, `tier 3: mirrored letters in only ${mirrors3} of ${total} rounds`);
  assert.ok(odd3 >= LANGS.length * SEEDS * 0.95, `counting in twos: odd numbers in only ${odd3} rounds`);
});

for (const policy of ['greedy', 'cautious']) {
  test(`rounds: always a crow-free way; a ${policy} child finishes every round, crows walking (200 seeds per kind, tier, language and orientation)`, () => {
    let touches = 0;
    let played = 0;
    let walked = 0;
    let crowSteps = 0;
    for (const r of rounds(SEEDS, true)) {
      const s = R.createRound(r);
      const where = `${policy} ${r.mode} ${r.tier} ${r.lang} ${r.landscape ? 'side' : 'up'} seed ${r.seed}`;
      const got = play(s, where, policy);
      const { events } = got;
      walked += got.walked;
      crowSteps += got.crowSteps;
      assert.equal(s.i, s.seq.length);
      assert.equal(s.mistakes, 0, `${where}: the child bumped into a wrong tile`);
      assert.ok(!events.includes('wrong') && !events.includes('wait'));
      touches += events.filter((e) => e === 'crow').length;
      assert.equal(R.starsFor(s.mistakes), 3, `${where}: crows cost stars`);
      played++;
    }
    assert.equal(played, R.MODES.length * R.TIER_IDS.length * LANGS.length * SEEDS * 2);
    // the crows keep walking about the garden; they are not parked out of the way
    assert.ok(walked > crowSteps * 0.8, `the crows walked only ${walked} of ${crowSteps} steps`);
    if (policy === 'greedy') assert.ok(touches > 0, 'the crows never came in the way');
    else assert.equal(touches, 0, 'the cautious child walked into a crow');
  });
}

test('rounds: a word round spells word after word, and a letter that comes twice waits its turn', () => {
  const s = R.createRound({ mode: 'word', tier: 't3', lang: 'nl', seed: 5 });
  s.words = [{ word: 'appel', picture: 'apple', from: 0, to: 5 }, { word: 'bloem', picture: 'flower', from: 5, to: 10 }];
  s.seq = [...'appelbloem'];
  s.tiles = [];
  s.i = 0;
  R.refill(s);
  const on = () => s.tiles.map((t) => t.value);
  assert.deepEqual(['a', 'p', 'e', 'l'].filter((v) => on().includes(v)), ['a', 'p', 'e', 'l']);
  assert.ok(!on().includes('b') || R.DECOYS.word.t3 > 0, 'the next word waits');
  assert.equal(on().filter((v) => v === 'p').length, 1, 'one p at a time');
  const { events } = play(s, 'appel bloem');
  assert.ok(s.over);
  assert.ok(events.includes('eat'));
});

test('tier 1 wrong tiles are plain on every step: never a look-alike of the letters or numbers asked for', () => {
  const looksLetter = (a, b) => anyLook(a).includes(b) || anyLook(b).includes(a);
  const looksNumber = (a, b) => (R.NUMBER_LOOKALIKE[a] || []).includes(b) || (R.NUMBER_LOOKALIKE[b] || []).includes(a);
  let words = 0;
  for (const mode of R.MODES) {
    for (const lang of LANGS) {
      for (let seed = 1; seed <= 300; seed++) {
        const s = R.createRound({ mode, tier: 't1', lang, seed, landscape: seed % 2 === 0, round: seed % 4 });
        const where = `${mode} t1 ${lang} seed ${seed}`;
        const check = () => {
          const win = s.seq.slice(s.i, R.windowEnd(s));
          const asked = mode === 'word' ? win : s.seq;
          for (const t of s.tiles) {
            if (win.includes(t.value)) continue;
            assert.ok(!asked.includes(t.value), `${where} at ${s.i}: ${t.value} is part of ${asked.join('')}`);
            const look = asked.find((v) => (mode === 'count' ? looksNumber(v, t.value) : looksLetter(v, t.value)));
            assert.equal(look, undefined, `${where} at ${s.i}: ${t.value} looks like the ${look} of ${asked.join('')}`);
          }
        };
        check();
        let steps = 0;
        while (!s.over && steps++ < 4000) {
          const e = R.stepHog(s, R.pathDirection(s));
          if (e.word) words++;
          if (steps % 2 === 0) R.stepCrows(s);
          check();
        }
        assert.ok(s.over, `${where}: not finished`);
      }
    }
  }
  assert.ok(words > 1000, `only ${words} word changes seen`);
});

test('a walk going on by itself stops in front of a crow that stepped in, and in front of a wrong letter', () => {
  let crowsTested = 0;
  let wrongTested = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const s = R.createRound({ mode: 'abc', tier: 't2', seed });
    s.crows = s.crows.slice(0, 1);
    s.started = true;
    // a cell next to the hedgehog without a tile, and a crow put there between two steps
    const d = exits(s.maze, s.hog).find((x) => !R.tileAt(s, beside(s.maze, s.hog, x)));
    if (!d) continue;
    const ahead = beside(s.maze, s.hog, d);
    s.crows[0].cell = ahead;
    const before = { hog: s.hog, touches: s.touches, crow: ahead };
    assert.deepEqual(R.stepHog(s, d, { auto: true }), { type: 'stop' }, `seed ${seed}: an automatic step walked into a crow`);
    assert.deepEqual([s.hog, s.touches, s.crows[0].cell], [before.hog, 0, ahead]);
    assert.equal(R.stepHog(s, d).type, 'crow', 'a chosen step into a crow still touches it'); // the child's own step
    crowsTested++;
  }
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { s, d, wrong } = withWrongBeside(seed);
    if (!s) continue;
    const hog = s.hog;
    assert.deepEqual(R.stepHog(s, d, { auto: true }), { type: 'stop' }, `seed ${seed}: an automatic step bumped ${wrong.value}`);
    assert.deepEqual([s.hog, s.mistakes, s.bumps], [hog, 0, 0]);
    // every corridor cell next to a wrong tile: a walk round its bend stops in front of the tile
    for (let c = 0; c < s.cols * s.rows; c++) {
      if (R.tileAt(s, c) || R.crowAt(s, c) >= 0 || exits(s.maze, c).length !== 2) continue;
      for (const toTile of exits(s.maze, c)) {
        const t = R.tileAt(s, beside(s.maze, c, toTile));
        if (!t || t.value === R.expected(s)) continue;
        const other = exits(s.maze, c).find((x) => x !== toTile);
        s.hog = c;
        assert.equal(R.continueDir(s, OPPOSITE[other]), null, `seed ${seed}: a walk goes on into ${t.value}`);
      }
    }
    s.hog = hog;
    wrongTested++;
  }
  assert.ok(crowsTested > SEEDS * 0.9 && wrongTested > SEEDS * 0.3, `${crowsTested} crows, ${wrongTested} wrong letters tested`);
});

// ---------- the two kind rules ----------

/** A round with one wrong tile right next to the hedgehog (and the crows out of the way). */
function withWrongBeside(only = 0) {
  for (let seed = only || 1; seed < (only ? only + 1 : 500); seed++) {
    const s = R.createRound({ mode: 'abc', tier: 't1', seed });
    s.crows = [];
    for (const d of exits(s.maze, s.hog)) {
      const c = beside(s.maze, s.hog, d);
      const wrong = s.tiles.find((t) => t.value !== R.expected(s));
      if (R.tileAt(s, c)) continue;
      const from = wrong.cell;
      wrong.cell = -1;
      if (R.placementOk(s, c)) {
        wrong.cell = c;
        return { s, d, wrong };
      }
      wrong.cell = from;
    }
  }
  if (only) return {};
  throw new Error('no round with room for a wrong tile');
}

test('a wrong letter is a soft bump: nothing moves, nothing is eaten, one mistake per letter, then help', () => {
  const { s, d, wrong } = withWrongBeside();
  const hog = s.hog;
  const tiles = JSON.stringify(s.tiles);
  const e = R.stepHog(s, d);
  assert.deepEqual(e, { type: 'wrong', value: wrong.value, want: 'a' });
  assert.equal(s.hog, hog, 'the hedgehog moved onto a wrong tile');
  assert.equal(JSON.stringify(s.tiles), tiles, 'a wrong tile was eaten or moved');
  assert.equal(s.mistakes, 1);
  assert.equal(R.helpOn(s), false);
  assert.equal(R.stepHog(s, d).type, 'wrong');
  assert.equal(s.mistakes, 1, 'a second bump for the same letter counted again');
  assert.equal(R.helpOn(s), true, 'no help after two bumps');
  assert.equal(R.starsFor(s.mistakes), 2);
  assert.equal(R.continueDir(s, d), null);
  // the right letter: eaten, the help stops, the next one counts on its own
  play(s, 'after the bump');
  assert.equal(s.mistakes, 1);
  assert.ok(s.over);
});

test('a crow: a walk stops in front of it; a step into it makes it flutter off, the hedgehog stays, nothing is lost', () => {
  let tested = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const s = R.createRound({ mode: 'abc', tier: 't3', seed, landscape: seed % 2 === 0 });
    for (let k = 0; k < 6 && !s.over; k++) R.stepHog(s, R.pathDirection(s));
    if (s.over) continue;
    const d = exits(s.maze, s.hog).find((x) => {
      const c = beside(s.maze, s.hog, x);
      return !R.tileAt(s, c) && R.crowAt(s, c) < 0;
    });
    if (!d) continue;
    const crowCell = beside(s.maze, s.hog, d);
    s.crows[0].cell = crowCell;
    s.crows[0].prev = -1;
    // walking towards it from behind stops in front of it
    if (exits(s.maze, s.hog).length === 2) assert.equal(R.continueDir(s, d), null, `seed ${seed}: a walk ran into a crow`);
    assert.deepEqual(R.stepHog(s, d, { auto: true }), { type: 'stop' });
    const before = { i: s.i, tiles: JSON.stringify(s.tiles), mistakes: s.mistakes, hog: s.hog, other: s.crows[1].cell };
    const e = R.stepHog(s, d);
    assert.deepEqual(e, { type: 'crow', crow: 0, from: crowCell, to: s.crows[0].cell }, `seed ${seed}`);
    assert.equal(s.hog, before.hog, `seed ${seed}: the hedgehog moved (rolled back?)`);
    assert.deepEqual([s.i, JSON.stringify(s.tiles), s.mistakes], [before.i, before.tiles, before.mistakes], `seed ${seed}: a crow cost something`);
    assert.equal(s.crows[1].cell, before.other, `seed ${seed}: the other crow moved`);
    assert.equal(s.touches, 1);
    const at = s.crows[0].cell;
    assert.notEqual(at, crowCell, `seed ${seed}: the crow stayed`);
    if (at >= 0) {
      const dist = distances(s.maze, s.hog);
      assert.ok(dist[at] >= 2, `seed ${seed}: the crow landed ${dist[at]} steps away`);
      // off the hedgehog's way: its crow-free way is as short as without the crow
      assert.equal(R.freeDistance(s), R.freeDistance(s, [s.crows[1].cell]), `seed ${seed}: the crow landed on the hedgehog's way`);
    }
    checkBoard(s, `seed ${seed} after a crow`);
    // the hedgehog can walk on at once: the next step is a real one
    assert.notEqual(R.stepHog(s, d).type, 'wait', `seed ${seed}: the hedgehog has to wait`);
    play(s, `seed ${seed} after a crow`);
    assert.equal(R.starsFor(s.mistakes), 3, 'a crow cost a star');
    tested++;
  }
  assert.ok(tested >= SEEDS * 0.8, `only ${tested} crow touches tested`);
  assert.equal(R.ROLLBACK, undefined, 'there is no rolling back any more');
});

test('a crow on the only way (a new letter landed behind it) flies off at once, the nearest one first', () => {
  let tested = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const s = R.createRound({ mode: 'count', tier: 't3', seed, landscape: seed % 2 === 1 });
    s.started = true;
    const target = R.targetTile(s);
    // put crows on the way until there is none
    const blocked = new Set(s.tiles.filter((t) => t !== target).map((t) => t.cell));
    const cut = [];
    for (let k = 0; k < s.crows.length && R.hasFreeWay(s, cut); k++) {
      const d = firstStep(s.maze, s.hog, target.cell, new Set([...blocked, ...cut]));
      let c = beside(s.maze, s.hog, d);
      // one step further along when it can, so it is not next to the hedgehog
      const d2 = c !== target.cell && firstStep(s.maze, c, target.cell, new Set([...blocked, ...cut]));
      if (d2 && beside(s.maze, c, d2) !== target.cell) c = beside(s.maze, c, d2);
      if (c === target.cell) break;
      cut.push(c);
    }
    if (R.hasFreeWay(s, cut)) continue;
    cut.forEach((c, k) => (s.crows[k].cell = c));
    const flew = R.keepWay(s);
    assert.ok(flew.length >= 1, `seed ${seed}: no crow flew`);
    assert.ok(R.hasFreeWay(s), `seed ${seed}: still no way`);
    checkBoard(s, `seed ${seed} after keepWay`);
    for (const k of flew) assert.notEqual(s.crows[k].cell, cut[k], `seed ${seed}: crow ${k} flew to where it was`);
    // and stepCrows does the same by itself
    cut.forEach((c, k) => (s.crows[k].cell = c));
    R.stepCrows(s);
    assert.ok(R.hasFreeWay(s), `seed ${seed}: the crows' step kept no way`);
    tested++;
  }
  assert.ok(tested >= SEEDS * 0.5, `only ${tested} blocked ways tested`);
});

test('crows never trap the hedgehog: never onto it, next to it, a tile, each other or its way; they only wait when they must', () => {
  let stood = 0;
  let steps = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    for (const landscape of [false, true]) {
      const s = R.createRound({ mode: 'count', tier: 't3', seed, landscape });
      s.started = true;
      for (let k = 0; k < 300; k++) {
        const before = s.crows.map((c) => c.cell);
        const free = R.freeDistance(s);
        R.stepCrows(s);
        const where = `seed ${seed} ${landscape ? 'side' : 'up'} crow step ${k}`;
        checkBoard(s, where);
        assert.ok(R.freeDistance(s) <= free, `${where}: a crow made the hedgehog's way longer`);
        const nearHog = neighbours(s.maze, s.hog);
        s.crows.forEach((c, j) => {
          if (c.cell !== before[j]) {
            assert.ok(neighbours(s.maze, before[j]).includes(c.cell), `${where}: a crow jumped`);
            assert.ok(!nearHog.includes(c.cell), `${where}: a crow stepped next to the hedgehog`);
            return;
          }
          // it waited: only when every step was onto the hedgehog, next to it, a tile, a crow or its way
          stood++;
          const now = s.crows.map((x, i) => (i < j ? x.cell : before[i]));
          const free = R.freeDistance(s, now);
          for (const to of neighbours(s.maze, c.cell)) {
            const after = R.freeDistance(s, now.map((x, i) => (i === j ? to : x)));
            const ok = to !== s.hog && !nearHog.includes(to) && !R.tileAt(s, to) && !now.includes(to) && after >= 0 && after <= free;
            assert.ok(!ok, `${where}: crow ${j} waited although it could step to ${to}`);
          }
        });
        steps += s.crows.length;
      }
      assert.ok(R.placementOk(s), `seed ${seed}: a tile cut off`);
    }
  }
  // with the hedgehog standing still most crows still find room to walk
  assert.ok(stood < steps * 0.4, `the crows waited ${stood} of ${steps} steps`);
  // they wait for the hedgehog's first step
  const s = R.createRound({ mode: 'abc', tier: 't3', seed: 1 });
  const at = s.crows.map((c) => c.cell);
  R.stepCrows(s);
  assert.deepEqual(s.crows.map((c) => c.cell), at);
});

test('walking: a walk goes round bends and stops at crossings and hedges', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const s = R.createRound({ mode: 'abc', tier: 't2', seed });
    s.crows = [];
    s.tiles = [];
    for (const c of cells(s)) {
      s.hog = c;
      for (const d of DIR_NAMES) {
        const next = R.continueDir(s, d);
        const ways = exits(s.maze, c).filter((x) => x !== OPPOSITE[d]);
        assert.equal(next, ways.length === 1 ? ways[0] : null, `seed ${seed} cell ${c} ${d}`);
      }
    }
    s.hog = 0;
    const shut = DIR_NAMES.find((d) => !isOpen(s.maze, 0, d));
    assert.deepEqual(R.stepHog(s, shut), { type: 'blocked' });
    assert.equal(s.started, false, 'a hedge started the crows');
  }
});

test('stars count wrong letters only, never crows or time', () => {
  assert.deepEqual([0, 1, 2, 3, 9].map(R.starsFor), [3, 2, 2, 1, 1]);
});

test('meta: tier 1 of every kind is free, the rest needs the full version', () => {
  for (const mode of R.MODES) {
    assert.equal(meta.isLocked({ mode, tier: 't1' }, false), false);
    assert.equal(meta.isLocked({ mode, tier: 't2' }, false), true);
    assert.equal(meta.isLocked({ mode, tier: 't3' }, false), true);
    assert.equal(meta.isLocked({ mode, tier: 't3' }, true), false);
  }
  assert.equal(meta.group, 'learning');
});

test('pictures: self-contained SVG, readable glyphs', () => {
  for (const svg of [hogSvg(), crowSvg(), tileSvg(), ...R.MODES.map(modeSvg)]) {
    assert.match(svg, /^<svg [^>]*viewBox=/);
    assert.doesNotMatch(svg, /\bid=|url\(|href|NaN|undefined/);
  }
  // at the smallest garden cell on a 320 px phone (about 40 px) letters and two-digit numbers stay 14 px or more
  assert.ok(glyphPx(40, 'a') >= 14 && glyphPx(40, '12') >= 14);
});
