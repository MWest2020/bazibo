// Dammen's rules, pure so they can be tested and used by the computer player (ai.js).
// Two boards:
//   small  8×8, 12 pieces each (free). Dutch rules made small: a man moves one step diagonally
//          forward; capturing is compulsory and a man may also capture backwards; a capture goes
//          on as long as it can (a multi-capture is one move); a man that ends its move on the far
//          row becomes a king; a king moves and captures one step in every direction. You may
//          pick any capture (the "take the most" rule is for the big board).
//   big   10×10, 20 pieces each (full version), the international rules: as above, plus flying
//          kings (they move and capture along a whole diagonal, landing on any free square beyond
//          the piece) and you must take the most pieces (a king counts as one piece).
// Both boards: pieces jumped in a multi-capture stay on the board until the move ends (they block,
// and are never jumped twice); a man that passes the far row during a capture and has to go on
// stays a man (it is crowned only when the move ends there). A player who cannot move (no pieces,
// or all blocked) loses. A draw: the same position with the same player to move for the third
// time, or QUIET_LIMIT moves in a row with only kings moving and nothing taken.
//
// A board is an array of size*size squares, index = row * size + col, row 0 at the top. Only the
// dark squares ((row + col) odd) are used. A square holds 0 (empty), 1 or 2 (a man of player 1 or
// 2) or 3 or 4 (a king of player 1 or 2). Player 1 starts at the bottom, moves up and goes first.
//
// A move: { from, to, path: [every square it lands on, the last is `to`], captured: [squares],
// promote: bool }.

export const VARIANTS = Object.freeze({
  small: Object.freeze({ id: 'small', size: 8, rows: 3, flying: false, maxCapture: false, age: 6 }),
  big: Object.freeze({ id: 'big', size: 10, rows: 4, flying: true, maxCapture: true, age: 8 }),
});

/** Plies (single moves) with only kings moving and nothing taken before it is a draw: 25 each. */
export const QUIET_LIMIT = 50;

export const other = (player) => (player === 1 ? 2 : 1);
export const owner = (v) => (v ? ((v - 1) % 2) + 1 : 0);
export const isKing = (v) => v >= 3;
export const kingOf = (player) => player + 2;
export const isDark = (cfg, i) => (Math.floor(i / cfg.size) + (i % cfg.size)) % 2 === 1;

const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** The starting position: player 2 on the top rows, player 1 on the bottom rows. */
export function initialBoard(cfg) {
  const { size, rows } = cfg;
  const board = new Array(size * size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r < rows) board[r * size + c] = 2;
      else if (r >= size - rows) board[r * size + c] = 1;
    }
  }
  return board;
}

/** Build a board from a picture, for tests: one line per row, '.' or ' ' empty, w/b men, W/B kings. */
export function boardFrom(cfg, lines) {
  const map = { w: 1, b: 2, W: 3, B: 4 };
  const board = new Array(cfg.size * cfg.size).fill(0);
  lines.forEach((line, r) => {
    [...line.replace(/\s/g, '')].forEach((ch, c) => {
      if (map[ch]) board[r * cfg.size + c] = map[ch];
    });
  });
  return board;
}

const promoteRow = (cfg, player) => (player === 1 ? 0 : cfg.size - 1);

/** Every complete capture sequence for the piece on `from`. */
function captures(board, cfg, from) {
  const { size } = cfg;
  const piece = board[from];
  const me = owner(piece);
  const flying = isKing(piece) && cfg.flying;
  const work = board.slice();
  work[from] = 0; // the moving piece has left its square (it may land there again)
  const out = [];
  const jumped = [];
  const path = [];
  const at = (r, c) => (r >= 0 && r < size && c >= 0 && c < size ? r * size + c : -1);
  const isFoe = (i) => work[i] && owner(work[i]) !== me && !jumped.includes(i);

  function walk(pos) {
    const r0 = Math.floor(pos / size);
    const c0 = pos % size;
    let found = false;
    for (const [dr, dc] of DIRS) {
      let r = r0 + dr;
      let c = c0 + dc;
      if (flying) {
        while (at(r, c) >= 0 && !work[at(r, c)]) {
          r += dr;
          c += dc;
        }
      }
      const mid = at(r, c);
      if (mid < 0 || !isFoe(mid)) continue;
      // the landing squares: right behind the piece, or for a flying king any free square beyond
      let lr = r + dr;
      let lc = c + dc;
      while (at(lr, lc) >= 0 && !work[at(lr, lc)]) {
        const land = at(lr, lc);
        found = true;
        jumped.push(mid);
        path.push(land);
        walk(land);
        path.pop();
        jumped.pop();
        if (!flying) break;
        lr += dr;
        lc += dc;
      }
    }
    if (!found && jumped.length) {
      const to = path[path.length - 1];
      const promote = !isKing(piece) && Math.floor(to / size) === promoteRow(cfg, me);
      out.push({ from, to, path: path.slice(), captured: jumped.slice(), promote });
    }
  }
  walk(from);
  return out;
}

