import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOAT, TIGER, EMPTY, GOATS, WIN_CAPTURES, QUIET_LIMIT, TIGER_START, NEIGHBOURS, JUMPS, SEGMENTS,
  initialBoard, boardFrom, legalMoves, applyMove, newGame, play, outcome, capturable, hasDiagonals, sameMove, goatsOnBoard,
} from '../web/games/baghchal/rules.js';
import { chooseMove, evaluate, mulberry32, safeMoves, THINK_MS, EASY_CAPTURE, EASY_SAFE } from '../web/games/baghchal/ai.js';
import { meta } from '../web/games/baghchal/meta.js';
import { winKey, targetsFor } from '../web/games/baghchal/baghchal.js';

const at = (r, c) => r * 5 + c;
const tos = (moves) => moves.map((m) => m.to).sort((a, b) => a - b);
const movesFrom = (moves, from) => moves.filter((m) => m.from === from);

// ---------- the board ----------

test('the board: 25 points, 4 tigers on the corners, 20 goats to place, goats first', () => {
  const g = newGame();
  assert.equal(g.board.length, 25);
  assert.deepEqual(TIGER_START, [0, 4, 20, 24]);
  for (let i = 0; i < 25; i++) assert.equal(g.board[i], TIGER_START.includes(i) ? TIGER : EMPTY);
  assert.equal(g.turn, GOAT);
  assert.equal(g.toPlace, GOATS);
  assert.equal(GOATS, 20);
  assert.equal(g.captured, 0);
  assert.equal(g.over, null);
});

test('lines: rows and columns everywhere, diagonals only through points where row + col is even', () => {
  // the centre has 8 neighbours, a point with odd row + col only 4 (or 3 on the edge)
  assert.equal(NEIGHBOURS[at(2, 2)].length, 8);
  assert.deepEqual([...NEIGHBOURS[at(1, 2)]].sort((a, b) => a - b), [at(0, 2), at(1, 1), at(1, 3), at(2, 2)]);
  assert.deepEqual([...NEIGHBOURS[at(0, 1)]].sort((a, b) => a - b), [at(0, 0), at(0, 2), at(1, 1)]);
  assert.deepEqual([...NEIGHBOURS[at(0, 0)]].sort((a, b) => a - b), [at(0, 1), at(1, 0), at(1, 1)]);
  for (let i = 0; i < 25; i++) {
    assert.equal(hasDiagonals(i), (Math.floor(i / 5) + (i % 5)) % 2 === 0);
    for (const j of NEIGHBOURS[i]) assert.ok(NEIGHBOURS[j].includes(i), `line ${i}-${j} goes one way only`);
  }
  // 5 rows × 4 + 5 columns × 4 + the diagonals: 16 short diagonal pieces
  assert.equal(SEGMENTS.length, 40 + 16);
});

test('boardFrom reads a picture of the board', () => {
  const b = boardFrom(['T . . . T', '. g . . .', '', '', 'T . . . T']);
  assert.equal(b[at(1, 1)], GOAT);
  assert.equal(b[at(4, 4)], TIGER);
  assert.equal(goatsOnBoard(b), 1);
});

// ---------- placing ----------

test('placing: a goat goes on any empty point, one per turn; goats cannot move until all 20 are placed', () => {
  let g = newGame();
  const first = legalMoves(g.board, GOAT, g.toPlace);
  assert.equal(first.length, 21);
  assert.ok(first.every((m) => m.from === -1 && m.over === -1));
  g = play(g, { from: -1, to: at(2, 2), over: -1 });
  assert.equal(g.board[at(2, 2)], GOAT);
  assert.equal(g.toPlace, 19);
  assert.equal(g.turn, TIGER);
  // tigers move while goats are still being placed
  g = play(g, { from: 0, to: 1, over: -1 });
  const goatMoves = legalMoves(g.board, GOAT, g.toPlace);
  assert.ok(goatMoves.every((m) => m.from === -1), 'a goat moved during placement');
  assert.ok(!goatMoves.some((m) => m.to === at(2, 2) || m.to === 1), 'placed on a taken point');
  assert.equal(goatMoves.length, 20);
});

