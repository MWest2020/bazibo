// The computer player. It only ever plays a legal move on the real board (it never cheats); the
// levels differ only in how well it looks ahead:
//   1 easy   (ages 4+): plays mostly at random near the middle; it takes a win or blocks one only
//                       some of the time, so a young child can beat it
//   2 medium:           always takes a win and always blocks one; otherwise picks a move that does
//                       not hand over a win, near the middle
//   3 hard:             wins, blocks, and otherwise looks a few moves ahead (minimax with
//                       alpha-beta, depth 4 on the big board); a child who thinks ahead and sets
//                       up two threats at once still beats it
// `rand` is a function returning [0, 1); tests pass a seeded one.
import { validCols, drop, winAt, winningCols, other, isFull } from './rules.js';

export const LEVELS = Object.freeze([1, 2, 3]);
const EASY_WIN = 0.55; // chance that easy sees its own win
const EASY_BLOCK = 0.4; // chance that easy blocks a win

/** Columns ordered from the middle outwards, so ties prefer the centre. */
function byCentre(cols, cfg) {
  const mid = (cfg.cols - 1) / 2;
  return cols.slice().sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
}

/** A random column, weighted towards the middle (edges count once, the middle up to cols/2+1 times). */
function centreWeighted(cols, cfg, rand) {
  const mid = (cfg.cols - 1) / 2;
  const weights = cols.map((c) => cfg.cols / 2 + 1 - Math.abs(c - mid));
  let x = rand() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < cols.length; k++) {
    x -= weights[k];
    if (x < 0) return cols[k];
  }
  return cols[cols.length - 1];
}

/** Moves after which `player`'s opponent cannot win at once. */
function safeCols(board, cfg, player) {
  return validCols(board, cfg).filter((c) => winningCols(drop(board, cfg, c, player).board, cfg, other(player)).length === 0);
}

/** How good the board looks for `player`: open runs of its tokens, minus the opponent's. */
export function evaluate(board, cfg, player) {
  const { cols, rows, need } = cfg;
  const opp = other(player);
  let score = 0;
  const mid = Math.floor(cols / 2);
  for (let r = 0; r < rows; r++) {
    if (board[r * cols + mid] === player) score += 3;
    else if (board[r * cols + mid] === opp) score -= 3;
  }
  const weight = (k) => (k === need - 1 ? 5 : k === need - 2 ? 2 : 0);
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rEnd = r + dr * (need - 1);
        const cEnd = c + dc * (need - 1);
        if (rEnd < 0 || rEnd >= rows || cEnd < 0 || cEnd >= cols) continue;
        let mine = 0;
        let theirs = 0;
        for (let k = 0; k < need; k++) {
          const v = board[(r + dr * k) * cols + (c + dc * k)];
          if (v === player) mine++;
          else if (v === opp) theirs++;
        }
        if (mine && !theirs) score += weight(mine);
        else if (theirs && !mine) score -= weight(theirs) * 0.8;
      }
    }
  }
  return score;
}

const WIN = 100000;

function negamax(board, cfg, player, depth, alpha, beta) {
  const cols = byCentre(validCols(board, cfg), cfg);
  if (!cols.length) return 0; // a draw
  if (depth === 0) return evaluate(board, cfg, player);
  let best = -Infinity;
  for (const c of cols) {
    const d = drop(board, cfg, c, player);
    const score = winAt(d.board, cfg, d.index) ? WIN + depth : -negamax(d.board, cfg, other(player), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Search depth per board: the small board is cheap, so it looks a little further. */
export const depthFor = (cfg) => (cfg.cols * cfg.rows <= 20 ? 5 : 4);

/** The column the computer plays for `player` at `level`; -1 when the board is full. */
export function chooseMove(board, cfg, player, level, rand = Math.random) {
  const cols = validCols(board, cfg);
  if (!cols.length || isFull(board)) return -1;
  const wins = winningCols(board, cfg, player);
  const threats = winningCols(board, cfg, other(player));

  if (level <= 1) {
    if (wins.length && rand() < EASY_WIN) return wins[0];
    if (threats.length && rand() < EASY_BLOCK) return threats[0];
    return centreWeighted(cols, cfg, rand);
  }
  if (wins.length) return wins[0];
  if (threats.length) return threats[0];
  if (level === 2) {
    const safe = safeCols(board, cfg, player);
    return centreWeighted(safe.length ? safe : cols, cfg, rand);
  }
  // hard: look ahead; among equally good moves pick one at random so games differ
  const depth = depthFor(cfg);
  let best = -Infinity;
  let bestCols = [];
  for (const c of byCentre(cols, cfg)) {
    const d = drop(board, cfg, c, player);
    const score = -negamax(d.board, cfg, other(player), depth - 1, -Infinity, Infinity);
    if (score > best + 1e-9) {
      best = score;
      bestCols = [c];
    } else if (Math.abs(score - best) <= 1e-9) {
      bestCols.push(c);
    }
  }
  return bestCols[Math.floor(rand() * bestCols.length)];
}
