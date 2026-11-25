// Keukentje: the rounds and what a tap means, pure (no DOM, no sound) so the tests can play them.
// Harder by what the child must know, never by speed:
//   t1 (3-5)   "Wat hoort erbij?": a dish with two or three empty bowls; tap what goes in from six
//              pictures (the others plainly from other dishes)
//   t2 (6-7)   every ingredient of a bigger dish from eight pictures, with look-alikes (sugar next
//              to salt, yoghurt next to milk), and "which dish can you make with these?" (one of 3)
//   t3 (8-10)  where an ingredient comes from, the steps of a simple recipe in order, and the odd
//              one out
// A wrong tap is never "wrong": it bounces back with a short line (the dish it belongs to, the
// ingredient the picked dish lacks, what the picked source gives). After MAX_TRIES the answer glows.
import { DISHES, DISH_IDS, INGREDIENT_IDS, LOOKALIKES, lookalikesOf, ORIGINS, ORIGIN_IDS, GROUPS, GROUP_IDS, RECIPES, RECIPE_IDS } from './dishes.js';

export const TIER_IDS = Object.freeze(['t1', 't2', 't3']);
export const TIERS = Object.freeze({
  t1: Object.freeze({ age: '3-5', options: 6 }),
  t2: Object.freeze({ age: '6-7', options: 8 }),
  t3: Object.freeze({ age: '8-10', options: 4 }),
});
export const ROUNDS_PER_TIER = 3;
export const ROUND_LEN = 6;
export const MAX_TRIES = 2; // wrong taps on one question before the answer glows
/** The kinds of question in a round of each tier (in this order, shuffled per round). */
export const KINDS = Object.freeze({
  t1: Object.freeze(['fill', 'fill', 'fill', 'fill', 'fill', 'fill']),
  t2: Object.freeze(['fill', 'fill', 'fill', 'which', 'which', 'which']),
  t3: Object.freeze(['from', 'from', 'steps', 'steps', 'odd', 'odd']),
});
/** Dishes for a 6-7 fill: the ones with four ingredients or more ("more ingredients per dish"). */
export const BIG_DISHES = Object.freeze(DISH_IDS.filter((d) => DISHES[d].need.length >= 4));
/** Options in a "which dish?" question and in a "where from?" question. */
export const WHICH_OPTIONS = 3;
export const FROM_OPTIONS = 3;

/** Stars by mistakes (questions with a wrong tap): none 3, one or two 2, more 1. Never time. */
export const starsFor = (mistakes) => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);

export function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Everything that may be in a dish: what it needs and what is often in it. */
export const inDish = (d) => new Set([...DISHES[d].need, ...DISHES[d].maybe]);

/**
 * The dish a wrong ingredient belongs to, for "Dat hoort bij de pizza!": one it is known by first,
 * then one it is needed in, then one it may go on (ham: the tosti).
 */
export function belongsTo(ing, except = null) {
  for (const field of ['key', 'need', 'maybe']) {
    for (const d of DISH_IDS) if (d !== except && DISHES[d][field].includes(ing)) return d;
  }
  return null;
}

/** For a picked dish that is not the answer: the first shown ingredient that is not in it. */
export function missingIn(d, shown) {
  const has = inDish(d);
  return shown.find((i) => !has.has(i)) ?? null;
}

// ---------- making questions ----------

/** Ingredients a dish of the 3-5 rounds may show next to its own: plainly from another dish. */
function clearOthers(d, right) {
  const has = inDish(d);
  const near = new Set(right.flatMap(lookalikesOf));
  const known = new Set(DISH_IDS.filter((o) => o !== d).flatMap((o) => DISHES[o].key));
  return INGREDIENT_IDS.filter((i) => i !== d && !has.has(i) && !near.has(i) && known.has(i));
}

export function fillQuestion(d, tier, rand) {
  const right = tier === 't1' ? [...DISHES[d].key] : [...DISHES[d].need];
  const has = inDish(d);
  const want = TIERS[tier].options - right.length;
  let wrong;
  if (tier === 't1') {
    wrong = shuffle(clearOthers(d, right), rand).slice(0, want);
  } else {
    // one or two look-alikes of what goes in (never something that is in it), then the rest
    const near = shuffle([...new Set(right.flatMap(lookalikesOf))].filter((i) => !has.has(i)), rand).slice(0, want >= 4 ? 2 : 1);
    const rest = shuffle(INGREDIENT_IDS.filter((i) => i !== d && !has.has(i) && !near.includes(i)), rand).slice(0, want - near.length);
    wrong = [...near, ...rest];
  }
  return { kind: 'fill', dish: d, need: right, options: shuffle([...right, ...wrong], rand) };
}

export function whichQuestion(d, rand) {
  const shown = [...DISHES[d].need];
  // the other dishes must lack at least one shown ingredient; ones that share something come first
  const fits = DISH_IDS.filter((o) => o !== d && missingIn(o, shown));
  const share = shuffle(fits.filter((o) => DISHES[o].need.some((i) => shown.includes(i))), rand);
  const other = shuffle(fits.filter((o) => !share.includes(o)), rand);
  const pick = [...share.slice(0, 1), ...other, ...share.slice(1)].slice(0, WHICH_OPTIONS - 1);
  return { kind: 'which', dish: d, shown, answer: d, options: shuffle([d, ...pick], rand) };
}

