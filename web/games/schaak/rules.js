// Schaken (chess): the complete FIDE Laws of Chess, pure (no DOM, no timers), so they can be tested
// in node. Source: the FIDE Handbook, "Laws of Chess" (articles 3 and 5 for the moves and the end of
// the game, 9 for the draws); chess itself is public domain.
//
// The board is 64 squares, index = row * 8 + col, row 0 at the top (rank 8, black's back rank) and
// row 7 at the bottom (rank 1, white's back rank): a8 is 0, h8 7, a1 56, h1 63. White (player 1)
// plays from the bottom and always starts. A piece is a number: its kind (PAWN 1 .. KING 6) for
// white, kind + 8 for black; 0 is an empty square.
//
// A position: { board, turn: 1 | 2, castling: bits (WK 1, WQ 2, BK 4, BQ 8), ep: the square a pawn
// may capture en passant onto (-1: none), half: plies since the last capture or pawn move, full: the
// move number }. A game: { pos, keys: the position keys since the start (for repetition), over }.
//
// The draws are automatic here, so a game between children always ends without a claim: the same
// position for the third time (FIDE 9.2 lets a player claim it), 50 moves by each side without a
// capture or a pawn move (9.3, a claim), and positions where neither side can ever mate (5.2.2, the
// usual cases: king against king, king and one bishop or knight against king, and kings with only
// bishops on squares of one colour). A move is a plain object:
// { from, to, piece, captured, promo: the kind a pawn becomes (0: none), flag }.
export const WHITE = 1;
export const BLACK = 2;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export const KINDS = Object.freeze([PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING]);
/** What a pawn may become, the queen first (the default). */
export const PROMOTIONS = Object.freeze([QUEEN, ROOK, BISHOP, KNIGHT]);

export const FLAG_NONE = 0;
export const FLAG_DOUBLE = 1; // a pawn's first double step
export const FLAG_EP = 2; // a capture en passant
export const FLAG_CASTLE_K = 3; // castling on the king's side (O-O)
export const FLAG_CASTLE_Q = 4; // castling on the queen's side (O-O-O)

export const CASTLE_WK = 1;
export const CASTLE_WQ = 2;
export const CASTLE_BK = 4;
export const CASTLE_BQ = 8;

/** 50 moves by each side without a capture or a pawn move. */
export const FIFTY_PLIES = 100;
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const piece = (color, kind) => (color === BLACK ? kind + 8 : kind);
export const kindOf = (p) => p & 7;
export const colorOf = (p) => (p ? (p & 8 ? BLACK : WHITE) : 0);
export const other = (c) => (c === WHITE ? BLACK : WHITE);
export const rowOf = (i) => i >> 3;
export const colOf = (i) => i & 7;

const FILES = 'abcdefgh';
/** The square's name: 0 -> 'a8', 63 -> 'h1'. */
export const squareName = (i) => FILES[i & 7] + String(8 - (i >> 3));
/** The square of a name ('e4' -> 36), or -1. */
export function squareOf(name) {
  if (typeof name !== 'string' || !/^[a-h][1-8]$/.test(name)) return -1;
  return (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]);
}
/** A light square (a1 is dark, h1 light). */
export const isLight = (i) => ((i >> 3) + (i & 7)) % 2 === 0;

// ---------- the lines on the board, worked out once ----------

const KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function steps(list) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    const r = i >> 3;
    const c = i & 7;
    out.push(list.filter(([dr, dc]) => r + dr >= 0 && r + dr < 8 && c + dc >= 0 && c + dc < 8).map(([dr, dc]) => (r + dr) * 8 + c + dc));
  }
  return out;
}
function rays(dirs) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    const r0 = i >> 3;
    const c0 = i & 7;
    out.push(
      dirs.map(([dr, dc]) => {
        const ray = [];
        for (let r = r0 + dr, c = c0 + dc; r >= 0 && r < 8 && c >= 0 && c < 8; r += dr, c += dc) ray.push(r * 8 + c);
        return ray;
      }),
    );
  }
  return out;
}
const KNIGHT_TO = steps(KNIGHT_STEPS);
const KING_TO = steps(KING_STEPS);
const ROOK_RAYS = rays(ROOK_DIRS);
const BISHOP_RAYS = rays(BISHOP_DIRS);
// the castling right lost when a piece leaves or arrives on a square (a king or a rook moving, a rook taken)
const CASTLE_MASK = new Array(64).fill(15);
CASTLE_MASK[60] = 15 & ~(CASTLE_WK | CASTLE_WQ); // e1
CASTLE_MASK[63] = 15 & ~CASTLE_WK; // h1
CASTLE_MASK[56] = 15 & ~CASTLE_WQ; // a1
CASTLE_MASK[4] = 15 & ~(CASTLE_BK | CASTLE_BQ); // e8
CASTLE_MASK[7] = 15 & ~CASTLE_BK; // h8
CASTLE_MASK[0] = 15 & ~CASTLE_BQ; // a8

