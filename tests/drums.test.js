import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../web/games/drums/kit.js';
import { meta } from '../web/games/drums/meta.js';
import { tileSvg, cardSvg, padSvg, padGlyph, standsSvg } from '../web/games/drums/art.js';
import * as sound from '../web/games/drums/sound.js';
import * as sfx from '../web/js/audio.js';
import * as store from '../web/js/storage.js';
import { sanitizePayload } from '../web/js/transfer.js';

const beats = (r) => r.beats;

test('the kit: 8 pads (kick, snare, hi-hat, three toms, crash, ride), each its own colour and key', () => {
  assert.deepEqual([...D.PAD_IDS].sort(), ['crash', 'floor', 'hihat', 'kick', 'ride', 'snare', 'tom1', 'tom2']);
  const colours = D.PADS.map((p) => p.color);
  assert.equal(new Set(colours).size, colours.length, 'two pads share a colour');
  for (const c of colours) assert.match(c, /^#[0-9a-f]{6}$/);
  assert.equal(new Set(Object.keys(D.KEYBOARD_MAP)).size, D.PADS.length);
  assert.deepEqual([...new Set(Object.values(D.KEYBOARD_MAP))].sort(), [...D.PAD_IDS].sort());
  assert.equal(D.padById('cowbell'), null);
});

test('the layout: a real kit, the kick big and low in the middle, the toms on it, cymbals above', () => {
  const mid = (r) => r[0] + r[2] / 2;
  const bottom = (r) => r[1] + r[3];
  for (const [name, kit] of Object.entries(D.KITS)) {
    const p = kit.pads;
    assert.deepEqual(Object.keys(p).sort(), [...D.PAD_IDS].sort(), name);
    for (const [id, [x, y, w, h]] of Object.entries(p)) assert.ok(x >= 0 && y >= 0 && x + w <= kit.w && y + h <= kit.h, `${name}: ${id} outside the kit`);
    // the kick: the lowest, in the middle, the biggest drum
    for (const id of D.PAD_IDS) if (id !== 'kick') assert.ok(bottom(p[id]) <= bottom(p.kick), `${name}: ${id} below the kick`);
    assert.ok(Math.abs(mid(p.kick) - kit.w / 2) < kit.w * 0.06, `${name}: the kick is not in the middle`);
    assert.ok(p.kick[2] * p.kick[3] >= Math.max(...D.PAD_IDS.filter((id) => id !== 'kick').map((id) => p[id][2] * p[id][3])), `${name}: the kick is not the biggest`);
    // the toms above the kick and around its middle, the high tom left; the cymbals on top
    assert.ok(bottom(p.tom1) <= p.kick[1] && bottom(p.tom2) <= p.kick[1], name);
    assert.ok(mid(p.tom1) < mid(p.kick) && mid(p.tom2) > mid(p.kick), name);
    for (const c of ['crash', 'ride']) assert.ok(p[c][1] < p.tom1[1] + p.tom1[3] / 2 && p[c][1] < p.hihat[1] && p[c][1] < p.floor[1], `${name}: ${c} not high`);
    // the hi-hat far left, the snare left of the middle, the floor tom right, the crash left, the ride right
    assert.ok(mid(p.hihat) < mid(p.snare) && mid(p.snare) <= mid(p.kick) && mid(p.floor) > mid(p.kick), name);
    assert.ok(mid(p.crash) < mid(p.kick) && mid(p.ride) > mid(p.kick), name);
    assert.equal(Math.min(...D.PAD_IDS.map((id) => mid(p[id]))), mid(p.hihat), `${name}: the hi-hat is not the leftmost`);
  }
  for (const [name, shape] of Object.entries(D.GRIDS)) {
    assert.deepEqual([...shape.areas.flat()].sort(), [...D.PAD_IDS].sort(), name);
    assert.equal(shape.areas.length, shape.rows);
    for (const row of shape.areas) assert.equal(row.length, shape.cols);
  }
  assert.equal(D.kitShape(844, 300), 'wide');
  assert.equal(D.kitShape(1280, 650), 'wide');
  assert.equal(D.kitShape(390, 650), 'tall');
  assert.equal(D.kitShape(300, 300), 'tall');
});

/** Every pad inside the box, at least `min` px each way, and no two touch areas overlapping. */
function checkCells(label, cells, w, h, min) {
  const list = Object.entries(cells);
  assert.equal(list.length, 8, label);
  for (const [id, c] of list) {
    assert.ok(Math.min(c.w, c.h) >= min, `${label}: ${id} is ${c.w.toFixed(0)}x${c.h.toFixed(0)}`);
    assert.ok(c.x >= -1e-9 && c.y >= -1e-9 && c.x + c.w <= w + 1e-9 && c.y + c.h <= h + 1e-9, `${label}: ${id} off screen`);
  }
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [ia, a] = list[i];
      const [ib, b] = list[j];
      assert.ok(a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9 || a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9, `${label}: ${ia} and ${ib} overlap`);
    }
}

