import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allStrings, LANGS } from '../web/js/i18n.js';
import '../web/games/keuken/strings.js';
import { PREFERRED, VEGETABLES, DISHES, DISH_IDS, INGREDIENT_IDS, HOT, LOOKALIKES, lookalikesOf, SOURCE_IDS, ORIGINS, ORIGIN_IDS, GROUPS, GROUP_IDS, RECIPES, RECIPE_IDS } from '../web/games/keuken/dishes.js';
import { TIERS, TIER_IDS, KINDS, ROUND_LEN, ROUNDS_PER_TIER, MAX_TRIES, BIG_DISHES, makeRound, starsFor, startState, tapOption, stillToTap, answersOf, inDish, belongsTo, missingIn, canMake, hashSeed } from '../web/games/keuken/rules.js';
import { LOOK, DISH_TOP, ACT_IDS, ingredientSvg, dishSvg, sourceSvg, actSvg, tileSvg, howSvg, wallSvg, clocheSvg } from '../web/games/keuken/art.js';
import { meta } from '../web/games/keuken/meta.js';
import { sanitizePayload, mergeTransfer, replaceTransfer } from '../web/js/transfer.js';

const S = allStrings();
const has = (key) => LANGS.every((l) => typeof S[l][key] === 'string' && S[l][key].trim());

test('16 dishes, every ingredient of them exists and the 3-5 ones are among what they need', () => {
  assert.equal(DISH_IDS.length, 16);
  const all = new Set(INGREDIENT_IDS);
  assert.equal(all.size, INGREDIENT_IDS.length, 'an ingredient twice');
  for (const d of DISH_IDS) {
    const { need, key, maybe } = DISHES[d];
    for (const i of [...need, ...key, ...maybe]) assert.ok(all.has(i), `${d}: ${i} is not an ingredient`);
    assert.ok(need.length >= 2 && need.length <= 5, `${d}: ${need.length} ingredients`);
    assert.ok(key.length >= 2 && key.length <= 3, `${d}: the 3-5 rounds ask ${key.length}`);
    for (const i of key) assert.ok(need.includes(i), `${d}: ${i} is in key but not in need`);
    for (const i of maybe) assert.ok(!need.includes(i), `${d}: ${i} both needed and maybe`);
    assert.equal(new Set(need).size, need.length, `${d}: an ingredient twice`);
    assert.ok(has(`keuken.dish.${d}`) && has(`keuken.the.${d}`), `${d}: no name in both languages`);
  }
  for (const d of HOT) assert.ok(DISHES[d], `HOT: ${d} is no dish`);
});

test('the dishes Mark asked for, with the ingredients children know', () => {
  assert.deepEqual(DISHES.brood.need, ['bloem', 'water', 'gist', 'zout']);
  assert.deepEqual(DISHES.pannenkoeken.need, ['bloem', 'melk', 'ei']);
  assert.deepEqual(DISHES.tosti.need, ['brood', 'kaas']);
  assert.ok(DISHES.tosti.maybe.includes('ham'), 'a tosti may be with or without ham');
  assert.deepEqual(DISHES.brood.key, ['bloem', 'water', 'zout'], 'a 4-year-old is not asked to know yeast');
  for (const i of ['appel', 'kaas', 'ham', 'banaan']) assert.ok(inDish('pannenkoeken').has(i), `pancakes may have ${i}`);
  for (const i of ['pasta', 'kipvlees', 'rijst']) assert.ok(inDish('groentesoep').has(i), `soup may have ${i}`);
  for (const i of VEGETABLES) assert.ok(inDish('rijstgroente').has(i), `rice with vegetables may have ${i}`);
  for (const i of ['hagelslag', 'banaan']) assert.ok(inDish('pindakaasbrood').has(i));
  assert.ok(inDish('salade').has('aardappel') && inDish('pizza').has('kipvlees'));
  for (const d of DISH_IDS) assert.equal(typeof DISH_TOP[d], 'number', `${d}: no top for the steam`);
});

