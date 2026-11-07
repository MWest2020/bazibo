import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARDS, emptyBoard, drop, landingRow, validCols, winAt, findWin, isFull, winningCols, other } from '../web/games/vier/rules.js';
import { chooseMove, evaluate } from '../web/games/vier/ai.js';
import { meta } from '../web/games/vier/meta.js';
import { winKey, childAlwaysStarts } from '../web/games/vier/vier.js';

const BIG = BOARDS.big;
const SMALL = BOARDS.small;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Play a list of columns, alternating players from 1; returns the board and the last drop. */
function play(cfg, moves) {
  let board = emptyBoard(cfg);
  let last = null;
  moves.forEach((c, k) => {
    last = drop(board, cfg, c, (k % 2) + 1);
    assert.ok(last, `column ${c} is full`);
    board = last.board;
  });
  return { board, last };
}

test('boards: 7×6 four in a row, 5×4 three in a row', () => {
  assert.deepEqual([BIG.cols, BIG.rows, BIG.need], [7, 6, 4]);
  assert.deepEqual([SMALL.cols, SMALL.rows, SMALL.need], [5, 4, 3]);
});

test('tokens drop to the lowest empty cell; a full column takes nothing', () => {
  let board = emptyBoard(BIG);
  assert.equal(landingRow(board, BIG, 3), 5);
  for (let k = 0; k < 6; k++) board = drop(board, BIG, 3, (k % 2) + 1).board;
  assert.equal(landingRow(board, BIG, 3), -1);
  assert.equal(drop(board, BIG, 3, 1), null);
  assert.deepEqual(validCols(board, BIG), [0, 1, 2, 4, 5, 6]);
  assert.equal(drop(board, BIG, 7, 1), null);
});

test('win detection: horizontal, vertical and both diagonals on the big board', () => {
  // horizontal along the bottom: 1 plays 0,1,2,3; 2 plays on top of them
  let { board, last } = play(BIG, [0, 0, 1, 1, 2, 2, 3]);
  assert.deepEqual(winAt(board, BIG, last.index), [35, 36, 37, 38]);
  // vertical in column 4
  ({ board, last } = play(BIG, [4, 5, 4, 5, 4, 5, 4]));
  assert.equal(winAt(board, BIG, last.index).length, 4);
  // diagonal up-right (/): 1 at (5,0) (4,1) (3,2) (2,3)
  ({ board, last } = play(BIG, [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]));
  assert.deepEqual(winAt(board, BIG, last.index), [2 * 7 + 3, 3 * 7 + 2, 4 * 7 + 1, 5 * 7 + 0]);
  // diagonal down-right (\): 1 at (2,3) (3,4) (4,5) (5,6)
  ({ board, last } = play(BIG, [6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]));
  assert.deepEqual(winAt(board, BIG, last.index), [2 * 7 + 3, 3 * 7 + 4, 4 * 7 + 5, 5 * 7 + 6]);
  assert.equal(findWin(board, BIG).player, 1);
});

test('three in a row does not win the big board; it does win the small one', () => {
  let { board, last } = play(BIG, [0, 0, 1, 1, 2]);
  assert.equal(winAt(board, BIG, last.index), null);
  ({ board, last } = play(SMALL, [0, 0, 1, 1, 2]));
  assert.deepEqual(winAt(board, SMALL, last.index), [15, 16, 17]);
  // small diagonal
  ({ board, last } = play(SMALL, [0, 1, 1, 2, 2, 4, 2]));
  assert.deepEqual(winAt(board, SMALL, last.index), [1 * 5 + 2, 2 * 5 + 1, 3 * 5 + 0]);
});

test('a full board without a row is a draw', () => {
  // small board filled column-pair by column-pair so nobody gets three
  const order = [0, 1, 0, 1, 1, 0, 1, 0, 2, 3, 2, 3, 3, 2, 3, 2, 4, 4, 4, 4];
  let board = emptyBoard(SMALL);
  for (let k = 0; k < order.length; k++) board = drop(board, SMALL, order[k], (k % 2) + 1).board;
  assert.ok(isFull(board));
  assert.equal(findWin(board, SMALL), null);
  assert.equal(chooseMove(board, SMALL, 1, 3), -1);
});

