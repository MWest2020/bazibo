import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { PACKS, PACK_IDS, COUNTRY_IDS, FREE_PACK, defaultCountry, menuPacks, loadPack } from '../web/games/kaart/packs.js';
import { parsePath, shapeOf, insideRings, hitRegion, hitPoint, snaps, snapDistance, fitMap, zoomFor, SNAP_PX } from '../web/games/kaart/map.js';
import { TIER_IDS, TIERS, CHUNK, KINDS, roundsOf, makeRound, roundId, parseRoundId, nextRound, starsFor, chunkSizes, sameNameAsRegion } from '../web/games/kaart/rounds.js';
import { meta } from '../web/games/kaart/meta.js';
import { tileSvg, howSvg } from '../web/games/kaart/art.js';

const packs = Object.fromEntries(await Promise.all(PACK_IDS.map(async (id) => [id, await loadPack(id)])));
const FINGER = 22;
/** The scale a phone of 320 x 568 draws a pack at (the map's box is about 300 x 330 upright). */
const phone = (pack) => fitMap(pack, 300, 330).s;
const desktop = (pack) => fitMap(pack, 900, 560).s;

test('kaart: every pack has its data file, a small one, and the registry matches it', () => {
  let total = 0;
  for (const id of PACK_IDS) {
    const pack = packs[id];
    assert.equal(pack.id, id);
    assert.ok(pack.w > 0 && pack.h > 0, `${id} has no size`);
    const bytes = statSync(new URL(`../web/games/kaart/packs/${id}.js`, import.meta.url)).size;
    assert.ok(bytes < 80_000, `${id} is ${bytes} bytes`);
    total += bytes;
  }
  assert.ok(total < 200_000, `the packs are ${total} bytes together`);
  assert.ok(PACK_IDS.includes(FREE_PACK));
  assert.deepEqual(COUNTRY_IDS, ['nl', 'us', 'uk']);
  for (const p of PACKS) if (p.kind === 'country') assert.ok(p.locales.length, `${p.id} has no locales`);
});

test('kaart: every region has a path, a centre inside it, Dutch and English names, no duplicates', () => {
  for (const pack of Object.values(packs)) {
    const ids = new Set();
    const names = { nl: new Set(), en: new Set() };
    for (const g of pack.regions) {
      assert.match(g.id, /^[A-Za-z]{2,3}$/, `${pack.id}: id ${g.id}`);
      assert.ok(!ids.has(g.id), `${pack.id}: ${g.id} twice`);
      ids.add(g.id);
      for (const l of ['nl', 'en']) {
        assert.equal(typeof g[l], 'string', `${pack.id} ${g.id}: no ${l} name`);
        assert.ok(g[l].trim().length > 1, `${pack.id} ${g.id}: empty ${l} name`);
        assert.ok(!names[l].has(g[l]), `${pack.id}: ${l} name ${g[l]} twice`);
        names[l].add(g[l]);
      }
      const rings = parsePath(g.d);
      assert.ok(rings.length >= 1 && rings.every((r) => r.length >= 3), `${pack.id} ${g.id}: bad path`);
      for (const r of rings) for (const [x, y] of r) assert.ok(x >= -1 && y >= -1 && x <= pack.w + 1 && y <= pack.h + 1, `${pack.id} ${g.id}: (${x}, ${y}) off the map`);
      assert.ok(insideRings(rings, g.c[0], g.c[1]), `${pack.id} ${g.id}: centre ${g.c} not inside`);
      assert.ok(g.a > 0, `${pack.id} ${g.id}: no area`);
    }
  }
});

