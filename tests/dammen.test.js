import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARIANTS, QUIET_LIMIT, initialBoard, boardFrom, legalMoves, applyMove, newGame, play, outcome, countPieces, isDark, sameMove } from '../web/games/dammen/rules.js';
import { chooseMove, evaluate, mulberry32 } from '../web/games/dammen/ai.js';
import { meta } from '../web/games/dammen/meta.js';
import { winKey, pickTargets } from '../web/games/dammen/dammen.js';

const S = VARIANTS.small;
const B = VARIANTS.big;
const sq = (cfg, r, c) => r * cfg.size + c;
const empty = (cfg) => new Array(cfg.size * cfg.size).fill(0);
const put = (cfg, pieces) => {
  const b = empty(cfg);
  for (const [r, c, v] of pieces) {
    assert.ok(isDark(cfg, sq(cfg, r, c)), `(${r},${c}) is a light square`);
    b[sq(cfg, r, c)] = v;
  }
  return b;
};
const tos = (moves) => moves.map((m) => m.to).sort((a, b) => a - b);

test('boards: 8×8 with 12 pieces each, 10×10 with 20 each, only on dark squares', () => {
  for (const [cfg, n] of [[S, 12], [B, 20]]) {
    const board = initialBoard(cfg);
    assert.deepEqual(countPieces(board), [0, n, n]);
    board.forEach((v, i) => v && assert.ok(isDark(cfg, i)));
  }
  assert.equal(legalMoves(initialBoard(S), S, 1).length, 7);
  assert.equal(legalMoves(initialBoard(B), B, 1).length, 9);
  assert.equal(legalMoves(initialBoard(S), S, 2).length, 7);
});

test('boardFrom reads a picture of the board', () => {
  const b = boardFrom(S, ['. b . . . . . .', '', '', '', '', '', '', 'W . . . . . . .']);
  assert.equal(b[sq(S, 0, 1)], 2);
  assert.equal(b[sq(S, 7, 0)], 3);
});

test('a man moves one step diagonally forward, never back', () => {
  const b = put(S, [[5, 2, 1], [2, 3, 2]]);
  assert.deepEqual(tos(legalMoves(b, S, 1)), [sq(S, 4, 1), sq(S, 4, 3)]);
  assert.deepEqual(tos(legalMoves(b, S, 2)), [sq(S, 3, 2), sq(S, 3, 4)]);
  // at the edge: one step only
  assert.deepEqual(tos(legalMoves(put(S, [[5, 0, 1]]), S, 1)), [sq(S, 4, 1)]);
});

test('capturing is compulsory: only the capture is legal', () => {
  const b = put(S, [[5, 2, 1], [4, 3, 2], [5, 6, 1]]);
  const moves = legalMoves(b, S, 1);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].from, sq(S, 5, 2));
  assert.equal(moves[0].to, sq(S, 3, 4));
  assert.deepEqual(moves[0].captured, [sq(S, 4, 3)]);
  const after = applyMove(b, S, moves[0]);
  assert.equal(after[sq(S, 4, 3)], 0);
  assert.equal(after[sq(S, 3, 4)], 1);
  assert.equal(after[sq(S, 5, 2)], 0);
});

test('a man may capture backwards', () => {
  const b = put(S, [[3, 2, 1], [4, 3, 2]]);
  const moves = legalMoves(b, S, 1);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].to, sq(S, 5, 4));
});

test('a multi-capture is one move and must go on to the end', () => {
  const b = put(S, [[7, 0, 1], [6, 1, 2], [4, 3, 2], [0, 7, 2]]);
  const moves = legalMoves(b, S, 1);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].path, [sq(S, 5, 2), sq(S, 3, 4)]);
  assert.deepEqual(moves[0].captured, [sq(S, 6, 1), sq(S, 4, 3)]);
  const after = applyMove(b, S, moves[0]);
  assert.deepEqual(countPieces(after), [0, 1, 1]);
});

test('a branching multi-capture offers every way on the small board', () => {
  // from (7,2): over (6,1) to (5,0), or over (6,3) to (5,4) and on over (4,5) to (3,6)
  const b = put(S, [[7, 2, 1], [6, 1, 2], [6, 3, 2], [4, 5, 2]]);
  const moves = legalMoves(b, S, 1);
  assert.deepEqual(moves.map((m) => m.captured.length).sort(), [1, 2]);
});

