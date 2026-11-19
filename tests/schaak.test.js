import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, FLAG_EP, FLAG_CASTLE_K, FLAG_CASTLE_Q, FLAG_DOUBLE, FIFTY_PLIES, START_FEN,
  CASTLE_WK, CASTLE_WQ, CASTLE_BK, CASTLE_BQ,
  fromFen, toFen, legalMoves, applyMove, newGame, play, outcome, perft, isCheck, insufficientMaterial, positionKey,
  squareOf, squareName, moveText, moveFromText, sameMove, workCopy, legalOn, makeMove, unmakeMove,
} from '../web/games/schaak/rules.js';
import { chooseMove, hintMove, evaluate, mulberry32, freeCaptures, VALUE, THINK_MS, EASY_TAKE } from '../web/games/schaak/ai.js';
import { meta } from '../web/games/schaak/meta.js';
import { winKey, targetsFrom, movesTo, TOUCH_REACH } from '../web/games/schaak/schaak.js';

const sq = squareOf;
const from = (fen) => fromFen(fen);
const texts = (moves) => moves.map(moveText).sort();
const movesOf = (fen, square) => texts(legalMoves(from(fen)).filter((m) => m.from === sq(square)));
/** Play moves given as texts ('e2e4', 'e7e8q') from a FEN; fails on an illegal one. */
function line(list, fen = START_FEN) {
  let g = newGame(fen);
  for (const t of list) {
    const m = moveFromText(g.pos, t);
    assert.ok(m, `${t} is not legal in ${toFen(g.pos)}`);
    g = play(g, m);
  }
  return g;
}

// ---------- the board and FEN ----------

