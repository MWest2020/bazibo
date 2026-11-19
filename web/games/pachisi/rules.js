// Pachisi, the original game from India: the rules, pure so they can be tested with seeded throws
// and used by the computer players (ai.js) and the screens (pachisi.js).
//
// Source: Wikipedia, "Pachisi" (https://en.wikipedia.org/wiki/Pachisi, read 19 Nov 2026), sections
// Equipment and Rules. What we keep from it:
//   - a cross-shaped cloth board: four arms of three columns of eight squares round the Charkoni,
//     the big square in the middle where every pawn starts and where it has to come back to
//   - a pawn goes down the middle column of its own arm, counter-clockwise round the outer
//     columns of all four arms, and back up its own middle column into the Charkoni (84 steps)
//   - 12 castle squares: the end of each middle column and, on every outer column, the fourth
//     square from its end. A pawn on a castle cannot be captured, and a pawn may not land on a
//     castle where an opponent stands
//   - six cowrie shells are thrown; the shells that land mouth up give the move (the six-shell
//     table): 2, 3, 4, 5 or 6 open shells move that many squares, 1 open shell moves 10, none
//     open moves 25 ("pachisi", the throw the game is named after). A 6, 10 or 25 (a "grace")
//     gives another throw
//   - landing on an opponent's pawn on a square that is not a castle sends it back to the
//     Charkoni; pawns of one player may share a square; one pawn moves per throw; a throw no
//     pawn can use is lost
//   - 2 to 4 players with 4 pawns each; the first to bring every pawn home wins
// Made simpler and kinder for children (each one also in AGENTS.md):
//   - a pawn leaves the Charkoni with any throw (the source needs a grace throw for that: with
//     six shells only 1 throw in 8, so a young child could wait many turns before moving at all)
//   - coming home needs no exact throw: a throw that reaches or passes the Charkoni brings the
//     pawn home (the steps 2-6, 10 and 25 can never make an exact 1, so a pawn one square from
//     home would otherwise wait forever)
//   - a throw must be used when a pawn can use it (the source lets a player pass), so a turn is
//     never a puzzle about whether to move
//   - no extra throw after a capture (some versions in the source leave it out too), and no
//     partnerships: with four players everyone plays for themselves
//   - the game can also be played with 2 pawns each (a shorter game); 4 is the traditional number
//   - every game ends: after MAX_THROWS throws in all the player who is furthest along wins
//     (the most pawns home, then the most steps walked). Ordinary games end long before that.
//   - a captured pawn is not "beaten": it walks back to the Charkoni and starts again
//
// Squares: the board is a 19×19 grid of cells (8 + 3 + 8) with the Charkoni the 3×3 block in the
// middle. A cell is r * 19 + c, row 0 at the top. Seats: 0 the bottom arm, 1 the right, 2 the
// top, 3 the left (the counter-clockwise order a pawn walks in). A pawn's position is 0 (still in
// the Charkoni), 1-83 (on its path) or HOME (84, back in the Charkoni: done).

export const SIZE = 19;
export const ARM = 8;
export const HOME = 84;
export const SHELLS = 6;
export const MAX_PLAYERS = 4;
export const PAWN_COUNTS = Object.freeze([2, 4]);
/** Steps per number of open shells (index 0-6), the six-shell table. */
export const STEPS = Object.freeze([25, 10, 2, 3, 4, 5, 6]);
/** The throws that give another throw: none open (25), one open (10), all six open (6). */
export const GRACE = Object.freeze([0, 1, 6]);
/** Throws in all after which the game ends anyway (see the top). */
export const MAX_THROWS = 1200;

export const cellOf = (r, c) => r * SIZE + c;
export const rowOf = (cell) => Math.floor(cell / SIZE);
export const colOf = (cell) => cell % SIZE;
/** The Charkoni's middle cell. */
export const CENTRE = cellOf(9, 9);

/** Turn a cell of the bottom arm's coordinates (seat 0) a quarter counter-clockwise `seat` times. */
function turn(r, c, seat) {
  // seat 1 (right arm): the bottom arm turned a quarter counter-clockwise on screen
  for (let k = 0; k < seat; k++) [r, c] = [SIZE - 1 - c, r];
  return [r, c];
}

