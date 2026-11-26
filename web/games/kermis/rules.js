// Kleurenkermis (Colour Fair): the rounds, what a tap means and the race, pure (no DOM, no sound,
// no clock: time is passed in) so the tests can play them. The game is about the Stroop effect (a
// colour word in another ink), made our own and calm. Harder by what must be told apart, never by
// speed:
//   t1 (3-5)   a thing in a colour ("klopt deze kleur?"): Ja or Nee; things with one clear colour
//   t2 (6-7)   a short colour word (rood, blauw, geel, groen) in its own or another ink: Ja or Nee
//   t3 (8-10)  the real Stroop task: tap the colour of the letters, not the word, from 4 colours
// In tiers 1 and 2 every round has as many Ja as Nee; in tier 3 the word is its own ink in at most
// a third of the questions (CONGRUENT of ROUND_LEN).
// Rustig (calm, the default): no time; a tap that does not fit is greyed with a short line, after
// MAX_TRIES the answer glows; stars by mistakes only. Race (the full version; Mark, 26 Nov 2026: the
// only Bazibo game with a race): 1 to 4 children on one tablet, each with their own corner, all at
// once; the first right tap wins the question's point; a wrong tap gives only that child a short
// pause (PAUSE_MS), never minus points. Alone, a child races the little turtle (turtlePlan).
import { INKS, WORD_COLOURS, STROOP_COLOURS, THINGS, THING_IDS } from './colours.js';

export const TIER_IDS = Object.freeze(['t1', 't2', 't3']);
export const TIERS = Object.freeze({
  t1: Object.freeze({ age: '3-5', kind: 'pic' }),
  t2: Object.freeze({ age: '6-7', kind: 'word' }),
  t3: Object.freeze({ age: '8-10', kind: 'stroop' }),
});
export const MODES = Object.freeze(['calm', 'race']);
export const PLAYER_COUNTS = Object.freeze([1, 2, 3, 4]);
/** The players, by corner: Zon bottom left, Maan top right (far apart), then Wolk, Bloem. */
export const PLAYER_IDS = Object.freeze(['zon', 'maan', 'wolk', 'bloem']);
export const SLOTS = Object.freeze(['bl', 'tr', 'br', 'tl']);
export const ROUNDS_PER_TIER = 3;
export const ROUND_LEN = 8;
export const MAX_TRIES = 2; // wrong taps on one question before the answer glows (tier 3)
export const CONGRUENT = 2; // tier 3: questions per round where the word is its own ink
export const STROOP_OPTIONS = 4;
/** Race: how long a wrong tap pauses that child (ms), and the beat before the next question. */
export const PAUSE_MS = 1500;
export const NEXT_MS = 1600;
/** The turtle (racing a child who plays alone): when it taps, per tier (ms after the question). */
export const TURTLE = Object.freeze({
  t1: Object.freeze({ from: 2600, spread: 2200, right: 0.8 }),
  t2: Object.freeze({ from: 2900, spread: 2400, right: 0.8 }),
  t3: Object.freeze({ from: 3400, spread: 2600, right: 0.75 }),
});

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

const pick = (list, rand) => list[Math.floor(rand() * list.length)];
const YES_NO = Object.freeze(['yes', 'no']);

/** Half Ja and half Nee, shuffled, never more than three of one in a row. */
function balanced(rand) {
  for (;;) {
    const a = shuffle([...Array(ROUND_LEN / 2).fill(true), ...Array(ROUND_LEN / 2).fill(false)], rand);
    if (!a.some((v, i) => i >= 3 && a[i - 1] === v && a[i - 2] === v && a[i - 3] === v)) return a;
  }
}

/** A tier 1 question: a thing, shown in its own colour (Ja) or in one that is plainly wrong (Nee). */
export function picQuestion(thing, match, rand) {
  const own = THINGS[thing].ink;
  const ink = match ? own : pick(THINGS[thing].not, rand);
  return { kind: 'pic', thing, ink, own, answer: match ? 'yes' : 'no', options: [...YES_NO] };
}

/** A tier 2 question: a colour word in its own ink (Ja) or in another of the four (Nee). */
export function wordQuestion(word, match, rand) {
  const ink = match ? word : pick(WORD_COLOURS.filter((c) => c !== word), rand);
  return { kind: 'word', word, ink, answer: match ? 'yes' : 'no', options: [...YES_NO] };
}