// ---------- FEN ----------

const FEN_KIND = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
const KIND_CHAR = ' pnbrqk';

/** A position from Forsyth-Edwards Notation; throws on anything that is not a sound position. */
export function fromFen(fen) {
  if (typeof fen !== 'string' || fen.length > 100) throw new Error('bad fen');
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0]?.split('/') || [];
  if (rows.length !== 8) throw new Error('bad fen: rows');
  const board = [];
  for (const row of rows) {
    let n = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        for (let k = 0; k < Number(ch); k++) board.push(0);
        n += Number(ch);
      } else {
        const kind = FEN_KIND[ch.toLowerCase()];
        if (!kind) throw new Error('bad fen: piece');
        board.push(piece(ch === ch.toLowerCase() ? BLACK : WHITE, kind));
        n++;
      }
    }
    if (n !== 8) throw new Error('bad fen: row length');
  }
  const turn = parts[1] === 'b' ? BLACK : parts[1] === 'w' || parts[1] === undefined ? WHITE : null;
  if (!turn) throw new Error('bad fen: turn');
  let castling = 0;
  const c = parts[2] || '-';
  if (!/^(-|K?Q?k?q?)$/.test(c)) throw new Error('bad fen: castling');
  if (c.includes('K')) castling |= CASTLE_WK;
  if (c.includes('Q')) castling |= CASTLE_WQ;
  if (c.includes('k')) castling |= CASTLE_BK;
  if (c.includes('q')) castling |= CASTLE_BQ;
  const ep = parts[3] && parts[3] !== '-' ? squareOf(parts[3]) : -1;
  if (parts[3] && parts[3] !== '-' && ep < 0) throw new Error('bad fen: en passant');
  const half = parts[4] === undefined ? 0 : Number(parts[4]);
  const full = parts[5] === undefined ? 1 : Number(parts[5]);
  if (!Number.isInteger(half) || half < 0 || !Number.isInteger(full) || full < 1) throw new Error('bad fen: counters');
  const pos = { board, turn, castling, ep, half, full };
  if (board.filter((p) => p === piece(WHITE, KING)).length !== 1 || board.filter((p) => p === piece(BLACK, KING)).length !== 1) throw new Error('bad fen: kings');
  // castling rights only where the king and rook still stand
  if (board[60] !== KING) pos.castling &= ~(CASTLE_WK | CASTLE_WQ);
  if (board[63] !== ROOK) pos.castling &= ~CASTLE_WK;
  if (board[56] !== ROOK) pos.castling &= ~CASTLE_WQ;
  if (board[4] !== KING + 8) pos.castling &= ~(CASTLE_BK | CASTLE_BQ);
  if (board[7] !== ROOK + 8) pos.castling &= ~CASTLE_BK;
  if (board[0] !== ROOK + 8) pos.castling &= ~CASTLE_BQ;
  return pos;
}

/** The position as FEN. */
export function toFen(pos) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let s = '';
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = pos.board[r * 8 + c];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) s += String(empty);
      empty = 0;
      const ch = KIND_CHAR[kindOf(p)];
      s += colorOf(p) === WHITE ? ch.toUpperCase() : ch;
    }
    if (empty) s += String(empty);
    rows.push(s);
  }
  let c = '';
  if (pos.castling & CASTLE_WK) c += 'K';
  if (pos.castling & CASTLE_WQ) c += 'Q';
  if (pos.castling & CASTLE_BK) c += 'k';
  if (pos.castling & CASTLE_BQ) c += 'q';
  return `${rows.join('/')} ${pos.turn === WHITE ? 'w' : 'b'} ${c || '-'} ${pos.ep >= 0 ? squareName(pos.ep) : '-'} ${pos.half} ${pos.full}`;
}

