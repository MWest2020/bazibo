// Slangetje's rules, without any drawing, so they can be tested. A round is a grid, a snake and the
// things it has to eat in order:
//   count    numbered fruits, eaten in order (1, 2, 3 … or 2, 4, 6 …, or counting down)
//   letters  the letters of a short word, eaten in order; the word comes with a picture
//   colors   only the fruit of the shown colour (every colour has its own shape too)
// Eating the wrong thing is never a game over: a gentle "oops", the snake gets one shorter and the
// fruit hops to another spot. The youngest tier wraps around the edges and the snake passes
// through itself; the oldest tier has walls and bumping into yourself ends the round.
//
// Coordinates are [row, col]. A level's `size` is [short, long]: the board stands upright on an
// upright phone (cols = short, rows = long) and lies down on a sideways one (cols = long, rows =
// short). Walls are given for the upright board and turned with it.

export const DIRS = Object.freeze({ up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] });
export const OPPOSITE = Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' });
export const MODES = Object.freeze(['count', 'letters', 'colors']);

// What each age tier changes. `window`: how many of the next things lie on the board at once.
// `help`: the next thing to eat gets a soft ring (for children who cannot read numbers yet).
export const TIERS = Object.freeze({
  tiny: Object.freeze({ age: 3, wrap: true, selfHit: false, window: Infinity, help: true, timed: false }),
  small: Object.freeze({ age: 5, wrap: true, selfHit: false, window: 5, help: false, timed: true }),
  big: Object.freeze({ age: 7, wrap: false, selfHit: true, window: 5, help: false, timed: true }),
});
export const START_LENGTH = 3;
export const MAX_QUEUE = 2; // turns typed ahead (a quick double swipe around a corner)

// The words for the letters rounds, per language, with the picture that goes with them.
export const WORDS = Object.freeze({
  egg: Object.freeze({ nl: 'EI', en: 'EGG' }),
  sun: Object.freeze({ nl: 'ZON', en: 'SUN' }),
  ball: Object.freeze({ nl: 'BAL', en: 'BALL' }),
  fish: Object.freeze({ nl: 'VIS', en: 'FISH' }),
  dog: Object.freeze({ nl: 'HOND', en: 'DOG' }),
  pear: Object.freeze({ nl: 'PEER', en: 'PEAR' }),
  apple: Object.freeze({ nl: 'APPEL', en: 'APPLE' }),
  flower: Object.freeze({ nl: 'BLOEM', en: 'FLOWER' }),
  grapes: Object.freeze({ nl: 'DRUIVEN', en: 'GRAPES' }),
  banana: Object.freeze({ nl: 'BANAAN', en: 'BANANA' }),
  carrot: Object.freeze({ nl: 'WORTEL', en: 'CARROT' }),
});

export const tierOf = (level) => TIERS[level.tier] || TIERS.tiny;
export const wrapOf = (level) => (typeof level.wrap === 'boolean' ? level.wrap : tierOf(level).wrap);
export const selfHitOf = (level) => tierOf(level).selfHit;
const key = (r, c) => `${r},${c}`;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

/** The numbers of a counting level: from, to, step (a negative step counts down). */
export function countSequence({ from = 1, to, step = 1 }) {
  const out = [];
  if (!step) return out;
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v);
  return out;
}

/** The letters of a letters level in one language, word after word. */
export function letterSequence(level, lang) {
  return level.words.flatMap((w) => [...(WORDS[w]?.[lang] || WORDS[w]?.nl || '')]);
}

/** For each letter of the sequence: which word it belongs to. */
export function wordIndexes(level, lang) {
  return level.words.flatMap((w, i) => [...(WORDS[w]?.[lang] || '')].map(() => i));
}

/** The colour to eat for every fruit of a colours level: one colour, or a new one every `switchEvery`. */
export function colorTargets(level, rng = Math.random) {
  const palette = level.palette;
  const out = [];
  let current = Math.floor(rng() * palette);
  for (let i = 0; i < level.eat; i++) {
    if (i > 0 && level.switchEvery && i % level.switchEvery === 0) {
      const next = Math.floor(rng() * (palette - 1));
      current = next >= current ? next + 1 : next; // always a different colour
    }
    out.push(current);
  }
  return out;
}

/**
 * On a small screen the biggest boards get two rows and two columns fewer, so the numbers and
 * letters stay readable (review of PR #12). Only boards of 13 wide or more shrink.
 */
export const COMPACT_SHRINK = 2;
export const canCompact = (level) => level.size[0] >= 13;
/** The level's [short, long] size, compact or not. */
export function sizeOf(level, compact = false) {
  const [short, long] = level.size;
  return compact && canCompact(level) ? [short - COMPACT_SHRINK, long - COMPACT_SHRINK] : [short, long];
}

