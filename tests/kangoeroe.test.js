import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIERS,
  TIER_IDS,
  ROUND_LEN,
  KINDS,
  OPTIONS,
  ROUNDS_PER_TIER,
  makeRound,
  starsFor,
  hashSeed,
  buttonsFor,
  optionsFor,
  stepsOf,
  tenBetween,
  viaTen,
  landing,
  isRight,
  startHops,
  canHop,
  hop,
  jump,
  undo,
  pipsDone,
  viewSize,
  startView,
  followView,
  rng,
} from '../web/games/kangoeroe/hops.js';
import { meta } from '../web/games/kangoeroe/meta.js';
import { kangaroo, tileSvg, howSvg } from '../web/games/kangoeroe/art.js';

const SEEDS = 200;
/** Every question of 200 seeded rounds per tier (and of rounds 1-3, the fixed ones). */
function allRounds(tier) {
  const out = [];
  for (let s = 0; s < SEEDS; s++) out.push(makeRound({ tier, seed: hashSeed(`test:${tier}:${s}`), round: 0 }));
  for (let r = 1; r <= ROUNDS_PER_TIER; r++) out.push(makeRound({ tier, seed: hashSeed(`kangoeroe:${tier}-${r}`), round: r }));
  return out;
}
const everyQ = (tier) => allRounds(tier).flat();
const onLine = (n, tier) => Number.isInteger(n) && n >= 0 && n <= TIERS[tier].max;

/** Breadth-first: the fewest hops with the buttons on offer from the start to `goal`, or -1. */
function fewestHops(q, tier, goal) {
  const seen = new Map([[q.start, 0]]);
  const todo = [startHops(q)];
  while (todo.length) {
    const st = todo.shift();
    if (st.pos === goal) return seen.get(st.pos);
    for (const d of q.buttons) {
      const next = hop(q, tier, st, d);
      if (next && !seen.has(next.pos)) {
        seen.set(next.pos, seen.get(st.pos) + 1);
        todo.push(next);
      }
    }
  }
  return -1;
}

test('meta: the first tier is free, the others need the full version', () => {
  assert.equal(meta.id, 'kangoeroe');
  assert.equal(meta.group, 'learning');
  assert.deepEqual([...meta.freeTiers], ['t1']);
  assert.equal(meta.isLocked({ tier: 't1' }, false), false);
  assert.equal(meta.isLocked({ tier: 't2' }, false), true);
  assert.equal(meta.isLocked({ tier: 't3' }, false), true);
  for (const tier of TIER_IDS) assert.equal(meta.isLocked({ tier }, true), false);
});

test('rounds: 8 questions of the tier\'s kinds, the same for the same seed, never a question twice', () => {
  for (const tier of TIER_IDS) {
    for (const qs of allRounds(tier)) {
      assert.equal(qs.length, ROUND_LEN);
      assert.deepEqual(qs.map((q) => q.kind).sort(), [...KINDS[tier]].sort());
      const keys = qs.map((q) => `${q.kind}:${q.start}:${q.terms.join(',')}`);
      assert.equal(new Set(keys).size, keys.length, `${tier}: a question twice in ${keys}`);
    }
    assert.deepEqual(makeRound({ tier, seed: 7 }), makeRound({ tier, seed: 7 }));
    assert.notDeepEqual(makeRound({ tier, seed: hashSeed('kangoeroe:a') }), makeRound({ tier, seed: hashSeed('kangoeroe:b') }));
  }
  assert.throws(() => makeRound({ tier: 't9', seed: 1 }));
});

test('every number is on the line: start, answer, flag and the way; never below 0', () => {
  for (const tier of TIER_IDS) {
    for (const q of everyQ(tier)) {
      const where = `${tier} ${JSON.stringify(q)}`;
      assert.ok(onLine(q.start, tier), where);
      assert.ok(onLine(landing(q), tier), where);
      assert.ok(q.answer >= 0 && Number.isInteger(q.answer), where);
      for (const [a, b] of q.hint) assert.ok(onLine(a, tier) && onLine(b, tier) && a !== b, where);
      if (q.ask === 'land') assert.equal(q.answer, q.start + q.terms.reduce((x, y) => x + y, 0), where);
      else assert.equal(q.answer, Math.abs(q.to - q.start), where);
    }
  }
});

