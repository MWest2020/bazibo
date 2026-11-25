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
  swapFor,
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
  shopLine,
  lineText,
  LINE_KEYS,
  GREETINGS,
  isFood,
} from '../web/games/winkel/rules.js';
import { allStrings, setLang, t as tr } from '../web/js/i18n.js';
import '../web/games/winkel/strings.js';
import { meta } from '../web/games/winkel/meta.js';
import { coinSvg, noteSvg, moneySvg, itemSvg, tileSvg, howSvg, keeperSvg, tillSvg, bagSvg, KEEPER, ITEM_ART, BIG, NOTE, BAND_OPACITY } from '../web/games/winkel/art.js';
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
  // where the biggest first goes wrong: 60 from one 50 and three 20s is 20 + 20 + 20
  assert.deepEqual(fewest(60, { 50: 1, 20: 3 }), [20, 20, 20]);
  assert.deepEqual(fewest(80, { 50: 1, 20: 4, 10: 0 }), [20, 20, 20, 20]);
  assert.deepEqual(fewest(6, { 5: 1, 3: 2, 1: 0 }), [3, 3]);
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
  assert.deepEqual(short.back, []);
  assert.equal(short.missing, 150);
  assert.deepEqual(short.ghosts, [100, 50]);
  const over = judge(q, [500, 200, 100]);
  assert.equal(over.why, 'over');
  assert.equal(over.over, 50);
  assert.equal(over.extra, null, 'no 50 cent on the counter to point at');
  assert.deepEqual([over.back, over.ghosts], [[2], [50]], 'the € 1 back, a 50 cent on');
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

test('too little that the purse cannot make: take the fewest pieces back and show what goes on instead', () => {
  const twos = (target) => ({ kind: 'twos', ask: 'pay', goal: 'exact', items: [{ id: 'book', price: target }], target, wallet: WALLETS.twos, solution: fewest(target, WALLETS.twos) });
  // € 3 with both € 1 laid: no € 1 left for the last euro, so one € 1 goes back and a € 2 goes on
  assert.deepEqual(judge(twos(300), [100, 100]), { ok: false, why: 'short', missing: 100, ghosts: [200], back: [0] });
  // € 5 with both € 1: one back, and two € 2
  assert.deepEqual(judge(twos(500), [100, 100]), { ok: false, why: 'short', missing: 300, ghosts: [200, 200], back: [0] });
  // € 5 with both € 1 and a € 2: one € 1 back, one more € 2 (the € 2 stays)
  assert.deepEqual(judge(twos(500), [100, 200, 100]), { ok: false, why: 'short', missing: 100, ghosts: [200], back: [0] });
  assert.deepEqual(judge(twos(500), [200, 100, 100]), { ok: false, why: 'short', missing: 100, ghosts: [200], back: [1] });
  // what the purse can make needs no swap: € 2 or € 4 with one € 1 laid takes the other
  assert.deepEqual(judge(twos(200), [100]), { ok: false, why: 'short', missing: 100, ghosts: [100], back: [] });
  assert.deepEqual(judge(twos(400), [100, 200]), { ok: false, why: 'short', missing: 100, ghosts: [100], back: [] });
  assert.deepEqual(judge(twos(500), [200, 200]), { ok: false, why: 'short', missing: 100, ghosts: [100], back: [] });
  assert.deepEqual(judge(twos(300), [200]), { ok: false, why: 'short', missing: 100, ghosts: [100], back: [] });
  // every twos price with every too-little counter: the help always leads to a right answer
  for (const target of [200, 300, 400, 500]) {
    const q = twos(target);
    for (let ones = 0; ones <= 2; ones++) {
      for (let tw = 0; tw <= 3; tw++) {
        const laid = [...Array(ones).fill(100), ...Array(tw).fill(200)];
        if (total(laid) >= target) continue;
        const res = judge(q, laid);
        assert.equal(res.why, 'short');
        const after = [...laid.filter((_, i) => !res.back.includes(i)), ...res.ghosts];
        assert.equal(total(after), target, `${target} from ${laid}: ${JSON.stringify(res)}`);
        for (const n of Object.values(left(q.wallet, after))) assert.ok(n >= 0, `${target} from ${laid}: more than the purse has`);
        assert.ok(res.ghosts.length, 'always a coin to show');
      }
    }
  }
  // the same over 200 seeds of every tier: whatever too little lies there, the help adds up
  for (const tier of TIER_IDS) {
    for (let s = 0; s < 40; s++) {
      for (const q of makeRound({ tier, seed: seedOf(s) })) {
        if (q.ask === 'basket') continue;
        for (let k = 0; k < q.solution.length; k++) {
          const laid = q.solution.slice(0, k);
          const res = judge(q, laid);
          const after = [...laid.filter((_, i) => !res.back.includes(i)), ...res.ghosts];
          assert.equal(total(after), q.target);
        }
      }
    }
  }
  assert.deepEqual(swapFor(twos(300), [100, 100]), { back: [0], ghosts: [200] });
});

