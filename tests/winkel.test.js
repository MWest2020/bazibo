// Winkeltje (Little Shop): the money maths in rules.js. Every amount is whole cents; every round's
// answer is payable with what the round offers, the fewest-coins solver is checked against a brute
// force, change counts up from the price, and 200 seeds per tier make sound rounds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIERS,
  TIER_IDS,
  ROUNDS_PER_TIER,
  ROUND_LEN,
  MAX_TRIES,
  COINS,
  NOTES,
  DENOMS,
  SIZE_MM,
  WALLETS,
  ITEMS,
  ITEM_IDS,
  KINDS,
  PICK,
  starsFor,
  hashSeed,
  money,
  total,
  left,
  fewest,
  subsetFor,
  countUp,
  lay,
  takeBack,
  takeOne,
  toggle,
  judge,
  judgeBasket,
  fittingPairs,
  makeRound,
} from '../web/games/winkel/rules.js';
import { meta } from '../web/games/winkel/meta.js';
import { coinSvg, noteSvg, moneySvg, itemSvg, tileSvg, howSvg, ITEM_ART, BIG } from '../web/games/winkel/art.js';
import { sanitizePayload, payloadOf, mergeTransfer, encodeSave, decodeText } from '../web/js/transfer.js';

const SEEDS = 200;
const seedOf = (i) => (Math.imul(i + 1, 2654435761) >>> 0) || 1;
const fixed = (tier) => Array.from({ length: ROUNDS_PER_TIER }, (_, k) => makeRound({ tier, seed: hashSeed(`winkel:${tier}-${k + 1}`), round: k + 1 }));

/** Every way to pay `amount` from `wallet`, the fewest pieces (brute force, for small wallets). */
function bruteFewest(amount, wallet) {
  const ds = Object.keys(wallet).map(Number);
  let best = null;
  const walk = (k, rest, n) => {
    if (rest === 0) {
      if (best === null || n < best) best = n;
      return;
    }
    if (k >= ds.length) return;
    const d = ds[k];
    for (let j = 0; j <= wallet[d] && j * d <= rest; j++) walk(k + 1, rest - j * d, n + j);
  };
  walk(0, amount, 0);
  return best;
}

test('meta: Leren, tier 1 free, the rest in the full version', () => {
  assert.equal(meta.id, 'winkel');
  assert.equal(meta.group, 'learning');
  assert.ok(!meta.isLocked({ tier: 't1' }, false));
  assert.ok(meta.isLocked({ tier: 't2' }, false));
  assert.ok(meta.isLocked({ tier: 't3' }, false));
  for (const tier of TIER_IDS) assert.ok(!meta.isLocked({ tier }, true));
  assert.deepEqual(TIER_IDS.map((t) => TIERS[t].age), ['3-5', '6-7', '8-10']);
});

test('money is written the Dutch way in Dutch and the English way in English, from whole cents', () => {
  assert.equal(money(250, 'nl'), '€ 2,50');
  assert.equal(money(250, 'en'), '€ 2.50');
  assert.equal(money(300, 'nl'), '€ 3');
  assert.equal(money(300, 'nl', { decimals: true }), '€ 3,00');
  assert.equal(money(5, 'nl'), '€ 0,05');
  assert.equal(money(1999, 'en'), '€ 19.99');
  assert.equal(money(340, 'nl', { decimals: true }), '€ 3,40');
});

test('the coins and notes: every euro coin and the notes up to 20, in whole cents', () => {
  assert.deepEqual(COINS, [1, 2, 5, 10, 20, 50, 100, 200]);
  assert.deepEqual(NOTES, [500, 1000, 2000]);
  for (const d of DENOMS) assert.ok(Number.isInteger(d) && d > 0);
  // the real relative sizes: 1 cent smallest, 2 euro biggest, 10 cent smaller than 5 cent
  assert.equal(BIG, SIZE_MM[200]);
  for (const d of COINS) assert.ok(SIZE_MM[d] <= SIZE_MM[200]);
  assert.ok(SIZE_MM[10] < SIZE_MM[5] && SIZE_MM[1] < SIZE_MM[2] && SIZE_MM[100] < SIZE_MM[50]);
  for (const n of NOTES) assert.ok(SIZE_MM[n][0] > SIZE_MM[n][1]);
  assert.ok(SIZE_MM[500][0] < SIZE_MM[1000][0] && SIZE_MM[1000][0] < SIZE_MM[2000][0]);
});

