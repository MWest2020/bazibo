// Kangoeroe op de getallenlijn: the questions and the hops, pure (no DOM, no sound) so the tests
// can play them. This is how Dutch schools teach adding and taking away in groep 3-4: a kangaroo
// on a number line, and the child decides the hops. Harder by the maths, never by speed.
//   t1 (5-6)  a line 0-10, forward only: "from 3 to 7, how many hops?" (count) and "3 + 4 = ?"
//             (add, the four hops shown as pips that fill as the kangaroo hops)
//   t2 (6-7)  a line 0-20, forward and back: adding and taking away, mostly over 10, and the
//             missing number ("5 + ? = 12"); over 10 the hint is two arcs: to 10, then on
//   t3 (7-8)  a line 0-100 with the tens marked: hops of 10 (tens), over a ten (via), two steps
//             ("37 + 20 + 5"), and counting by 2s and 5s (skip); + and − mixed
// A question is `ask: 'land'` (hop to the answer, then "Hier!") or `ask: 'count'` (how many hops
// from `start` to `to`: pick the number). `hint` is the strategy as arcs [from, to], shown after a
// wrong answer; `buttons` are the hops on offer (signed). Every position stays on the line.

export const TIER_IDS = Object.freeze(['t1', 't2', 't3']);
export const TIERS = Object.freeze({
  t1: Object.freeze({ max: 10, age: '5-6', back: false }),
  t2: Object.freeze({ max: 20, age: '6-7', back: true }),
  t3: Object.freeze({ max: 100, age: '7-8', back: true }),
});
export const ROUNDS_PER_TIER = 3;
export const ROUND_LEN = 8;
export const MAX_TRIES = 2; // wrong answers on one question before the kangaroo shows the way
/** How many numbers to choose from in a "how many hops?" question. */
export const OPTIONS = Object.freeze({ t1: 3, t2: 4, t3: 4 });
/** The kinds of question in a round of each tier (shuffled per round). */
export const KINDS = Object.freeze({
  t1: Object.freeze(['count', 'count', 'count', 'count', 'add', 'add', 'add', 'add']),
  t2: Object.freeze(['add', 'add', 'add', 'sub', 'sub', 'sub', 'missing', 'missing']),
  t3: Object.freeze(['tens', 'tens', 'via', 'via', 'two', 'two', 'skip', 'skip']),
});

/** Stars by mistakes (questions with a wrong answer): none 3, one or two 2, more 1. */
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

/** A whole number from lo to hi, both included (lo when hi < lo). */
const int = (rand, lo, hi) => (hi <= lo ? lo : lo + Math.floor(rand() * (hi - lo + 1)));
const sign = (n) => (n < 0 ? -1 : 1);

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- the strategy as arcs ----------

/** Single hops of `step` from a to b (b - a a multiple of step). */
export function stepsOf(a, b, step = 1) {
  const out = [];
  const d = sign(b - a) * step;
  for (let x = a; x !== b; x += d) out.push([x, x + d]);
  return out;
}

/** The ten a hop from a to b passes on its way (never one it starts or ends on), or null. */
export function tenBetween(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const ten = Math.floor(lo / 10) * 10 + 10;
  return ten < hi ? ten : null;
}

/**
 * From a to b "via 10": over a ten it is two arcs (to the ten, then on), otherwise single hops
 * (t2) or one arc (t3, where the hops are small next to the tens).
 */
export function viaTen(a, b, singles = true) {
  const ten = tenBetween(a, b);
  if (ten !== null) return [[a, ten], [ten, b]];
  return singles ? stepsOf(a, b) : [[a, b]];
}

// ---------- the questions ----------

/** t1: the biggest hop in a round (1 an easier start, 3 and random the most). */
const t1Most = (round) => (round === 1 ? 4 : round === 2 ? 5 : 6);

function t1(kind, rand, round) {
  const most = t1Most(round);
  if (kind === 'count') {
    const d = int(rand, 2, most);
    const a = int(rand, 0, 10 - d);
    return { kind, ask: 'count', start: a, to: a + d, answer: d, terms: [d], hint: stepsOf(a, a + d) };
  }
  const d = int(rand, 1, most);
  const a = int(rand, 1, 10 - d);
  return { kind: 'add', ask: 'land', start: a, answer: a + d, terms: [d], hint: stepsOf(a, a + d) };
}

