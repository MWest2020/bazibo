import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIZES, SIZE_IDS, pairsOf, newGame, flip, hide, canFlip, mustHide, winners, starsFor, bestGrid, mulberry32, shuffle } from '../web/games/memory/rules.js';
import { emptyMemory, observe, fade, choose } from '../web/games/memory/ai.js';
import { THEMES, THEME_IDS, THEME_SAMPLE, cardPictureSvg } from '../web/games/memory/art.js';
import { meta } from '../web/games/memory/meta.js';

const where = (g, face) => g.cards.flatMap((c, i) => (c.face === face ? [i] : []));

test('the boards: 6, 12, 16 and 20 cards, an even number each', () => {
  assert.deepEqual(SIZE_IDS, ['2x3', '3x4', '4x4', '4x5']);
  assert.deepEqual(SIZE_IDS.map(pairsOf), [3, 6, 8, 10]);
  for (const id of SIZE_IDS) assert.ok(SIZES[id].cols >= SIZES[id].rows);
});

test('every theme has enough different pictures for the biggest board, each with a drawing', () => {
  const biggest = Math.max(...SIZE_IDS.map(pairsOf));
  const all = new Set();
  for (const id of THEME_IDS) {
    assert.ok(new Set(THEMES[id]).size >= biggest, `${id} has only ${THEMES[id].length} pictures`);
    assert.ok(THEMES[id].includes(THEME_SAMPLE[id]));
    for (const pic of THEMES[id]) {
      assert.ok(!all.has(pic), `${pic} is in two themes`);
      all.add(pic);
      assert.match(cardPictureSvg(pic), /^<svg[\s\S]*<\/svg>$/, `${pic} has no drawing`);
    }
  }
});

test('a deal: every picture exactly twice, shuffled, all face down', () => {
  const rand = mulberry32(3);
  for (const size of SIZE_IDS) {
    const g = newGame({ size, faces: THEMES.fruit, rand });
    assert.equal(g.cards.length, SIZES[size].cols * SIZES[size].rows);
    const counts = {};
    for (const c of g.cards) counts[c.face] = (counts[c.face] || 0) + 1;
    assert.equal(Object.keys(counts).length, pairsOf(size));
    assert.ok(Object.values(counts).every((n) => n === 2));
    assert.ok(g.cards.every((c) => !c.up && !c.found));
  }
  // different seeds, different deals; the same seed, the same deal
  const a = newGame({ size: '4x5', faces: THEMES.book, rand: mulberry32(1) }).cards.map((c) => c.face);
  const b = newGame({ size: '4x5', faces: THEMES.book, rand: mulberry32(2) }).cards.map((c) => c.face);
  const a2 = newGame({ size: '4x5', faces: THEMES.book, rand: mulberry32(1) }).cards.map((c) => c.face);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, a2);
  assert.throws(() => newGame({ size: '4x5', faces: ['a', 'b', 'c'] }));
  assert.throws(() => newGame({ size: '9x9', faces: THEMES.fruit }));
  assert.equal(shuffle([1, 2, 3], mulberry32(5)).length, 3);
});

test('a pair stays face up, counts for the finder, and the same player goes on', () => {
  let g = newGame({ size: '2x3', faces: THEMES.fruit, players: 2, rand: mulberry32(9) });
  const [a, b] = where(g, g.cards[0].face);
  let r = flip(g, a);
  assert.equal(r.result, 'first');
  r = flip(r.game, b);
  assert.equal(r.result, 'pair');
  g = r.game;
  assert.ok(g.cards[a].found && g.cards[b].found);
  assert.equal(g.cards[a].by, 0);
  assert.deepEqual(g.scores, [1, 0]);
  assert.equal(g.turn, 0);
  assert.equal(g.turns, 1);
  assert.deepEqual(g.open, []);
  // a found card cannot be turned again
  assert.equal(flip(g, a).result, null);
});