// ---------- the engine: a mutable copy for fast move making (also used by ai.js) ----------

/** A working copy of a position for making and unmaking moves; `kings` caches both kings. */
export function workCopy(pos) {
  const board = pos.board.slice();
  const kings = [-1, board.indexOf(KING), board.indexOf(KING + 8)];
  return { board, turn: pos.turn, castling: pos.castling, ep: pos.ep, half: pos.half, full: pos.full, kings };
}

/** Is square `sq` attacked by a piece of `by`? */
export function attacked(s, sq, by) {
  const b = s.board;
  const add = by === BLACK ? 8 : 0;
  // pawns: a white pawn attacks up (from the row below), a black pawn down
  const r = sq >> 3;
  const c = sq & 7;
  if (by === WHITE) {
    if (r < 7) {
      if (c > 0 && b[sq + 7] === PAWN) return true;
      if (c < 7 && b[sq + 9] === PAWN) return true;
    }
  } else if (r > 0) {
    if (c > 0 && b[sq - 9] === PAWN + 8) return true;
    if (c < 7 && b[sq - 7] === PAWN + 8) return true;
  }
  for (const t of KNIGHT_TO[sq]) if (b[t] === KNIGHT + add) return true;
  for (const t of KING_TO[sq]) if (b[t] === KING + add) return true;
  for (const ray of ROOK_RAYS[sq]) {
    for (const t of ray) {
      const p = b[t];
      if (!p) continue;
      if (p === ROOK + add || p === QUEEN + add) return true;
      break;
    }
  }
  for (const ray of BISHOP_RAYS[sq]) {
    for (const t of ray) {
      const p = b[t];
      if (!p) continue;
      if (p === BISHOP + add || p === QUEEN + add) return true;
      break;
    }
  }
  return false;
}

/** Is `color`'s king in check? */
export const inCheck = (s, color) => attacked(s, s.kings[color], other(color));

function addPawnMove(out, from, to, p, captured, flag) {
  const r = to >> 3;
  if (r === 0 || r === 7) {
    for (const k of PROMOTIONS) out.push({ from, to, piece: p, captured, promo: k, flag });
  } else out.push({ from, to, piece: p, captured, promo: 0, flag });
}

/**
 * Every move the side to move could make if its own king did not matter (pseudo-legal), into
 * `out`. `capturesOnly`: only captures and promotions (the search's quiet ending).
 */