test('after the 20th goat the goats move one step along a line to an empty point', () => {
  const b = boardFrom(['T . . . T', '. . . . .', '. . g . .', '. . . . .', 'T . . . T']);
  const g = newGame(b, GOAT, 0, 0);
  const m = legalMoves(g.board, GOAT, 0);
  assert.equal(m.length, 8);
  assert.ok(m.every((x) => x.from === at(2, 2) && x.over === -1));
  const odd = newGame(boardFrom(['T . . . T', '. . g . .', '', '', 'T . . . T']), GOAT, 0, 0);
  assert.deepEqual(tos(legalMoves(odd.board, GOAT, 0)), [at(0, 2), at(1, 1), at(1, 3), at(2, 2)]);
  // a goat never jumps
  const blocked = boardFrom(['T g . . T', 'g g . . .', '', '', 'T . . . T']);
  assert.ok(!movesFrom(legalMoves(blocked, GOAT, 0), at(0, 1)).some((x) => x.to === at(0, 3)));
});

// ---------- tigers ----------

test('a tiger steps one point along a line, never to a taken point', () => {
  const b = boardFrom(['T g . . T', 'g . . . .', '', '', 'T . . . T']);
  // the corner tiger: right is a goat (no jump: 0,2 is free so it can jump), down is a goat, the diagonal is free
  const m = movesFrom(legalMoves(b, TIGER, 18), 0);
  assert.ok(m.some((x) => x.to === at(1, 1) && x.over === -1));
  assert.ok(!m.some((x) => x.over < 0 && (x.to === at(0, 1) || x.to === at(1, 0))));
  // a tiger on an odd point has no diagonal
  const odd = boardFrom(['. . . . .', '. . T . .', '', '', '']);
  assert.deepEqual(tos(legalMoves(odd, TIGER, 0)), [at(0, 2), at(1, 1), at(1, 3), at(2, 2)]);
});

test('a tiger captures by jumping over an adjacent goat in a straight line to the empty point beyond', () => {
  const b = boardFrom(['T g . . T', '. . . . .', '. . . . .', '. . . . .', 'T . . . T']);
  const caps = legalMoves(b, TIGER, 19).filter((m) => m.over >= 0);
  assert.deepEqual(caps, [{ from: 0, to: at(0, 2), over: at(0, 1) }]);
  const g = play(newGame(b, TIGER, 19, 0), caps[0]);
  assert.equal(g.board[at(0, 1)], EMPTY, 'the goat hops off');
  assert.equal(g.board[at(0, 2)], TIGER);
  assert.equal(g.board[0], EMPTY);
  assert.equal(g.captured, 1);
  assert.equal(g.toPlace, 19, 'a capture does not change the goats to place');
  // diagonally only along a diagonal line
  const diag = boardFrom(['. . . . .', '. T . . .', '. . g . .', '. . . . .', '. . . . .']);
  assert.ok(legalMoves(diag, TIGER, 0).some((m) => m.over === at(2, 2) && m.to === at(3, 3)));
  const noDiag = boardFrom(['. . . . .', '. . T . .', '. . . g .', '. . . . .', '. . . . .']);
  assert.ok(!legalMoves(noDiag, TIGER, 0).some((m) => m.over >= 0), 'jumped along a line that is not there');
});

test('no capture when the point beyond is taken or off the board, or over a tiger', () => {
  assert.equal(capturable(boardFrom(['T g g . T', '', '', '', 'T . . . T'])).length, 0);
  assert.equal(capturable(boardFrom(['T T . . .', '', '', '', ''])).length, 0);
  assert.equal(capturable(boardFrom(['g T . . .', '', '', '', ''])).length, 0, 'jumped off the board');
  assert.equal(capturable(boardFrom(['T g T . .', '', '', '', ''])).length, 0);
});

test('one capture per move: no multi-jumps, and the turn passes after a capture', () => {
  // after jumping (0,1) the tiger could jump (0,3) as well, but its move is over
  const b = boardFrom(['T g . g .', '. . . . .', '', '', '']);
  let g = newGame(b, TIGER, 10, 0);
  const caps = legalMoves(g.board, TIGER, g.toPlace).filter((m) => m.over >= 0);
  assert.equal(caps.length, 1);
  g = play(g, caps[0]);
  assert.equal(g.turn, GOAT);
  assert.equal(g.board[at(0, 3)], GOAT, 'the second goat is still there');
  assert.equal(g.captured, 1);
});

test('capturing is never compulsory, and tigers may capture while goats are still placed', () => {
  const b = boardFrom(['T g . . T', '', '', '', 'T . . . T']);
  const moves = legalMoves(b, TIGER, 19);
  assert.ok(moves.some((m) => m.over >= 0));
  assert.ok(moves.some((m) => m.over < 0));
});

