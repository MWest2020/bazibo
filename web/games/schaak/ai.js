// The computer player for Schaken (chess). It only ever plays a legal move (it never cheats); the
// levels differ in how far it looks ahead:
//   1 easy   (free): mostly at random; now and then (EASY_TAKE) it takes a piece that is free (not
//                    guarded, or worth more than the piece that takes it), so a child who plays
//                    sensibly wins most games
//   2 medium (full version): alpha-beta search 2 plies deep plus the captures after that,
//                    material and a simple positional sense (piece-square tables), a little
//                    randomness so games differ
//   3 hard   (full version): the same search, deepening step by step up to 6 plies, with move
//                    ordering (the best move of the last depth, captures by most valuable victim,
//                    killer moves) and the captures after that (quiescence), until its budget of
//                    positions or its time (THINK_MS) is spent
// The search counts the positions it looks at and stops at a budget or a deadline, whichever comes
// first, so a move never takes long, also on a slow phone; in the app it runs in a worker
// (ai-worker.js, through Dammen's think.js), and on the page with PAGE_NODES when a worker cannot
// start. `rand` is a function returning [0, 1); tests pass a seeded one.
import {
  WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
  workCopy, legalOn, makeMove, unmakeMove, inCheck, attacked, positionKey, applyMove, other, colorOf,
} from './rules.js';

export const LEVELS = Object.freeze([1, 2, 3]);

/** Search settings per level: deepest search and the budget of positions. */
export const SEARCH = Object.freeze({
  2: Object.freeze({ depth: 2, nodes: 25000, noise: 18 }),
  3: Object.freeze({ depth: 6, nodes: 220000, noise: 0 }),
});
/** The longest a search may take, in ms (a slow phone stops here before the position budget). */
export const THINK_MS = 2500;
/** On the page (no worker) the budget is smaller, so the screen never stalls for long. */
export const PAGE_NODES = 15000;
/** Easy takes a free piece this often. */
export const EASY_TAKE = 0.4;
/** The hint (easy only): a quick, shallow look. */
export const HINT = Object.freeze({ depth: 2, nodes: 6000 });

/** The worth of each kind, in hundredths of a pawn. */
export const VALUE = Object.freeze([0, 100, 320, 330, 500, 900, 0]);
const MATE = 100000;

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

// ---------- the evaluation ----------

// Piece-square tables from white's side (index 0 = a8), in hundredths of a pawn: pawns forward and
// in the centre, knights and bishops towards the middle, rooks on the 7th, the king safe behind its
// pawns in the middle game and in the centre in the end game.
const PST = {
  [PAWN]: [
    0, 0, 0, 0, 0, 0, 0, 0,
    60, 60, 60, 60, 60, 60, 60, 60,
    20, 20, 30, 40, 40, 30, 20, 20,
    8, 8, 14, 28, 28, 14, 8, 8,
    2, 2, 6, 22, 22, 6, 2, 2,
    4, -2, -6, 4, 4, -6, -2, 4,
    4, 8, 8, -16, -16, 8, 8, 4,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [KNIGHT]: [
    -40, -30, -20, -20, -20, -20, -30, -40,
    -30, -10, 0, 4, 4, 0, -10, -30,
    -20, 4, 12, 16, 16, 12, 4, -20,
    -20, 4, 16, 22, 22, 16, 4, -20,
    -20, 4, 16, 22, 22, 16, 4, -20,
    -20, 4, 12, 14, 14, 12, 4, -20,
    -30, -10, 0, 4, 4, 0, -10, -30,
    -40, -24, -20, -20, -20, -20, -24, -40,
  ],
  [BISHOP]: [
    -16, -8, -8, -8, -8, -8, -8, -16,
    -8, 0, 0, 0, 0, 0, 0, -8,
    -8, 0, 6, 10, 10, 6, 0, -8,
    -8, 6, 6, 10, 10, 6, 6, -8,
    -8, 0, 10, 10, 10, 10, 0, -8,
    -8, 10, 10, 10, 10, 10, 10, -8,
    -8, 6, 0, 0, 0, 0, 6, -8,
    -16, -8, -12, -8, -8, -12, -8, -16,
  ],
  [ROOK]: [
    0, 0, 0, 0, 0, 0, 0, 0,
    8, 12, 12, 12, 12, 12, 12, 8,
    -4, 0, 0, 0, 0, 0, 0, -4,
    -4, 0, 0, 0, 0, 0, 0, -4,
    -4, 0, 0, 0, 0, 0, 0, -4,
    -4, 0, 0, 0, 0, 0, 0, -4,
    -4, 0, 0, 0, 0, 0, 0, -4,
    0, 0, 2, 6, 6, 4, 0, 0,
  ],
  [QUEEN]: [
    -16, -8, -8, -4, -4, -8, -8, -16,
    -8, 0, 0, 0, 0, 0, 0, -8,
    -8, 0, 4, 4, 4, 4, 0, -8,
    -4, 0, 4, 4, 4, 4, 0, -4,
    -4, 0, 4, 4, 4, 4, 0, -4,
    -8, 2, 4, 4, 4, 4, 0, -8,
    -8, 0, 2, 0, 0, 0, 0, -8,
    -16, -8, -8, -4, -4, -8, -8, -16,
  ],
  [KING]: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    16, 16, 0, 0, 0, 0, 16, 16,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};
const KING_END = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];
const mirror = (i) => (7 - (i >> 3)) * 8 + (i & 7);
const dist = (a, b) => Math.max(Math.abs((a >> 3) - (b >> 3)), Math.abs((a & 7) - (b & 7)));
const edge = (i) => {
  const r = i >> 3;
  const c = i & 7;
  return Math.max(3 - Math.min(r, 7 - r), 3 - Math.min(c, 7 - c)); // 0 in the centre, 3 on the edge
};

