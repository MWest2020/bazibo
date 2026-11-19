// Runs the computer player (ai.js) off the page, so the screen never freezes while the medium or
// hard computer thinks. One job at a time: { id, fen, keys, level, seed }. The page talks to it
// through Dammen's think.js (timeouts, errors and cancelling).
import { fromFen } from './rules.js';
import { chooseMove, mulberry32 } from './ai.js';

self.onmessage = (e) => {
  const { id, fen, keys, level, seed } = e.data || {};
  try {
    const pos = fromFen(fen);
    const seen = Array.isArray(keys) ? keys.filter((k) => typeof k === 'string').slice(-120) : [];
    const m = chooseMove(pos, level, mulberry32(seed), { keys: seen });
    self.postMessage({ id, ok: true, move: m && { from: m.from, to: m.to, promo: m.promo } });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
