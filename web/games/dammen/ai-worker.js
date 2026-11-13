// Runs Dammen's computer player (ai.js) off the page, so the screen never freezes while the
// medium or hard computer thinks. One job at a time: { id, board, variant, player, level, seed }.
import { VARIANTS } from './rules.js';
import { chooseMove, mulberry32 } from './ai.js';

self.onmessage = (e) => {
  const { id, board, variant, player, level, seed } = e.data || {};
  try {
    const cfg = VARIANTS[variant];
    if (!cfg || !Array.isArray(board)) throw new Error('bad job');
    const move = chooseMove(board, cfg, player, level, mulberry32(seed));
    self.postMessage({ id, ok: true, move });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
