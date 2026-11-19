import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZE, TRACK_LEN, LAST, TRIES, MAX_THROWS, WAYS, TRACK, STARTS, MIDDLE, cellOf, rowOf, colOf, seatsFor,
  newGame, applyThrow, playMove, legalMoves, whyNot, stepsOf, opponentsOn, leader, throwDie, readThrow, isHome, onTrack, mulberry32,
} from '../web/games/pachisi/ludo-rules.js';
import { chooseMove, sensibleMove, scoreMove, danger, EASY_CAPTURE } from '../web/games/pachisi/ludo-ai.js';
import { LUDO, PACHISI, MODES, MODE_IDS, modeOf, ludoSpots, ludoPlace } from '../web/games/pachisi/modes.js';
import { yardCorner } from '../web/games/pachisi/ludo-art.js';
import { meta } from '../web/games/pachisi/meta.js';
import { winKey, cleanSetup, buildHits, pickHit, DEFAULT_SETUP, MIN_HIT } from '../web/games/pachisi/pachisi.js';

/** A game with the pawns where we want them and a throw of `value` waiting. */
function at(pawns, value, turn = 0) {
  const g = { ...newGame(pawns.length, pawns[0].length), pawns: pawns.map((p) => p.slice()), turn };
  return applyThrow(g, value).game;
}
const rc = (cell) => [rowOf(cell), colOf(cell)];
/** Where player 1 (seat 2 in a 2-player game) stands on the cell seat 0 reaches at `pos`. */
const otherPos = (pos, seat = 2) => WAYS[seat].indexOf(WAYS[0][pos]);

// ---------- the board ----------

test('the board: a cross of 40 squares (the outline of three-wide arms), 4 home squares per player, a free middle', () => {
  assert.equal(SIZE, 11);
  assert.equal(TRACK_LEN, 40);
  assert.equal(LAST, 44);
  assert.equal(TRACK.length, 40);
  assert.equal(new Set(TRACK).size, 40);
  for (const cell of TRACK) {
    const [r, c] = rc(cell);
    const inCross = (r >= 4 && r <= 6) || (c >= 4 && c <= 6);
    assert.ok(inCross, `${r},${c} is on the cross`);
    assert.ok(!(r === 5 && c >= 1 && c <= 9) && !(c === 5 && r >= 1 && r <= 9), `${r},${c} is not a middle column`);
  }
  assert.ok(!TRACK.includes(MIDDLE));
  // the home squares: every seat's own four, on its arm's middle column, never on the track
  const homes = new Set();
  for (let seat = 0; seat < 4; seat++) {
    for (let pos = TRACK_LEN + 1; pos <= LAST; pos++) {
      assert.ok(!TRACK.includes(WAYS[seat][pos]));
      homes.add(WAYS[seat][pos]);
    }
  }
  assert.equal(homes.size, 16);
  assert.ok(!homes.has(MIDDLE));
});

test('the way: start square, 40 squares clockwise round, then the own 4 home squares; every step a neighbour', () => {
  for (let seat = 0; seat < 4; seat++) {
    const w = WAYS[seat];
    assert.equal(w.length, LAST + 1);
    assert.equal(w[0], null);
    assert.equal(new Set(w.slice(1, TRACK_LEN + 1)).size, 40, 'every track square once');
    for (let pos = 1; pos < LAST; pos++) {
      const [a, b] = [rc(w[pos]), rc(w[pos + 1])];
      assert.equal(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 1, `seat ${seat}: ${pos} -> ${pos + 1}`);
    }
    // the seats start 10 squares apart on the same loop
    assert.equal(w[1], WAYS[0][((10 * seat) % 40) + 1]);
  }
  // seat 0: up the bottom arm's left column, then the left arm (clockwise on screen)
  assert.deepEqual(rc(WAYS[0][1]), [10, 4]);
  assert.deepEqual(rc(WAYS[0][5]), [6, 4]);
  assert.deepEqual(rc(WAYS[0][6]), [6, 3]);
  assert.deepEqual(rc(WAYS[0][10]), [5, 0]);
  assert.deepEqual(rc(WAYS[0][20]), [0, 5]);
  assert.deepEqual(rc(WAYS[0][40]), [10, 5]); // the end of its own arm, in front of the home squares
  assert.deepEqual(rc(WAYS[0][41]), [9, 5]);
  assert.deepEqual(rc(WAYS[0][44]), [6, 5]);
  assert.deepEqual(STARTS.map(rc), [[10, 4], [4, 0], [0, 6], [6, 10]]);
  // every start square lies next to its own yard
  for (let seat = 0; seat < 4; seat++) {
    const [x0, y0] = yardCorner(seat);
    const [r, c] = rc(STARTS[seat]);
    assert.ok(Math.abs(c + 0.5 - (x0 + 2)) <= 3 && Math.abs(r + 0.5 - (y0 + 2)) <= 3, `seat ${seat}`);
  }
  assert.equal(cellOf(5, 5), MIDDLE);
});