test('hard never misses an immediate win, and never misses a block', () => {
  const rand = mulberry32(7);
  for (let seed = 1; seed <= 200; seed++) {
    // random positions; whenever a side can win at once, hard must win, else it must block
    const r = mulberry32(seed);
    for (const cfg of [BIG, SMALL]) {
      let board = emptyBoard(cfg);
      let player = 1;
      for (let k = 0; k < cfg.cols * cfg.rows - 2; k++) {
        const cols = validCols(board, cfg);
        const d = drop(board, cfg, cols[Math.floor(r() * cols.length)], player);
        if (winAt(d.board, cfg, d.index)) break;
        board = d.board;
        player = other(player);
        const wins = winningCols(board, cfg, player);
        const threats = winningCols(board, cfg, other(player));
        if (!wins.length && !threats.length) continue;
        const move = chooseMove(board, cfg, player, 3, rand);
        if (wins.length) assert.ok(wins.includes(move), `seed ${seed}: hard missed a win`);
        else assert.ok(threats.includes(move), `seed ${seed}: hard missed a block`);
        const medium = chooseMove(board, cfg, player, 2, rand);
        if (wins.length) assert.ok(wins.includes(medium), `seed ${seed}: medium missed a win`);
        else assert.ok(threats.includes(medium), `seed ${seed}: medium missed a block`);
      }
    }
  }
});

/** A simple scripted player: win if it can, block if it must, else the middle-most column. */
function greedy(board, cfg, player) {
  const w = winningCols(board, cfg, player);
  if (w.length) return w[0];
  const t = winningCols(board, cfg, other(player));
  if (t.length) return t[0];
  const mid = (cfg.cols - 1) / 2;
  return validCols(board, cfg).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
}

function match(cfg, moveOf1, moveOf2) {
  let board = emptyBoard(cfg);
  let player = 1;
  for (;;) {
    const col = player === 1 ? moveOf1(board) : moveOf2(board);
    const d = drop(board, cfg, col, player);
    assert.ok(d, 'an illegal move');
    board = d.board;
    if (winAt(board, cfg, d.index)) return player;
    if (isFull(board)) return 0;
    player = other(player);
  }
}

test('easy loses to a simple scripted strategy (often), and still wins sometimes', () => {
  for (const cfg of [BIG, SMALL]) {
    const results = { greedy: 0, easy: 0, draw: 0 };
    for (let seed = 1; seed <= 60; seed++) {
      const rand = mulberry32(seed);
      // easy starts half the games
      const easyFirst = seed % 2 === 0;
      const easy = (b) => chooseMove(b, cfg, easyFirst ? 1 : 2, 1, rand);
      const g = (b) => greedy(b, cfg, easyFirst ? 2 : 1);
      const w = easyFirst ? match(cfg, easy, g) : match(cfg, g, easy);
      if (w === 0) results.draw++;
      else if ((w === 1) === easyFirst) results.easy++;
      else results.greedy++;
    }
    // three in a row on the small board is quickly won by whoever starts, so there it is closer
    const atLeast = cfg.id === 'big' ? 30 : 15;
    assert.ok(results.greedy >= atLeast, `${cfg.id}: easy should lose often, ${JSON.stringify(results)}`);
    assert.ok(results.easy >= 1, `${cfg.id}: easy never won, ${JSON.stringify(results)}`);
  }
});

test('hard beats easy nearly always, and holds its own against the scripted strategy', () => {
  let hardWins = 0;
  let vsGreedy = { hard: 0, greedy: 0, draw: 0 };
  for (let seed = 1; seed <= 20; seed++) {
    const rand = mulberry32(seed);
    const hardFirst = seed % 2 === 0;
    const hard = (b) => chooseMove(b, BIG, hardFirst ? 1 : 2, 3, rand);
    const easy = (b) => chooseMove(b, BIG, hardFirst ? 2 : 1, 1, rand);
    const w = hardFirst ? match(BIG, hard, easy) : match(BIG, easy, hard);
    if (w && (w === 1) === hardFirst) hardWins++;
    const g = (b) => greedy(b, BIG, hardFirst ? 2 : 1);
    const w2 = hardFirst ? match(BIG, hard, g) : match(BIG, g, hard);
    if (w2 === 0) vsGreedy.draw++;
    else if ((w2 === 1) === hardFirst) vsGreedy.hard++;
    else vsGreedy.greedy++;
  }
  assert.ok(hardWins >= 18, `hard won ${hardWins} of 20 against easy`);
  assert.ok(vsGreedy.hard > vsGreedy.greedy, JSON.stringify(vsGreedy));
});

test('every level only plays legal moves, also on a nearly full board', () => {
  const rand = mulberry32(3);
  for (const cfg of [BIG, SMALL]) {
    for (const level of [1, 2, 3]) {
      let board = emptyBoard(cfg);
      let player = 1;
      while (!isFull(board)) {
        const col = chooseMove(board, cfg, player, level, rand);
        const d = drop(board, cfg, col, player);
        assert.ok(d, `level ${level} played full column ${col}`);
        board = d.board;
        if (winAt(board, cfg, d.index)) break;
        player = other(player);
      }
    }
  }
});

