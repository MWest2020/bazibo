// Drumstel: the kit, the rhythms and the rules of playing along, as data and pure functions. No DOM,
// no sound, so `tests/drums.test.js` checks all of it. Time is always passed in (milliseconds, any
// clock), so the tests can play a rhythm without waiting.
//
// A rhythm is a string of steps: the pads hit together joined with + (K kick, S snare, H hi-hat,
// C crash, R ride, 1 2 3 the high, middle and floor tom), with an optional length after a colon in
// beats (1 = a quarter note; `S:.5` an eighth). A . is a rest. A | is a bar line, only there to read.
//
// Two levels, by age:
//   small (4-6)  one pad at a time, slow; in your own pace: the next pad glows on the beat, but the
//                rhythm waits for the child and only the order counts
//   big (7-10)   two pads at once too, faster; on the beat: the rhythm runs on, a step counts when
//                its pads are hit close to its beat (`WINDOW_MS`), a missed step is simply passed

/** The pads, in reading order of the kit. `kind` picks the drawing and the sound. */
export const PADS = Object.freeze([
  { id: 'crash', kind: 'cymbal', color: '#ffc531', key: 'c' },
  { id: 'tom1', kind: 'tom', color: '#4aa8ff', key: '1' },
  { id: 'tom2', kind: 'tom', color: '#7ed957', key: '2' },
  { id: 'ride', kind: 'ride', color: '#f39a2e', key: 'r' },
  { id: 'hihat', kind: 'hihat', color: '#dfe3f0', key: 'h' },
  { id: 'snare', kind: 'snare', color: '#ff8a3d', key: 's' },
  { id: 'kick', kind: 'kick', color: '#ff5d6c', key: 'k' },
  { id: 'floor', kind: 'tom', color: '#9b7bff', key: '3' },
].map((p) => Object.freeze(p)));

export const PAD_IDS = PADS.map((p) => p.id);
const BY_ID = Object.fromEntries(PADS.map((p) => [p.id, p]));
export const padById = (id) => BY_ID[id] || null;

// A computer keyboard plays too: the letter of the drum (k kick, s snare, h hi-hat, c crash, r ride)
// and 1 2 3 for the toms.
export const KEYBOARD_MAP = Object.freeze(Object.fromEntries(PADS.map((p) => [p.key, p.id])));

/**
 * The kit's arrangement, drawn like a real drum kit seen from the drum stool: the bass drum (kick)
 * big and low in the middle with the two toms on top of it, the snare in front of it on the left,
 * the hi-hat on its stand further left, the floor tom on the right, the crash and the ride cymbals
 * above on their stands. Every pad is a rectangle `[x, y, w, h]` in the kit's own units (`w`x`h`);
 * that rectangle is the pad's touch area and the drawing sits inside it.
 *   wide  sideways phones, tablets and desktop: the whole kit as one picture
 *   tall  upright phones: the same kit stacked up (cymbals, toms, hi-hat / snare / floor tom, kick)
 * `kitLayout` scales a kit to the box, x and y each by their own factor but never one more than
 * `STRETCH` times the other (so the kit keeps its shape), and centres it. A box too small for every
 * pad to stay `MIN_PAD` px falls back to a plain grid (`GRIDS`) when that gives bigger pads.
 */
export const KITS = Object.freeze({
  wide: Object.freeze({
    w: 98,
    h: 46,
    pads: Object.freeze({
      crash: [2, 0, 24, 15.5],
      tom1: [31.5, 2.5, 17, 16],
      tom2: [50.5, 2.5, 17, 16],
      ride: [72, 4, 26, 15.5],
      hihat: [0, 17, 19, 16],
      snare: [20, 26, 17, 17],
      kick: [38, 20, 25, 26],
      floor: [64, 24, 20, 20],
    }),
  }),
  tall: Object.freeze({
    w: 60,
    h: 77,
    pads: Object.freeze({
      crash: [0, 0, 27, 17],
      ride: [33, 1.5, 27, 17],
      tom1: [11.5, 18, 18, 17],
      tom2: [30.5, 19.5, 18, 17],
      hihat: [0, 36, 19.5, 17],
      snare: [20.5, 38.5, 19, 17],
      floor: [40.5, 38, 19.5, 18],
      kick: [14, 57, 32, 20],
    }),
  }),
});