test('kaart: the shipped packs have the regions and the hand-checked names', () => {
  assert.equal(packs.continents.regions.length, 7);
  assert.deepEqual(packs.continents.regions.map((g) => g.nl).sort(), ['Afrika', 'Antarctica', 'Azië', 'Europa', 'Noord-Amerika', 'Oceanië', 'Zuid-Amerika']);
  assert.equal(packs.continents.points.kind, 'sea');
  assert.deepEqual(packs.continents.points.list.map((p) => p.en).sort(), ['Arctic Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Southern Ocean']);
  assert.deepEqual(packs.nl.regions.map((g) => g.nl).sort(), ['Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg', 'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland']);
  const en = Object.fromEntries(packs.nl.regions.map((g) => [g.nl, g.en]));
  assert.equal(en['Noord-Holland'], 'North Holland');
  assert.equal(en['Zuid-Holland'], 'South Holland');
  assert.equal(en['Noord-Brabant'], 'North Brabant');
  assert.equal(packs.nl.points.list.length, 12);
  assert.ok(packs.nl.points.list.some((p) => p.nl === 'Den Haag' && p.en === 'The Hague' && p.region === 'ZH'));
  assert.ok(packs.nl.points.list.some((p) => p.nl === 'Lelystad' && p.region === 'FL'));
  assert.equal(packs.us.regions.length, 50);
  assert.ok(!packs.us.regions.some((g) => g.id === 'DC'));
  assert.equal(packs.us.regions.find((g) => g.id === 'CA').nl, 'Californië');
  assert.equal(packs.us.points.list.length, 50);
  assert.ok(packs.us.points.list.some((p) => p.en === 'Saint Paul'));
  assert.equal(packs.uk.regions.length, 4);
  assert.deepEqual(packs.uk.regions.map((g) => g.nl).sort(), ['Engeland', 'Noord-Ierland', 'Schotland', 'Wales']);
  const eu = Object.fromEntries(packs.europe.regions.map((g) => [g.id, g]));
  assert.equal(eu.DEU.nl, 'Duitsland');
  assert.equal(eu.BEL.nl, 'België');
  assert.equal(eu.BLR.nl, 'Belarus');
  assert.equal(eu.CZE.en, 'Czechia');
  assert.ok(eu.CYP && eu.UKR && eu.KOS && eu.MLT && eu.LUX, 'Cyprus, Ukraine, Kosovo, Malta and Luxembourg are in Europe');
  for (const tiny of ['VAT', 'SMR', 'MCO', 'LIE', 'AND']) assert.ok(!eu[tiny], `${tiny} is too small to be a piece`);
  assert.equal(packs.europe.points.list.length, packs.europe.regions.length, 'a capital per country');
  assert.ok(packs.europe.points.list.some((p) => p.nl === 'Brussel' && p.en === 'Brussels'));
});

test('kaart: every point is on the map, named, unique and (a capital) in or by its region', () => {
  for (const pack of Object.values(packs)) {
    const ids = new Set();
    for (const p of pack.points.list) {
      assert.ok(!ids.has(p.id), `${pack.id}: point ${p.id} twice`);
      ids.add(p.id);
      assert.ok(p.nl && p.en, `${pack.id} ${p.id}: names`);
      assert.ok(p.at.length >= 1);
      for (const [x, y] of p.at) assert.ok(x >= 0 && y >= 0 && x <= pack.w && y <= pack.h, `${pack.id} ${p.id} off the map`);
      if (pack.points.kind === 'city') {
        const g = pack.regions.find((r) => r.id === p.region);
        assert.ok(g, `${pack.id} ${p.id}: no region ${p.region}`);
        const { box } = shapeOf(g);
        const m = pack.w * 0.01;
        const [x, y] = p.at[0];
        assert.ok(x >= box[0] - m && x <= box[2] + m && y >= box[1] - m && y <= box[3] + m, `${pack.id} ${p.id} is far from ${g.id}`);
      }
    }
  }
});

test('kaart: a tap on a region centre picks that region, on a 320 px phone, zoomed and on desktop', () => {
  for (const pack of Object.values(packs)) {
    const s = phone(pack);
    for (const scale of [s, s * zoomFor(pack, s), desktop(pack)]) {
      const r = FINGER / scale;
      for (const g of pack.regions) assert.equal(hitRegion(pack, g.c[0], g.c[1], r)?.id, g.id, `${pack.id}: the centre of ${g.id} at ${scale.toFixed(2)} px a unit`);
    }
  }
});

test('kaart: a small region is picked a little off its centre; open sea far from land picks nothing', () => {
  const us = packs.us;
  const s = phone(us);
  const r = FINGER / s;
  const ri = us.regions.find((g) => g.id === 'RI');
  assert.ok(shapeOf(ri).size < 2 * r, 'Rhode Island is smaller than a finger on a phone');
  assert.equal(hitRegion(us, ri.c[0] + r * 0.3, ri.c[1] + r * 0.2, r)?.id, 'RI');
  assert.equal(hitRegion(us, 2, 2, FINGER / desktop(us)), null);
  // `among`: only the round's empty places count
  const tx = us.regions.find((g) => g.id === 'TX');
  assert.equal(hitRegion(us, tx.c[0], tx.c[1], r, ['CA', 'NY']), null);
});