/**
 * How good the position looks for `player` (hundredths of a pawn): material, the piece-square
 * tables, and in a won ending the losing king pushed to the edge with the winning king near it (so
 * the computer can finish a game with a queen or a rook).
 */
export function evaluate(board, player) {
  const mat = [0, 0, 0];
  const pos = [0, 0, 0];
  const kings = [0, -1, -1];
  let heavy = 0; // queens and minor pieces, to tell the end game
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const kind = p & 7;
    const c = colorOf(p);
    const sq = c === WHITE ? i : mirror(i);
    if (kind === KING) {
      kings[c] = i;
      continue;
    }
    mat[c] += VALUE[kind];
    pos[c] += PST[kind][sq];
    if (kind !== PAWN) heavy += kind === QUEEN ? 3 : kind === ROOK ? 2 : 1;
  }
  const endgame = heavy <= 6;
  for (const c of [WHITE, BLACK]) {
    const sq = c === WHITE ? kings[c] : mirror(kings[c]);
    pos[c] += endgame ? KING_END[sq] : PST[KING][sq];
  }
  let s = mat[WHITE] - mat[BLACK] + pos[WHITE] - pos[BLACK];
  // a won ending: drive the other king to the edge and bring the own king close
  const lead = mat[WHITE] - mat[BLACK];
  if (endgame && Math.abs(lead) >= 400) {
    const strong = lead > 0 ? WHITE : BLACK;
    const weak = other(strong);
    const push = edge(kings[weak]) * 24 + (7 - dist(kings[WHITE], kings[BLACK])) * 10;
    s += strong === WHITE ? push : -push;
  }
  return player === WHITE ? s : -s;
}

// ---------- the search ----------

class OutOfNodes extends Error {}

const victimScore = (m) => (m.captured ? VALUE[m.captured & 7] * 10 - VALUE[m.piece & 7] / 10 : 0) + (m.promo ? VALUE[m.promo] * 10 : 0);

function order(moves, ctx, ply, first) {
  const k = ctx.killers[ply] || [];
  for (const m of moves) {
    let s = victimScore(m);
    if (!s && k.some((x) => x && x.from === m.from && x.to === m.to)) s = 900;
    if (first && m.from === first.from && m.to === first.to && m.promo === first.promo) s = 1e9;
    m.order = s;
  }
  return moves.sort((a, b) => b.order - a.order);
}

function tick(ctx) {
  if (++ctx.nodes > ctx.budget) throw new OutOfNodes();
  if ((ctx.nodes & 511) === 0 && now() > ctx.deadline) throw new OutOfNodes();
}

