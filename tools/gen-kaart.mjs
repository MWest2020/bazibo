#!/usr/bin/env node
// Kaartpuzzel's map packs: reads Natural Earth GeoJSON (public domain, https://www.naturalearthdata.com;
// the files of github.com/nvkelso/natural-earth-vector at commit ca96624, release v5.1.2), projects,
// clips and simplifies it (our own Douglas-Peucker) and writes one small ES module per pack to
// web/games/kaart/packs/<id>.js. The raw files are not committed; to rebuild:
//
//   C=ca96624a56bd078437bca8184e78163e5039ad19
//   for f in ne_10m_admin_0_countries_nld ne_50m_admin_0_countries ne_50m_admin_0_map_units \
//            ne_110m_admin_0_countries ne_10m_admin_1_states_provinces ne_50m_admin_1_states_provinces \
//            ne_10m_populated_places_simple ne_10m_lakes; do
//     curl -sSLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/$C/geojson/$f.geojson
//   done
//   node tools/gen-kaart.mjs <that folder>
//
// Region names: Natural Earth's NAME_NL/NAME_EN where they are right, checked by hand; the hand-made
// ones are in the tables below. A pack: { id, w, h, bg?, regions: [{ id, nl, en, d, c, a }],
// points: { kind: 'city' | 'sea', list: [{ id, nl, en, at: [[x, y], ...], region? }] } }, where `d`
// is an SVG path (absolute M, relative l, z; even-odd), `c` a point well inside the region (its
// label and hit point), `a` its area in viewBox units.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = process.argv[2];
if (!SRC) {
  console.error('usage: node tools/gen-kaart.mjs <folder with the Natural Earth geojson files>');
  process.exit(2);
}
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'games', 'kaart', 'packs');
const cache = new Map();
function load(name) {
  if (!cache.has(name)) cache.set(name, JSON.parse(fs.readFileSync(path.join(SRC, `${name}.geojson`), 'utf8')).features);
  return cache.get(name);
}
/** Every ring of a (Multi)Polygon as [[lon, lat], ...] (holes too: the paths are filled even-odd). */
const ringsOf = (g) => (g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []).map((r) => r.slice(0, -1));

// ---------- projections (y grows downwards) ----------
const RAD = Math.PI / 180;
function naturalEarth([lon, lat]) {
  const l = lon * RAD;
  const p = lat * RAD;
  const p2 = p * p;
  const p4 = p2 * p2;
  return [l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))), -p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))];
}
function laea(lon0, lat0) {
  const s0 = Math.sin(lat0 * RAD);
  const c0 = Math.cos(lat0 * RAD);
  return ([lon, lat]) => {
    const l = (lon - lon0) * RAD;
    const p = lat * RAD;
    const k = Math.sqrt(2 / (1 + s0 * Math.sin(p) + c0 * Math.cos(p) * Math.cos(l)));
    return [k * Math.cos(p) * Math.sin(l), -k * (c0 * Math.sin(p) - s0 * Math.cos(p) * Math.cos(l))];
  };
}
function albers(lon0, lat0, lat1, lat2) {
  const n = (Math.sin(lat1 * RAD) + Math.sin(lat2 * RAD)) / 2;
  const C = Math.cos(lat1 * RAD) ** 2 + 2 * n * Math.sin(lat1 * RAD);
  const r0 = Math.sqrt(C - 2 * n * Math.sin(lat0 * RAD)) / n;
  return ([lon, lat]) => {
    const r = Math.sqrt(C - 2 * n * Math.sin(lat * RAD)) / n;
    const th = n * (lon - lon0) * RAD;
    return [r * Math.sin(th), -(r0 - r * Math.cos(th))];
  };
}
const plate = (lat0) => ([lon, lat]) => [lon * Math.cos(lat0 * RAD), -lat];

