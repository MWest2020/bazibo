// Memory's rules, pure so they can be tested and used by the screen and the computer player.
//   - the cards lie face down in a grid; a turn is two cards turned over
//   - the same picture twice: a pair. It stays face up, counts for whoever found it, and that
//     player turns two more (the classic rule)
//   - two different pictures: they are shown for a moment and turned back (`hide`), and with two
//     players the turn passes
//   - when every pair is found the game is over; most pairs wins (with two players a draw is
//     possible). Alone, the stars count the turns (`starsFor`); there is no clock.

/** The boards: cols × rows with cols ≥ rows (the screen turns the grid to fit, `bestGrid`). */
export const SIZES = Object.freeze({
  '2x3': Object.freeze({ cols: 3, rows: 2, age: 3 }),
  '3x4': Object.freeze({ cols: 4, rows: 3, age: 4 }),
  '4x4': Object.freeze({ cols: 4, rows: 4, age: 5 }),
  '4x5': Object.freeze({ cols: 5, rows: 4, age: 6 }),
});
export const SIZE_IDS = Object.freeze(Object.keys(SIZES));
export const pairsOf = (size) => (SIZES[size].cols * SIZES[size].rows) / 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy (Fisher-Yates). */
export function shuffle(list, rand = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A new game: `pairs` pictures picked at random from `faces` (the theme's picture ids), each
 * twice, shuffled. `players`: 1 (alone) or 2 (together, or a child against the computer);
 * `starter`: who turns first (0 or 1).
 */
export function newGame({ size, faces, players = 1, starter = 0, rand = Math.random }) {
  const cfg = SIZES[size];
  if (!cfg) throw new Error(`unknown size ${size}`);
  const pairs = pairsOf(size);
  if (!Array.isArray(faces) || new Set(faces).size < pairs) throw new Error(`a ${size} board needs ${pairs} different pictures`);
  if (players !== 1 && players !== 2) throw new Error('one or two players');
  const picked = shuffle([...new Set(faces)], rand).slice(0, pairs);
  const deck = shuffle([...picked, ...picked], rand);
  return {
    size,
    cols: cfg.cols,
    rows: cfg.rows,
    players,
    cards: deck.map((face) => ({ face, up: false, found: false, by: -1 })),
    turn: players === 2 && starter === 1 ? 1 : 0,
    open: [], // the cards turned over this turn (0, 1 or 2; two only after a miss, until `hide`)
    scores: players === 2 ? [0, 0] : [0],
    turns: 0, // turns taken (two cards each), by all players
    over: null, // { winners: [player, ...] } when every pair is found
  };
}

const clone = (g) => ({ ...g, cards: g.cards.map((c) => ({ ...c })), open: g.open.slice(), scores: g.scores.slice() });

/** May card i be turned over now? */
export function canFlip(g, i) {
  const c = g.cards[i];
  return !!c && !g.over && g.open.length < 2 && !c.up && !c.found;
}

/** Waiting for `hide` after two different pictures? */
export const mustHide = (g) => g.open.length === 2;

/**
 * Turn card i over. Returns { game, result } with result 'first' (one card up), 'pair' (a pair,
 * the same player goes on), 'miss' (two different pictures: call `hide` next), 'over' (the last
 * pair), or null when the card cannot be turned (the game is unchanged).
 */
export function flip(g, i) {
  if (!canFlip(g, i)) return { game: g, result: null };
  const n = clone(g);
  n.cards[i].up = true;
  n.open.push(i);
  if (n.open.length === 1) return { game: n, result: 'first' };
  n.turns++;
  const [a, b] = n.open;
  if (n.cards[a].face !== n.cards[b].face) return { game: n, result: 'miss' };
  for (const k of [a, b]) Object.assign(n.cards[k], { found: true, by: n.turn });
  n.scores[n.turn]++;
  n.open = [];
  if (n.cards.every((c) => c.found)) {
    n.over = { winners: winners(n.scores) };
    return { game: n, result: 'over' };
  }
  return { game: n, result: 'pair' };
}

/** After a miss: turn both cards back; with two players the other one goes next. */
export function hide(g) {
  if (!mustHide(g)) return g;
  const n = clone(g);
  for (const k of n.open) n.cards[k].up = false;
  n.open = [];
  if (n.players === 2) n.turn = 1 - n.turn;
  return n;
}

/** Who has the most pairs (two players with the same score: both, a draw). */
export function winners(scores) {
  const best = Math.max(...scores);
  return scores.flatMap((s, p) => (s === best ? [p] : []));
}

/** Alone: 3 stars within 2 turns a pair, 2 within 3 turns a pair, otherwise 1. Never a clock. */
export function starsFor(turns, pairs) {
  if (turns <= pairs * 2) return 3;
  if (turns <= pairs * 3) return 2;
  return 1;
}

/**
 * The biggest square cards for a cols × rows board in a w × h box: the grid may be turned (rows
 * and columns swapped), so a sideways phone gets wide rows. `gap` is a part of a card.
 * Returns { cols, rows, cell }.
 */
export function bestGrid(cols, rows, w, h, gap = 0.12) {
  const fit = (c, r) => Math.floor(Math.min(w / (c + (c - 1) * gap), h / (r + (r - 1) * gap)));
  const a = fit(cols, rows);
  const b = fit(rows, cols);
  return b > a ? { cols: rows, rows: cols, cell: b } : { cols, rows, cell: a };
}