// ---------- the die ----------

test('the die: 1-6 with about equal chances; a 6 throws again', () => {
  const rand = mulberry32(9);
  const n = [0, 0, 0, 0, 0, 0, 0];
  for (let k = 0; k < 6000; k++) n[throwDie(rand)]++;
  assert.equal(n[0], 0);
  for (let v = 1; v <= 6; v++) assert.ok(Math.abs(n[v] - 1000) < 120, `${v}: ${n[v]}`);
  assert.deepEqual(readThrow(6), { value: 6, steps: 6, grace: true });
  assert.deepEqual(readThrow(3), { value: 3, steps: 3, grace: false });
  assert.throws(() => applyThrow(newGame(2), 7));
  assert.throws(() => applyThrow(newGame(2), 0));
});

// ---------- the rules ----------

test('a new game: every pawn in its yard, two players face each other, player 0 throws', () => {
  const g = newGame(2);
  assert.deepEqual(g.pawns, [[0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.deepEqual(g.seats, [0, 2]);
  assert.deepEqual(seatsFor(3), [0, 1, 2]);
  assert.deepEqual(seatsFor(4), [0, 1, 2, 3]);
  assert.deepEqual(newGame(4, 2).pawns, [[0, 0], [0, 0], [0, 0], [0, 0]]);
  assert.throws(() => newGame(1));
  assert.throws(() => newGame(5));
  assert.throws(() => newGame(2, 3));
});

test('entering: only a 6 brings a pawn onto the start square, and it throws again', () => {
  for (let v = 1; v <= 5; v++) assert.deepEqual(legalMoves(at([[0, 0, 0, 0], [0, 0, 0, 0]], v)), []);
  const g = at([[0, 0, 0, 0], [0, 0, 0, 0]], 6);
  const moves = legalMoves(g);
  assert.equal(moves.length, 1, 'pawns in the yard make one and the same move');
  assert.deepEqual({ from: moves[0].from, to: moves[0].to }, { from: 0, to: 1 });
  const r = playMove(g, moves[0]);
  assert.deepEqual(r.game.pawns[0], [1, 0, 0, 0]);
  assert.equal(r.game.turn, 0, 'a 6 throws again');
  assert.deepEqual(r.events.map((e) => e.type), ['move', 'enter', 'again']);
  assert.deepEqual(stepsOf(moves[0]), [1]);
});

test('a 6 must bring a pawn out when the start square is free of your own pawn; otherwise move as usual', () => {
  const g = at([[0, 0, 12, 20], [0, 0, 0, 0]], 6);
  assert.deepEqual(legalMoves(g).map((m) => m.from), [0], 'only the new pawn');
  assert.equal(whyNot(g, 2), 'enter');
  // your own pawn on the start square: no pawn can come out, the others move
  const g2 = at([[0, 1, 12, 0], [0, 0, 0, 0]], 6);
  assert.deepEqual(legalMoves(g2).map((m) => [m.from, m.to]).sort((a, b) => a[0] - b[0]), [[1, 7], [12, 18]]);
  assert.equal(whyNot(g2, 0), 'own');
  // no pawns left in the yard: a 6 moves a pawn
  const g3 = at([[5, 12, 41, 42], [0, 0, 0, 0]], 6);
  assert.deepEqual(legalMoves(g3).map((m) => m.from).sort((a, b) => a - b), [5, 12]);
});

test('moving: exactly the steps, clockwise; a pawn never lands on its own pawn but may walk past it', () => {
  const g = at([[5, 7, 20, 0], [0, 0, 0, 0]], 2);
  assert.deepEqual(legalMoves(g).map((m) => [m.from, m.to]).sort((a, b) => a[0] - b[0]), [[7, 9], [20, 22]]);
  assert.equal(whyNot(g, 0), 'own');
  assert.equal(whyNot(g, 3), 'yard');
  const r = playMove(g, { from: 7, to: 9 });
  assert.deepEqual(r.game.pawns[0], [5, 9, 20, 0]);
  assert.equal(r.game.turn, 1);
  assert.equal(r.game.roll, null);
  assert.throws(() => playMove(g, { from: 5, to: 7 }), /not a legal move/);
  assert.throws(() => playMove(r.game, { from: 9, to: 11 }), /throw first/);
  assert.throws(() => applyThrow(g, 2), /move first/);
  // walking past its own pawn is fine
  const g2 = at([[5, 7, 0, 0], [0, 0, 0, 0]], 4);
  assert.ok(legalMoves(g2).some((m) => m.from === 5 && m.to === 9));
});

test('capture: landing on an opponent sends it back to its yard; there are no safe squares, not even a start square', () => {
  const q = otherPos(23);
  assert.ok(onTrack(q));
  const g = at([[20, 0, 0, 0], [q, 15, 0, 0]], 3);
  const m = legalMoves(g).find((x) => x.from === 20);
  assert.deepEqual(m.captures, [{ player: 1, pawn: 0 }]);
  assert.deepEqual(opponentsOn(g, 0, WAYS[0][23]), [{ player: 1, pawn: 0 }]);
  const r = playMove(g, m);
  assert.deepEqual(r.game.pawns[1], [0, 15, 0, 0]);
  assert.deepEqual(r.events.filter((e) => e.type === 'capture'), [{ type: 'capture', player: 1, pawn: 0, by: 0 }]);
  assert.equal(r.game.turn, 1, 'no extra throw for a capture');
  // a pawn on its own start square is not safe
  const theirStart = otherPos(0) === -1 ? null : WAYS[2][1];
  const myPos = WAYS[0].indexOf(theirStart);
  const g2 = at([[myPos - 4, 0, 0, 0], [1, 0, 0, 0]], 4);
  assert.deepEqual(legalMoves(g2).find((x) => x.from === myPos - 4).captures, [{ player: 1, pawn: 0 }]);
  // coming out with a 6 onto your start square captures an opponent standing there
  const g3 = at([[0, 0, 0, 0], [otherPos(1), 0, 0, 0]], 6);
  const out = legalMoves(g3)[0];
  assert.deepEqual(out.captures, [{ player: 1, pawn: 0 }]);
  assert.equal(playMove(g3, out).game.pawns[1][0], 0);
  // the home squares are private: nobody is captured there
  const g4 = at([[38, 0, 0, 0], [0, 0, 0, 0]], 4);
  assert.deepEqual(legalMoves(g4)[0].captures, []);
});

test('home squares: an exact throw is needed; a throw too high does not move that pawn', () => {
  const g = at([[39, 0, 0, 0], [12, 0, 0, 0]], 5);
  assert.deepEqual(legalMoves(g).map((m) => [m.from, m.to]), [[39, 44]]);
  const r = playMove(g, legalMoves(g)[0]);
  assert.ok(r.events.some((e) => e.type === 'home'));
  assert.ok(isHome(44));
  const g2 = at([[39, 44, 0, 0], [12, 0, 0, 0]], 6);
  assert.equal(whyNot(g2, 0), 'enter'); // a 6 with the yard full: the new pawn comes out
  const g3 = at([[39, 44, 43, 42], [12, 0, 0, 0]], 6);
  assert.equal(whyNot(g3, 0, 6), 'far');
  assert.equal(whyNot(g3, 1, 6), 'done');
  assert.equal(g3.roll, null, 'nothing could move: the 6 throws again');
  // a pawn in the home squares may still walk further in, onto a free one
  const g4 = at([[41, 44, 10, 20], [12, 0, 0, 0]], 2);
  assert.ok(legalMoves(g4).some((m) => m.from === 41 && m.to === 43));
  const g5 = at([[41, 43, 10, 20], [12, 0, 0, 0]], 2);
  assert.ok(!legalMoves(g5).some((m) => m.from === 41), 'not onto its own pawn there either');
});

test('no move: the turn passes; with no pawn on the track: up to three throws; a 6 always throws again', () => {
  // a pawn on the track that can move nowhere (too far, the others home): the turn passes
  let r = applyThrow({ ...newGame(2), pawns: [[39, 44, 43, 42], [12, 0, 0, 0]] }, 3);
  assert.deepEqual(r.events.map((e) => e.type), ['throw', 'nomove']);
  assert.equal(r.game.turn, 1);
  // everything in the yard: three tries for a 6
  let g = newGame(2);
  for (let k = 1; k <= TRIES; k++) {
    r = applyThrow(g, 2);
    assert.equal(r.events[1].type, 'nomove');
    if (k < TRIES) {
      assert.equal(r.game.turn, 0, `try ${k}: again`);
      assert.deepEqual(r.events[2], { type: 'again', player: 0, reason: 'try' });
      assert.equal(r.events[1].tries, k);
    } else assert.equal(r.game.turn, 1, 'after three tries the turn passes');
    g = r.game;
  }
  assert.equal(g.tries, 0);
  // pawns home and in the yard (none on the track): three tries too
  r = applyThrow({ ...newGame(2), pawns: [[44, 0, 0, 0], [5, 0, 0, 0]] }, 1);
  assert.equal(r.game.turn, 0);
  // a six with no move still throws again
  r = applyThrow({ ...newGame(2), pawns: [[39, 44, 43, 42], [12, 0, 0, 0]] }, 6);
  assert.deepEqual(r.events.map((e) => e.type), ['throw', 'nomove', 'again']);
  assert.equal(r.game.turn, 0);
  // after a 6 that brings a pawn out, the next throw is an ordinary move
  g = playMove(at([[0, 0, 0, 0], [0, 0, 0, 0]], 6), { from: 0, to: 1 }).game;
  g = applyThrow(g, 4).game;
  assert.deepEqual(legalMoves(g).map((m) => [m.from, m.to]), [[1, 5]]);
});

test('win: the first player with every pawn in the home squares wins', () => {
  const g = at([[44, 43, 42, 39], [10, 0, 0, 0]], 2);
  const r = playMove(g, legalMoves(g).find((m) => m.from === 39));
  assert.equal(r.game.winner, 0);
  assert.deepEqual(r.game.over, { winner: 0, reason: 'home' });
  assert.ok(r.events.some((e) => e.type === 'win'));
  assert.deepEqual(legalMoves(r.game), []);
  assert.throws(() => applyThrow(r.game, 2), /over/);
  // with 2 pawns each: both in the home squares
  const g2 = at([[44, 38], [10, 0]], 3);
  assert.equal(playMove(g2, legalMoves(g2).find((m) => m.from === 38)).game.winner, 0);
});

test('every game ends: MAX_THROWS throws in all and the one furthest along wins', () => {
  const g = { ...newGame(2), pawns: [[44, 30, 0, 0], [35, 35, 35, 0]], throws: MAX_THROWS - 1 };
  const r = applyThrow(g, 3);
  const done = r.game.over ? r.game : playMove(r.game, legalMoves(r.game)[0]).game;
  assert.ok(done.over);
  assert.equal(done.over.reason, 'limit');
  assert.equal(done.winner, 0, 'one pawn home beats more steps');
  assert.equal(leader({ pawns: [[10, 0], [11, 0]] }), 1);
});

/** One whole game: `players` pick moves; returns the finished game and how often things happened. */
function playGame(n, pawns, policies, seed) {
  const rand = mulberry32(seed);
  let g = newGame(n, pawns);
  const seen = { captures: 0, nomove: 0, tries: 0, enters: 0, sixes: 0 };
  while (!g.over) {
    const r = applyThrow(g, throwDie(rand));
    if (r.events.some((e) => e.type === 'nomove')) seen.nomove++;
    if (r.events.some((e) => e.reason === 'try')) seen.tries++;
    g = r.game;
    if (g.over || !g.roll) continue;
    const moves = legalMoves(g);
    const m = policies[g.turn](g, rand);
    assert.ok(moves.some((x) => x.from === m.from && x.to === m.to), 'only legal moves');
    const res = playMove(g, m);
    seen.captures += res.events.filter((e) => e.type === 'capture').length;
    seen.enters += res.events.filter((e) => e.type === 'enter').length;
    if (g.roll.value === 6) seen.sixes++;
    // nobody ever shares a square: one pawn per track square, own home squares never doubled
    const cells = new Map();
    res.game.pawns.forEach((list, k) =>
      list.forEach((pos) => {
        if (pos <= 0) return;
        const cell = WAYS[res.game.seats[k]][pos];
        assert.ok(!cells.has(cell), `two pawns on ${rc(cell)}`);
        cells.set(cell, k);
      }),
    );
    g = res.game;
  }
  return { g, seen };
}

const easy = (g, rand) => chooseMove(g, 1, rand);
const medium = (g, rand) => chooseMove(g, 2, rand);
const kid = (g) => sensibleMove(g);

test('200 seeded games with 2, 3 and 4 players and 2 or 4 pawns all end, with captures, tries and sixes', () => {
  const seen = { captures: 0, nomove: 0, tries: 0, enters: 0, sixes: 0 };
  let limit = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const n = 2 + (seed % 3);
    const pawns = seed % 2 ? 4 : 2;
    const policies = Array.from({ length: n }, (_, k) => [easy, medium, kid][(seed + k) % 3]);
    const { g, seen: s } = playGame(n, pawns, policies, seed);
    assert.ok(g.over && g.winner >= 0 && g.winner < n);
    if (g.over.reason === 'limit') limit++;
    else assert.ok(g.pawns[g.winner].every(isHome));
    for (const k of Object.keys(seen)) seen[k] += s[k];
  }
  assert.equal(limit, 0, 'ordinary games end long before MAX_THROWS');
  assert.ok(seen.captures > 500 && seen.tries > 500 && seen.nomove > 500 && seen.enters > 1000, JSON.stringify(seen));
});

// ---------- the computer ----------

test('easy is gentle: a sensible child wins at least 3 in 4 games with 4 pawns (and most with 2), either player first', () => {
  for (const pawns of [4, 2]) {
    let won = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const first = seed % 2 === 0;
      const { g } = playGame(2, pawns, first ? [kid, easy] : [easy, kid], 1000 + seed);
      if (g.winner === (first ? 0 : 1)) won++;
    }
    assert.ok(won >= (pawns === 4 ? 150 : 120), `the child won ${won} of 200 with ${pawns} pawns`);
  }
});

test('easy takes a capture only now and then; medium always does', () => {
  const q = otherPos(23);
  const g = at([[20, 10, 0, 0], [q, 0, 0, 0]], 3);
  let took = 0;
  const rand = mulberry32(3);
  for (let k = 0; k < 1000; k++) if (chooseMove(g, 1, rand).captures.length) took++;
  assert.ok(took > 1000 * EASY_CAPTURE * 0.7 && took < 1000 * EASY_CAPTURE * 1.4, `easy took ${took} of 1000`);
  for (let s = 1; s < 50; s++) assert.equal(chooseMove(g, 2, mulberry32(s)).from, 20);
});

test('medium prefers safety and progress: away from a pawn behind it, into the home squares, a new pawn out', () => {
  // pawn A at 12 has an opponent 2 behind it; pawn B at 30 is safe. With a 6, medium moves A out of reach
  const behind = otherPos(10);
  const g = at([[12, 30, 41, 44], [behind, 0, 0, 0]], 6);
  assert.ok(danger(g, 0, WAYS[0][12]) > 0);
  const moves = legalMoves(g);
  const a = moves.find((m) => m.from === 12);
  const b = moves.find((m) => m.from === 30);
  assert.ok(scoreMove(g, a) > scoreMove(g, b));
  for (let s = 1; s < 20; s++) assert.equal(chooseMove(g, 2, mulberry32(s)).from, 12);
  // into the home squares when it can
  const g2 = at([[38, 20, 0, 0], [0, 0, 0, 0]], 4);
  assert.equal(chooseMove(g2, 2, mulberry32(1)).to, 42);
  // the home squares are safe; the yard reaches its start square with a 6
  assert.equal(danger(g, 0, WAYS[0][41]), 0);
  assert.equal(danger({ ...newGame(2), pawns: [[0, 0, 0, 0], [0, 0, 0, 0]] }, 0, WAYS[2][1]), 1 / 6);
});

test('medium beats easy in most games and plays only legal moves; every level returns null without moves', () => {
  let won = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const { g } = playGame(2, 4, seed % 2 ? [medium, easy] : [easy, medium], 5000 + seed);
    if (g.winner === (seed % 2 ? 0 : 1)) won++;
  }
  assert.ok(won >= 70, `medium won ${won} of 100`);
  const none = { ...newGame(2), roll: { value: 3, steps: 3 } };
  assert.equal(chooseMove(none, 1), null);
  assert.equal(chooseMove(none, 2), null);
});