test('the way (hint) runs from the start to the answer in hops that join up', () => {
  for (const tier of TIER_IDS) {
    for (const q of everyQ(tier)) {
      const where = `${tier} ${JSON.stringify(q)}`;
      assert.ok(q.hint.length >= 1, where);
      assert.equal(q.hint[0][0], q.start, where);
      for (let k = 1; k < q.hint.length; k++) assert.equal(q.hint[k][0], q.hint[k - 1][1], where);
      assert.equal(q.hint[q.hint.length - 1][1], landing(q), where);
      // the way never turns round: every arc goes the same way as the sum
      const dir = Math.sign(landing(q) - q.start);
      for (const [a, b] of q.hint.slice(0, q.kind === 'two' ? -2 : undefined)) assert.equal(Math.sign(b - a), dir, where);
    }
  }
});

test('over 10 the way goes via 10: two arcs, the first ending on the ten (t2), and via the ten in t3', () => {
  let over = 0;
  let total = 0;
  for (const q of everyQ('t2')) {
    total++;
    const ten = tenBetween(q.start, landing(q));
    if (ten === null) {
      for (const [a, b] of q.hint) assert.equal(Math.abs(b - a), 1, `t2 not over 10, single hops: ${JSON.stringify(q)}`);
      continue;
    }
    over++;
    assert.equal(ten, 10, JSON.stringify(q));
    assert.equal(q.hint.length, 2, `t2 over 10 in two arcs: ${JSON.stringify(q)}`);
    assert.deepEqual(q.hint[0], [q.start, 10]);
    assert.deepEqual(q.hint[1], [10, landing(q)]);
  }
  assert.ok(over / total > 0.6, `most t2 questions go over 10 (${over} of ${total})`);
  for (const q of everyQ('t3')) {
    if (q.kind === 'via') {
      assert.equal(q.hint.length, 2, JSON.stringify(q));
      assert.equal(q.hint[0][1] % 10, 0, `t3 via: first to the ten ${JSON.stringify(q)}`);
      assert.notEqual(q.start % 10, 0);
      assert.notEqual(q.answer % 10, 0);
    }
    if (q.kind === 'two') {
      const [tens, units] = q.terms;
      assert.equal(Math.abs(tens) % 10, 0, JSON.stringify(q));
      assert.ok(Math.abs(units) >= 2 && Math.abs(units) <= 9, JSON.stringify(q));
      const k = Math.abs(tens) / 10;
      for (const [a, b] of q.hint.slice(0, k)) assert.equal(b - a, Math.sign(tens) * 10, JSON.stringify(q));
      const rest = q.hint.slice(k);
      const mid = q.start + tens;
      assert.ok(onLine(mid, 't3'));
      assert.deepEqual(rest, viaTen(mid, q.answer, false), JSON.stringify(q));
    }
  }
  assert.deepEqual(viaTen(8, 13), [[8, 10], [10, 13]]);
  assert.deepEqual(viaTen(13, 8), [[13, 10], [10, 8]]);
  assert.deepEqual(viaTen(3, 6), [[3, 4], [4, 5], [5, 6]]);
  assert.deepEqual(viaTen(10, 13), [[10, 11], [11, 12], [12, 13]]); // starting on 10 is not "over"
  assert.deepEqual(viaTen(47, 55, false), [[47, 50], [50, 55]]);
  assert.equal(tenBetween(8, 10), null);
});

test('every question can be solved with the hop buttons it offers', () => {
  for (const tier of TIER_IDS) {
    for (const q of everyQ(tier)) {
      const where = `${tier} ${JSON.stringify(q)}`;
      assert.deepEqual(q.buttons, buttonsFor(q, tier));
      if (q.ask === 'count') {
        // the flag is reached in exactly `answer` hops of one, so counting the arcs gives the answer
        assert.equal(fewestHops(q, tier, q.to), q.answer, where);
        assert.deepEqual(q.buttons, [Math.sign(q.to - q.start)], where);
      } else {
        assert.ok(fewestHops(q, tier, q.answer) >= 0, `cannot hop to the answer: ${where}`);
        // and following the way with the buttons works too, hop by hop
        let st = startHops(q);
        for (const [a, b] of q.hint) {
          const d = b - a;
          const unit = q.buttons.includes(d) ? d : q.buttons.find((x) => Math.abs(x) === 1 && Math.sign(x) === Math.sign(d)) ?? q.buttons.find((x) => Math.sign(x) === Math.sign(d) && d % x === 0);
          assert.ok(unit, `no button for the arc ${a}->${b}: ${where}`);
          for (let k = 0; k < d / unit; k++) st = hop(q, tier, st, unit);
          assert.equal(st.pos, b, where);
        }
        assert.ok(isRight(q, st.pos), where);
      }
    }
  }
});

