// Klok kijken: the time logic, with no DOM, so all of it can be tested.
// A time is a number of minutes since midnight, 0..1439. The analogue clock shows it modulo 720
// (twelve hours); the oldest tier also reads and writes 24-hour digital times.
//
// Dutch telling time works around the half hour: 2:25 is "vijf voor half drie", 2:30 "half drie",
// 2:40 "tien over half drie". English counts past and to the whole hour.

export const DAY = 1440;
export const FACE = 720;

/** The tiers, youngest first: the step of the minutes, how many answers, how times are written. */
export const TIERS = Object.freeze({
  t1: Object.freeze({ age: '5-6', step: 60, options: 3, digital24: false, dayPart: false }),
  t2: Object.freeze({ age: '6-7', step: 30, options: 3, digital24: false, dayPart: false }),
  t3: Object.freeze({ age: '7-8', step: 15, options: 4, digital24: false, dayPart: false }),
  t4: Object.freeze({ age: '8-9', step: 5, options: 4, digital24: false, dayPart: false }),
  t5: Object.freeze({ age: '9-10', step: 1, options: 4, digital24: true, dayPart: true }),
});
export const TIER_IDS = Object.keys(TIERS);

const NL_NUM = ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien', 'twintig', 'eenentwintig', 'tweeëntwintig', 'drieëntwintig', 'vierentwintig', 'vijfentwintig', 'zesentwintig', 'zevenentwintig', 'achtentwintig', 'negenentwintig'];
const EN_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine'];

const mod = (a, n) => ((a % n) + n) % n;

/** The hour as it is written on the clock face: 1..12. */
export function hour12(t) {
  const h = Math.floor(mod(t, DAY) / 60) % 12;
  return h === 0 ? 12 : h;
}
const next12 = (h) => (h === 12 ? 1 : h + 1);

export function minuteOf(t) {
  return mod(t, DAY) % 60;
}

/** The time in words, 12-hour, lowercase: "kwart voor drie", "twenty-five past two". */
export function phrase(t, lang = 'nl') {
  const h = hour12(t);
  const m = minuteOf(t);
  return lang === 'en' ? phraseEn(h, m) : phraseNl(h, m);
}

function phraseNl(h, m) {
  const H = NL_NUM[h];
  const N = NL_NUM[next12(h)];
  const mins = (n) => (n % 5 === 0 ? NL_NUM[n] : `${NL_NUM[n]} ${n === 1 ? 'minuut' : 'minuten'}`);
  if (m === 0) return `${H} uur`;
  if (m === 15) return `kwart over ${H}`;
  if (m === 30) return `half ${N}`;
  if (m === 45) return `kwart voor ${N}`;
  if (m < 15) return `${mins(m)} over ${H}`; // 1..14: "tien over drie"
  if (m < 30) return `${mins(30 - m)} voor half ${N}`; // 16..29: "vijf voor half vier"
  if (m < 45) return `${mins(m - 30)} over half ${N}`; // 31..44: "tien over half vier"
  return `${mins(60 - m)} voor ${N}`; // 46..59: "vijf voor vier"
}

function phraseEn(h, m) {
  const H = EN_NUM[h];
  const N = EN_NUM[next12(h)];
  const mins = (n) => (n % 5 === 0 ? EN_NUM[n] : `${EN_NUM[n]} ${n === 1 ? 'minute' : 'minutes'}`);
  if (m === 0) return `${H} o’clock`;
  if (m === 15) return `quarter past ${H}`;
  if (m === 30) return `half past ${H}`;
  if (m === 45) return `quarter to ${N}`;
  if (m < 30) return `${mins(m)} past ${H}`;
  return `${mins(60 - m)} to ${N}`;
}

/** Digital: "3:05" (12-hour) or "15:05" / "03:05" (24-hour). */
export function digital(t, { h24 = false } = {}) {
  const m = minuteOf(t);
  const mm = String(m).padStart(2, '0');
  if (h24) return `${String(Math.floor(mod(t, DAY) / 60)).padStart(2, '0')}:${mm}`;
  return `${hour12(t)}:${mm}`;
}

