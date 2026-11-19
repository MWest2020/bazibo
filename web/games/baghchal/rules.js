// Bagh-Chal ("tigers and goats", Nepal; centuries old, public domain): the rules, pure so they
// can be tested and used by the computer player (ai.js).
//
// Source: Wikipedia, "Bagh-Chal" (https://en.wikipedia.org/wiki/Bagh-Chal, read 19 Nov 2026),
// sections Overview and Rules:
//   - a 5×5 grid of 25 points; lines along every row and column, and diagonals through the
//     points where (row + col) is even (the classic "alquerque" pattern)
//   - the 4 tigers start on the 4 corners; the goat player has 20 goats off the board
//   - the goats move first, by placing a goat on a free point; goats cannot move until all 20
//     are placed; after that a goat moves one step along a line to a free point
//   - a tiger moves one step along a line to a free point, or captures by jumping over an
//     adjacent goat, in a straight line, to the free point just beyond; one goat per move (no
//     multi-jumps); capturing is never compulsory; tigers may capture while goats are still
//     being placed
//   - the tigers win when they have captured 5 goats; the goats win when no tiger can move
// Two things the source leaves open or does differently, settled here so every game ends:
//   - a goat player who cannot move (only possible once all goats are placed) loses, as in
//     draughts ("a player who cannot move loses")
//   - Wikipedia forbids a move that repeats an earlier position once all goats are placed. For
//     children that is a hidden rule that makes a move "not allowed" for no visible reason, so
//     instead (as in Dammen) the same position with the same player to move for the third time
//     is a draw, and so is QUIET_LIMIT moves in a row without a capture after the last goat was
//     placed.
//
// A board is an array of 25 points, index = row * 5 + col, row 0 at the top. A point holds 0
// (empty), GOAT (1) or TIGER (2). A move is { from, to, over }: `from` -1 for placing a goat,
// `over` the captured goat's point or -1.

export const SIZE = 5;
export const POINTS = SIZE * SIZE;
export const EMPTY = 0;
export const GOAT = 1;
export const TIGER = 2;
/** Goats the goat player places. */
export const GOATS = 20;
/** Captured goats that win the game for the tigers. */
export const WIN_CAPTURES = 5;
/** Plies without a capture, after the last goat was placed, before it is a draw: 50 each. */
export const QUIET_LIMIT = 100;
export const TIGER_START = Object.freeze([0, SIZE - 1, POINTS - SIZE, POINTS - 1]);

export const other = (player) => (player === GOAT ? TIGER : GOAT);
export const rowOf = (i) => Math.floor(i / SIZE);
export const colOf = (i) => i % SIZE;
/** Diagonal lines run through the points where row + col is even. */
export const hasDiagonals = (i) => (rowOf(i) + colOf(i)) % 2 === 0;

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

/** For every point: the points one step away along a line. */
export const NEIGHBOURS = Object.freeze(
  Array.from({ length: POINTS }, (_, i) => {
    const out = [];
    for (const [dr, dc] of DIRS) {
      if (dr && dc && !hasDiagonals(i)) continue;
      const r = rowOf(i) + dr;
      const c = colOf(i) + dc;
      if (inside(r, c)) out.push(r * SIZE + c);
    }
    return Object.freeze(out);
  }),
);

/** For every point: the jumps along a straight line, { over, to }. */
export const JUMPS = Object.freeze(
  Array.from({ length: POINTS }, (_, i) => {
    const out = [];
    for (const [dr, dc] of DIRS) {
      if (dr && dc && !hasDiagonals(i)) continue;
      const r = rowOf(i) + 2 * dr;
      const c = colOf(i) + 2 * dc;
      if (inside(r, c)) out.push(Object.freeze({ over: (rowOf(i) + dr) * SIZE + colOf(i) + dc, to: r * SIZE + c }));
    }
    return Object.freeze(out);
  }),
);

/** Every line segment between two neighbouring points, [a, b] with a < b (for drawing). */
export const SEGMENTS = Object.freeze(NEIGHBOURS.flatMap((ns, a) => ns.filter((b) => b > a).map((b) => Object.freeze([a, b]))));

/** The starting board: the tigers on the corners. */
export function initialBoard() {
  const board = new Array(POINTS).fill(EMPTY);
  for (const i of TIGER_START) board[i] = TIGER;
  return board;
}

