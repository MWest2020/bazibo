// Kwartet's computer players: gentle, and readable. A computer only uses what everyone at the
// table could know (who asked for what, who gave what, who said no, who drew the very card they
// asked for), never the hidden cards or the pile, and it remembers each of those things only now
// and then (`KEEP`). When it remembers who has a card it needs it usually asks for that card
// (`USE`). Next, a player who asked for a card of a set holds a card of that set: it usually asks
// that player for another card of it (`HINT`). Otherwise it asks a random player for a random card
// it may ask for, not one it remembers that player saying no to. Pure (the random source is passed
// in), so the tests can seed it.

import { askable, opponents, setOf } from './rules.js';

export const KEEP = 0.6; // the chance it remembers something it saw at the table
export const USE = 0.75; // the chance it uses what it remembers
export const HINT = 0.4; // the chance it follows up on what someone asked for (kept low: gentle)

/**
 * An empty memory: who holds a card (card -> player), who does not (player -> [cards]), and who
 * asked for what (player -> [cards]: that player holds another card of that set).
 */
export const emptyMemory = () => ({ holds: {}, lacks: {}, asked: {} });

const forget = (m, card) => {
  const n = { holds: { ...m.holds }, lacks: { ...m.lacks }, asked: { ...(m.asked || {}) } };
  delete n.holds[card];
  return n;
};

/**
 * What the table saw: `asker` asked `target` for `card`, and got it or not. Every computer keeps
 * its own memory; each fact sticks only with chance `keep`.
 */
export function observe(memory, { asker, target, card, got }, rand = Math.random, keep = KEEP) {
  let m = forget(memory, card);
  const lack = (p, c) => {
    if (rand() < keep) m.lacks[p] = [...new Set([...(m.lacks[p] || []), c])];
  };
  // whoever asks holds a card of that set (and gave away nothing of it by asking)
  if (rand() < keep) m.asked[asker] = [...new Set([...(m.asked[asker] || []).filter((c) => c !== card), card])];
  // a player who gives a card away may have given the last of that set
  if (got && m.asked[target]) m.asked[target] = m.asked[target].filter((c) => setOf(c) !== setOf(card));
  // the asker holds a card of that set; it did not have this card (or it does now)
  if (got) {
    if (rand() < keep) m.holds[card] = asker;
  } else {
    lack(asker, card);
    lack(target, card);
  }
  // a card that moved is no longer missing from its new owner
  if (got && m.lacks[asker]) m.lacks[asker] = m.lacks[asker].filter((c) => c !== card);
  return m;
}

/**
 * After a "no" the asker took a card from the pile. Nobody else sees which, except when it was the
 * very card asked for: then the asker shows it and asks again (`lucky`).
 */
export function drew(memory, { player, card, lucky }, rand = Math.random, keep = KEEP) {
  if (!lucky) return memory;
  const m = forget(memory, card);
  if (rand() < keep) m.holds[card] = player;
  if (m.lacks[player]) m.lacks[player] = m.lacks[player].filter((c) => c !== card);
  return m;
}

/** A kwartet was laid down: its cards are out of the game. */
export function laidDown(memory, set) {
  const m = { holds: {}, lacks: {}, asked: {} };
  for (const [c, p] of Object.entries(memory.holds)) if (setOf(c) !== set) m.holds[c] = p;
  for (const [p, list] of Object.entries(memory.lacks)) m.lacks[p] = list.filter((c) => setOf(c) !== set);
  for (const [p, list] of Object.entries(memory.asked || {})) m.asked[p] = list.filter((c) => setOf(c) !== set);
  return m;
}

const pick = (list, rand) => list[Math.floor(rand() * list.length)];

/** The computer `me` (whose turn it is) chooses { target, card }; null when it cannot ask. */
export function choose(g, me, memory, rand = Math.random, use = USE) {
  const cards = askable(g, me);
  const others = opponents(g, me);
  if (!cards.length || !others.length) return null;
  // a card it remembers someone has
  const known = cards.filter((c) => others.includes(memory.holds[c]));
  if (known.length && rand() < use) {
    const card = pick(known, rand);
    return { target: memory.holds[card], card };
  }
  const lacks = (p, c) => (memory.lacks[p] || []).includes(c);
  // someone asked for a card of a set it holds too: that player has another card of it
  const hinted = others.flatMap((p) =>
    cards.filter((c) => !lacks(p, c) && (memory.asked?.[p] || []).some((a) => a !== c && setOf(a) === setOf(c))).map((card) => ({ target: p, card })),
  );
  if (hinted.length && rand() < Math.min(use, HINT)) return pick(hinted, rand);
  // otherwise a guess, but not someone it remembers saying no to that very card (and, when it can,
  // not a card everyone it could ask said no to)
  const open = cards.filter((c) => others.some((p) => !lacks(p, c)));
  const card = pick(open.length ? open : cards, rand);
  const maybe = others.filter((p) => !lacks(p, card));
  return { target: pick(maybe.length ? maybe : others, rand), card };
}
