// Verstoppertje (Hide and Seek): the rules, pure and tested (tests/verstop.test.js). A round is one
// scene with hiding spots (stones, bushes, a little door in a tree, an advent-calendar flap...);
// the animal to find hides behind exactly one of them, and behind every other spot a friendly
// creature lives that peeks out and waves. Nothing is ever "wrong": a look that does not find the
// animal is a little hello, and only the extra looks count for the stars, gently (never time).
//
// Harder by what the child must do, never by speed (Mark, 18 Nov 2026, for all games):
//   t1 (3-4): 4-5 big spots, one animal.
//   t2 (4-6): 6-7 spots, two animals to find in one round.
//   t3 (5-7): 7-8 spots, one animal with a clear feature (a red scarf, a yellow bow, a pink flower)
//             among two look-alikes of the same animal (another feature, or none), and on every
//             second round a memory twist: once it is found, every spot closes and the child
//             shows where a creature they met lived ("Waar was de kikker?").
// Rounds are seeded (`hashSeed` of the round id), so round t1-3 in the garden is always the same.

export const SCENE_IDS = Object.freeze(['garden', 'forest', 'beach', 'farm']);

/** Which animals hide in a scene and which hiding spots it has (the order is the rotation of rounds). */
export const SCENES = Object.freeze({
  garden: Object.freeze({ animals: Object.freeze(['hedgehog', 'rabbit', 'puppy']), spots: Object.freeze(['stone', 'bush', 'pot', 'bucket', 'flap']) }),
  forest: Object.freeze({ animals: Object.freeze(['squirrel', 'owl', 'hedgehog']), spots: Object.freeze(['tree', 'log', 'door', 'bush', 'stone']) }),
  beach: Object.freeze({ animals: Object.freeze(['crab', 'turtle', 'puppy']), spots: Object.freeze(['shell', 'castle', 'bucket', 'stone']) }),
  farm: Object.freeze({ animals: Object.freeze(['piglet', 'lamb', 'rabbit']), spots: Object.freeze(['hay', 'flap', 'bucket', 'pot', 'bush']) }),
});

/** The animals a child looks for. */
export const ANIMAL_IDS = Object.freeze(['hedgehog', 'rabbit', 'puppy', 'squirrel', 'owl', 'crab', 'turtle', 'piglet', 'lamb']);
/** The friendly creatures that live behind the other spots and wave. */
export const CREATURE_IDS = Object.freeze(['snail', 'ladybug', 'mouse', 'frog', 'bird', 'bee', 'butterfly', 'mole']);
/** What tells look-alikes apart (tier 3): each its own thing, colour and place on the animal. */
export const FEATURE_IDS = Object.freeze(['scarf', 'bow', 'flower']);
/**
 * Features an animal never wears: too close to its own colour to be seen at a glance (a red scarf on
 * the rust squirrel or the coral crab, a pink flower on the piglet, a yellow bow on the golden
 * puppy; tested: every feature an animal may wear is 90 or more apart from it in RGB).
 */
export const NOT_WORN = Object.freeze({ puppy: Object.freeze(['bow']), squirrel: Object.freeze(['scarf']), crab: Object.freeze(['scarf']), piglet: Object.freeze(['flower']) });
/** The features an animal may wear (at least two, so a round has a target and two look-alikes). */
export const featuresFor = (animal) => FEATURE_IDS.filter((f) => !(NOT_WORN[animal] || []).includes(f));

/**
 * The hiding spots and how each opens: `lift` (lifted up and tilted), `aside` (pushed to the side)
 * or `door` (a little door swings open).
 */
export const SPOTS = Object.freeze({
  stone: 'lift',
  pot: 'lift',
  bucket: 'lift',
  hay: 'lift',
  shell: 'lift',
  castle: 'lift',
  bush: 'aside',
  tree: 'aside',
  log: 'aside',
  door: 'door',
  flap: 'door',
});
export const SPOT_KINDS = Object.freeze(Object.keys(SPOTS));

export const TIERS = Object.freeze({
  t1: Object.freeze({ age: '3-4', spots: Object.freeze([4, 5]), find: 1, lookalikes: 0, memory: false }),
  t2: Object.freeze({ age: '4-6', spots: Object.freeze([6, 7]), find: 2, lookalikes: 0, memory: false }),
  t3: Object.freeze({ age: '5-7', spots: Object.freeze([7, 8]), find: 1, lookalikes: 2, memory: true }),
});
export const TIER_IDS = Object.freeze(Object.keys(TIERS));
export const ROUNDS_PER_TIER = 6;
export const MAX_SPOTS = Math.max(...TIER_IDS.map((k) => TIERS[k].spots[1]));

