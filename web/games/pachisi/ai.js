// The computer players for Pachisi. They throw the same shells as the child (the screen throws for
// them, with the same chances) and only ever choose among the legal moves; they never cheat. The
// levels differ only in how they pick a pawn:
//   1 easy   (free): mostly at random. It takes a pawn it can capture only now and then
//                    (EASY_CAPTURE), so a child who plays sensibly wins most games
//   2 medium (full version): weighs every move (scoreMove): a capture, coming home, a castle
//                    square, getting out of reach of a pawn behind it, not landing where one can
//                    reach it, and getting pawns out of the Charkoni
// Pure and seeded (`rand` returns [0, 1); the tests pass a seeded one), fast enough to run on
// the page: there are never more than four moves to weigh.
import { HOME, STEP_CHANCE, PATHS, isCastle, cellAt, legalMoves } from './rules.js';

export const LEVELS = Object.freeze([1, 2]);
/** Easy takes a capture it could make this often. */
export const EASY_CAPTURE = 0.3;

const pick = (list, rand) => list[Math.floor(rand() * list.length)];

/**
 * How likely a pawn of player k on `cell` is to be captured before k moves again: for every
 * opponent pawn that could land there with one throw, the chance of that throw (added up, at most
 * 1). A castle is safe; so is k's own middle column (no opponent walks there).
 */
export function danger(game, k, cell) {
  if (isCastle(cell)) return 0;
  let p = 0;
  game.pawns.forEach((list, q) => {
    if (q === k) return;
    const path = PATHS[game.seats[q]];
    const counted = new Set();
    list.forEach((from) => {
      if (from >= HOME || counted.has(from)) return;
      counted.add(from);
      for (const [steps, chance] of Object.entries(STEP_CHANCE)) {
        const to = from + Number(steps);
        if (to < HOME && path[to] === cell) p += chance;
      }
    });
  });
  return Math.min(1, p);
}

/** How good a move looks for the player to move (medium). Higher is better. */
export function scoreMove(game, move) {
  const k = game.turn;
  let s = 0;
  for (const c of move.captures) s += 60 + game.pawns[c.player][c.pawn] * 0.6; // a pawn far along hurts them more
  if (move.to >= HOME) return s + 70;
  const cell = cellAt(game, k, move.to);
  if (isCastle(cell)) s += 22;
  s -= danger(game, k, cell) * 90;
  if (move.from > 0) s += danger(game, k, cellAt(game, k, move.from)) * 60; // out of reach
  if (move.from === 0) s += 14; // another pawn on its way
  s += move.to * 0.08; // a little push for the pawn furthest along
  return s;
}

/** The move the computer plays for the player to move at `level`, or null when it has none. */
export function chooseMove(game, level = 1, rand = Math.random) {
  const moves = legalMoves(game);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  if (level <= 1) {
    const caps = moves.filter((m) => m.captures.length);
    if (caps.length && rand() < EASY_CAPTURE) return pick(caps, rand);
    const quiet = moves.filter((m) => !m.captures.length);
    return pick(quiet.length ? quiet : moves, rand);
  }
  let best = -Infinity;
  let found = [];
  for (const m of moves) {
    const s = scoreMove(game, m);
    if (s > best + 1e-9) {
      best = s;
      found = [m];
    } else if (Math.abs(s - best) <= 1e-9) found.push(m);
  }
  return pick(found, rand);
}

/**
 * A sensible child, for the tests: a capture when there is one, else coming home, else a castle,
 * else the pawn furthest along that lands out of easy reach.
 */
export function sensibleMove(game) {
  const moves = legalMoves(game);
  if (!moves.length) return null;
  const k = game.turn;
  const key = (m) => {
    if (m.captures.length) return 1000 + m.to;
    if (m.to >= HOME) return 900;
    const cell = cellAt(game, k, m.to);
    if (isCastle(cell)) return 800 + m.to;
    return (danger(game, k, cell) < 0.2 ? 500 : 0) + m.to;
  };
  return moves.reduce((a, b) => (key(b) > key(a) ? b : a));
}