// ---------- the two modes and the screen's pure parts ----------

test('the modes: Ludo is the default, Pachisi the second; both play through the same interface', () => {
  assert.deepEqual(MODE_IDS, ['ludo', 'pachisi']);
  assert.equal(modeOf(undefined), LUDO);
  assert.equal(modeOf('pachisi'), PACHISI);
  assert.equal(modeOf('parcheesi'), LUDO);
  for (const m of Object.values(MODES)) {
    for (const f of ['newGame', 'applyThrow', 'playMove', 'legalMoves', 'stepsOf', 'randomThrow', 'readThrow', 'items', 'isDone', 'pawnSpots', 'placeOf', 'boardSvg', 'chooseMove', 'why', 'safeAt']) assert.equal(typeof m[f], 'function', `${m.id}.${f}`);
    const rand = mulberry32(4);
    const g = m.newGame(2, 2);
    const thr = m.randomThrow(rand);
    const roll = m.readThrow(thr);
    assert.ok(m.items(roll).length >= 1);
    assert.ok(m.applyThrow(g, thr).game.throws === 1);
    assert.match(m.boardSvg(g.seats), /^<svg /);
  }
  // the die's items are its pips; the shells' the open shells
  assert.deepEqual(LUDO.items(LUDO.readThrow(4)), [true, true, true, true]);
  assert.deepEqual(PACHISI.items(PACHISI.readThrow([true, false, true, false, false, false])), [true, false, true, false, false, false]);
  assert.equal(LUDO.why(at([[0, 0, 0, 0], [0, 0, 0, 0]], 6), 0), null);
  assert.equal(LUDO.why(at([[0, 9, 0, 0], [0, 0, 0, 0]], 3), 0), 'ludo.needSix');
  assert.equal(LUDO.safeAt(newGame(2), 0, 1), false);
});

