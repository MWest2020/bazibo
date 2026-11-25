// Winkeltje (Little Shop): the money maths, pure (no DOM, no sound) so the tests can play every
// round. All amounts are whole numbers of cents, never floats. Harder by the maths, never by speed:
//   t1 (3-5)   whole euros up to € 5 with € 1 coins: count coins onto the counter ("3 euro");
//              then € 2 coins as "two at once"
//   t2 (6-7)   up to € 20 with € 1, € 2, € 5 and € 10, and 50-cent coins: pay exactly, then pay
//              with as few coins and notes as you can (`fewest`)
//   t3 (8-10)  cents with every coin; change ("you pay € 5, it costs € 3,40": count up from the
//              price); two things together; and a budget ("you have € 5: pick two things")
// A question is `ask: 'pay'` (lay `target` cents from `wallet` on the counter), `ask: 'change'`
// (the same from the shop's till: `paid` minus `price`), or `ask: 'basket'` (pick `pick` things
// that together cost no more than `budget`). Nothing is ever "wrong": `judge` says what is missing
// or what is over, so the screen can show it.

export const TIER_IDS = Object.freeze(['t1', 't2', 't3']);
export const TIERS = Object.freeze({
  t1: Object.freeze({ age: '3-5', cents: false, piles: false }),
  t2: Object.freeze({ age: '6-7', cents: false, piles: true }),
  t3: Object.freeze({ age: '8-10', cents: true, piles: true }),
});
export const ROUNDS_PER_TIER = 3;
export const ROUND_LEN = 6;
export const MAX_TRIES = 2; // tries on one question before the shop shows how to pay
export const PICK = 2; // things to pick in a budget question

/** Every coin and note in cents, small to big. */
export const COINS = Object.freeze([1, 2, 5, 10, 20, 50, 100, 200]);
export const NOTES = Object.freeze([500, 1000, 2000]);
export const DENOMS = Object.freeze([...COINS, ...NOTES]);
export const isNote = (d) => d >= 500;
/** The real sizes in mm (diameter of a coin; width and height of a note), for drawing to scale. */
export const SIZE_MM = Object.freeze({
  1: 16.25, 2: 18.75, 5: 21.25, 10: 19.75, 20: 22.25, 50: 24.25, 100: 23.25, 200: 25.75,
  500: [120, 62], 1000: [127, 67], 2000: [133, 72],
});

// What lies in the purse (or the till) per kind of question: enough of each to pay every price
// of that kind, never so much that any coin will do (tested: every amount the kind asks is payable).
export const WALLETS = Object.freeze({
  ones: Object.freeze({ 100: 6 }),
  twos: Object.freeze({ 100: 1, 200: 3 }),
  whole: Object.freeze({ 100: 4, 200: 3, 500: 1 }),
  half: Object.freeze({ 50: 2, 100: 3, 200: 3, 500: 2, 1000: 1 }),
  cents: Object.freeze({ 1: 3, 2: 2, 5: 2, 10: 3, 20: 2, 50: 2, 100: 3, 200: 2, 500: 1 }),
  till: Object.freeze({ 5: 2, 10: 3, 20: 2, 50: 2, 100: 4, 200: 2, 500: 1 }),
});

/**
 * The things in the shop with the prices they may have (cents, lo-hi), so an apple never costs
 * € 18. Every price a tier asks has at least two things that may cost it (tested).
 */
export const ITEMS = Object.freeze([
  { id: 'apple', lo: 20, hi: 150 },
  { id: 'banana', lo: 20, hi: 150 },
  { id: 'carrot', lo: 10, hi: 120 },
  { id: 'lolly', lo: 10, hi: 200 },
  { id: 'cookie', lo: 50, hi: 300 },
  { id: 'milk', lo: 50, hi: 300 },
  { id: 'pencil', lo: 20, hi: 300 },
  { id: 'balloon', lo: 50, hi: 400 },
  { id: 'bread', lo: 100, hi: 500 },
  { id: 'icecream', lo: 100, hi: 500 },
  { id: 'cheese', lo: 200, hi: 1000 },
  { id: 'car', lo: 100, hi: 1000 },
  { id: 'ball', lo: 200, hi: 1500 },
  { id: 'book', lo: 300, hi: 2000 },
  { id: 'teddy', lo: 500, hi: 2000 },
  { id: 'kite', lo: 500, hi: 2000 },
]);
export const ITEM_IDS = Object.freeze(ITEMS.map((i) => i.id));