test('the layout on every screen: the kit shape, every pad 80 px or more, inside the box, none overlapping', () => {
  // the kit's box as the smoke test measures it (free play, then a rhythm with the bar above the kit)
  const boxes = [
    ['320x568', 'tall', [308, 472], [308, 373]],
    ['360x640', 'tall', [348, 544], [348, 462]],
    ['390x844', 'tall', [370, 744], [370, 645]],
    ['768x1024', 'tall', [748, 924], [748, 842]],
    ['568x320', 'wide', [548, 250], [548, 244]],
    ['844x390', 'wide', [824, 320], [824, 314]],
    ['1024x768', 'wide', [1004, 668], [1004, 586]],
    ['1280x800', 'wide', [1100, 700], [1100, 618]],
  ];
  for (const [screen, shape, ...sizes] of boxes) {
    for (const [w, h] of sizes) {
      const lay = D.kitLayout(w, h);
      assert.equal(lay.shape, shape, `${screen} (${w}x${h}): ${lay.shape}`);
      checkCells(`${screen} (${w}x${h})`, lay.cells, w, h, D.MIN_PAD);
      assert.deepEqual(D.kitCells(w, h), lay.cells);
      // the kit keeps its shape: never stretched more than STRETCH one way
      const k = D.KITS[shape];
      const sx = lay.box.w / k.w;
      const sy = lay.box.h / k.h;
      assert.ok(Math.max(sx / sy, sy / sx) <= D.STRETCH + 1e-9, `${screen}: stretched ${sx.toFixed(2)} by ${sy.toFixed(2)}`);
      // centred across, standing on the bottom of the box (close to the thumbs)
      assert.ok(Math.abs(lay.box.x * 2 + lay.box.w - w) < 1e-6 && Math.abs(lay.box.y + lay.box.h - h) < 1e-6, `${screen}: the kit does not stand on the bottom`);
      assert.ok(Math.abs(Math.max(...Object.values(lay.cells).map((c) => c.y + c.h)) - h) < 1e-6, `${screen}: the kick is not on the bottom`);
    }
  }
  // a box too small for the kit: the plain grid, when it gives bigger pads
  const low = D.kitLayout(548, 175);
  assert.equal(low.shape, 'grid-wide');
  checkCells('548x175', low.cells, 548, 175, 80);
  const narrow = D.kitLayout(250, 360);
  assert.equal(narrow.shape, 'grid-tall');
  checkCells('250x360', narrow.cells, 250, 360, 80);
  // every box from small phones to desktop: never overlapping, always inside
  for (let w = 240; w <= 1400; w += 37)
    for (let h = 160; h <= 1000; h += 41) {
      const lay = D.kitLayout(w, h);
      checkCells(`${w}x${h}`, lay.cells, w, h, 0);
    }
});