test('a miss: both cards stay up until hide, then go down and the turn passes', () => {
  const g0 = newGame({ size: '3x4', faces: THEMES.shapes, players: 2, rand: mulberry32(4) });
  const a = 0;
  const b = g0.cards.findIndex((c, i) => i !== a && c.face !== g0.cards[a].face);
  let g = flip(flip(g0, a).game, b).game;
  assert.ok(mustHide(g));
  assert.ok(g.cards[a].up && g.cards[b].up);
  // no third card while two are up
  const c = g.cards.findIndex((x, i) => i !== a && i !== b);
  assert.equal(canFlip(g, c), false);
  assert.equal(flip(g, c).result, null);
  g = hide(g);
  assert.ok(!g.cards[a].up && !g.cards[b].up);
  assert.equal(g.turn, 1);
  assert.equal(g.turns, 1);
  // alone the turn never passes
  const s = newGame({ size: '3x4', faces: THEMES.shapes, rand: mulberry32(4) });
  assert.equal(hide(flip(flip(s, a).game, b).game).turn, 0);
  // the same card twice is not a turn
  assert.equal(flip(flip(s, a).game, a).result, null);
  // the rules never change the state they were given
  assert.ok(!g0.cards[a].up);
});

test('the last pair ends the game; most pairs wins, the same number is a draw', () => {
  let g = newGame({ size: '2x3', faces: THEMES.fruit, players: 2, rand: mulberry32(11) });
  const faces = [...new Set(g.cards.map((c) => c.face))];
  // player 0 finds one pair, misses, player 1 finds the other two
  let r = flip(flip(g, where(g, faces[0])[0]).game, where(g, faces[0])[1]);
  g = r.game;
  g = hide(flip(flip(g, where(g, faces[1])[0]).game, where(g, faces[2])[0]).game);
  assert.equal(g.turn, 1);
  g = flip(flip(g, where(g, faces[1])[0]).game, where(g, faces[1])[1]).game;
  r = flip(flip(g, where(g, faces[2])[0]).game, where(g, faces[2])[1]);
  assert.equal(r.result, 'over');
  assert.deepEqual(r.game.scores, [1, 2]);
  assert.deepEqual(r.game.over.winners, [1]);
  assert.equal(flip(r.game, 0).result, null);
  assert.deepEqual(winners([4, 4]), [0, 1]);
  assert.deepEqual(winners([5]), [0]);
});

test('stars alone: by turns, never by time, kind for small boards', () => {
  assert.equal(starsFor(3, 3), 3);
  assert.equal(starsFor(6, 3), 3);
  assert.equal(starsFor(7, 3), 2);
  assert.equal(starsFor(9, 3), 2);
  assert.equal(starsFor(10, 3), 1);
  assert.equal(starsFor(20, 10), 3);
  assert.equal(starsFor(31, 10), 1);
});

test('the grid turns to fit: wide rows on a sideways phone, tall columns upright', () => {
  const up = bestGrid(5, 4, 296, 430);
  assert.deepEqual([up.cols, up.rows], [4, 5]);
  const side = bestGrid(5, 4, 520, 280);
  assert.deepEqual([side.cols, side.rows], [5, 4]);
  // the cards and the gaps fit inside the box
  for (const [w, h] of [[296, 430], [520, 280], [1200, 600], [300, 300]]) {
    for (const id of SIZE_IDS) {
      const { cols, rows, cell } = bestGrid(SIZES[id].cols, SIZES[id].rows, w, h);
      assert.ok(cols * cell + (cols - 1) * cell * 0.12 <= w + 0.01);
      assert.ok(rows * cell + (rows - 1) * cell * 0.12 <= h + 0.01);
    }
  }
  // 20 cards on a 320×568 phone are still big enough to tap
  assert.ok(bestGrid(5, 4, 296, 400).cell >= 60);
});

/**
 * Play a whole game: the computer as in the app, the child as a player who remembers a card it
 * saw with chance `childKeep` (1: never forgets; 0: only guesses) and always goes for a pair it knows.
 */
