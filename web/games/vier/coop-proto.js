// Vier op een rij on two phones (spike): what travels over the data channel once the phones are
// connected, and how a phone judges what the other one sends. Pure, so it can be tested.
//
// Both phones keep the whole game and play every move through the same rules (rules.js). Only
// moves travel, never a board or a result, so a phone that cheats or sends garbage cannot change
// the game on the other phone: a message is checked for its shape first (`parseMessage`), then a
// move against the rules and the turn (`judgeMove`). Anything else is ignored; a flood or a run of
// bad messages closes the connection (`createGuard`).
//   { t: 'm', n, c }   a move: the n-th move of this game (0 = the first), dropped in column c
//   { t: 'again', g }  start game number g (the next one); either phone may ask
//   { t: 'bye' }       the other phone leaves (the connection closes right after)
import { landingRow } from './rules.js';

export const MAX_MESSAGE = 64; // characters; a move is about 20
export const BAD_LIMIT = 10; // bad messages before the connection is closed
export const RATE_LIMIT = 20; // messages per RATE_WINDOW before the connection is closed
export const RATE_WINDOW = 1000; // ms
export const MAX_GAMES = 9999;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const keysAre = (o, keys) => {
  const k = Object.keys(o);
  return k.length === keys.length && keys.every((x) => Object.hasOwn(o, x));
};

/** Raw data from the channel -> a message with a known shape, or null. Never throws. */
export function parseMessage(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE) return null; // binary data too
  let o;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(o)) return null;
  if (o.t === 'm' && keysAre(o, ['t', 'n', 'c']) && isInt(o.n, 0, 99) && isInt(o.c, 0, 15)) return { t: 'm', n: o.n, c: o.c };
  if (o.t === 'again' && keysAre(o, ['t', 'g']) && isInt(o.g, 2, MAX_GAMES)) return { t: 'again', g: o.g };
  if (o.t === 'bye' && keysAre(o, ['t'])) return { t: 'bye' };
  return null;
}

export const moveMessage = (n, c) => JSON.stringify({ t: 'm', n, c });
export const againMessage = (g) => JSON.stringify({ t: 'again', g });
export const BYE = JSON.stringify({ t: 'bye' });

/**
 * May the other phone (`from`, 1 or 2) make this move now? `view`: { cfg, board, turn, over,
 * moves } (moves: how many were played this game). Answers 'ok' or why not: 'over', 'turn',
 * 'seq' (not the next move: a repeat or a skip), 'col' (no such column), 'full'.
 */
export function judgeMove(view, msg, from) {
  if (view.over) return 'over';
  if (view.turn !== from) return 'turn';
  if (msg.n !== view.moves) return 'seq';
  if (msg.c >= view.cfg.cols) return 'col';
  if (landingRow(view.board, view.cfg, msg.c) < 0) return 'full';
  return 'ok';
}

/**
 * May the other phone start game `msg.g` now? Only the next game, and only once this one is over.
 * 'ok', 'stale' (we started it already: both tapped "again"), 'early' (this game is not over) or
 * 'skip' (not the next number).
 */
export function judgeAgain(view, msg) {
  if (msg.g === view.game) return 'stale';
  if (msg.g !== view.game + 1) return 'skip';
  if (!view.over) return 'early';
  return 'ok';
}

/** Who starts game number g: the phone that showed the first code (1) the odd games, the other the even. */
export const starterFor = (g) => (g % 2 === 1 ? 1 : 2);

/**
 * Counts what comes in. `take(now)` for every message (a flood closes the connection), `bad()` for
 * every message that was not allowed (a run of them closes it). Both answer 'ok' or 'close'.
 */
export function createGuard() {
  let bad = 0;
  let windowStart = -Infinity;
  let inWindow = 0;
  return {
    take(now) {
      if (now - windowStart >= RATE_WINDOW) {
        windowStart = now;
        inWindow = 0;
      }
      inWindow++;
      return inWindow > RATE_LIMIT ? 'close' : 'ok';
    },
    bad() {
      bad++;
      return bad >= BAD_LIMIT ? 'close' : 'ok';
    },
  };
}