test('kaart: a capital tap picks the nearest dot; an ocean tap picks by the water, never on land', () => {
  for (const id of ['nl', 'europe', 'us', 'uk']) {
    const pack = packs[id];
    const r = (FINGER * 1.4) / (phone(pack) * zoomFor(pack, phone(pack)));
    for (const p of pack.points.list) assert.equal(hitPoint(pack, p.at[0][0], p.at[0][1], r)?.id, p.id, `${id}: the dot of ${p.id}`);
  }
  const w = packs.continents;
  for (const p of w.points.list) for (const [x, y] of p.at) assert.equal(hitPoint(w, x, y, 5)?.id, p.id, `continents: ${p.id} at (${x}, ${y})`);
  for (const g of w.regions) assert.equal(hitPoint(w, g.c[0], g.c[1], 5), null, `continents: ${g.id} is land`);
});

test('kaart: a piece snaps near its own place only, never on another region\'s place', () => {
  for (const pack of Object.values(packs)) {
    const s = desktop(pack);
    for (const g of pack.regions) {
      assert.ok(snaps(pack, g, g.c[0], g.c[1], s));
      const d = snapDistance(pack, g, s);
      assert.ok(d >= SNAP_PX / s - 1e-9);
      assert.ok(!snaps(pack, g, g.c[0] + d * 1.01, g.c[1], s), `${pack.id} ${g.id}: snaps too far away`);
      for (const o of pack.regions) {
        if (o === g) continue;
        const near = Math.hypot(o.c[0] - g.c[0], o.c[1] - g.c[1]) <= d;
        if (near) assert.ok(shapeOf(g).size * s < 2 * SNAP_PX || shapeOf(o).size * s < 2 * SNAP_PX, `${pack.id}: ${g.id} snaps on ${o.id}'s place`);
      }
    }
  }
});

test('kaart: the magnifier only where regions are smaller than a finger on a phone', () => {
  assert.equal(zoomFor(packs.continents, phone(packs.continents)), 1);
  assert.equal(zoomFor(packs.nl, phone(packs.nl)), 1);
  assert.ok(zoomFor(packs.us, phone(packs.us)) > 1);
  assert.ok(zoomFor(packs.europe, phone(packs.europe)) > 1);
  for (const pack of Object.values(packs)) assert.equal(zoomFor(pack, desktop(pack) * 4), 1);
});

test('kaart: parsePath reads absolute starts and relative steps', () => {
  assert.deepEqual(parsePath('M10 20l5 0 0 5-5 0zM1 1l2 0 0 2z'), [
    [[10, 20], [15, 20], [15, 25], [10, 25]],
    [[1, 1], [3, 1], [3, 3]],
  ]);
  assert.deepEqual(parsePath('M.5-1l-.5 1.5 1 0z'), [[[0.5, -1], [0, 0.5], [1, 0.5]]]);
});

test('kaart: rounds per tier cover every region (t1 biggest first, t2), then the whole puzzle without lines and every point (t3)', () => {
  assert.deepEqual(chunkSizes(12), [6, 6]);
  assert.deepEqual(chunkSizes(7), [7]);
  assert.deepEqual(chunkSizes(41), [7, 7, 7, 7, 7, 6]);
  assert.deepEqual(chunkSizes(50), [8, 7, 7, 7, 7, 7, 7]);
  for (const pack of Object.values(packs)) {
    const all = pack.regions.map((g) => g.id).sort();
    const t1 = roundsOf(pack, 't1');
    assert.ok(t1.every((r) => r.kind === 'puzzle' && r.lines && r.items.length <= CHUNK));
    assert.deepEqual(t1.flatMap((r) => r.items).sort(), all);
    const area = (id) => pack.regions.find((g) => g.id === id).a;
    for (let k = 1; k < t1.length; k++) assert.ok(area(t1[k - 1].items[0]) >= area(t1[k].items[0]), `${pack.id}: t1 biggest first`);
    const t2 = roundsOf(pack, 't2');
    assert.ok(t2.every((r) => r.kind === 'where' && r.items.length <= CHUNK));
    assert.deepEqual(t2.flatMap((r) => r.items).sort(), all);
    const t3 = roundsOf(pack, 't3');
    assert.equal(t3[0].kind, 'puzzle');
    assert.equal(t3[0].lines, false);
    assert.deepEqual([...t3[0].items].sort(), all);
    assert.ok(t3.slice(1).every((r) => r.kind === 'point' && r.items.length <= CHUNK));
    assert.deepEqual(t3.slice(1).flatMap((r) => r.items).sort(), pack.points.list.map((p) => p.id).sort());
    for (const r of [...t1, ...t2, ...t3]) assert.ok(KINDS.includes(r.kind));
  }
});