function t2(kind, rand) {
  const over = rand() < 0.75; // most questions go over 10: that is what this tier is about
  if (kind === 'add') {
    let a;
    let d;
    if (over) {
      a = int(rand, 3, 9);
      d = int(rand, 11 - a, Math.min(9, 20 - a));
    } else if (rand() < 0.5) {
      a = int(rand, 1, 7);
      d = int(rand, 2, 10 - a);
    } else {
      a = int(rand, 10, 17);
      d = int(rand, 2, 20 - a);
    }
    return { kind, ask: 'land', start: a, answer: a + d, terms: [d], hint: viaTen(a, a + d) };
  }
  if (kind === 'sub') {
    let a;
    let d;
    if (over) {
      a = int(rand, 11, 18);
      d = int(rand, a - 9, Math.min(9, a - 1));
    } else if (rand() < 0.5) {
      a = int(rand, 13, 20);
      d = int(rand, 2, a - 10);
    } else {
      a = int(rand, 4, 10);
      d = int(rand, 2, a - 1);
    }
    return { kind, ask: 'land', start: a, answer: a - d, terms: [-d], hint: viaTen(a, a - d) };
  }
  // missing: "5 + ? = 12" or "14 - ? = 8": how many hops from a to c
  const up = rand() < 0.6;
  let a;
  let c;
  if (up) {
    a = over ? int(rand, 3, 9) : int(rand, 11, 16);
    c = over ? int(rand, 11, Math.min(a + 9, 20)) : int(rand, a + 2, Math.min(a + 6, 20));
  } else {
    a = over ? int(rand, 11, 18) : int(rand, 14, 20);
    c = over ? int(rand, Math.max(1, a - 9), 9) : int(rand, Math.max(10, a - 6), a - 2);
  }
  return { kind: 'missing', ask: 'count', start: a, to: c, answer: Math.abs(c - a), terms: [c - a], hint: viaTen(a, c) };
}

function t3(kind, rand) {
  const down = rand() < 0.5;
  if (kind === 'tens') {
    // 34 + 30, 75 - 40: hops of ten
    const k = int(rand, 2, 5);
    let a = down ? int(rand, 10 * k + 1, 99) : int(rand, 1, 99 - 10 * k);
    if (a % 10 === 0) a += a < 99 - 10 * k ? 1 : -1; // not on a ten, so the units stay put
    const d = down ? -10 * k : 10 * k;
    return { kind, ask: 'land', start: a, answer: a + d, terms: [d], hint: stepsOf(a, a + d, 10) };
  }
  if (kind === 'via') {
    // 47 + 8 = 55 (to 50, then on), 52 - 7 = 45 (to 50, then on)
    let a;
    let d;
    if (down) {
      a = int(rand, 2, 9) * 10 + int(rand, 1, 6);
      d = int(rand, (a % 10) + 1, 9);
      return { kind, ask: 'land', start: a, answer: a - d, terms: [-d], hint: viaTen(a, a - d, false) };
    }
    a = int(rand, 1, 8) * 10 + int(rand, 4, 9);
    d = int(rand, 11 - (a % 10), 9);
    return { kind, ask: 'land', start: a, answer: a + d, terms: [d], hint: viaTen(a, a + d, false) };
  }
  if (kind === 'two') {
    // 37 + 20 + 5, 64 - 20 - 3, 58 - 30 + 4: the tens first, then the rest
    const k = int(rand, 1, 3);
    const tens = down ? -10 * k : 10 * k;
    const units = int(rand, 2, 9) * (rand() < 0.7 ? sign(tens) : -sign(tens));
    const lo = Math.max(11, 1 - tens, 1 - tens - units);
    const hi = Math.min(89, 99 - tens, 99 - tens - units);
    let a = int(rand, lo, hi);
    if (a % 10 === 0) a += a < hi ? 1 : -1;
    const mid = a + tens;
    const end = mid + units;
    return { kind, ask: 'land', start: a, answer: end, terms: [tens, units], hint: [...stepsOf(a, mid, 10), ...viaTen(mid, end, false)] };
  }
  // skip: counting by 2s or 5s, "4 hops of 5 from 15"
  const step = rand() < 0.5 ? 2 : 5;
  const n = int(rand, 3, 6);
  const span = n * step;
  const first = down ? Math.ceil(span / step) : 0;
  const last = down ? Math.floor(100 / step) : Math.floor((100 - span) / step);
  const a = int(rand, first, Math.min(last, step === 2 ? 25 + first : last)) * step;
  const d = down ? -span : span;
  return { kind, ask: 'land', start: a, answer: a + d, terms: [d], step, hops: n, hint: stepsOf(a, a + d, step) };
}

/** The hops offered as buttons (signed), smallest first. */
export function buttonsFor(q, tier) {
  if (q.ask === 'count') return [sign(q.to - q.start)]; // one way only: the hops are what is counted
  if (q.kind === 'skip') return [-q.step, q.step];
  const one = TIERS[tier].back ? [-1, 1] : [1];
  return tier === 't3' ? [-10, ...one, 10] : one;
}

