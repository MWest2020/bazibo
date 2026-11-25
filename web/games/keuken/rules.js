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
import { PREFERRED, DISHES, DISH_IDS, INGREDIENT_IDS, LOOKALIKES, lookalikesOf, MADE_OF, ORIGINS, ORIGIN_IDS, SOURCE_IDS, GROUPS, GROUP_IDS, RECIPES, RECIPE_IDS } from './dishes.js';

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
  const pref = PREFERRED[ing];
  if (pref && pref !== except && DISHES[pref] && inDish(pref).has(ing)) return pref;
  for (const field of ['key', 'need', 'maybe']) {
    for (const d of DISH_IDS) if (d !== except && DISHES[d][field].includes(ing)) return d;
  }
  return null;
}

/**
 * Could a child say this dish can be made from the shown bowls? When it lacks something shown, no;
 * when everything it needs (or everything it is known by) is in the bowls, yes (pancakes from the
 * poffertjes bowls). A "which dish?" never offers such a dish beside the answer.
 */
export function canMake(d, shown) {
  if (!missingIn(d, shown)) return true;
  return DISHES[d].need.every((i) => shown.includes(i)) || DISHES[d].key.every((i) => shown.includes(i));
}

/**
 * Everything a dish has in it, also in a made form: what it needs or may have, what those are made of
 * (`MADE_OF`: the flour, water, yeast and salt in a tosti's bread, the milk in its cheese) and the dish
 * itself (the bread in bread).
 */
export function hasIn(d) {
  const has = inDish(d);
  has.add(d);
  for (const i of [...has]) for (const m of MADE_OF[i] || []) has.add(m);
  return has;
}

/**
 * For a picked dish that is not the answer: the first shown ingredient that is really not in it, in
 * no form ("Hmm, geen kaas in het brood!", never "geen bloem in de tosti" or "geen brood in het brood").
 */
export function missingIn(d, shown) {
  const has = hasIn(d);
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
  const fits = DISH_IDS.filter((o) => o !== d && !canMake(o, shown));
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

// ---------- what the cook says ----------

/**
 * The grammatical forms of an ingredient (`keuken.form.<id>` per language): a de-word (or English
 * singular), a het-word, a plural. A line with `form` has a key per form ("Die horen bij ...").
 */
export const FORMS = Object.freeze(['sg', 'n', 'pl']);

/**
 * What the cook says, as { key, form, vars, help } for t(). Every value in `vars` is another key (an
 * ingredient or a dish as said in a sentence); null is left out (the greeting after the first
 * question). `form` names the key of the tapped ingredient's form; the text is then
 * `<key>.<form>` (plurals and het-words agree). `help` adds the line about the glowing help.
 *   say 'hello'  at the start of question `i` of a round (the first with "Hoi!"), in tier `tier`
 *   say 'try'    after a tap on option `id`: `res` is what tapOption said about it
 */
export function cookLine(q, { say, i = 0, tier = 't1', res = null, id = null, help = false } = {}) {
  const hi = i <= 0 ? 'keuken.hi' : null;
  const make = (d) => `keuken.make.${d}`;
  if (say === 'hello') {
    if (q.kind === 'fill') return { key: tier === 't1' ? 'keuken.say.fill' : 'keuken.say.fillAll', vars: { hi, dish: make(q.dish) } };
    if (q.kind === 'from') return { key: 'keuken.say.from', vars: { hi, ing: `keuken.some.${q.ing}` } };
    if (q.kind === 'steps') return { key: 'keuken.say.steps', vars: { hi, dish: make(q.dish) } };
    if (q.kind === 'which') return { key: 'keuken.say.which', vars: { hi } };
    return { key: 'keuken.say.odd', vars: { hi } };
  }
  if (say !== 'try' || !res || res.ok === null) throw new Error(`unknown line ${say}`);
  let line;
  if (res.ok) {
    if (res.done && (q.kind === 'fill' || q.kind === 'steps')) return { key: 'keuken.ready', vars: {} };
    if (q.kind === 'fill') line = { key: 'keuken.say.yum', vars: { it: `keuken.art.${id}` } };
    else if (q.kind === 'steps') line = { key: 'keuken.say.next', vars: {} };
    else if (q.kind === 'which') return { key: 'keuken.say.dish', vars: { dish: make(q.dish) } };
    else if (q.kind === 'from') return { key: `keuken.fact.${q.ing}`, vars: {} };
    else return { key: `keuken.group.${q.group}`, vars: {} };
  } else if (res.why === 'belongs') line = { key: 'keuken.belongs', form: `keuken.form.${id}`, vars: { ing: `keuken.some.${id}`, dish: `keuken.the.${res.about}` } };
  else if (res.why === 'lacks') line = { key: 'keuken.lacks', vars: { ing: `keuken.ing.${res.about.ing}`, dish: `keuken.the.${res.about.dish}` } };
  else if (res.why === 'gives') line = { key: `keuken.gives.${res.about}`, vars: {} };
  else if (res.why === 'later') line = { key: 'keuken.later', vars: {} };
  else line = { key: `keuken.also.${res.about}`, form: `keuken.form.${id}`, vars: {} };
  return help ? { ...line, help: true } : line;
}

/** Every key a line may use, for the strings test. */
export const LINE_KEYS = Object.freeze([
  'keuken.hi',
  'keuken.help',
  'keuken.ready',
  ...FORMS.map((f) => `keuken.belongs.${f}`),
  'keuken.lacks',
  'keuken.later',
  ...['fill', 'fillAll', 'from', 'steps', 'which', 'odd', 'yum', 'next', 'dish'].map((k) => `keuken.say.${k}`),
  ...DISH_IDS.flatMap((d) => [`keuken.make.${d}`, `keuken.the.${d}`]),
  ...INGREDIENT_IDS.flatMap((i) => [`keuken.ing.${i}`, `keuken.some.${i}`, `keuken.art.${i}`, `keuken.form.${i}`]),
  ...ORIGIN_IDS.map((i) => `keuken.fact.${i}`),
  ...SOURCE_IDS.map((s) => `keuken.gives.${s}`),
  ...GROUP_IDS.flatMap((g) => [`keuken.group.${g}`, ...FORMS.map((f) => `keuken.also.${g}.${f}`)]),
]);

/**
 * A line as text through `t`: the key of the ingredient's form when the line has one, spaces left by
 * a greeting that is left out dropped, and every sentence starting with a capital ("Hmm, een ei?
 * Dat hoort ...", "Fijn! Nu hebben we ..."). Soft hyphens stay, so a long word (boerenkool-
 * stamppot) can break in a narrow bubble.
 */
export function lineText(line, t) {
  const vars = {};
  for (const [k, v] of Object.entries(line.vars)) vars[k] = v === null ? '' : t(v);
  const form = line.form ? t(line.form) : null;
  let s = t(form ? `${line.key}.${FORMS.includes(form) ? form : 'sg'}` : line.key, vars);
  if (line.help) s = `${s} ${t('keuken.help')}`;
  s = s.replace(/ {2,}/g, ' ').trim();
  return s.replace(/(^|[.!?] )(\p{Ll})/gu, (_, a, b) => a + b.toLocaleUpperCase());
}

export { LOOKALIKES };