test('free and full version, the same in both modes; a saved setup is made safe and an old one opens Ludo', () => {
  for (const mode of MODE_IDS) {
    assert.equal(meta.isLocked({ mode, players: ['kid', 'cpu'], level: 1 }, false), false);
    assert.equal(meta.isLocked({ mode, players: ['kid', 'cpu'], level: 2 }, false), true);
    assert.equal(meta.isLocked({ mode, players: ['kid', 'kid', 'kid'], level: 1 }, false), true);
    assert.equal(meta.isLocked({ mode, players: ['kid', 'cpu', 'cpu', 'cpu'], level: 2 }, true), false);
  }
  assert.equal(meta.id, 'pachisi', 'the id stays for save compatibility');
  assert.equal(DEFAULT_SETUP.mode, 'ludo');
  assert.equal(winKey(1), 'ludo-cpu-1');
  assert.equal(winKey(2, 'ludo'), 'ludo-cpu-2');
  assert.equal(winKey(2, 'pachisi'), 'cpu-2');
  // a setup saved before Ludo came (no mode) opens Ludo with the rest kept
  assert.deepEqual(cleanSetup({ players: ['kid', 'kid'], level: 1, pawns: 2, count: false }), { mode: 'ludo', players: ['kid', 'kid'], level: 1, pawns: 2, count: false });
  assert.equal(cleanSetup({ mode: 'pachisi' }).mode, 'pachisi');
  assert.equal(cleanSetup({ mode: 'mens' }).mode, 'ludo');
  assert.deepEqual(cleanSetup(null), { ...DEFAULT_SETUP, players: ['kid', 'cpu'] });
});