test('fewest: the fewest coins and notes, checked against a brute force, null when it cannot be made', () => {
  for (const [name, wallet] of Object.entries(WALLETS)) {
    const most = total(Object.entries(wallet).flatMap(([d, n]) => Array(n).fill(Number(d))));
    for (let a = 0; a <= Math.min(most, 1200); a++) {
      const got = fewest(a, wallet);
      const want = bruteFewest(a, wallet);
      if (want === null) assert.equal(got, null, `${name} ${a}`);
      else {
        assert.ok(got, `${name}: ${a} cannot be made`);
        assert.equal(total(got), a, `${name} ${a}: ${got}`);
        assert.equal(got.length, want, `${name} ${a}: ${got} is not the fewest`);
        const rest = left(wallet, got);
        for (const n of Object.values(rest)) assert.ok(n >= 0, `${name} ${a}: more than the wallet has`);
        for (let k = 1; k < got.length; k++) assert.ok(got[k] <= got[k - 1], 'biggest first');
      }
    }
  }
  // with plenty of everything the euro is greedy: the biggest that fits first
  const plenty = Object.fromEntries(DENOMS.map((d) => [d, 20]));
  for (let a = 0; a <= 2000; a += 7) {
    const greedy = [];
    let r = a;
    for (const d of [...DENOMS].reverse()) while (r >= d) (greedy.push(d), (r -= d));
    assert.deepEqual(fewest(a, plenty), greedy, `${a}`);
  }
  assert.deepEqual(fewest(1350, WALLETS.half), [1000, 200, 100, 50]);
  assert.deepEqual(fewest(340, WALLETS.till), [200, 100, 20, 20]);
  assert.equal(fewest(3, WALLETS.ones), null);
  assert.equal(fewest(-1, WALLETS.ones), null);
  assert.equal(fewest(1.5, WALLETS.ones), null);
});

test('every amount a kind of question asks can be paid from its purse or till', () => {
  const check = (wallet, amounts, name) => {
    for (const a of amounts) assert.ok(fewest(a, wallet), `${name}: ${a} cannot be paid`);
  };
  check(WALLETS.ones, [100, 200, 300, 400, 500], 'ones');
  check(WALLETS.twos, [200, 300, 400, 500], 'twos');
  check(WALLETS.whole, Array.from({ length: 8 }, (_, k) => (k + 3) * 100), 'whole');
  check(WALLETS.half, Array.from({ length: 39 }, (_, k) => (k + 2) * 50), 'half');
  check(WALLETS.cents, Array.from({ length: 999 }, (_, k) => k + 1), 'cents');
  check(WALLETS.till, Array.from({ length: 170 }, (_, k) => (k + 1) * 5), 'till');
});

test('change counts up from the price: the totals step by step, small coins first, ending on what was paid', () => {
  assert.deepEqual(countUp(340, [100, 50, 10]), [340, 350, 400, 500]);
  assert.deepEqual(countUp(340, []), [340]);
  for (let price = 150; price < 500; price += 5) {
    const back = fewest(500 - price, WALLETS.till);
    const steps = countUp(price, back);
    assert.equal(steps[0], price);
    assert.equal(steps.at(-1), 500, `${price}`);
    for (let k = 1; k < steps.length; k++) assert.ok(steps[k] > steps[k - 1]);
  }
});

test('laying and taking back: only what is in the purse, the counter keeps its order', () => {
  const q = makeRound({ tier: 't1', seed: 7, round: 1 })[0];
  let laid = [];
  for (let k = 0; k < WALLETS.ones[100]; k++) laid = lay(q, laid, 100);
  assert.equal(laid.length, 6);
  assert.equal(lay(q, laid, 100), null, 'no seventh coin');
  assert.equal(lay(q, [], 200), null, 'no 2 euro coin in this purse');
  assert.deepEqual(takeBack([100, 200, 100], 1), [100, 100]);
  assert.equal(takeBack([100], 3), null);
  assert.deepEqual(takeOne([100, 200, 100, 50], 100), [100, 200, 50]);
  assert.equal(takeOne([100], 200), null);
  assert.deepEqual(left({ 100: 3, 200: 1 }, [100, 200]), { 100: 2, 200: 0 });
});

