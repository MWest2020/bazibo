import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENE_IDS,
  SCENES,
  ANIMAL_IDS,
  CREATURE_IDS,
  FEATURE_IDS,
  NOT_WORN,
  featuresFor,
  SPOTS,
  SPOT_KINDS,
  TIERS,
  TIER_IDS,
  ROUNDS_PER_TIER,
  MIN_SPOT,
  MAX_SPOT,
  makeRound,
  fixedRound,
  parseRoundId,
  roundId,
  keyOf,
  isTarget,
  newPlay,
  look,
  memoryAsk,
  stillToFind,
  starsFor,
  spotLayout,
  hidingSpots,
  samePlace,
  clash,
  roundSeed,
  MAX_SAME_SPOT,
  clueFor,
  cluesOf,
  CLUE_SHOWS,
} from '../web/games/verstop/rules.js';
import { meta } from '../web/games/verstop/meta.js';
import { ANIMALS, CREATURES, SPOT_ART, COLORS, FEATURE_COLORS, figureSvg, spotSvg, sceneSvg, tileSvg, howSvg, sceneCardSvg, figureFit, clueG, PEEK_AT, CASTLE_FLAG } from '../web/games/verstop/art.js';

const SEEDS = 200;

/** 200 seeded random rounds per scene and tier, and every fixed round from the menu. */
function rounds(tier) {
  const out = [];
  for (const scene of SCENE_IDS) {
    for (let s = 1; s <= SEEDS; s++) out.push(makeRound({ scene, tier, seed: s * 7919 + scene.length }));
    for (let n = 1; n <= ROUNDS_PER_TIER; n++) out.push(fixedRound(roundId(scene, tier, n)));
  }
  return out;
}

/** Play a round by opening spots in `order` (indexes), each once; returns the play when it ends. */
function playOut(round, order) {
  let play = newPlay();
  for (const i of order) {
    const r = look(round, play, i);
    play = r.play;
    if (r.result === 'memory') {
      const again = look(round, play, play.ask);
      assert.equal(again.result, 'remembered');
      play = again.play;
    }
    if (play.phase === 'done') return play;
  }
  return play;
}

for (const tier of TIER_IDS) {
  test(`verstop ${tier}: every round (${SEEDS} seeds per scene and the fixed ones) is fair and solvable`, () => {
    const tt = TIERS[tier];
    for (const round of rounds(tier)) {
      const tag = `${round.scene} ${tier} n${round.n}`;
      const n = round.spots.length;
      assert.ok(n >= tt.spots[0] && n <= tt.spots[1], `${tag}: ${n} spots`);
      assert.equal(round.find.length, tt.find, tag);
      // each animal to find is behind exactly one spot
      for (const f of round.find) {
        const at = round.spots.filter((s) => s.who.kind === 'animal' && s.who.id === f.id && (s.who.feature || null) === (f.feature || null));
        assert.equal(at.length, 1, `${tag}: ${f.id} ${f.feature} behind ${at.length} spots`);
        assert.ok(SCENES[round.scene].animals.includes(f.id), `${tag}: ${f.id} does not live here`);
      }
      assert.equal(new Set(round.find.map((f) => f.id)).size, round.find.length, `${tag}: the same animal twice`);
      // nobody twice in a round
      const keys = round.spots.map((s) => keyOf(s.who));
      assert.equal(new Set(keys).size, n, `${tag}: someone twice: ${keys}`);
      for (const s of round.spots) {
        assert.ok(SCENES[round.scene].spots.includes(s.kind), `${tag}: a ${s.kind} in the ${round.scene}`);
        if (s.who.kind === 'creature') assert.ok(CREATURE_IDS.includes(s.who.id), tag);
      }
      // look-alikes: the same animal, told apart by a clear feature (another one, or none)
      const alikes = round.spots.filter((s) => s.who.kind === 'animal' && !isTarget(round, s.who));
      assert.equal(alikes.length, tt.lookalikes, `${tag}: ${alikes.length} look-alikes`);
      for (const s of alikes) {
        assert.equal(s.who.id, round.find[0].id, `${tag}: a look-alike of another animal`);
        assert.notEqual(s.who.feature || null, round.find[0].feature, `${tag}: a look-alike with the same feature`);
      }
      if (tt.lookalikes) assert.ok(featuresFor(round.find[0].id).includes(round.find[0].feature), `${tag}: the animal wears ${round.find[0].feature}`);
      else assert.ok(round.find.every((f) => f.feature === null), tag);
      for (const s of round.spots) if (s.who.feature) assert.ok(!(NOT_WORN[s.who.id] || []).includes(s.who.feature), `${tag}: ${s.who.id} in a ${s.who.feature}`);
      assert.equal(round.memory, tt.memory && (round.n ? round.n % 2 === 0 : round.memory), tag);
      // solvable: straight to the animals is 3 stars; opening every spot in turn always ends
      const best = playOut(round, round.spots.map((s, i) => i).filter((i) => isTarget(round, round.spots[i].who)));
      assert.equal(best.phase, 'done', `${tag}: not done when every animal is found first`);
      assert.equal(best.extra, 0, tag);
      assert.equal(starsFor(best.extra, round), 3, tag);
      const all = playOut(round, round.spots.map((s, i) => i));
      assert.equal(all.phase, 'done', `${tag}: opening every spot does not end the round`);
      assert.ok(all.extra <= n - round.find.length, tag);
      const back = playOut(round, round.spots.map((s, i) => n - 1 - i));
      assert.equal(back.phase, 'done', tag);
    }
  });
}