/** A tier 3 question: tap the ink; the four colours always hold the ink and the word's colour. */
export function stroopQuestion(word, ink, rand) {
  const set = new Set([ink, word]);
  for (const c of shuffle(STROOP_COLOURS, rand)) if (set.size < STROOP_OPTIONS) set.add(c);
  return { kind: 'stroop', word, ink, answer: ink, options: STROOP_COLOURS.filter((c) => set.has(c)) };
}

const sameAs = (a, b) => a && b && a.kind === b.kind && a.word === b.word && a.ink === b.ink && a.thing === b.thing;

/** The questions of a round: ROUND_LEN of them, the same for the same seed. */
export function makeRound({ tier, seed }) {
  const rand = rng(seed);
  if (tier === 't1') {
    const things = shuffle(THING_IDS, rand).slice(0, ROUND_LEN);
    return balanced(rand).map((m, i) => picQuestion(things[i], m, rand));
  }
  if (tier === 't2') {
    const out = [];
    for (const m of balanced(rand)) {
      let q;
      do q = wordQuestion(pick(WORD_COLOURS, rand), m, rand);
      while (sameAs(q, out[out.length - 1]) || q.word === out[out.length - 1]?.word);
      out.push(q);
    }
    return out;
  }
  if (tier === 't3') {
    const congruent = new Set(shuffle([...Array(ROUND_LEN).keys()], rand).slice(0, CONGRUENT));
    const out = [];
    for (let i = 0; i < ROUND_LEN; i++) {
      const prev = out[i - 1];
      let word, ink;
      do {
        word = pick(STROOP_COLOURS, rand);
        ink = congruent.has(i) ? word : pick(STROOP_COLOURS.filter((c) => c !== word), rand);
      } while (prev && (word === prev.word || ink === prev.ink));
      out.push(stroopQuestion(word, ink, rand));
    }
    return out;
  }
  throw new Error(`unknown tier ${tier}`);
}

// ---------- Rustig: a tap ----------

export const startState = () => ({ tried: [] });

/**
 * What a tap on answer `a` means: { ok: true } when right; { ok: false, why } when not ('word': it
 * is the colour of the word, not of the letters; 'look' otherwise), with the state that remembers
 * it; { ok: null } for a tap that counts nothing (already tried, or not an answer here).
 */
export function tapAnswer(q, st, a) {
  if (!q.options.includes(a) || st.tried.includes(a)) return { ok: null, st };
  if (a === q.answer) return { ok: true, st };
  const why = q.kind === 'stroop' && a === q.word ? 'word' : 'look';
  return { ok: false, why, st: { tried: [...st.tried, a] } };
}

/** What still glows as help: the answer. */
export const answerOf = (q) => q.answer;

// ---------- Race ----------

/** A race of `n` players at the start of a question: points, pauses (until when) and what each tried. */
export function raceStart(n) {
  return { scores: Array(n).fill(0), paused: Array(n).fill(0), tried: Array.from({ length: n }, () => []), winner: null };
}

/** The next question: nobody has won it, nobody is paused, nothing is tried; the points stay. */
export function raceNext(st) {
  return { scores: [...st.scores], paused: st.paused.map(() => 0), tried: st.tried.map(() => []), winner: null };
}

/**
 * Player `p` taps answer `a` on question `q` at time `now` (ms). Returns { st, res }:
 *   'closed'  the question was won already (nothing changes)
 *   'paused'  this player is still in their pause after a wrong tap (nothing changes)
 *   'same'    an answer this player tried already (nothing changes)
 *   'right'   first right tap: the point, and the question is over
 *   'wrong'   a pause for this player only, until now + PAUSE_MS; nobody loses a point
 */
export function raceTap(st, p, a, q, now) {
  if (st.winner !== null) return { st, res: 'closed' };
  if (p < 0 || p >= st.scores.length || !q.options.includes(a)) return { st, res: 'closed' };
  if (now < st.paused[p]) return { st, res: 'paused' };
  if (st.tried[p].includes(a)) return { st, res: 'same' };
  if (a === q.answer) {
    const scores = [...st.scores];
    scores[p]++;
    return { st: { ...st, scores, winner: p }, res: 'right' };
  }
  const paused = [...st.paused];
  paused[p] = now + PAUSE_MS;
  const tried = st.tried.map((x, k) => (k === p ? [...x, a] : x));
  return { st: { ...st, paused, tried }, res: 'wrong' };
}

/** Is player `p` paused at `now`? */
export const isPaused = (st, p, now) => now < st.paused[p];