/** Columns and rows for this round: upright on an upright screen, lying down on a sideways one. */
export function gridSize(level, landscape = false, compact = false) {
  const [short, long] = sizeOf(level, compact);
  return landscape ? { cols: long, rows: short } : { cols: short, rows: long };
}

/**
 * The level's walls on this round's board (given for the upright board). On a compact board the
 * walls in the far half move in with the edge, so a corner stays a corner.
 */
export function wallCells(level, landscape = false, compact = false) {
  const [short, long] = level.size;
  const shrink = compact && canCompact(level) ? COMPACT_SHRINK : 0;
  return (level.walls || [])
    .map(([r, c]) => [r >= long / 2 ? r - shrink : r, c >= short / 2 ? c - shrink : c])
    .map(([r, c]) => (landscape ? [c, r] : [r, c]));
}

/** Where the snake starts: in the middle, three long, facing up (upright) or right (sideways). */
export function startSnake(cols, rows, landscape = false) {
  if (landscape) {
    const r = Math.floor(rows / 2);
    const c = Math.floor(cols * 0.4);
    return { dir: 'right', snake: Array.from({ length: START_LENGTH }, (_, i) => [r, c - i]) };
  }
  const r = Math.floor(rows * 0.6);
  const c = Math.floor(cols / 2);
  return { dir: 'up', snake: Array.from({ length: START_LENGTH }, (_, i) => [r + i, c]) };
}

/** A new round. `rng` decides where things appear (and the colours); tests pass a seeded one. */
export function createRound(level, { lang = 'nl', rng = Math.random, landscape = false, compact = false } = {}) {
  const { cols, rows } = gridSize(level, landscape, compact);
  const { dir, snake } = startSnake(cols, rows, landscape);
  const state = {
    level,
    mode: level.mode,
    lang,
    cols,
    rows,
    wrap: wrapOf(level),
    selfHit: selfHitOf(level),
    walls: new Set(wallCells(level, landscape, compact).map(([r, c]) => key(r, c))),
    compact: compact && canCompact(level),
    snake,
    dir,
    queue: [],
    started: false,
    seq: [],
    words: [],
    idx: 0,
    items: [],
    nextId: 1,
    mistakes: 0,
    steps: 0,
    over: null, // 'done' | 'crash'
  };
  if (level.mode === 'count') state.seq = countSequence(level);
  else if (level.mode === 'letters') {
    state.seq = letterSequence(level, lang);
    state.words = wordIndexes(level, lang);
  } else state.seq = colorTargets(level, rng);
  refill(state, rng);
  return state;
}

export const total = (state) => state.seq.length;
/** What the snake has to eat next: a number, a letter or a colour index. */
export const expected = (state) => state.seq[state.idx];
export const isCorrect = (state, item) => item.value === expected(state);

/** For a letters round: the word being spelled now, and how far it is. */
export function currentWord(state) {
  if (state.mode !== 'letters') return null;
  const w = state.words[Math.min(state.idx, state.words.length - 1)];
  const start = state.words.indexOf(w);
  const end = state.words.lastIndexOf(w) + 1;
  return { index: w, id: state.level.words[w], letters: state.seq.slice(start, end), done: Math.min(state.idx, end) - start };
}

/** The values that should lie on the board now. */
export function wanted(state) {
  const tier = tierOf(state.level);
  if (state.mode === 'letters') {
    const w = currentWord(state);
    if (!w) return [];
    return w.letters.slice(w.done);
  }
  if (state.mode === 'count') return state.seq.slice(state.idx, state.idx + (Number.isFinite(tier.window) ? tier.window : state.seq.length));
  // colours: a few fruits of the palette, at least two of the colour to eat
  const n = Math.max(4, state.level.palette + 1);
  const target = expected(state);
  const have = state.items.map((it) => it.value);
  const out = have.slice();
  while (out.filter((v) => v === target).length < 2) out.push(target);
  while (out.length < n) out.push(-1); // -1: any colour, picked when it is placed
  return out;
}

/** The cells right in front of the head (where something must not pop up out of nowhere). */
function aheadCells(state, n = 2) {
  const out = [];
  // the way it goes now, and the way it will go after the turns typed ahead (review of PR #12)
  const paths = [Array(n).fill(state.dir)];
  if (state.queue.length) paths.push([...state.queue, ...Array(n).fill(state.queue[state.queue.length - 1])].slice(0, n));
  for (const path of paths) {
    let [r, c] = state.snake[0];
    for (const d of path) {
      const [dr, dc] = DIRS[d];
      r += dr;
      c += dc;
      if (state.wrap) {
        r = (r + state.rows) % state.rows;
        c = (c + state.cols) % state.cols;
      }
      out.push(key(r, c));
    }
  }
  return out;
}