test('never wrong: too little says what is missing (with coins that make it), too much what is over', () => {
  const q = { kind: 'exact', ask: 'pay', goal: 'exact', items: [{ id: 'book', price: 750 }], target: 750, wallet: WALLETS.half, solution: [500, 200, 50] };
  const short = judge(q, [500, 100]);
  assert.equal(short.why, 'short');
  assert.equal(short.missing, 150);
  assert.deepEqual(short.ghosts, [100, 50]);
  const over = judge(q, [500, 200, 100]);
  assert.equal(over.why, 'over');
  assert.equal(over.over, 50);
  assert.equal(over.extra, null, 'no 50 cent on the counter to point at');
  const over2 = judge(q, [500, 200, 50, 100]);
  assert.deepEqual(over2.extra, [3], 'the euro that is too much');
  assert.deepEqual(judge(q, [200, 500, 50]), { ok: true });
  assert.deepEqual(judge(q, [200, 200, 200, 100, 50]), { ok: true }, 'any way is fine when exact');
  const few = { ...q, goal: 'fewest' };
  assert.deepEqual(judge(few, [200, 200, 200, 100, 50]), { ok: false, why: 'more', n: 3 });
  assert.deepEqual(judge(few, [50, 200, 500]), { ok: true });
  assert.deepEqual(subsetFor([100, 50, 20, 20, 10], 40), [2, 3]);
  assert.deepEqual(subsetFor([100, 50, 20, 20, 10], 30), [2, 4]);
  assert.equal(subsetFor([100], 50), null);
});

test('a budget: two things that together cost no more than you have; over says by how much', () => {
  const q = { kind: 'budget', ask: 'basket', items: [{ id: 'apple', price: 120 }, { id: 'book', price: 400 }, { id: 'milk', price: 150 }, { id: 'ball', price: 350 }], budget: 500, pick: 2 };
  let picked = toggle(q, [], 1);
  picked = toggle(q, picked, 3);
  assert.deepEqual(picked, [1, 3]);
  assert.equal(toggle(q, picked, 0), null, 'a third thing does not fit in the basket');
  assert.deepEqual(judgeBasket(q, picked), { ok: false, why: 'over', over: 250, sum: 750 });
  assert.deepEqual(judgeBasket(q, [0]), { ok: false, why: 'count', n: 1 });
  assert.deepEqual(toggle(q, picked, 3), [1]);
  assert.deepEqual(judgeBasket(q, [0, 2]), { ok: true, sum: 270 });
  assert.deepEqual(judgeBasket(q, [0, 3]), { ok: true, sum: 470 });
  assert.deepEqual(fittingPairs(q.items, 500), [[0, 2], [0, 3], [2, 3]]);
});

test('stars count mistakes only', () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(1), 2);
  assert.equal(starsFor(2), 2);
  assert.equal(starsFor(3), 1);
  assert.equal(starsFor(6), 1);
  assert.equal(MAX_TRIES, 2);
});