// ---------- geometry ----------
function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
}
function bboxOf(rings) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of rings) for (const [x, y] of r) {
    if (x < b[0]) b[0] = x;
    if (y < b[1]) b[1] = y;
    if (x > b[2]) b[2] = x;
    if (y > b[3]) b[3] = y;
  }
  return b;
}
/** Sutherland-Hodgman against one half-plane: keep points where f(p) >= 0. */
function clipHalf(ring, f) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
function clipRect(ring, [x0, y0, x1, y1]) {
  let r = ring;
  for (const f of [(p) => p[0] - x0, (p) => x1 - p[0], (p) => p[1] - y0, (p) => y1 - p[1]]) {
    if (r.length < 3) return [];
    r = clipHalf(r, f);
  }
  return r.length >= 3 ? r : [];
}
/** Points along a ring at most `step` apart (lon/lat), so a cut along a meridian curves when projected. */
function densify(ring, step = 1) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
    for (let k = 1; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
/**
 * Dissolve: the outline of a set of rings that share their borders vertex for vertex (Natural
 * Earth's countries do): every edge that occurs both ways is an inner border and goes; the rest is
 * chained into rings.
 */
function dissolve(rings) {
  const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
  const edges = new Map();
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i];
      const b = r[(i + 1) % r.length];
      const ka = key(a);
      const kb = key(b);
      if (ka === kb) continue;
      const back = `${kb}>${ka}`;
      if (edges.get(back)?.n) {
        const e = edges.get(back);
        if (--e.n === 0) edges.delete(back);
        continue;
      }
      const k = `${ka}>${kb}`;
      const e = edges.get(k);
      if (e) e.n++;
      else edges.set(k, { a, b, ka, kb, n: 1 });
    }
  }
  const from = new Map();
  for (const e of edges.values()) for (let i = 0; i < e.n; i++) {
    if (!from.has(e.ka)) from.set(e.ka, []);
    from.get(e.ka).push(e);
  }
  const out = [];
  for (const list of from.values()) {
    while (list.length) {
      const first = list.pop();
      const ring = [first.a];
      let cur = first;
      for (let guard = 0; guard < 1e6 && cur.kb !== first.ka; guard++) {
        const next = from.get(cur.kb)?.pop();
        if (!next) break;
        ring.push(next.a);
        cur = next;
      }
      if (ring.length >= 3) out.push(ring);
    }
  }
  return out;
}
/**
 * A region minus some water (the IJsselmeer), robustly: drawn on a grid of `res` cells a unit
 * (pixel centres inside the region and outside every hole), then the grid's outline traced back into
 * rings (the cell edges between in and out, chained). Shared borders stay shared: neighbouring
 * regions take complementary cells.
 */
