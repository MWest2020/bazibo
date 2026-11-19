import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZE, HOME, SHELLS, STEPS, GRACE, MAX_THROWS, PATHS, CASTLES, TRACK, CENTRE, STEP_CHANCE,
  cellOf, rowOf, colOf, isCastle, seatsFor, newGame, applyThrow, playMove, legalMoves, readThrow, throwShells,
  stepsOf, opponentsOn, leader, mulberry32,
} from '../web/games/pachisi/rules.js';
import { chooseMove, sensibleMove, scoreMove, danger, EASY_CAPTURE } from '../web/games/pachisi/ai.js';
import { meta } from '../web/games/pachisi/meta.js';
import { winKey, cleanSetup, pawnSpots, placeOf, buildHits, pickHit, otherOnSquare, DEFAULT_SETUP, MIN_HIT } from '../web/games/pachisi/pachisi.js';

/** Six shells with `open` of them mouth up. */
const shells = (open) => Array.from({ length: SHELLS }, (_, i) => i < open);
/** A game with the pawns where we want them and a throw of `open` shells waiting. */
function at(pawns, open, turn = 0) {
  const g = { ...newGame(pawns.length, pawns[0].length), pawns: pawns.map((p) => p.slice()), turn };
  return applyThrow(g, shells(open)).game;
}
const rc = (cell) => [rowOf(cell), colOf(cell)];

// ---------- the board ----------

test('the board: a cross of four arms of 3×8 squares round the 3×3 Charkoni', () => {
  assert.equal(SIZE, 19);
  assert.equal(TRACK.length, 4 * 3 * 8);
  assert.equal(new Set(TRACK).size, 96);
  for (const cell of TRACK) {
    const [r, c] = rc(cell);
    const inArm = (r >= 8 && r <= 10) !== (c >= 8 && c <= 10);
    assert.ok(inArm, `${r},${c} is on an arm`);
  }
  assert.deepEqual(rc(CENTRE), [9, 9]);
  assert.ok(!TRACK.includes(CENTRE));
});

test('the path: 84 steps, down the own middle column, counter-clockwise round, back up into the Charkoni', () => {
  for (let seat = 0; seat < 4; seat++) {
    const p = PATHS[seat];
    assert.equal(p.length, HOME + 1);
    assert.equal(p[0], CENTRE);
    assert.equal(p[HOME], CENTRE);
    for (let pos = 1; pos < HOME; pos++) assert.ok(TRACK.includes(p[pos]), `seat ${seat} pos ${pos} on the track`);
    // every step goes to a neighbouring square (straight, or diagonally across an inner corner)
    for (let pos = 1; pos < HOME - 1; pos++) {
      const [a, b] = [rc(p[pos]), rc(p[pos + 1])];
      if (pos === 8 || pos === 76) continue;
      assert.equal(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])), 1, `seat ${seat}: ${pos} -> ${pos + 1}`);
    }
    // the middle column out (1-8) and back in (76-83) are the same squares
    for (let k = 1; k <= 8; k++) assert.equal(p[k], p[84 - k]);
    // the loop (8-76) visits every outer square and every middle column's end once
    const loop = new Set(p.slice(8, 76));
    assert.equal(loop.size, 68);
  }
  // seat 0: down the bottom arm's middle column, then right (counter-clockwise on screen)
  assert.deepEqual(rc(PATHS[0][1]), [11, 9]);
  assert.deepEqual(rc(PATHS[0][8]), [18, 9]);
  assert.deepEqual(rc(PATHS[0][9]), [18, 10]);
  assert.deepEqual(rc(PATHS[0][17]), [10, 11]); // into the right arm
  assert.deepEqual(rc(PATHS[0][25]), [9, 18]); // the right arm's end
  assert.deepEqual(rc(PATHS[0][42]), [0, 9]); // the top arm's end
  assert.deepEqual(rc(PATHS[0][59]), [9, 0]); // the left arm's end
  assert.deepEqual(rc(PATHS[0][83]), [11, 9]);
  // the other seats walk the same loop, a quarter turn later
  const loop0 = PATHS[0].slice(8, 76);
  for (let seat = 1; seat < 4; seat++) assert.ok(PATHS[seat].slice(8, 76).every((c) => loop0.includes(c)));
  assert.equal(PATHS[1][8], PATHS[0][25]);
});

