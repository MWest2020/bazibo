// Kaartpuzzel's rounds, pure so they can be tested without a screen. Every pack has the same three
// tiers, harder by the task, never by speed (no timers anywhere):
//   t1 "Leggen" (6-8): a puzzle on the map with every border drawn; a round is a handful of pieces,
//      the biggest regions first (all seven continents at once).
//   t2 "Waar ligt...?" (7-10): a name is shown, tap the region; every region once over the rounds.
//   t3 (9-12): first the whole puzzle without the borders (only the land, or for the continents an
//      empty sea), then "Waar ligt...?" for the capitals (or the oceans on the world map).
// A wrong drop or tap is a gentle bounce and counts once per piece or question; after MAX_TRIES the
// right place glows. Stars count mistakes only.

export const TIER_IDS = Object.freeze(['t1', 't2', 't3']);
export const TIERS = Object.freeze({
  t1: Object.freeze({ age: '6-8' }),
  t2: Object.freeze({ age: '7-10' }),
  t3: Object.freeze({ age: '9-12' }),
});
export const KINDS = Object.freeze(['puzzle', 'where', 'point']);
export const CHUNK = 8; // at most this many pieces or questions in a round (but the whole puzzle)
export const MAX_TRIES = 2; // wrong drops or taps before the right place glows

export const starsFor = (mistakes) => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);

export function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** n items in rounds of at most `max`, as even as can be (12 -> 6 + 6, 41 -> 7 + 7 + 7 + 7 + 7 + 6). */
export function chunkSizes(n, max = CHUNK) {
  const k = Math.max(1, Math.ceil(n / max));
  return Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
}

function chunk(ids, max = CHUNK) {
  const out = [];
  let at = 0;
  for (const n of chunkSizes(ids.length, max)) {
    out.push(ids.slice(at, at + n));
    at += n;
  }
  return out;
}

/**
 * The rounds of a tier of a pack, in order: [{ kind, lines, items }]. `items` are region ids
 * (puzzle, where) or point ids (point). Fixed per pack, so stars per round mean the same next time.
 */
export function roundsOf(pack, tier) {
  const ids = pack.regions.map((g) => g.id);
  if (tier === 't1') {
    const big = pack.regions.slice().sort((a, b) => b.a - a.a || a.id.localeCompare(b.id)).map((g) => g.id);
    return chunk(big).map((items) => ({ kind: 'puzzle', lines: true, items }));
  }
  if (tier === 't2') {
    return chunk(shuffle(ids, rng(hashSeed(`${pack.id}:t2`)))).map((items) => ({ kind: 'where', lines: true, items }));
  }
  if (tier === 't3') {
    const pts = (pack.points?.list || []).map((p) => p.id);
    const out = [{ kind: 'puzzle', lines: false, items: ids }];
    if (pts.length) out.push(...chunk(shuffle(pts, rng(hashSeed(`${pack.id}:t3`)))).map((items) => ({ kind: 'point', lines: true, items })));
    return out;
  }
  return [];
}

export const roundId = (packId, tier, r) => `${packId}-${tier}-${r}`;
/** "nl-t2-1" -> { pack: 'nl', tier: 't2', r: 1 } (or null). */
export function parseRoundId(id) {
  const m = /^([a-z]+)-(t[123])-(\d+)$/.exec(String(id));
  return m ? { pack: m[1], tier: m[2], r: Number(m[3]) } : null;
}

/**
 * One round to play: the round of `roundsOf` with its items in playing order (pieces in the tray,
 * questions one by one), shuffled by `seed`. A puzzle keeps the biggest piece first in tier 1, so
 * the very first drag is an easy one.
 */
export function makeRound(pack, tier, r, seed = hashSeed(roundId(pack.id, tier, r))) {
  const round = roundsOf(pack, tier)[r - 1];
  if (!round) return null;
  const rand = rng(seed);
  let order = shuffle(round.items, rand);
  if (round.kind === 'puzzle' && tier === 't1') order = [round.items[0], ...order.filter((id) => id !== round.items[0])];
  return { kind: round.kind, lines: round.lines, items: order };
}

/** The next round after (tier, r) in the same pack: the next of the tier, then tier + 1's first. */
export function nextRound(pack, tier, r) {
  if (r < roundsOf(pack, tier).length) return { tier, r: r + 1 };
  const k = TIER_IDS.indexOf(tier);
  return k >= 0 && k + 1 < TIER_IDS.length ? { tier: TIER_IDS[k + 1], r: 1 } : null;
}

/** The question asks for this point by name; is its name also a region's ("Utrecht (stad)")? */
export function sameNameAsRegion(pack, point, lang) {
  return pack.regions.some((g) => g[lang] === point[lang]);
}