// ---------- the end ----------

test('the tigers win when they have captured 5 goats', () => {
  const b = boardFrom(['T g . . T', '', '', '', 'T . . . T']);
  let g = newGame(b, TIGER, 0, WIN_CAPTURES - 1);
  // the goat player has 0 goats left to place and one goat: make it a real position
  g = play(g, { from: 0, to: at(0, 2), over: at(0, 1) });
  assert.deepEqual(g.over, { winner: TIGER, reason: 'captured' });
  assert.equal(WIN_CAPTURES, 5);
});

test('the goats win when no tiger can move', () => {
  // the corner tiger is boxed in: its three neighbours are goats with goats behind them
  const b = boardFrom(['T g g . .', 'g g . . .', 'g . g . .', '. . . . .', '. . . . .']);
  const g = newGame(b, TIGER, 0, 0);
  assert.deepEqual(g.over, { winner: GOAT, reason: 'trapped' });
  // the same position with the goats to move is not over yet
  assert.equal(newGame(b, GOAT, 0, 0).over, null);
  // played into: the last goat closes the trap
  const before = boardFrom(['T g g . .', 'g . . . .', 'g . g . .', '. . . . .', '. . . . .']);
  const after = play(newGame(before, GOAT, 1, 0), { from: -1, to: at(1, 1), over: -1 });
  assert.deepEqual(after.over, { winner: GOAT, reason: 'trapped' });
});

test('a goat player who cannot move loses', () => {
  const b = boardFrom(['g T . . .', 'T . . . .', '. . . . .', '. . . . .', '. . . . .']);
  // the only goat is wedged between two tigers, with no goats left to place: it cannot move
  const blocked = boardFrom(['g T . . .', 'T T . . .', '. . . . .', '. . . . .', '. . . . .']);
  assert.deepEqual(newGame(blocked, GOAT, 0, 0).over, { winner: TIGER, reason: 'stuck' });
  assert.equal(newGame(b, GOAT, 0, 0).over, null); // (1,1) is free
  assert.equal(newGame(blocked, GOAT, 1, 0).over, null, 'while placing there is always a free point');
});

test('a draw: the same position with the same player to move for the third time', () => {
  const b = boardFrom(['T . . . T', '. . . . .', '. . g . .', '. . . . .', 'T . . . T']);
  let g = newGame(b, GOAT, 0, 0);
  const shuffle = [
    { from: at(2, 2), to: at(2, 1), over: -1 },
    { from: 0, to: 1, over: -1 },
    { from: at(2, 1), to: at(2, 2), over: -1 },
    { from: 1, to: 0, over: -1 },
  ];
  for (let k = 0; k < 8; k++) {
    assert.equal(g.over, null, `over too soon, after ${k} plies`);
    g = play(g, shuffle[k % 4]);
  }
  assert.deepEqual(g.over, { draw: true, reason: 'repeat' });
});

test('a draw: QUIET_LIMIT plies without a capture once all goats are placed', () => {
  let g = newGame(boardFrom(['T . . . T', '. . . . .', '. . g . .', '. . . . .', 'T . . . T']), GOAT, 0, 0);
  g = { ...g, seen: {}, quiet: QUIET_LIMIT - 1 };
  g = play(g, { from: at(2, 2), to: at(2, 3), over: -1 });
  assert.deepEqual(g.over, { draw: true, reason: 'quiet' });
  // placing and capturing reset the count
  const placing = play({ ...newGame(), quiet: 50 }, { from: -1, to: 12, over: -1 });
  assert.equal(placing.quiet, 0);
  const cap = newGame(boardFrom(['T g . . T', '', '', '', 'T . . . T']), TIGER, 0, 0);
  assert.equal(play({ ...cap, quiet: 80 }, { from: 0, to: 2, over: 1 }).quiet, 0);
});

test('play() leaves the old game untouched (for take-back) and sameMove compares moves', () => {
  const g = newGame();
  const copy = JSON.stringify(g);
  play(g, { from: -1, to: 12, over: -1 });
  assert.equal(JSON.stringify(g), copy);
  assert.ok(sameMove({ from: 1, to: 2, over: -1 }, { from: 1, to: 2 }));
  assert.ok(!sameMove({ from: 1, to: 3, over: 2 }, { from: 1, to: 3, over: -1 }));
  assert.deepEqual(applyMove(initialBoard(), { from: 0, to: 6, over: -1 })[6], TIGER);
});