// The hints (Mark's playtest, 23 Nov 2026: "otherwise it is just guessing"): a bit of the animal
// peeks out over its own spot, never over a friend's; harder by tier, never by speed.
for (const tier of TIER_IDS) {
  test(`verstop ${tier}: the hint sits on the animal's spot only, never on a friend's (${SEEDS} seeds per scene and the fixed ones)`, () => {
    for (const round of rounds(tier)) {
      const tag = `${round.scene} ${tier} n${round.n}`;
      const clues = cluesOf(round);
      assert.equal(clues.length, round.spots.length, tag);
      round.spots.forEach((s, i) => {
        const c = clues[i];
        if (c) assert.deepEqual({ animal: c.animal, feature: c.feature, show: c.show }, clueFor(round, i), tag);
        else assert.equal(clueFor(round, i), null, tag);
        if (s.who.kind === 'creature') assert.equal(c, null, `${tag}: a hint on the ${s.who.id}'s spot`);
        else {
          assert.ok(c, `${tag}: no hint where the ${s.who.id} hides`);
          // the clue says who it is: that animal, with that feature (or none)
          assert.equal(c.animal, s.who.id, tag);
          assert.equal(c.feature, s.who.feature || null, tag);
          assert.equal(c.show, TIERS[tier].clue, tag);
        }
      });
      // each animal to find: exactly one spot gives its clue, and that is where it hides
      for (const f of round.find) {
        const at = clues.map((c, i) => (c && c.animal === f.id && c.feature === (f.feature || null) ? i : -1)).filter((i) => i >= 0);
        assert.equal(at.length, 1, `${tag}: the ${f.id}'s clue on ${at.length} spots`);
        assert.ok(isTarget(round, round.spots[at[0]].who), `${tag}: the ${f.id}'s clue is not where it hides`);
      }
      const on = clues.filter(Boolean);
      // the clue spots peek in turn: one beat each
      assert.deepEqual(on.map((c) => c.beat), on.map((c, k) => k), tag);
      if (!TIERS[tier].lookalikes) {
        // t1 and t2: only the animals to find give a clue, each its own
        assert.equal(on.length, round.find.length, tag);
        assert.equal(new Set(on.map((c) => c.animal)).size, round.find.length, `${tag}: two animals, one clue`);
      } else {
        // t3: the look-alikes peek too, so "a hedgehog is here" is not enough; the colour of the
        // feature that peeks with it tells the real one apart
        assert.equal(on.length, 1 + TIERS[tier].lookalikes, tag);
        const target = round.find[0];
        assert.ok(target.feature, tag);
        const mine = on.filter((c) => c.feature === target.feature);
        assert.equal(mine.length, 1, `${tag}: the ${target.feature} peeks out on ${mine.length} spots`);
        for (const c of on) assert.equal(c.animal, target.id, tag);
        assert.equal(new Set(on.map((c) => c.feature)).size, on.length, `${tag}: two look-alikes give the same clue`);
      }
    }
  });
}

