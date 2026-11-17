// Kwartet's rules, pure so they can be tested and used by the screen and the computer players.
// The Dutch quartets game, made clear for young children:
//   - sets of 4 cards, dealt one by one, starting with the player who begins. With 3 or 4 players
//     every card is dealt. With 2 players (where asking would always get a yes) each gets
//     `handSize` cards and the rest lies face down as the pile (de pot / de stapel)
//   - on your turn you ask one other player (who still has cards) for one card of a set you hold
//     at least one card of, and that you do not have yourself
//   - they have it: they give it to you and you ask again; they do not: with a pile you take its
//     top card (`draw`; if that is the very card you asked for, you may ask again), then the turn
//     passes to the next player (in order round the table, so every child knows who is next).
//     An empty pile: the turn simply passes
//   - 4 cards of a set in one hand are laid down at once as a kwartet (also straight after the deal)
//   - a player whose hand runs empty takes a card from the pile at once; with no pile left, that
//     player sits out. When every set is laid down the game is over, and the player with the most
//     kwartetten wins (the same number: they share the win)
// A card is '<set>:<k>' with k 0-3; the screen and art.js give it a picture and a name.

export const PER_SET = 4;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

/** Only two players play with a pile; with three or more every card is dealt. */
export const usesPile = (players) => players === 2;
/**
 * The hand of each of two players: 5 cards with 4 sets, 6 with 6, 7 with 8. That leaves a pile at
 * least as big as a hand (6, 12 and 18 cards), so a "no" is common and drawing matters, while a
 * hand stays small enough to see whole on a small phone and to hold a set or two to ask for.
 * (Small test decks keep at least two cards on the pile.)
 */
export const handSize = (sets) => Math.min(3 + Math.floor(sets / 2), 7, Math.floor((sets * PER_SET - 2) / 2));

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

const clone = (g) => ({ ...g, hands: g.hands.map((h) => h.slice()), quartets: g.quartets.map((q) => q.slice()), pile: (g.pile || []).slice() });
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

/** Player p's hand ran empty: take the top card of the pile, if there is one (mutates `g`). */
function refill(g, p) {
  if (g.hands[p].length || !g.pile.length) return null;
  const card = g.pile[0];
  g.pile = g.pile.slice(1);
  g.hands[p] = [card];
  return { player: p, card };
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
 * the first card. Two players get `handSize` cards each and the rest is the pile (`pile`, top card
 * first); three or four share every card and the pile is empty. Complete sets after the deal are
 * laid down at once. `drawing` is the card asked for while the asker still has to draw (else null).
 */
export function newGame({ sets, players, starter = 0, rand = Math.random }) {
  if (!Array.isArray(sets) || sets.length < 2 || new Set(sets).size !== sets.length) throw new Error('at least two different sets');
  if (!(players >= MIN_PLAYERS && players <= MAX_PLAYERS)) throw new Error(`${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  const g = { sets: sets.slice(), players, hands: Array.from({ length: players }, () => []), quartets: Array.from({ length: players }, () => []), pile: [], drawing: null, turn: starter % players, over: null };
  const deck = shuffle(sets.flatMap(cardsOf), rand);
  const dealt = usesPile(players) ? handSize(sets.length) * players : deck.length;
  deck.slice(0, dealt).forEach((card, i) => g.hands[(g.turn + i) % players].push(card));
  g.pile = deck.slice(dealt);
  for (let p = 0; p < players; p++) {
    g.hands[p].sort(ORDER);
    layDown(g, p);
    refill(g, p);
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
  if (g.over || g.drawing) return false;
  return opponents(g, g.turn).includes(target) && askable(g, g.turn).includes(card);
}

/**
 * The player whose turn it is asks `target` for `card`. Returns { game, got, laid, draw, refills }
 * (laid: the set laid down as a kwartet, or null; draw: true when the answer was no and the asker
 * now has to take a card from the pile with `draw`, the turn waiting until then; refills: the
 * players whose hand ran empty and who took a card from the pile, as { player, card }), or null
 * when the ask is not allowed.
 */
export function ask(g, target, card) {
  if (!canAsk(g, target, card)) return null;
  const n = clone(g);
  const asker = n.turn;
  const got = n.hands[target].includes(card);
  let laid = null;
  const refills = [];
  if (got) {
    n.hands[target] = n.hands[target].filter((c) => c !== card);
    n.hands[asker] = [...n.hands[asker], card].sort(ORDER);
    laid = layDown(n, asker)[0] || null;
    for (const p of [target, asker]) {
      const r = refill(n, p);
      if (r) refills.push(r);
    }
  } else if (n.pile.length) {
    n.drawing = card; // "no": take a card from the pile first
    return { game: n, got, laid, draw: true, refills };
  }
  finishIfDone(n);
  // asking again needs cards; a "no" passes the turn round the table
  if (!n.over && (!got || !n.hands[asker].length)) n.turn = nextPlayer(n, asker);
  return { game: n, got, laid, draw: false, refills };
}

/** May the player whose turn it is take a card from the pile now (after a "no")? */
export const canDraw = (g) => !g.over && !!g.drawing && g.pile.length > 0;

/**
 * After a "no": the asker takes the top card of the pile. Returns { game, card, lucky, laid,
 * refills }: lucky when it is the very card that was asked for (then the asker asks again, the
 * house rule most Dutch families play), laid when it completes a set. Null when there is nothing
 * to draw.
 */
export function draw(g) {
  if (!canDraw(g)) return null;
  const n = clone(g);
  const p = n.turn;
  const card = n.pile[0];
  const lucky = card === n.drawing;
  n.pile = n.pile.slice(1);
  n.drawing = null;
  n.hands[p] = [...n.hands[p], card].sort(ORDER);
  const laid = layDown(n, p)[0] || null;
  const refills = [];
  const r = refill(n, p);
  if (r) refills.push(r);
  finishIfDone(n);
  if (!n.over && (!lucky || !n.hands[p].length)) n.turn = nextPlayer(n, p);
  return { game: n, card, lucky, laid, refills };
}

/** Who has the most kwartetten (the same number: all of them). */
export function winners(g) {
  const counts = g.quartets.map((q) => q.length);
  const best = Math.max(...counts);
  return counts.flatMap((n, p) => (n === best ? [p] : []));
}