test('castles: 12, the end of every middle column and the 4th square from the end of every outer column; 25 from home', () => {
  assert.equal(CASTLES.length, 12);
  assert.equal(new Set(CASTLES).size, 12);
  const bottom = CASTLES.map(rc).filter(([r]) => r > 10).sort();
  assert.deepEqual(bottom, [[15, 10], [15, 8], [18, 9]].sort());
  for (let seat = 0; seat < 4; seat++) {
    assert.ok(isCastle(PATHS[seat][8]), 'the own middle end');
    // Wikipedia: the castle squares are exactly 25 moves from the Charkoni (the end before home)
    assert.ok(isCastle(PATHS[seat][HOME - 25]));
  }
});

// ---------- the shells ----------

test('throws: the six-shell table, open shells = steps for 2-6, one open 10, none open 25; graces 6, 10, 25', () => {
  assert.deepEqual(STEPS, [25, 10, 2, 3, 4, 5, 6]);
  assert.deepEqual(GRACE, [0, 1, 6]);
  for (let open = 0; open <= 6; open++) {
    const r = readThrow(shells(open));
    assert.equal(r.open, open);
    assert.equal(r.steps, STEPS[open]);
    assert.equal(r.grace, open === 0 || open === 1 || open === 6);
  }
  assert.deepEqual(readThrow([false, true, false, true, true, false]), { open: 3, steps: 3, grace: false });
  const total = Object.values(STEP_CHANCE).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-12);
  assert.equal(STEP_CHANCE[3], 20 / 64);
  // the seeded throw: six shells, about half open
  const rand = mulberry32(5);
  let open = 0;
  for (let k = 0; k < 2000; k++) {
    const s = throwShells(rand);
    assert.equal(s.length, 6);
    open += s.filter(Boolean).length;
  }
  assert.ok(Math.abs(open / 12000 - 0.5) < 0.03);
});

// ---------- moving ----------