test('verstop: the sandcastle\'s flag is no feature\'s colour and far from every animal\'s', () => {
  const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const apart = (a, b) => Math.hypot(...rgb(a).map((v, k) => v - rgb(b)[k]));
  assert.ok(spotSvg('castle', { kind: 'creature', id: 'frog' }, 1).includes(`fill="${CASTLE_FLAG}"`));
  for (const [f, c] of Object.entries(FEATURE_COLORS)) assert.ok(apart(CASTLE_FLAG, c) >= 120, `the flag looks like the ${f}: ${apart(CASTLE_FLAG, c).toFixed(0)}`);
  for (const [a, c] of Object.entries(COLORS.animal)) assert.ok(apart(CASTLE_FLAG, c) >= 90, `the flag looks like the ${a}: ${apart(CASTLE_FLAG, c).toFixed(0)}`);
});

test('verstop: harder by tier, never by speed: t1 from the start, t2 now and then, t3 rarely', () => {
  assert.deepEqual(TIER_IDS.map((k) => TIERS[k].clue), ['always', 'sometimes', 'rarely']);
  assert.deepEqual([...CLUE_SHOWS], ['always', 'sometimes', 'rarely']);
  // the rest of the game is as it was: stars by extra looks only, the hint changes nothing there
  const round = fixedRound('garden-t1-1');
  const target = round.spots.findIndex((s) => isTarget(round, s.who));
  assert.equal(look(round, newPlay(), target).result, 'done');
  assert.equal(clueFor(round, 99), null);
});