test('parseRhythm reads pads, pairs, lengths and rests, and refuses what a child cannot play', () => {
  assert.deepEqual(D.parseRhythm('K+H S:.5 | . 3:2'), [
    { pads: ['kick', 'hihat'], beats: 1 },
    { pads: ['snare'], beats: 0.5 },
    { pads: [], beats: 1 },
    { pads: ['floor'], beats: 2 },
  ]);
  assert.throws(() => D.parseRhythm('K X'), /unknown pad/);
  assert.throws(() => D.parseRhythm('K+K'), /twice/);
  assert.throws(() => D.parseRhythm('K+S+H'), /more than two/);
  assert.throws(() => D.parseRhythm('K:0'), /odd length/);
  assert.throws(() => D.parseRhythm('K:8'), /odd length/);
});

test('the rhythms: two levels by age, whole 4/4 bars, the young one slower and one pad at a time', () => {
  assert.deepEqual(D.LEVELS.map((l) => [l.id, l.timed]), [['small', false], ['big', true]]);
  assert.deepEqual(D.RHYTHM_IDS, ['rock1', 'mars1', 'jacob1', 'paard1', 'rock2', 'mars2', 'jacob2', 'disco2']);
  assert.equal(new Set(D.RHYTHM_IDS).size, D.RHYTHM_IDS.length);
  for (const r of D.RHYTHMS) {
    assert.equal(beats(r) % 4, 0, `${r.id}: ${beats(r)} beats is not whole 4/4 bars`);
    assert.ok(r.steps.length >= 12 && r.steps.length <= 40, `${r.id}: ${r.steps.length} steps`);
    assert.ok(D.rhythmLength(r) < 25000, `${r.id} takes ${D.rhythmLength(r)} ms`);
    for (let i = 1; i < r.steps.length; i++) assert.ok(r.steps[i].at > r.steps[i - 1].at, `${r.id}: steps out of order`);
    for (const s of r.steps) for (const p of s.pads) assert.ok(D.padById(p), `${r.id}: ${p}`);
    assert.equal(D.levelOf(r).rhythms.includes(r), true);
  }
  const small = D.LEVELS[0].rhythms;
  const big = D.LEVELS[1].rhythms;
  for (const r of small) {
    assert.ok(r.steps.every((s) => s.pads.length === 1), `${r.id}: a 4-year-old plays one pad at a time`);
    assert.ok(r.bpm <= 96, `${r.id}: ${r.bpm} bpm`);
  }
  for (const r of big) {
    assert.ok(r.steps.some((s) => s.pads.length === 2), `${r.id} has no two pads at once`);
    assert.ok(r.bpm >= 100 && r.bpm <= 120, `${r.id}: ${r.bpm} bpm`);
    // on the beat, steps are never closer than an eighth: a window stays wide enough for a finger
    for (let i = 1; i < r.steps.length; i++) assert.ok(r.steps[i].at - r.steps[i - 1].at >= 0.5, `${r.id} step ${i}`);
  }
  assert.ok(Math.max(...small.map((r) => r.bpm)) < Math.min(...big.map((r) => r.bpm)), 'the older level is faster');
  // the easy beats Mark asked for: a rock beat, a march and the rhythm of Vader Jacob
  assert.deepEqual(D.rhythmById('rock1').steps.slice(0, 4).map((s) => s.pads[0]), ['kick', 'hihat', 'snare', 'hihat']);
  assert.deepEqual(D.rhythmById('rock2').steps[0].pads, ['kick', 'hihat']);
  // Vader Jacob follows the tune: C D E C on floor, middle and high tom; "slaapt gij nog" ends on the crash
  const jacob = D.rhythmById('jacob1').steps.map((s) => s.pads[0]);
  assert.deepEqual(jacob.slice(0, 8), ['floor', 'tom2', 'tom1', 'floor', 'floor', 'tom2', 'tom1', 'floor']);
  assert.deepEqual(jacob.slice(8, 11), ['tom1', 'snare', 'crash']);
  assert.equal(D.rhythmById('nope'), null);
});

test('free part: free play and the first rhythm of each level; the rest only with the full version', () => {
  assert.equal(meta.id, 'drums');
  assert.equal(meta.group, 'creative');
  assert.deepEqual([...meta.freeRhythms], D.LEVELS.map((l) => l.rhythms[0].id));
  for (const l of D.LEVELS) {
    assert.equal(meta.isLocked(l.rhythms[0].id, false), false);
    for (const r of l.rhythms.slice(1)) {
      assert.equal(meta.isLocked(r.id, false), true, r.id);
      assert.equal(meta.isLocked(r.id, true), false, r.id);
    }
  }
});