/** The plain grids, for a box too small for the kit: four across and two down, or the other way. */
export const GRIDS = Object.freeze({
  wide: Object.freeze({ cols: 4, rows: 2, areas: Object.freeze([['crash', 'tom1', 'tom2', 'ride'], ['hihat', 'snare', 'kick', 'floor']]) }),
  tall: Object.freeze({ cols: 2, rows: 4, areas: Object.freeze([['crash', 'ride'], ['tom1', 'tom2'], ['hihat', 'snare'], ['kick', 'floor']]) }),
});

/** Every pad stays at least this many px in its smallest direction: a small hand hits it. */
export const MIN_PAD = 80;
/** How much more the kit may be stretched one way than the other. */
export const STRETCH = 1.2;

export function kitShape(w, h) {
  return w >= h * 1.1 ? 'wide' : 'tall';
}

const minSide = (cells) => Math.min(...Object.values(cells).map((c) => Math.min(c.w, c.h)));

function placeKit(kit, w, h) {
  let sx = w / kit.w;
  let sy = h / kit.h;
  sx = Math.min(sx, sy * STRETCH);
  sy = Math.min(sy, sx * STRETCH);
  const x0 = (w - kit.w * sx) / 2;
  const y0 = (h - kit.h * sy) / 2;
  const cells = {};
  for (const [id, [x, y, cw, ch]] of Object.entries(kit.pads)) cells[id] = { x: x0 + x * sx, y: y0 + y * sy, w: cw * sx, h: ch * sy };
  return { cells, box: { x: x0, y: y0, w: kit.w * sx, h: kit.h * sy } };
}

function placeGrid(grid, w, h, gap) {
  const cw = (w - gap * (grid.cols - 1)) / grid.cols;
  const ch = (h - gap * (grid.rows - 1)) / grid.rows;
  const cells = {};
  grid.areas.forEach((row, r) => row.forEach((id, c) => (cells[id] = { x: c * (cw + gap), y: r * (ch + gap), w: cw, h: ch })));
  return { cells, box: { x: 0, y: 0, w, h } };
}

/**
 * Where every pad goes in a box of `w`x`h`: `{ shape, cells: { id: { x, y, w, h } }, box }`, with
 * `shape` 'wide' or 'tall' for the kit and 'grid-wide' or 'grid-tall' for the fallback, and `box`
 * the part of the box the kit fills (the stands and the rug are drawn there).
 */
export function kitLayout(w, h, gap = 8) {
  const name = kitShape(w, h);
  const kit = placeKit(KITS[name], w, h);
  if (minSide(kit.cells) >= MIN_PAD) return { shape: name, ...kit };
  const grid = placeGrid(GRIDS[name], w, h, gap);
  return minSide(grid.cells) > minSide(kit.cells) ? { shape: `grid-${name}`, ...grid } : { shape: name, ...kit };
}

/** The touch area of every pad (x, y, w, h) in a box of `w`x`h`. */
export function kitCells(w, h, gap = 8) {
  return kitLayout(w, h, gap).cells;
}

const TOKEN = { K: 'kick', S: 'snare', H: 'hihat', C: 'crash', R: 'ride', 1: 'tom1', 2: 'tom2', 3: 'floor' };

/**
 * "K+H S:.5 ." -> [{ pads: ['kick', 'hihat'], beats: 1 }, { pads: ['snare'], beats: 0.5 }, { pads: [], beats: 1 }].
 * Throws on an unknown pad, an odd length, a pad twice in one step or more than two pads at once.
 */