test('kaart: a round is its items in a seeded order, the same every time; the first t1 piece is the biggest', () => {
  for (const pack of Object.values(packs)) {
    for (const tier of TIER_IDS) {
      roundsOf(pack, tier).forEach((rd, k) => {
        const a = makeRound(pack, tier, k + 1);
        assert.deepEqual(a, makeRound(pack, tier, k + 1));
        assert.equal(a.kind, rd.kind);
        assert.deepEqual([...a.items].sort(), [...rd.items].sort());
        if (tier === 't1') assert.equal(a.items[0], rd.items[0]);
        for (let seed = 1; seed <= 20; seed++) assert.deepEqual([...makeRound(pack, tier, k + 1, seed).items].sort(), [...rd.items].sort());
      });
      assert.equal(makeRound(pack, tier, roundsOf(pack, tier).length + 1), null);
    }
  }
});

test('kaart: the next round walks through every round of every tier, and round ids round-trip', () => {
  for (const pack of Object.values(packs)) {
    let at = { tier: 't1', r: 1 };
    let n = 0;
    while (at) {
      n++;
      assert.deepEqual(parseRoundId(roundId(pack.id, at.tier, at.r)), { pack: pack.id, ...at });
      at = nextRound(pack, at.tier, at.r);
    }
    assert.equal(n, TIER_IDS.reduce((s, tier) => s + roundsOf(pack, tier).length, 0));
  }
  assert.equal(parseRoundId('nl-t4-1'), null);
  assert.equal(parseRoundId('../x'), null);
  for (const tier of TIER_IDS) assert.match(TIERS[tier].age, /^\d+-\d+$/);
});

test('kaart: stars count mistakes only', () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(1), 2);
  assert.equal(starsFor(2), 2);
  assert.equal(starsFor(3), 1);
  assert.equal(starsFor(40), 1);
});

test('kaart: a capital with the name of its region is asked as "(stad)"', () => {
  const utrecht = packs.nl.points.list.find((p) => p.nl === 'Utrecht');
  assert.ok(sameNameAsRegion(packs.nl, utrecht, 'nl'));
  assert.ok(!sameNameAsRegion(packs.nl, packs.nl.points.list.find((p) => p.nl === 'Zwolle'), 'nl'));
  assert.ok(sameNameAsRegion(packs.europe, packs.europe.points.list.find((p) => p.en === 'Luxembourg'), 'en'));
});

test('kaart: free are the whole Continents pack and tier 1 of every pack; the purchase opens the rest', () => {
  for (const pack of PACK_IDS) {
    for (const tier of TIER_IDS) {
      const free = pack === 'continents' || tier === 't1';
      assert.equal(meta.isLocked({ pack, tier }, false), !free, `${pack} ${tier}`);
      assert.equal(meta.isLocked({ pack, tier }, true), false);
    }
  }
  assert.equal(meta.group, 'learning');
});

test('kaart: the own country follows the device language, and nobody else gets one', () => {
  assert.equal(defaultCountry('nl-NL'), 'nl');
  assert.equal(defaultCountry('nl-BE'), 'nl');
  assert.equal(defaultCountry('nl'), 'nl');
  assert.equal(defaultCountry('en-US'), 'us');
  assert.equal(defaultCountry('en_US'), 'us');
  assert.equal(defaultCountry('en-GB'), 'uk');
  for (const tag of ['en', 'en-AU', 'en-IE', 'de-DE', 'fr', 'fa-IR', '', undefined, null]) assert.equal(defaultCountry(tag), null, String(tag));
  assert.deepEqual(menuPacks('nl'), ['continents', 'europe', 'nl']);
  assert.deepEqual(menuPacks(null), ['continents', 'europe']);
  assert.deepEqual(menuPacks('xx'), ['continents', 'europe']);
});

test('kaart: the drawings are plain SVG without ids', () => {
  for (const svg of [tileSvg(), howSvg()]) {
    assert.match(svg, /^<svg/);
    assert.doesNotMatch(svg, /\sid=|url\(#|<script|href=/);
  }
});