test('jumped pieces stay until the move ends: never jumped twice', () => {
  // a man goes round a ring of four and lands on its own square again; it never takes one twice
  const b = put(S, [[6, 3, 1], [5, 4, 2], [3, 4, 2], [3, 2, 2], [5, 2, 2]]);
  const moves = legalMoves(b, S, 1);
  for (const m of moves) assert.equal(new Set(m.captured).size, m.captured.length);
  const round = moves.find((m) => m.captured.length === 4);
  assert.ok(round, 'no move takes all four');
  assert.equal(round.to, sq(S, 6, 3));
  assert.deepEqual(countPieces(applyMove(b, S, round)), [0, 1, 0]);
});

test('a man is crowned when a capture ends on the far row', () => {
  const b = put(S, [[2, 1, 1], [1, 2, 2]]);
  const [m] = legalMoves(b, S, 1);
  assert.equal(m.to, sq(S, 0, 3));
  assert.equal(m.promote, true);
  assert.equal(applyMove(b, S, m)[sq(S, 0, 3)], 3);
  // and by a plain step
  const [step] = legalMoves(put(S, [[1, 2, 1]]), S, 1).filter((x) => x.to === sq(S, 0, 1));
  assert.equal(step.promote, true);
  // player 2 is crowned on the bottom row
  const [down] = legalMoves(put(S, [[6, 1, 2]]), S, 2).filter((x) => x.to === sq(S, 7, 0));
  assert.equal(applyMove(put(S, [[6, 1, 2]]), S, down)[sq(S, 7, 0)], 4);
});

test('a man that passes the far row during a capture and goes on stays a man', () => {
  // over (1,2) to (0,3) on the far row, then on over (1,4) to (2,5)
  const b = put(S, [[2, 1, 1], [1, 2, 2], [1, 4, 2]]);
  const moves = legalMoves(b, S, 1);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].path, [sq(S, 0, 3), sq(S, 2, 5)]);
  assert.equal(moves[0].promote, false);
  assert.equal(applyMove(b, S, moves[0])[sq(S, 2, 5)], 1);
  // the same on the big board
  const bb = put(B, [[2, 1, 1], [1, 2, 2], [1, 4, 2]]);
  const [mb] = legalMoves(bb, B, 1);
  assert.equal(mb.promote, false);
});

test('on the small board a king moves and captures one step in every direction', () => {
  assert.equal(legalMoves(put(S, [[4, 3, 3]]), S, 1).length, 4);
  // a piece two squares away is not taken
  const far = put(S, [[5, 2, 3], [3, 4, 2]]);
  assert.ok(legalMoves(far, S, 1).every((m) => !m.captured.length));
  // a piece right next to it is, also backwards
  const near = put(S, [[3, 4, 3], [4, 3, 2]]);
  const [m] = legalMoves(near, S, 1);
  assert.equal(m.to, sq(S, 5, 2));
});

test('on the big board kings fly: any distance along a free diagonal', () => {
  // a king on (9,0) sees the whole long diagonal: 9 squares
  assert.equal(legalMoves(put(B, [[9, 0, 3]]), B, 1).length, 9);
  // from (5,4): 4 + 5 + 4 + 4
  assert.equal(legalMoves(put(B, [[5, 4, 3]]), B, 1).length, 17);
  // blocked by its own man
  assert.equal(legalMoves(put(B, [[9, 0, 3], [6, 3, 1]]), B, 1).filter((m) => m.from === sq(B, 9, 0)).length, 2);
});

test('a flying king captures from afar and may land on any free square beyond', () => {
  const b = put(B, [[9, 0, 3], [5, 4, 2]]);
  const moves = legalMoves(b, B, 1);
  assert.deepEqual(tos(moves), [sq(B, 0, 9), sq(B, 1, 8), sq(B, 2, 7), sq(B, 3, 6), sq(B, 4, 5)].sort((a, b) => a - b));
  for (const m of moves) assert.deepEqual(m.captured, [sq(B, 5, 4)]);
  // two pieces next to each other on the line cannot be jumped
  assert.equal(legalMoves(put(B, [[9, 0, 3], [5, 4, 2], [4, 5, 2]]), B, 1).every((m) => !m.captured.length), true);
});