/** Only captures (and promotions) until the position is quiet: no piece left hanging at the end. */
function quiesce(s, alpha, beta, ctx, qdepth) {
  tick(ctx);
  const stand = evaluate(s.board, s.turn);
  if (stand >= beta || qdepth <= 0) return stand;
  if (stand > alpha) alpha = stand;
  const moves = order(legalOn(s, true), ctx, 63, null);
  for (const m of moves) {
    const u = makeMove(s, m);
    const score = -quiesce(s, -beta, -alpha, ctx, qdepth - 1);
    unmakeMove(s, m, u);
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function search(s, depth, alpha, beta, ctx, ply) {
  tick(ctx);
  const moves = legalOn(s);
  const me = s.turn;
  if (!moves.length) return inCheck(s, me) ? -MATE + ply : 0; // mate (the sooner, the worse) or stalemate
  if (s.half >= 100) return 0;
  if (depth <= 0) return quiesce(s, alpha, beta, ctx, 6);
  let best = -Infinity;
  for (const m of order(moves, ctx, ply, null)) {
    const u = makeMove(s, m);
    const score = -search(s, depth - 1, -beta, -alpha, ctx, ply + 1);
    unmakeMove(s, m, u);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) {
      if (!m.captured) {
        const k = (ctx.killers[ply] ||= [null, null]);
        if (!(k[0] && k[0].from === m.from && k[0].to === m.to)) {
          k[1] = k[0];
          k[0] = m;
        }
      }
      break;
    }
  }
  return best;
}

const pick = (list, rand) => list[Math.floor(rand() * list.length)];

/** Captures that win something: the piece is not guarded, or worth more than the piece taking it. */
export function freeCaptures(pos, moves) {
  const s = workCopy(pos);
  const foe = other(pos.turn);
  return moves.filter((m) => {
    if (!m.captured) return false;
    if (VALUE[m.captured & 7] > VALUE[m.piece & 7]) return true;
    // after the capture: is the square not covered by the other side?
    const u = makeMove(s, m);
    const safe = !attacked(s, m.to, foe);
    unmakeMove(s, m, u);
    return safe;
  });
}

/**
 * The move the computer plays at `level`, or null when it has none. `pos` is a position from
 * rules.js; `opts.keys` the position keys of the game so far (a move that repeats a position for
 * the third time counts as a draw), `opts.nodes` overrides the budget (the page fallback, the
 * tests), `opts.ms` the time limit, `opts.depth` the depth.
 */
export function chooseMove(pos, level, rand = Math.random, opts = {}) {
  const s = workCopy(pos);
  const moves = legalOn(s);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  if (level <= 1 && !opts.depth) {
    // a pawn that reaches the end always becomes a queen at easy
    const plain = moves.filter((m) => !m.promo || m.promo === QUEEN);
    if (rand() < EASY_TAKE) {
      const free = freeCaptures(pos, plain);
      if (free.length) return pick(free, rand);
    }
    return pick(plain, rand);
  }
  const set = SEARCH[level] || SEARCH[3];
  const ctx = { nodes: 0, budget: opts.nodes ?? set.nodes, deadline: now() + (opts.ms ?? THINK_MS), killers: [] };
  const maxDepth = opts.depth ?? set.depth;
  const noise = opts.noise ?? set.noise ?? 0;
  const seen = Array.isArray(opts.keys) ? opts.keys : [];
  // a move that makes the same position come back a third time is a draw
  const repeats = new Set();
  if (seen.length) {
    for (const m of moves) {
      const key = positionKey(applyMove(pos, m));
      if (seen.filter((k) => k === key).length >= 2) repeats.add(m);
    }
  }
  const jitter = new Map(moves.map((m) => [m, noise ? Math.round((rand() * 2 - 1) * noise) : 0]));
  let bestMoves = moves; // before any search finished: any move
  let first = null;
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let best = -Infinity;
      let found = [];
      let alpha = -Infinity;
      for (const m of order(moves.slice(), ctx, 0, first)) {
        let score;
        if (repeats.has(m)) score = 0;
        else {
          const u = makeMove(s, m);
          // a narrow window around the best so far (plus the noise), then the full one when needed
          score = -search(s, depth - 1, -Infinity, -(alpha - noise - 1), ctx, 1);
          unmakeMove(s, m, u);
        }
        score += jitter.get(m);
        if (score > best + 1e-9) {
          best = score;
          found = [m];
        } else if (Math.abs(score - best) <= 1e-9) found.push(m);
        if (best > alpha) alpha = best;
      }
      bestMoves = found;
      first = found[0];
      if (best >= MATE - 1000) break; // a sure mate: no need to look further
    } catch (err) {
      if (!(err instanceof OutOfNodes)) throw err;
      break; // the budget is spent: keep the last depth that finished
    }
  }
  // among equally good moves pick one at random, so games differ
  return pick(bestMoves, rand);
}

/** A good move for the child (the hint button at easy): a quick, shallow look. */
export function hintMove(pos, rand = Math.random) {
  return chooseMove(pos, 2, rand, { depth: HINT.depth, nodes: HINT.nodes, noise: 0 });
}
