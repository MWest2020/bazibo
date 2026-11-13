// The computer player for Dammen. It only ever plays a legal move (it never cheats); the levels
// differ in how far it looks ahead:
//   1 easy   (free): plays mostly at random. It takes a capture only because capturing is
//                    compulsory, and it does not look at what the child can take back, so a child
//                    who looks one move ahead beats it
//   2 medium (full version): alpha-beta search, 3 plies deep, with captures followed to the end
//   3 hard   (full version): the same search, up to 8 plies deep, deepening step by step until
//                    its budget of positions is spent
// The search counts the positions it looks at and stops at a budget, so a move never takes long;
// in the app it runs in a worker (ai-worker.js), and on the page with a smaller budget when a
// worker cannot start. `rand` is a function returning [0, 1); tests pass a seeded one.
import { legalMoves, applyMove, owner, isKing, other } from './rules.js';

export const LEVELS = Object.freeze([1, 2, 3]);

/** Search settings per level: deepest search and the budget of positions. */
export const SEARCH = Object.freeze({
  2: Object.freeze({ depth: 3, nodes: 30000 }),
  3: Object.freeze({ depth: 8, nodes: 120000 }),
});
/** On the page (no worker) the budget is smaller, so the screen never stalls for long. */
export const PAGE_NODES = 12000;
const EASY_SMART = 0.25; // chance that easy picks the best-looking move without looking ahead

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAN = 100;
const KING = 320;
const WIN = 1e6;

/** How good the board looks for `player`: material, men moving up, the centre, a guarded back row. */
export function evaluate(board, cfg, player) {
  const { size } = cfg;
  let score = 0;
  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (!v) continue;
    const p = owner(v);
    const r = Math.floor(i / size);
    const c = i % size;
    let s;
    if (isKing(v)) s = KING;
    else {
      const ahead = p === 1 ? size - 1 - r : r; // rows travelled from its own side
      s = MAN + ahead * 4;
      if ((p === 1 && r === size - 1) || (p === 2 && r === 0)) s += 6; // the back row guards against kings
    }
    if (c > 1 && c < size - 2 && r > 1 && r < size - 2) s += 4; // the centre
    score += p === player ? s : -s;
  }
  return score;
}

class OutOfNodes extends Error {}

function search(board, cfg, player, depth, alpha, beta, ctx, ply) {
  if (++ctx.nodes > ctx.budget) throw new OutOfNodes();
  const moves = legalMoves(board, cfg, player);
  if (!moves.length) return -WIN + ply; // no move: a loss (the sooner, the worse)
  const capturing = moves[0].captured.length > 0;
  // at the horizon, follow captures to the end so it never stops in the middle of an exchange
  if (depth <= 0 && (!capturing || depth < -6)) return evaluate(board, cfg, player);
  let best = -Infinity;
  for (const m of order(moves)) {
    const score = -search(applyMove(board, cfg, m), cfg, other(player), depth - 1, -beta, -alpha, ctx, ply + 1);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Most captures and crownings first: better cut-offs. */
function order(moves) {
  return moves.slice().sort((a, b) => b.captured.length - a.captured.length || Number(b.promote) - Number(a.promote));
}

/**
 * The move the computer plays for `player` at `level`, or null when it has none. Returns the move
 * object from legalMoves(). `opts.nodes` overrides the budget (the page fallback, the tests).
 */
export function chooseMove(board, cfg, player, level, rand = Math.random, opts = {}) {
  const moves = legalMoves(board, cfg, player);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  if (level <= 1) {
    if (rand() < EASY_SMART) {
      const scored = moves.map((m) => evaluate(applyMove(board, cfg, m), cfg, player));
      const top = Math.max(...scored);
      const best = moves.filter((_, k) => scored[k] === top);
      return best[Math.floor(rand() * best.length)];
    }
    return moves[Math.floor(rand() * moves.length)];
  }
  const set = SEARCH[level] || SEARCH[3];
  const ctx = { nodes: 0, budget: opts.nodes ?? set.nodes };
  const maxDepth = opts.depth ?? set.depth;
  let bestMoves = moves; // before any search finished: any move
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let best = -Infinity;
      let found = [];
      for (const m of order(moves)) {
        const score = -search(applyMove(board, cfg, m), cfg, other(player), depth - 1, -Infinity, Infinity, ctx, 1);
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
  return bestMoves[Math.floor(rand() * bestMoves.length)];
}
