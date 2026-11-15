// Kwartet's rules, pure so they can be tested and used by the screen and the computer players.
// The Dutch quartets game, made clear for young children:
//   - sets of 4 cards; all cards are dealt, one by one, starting with the player who begins
//   - on your turn you ask one other player (who still has cards) for one card of a set you hold
//     at least one card of, and that you do not have yourself
//   - they have it: they give it to you and you ask again; they do not: the turn passes to the
//     next player (in order round the table, so every child knows who is next)
//   - 4 cards of a set in one hand are laid down at once as a kwartet (also straight after the deal)
//   - a player without cards sits out; when every set is laid down the game is over, and the
//     player with the most kwartetten wins (the same number: they share the win)
// A card is '<set>:<k>' with k 0-3; the screen and art.js give it a picture and a name.

export const PER_SET = 4;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export const setOf = (card) => card.slice(0, card.lastIndexOf(':'));
export const cardsOf = (set) => Array.from({ length: PER_SET }, (_, k) => `${set}:${k}`);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rand = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const clone = (g) => ({ ...g, hands: g.hands.map((h) => h.slice()), quartets: g.quartets.map((q) => q.slice()) });
const ORDER = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Lay down every complete set in player p's hand (mutates the clone `g`); returns the sets laid. */
function layDown(g, p) {
  const laid = [];
  for (const set of g.sets) {
    const mine = g.hands[p].filter((c) => setOf(c) === set);
    if (mine.length === PER_SET) {
      g.hands[p] = g.hands[p].filter((c) => setOf(c) !== set);
      g.quartets[p].push(set);
      laid.push(set);
    }
  }
  return laid;
}

/** The next player after `from` (round the table) who still has cards; -1 when nobody has. */
export function nextPlayer(g, from) {
  for (let step = 1; step <= g.players; step++) {
    const p = (from + step) % g.players;
    if (g.hands[p].length) return p;
  }
  return -1;
}

const finishIfDone = (g) => {
  if (g.quartets.flat().length === g.sets.length) g.over = { winners: winners(g) };
  return g;
};

/**
 * A new game: `sets` (set ids, at least 2), `players` (2-4), `starter` who begins and is dealt
 * the first card. Complete sets after the deal are laid down at once.
 */
export function newGame({ sets, players, starter = 0, rand = Math.random }) {
  if (!Array.isArray(sets) || sets.length < 2 || new Set(sets).size !== sets.length) throw new Error('at least two different sets');
  if (!(players >= MIN_PLAYERS && players <= MAX_PLAYERS)) throw new Error(`${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  const g = { sets: sets.slice(), players, hands: Array.from({ length: players }, () => []), quartets: Array.from({ length: players }, () => []), turn: starter % players, over: null };
  shuffle(sets.flatMap(cardsOf), rand).forEach((card, i) => g.hands[(g.turn + i) % players].push(card));
  for (let p = 0; p < players; p++) {
    g.hands[p].sort(ORDER);
    layDown(g, p);
  }
  finishIfDone(g);
  if (!g.over && !g.hands[g.turn].length) g.turn = nextPlayer(g, g.turn);
  return g;
}

/** The sets player p holds at least one card of. */
export const setsHeld = (g, p) => g.sets.filter((s) => g.hands[p].some((c) => setOf(c) === s));

/** The cards player p may ask for: the missing cards of the sets p holds. */
export function askable(g, p) {
  const hand = new Set(g.hands[p]);
  return setsHeld(g, p).flatMap((s) => cardsOf(s).filter((c) => !hand.has(c)));
}

/** The players p may ask: everyone else who still has cards. */
export const opponents = (g, p) => g.hands.flatMap((h, q) => (q !== p && h.length ? [q] : []));

/** Is this ask allowed for the player whose turn it is? */
export function canAsk(g, target, card) {
  if (g.over) return false;
  return opponents(g, g.turn).includes(target) && askable(g, g.turn).includes(card);
}

/**
 * The player whose turn it is asks `target` for `card`. Returns { game, got, laid } (laid: the
 * set laid down as a kwartet, or null), or null when the ask is not allowed.
 */
export function ask(g, target, card) {
  if (!canAsk(g, target, card)) return null;
  const n = clone(g);
  const asker = n.turn;
  const got = n.hands[target].includes(card);
  let laid = null;
  if (got) {
    n.hands[target] = n.hands[target].filter((c) => c !== card);
    n.hands[asker] = [...n.hands[asker], card].sort(ORDER);
    laid = layDown(n, asker)[0] || null;
  }
  finishIfDone(n);
  // asking again needs cards; a "no" passes the turn round the table
  if (!n.over && (!got || !n.hands[asker].length)) n.turn = nextPlayer(n, asker);
  return { game: n, got, laid };
}

/** Who has the most kwartetten (the same number: all of them). */
export function winners(g) {
  const counts = g.quartets.map((q) => q.length);
  const best = Math.max(...counts);
  return counts.flatMap((n, p) => (n === best ? [p] : []));
}