test('verstop: every animal can peek over every kind of spot, in its own colours, with its feature\'s colour', () => {
  assert.deepEqual(Object.keys(PEEK_AT).sort(), [...SPOT_KINDS].sort());
  const others = (f) => FEATURE_IDS.filter((g) => g !== f).map((g) => FEATURE_COLORS[g]);
  for (const kind of SPOT_KINDS) {
    assert.equal(clueG(kind, null), '');
    for (const animal of ANIMAL_IDS) {
      for (const feature of [null, ...featuresFor(animal)]) {
        for (const show of CLUE_SHOWS) {
          const g = clueG(kind, { animal, feature, show, beat: 1 });
          const tag = `${kind} ${animal} ${feature} ${show}`;
          assert.ok(g.includes(`class="vz-clue" data-show="${show}" data-beat="1" data-animal="${animal}"`), tag);
          assert.ok(g.includes('class="vz-peek"'), tag);
          assert.ok(g.includes(ANIMALS[animal].color), `${tag}: not in the ${animal}'s own colour`);
          if (feature) assert.ok(g.includes(FEATURE_COLORS[feature]), `${tag}: no glimpse of the ${feature}`);
          for (const c of others(feature)) assert.ok(!g.includes(c), `${tag}: the colour of another feature`);
          assert.ok(!/\sid=|url\(#|style=/.test(g), `${tag}: ids or styles in the drawing`);
        }
      }
    }
    // in the spot: drawn behind the cover (behind the figure and the frame too, unless it comes out
    // of the stump's hollow); none on a friend's spot
    const svg = spotSvg(kind, { kind: 'animal', id: 'hedgehog', feature: null }, 2, { animal: 'hedgehog', feature: null, show: 'always', beat: 0 });
    assert.ok(svg.indexOf('vz-clue') < svg.indexOf('vz-cover'), kind);
    if (!PEEK_AT[kind].over) assert.ok(svg.indexOf('vz-clue') < svg.indexOf('vz-who'), kind);
    else assert.ok(svg.indexOf('vz-frame') < svg.indexOf('vz-clue'), kind);
    assert.ok(!spotSvg(kind, { kind: 'creature', id: 'frog' }, 2, null).includes('vz-clue'), kind);
  }
});

test('verstop: the same id is the same round; fixed rounds take every animal of the scene in turn', () => {
  assert.deepEqual(fixedRound('garden-t1-3'), fixedRound('garden-t1-3'));
  assert.notDeepEqual(fixedRound('garden-t1-3'), fixedRound('garden-t1-4'));
  for (const scene of SCENE_IDS) {
    const seen = new Set();
    for (let n = 1; n <= ROUNDS_PER_TIER; n++) seen.add(fixedRound(roundId(scene, 't1', n)).find[0].id);
    assert.deepEqual([...seen].sort(), [...SCENES[scene].animals].sort(), scene);
  }
  assert.deepEqual(parseRoundId('beach-t3-6'), { scene: 'beach', tier: 't3', n: 6 });
  for (const bad of ['beach-t3-7', 'beach-t4-1', 'moon-t1-1', 'garden-t1-0', '', 'garden-t1-1x']) assert.equal(parseRoundId(bad), null, bad);
  assert.equal(fixedRound('nope'), null);
  // memory rounds: every second round of tier 3
  for (let n = 1; n <= ROUNDS_PER_TIER; n++) assert.equal(fixedRound(roundId('farm', 't3', n)).memory, n % 2 === 0);
});

// the scene boxes measured at the smoke-test sizes (320x568, 390x844, 568x320, 844x390, desktop, 360x640), less the padding
const BOXES = [[284, 365], [354, 607], [262, 292], [538, 362], [888, 563], [324, 437]];

/**
 * The animal moves on (Mark's playtest, 20 Nov 2026: the hedgehog 5 times in the same spot): in a
 * run of rounds (`seeds[k]` the layout seed of round k) no animal hides behind the kind of spot or
 * in the place of an animal of the round before (in every measured box its centre is outside that
 * spot), and no kind of spot or cell hides an animal more than MAX_SAME_SPOT times.
 */
function movesOn(list, seeds, tag) {
  const at = list.map(hidingSpots);
  for (let r = 1; r < list.length; r++) {
    assert.ok(!clash(list[r], list[r - 1]), `${tag}: round ${r + 1} hides where round ${r} did: ${JSON.stringify(at[r])} after ${JSON.stringify(at[r - 1])}`);
    for (const p of at[r]) {
      for (const q of at[r - 1]) {
        assert.notEqual(p.kind, q.kind, `${tag}: round ${r + 1} behind the ${p.kind} again`);
        for (const [w, h] of BOXES) {
          const A = spotLayout(p.n, w, h, seeds[r])[p.i];
          const B = spotLayout(q.n, w, h, seeds[r - 1])[q.i];
          const apart = Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y));
          assert.ok(apart > (A.s + B.s) / 4, `${tag}: round ${r + 1} in the same place at ${w}x${h} (${apart.toFixed(0)} px)`);
        }
      }
    }
  }
  for (let k = 0; k < at[0].length; k++) {
    for (const p of at.map((a) => a[k])) {
      assert.ok(at.filter((a) => a[k].kind === p.kind).length <= MAX_SAME_SPOT, `${tag}: the ${p.kind} hides animal ${k + 1} more than ${MAX_SAME_SPOT} times`);
      assert.ok(at.filter((a) => a[k].n === p.n && a[k].i === p.i).length <= MAX_SAME_SPOT, `${tag}: spot ${p.i} of ${p.n} hides animal ${k + 1} more than ${MAX_SAME_SPOT} times`);
    }
  }
}

