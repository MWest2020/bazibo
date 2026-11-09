import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../web/games/klok/time.js';
import { meta } from '../web/games/klok/meta.js';
import * as store from '../web/js/storage.js';

const at = (h, m) => h * 60 + m;

// Every 5-minute step of one hour, as Dutch and English children learn them.
const NL = {
  0: 'twee uur',
  5: 'vijf over twee',
  10: 'tien over twee',
  15: 'kwart over twee',
  20: 'tien voor half drie',
  25: 'vijf voor half drie',
  30: 'half drie',
  35: 'vijf over half drie',
  40: 'tien over half drie',
  45: 'kwart voor drie',
  50: 'tien voor drie',
  55: 'vijf voor drie',
};
const EN = {
  0: 'two o’clock',
  5: 'five past two',
  10: 'ten past two',
  15: 'quarter past two',
  20: 'twenty past two',
  25: 'twenty-five past two',
  30: 'half past two',
  35: 'twenty-five to three',
  40: 'twenty to three',
  45: 'quarter to three',
  50: 'ten to three',
  55: 'five to three',
};

test('phrase: every 5-minute step in Dutch and English', () => {
  for (const [m, want] of Object.entries(NL)) assert.equal(T.phrase(at(2, Number(m)), 'nl'), want, `nl 2:${m}`);
  for (const [m, want] of Object.entries(EN)) assert.equal(T.phrase(at(2, Number(m)), 'en'), want, `en 2:${m}`);
  // the same holds for every hour, morning and afternoon
  const NUM_NL = ['twaalf', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf'];
  const NUM_EN = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
  for (let h = 0; h < 24; h++) {
    const H = h % 12;
    const N = (h + 1) % 12;
    for (const [m, two] of Object.entries(NL)) {
      const want = two.replace('drie', '§').replace('twee', NUM_NL[H]).replace('§', NUM_NL[N]);
      assert.equal(T.phrase(at(h, Number(m)), 'nl'), want, `nl ${h}:${m}`);
    }
    for (const [m, two] of Object.entries(EN)) {
      const want = two.replace('three', '§').replace('two', NUM_EN[H]).replace('§', NUM_EN[N]);
      assert.equal(T.phrase(at(h, Number(m)), 'en'), want, `en ${h}:${m}`);
    }
  }
});

test('phrase: the hour wraps from twelve to one', () => {
  assert.equal(T.phrase(at(12, 30), 'nl'), 'half één');
  assert.equal(T.phrase(at(0, 45), 'nl'), 'kwart voor één');
  assert.equal(T.phrase(at(11, 30), 'nl'), 'half twaalf');
  assert.equal(T.phrase(at(23, 55), 'en'), 'five to twelve');
  assert.equal(T.phrase(at(0, 0), 'en'), 'twelve o’clock');
});

test('phrase: single minutes, with "voor half" and "over half" in Dutch', () => {
  assert.equal(T.phrase(at(3, 1), 'nl'), 'één minuut over drie');
  assert.equal(T.phrase(at(3, 7), 'nl'), 'zeven minuten over drie');
  assert.equal(T.phrase(at(3, 16), 'nl'), 'veertien minuten voor half vier');
  assert.equal(T.phrase(at(3, 22), 'nl'), 'acht minuten voor half vier');
  assert.equal(T.phrase(at(3, 33), 'nl'), 'drie minuten over half vier');
  assert.equal(T.phrase(at(3, 44), 'nl'), 'veertien minuten over half vier');
  assert.equal(T.phrase(at(3, 46), 'nl'), 'veertien minuten voor vier');
  assert.equal(T.phrase(at(3, 59), 'nl'), 'één minuut voor vier');
  assert.equal(T.phrase(at(3, 1), 'en'), 'one minute past three');
  assert.equal(T.phrase(at(3, 22), 'en'), 'twenty-two minutes past three');
  assert.equal(T.phrase(at(3, 47), 'en'), 'thirteen minutes to four');
});

test('phrase: all 720 positions on the face read differently, in both languages', () => {
  for (const lang of ['nl', 'en']) {
    const seen = new Set();
    for (let t = 0; t < 720; t++) {
      const p = T.phrase(t, lang);
      assert.ok(p && !p.includes('undefined'), `${lang} ${t}`);
      seen.add(p);
      assert.equal(T.phrase(t + 720, lang), p, 'morning and afternoon read the same on the face');
    }
    assert.equal(seen.size, 720, lang);
  }
});

test('digital: 12-hour and 24-hour', () => {
  assert.equal(T.digital(at(15, 5)), '3:05');
  assert.equal(T.digital(at(0, 30)), '12:30');
  assert.equal(T.digital(at(15, 5), { h24: true }), '15:05');
  assert.equal(T.digital(at(3, 5), { h24: true }), '03:05');
  assert.equal(T.digital(at(0, 0), { h24: true }), '00:00');
  assert.equal(T.isDay(at(6, 0)), true);
  assert.equal(T.isDay(at(17, 59)), true);
  assert.equal(T.isDay(at(18, 0)), true); // dinner at six is still daytime
  assert.equal(T.isDay(at(18, 1)), false);
  assert.equal(T.isDay(at(5, 59)), false);
});

test('hands: the hour hand moves on with the minutes', () => {
  assert.equal(T.minuteAngle(at(2, 30)), 180);
  assert.equal(T.hourAngle(at(2, 30)), 75);
  assert.equal(T.hourAngle(at(14, 30)), 75);
  assert.equal(T.hourAngle(at(12, 0)), 0);
  assert.equal(T.hourAngle(at(9, 45)), 292.5);
  assert.equal(T.pointAngle(100, 0, 100, 100), 0);
  assert.equal(T.pointAngle(200, 100, 100, 100), 90);
  assert.equal(T.pointAngle(100, 200, 100, 100), 180);
  assert.equal(T.pointAngle(0, 100, 100, 100), 270);
});

test('drag: the long hand follows the finger the shortest way and carries the hour over 12', () => {
  const sweep = (t, angles, step) => {
    const d = T.minuteDrag(t, angles[0], step);
    let x = d.first;
    for (const a of angles.slice(1)) x = d.move(a);
    return x;
  };
  const path = (from, to, n = 12) => Array.from({ length: n + 1 }, (_, k) => from + ((to - from) * k) / n);
  assert.equal(sweep(at(2, 50), path(300, 390), 5), at(3, 5)); // forwards over the top
  assert.equal(sweep(at(3, 5), path(30, -30), 5), at(2, 55)); // backwards over the top
  assert.equal(sweep(at(3, 10), [100], 5), at(3, 15)); // where the finger lands: 16.7 snaps to 15
  assert.equal(sweep(at(3, 0), path(0, 170), 30), at(3, 30));
  assert.equal(sweep(at(3, 0), path(0, 360, 4), 30), at(4, 0)); // half hours, round the clock: the hour moves on
  assert.equal(sweep(at(3, 30), path(180, 540, 3), 30), at(4, 30)); // big steps of 120 degrees still count
  assert.equal(sweep(at(3, 0), path(0, -360, 4), 30), at(2, 0)); // and backwards
  assert.equal(sweep(at(3, 50), path(300, 400, 2), 5), at(4, 7) - 2); // a fast flick of 50 degrees over 12
  assert.equal(sweep(at(3, 0), [200], 1), at(2, 33)); // landing at 33 past: the shortest way is back over 12
  assert.equal(sweep(at(3, 25), path(150, 200), 1), at(3, 33));
  assert.equal(sweep(at(11, 55), path(330, 363), 5), at(12, 0));
  assert.equal(sweep(at(23, 55), path(330, 363), 5), 0); // past midnight wraps
  assert.equal(sweep(at(3, 0), path(0, 1080, 18), 15), at(6, 0)); // three times round
  assert.equal(T.turnBetween(350, 10), 20);
  assert.equal(T.turnBetween(10, 350), -20);
});

test('drag: the hour hand keeps the minutes and the half of the day', () => {
  assert.equal(T.dragHour(at(3, 0), 90), at(3, 0));
  assert.equal(T.dragHour(at(3, 0), 125), at(4, 0));
  assert.equal(T.dragHour(at(3, 30), 135), at(4, 30)); // at 4:30 the hand points at 135 degrees
  assert.equal(T.dragHour(at(15, 30), 135), at(16, 30));
  assert.equal(T.dragHour(at(3, 0), 359), at(0, 0)); // twelve o'clock
  assert.equal(T.hour12(T.dragHour(at(3, 0), 359)), 12);
});

test('picking a hand: by distance from the centre, the short hand wins when the hands overlap', () => {
  assert.equal(T.pickHand(10, 70, at(3, 0)), 'minute'); // far out: always the long hand
  assert.equal(T.pickHand(90, 70, at(3, 0)), 'minute');
  assert.equal(T.pickHand(90, 30, at(3, 0)), 'hour'); // near the centre, on the short hand
  assert.equal(T.pickHand(5, 30, at(12, 0)), 'hour'); // 12:00, both hands up: the short hand
  assert.equal(T.pickHand(5, 70, at(12, 0)), 'minute'); // ... unless the finger is beyond its reach
  assert.equal(T.pickHand(180, 40, at(3, 30)), 'minute'); // near the centre, far from the short hand
});

test('answer options: right number, one correct, all different, plausible, on the grid', () => {
  for (const tier of T.TIER_IDS) {
    const info = T.TIERS[tier];
    for (let seed = 1; seed <= 300; seed++) {
      const rng = T.mulberry32(seed);
      const target = T.randomTime(tier, rng);
      for (const lang of ['nl', 'en']) {
        const opts = T.answerOptions(target, tier, T.mulberry32(seed * 7), lang);
        assert.equal(opts.length, info.options, `${tier} ${seed}`);
        assert.equal(opts.filter((o) => o.correct).length, 1);
        assert.equal(new Set(opts.map((o) => o.text)).size, opts.length, `unique ${tier} ${seed} ${lang}`);
        const right = opts.find((o) => o.correct);
        assert.equal(right.text, T.label(target, tier, lang));
        for (const o of opts) {
          assert.equal(T.minuteOf(o.t) % info.step, 0, `on the grid ${tier}`);
          assert.equal(o.text, T.label(o.t, tier, lang));
          if (!o.correct) {
            if (info.digital24) assert.notEqual(o.t % 1440, target % 1440);
            else assert.ok(!T.sameFace(o.t, target), 'a wrong answer never shows the same clock');
          }
        }
      }
    }
  }
});

test('answer options: the oldest tier sometimes offers the twelve-hour flip as a mistake', () => {
  let flips = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const target = T.randomTime('t5', T.mulberry32(seed));
    const opts = T.answerOptions(target, 't5', T.mulberry32(seed + 1000));
    if (opts.some((o) => !o.correct && T.sameFace(o.t, target))) flips++;
  }
  assert.ok(flips > 40 && flips < 300, `flip offered in ${flips} of 400`);
});