export function parseRhythm(text) {
  const steps = [];
  for (const tok of text.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const m = /^([^:]+)(?::(\d*\.?\d+))?$/.exec(tok);
    if (!m) throw new Error(`drums: odd step ${JSON.stringify(tok)}`);
    const beats = m[2] === undefined ? 1 : Number(m[2]);
    if (!(beats > 0 && beats <= 4)) throw new Error(`drums: odd length ${JSON.stringify(tok)}`);
    let pads = [];
    if (m[1] !== '.') {
      pads = m[1].split('+').map((p) => {
        if (!TOKEN[p]) throw new Error(`drums: unknown pad ${JSON.stringify(tok)}`);
        return TOKEN[p];
      });
      if (new Set(pads).size !== pads.length) throw new Error(`drums: a pad twice in ${JSON.stringify(tok)}`);
      if (pads.length > 2) throw new Error(`drums: more than two pads in ${JSON.stringify(tok)}`);
    }
    steps.push(Object.freeze({ pads: Object.freeze(pads), beats }));
  }
  return Object.freeze(steps);
}

// The rhythms, easy first within a level. The first of each level is free (meta.js). Names live in
// strings.js as `drums.rhythm.<id>`. "Vader Jacob" follows the tune: low C on the floor tom, D and
// E on the toms, F on the snare, G on the crash, the high notes on the ride.
const RAW = {
  small: [
    { id: 'rock1', bpm: 88, steps: 'K H S H | K H S H | K H S H | K K S:2' },
    { id: 'mars1', bpm: 92, steps: 'K S K S | K S K S:.5 S:.5 | K S K S | K S:.5 S:.5 C:2' },
    { id: 'jacob1', bpm: 96, steps: '3 2 1 3 | 3 2 1 3 | 1 S C:2 | 1 S C:2 | R 3 R:2 | R 3 R:2' },
    { id: 'paard1', bpm: 84, steps: 'K:.75 S:.25 K:.75 S:.25 K:.75 S:.25 K | 1:.75 2:.25 1:.75 2:.25 3 3 | K:.75 S:.25 K:.75 S:.25 C:2' },
  ],
  big: [
    { id: 'rock2', bpm: 100, steps: 'K+H H S+H H | K+H K+H S+H H | K+H H S+H H | K+H K+H S+H:.5 S:.5 K+C' },
    { id: 'mars2', bpm: 108, steps: 'K+S S:.5 S:.5 K+S S | K+S S:.5 S:.5 K+S S:.5 S:.5 | 1 2 3 3:.5 3:.5 | K+S S:.5 S:.5 K+C:2' },
    {
      id: 'jacob2',
      bpm: 104,
      steps: `K+3 2 1 3 | K+3 2 1 3 | K+1 S C:2 | K+1 S C:2 |
              K+C:.5 R:.5 C:.5 S:.5 1 3 | K+C:.5 R:.5 C:.5 S:.5 1 3 | K+R 3 R:2 | K+R 3 K+R:2`,
    },
    {
      id: 'disco2',
      bpm: 112,
      steps: `K:.5 H:.5 K+S:.5 H:.5 K:.5 H:.5 K+S:.5 H:.5 | K:.5 H:.5 K+S:.5 H:.5 K:.5 H:.5 K+S:.5 H:.5 |
              K:.5 H:.5 K+S:.5 H:.5 K:.5 H:.5 K+S:.5 H:.5 | K:.5 H:.5 K+S:.5 H:.5 K+C:2`,
    },
  ],
};

function build(raw, level) {
  const all = parseRhythm(raw.steps);
  let at = 0;
  const steps = [];
  for (const s of all) {
    if (s.pads.length) steps.push(Object.freeze({ pads: s.pads, at, beats: s.beats }));
    at += s.beats;
  }
  return Object.freeze({ id: raw.id, level, bpm: raw.bpm, beats: at, steps: Object.freeze(steps) });
}

export const LEVELS = Object.freeze([
  Object.freeze({ id: 'small', timed: false, rhythms: Object.freeze(RAW.small.map((r) => build(r, 'small'))) }),
  Object.freeze({ id: 'big', timed: true, rhythms: Object.freeze(RAW.big.map((r) => build(r, 'big'))) }),
]);
export const RHYTHMS = Object.freeze(LEVELS.flatMap((l) => l.rhythms));
export const RHYTHM_IDS = RHYTHMS.map((r) => r.id);
export const rhythmById = (id) => RHYTHMS.find((r) => r.id === id) || null;
export const levelOf = (rhythm) => LEVELS.find((l) => l.id === rhythm?.level) || null;

