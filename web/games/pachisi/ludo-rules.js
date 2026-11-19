// Ludo: the rules, pure so they can be tested with seeded dice and used by the computer players
// (ludo-ai.js) and the screen (pachisi.js, which plays Ludo and Pachisi as two modes of one game).
//
// Ludo is the public-domain race game with one die (patented in England in 1896 as a simplified
// Pachisi). Source: Wikipedia, "Ludo" (https://en.wikipedia.org/wiki/Ludo, read 19 Nov 2026),
// sections Rules and Variants: one six-sided die, four pawns per player in a yard, a 6 brings a
// pawn onto the start square and gives another throw, pawns walk clockwise round a shared track
// and then up their own coloured home column, landing on an opponent's pawn sends it back to its
// yard, and the home column needs an exact throw.
//
// We play it the way Dutch families play this family of games (Mark, 19 Nov 2026: the rules are
// free, only names and artwork are protected), so it feels like what Dutch children know:
//   - the board: a cross of 40 squares round a free middle, with 4 home squares for every player
//     (instead of Ludo's 52 squares and 5-6 home squares). Our own board, drawn in code (art).
//   - a 6 brings a pawn from the yard onto your start square and gives another throw. A 6 must
//     bring a pawn out when you have pawns in the yard and your start square is free of your own
//     pawn; otherwise you move a pawn on the board as usual.
//   - when you have no pawn on the track (all in the yard or in your home squares), you get up to
//     three throws in a turn to throw something you can use (the familiar "three tries for a 6")
//   - every 6 gives another throw (no limit on sixes in a row: the Dutch home rule; Wikipedia's
//     "three sixes and the turn passes" is left out to keep it simple)
//   - landing on an opponent's pawn sends it back to its yard (on screen it walks home, calmly)
//   - no safe squares at all, not even the start squares (the Dutch way; Ludo boards often make
//     the start squares safe)
//   - you cannot land on your own pawn (on the track or in your home squares); you may walk past
//     it. There are no blockades
//   - the home squares need an exact throw; a throw that is too high does not move that pawn,
//     and when no pawn can use a throw it is lost (the turn passes, unless it was a 6 or one of the
//     three tries)
//   - 2-4 players for themselves (no partnerships), 4 pawns each, or 2 each as a short game
//   - every game ends: after MAX_THROWS throws in all the player furthest along wins (the most
//     pawns home, then the most steps walked). Ordinary games end long before that.
//
// Squares: an 11×11 grid of cells, r * 11 + c, row 0 at the top. The track is the outline of the
// cross (its arms three cells wide): 9 squares on every arm plus the 4 inner corners = 40. Seats
// go clockwise: 0 the bottom arm, 1 the left, 2 the top, 3 the right. Seat 0 starts at the bottom
// of the bottom arm's left column, walks up, round the board clockwise, and turns into its home
// squares from the bottom arm's end (the middle column, upwards). A pawn's position: 0 in the yard,
// 1-40 on the track (1 is its start square), 41-44 its home squares (LAST is the innermost).

export const SIZE = 11;
export const TRACK_LEN = 40;
export const HOME_SQUARES = 4;
export const LAST = TRACK_LEN + HOME_SQUARES; // 44
export const MAX_PLAYERS = 4;
export const PAWN_COUNTS = Object.freeze([2, 4]);
export const SIX = 6;
/** Throws in a turn when a player has no pawn on the track. */
export const TRIES = 3;
/** Throws in all after which the game ends anyway (see the top). */
export const MAX_THROWS = 1500;

export const cellOf = (r, c) => r * SIZE + c;
export const rowOf = (cell) => Math.floor(cell / SIZE);
export const colOf = (cell) => cell % SIZE;

/** Turn a cell a quarter clockwise round the middle `seat` times. */
function turn(r, c, seat) {
  for (let k = 0; k < seat; k++) [r, c] = [c, SIZE - 1 - r];
  return [r, c];
}

/** Seat 0's way: positions 1-44 as [row, col]. */
function seatZeroWay() {
  const p = [null];
  const arm = (seat) => {
    // up the arm's left column from its outer end to the inner corner (5), then the next arm
    const out = [];
    for (let r = 10; r >= 6; r--) out.push(turn(r, 4, seat)); // 1-5 (5: the inner corner)
    return out;
  };
  for (let seat = 0; seat < 4; seat++) {
    // seen from seat `seat`: up its left column (5), along the next arm (turned) out (4), across its end (1)
    p.push(...arm(seat));
    const next = (seat + 1) % 4;
    for (let r = 7; r <= 10; r++) p.push(turn(r, 6, next)); // the next arm's right column, outwards
    p.push(turn(10, 5, next)); // the end of the next arm
  }
  // that loop went: up seat 0's left column, then seat 1's arm (the left arm) etc.; it is 40 long
  // and ends on seat 0's arm end (the last 'next' is seat 0). Then the home squares, upwards.
  for (let r = 9; r >= 6; r--) p.push([r, 5]); // 41-44
  return p;
}