function playOut(seed, size, childKeep) {
  const rand = mulberry32(seed);
  let g = newGame({ size, faces: THEMES.fruit, players: 2, starter: seed % 2, rand });
  let cpu = emptyMemory();
  let kid = emptyMemory();
  let moves = 0;
  while (!g.over && moves++ < 2000) {
    let i;
    if (g.turn === 1) {
      if (!g.open.length) cpu = fade(cpu, g, rand);
      i = choose(g, cpu, rand);
    } else {
      if (!g.open.length) kid = fade(kid, g, rand, childKeep === 1 ? 0 : 0.2);
      i = choose(g, kid, rand, 1);
    }
    assert.ok(canFlip(g, i), `illegal card ${i} by player ${g.turn}`);
    const r = flip(g, i);
    g = r.game;
    cpu = observe(cpu, g, i, rand);
    kid = observe(kid, g, i, rand, childKeep);
    if (r.result === 'miss') g = hide(g);
  }
  assert.ok(g.over, 'the game never ended');
  return g.over.winners;
}

const childWins = (w) => w.length === 1 && w[0] === 0;

test('the computer only turns cards that may be turned, and every game ends', () => {
  for (let seed = 1; seed <= 200; seed++) playOut(seed, SIZE_IDS[seed % SIZE_IDS.length], [1, 0.5, 0][seed % 3]);
});

test('the computer is gentle: an attentive child nearly always wins, a forgetful one often', () => {
  let attentive = 0;
  let forgetful = 0;
  for (let seed = 1; seed <= 200; seed++) {
    if (childWins(playOut(seed, '4x4', 1))) attentive++;
    if (childWins(playOut(seed + 1000, '3x4', 0.3))) forgetful++;
  }
  assert.ok(attentive >= 170, `a child who remembers everything won only ${attentive} of 200`);
  assert.ok(forgetful >= 60, `a child who remembers a third of the cards won only ${forgetful} of 200`);
});

test('the computer uses what it remembers: a known match is taken', () => {
  let g = newGame({ size: '3x4', faces: THEMES.fruit, players: 2, starter: 1, rand: mulberry32(7) });
  const [a, b] = where(g, g.cards[0].face);
  const mem = { [b]: g.cards[b].face };
  g = flip(g, a).game;
  assert.equal(choose(g, mem, mulberry32(1)), b);
  // remembering both halves of a pair: it goes for it (when the dice say so)
  const fresh = newGame({ size: '3x4', faces: THEMES.fruit, players: 2, starter: 1, rand: mulberry32(7) });
  assert.equal(choose(fresh, { [a]: fresh.cards[a].face, [b]: fresh.cards[b].face }, () => 0), a);
  // it forgets found cards
  const found = flip(flip(fresh, a).game, b).game;
  assert.deepEqual(fade({ [a]: 'x', [b]: 'x' }, found, () => 0.99), {});
  // observe keeps a card only sometimes
  assert.deepEqual(observe(emptyMemory(), fresh, 3, () => 0.9), {});
  assert.deepEqual(observe(emptyMemory(), fresh, 3, () => 0.1), { 3: fresh.cards[3].face });
});

test('the free part: the two smallest boards with fruit; the full version opens the rest', () => {
  assert.equal(meta.group, 'puzzles');
  for (const mode of ['solo', 'duo', 'cpu']) {
    assert.equal(meta.isLocked({ size: '2x3', theme: 'fruit', mode }, false), false);
    assert.equal(meta.isLocked({ size: '3x4', theme: 'fruit', mode }, false), false);
    assert.equal(meta.isLocked({ size: '4x4', theme: 'fruit', mode }, false), true);
    assert.equal(meta.isLocked({ size: '2x3', theme: 'book', mode }, false), true);
    assert.equal(meta.isLocked({ size: '4x5', theme: 'shapes', mode }, true), false);
  }
});
