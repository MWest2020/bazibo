// The computer player for Tijgers en geitjes (Bagh-Chal). It plays either side and only ever
// plays a legal move (it never cheats); the levels differ in how far it looks ahead:
//   1 easy   (free): mostly at random. As the tigers it takes a goat only now and then
//                    (EASY_CAPTURE; capturing is never compulsory), as the goats it keeps a goat
//                    safe only now and then (EASY_SAFE), so a child who plays sensibly wins often
//   2 medium (full version): alpha-beta search, 3 plies deep
//   3 hard   (full version): the same search, up to 8 plies deep, deepening step by step until
//                    its budget of positions or its time (THINK_MS) is spent
// At the end of the search a tiger that can still capture counts as having done so, and goats
// that are under threat count against the goats, so medium and hard never give a goat away for
// nothing (as the goats) and never let a free goat go (as the tigers).
// The search counts the positions it looks at and stops at a budget or a deadline, whichever comes
// first, so a move never takes long, also on a slow phone; in the app it runs in a worker
// (ai-worker.js, through Dammen's think.js), and on the page with PAGE_NODES when a worker cannot
// start. `rand` is a function returning [0, 1); tests pass a seeded one.
import { GOAT, TIGER, POINTS, WIN_CAPTURES, NEIGHBOURS, JUMPS, legalMoves, applyMove, capturable, other } from './rules.js';

export const LEVELS = Object.freeze([1, 2, 3]);

/** Search settings per level: deepest search and the budget of positions. */
export const SEARCH = Object.freeze({
  2: Object.freeze({ depth: 3, nodes: 30000 }),
  3: Object.freeze({ depth: 8, nodes: 120000 }),
});
/** The longest a search may take, in ms (a slow phone stops here before the position budget). */
export const THINK_MS = 2000;
/** On the page (no worker) the budget is smaller, so the screen never stalls for long. */
export const PAGE_NODES = 12000;
/** Easy tigers take a goat they can take this often. */
export const EASY_CAPTURE = 0.3;
/** Easy goats pick a move that keeps every goat safe this often. */
export const EASY_SAFE = 0.3;

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOAT_VALUE = 1000;
const WIN = 1e6;

/** Tiger moves and tigers that cannot move. */
function tigerStats(board) {
  let mobility = 0;
  let trapped = 0;
  for (let i = 0; i < POINTS; i++) {
    if (board[i] !== TIGER) continue;
    let n = 0;
    for (const to of NEIGHBOURS[i]) if (!board[to]) n++;
    for (const j of JUMPS[i]) if (board[j.over] === GOAT && !board[j.to]) n++;
    mobility += n;
    if (!n) trapped++;
  }
  return { mobility, trapped };
}

/**
 * How good the position looks for `player`, with `turn` to move: goats captured, goats under
 * threat (a tiger to move takes one; goats to move can save one, not two), tiger mobility and
 * trapped tigers, goats on the edge (safe from jumps) while they are still being placed.
 */
export function evaluate(board, toPlace, captured, turn, player) {
  const { mobility, trapped } = tigerStats(board);
  const threats = capturable(board).length;
  let s = captured * GOAT_VALUE; // for the tigers
  if (threats) s += turn === TIGER ? GOAT_VALUE * 0.9 : threats > 1 ? GOAT_VALUE * 0.8 : 220;
  s += mobility * 12 - trapped * 160;
  if (toPlace > 0) {
    // goats on the edge cannot be jumped over: a small plus for the goats while placing
    for (let i = 0; i < POINTS; i++) {
      if (board[i] !== GOAT) continue;
      const r = Math.floor(i / 5);
      const c = i % 5;
      if (r === 0 || r === 4 || c === 0 || c === 4) s -= 6;
    }
  }
  return player === TIGER ? s : -s;
}

class OutOfNodes extends Error {}

function search(board, toPlace, captured, player, depth, alpha, beta, ctx, ply) {
  if (++ctx.nodes > ctx.budget) throw new OutOfNodes();
  if ((ctx.nodes & 511) === 0 && now() > ctx.deadline) throw new OutOfNodes();
  if (captured >= WIN_CAPTURES) return player === TIGER ? WIN - ply : -WIN + ply;
  const moves = legalMoves(board, player, toPlace);
  if (!moves.length) return -WIN + ply; // the side to move cannot move: a loss (the sooner, the worse)
  if (depth <= 0) return evaluate(board, toPlace, captured, player, player);
  let best = -Infinity;
  for (const m of order(moves)) {
    const score = -search(applyMove(board, m), m.from < 0 ? toPlace - 1 : toPlace, captured + (m.over >= 0 ? 1 : 0), other(player), depth - 1, -beta, -alpha, ctx, ply + 1);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Captures first: better cut-offs. */
function order(moves) {
  return moves.slice().sort((a, b) => Number(b.over >= 0) - Number(a.over >= 0));
}

const pick = (list, rand) => list[Math.floor(rand() * list.length)];

/** Moves after which no tiger can capture (for the goats). */
export function safeMoves(board, moves) {
  return moves.filter((m) => !capturable(applyMove(board, m)).length);
}

/**
 * The move the computer plays for `player` at `level`, or null when it has none. `game` is
 * { board, toPlace, captured }. Returns a move object from legalMoves(). `opts.nodes` overrides
 * the budget (the page fallback, the tests), `opts.ms` the time limit, `opts.depth` the depth.
 */
export function chooseMove(game, player, level, rand = Math.random, opts = {}) {
  const { board, toPlace, captured } = game;
  const moves = legalMoves(board, player, toPlace);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  if (level <= 1) {
    if (player === TIGER) {
      const caps = moves.filter((m) => m.over >= 0);
      if (caps.length && rand() < EASY_CAPTURE) return pick(caps, rand);
      const steps = moves.filter((m) => m.over < 0);
      return pick(steps.length ? steps : moves, rand);
    }
    if (rand() < EASY_SAFE) {
      const safe = safeMoves(board, moves);
      if (safe.length) return pick(safe, rand);
    }
    return pick(moves, rand);
  }
  const set = SEARCH[level] || SEARCH[3];
  const ctx = { nodes: 0, budget: opts.nodes ?? set.nodes, deadline: now() + (opts.ms ?? THINK_MS) };
  const maxDepth = opts.depth ?? set.depth;
  let bestMoves = moves; // before any search finished: any move
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let best = -Infinity;
      let found = [];
      for (const m of order(moves)) {
        const score = -search(applyMove(board, m), m.from < 0 ? toPlace - 1 : toPlace, captured + (m.over >= 0 ? 1 : 0), other(player), depth - 1, -Infinity, Infinity, ctx, 1);
        if (score > best + 1e-9) {
          best = score;
          found = [m];
        } else if (Math.abs(score - best) <= 1e-9) found.push(m);
      }
      bestMoves = found;
      if (best >= WIN - 100) break; // a sure win: no need to look further
    } catch (err) {
      if (!(err instanceof OutOfNodes)) throw err;
      break; // the budget is spent: keep the last depth that finished
    }
  }
  // among equally good moves pick one at random, so games differ
  return pick(bestMoves, rand);
}