/** Little hands: no spot is smaller than this many px, on any screen the app supports. */
export const MIN_SPOT = 64;
/** The biggest a spot gets (a 4-spot garden on a tablet). */
export const MAX_SPOT = 168;
/** How much of its cell a spot fills; the rest is room for a natural, uneven scatter. */
export const FILL = 0.86;

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

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `garden-t1-3` -> { scene: 'garden', tier: 't1', n: 3 }, or null for anything else. */
export function parseRoundId(id) {
  const m = /^([a-z]+)-(t\d)-(\d+)$/.exec(String(id));
  if (!m || !SCENE_IDS.includes(m[1]) || !TIER_IDS.includes(m[2])) return null;
  const n = Number(m[3]);
  return n >= 1 && n <= ROUNDS_PER_TIER ? { scene: m[1], tier: m[2], n } : null;
}

export const roundId = (scene, tier, n) => `${scene}-${tier}-${n}`;
export const roundSeed = (id) => hashSeed(`verstop:${id}`);

/** Who lives behind a spot, as one string: `animal:hedgehog:scarf`, `animal:hedgehog:`, `creature:frog:`. */
export const keyOf = (who) => `${who.kind}:${who.id}:${who.feature || ''}`;

/** Is `who` one of the round's animals to find (the same animal with the same feature, or none)? */
export function isTarget(round, who) {
  return who.kind === 'animal' && round.find.some((f) => f.id === who.id && (f.feature || null) === (who.feature || null));
}

/**
 * A round: `{ scene, tier, n, spots: [{ kind, who }], find: [{ id, feature }], memory }`.
 * `n` is the round number in the menu (1..ROUNDS_PER_TIER), 0 for a random round. Fixed rounds
 * take the scene's animals in turn, so every animal of a scene hides in its first rounds.
 */
export function makeRound({ scene, tier, seed, n = 0 }) {
  const sc = SCENES[scene];
  const tt = TIERS[tier];
  if (!sc || !tt) throw new Error(`no such scene or tier: ${scene} ${tier}`);
  const rand = rng(seed);
  const count = tt.spots[0] + Math.floor(rand() * (tt.spots[1] - tt.spots[0] + 1));
  const animals = sc.animals;
  const first = n > 0 ? (n - 1) % animals.length : Math.floor(rand() * animals.length);
  const find = [];
  for (let k = 0; k < tt.find; k++) find.push({ id: animals[(first + k) % animals.length], feature: null });
  const who = find.map((f) => ({ kind: 'animal', id: f.id, feature: null }));
  if (tt.lookalikes) {
    // the animal wears one feature; the look-alikes another one, or nothing at all
    const can = featuresFor(find[0].id);
    const feature = can[Math.floor(rand() * can.length)];
    find[0].feature = feature;
    who[0].feature = feature;
    const others = shuffle([null, ...can.filter((f) => f !== feature)], rand).slice(0, tt.lookalikes);
    for (const f of others) who.push({ kind: 'animal', id: find[0].id, feature: f });
  }
  for (const c of shuffle(CREATURE_IDS, rand).slice(0, count - who.length)) who.push({ kind: 'creature', id: c, feature: null });
  // the kinds of spot: the scene's kinds shuffled, each once before any comes back
  const kinds = [];
  while (kinds.length < count) kinds.push(...shuffle(sc.spots, rand));
  const placed = shuffle(who, rand);
  const spots = placed.map((w, i) => ({ kind: kinds[i], who: w }));
  const memory = tt.memory && (n > 0 ? n % 2 === 0 : rand() < 0.5);
  return { scene, tier, n, spots, find, memory };
}

/** A round from its id in the menu (`garden-t1-3`), or null. */
export function fixedRound(id) {
  const p = parseRoundId(id);
  return p ? makeRound({ ...p, seed: roundSeed(id) }) : null;
}

// ---------- playing ----------

/**
 * What the child has done in a round: `looked` the spots opened that did not hold an animal still to
 * find (in order), `found` the spots of the animals found, `extra` the looks that count against the
 * stars (each spot once), `phase` 'seek' | 'memory' | 'done', `ask` the spot of the memory question.
 */