/** One beat in milliseconds. */
export const beatMs = (rhythm, speed = 1) => 60000 / rhythm.bpm / speed;

/**
 * When each step sounds and how long its pads stay lit, in milliseconds from the start, for the
 * listen button. A step is lit a little shorter than its length so a pad hit twice lights twice.
 */
export function schedule(rhythm, speed = 1) {
  const beat = beatMs(rhythm, speed);
  return rhythm.steps.map((s, i) => {
    const next = i + 1 < rhythm.steps.length ? rhythm.steps[i + 1].at : rhythm.beats;
    const gap = (next - s.at) * beat;
    return { pads: s.pads, at: Math.round(s.at * beat), hold: Math.round(Math.max(60, Math.min(gap * 0.75, gap - 50))) };
  });
}

export function rhythmLength(rhythm, speed = 1) {
  return Math.round(rhythm.beats * beatMs(rhythm, speed));
}

/** The count-in: four beats ("1 2 3 4") before the first step. */
export const COUNT_IN = 4;

/** On the beat: a step counts when its pads are hit at most this far from its beat (and never past
 *  the middle between two steps). Generous on purpose: a phone screen is not a drum. */
export const WINDOW_MS = 180;

/** Stars in your own pace: only wrong pads count, gently (like the piano). Never time. */
export function starsFor(misses) {
  if (misses <= 2) return 3;
  if (misses <= 6) return 2;
  return 1;
}

/** Stars on the beat: the share of steps hit in time. 0 means "try again" (no stars saved). */
export function timedStars(good, total) {
  const f = total ? good / total : 0;
  if (f >= 0.8) return 3;
  if (f >= 0.55) return 2;
  if (f >= 0.3) return 1;
  return 0;
}

/**
 * Playing along. `start(now)` begins the count-in; every other call takes the current time.
 *   press(pad, now)  'count' (during the count-in in your own pace: nothing counts), 'part' (one
 *                    pad of a two-pad step), 'step' (the step is complete), 'done' (that was the
 *                    last), 'wrong' (own pace: another pad, counted as a miss, the rhythm waits),
 *                    'again' (a pad of this step hit twice), 'stray' (on the beat: no step near,
 *                    or a pad that is not in it; never counted), 'over', 'idle' (not started)
 *   update(now)      on the beat: steps whose time has passed unplayed become misses
 *   glow(now)        the pads to light up now (the next step, once its beat has come)
 *   lead(now)        on the beat: ms from now to the glowing step's beat (for the approaching ring)
 *   countAt(now)     1..4 during the count-in, else 0
 *   nextChange(now)  when the glow, the count or a miss changes next (null: only a press changes it)
 */