export function fromQuestion(ing, rand) {
  const o = ORIGINS[ing];
  const wrong = shuffle(o.not, rand).slice(0, FROM_OPTIONS - 1);
  return { kind: 'from', ing, answer: o.src, options: shuffle([o.src, ...wrong], rand) };
}

export function stepsQuestion(recipe, rand) {
  const steps = RECIPES[recipe].map((_, k) => `${recipe}.${k + 1}`);
  let options = shuffle(steps, rand);
  // never already in order (then there would be nothing to do)
  for (let k = 0; k < 8 && options.every((s, i) => s === steps[i]); k++) options = shuffle(steps, rand);
  if (options.every((s, i) => s === steps[i])) options = [...steps.slice(1), steps[0]];
  return { kind: 'steps', dish: recipe, steps, options };
}

export function oddQuestion(group, rand) {
  const g = GROUPS[group];
  const three = shuffle(g.members, rand).slice(0, 3);
  const odd = shuffle(g.odd, rand)[0];
  return { kind: 'odd', group, answer: odd, options: shuffle([...three, odd], rand) };
}

/** What each kind of question is about, per tier (the menu's rounds walk these in a fixed order). */
function pools(tier) {
  if (tier === 't1') return { fill: DISH_IDS, which: [], from: [], steps: [], odd: [] };
  if (tier === 't2') return { fill: BIG_DISHES, which: DISH_IDS, from: [], steps: [], odd: [] };
  return { fill: [], which: [], from: ORIGIN_IDS, steps: RECIPE_IDS, odd: GROUP_IDS };
}

/**
 * A round of ROUND_LEN questions. `round` 1..ROUNDS_PER_TIER is a round from the menu: its topics
 * come in turn from one fixed order per tier, so the three rounds together show (nearly) every
 * dish; `round` 0 is a random round (the full version). Never the same topic twice in a round, and
 * a "which dish?" never asks a dish that a fill in the same round just made.
 */
export function makeRound({ tier, seed, round = 0 }) {
  if (!TIERS[tier]) throw new Error(`no tier ${tier}`);
  const rand = rng(seed);
  const kinds = shuffle(KINDS[tier], rand);
  const pool = pools(tier);
  const order = {};
  for (const [kind, list] of Object.entries(pool)) {
    const want = kinds.filter((k) => k === kind).length;
    if (!want) continue;
    const base = round > 0 ? shuffle(list, rng(hashSeed(`keuken:${tier}:${kind}`))) : shuffle(list, rand);
    const at = round > 0 ? ((round - 1) * want) % base.length : 0;
    order[kind] = [...base.slice(at), ...base.slice(0, at)];
  }
  const used = new Set();
  const out = [];
  for (const kind of kinds) {
    const topic = order[kind].find((x) => !used.has(x)) ?? order[kind][0];
    used.add(topic);
    if (kind === 'fill') out.push(fillQuestion(topic, tier, rand));
    else if (kind === 'which') out.push(whichQuestion(topic, rand));
    else if (kind === 'from') out.push(fromQuestion(topic, rand));
    else if (kind === 'steps') out.push(stepsQuestion(topic, rand));
    else out.push(oddQuestion(topic, rand));
  }
  return out;
}

// ---------- what a tap means ----------

/** A question's start: nothing placed yet. */
export const startState = () => ({ placed: [] });

/**
 * A tap on an option. Returns
 *   { ok: true, st, done }          it goes in (fill: into a bowl; steps: the next step; else the answer)
 *   { ok: false, why, about }       it bounces back; `why` names the line ('belongs', 'lacks',
 *                                   'gives', 'later', 'also') and `about` what it is about
 *   { ok: null }                    nothing happens (already placed, or not an option)
 */
export function tapOption(q, st, id) {
  if (!q.options.includes(id) || st.placed.includes(id)) return { ok: null };
  if (q.kind === 'fill') {
    if (!q.need.includes(id)) return { ok: false, why: 'belongs', about: belongsTo(id, q.dish) };
    const placed = [...st.placed, id];
    return { ok: true, st: { placed }, done: placed.length === q.need.length };
  }
  if (q.kind === 'steps') {
    if (id !== q.steps[st.placed.length]) return { ok: false, why: 'later', about: id };
    const placed = [...st.placed, id];
    return { ok: true, st: { placed }, done: placed.length === q.steps.length };
  }
  if (id === q.answer) return { ok: true, st: { placed: [id] }, done: true };
  if (q.kind === 'which') return { ok: false, why: 'lacks', about: { dish: id, ing: missingIn(id, q.shown) } };
  if (q.kind === 'from') return { ok: false, why: 'gives', about: id };
  return { ok: false, why: 'also', about: q.group };
}

/** What still has to be tapped (the help glows on these after MAX_TRIES). */
export function stillToTap(q, st) {
  if (q.kind === 'fill') return q.need.filter((i) => !st.placed.includes(i));
  if (q.kind === 'steps') return st.placed.length < q.steps.length ? [q.steps[st.placed.length]] : [];
  return st.placed.length ? [] : [q.answer];
}

/** The right answer(s) of a question, for the tests: every one is among the options. */
export function answersOf(q) {
  if (q.kind === 'fill') return q.need;
  if (q.kind === 'steps') return q.steps;
  return [q.answer];
}

export { LOOKALIKES };