/** Play a whole game; `players[side]` is a level or a function (game, rand) -> move. Checks every move is legal. */
function playOut(players, seed, maxPlies = 1500, opts = {}) {
  const rand = mulberry32(seed);
  let g = newGame();
  let plies = 0;
  while (!g.over) {
    assert.ok(plies < maxPlies, `seed ${seed}: no end after ${plies} plies`);
    const p = players[g.turn];
    const legal = legalMoves(g.board, g.turn, g.toPlace);
    const m = typeof p === 'function' ? p(g, rand) : chooseMove(g, g.turn, p, rand, opts[p] || {});
    assert.ok(legal.some((x) => sameMove(x, m)), `seed ${seed}: an illegal move ${JSON.stringify(m)}`);
    const before = goatsOnBoard(g.board) + g.toPlace + g.captured;
    g = play(g, m);
    assert.equal(goatsOnBoard(g.board) + g.toPlace + g.captured, before, 'a goat appeared or vanished');
    assert.equal(g.board.filter((v) => v === TIGER).length, 4, 'tigers are never captured');
    plies++;
  }
  return { ...g, plies };
}
const random = (g, rand) => {
  const m = legalMoves(g.board, g.turn, g.toPlace);
  return m[Math.floor(rand() * m.length)];
};

test('200 seeded games with random moves all end, each in a win or a draw', () => {
  const ends = {};
  for (let seed = 1; seed <= 200; seed++) {
    const g = playOut({ [GOAT]: random, [TIGER]: random }, seed);
    const k = g.over.draw ? `draw-${g.over.reason}` : `${g.over.winner}-${g.over.reason}`;
    ends[k] = (ends[k] || 0) + 1;
  }
  assert.ok(ends[`${TIGER}-captured`] > 100, JSON.stringify(ends));
  // a game where nobody captures can only end by a trap or a draw: shuffling goats
  const shy = (g, rand) => {
    const m = legalMoves(g.board, g.turn, g.toPlace).filter((x) => x.over < 0);
    return m.length ? m[Math.floor(rand() * m.length)] : random(g, rand);
  };
  for (let seed = 1; seed <= 200; seed++) playOut({ [GOAT]: shy, [TIGER]: shy }, seed, 4000);
});

// ---------- the computer ----------

/** A child who plays the goats sensibly: never leaves a goat to be taken when it can help it, and hems the tigers in. */
const childGoat = (g, rand) => {
  const moves = legalMoves(g.board, GOAT, g.toPlace);
  const safe = safeMoves(g.board, moves);
  let best = Infinity;
  let out = [];
  for (const m of safe.length ? safe : moves) {
    const n = legalMoves(applyMove(g.board, m), TIGER, 0).length;
    if (n < best) [best, out] = [n, [m]];
    else if (n === best) out.push(m);
  }
  return out[Math.floor(rand() * out.length)];
};
/** A child who plays the tigers sensibly: takes a goat when it can, otherwise threatens one. */
const childTiger = (g, rand) => {
  const moves = legalMoves(g.board, TIGER, g.toPlace);
  const caps = moves.filter((m) => m.over >= 0);
  if (caps.length) return caps[Math.floor(rand() * caps.length)];
  let best = -1;
  let out = [];
  for (const m of moves) {
    const n = capturable(applyMove(g.board, m)).length;
    if (n > best) [best, out] = [n, [m]];
    else if (n === best) out.push(m);
  }
  return out[Math.floor(rand() * out.length)];
};

test('every level plays only legal moves, on both sides, and every game ends', () => {
  for (let seed = 1; seed <= 3; seed++) {
    playOut({ [GOAT]: 1, [TIGER]: 2 }, seed, 1500, { 2: { nodes: 3000 } });
    playOut({ [GOAT]: 2, [TIGER]: 1 }, seed, 1500, { 2: { nodes: 3000 } });
    playOut({ [GOAT]: 3, [TIGER]: 3 }, seed, 1500, { 3: { nodes: 2500 } });
  }
});