/** The kinds of question in each round (shuffled per round); index 0 is the random round. */
export const KINDS = Object.freeze({
  t1: Object.freeze([
    Object.freeze(['count', 'count', 'count', 'twos', 'twos', 'twos']),
    Object.freeze(['count', 'count', 'count', 'count', 'count', 'count']),
    Object.freeze(['count', 'count', 'count', 'count', 'count', 'count']),
    Object.freeze(['count', 'count', 'twos', 'twos', 'twos', 'twos']),
  ]),
  t2: Object.freeze([
    Object.freeze(['exact', 'exact', 'exact', 'fewest', 'fewest', 'fewest']),
    Object.freeze(['exact', 'exact', 'exact', 'exact', 'exact', 'exact']),
    Object.freeze(['exact', 'exact', 'exact', 'exact', 'exact', 'exact']),
    Object.freeze(['fewest', 'fewest', 'fewest', 'fewest', 'fewest', 'fewest']),
  ]),
  t3: Object.freeze([
    Object.freeze(['cents', 'two', 'change', 'change', 'budget', 'two']),
    Object.freeze(['cents', 'cents', 'cents', 'cents', 'two', 'two']),
    Object.freeze(['change', 'change', 'change', 'change', 'cents', 'cents']),
    Object.freeze(['change', 'change', 'two', 'two', 'budget', 'budget']),
  ]),
});

/** Stars by mistakes (questions with a wrong try): none 3, one or two 2, more 1. Never time. */
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

/** A whole number from lo to hi, both included. */
const int = (rand, lo, hi) => (hi <= lo ? lo : lo + Math.floor(rand() * (hi - lo + 1)));

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- money ----------

/** The total of a list of coins and notes. */
export const total = (laid) => laid.reduce((s, d) => s + d, 0);

/**
 * An amount the way a shop writes it: "€ 2,50" in Dutch, "€ 2.50" in English, whole euros as
 * "€ 3" (or "€ 3,00" with `decimals`, for the cents tier). A no-break space after the €.
 */
export function money(cents, lang = 'nl', { decimals = false } = {}) {
  const c = Math.max(0, Math.round(cents));
  const e = Math.floor(c / 100);
  const r = c % 100;
  if (r === 0 && !decimals) return `€ ${e}`;
  return `€ ${e}${lang === 'en' ? '.' : ','}${String(r).padStart(2, '0')}`;
}

/** How many of each coin are still in the wallet with `laid` on the counter. */
export function left(wallet, laid) {
  const out = {};
  for (const [d, n] of Object.entries(wallet)) out[d] = n;
  for (const d of laid) out[d] = (out[d] || 0) - 1;
  return out;
}

/**
 * The fewest coins and notes from `wallet` ({ cents: count }) that make exactly `amount`, biggest
 * first, or null when it cannot be made. A bounded change-making table: each coin once per count.
 */
export function fewest(amount, wallet) {
  if (!Number.isInteger(amount) || amount < 0) return null;
  const ds = Object.keys(wallet)
    .map(Number)
    .filter((d) => wallet[d] > 0)
    .sort((a, b) => a - b);
  const INF = 1e9;
  let best = new Array(amount + 1).fill(INF);
  best[0] = 0;
  const use = [];
  for (const d of ds) {
    const k = wallet[d];
    const next = best.slice();
    const u = new Uint8Array(amount + 1);
    for (let a = d; a <= amount; a++) {
      for (let j = 1; j <= k && j * d <= a; j++) {
        const c = best[a - j * d] + j;
        if (c < next[a]) {
          next[a] = c;
          u[a] = j;
        }
      }
    }
    use.push(u);
    best = next;
  }
  if (best[amount] >= INF) return null;
  const out = [];
  let a = amount;
  for (let i = ds.length - 1; i >= 0; i--) {
    const j = use[i][a];
    for (let x = 0; x < j; x++) out.push(ds[i]);
    a -= j * ds[i];
  }
  return out;
}

/** The fewest pieces among `laid` (their indexes) that add up to exactly `amount`, or null. */
export function subsetFor(laid, amount) {
  if (amount <= 0) return null;
  const best = new Map([[0, []]]);
  laid.forEach((d, i) => {
    for (const [s, idx] of [...best.entries()].sort((a, b) => b[0] - a[0])) {
      const t = s + d;
      if (t > amount) continue;
      if (!best.has(t) || best.get(t).length > idx.length + 1) best.set(t, [...idx, i]);
    }
  });
  return best.get(amount) || null;
}

/**
 * Too little, and the purse cannot make the rest: the fewest pieces of `laid` to take back (their
 * indexes) so that the purse can then make the price, and the pieces that go on instead.
 */