test('Ludo pawn spots: on their own square, in their own nest in their own yard, never on top of each other', () => {
  const seats = [0, 1, 2, 3];
  const shown = [[0, 0, 5, 44], [0, 30, 41, 0], [12, 0, 0, 0], [0, 0, 0, 0]];
  const spots = ludoSpots(seats, shown);
  const c = WAYS[0][5];
  assert.ok(Math.abs(spots[0][2].x - (colOf(c) + 0.5)) < 1e-9 && Math.abs(spots[0][2].y - (rowOf(c) + 0.5)) < 0.1);
  for (let k = 0; k < 4; k++) {
    const [x0, y0] = yardCorner(seats[k]);
    shown[k].forEach((pos, i) => {
      if (pos !== 0) return;
      const s = spots[k][i];
      assert.ok(s.x > x0 && s.x < x0 + 4 && s.y > y0 && s.y < y0 + 4, `player ${k} pawn ${i} in its yard`);
    });
  }
  const all = spots.flat().map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)}`);
  assert.equal(new Set(all).size, all.length);
  // 2 pawns: the two nests on the diagonal
  const two = ludoSpots([0, 2], [[0, 0], [0, 0]]);
  assert.ok(Math.abs(two[0][0].x - two[0][1].x) > 1.5 && Math.abs(two[0][0].y - two[0][1].y) > 1.5);
  assert.deepEqual(ludoPlace([0, 2], 0, 41), { x: 5.5, y: 9.5 });
});

test('Ludo taps: the glowing target wins over a pawn right next to it; every yard pawn and every movable pawn is a hit', () => {
  // pawns on 10 and 11: the pawn on 10 picked with a 2 (11 is its own: it walks past to 12)
  const g = at([[10, 11, 0, 0], [0, 0, 0, 0]], 2);
  const hits = buildHits(g, g.pawns, 10, LUDO);
  const target = hits.find((h) => h.kind === 'target');
  assert.equal(target.to, 12);
  for (const cell of [24, 30, 44, 60]) {
    // a tap on the target (one square from the pawn on 11) walks
    for (const [dx, dy] of [[0, 0], [0.25, -0.2], [-0.3, 0.15]]) assert.equal(pickHit(hits, target.x + dx, target.y + dy, cell).kind, 'target', `cell ${cell}`);
    const on10 = hits.find((h) => h.kind === 'pawn' && h.from === 10);
    assert.equal(pickHit(hits, on10.x, on10.y, cell).from, 10);
  }
  // a 6 with pawns in the yard: every yard pawn can be tapped (they all make the one move)
  const g6 = at([[0, 0, 0, 30], [0, 0, 0, 0]], 6);
  const h6 = buildHits(g6, g6.pawns, null, LUDO);
  assert.equal(h6.filter((h) => h.kind === 'pawn' && h.from === 0).length, 3);
  const spots = ludoSpots(g6.seats, g6.pawns);
  for (let i = 0; i < 3; i++) assert.equal(pickHit(h6, spots[0][i].x, spots[0][i].y, 30).from, 0);
  // far from everything: nothing
  assert.equal(pickHit(h6, 9, 1, 30), null);
  assert.ok(MIN_HIT >= 44);
});

test('names: Ludo may be used, never the names of the trademarked spin-offs (app, store texts, parents\' pages)', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('../', import.meta.url).pathname;
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? (d.name === 'vendor' ? [] : files(join(dir, d.name))) : /\.(js|html|css|md|json)$/.test(d.name) ? [join(dir, d.name)] : []));
  const banned = [/mens\s*erger/i, /mensch\s*ärgere/i, /parcheesi/i];
  for (const f of [...files(join(root, 'web')), ...files(join(root, 'store'))]) {
    const text = readFileSync(f, 'utf8');
    for (const re of banned) assert.ok(!re.test(text), `${f.slice(root.length)} names ${re}`);
  }
  // the tile says Ludo, with its small line
  const { allStrings } = await import('../web/js/i18n.js');
  await import('../web/games/pachisi/strings.js');
  const s = allStrings();
  assert.equal(s.nl['games.pachisi'], 'Ludo');
  assert.equal(s.en['games.pachisi'], 'Ludo');
  assert.equal(s.nl['pachisi.subtitle'], 'met één dobbelsteen');
  assert.equal(s.en['pachisi.subtitle'], 'with one die');
});
