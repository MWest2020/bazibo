// Kwartet's computer players: gentle, and readable. A computer only uses what everyone at the
// table could know (who asked for what, who gave what, who said no), never the hidden cards, and it
// remembers each of those things only now and then (`KEEP`). When it remembers who has a card it
// needs it usually asks for that card (`USE`); otherwise it asks a random player for a random card
// it may ask for. Pure (the random source is passed in), so the tests can seed it.

import { askable, opponents, setOf } from './rules.js';

export const KEEP = 0.6; // the chance it remembers something it saw at the table
export const USE = 0.75; // the chance it uses what it remembers

/** An empty memory: who holds a card (card -> player), and who does not (player -> [cards]). */
export const emptyMemory = () => ({ holds: {}, lacks: {} });

const forget = (m, card) => {
  const n = { holds: { ...m.holds }, lacks: { ...m.lacks } };
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

/** A kwartet was laid down: its cards are out of the game. */
export function laidDown(memory, set) {
  const m = { holds: {}, lacks: {} };
  for (const [c, p] of Object.entries(memory.holds)) if (setOf(c) !== set) m.holds[c] = p;
  for (const [p, list] of Object.entries(memory.lacks)) m.lacks[p] = list.filter((c) => setOf(c) !== set);
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
  // otherwise a guess, but not someone it remembers saying no to that very card
  const card = pick(cards, rand);
  const maybe = others.filter((p) => !(memory.lacks[p] || []).includes(card));
  return { target: pick(maybe.length ? maybe : others, rand), card };
}