test('every ingredient has a name in both languages, a picture, and belongs to a dish', () => {
  for (const i of INGREDIENT_IDS) {
    assert.ok(has(`keuken.ing.${i}`), `${i}: no name`);
    assert.ok(ingredientSvg(i).startsWith('<svg'), `${i}: no picture`);
    assert.ok(DISH_IDS.some((d) => DISHES[d].need.includes(i) || DISHES[d].maybe.includes(i)), `${i}: in no dish, so "Dat hoort bij ..." has nothing to say`);
    assert.ok(belongsTo(i), `${i}: belongs to nothing`);
    for (const d of DISH_IDS) assert.ok(belongsTo(i, d) !== d, `${i}: said to belong to the dish it is not in`);
  }
});

test('the pictures: our own, no ids, no url(#), no style attributes, every ingredient unique by shape and colour', () => {
  const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const dist = (a, b) => Math.hypot(...rgb(a).map((v, k) => v - rgb(b)[k]));
  for (const i of INGREDIENT_IDS) assert.ok(LOOK[i], `${i}: no LOOK`);
  assert.deepEqual(Object.keys(LOOK).sort(), [...INGREDIENT_IDS].sort());
  for (let a = 0; a < INGREDIENT_IDS.length; a++) {
    for (let b = a + 1; b < INGREDIENT_IDS.length; b++) {
      const A = LOOK[INGREDIENT_IDS[a]];
      const B = LOOK[INGREDIENT_IDS[b]];
      if (A.shape === B.shape) assert.ok(dist(A.color, B.color) >= 90, `${INGREDIENT_IDS[a]} and ${INGREDIENT_IDS[b]}: the same shape and colours only ${dist(A.color, B.color).toFixed(0)} apart`);
    }
  }
  // the colour in LOOK is the colour drawn; round lumpy things never share a colour; yeast (a pale
  // block) and a potato (a brown lump) are far apart (they were one brown blob, #c9a46a and #c9a066)
  for (const i of INGREDIENT_IDS) assert.ok(ingredientSvg(i).includes(`fill="${LOOK[i].color}"`), `${i}: ${LOOK[i].color} is not in its picture`);
  const blobs = INGREDIENT_IDS.filter((i) => ['lump', 'potato', 'loaf', 'bulb', 'round', 'egg'].includes(LOOK[i].shape));
  for (let a = 0; a < blobs.length; a++) {
    for (let b = a + 1; b < blobs.length; b++) {
      const d = dist(LOOK[blobs[a]].color, LOOK[blobs[b]].color);
      assert.ok(d >= 60, `${blobs[a]} and ${blobs[b]}: two round shapes only ${d.toFixed(0)} apart in colour`);
    }
  }
  assert.ok(dist(LOOK.gist.color, LOOK.aardappel.color) >= 90, 'yeast and a potato look alike');
  const pics = [
    ...INGREDIENT_IDS.map((i) => ingredientSvg(i)),
    ...DISH_IDS.map((d) => dishSvg(d)),
    ...SOURCE_IDS.map((s) => sourceSvg(s)),
    ...ACT_IDS.map((a) => actSvg(a)),
    tileSvg(),
    howSvg(),
    wallSvg(),
    clocheSvg(),
  ];
  for (const p of pics) {
    assert.ok(p.length > 60, 'an empty picture');
    assert.ok(!/\sid=|url\(#|\sstyle=|<use|<script|NaN|undefined/.test(p), `a picture with an id, url(#), style, use or a bad number: ${p.slice(0, 80)}`);
    assert.match(p, /aria-hidden="true"/);
  }
  for (const d of DISH_IDS) assert.ok(dishSvg(d), `${d}: no picture`);
});

test('look-alikes: real ingredients, never two of the same dish both needed and alike by accident', () => {
  for (const [a, b] of LOOKALIKES) {
    assert.ok(INGREDIENT_IDS.includes(a) && INGREDIENT_IDS.includes(b), `${a}/${b}`);
    assert.notEqual(a, b);
  }
  assert.deepEqual(lookalikesOf('zout'), ['suiker']);
  assert.ok(lookalikesOf('melk').includes('yoghurt'));
});

test('where things come from: a source with a name, a line and a picture, never a wrong option that is partly right', () => {
  for (const s of SOURCE_IDS) {
    assert.ok(has(`keuken.src.${s}`) && has(`keuken.gives.${s}`), `${s}: no name or line`);
    assert.ok(sourceSvg(s).startsWith('<svg'), `${s}: no picture`);
  }
  for (const i of ORIGIN_IDS) {
    const o = ORIGINS[i];
    assert.ok(INGREDIENT_IDS.includes(i), `${i} is no ingredient`);
    assert.ok(SOURCE_IDS.includes(o.src), `${i}: ${o.src} is no source`);
    assert.ok(o.not.length >= 2, `${i}: too few wrong options`);
    for (const n of o.not) assert.ok(SOURCE_IDS.includes(n) && n !== o.src, `${i}: wrong option ${n}`);
    assert.ok(has(`keuken.fact.${i}`), `${i}: no line after the answer`);
  }
  assert.equal(ORIGINS.melk.src, 'koe');
  assert.equal(ORIGINS.bloem.src, 'graan');
  assert.equal(ORIGINS.kaas.src, 'melk');
  assert.equal(ORIGINS.gist.src, 'schimmel', 'yeast is a tiny fungus');
  assert.equal(ORIGINS.ei.src, 'kip');
  assert.equal(ORIGINS.rijst.src, 'rijstveld');
  assert.ok(!ORIGINS.kaas.not.includes('koe') && !ORIGINS.kaas.not.includes('zee'), 'cheese: the cow and the salt are partly right');
});

test('the odd one out: groups with lines, the odd ones plainly outside the group', () => {
  for (const id of GROUP_IDS) {
    const g = GROUPS[id];
    assert.ok(g.members.length >= 3, `${id}: fewer than 3`);
    for (const i of [...g.members, ...g.odd]) assert.ok(INGREDIENT_IDS.includes(i), `${id}: ${i}`);
    for (const i of g.odd) assert.ok(!g.members.includes(i), `${id}: ${i} both in and out`);
    assert.ok(has(`keuken.group.${id}`) && has(`keuken.also.${id}`), `${id}: no lines`);
  }
  assert.ok(!GROUPS.grond.odd.includes('pindakaas') && !GROUPS.graan.odd.includes('rijst'), 'nothing that is partly in the group');
});

test('the recipes: steps with a picture and a line in both languages', () => {
  for (const r of RECIPE_IDS) {
    assert.ok(DISHES[r], `${r}: no dish`);
    assert.ok(RECIPES[r].length >= 3 && RECIPES[r].length <= 4, `${r}: ${RECIPES[r].length} steps`);
    RECIPES[r].forEach((act, k) => {
      assert.ok(ACT_IDS.includes(act), `${r}: no picture for ${act}`);
      assert.ok(has(`keuken.step.${r}.${k + 1}`), `${r}: no line for step ${k + 1}`);
    });
  }
  assert.deepEqual(RECIPES.pannenkoeken, ['mix', 'pour', 'flip'], 'pancakes: mix, pour into the pan, flip');
});

/** Every check on one question; `label` says which. */
function checkQuestion(qq, tier, label) {
  const ans = answersOf(qq);
  assert.equal(new Set(qq.options).size, qq.options.length, `${label}: an option twice`);
  for (const a of ans) assert.ok(qq.options.includes(a), `${label}: the answer ${a} is not among the options`);
  if (qq.kind === 'fill') {
    const d = DISHES[qq.dish];
    assert.equal(qq.options.length, TIERS[tier].options, `${label}: ${qq.options.length} pictures`);
    assert.deepEqual(qq.need, tier === 't1' ? [...d.key] : [...d.need]);
    const wrong = qq.options.filter((i) => !qq.need.includes(i));
    for (const w of wrong) {
      assert.ok(!inDish(qq.dish).has(w), `${label}: ${w} is offered as not in ${qq.dish}, but it is`);
      assert.notEqual(w, qq.dish, `${label}: bread offered for bread`);
      assert.ok(belongsTo(w, qq.dish), `${label}: ${w} belongs nowhere`);
    }
    if (tier === 't1') {
      assert.ok(qq.need.length >= 2 && qq.need.length <= 3, `${label}: ${qq.need.length} bowls`);
      for (const w of wrong) assert.ok(!qq.need.some((i) => lookalikesOf(i).includes(w)), `${label}: ${w} looks like a right one (3-5 must be plain)`);
    } else {
      assert.ok(BIG_DISHES.includes(qq.dish) && qq.need.length >= 4, `${label}: ${qq.dish} is not a bigger dish`);
      assert.ok(wrong.some((w) => qq.need.some((i) => lookalikesOf(i).includes(w))), `${label}: no look-alike among ${wrong}`);
    }
  } else if (qq.kind === 'which') {
    assert.equal(qq.options.length, 3);
    assert.ok(qq.shown.every((i) => inDish(qq.answer).has(i)), `${label}: the answer lacks a shown ingredient`);
    for (const o of qq.options) {
      if (o === qq.answer) continue;
      assert.ok(missingIn(o, qq.shown), `${label}: ${o} can be made with ${qq.shown} too`);
      assert.ok(!DISHES[o].need.every((i) => qq.shown.includes(i)), `${label}: everything ${o} needs is in the bowls ${qq.shown}`);
      assert.ok(!DISHES[o].key.every((i) => qq.shown.includes(i)), `${label}: everything ${o} is known by is in the bowls ${qq.shown}`);
    }
  } else if (qq.kind === 'from') {
    assert.equal(qq.options.length, 3);
    for (const o of qq.options) if (o !== qq.answer) assert.ok(ORIGINS[qq.ing].not.includes(o), `${label}: ${o} as a wrong source for ${qq.ing}`);
  } else if (qq.kind === 'steps') {
    assert.deepEqual([...qq.options].sort(), [...qq.steps].sort(), `${label}: the steps`);
    assert.ok(qq.options.some((s, k) => s !== qq.steps[k]), `${label}: already in order`);
  } else if (qq.kind === 'odd') {
    assert.equal(qq.options.length, 4);
    const out = qq.options.filter((i) => !GROUPS[qq.group].members.includes(i));
    assert.deepEqual(out, [qq.answer], `${label}: the odd one`);
    assert.ok(GROUPS[qq.group].odd.includes(qq.answer));
  } else assert.fail(`${label}: kind ${qq.kind}`);
}

/** A child who taps every right answer: the question ends, and nothing else happens. */
function playRight(qq) {
  let st = startState();
  for (const a of answersOf(qq)) {
    const r = tapOption(qq, st, a);
    assert.equal(r.ok, true, `${qq.kind}: ${a} did not go in`);
    st = r.st;
  }
  assert.deepEqual(stillToTap(qq, st), []);
  return st;
}

test('200 seeds per tier: every round has its answers among the options, no duplicates, no distractor in the dish', () => {
  for (const tier of TIER_IDS) {
    for (let seed = 1; seed <= 200; seed++) {
      const qs = makeRound({ tier, seed });
      assert.equal(qs.length, ROUND_LEN);
      assert.deepEqual(qs.map((x) => x.kind).sort(), [...KINDS[tier]].sort());
      const topics = qs.map((x) => x.ing || x.group || x.dish);
      assert.equal(new Set(topics).size, topics.length, `${tier} seed ${seed}: a topic twice (${topics})`);
      qs.forEach((qq, k) => {
        checkQuestion(qq, tier, `${tier} seed ${seed} q${k + 1} ${qq.kind}`);
        playRight(qq);
      });
    }
  }
});

test('the menu rounds: fixed, and together they show nearly every dish', () => {
  for (const tier of TIER_IDS) {
    for (let r = 1; r <= ROUNDS_PER_TIER; r++) {
      const a = makeRound({ tier, seed: hashSeed(`keuken:${tier}-${r}`), round: r });
      const b = makeRound({ tier, seed: hashSeed(`keuken:${tier}-${r}`), round: r });
      assert.deepEqual(a, b, `${tier}-${r} is not fixed`);
      a.forEach((qq, k) => checkQuestion(qq, tier, `${tier}-${r} q${k + 1}`));
    }
  }
  const t1 = new Set();
  for (let r = 1; r <= ROUNDS_PER_TIER; r++) for (const qq of makeRound({ tier: 't1', seed: hashSeed(`keuken:t1-${r}`), round: r })) t1.add(qq.dish);
  assert.equal(t1.size, 16, `the three 3-5 rounds show ${t1.size} of the 16 dishes`);
  const steps = new Set();
  for (let r = 1; r <= ROUNDS_PER_TIER; r++) for (const qq of makeRound({ tier: 't3', seed: hashSeed(`keuken:t3-${r}`), round: r })) if (qq.kind === 'steps') steps.add(qq.dish);
  assert.equal(steps.size, 6);
});

test('a tap: right goes in, wrong bounces with its line, a second tap on a placed one does nothing', () => {
  const fill = { kind: 'fill', dish: 'pizza', need: ['bloem', 'tomaat', 'kaas'], options: ['bloem', 'tomaat', 'kaas', 'melk', 'banaan', 'pindakaas'] };
  let r = tapOption(fill, startState(), 'melk');
  assert.deepEqual(r, { ok: false, why: 'belongs', about: 'pannenkoeken' });
  r = tapOption(fill, startState(), 'kaas');
  assert.equal(r.ok, true);
  assert.equal(r.done, false);
  assert.deepEqual(tapOption(fill, r.st, 'kaas'), { ok: null });
  assert.deepEqual(tapOption(fill, r.st, 'ham'), { ok: null }, 'not an option');
  assert.deepEqual(stillToTap(fill, r.st), ['bloem', 'tomaat']);
  // the pizza's cheese belongs to the toastie when a wrong cheese is tapped elsewhere
  assert.equal(belongsTo('kaas', 'pizza'), 'tosti');
  assert.equal(belongsTo('melk'), 'pannenkoeken');
  assert.equal(belongsTo('ham'), 'tosti', 'ham only ever goes on something: the toastie');
  assert.equal(belongsTo('aardappel'), 'stamppot', 'a potato: the stamppot, not the roti');
  assert.equal(belongsTo('aardappel', 'stamppot'), 'roti');
  for (const [i, d] of Object.entries(PREFERRED)) assert.ok(inDish(d).has(i), `PREFERRED: ${i} is not in ${d}`);
  for (const i of INGREDIENT_IDS) assert.ok(PREFERRED[i], `${i}: no preferred dish`);

  const which = { kind: 'which', dish: 'pannenkoeken', shown: ['bloem', 'melk', 'ei'], answer: 'pannenkoeken', options: ['pannenkoeken', 'pizza', 'salade'] };
  assert.deepEqual(tapOption(which, startState(), 'pizza'), { ok: false, why: 'lacks', about: { dish: 'pizza', ing: 'melk' } });
  assert.equal(tapOption(which, startState(), 'pannenkoeken').done, true);

  const from = { kind: 'from', ing: 'ei', answer: 'kip', options: ['koe', 'kip', 'zee'] };
  assert.deepEqual(tapOption(from, startState(), 'koe'), { ok: false, why: 'gives', about: 'koe' });

  const steps = { kind: 'steps', dish: 'pannenkoeken', steps: ['pannenkoeken.1', 'pannenkoeken.2', 'pannenkoeken.3'], options: ['pannenkoeken.3', 'pannenkoeken.1', 'pannenkoeken.2'] };
  assert.deepEqual(tapOption(steps, startState(), 'pannenkoeken.3'), { ok: false, why: 'later', about: 'pannenkoeken.3' });
  const s1 = tapOption(steps, startState(), 'pannenkoeken.1');
  assert.equal(s1.ok, true);
  assert.deepEqual(stillToTap(steps, s1.st), ['pannenkoeken.2']);

  const odd = { kind: 'odd', group: 'koe', answer: 'appel', options: ['melk', 'appel', 'kaas', 'boter'] };
  assert.deepEqual(tapOption(odd, startState(), 'kaas'), { ok: false, why: 'also', about: 'koe' });
  assert.equal(tapOption(odd, startState(), 'appel').ok, true);
});

test('stillToTap: what is left to tap, per kind', () => {
  const fill = { kind: 'fill', dish: 'pizza', need: ['bloem', 'tomaat', 'kaas'], options: ['bloem', 'tomaat', 'kaas', 'melk', 'banaan', 'pindakaas'] };
  assert.deepEqual(stillToTap(fill, startState()), ['bloem', 'tomaat', 'kaas']);
  assert.deepEqual(stillToTap(fill, { placed: ['tomaat'] }), ['bloem', 'kaas'], 'in any order');
  assert.deepEqual(stillToTap(fill, { placed: ['tomaat', 'kaas', 'bloem'] }), []);
  const steps = { kind: 'steps', dish: 'tosti', steps: ['tosti.1', 'tosti.2', 'tosti.3'], options: ['tosti.2', 'tosti.3', 'tosti.1'] };
  assert.deepEqual(stillToTap(steps, startState()), ['tosti.1'], 'only the next step');
  assert.deepEqual(stillToTap(steps, { placed: ['tosti.1', 'tosti.2'] }), ['tosti.3']);
  assert.deepEqual(stillToTap(steps, { placed: ['tosti.1', 'tosti.2', 'tosti.3'] }), []);
  for (const kind of ['which', 'from', 'odd']) {
    const q = { kind, answer: 'x', options: ['x', 'y', 'z'] };
    assert.deepEqual(stillToTap(q, startState()), ['x']);
    assert.deepEqual(stillToTap(q, { placed: ['x'] }), []);
  }
});

test('missingIn and canMake respect maybe: what may be in a dish is never said to be missing', () => {
  assert.equal(missingIn('tosti', ['brood', 'kaas', 'ham']), null, 'ham may go on a tosti');
  assert.equal(missingIn('pizza', ['bloem', 'kipvlees']), null, 'chicken may go on a pizza');
  assert.equal(missingIn('pannenkoeken', ['bloem', 'melk', 'appel']), null, 'apple pancakes');
  assert.equal(missingIn('pannenkoeken', ['bloem', 'gist']), 'gist');
  assert.equal(missingIn('tosti', ['brood', 'pindakaas']), 'pindakaas');
  assert.ok(canMake('pannenkoeken', DISHES.poffertjes.need), 'pancakes from the poffertjes bowls');
  assert.ok(!canMake('pizza', DISHES.poffertjes.need));
});

test('stars count mistakes only, never time; help after MAX_TRIES', () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(1), 2);
  assert.equal(starsFor(2), 2);
  assert.equal(starsFor(3), 1);
  assert.equal(starsFor(6), 1);
  assert.equal(starsFor.length, 1, 'one argument: the mistakes');
  assert.equal(MAX_TRIES, 2);
});