function rasterSubtract(rings, holes, res = 3) {
  const [bx0, by0, bx1, by1] = bboxOf(rings);
  const x0 = Math.floor(bx0 * res) - 1;
  const y0 = Math.floor(by0 * res) - 1;
  const W = Math.ceil(bx1 * res) - x0 + 2;
  const H = Math.ceil(by1 * res) - y0 + 2;
  const grid = new Uint8Array(W * H);
  const fill = (rs, v) => {
    for (let j = 0; j < H; j++) {
      const y = (y0 + j + 0.5) / res;
      const xs = [];
      for (const r of rs) {
        for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
          const [ax, ay] = r[k];
          const [bx, by] = r[i];
          if (ay > y !== by > y) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      xs.sort((a, b) => a - b);
      for (let n = 0; n + 1 < xs.length; n += 2) {
        const from = Math.max(0, Math.ceil(xs[n] * res - 0.5) - x0);
        const to = Math.min(W - 1, Math.floor(xs[n + 1] * res - 0.5) - x0);
        for (let i = from; i <= to; i++) grid[j * W + i] = v;
      }
    }
  };
  fill(rings, 1);
  fill(holes, 0);
  const on = (i, j) => i >= 0 && j >= 0 && i < W && j < H && grid[j * W + i] === 1;
  // boundary edges between corners (i, j), the region on the left going round clockwise on screen
  // (a corner can start two edges where cells touch diagonally: both are kept)
  const next = new Map();
  const add = (ax, ay, bx, by) => {
    const k = ay * (W + 1) + ax;
    if (!next.has(k)) next.set(k, []);
    next.get(k).push([bx, by, ax, ay]);
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!on(i, j)) continue;
    if (!on(i, j - 1)) add(i, j, i + 1, j);
    if (!on(i + 1, j)) add(i + 1, j, i + 1, j + 1);
    if (!on(i, j + 1)) add(i + 1, j + 1, i, j + 1);
    if (!on(i - 1, j)) add(i, j + 1, i, j);
  }
  const out = [];
  for (const k0 of [...next.keys()]) {
    while (next.get(k0)?.length) {
      const ring = [];
      let k = k0;
      for (let guard = 0; guard < 1e7; guard++) {
        const list = next.get(k);
        if (!list?.length) break;
        const [bx, by, ax, ay] = list.pop();
        ring.push([(ax + x0) / res, (ay + y0) / res]);
        k = by * (W + 1) + bx;
        if (k === k0 && !next.get(k0)?.length) break;
      }
      if (ring.length >= 4) out.push(ring);
    }
  }
  return out;
}
/** Douglas-Peucker on a closed ring (tolerance in output units). */
function simplify(ring, tol) {
  const n = ring.length;
  if (n <= 4) return ring;
  // split at the point farthest from the first one
  let far = 0;
  let fd = -1;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > fd) {
      fd = d;
      far = i;
    }
  }
  const keep = new Uint8Array(n + 1);
  keep[0] = keep[far] = keep[n] = 1;
  const pt = (i) => ring[i % n];
  const stack = [[0, far], [far, n]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [ax, ay] = pt(s);
    const [bx, by] = pt(e);
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let md = -1;
    let mi = -1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = pt(i);
      const d = Math.abs(dy * (px - ax) - dx * (py - ay)) / len;
      if (d > md) {
        md = d;
        mi = i;
      }
    }
    if (md > tol && mi > 0) {
      keep[mi] = 1;
      stack.push([s, mi], [mi, e]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(ring[i]);
  return out;
}
/** Ints (in tenths when `dec`), no repeated points, at least 3 points. */
function quantize(ring, q) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [Math.round(x * q) / q, Math.round(y * q) / q];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  while (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  return out.length >= 3 && Math.abs(ringArea(out)) > 0 ? out : null;
}
function encode(rings, q) {
  const num = (v) => {
    const s = String(Math.round(v * q) / q);
    return s.replace(/^(-?)0\./, '$1.');
  };
  const pair = (x, y, first) => {
    const a = num(x);
    const b = num(y);
    return `${first || a.startsWith('-') ? '' : ' '}${a}${b.startsWith('-') ? '' : ' '}${b}`;
  };
  let d = '';
  for (const r of rings) {
    d += `M${pair(r[0][0], r[0][1], true)}l`;
    let first = true;
    for (let i = 1; i < r.length; i++) {
      d += pair(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1], first);
      first = false;
    }
    d += 'z';
  }
  return d;
}
function inside(rings, x, y) {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}
function edgeDist(rings, x, y) {
  let m = Infinity;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [ax, ay] = r[j];
      const [bx, by] = r[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      m = Math.min(m, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
  }
  return m;
}
/** A point well inside: on the biggest ring, the grid point farthest from every edge, refined. */
function labelPoint(rings) {
  const big = rings.reduce((a, r) => (Math.abs(ringArea(r)) > Math.abs(ringArea(a)) ? r : a));
  let [x0, y0, x1, y1] = bboxOf([big]);
  let best = null;
  for (let pass = 0; pass < 4; pass++) {
    const N = 24;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const x = x0 + ((x1 - x0) * i) / N;
      const y = y0 + ((y1 - y0) * j) / N;
      if (!inside(rings, x, y) || !inside([big], x, y)) continue;
      const d = edgeDist(rings, x, y);
      if (!best || d > best.d) best = { x, y, d };
    }
    if (!best) break;
    const sx = (x1 - x0) / 8;
    const sy = (y1 - y0) / 8;
    [x0, y0, x1, y1] = [best.x - sx, best.y - sy, best.x + sx, best.y + sy];
  }
  if (!best) best = { x: big[0][0], y: big[0][1] };
  return [Math.round(best.x * 10) / 10, Math.round(best.y * 10) / 10];
}

// ---------- building a pack ----------
/**
 * regions: [{ id, nl, en, rings (lon/lat), proj? }]; frame: a box in projected units to clip to
 * (or null); w: the viewBox width; tol: simplification in viewBox units; minArea: smaller islands
 * go (the biggest ring of a region always stays); bg: rings of the land around (grey, no region).
 */