/**
 * A free cell for a new thing: not on a wall, the snake or another thing, and not right in front of
 * the head (also after a turn typed ahead). Preferably a roomy spot: not next to another thing and
 * not in a pocket, so a needed thing is never fenced in by wrong ones (the snake would have to eat
 * a wrong one to get there).
 */
export function spawnCell(state, rng = Math.random) {
  const walls = state.walls;
  const items = new Set(state.items.map((it) => key(it.r, it.c)));
  const taken = new Set([...walls, ...items]);
  for (const [r, c] of state.snake) taken.add(key(r, c));
  const ahead = new Set(aheadCells(state));
  const roomy = [];
  const free = [];
  const loose = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const k = key(r, c);
      if (taken.has(k)) continue;
      loose.push([r, c]);
      if (ahead.has(k)) continue;
      free.push([r, c]);
      let open = 0;
      let nearItem = false;
      for (const d of Object.keys(DIRS)) {
        const n = nextCell(state, [r, c], d);
        if (!n) continue;
        const nk = key(n[0], n[1]);
        if (items.has(nk)) nearItem = true;
        else if (!walls.has(nk)) open++;
      }
      if (!nearItem && open >= 3) roomy.push([r, c]);
    }
  }
  const pool = roomy.length ? roomy : free.length ? free : loose;
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

function place(state, value, rng) {
  const cell = spawnCell(state, rng);
  if (!cell) return null;
  const v = value === -1 ? Math.floor(rng() * state.level.palette) : value;
  const item = { id: state.nextId++, r: cell[0], c: cell[1], value: v };
  state.items.push(item);
  return item;
}

/** Put on the board what is missing (only adds; things leave the board by being eaten). */
export function refill(state, rng = Math.random) {
  if (state.over) return;
  const want = wanted(state);
  if (state.mode === 'colors') {
    const target = expected(state);
    let targets = state.items.filter((it) => it.value === target).length;
    while (targets < 2) {
      if (!place(state, target, rng)) return;
      targets++;
    }
    while (state.items.length < want.length) if (!place(state, -1, rng)) return;
    return;
  }
  const have = state.items.map((it) => it.value);
  for (const v of want) {
    const i = have.indexOf(v);
    if (i >= 0) have.splice(i, 1);
    else if (!place(state, v, rng)) return;
  }
}

/**
 * Change direction. Never straight back into the body, at most MAX_QUEUE turns ahead. The first
 * direction (or the one the snake already faces) starts the round. Returns true if it counted.
 */
export function turn(state, dir) {
  if (!DIRS[dir] || state.over) return false;
  const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
  if (dir === last) {
    if (state.started) return false;
    state.started = true; // the direction it already faces: off it goes
    return true;
  }
  if (dir === OPPOSITE[last]) return false;
  if (state.queue.length >= MAX_QUEUE) return false;
  state.queue.push(dir);
  state.started = true;
  return true;
}

/** Where the head goes next in direction `dir`, or null when that is off a board without wrap. */
export function nextCell(state, [r, c], dir) {
  const [dr, dc] = DIRS[dir];
  let nr = r + dr;
  let nc = c + dc;
  if (state.wrap) {
    nr = (nr + state.rows) % state.rows;
    nc = (nc + state.cols) % state.cols;
  } else if (nr < 0 || nc < 0 || nr >= state.rows || nc >= state.cols) return null;
  return [nr, nc];
}

/**
 * One step forward. Returns what happened, in order: { type: 'eat', value }, { type: 'oops',
 * value }, { type: 'done' } or { type: 'crash', at }. Nothing happens before the round started.
 */
export function step(state, rng = Math.random) {
  if (state.over || !state.started) return [];
  if (state.queue.length) state.dir = state.queue.shift();
  const events = [];
  const head = state.snake[0];
  const next = nextCell(state, head, state.dir);
  if (!next || state.walls.has(key(next[0], next[1]))) {
    state.over = 'crash';
    events.push({ type: 'crash', at: next || head });
    return events;
  }
  const item = state.items.find((it) => it.r === next[0] && it.c === next[1]);
  const good = !!item && isCorrect(state, item);
  // the tail moves out of the way this step, unless the snake grows
  const body = good ? state.snake : state.snake.slice(0, -1);
  if (state.selfHit && body.some((s) => same(s, next))) {
    state.over = 'crash';
    events.push({ type: 'crash', at: next });
    return events;
  }
  state.snake.unshift(next);
  if (!good) state.snake.pop();
  state.steps++;
  if (item && good) {
    state.items = state.items.filter((it) => it !== item);
    state.idx++;
    events.push({ type: 'eat', value: item.value });
    if (state.idx >= total(state)) {
      state.over = 'done';
      events.push({ type: 'done' });
    } else refill(state, rng);
  } else if (item) {
    state.mistakes++;
    if (state.snake.length > 2) state.snake.pop(); // one shorter, never a game over
    // the fruit hops to another free spot (it is still needed later, or it was the wrong colour)
    state.items = state.items.filter((it) => it !== item);
    place(state, item.value, rng);
    events.push({ type: 'oops', value: item.value });
  }
  return events;
}