/** Day or night on the clock face (oldest tier and the daily rhythm): 06:00 to 18:00 is day. */
export function isDay(t) {
  const x = mod(t, DAY);
  return x >= 6 * 60 && x <= 18 * 60;
}

// ---------- the hands ----------

/** Angles in degrees, clockwise from 12. The hour hand moves on with the minutes. */
export function minuteAngle(t) {
  return minuteOf(t) * 6;
}
export function hourAngle(t) {
  return (mod(t, FACE) / 720) * 360;
}

/** The angle of a point (x, y) around the centre (cx, cy), clockwise from 12, 0..360. */
export function pointAngle(x, y, cx, cy) {
  return mod((Math.atan2(x - cx, cy - y) * 180) / Math.PI, 360);
}

const angleGap = (a, b) => {
  const x = mod(a - b, 360);
  return Math.min(x, 360 - x);
};
/** The signed shortest turn from angle `from` to angle `to`, -180..180 (clockwise positive). */
export function turnBetween(from, to) {
  return mod(to - from + 180, 360) - 180;
}

/** Hand lengths in the clock drawing (art.js): the hour hand reaches 48, the minute hand 74. */
export const HOUR_REACH = 55;

/**
 * Which hand a finger at angle `a` and distance `r` from the centre grabs. Beyond the hour hand's
 * reach it is always the long hand; inside it, the hour hand when it is within 20 degrees (so the
 * hands lying on top of each other, as at 12:00, still give the short hand), else the nearer hand.
 */
export function pickHand(a, r, t) {
  if (r > HOUR_REACH) return 'minute';
  if (angleGap(a, hourAngle(t)) <= 20) return 'hour';
  return angleGap(a, hourAngle(t)) < angleGap(a, minuteAngle(t)) ? 'hour' : 'minute';
}

/**
 * Turning the long hand with a finger. The raw angle is followed with the signed shortest turn
 * between pointer events (also from the hand to where the finger first lands), so passing 12
 * forwards moves the hour on and backwards moves it back, also with a big step size or a fast
 * flick. The time is snapped to `step` minutes only for what the clock shows.
 *   const drag = minuteDrag(time, angle, step); time = drag.move(newAngle);
 */
export function minuteDrag(t, a, step = 5) {
  const snap = Math.min(step, 60);
  const start = t;
  let raw = 0; // minutes turned since the start, unsnapped
  let last = minuteAngle(t);
  const move = (b) => {
    raw += turnBetween(last, b) / 6;
    last = b;
    const total = start + raw;
    return mod(Math.round(total / snap) * snap, DAY);
  };
  const first = move(a);
  return { first, move };
}

/** Drag the hour hand to angle `a`: the nearest whole hour, the minutes stay. */
export function dragHour(t, a) {
  const m = minuteOf(t);
  const raw = mod(a - m * 0.5, 360) / 30; // where the hour would be with these minutes
  let h = Math.round(raw) % 12;
  const pm = Math.floor(mod(t, DAY) / 60) >= 12;
  return mod((h + (pm ? 12 : 0)) * 60 + m, DAY);
}

/** + or - one step of the minutes (with the hour carried), or one hour. */
export function nudge(t, minutes) {
  return mod(t + minutes, DAY);
}

/** Two times show the same on the clock face. */
export function sameFace(a, b) {
  return mod(a, FACE) === mod(b, FACE);
}

// ---------- random, seeded (so a round is the same each time it is played) ----------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

