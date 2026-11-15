// Memory's computer player: gentle, so a child who pays attention beats it most of the time.
// It plays like a forgetful child: of every card it sees turned over (by anyone) it remembers the
// picture only now and then (`KEEP`), and at the start of each of its turns some of what it
// remembered fades (`FORGET`). It only uses what it remembers; otherwise it guesses among the
// cards it does not know. Pure (the random source is passed in), so the tests can seed it.

import { canFlip } from './rules.js';

export const KEEP = 0.35; // the chance it remembers a card it saw
export const FORGET = 0.3; // the chance a remembered card fades, at the start of its turn
export const TAKE_KNOWN = 0.7; // the chance it goes for a pair it knows, instead of guessing

/** An empty memory: card index -> picture. */
export const emptyMemory = () => ({});

/** A card was seen face up: maybe remember it. Found cards are forgotten (they are out). */
export function observe(memory, g, i, rand = Math.random, keep = KEEP) {
  const m = { ...memory };
  const c = g.cards[i];
  if (!c) return m;
  if (c.found) {
    delete m[i];
    return m;
  }
  if (rand() < keep) m[i] = c.face;
  return m;
}

/** Forget the cards that are out of the game, and let some of the rest fade. */
export function fade(memory, g, rand = Math.random, forget = FORGET) {
  const m = {};
  for (const [k, face] of Object.entries(memory)) {
    const i = Number(k);
    if (g.cards[i] && !g.cards[i].found && rand() >= forget) m[i] = face;
  }
  return m;
}

const pick = (list, rand) => list[Math.floor(rand() * list.length)];

/** The card the computer turns over next (the first or the second of its turn); -1 if none can. */
export function choose(g, memory, rand = Math.random, takeKnown = TAKE_KNOWN) {
  const open = g.cards.flatMap((c, i) => (canFlip(g, i) ? [i] : []));
  if (!open.length) return -1;
  const known = Object.entries(memory)
    .map(([k, face]) => [Number(k), face])
    .filter(([i]) => canFlip(g, i));
  const unknown = open.filter((i) => !(i in memory));
  if (g.open.length === 1) {
    // the second card: the match, if it remembers where it is
    const face = g.cards[g.open[0]].face;
    const match = known.find(([, f]) => f === face);
    if (match) return match[0];
    return pick(unknown.length ? unknown : open, rand);
  }
  // the first card: a pair it knows, sometimes; otherwise a card it does not know
  const byFace = {};
  for (const [i, f] of known) (byFace[f] ||= []).push(i);
  const pair = Object.values(byFace).find((list) => list.length >= 2);
  if (pair && rand() < takeKnown) return pair[0];
  return pick(unknown.length ? unknown : open, rand);
}
