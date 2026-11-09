import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMandala, groupOf, MANDALA_TIERS, FREE_MANDALAS, rng } from '../web/games/kleuren/mandala.js';
import { PICTURES, FREE_PICTURES } from '../web/games/kleuren/pictures.js';
import { pageFor, parseKey, pictureKey, mandalaKey, targets, LIST_KEYS, FREE_MANDALA_KEYS } from '../web/games/kleuren/pages.js';
import { PALETTE, WHITE, pageSvg } from '../web/games/kleuren/art.js';
import { meta } from '../web/games/kleuren/meta.js';
import { backAction } from '../web/js/back.js';
import * as store from '../web/js/storage.js';

// A path is closed when every subpath ends with Z and only uses the commands we draw with.
const closed = (d) => /^M/.test(d) && /Z$/.test(d) && !/[^MLHVQCATZ0-9 .,\-e]/i.test(d) && d.split('M').slice(1).every((sub) => /Z\s*$/.test(sub));

function fakePreferences(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { get: async ({ key }) => ({ value: m.has(key) ? m.get(key) : null }), set: async ({ key, value }) => void m.set(key, value), dump: () => Object.fromEntries(m) };
}

test('mandalas are the same for the same seed and differ between seeds', () => {
  for (const tier of Object.keys(MANDALA_TIERS)) {
    const a = makeMandala(tier, 42);
    const b = makeMandala(tier, 42);
    assert.deepEqual(a, b, `${tier}: not deterministic`);
    const shapes = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((s) => makeMandala(tier, 1000 + s).regions.map((r) => r.d).join('')));
    assert.ok(shapes.size >= 7, `${tier}: seeds give too few different mandalas`);
  }
  const r = rng(7);
  const xs = Array.from({ length: 1000 }, r);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('every mandala region is a closed path with a unique id; counts stay inside the tier bounds', () => {
  for (const [tier, spec] of Object.entries(MANDALA_TIERS)) {
    for (let seed = 1; seed <= 300; seed++) {
      const m = makeMandala(tier, seed * 7919);
      const ids = new Set();
      for (const reg of m.regions) {
        assert.ok(closed(reg.d), `${tier}/${seed}: ${reg.id} is not a closed path`);
        assert.ok(!ids.has(reg.id), `${tier}/${seed}: duplicate id ${reg.id}`);
        ids.add(reg.id);
        assert.ok(!/NaN|Infinity/.test(reg.d), `${tier}/${seed}: ${reg.id} has a bad number`);
      }
      const [lo, hi] = spec.regions;
      assert.ok(m.regions.length >= lo && m.regions.length <= hi, `${tier}/${seed}: ${m.regions.length} regions, expected ${lo}..${hi}`);
      assert.ok(spec.folds.includes(m.folds));
    }
  }
});

test('mandala symmetry groups: every copy of a shape is in its group, one per fold (or two)', () => {
  for (const tier of Object.keys(MANDALA_TIERS)) {
    for (let seed = 1; seed <= 60; seed++) {
      const m = makeMandala(tier, seed);
      const groups = new Map();
      for (const r of m.regions) groups.set(r.g, [...(groups.get(r.g) || []), r.id]);
      for (const [g, ids] of groups) {
        if (g === 'c0' || g === 'c1') assert.equal(ids.length, 1, `${tier}/${seed}: centre ${g}`);
        else assert.equal(ids.length, m.folds, `${tier}/${seed}: group ${g} has ${ids.length} copies, folds ${m.folds}`);
        for (const id of ids) assert.deepEqual(groupOf(m, id).sort(), [...ids].sort());
      }
    }
  }
});

test('pictures: closed regions with unique ids, details on top, from few parts to more', () => {
  assert.ok(PICTURES.length >= 12 && PICTURES.length <= 16, `${PICTURES.length} pictures`);
  assert.equal(FREE_PICTURES, 6);
  const names = new Set();
  for (const p of PICTURES) {
    assert.ok(/^[a-z]+$/.test(p.id) && !names.has(p.id), p.id);
    names.add(p.id);
    const ids = new Set();
    for (const r of p.regions) {
      assert.ok(closed(r.d), `${p.id}/${r.id} not closed: ${r.d}`);
      assert.ok(!ids.has(r.id), `${p.id}: duplicate ${r.id}`);
      ids.add(r.id);
    }
    assert.ok(p.regions.length >= 6 && p.regions.length <= 20, `${p.id}: ${p.regions.length} regions`);
    assert.ok(!/data-r|onclick|<script/i.test(p.deco), `${p.id}: details must not be tappable or scripted`);
  }
  // the free ones are the simplest
  const freeMax = Math.max(...PICTURES.slice(0, FREE_PICTURES).map((p) => p.regions.length));
  const paidMax = Math.max(...PICTURES.slice(FREE_PICTURES).map((p) => p.regions.length));
  assert.ok(freeMax <= paidMax);
});

test('page keys: pictures, the free mandalas and generated ones; anything else is refused', () => {
  assert.equal(LIST_KEYS.length, PICTURES.length + FREE_MANDALAS.length);
  assert.equal(meta.free, FREE_PICTURES + FREE_MANDALAS.length);
  for (const key of LIST_KEYS) assert.ok(pageFor(key), key);
  assert.equal(pageFor(pictureKey('zon')).free, true);
  assert.equal(pageFor(pictureKey(PICTURES[FREE_PICTURES].id)).free, false);
  for (const key of FREE_MANDALA_KEYS) assert.equal(pageFor(key).free, true);
  const gen = pageFor(mandalaKey('m2', 123456789));
  assert.equal(gen.free, false);
  assert.equal(gen.random, true);
  assert.equal(parseKey('f:m1:999'), null, 'a "free" key must be one of the free mandalas');
  for (const bad of ['', 'p:', 'p:nope', 'm:m3:1', 'm:m1:-1', 'm:m1:12345678901', 'x:zon', '__proto__']) assert.equal(parseKey(bad), null, bad);
});

test('a tap colours one region, or all copies of a mandala shape when mirroring', () => {
  const pic = pageFor(pictureKey('zon'));
  assert.deepEqual(targets(pic, 'face', true), ['face']); // pictures never mirror
  assert.deepEqual(targets(pic, 'nope', false), []);
  const m = pageFor(FREE_MANDALA_KEYS[0]);
  const shape = m.regions.find((r) => r.g !== 'c0' && r.g !== 'c1');
  assert.deepEqual(targets(m, shape.id, false), [shape.id]);
  assert.equal(targets(m, shape.id, true).length, m.mandala.folds);
});

test('drawing: saved colours fill their regions, white means empty, only the live page is tappable', () => {
  assert.equal(PALETTE[WHITE], '#ffffff');
  assert.equal(PALETTE.length, 16);
  const pic = pageFor(pictureKey('zon'));
  const live = pageSvg(pic, { face: 2 }, { live: true });
  assert.ok(live.includes(`data-r="face"`) && live.includes(PALETTE[2]));
  assert.equal((live.match(/data-r=/g) || []).length, pic.regions.length);
  const thumb = pageSvg(pic, { face: 99 }); // an unknown colour draws white
  assert.ok(!thumb.includes('data-r'));
  assert.ok(!thumb.includes('undefined'));
});

test('back: a colouring page goes to the list, the list goes home', () => {
  assert.equal(backAction({ screen: 'kleuren' }), 'kleuren-list');
  assert.equal(backAction({ screen: 'kleuren-list' }), 'home');
  assert.equal(backAction({ screen: 'kleuren', overlay: 'card' }), 'close');
});

test('save: pages are kept per key, an empty page is dropped, at most 30 generated mandalas', async () => {
  const prefs = fakePreferences();
  await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: null });
  store.saveArt(meta.id, 'p:zon', { f: { face: 2, ray0: 1, bad: -1, worse: 'x' }, t: 10 });
  assert.deepEqual(store.loadArt(meta.id)['p:zon'], { f: { face: 2, ray0: 1 }, t: 10, done: false });
  store.saveArt(meta.id, 'p:zon', { f: {}, t: 11 });
  assert.equal(store.loadArt(meta.id)['p:zon'], undefined, 'an empty, unfinished page is removed');
  store.saveArt(meta.id, 'p:vis', { f: {}, done: true, t: 12 });
  assert.equal(store.loadArt(meta.id)['p:vis'].done, true, 'a finished page stays, even blank');
  store.saveArt(meta.id, 'f:m1:1101', { f: { c0: 1 }, t: 1 });
  for (let i = 0; i < 40; i++) store.saveArt(meta.id, `m:m1:${i}`, { f: { c0: 3 }, t: 100 + i });
  const art = store.loadArt(meta.id);
  const generated = Object.keys(art).filter((k) => k.startsWith('m:'));
  assert.equal(generated.length, store.ART_KEEP);
  assert.ok(!art['m:m1:0'] && art['m:m1:39'], 'the oldest generated ones go first');
  assert.ok(art['f:m1:1101'] && art['p:vis'], 'pictures and the free mandalas are always kept');
  assert.throws(() => store.saveGameOption(meta.id, 'art', {}));
  assert.equal(store.loadGameOption(meta.id, 'art', 'none'), 'none');
  await store.flushed();
  const saved = JSON.parse(prefs.dump()[store.SAVE_KEY]);
  assert.equal(Object.keys(saved.games.kleuren.art).length, store.ART_KEEP + 2);
});

