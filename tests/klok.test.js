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

test('rounds and the lock: the two youngest tiers, the daily rhythm and digital tier 1 are free', () => {
  const ids = T.roundIds();
  assert.equal(ids.length, 2 * 5 * 3 + 3 + 3 * 3);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    const { mode, tier } = T.parseRoundId(id);
    const free = mode === 'day' || (mode === 'dig' ? tier === 't1' : tier === 't1' || tier === 't2');
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

// ---------- Digitaal ----------

const NB = ' '; // ’s and its word stay together
const PART_NL = { night: `’s${NB}nachts`, morning: `’s${NB}ochtends`, afternoon: `’s${NB}middags`, evening: `’s${NB}avonds` };
const PART_EN = { night: 'at night', morning: 'in the morning', afternoon: 'in the afternoon', evening: 'in the evening' };
const partOfHour = (h) => (h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening');

test('parts of the day: 0-6 night, 6-12 morning, 12-18 afternoon, 18-24 evening', () => {
  const cases = [[0, 0, 'night'], [5, 59, 'night'], [6, 0, 'morning'], [11, 59, 'morning'], [12, 0, 'afternoon'], [17, 59, 'afternoon'], [18, 0, 'evening'], [23, 59, 'evening']];
  for (const [h, m, want] of cases) assert.equal(T.dayPart(at(h, m)), want, `${h}:${m}`);
  assert.equal(T.dayPart(at(24, 30)), 'night', 'wraps past midnight');
  assert.equal(T.dayPart(-30), 'evening');
  assert.deepEqual(T.DAY_PARTS.map((p) => p.from), [0, 360, 720, 1080]);
  for (let t = 0; t < 1440; t++) assert.equal(T.dayPart(t), partOfHour(Math.floor(t / 60)));
});

test('phrase24: every 5-minute step of all 24 hours in Dutch and English', () => {
  const NUM_NL = ['twaalf', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf'];
  const NUM_EN = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
  for (const lang of ['nl', 'en']) {
    const seen = new Set();
    for (let h = 0; h < 24; h++) {
      for (const [m, two] of Object.entries(lang === 'nl' ? NL : EN)) {
        const [a, b, NUM, PART] = lang === 'nl' ? ['drie', 'twee', NUM_NL, PART_NL] : ['three', 'two', NUM_EN, PART_EN];
        const words = two.replace(a, '§').replace(b, NUM[h % 12]).replace('§', NUM[(h + 1) % 12]);
        const want = lang === 'en' && h === 12 && m === '0' ? 'twelve o’clock, midday' : `${words} ${PART[partOfHour(h)]}`;
        const got = T.phrase24(at(h, Number(m)), lang);
        assert.equal(got, want, `${lang} ${h}:${m}`);
        seen.add(got);
      }
    }
    assert.equal(seen.size, 288, `${lang}: every 5-minute step of the day reads differently`);
  }
});

test('phrase24: the examples and the boundaries, as a child hears them', () => {
  const nl = (h, m) => T.phrase24(at(h, m), 'nl').replaceAll(NB, ' ');
  const en = (h, m) => T.phrase24(at(h, m), 'en');
  assert.equal(nl(14, 25), 'vijf voor half drie ’s middags');
  assert.equal(en(14, 25), 'twenty-five past two in the afternoon');
  assert.equal(nl(21, 15), 'kwart over negen ’s avonds');
  assert.equal(nl(9, 40), 'tien over half tien ’s ochtends');
  assert.equal(nl(0, 0), 'twaalf uur ’s nachts');
  assert.equal(nl(12, 0), 'twaalf uur ’s middags');
  assert.equal(en(12, 0), 'twelve o’clock, midday');
  assert.equal(en(12, 5), 'five past twelve in the afternoon');
  assert.equal(en(0, 0), 'twelve o’clock at night');
  assert.equal(nl(5, 55), 'vijf voor zes ’s nachts');
  assert.equal(nl(6, 0), 'zes uur ’s ochtends');
  assert.equal(nl(11, 55), 'vijf voor twaalf ’s ochtends');
  assert.equal(nl(17, 45), 'kwart voor zes ’s middags');
  assert.equal(nl(18, 0), 'zes uur ’s avonds');
  assert.equal(en(18, 0), 'six o’clock in the evening');
  assert.equal(nl(23, 55), 'vijf voor twaalf ’s avonds');
  assert.equal(en(2, 30), 'half past two at night');
  assert.equal(T.partWord(at(8, 0), 'en'), 'in the morning');
});

test('digital12: always two digits for the hour, 1 to 12', () => {
  assert.equal(T.digital12(at(3, 30)), '03:30');
  assert.equal(T.digital12(at(15, 5)), '03:05');
  assert.equal(T.digital12(at(0, 0)), '12:00');
  assert.equal(T.digital12(at(12, 55)), '12:55');
  assert.equal(T.digital12(at(11, 0)), '11:00');
  const faces = new Set();
  for (let t = 0; t < 720; t += 5) faces.add(T.digital12(t));
  assert.equal(faces.size, 144);
});

test('digital steppers: the hour goes round 1..12, the minutes round on their own', () => {
  assert.equal(T.digital12(T.stepDigit(at(12, 30), 'hour', 1)), '01:30');
  assert.equal(T.digital12(T.stepDigit(at(1, 30), 'hour', -1)), '12:30');
  assert.equal(T.digital12(T.stepDigit(at(11, 0), 'hour', 1)), '12:00');
  assert.equal(T.digital12(T.stepDigit(at(4, 55), 'minute', 1, 5)), '04:00'); // the hour stays
  assert.equal(T.digital12(T.stepDigit(at(4, 0), 'minute', -1, 5)), '04:55');
  assert.equal(T.digital12(T.stepDigit(at(4, 45), 'minute', 1, 15)), '04:00');
  assert.equal(T.digital12(T.stepDigit(at(16, 20), 'minute', 1, 5)), '04:25'); // 12-hour
  // every time on the face can be reached from any other
  for (const step of [5, 15]) {
    const reach = new Set();
    for (let h = 0; h < 12; h++) for (let m = 0; m < 60; m += step) reach.add(T.stepDigit(T.stepDigit(0, 'hour', h), 'minute', m / step, step));
    assert.equal(reach.size, 12 * (60 / step));
  }
});

test('digital rounds: the kinds, the grid, one right answer, no time twice, analogue and digital agree', () => {
  const span = (kind) => (T.digIs24(kind) ? 1440 : 720);
  for (const tier of T.DIG_TIER_IDS) {
    const info = T.DIG_TIERS[tier];
    let tricky = 0;
    let laters = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const round of [0, 1, 2, 3]) {
        for (const lang of ['nl', 'en']) {
          const step = T.digStep(tier, round);
          const qs = T.makeRound({ mode: 'dig', tier, seed, lang, round });
          const again = T.makeRound({ mode: 'dig', tier, seed, lang, round });
          assert.deepEqual(qs, again, 'the same seed gives the same round');
          assert.equal(qs.length, T.ROUND_LEN);
          const count = {};
          for (const q of qs) count[q.kind] = (count[q.kind] || 0) + 1;
          assert.deepEqual(count, { ...info.kinds }, `${tier} kinds`);
          const faces = qs.filter((q) => !T.digIs24(q.kind)).map((q) => q.target % 720);
          assert.equal(new Set(faces).size, faces.length, `${tier} ${seed}: a 12-hour target twice`);
          const days = qs.map((q) => q.target % 1440);
          assert.equal(new Set(days).size, days.length, `${tier} ${seed}: a target twice`);
          for (const q of qs) {
            const where = `${tier} r${round} ${seed} ${lang} ${q.kind} ${T.digital(q.target, { h24: true })}`;
            assert.equal(T.minuteOf(q.target) % step, 0, `${where}: on the grid`);
            if (!T.digIs24(q.kind)) assert.ok(q.target >= 0 && q.target < 720, where);
            if (T.DIG_SET_KINDS.includes(q.kind)) {
              assert.equal(q.options, undefined);
              assert.ok(!T.sameFace(q.start, q.target), `${where}: the start is not the answer`);
              assert.equal(T.minuteOf(q.start) % step, 0, `${where}: the start is on the grid`);
              continue;
            }
            const n = q.kind === 'later' ? 2 : info.options;
            assert.equal(q.options.length, n, where);
            assert.equal(q.options.filter((o) => o.correct).length, 1, where);
            assert.equal(q.options.find((o) => o.correct).t % span(q.kind), q.target % span(q.kind), where);
            assert.equal(new Set(q.options.map((o) => o.text)).size, n, `${where}: an answer written twice`);
            assert.equal(new Set(q.options.map((o) => o.t % span(q.kind))).size, n, `${where}: a time twice`);
            for (const o of q.options) {
              assert.equal(o.text, T.digLabel(q.kind, o.t, lang), `${where}: the text is the time`);
              assert.equal(T.minuteOf(o.t) % step, 0, `${where}: an option off the grid`);
            }
            if (q.kind === 'later') {
              const [a, b] = q.options.map((o) => o.t);
              assert.ok(Math.abs(a - b) >= 60, where);
              assert.equal(q.target, Math.max(a, b));
              laters++;
              if (T.laterMisleads(a, b)) tricky++;
            }
          }
        }
      }
    }
    if (laters) assert.ok(tricky / laters > 0.35 && tricky / laters < 0.65, `${tier}: ${tricky} of ${laters} "later" pairs mislead on a 12-hour reading`);
  }
});

test('which is later: misleading as the 12-hour digits read (12 is the biggest hour)', () => {
  assert.equal(T.laterMisleads(at(12, 45), at(7, 50)), false); // 12:45 reads later, and is
  assert.equal(T.laterMisleads(at(0, 25), at(9, 15)), true); // 00:25 reads as 12:25, but is earlier
  assert.equal(T.laterMisleads(at(9, 40), at(21, 15)), true);
  assert.equal(T.laterMisleads(at(21, 15), at(9, 40)), true);
  assert.equal(T.laterMisleads(at(8, 0), at(15, 0)), true); // 8:00 against 3:00
  assert.equal(T.laterMisleads(at(3, 0), at(20, 0)), false);
  assert.equal(T.laterMisleads(at(9, 40), at(21, 40)), false); // the same reading: no direction
});

test('digital rounds: tier 1 whole hours first, then half hours; tier 2 quarters first, then five minutes', () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (const q of T.makeRound({ mode: 'dig', tier: 't1', seed, round: 1 })) assert.equal(T.minuteOf(q.target), 0);
    for (const q of T.makeRound({ mode: 'dig', tier: 't2', seed, round: 1 })) assert.equal(T.minuteOf(q.target) % 15, 0);
  }
  const minutes = new Set();
  for (let seed = 1; seed <= 50; seed++) for (const q of T.makeRound({ mode: 'dig', tier: 't2', seed, round: 2 })) minutes.add(T.minuteOf(q.target));
  assert.equal(minutes.size, 12, 'every five minutes turns up');
  assert.equal(T.digStep('t1', 0), 30);
  assert.equal(T.digStep('t3', 0), 5);
});

