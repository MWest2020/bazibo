// Runs the computer player (ai.js) off the page, so the screen never freezes while the medium or
// hard computer thinks. One job at a time: { id, board, toPlace, captured, player, level, seed }.
// The page talks to it through Dammen's think.js (timeouts, errors and cancelling).
import { POINTS } from './rules.js';
import { chooseMove, mulberry32 } from './ai.js';

self.onmessage = (e) => {
  const { id, board, toPlace, captured, player, level, seed } = e.data || {};
  try {
    if (!Array.isArray(board) || board.length !== POINTS) throw new Error('bad job');
    const move = chooseMove({ board, toPlace: Number(toPlace) || 0, captured: Number(captured) || 0 }, player, level, mulberry32(seed));
    self.postMessage({ id, ok: true, move });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