const WAY0 = seatZeroWay();

/** For every seat: the cell of every position 1-44 (0, the yard, is null). */
export const WAYS = Object.freeze([0, 1, 2, 3].map((seat) => Object.freeze(WAY0.map((rc) => (rc ? cellOf(...turn(rc[0], rc[1], seat)) : null)))));

/** The 40 track cells in seat 0's order (positions 1-40). */
export const TRACK = Object.freeze(WAYS[0].slice(1, TRACK_LEN + 1));
/** Every seat's start square (its position 1). */
export const STARTS = Object.freeze([0, 1, 2, 3].map((seat) => WAYS[seat][1]));
/** The middle cell (free: nobody walks there). */
export const MIDDLE = cellOf(5, 5);

/** The seats the players sit at: two face each other. */
export function seatsFor(n) {
  if (n === 2) return [0, 2];
  if (n === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Throw the die: 1-6. */
export const throwDie = (rand = Math.random) => 1 + Math.min(5, Math.floor(rand() * 6));

/** What a throw means: { value, steps, grace } (a 6 throws again). */
export const readThrow = (value) => ({ value, steps: value, grace: value === SIX });

/** A new game: every pawn in its yard, player 0 to throw. */
export function newGame(players, pawns = 4) {
  if (!Number.isInteger(players) || players < 2 || players > MAX_PLAYERS) throw new Error(`2 to ${MAX_PLAYERS} players`);
  if (!PAWN_COUNTS.includes(pawns)) throw new Error(`pawns: ${PAWN_COUNTS.join(' or ')}`);
  return {
    seats: seatsFor(players),
    pawns: Array.from({ length: players }, () => new Array(pawns).fill(0)),
    turn: 0,
    roll: null, // the throw waiting for a move: { value, steps, grace }
    tries: 0, // throws without a move this turn (three tries)
    throws: 0,
    winner: -1,
    over: null, // { winner, reason: 'home' | 'limit' }
  };
}

const clone = (g) => ({ ...g, pawns: g.pawns.map((p) => p.slice()), roll: g.roll ? { ...g.roll } : null });

/** The cell player k's pawn at `pos` stands on (null in the yard). */
export const cellAt = (game, k, pos) => (pos > 0 ? WAYS[game.seats[k]][pos] : null);
/** A pawn on the shared track (not in the yard, not in its home squares). */
export const onTrack = (pos) => pos >= 1 && pos <= TRACK_LEN;
/** A pawn in its home squares: done. */
export const isHome = (pos) => pos > TRACK_LEN;

/** The opponent pawns on a track cell: [{ player, pawn }] (at most one: nobody shares a square). */
export function opponentsOn(game, k, cell) {
  const out = [];
  game.pawns.forEach((list, q) => {
    if (q === k) return;
    list.forEach((pos, i) => {
      if (onTrack(pos) && cellAt(game, q, pos) === cell) out.push({ player: q, pawn: i });
    });
  });
  return out;
}

/** Why pawn i of the player to move cannot use `steps`, or null if it can: 'yard', 'own', 'far', 'enter', 'done'. */
export function whyNot(game, i, steps = game.roll?.steps) {
  const k = game.turn;
  const list = game.pawns[k];
  const from = list[i];
  const mustEnter = steps === SIX && list.includes(0) && !list.includes(1);
  if (from === 0) return steps === SIX ? (list.includes(1) ? 'own' : null) : 'yard';
  if (mustEnter) return 'enter';
  const to = from + steps;
  if (to > LAST) return isHome(from) && from === LAST ? 'done' : 'far';
  if (list.some((p, j) => j !== i && p === to)) return 'own';
  return null;
}

/**
 * The moves for the player to move with `steps`: [{ pawn, from, to, captures: [{ player, pawn }] }].
 * Pawns in the yard all make the same move, so only the first of them is listed.
 */
export function legalMoves(game, steps = game.roll?.steps) {
  if (!steps || game.over) return [];
  const k = game.turn;
  const out = [];
  let yard = false;
  game.pawns[k].forEach((from, pawn) => {
    if (whyNot(game, pawn, steps)) return;
    if (from === 0) {
      if (yard) return;
      yard = true;
    }
    const to = from === 0 ? 1 : from + steps;
    const captures = onTrack(to) ? opponentsOn(game, k, cellAt(game, k, to)) : [];
    out.push({ pawn, from, to, captures });
  });
  return out;
}

/** Positions along the way of a move (for the screen): every position from `from` + 1 to `to`. */
export function stepsOf(move) {
  const out = [];
  for (let p = move.from + 1; p <= move.to; p++) out.push(p);
  return out;
}

const progress = (list) => list.reduce((s, p) => s + p, 0);
const homeCount = (list) => list.filter(isHome).length;

/** Who is furthest along: the most pawns home, then the most steps walked (ties: the earlier player). */
export function leader(game) {
  let best = 0;
  for (let k = 1; k < game.pawns.length; k++) {
    const a = game.pawns[k];
    const b = game.pawns[best];
    if (homeCount(a) > homeCount(b) || (homeCount(a) === homeCount(b) && progress(a) > progress(b))) best = k;
  }
  return best;
}

function nextPlayer(g, events, again, reason = 'six') {
  if (g.throws >= MAX_THROWS) {
    g.winner = leader(g);
    g.over = { winner: g.winner, reason: 'limit' };
    g.roll = null;
    events.push({ type: 'limit', player: g.winner });
    return;
  }
  if (again) events.push({ type: 'again', player: g.turn, reason });
  else {
    g.turn = (g.turn + 1) % g.pawns.length;
    g.tries = 0;
  }
  g.roll = null;
}

/**
 * The player to move throws `value` (1-6). Returns { game, events }. When no pawn can use the
 * throw it is lost: events { type: 'throw' }, { type: 'nomove' } and then the same player throws
 * again after a 6 or while they have tries left (no pawn on the track), else the next player.
 */
export function applyThrow(game, value) {
  if (game.over) throw new Error('the game is over');
  if (game.roll) throw new Error('move first');
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error('a die shows 1-6');
  const g = clone(game);
  g.roll = readThrow(value);
  g.throws++;
  const events = [{ type: 'throw', player: g.turn, ...g.roll }];
  if (!legalMoves(g).length) {
    events.push({ type: 'nomove', player: g.turn });
    if (g.roll.grace) nextPlayer(g, events, true, 'six');
    else {
      g.tries = (g.tries || 0) + 1;
      const tryAgain = !g.pawns[g.turn].some(onTrack) && g.tries < TRIES;
      if (tryAgain) events[1].tries = g.tries;
      nextPlayer(g, events, tryAgain, 'try');
    }
  }
  return { game: g, events };
}

/**
 * Play `move` (one from legalMoves) with the throw waiting. Returns { game, events }:
 *   { type: 'move', player, pawn, from, to }
 *   { type: 'enter', player, pawn }          a 6 brought a pawn onto its start square
 *   { type: 'capture', player, pawn, by }    that pawn goes back to its yard
 *   { type: 'home', player, pawn }           a pawn reached its home squares
 *   { type: 'win', player }
 *   { type: 'again', player, reason: 'six' } a 6: the same player throws again
 *   { type: 'limit', player }                MAX_THROWS reached: that player was furthest along
 */
export function playMove(game, move) {
  if (!game.roll) throw new Error('throw first');
  const legal = legalMoves(game).find((m) => m.from === move.from && m.to === move.to);
  if (!legal) throw new Error(`not a legal move: ${JSON.stringify(move)}`);
  const g = clone(game);
  const k = g.turn;
  const pawn = legal.pawn;
  g.pawns[k][pawn] = legal.to;
  const events = [{ type: 'move', player: k, pawn, from: legal.from, to: legal.to }];
  if (legal.from === 0) events.push({ type: 'enter', player: k, pawn });
  for (const c of legal.captures) {
    g.pawns[c.player][c.pawn] = 0;
    events.push({ type: 'capture', player: c.player, pawn: c.pawn, by: k });
  }
  if (isHome(legal.to) && !isHome(legal.from)) events.push({ type: 'home', player: k, pawn });
  if (g.pawns[k].every(isHome)) {
    g.winner = k;
    g.over = { winner: k, reason: 'home' };
    g.roll = null;
    events.push({ type: 'win', player: k });
    return { game: g, events };
  }
  g.tries = 0;
  nextPlayer(g, events, g.roll.grace, 'six');
  return { game: g, events };
}

/** Pawns home per player. */
export const homeOf = (game, k) => homeCount(game.pawns[k]);