/** Seconds this round should take for the third star: the things to eat, half a board apart. */
export function parSeconds(level, cols, rows) {
  const n = level.mode === 'colors' ? level.eat : level.mode === 'count' ? countSequence(level).length : 0;
  const things = level.mode === 'letters' ? level.words.reduce((s, w) => s + Math.max(WORDS[w].nl.length, WORDS[w].en.length), 0) : n;
  return Math.ceil((things * ((cols + rows) / 2)) / level.speed * 1.4 + 4);
}

/**
 * Stars for a finished round. The youngest tier only counts mistakes (no clock for three-year-olds);
 * the others also want the round inside the time.
 */
export function starsFor({ tier = 'tiny', mistakes = 0, seconds = 0, par = Infinity }) {
  if (!TIERS[tier]?.timed) return mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
  if (mistakes === 0 && seconds <= par) return 3;
  if (mistakes <= 2 && seconds <= par * 1.6) return 2;
  return 1;
}

/**
 * The next direction towards the nearest right thing, by the shortest safe path: walls, the body
 * (when it hurts) and wrong things are avoided, and a move into a corner too small for the snake
 * is only taken when nothing else is left. Used by the tests and the smoke test to play rounds;
 * returns null when there is no move at all.
 */
export function pathDirection(state) {
  const head = state.snake[0];
  const blocked = new Set(state.walls);
  if (state.selfHit) for (const s of state.snake.slice(0, -1)) blocked.add(key(s[0], s[1]));
  const wrong = new Set(state.items.filter((it) => !isCorrect(state, it)).map((it) => key(it.r, it.c)));
  const goal = new Set(state.items.filter((it) => isCorrect(state, it)).map((it) => key(it.r, it.c)));
  const facing = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
  const headKey = key(head[0], head[1]);
  const tail = state.snake[state.snake.length - 1];
  const tailKey = key(tail[0], tail[1]);
  // from a first cell: the distance to the nearest right thing, and how much room there is
  const explore = (start) => {
    const seen = new Set([headKey, key(start[0], start[1])]);
    let frontier = [start];
    let dist = goal.has(key(start[0], start[1])) ? 0 : Infinity;
    let depth = 0;
    let room = 1;
    let toTail = key(start[0], start[1]) === tailKey; // the tail moves away: a way out
    while (frontier.length) {
      depth++;
      const nextFrontier = [];
      for (const cell of frontier) {
        for (const d of Object.keys(DIRS)) {
          const n = nextCell(state, cell, d);
          if (!n) continue;
          const k = key(n[0], n[1]);
          if (blocked.has(k) || seen.has(k)) continue;
          seen.add(k);
          room++;
          if (k === tailKey) toTail = true;
          if (goal.has(k) && depth < dist) dist = depth;
          if (!wrong.has(k)) nextFrontier.push(n);
        }
      }
      frontier = nextFrontier;
    }
    return { dist, room, toTail };
  };
  const options = [];
  for (const d of Object.keys(DIRS)) {
    if (d === OPPOSITE[facing]) continue;
    const n = nextCell(state, head, d);
    if (!n) continue;
    const k = key(n[0], n[1]);
    if (blocked.has(k) || wrong.has(k)) continue;
    options.push({ d, ...explore(n) });
  }
  if (!options.length) {
    // boxed in by wrong things (and the fence): a wrong bite is only an oops, so take the roomiest
    for (const d of Object.keys(DIRS)) {
      if (d === OPPOSITE[facing]) continue;
      const n = nextCell(state, head, d);
      if (n && !blocked.has(key(n[0], n[1]))) options.push({ d, ...explore(n) });
    }
    if (!options.length) return null;
  }
  const need = state.selfHit ? state.snake.length + 2 : 0;
  const safe = options.filter((o) => o.room >= need || (state.selfHit && o.toTail));
  const pool = safe.length ? safe : options;
  pool.sort((a, b) => a.dist - b.dist || b.toTail - a.toTail || b.room - a.room);
  return pool[0].d;
}