test('save: after a failed read, the newer version of each page wins when the save is read again', async () => {
  const real = JSON.stringify({
    version: 1,
    games: { kleuren: { art: { 'p:zon': { f: { face: 1 }, t: 50, done: true }, 'p:vis': { f: { body: 4 }, t: 500, done: false } } }, bubbels: { stars: { 1: 3 } } },
    settings: { muted: false, lang: null },
    purchase: { owned: false },
  });
  const prefs = fakePreferences({ [store.SAVE_KEY]: real });
  let broken = true;
  const backend = store.preferencesBackend({ get: async (a) => (broken ? Promise.reject(new Error('bridge')) : prefs.get(a)), set: prefs.set });
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await store.init({ backend, legacyStorage: null, retryDelayMs: 0 }), 'read-failed');
    store.saveArt(meta.id, 'p:zon', { f: { face: 7 }, t: 100 }); // newer than the stored one
    store.saveArt(meta.id, 'p:vis', { f: { body: 9 }, t: 200 }); // older than the stored one
    store.saveArt(meta.id, 'p:huis', { f: { roof: 0 }, t: 300 }); // only in the session
    broken = false;
    store.retryFailedWrite();
    assert.equal(await store.adopted(), true);
    await store.flushed();
    const art = JSON.parse(prefs.dump()[store.SAVE_KEY]).games.kleuren.art;
    assert.deepEqual(art['p:zon'].f, { face: 7 });
    assert.deepEqual(art['p:vis'].f, { body: 4 });
    assert.deepEqual(art['p:huis'].f, { roof: 0 });
    assert.deepEqual(JSON.parse(prefs.dump()[store.SAVE_KEY]).games.bubbels.stars, { 1: 3 });
  } finally {
    console.warn = warn;
  }
});