test('big board: you must take the most pieces, and a flying king picks the landing that goes on', () => {
  // man A on (6,1) can take one; man C on (6,5) can take two
  const pieces = [[6, 1, 1], [5, 2, 2], [6, 5, 1], [5, 6, 2], [3, 6, 2], [0, 9, 2]];
  const big = legalMoves(put(B, pieces), B, 1);
  assert.ok(big.length >= 1);
  for (const m of big) {
    assert.equal(m.from, sq(B, 6, 5));
    assert.equal(m.captured.length, 2);
  }
  // on the small board any capture may be chosen
  const smallPieces = [[6, 1, 1], [5, 2, 2], [6, 5, 1], [5, 6, 2], [3, 6, 2], [0, 7, 2]];
  const small = legalMoves(put(S, smallPieces), S, 1);
  assert.deepEqual(new Set(small.map((m) => m.captured.length)), new Set([1, 2]));
  // a flying king: of the squares behind the first piece only the one that takes a second counts
  const king = put(B, [[9, 0, 3], [6, 3, 2], [3, 4, 2]]);
  const km = legalMoves(king, B, 1);
  assert.ok(km.length >= 1);
  for (const m of km) {
    assert.equal(m.captured.length, 2);
    assert.equal(m.path[0], sq(B, 4, 5)); // from (4,5) it can turn and take (3,4)
  }
});

test('a player who cannot move loses; one with no pieces too', () => {
  const blocked = put(S, [[7, 0, 1], [6, 1, 2], [5, 2, 2]]);
  assert.equal(legalMoves(blocked, S, 1).length, 0);
  assert.deepEqual(newGame(S, blocked, 1).over, { winner: 2, reason: 'stuck' });
  assert.deepEqual(newGame(S, put(S, [[2, 3, 2]]), 1).over, { winner: 2, reason: 'stuck' });
  // taking the last piece ends the game
  let g = newGame(S, put(S, [[5, 2, 1], [4, 3, 2]]), 1);
  assert.equal(g.over, null);
  g = play(g, S, legalMoves(g.board, S, 1)[0]);
  assert.deepEqual(g.over, { winner: 1, reason: 'stuck' });
});

test('a draw when the same position comes back a third time', () => {
  let g = newGame(S, put(S, [[7, 0, 3], [0, 7, 4]]), 1);
  const go = (from, to) => {
    const m = legalMoves(g.board, S, g.turn).find((x) => x.from === from && x.to === to);
    assert.ok(m, `no move ${from}->${to}`);
    g = play(g, S, m);
  };
  for (let k = 0; k < 2; k++) {
    assert.equal(g.over, null);
    go(sq(S, 7, 0), sq(S, 6, 1));
    go(sq(S, 0, 7), sq(S, 1, 6));
    go(sq(S, 6, 1), sq(S, 7, 0));
    go(sq(S, 1, 6), sq(S, 0, 7));
  }
  assert.deepEqual(g.over, { draw: true, reason: 'repeat' });
});

test('a draw after QUIET_LIMIT king moves without a capture; a man moving resets the count', () => {
  const g = { ...newGame(S, put(S, [[7, 0, 3], [6, 5, 1], [0, 7, 4]]), 1), quiet: QUIET_LIMIT - 1 };
  const kingMove = legalMoves(g.board, S, 1).find((m) => m.from === sq(S, 7, 0));
  assert.deepEqual(play(g, S, kingMove).over, { draw: true, reason: 'quiet' });
  const manMove = legalMoves(g.board, S, 1).find((m) => m.from === sq(S, 6, 5));
  const after = play(g, S, manMove);
  assert.equal(after.quiet, 0);
  assert.equal(after.over, null);
});

test('play() leaves the old game as it was (undo keeps snapshots)', () => {
  const g = newGame(S);
  const before = g.board.slice();
  play(g, S, legalMoves(g.board, S, 1)[0]);
  assert.deepEqual(g.board, before);
  assert.equal(g.turn, 1);
});

// ---------- tapping a move: step by step ----------

test('pickTargets: the next squares to tap, step by step through a multi-capture', () => {
  const b = put(S, [[7, 2, 1], [6, 1, 2], [6, 3, 2], [4, 5, 2]]);
  const moves = legalMoves(b, S, 1);
  const first = pickTargets(moves, sq(S, 7, 2), []);
  assert.deepEqual(first.targets.sort((a, c) => a - c), [sq(S, 5, 0), sq(S, 5, 4)]);
  const two = pickTargets(moves, sq(S, 7, 2), [sq(S, 5, 4)]);
  assert.ok(two.done && sameMove(two.done, moves.find((m) => m.captured.length === 2)));
  const one = pickTargets(moves, sq(S, 7, 2), [sq(S, 5, 0)]);
  assert.equal(one.done.to, sq(S, 5, 0));
});

// ---------- the computer ----------

function playOut(cfg, levels, seed, maxPlies = 200, opts = {}) {
  const rand = mulberry32(seed);
  let g = newGame(cfg);
  let plies = 0;
  while (!g.over && plies < maxPlies) {
    const lv = levels[g.turn];
    const m = typeof lv === 'function' ? lv(g.board, g.turn, rand) : chooseMove(g.board, cfg, g.turn, lv, rand, opts[g.turn] || {});
    const legal = legalMoves(g.board, cfg, g.turn);
    assert.ok(legal.some((x) => sameMove(x, m) && x.captured.join() === m.captured.join()), 'an illegal move');
    g = play(g, cfg, m);
    plies++;
  }
  return g;
}