/** Seat 0's path, positions 1-83, as [row, col]. */
function seatZeroPath() {
  const p = [null];
  for (let r = 11; r <= 18; r++) p.push([r, 9]); // 1-8 down the middle column (8: its end, a castle)
  // then round the board: the right column of each arm inwards, the next arm's lower-left
  // column outwards, across its end and back in, and so on (counter-clockwise on screen)
  const arm = [];
  for (let r = 18; r >= 11; r--) arm.push([r, 10]); // the bottom arm's right column, inwards
  p.push(...arm); // 9-16
  for (let seat = 1; seat <= 3; seat++) {
    // the next arm: out along its first outer column, across the end, back in along the other
    const out = [];
    for (let r = 18; r >= 11; r--) out.push(turn(r, 8, seat)); // seen from that arm: its left column, outwards
    out.reverse();
    p.push(...out);
    p.push(turn(18, 9, seat));
    for (let r = 18; r >= 11; r--) p.push(turn(r, 10, seat));
  }
  for (let r = 11; r <= 18; r++) p.push([r, 8]); // 68-75: the bottom arm's left column, outwards
  p.push([18, 9]); // 76: the end of the middle column again
  for (let r = 17; r >= 11; r--) p.push([r, 9]); // 77-83: up the middle column
  return p;
}

const PATH0 = seatZeroPath();

/** For every seat: the cell of every position 1-83 (0 and HOME: the Charkoni's middle). */
export const PATHS = Object.freeze(
  [0, 1, 2, 3].map((seat) =>
    Object.freeze(PATH0.map((rc, pos) => (pos === 0 ? CENTRE : cellOf(...turn(rc[0], rc[1], seat)))).concat([CENTRE])),
  ),
);

/** The castle squares: every middle column's end and the fourth square from the end of every outer column. */
export const CASTLES = Object.freeze(
  [0, 1, 2, 3].flatMap((seat) => [cellOf(...turn(18, 9, seat)), cellOf(...turn(15, 8, seat)), cellOf(...turn(15, 10, seat))]),
);
const CASTLE_SET = new Set(CASTLES);
export const isCastle = (cell) => CASTLE_SET.has(cell);

/** Every cell of the track (the three columns of every arm), for drawing. */
export const TRACK = Object.freeze(
  [0, 1, 2, 3].flatMap((seat) => {
    const out = [];
    for (let r = 11; r <= 18; r++) for (const c of [8, 9, 10]) out.push(cellOf(...turn(r, c, seat)));
    return out;
  }),
);

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

/** Throw the six shells: true is a shell that lands mouth up (open). */
export const throwShells = (rand = Math.random) => Array.from({ length: SHELLS }, () => rand() < 0.5);

/** What a throw means: { open, steps, grace }. */
export function readThrow(shells) {
  const open = shells.filter(Boolean).length;
  return { open, steps: STEPS[open], grace: GRACE.includes(open) };
}

/** The chance of each number of steps with six fair shells: { steps: p }. */
export const STEP_CHANCE = Object.freeze(
  STEPS.reduce((acc, steps, open) => {
    const ways = [1, 6, 15, 20, 15, 6, 1][open];
    acc[steps] = (acc[steps] || 0) + ways / 64;
    return acc;
  }, {}),
);

/** A new game: every pawn in the Charkoni, player 0 to throw. */
export function newGame(players, pawns = 4) {
  if (!Number.isInteger(players) || players < 2 || players > MAX_PLAYERS) throw new Error(`2 to ${MAX_PLAYERS} players`);
  if (!PAWN_COUNTS.includes(pawns)) throw new Error(`pawns: ${PAWN_COUNTS.join(' or ')}`);
  return {
    seats: seatsFor(players),
    pawns: Array.from({ length: players }, () => new Array(pawns).fill(0)),
    turn: 0,
    roll: null, // the throw waiting for a move: { shells, open, steps, grace }
    throws: 0,
    winner: -1,
    over: null, // { winner, reason: 'home' | 'limit' }
  };
}

const clone = (g) => ({ ...g, pawns: g.pawns.map((p) => p.slice()), roll: g.roll ? { ...g.roll, shells: g.roll.shells.slice() } : null });

/** The cell player k's pawn at `pos` stands on. */
export const cellAt = (game, k, pos) => PATHS[game.seats[k]][pos];