export function pseudoMoves(s, out = [], capturesOnly = false) {
  const b = s.board;
  const me = s.turn;
  const foe = other(me);
  for (let from = 0; from < 64; from++) {
    const p = b[from];
    if (!p || colorOf(p) !== me) continue;
    const kind = p & 7;
    if (kind === PAWN) {
      const dir = me === WHITE ? -8 : 8;
      const startRow = me === WHITE ? 6 : 1;
      const r = from >> 3;
      const c = from & 7;
      const one = from + dir;
      const lastRow = me === WHITE ? 0 : 7;
      if (one >= 0 && one < 64 && !b[one]) {
        if (!capturesOnly || (one >> 3) === lastRow) addPawnMove(out, from, one, p, 0, FLAG_NONE);
        if (!capturesOnly && r === startRow && !b[one + dir]) out.push({ from, to: one + dir, piece: p, captured: 0, promo: 0, flag: FLAG_DOUBLE });
      }
      for (const dc of [-1, 1]) {
        if (c + dc < 0 || c + dc > 7) continue;
        const to = one + dc;
        if (to < 0 || to >= 64) continue;
        const q = b[to];
        if (q && colorOf(q) === foe) addPawnMove(out, from, to, p, q, FLAG_NONE);
        else if (to === s.ep && !q) out.push({ from, to, piece: p, captured: piece(foe, PAWN), promo: 0, flag: FLAG_EP });
      }
      continue;
    }
    if (kind === KNIGHT || kind === KING) {
      for (const to of kind === KNIGHT ? KNIGHT_TO[from] : KING_TO[from]) {
        const q = b[to];
        if (q && colorOf(q) === me) continue;
        if (capturesOnly && !q) continue;
        out.push({ from, to, piece: p, captured: q, promo: 0, flag: FLAG_NONE });
      }
      if (kind === KING && !capturesOnly) castleMoves(s, out, from, p);
      continue;
    }
    const allRays = kind === ROOK ? [ROOK_RAYS[from]] : kind === BISHOP ? [BISHOP_RAYS[from]] : [ROOK_RAYS[from], BISHOP_RAYS[from]];
    for (const set of allRays) {
      for (const ray of set) {
        for (const to of ray) {
          const q = b[to];
          if (!q) {
            if (!capturesOnly) out.push({ from, to, piece: p, captured: 0, promo: 0, flag: FLAG_NONE });
            continue;
          }
          if (colorOf(q) !== me) out.push({ from, to, piece: p, captured: q, promo: 0, flag: FLAG_NONE });
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Castling (FIDE 3.8.2): the king and that rook have never moved (the right is still there), the
 * squares between them are empty, and the king is not in check, does not pass through a square
 * attacked by the other side and does not land in check (the last is checked with every move).
 */
function castleMoves(s, out, from, p) {
  const b = s.board;
  const me = s.turn;
  const foe = other(me);
  const home = me === WHITE ? 60 : 4;
  if (from !== home) return;
  const kRight = me === WHITE ? CASTLE_WK : CASTLE_BK;
  const qRight = me === WHITE ? CASTLE_WQ : CASTLE_BQ;
  const rook = piece(me, ROOK);
  if (!(s.castling & (kRight | qRight))) return;
  if (attacked(s, home, foe)) return; // never out of check
  if (s.castling & kRight && b[home + 3] === rook && !b[home + 1] && !b[home + 2] && !attacked(s, home + 1, foe) && !attacked(s, home + 2, foe)) {
    out.push({ from, to: home + 2, piece: p, captured: 0, promo: 0, flag: FLAG_CASTLE_K });
  }
  if (s.castling & qRight && b[home - 4] === rook && !b[home - 1] && !b[home - 2] && !b[home - 3] && !attacked(s, home - 1, foe) && !attacked(s, home - 2, foe)) {
    out.push({ from, to: home - 2, piece: p, captured: 0, promo: 0, flag: FLAG_CASTLE_Q });
  }
}

/** Make a move on a working copy; returns what unmake needs. */
export function makeMove(s, m) {
  const b = s.board;
  const undo = { castling: s.castling, ep: s.ep, half: s.half, full: s.full };
  const me = s.turn;
  b[m.from] = 0;
  if (m.flag === FLAG_EP) b[m.to + (me === WHITE ? 8 : -8)] = 0;
  b[m.to] = m.promo ? piece(me, m.promo) : m.piece;
  if (m.flag === FLAG_CASTLE_K) {
    b[m.to - 1] = b[m.to + 1];
    b[m.to + 1] = 0;
  } else if (m.flag === FLAG_CASTLE_Q) {
    b[m.to + 1] = b[m.to - 2];
    b[m.to - 2] = 0;
  }
  if ((m.piece & 7) === KING) s.kings[me] = m.to;
  s.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
  s.ep = m.flag === FLAG_DOUBLE ? (m.from + m.to) >> 1 : -1;
  s.half = m.captured || (m.piece & 7) === PAWN ? 0 : s.half + 1;
  if (me === BLACK) s.full++;
  s.turn = other(me);
  return undo;
}

export function unmakeMove(s, m, undo) {
  const b = s.board;
  const me = other(s.turn);
  s.turn = me;
  s.castling = undo.castling;
  s.ep = undo.ep;
  s.half = undo.half;
  s.full = undo.full;
  b[m.from] = m.piece;
  if (m.flag === FLAG_EP) {
    b[m.to] = 0;
    b[m.to + (me === WHITE ? 8 : -8)] = m.captured;
  } else b[m.to] = m.captured;
  if (m.flag === FLAG_CASTLE_K) {
    b[m.to + 1] = b[m.to - 1];
    b[m.to - 1] = 0;
  } else if (m.flag === FLAG_CASTLE_Q) {
    b[m.to - 2] = b[m.to + 1];
    b[m.to + 1] = 0;
  }
  if ((m.piece & 7) === KING) s.kings[me] = m.from;
}

/** The legal moves on a working copy (pseudo-legal moves that do not leave the own king in check). */
export function legalOn(s, capturesOnly = false) {
  const me = s.turn;
  const out = [];
  for (const m of pseudoMoves(s, [], capturesOnly)) {
    const u = makeMove(s, m);
    if (!attacked(s, s.kings[me], s.turn)) out.push(m);
    unmakeMove(s, m, u);
  }
  return out;
}

/** The legal moves in a position (pure). */
export function legalMoves(pos) {
  return legalOn(workCopy(pos));
}

/** The position after a move (pure: the old one is left as it was). */
export function applyMove(pos, m) {
  const s = workCopy(pos);
  makeMove(s, m);
  return { board: s.board, turn: s.turn, castling: s.castling, ep: s.ep, half: s.half, full: s.full };
}

/** Is the side to move in check? */
export const isCheck = (pos) => {
  const s = workCopy(pos);
  return inCheck(s, s.turn);
};

/** The number of leaf positions `depth` plies deep: the standard test of a move generator. */
export function perft(pos, depth) {
  const s = workCopy(pos);
  const walk = (d) => {
    const moves = legalOn(s);
    if (d === 1) return moves.length;
    let n = 0;
    for (const m of moves) {
      const u = makeMove(s, m);
      n += walk(d - 1);
      unmakeMove(s, m, u);
    }
    return n;
  };
  return depth <= 0 ? 1 : walk(depth);
}

// ---------- the game: repetition, the 50-move rule, mate and the draws ----------

/**
 * The key for repetition (FIDE 9.2.3): the pieces, the side to move, the castling rights and an
 * en passant square only when an en passant capture is really possible.
 */
export function positionKey(pos) {
  let ep = '-';
  if (pos.ep >= 0 && legalMoves(pos).some((m) => m.flag === FLAG_EP)) ep = squareName(pos.ep);
  return `${pos.board.join(',')}|${pos.turn}|${pos.castling}|${ep}`;
}

/**
 * Can neither side ever mate (FIDE 5.2.2, the usual cases)? King against king, a king with one
 * bishop or one knight against a bare king, and kings with only bishops that all stand on squares
 * of one colour.
 */
export function insufficientMaterial(board) {
  const minors = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const k = p & 7;
    if (k === KING) continue;
    if (k === PAWN || k === ROOK || k === QUEEN) return false;
    minors.push({ k, i });
  }
  if (minors.length <= 1) return true;
  if (minors.every((m) => m.k === BISHOP)) {
    const shade = isLight(minors[0].i);
    return minors.every((m) => isLight(m.i) === shade);
  }
  return false;
}

/** How the game stands: null while it goes on, else { winner, reason: 'mate' } or { draw: true, reason }. */
export function outcome(pos, keys = []) {
  const moves = legalMoves(pos);
  if (!moves.length) {
    if (isCheck(pos)) return { winner: other(pos.turn), reason: 'mate' };
    return { draw: true, reason: 'stalemate' };
  }
  if (insufficientMaterial(pos.board)) return { draw: true, reason: 'material' };
  const key = keys.length ? keys[keys.length - 1] : positionKey(pos);
  if (keys.filter((k) => k === key).length >= 3) return { draw: true, reason: 'repeat' };
  if (pos.half >= FIFTY_PLIES) return { draw: true, reason: 'fifty' };
  return null;
}

/** A new game, from the start or from a FEN (the tests and the test hook). */
export function newGame(fen = START_FEN) {
  const pos = fromFen(fen);
  const keys = [positionKey(pos)];
  return { pos, keys, over: outcome(pos, keys) };
}

/** The game after a legal move (pure: the old game is kept for take-back). */
export function play(game, m) {
  const pos = applyMove(game.pos, m);
  // a capture or a pawn move can never be repeated past: older keys no longer matter
  const keys = pos.half === 0 ? [positionKey(pos)] : [...game.keys, positionKey(pos)];
  return { pos, keys, over: outcome(pos, keys) };
}

/** Do two moves mean the same thing (from, to and the promotion)? */
export const sameMove = (a, b) => !!a && !!b && a.from === b.from && a.to === b.to && (a.promo || 0) === (b.promo || 0);

/** The move as a short text ('e2e4', 'e7e8q'), for tests and the worker. */
export const moveText = (m) => squareName(m.from) + squareName(m.to) + (m.promo ? ' pnbrqk'[m.promo] : '');

/** The legal move that a text like 'e2e4' or 'e7e8q' means, or null. */
export function moveFromText(pos, text) {
  return legalMoves(pos).find((m) => moveText(m) === text || (moveText(m) === `${text}q` && m.promo === QUEEN)) || null;
}