test('easy loses often to a child who plays sensibly, on either side', () => {
  let goatWins = 0;
  let tigerWins = 0;
  for (let seed = 1; seed <= 60; seed++) {
    if (playOut({ [GOAT]: childGoat, [TIGER]: 1 }, seed).over.winner === GOAT) goatWins++;
    if (playOut({ [GOAT]: 1, [TIGER]: childTiger }, seed).over.winner === TIGER) tigerWins++;
  }
  assert.ok(goatWins >= 30, `as the goats the child won only ${goatWins} of 60`);
  assert.ok(tigerWins >= 50, `as the tigers the child won only ${tigerWins} of 60`);
  assert.ok(EASY_CAPTURE < 0.5 && EASY_SAFE < 0.5);
});

/** Can the tigers, after `board` (tigers to move), force a capture next turn whatever the goats do? */
function forcedCapture(board, toPlace) {
  for (const t of legalMoves(board, TIGER, toPlace)) {
    if (t.over >= 0) return true;
    const b = applyMove(board, t);
    const replies = legalMoves(b, GOAT, toPlace);
    if (replies.length && replies.every((g) => capturable(applyMove(b, g)).length)) return true;
  }
  return false;
}

test('medium and hard as the goats never leave a goat to be taken for nothing', () => {
  // a constructed position: placing on (1,1) or (0,1) next to the corner tiger gives a goat away
  const b = boardFrom(['T . . . T', '. . . . .', '. . . . .', '. . . . .', 'T . . . T']);
  for (let seed = 1; seed <= 6; seed++) {
    for (const level of [2, 3]) {
      const m = chooseMove({ board: b, toPlace: 20, captured: 0 }, GOAT, level, mulberry32(seed), { nodes: 15000 });
      assert.equal(capturable(applyMove(b, m)).length, 0, `level ${level} placed on ${m.to}`);
    }
  }
  // positions from real games: whenever the goats have a safe move, the computer's move is safe,
  // or every safe move lets the tigers force a capture anyway (then it is not "for nothing")
  let checked = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const rand = mulberry32(seed * 7);
    let g = newGame();
    const plies = 8 + Math.floor(rand() * 40);
    for (let k = 0; k < plies && !g.over; k++) g = play(g, g.turn === GOAT ? childGoat(g, rand) : childTiger(g, rand));
    if (g.over || g.turn !== GOAT) continue;
    const moves = legalMoves(g.board, GOAT, g.toPlace);
    const safe = safeMoves(g.board, moves);
    if (!safe.length) continue;
    for (const level of [2, 3]) {
      const m = chooseMove(g, GOAT, level, mulberry32(seed), { nodes: 15000 });
      const left = capturable(applyMove(g.board, m)).length;
      if (left) {
        const toPlace = m.from < 0 ? g.toPlace - 1 : g.toPlace;
        assert.ok(safe.every((s) => forcedCapture(applyMove(g.board, s), s.from < 0 ? g.toPlace - 1 : g.toPlace)), `seed ${seed} level ${level}: gave a goat away (${JSON.stringify(m)}, ${toPlace} to place)`);
      }
      checked++;
    }
  }
  assert.ok(checked >= 20, `only ${checked} positions checked`);
});

test('medium and hard as the tigers never let a free goat go (they take it, or make a capture certain)', () => {
  const b = boardFrom(['T . . . T', '. g . . .', '. . . . .', '. . . . .', 'T . . . T']);
  for (let seed = 1; seed <= 6; seed++) {
    for (const level of [2, 3]) {
      const m = chooseMove({ board: b, toPlace: 19, captured: 0 }, TIGER, level, mulberry32(seed), { nodes: 15000 });
      assert.deepEqual([m.from, m.to, m.over], [0, at(2, 2), at(1, 1)], `level ${level} did not take the goat`);
    }
  }
  // positions from real games with a capture on offer: the computer captures
  let checked = 0;
  for (let seed = 1; seed <= 400 && checked < 20; seed++) {
    const rand = mulberry32(seed * 13);
    let g = newGame();
    const plies = 6 + Math.floor(rand() * 40);
    for (let k = 0; k < plies && !g.over; k++) g = play(g, random(g, rand));
    if (g.over || g.turn !== TIGER || !capturable(g.board).length) continue;
    for (const level of [2, 3]) {
      const m = chooseMove(g, TIGER, level, mulberry32(seed), { nodes: 15000 });
      // it captures, or it plays a move after which the goats cannot save every goat (the goat is
      // only postponed: a capture next turn is certain)
      const b = applyMove(g.board, m);
      const replies = legalMoves(b, GOAT, g.toPlace);
      const certain = m.over >= 0 || replies.every((r) => capturable(applyMove(b, r)).length);
      assert.ok(certain, `seed ${seed} level ${level}: let a goat go (${JSON.stringify(m)})`);
    }
    checked++;
  }
  assert.ok(checked >= 10, `only ${checked} positions checked`);
});

