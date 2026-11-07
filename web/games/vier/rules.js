// Vier op een rij's rules, pure so they can be tested and used by the computer player (ai.js).
// Two boards:
//   big   7 columns × 6 rows, four in a row wins (ages 6+)
//   small 5 columns × 4 rows, three in a row wins (the "kleuterbord", ages 3-5)
// A board is an array of cols*rows cells, index = row * cols + col, row 0 at the top; a cell is
// 0 (empty), 1 or 2 (a player's token). Tokens drop to the lowest empty cell of their column.

export const BOARDS = Object.freeze({
  big: Object.freeze({ id: 'big', cols: 7, rows: 6, need: 4, age: 6 }),
  small: Object.freeze({ id: 'small', cols: 5, rows: 4, need: 3, age: 3 }),
});

export const other = (player) => (player === 1 ? 2 : 1);

export function emptyBoard(cfg) {
  return new Array(cfg.cols * cfg.rows).fill(0);
}

/** The row a token dropped in `col` lands on, or -1 when the column is full. */
export function landingRow(board, cfg, col) {
  if (col < 0 || col >= cfg.cols) return -1;
  for (let r = cfg.rows - 1; r >= 0; r--) if (!board[r * cfg.cols + col]) return r;
  return -1;
}

export function validCols(board, cfg) {
  const out = [];
  for (let c = 0; c < cfg.cols; c++) if (!board[c]) out.push(c); // the top cell is free
  return out;
}

/** Drop a token: a new board and the cell it landed on, or null when the column is full. */
export function drop(board, cfg, col, player) {
  const r = landingRow(board, cfg, col);
  if (r < 0) return null;
  const next = board.slice();
  const i = r * cfg.cols + col;
  next[i] = player;
  return { board: next, row: r, index: i };
}

const DIRS = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
];

/**
 * The winning cells through cell `index` (the token just played), or null. Returns the whole run,
 * which can be longer than `need` (five in a row shows all five).
 */
export function winAt(board, cfg, index) {
  const p = board[index];
  if (!p) return null;
  const r0 = Math.floor(index / cfg.cols);
  const c0 = index % cfg.cols;
  for (const [dr, dc] of DIRS) {
    const run = [index];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < cfg.rows && c >= 0 && c < cfg.cols && board[r * cfg.cols + c] === p) {
        run.push(r * cfg.cols + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (run.length >= cfg.need) return run.sort((a, b) => a - b);
  }
  return null;
}

/** Any winner on the whole board: { player, cells } or null. */
export function findWin(board, cfg) {
  for (let i = 0; i < board.length; i++) {
    const cells = board[i] ? winAt(board, cfg, i) : null;
    if (cells) return { player: board[i], cells };
  }
  return null;
}

export const isFull = (board) => board.every(Boolean);

/** Columns where `player` would win right now. */
export function winningCols(board, cfg, player) {
  return validCols(board, cfg).filter((c) => {
    const d = drop(board, cfg, c, player);
    return !!winAt(d.board, cfg, d.index);
  });
}