test('answer options: never an hour too early and an hour too late together', () => {
  for (const tier of T.TIER_IDS) {
    const span = T.TIERS[tier].digital24 ? 1440 : 720;
    for (let seed = 1; seed <= 500; seed++) {
      const target = T.randomTime(tier, T.mulberry32(seed));
      const offs = T.answerOptions(target, tier, T.mulberry32(seed * 3 + 1)).map((o) => (((o.t - target) % span) + span) % span);
      assert.ok(!(offs.includes(60) && offs.includes(span - 60)), `${tier} ${seed}: ${offs}`);
    }
  }
});

test('answer options: no simple rule finds the answer (the middle one, the earliest, the latest)', () => {
  for (const tier of T.TIER_IDS) {
    const span = T.TIERS[tier].digital24 ? 1440 : 720;
    const wins = { middle: 0, earliest: 0, latest: 0, nearestToOthers: 0 };
    const N = 1000;
    for (let seed = 1; seed <= N; seed++) {
      const target = T.randomTime(tier, T.mulberry32(seed));
      const opts = T.answerOptions(target, tier, T.mulberry32(seed * 7 + 3));
      // read the times around the right one, as a child sees a row of answers
      const pos = opts.map((o) => ({ ...o, rel: ((((o.t - target) % span) + span + span / 2) % span) - span / 2 }));
      const sorted = [...pos].sort((a, b) => a.rel - b.rel);
      if (sorted[Math.floor((sorted.length - 1) / 2)].correct || (sorted.length % 2 === 0 && sorted[sorted.length / 2].correct && false)) wins.middle++;
      if (sorted[0].correct) wins.earliest++;
      if (sorted[sorted.length - 1].correct) wins.latest++;
      const spread = (o) => pos.reduce((s, x) => s + Math.abs(x.rel - o.rel), 0);
      const best = [...pos].sort((a, b) => spread(a) - spread(b))[0];
      if (best.correct) wins.nearestToOthers++;
    }
    for (const [rule, n] of Object.entries(wins)) assert.ok(n / N <= 0.42, `${tier}: "${rule}" wins ${((100 * n) / N).toFixed(0)}%`);
  }
});