for (const tier of TIER_IDS) {
  test(`verstop ${tier}: the animal moves on from round to round, in every scene (the menu's rounds and ${SEEDS} seeded runs)`, () => {
    for (const scene of SCENE_IDS) {
      const ids = Array.from({ length: ROUNDS_PER_TIER }, (_, k) => roundId(scene, tier, k + 1));
      const menu = ids.map((id) => fixedRound(id));
      movesOn(menu, ids.map(roundSeed), `${scene} ${tier}`);
      for (let s = 1; s <= SEEDS; s++) {
        const list = [];
        const seeds = [];
        for (let n = 1; n <= ROUNDS_PER_TIER; n++) {
          seeds.push(s * 104729 + n * 7919 + scene.length);
          list.push(makeRound({ scene, tier, seed: seeds[n - 1], n, before: list }));
        }
        movesOn(list, seeds, `${scene} ${tier} seed ${s}`);
      }
    }
  });
}

test('verstop: a round played again, and a random round, hide the animal away from the round just played', () => {
  for (const scene of SCENE_IDS) {
    for (const tier of TIER_IDS) {
      for (let n = 1; n <= ROUNDS_PER_TIER; n++) {
        const id = roundId(scene, tier, n);
        const round = fixedRound(id);
        // again: the same round (number, animals, friends), the animals somewhere else
        const again = fixedRound(id, round);
        assert.ok(!clash(again, round), `${id} played again hides where it did`);
        assert.equal(again.n, n);
        assert.deepEqual(again.find, round.find, id);
        assert.equal(again.memory, round.memory, id);
        assert.deepEqual(again.spots.map((x) => keyOf(x.who)).sort(), round.spots.map((x) => keyOf(x.who)).sort(), `${id}: other friends when played again`);
        assert.ok(!clash(fixedRound(id, again), again), `${id} a third time`);
        // straight after the round before it: the round of the menu, unchanged
        if (n > 1) assert.deepEqual(fixedRound(id, fixedRound(roundId(scene, tier, n - 1))), round, id);
        // a random round after it, in every scene
        for (const where of SCENE_IDS) {
          for (let s = 1; s <= 20; s++) {
            const r = makeRound({ scene: where, tier, seed: s * 31 + n, before: [round] });
            assert.ok(!clash(r, round), `random ${where} ${tier} after ${id}`);
            assert.ok(!clash(makeRound({ scene: where, tier, seed: s * 37 + n, before: [r] }), r), `random after random ${where} ${tier}`);
          }
        }
      }
    }
  }
  // the place on screen: the same cell is the same place, a far corner is not
  assert.ok(samePlace({ i: 0, n: 4 }, { i: 0, n: 4 }));
  assert.ok(!samePlace({ i: 0, n: 4 }, { i: 3, n: 4 }));
  assert.ok(samePlace({ i: 2, n: 4 }, { i: 3, n: 5 }), 'bottom left in a round of 4 and of 5');
});

test('verstop: saved stars stay with their round (the same id, number and animal)', () => {
  for (const scene of SCENE_IDS) {
    for (const tier of TIER_IDS) {
      for (let n = 1; n <= ROUNDS_PER_TIER; n++) {
        const id = roundId(scene, tier, n);
        const round = fixedRound(id);
        assert.deepEqual(parseRoundId(id), { scene, tier, n });
        assert.equal(round.n, n);
        assert.equal(round.find[0].id, SCENES[scene].animals[(n - 1) % SCENES[scene].animals.length], id);
      }
    }
  }
});