test("too much that nothing on the counter makes: the help takes pieces back and lays others, and adds up", () => {
  // the youngest: € 3 paid 2 + 2, € 5 paid 2 + 2 + 2
  const twos = (target) => ({ kind: 'twos', ask: 'pay', goal: 'exact', items: [{ id: 'ball', price: target }], target, wallet: WALLETS.twos, solution: fewest(target, WALLETS.twos) });
  assert.deepEqual(judge(twos(300), [200, 200]), { ok: false, why: 'over', over: 100, extra: null, back: [0], ghosts: [100] });
  assert.deepEqual(judge(twos(500), [200, 200, 200]), { ok: false, why: 'over', over: 100, extra: null, back: [0], ghosts: [100] });
  // every too-much counter of every pay question (the solution with one piece swapped up): marked pieces or a swap that adds up
  for (const tier of TIER_IDS) {
    const all = [...fixed(tier).flat()];
    for (let s = 0; s < SEEDS; s++) all.push(...makeRound({ tier, seed: seedOf(s) }));
    for (const q of all) {
      if (q.ask === 'basket') continue;
      for (let k = 0; k < q.solution.length; k++) {
        const rest = left(q.wallet, q.solution);
        for (const d of Object.keys(q.wallet).map(Number).filter((x) => x > q.solution[k] && rest[x] > 0)) {
          const laid = q.solution.map((x, i) => (i === k ? d : x));
          const res = judge(q, laid);
          assert.equal(res.why, 'over');
          if (res.extra) assert.equal(res.extra.reduce((n, i) => n + laid[i], 0), res.over);
          else {
            const after = [...laid.filter((_, i) => !res.back.includes(i)), ...res.ghosts];
            assert.equal(total(after), q.target, `${q.kind} ${q.target} from ${laid}: ${JSON.stringify(res)}`);
            for (const n of Object.values(left(q.wallet, after))) assert.ok(n >= 0);
            assert.ok(res.back.length && res.ghosts.length);
          }
        }
      }
    }
  }
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

test('variety: an amount comes back in a round only when the kind has run out of others', () => {
  const key = (q) => (q.ask === 'basket' ? `${q.budget}:${q.items.map((i) => i.price)}` : q.target);
  const check = (qs, label) => {
    for (const kind of new Set(qs.map((q) => q.kind))) {
      const mine = qs.filter((q) => q.kind === kind).map(key);
      const counts = {};
      for (const k of mine) counts[k] = (counts[k] || 0) + 1;
      assert.ok(Math.max(...Object.values(counts)) <= 2, `${label} ${kind}: ${mine}`);
    }
  };
  for (const tier of TIER_IDS) {
    fixed(tier).forEach((qs, k) => check(qs, `${tier}-${k + 1}`));
    for (let s = 0; s < SEEDS; s++) check(makeRound({ tier, seed: seedOf(s) }), `${tier} seed ${s}`);
  }
  // 3-5 round 3: four "two at once" questions, each a different amount
  const twos = fixed('t1')[2].filter((q) => q.kind === 'twos').map((q) => q.target);
  assert.equal(new Set(twos).size, twos.length, `t1-3 twos: ${twos}`);
  // round 1 of 3-5 starts with an amount where too few coins can be laid (the smoke test needs it)
  assert.ok(fixed('t1')[0][0].target >= 200);
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
  // drawn to scale: a coin's radius is its real diameter against the 2 euro coin's, a note's width likewise
  const radius = (d) => Number(coinSvg(d).match(/<circle cx="50" cy="50" r="([\d.]+)"/)[1]);
  for (const d of COINS) assert.ok(Math.abs(radius(d) / radius(200) - SIZE_MM[d] / SIZE_MM[200]) < 0.002, `${d}: drawn at the wrong size`);
  const width = (d) => Number(noteSvg(d).match(/<rect [^>]*? width="([\d.]+)"/)[1]);
  const height = (d) => Number(noteSvg(d).match(/<rect [^>]*? height="([\d.]+)"/)[1]);
  for (const d of NOTES) {
    assert.ok(Math.abs(width(d) / width(2000) - SIZE_MM[d][0] / SIZE_MM[2000][0]) < 0.002, `${d}: note width`);
    assert.ok(Math.abs(height(d) / height(2000) - SIZE_MM[d][1] / SIZE_MM[2000][1]) < 0.002, `${d}: note height`);
  }
  // the small value on a note's band is readable: 4.5:1 or more on the band over the face
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c) => {
    const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const d of NOTES) {
    const c = NOTE[d];
    const band = rgb(c.band).map((v, i) => v * BAND_OPACITY + rgb(c.face)[i] * (1 - BAND_OPACITY));
    const [a, b] = [lum(band), lum(rgb(c.ink))].sort((x, y) => y - x);
    const ratio = (a + 0.05) / (b + 0.05);
    assert.ok(ratio >= 4.5, `${d}: the value on the band is ${ratio.toFixed(2)}:1`);
    assert.match(noteSvg(d), new RegExp(`fill="${c.ink}" class="wk-face wk-band-value">${d / 100}<`));
  }
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

/**
 * Every way to lay money from `wallet` (each count of each coin and note), by the amount it makes.
 * Small wallets only (the cents purse has 31104 ways); kept per wallet.
 */
const WAYS = new Map();
function waysOf(wallet) {
  const key = JSON.stringify(wallet);
  if (WAYS.has(key)) return WAYS.get(key);
  const ds = Object.keys(wallet).map(Number);
  const out = new Map();
  const walk = (k, laid, sum) => {
    if (k === ds.length) {
      if (!out.has(sum)) out.set(sum, []);
      out.get(sum).push(laid);
      return;
    }
    for (let j = 0; j <= wallet[ds[k]]; j++) walk(k + 1, [...laid, ...Array(j).fill(ds[k])], sum + j * ds[k]);
  };
  walk(0, [], 0);
  WAYS.set(key, out);
  return out;
}

/**
 * Mark's € 4 (25 Nov 2026): when the amount is exact, every way of making it is right. Every set of
 * coins and notes from the purse (or till) that adds up to the price, laid one by one through `lay`
 * and in the other order too, is judged right; in a 'fewest' question it is right with the fewest
 * pieces and otherwise asks for fewer, never too little or too much.
 */
function checkEveryWay(q, label) {
  if (q.ask === 'basket') return 0;
  const ways = waysOf(q.wallet).get(q.target) || [];
  assert.ok(ways.length >= 1, `${label}: no way to pay ${q.target}`);
  for (const way of ways) {
    let laid = [];
    for (const d of way) {
      laid = lay(q, laid, d);
      assert.ok(laid, `${label}: cannot lay ${way}`);
    }
    for (const order of [laid, [...laid].reverse()]) {
      const res = judge(q, order);
      if (q.goal !== 'fewest') assert.deepEqual(res, { ok: true }, `${label}: ${order} for ${q.target} not judged right`);
      else if (order.length === q.solution.length) assert.deepEqual(res, { ok: true }, `${label}: ${order} is as few as can be`);
      else assert.deepEqual(res, { ok: false, why: 'more', n: q.solution.length }, `${label}: ${order}`);
    }
  }
  return ways.length;
}

test('every way to make the exact amount is right: the fixed rounds and 200 seeds per tier', () => {
  let n = 0;
  for (const tier of TIER_IDS) {
    fixed(tier).forEach((qs, k) => qs.forEach((q, i) => (n += checkEveryWay(q, `${tier}-${k + 1} q${i + 1}`))));
    for (let s = 0; s < SEEDS; s++) makeRound({ tier, seed: seedOf(s) }).forEach((q, i) => (n += checkEveryWay(q, `${tier} seed ${seedOf(s)} q${i + 1}`)));
  }
  assert.ok(n > 10000, `only ${n} ways checked`);
});

test("3-5 never asks for as few coins as possible, and € 4 is 1 + 1 + 2 as well as 2 + 2", () => {
  for (const kinds of KINDS.t1) assert.ok(!kinds.includes('fewest'));
  const all = [...fixed('t1').flat()];
  for (let s = 0; s < SEEDS; s++) all.push(...makeRound({ tier: 't1', seed: seedOf(s) }));
  let fours = 0;
  for (const q of all) {
    assert.equal(q.goal, 'exact', `3-5 ${q.kind}: goal ${q.goal}`);
    if (q.target !== 400) continue;
    fours++;
    if ((q.wallet[100] || 0) >= 2 && (q.wallet[200] || 0) >= 1) assert.deepEqual(judge(q, [100, 100, 200]), { ok: true });
    if ((q.wallet[200] || 0) >= 2) assert.deepEqual(judge(q, [200, 200]), { ok: true });
  }
  assert.ok(fours > 20, `only ${fours} questions of € 4`);
  // the twos purse makes both ways
  const q = { kind: 'twos', ask: 'pay', goal: 'exact', items: [{ id: 'ball', price: 400 }], target: 400, wallet: WALLETS.twos, solution: fewest(400, WALLETS.twos) };
  for (const way of [[100, 100, 200], [200, 100, 100], [200, 200]]) {
    let laid = [];
    for (const d of way) laid = lay(q, laid, d);
    assert.deepEqual(judge(q, laid), { ok: true }, `${way}`);
  }
  assert.deepEqual(waysOf(WALLETS.twos).get(400).map((w) => w.join('+')).sort(), ['100+100+200', '200+200']);
});

// ---------- the shopkeeper's lines ----------

const strings = allStrings();
const raw = (lang, line, opts = {}) => {
  setLang(lang);
  const cents = !!opts.cents;
  return lineText(line, tr, (c) => money(c, lang, { decimals: cents }));
};
/** A line as text, with the no-break space after € written as a space (to compare). */
const say = (lang, line, opts) => raw(lang, line, opts).replaceAll('\u00a0', ' ');

test('the shopkeeper says every line in Dutch and English, through t(), with nothing left unfilled', () => {
  for (const key of LINE_KEYS) for (const lang of ['nl', 'en']) assert.ok(strings[lang][key], `${key} has no ${lang} text`);
  for (const id of ITEM_IDS) assert.equal(typeof isFood(id), 'boolean');
  const seen = new Set();
  const check = (q, label, cents) => {
    const lines = [shopLine(q, { say: 'hello', i: 0 }), shopLine(q, { say: 'hello', i: 3, again: true }), shopLine(q, { say: 'show' }), shopLine(q, { say: 'try', res: { ok: true } })];
    if (q.ask === 'basket') {
      lines.push(shopLine(q, { say: 'try', res: judgeBasket(q, [0, 1, 2, 3].filter((k) => !q.best.includes(k)).slice(0, 2)) }));
    } else {
      const tries = [q.solution.slice(1), [...q.solution, ...Object.keys(q.wallet).map(Number).filter((d) => left(q.wallet, q.solution)[d] > 0).slice(0, 1)]];
      if (q.kind === 'twos' && q.target % 200) tries.push([100, 100]); // the swap
      // the smallest piece swapped for a bigger one: too much, often with nothing on the counter that makes it
      const small = q.solution.at(-1);
      const big = Object.keys(q.wallet).map(Number).find((d) => d > small && left(q.wallet, q.solution.slice(0, -1))[d] > 0);
      if (big) tries.push([...q.solution.slice(0, -1), big]);
      if (q.goal === 'fewest') tries.push(waysOf(q.wallet).get(q.target).find((w) => w.length > q.solution.length)); // more pieces
      for (const laid of tries) {
        const res = judge(q, laid);
        if (!res.ok) lines.push(shopLine(q, { say: 'try', res, laid }));
      }
    }
    for (const line of lines) {
      assert.ok(LINE_KEYS.includes(line.key), `${label}: ${line.key} is not in LINE_KEYS`);
      seen.add(line.key);
      for (const v of Object.values(line.vars)) if (typeof v === 'string') assert.ok(LINE_KEYS.includes(v) || v.startsWith('winkel.item.'), `${label}: ${v}`);
      for (const lang of ['nl', 'en']) {
        const text = raw(lang, line, { cents });
        assert.doesNotMatch(text, /[{}]|undefined|null|NaN|\s{2}|^\s|\s$/, `${label} ${lang}: ${text}`);
        assert.match(text, /^(\p{Lu}|€)/u, `${label} ${lang}: no capital: ${text}`);
        assert.ok(text.length <= 90, `${label} ${lang}: too long for the bubble (${text.length}): ${text}`);
        assert.doesNotMatch(text, /fout|wrong|helaas/i, `${label} ${lang}: never wrong`);
      }
    }
  };
  for (const tier of TIER_IDS) {
    fixed(tier).forEach((qs, k) => qs.forEach((q, i) => check(q, `${tier}-${k + 1} q${i + 1}`, TIERS[tier].cents)));
    for (let s = 0; s < 40; s++) makeRound({ tier, seed: seedOf(s) }).forEach((q, i) => check(q, `${tier} seed ${s} q${i + 1}`, TIERS[tier].cents));
  }
  for (const key of LINE_KEYS.filter((k) => k.startsWith('winkel.say.') && k !== 'winkel.say.count')) assert.ok(seen.has(key), `${key} is never said`);
  setLang('nl');
});

test('the lines: a greeting with the price, too little, too much, thanks, change and as few as possible', () => {
  const kite = { kind: 'exact', ask: 'pay', goal: 'exact', items: [{ id: 'kite', price: 600 }], target: 600, wallet: WALLETS.whole, solution: fewest(600, WALLETS.whole) };
  assert.equal(say('nl', shopLine(kite, { say: 'hello', i: 0 })), 'Goedemorgen! Een vlieger, dat is € 6.');
  assert.equal(say('en', shopLine(kite, { say: 'hello', i: 0 })), 'Good morning! A kite, that is € 6.');
  // the next questions are greeted in turn; after a try the price again, without a greeting
  const greets = Array.from({ length: 6 }, (_, i) => shopLine(kite, { say: 'hello', i }).vars.hi);
  assert.deepEqual(greets, ['winkel.hi.0', 'winkel.hi.1', 'winkel.hi.2', 'winkel.hi.1', 'winkel.hi.2', 'winkel.hi.1']);
  assert.equal(GREETINGS, 3);
  assert.equal(say('nl', shopLine(kite, { say: 'hello', i: 2, again: true })), 'Een vlieger, dat is € 6.');
  // too little: what is missing, politely (the ghost coins show it on the counter)
  const short = judge(kite, [500]);
  assert.equal(say('nl', shopLine(kite, { say: 'try', res: short, laid: [500] })), 'Nog € 1, alsjeblieft.');
  assert.equal(say('en', shopLine(kite, { say: 'try', res: short, laid: [500] })), '€ 1 more, please.');
  // too much without a piece that makes it: pay it exactly (the € 2 marked, a € 1 ghost); with one: take that back (it is marked)
  const over = judge(kite, [500, 200]);
  assert.deepEqual(over, { ok: false, why: 'over', over: 100, extra: null, back: [1], ghosts: [100] });
  assert.equal(say('nl', shopLine(kite, { say: 'try', res: over, laid: [500, 200] })), 'Dat is € 1 te veel. Kun je het precies betalen?');
  assert.equal(say('en', shopLine(kite, { say: 'try', res: over, laid: [500, 200] })), 'That is € 1 too much. Can you pay it exactly?');
  const over2 = judge(kite, [500, 100, 100]);
  assert.deepEqual(over2.extra, [1]);
  assert.equal(say('nl', shopLine(kite, { say: 'try', res: over2, laid: [500, 100, 100] })), 'Dat is € 1 te veel. Pak die maar terug.');
  // right: thanks, and fun with a toy or a good meal
  assert.equal(say('nl', shopLine(kite, { say: 'try', res: { ok: true } })), 'Dank je wel! Veel plezier met je vlieger!');
  assert.equal(say('en', shopLine(kite, { say: 'try', res: { ok: true } })), 'Thank you! Have fun with your kite!');
  const apple = { ...kite, items: [{ id: 'apple', price: 100 }], target: 100 };
  assert.equal(say('nl', shopLine(apple, { say: 'try', res: { ok: true } })), 'Dank je wel! Smullen maar van je appel!');
  assert.equal(say('en', shopLine(apple, { say: 'hello', i: 1 })), 'Hello! An apple, that is € 1.');
  // the swap of the twos purse
  const twos = { kind: 'twos', ask: 'pay', goal: 'exact', items: [{ id: 'ball', price: 300 }], target: 300, wallet: WALLETS.twos, solution: fewest(300, WALLETS.twos) };
  const sw = judge(twos, [100, 100]);
  assert.equal(say('nl', shopLine(twos, { say: 'try', res: sw, laid: [100, 100] })), 'Nog € 1, alsjeblieft. Pak eerst € 1 terug en ruil.');
  assert.equal(say('nl', shopLine(twos, { say: 'hello', i: 0 })), 'Goedemorgen! Een bal, dat is € 3. Een munt van 2 telt voor twee!');
  // as few as possible: asked plainly up front, and the right amount with more pieces asks for fewer
  const few = { ...kite, kind: 'fewest', goal: 'fewest', wallet: WALLETS.half, solution: fewest(600, WALLETS.half) };
  assert.equal(say('nl', shopLine(few, { say: 'hello', i: 0 })), 'Een vlieger, dat is € 6. Kun je betalen met zo min mogelijk munten en briefjes?');
  assert.equal(say('en', shopLine(few, { say: 'hello', i: 0 })), 'A kite, that is € 6. Can you pay with as few coins and notes as possible?');
  const more = judge(few, [200, 200, 200]);
  assert.equal(more.why, 'more');
  assert.equal(say('nl', shopLine(few, { say: 'try', res: more })), 'Het klopt! Kan het ook met minder munten en briefjes?');
  assert.equal(say('en', shopLine(few, { say: 'try', res: more })), 'That is right! Can you do it with fewer coins and notes?');
  // change: counted by the child from the till, "this is what you get back"
  const change = { kind: 'change', ask: 'change', goal: 'exact', items: [{ id: 'balloon', price: 340 }], price: 340, paid: 500, target: 160, wallet: WALLETS.till, solution: fewest(160, WALLETS.till) };
  assert.equal(say('nl', shopLine(change, { say: 'hello', i: 0 }), { cents: true }), 'Een ballon, dat is € 3,40. Je geeft me € 5,00. Tel jij wat je terugkrijgt?');
  assert.equal(say('nl', shopLine(change, { say: 'try', res: { ok: true } })), 'Dat klopt! Dit krijg je terug.');
  assert.equal(say('nl', shopLine(change, { say: 'show' })), 'Kijk, dit krijg je terug.');
  assert.equal(say('nl', shopLine(change, { say: 'try', res: judge(change, [100, 50, 10, 10]) }), { cents: true }), 'Dat is € 0,10 te veel. Dat mag terug in de kassa.');
  // two things and a budget
  const two = { kind: 'two', ask: 'pay', goal: 'exact', items: [{ id: 'apple', price: 120 }, { id: 'book', price: 340 }], target: 460, wallet: WALLETS.cents, solution: fewest(460, WALLETS.cents) };
  assert.equal(say('nl', shopLine(two, { say: 'hello', i: 1 })), 'Hallo! Een appel en een boek. Betaal je ze samen?');
  assert.equal(say('nl', shopLine(two, { say: 'try', res: { ok: true } })), 'Dank je wel! Veel plezier ermee!');
  const basket = { kind: 'budget', ask: 'basket', items: [{ id: 'apple', price: 120 }, { id: 'book', price: 400 }, { id: 'milk', price: 150 }, { id: 'ball', price: 350 }], budget: 500, pick: 2, best: [0, 2] };
  assert.equal(say('nl', shopLine(basket, { say: 'hello', i: 0 })), 'Goedemorgen! Je hebt € 5. Welke twee neem je mee?');
  assert.equal(say('nl', shopLine(basket, { say: 'try', res: judgeBasket(basket, [1, 3]) })), 'Samen is dat € 7,50, € 2,50 te veel. Kies iets anders?');
  // the no-break space after € stays
  assert.ok(raw('nl', shopLine(kite, { say: 'hello', i: 0 })).includes('€\u00a06'));
  assert.throws(() => shopLine(kite, { say: 'sing' }));
  setLang('nl');
});

test('the shopkeeper, the till and the bag are our own drawings: no ids, url(#) or styles', () => {
  const all = [keeperSvg(), tillSvg(), ...ITEM_IDS.map((id) => bagSvg(id))].join('');
  assert.doesNotMatch(all, /\sid=|url\(#|<use|<image|href=|style=|<text/);
  // the bag holds the thing it was bought for
  for (const id of ITEM_IDS) assert.ok(bagSvg(id).includes(ITEM_ART[id]), id);
  // a mouse of its own colours: never black ears, every colour different
  const colours = Object.values(KEEPER);
  assert.equal(new Set(colours).size, colours.length);
  for (const c of colours) assert.match(c, /^#[0-9a-f]{6}$/);
  assert.notEqual(KEEPER.ear, '#000000');
  assert.ok(colours.every((c) => keeperSvg().includes(c)), 'every colour is drawn');
});