/** Everyone's place by points: the same points share a place (5, 5, 3 points: 1st, 1st, 3rd). */
export function places(scores) {
  return scores.map((s) => 1 + scores.filter((x) => x > s).length);
}

/**
 * The turtle's taps on a question (a child alone races it): when (ms after the question is shown)
 * and what, seeded. Mostly right; when not, it tries the right one after its pause.
 */
export function turtlePlan(q, tier, seed) {
  const cfg = TURTLE[tier];
  const rand = rng(seed);
  const at = Math.round(cfg.from + rand() * cfg.spread);
  if (rand() < cfg.right) return [{ at, a: q.answer }];
  const wrong = q.options.filter((o) => o !== q.answer);
  return [
    { at, a: pick(wrong, rand) },
    { at: at + PAUSE_MS + Math.round(500 + rand() * 900), a: q.answer },
  ];
}

// ---------- what the chameleon says ----------

/**
 * What the chameleon says, as { key, vars, help } for t(). Every value in `vars` is another key; null
 * is left out (no greeting after the first question).
 *   say 'hello'  at the start of question `i`; `who` the player whose turn it is (calm together), or
 *                `race` true
 *   say 'try'    after a tap on `a`: `res` is what tapAnswer said
 *   say 'won'    in a race, player `who` was first
 */
export function hostLine(q, { say, i = 0, who = null, race = false, res = null, a = null, help = false } = {}) {
  const col = (c) => `kermis.col.${c}`;
  if (say === 'hello') {
    const hi = race ? (i <= 0 ? 'kermis.raceHi' : null) : who ? `kermis.turn.${who}` : i <= 0 ? 'kermis.hi' : null;
    return { key: `kermis.say.${q.kind}`, vars: { hi } };
  }
  if (say === 'won') return { key: 'kermis.won', vars: { who: `kermis.p.${who}` } };
  if (say !== 'try' || !res || res.ok === null) throw new Error(`unknown line ${say}`);
  let line;
  if (q.kind === 'pic') {
    const vars = { an: `kermis.an.${q.thing}`, col: col(q.own), ink: col(q.ink) };
    if (res.ok) return { key: q.answer === 'yes' ? 'kermis.picYes' : 'kermis.picNo', vars };
    line = { key: q.answer === 'yes' ? 'kermis.picLookYes' : 'kermis.picLookNo', vars };
  } else if (q.kind === 'word') {
    const vars = { word: col(q.word), col: col(q.ink) };
    if (res.ok) return { key: q.answer === 'yes' ? 'kermis.wordYes' : 'kermis.wordNo', vars };
    line = { key: q.answer === 'yes' ? 'kermis.wordLookYes' : 'kermis.wordLookNo', vars };
  } else {
    if (res.ok) return { key: 'kermis.stroopYes', vars: { col: col(q.ink) } };
    line = { key: res.why === 'word' ? 'kermis.stroopWord' : 'kermis.stroopLook', vars: {} };
  }
  return help ? { ...line, help: true } : line;
}

/** Every key a line may use, for the strings test. */
export const LINE_KEYS = Object.freeze([
  'kermis.hi',
  'kermis.raceHi',
  'kermis.help',
  'kermis.won',
  ...['pic', 'word', 'stroop'].map((k) => `kermis.say.${k}`),
  ...['picYes', 'picNo', 'picLookYes', 'picLookNo', 'wordYes', 'wordNo', 'wordLookYes', 'wordLookNo', 'stroopYes', 'stroopWord', 'stroopLook'].map((k) => `kermis.${k}`),
  ...PLAYER_IDS.flatMap((p) => [`kermis.turn.${p}`, `kermis.p.${p}`]),
  ...Object.keys(INKS).map((c) => `kermis.col.${c}`),
  ...THING_IDS.flatMap((id) => [`kermis.an.${id}`, `kermis.thing.${id}`]),
]);

/**
 * A line as text through `t`: spaces left by a greeting that is left out dropped, and every
 * sentence starting with a capital ("Een banaan is geel.").
 */
export function lineText(line, t) {
  const vars = {};
  for (const [k, v] of Object.entries(line.vars)) vars[k] = v === null ? '' : t(v);
  let s = t(line.key, vars);
  if (line.help) s = `${s} ${t('kermis.help')}`;
  s = s.replace(/ {2,}/g, ' ').trim();
  return s.replace(/(^|[.!?] )(\p{Ll})/gu, (_, a, b) => a + b.toLocaleUpperCase());
}