test('daily rhythm: the first rounds never show two clocks that differ only by the sun or the moon', () => {
  for (const round of [1, 2]) {
    for (let seed = 1; seed <= 200; seed++) {
      for (const q of T.makeRound({ mode: 'day', tier: 't1', seed, round })) {
        const faces = q.options.map((o) => o.t % 720);
        assert.equal(new Set(faces).size, faces.length, `round ${round} seed ${seed}`);
      }
    }
  }
});

test('rounds: 10 questions, the same for the same seed, different targets, a start that is not the answer', () => {
  for (const mode of ['set', 'read']) {
    for (const tier of T.TIER_IDS) {
      const a = T.makeRound({ mode, tier, seed: 42 });
      const b = T.makeRound({ mode, tier, seed: 42 });
      assert.equal(a.length, T.ROUND_LEN);
      assert.deepEqual(a.map((q) => q.target), b.map((q) => q.target));
      const key = (x) => (T.TIERS[tier].digital24 ? x % 1440 : x % 720);
      assert.equal(new Set(a.map((q) => key(q.target))).size, a.length, `${mode} ${tier} distinct`);
      for (const q of a) {
        assert.equal(T.minuteOf(q.target) % T.TIERS[tier].step, 0);
        if (mode === 'set') assert.ok(!T.sameFace(q.start, q.target));
        else assert.equal(q.options.length, T.TIERS[tier].options);
      }
    }
  }
});