export function newPlay() {
  return { looked: [], found: [], memLooked: [], extra: 0, phase: 'seek', ask: null };
}

/** The memory question: the first creature the child met (the one longest ago), or null. */
export function memoryAsk(round, looked) {
  const i = looked.find((k) => round.spots[k]?.who.kind === 'creature');
  return i === undefined ? null : i;
}

/**
 * A tap on spot i. Returns `{ play, result, first }`:
 *   'found'      an animal to find (more to find),
 *   'done'       the last animal found, the round is over,
 *   'memory'     the last animal found, now the memory question (`play.ask`),
 *   'remembered' the memory question answered, the round is over,
 *   'friend'     a creature waves (`first`: the first time this spot was opened, so it counted),
 *   'lookalike'  another animal of the same kind with another feature (or none) waves,
 *   'none'       nothing happens (an animal already found, a round already over).
 */
export function look(round, play, i) {
  const spot = round.spots[i];
  if (!spot || play.phase === 'done' || play.found.includes(i)) return { play, result: 'none', first: false };
  const who = spot.who;
  const hello = who.kind === 'creature' ? 'friend' : 'lookalike';
  if (play.phase === 'memory') {
    if (i === play.ask) return { play: { ...play, phase: 'done' }, result: 'remembered', first: true };
    // each spot counts once in a round: one already opened while seeking counts nothing here
    const fresh = !play.memLooked.includes(i);
    const first = fresh && !play.looked.includes(i);
    const next = fresh ? { ...play, memLooked: [...play.memLooked, i], extra: play.extra + (first ? 1 : 0) } : play;
    return { play: next, result: hello, first };
  }
  if (isTarget(round, who)) {
    const found = [...play.found, i];
    if (found.length < round.find.length) return { play: { ...play, found }, result: 'found', first: true };
    const ask = round.memory ? memoryAsk(round, play.looked) : null;
    if (ask !== null) return { play: { ...play, found, phase: 'memory', ask }, result: 'memory', first: true };
    return { play: { ...play, found, phase: 'done' }, result: 'done', first: true };
  }
  const first = !play.looked.includes(i);
  const next = first ? { ...play, looked: [...play.looked, i], extra: play.extra + 1 } : play;
  return { play: next, result: hello, first };
}

/** Which of the round's animals are still to find (their index in `round.find`). */
export function stillToFind(round, play) {
  const got = play.found.map((i) => round.spots[i].who);
  return round.find.map((f, k) => k).filter((k) => !got.some((w) => w.id === round.find[k].id && (w.feature || null) === (round.find[k].feature || null)));
}

/**
 * Stars by extra looks only, gently: up to half of the other spots is still 3 stars, anything short
 * of opening every other spot 2, and 1 star otherwise. Never by time.
 */
export function starsFor(extra, round) {
  const others = round.spots.length - round.find.length;
  if (extra <= Math.floor(others / 2)) return 3;
  if (extra < others) return 2;
  return 1;
}

// ---------- where the spots stand ----------

/**
 * Where the `n` spots stand in a box of w x h px: `[{ x, y, s }]` (centre and size of a square
 * spot). The box is cut into a grid of cells, as many columns as give the biggest spots (a short
 * last row is centred); each spot fills FILL of its cell and is nudged inside it by the seed, so
 * the scene looks scattered but no two spots ever overlap and none leaves the box.
 */
export function spotLayout(n, w, h, seed = 1) {
  if (!(n > 0) || !(w > 0) || !(h > 0)) return [];
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = w / cols;
    const ch = h / rows;
    const s = Math.min(cw, ch, MAX_SPOT / FILL) * FILL;
    // the biggest spots win; on a tie the cells closest to square
    const shape = Math.abs(Math.log(cw / ch));
    if (!best || s > best.s + 0.5 || (Math.abs(s - best.s) <= 0.5 && shape < best.shape)) best = { cols, rows, cw, ch, s, shape };
  }
  const { cols, rows, cw, ch, s } = best;
  const rand = rng(seed ^ 0x9e3779b9);
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const col = i - row * cols;
    const x0 = (w - inRow * cw) / 2 + col * cw;
    const y0 = row * ch;
    const jx = (cw - s) / 2;
    const jy = (ch - s) / 2;
    out.push({ x: x0 + cw / 2 + (rand() * 2 - 1) * jx * 0.8, y: y0 + ch / 2 + (rand() * 2 - 1) * jy * 0.8, s });
  }
  return out;
}