export function createRun(rhythm, { timed = false } = {}) {
  const beat = beatMs(rhythm);
  const steps = rhythm.steps;
  const n = steps.length;
  let t0 = null;
  let index = 0; // own pace: the step to play; on the beat: the first step not yet hit or missed
  let misses = 0;
  let good = 0;
  let strays = 0;
  let hit = new Set(); // the pads of the current step hit so far (own pace)
  const state = steps.map(() => ({ hit: new Set(), status: 'todo' })); // on the beat
  let doneAt = null; // own pace: when the previous step was completed

  const playFrom = () => t0 + COUNT_IN * beat;
  const due = (i) => playFrom() + steps[i].at * beat;
  const gapBefore = (i) => (i > 0 ? (steps[i].at - steps[i - 1].at) * beat : beat);
  const gapAfter = (i) => (i + 1 < n ? (steps[i + 1].at - steps[i].at) * beat : rhythm.beats * beat - steps[i].at * beat);
  const winStart = (i) => due(i) - Math.min(WINDOW_MS, gapBefore(i) / 2);
  const winEnd = (i) => due(i) + Math.min(WINDOW_MS, gapAfter(i) / 2);
  // own pace: the next pad lights up one step-length after the previous step was played
  const readyAt = (i) => (i === 0 ? playFrom() : doneAt + gapBefore(i));

  function settle(now) {
    if (!timed || t0 === null) return [];
    const missed = [];
    while (index < n && state[index].status !== 'todo') index++;
    for (let i = index; i < n && winEnd(i) < now; i++) {
      if (state[i].status === 'todo') {
        state[i].status = 'miss';
        misses++;
        missed.push(i);
      }
    }
    while (index < n && state[index].status !== 'todo') index++;
    return missed;
  }

  return {
    timed,
    get started() {
      return t0 !== null;
    },
    get index() {
      return index;
    },
    get misses() {
      return misses;
    },
    get good() {
      return good;
    },
    get strays() {
      return strays;
    },
    get total() {
      return n;
    },
    get done() {
      return index >= n;
    },
    start(now) {
      t0 = now;
      index = 0;
      misses = 0;
      good = 0;
      strays = 0;
      hit = new Set();
      doneAt = null;
      for (const s of state) {
        s.hit = new Set();
        s.status = 'todo';
      }
    },
    /** The time of step `i`'s beat (on the beat), for the tests and the test hook. */
    due(i) {
      return t0 === null || i >= n ? null : due(i);
    },
    /** The pads of the step being played (or the next one on the beat), for the strip and the hook. */
    target() {
      return index < n ? steps[index].pads : null;
    },
    stepState(i) {
      if (timed) return state[i].status;
      return i < index ? 'hit' : 'todo';
    },
    countAt(now) {
      if (t0 === null || now < t0 || now >= playFrom()) return 0;
      return Math.floor((now - t0) / beat) + 1;
    },
    press(pad, now) {
      if (t0 === null) return 'idle';
      if (!timed) {
        if (index >= n) return 'over';
        if (now < playFrom()) return 'count';
        const want = steps[index].pads;
        if (!want.includes(pad)) {
          if (index > 0 && steps[index - 1].pads.includes(pad) && now - doneAt < 250) return 'again'; // a double tap
          misses++;
          return 'wrong';
        }
        if (hit.has(pad)) return 'again';
        hit.add(pad);
        if (hit.size < want.length) return 'part';
        hit = new Set();
        index++;
        doneAt = now;
        return index >= n ? 'done' : 'step';
      }
      settle(now);
      if (index >= n) return 'over';
      for (let i = index; i < n && winStart(i) <= now; i++) {
        if (state[i].status !== 'todo' || now > winEnd(i)) continue;
        if (!steps[i].pads.includes(pad)) break;
        if (state[i].hit.has(pad)) return 'again';
        state[i].hit.add(pad);
        if (state[i].hit.size < steps[i].pads.length) return 'part';
        state[i].status = 'hit';
        good++;
        settle(now);
        return index >= n ? 'done' : 'step';
      }
      strays++;
      return 'stray';
    },
    update(now) {
      return settle(now);
    },
    glow(now) {
      if (t0 === null || index >= n) return [];
      if (!timed) return now >= readyAt(index) ? steps[index].pads.filter((p) => !hit.has(p)) : [];
      settle(now);
      if (index >= n || now < due(index) - gapBefore(index)) return [];
      return steps[index].pads.filter((p) => !state[index].hit.has(p));
    },
    lead(now) {
      if (!timed || t0 === null || index >= n) return 0;
      return Math.max(0, due(index) - now);
    },
    nextChange(now) {
      if (t0 === null || index >= n) return null;
      if (now < playFrom()) {
        const nextBeat = t0 + (Math.floor((now - t0) / beat) + 1) * beat;
        const glowFrom = due(index) - gapBefore(index); // on the beat, the first ring starts on "4"
        return timed && glowFrom > now ? Math.min(nextBeat, glowFrom) : nextBeat;
      }
      if (!timed) return now < readyAt(index) ? readyAt(index) : null;
      settle(now);
      if (index >= n) return now;
      const glowFrom = due(index) - gapBefore(index);
      return now < glowFrom ? glowFrom : winEnd(index) + 1;
    },
  };
}
