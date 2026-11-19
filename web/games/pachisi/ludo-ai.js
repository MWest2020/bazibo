// The computer players for Ludo. They throw the same die as the child (the screen throws for
// them) and only ever choose among the legal moves; they never cheat. The levels differ only in
// how they pick a pawn:
//   1 easy   (free): mostly at random, and it takes a capture only now and then (EASY_CAPTURE),
//                    so a child who plays sensibly wins most games
//   2 medium (full version): weighs every move (scoreMove): a capture, reaching the home squares,
//                    bringing a pawn out, getting away from a pawn behind it, not landing where an
//                    opponent can reach it with one throw, and progress
// Pure and seeded (`rand` returns [0, 1); the tests pass a seeded one), and fast: there are never
// more than four moves to weigh.
import { TRACK_LEN, onTrack, isHome, cellAt, legalMoves, WAYS } from './ludo-rules.js';

export const LEVELS = Object.freeze([1, 2]);
/** Easy takes a capture it could make this often. */
export const EASY_CAPTURE = 0.25;

const pick = (list, rand) => list[Math.floor(rand() * list.length)];

/**
 * How likely a pawn of player k on track `cell` is to be hit before k moves again: for every
 * opponent pawn 1-6 squares behind it on that opponent's way, a sixth (a pawn in the yard reaches
 * its start square with a 6). At most 1. The home squares are always safe.
 */
export function danger(game, k, cell) {
  if (cell === null) return 0;
  let p = 0;
  game.pawns.forEach((list, q) => {
    if (q === k) return;
    const way = WAYS[game.seats[q]];
    const at = way.indexOf(cell);
    if (at < 1 || at > TRACK_LEN) return; // not on q's track (q never walks there)
    for (const from of new Set(list)) {
      if (from === 0 && at === 1) p += 1 / 6;
      else if (onTrack(from) && at - from >= 1 && at - from <= 6) p += 1 / 6;
    }
  });
  return Math.min(1, p);
}

/** How good a move looks for the player to move (medium). Higher is better. */
export function scoreMove(game, move) {
  const k = game.turn;
  let s = 0;
  for (const c of move.captures) s += 60 + game.pawns[c.player][c.pawn] * 0.8; // a pawn far along hurts them more
  if (isHome(move.to)) s += isHome(move.from) ? 8 + move.to : 55;
  if (move.from === 0) s += 30; // another pawn on its way
  if (onTrack(move.to)) s -= danger(game, k, cellAt(game, k, move.to)) * 70;
  if (onTrack(move.from)) s += danger(game, k, cellAt(game, k, move.from)) * 45; // out of reach
  s += move.to * 0.15; // a little push for the pawn furthest along
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
 * A sensible child, for the tests: a capture when there is one, else into the home squares, else
 * a new pawn out, else the pawn furthest along that lands out of easy reach.
 */
export function sensibleMove(game) {
  const moves = legalMoves(game);
  if (!moves.length) return null;
  const k = game.turn;
  const key = (m) => {
    if (m.captures.length) return 1000 + m.to;
    if (isHome(m.to) && !isHome(m.from)) return 900;
    if (m.from === 0) return 800;
    if (isHome(m.to)) return 100 + m.to;
    return (danger(game, k, cellAt(game, k, m.to)) < 0.2 ? 500 : 200) + m.to;
  };
  return moves.reduce((a, b) => (key(b) > key(a) ? b : a));
}
