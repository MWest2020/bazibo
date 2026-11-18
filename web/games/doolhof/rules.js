// Egeltje's rules, pure (no DOM, no sound, no clock), so the tests can play whole rounds. A little
// hedgehog walks through a garden maze and picks up letters (or numbers) in order:
//   abc    the alphabet in order (a b c d e for the youngest, the whole alphabet for the oldest)
//   word   the letters of a pictured word, word after word
//   count  numbers in order (1-5, 1-10, then counting in twos up to 20)
// A tier is harder by what must be told apart and how much is given, never by speed: tier 1 has
// plain wrong letters (an x among a-e), tier 2 look-alikes (a d or a q next to the b), tier 3
// mirrored look-alikes first (b d p q) and, for words, the picture only. The board only ever holds
// one tile per letter; letters further on appear when they are near (WINDOW).
//
// Nothing is ever lost:
//   - a wrong letter is a soft bump: the hedgehog stays where it was, the letter stays where it is,
//     and the round counts one mistake for that letter (once). After two bumps the right one glows.
//     A walk going on by itself stops in front of a wrong letter; only a chosen step bumps.
//   - a crow is a friendly obstacle. A walk never runs into one: the hedgehog stops politely in
//     front of it, also when the crow stepped in front of it during the walk. Only a step straight into a crow touches it: the hedgehog curls up for a moment
//     and rolls back to the start of its corridor (at most ROLLBACK cells), and the crow flies off to
//     the far side of the garden. No letters are lost and stars do not count crows.
//   - stars count wrong letters only (letters' starsFor), never time and never crows.
import { makeMaze, beside, stepFrom, exits, neighbours, distances, firstStep, OPPOSITE } from './maze.js';
import { rng, hashSeed, starsFor } from '../letters/round.js';
import { ALPHABET, BUILD, similar, lookalike, pictureOf } from '../letters/words.js';

export { hashSeed, starsFor };
export const MODES = Object.freeze(['abc', 'word', 'count']);
export const TIER_IDS = Object.freeze(['t1', 't2', 't3']);
export const ROUNDS_PER_TIER = 3;
export const AGES = Object.freeze({ t1: '4-5', t2: '5-6', t3: '6-8' });
/** The garden in cells, [short, long]: upright on an upright screen, lying down on a sideways one. */
export const SIZES = Object.freeze({ t1: Object.freeze([5, 6]), t2: Object.freeze([5, 7]), t3: Object.freeze([6, 8]) });
export const CROWS = Object.freeze({ t1: 1, t2: 1, t3: 2 });
/** How slowly the crows walk: milliseconds per step (the controller's clock). */
export const CROW_MS = Object.freeze({ t1: 1100, t2: 950, t3: 850 });
/** How many of the next letters are on the board at once (word: the whole word). */
export const WINDOW = Object.freeze({ abc: Object.freeze({ t1: 5, t2: 5, t3: 6 }), count: Object.freeze({ t1: 5, t2: 5, t3: 5 }) });
/** Wrong tiles on the board. */
export const DECOYS = Object.freeze({
  abc: Object.freeze({ t1: 2, t2: 3, t3: 4 }),
  word: Object.freeze({ t1: 2, t2: 2, t3: 3 }),
  count: Object.freeze({ t1: 2, t2: 3, t3: 3 }),
});
/** Word: how the word is shown. ghost: every letter faint with the next one big, word: the word only, picture: the picture only. */
export const WORD_HINT = Object.freeze({ t1: 'ghost', t2: 'word', t3: 'picture' });
export const WORDS_PER_ROUND = 3;
export const ROLLBACK = 3; // cells a crow touch rolls the hedgehog back, at most
export const DETOUR = 4; // the guide walks round a crow when that is at most this many steps longer
export const HELP_AFTER = 2; // bumps on one letter before the right tile glows
/** The alphabet runs per round: [from, to) in ALPHABET. Random rounds of tier 2 take any 10 in a row. */
export const ABC_RUNS = Object.freeze({
  t1: [[0, 5], [0, 5], [0, 5]],
  t2: [[0, 10], [10, 20], [16, 26]],
  t3: [[0, 26], [0, 26], [0, 26]],
});
const COUNTS = Object.freeze({
  t1: ['1', '2', '3', '4', '5'],
  t2: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  t3: ['2', '4', '6', '8', '10', '12', '14', '16', '18', '20'],
});
/** Words of tier 3: longer, each with a picture in Letters' art. */
export const LONG_WORDS = Object.freeze({
  nl: ['bloem', 'vogel', 'appel', 'raket', 'wortel', 'banaan', 'olifant'],
  en: ['flower', 'apple', 'rocket', 'carrot', 'banana', 'grapes', 'elephant'],
});
/** Numbers that look alike (turned, mirrored or the digits swapped). */
export const NUMBER_LOOKALIKE = Object.freeze({
  1: ['7'], 2: ['5'], 3: ['8'], 4: ['9'], 5: ['2'], 6: ['9'], 7: ['1'], 8: ['3'], 9: ['6', '4'], 10: ['16', '19'],
  12: ['21'], 13: ['31'], 14: ['41'], 16: ['19', '61'], 18: ['81'], 20: ['21', '19'],
});
// tier 1 counting (1-5): wrong numbers that look like none of them (no 7 next to the 1, no 8 next to the 3)
const PLAIN_NUMBERS = ['6', '0', '10', '20'];