test('own pace (4-6): the count-in counts nothing, the right pad moves on, another only counts as a miss', () => {
  for (const r of D.LEVELS[0].rhythms) {
    const beat = D.beatMs(r);
    const run = D.createRun(r);
    assert.equal(run.press('kick', 0), 'idle');
    run.start(1000);
    assert.equal(run.countAt(1000), 1);
    assert.equal(run.countAt(1000 + beat * 3.5), 4);
    assert.deepEqual(run.glow(1000 + beat), [], 'nothing glows during the count-in');
    assert.equal(run.press(r.steps[0].pads[0], 1000 + beat), 'count');
    assert.equal(run.index, 0);
    let at = 1000 + D.COUNT_IN * beat;
    assert.equal(run.countAt(at), 0);
    let misses = 0;
    r.steps.forEach((s, i) => {
      assert.deepEqual(run.glow(at), s.pads, `${r.id} step ${i} glows on its beat`);
      if (i % 4 === 1) {
        const wrong = D.PAD_IDS.find((p) => !s.pads.includes(p) && !r.steps[i - 1].pads.includes(p));
        assert.equal(run.press(wrong, at), 'wrong');
        misses++;
        assert.equal(run.index, i, 'a wrong pad never moves the rhythm on');
      }
      assert.equal(run.press(s.pads[0], at), i === r.steps.length - 1 ? 'done' : 'step');
      if (i + 1 < r.steps.length) {
        const gap = (r.steps[i + 1].at - s.at) * beat;
        // the next pad lights up one step later (the beat), but a child who is early still counts
        assert.deepEqual(run.glow(at + gap / 2), [], `${r.id} step ${i + 1} glows too early`);
        assert.equal(run.nextChange(at + gap / 2), at + gap);
        at += gap + 3000; // a slow child: the rhythm waits
        assert.equal(run.nextChange(at), null, 'waiting for the child needs no timer');
      }
    });
    assert.equal(run.done, true);
    assert.equal(run.misses, misses);
    assert.equal(run.press('kick', at), 'over');
    assert.equal(run.misses, misses, 'nothing counts after the end');
    assert.ok(D.starsFor(run.misses) >= 2);
  }
});

test('own pace: an early hit counts, a double tap is not a mistake, and a two-pad step needs both pads', () => {
  const r = D.rhythmById('rock1');
  const run = D.createRun(r);
  run.start(0);
  const go = D.COUNT_IN * D.beatMs(r);
  assert.equal(run.press('kick', go), 'step');
  assert.equal(run.press('kick', go + 80), 'again', 'a bounce of the finger');
  assert.equal(run.press('hihat', go + 100), 'step', 'before its glow');
  assert.equal(run.misses, 0);
  // a pair (own pace never has one in the rhythms, but the rules allow it)
  const pair = { id: 'x', level: 'small', bpm: 90, beats: 4, steps: [{ pads: ['kick', 'crash'], at: 0, beats: 2 }, { pads: ['snare'], at: 2, beats: 2 }] };
  const p = D.createRun(pair);
  p.start(0);
  const t = D.COUNT_IN * D.beatMs(pair);
  assert.deepEqual(p.glow(t), ['kick', 'crash']);
  assert.equal(p.press('crash', t), 'part');
  assert.deepEqual(p.glow(t), ['kick'], 'the pad still to hit keeps glowing');
  assert.equal(p.press('crash', t + 10), 'again');
  assert.equal(p.press('kick', t + 20), 'step');
  assert.equal(p.press('snare', t + 2000), 'done');
});