export function swapFor(q, laid) {
  const kinds = [...new Set(laid)].sort((a, b) => b - a);
  const have = kinds.map((d) => laid.filter((x) => x === d).length);
  const rest = left(q.wallet, laid);
  const sum = total(laid);
  // every way to take k pieces back, k = 1, 2, ... (by kind, so the same coin twice is one way)
  for (let k = 1; k <= laid.length; k++) {
    let found = null;
    const walk = (i, need, out) => {
      if (found) return;
      if (need === 0) {
        const off = total(out);
        const purse = { ...rest };
        for (const d of out) purse[d] = (purse[d] || 0) + 1;
        const add = fewest(q.target - (sum - off), purse);
        if (add) found = { out: [...out], add };
        return;
      }
      if (i >= kinds.length) return;
      for (let j = Math.min(need, have[i]); j >= 0; j--) walk(i + 1, need - j, [...out, ...Array(j).fill(kinds[i])]);
    };
    walk(0, k, []);
    if (found) {
      const back = [];
      for (const d of found.out) {
        const i = laid.findIndex((x, n) => x === d && !back.includes(n));
        back.push(i);
      }
      // a piece taken back and laid again is no swap: drop it from both sides
      const ghosts = [...found.add];
      for (let n = back.length - 1; n >= 0; n--) {
        const g = ghosts.indexOf(laid[back[n]]);
        if (g >= 0) {
          ghosts.splice(g, 1);
          back.splice(n, 1);
        }
      }
      return { back: back.sort((a, b) => a - b), ghosts };
    }
  }
  return { back: laid.map((_, i) => i), ghosts: [...q.solution] };
}

/** Counting up from the price: the totals after each coin, small coins first ("3,40 → 3,50 → 4"). */
export function countUp(from, laid) {
  const out = [from];
  let s = from;
  for (const d of [...laid].sort((a, b) => a - b)) {
    s += d;
    out.push(s);
  }
  return out;
}

// ---------- what a tap does ----------

/** Lay one `d` from the wallet on the counter; null when there is none left. */
export function lay(q, laid, d) {
  if (q.ask === 'basket') return null;
  if (!((left(q.wallet, laid)[d] || 0) > 0)) return null;
  return [...laid, d];
}

/** Take the piece at `i` back from the counter. */
export function takeBack(laid, i) {
  if (!(i >= 0 && i < laid.length)) return null;
  return laid.filter((_, k) => k !== i);
}

/** Take one `d` back (the last laid of that kind): a tap on a pile. */
export function takeOne(laid, d) {
  const i = laid.lastIndexOf(d);
  return i < 0 ? null : takeBack(laid, i);
}

/** Put a thing in the basket or take it out again (a budget question). */
export function toggle(q, picked, i) {
  if (q.ask !== 'basket' || !(i >= 0 && i < q.items.length)) return null;
  if (picked.includes(i)) return picked.filter((k) => k !== i);
  if (picked.length >= q.pick) return null;
  return [...picked, i].sort((a, b) => a - b);
}

/**
 * Is what lies on the counter right? { ok: true }, or what to show:
 *   { why: 'short', missing, ghosts }  too little: what is missing (and coins that would make it)
 *   { why: 'over', over, extra }       too much: what is over (and the pieces that make it, if any)
 *   { why: 'more', n }                 the right amount, but it can be done with n pieces
 */
export function judge(q, laid) {
  const sum = total(laid);
  if (sum < q.target) {
    const missing = q.target - sum;
    const add = fewest(missing, left(q.wallet, laid));
    if (add) return { ok: false, why: 'short', missing, ghosts: add, back: [] };
    // what is left in the purse cannot make the rest (the twos purse: € 2 with the € 1 laid):
    // take the fewest pieces back so it can, and show what goes on instead
    const swap = swapFor(q, laid);
    return { ok: false, why: 'short', missing, ghosts: swap.ghosts, back: swap.back };
  }
  if (sum > q.target) {
    const over = sum - q.target;
    return { ok: false, why: 'over', over, extra: subsetFor(laid, over) };
  }
  if (q.goal === 'fewest' && laid.length > q.solution.length) return { ok: false, why: 'more', n: q.solution.length };
  return { ok: true };
}

/** A budget question: the right number of things that together cost no more than the budget. */
export function judgeBasket(q, picked) {
  if (picked.length !== q.pick) return { ok: false, why: 'count', n: q.pick - picked.length };
  const sum = picked.reduce((s, i) => s + q.items[i].price, 0);
  if (sum > q.budget) return { ok: false, why: 'over', over: sum - q.budget, sum };
  return { ok: true, sum };
}

/** Every pair of things in a basket question that fits the budget. */
export function fittingPairs(items, budget) {
  const out = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (items[i].price + items[j].price <= budget) out.push([i, j]);
  return out;
}

// ---------- the questions ----------

/** Things that may cost `price`, in a random order. */
function itemsFor(price, rand, not = []) {
  return shuffle(ITEMS.filter((i) => price >= i.lo && price <= i.hi && !not.includes(i.id)), rand);
}

function payQ(kind, price, wallet, rand, extra = {}) {
  const item = itemsFor(price, rand, extra.not)[0];
  if (!item) return null;
  const solution = fewest(price, wallet);
  if (!solution) return null;
  return { kind, ask: 'pay', goal: extra.goal || 'exact', items: [{ id: item.id, price }], target: price, wallet, solution };
}