/** Opponent pawns on a cell: [{ player, pawn }]. Pawns in the Charkoni never count. */
export function opponentsOn(game, k, cell) {
  const out = [];
  game.pawns.forEach((list, q) => {
    if (q === k) return;
    list.forEach((pos, i) => {
      if (pos > 0 && pos < HOME && cellAt(game, q, pos) === cell) out.push({ player: q, pawn: i });
    });
  });
  return out;
}

/**
 * The moves for the player to move with `steps`: [{ pawn, from, to, captures: [{ player, pawn }] }].
 * Pawns on the same position make the same move, so only the first of them is listed.
 */
export function legalMoves(game, steps = game.roll?.steps) {
  if (!steps || game.over) return [];
  const k = game.turn;
  const out = [];
  const seen = new Set();
  game.pawns[k].forEach((from, pawn) => {
    if (from >= HOME || seen.has(from)) return;
    seen.add(from);
    const to = Math.min(HOME, from + steps);
    if (to === HOME) {
      out.push({ pawn, from, to, captures: [] });
      return;
    }
    const cell = cellAt(game, k, to);
    const others = opponentsOn(game, k, cell);
    if (isCastle(cell)) {
      if (others.length) return; // an opponent holds the castle
      out.push({ pawn, from, to, captures: [] });
      return;
    }
    out.push({ pawn, from, to, captures: others });
  });
  return out;
}

/** Steps along the way of a move (for the screens): every position from `from` + 1 to `to`. */
export function stepsOf(move) {
  const out = [];
  for (let p = move.from + 1; p <= move.to; p++) out.push(p);
  return out;
}

const progress = (list) => list.reduce((s, p) => s + p, 0);
const homeCount = (list) => list.filter((p) => p >= HOME).length;

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

function nextPlayer(g, events, again) {
  if (g.throws >= MAX_THROWS) {
    g.winner = leader(g);
    g.over = { winner: g.winner, reason: 'limit' };
    events.push({ type: 'limit', player: g.winner });
    return;
  }
  if (again) events.push({ type: 'again', player: g.turn });
  else g.turn = (g.turn + 1) % g.pawns.length;
  g.roll = null;
}

/**
 * The player to move throws `shells` (six booleans). Returns { game, events }. When no pawn can
 * use the throw it is lost: events { type: 'throw' }, { type: 'nomove' } and the next player (or
 * the same one again after a grace) is to throw.
 */
export function applyThrow(game, shells) {
  if (game.over) throw new Error('the game is over');
  if (game.roll) throw new Error('move first');
  if (!Array.isArray(shells) || shells.length !== SHELLS) throw new Error('six shells');
  const g = clone(game);
  g.roll = { shells: shells.map(Boolean), ...readThrow(shells) };
  g.throws++;
  const events = [{ type: 'throw', player: g.turn, ...g.roll }];
  if (!legalMoves(g).length) {
    events.push({ type: 'nomove', player: g.turn });
    nextPlayer(g, events, g.roll.grace);
  }
  return { game: g, events };
}

/**
 * Play `move` (one from legalMoves) with the throw waiting. Returns { game, events }:
 *   { type: 'move', player, pawn, from, to }
 *   { type: 'capture', player, pawn, by }   that pawn walks back to the Charkoni
 *   { type: 'home', player, pawn }          a pawn is back in the Charkoni for good
 *   { type: 'win', player }
 *   { type: 'again', player }               a grace: the same player throws again
 *   { type: 'limit', player }               MAX_THROWS reached: that player was furthest along
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
  for (const c of legal.captures) {
    g.pawns[c.player][c.pawn] = 0;
    events.push({ type: 'capture', player: c.player, pawn: c.pawn, by: k });
  }
  if (legal.to === HOME) events.push({ type: 'home', player: k, pawn });
  if (g.pawns[k].every((p) => p >= HOME)) {
    g.winner = k;
    g.over = { winner: k, reason: 'home' };
    g.roll = null;
    events.push({ type: 'win', player: k });
    return { game: g, events };
  }
  nextPlayer(g, events, g.roll.grace);
  return { game: g, events };
}

/** Pawns home per player. */
export const homeOf = (game, k) => homeCount(game.pawns[k]);