test('verstop: a look that does not find the animal is a hello, counted once per spot', () => {
  const round = fixedRound('garden-t1-1');
  const target = round.spots.findIndex((s) => isTarget(round, s.who));
  const others = round.spots.map((s, i) => i).filter((i) => i !== target);
  let r = look(round, newPlay(), others[0]);
  assert.equal(r.result, 'friend');
  assert.ok(r.first);
  assert.equal(r.play.extra, 1);
  r = look(round, r.play, others[0]); // the same spot again: it waves again, nothing counted
  assert.equal(r.result, 'friend');
  assert.ok(!r.first);
  assert.equal(r.play.extra, 1);
  r = look(round, r.play, others[1]);
  assert.equal(r.play.extra, 2);
  assert.deepEqual(r.play.looked, [others[0], others[1]]);
  r = look(round, r.play, target);
  assert.equal(r.result, 'done');
  assert.equal(r.play.phase, 'done');
  // after the end nothing happens
  assert.equal(look(round, r.play, others[2]).result, 'none');
  assert.equal(look(round, newPlay(), 99).result, 'none');
});

test('verstop t2: two animals; the first found says "found", a found one tapped again does nothing', () => {
  const round = fixedRound('forest-t2-2');
  const targets = round.spots.map((s, i) => i).filter((i) => isTarget(round, round.spots[i].who));
  assert.equal(targets.length, 2);
  let r = look(round, newPlay(), targets[1]);
  assert.equal(r.result, 'found');
  assert.deepEqual(stillToFind(round, r.play).map((k) => round.find[k].id), round.find.filter((f, k) => k !== round.find.findIndex((x) => x.id === round.spots[targets[1]].who.id)).map((f) => f.id));
  assert.equal(look(round, r.play, targets[1]).result, 'none');
  r = look(round, r.play, targets[0]);
  assert.equal(r.result, 'done');
  assert.deepEqual(stillToFind(round, r.play), []);
});

test('verstop t3: a look-alike waves too; the memory question asks for the first creature met', () => {
  const round = fixedRound('garden-t3-2');
  assert.ok(round.memory);
  const target = round.spots.findIndex((s) => isTarget(round, s.who));
  const alike = round.spots.findIndex((s) => s.who.kind === 'animal' && !isTarget(round, s.who));
  const creatures = round.spots.map((s, i) => i).filter((i) => round.spots[i].who.kind === 'creature');
  let r = look(round, newPlay(), alike);
  assert.equal(r.result, 'lookalike');
  r = look(round, r.play, creatures[1]);
  r = look(round, r.play, creatures[0]);
  assert.equal(memoryAsk(round, r.play.looked), creatures[1], 'the one met first');
  r = look(round, r.play, target);
  assert.equal(r.result, 'memory');
  assert.equal(r.play.ask, creatures[1]);
  assert.equal(r.play.extra, 3);
  // a spot already opened while seeking: a hello again, but it counted once already
  let m = look(round, r.play, creatures[0]);
  assert.equal(m.result, 'friend');
  assert.ok(!m.first);
  assert.equal(m.play.extra, 3);
  // a spot not opened before: one more look, once
  const fresh = creatures.find((i) => !r.play.looked.includes(i));
  m = look(round, m.play, fresh);
  assert.ok(m.first);
  assert.equal(m.play.extra, 4);
  assert.equal(look(round, m.play, fresh).play.extra, 4);
  assert.equal(look(round, m.play, target).result, 'none');
  m = look(round, m.play, creatures[1]);
  assert.equal(m.result, 'remembered');
  assert.equal(m.play.phase, 'done');
  // only look-alikes met (no creature): no memory question
  const r2 = look(round, look(round, newPlay(), alike).play, target);
  assert.equal(r2.result, 'done');
  // found at once: no memory question either
  assert.equal(look(round, newPlay(), target).result, 'done');
  // not a memory round: never a question
  const plain = fixedRound('garden-t3-1');
  const pt = plain.spots.findIndex((s) => isTarget(plain, s.who));
  const pc = plain.spots.findIndex((s) => s.who.kind === 'creature');
  assert.equal(look(plain, look(plain, newPlay(), pc).play, pt).result, 'done');
});