test('tier 1: a line to 10, forward only, small hops; "how many hops?" and "3 + 4"', () => {
  const kinds = new Set();
  for (const qs of allRounds('t1')) {
    for (const q of qs) {
      kinds.add(q.kind);
      assert.ok(q.buttons.every((d) => d === 1), JSON.stringify(q));
      assert.ok(landing(q) > q.start, JSON.stringify(q));
      assert.ok(q.terms[0] >= 1 && q.terms[0] <= 6, JSON.stringify(q));
      if (q.kind === 'count') assert.ok(q.answer >= 2);
    }
  }
  assert.deepEqual([...kinds].sort(), ['add', 'count']);
  // round 1 is the gentlest: hops of at most 4
  for (const q of makeRound({ tier: 't1', seed: hashSeed('kangoeroe:t1-1'), round: 1 })) assert.ok(q.terms[0] <= 4);
});

test('tier 2: to 20, adding and taking away, the missing number; forward and back', () => {
  const seen = { up: 0, down: 0, missingUp: 0, missingDown: 0 };
  for (const q of everyQ('t2')) {
    assert.ok(landing(q) <= 20);
    if (q.kind === 'add') assert.ok(q.terms[0] > 0);
    if (q.kind === 'sub') assert.ok(q.terms[0] < 0 && q.answer >= 1);
    if (q.kind === 'missing') {
      assert.equal(q.ask, 'count');
      seen[q.to > q.start ? 'missingUp' : 'missingDown']++;
    }
    if (q.ask === 'land') {
      assert.deepEqual(q.buttons, [-1, 1]);
      seen[q.answer > q.start ? 'up' : 'down']++;
    }
  }
  for (const [k, n] of Object.entries(seen)) assert.ok(n > 50, `t2 ${k}: only ${n}`);
});

test('tier 3: to 100 with hops of 10, via a ten, two steps, counting by 2s and 5s; + and − mixed', () => {
  let plus = 0;
  let minus = 0;
  const steps = new Set();
  for (const q of everyQ('t3')) {
    const where = JSON.stringify(q);
    assert.ok(landing(q) <= 100);
    if (q.kind === 'skip') {
      steps.add(q.step);
      assert.ok([2, 5].includes(q.step), where);
      assert.deepEqual(q.buttons, [-q.step, q.step]);
      assert.equal(q.answer - q.start, Math.sign(q.terms[0]) * q.hops * q.step, where);
      assert.equal(q.start % q.step, 0, `skip counting starts on the count: ${where}`);
      assert.equal(q.hint.length, q.hops);
    } else assert.deepEqual(q.buttons, [-10, -1, 1, 10]);
    if (q.kind === 'tens') {
      assert.equal(Math.abs(q.terms[0]) % 10, 0);
      assert.ok(Math.abs(q.terms[0]) >= 20 && Math.abs(q.terms[0]) <= 50, where);
      for (const [a, b] of q.hint) assert.equal(Math.abs(b - a), 10);
    }
    if (q.answer > q.start) plus++;
    else minus++;
  }
  assert.deepEqual([...steps].sort(), [2, 5]);
  assert.ok(plus > 300 && minus > 300, `t3 mixes + and − (${plus} / ${minus})`);
});

test('"how many hops?" offers the answer, one more (counting the start too) and other near numbers', () => {
  for (const tier of TIER_IDS) {
    for (const q of everyQ(tier).filter((x) => x.ask === 'count')) {
      assert.equal(q.options.length, OPTIONS[tier]);
      assert.ok(q.options.includes(q.answer));
      assert.ok(q.options.includes(q.answer + 1));
      assert.equal(new Set(q.options).size, q.options.length);
      assert.ok(q.options.every((n) => Number.isInteger(n) && n >= 1));
      assert.deepEqual(q.options, [...q.options].sort((a, b) => a - b));
    }
  }
  const low = optionsFor(1, 3, rng(1));
  assert.ok(low.length === 3 && low.includes(1) && low.includes(2) && low.every((n) => n >= 1), String(low));
  assert.equal(optionsFor(2, 4, rng(5)).length, 4);
});