/** Every question is sound: a thing that may cost that, payable, the answer judged right. */
function checkQuestion(q, tier, label) {
  assert.ok(KINDS[tier].flat().includes(q.kind), `${label}: kind ${q.kind}`);
  for (const it of q.items) {
    const item = ITEMS.find((i) => i.id === it.id);
    assert.ok(item, `${label}: unknown thing ${it.id}`);
    assert.ok(Number.isInteger(it.price) && it.price >= item.lo && it.price <= item.hi, `${label}: ${it.id} for ${it.price}`);
  }
  assert.equal(new Set(q.items.map((i) => i.id)).size, q.items.length, `${label}: a thing twice`);
  if (q.ask === 'basket') {
    assert.equal(q.items.length, 4);
    assert.equal(q.pick, PICK);
    const fits = fittingPairs(q.items, q.budget);
    assert.ok(fits.length >= 1 && fits.length <= 4, `${label}: ${fits.length} pairs fit`);
    assert.ok(judgeBasket(q, q.best).ok, `${label}: the shown pair does not fit`);
    for (const [i, j] of fits) assert.ok(judgeBasket(q, [i, j]).ok);
    return;
  }
  assert.ok(Number.isInteger(q.target) && q.target > 0, `${label}: target ${q.target}`);
  if (q.ask === 'change') {
    assert.equal(q.target, q.paid - q.price);
    assert.ok([500, 1000].includes(q.paid));
    assert.equal(q.price % 5, 0, `${label}: cash in 5 cents`);
    assert.ok(q.price % 100 !== 0 && q.price < q.paid);
    assert.equal(countUp(q.price, q.solution).at(-1), q.paid);
  } else assert.equal(q.target, total(q.items.map((i) => i.price)));
  assert.equal(total(q.solution), q.target, `${label}: the solution`);
  assert.deepEqual(judge(q, q.solution), { ok: true }, `${label}: the solution is not right`);
  assert.equal(q.solution.length, bruteFewest(q.target, q.wallet) ?? -1, `${label}: not the fewest`);
  // the solution, laid one at a time from the purse, then judged; one coin less is short
  let laid = [];
  for (const d of q.solution) {
    laid = lay(q, laid, d);
    assert.ok(laid, `${label}: cannot lay ${d}`);
  }
  assert.deepEqual(judge(q, laid), { ok: true });
  const less = judge(q, laid.slice(1));
  assert.equal(less.why, 'short');
  assert.equal(less.missing, q.solution[0]);
  // the coins shown as missing really make up the gap
  assert.equal(total(less.ghosts), less.missing);
  for (const d of q.solution) assert.ok(Object.keys(q.wallet).map(Number).includes(d));
  if (tier === 't1') {
    assert.equal(q.target % 100, 0, `${label}: whole euros`);
    assert.ok(q.target <= 500, `${label}: up to 5 euros`);
    assert.ok(Object.keys(q.wallet).every((d) => d === '100' || d === '200'), `${label}: only 1 and 2 euro coins`);
  }
  if (tier === 't2') {
    assert.equal(q.target % 50, 0, `${label}: euros and 50 cents`);
    assert.ok(q.target <= 2000, `${label}: up to 20 euros`);
    assert.ok(Object.keys(q.wallet).every((d) => [50, 100, 200, 500, 1000].includes(Number(d))));
  }
  if (tier === 't3') assert.ok(q.target < 1000);
}

test('the fixed rounds: the same every time, sound, the easiest kinds first in each tier', () => {
  for (const tier of TIER_IDS) {
    const rounds = fixed(tier);
    assert.deepEqual(rounds, fixed(tier), 'not the same twice');
    rounds.forEach((qs, k) => {
      assert.equal(qs.length, ROUND_LEN);
      assert.deepEqual(qs.map((q) => q.kind).sort(), [...KINDS[tier][k + 1]].sort());
      qs.forEach((q, i) => checkQuestion(q, tier, `${tier}-${k + 1} q${i + 1}`));
    });
  }
  // 3-5: round 1 counts up to 3 euros only; round 3 brings the 2 euro coin ("two at once")
  for (const q of fixed('t1')[0]) assert.ok(q.target <= 300 && q.kind === 'count');
  assert.ok(fixed('t1')[2].some((q) => q.kind === 'twos' && q.solution.includes(200)));
  // 6-7: round 1 whole euros, round 2 brings the 50 cent coin, round 3 as few as possible
  for (const q of fixed('t2')[0]) assert.equal(q.target % 100, 0);
  assert.ok(fixed('t2')[1].some((q) => q.target % 100 === 50));
  for (const q of fixed('t2')[2]) assert.equal(q.goal, 'fewest');
  // 8-10: cents, change, two things and a budget all appear
  const kinds = new Set(fixed('t3').flat().map((q) => q.kind));
  for (const k of ['cents', 'change', 'two', 'budget']) assert.ok(kinds.has(k), k);
});

test('200 random rounds per tier: every question sound, and the rounds differ', () => {
  for (const tier of TIER_IDS) {
    const seen = new Set();
    const t0 = performance.now();
    for (let s = 0; s < SEEDS; s++) {
      const qs = makeRound({ tier, seed: seedOf(s) });
      assert.equal(qs.length, ROUND_LEN);
      assert.deepEqual(qs.map((q) => q.kind).sort(), [...KINDS[tier][0]].sort());
      qs.forEach((q, i) => {
        checkQuestion(q, tier, `${tier} seed ${seedOf(s)} q${i + 1}`);
        if (i > 0) {
          const p = qs[i - 1];
          assert.ok(!(p.kind === q.kind && p.target === q.target && p.items[0].id === q.items[0].id), 'the same question twice in a row');
        }
      });
      seen.add(JSON.stringify(qs));
    }
    assert.ok(seen.size >= SEEDS * 0.95, `${tier}: only ${seen.size} different rounds`);
    console.log(`winkel ${tier}: 200 rounds in ${(performance.now() - t0).toFixed(0)} ms`);
  }
});

