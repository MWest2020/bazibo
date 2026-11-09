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
  if (m === 0) return `${H} o'clock`;
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

/** Day or night on the clock face (oldest tier and the daily rhythm): 06:00-17:59 is day. */
export function isDay(t) {
  const h = Math.floor(mod(t, DAY) / 60);
  return h >= 6 && h < 18;
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

/** Which hand is nearer (by angle) to a finger at angle `a`: 'minute' or 'hour'. */
export function nearestHand(a, t) {
  const d = (b) => {
    const x = mod(a - b, 360);
    return Math.min(x, 360 - x);
  };
  return d(hourAngle(t)) < d(minuteAngle(t)) ? 'hour' : 'minute';
}

/**
 * Drag the minute hand to angle `a`, snapped to `step` minutes. While the finger moves, passing 12
 * forwards moves the hour on and passing it backwards moves the hour back, as on a real clock (the
 * shorter way round from the old minute decides). `jump` (the finger just landed somewhere) only
 * sets the minutes. Returns the new time.
 */
export function dragMinute(t, a, step = 5, { jump = false } = {}) {
  const snapStep = Math.min(step, 60);
  let m = Math.round(mod(a, 360) / 6 / snapStep) * snapStep;
  if (m >= 60) m = 0;
  const old = minuteOf(t);
  let base = t - old;
  if (!jump) {
    if (m - old < -30) base += 60; // over the top, forwards
    else if (m - old > 30) base -= 60; // over the top, backwards
  }
  return mod(base + m, DAY);
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
 * all written differently, shuffled. The mistakes children really make: an hour off ("half drie"
 * is not 3:30), the hands swapped, a step off, and for the oldest the twelve-hour flip (3:47 vs 15:47).
 */
export function answerOptions(t, tierId, rng, lang = 'nl') {
  const tier = TIERS[tierId];
  const step = tier.step;
  const onGrid = (x) => minuteOf(x) % step === 0;
  const h = hour12(t);
  const m = minuteOf(t);
  const swapped = ((m === 0 ? 12 : Math.round(m / 5)) % 12) * 60 + ((h % 12) * 5) % 60; // hands swapped
  const ideas = [t + 60, t - 60, t + step, t - step, swapped, t + 2 * step, t - 2 * step, t + 120, t - 120];
  if (step <= 15) ideas.push(t + 30, t - 30); // "half" around the wrong hour
  if (tier.digital24) ideas.unshift(t + 720, t - 720); // morning or afternoon
  const right = label(t, tierId, lang);
  const out = [{ t: mod(t, DAY), text: right, correct: true }];
  const seen = new Set([right]);
  const sameAsRight = (x) => (tier.digital24 ? mod(x, DAY) === mod(t, DAY) : sameFace(x, t));
  const add = (x) => {
    x = mod(x, DAY);
    if (out.length >= tier.options || !onGrid(x) || sameAsRight(x)) return;
    const text = label(x, tierId, lang);
    if (seen.has(text)) return;
    seen.add(text);
    out.push({ t: x, text, correct: false });
  };
  for (const x of shuffle(rng, ideas.slice(0, 3)).concat(ideas.slice(3))) add(x);
  for (let guard = 0; out.length < tier.options && guard < 200; guard++) add(randomTime(tierId, rng));
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

/** Three clocks to choose from for an activity: its own time and two others that are far enough away. */
export function dayOptions(activityId, rng) {
  const act = ACTIVITIES.find((a) => a.id === activityId);
  const far = ACTIVITIES.filter((a) => a.id !== act.id && Math.abs(a.t - act.t) >= 180);
  const picks = shuffle(rng, far).slice(0, 2);
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
export function makeRound({ mode, tier, seed, lang = 'nl' }) {
  const rng = mulberry32(seed);
  const qs = [];
  if (mode === 'day') {
    let prev = null;
    for (let i = 0; i < ROUND_LEN; i++) {
      let act = pick(rng, ACTIVITIES);
      for (let g = 0; g < 10 && act.id === prev; g++) act = pick(rng, ACTIVITIES);
      prev = act.id;
      qs.push({ activity: act.id, target: act.t, options: dayOptions(act.id, rng) });
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