test('a new game: every pawn in the Charkoni, two players face each other, player 0 throws', () => {
  const g = newGame(2);
  assert.deepEqual(g.pawns, [[0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.deepEqual(g.seats, [0, 2]);
  assert.deepEqual(seatsFor(3), [0, 1, 2]);
  assert.deepEqual(seatsFor(4), [0, 1, 2, 3]);
  assert.equal(g.turn, 0);
  assert.deepEqual(newGame(3, 2).pawns, [[0, 0], [0, 0], [0, 0]]);
  assert.throws(() => newGame(1));
  assert.throws(() => newGame(5));
  assert.throws(() => newGame(2, 3));
});

test('entering: a pawn leaves the Charkoni with any throw (simplified: no grace needed)', () => {
  for (let open = 0; open <= 6; open++) {
    const g = at([[0, 0, 0, 0], [0, 0, 0, 0]], open);
    const moves = legalMoves(g);
    assert.equal(moves.length, 1, 'pawns in the Charkoni make one and the same move');
    assert.deepEqual({ from: moves[0].from, to: moves[0].to }, { from: 0, to: STEPS[open] });
  }
});

test('moving: one pawn a throw, exactly the steps along its path; pawns on one square make the same move', () => {
  let g = at([[5, 5, 20, 0], [0, 0, 0, 0]], 3);
  const moves = legalMoves(g);
  assert.deepEqual(moves.map((m) => [m.from, m.to]).sort((a, b) => a[0] - b[0]), [[0, 3], [5, 8], [20, 23]]);
  const r = playMove(g, { from: 20, to: 23 });
  assert.deepEqual(r.game.pawns[0], [5, 5, 23, 0]);
  assert.equal(r.game.turn, 1);
  assert.equal(r.game.roll, null);
  assert.deepEqual(stepsOf({ from: 20, to: 23 }), [21, 22, 23]);
  assert.throws(() => playMove(g, { from: 20, to: 24 }));
  assert.throws(() => playMove(r.game, { from: 0, to: 3 }), /throw first/);
  g = r.game;
  assert.throws(() => applyThrow(applyThrow(g, shells(2)).game, shells(2)), /move first/);
});

test('graces: after a 6, 10 or 25 the same player throws again; never after 2-5', () => {
  for (let open = 0; open <= 6; open++) {
    const g = at([[0, 0, 0, 0], [0, 0, 0, 0]], open);
    const r = playMove(g, legalMoves(g)[0]);
    assert.equal(r.game.turn, GRACE.includes(open) ? 0 : 1, `open ${open}`);
    assert.equal(r.events.some((e) => e.type === 'again'), GRACE.includes(open));
  }
});

test('home: a throw that reaches or passes the Charkoni brings the pawn home (no exact throw needed)', () => {
  const g = at([[83, 80, 0, 0], [0, 0, 0, 0]], 2);
  const moves = legalMoves(g);
  assert.ok(moves.some((m) => m.from === 83 && m.to === HOME));
  assert.ok(moves.some((m) => m.from === 80 && m.to === 82));
  const r = playMove(g, { from: 83, to: HOME });
  assert.equal(r.game.pawns[0][0], HOME);
  assert.ok(r.events.some((e) => e.type === 'home'));
  // a pawn at home never moves again
  const g2 = at([[HOME, 10, 0, 0], [0, 0, 0, 0]], 3);
  assert.ok(legalMoves(g2).every((m) => m.from !== HOME));
});

test('capture: landing on an opponent outside a castle sends it back to the Charkoni; it starts again', () => {
  // player 1 (seat 2) on its position 13 stands on seat 0's position 47 (half way round)
  const cell = PATHS[0][47];
  const q = PATHS[2].indexOf(cell);
  assert.ok(q > 8 && q < 76);
  assert.ok(!isCastle(cell));
  const g = at([[44, 0, 0, 0], [q, q + 5, 0, 0]], 3);
  const m = legalMoves(g).find((x) => x.from === 44);
  assert.deepEqual(m.captures, [{ player: 1, pawn: 0 }]);
  assert.deepEqual(opponentsOn(g, 0, cell), [{ player: 1, pawn: 0 }]);
  const r = playMove(g, m);
  assert.equal(r.game.pawns[1][0], 0);
  assert.equal(r.game.pawns[1][1], q + 5);
  assert.deepEqual(r.events.filter((e) => e.type === 'capture'), [{ type: 'capture', player: 1, pawn: 0, by: 0 }]);
  assert.equal(r.game.turn, 1, 'no extra throw for a capture (simplified)');
  // the captured pawn can come out again with any throw
  const back = applyThrow(r.game, shells(2)).game;
  assert.ok(legalMoves(back).some((x) => x.from === 0));
});

test('capture: every opponent pawn on the square goes back; own pawns share squares', () => {
  const cell = PATHS[0][30];
  const q = PATHS[2].indexOf(cell);
  const g = at([[28, 30, 0, 0], [q, q, 0, 0]], 2);
  // landing on its own pawn is fine
  const own = legalMoves(g).find((m) => m.from === 28);
  assert.equal(own.to, 30);
  assert.deepEqual(own.captures.map((c) => c.pawn).sort(), [0, 1]);
  const r = playMove(g, own);
  assert.deepEqual(r.game.pawns[1], [0, 0, 0, 0]);
  assert.deepEqual(r.game.pawns[0].slice(0, 2), [30, 30]);
});

test('castles: a pawn there cannot be captured, and nobody may land on a castle an opponent holds', () => {
  const castle = PATHS[0][25]; // the right arm's end
  assert.ok(isCastle(castle));
  const q = PATHS[2].indexOf(castle);
  const g = at([[22, 0, 0, 0], [q, 0, 0, 0]], 3);
  assert.ok(!legalMoves(g).some((m) => m.from === 22), 'the castle is held: that pawn cannot go there');
  assert.ok(legalMoves(g).some((m) => m.from === 0));
  // without the opponent: it may land there; then it is safe
  const g2 = at([[22, 0, 0, 0], [5, 0, 0, 0]], 3);
  const r = playMove(g2, legalMoves(g2).find((m) => m.from === 22));
  assert.equal(r.game.pawns[0][0], 25);
  assert.equal(danger(r.game, 0, castle), 0);
  // nobody else can land there now
  const p1 = PATHS[2].indexOf(castle) - 3;
  const g3 = at([[25, 0, 0, 0], [p1, 0, 0, 0]], 3, 1);
  assert.ok(!legalMoves(g3).some((m) => m.from === p1));
});

test('a throw no pawn can use is lost (and a grace still gives the next throw)', () => {
  // the only pawn not home would land on a castle an opponent holds
  const castle = PATHS[0][25];
  const q = PATHS[2].indexOf(castle);
  const g = { ...newGame(2), pawns: [[22, HOME, HOME, HOME], [q, 0, 0, 0]] };
  const r = applyThrow(g, shells(3));
  assert.deepEqual(r.events.map((e) => e.type), ['throw', 'nomove']);
  assert.equal(r.game.turn, 1);
  assert.equal(r.game.roll, null);
  // the same with a six: the same player throws again
  const g6 = { ...newGame(2), pawns: [[19, HOME, HOME, HOME], [PATHS[2].indexOf(castle), 0, 0, 0]] };
  const r6 = applyThrow(g6, shells(6));
  assert.deepEqual(r6.events.map((e) => e.type), ['throw', 'nomove', 'again']);
  assert.equal(r6.game.turn, 0);
});

test('win: the first player with every pawn home wins', () => {
  const g = at([[HOME, HOME, HOME, 80], [10, 0, 0, 0]], 4);
  const r = playMove(g, legalMoves(g).find((m) => m.from === 80));
  assert.equal(r.game.winner, 0);
  assert.deepEqual(r.game.over, { winner: 0, reason: 'home' });
  assert.ok(r.events.some((e) => e.type === 'win'));
  assert.deepEqual(legalMoves(r.game), []);
  assert.throws(() => applyThrow(r.game, shells(2)), /over/);
});

test('every game ends: MAX_THROWS throws in all and the one furthest along wins', () => {
  const g = { ...newGame(2), pawns: [[HOME, 30, 0, 0], [50, 50, 50, 50]], throws: MAX_THROWS - 1 };
  const r = applyThrow(g, shells(3));
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
  const seen = { captures: 0, nomove: 0, castles: 0 };
  while (!g.over) {
    const r = applyThrow(g, throwShells(rand));
    if (r.events.some((e) => e.type === 'nomove')) seen.nomove++;
    g = r.game;
    if (g.over || !g.roll) continue;
    const moves = legalMoves(g);
    const m = policies[g.turn](g, rand);
    assert.ok(moves.some((x) => x.from === m.from && x.to === m.to), 'only legal moves');
    const res = playMove(g, m);
    seen.captures += res.events.filter((e) => e.type === 'capture').length;
    if (m.to < HOME && isCastle(PATHS[g.seats[g.turn]][m.to])) seen.castles++;
    // nobody ever stands on a castle with an opponent
    for (const cell of CASTLES) {
      const owners = new Set();
      res.game.pawns.forEach((list, k) => list.forEach((pos) => pos > 0 && pos < HOME && PATHS[res.game.seats[k]][pos] === cell && owners.add(k)));
      assert.ok(owners.size <= 1);
    }
    g = res.game;
  }
  return { g, seen };
}

const easy = (g, rand) => chooseMove(g, 1, rand);
const medium = (g, rand) => chooseMove(g, 2, rand);
const kid = (g) => sensibleMove(g);

test('200 seeded games with 2, 3 and 4 players and 2 or 4 pawns all end, with captures, castles and lost throws', () => {
  const seen = { captures: 0, nomove: 0, castles: 0 };
  let limit = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const n = 2 + (seed % 3);
    const pawns = seed % 2 ? 4 : 2;
    const policies = Array.from({ length: n }, (_, k) => [easy, medium, kid][(seed + k) % 3]);
    const { g, seen: s } = playGame(n, pawns, policies, seed);
    assert.ok(g.over && g.winner >= 0 && g.winner < n);
    if (g.over.reason === 'limit') limit++;
    else assert.ok(g.pawns[g.winner].every((p) => p === HOME));
    for (const k of Object.keys(seen)) seen[k] += s[k];
  }
  assert.equal(limit, 0, 'ordinary games end long before MAX_THROWS');
  assert.ok(seen.captures > 100 && seen.castles > 100 && seen.nomove > 10, JSON.stringify(seen));
});

// ---------- the computer ----------

test('easy is gentle: a sensible child wins most games against it (2 and 4 pawns, either player first)', () => {
  for (const pawns of [2, 4]) {
    let won = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const first = seed % 2 === 0;
      const { g } = playGame(2, pawns, first ? [kid, easy] : [easy, kid], 1000 + seed);
      if (g.winner === (first ? 0 : 1)) won++;
    }
    assert.ok(won >= (pawns === 4 ? 150 : 115), `the child won ${won} of 200 with ${pawns} pawns`);
  }
});

test('easy takes a capture only now and then; medium always does', () => {
  const cell = PATHS[0][47];
  const q = PATHS[2].indexOf(cell);
  const g = at([[44, 10, 0, 0], [q, 0, 0, 0]], 3);
  let took = 0;
  const rand = mulberry32(3);
  for (let k = 0; k < 1000; k++) if (chooseMove(g, 1, rand).captures.length) took++;
  assert.ok(took > 1000 * EASY_CAPTURE * 0.7 && took < 1000 * EASY_CAPTURE * 1.4, `easy took ${took} of 1000`);
  for (let s = 1; s < 50; s++) assert.equal(chooseMove(g, 2, mulberry32(s)).from, 44);
});

test('medium prefers a castle over a square an opponent can reach', () => {
  // pawn A can land on the right arm's end (a castle); pawn B on a square two in front of an opponent
  const castle = PATHS[0][25];
  const target = PATHS[0][40];
  const q = PATHS[2].indexOf(target) - 3; // three behind: a 3 hits it (the likeliest throw)
  const g = at([[22, 37, 0, 0], [q, 0, 0, 0]], 3);
  assert.ok(isCastle(castle) && !isCastle(target));
  assert.ok(danger(g, 0, target) > 0.25);
  const moves = legalMoves(g);
  const toCastle = moves.find((m) => m.from === 22);
  const exposed = moves.find((m) => m.from === 37);
  assert.ok(scoreMove(g, toCastle) > scoreMove(g, exposed));
  for (let s = 1; s < 30; s++) assert.equal(chooseMove(g, 2, mulberry32(s)).from, 22);
  // and it brings a pawn home when it can
  const g2 = at([[82, 30, 0, 0], [0, 0, 0, 0]], 4);
  assert.equal(chooseMove(g2, 2, mulberry32(1)).to, HOME);
});

test('medium beats easy in most games and plays only legal moves; every level returns null without moves', () => {
  let won = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const { g } = playGame(2, 4, seed % 2 ? [medium, easy] : [easy, medium], 5000 + seed);
    if (g.winner === (seed % 2 ? 0 : 1)) won++;
  }
  assert.ok(won >= 80, `medium won ${won} of 100`);
  const none = { ...newGame(2), pawns: [[HOME, HOME, HOME, HOME], [0, 0, 0, 0]], roll: { steps: 3 } };
  assert.equal(chooseMove(none, 1), null);
  assert.equal(chooseMove(none, 2), null);
});

// ---------- the screen's pure parts ----------

test('free and full version: 2 players with easy free; a 3rd or 4th player and medium in the full version', () => {
  assert.equal(meta.id, 'pachisi');
  assert.equal(meta.group, 'board');
  assert.equal(meta.subKey, 'pachisi.subtitle');
  assert.equal(meta.isLocked({ players: ['kid', 'cpu'], level: 1 }, false), false);
  assert.equal(meta.isLocked({ players: ['kid', 'kid'], level: 2 }, false), false, 'no computer: the level does not matter');
  assert.equal(meta.isLocked({ players: ['kid', 'cpu'], level: 2 }, false), true);
  assert.equal(meta.isLocked({ players: ['kid', 'cpu', 'cpu'], level: 1 }, false), true);
  assert.equal(meta.isLocked({ players: ['kid', 'cpu', 'cpu', 'kid'], level: 2 }, true), false);
  assert.equal(winKey(1), 'cpu-1');
});

test('a saved setup is made safe', () => {
  assert.deepEqual(cleanSetup(null), { ...DEFAULT_SETUP, players: ['kid', 'cpu'] });
  assert.deepEqual(cleanSetup({ players: ['kid', 'kid', 'cpu'], level: 2, pawns: 2, count: false }), { players: ['kid', 'kid', 'cpu'], level: 2, pawns: 2, count: false });
  assert.deepEqual(cleanSetup({ players: ['kid'], level: 7, pawns: 3, count: 'yes' }), { ...DEFAULT_SETUP, players: ['kid', 'cpu'] });
  assert.deepEqual(cleanSetup({ players: ['kid', 'dog'] }).players, ['kid', 'cpu']);
});

test('pawn spots: on their square, in the Charkoni in front of their own arm, and never on top of each other', () => {
  const seats = [0, 1, 2, 3];
  const shown = [[0, 0, 5, HOME], [0, 30, 30, HOME], [12, 0, 0, 0], [HOME, HOME, 3, 3]];
  const spots = pawnSpots(seats, shown);
  // a pawn on a square stands in its middle
  const c = PATHS[0][5];
  assert.deepEqual([spots[0][2].x, spots[0][2].y], [colOf(c) + 0.5, rowOf(c) + 0.5]);
  // two pawns on one square stand side by side
  assert.notDeepEqual([spots[1][1].x, spots[1][1].y], [spots[1][2].x, spots[1][2].y]);
  // waiting pawns: inside the Charkoni (8-11), on their own side of the middle
  for (const [k, side] of [[0, 'y+'], [1, 'x+'], [2, 'y-'], [3, 'x-']]) {
    for (const [i, pos] of shown[k].entries()) {
      if (pos !== 0 && pos !== HOME) continue;
      const s = spots[k][i];
      assert.ok(s.x > 8 && s.x < 11 && s.y > 8 && s.y < 11, `player ${k} pawn ${i} in the Charkoni`);
      const d = side[0] === 'x' ? s.x - 9.5 : s.y - 9.5;
      assert.ok(side[1] === '+' ? d > 0 : d < 0);
    }
  }
  // no two pawns in exactly the same spot
  const all = spots.flat().map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)}`);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(placeOf(seats, 0, HOME), { x: 9.5, y: 9.5 });
  assert.ok(MIN_HIT >= 44);
});

test('taps: the selected pawn\'s glowing target wins over an own pawn standing on it', () => {
  const g = at([[10, 13, 0, 0], [0, 0, 0, 0]], 3);
  for (const cell of [12, 16, 20, 37]) {
    const hits = buildHits(g, g.pawns, 10);
    const target = hits.find((h) => h.kind === 'target');
    assert.equal(target.to, 13);
    const on13 = hits.find((h) => h.kind === 'pawn' && h.from === 13);
    assert.ok(Math.hypot(on13.x - target.x, on13.y - target.y) < 0.01, 'the pawn on 13 stands on the target');
    // a tap on the target (or on the pawn drawn there) walks, never picks the other pawn
    for (const [dx, dy] of [[0, 0], [0.2, -0.2], [-0.3, 0.1]]) assert.equal(pickHit(hits, target.x + dx, target.y + dy, cell).kind, 'target', `cell ${cell}`);
    // a tap on the pawn on 10 still picks that pawn
    const on10 = hits.find((h) => h.kind === 'pawn' && h.from === 10);
    assert.equal(pickHit(hits, on10.x, on10.y, cell).from, 10);
    // nothing selected yet: a tap on 13 picks the pawn on 13
    assert.equal(pickHit(buildHits(g, g.pawns, null), on13.x, on13.y, cell).from, 13);
  }
});

test('taps: two pawns on one square (8 and 76) are drawn apart and each tap picks the one drawn there', () => {
  const g = at([[8, 76, 0, 0], [0, 0, 0, 0]], 2);
  assert.equal(PATHS[0][8], PATHS[0][76]);
  const spots = pawnSpots(g.seats, g.pawns);
  for (const sel of [null, 8, 76]) {
    const hits = buildHits(g, g.pawns, sel);
    for (const cell of [12, 20, 37]) {
      assert.equal(pickHit(hits, spots[0][0].x, spots[0][0].y, cell).from, 8);
      assert.equal(pickHit(hits, spots[0][1].x, spots[0][1].y, cell).from, 76);
    }
  }
  // a second tap on the selected one switches to the other on the same square
  const hits = buildHits(g, g.pawns, 8);
  assert.equal(otherOnSquare(hits, hits.find((h) => h.kind === 'pawn' && h.from === 8)).from, 76);
  // far from everything: nothing
  assert.equal(pickHit(hits, 1, 1, 20), null);
});

test('taps: every hit area is round and 44 px or more, every movable pawn has one', () => {
  const g = at([[0, 0, 30, 60], [0, 0, 0, 0]], 4);
  const hits = buildHits(g, g.pawns, 30);
  assert.equal(hits.filter((h) => h.kind === 'pawn').length, 4);
  assert.equal(hits.filter((h) => h.kind === 'target').length, 1);
  // at 12 px squares a tap 18 px (1.5 squares) from a lone pawn still reaches it
  const lone = hits.find((h) => h.from === 60);
  assert.equal(pickHit(hits, lone.x + 1.5, lone.y, 12)?.from, 60);
  assert.ok(MIN_HIT * 0.62 >= 27);
});