test('hopping: only the hops on offer, never off the line, never past the flag; undo and a jump', () => {
  const add = { kind: 'add', ask: 'land', start: 9, answer: 10, terms: [1], hint: [[9, 10]], buttons: [1] };
  let st = startHops(add);
  assert.equal(canHop(add, 't1', st, -1), false); // forward only in tier 1
  st = hop(add, 't1', st, 1);
  assert.deepEqual(st, { pos: 10, trail: [[9, 10]] });
  assert.equal(hop(add, 't1', st, 1), null); // the end of the line
  assert.deepEqual(undo(st), { pos: 9, trail: [] });
  assert.equal(undo(startHops(add)), null);

  const count = { kind: 'count', ask: 'count', start: 3, to: 5, answer: 2, terms: [2], hint: [[3, 4], [4, 5]], buttons: [1], options: [1, 2, 3] };
  st = hop(count, 't1', hop(count, 't1', startHops(count), 1), 1);
  assert.equal(st.pos, 5);
  assert.equal(hop(count, 't1', st, 1), null); // the kangaroo stops at the flag
  assert.equal(jump(count, 't1', st, 4), null); // no big jumps when the hops are what is counted

  const sub = { kind: 'sub', ask: 'land', start: 1, answer: 0, terms: [-1], hint: [[1, 0]], buttons: [-1, 1] };
  st = hop(sub, 't2', startHops(sub), -1);
  assert.equal(st.pos, 0);
  assert.equal(hop(sub, 't2', st, -1), null); // never below 0
  assert.equal(hop(sub, 't2', st, 10), null); // not a button here

  const big = { kind: 'tens', ask: 'land', start: 95, answer: 75, terms: [-20], hint: [[95, 85], [85, 75]], buttons: [-10, -1, 1, 10] };
  assert.equal(hop(big, 't3', startHops(big), 10), null); // 105 is off the line
  assert.equal(hop(big, 't3', startHops(big), -10).pos, 85);
  st = jump(big, 't3', startHops(big), 75);
  assert.deepEqual(st, { pos: 75, trail: [[95, 75]] });
  assert.equal(jump(big, 't3', st, 75), null); // already there
  assert.equal(jump(big, 't3', st, 101), null);
  assert.equal(jump(big, 't3', st, -1), null);
  assert.ok(isRight(big, st.pos));
  assert.ok(!isRight(big, 74));
});

test('tier 1 "3 + 4": the pips fill with the hops forward from the start, never more than planned', () => {
  const q = { kind: 'add', ask: 'land', start: 3, answer: 7, terms: [4], hint: stepsOf(3, 7), buttons: [1] };
  let st = startHops(q);
  assert.equal(pipsDone(q, st), 0);
  st = hop(q, 't1', st, 1);
  st = hop(q, 't1', st, 1);
  assert.equal(pipsDone(q, st), 2);
  for (let k = 0; k < 5; k++) st = hop(q, 't1', st, 1) || st;
  assert.equal(st.pos, 10);
  assert.equal(pipsDone(q, st), 4);
});

test('the view: the whole line to 20, a window of tens on 0-100 that keeps the kangaroo in sight', () => {
  assert.equal(viewSize('t1', 284), 10);
  assert.equal(viewSize('t2', 284), 20);
  assert.equal(viewSize('t3', 284), 30); // a 320 px phone
  assert.equal(viewSize('t3', 354), 40); // a 390 px phone
  assert.equal(viewSize('t3', 1244), 100); // desktop: all of it
  assert.equal(viewSize('t3', 100), 20); // never fewer than 20
  for (let px = 200; px <= 1400; px += 37) {
    const n = viewSize('t3', px);
    assert.equal(n % 10, 0);
    assert.ok(n === 20 || px / n >= 8, `${px}px: ${n} numbers`);
  }
  for (const q of everyQ('t3')) {
    for (const size of [30, 40, 60]) {
      const lo = startView(q, 't3', size);
      assert.ok(lo >= 0 && lo + size <= 100, `${size}: ${lo}`);
      assert.ok(q.start >= lo && q.start <= lo + size, `the start in view: ${JSON.stringify(q)} ${lo}`);
      if (Math.abs(landing(q) - q.start) + 4 <= size) assert.ok(landing(q) >= lo && landing(q) <= lo + size);
    }
  }
  // following: the kangaroo stays 3 from the edges, and the view stays on the line
  let lo = 14;
  for (const pos of [17, 27, 37, 47, 57, 67, 77, 87, 97, 100]) {
    lo = followView(lo, 30, pos, 100);
    assert.ok(pos >= lo + 3 || lo === 0);
    assert.ok(pos <= lo + 27 || lo === 70, `${pos} in [${lo}, ${lo + 30}]`);
    assert.ok(lo >= 0 && lo <= 70);
  }
  assert.equal(followView(40, 30, 50, 100), 40); // in sight: no move
  assert.equal(followView(40, 30, 2, 100), 0);
  assert.equal(followView(0, 100, 50, 100), 0);
});

test('stars by mistakes, never by time', () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(1), 2);
  assert.equal(starsFor(2), 2);
  assert.equal(starsFor(3), 1);
  assert.equal(starsFor(8), 1);
});

test('the drawings are inline SVG without ids or outside references', () => {
  for (const svg of [kangaroo(1), kangaroo(-1), tileSvg(), howSvg()]) {
    assert.ok(!/\bid=|url\(|href|https?:/.test(svg), svg.slice(0, 60));
  }
  assert.match(tileSvg(), /^<svg/);
  assert.match(kangaroo(-1), /scale\(-1 1\)/);
});