test('every price a tier asks has at least two things that may cost it', () => {
  const ranges = { t1: [100, 500, 100], t2: [100, 2000, 50] };
  for (const [tier, [lo, hi, step]] of Object.entries(ranges)) {
    for (let p = lo; p <= hi; p += step) assert.ok(ITEMS.filter((i) => p >= i.lo && p <= i.hi).length >= 2, `${tier}: ${p}`);
  }
  for (let p = 15; p <= 999; p++) assert.ok(ITEMS.filter((i) => p >= i.lo && p <= i.hi).length >= 2, `t3: ${p}`);
});

test('art: our own coins and notes with the value large, every thing drawn, no ids or url(#)', () => {
  for (const d of COINS) {
    const svg = coinSvg(d, { unit: 'cent' });
    assert.match(svg, />(\d+)<\/text>/);
    assert.ok(svg.includes(`>${d >= 100 ? d / 100 : d}</text>`), `${d}: the value on the face`);
  }
  for (const d of NOTES) assert.ok(noteSvg(d).includes(`>${d / 100}</text>`));
  // the bi-metal coins, the other way round: € 1 a gold ring round silver, € 2 a silver ring round gold
  const fills = (d) => [...coinSvg(d).matchAll(/<circle[^>]*fill="(#[0-9a-f]+)"/g)].map((m) => m[1]);
  assert.deepEqual(fills(100).slice(0, 2), ['#ecc85e', '#d5dae0']);
  assert.deepEqual(fills(200).slice(0, 2), ['#d5dae0', '#ecc85e']);
  // copper and gold differ
  assert.notEqual(coinSvg(5).match(/fill="(#[0-9a-f]+)"/)[1], coinSvg(10).match(/fill="(#[0-9a-f]+)"/)[1]);
  for (const id of ITEM_IDS) assert.ok(ITEM_ART[id], `${id} has no drawing`);
  const all = [...DENOMS.map((d) => moneySvg(d)), ...ITEM_IDS.map((id) => itemSvg(id)), tileSvg(), howSvg()].join('');
  assert.doesNotMatch(all, /\sid=|url\(#|<use|<image|href=/);
  // no real-coin or banknote marks: no stars, no bank's letters, no map
  assert.doesNotMatch(all, /ECB|EZB|BCE|EKT|star/i);
  // without a unit word the tile and the how-to picture carry no text to translate
  assert.doesNotMatch(tileSvg() + howSvg(), /<text[^>]*class="wk-unit"/);
});

test('what is saved travels with Voortgang overzetten, and nothing odd gets through', async () => {
  const save = {
    version: 1,
    games: { winkel: { stars: { 't1-1': 3, 't1-2': 2, 't3-3': 1 }, random: { t2: 4, t3: 1 }, howSeen: { t1: true, t2: true }, lastTier: 't2' } },
    settings: {},
  };
  const out = sanitizePayload(JSON.parse(JSON.stringify(payloadOf(save))));
  assert.deepEqual(out.games.winkel, save.games.winkel);
  // the whole way: a code text and back, every shape kept
  const back = await decodeText(await encodeSave(save));
  assert.deepEqual(back.games.winkel, save.games.winkel);
  const odd = sanitizePayload(
    JSON.parse('{"games":{"winkel":{"stars":{"t1-1":3,"t2-1":-2,"__proto__":3},"random":{"t2":"x","t3":2},"howSeen":{"t1":true,"t2":"yes"},"lastTier":"t3","junk":{"deep":{"er":1}}}}}'),
  );
  assert.deepEqual(odd.games.winkel.stars, { 't1-1': 3 });
  assert.deepEqual(odd.games.winkel.random, { t3: 2 });
  assert.deepEqual(odd.games.winkel.howSeen, { t1: true });
  assert.equal(odd.games.winkel.lastTier, 't3');
  // merged into another device's save: stars only go up, random rounds add up to the most
  const mine = { version: 1, games: { winkel: { stars: { 't1-1': 1, 't1-3': 3 }, random: { t2: 9 } } }, settings: {} };
  const merged = mergeTransfer(mine, out);
  assert.equal(merged.games.winkel.stars['t1-1'], 3);
  assert.equal(merged.games.winkel.stars['t1-3'], 3);
  assert.equal(merged.games.winkel.random.t2, 9);
  assert.equal(merged.games.winkel.random.t3, 1);
  assert.equal(merged.games.winkel.lastTier, 't2');
});