test('medium and hard beat a sensible child more often than easy does, and the evaluation sees captures', () => {
  let hardGoatWins = 0;
  let hardTigerWins = 0;
  for (let seed = 1; seed <= 4; seed++) {
    if (playOut({ [GOAT]: 3, [TIGER]: childTiger }, seed, 1500, { 3: { nodes: 6000 } }).over.winner === GOAT) hardGoatWins++;
    if (playOut({ [GOAT]: childGoat, [TIGER]: 2 }, seed, 1500, { 2: { nodes: 6000 } }).over.winner === TIGER) hardTigerWins++;
  }
  assert.ok(hardGoatWins >= 3, `hard goats won only ${hardGoatWins} of 4`);
  assert.ok(hardTigerWins >= 3, `medium tigers won only ${hardTigerWins} of 4`);
  const b = boardFrom(['T . . . T', '', '', '', 'T . . . T']);
  assert.ok(evaluate(b, 10, 2, GOAT, TIGER) > evaluate(b, 10, 1, GOAT, TIGER));
  assert.ok(evaluate(b, 10, 1, GOAT, GOAT) < 0);
});

test('the search stops at its time limit as well as its budget', () => {
  assert.ok(THINK_MS <= 2500);
  const g = newGame();
  const t0 = performance.now();
  const m = chooseMove(g, GOAT, 3, mulberry32(1), { nodes: 1e9, ms: 150 });
  const took = performance.now() - t0;
  assert.ok(took < 1500, `took ${Math.round(took)} ms`);
  assert.ok(legalMoves(g.board, GOAT, g.toPlace).some((x) => sameMove(x, m)));
  assert.equal(chooseMove(newGame(boardFrom(['g T . . .', 'T T . . .', '', '', '']), GOAT, 0, 0), GOAT, 2), null, 'no move: null');
});

// ---------- the screen's pure parts and the free part ----------

test('targetsFor: the points a tapped piece can go to, and empty points while placing', () => {
  const b = boardFrom(['T g . . T', '', '', '', 'T . . . T']);
  const g = newGame(b, TIGER, 19, 0);
  const moves = legalMoves(g.board, TIGER, g.toPlace);
  assert.deepEqual(targetsFor(moves, 0).sort((a, b2) => a - b2), [2, at(1, 0), at(1, 1)]);
  assert.deepEqual(targetsFor(moves, at(2, 2)), []);
  const placing = legalMoves(initialBoard(), GOAT, 20);
  assert.equal(targetsFor(placing, -1).length, 21);
});

test('free: two players and easy on both sides; locked: medium and hard', () => {
  for (const side of ['goats', 'tigers']) {
    assert.equal(meta.isLocked({ mode: 'duo', level: 1, side }, false), false);
    assert.equal(meta.isLocked({ mode: 'cpu', level: 1, side }, false), false);
    assert.equal(meta.isLocked({ mode: 'cpu', level: 2, side }, false), true);
    assert.equal(meta.isLocked({ mode: 'cpu', level: 3, side }, false), true);
    for (const level of [1, 2, 3]) assert.equal(meta.isLocked({ mode: 'cpu', level, side }, true), false);
  }
  assert.equal(winKey({ side: 'tigers', level: 2 }), 'cpu-tigers-2');
});

test('the worker module answers with a move for a job', async () => {
  // ai-worker.js only wires chooseMove to messages; check it loads and answers like the page does
  const posted = [];
  globalThis.self = { postMessage: (m) => posted.push(m) };
  try {
    await import('../web/games/baghchal/ai-worker.js');
    const g = newGame();
    globalThis.self.onmessage({ data: { id: 3, board: g.board, toPlace: 20, captured: 0, player: GOAT, level: 2, seed: 5 } });
    assert.equal(posted[0].id, 3);
    assert.equal(posted[0].ok, true);
    assert.ok(legalMoves(g.board, GOAT, 20).some((x) => sameMove(x, posted[0].move)));
    globalThis.self.onmessage({ data: { id: 4, board: 'nope' } });
    assert.equal(posted[1].ok, false);
  } finally {
    delete globalThis.self;
  }
});