function shuffle(rng, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A random time on the tier's grid. Up to the 5-minute tier on a 12-hour face (1:00..12:55). */
export function randomTime(tierId, rng) {
  const tier = TIERS[tierId];
  const m = Math.floor(rng() * (60 / tier.step)) * tier.step;
  if (tier.digital24) return Math.floor(rng() * 24) * 60 + m;
  const h = 1 + Math.floor(rng() * 12);
  return (h % 12) * 60 + m + (rng() < 0.5 ? 0 : 720); // morning or afternoon: the face is the same
}

/** How an answer is written for this tier: the words, or 24-hour digital for the oldest. */
export function label(t, tierId, lang) {
  return TIERS[tierId].digital24 ? digital(t, { h24: true }) : phrase(t, lang);
}

/**
 * The answer options for a time: the right one plus plausible mistakes, all on the tier's grid,
 * all written differently, shuffled. The mistakes are the ones children really make: an hour off
 * ("half drie" is 2:30, not 3:30), a step off, the hands swapped, half an hour off, and for the
 * oldest the twelve-hour flip (3:47 vs 15:47). Each mistake comes from a different kind where it
 * can, and the right answer is as often the earliest, a middle or the latest time of the row (its
 * place is drawn first), so no simple rule finds it. Never an hour too early and an hour too late
 * together.
 */
export function answerOptions(t, tierId, rng, lang = 'nl') {
  const tier = TIERS[tierId];
  const step = tier.step;
  const span = tier.digital24 ? DAY : FACE;
  const n = tier.options;
  const onGrid = (x) => minuteOf(x) % step === 0;
  const rel = (x) => mod(x - t + span / 2, span) - span / 2; // minutes before (-) or after (+) the answer
  const h = hour12(t);
  const m = minuteOf(t);
  const swapped = ((m === 0 ? 12 : Math.round(m / 5)) % 12) * 60 + ((h % 12) * 5) % 60;
  const bigStep = step >= 60 ? 120 : step;
  const kinds = {
    hour: [60, 120],
    step: step >= 60 ? [120, 180] : [step, 2 * step],
    other: [...(step <= 30 ? [30] : []), step >= 60 ? 240 : 3 * bigStep],
  };
  const right = label(t, tierId, lang);
  const out = [{ t: mod(t, DAY), text: right, correct: true }];
  const seen = new Set([right]);
  const offs = new Set();
  const sameAsRight = (x) => (tier.digital24 ? mod(x, DAY) === mod(t, DAY) : sameFace(x, t));
  const add = (x) => {
    x = mod(x, DAY);
    if (out.length >= n || !onGrid(x) || sameAsRight(x)) return false;
    const off = rel(x);
    if (Math.abs(off) === 60 && offs.has(-off)) return false; // never an hour on both sides
    const text = label(x, tierId, lang);
    if (seen.has(text)) return false;
    seen.add(text);
    offs.add(off);
    out.push({ t: x, text, correct: false });
    return true;
  };
  // where the right answer sits in the row of times: drawn first, evenly
  const before = Math.floor(rng() * n);
  const need = { [-1]: before, [1]: n - 1 - before };
  const extras = () => {
    const xs = [swapped];
    if (tier.digital24) xs.push(t + 720, t - 720);
    for (let k = 0; k < 6; k++) xs.push(randomTime(tierId, rng));
    return shuffle(rng, xs);
  };
  for (const side of shuffle(rng, [-1, 1])) {
    let got = 0;
    // one mistake per kind first, then anything on this side
    for (const kind of shuffle(rng, Object.keys(kinds))) {
      if (got >= need[side]) break;
      const ds = kind === 'other' && tier.digital24 && side < 0 ? [720, ...kinds.other] : kinds[kind]; // the twelve-hour flip
      for (const d of ds) {
        if (Math.sign(rel(t + side * d)) !== side) continue;
        if (add(t + side * d)) {
          got++;
          break;
        }
      }
    }
    for (const x of extras()) {
      if (got >= need[side]) break;
      if (Math.sign(rel(x)) === side && add(x)) got++;
    }
    for (let d = step; got < need[side] && d < span / 2; d += step) if (add(t + side * d)) got++;
  }
  for (let guard = 0; out.length < n && guard < 200; guard++) add(randomTime(tierId, rng));
  return shuffle(rng, out);
}

// ---------- the daily rhythm (youngest): whole hours with a sun or a moon ----------

export const ACTIVITIES = Object.freeze([
  Object.freeze({ id: 'breakfast', t: 7 * 60 }),
  Object.freeze({ id: 'school', t: 8 * 60 }),
  Object.freeze({ id: 'lunch', t: 12 * 60 }),
  Object.freeze({ id: 'play', t: 15 * 60 }),
  Object.freeze({ id: 'dinner', t: 18 * 60 }),
  Object.freeze({ id: 'bath', t: 19 * 60 }),
  Object.freeze({ id: 'bed', t: 20 * 60 }),
]);

/**
 * Three clocks to choose from for an activity: its own time and two others that are far enough
 * away. `easy` (the first rounds) also leaves out clocks that look the same apart from the sun or
 * the moon (7:00 and 19:00).
 */
export function dayOptions(activityId, rng, { easy = false } = {}) {
  const act = ACTIVITIES.find((a) => a.id === activityId);
  const far = ACTIVITIES.filter((a) => a.id !== act.id && Math.abs(a.t - act.t) >= 180 && !(easy && sameFace(a.t, act.t)));
  const picks = [];
  for (const a of shuffle(rng, far)) {
    if (picks.length === 2) break;
    if (easy && picks.some((p) => sameFace(p.t, a.t))) continue; // two clocks that look alike
    picks.push(a);
  }
  return shuffle(rng, [{ t: act.t, correct: true }, ...picks.map((a) => ({ t: a.t, correct: false }))]);
}

// ---------- rounds ----------

export const MODES = Object.freeze(['set', 'read', 'day']);
export const ROUND_LEN = 10;
export const ROUNDS_PER_TIER = 3;

/** The fixed rounds: set and read have 3 rounds per tier, the daily rhythm 3 rounds. */
export function roundIds() {
  const ids = [];
  for (const mode of ['set', 'read']) for (const tier of TIER_IDS) for (let r = 1; r <= ROUNDS_PER_TIER; r++) ids.push(`${mode}-${tier}-${r}`);
  for (let r = 1; r <= ROUNDS_PER_TIER; r++) ids.push(`day-t1-${r}`);
  return ids;
}

export function parseRoundId(id) {
  const [mode, tier, r] = String(id).split('-');
  return { mode, tier, round: Number(r) };
}

/**
 * The questions of a round. Fixed rounds use a seed from their id, random practice a fresh seed.
 * set:  { target, start }   read: { target, options }   day: { activity, target, options }
 */
export function makeRound({ mode, tier, seed, lang = 'nl', round = 0 }) {
  const rng = mulberry32(seed);
  const qs = [];
  if (mode === 'day') {
    let prev = null;
    for (let i = 0; i < ROUND_LEN; i++) {
      let act = pick(rng, ACTIVITIES);
      for (let g = 0; g < 10 && act.id === prev; g++) act = pick(rng, ACTIVITIES);
      prev = act.id;
      qs.push({ activity: act.id, target: act.t, options: dayOptions(act.id, rng, { easy: round > 0 && round <= 2 }) });
    }
    return qs;
  }
  const used = new Set();
  for (let i = 0; i < ROUND_LEN; i++) {
    let target = randomTime(tier, rng);
    for (let g = 0; g < 50 && used.has(mod(target, TIERS[tier].digital24 ? DAY : FACE)); g++) target = randomTime(tier, rng);
    used.add(mod(target, TIERS[tier].digital24 ? DAY : FACE));
    if (mode === 'set') {
      let start = randomTime(tier, rng);
      for (let g = 0; g < 50 && sameFace(start, target); g++) start = randomTime(tier, rng);
      qs.push({ target, start });
    } else qs.push({ target, options: answerOptions(target, tier, rng, lang) });
  }
  return qs;
}

/** Stars for a round of 10: no mistakes 3, one or two 2, more 1. */
export function starsFor(mistakes) {
  return mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
}

/** Which hand a hint points at: the minute hand while the minutes are wrong, then the hour hand. */
export function hintHand(current, target) {
  return minuteOf(current) !== minuteOf(target) ? 'minute' : 'hour';
}

/** Where the long hand points, as a number on the face (12 for 0 minutes) or between numbers. */
export function minutePosition(t) {
  const m = minuteOf(t);
  return m % 5 === 0 ? (m === 0 ? 12 : m / 5) : null;
}