/** A simple child: take the capture or step that looks best right now, ties at random. */
const greedy = (cfg) => (board, player, rand) => {
  const moves = legalMoves(board, cfg, player);
  const score = (m) => {
    const after = applyMove(board, cfg, m);
    // look at the computer's best capture back
    const replies = legalMoves(after, cfg, player === 1 ? 2 : 1);
    const loss = replies.length ? Math.max(...replies.map((r) => r.captured.length)) : -5;
    return m.captured.length * 2 + (m.promote ? 2 : 0) - loss * 2;
  };
  const scored = moves.map(score);
  const top = Math.max(...scored);
  const best = moves.filter((_, k) => scored[k] === top);
  return best[Math.floor(rand() * best.length)];
};

test('every level plays only legal moves, on both boards', () => {
  for (let seed = 1; seed <= 4; seed++) {
    playOut(S, { 1: 1, 2: 2 }, seed, 120, { 2: { nodes: 4000 } });
    playOut(B, { 1: 1, 2: 3 }, seed, 60, { 2: { nodes: 3000 } });
  }
});

test('easy loses most games to a child who looks one move ahead', () => {
  let childWins = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const g = playOut(S, { 1: greedy(S), 2: 1 }, seed, 300);
    if (g.over?.winner === 1) childWins++;
  }
  assert.ok(childWins >= 14, `the child won only ${childWins} of 20`);
});

test('medium and hard never leave a man to be taken for nothing when a safe move exists', () => {
  // (5,2)->(4,3) runs into the black man on (3,4); every other move is safe
  const b = put(S, [[5, 2, 1], [6, 7, 1], [3, 4, 2], [0, 1, 2]]);
  const bad = (m) => m.from === sq(S, 5, 2) && m.to === sq(S, 4, 3);
  for (let seed = 1; seed <= 10; seed++) {
    for (const level of [2, 3]) assert.ok(!bad(chooseMove(b, S, 1, level, mulberry32(seed), { nodes: 20000 })), `level ${level} gave a man away`);
  }
});

test('medium and hard never hand over a double capture when a safe move exists', () => {
  // (5,4)->(4,5) lets black jump (4,5) and then (6,5); (5,4)->(4,3) loses one; (6,5)->(5,6) is safe
  const b = put(S, [[5, 4, 1], [6, 5, 1], [3, 4, 2], [0, 1, 2]]);
  for (let seed = 1; seed <= 6; seed++) {
    for (const level of [2, 3]) {
      const m = chooseMove(b, S, 1, level, mulberry32(seed), { nodes: 20000 });
      const replies = legalMoves(applyMove(b, S, m), S, 2);
      const worst = replies.length ? Math.max(...replies.map((r) => r.captured.length)) : 0;
      assert.equal(worst, 0, `level ${level} played ${m.from}->${m.to}`);
    }
  }
});

test('hard beats easy, and the evaluation favours the side with more pieces', () => {
  let hardWins = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const g = playOut(S, { 1: 1, 2: 3 }, seed, 300, { 2: { nodes: 6000 } });
    if (g.over?.winner === 2) hardWins++;
  }
  assert.ok(hardWins >= 3, `hard won only ${hardWins} of 4`);
  assert.ok(evaluate(put(S, [[5, 2, 1], [6, 3, 1], [2, 3, 2]]), S, 1) > 0);
});

// ---------- the free part ----------

test('free: the 8×8 board together and against easy; locked: medium, hard and the 10×10 board', () => {
  assert.equal(meta.isLocked({ variant: 'small', mode: 'duo', level: 1 }, false), false);
  assert.equal(meta.isLocked({ variant: 'small', mode: 'cpu', level: 1 }, false), false);
  assert.equal(meta.isLocked({ variant: 'small', mode: 'cpu', level: 2 }, false), true);
  assert.equal(meta.isLocked({ variant: 'small', mode: 'cpu', level: 3 }, false), true);
  assert.equal(meta.isLocked({ variant: 'big', mode: 'duo', level: 1 }, false), true);
  assert.equal(meta.isLocked({ variant: 'big', mode: 'cpu', level: 1 }, false), true);
  for (const variant of ['small', 'big']) for (const level of [1, 2, 3]) assert.equal(meta.isLocked({ variant, mode: 'cpu', level }, true), false);
  assert.equal(winKey({ variant: 'small', level: 2 }), 'cpu-small-2');
});