function buildPack({ id, regions, proj, frame = null, w = 1000, tol = 0.7, minArea = 1.5, q = 1, bg = [], points = null, pad = 6, place = null, water = [] }) {
  const projected = regions.map((r) => ({ ...r, prings: r.rings.map((ring) => ring.map(r.proj || proj)) }));
  for (const r of projected) if (place?.[r.id]) r.prings = place[r.id](r.prings);
  const all = projected.flatMap((r) => r.prings);
  const box = frame || bboxOf(all);
  const s = (w - 2 * pad) / (box[2] - box[0]);
  const h = Math.round((box[3] - box[1]) * s + 2 * pad);
  const tf = ([x, y]) => [(x - box[0]) * s + pad, (y - box[1]) * s + pad];
  const wet = water.map((r) => r.map(proj).map(tf));
  const shape = (rings, t, min) => {
    const clipped = frame ? rings.map((r) => clipRect(r, box)).filter((r) => r.length) : rings;
    let px = clipped.map((r) => r.map(tf));
    if (wet.length) px = rasterSubtract(px, wet);
    const areas = px.map((r) => Math.abs(ringArea(r)));
    const biggest = areas.indexOf(Math.max(...areas));
    return px
      .map((r, i) => (i === biggest || areas[i] >= min ? quantize(simplify(r, t), q) : null))
      .filter(Boolean);
  };
  const out = { id, w, h, regions: [] };
  if (bg.length) {
    const rings = shape(bg.map((r) => r.map(proj)), tol * 1.6, minArea * 3);
    out.bg = encode(rings, q);
  }
  for (const r of projected) {
    const rings = shape(r.prings, tol, minArea);
    if (!rings.length) throw new Error(`${id}: ${r.id} has no shape left`);
    const a = Math.round(rings.reduce((t, x) => t + Math.abs(ringArea(x)), 0));
    out.regions.push({ id: r.id, nl: r.nl, en: r.en, d: encode(rings, q), c: labelPoint(rings), a });
  }
  if (points) {
    out.points = {
      kind: points.kind,
      list: points.list.map((p) => {
        const at = p.at.map((ll) => tf((p.proj || proj)(ll)).map((v) => Math.round(v * 10) / 10));
        for (const [x, y] of at) if (x < 0 || y < 0 || x > w || y > h) throw new Error(`${id}: point ${p.id} off the map`);
        return { id: p.id, nl: p.nl, en: p.en, at, ...(p.region ? { region: p.region } : {}) };
      }),
    };
  }
  return out;
}

function write(pack, note) {
  fs.mkdirSync(OUT, { recursive: true });
  const lines = [
    `// Kaartpuzzel map pack "${pack.id}": ${note}`,
    '// Generated by tools/gen-kaart.mjs from Natural Earth (public domain, https://www.naturalearthdata.com).',
    '// Do not edit by hand: change the tool and run it again.',
    'export default {',
    `  id: ${JSON.stringify(pack.id)},`,
    `  w: ${pack.w},`,
    `  h: ${pack.h},`,
  ];
  if (pack.bg) lines.push(`  bg: ${JSON.stringify(pack.bg)},`);
  lines.push('  regions: [');
  for (const r of pack.regions) lines.push(`    ${JSON.stringify(r)},`);
  lines.push('  ],');
  if (pack.points) {
    lines.push(`  points: { kind: ${JSON.stringify(pack.points.kind)}, list: [`);
    for (const p of pack.points.list) lines.push(`    ${JSON.stringify(p)},`);
    lines.push('  ] },');
  }
  lines.push('};', '');
  const file = path.join(OUT, `${pack.id}.js`);
  fs.writeFileSync(file, lines.join('\n'));
  console.log(`${pack.id}: ${pack.regions.length} regions, ${pack.points?.list.length || 0} points, ${fs.statSync(file).size} bytes`);
}

const places = () => load('ne_10m_populated_places_simple');
function city(name, adm0, nl = name, en = name, region) {
  const f = places().find((p) => p.properties.adm0_a3 === adm0 && (p.properties.name === name || p.properties.nameascii === name));
  if (!f) throw new Error(`no place ${name} in ${adm0}`);
  return { id: en.toLowerCase().replace(/[^a-z]+/g, '-'), nl, en, at: [[f.properties.longitude, f.properties.latitude]], region };
}