test('on the beat (7-10): hits close to the beat count, both pads of a pair, a missed step passes', () => {
  for (const r of D.LEVELS[1].rhythms) {
    const run = D.createRun(r, { timed: true });
    run.start(0);
    const skip = new Set([2, 7, 11]); // steps the child misses
    let good = 0;
    r.steps.forEach((s, i) => {
      const due = run.due(i);
      const off = [-90, 40, -30, 70][i % 4]; // a little early or late, as fingers are
      assert.deepEqual(run.glow(due - 30), i === 0 || !skip.has(i - 1) ? s.pads : run.glow(due - 30));
      if (skip.has(i)) return;
      s.pads.forEach((pad, k) => {
        const res = run.press(pad, due + off + k * 15);
        assert.equal(res, k < s.pads.length - 1 ? 'part' : i === r.steps.length - 1 ? 'done' : 'step', `${r.id} step ${i} ${pad}`);
      });
      good++;
    });
    assert.equal(run.done, true, r.id);
    assert.equal(run.good, good);
    assert.equal(run.misses, skip.size);
    assert.equal(D.timedStars(run.good, run.total), 3);
  }
});

test('on the beat: too early or too late is a stray (never a miss), the right pad near its beat is not', () => {
  const r = D.rhythmById('rock2'); // quarters at 100 bpm: 600 ms apart
  const run = D.createRun(r, { timed: true });
  run.start(0);
  const due = run.due(0);
  assert.equal(due, D.COUNT_IN * 600);
  assert.equal(run.countAt(100), 1);
  assert.equal(run.countAt(due - 1), 4);
  assert.equal(run.press('kick', due - D.WINDOW_MS - 20), 'stray', 'too early');
  assert.equal(run.press('snare', due), 'stray', 'not in this step');
  assert.equal(run.misses, 0);
  assert.equal(run.strays, 2);
  assert.equal(run.press('kick', due - D.WINDOW_MS + 5), 'part');
  assert.equal(run.press('hihat', due + D.WINDOW_MS - 5), 'step');
  // step 1 is never played: once its window closes it is a miss and step 2 glows
  const d1 = run.due(1);
  assert.deepEqual(run.update(d1 + D.WINDOW_MS - 1), []);
  assert.deepEqual(run.update(d1 + D.WINDOW_MS + 1), [1]);
  assert.equal(run.index, 2);
  assert.equal(run.stepState(1), 'miss');
  assert.deepEqual(run.glow(d1 + D.WINDOW_MS + 1), ['snare', 'hihat']);
  assert.ok(run.lead(d1 + D.WINDOW_MS + 1) > 0, 'the ring has time to close in');
  assert.equal(run.press('snare', run.due(2) + D.WINDOW_MS + 30), 'stray', 'too late: past its window');
  // nobody plays the rest: the rhythm still ends
  const end = run.due(r.steps.length - 1) + 1000;
  run.update(end);
  assert.equal(run.done, true);
  assert.equal(run.good, 1);
  assert.equal(run.misses, r.steps.length - 1);
  assert.equal(D.timedStars(run.good, run.total), 0);
});

test('on the beat: the window never reaches past the middle between two eighths', () => {
  const r = D.rhythmById('disco2'); // eighths at 112 bpm: 268 ms apart
  const run = D.createRun(r, { timed: true });
  run.start(0);
  const gap = run.due(1) - run.due(0);
  assert.ok(gap < 2 * D.WINDOW_MS);
  // the kick of step 0 hit just after the middle belongs to step 1 (a hi-hat): a stray, not a hit
  assert.equal(run.press('kick', run.due(0) + gap / 2 + 5), 'stray');
  assert.equal(run.stepState(0), 'miss');
  assert.equal(run.press('hihat', run.due(1) - gap / 2 + 10), 'step');
});

test('nextChange wakes the screen for every count, glow and miss, and not while a child takes their time', () => {
  for (const timed of [false, true]) {
    const r = D.rhythmById(timed ? 'mars2' : 'mars1');
    const run = D.createRun(r, { timed });
    run.start(0);
    let at = 0;
    let wakes = 0;
    while (!run.done && wakes < 500) {
      const next = run.nextChange(at);
      if (next === null) {
        run.press(run.glow(at)[0], at + 50); // own pace: the child plays
        at += 50;
        continue;
      }
      assert.ok(next >= at, 'never in the past');
      at = Math.max(next, at + 1);
      run.update(at);
      wakes++;
    }
    assert.equal(run.done, true, `${r.id} ends`);
  }
});