/** The numbers to pick from for a "how many hops?" question: the answer, one more and one less first. */
export function optionsFor(answer, n, rand) {
  const out = new Set([answer, answer + 1]); // one more: counting the start too, the usual slip
  const near = shuffle([answer - 1, answer + 2, answer - 2, answer + 3], rand);
  for (const x of near) {
    if (out.size >= n) break;
    if (x >= 1) out.add(x);
  }
  for (let x = answer + 4; out.size < n; x++) out.add(x);
  return [...out].sort((a, b) => a - b);
}

/** A question's identity, so a round never asks the same thing twice. */
const keyOf = (q) => `${q.kind}:${q.start}:${q.terms.join(',')}`;

/**
 * One round of ROUND_LEN questions for `tier`, the same for the same seed. `round` (1-3, 0 for
 * random) makes the first rounds of tier 1 a little easier.
 */
export function makeRound({ tier, seed, round = 0 }) {
  if (!TIERS[tier]) throw new Error(`no tier ${tier}`);
  const rand = rng(seed);
  const kinds = shuffle(KINDS[tier], rand);
  const seen = new Set();
  const out = [];
  for (const kind of kinds) {
    let q;
    for (let tries = 0; tries < 40; tries++) {
      q = tier === 't1' ? t1(kind, rand, round) : tier === 't2' ? t2(kind, rand) : t3(kind, rand);
      if (!seen.has(keyOf(q))) break;
    }
    seen.add(keyOf(q));
    q.buttons = buttonsFor(q, tier);
    if (q.ask === 'count') q.options = optionsFor(q.answer, OPTIONS[tier], rand);
    out.push(Object.freeze(q));
  }
  return out;
}

/** Where the kangaroo ends when it follows the hint (the answer, or the flag of a count question). */
export const landing = (q) => (q.ask === 'count' ? q.to : q.answer);

/** Is `value` the answer: the number landed on, or the number of hops picked? */
export const isRight = (q, value) => value === q.answer;

// ---------- hopping ----------

/** A fresh kangaroo for a question: on the start, no hops yet. */
export const startHops = (q) => ({ pos: q.start, trail: [] });

/** Can the kangaroo hop `delta` now? Only the hops on offer, never off the line or past a count question's flag. */
export function canHop(q, tier, st, delta) {
  if (!q.buttons.includes(delta)) return false;
  const to = st.pos + delta;
  if (to < 0 || to > TIERS[tier].max) return false;
  if (q.ask === 'count') return Math.min(q.start, q.to) <= to && to <= Math.max(q.start, q.to);
  return true;
}

/** One hop: a new state with the arc added, or null when it is not allowed. */
export function hop(q, tier, st, delta) {
  if (!canHop(q, tier, st, delta)) return null;
  return { pos: st.pos + delta, trail: [...st.trail, [st.pos, st.pos + delta]] };
}

/** A tap on the line: one big jump to `n` (land questions only, on the line, not where it stands). */
export function jump(q, tier, st, n) {
  if (q.ask !== 'land' || !Number.isInteger(n) || n < 0 || n > TIERS[tier].max || n === st.pos) return null;
  return { pos: n, trail: [...st.trail, [st.pos, n]] };
}

/** Take the last hop back. */
export function undo(st) {
  if (!st.trail.length) return null;
  const trail = st.trail.slice(0, -1);
  return { pos: st.trail[st.trail.length - 1][0], trail };
}

/** Tier 1 "3 + 4": how many of the planned hops are made (forward from the start, never more). */
export const pipsDone = (q, st) => Math.max(0, Math.min(q.terms[0], st.pos - q.start));

// ---------- the view on the line ----------

/** At least this many pixels between two numbers on a phone (t3 shows a window of the line). */
export const MIN_UNIT_PX = 8;

/**
 * How many steps of the line are in view for a line `px` wide: the whole line in t1 and t2, in t3
 * a window of 20 to 100 (a multiple of 10) so numbers stay apart.
 */
export function viewSize(tier, px) {
  const max = TIERS[tier].max;
  if (max <= 20) return max;
  const fit = Math.floor(px / MIN_UNIT_PX / 10) * 10;
  return Math.max(20, Math.min(max, fit));
}

const clampLo = (lo, size, max) => Math.max(0, Math.min(max - size, lo));

/** Where a question's view starts: the start and the answer both in sight if they fit, else the start. */
export function startView(q, tier, size) {
  const max = TIERS[tier].max;
  if (size >= max) return 0;
  const pts = [q.start, landing(q)];
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  if (hi - lo + 4 <= size) return clampLo(Math.round((lo + hi) / 2 - size / 2), size, max);
  return clampLo(landing(q) > q.start ? q.start - 3 : q.start - size + 3, size, max);
}

/** Move the view as little as possible so `pos` stays at least `margin` from its edges. */
export function followView(lo, size, pos, max, margin = 3) {
  if (size >= max) return 0;
  let next = lo;
  if (pos < lo + margin) next = pos - margin;
  else if (pos > lo + size - margin) next = pos - size + margin;
  return clampLo(next, size, max);
}