// ---------- the continents (and the oceans as labels) ----------
{
  const NAMES = {
    eu: ['Europa', 'Europe'],
    as: ['Azië', 'Asia'],
    af: ['Afrika', 'Africa'],
    na: ['Noord-Amerika', 'North America'],
    sa: ['Zuid-Amerika', 'South America'],
    oc: ['Oceanië', 'Oceania'],
    an: ['Antarctica', 'Antarctica'],
  };
  const OF = { Europe: 'eu', Asia: 'as', Africa: 'af', 'North America': 'na', 'South America': 'sa', Oceania: 'oc', Antarctica: 'an' };
  const groups = Object.fromEntries(Object.keys(NAMES).map((k) => [k, []]));
  for (const f of load('ne_110m_admin_0_countries')) {
    const k = OF[f.properties.CONTINENT];
    if (!k) continue;
    const rings = ringsOf(f.geometry);
    if (f.properties.ADM0_A3 === 'RUS') {
      // Europe ends at the Urals: Russia west of 60°E is Europe, the rest Asia
      for (const r of rings) {
        if (r.every((p) => p[0] < 0)) continue; // the tip of Chukotka over the date line: a speck on the far left

        const d = densify(r);
        const west = clipHalf(d, (p) => 60 - p[0]);
        const east = clipHalf(d, (p) => p[0] - 60);
        if (west.length >= 3) groups.eu.push(west);
        if (east.length >= 3) groups.as.push(east);
      }
    } else if (k === 'eu') {
      // France's and the Netherlands' rings far from Europe (French Guiana, the Caribbean) are South or North America
      for (const r of rings) groups[r[0][0] < -30 ? (r[0][1] < 12 ? 'sa' : 'na') : 'eu'].push(r);
    } else if (k === 'oc') {
      groups.oc.push(...rings.filter((r) => !r.every((p) => p[0] < -100))); // Fiji's sliver over the date line
    } else groups[k].push(...rings);
  }
  const regions = Object.entries(NAMES).map(([id, [nl, en]]) => ({ id, nl, en, rings: dissolve(groups[id]).map((r) => densify(r, 2)) }));
  const SEAS = [
    ['pacific', 'Grote Oceaan', 'Pacific Ocean', [[-140, 5], [-150, 32], [-118, -28], [165, 22], [172, -28], [-165, -48], [150, 5]]],
    ['atlantic', 'Atlantische Oceaan', 'Atlantic Ocean', [[-38, 28], [-25, 2], [-18, -30], [-45, 48], [-28, -48]]],
    ['indian', 'Indische Oceaan', 'Indian Ocean', [[78, -22], [64, 8], [100, -32], [55, -38]]],
    ['arctic', 'Noordelijke IJszee', 'Arctic Ocean', [[0, 83], [-150, 80], [100, 81], [170, 77], [40, 77]]],
    ['southern', 'Zuidelijke Oceaan', 'Southern Ocean', [[-90, -62], [0, -60], [90, -60], [170, -64], [-40, -60], [140, -58]]],
  ];
  const pack = buildPack({
    id: 'continents',
    regions,
    proj: naturalEarth,
    frame: [-2.76, -1.36, 2.76, 1.3], // the whole world, without the poles
    w: 1000,
    tol: 0.8,
    minArea: 4,
    points: { kind: 'sea', list: SEAS.map(([id, nl, en, at]) => ({ id, nl, en, at })) },
  });
  write(pack, 'the seven continents and the five oceans');
}