test('stars are gentle: own pace counts wrong pads only, on the beat the share of steps in time', () => {
  assert.equal(D.starsFor(0), 3);
  assert.equal(D.starsFor(2), 3);
  assert.equal(D.starsFor(3), 2);
  assert.equal(D.starsFor(6), 2);
  assert.equal(D.starsFor(7), 1);
  assert.equal(D.starsFor(400), 1);
  assert.equal(D.timedStars(20, 20), 3);
  assert.equal(D.timedStars(16, 20), 3);
  assert.equal(D.timedStars(11, 20), 2);
  assert.equal(D.timedStars(6, 20), 1);
  assert.equal(D.timedStars(5, 20), 0);
  assert.equal(D.timedStars(0, 0), 0);
});

test('listening: steps follow each other by their lengths, each lit shorter than its step', () => {
  for (const r of D.RHYTHMS) {
    const steps = D.schedule(r);
    assert.equal(steps.length, r.steps.length);
    const beat = D.beatMs(r);
    assert.equal(steps[0].at, 0);
    for (let i = 1; i < steps.length; i++) {
      const gap = steps[i].at - steps[i - 1].at;
      assert.ok(Math.abs(gap - (r.steps[i].at - r.steps[i - 1].at) * beat) <= 1, `${r.id} step ${i}`);
      assert.ok(steps[i - 1].hold > 0 && steps[i - 1].hold < gap, `${r.id} step ${i - 1} is lit through the next one`);
    }
  }
});