test('the start: 32 pieces, white to move, every castling right, squares named a8..h1', () => {
  const pos = from(START_FEN);
  assert.equal(pos.board.filter(Boolean).length, 32);
  assert.equal(pos.turn, WHITE);
  assert.equal(pos.castling, CASTLE_WK | CASTLE_WQ | CASTLE_BK | CASTLE_BQ);
  assert.equal(pos.board[sq('e1')], KING);
  assert.equal(pos.board[sq('d8')], QUEEN + 8);
  assert.equal(squareName(0), 'a8');
  assert.equal(squareName(63), 'h1');
  assert.equal(sq('e4'), 36);
  assert.equal(toFen(pos), START_FEN);
  const kiwi = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
  assert.equal(toFen(from(kiwi)), kiwi);
  for (const bad of ['', 'x', '8/8/8/8/8/8/8/8 w - - 0 1', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w KQkq - 0 1', 42]) assert.throws(() => fromFen(bad));
});

// ---------- perft: the move generator against the known numbers ----------

test('perft from the start position: 20, 400, 8902, 197281', () => {
  assert.deepEqual([1, 2, 3, 4].map((d) => perft(from(START_FEN), d)), [20, 400, 8902, 197281]);
});

test('perft of "Kiwipete" (castling, en passant, promotions, pins): 48, 2039, 97862', () => {
  const kiwi = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
  assert.deepEqual([1, 2, 3].map((d) => perft(from(kiwi), d)), [48, 2039, 97862]);
});

test('perft of the other standard positions (en passant pins, promotions, checks)', () => {
  // the Chess Programming Wiki's "Perft Results" positions 3, 4 and 5
  assert.deepEqual([1, 2, 3, 4].map((d) => perft(from('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), d)), [14, 191, 2812, 43238]);
  assert.deepEqual([1, 2, 3].map((d) => perft(from('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'), d)), [6, 264, 9467]);
  assert.deepEqual([1, 2, 3].map((d) => perft(from('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'), d)), [44, 1486, 62379]);
});

test('make and unmake leave a position exactly as it was', () => {
  const s = workCopy(from('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'));
  const before = JSON.stringify(s);
  for (const m of legalOn(s)) {
    const u = makeMove(s, m);
    unmakeMove(s, m, u);
    assert.equal(JSON.stringify(s), before, moveText(m));
  }
});

// ---------- every piece ----------

test('a pawn: one step, two from its first row, captures diagonally, never backwards or onto a piece', () => {
  assert.deepEqual(movesOf(START_FEN, 'e2'), ['e2e3', 'e2e4']);
  assert.deepEqual(movesOf('4k3/8/8/8/8/4P3/8/4K3 w - - 0 1', 'e3'), ['e3e4']); // no double step off the first row
  assert.deepEqual(movesOf('4k3/8/8/8/8/4p3/4P3/4K3 w - - 0 1', 'e2'), []); // blocked
  assert.deepEqual(movesOf('4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1', 'e2'), []); // blocked: no capture straight ahead
  assert.deepEqual(movesOf('4k3/8/8/8/4p3/8/4P3/4K3 w - - 0 1', 'e2'), ['e2e3']); // the double step needs both squares free
  assert.deepEqual(movesOf('4k3/8/8/3p1n2/4P3/8/8/4K3 w - - 0 1', 'e4'), ['e4d5', 'e4e5', 'e4f5']);
  assert.deepEqual(movesOf('4k3/4p3/8/8/8/8/8/4K3 b - - 0 1', 'e7'), ['e7e5', 'e7e6']); // black goes down
  const dbl = legalMoves(from(START_FEN)).find((m) => moveText(m) === 'e2e4');
  assert.equal(dbl.flag, FLAG_DOUBLE);
  assert.equal(applyMove(from(START_FEN), dbl).ep, sq('e3'));
});

test('a knight jumps in an L over other pieces; a king steps one square', () => {
  assert.deepEqual(movesOf(START_FEN, 'g1'), ['g1f3', 'g1h3']);
  assert.equal(movesOf('4k3/8/8/8/3N4/8/8/4K3 w - - 0 1', 'd4').length, 8);
  assert.equal(movesOf('4k3/8/8/8/8/8/8/N3K3 w - - 0 1', 'a1').length, 2);
  assert.deepEqual(movesOf('8/8/8/8/3K4/8/8/7k w - - 0 1', 'd4'), ['d4c3', 'd4c4', 'd4c5', 'd4d3', 'd4d5', 'd4e3', 'd4e4', 'd4e5']);
});

test('bishop, rook and queen slide until a piece; they take the first piece of the other side', () => {
  assert.equal(movesOf('4k3/8/8/8/3B4/8/8/4K3 w - - 0 1', 'd4').length, 13);
  assert.equal(movesOf('4k3/8/8/8/3R4/8/8/4K3 w - - 0 1', 'd4').length, 14);
  assert.equal(movesOf('4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1', 'd4').length, 27);
  // a rook on a1 with its own pawn on a3 and a black knight on c1
  assert.deepEqual(movesOf('4k3/8/8/8/8/P7/8/R1n1K3 w - - 0 1', 'a1'), ['a1a2', 'a1b1', 'a1c1']);
  assert.deepEqual(movesOf(START_FEN, 'a1'), []);
  assert.deepEqual(movesOf(START_FEN, 'f1'), []);
});

// ---------- check ----------

test('check: only moves that save the king; a pinned piece stays; the king never walks into check', () => {
  // the white king on e1 in check from a rook on e8: step aside, block or take
  const fen = '4r1k1/8/8/8/8/8/3N4/R3K3 w - - 0 1';
  assert.ok(isCheck(from(fen)));
  const all = texts(legalMoves(from(fen)));
  assert.ok(all.every((t) => t.startsWith('e1') || t === 'd2e4'), all.join());
  assert.ok(all.includes('d2e4')); // the knight blocks
  assert.ok(!all.includes('e1e2')); // still on the file
  assert.ok(!all.includes('e1c1')); // never castle out of check
  // a bishop pinned to its king may only move along the pin
  assert.deepEqual(movesOf('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1', 'e2'), []);
  assert.deepEqual(movesOf('4k3/8/8/b7/8/8/3B4/4K3 w - - 0 1', 'd2'), ['d2a5', 'd2b4', 'd2c3']);
  // kings never stand next to each other
  assert.deepEqual(movesOf('8/8/8/3k4/8/3K4/8/8 w - - 0 1', 'd3'), ['d3c2', 'd3c3', 'd3d2', 'd3e2', 'd3e3']);
});

test('checkmate: the side in check without a move loses (back rank, scholar\'s mate)', () => {
  const g = line(['a1a8'], '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  assert.deepEqual(g.over, { winner: WHITE, reason: 'mate' });
  const s = line(['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7']);
  assert.deepEqual(s.over, { winner: WHITE, reason: 'mate' });
  const fool = line(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  assert.deepEqual(fool.over, { winner: BLACK, reason: 'mate' });
});

test('stalemate: no legal move and not in check is a draw', () => {
  const g = newGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.deepEqual(g.over, { draw: true, reason: 'stalemate' });
  assert.equal(outcome(from('7k/8/8/5Q2/8/8/8/6K1 b - - 0 1')), null);
});

// ---------- castling ----------

test('castling both ways: the king two squares, the rook jumps over it', () => {
  const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
  const moves = legalMoves(from(fen));
  const ks = moves.find((m) => m.flag === FLAG_CASTLE_K);
  const qs = moves.find((m) => m.flag === FLAG_CASTLE_Q);
  assert.equal(moveText(ks), 'e1g1');
  assert.equal(moveText(qs), 'e1c1');
  const a = applyMove(from(fen), ks);
  assert.equal(a.board[sq('g1')], KING);
  assert.equal(a.board[sq('f1')], ROOK);
  assert.equal(a.board[sq('h1')], 0);
  assert.equal(a.castling, CASTLE_BK | CASTLE_BQ);
  const b = applyMove(from(fen), qs);
  assert.equal(b.board[sq('c1')], KING);
  assert.equal(b.board[sq('d1')], ROOK);
  assert.equal(b.board[sq('a1')], 0);
  const black = texts(legalMoves(from(fen.replace(' w ', ' b '))).filter((m) => m.flag >= FLAG_CASTLE_K));
  assert.deepEqual(black, ['e8c8', 'e8g8']);
});

test('castling: not out of check, not through or into an attacked square, not with pieces between', () => {
  const castles = (fen) => texts(legalMoves(from(fen)).filter((m) => m.flag === FLAG_CASTLE_K || m.flag === FLAG_CASTLE_Q));
  assert.deepEqual(castles('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'), ['e1c1', 'e1g1']);
  assert.deepEqual(castles('4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1'), []); // in check
  assert.deepEqual(castles('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1'), ['e1c1']); // f1 attacked: not through it
  assert.deepEqual(castles('4k3/8/8/8/8/8/6r1/R3K2R w KQ - 0 1'), ['e1c1']); // g1 attacked: not into check
  assert.deepEqual(castles('4k3/8/8/8/8/8/3r4/R3K2R w KQ - 0 1'), ['e1g1']); // d1 attacked
  assert.deepEqual(castles('4k3/8/8/8/8/8/1r6/R3K2R w KQ - 0 1'), ['e1c1', 'e1g1']); // b1 attacked: only the rook passes it
  assert.deepEqual(castles('4k3/8/8/8/8/8/8/RN2K1NR w KQ - 0 1'), []); // pieces between
  assert.deepEqual(castles('4k3/8/8/8/8/8/8/R2QK2R w KQ - 0 1'), ['e1g1']);
});

test('castling rights: lost when the king or that rook moves, or the rook is taken', () => {
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  const castles = (g) => texts(legalMoves(g.pos).filter((m) => m.flag === FLAG_CASTLE_K || m.flag === FLAG_CASTLE_Q));
  // the king walks away and back: no castling any more
  assert.deepEqual(castles(line(['e1e2', 'e8e7', 'e2e1', 'e7e8'], fen)), []);
  // the h1 rook moves and back: only the queen's side is left
  assert.deepEqual(castles(line(['h1h2', 'a8a7', 'h2h1', 'a7a8'], fen)), ['e1c1']);
  // the a8 rook is taken (by a bishop, no check): black keeps only the king's side
  const g = line(['g2a8'], 'r3k2r/8/8/8/8/8/6B1/R3K2R w KQkq - 0 1');
  assert.deepEqual(castles(g), ['e8g8']);
  assert.equal(g.pos.castling, CASTLE_WK | CASTLE_WQ | CASTLE_BK);
  // a FEN that claims a right without the rook on its square does not get it
  assert.equal(from('4k3/8/8/8/8/8/8/4K2R w KQ - 0 1').castling, CASTLE_WK);
});

// ---------- en passant ----------

test('en passant: only right after the double step, the pawn passed is taken', () => {
  const g = line(['e2e4', 'a7a6', 'e4e5', 'd7d5']);
  const ep = legalMoves(g.pos).find((m) => m.flag === FLAG_EP);
  assert.equal(moveText(ep), 'e5d6');
  const after = applyMove(g.pos, ep);
  assert.equal(after.board[sq('d5')], 0);
  assert.equal(after.board[sq('d6')], PAWN);
  // one move later it is gone
  const late = line(['e2e4', 'a7a6', 'e4e5', 'd7d5', 'h2h3', 'h7h6']);
  assert.ok(!legalMoves(late.pos).some((m) => m.flag === FLAG_EP));
  // a single step twice is no double step
  const two = line(['e2e4', 'd7d6', 'e4e5', 'd6d5']);
  assert.ok(!legalMoves(two.pos).some((m) => m.flag === FLAG_EP));
  // black takes en passant too
  const b = line(['a2a3', 'd7d5', 'a3a4', 'd5d4', 'e2e4']);
  assert.equal(moveText(legalMoves(b.pos).find((m) => m.flag === FLAG_EP)), 'd4e3');
});

test('en passant is not allowed when it leaves the own king in check (the pin along the row)', () => {
  // white king a5, pawns b5 and c5 side by side after ...c7c5, black rook h5: taking would open the row
  const fen = '8/8/8/KPp4r/8/8/8/4k3 w - c6 0 1';
  assert.ok(!legalMoves(from(fen)).some((m) => m.flag === FLAG_EP));
  assert.ok(legalMoves(from('8/8/8/KPp5/8/8/8/4k3 w - c6 0 1')).some((m) => m.flag === FLAG_EP));
});

// ---------- promotion ----------

test('promotion: a pawn on the far row becomes a queen, rook, bishop or knight (also by capturing)', () => {
  const fen = '1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1';
  const moves = legalMoves(from(fen)).filter((m) => m.from === sq('a7'));
  assert.deepEqual(texts(moves), ['a7a8b', 'a7a8n', 'a7a8q', 'a7a8r', 'a7b8b', 'a7b8n', 'a7b8q', 'a7b8r']);
  const knight = moves.find((m) => moveText(m) === 'a7b8n');
  assert.equal(applyMove(from(fen), knight).board[sq('b8')], KNIGHT);
  assert.equal(applyMove(from(fen), moves.find((m) => moveText(m) === 'a7a8q')).board[sq('a8')], QUEEN);
  // black promotes on the first row
  const b = legalMoves(from('4k3/8/8/8/8/8/p7/4K3 b - - 0 1')).filter((m) => m.from === sq('a2'));
  assert.equal(b.length, 4);
  assert.equal(applyMove(from('4k3/8/8/8/8/8/p7/4K3 b - - 0 1'), b.find((m) => m.promo === ROOK)).board[sq('a1')], ROOK + 8);
  // moveFromText without a letter means the queen
  assert.equal(moveFromText(from(fen), 'a7a8').promo, QUEEN);
});

// ---------- draws ----------

test('a draw when the same position comes back a third time (the side to move and the rights count)', () => {
  const dance = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
  const once = line(dance);
  assert.equal(once.over, null);
  const twice = line([...dance, ...dance]);
  assert.deepEqual(twice.over, { draw: true, reason: 'repeat' });
  // after the kings moved, the same pieces with lost castling rights are a new position
  const k = line(['e2e4', 'e7e5', 'e1e2', 'e8e7', 'e2e1', 'e7e8', 'e1e2', 'e8e7', 'e2e1', 'e7e8']);
  assert.equal(k.over, null);
  const k2 = line(['e2e4', 'e7e5', 'e1e2', 'e8e7', 'e2e1', 'e7e8', 'e1e2', 'e8e7', 'e2e1', 'e7e8', 'e1e2', 'e8e7']);
  assert.deepEqual(k2.over, { draw: true, reason: 'repeat' });
  // an en passant square only counts when the capture is possible
  const p = from('4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1');
  assert.equal(positionKey(p), positionKey(from('4k3/8/8/8/4P3/8/8/4K3 b - - 0 1')));
  const q = from('4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1');
  assert.notEqual(positionKey(q), positionKey(from('4k3/8/8/8/3pP3/8/8/4K3 b - - 0 1')));
});

test('a draw after 50 moves by each side without a capture or a pawn move', () => {
  assert.equal(FIFTY_PLIES, 100);
  const fen = (half) => `4k3/8/8/8/8/8/8/R3K3 w - - ${half} 60`;
  assert.equal(outcome(from(fen(99))), null);
  assert.deepEqual(outcome(from(fen(100))), { draw: true, reason: 'fifty' });
  // a pawn move or a capture starts the count again
  const g = play(newGame('4k3/8/8/8/8/8/P7/R3K3 w - - 99 60'), moveFromText(from('4k3/8/8/8/8/8/P7/R3K3 w - - 99 60'), 'a2a3'));
  assert.equal(g.pos.half, 0);
  assert.equal(g.over, null);
  const h = play(newGame('4k3/8/8/8/8/8/8/R3K3 w - - 98 60'), moveFromText(from('4k3/8/8/8/8/8/8/R3K3 w - - 98 60'), 'a1a2'));
  assert.equal(h.pos.half, 99);
  assert.equal(h.over, null);
});

test('a draw when neither side can mate: K-K, K+B-K, K+N-K, bishops on one colour', () => {
  assert.ok(insufficientMaterial(from('4k3/8/8/8/8/8/8/4K3 w - - 0 1').board));
  assert.ok(insufficientMaterial(from('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1').board));
  assert.ok(insufficientMaterial(from('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1').board));
  assert.ok(insufficientMaterial(from('4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1').board)); // f8 and c1 are both dark
  assert.ok(!insufficientMaterial(from('4k1b1/8/8/8/8/8/8/2B1K3 w - - 0 1').board)); // g8 is light
  assert.ok(!insufficientMaterial(from('4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1').board));
  assert.ok(!insufficientMaterial(from('4k3/8/8/8/8/8/P7/4K3 w - - 0 1').board));
  assert.ok(!insufficientMaterial(from('4k3/8/8/8/8/8/8/R3K3 w - - 0 1').board));
  // taking the last piece ends the game at once
  const g = line(['e1d1'], '4k3/8/8/8/8/8/8/3qK3 w - - 0 1');
  assert.deepEqual(g.over, { draw: true, reason: 'material' });
});

test('play() leaves the old game as it was (take-back keeps snapshots) and sameMove compares moves', () => {
  const g0 = newGame();
  const copy = JSON.stringify(g0);
  const m = moveFromText(g0.pos, 'e2e4');
  const g1 = play(g0, m);
  assert.equal(JSON.stringify(g0), copy);
  assert.equal(g1.pos.turn, BLACK);
  assert.ok(sameMove(m, { from: sq('e2'), to: sq('e4'), promo: 0 }));
  assert.ok(!sameMove(m, { from: sq('e2'), to: sq('e3') }));
  assert.ok(!sameMove({ from: 8, to: 0, promo: QUEEN }, { from: 8, to: 0, promo: KNIGHT }));
});

test('200 seeded games with random moves all end, each in a mate or a draw', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const rand = mulberry32(seed);
    let g = newGame();
    let plies = 0;
    while (!g.over) {
      const moves = legalMoves(g.pos);
      g = play(g, moves[Math.floor(rand() * moves.length)]);
      plies++;
      assert.ok(plies < 6000, `seed ${seed} goes on and on`);
    }
    assert.ok(g.over.winner || g.over.draw);
    seen.add(g.over.reason);
  }
  // random games reach every ending
  for (const r of ['mate', 'stalemate', 'repeat', 'fifty', 'material']) assert.ok(seen.has(r), `no game ended by ${r}`);
});

// ---------- the computer ----------

const k = (p) => p & 7;
/** A simple greedy child: mates in one, takes the most, does not leave pieces hanging, checks. */
function greedy(pos, rand) {
  const me = pos.turn;
  let best = -Infinity;
  let pick = null;
  for (const m of legalMoves(pos)) {
    const s = workCopy(applyMove(pos, m));
    const replies = legalOn(s);
    const check = isCheck(s);
    if (!replies.length && check) return m;
    let score = (m.captured ? VALUE[k(m.captured)] : 0) + (m.promo ? VALUE[m.promo] - 100 : 0);
    if (!replies.length) score -= 2000; // no stalemate
    let threat = 0;
    for (const r of replies) {
      if (!r.captured) continue;
      const u = makeMove(s, r);
      const back = attackedBy(s, r.to, me) ? VALUE[k(r.piece)] : 0;
      unmakeMove(s, r, u);
      threat = Math.max(threat, VALUE[k(r.captured)] - back);
    }
    score -= threat;
    if (check) score += 30;
    score -= replies.length * 2; // fewer moves for the other side
    score += rand() * 5;
    if (score > best) {
      best = score;
      pick = m;
    }
  }
  return pick;
}
import { attacked as attackedBy } from '../web/games/schaak/rules.js';

function playGame(white, black, seed, maxPlies = 2000) {
  const rand = mulberry32(seed);
  let g = newGame();
  while (!g.over && maxPlies--) {
    const mover = g.pos.turn === WHITE ? white : black;
    const m = mover(g, rand);
    assert.ok(legalMoves(g.pos).some((x) => sameMove(x, m)), `an illegal move ${m && moveText(m)}`);
    g = play(g, m);
  }
  return g;
}

test('every level plays only legal moves, also in odd positions, and returns null without a move', () => {
  const fens = [START_FEN, 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', '1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1'];
  for (const fen of fens) {
    for (const level of [1, 2, 3]) {
      for (let seed = 1; seed <= 3; seed++) {
        const m = chooseMove(from(fen), level, mulberry32(seed), { nodes: 4000 });
        assert.ok(legalMoves(from(fen)).some((x) => sameMove(x, m)), `${level} ${fen}`);
      }
    }
  }
  assert.equal(chooseMove(from('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 3, mulberry32(1)), null);
});

test('medium and hard find a mate in one', () => {
  const puzzles = [
    ['6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'a1a8'],
    ['r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1', 'f3f7'],
    ['7k/8/6K1/8/8/8/8/R7 w - - 0 1', 'a1a8'],
    ['rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 1', 'd8h4'],
    ['k7/8/1K6/8/8/8/8/7Q w - - 0 1', null], // several mates (Qa1, Qh8): any of them
  ];
  for (const [fen, want] of puzzles) {
    for (const level of [2, 3]) {
      for (let seed = 1; seed <= 4; seed++) {
        const m = chooseMove(from(fen), level, mulberry32(seed));
        const g = play(newGame(fen), m);
        assert.equal(g.over?.reason, 'mate', `${level} missed the mate in ${fen}: ${moveText(m)}`);
        if (want) assert.equal(moveText(m), want);
      }
    }
  }
});

test('medium and hard take a free queen and do not leave their own queen to be taken', () => {
  // a black queen hangs on d5
  const free = '4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1';
  for (const level of [2, 3]) assert.equal(moveText(chooseMove(from(free), level, mulberry32(1))), 'd2d5');
  // the white queen on d4 is attacked by a pawn on e5: it moves away
  const hanging = '4k3/8/8/4p3/3Q4/8/8/4K3 w - - 0 1';
  for (const level of [2, 3]) {
    for (let seed = 1; seed <= 3; seed++) {
      const m = chooseMove(from(hanging), level, mulberry32(seed));
      const after = applyMove(from(hanging), m);
      const lost = legalMoves(after).some((r) => r.captured === QUEEN);
      assert.ok(!lost || moveText(m) === 'd4e5', `${level} leaves the queen: ${moveText(m)}`);
    }
  }
});

test('easy is beatable: a simple greedy player beats it in most seeded games, and every game ends', () => {
  let won = 0;
  const N = 16;
  for (let seed = 1; seed <= N; seed++) {
    const g = playGame((x, r) => greedy(x.pos, r), (x, r) => chooseMove(x.pos, 1, r, { keys: x.keys }), seed * 7919);
    assert.ok(g.over, `game ${seed} did not end`);
    if (g.over.winner === WHITE) won++;
  }
  assert.ok(won >= N * 0.7, `the greedy player won only ${won} of ${N}`);
  assert.ok(EASY_TAKE > 0 && EASY_TAKE < 1);
});

test('easy now and then takes a free piece; it never misses one every time, nor takes them all', () => {
  const fen = '4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1';
  const free = freeCaptures(from(fen), legalMoves(from(fen)));
  assert.deepEqual(texts(free), ['d2d5']);
  let took = 0;
  for (let seed = 1; seed <= 200; seed++) if (moveText(chooseMove(from(fen), 1, mulberry32(seed))) === 'd2d5') took++;
  assert.ok(took > 40 && took < 140, `took the free queen ${took} of 200 times`);
  // a guarded piece taken by a more valuable one is not free
  assert.deepEqual(texts(freeCaptures(from('4k3/8/2p5/3p4/8/8/3Q4/4K3 w - - 0 1'), legalMoves(from('4k3/8/2p5/3p4/8/8/3Q4/4K3 w - - 0 1')))), []);
});

test('medium and hard beat easy; games against the computer end', () => {
  for (const [level, nodes, games] of [[2, undefined, 3], [3, 8000, 2]]) {
    let won = 0;
    for (let seed = 1; seed <= games; seed++) {
      const g = playGame((x, r) => chooseMove(x.pos, level, r, { keys: x.keys, nodes }), (x, r) => chooseMove(x.pos, 1, r, { keys: x.keys }), seed);
      assert.ok(g.over, `level ${level} game ${seed} did not end`);
      if (g.over.winner === WHITE) won++;
    }
    assert.equal(won, games, `level ${level} beat easy ${won} of ${games} times`);
  }
});

test('the evaluation counts material and pushes a lone king to the edge', () => {
  assert.equal(evaluate(from(START_FEN).board, WHITE), 0);
  assert.ok(evaluate(from('4k3/8/8/8/8/8/8/3QK3 w - - 0 1').board, WHITE) > 800);
  assert.ok(evaluate(from('4k3/8/8/8/8/8/8/3QK3 w - - 0 1').board, BLACK) < -800);
  // with a queen up, the black king on the edge is better for white than in the centre
  const edge = evaluate(from('7k/8/8/8/8/8/8/3QK3 w - - 0 1').board, WHITE);
  const centre = evaluate(from('8/8/8/4k3/8/8/8/3QK3 w - - 0 1').board, WHITE);
  assert.ok(edge > centre);
});

test('hard mates with king and queen against a lone king', () => {
  let g = newGame('8/8/8/4k3/8/8/8/3QK3 w - - 0 1');
  const rand = mulberry32(3);
  for (let ply = 0; ply < 120 && !g.over; ply++) {
    const m = g.pos.turn === WHITE ? chooseMove(g.pos, 3, rand, { keys: g.keys, nodes: 30000 }) : chooseMove(g.pos, 1, rand);
    g = play(g, m);
  }
  assert.deepEqual(g.over, { winner: WHITE, reason: 'mate' });
});

test('the search stops at its time limit as well as its budget', () => {
  const t0 = Date.now();
  const m = chooseMove(from(START_FEN), 3, mulberry32(1), { nodes: 1e9, ms: 150 });
  assert.ok(legalMoves(from(START_FEN)).some((x) => sameMove(x, m)));
  assert.ok(Date.now() - t0 < 1500, `took ${Date.now() - t0} ms`);
  assert.ok(THINK_MS <= 3000);
});

test('a move that repeats a position a third time counts as a draw for the computer', () => {
  // white is a queen up; after Qd1-d2, Kh8-g8, Qd2-d1, Kg8-h8 twice, Qd2 again would draw
  let g = newGame('7k/8/8/8/8/8/8/3QK3 w - - 0 1');
  for (const t of ['d1d2', 'h8g8', 'd2d1', 'g8h8', 'd1d2', 'h8g8', 'd2d1', 'g8h8']) g = play(g, moveFromText(g.pos, t));
  for (let seed = 1; seed <= 3; seed++) {
    const m = chooseMove(g.pos, 2, mulberry32(seed), { keys: g.keys });
    assert.notEqual(play(g, m).over?.reason, 'repeat');
  }
});

test('the hint shows a sensible move: it takes a hanging queen and finds a mate in one', () => {
  assert.equal(moveText(hintMove(from('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1'), mulberry32(1))), 'd2d5');
  assert.equal(moveText(hintMove(from('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'), mulberry32(1))), 'a1a8');
});

// ---------- the screen's helpers, free/paid, the worker ----------

test('targetsFrom and movesTo: a promotion is one target with four moves, the queen first; captures are marked', () => {
  const pos = from('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  const moves = legalMoves(pos);
  const tg = targetsFrom(moves, sq('a7'));
  assert.deepEqual(tg.map((x) => [squareName(x.to), x.capture]).sort(), [['a8', false], ['b8', true]]);
  assert.deepEqual(movesTo(moves, sq('a7'), sq('b8')).map((m) => m.promo), [QUEEN, ROOK, BISHOP, KNIGHT]);
  assert.deepEqual(movesTo(moves, sq('e1'), sq('e2')).length, 1);
  assert.deepEqual(movesTo(moves, sq('e1'), sq('a1')), []);
  assert.ok(TOUCH_REACH >= 22);
});

test('free: together and easy; locked: medium and hard', () => {
  assert.equal(meta.id, 'schaak');
  assert.equal(meta.group, 'board');
  assert.equal(meta.isLocked({ mode: 'duo', level: 3 }, false), false);
  assert.equal(meta.isLocked({ mode: 'cpu', level: 1 }, false), false);
  assert.equal(meta.isLocked({ mode: 'cpu', level: 2 }, false), true);
  assert.equal(meta.isLocked({ mode: 'cpu', level: 3 }, false), true);
  for (const level of [1, 2, 3]) assert.equal(meta.isLocked({ mode: 'cpu', level }, true), false);
  assert.equal(winKey({ mode: 'cpu', level: 2 }), 'cpu-2');
});

test('the worker module answers with a legal move for a job, and an error for a bad one', async () => {
  const posted = [];
  globalThis.self = { postMessage: (m) => posted.push(m) };
  try {
    await import('../web/games/schaak/ai-worker.js');
    globalThis.self.onmessage({ data: { id: 3, fen: START_FEN, keys: [], level: 2, seed: 5 } });
    assert.equal(posted[0].id, 3);
    assert.equal(posted[0].ok, true);
    assert.ok(legalMoves(from(START_FEN)).some((x) => sameMove(x, posted[0].move)));
    globalThis.self.onmessage({ data: { id: 4, fen: 'nope' } });
    assert.equal(posted[1].ok, false);
  } finally {
    delete globalThis.self;
  }
});