// ---------- Europe (the Dutch point of view: Natural Earth's NLD edition) ----------
{
  const countries = load('ne_10m_admin_0_countries_nld');
  // too small to find or to tap on a phone map: drawn as land around, not as a piece
  const TINY = new Set(['VAT', 'SMR', 'MCO', 'LIE', 'AND', 'GIB', 'JEY', 'GGY', 'IMN', 'FRO']);
  const MERGE = { ALD: 'FIN' }; // Åland is part of Finland
  const NL = { BLR: 'Belarus', MDA: 'Moldavië', CZE: 'Tsjechië', MKD: 'Noord-Macedonië', BIH: 'Bosnië en Herzegovina', GBR: 'Verenigd Koninkrijk' };
  const EN = { CZE: 'Czechia', BIH: 'Bosnia and Herzegovina', MKD: 'North Macedonia' };
  const inEurope = (f) => (f.properties.CONTINENT === 'Europe' || f.properties.ADM0_A3 === 'CYP') && !TINY.has(f.properties.ADM0_A3);
  const byId = new Map();
  for (const f of countries.filter(inEurope)) {
    const a3 = MERGE[f.properties.ADM0_A3] || f.properties.ADM0_A3;
    if (!byId.has(a3)) byId.set(a3, { id: a3, nl: NL[a3] || f.properties.NAME_NL, en: EN[a3] || f.properties.NAME_EN, rings: [] });
    byId.get(a3).rings.push(...ringsOf(f.geometry));
  }
  // merged ones take the main country's names
  for (const f of countries) if (MERGE[f.properties.ADM0_A3] && !byId.has(f.properties.ADM0_A3)) void 0;
  const regions = [...byId.values()].sort((a, b) => a.en.localeCompare(b.en));
  const proj = laea(12, 52);
  const corners = [[-24.6, 63.3], [-24, 66.6], [25.8, 71.3], [34.8, 34.5], [-9.6, 36.9], [-10, 52], [44, 57], [44, 47], [26, 34.6], [14.5, 35.7]].map(proj);
  const b = bboxOf([corners]);
  const mx = (b[2] - b[0]) * 0.02;
  const my = (b[3] - b[1]) * 0.02;
  const frame = [b[0] - mx, b[1] - my, b[2] + mx, b[3] + my];
  const bg = countries.filter((f) => !inEurope(f) && !MERGE[f.properties.ADM0_A3]).flatMap((f) => ringsOf(f.geometry)).filter((r) => r.some(([lon, lat]) => lon > -35 && lon < 70 && lat > 25 && lat < 80));
  const CAP = {
    ALB: ['Tirana', 'Tirana', 'Tirana'], AUT: ['Vienna', 'Wenen', 'Vienna'], BEL: ['Brussels', 'Brussel', 'Brussels'], BGR: ['Sofia', 'Sofia', 'Sofia'],
    BIH: ['Sarajevo', 'Sarajevo', 'Sarajevo'], BLR: ['Minsk', 'Minsk', 'Minsk'], CHE: ['Bern', 'Bern', 'Bern'], CYP: ['Nicosia', 'Nicosia', 'Nicosia'],
    CZE: ['Prague', 'Praag', 'Prague'], DEU: ['Berlin', 'Berlijn', 'Berlin'], DNK: ['København', 'Kopenhagen', 'Copenhagen'], ESP: ['Madrid', 'Madrid', 'Madrid'],
    EST: ['Tallinn', 'Tallinn', 'Tallinn'], FIN: ['Helsinki', 'Helsinki', 'Helsinki'], FRA: ['Paris', 'Parijs', 'Paris'], GBR: ['London', 'Londen', 'London'],
    GRC: ['Athens', 'Athene', 'Athens'], HRV: ['Zagreb', 'Zagreb', 'Zagreb'], HUN: ['Budapest', 'Boedapest', 'Budapest'], IRL: ['Dublin', 'Dublin', 'Dublin'],
    ISL: ['Reykjavík', 'Reykjavik', 'Reykjavik'], ITA: ['Rome', 'Rome', 'Rome'], KOS: ['Pristina', 'Pristina', 'Pristina'], LTU: ['Vilnius', 'Vilnius', 'Vilnius'],
    LUX: ['Luxembourg', 'Luxemburg', 'Luxembourg'], LVA: ['Riga', 'Riga', 'Riga'], MDA: ['Chișinău', 'Chisinau', 'Chisinau'], MKD: ['Skopje', 'Skopje', 'Skopje'],
    MLT: ['Valletta', 'Valletta', 'Valletta'], MNE: ['Podgorica', 'Podgorica', 'Podgorica'], NLD: ['Amsterdam', 'Amsterdam', 'Amsterdam'], NOR: ['Oslo', 'Oslo', 'Oslo'],
    POL: ['Warsaw', 'Warschau', 'Warsaw'], PRT: ['Lisbon', 'Lissabon', 'Lisbon'], ROU: ['Bucharest', 'Boekarest', 'Bucharest'], RUS: ['Moscow', 'Moskou', 'Moscow'],
    SRB: ['Belgrade', 'Belgrado', 'Belgrade'], SVK: ['Bratislava', 'Bratislava', 'Bratislava'], SVN: ['Ljubljana', 'Ljubljana', 'Ljubljana'], SWE: ['Stockholm', 'Stockholm', 'Stockholm'],
    UKR: ['Kyiv', 'Kyiv', 'Kyiv'],
  };
  for (const r of regions) if (!CAP[r.id]) throw new Error(`europe: no capital for ${r.id}`);
  const pack = buildPack({
    id: 'europe',
    regions,
    proj,
    frame,
    w: 1000,
    tol: 0.55,
    minArea: 2.5,
    q: 1,
    bg,
    points: { kind: 'city', list: regions.map((r) => city(CAP[r.id][0], r.id, CAP[r.id][1], CAP[r.id][2], r.id)) },
  });
  write(pack, 'the countries of Europe and their capitals');
}