test('daily rhythm: whole hours, three clocks, the right one among them, far enough apart', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const qs = T.makeRound({ mode: 'day', tier: 't1', seed });
    assert.equal(qs.length, T.ROUND_LEN);
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (i) assert.notEqual(q.activity, qs[i - 1].activity, 'not the same picture twice in a row');
      assert.equal(T.minuteOf(q.target), 0);
      assert.equal(q.options.length, 3);
      assert.equal(q.options.filter((o) => o.correct).length, 1);
      assert.equal(q.options.find((o) => o.correct).t, q.target);
      assert.equal(new Set(q.options.map((o) => o.t)).size, 3);
      for (const o of q.options) if (!o.correct) assert.ok(Math.abs(o.t - q.target) >= 180);
    }
  }
});

test('stars and the hint', () => {
  assert.equal(T.starsFor(0), 3);
  assert.equal(T.starsFor(1), 2);
  assert.equal(T.starsFor(2), 2);
  assert.equal(T.starsFor(3), 1);
  assert.equal(T.starsFor(10), 1);
  assert.equal(T.hintHand(at(3, 10), at(5, 30)), 'minute');
  assert.equal(T.hintHand(at(3, 30), at(5, 30)), 'hour');
  assert.equal(T.minutePosition(at(3, 0)), 12);
  assert.equal(T.minutePosition(at(3, 25)), 5);
  assert.equal(T.minutePosition(at(3, 27)), null);
});

test('rounds and the lock: the two youngest tiers and the daily rhythm are free', () => {
  const ids = T.roundIds();
  assert.equal(ids.length, 2 * 5 * 3 + 3);
  for (const id of ids) {
    const { mode, tier } = T.parseRoundId(id);
    const free = mode === 'day' || tier === 't1' || tier === 't2';
    assert.equal(meta.isLocked({ mode, tier }, false), !free, id);
    assert.equal(meta.isLocked({ mode, tier }, true), false, id);
  }
});

test('save: stars per round only go up, random counts per mode and tier, the section is its own', async () => {
  const m = new Map();
  const prefs = { get: async ({ key }) => ({ value: m.has(key) ? m.get(key) : null }), set: async ({ key, value }) => void m.set(key, value) };
  await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  store.recordStars('bubbels', '1', 2);
  store.recordStars(meta.id, 'set-t1-1', 2);
  store.recordStars(meta.id, 'set-t1-1', 1); // never lowered
  store.recordStars(meta.id, 'read-t2-3', 3);
  store.recordRandomSolved(meta.id, 'set-t4');
  store.recordRandomSolved(meta.id, 'set-t4');
  store.saveGameOption(meta.id, 'howSeen', { set: true });
  await store.flushed();
  const saved = JSON.parse(m.get(store.SAVE_KEY));
  assert.deepEqual(saved.games.klok, { stars: { 'set-t1-1': 2, 'read-t2-3': 3 }, random: { 'set-t4': 2 }, howSeen: { set: true } });
  assert.deepEqual(saved.games.bubbels, { stars: { 1: 2 } });
});