test('verstop: stars by extra looks only, gently', () => {
  const r4 = { spots: new Array(4).fill(0), find: [{}] }; // 3 other spots
  const r5 = { spots: new Array(5).fill(0), find: [{}] }; // 4 other spots
  assert.deepEqual([0, 1, 2, 3].map((e) => starsFor(e, r4)), [3, 3, 2, 1]);
  assert.deepEqual([0, 1, 2, 3, 4].map((e) => starsFor(e, r5)), [3, 3, 3, 2, 1]);
  for (const tier of TIER_IDS) {
    for (const round of rounds(tier).slice(0, 50)) {
      let last = 3;
      for (let e = 0; e <= round.spots.length + 3; e++) {
        const s = starsFor(e, round);
        assert.ok(s <= last && s >= 1);
        last = s;
      }
    }
  }
});

test('verstop: the spots fit every box of the screens the app supports, 64 px or more, never overlapping', () => {
  const check = (n, w, h, seed, tag) => {
    const lay = spotLayout(n, w, h, seed);
    assert.equal(lay.length, n, tag);
    for (const p of lay) {
      assert.ok(p.s >= MIN_SPOT, `${tag}: a spot of ${p.s.toFixed(1)} px`);
      assert.ok(p.s <= MAX_SPOT + 1e-9, tag);
      assert.ok(p.x - p.s / 2 >= -1e-6 && p.y - p.s / 2 >= -1e-6 && p.x + p.s / 2 <= w + 1e-6 && p.y + p.s / 2 <= h + 1e-6, `${tag}: off the box`);
    }
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const A = lay[a];
        const B = lay[b];
        const apart = Math.abs(A.x - B.x) >= (A.s + B.s) / 2 - 1e-6 || Math.abs(A.y - B.y) >= (A.s + B.s) / 2 - 1e-6;
        assert.ok(apart, `${tag}: spots ${a} and ${b} overlap`);
      }
    }
  };
  // the scene boxes measured at the smoke-test sizes
  for (const [w, h] of BOXES) {
    for (let n = 4; n <= 8; n++) for (let seed = 1; seed <= 20; seed++) check(n, w, h, seed, `${w}x${h} n${n} seed ${seed}`);
  }
  // and every box from 260 x 290 up
  for (let w = 260; w <= 1200; w += 20) for (let h = 290; h <= 900; h += 20) for (let n = 4; n <= 8; n++) check(n, w, h, w * h + n, `${w}x${h} n${n}`);
  assert.deepEqual(spotLayout(0, 300, 300), []);
  assert.deepEqual(spotLayout(4, 0, 300), []);
});