// ---------- the Netherlands: 12 provinces ----------
{
  const NAMES = {
    'NL-GR': ['Groningen', 'Groningen'], 'NL-FR': ['Friesland', 'Friesland'], 'NL-DR': ['Drenthe', 'Drenthe'], 'NL-OV': ['Overijssel', 'Overijssel'],
    'NL-FL': ['Flevoland', 'Flevoland'], 'NL-GE': ['Gelderland', 'Gelderland'], 'NL-UT': ['Utrecht', 'Utrecht'], 'NL-NH': ['Noord-Holland', 'North Holland'],
    'NL-ZH': ['Zuid-Holland', 'South Holland'], 'NL-ZE': ['Zeeland', 'Zeeland'], 'NL-NB': ['Noord-Brabant', 'North Brabant'], 'NL-LI': ['Limburg', 'Limburg'],
  };
  const regions = load('ne_10m_admin_1_states_provinces')
    .filter((f) => f.properties.adm0_a3 === 'NLD' && NAMES[f.properties.iso_3166_2])
    .map((f) => ({ id: f.properties.iso_3166_2.slice(3), nl: NAMES[f.properties.iso_3166_2][0], en: NAMES[f.properties.iso_3166_2][1], rings: ringsOf(f.geometry) }));
  const proj = plate(52.2);
  const frame = (() => {
    const b = bboxOf(regions.flatMap((r) => r.rings).map((r) => r.map(proj)));
    const m = (b[2] - b[0]) * 0.04;
    return [b[0] - m, b[1] - m, b[2] + m, b[3] + m];
  })();
  const bg = load('ne_10m_admin_0_countries_nld').filter((f) => ['BEL', 'DEU'].includes(f.properties.ADM0_A3)).flatMap((f) => ringsOf(f.geometry));
  const CAP = [
    ['Groningen', 'GR'], ['Leeuwarden', 'FR'], ['Assen', 'DR'], ['Zwolle', 'OV'], ['Arnhem', 'GE'], ['Utrecht', 'UT'],
    ['Haarlem', 'NH'], ['The Hague', 'ZH', 'Den Haag', 'The Hague'], ['Middelburg', 'ZE'], ["'s-Hertogenbosch", 'NB', "'s-Hertogenbosch", "'s-Hertogenbosch"], ['Maastricht', 'LI'],
  ];
  const list = CAP.map(([name, region, nl, en]) => {
    const c = city(name, 'NLD', nl || name, en || name, region);
    return { ...c, id: region.toLowerCase() };
  });
  // Lelystad, Flevoland's capital, is not among Natural Earth's places: placed by hand (52.518 N, 5.471 E)
  list.splice(4, 0, { id: 'fl', nl: 'Lelystad', en: 'Lelystad', at: [[5.471, 52.518]], region: 'FL' });
  // the IJsselmeer and the Markermeer are water, as on every Dutch map (the provinces' borders run through them)
  const water = load('ne_10m_lakes').filter((f) => f.properties.name === 'IJsselmeer').flatMap((f) => ringsOf(f.geometry));
  const pack = buildPack({ id: 'nl', regions, proj, frame, w: 1000, tol: 0.7, minArea: 6, bg, water, points: { kind: 'city', list } });
  write(pack, 'the twelve provinces of the Netherlands and their capitals');
}