function make(kind, tier, round, rand) {
  if (kind === 'count') {
    const most = round === 1 ? 3 : 5;
    return payQ('count', int(rand, 1, most) * 100, WALLETS.ones, rand);
  }
  if (kind === 'twos') return payQ('twos', int(rand, 2, 5) * 100, WALLETS.twos, rand);
  if (kind === 'exact') {
    if (round === 1) return payQ('exact', int(rand, 3, 10) * 100, WALLETS.whole, rand);
    // mostly with a 50-cent coin in it: that is what is new here
    const half = rand() < 0.6;
    const price = half ? int(rand, 2, 19) * 100 + 50 : int(rand, 3, 20) * 100;
    return payQ('exact', price, WALLETS.half, rand);
  }
  if (kind === 'fewest') return payQ('fewest', int(rand, 7, 39) * 50, WALLETS.half, rand, { goal: 'fewest' });
  if (kind === 'cents') {
    let price = int(rand, 15, 999);
    if (price % 100 === 0) price += int(rand, 1, 99);
    return payQ('cents', Math.min(999, price), WALLETS.cents, rand);
  }
  if (kind === 'two') {
    const a = int(rand, 15, 600);
    const b = int(rand, 15, Math.min(600, 990 - a));
    const first = itemsFor(a, rand)[0];
    const second = first && itemsFor(b, rand, [first.id])[0];
    const solution = fewest(a + b, WALLETS.cents);
    if (!first || !second || !solution || (a % 100 === 0 && b % 100 === 0)) return null;
    return { kind, ask: 'pay', goal: 'exact', items: [{ id: first.id, price: a }, { id: second.id, price: b }], target: a + b, wallet: WALLETS.cents, solution };
  }
  if (kind === 'change') {
    const paid = rand() < 0.5 ? 500 : 1000;
    const price = int(rand, Math.ceil((paid * 0.3) / 5), paid / 5 - 1) * 5;
    if (price % 100 === 0) return null;
    const item = itemsFor(price, rand)[0];
    const solution = fewest(paid - price, WALLETS.till);
    if (!item || !solution) return null;
    return { kind, ask: 'change', goal: 'exact', items: [{ id: item.id, price }], price, paid, target: paid - price, wallet: WALLETS.till, solution };
  }
  if (kind === 'budget') {
    const budget = [300, 500, 1000][int(rand, 0, 2)];
    const items = [];
    for (let tries = 0; items.length < 4 && tries < 60; tries++) {
      const price = int(rand, Math.ceil((budget * 0.15) / 10), Math.floor((budget * 0.7) / 10)) * 10;
      const item = itemsFor(price, rand, items.map((i) => i.id))[0];
      if (item) items.push({ id: item.id, price });
    }
    if (items.length < 4) return null;
    const fits = fittingPairs(items, budget);
    if (fits.length < 1 || fits.length > 4) return null; // some pairs fit and some do not
    const best = fits.reduce((a, p) => (items[p[0]].price + items[p[1]].price < items[a[0]].price + items[a[1]].price ? p : a));
    return { kind, ask: 'basket', goal: 'exact', items, budget, pick: PICK, best, target: 0, wallet: {}, solution: [] };
  }
  throw new Error(`unknown kind ${kind}`);
}

/** The same kind of question again with a new number, never the same as the one before. */
function question(kind, tier, round, rand, before) {
  const prev = before[before.length - 1];
  const key = (x) => (x.ask === 'basket' ? `${x.budget}:${x.items.map((i) => i.price).join(',')}` : String(x.target));
  for (let tries = 0; tries < 300; tries++) {
    const q = make(kind, tier, round, rand);
    if (!q) continue;
    if (prev && prev.kind === q.kind && key(prev) === key(q)) continue;
    // an amount at most once per kind in a round while there are others to ask, then twice
    const seen = before.filter((x) => x.kind === q.kind && key(x) === key(q)).length;
    if (seen >= (tries < 150 ? 1 : 2) && tries < 250) continue;
    return Object.freeze(q);
  }
  throw new Error(`no ${kind} question`);
}

/**
 * The questions of a round: `round` 1-3 is a fixed round of the menu (the same every time for the
 * same seed), 0 a random one.
 */
export function makeRound({ tier, seed, round = 0 }) {
  if (!TIER_IDS.includes(tier)) throw new Error(`unknown tier ${tier}`);
  const r = round >= 1 && round <= ROUNDS_PER_TIER ? round : 0;
  const rand = rng(seed);
  // the first rounds start with their easiest kind; the rest are shuffled
  const kinds = shuffle(KINDS[tier][r], rand);
  const out = [];
  for (const kind of kinds) out.push(question(kind, tier, r, rand, out));
  return out;
}