/** Build a board from a picture, for tests: five lines, '.' empty, 'g' goat, 'T' tiger. */
export function boardFrom(lines) {
  const board = new Array(POINTS).fill(EMPTY);
  lines.forEach((line, r) => {
    [...line.replace(/\s/g, '')].forEach((ch, c) => {
      if (ch === 'g') board[r * SIZE + c] = GOAT;
      else if (ch === 'T') board[r * SIZE + c] = TIGER;
    });
  });
  return board;
}

/** The moves of the tiger on `from`: steps, then captures. */
export function tigerMoves(board, from, out = []) {
  for (const to of NEIGHBOURS[from]) if (!board[to]) out.push({ from, to, over: -1 });
  for (const j of JUMPS[from]) if (board[j.over] === GOAT && !board[j.to]) out.push({ from, to: j.to, over: j.over });
  return out;
}

/** All legal moves for `player`. `toPlace`: goats still to be placed. */
export function legalMoves(board, player, toPlace) {
  const out = [];
  if (player === GOAT) {
    if (toPlace > 0) {
      for (let i = 0; i < POINTS; i++) if (!board[i]) out.push({ from: -1, to: i, over: -1 });
      return out;
    }
    for (let i = 0; i < POINTS; i++) {
      if (board[i] !== GOAT) continue;
      for (const to of NEIGHBOURS[i]) if (!board[to]) out.push({ from: i, to, over: -1 });
    }
    return out;
  }
  for (let i = 0; i < POINTS; i++) if (board[i] === TIGER) tigerMoves(board, i, out);
  return out;
}

/** The goats a tiger could capture right now (each once). */
export function capturable(board) {
  const out = new Set();
  for (let i = 0; i < POINTS; i++) {
    if (board[i] !== TIGER) continue;
    for (const j of JUMPS[i]) if (board[j.over] === GOAT && !board[j.to]) out.add(j.over);
  }
  return [...out];
}

/** The board after a move (a new array). */
export function applyMove(board, move) {
  const next = board.slice();
  if (move.from < 0) next[move.to] = GOAT;
  else {
    next[move.to] = next[move.from];
    next[move.from] = EMPTY;
  }
  if (move.over >= 0) next[move.over] = EMPTY;
  return next;
}

export const sameMove = (a, b) => !!a && !!b && a.from === b.from && a.to === b.to && (a.over ?? -1) === (b.over ?? -1);

export const positionKey = (board, turn, toPlace) => `${turn}${toPlace}:${board.join('')}`;

/** A new game: the board, who moves, goats left to place, goats captured, positions seen. */
export function newGame(board = initialBoard(), turn = GOAT, toPlace = GOATS, captured = 0) {
  const game = { board, turn, toPlace, captured, seen: { [positionKey(board, turn, toPlace)]: 1 }, quiet: 0, over: null };
  game.over = outcome(game);
  return game;
}

/** The game after a move (a new object; the old one is left as it was, for take-back). */
export function play(game, move) {
  const board = applyMove(game.board, move);
  const toPlace = move.from < 0 ? game.toPlace - 1 : game.toPlace;
  const captured = game.captured + (move.over >= 0 ? 1 : 0);
  const turn = other(game.turn);
  const key = positionKey(board, turn, toPlace);
  const quiet = toPlace > 0 || move.from < 0 || move.over >= 0 ? 0 : game.quiet + 1;
  const next = { board, turn, toPlace, captured, seen: { ...game.seen, [key]: (game.seen[key] || 0) + 1 }, quiet, over: null };
  next.over = outcome(next);
  return next;
}

/**
 * How the game stands: null while it goes on; { winner: TIGER, reason: 'captured' } after 5
 * captures; { winner: GOAT, reason: 'trapped' } when no tiger can move; { winner: TIGER,
 * reason: 'stuck' } when no goat can move; { draw: true, reason: 'repeat' | 'quiet' }.
 */
export function outcome(game) {
  if (game.captured >= WIN_CAPTURES) return { winner: TIGER, reason: 'captured' };
  if (!legalMoves(game.board, game.turn, game.toPlace).length) {
    return game.turn === TIGER ? { winner: GOAT, reason: 'trapped' } : { winner: TIGER, reason: 'stuck' };
  }
  if ((game.seen[positionKey(game.board, game.turn, game.toPlace)] || 0) >= 3) return { draw: true, reason: 'repeat' };
  if (game.quiet >= QUIET_LIMIT) return { draw: true, reason: 'quiet' };
  return null;
}

/** Goats on the board. */
export const goatsOnBoard = (board) => board.reduce((n, v) => n + (v === GOAT ? 1 : 0), 0);