// ---------- the United States: 50 states, Alaska and Hawaii in boxes ----------
{
  const features = load('ne_50m_admin_1_states_provinces').filter((f) => f.properties.adm0_a3 === 'USA' && f.properties.postal !== 'DC');
  const NL = { CA: 'Californië', HI: 'Hawaï' };
  const lower = albers(-96, 37.5, 29.5, 45.5);
  const ak = albers(-154, 50, 55, 65);
  const hi = albers(-157, 3, 8, 18);
  const unwrap = ([lon, lat]) => [lon > 0 ? lon - 360 : lon, lat];
  const regions = features
    .map((f) => {
      const id = f.properties.postal;
      const name = f.properties.name;
      return { id, nl: NL[id] || name, en: name, rings: ringsOf(f.geometry).map((r) => r.map(unwrap)), proj: id === 'AK' ? ak : id === 'HI' ? hi : lower };
    })
    .sort((a, b) => a.en.localeCompare(b.en));
  // the lower 48 set the frame; Alaska (smaller) and Hawaii go into the empty corner bottom left
  const l48 = bboxOf(regions.filter((r) => r.id !== 'AK' && r.id !== 'HI').flatMap((r) => r.rings.map((x) => x.map(lower))));
  const W = l48[2] - l48[0];
  const H = l48[3] - l48[1];
  const fit = (rings, x0, y0, wMax) => {
    const b = bboxOf(rings);
    const k = wMax / (b[2] - b[0]);
    return rings.map((r) => r.map(([x, y]) => [x0 + (x - b[0]) * k, y0 + (y - b[1]) * k]));
  };
  const place = {
    AK: (rings) => {
      const b = bboxOf(rings);
      const k = (W * 0.24) / (b[2] - b[0]);
      return fit(rings, l48[0], l48[3] - (b[3] - b[1]) * k, W * 0.24);
    },
    HI: (rings) => {
      const b = bboxOf(rings);
      const k = (W * 0.17) / (b[2] - b[0]);
      return fit(rings, l48[0] + W * 0.27, l48[3] - (b[3] - b[1]) * k, W * 0.17);
    },
  };
  // the capitals (Hawaii's and Alaska's moved into their boxes with their state)
  const caps = places().filter((p) => p.properties.adm0_a3 === 'USA' && p.properties.featurecla === 'Admin-1 capital');
  const list = regions.map((r) => {
    const p = caps.find((c) => c.properties.adm1name === r.en);
    if (!p) throw new Error(`us: no capital for ${r.en}`);
    const name = p.properties.name.replace(/^St\.\s+/, 'Saint ');
    return { id: r.id.toLowerCase(), nl: name, en: name, at: [[p.properties.longitude, p.properties.latitude]], region: r.id };
  });
  // project the points like their state (also into the boxes)
  const boxed = (id, ll) => {
    const r = regions.find((x) => x.id === id);
    const pr = r.rings.map((x) => x.map(r.proj));
    const b = bboxOf(pr);
    const pp = place[id] ? place[id]([...pr, [r.proj(ll)]]).pop()[0] : r.proj(ll);
    void b;
    return pp;
  };
  const pack = buildPack({
    id: 'us',
    regions,
    proj: (p) => p,
    frame: null,
    w: 1000,
    tol: 0.55,
    minArea: 3,
    place,
    points: { kind: 'city', list: list.map((p) => ({ ...p, at: [boxed(p.region, unwrap(p.at[0]))] })) },
  });
  write(pack, 'the fifty states of the United States and their capitals');
}

// ---------- the United Kingdom: four nations ----------
{
  const NAMES = { England: ['ENG', 'Engeland', 'England'], Scotland: ['SCT', 'Schotland', 'Scotland'], Wales: ['WLS', 'Wales', 'Wales'], 'Northern Ireland': ['NIR', 'Noord-Ierland', 'Northern Ireland'] };
  const regions = load('ne_50m_admin_0_map_units')
    .filter((f) => f.properties.ADM0_A3 === 'GBR' && NAMES[f.properties.GEOUNIT])
    .map((f) => {
      const [id, nl, en] = NAMES[f.properties.GEOUNIT];
      return { id, nl, en, rings: ringsOf(f.geometry) };
    });
  const proj = plate(54.5);
  const b = bboxOf(regions.flatMap((r) => r.rings).map((r) => r.map(proj)));
  const m = (b[2] - b[0]) * 0.04;
  const frame = [b[0] - m * 2.5, b[1] - m, b[2] + m, b[3] + m];
  const bg = load('ne_50m_admin_0_countries').filter((f) => ['IRL', 'FRA', 'IMN', 'JEY', 'GGY'].includes(f.properties.ADM0_A3)).flatMap((f) => ringsOf(f.geometry));
  const list = [
    city('London', 'GBR', 'Londen', 'London', 'ENG'),
    city('Edinburgh', 'GBR', 'Edinburgh', 'Edinburgh', 'SCT'),
    city('Cardiff', 'GBR', 'Cardiff', 'Cardiff', 'WLS'),
    city('Belfast', 'GBR', 'Belfast', 'Belfast', 'NIR'),
  ];
  const pack = buildPack({ id: 'uk', regions, proj, frame, w: 1000, tol: 0.7, minArea: 5, bg, points: { kind: 'city', list } });
  write(pack, 'the four nations of the United Kingdom and their capitals');
}