test('the hard level answers quickly on the empty big board', () => {
  const t0 = Date.now();
  const col = chooseMove(emptyBoard(BIG), BIG, 1, 3, mulberry32(1));
  assert.ok(col >= 0 && col < 7);
  assert.ok(Date.now() - t0 < 1500, `took ${Date.now() - t0} ms`);
  assert.equal(typeof evaluate(emptyBoard(BIG), BIG, 1), 'number');
});

test('meta: two players and the easy and medium computer are free; hard is in the full version', () => {
  assert.equal(meta.id, 'vier');
  assert.deepEqual(meta.freeLevels, [1, 2]);
  assert.equal(meta.isLocked({ mode: 'duo', board: 'big' }, false), false);
  assert.equal(meta.isLocked({ mode: 'duo', board: 'small' }, false), false);
  assert.equal(meta.isLocked({ mode: 'cpu', level: 1 }, false), false);
  assert.equal(meta.isLocked({ mode: 'cpu', level: 2 }, false), false);
  assert.equal(meta.isLocked({ mode: 'cpu', level: 3 }, false), true);
  assert.equal(meta.isLocked({ mode: 'cpu', level: 3 }, true), false);
});

test('save: win counters only go up, also after a failed read that a later read merges in', async () => {
  const store = await import('../web/js/storage.js');
  let value = JSON.stringify({
    version: 1,
    games: { vier: { stars: { 'cpu-big-1': 4, 'cpu-small-2': 1 }, setup: { board: 'small', mode: 'duo', level: 1 } }, bubbels: { stars: { 1: 3 } } },
    settings: {},
    purchase: { owned: false },
  });
  let fails = 3;
  const backend = {
    name: 'flaky',
    get: async () => {
      if (fails-- > 0) throw new Error('not yet');
      return value;
    },
    set: async (k, v) => void (value = v),
  };
  assert.equal(await store.init({ backend, legacyStorage: null, retryDelayMs: 0 }), 'read-failed');
  // a win while the save could not be read: the game counts from what it can see (nothing yet)
  const key = 'cpu-big-1';
  store.recordStars('vier', key, (store.loadProgress('vier').stars[key] || 0) + 1);
  await store.adopted();
  await store.flushed();
  assert.equal(JSON.parse(value).games.vier.stars[key], 4, 'the stored count is never lowered');
  // the next win reads the merged save (the game keeps no copy), so it counts on from there
  store.recordStars('vier', key, (store.loadProgress('vier').stars[key] || 0) + 1);
  await store.flushed();
  const saved = JSON.parse(value).games;
  assert.equal(saved.vier.stars[key], 5);
  assert.equal(saved.vier.stars['cpu-small-2'], 1);
  assert.deepEqual(saved.vier.setup, { board: 'small', mode: 'duo', level: 1 });
  assert.deepEqual(saved.bubbels.stars, { 1: 3 });
});

test('the game reads its counters and options from the save each time (no kept copy)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../web/games/vier/vier.js', import.meta.url), 'utf8');
  // a variable in the game's own scope (two spaces in) would outlive a save that a later read merged
  assert.doesNotMatch(src, /^ {0,2}(let|const|var)\s+\w+\s*=\s*store\.load(Progress|GameOption)\(/m, 'a counter or option kept in a variable can go stale');
  assert.match(src, /const wins = \(\) => store\.loadProgress\(meta\.id\)\.stars/);
});

test('counters: only the child\'s wins against the computer, per board and level', () => {
  assert.equal(winKey({ mode: 'cpu', board: 'big', level: 3 }), 'cpu-big-3');
  assert.equal(winKey({ mode: 'cpu', board: 'small', level: 1 }), 'cpu-small-1');
  const src = readFileSync(new URL('../web/games/vier/vier.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /duo-\$\{/, 'games played together are not counted');
});

test('the kleuterbord is a forced win for whoever starts: against the computer the child starts', () => {
  assert.equal(childAlwaysStarts({ mode: 'cpu', board: 'small', level: 3 }), true);
  assert.equal(childAlwaysStarts({ mode: 'cpu', board: 'big', level: 3 }), false);
  assert.equal(childAlwaysStarts({ mode: 'duo', board: 'small' }), false);
  // and it really is: hard, starting, beats hard on the small board every time
  for (let seed = 1; seed <= 6; seed++) {
    const rand = mulberry32(seed);
    const w = match(SMALL, (b) => chooseMove(b, SMALL, 1, 3, rand), (b) => chooseMove(b, SMALL, 2, 3, rand));
    assert.equal(w, 1, `seed ${seed}: the starter did not win`);
  }
});