test('free: the 3-5 rounds; the full version opens the rest', () => {
  assert.equal(meta.id, 'keuken');
  assert.equal(meta.group, 'learning');
  assert.equal(meta.isLocked({ tier: 't1' }, false), false);
  assert.equal(meta.isLocked({ tier: 't2' }, false), true);
  assert.equal(meta.isLocked({ tier: 't3' }, false), true);
  assert.equal(meta.isLocked({ tier: 't3' }, true), false);
  for (const tier of TIER_IDS) assert.ok(has(`keuken.tier.${tier}`) && has(`keuken.short.${tier}`) && has(`keuken.how.${tier}`));
});

test('the save survives a transfer: stars per round, random rounds per tier, how-to cards seen, the last tier', () => {
  const sent = { games: { keuken: { stars: { 't1-1': 3, 't1-2': 2, 't2-3': 1, bad: -1 }, random: { t2: 4, t3: 1 }, howSeen: { t1: true, t2: true, t3: 'yes' }, lastTier: 't2' } } };
  const out = sanitizePayload(JSON.parse(JSON.stringify(sent)));
  assert.deepEqual(out.games.keuken.stars, { 't1-1': 3, 't1-2': 2, 't2-3': 1 });
  assert.deepEqual(out.games.keuken.random, { t2: 4, t3: 1 });
  assert.deepEqual(out.games.keuken.howSeen, { t1: true, t2: true });
  assert.equal(out.games.keuken.lastTier, 't2');
  const mine = { version: 1, games: { keuken: { stars: { 't1-1': 1 }, random: { t2: 6 } } }, purchase: { owned: false }, settings: {} };
  const merged = mergeTransfer(mine, out);
  assert.equal(merged.games.keuken.stars['t1-1'], 3, 'the higher stars win');
  assert.equal(merged.games.keuken.random.t2, 6, 'the higher count wins');
  assert.equal(merged.games.keuken.lastTier, 't2');
  assert.deepEqual(merged.games.keuken.howSeen, { t1: true, t2: true });
  const replaced = replaceTransfer(mine, out);
  assert.deepEqual(replaced.games.keuken.stars, { 't1-1': 3, 't1-2': 2, 't2-3': 1 });
});