/** The words of one tier in one language. */
export function wordList(lang, tier) {
  const build = BUILD[lang] || BUILD.nl;
  if (tier === 't1') return [...build.t1];
  if (tier === 't2') return [...build.t2];
  return [...(LONG_WORDS[lang] || LONG_WORDS.nl)];
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * What a round asks for: `seq` (the values in order) and, for words, `words`
 * ([{ word, picture, from, to }]: seq[from..to) spells the word). `round` is 1-3, or 0 for random.
 */
export function sequenceFor({ mode, tier, lang = 'nl', round = 1 }, rand) {
  if (mode === 'count') return { seq: [...COUNTS[tier]], words: [] };
  if (mode === 'abc') {
    let [a, b] = ABC_RUNS[tier][Math.max(0, round - 1) % ROUNDS_PER_TIER];
    if (!round && tier === 't2') {
      a = Math.floor(rand() * 17);
      b = a + 10;
    }
    return { seq: ALPHABET.slice(a, b), words: [] };
  }
  const picked = shuffle(wordList(lang, tier), rand).slice(0, WORDS_PER_ROUND);
  const seq = [];
  const words = picked.map((word) => {
    const from = seq.length;
    seq.push(...word.split(''));
    return { word, picture: pictureOf(lang, word), from, to: seq.length };
  });
  return { seq, words };
}

/** The seed of a fixed round: the same garden every time in this language and orientation. */
export const roundSeed = (id, lang, landscape) => hashSeed(`doolhof:${lang}:${id}:${landscape ? 'side' : 'up'}`);

/**
 * A new round. `seed` decides the garden, where the tiles land and how the crows walk. The hedgehog
 * starts in the middle; the crows start far away.
 */
export function createRound({ mode, tier, lang = 'nl', seed = 1, landscape = false, round = 1 }) {
  const rand = rng(seed);
  const [short, long] = SIZES[tier];
  const cols = landscape ? long : short;
  const rows = landscape ? short : long;
  const { seq, words } = sequenceFor({ mode, tier, lang, round }, rand);
  const start = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  let state = null;
  // a garden where every tile of the start fits (a tight one makes way for the next try)
  for (let attempt = 0; attempt < 40; attempt++) {
    state = {
      mode,
      tier,
      lang,
      maze: makeMaze(cols, rows, rand),
      cols,
      rows,
      seq,
      words,
      i: 0,
      tiles: [], // { cell, value }
      hog: start,
      start,
      face: 'right', // the way the hedgehog looks: left or right
      dir: null, // the last way it stepped
      trail: [start], // where it walked, for rolling back
      crows: [], // { cell, prev, face }
      missed: {}, // seq index -> true once a wrong letter was bumped for it
      mistakes: 0,
      bumps: 0, // wrong bumps for the letter it is looking for now (help after HELP_AFTER)
      touches: 0,
      curled: false,
      started: false,
      over: false,
      rand,
    };
    refill(state);
    if (state.tiles.length === new Set(seq.slice(0, windowEnd(state))).size + DECOYS[mode][tier]) break;
  }
  for (let k = 0; k < CROWS[tier]; k++) {
    const cell = farCell(state);
    if (cell >= 0) state.crows.push({ cell, prev: -1, face: 'left' });
  }
  return state;
}

// ---------- what is where ----------

export const tileAt = (state, cell) => state.tiles.find((t) => t.cell === cell) || null;
export const crowAt = (state, cell) => state.crows.findIndex((c) => c.cell === cell);
/** The value to pick up now (null when the round is over). */
export const expected = (state) => (state.over ? null : state.seq[state.i]);
export const targetTile = (state) => state.tiles.find((t) => t.value === expected(state)) || null;
/** The word being spelled now (word rounds), with how many of its letters are done. */
export function currentWord(state) {
  if (state.mode !== 'word') return null;
  const k = state.words.findIndex((w) => state.i < w.to);
  const index = k < 0 ? state.words.length - 1 : k;
  const w = state.words[index];
  return { ...w, index, done: Math.min(state.i, w.to) - w.from };
}
/** The end of the stretch of seq that is on the board (exclusive). */
export function windowEnd(state) {
  if (state.mode === 'word') return currentWord(state)?.to ?? state.seq.length;
  return Math.min(state.seq.length, state.i + WINDOW[state.mode][state.tier]);
}
/** Should the right tile glow? After HELP_AFTER bumps for this letter. */
export const helpOn = (state) => !state.over && state.bumps >= HELP_AFTER;

/**
 * Can `extra` (a cell) take a tile? Every cell without a tile must stay reachable from the
 * hedgehog, and every tile must keep an open side to such a cell, so no tile ever cuts the garden
 * in two and every letter can be reached without walking over another.
 */
export function placementOk(state, extra = -1) {
  const lettered = new Set(state.tiles.map((t) => t.cell));
  if (extra >= 0) lettered.add(extra);
  if (lettered.has(state.hog)) return false;
  const dist = distances(state.maze, state.hog, lettered);
  const n = state.cols * state.rows;
  for (let c = 0; c < n; c++) {
    if (lettered.has(c)) {
      if (!neighbours(state.maze, c).some((x) => !lettered.has(x))) return false;
    } else if (dist[c] < 0) return false;
  }
  return true;
}

/** Put a tile with `value` somewhere it fits, not too close to the hedgehog. False if it cannot. */
function place(state, value) {
  const dist = distances(state.maze, state.hog);
  const n = state.cols * state.rows;
  const free = shuffle([...Array(n).keys()], state.rand).filter((c) => c !== state.hog && !tileAt(state, c) && crowAt(state, c) < 0);
  for (const min of [2, 1]) {
    const cell = free.find((c) => dist[c] >= min && placementOk(state, c));
    if (cell !== undefined) {
      state.tiles.push({ cell, value });
      return true;
    }
  }
  return false;
}

const letterLooks = (l) => [...lookalike(l), ...similar(l)];
const numberLooks = (v) => NUMBER_LOOKALIKE[v] || [];

/**
 * Tier 1 wrong tiles are plain: never a value of the round (for words: of the word being spelled)
 * and never one that looks like one of them, either way round (a z is never next to the s of
 * "vis", a 7 never next to the 1). Tested on every step of every tier 1 round.
 */
export function plainOk(state, value) {
  const win = state.seq.slice(state.i, windowEnd(state));
  const base = state.mode === 'word' ? win : state.seq;
  if (base.includes(value)) return false;
  const looks = state.mode === 'count' ? numberLooks : letterLooks;
  return !base.some((v) => looks(v).includes(value) || looks(value).includes(v));
}

/** Wrong values that fit this tier, best first (look-alikes of what is on the board now). */
function decoyValues(state) {
  const win = state.seq.slice(state.i, windowEnd(state));
  const on = new Set(state.tiles.map((t) => t.value));
  const ok = (v) => !win.includes(v) && !on.has(v);
  const r = state.rand;
  if (state.mode === 'count') {
    if (state.tier === 't1') return shuffle(PLAIN_NUMBERS, r).filter((v) => ok(v) && plainOk(state, v));
    const near = state.tier === 't3' ? win.flatMap((v) => [String(+v - 1), String(+v + 1)]) : [];
    const looks = win.flatMap((v) => NUMBER_LOOKALIKE[v] || []);
    const spare = Array.from({ length: 11 }, (_, k) => String(k + 10));
    return [...new Set([...shuffle(near, r), ...shuffle(looks, r), ...shuffle(spare, r)])].filter(ok);
  }
  const letters = [...new Set(win)];
  if (state.tier === 't1') {
    return shuffle(ALPHABET, r).filter((l) => ok(l) && plainOk(state, l));
  }
  const mirrored = state.tier === 't3' ? shuffle(letters.flatMap(lookalike), r) : [];
  const shaped = shuffle(letters.flatMap((l) => similar(l)), r);
  return [...new Set([...mirrored, ...shaped, ...shuffle(ALPHABET, r)])].filter(ok);
}

/** Put the next letters of the window on the board (one tile per value), then the wrong ones. */
export function refill(state) {
  const end = windowEnd(state);
  for (let k = state.i; k < end; k++) {
    const v = state.seq[k];
    if (!state.tiles.some((t) => t.value === v)) place(state, v);
  }
  const want = DECOYS[state.mode][state.tier];
  const win = new Set(state.seq.slice(state.i, end));
  let have = state.tiles.filter((t) => !win.has(t.value)).length;
  for (const v of decoyValues(state)) {
    if (have >= want) break;
    if (place(state, v)) have++;
  }
}

/** A free cell far from the hedgehog (for a crow): no tile, no crow, among the farthest few. */
function farCell(state, skip = -1) {
  const dist = distances(state.maze, state.hog);
  const n = state.cols * state.rows;
  const free = [];
  for (let c = 0; c < n; c++) if (c !== state.hog && !tileAt(state, c) && crowAt(state, c) < 0 && c !== skip && dist[c] >= 0) free.push(c);
  if (!free.length) return -1;
  free.sort((a, b) => dist[b] - dist[a] || a - b);
  const top = free.filter((c) => dist[c] >= dist[free[0]] - 1).slice(0, 4);
  return top[Math.floor(state.rand() * top.length)];
}

// ---------- moving ----------

/**
 * One step of the hedgehog. Returns what happened:
 *   { type: 'wait' }                  curled up, or the round is over
 *   { type: 'blocked' }               a hedge
 *   { type: 'stop' }                  `auto` (a walk going on by itself): a crow or a wrong tile ahead
 *   { type: 'move' }
 *   { type: 'eat', value, word }      the right tile; `word` true when a word was finished
 *   { type: 'done', value }           the last one: the round is over
 *   { type: 'wrong', value, want }    a wrong tile: a bump, nothing moves
 *   { type: 'crow', crow, back }      walked into a crow: curled up and rolled back `back` cells
 */
export function stepHog(state, dir, { auto = false } = {}) {
  if (state.over || state.curled) return { type: 'wait' };
  const to = stepFrom(state.maze, state.hog, dir);
  if (to < 0) return { type: 'blocked' };
  // a walk going on by itself never walks into a crow (it may have stepped in since) or a wrong
  // tile: only a step the child chose counts
  if (auto && !freeAhead(state, to)) return { type: 'stop' };
  if (dir === 'left' || dir === 'right') state.face = dir;
  state.started = true;
  state.dir = dir;
  const crow = crowAt(state, to);
  if (crow >= 0) return touchCrow(state, crow);
  const tile = tileAt(state, to);
  if (tile && tile.value !== expected(state)) {
    if (!state.missed[state.i]) {
      state.missed[state.i] = true;
      state.mistakes++;
    }
    state.bumps++;
    return { type: 'wrong', value: tile.value, want: expected(state) };
  }
  state.hog = to;
  state.trail.push(to);
  if (state.trail.length > 64) state.trail.splice(0, state.trail.length - 64);
  if (!tile) return { type: 'move' };
  state.tiles.splice(state.tiles.indexOf(tile), 1);
  const before = currentWord(state);
  state.i++;
  state.bumps = 0;
  if (state.i >= state.seq.length) {
    state.over = true;
    return { type: 'done', value: tile.value };
  }
  const word = !!before && state.i >= before.to;
  if (word && state.tier === 't1') {
    // a new word: the old word's plain wrong tiles may look like the new word's letters; they go
    const win = new Set(state.seq.slice(state.i, windowEnd(state)));
    state.tiles = state.tiles.filter((t) => win.has(t.value) || plainOk(state, t.value));
  }
  refill(state);
  return { type: 'eat', value: tile.value, word };
}

/** Is `cell` free for a walk going on by itself: no crow, and no tile but the right one? */
function freeAhead(state, cell) {
  if (crowAt(state, cell) >= 0) return false;
  const tile = tileAt(state, cell);
  return !tile || tile.value === expected(state);
}

/**
 * Where a walk goes on after a step `dir`: straight on or round a bend, but it stops at a crossing
 * (more than one new way), at a hedge, in front of a crow or a wrong tile, and after a tile (null:
 * stop). The controller takes the steps it gives with `auto`, so a crow that steps in between
 * stops the walk too.
 */
export function continueDir(state, dir) {
  if (state.over || state.curled || !dir) return null;
  const ways = exits(state.maze, state.hog).filter((d) => d !== OPPOSITE[dir]);
  if (ways.length !== 1) return null;
  return freeAhead(state, beside(state.maze, state.hog, ways[0])) ? ways[0] : null;
}

function touchCrow(state, k) {
  state.touches++;
  state.curled = true;
  // roll back along the trail, at most ROLLBACK cells, stopping at a crossing
  let back = 0;
  while (back < ROLLBACK && state.trail.length > 1) {
    const prev = state.trail[state.trail.length - 2];
    if (tileAt(state, prev) || crowAt(state, prev) >= 0) break;
    state.trail.pop();
    state.hog = prev;
    back++;
    if (exits(state.maze, prev).length >= 3) break;
  }
  // the crow flies off to the far side of the garden
  const crow = state.crows[k];
  const to = farCell(state, crow.cell);
  if (to >= 0) {
    crow.cell = to;
    crow.prev = -1;
  }
  return { type: 'crow', crow: k, back };
}

/** The hedgehog uncurls (the controller calls this after a moment). */
export function uncurl(state) {
  state.curled = false;
}

/**
 * The crows take one step each: on, not back the way they came unless they must, never onto the
 * hedgehog, a tile or another crow. They only walk once the hedgehog has started.
 */
export function stepCrows(state) {
  if (state.over || !state.started) return;
  for (const crow of state.crows) {
    const ways = exits(state.maze, crow.cell).filter((d) => {
      const to = beside(state.maze, crow.cell, d);
      return to !== state.hog && !tileAt(state, to) && crowAt(state, to) < 0;
    });
    const onward = ways.filter((d) => beside(state.maze, crow.cell, d) !== crow.prev);
    const pick = (onward.length ? onward : ways)[Math.floor(state.rand() * (onward.length || ways.length))];
    if (!pick) {
      crow.prev = -1;
      continue;
    }
    if (pick === 'left' || pick === 'right') crow.face = pick;
    crow.prev = crow.cell;
    crow.cell = beside(state.maze, crow.cell, pick);
  }
}

/**
 * The tests' and the smoke test's guide: the first direction of a shortest way to the right tile,
 * around the other tiles, and around the crows when that is possible.
 */
export function pathDirection(state) {
  const target = targetTile(state);
  if (!target || state.over) return null;
  const others = new Set(state.tiles.filter((t) => t !== target).map((t) => t.cell));
  const crows = new Set(state.crows.map((c) => c.cell));
  const direct = distances(state.maze, target.cell, (c) => c !== state.hog && others.has(c))[state.hog];
  const around = distances(state.maze, target.cell, (c) => c !== state.hog && (others.has(c) || crows.has(c)))[state.hog];
  if (around >= 0 && around <= direct + DETOUR) return firstStep(state.maze, state.hog, target.cell, (c) => others.has(c) || crows.has(c));
  return firstStep(state.maze, state.hog, target.cell, others);
}