test('digital rounds: the 24-hour mistakes include the twelve-hour flip, and no simple rule finds the answer', () => {
  let flips = 0;
  let asked = 0;
  const wins = {};
  for (let seed = 1; seed <= 400; seed++) {
    for (const tier of T.DIG_TIER_IDS) {
      for (const q of T.makeRound({ mode: 'dig', tier, seed: seed * 13 + 1, round: 2 })) {
        if (!q.options || q.kind === 'later') continue;
        const sp = T.digIs24(q.kind) ? 1440 : 720;
        if (T.digIs24(q.kind)) {
          asked++;
          if (q.options.some((o) => !o.correct && T.sameFace(o.t, q.target))) flips++;
        }
        const rel = (x) => ((((x - q.target) % sp) + sp + sp / 2) % sp) - sp / 2;
        const sorted = [...q.options].sort((a, b) => rel(a.t) - rel(b.t));
        const w = (wins[q.kind] ||= { n: 0, earliest: 0, latest: 0, middle: 0 });
        w.n++;
        if (sorted[0].correct) w.earliest++;
        if (sorted[sorted.length - 1].correct) w.latest++;
        if (sorted[Math.floor((sorted.length - 1) / 2)].correct) w.middle++;
      }
    }
  }
  assert.ok(flips / asked > 0.2, `the twelve-hour flip in ${flips} of ${asked}`);
  for (const [kind, w] of Object.entries(wins)) {
    for (const rule of ['earliest', 'latest', 'middle']) assert.ok(w[rule] / w.n <= 0.45, `${kind}: "${rule}" wins ${((100 * w[rule]) / w.n).toFixed(0)}%`);
  }
});

test('save and transfer: digital stars, random rounds, the how-to card and the last tier come through', async () => {
  const { sanitizePayload } = await import('../web/js/transfer.js');
  const doc = { v: 1, games: { klok: { stars: { 'dig-t1-1': 3, 'dig-t3-2': 1 }, random: { 'dig-t2': 4 }, howSeen: { dig: true }, lastTier: { dig: 't2', set: 't1' } } }, settings: {} };
  const clean = sanitizePayload(doc);
  assert.deepEqual(clean.games.klok, doc.games.klok);
});