/** Plain moves (no capture) for the piece on `from`. */
function steps(board, cfg, from) {
  const { size } = cfg;
  const piece = board[from];
  const me = owner(piece);
  const king = isKing(piece);
  const out = [];
  const r0 = Math.floor(from / size);
  const c0 = from % size;
  for (const [dr, dc] of DIRS) {
    if (!king && dr !== (me === 1 ? -1 : 1)) continue; // a man only goes forward
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < size && c >= 0 && c < size && !board[r * size + c]) {
      const to = r * size + c;
      const promote = !king && r === promoteRow(cfg, me);
      out.push({ from, to, path: [to], captured: [], promote });
      if (!(king && cfg.flying)) break;
      r += dr;
      c += dc;
    }
  }
  return out;
}

/** All legal moves for `player`: captures when there are any (the most pieces on the big board). */
export function legalMoves(board, cfg, player) {
  let caps = [];
  for (let i = 0; i < board.length; i++) if (board[i] && owner(board[i]) === player) caps.push(...captures(board, cfg, i));
  if (caps.length) {
    if (cfg.maxCapture) {
      const most = Math.max(...caps.map((m) => m.captured.length));
      caps = caps.filter((m) => m.captured.length === most);
    }
    return caps;
  }
  const out = [];
  for (let i = 0; i < board.length; i++) if (board[i] && owner(board[i]) === player) out.push(...steps(board, cfg, i));
  return out;
}

/** The board after a move. */
export function applyMove(board, cfg, move) {
  const next = board.slice();
  const piece = next[move.from];
  next[move.from] = 0;
  for (const i of move.captured) next[i] = 0;
  next[move.to] = move.promote ? kingOf(owner(piece)) : piece;
  return next;
}

export const sameMove = (a, b) => !!a && !!b && a.from === b.from && a.path.length === b.path.length && a.path.every((p, k) => p === b.path[k]);

export const positionKey = (board, turn) => `${turn}:${board.join('')}`;

/** A new game: the board, who is to move, how often each position was seen, the quiet count. */
export function newGame(cfg, board = initialBoard(cfg), turn = 1) {
  const game = { board, turn, seen: { [positionKey(board, turn)]: 1 }, quiet: 0, over: null };
  game.over = outcome(game, cfg);
  return game;
}

/** The game after a move (a new object; the old one is left as it was, for undo). */
export function play(game, cfg, move) {
  const piece = game.board[move.from];
  const board = applyMove(game.board, cfg, move);
  const turn = other(game.turn);
  const key = positionKey(board, turn);
  const quiet = isKing(piece) && !move.captured.length ? game.quiet + 1 : 0;
  const next = { board, turn, seen: { ...game.seen, [key]: (game.seen[key] || 0) + 1 }, quiet, over: null };
  next.over = outcome(next, cfg);
  return next;
}

/**
 * How the game stands: null while it goes on; { winner, reason: 'stuck' } when the player to move
 * has no move; { draw: true, reason: 'repeat' | 'quiet' } for a draw.
 */
export function outcome(game, cfg) {
  if (!legalMoves(game.board, cfg, game.turn).length) return { winner: other(game.turn), reason: 'stuck' };
  if ((game.seen[positionKey(game.board, game.turn)] || 0) >= 3) return { draw: true, reason: 'repeat' };
  if (game.quiet >= QUIET_LIMIT) return { draw: true, reason: 'quiet' };
  return null;
}

/** How many pieces each player has: [_, player 1, player 2]. */
export function countPieces(board) {
  const n = [0, 0, 0];
  for (const v of board) if (v) n[owner(v)]++;
  return n;
}