test('the pictures are self-contained SVG (no ids, no links)', () => {
  for (const svg of [tileSvg(), cardSvg('free'), ...D.RHYTHM_IDS.map(cardSvg), ...D.PAD_IDS.map(padSvg), ...D.PAD_IDS.map(padGlyph), standsSvg(D.kitLayout(824, 314), 824, 314), standsSvg(D.kitLayout(308, 373), 308, 373), standsSvg(D.kitLayout(548, 175), 548, 175)]) {
    assert.match(svg, /^<svg [^>]*viewBox=/);
    assert.doesNotMatch(svg, /\bid=|url\(|href|NaN|undefined/);
  }
  assert.equal(new Set(D.PAD_IDS.map(padSvg)).size, D.PAD_IDS.length, 'two pads look the same');
  assert.equal(new Set(D.PAD_IDS.map(padGlyph)).size, D.PAD_IDS.length, 'two pad signs look the same');
});

// A stand-in for the Web Audio API that counts what a hit makes. `currentTime` is moved by the test.
function fakeAudio() {
  const made = { osc: 0, noise: 0, started: 0, sources: [], compressors: [], suspended: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = (extra = {}) => ({ connect: (n) => n, ...extra });
  const source = (extra) => {
    const s = node({ ...extra, stopAt: Infinity, stop(t) { s.stopAt = t; } });
    made.sources.push(s);
    return s;
  };
  class Ctx {
    constructor() {
      made.ctx = this;
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.state = 'running';
      this.destination = node();
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      made.suspended++;
      this.state = 'suspended';
      return Promise.resolve();
    }
    createGain() {
      return node({ gain: param() });
    }
    createWaveShaper() {
      return node({});
    }
    createDynamicsCompressor() {
      const c = node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
      made.compressors.push(c);
      return c;
    }
    createBiquadFilter() {
      return node({ frequency: param(), Q: param(), type: '' });
    }
    createOscillator() {
      made.osc++;
      return source({ frequency: param(), type: '', start: () => made.started++ });
    }
    createBuffer(ch, len, rate) {
      const d = new Float32Array(len);
      return { duration: len / rate, getChannelData: () => d };
    }
    createBufferSource() {
      made.noise++;
      return source({ buffer: null, start: () => made.started++ });
    }
  }
  return { Ctx, made };
}

function withFakeAudio(fn) {
  const fake = fakeAudio();
  globalThis.AudioContext = fake.Ctx;
  try {
    sound.resetForTest();
    sfx.setMuted(false);
    return fn(fake.made);
  } finally {
    sfx.setMuted(false);
    sound.resetForTest();
    delete globalThis.AudioContext;
  }
}

test('the sound: every pad and the sticks make a sound that ends within two seconds; nothing with the sound off', () => {
  withFakeAudio((made) => {
    assert.equal(sound.hit('kick'), false, 'nothing before the first touch');
    sound.unlock();
    for (const id of [...D.PAD_IDS, 'sticks']) {
      const before = made.osc + made.noise;
      assert.equal(sound.hit(id), true, id);
      assert.ok(made.osc + made.noise > before, `${id} made no sound`);
    }
    assert.deepEqual([...sound.VOICE_IDS].sort(), [...D.PAD_IDS, 'sticks'].sort());
    for (const s of made.sources) assert.ok(s.stopAt > 0 && s.stopAt < 2.5, `a sound runs until ${s.stopAt}s`);
    assert.equal(made.sources.length, made.started, 'every source starts');
    sfx.setMuted(true);
    const before = made.osc + made.noise;
    for (const id of D.PAD_IDS) assert.equal(sound.hit(id), false);
    assert.equal(made.osc + made.noise, before, 'a sound with the sound off');
  });
});

test('the sound: a mashed cymbal chokes its last hit, so at most one voice per pad rings; a limiter keeps headroom', () => {
  withFakeAudio((made) => {
    sound.unlock();
    // a limiter with headroom sits before the clipper
    assert.equal(made.compressors.length, 1);
    assert.ok(sound.LIMIT.threshold <= -10 && sound.LIMIT.ratio >= 10 && sound.LIMIT.attack <= 0.005);
    assert.equal(made.compressors[0].threshold.value, sound.LIMIT.threshold);
    const ringingSources = (now) => made.sources.filter((s) => s.stopAt > now).length;
    let now = 0;
    // 60 hits on the crash and the ride, 50 ms apart (a child mashing two cymbals)
    const one = (() => {
      const before = made.sources.length;
      sound.hit('crash');
      return made.sources.length - before;
    })();
    for (let k = 1; k < 60; k++) {
      made.ctx.currentTime = k * 0.05;
      sound.hit('crash');
      sound.hit('ride');
      now = k * 0.05;
    }
    const live = ringingSources(now + 0.03);
    assert.ok(sound.ringing() <= 2, `${sound.ringing()} voices ring`);
    assert.ok(live <= one * 2 + 6, `${live} sources still ring after the mash (one crash is ${one})`);
    // every pad mashed at once: never more than one voice per pad
    for (let k = 0; k < 20; k++) {
      made.ctx.currentTime = 4 + k * 0.03;
      for (const id of [...D.PAD_IDS, 'sticks']) sound.hit(id);
    }
    assert.ok(sound.ringing() <= sound.MAX_VOICES, `${sound.ringing()} voices ring`);
    // the background lets the context sleep
    sound.suspend();
    assert.equal(made.suspended, 1);
  });
});

test('save: stars per rhythm only go up, in its own section, and survive a transfer', async () => {
  const m = new Map();
  const prefs = { get: async ({ key }) => ({ value: m.has(key) ? m.get(key) : null }), set: async ({ key, value }) => void m.set(key, value) };
  await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  store.recordStars(meta.id, 'rock1', 2);
  store.recordStars(meta.id, 'rock1', 1); // never lowered
  store.recordStars(meta.id, 'rock1', 3);
  store.recordStars(meta.id, 'rock2', 2);
  await store.flushed();
  const saved = JSON.parse(m.get(store.SAVE_KEY));
  assert.deepEqual(saved.games.drums, { stars: { rock1: 3, rock2: 2 } });
  const moved = sanitizePayload({ v: 1, games: { drums: saved.games.drums }, settings: {} });
  assert.deepEqual(moved.games.drums, { stars: { rock1: 3, rock2: 2 } });
});