test('verstop: every animal, creature and spot is drawn and differs by colour; features differ', () => {
  for (const id of ANIMAL_IDS) assert.ok(ANIMALS[id], id);
  for (const id of CREATURE_IDS) assert.ok(CREATURES[id], id);
  assert.deepEqual(Object.keys(SPOT_ART).sort(), [...SPOT_KINDS].sort());
  assert.deepEqual(Object.keys(ANIMALS).sort(), [...ANIMAL_IDS].sort());
  assert.deepEqual(Object.keys(CREATURES).sort(), [...CREATURE_IDS].sort());
  const figures = [...Object.values(COLORS.animal), ...Object.values(COLORS.creature)];
  assert.equal(new Set(figures).size, figures.length, 'two figures share a colour');
  assert.equal(new Set(Object.values(COLORS.spot)).size, SPOT_KINDS.length, 'two spots share a colour');
  assert.equal(new Set(Object.values(FEATURE_COLORS)).size, FEATURE_IDS.length);
  // a feature an animal wears stands out from its body (90 or more apart in RGB), and every animal
  // keeps at least two (the target's and a look-alike's)
  const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const apart = (a, b) => Math.hypot(...rgb(a).map((v, k) => v - rgb(b)[k]));
  for (const id of ANIMAL_IDS) {
    assert.ok(featuresFor(id).length >= 2, `${id} wears too few features`);
    for (const f of featuresFor(id)) assert.ok(apart(COLORS.animal[id], FEATURE_COLORS[f]) >= 90, `${id} + ${f}: only ${apart(COLORS.animal[id], FEATURE_COLORS[f]).toFixed(0)} apart`);
  }
  for (const id of ANIMAL_IDS) {
    for (const f of [null, ...FEATURE_IDS]) {
      const svg = figureSvg({ kind: 'animal', id, feature: f });
      assert.equal((svg.match(/vz-feat/g) || []).length, f ? 1 : 0, `${id} ${f}`);
      assert.ok(svg.includes('vz-arm'), `${id} cannot wave`);
      assert.ok(!/\sid=|url\(#/.test(svg), `${id}: ids in the drawing`);
    }
  }
  for (const id of CREATURE_IDS) assert.ok(figureSvg({ kind: 'creature', id }).includes('vz-arm'), `${id} cannot wave`);
  for (const kind of SPOT_KINDS) {
    const svg = spotSvg(kind, { kind: 'creature', id: 'frog' }, 3);
    assert.ok(svg.includes('vz-cover') && svg.includes('vz-who'), kind);
    assert.ok(['lift', 'aside', 'door'].includes(SPOTS[kind]), kind);
    assert.equal(!!SPOT_ART[kind].hole, SPOTS[kind] === 'door', `${kind}: a doorway only on a door`);
    const fit = figureFit(kind);
    assert.ok(fit.k > 0.5 && fit.k <= 1, kind);
    assert.ok(!/\sid=|url\(#/.test(svg), `${kind}: ids in the drawing`);
  }
  for (const s of SCENE_IDS) {
    assert.ok(sceneSvg(s).startsWith('<svg'));
    assert.ok(sceneCardSvg(s, SCENES[s].spots[0], SCENES[s].animals[0]).includes('vz-scene-pic'));
    for (const a of SCENES[s].animals) assert.ok(ANIMAL_IDS.includes(a));
    for (const k of SCENES[s].spots) assert.ok(SPOT_KINDS.includes(k));
  }
  // enough creatures for the fullest round
  for (const tier of TIER_IDS) assert.ok(CREATURE_IDS.length >= TIERS[tier].spots[1] - TIERS[tier].find - TIERS[tier].lookalikes);
  assert.ok(tileSvg().startsWith('<svg') && howSvg().startsWith('<svg'));
});

test('verstop: free is tier 1 in the garden; the full version opens the rest', () => {
  assert.equal(meta.id, 'verstop');
  assert.equal(meta.group, 'puzzles');
  assert.equal(meta.isLocked({ scene: 'garden', tier: 't1' }, false), false);
  for (const tier of ['t2', 't3']) assert.equal(meta.isLocked({ scene: 'garden', tier }, false), true);
  for (const scene of ['forest', 'beach', 'farm']) for (const tier of TIER_IDS) assert.equal(meta.isLocked({ scene, tier }, false), true);
  for (const scene of SCENE_IDS) for (const tier of TIER_IDS) assert.equal(meta.isLocked({ scene, tier }, true), false);
});

test('verstop: its save section travels whole through Voortgang overzetten (sanitizePayload)', async () => {
  const { sanitizePayload } = await import('../web/js/transfer.js');
  const section = {
    stars: { 'garden-t1-1': 2, 'beach-t3-6': 3 },
    random: { t1: 4, t3: 1 },
    howSeen: { t1: true, t3: true },
    lastScene: 'farm',
    lastTier: 't2',
  };
  const out = sanitizePayload({ games: { verstop: section }, settings: {} });
  assert.deepEqual(out.games.verstop, section);
});
