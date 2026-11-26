import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIZES, SIZE_IDS, RETIRED_SIZES, DEFAULT_SIZE, knownSize, piecesOf, makeEdges, sidesOf, piecePath, margin, layout, scatter, home, snaps, isComplete, rearrange, mulberry32, TAB, SNAP, GRAB, zoomFor, clampPan, zoomAround, ZOOM_FROM, ZOOM_MAX } from '../web/games/legpuzzel/rules.js';
import { PICTURES, PICTURE_IDS, pictureSvg } from '../web/games/legpuzzel/pictures.js';
import { meta } from '../web/games/legpuzzel/meta.js';

const nums = (d) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

test('seven sizes, from 9 pieces for a three-year-old to 100 for a nine-year-old (Mark, 26 Nov 2026)', () => {
  assert.deepEqual(SIZE_IDS.map(piecesOf), [9, 25, 36, 48, 60, 80, 100]);
  assert.deepEqual(SIZE_IDS.map((id) => SIZES[id].age), [3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(SIZE_IDS.map((id) => [SIZES[id].cols, SIZES[id].rows]), [[3, 3], [5, 5], [6, 6], [8, 6], [10, 6], [10, 8], [10, 10]]);
  // nothing for two-year-olds, one size per age, and never more than 10 across (a phone's width)
  assert.ok(SIZE_IDS.every((id) => SIZES[id].age >= 3 && SIZES[id].cols <= 10 && SIZES[id].cols >= SIZES[id].rows));
  assert.equal(new Set(SIZE_IDS.map((id) => SIZES[id].age)).size, SIZE_IDS.length);
});

test('a saved last size that left the menu opens on the size that took its place; the sizes in it stay', () => {
  assert.equal(DEFAULT_SIZE, 'p9');
  assert.deepEqual(RETIRED_SIZES, ['p4', 'p6', 'p12', 'p20', 'p16', 'p30']);
  for (const id of RETIRED_SIZES) assert.ok(!SIZE_IDS.includes(id), id);
  // 26 Nov 2026: 16 pieces (4+) opens on 25 (now 4+), 30 pieces on 36, the next step up
  assert.equal(knownSize('p16'), 'p25');
  assert.equal(knownSize('p30'), 'p36');
  // the sizes for two-year-olds (17 Nov 2026) still open on 9
  for (const id of ['p4', 'p6', 'p12', 'p20']) assert.equal(knownSize(id), 'p9');
  for (const id of SIZE_IDS) assert.equal(knownSize(id), id);
  for (const junk of [undefined, null, '', 'p101', 'constructor', 'toString', 42]) assert.equal(knownSize(junk), 'p9');
});

test('neighbouring pieces fit: a tab out on one side is a hole in on the other; the border is straight', () => {
  for (const id of SIZE_IDS) {
    const { cols, rows } = SIZES[id];
    const e = makeEdges(cols, rows, mulberry32(cols * rows));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const s = sidesOf(e, cols, rows, c, r);
        if (r === 0) assert.equal(s.top, 0);
        if (c === 0) assert.equal(s.left, 0);
        if (r === rows - 1) assert.equal(s.bottom, 0);
        if (c === cols - 1) assert.equal(s.right, 0);
        if (c < cols - 1) assert.equal(s.right, -sidesOf(e, cols, rows, c + 1, r).left);
        if (r < rows - 1) assert.equal(s.bottom, -sidesOf(e, cols, rows, c, r + 1).top);
        for (const k of ['top', 'right', 'bottom', 'left']) if ((k === 'top' && r) || (k === 'left' && c) || (k === 'bottom' && r < rows - 1) || (k === 'right' && c < cols - 1)) assert.ok(Math.abs(s[k]) === 1);
      }
  }
});

test('a piece outline stays inside its drawing, and a tab reaches out as far as TAB', () => {
  const s = 60;
  const m = margin(s);
  for (const sides of [
    { top: 0, right: 0, bottom: 0, left: 0 },
    { top: 1, right: 1, bottom: 1, left: 1 },
    { top: -1, right: -1, bottom: -1, left: -1 },
    { top: 1, right: -1, bottom: 0, left: 1 },
  ]) {
    const d = piecePath(sides, s, m);
    assert.match(d, /^M.*Z$/);
    const v = nums(d);
    assert.ok(Math.min(...v) >= 0 && Math.max(...v) <= s + 2 * m, `outside the drawing: ${d}`);
  }
  const out = nums(piecePath({ top: 1, right: 0, bottom: 0, left: 0 }, s, m)).filter((_, i) => i % 2 === 1);
  assert.ok(Math.abs(Math.min(...out) - (m - TAB * s)) < 0.6);
  // every piece size a layout can give (down to the 26 px squares of 100 pieces on a small phone),
  // every combination of sides: the outline stays inside its drawing, the tabs inside the margin
  for (let s2 = 16; s2 <= 150; s2++) {
    const m2 = margin(s2);
    assert.ok(m2 >= TAB * s2, `${s2}: margin ${m2}`);
    for (let k = 0; k < 81; k++) {
      const d = [0, 1, 2, 3].map((j) => (Math.floor(k / 3 ** j) % 3) - 1);
      const v = nums(piecePath({ top: d[0], right: d[1], bottom: d[2], left: d[3] }, s2, m2));
      assert.ok(Math.min(...v) >= 0 && Math.max(...v) <= s2 + 2 * m2, `${s2} ${d}: outside the drawing`);
    }
  }
  const plain = piecePath({ top: 0, right: 0, bottom: 0, left: 0 }, s, m);
  assert.equal(plain, `M${m} ${m}L${m + s} ${m}L${m + s} ${m + s}L${m} ${m + s}L${m} ${m}Z`);
});

test('the layout fits the board and the tray on every screen, with pieces big enough to grab', () => {
  const screens = [[296, 440], [296, 300], [440, 300], [700, 330], [1180, 660], [360, 640]];
  for (const [w, h] of screens) {
    for (const id of SIZE_IDS) {
      const { cols, rows } = SIZES[id];
      const l = layout(w, h, cols, rows);
      assert.ok(l, `no layout for ${id} on ${w}×${h}`);
      const { board, tray, s, m } = l;
      assert.ok(board.x >= -0.01 && board.y >= -0.01 && board.x + board.w <= w + 0.01 && board.y + board.h <= h + 0.01, `${id} ${w}×${h}: board ${JSON.stringify(board)}`);
      assert.ok(tray.x >= -0.01 && tray.y >= -0.01 && tray.x + tray.w <= w + 0.01 && tray.y + tray.h <= h + 0.01, `${id} ${w}×${h}: tray ${JSON.stringify(tray)}`);
      // board and tray never overlap
      assert.ok(tray.x >= board.x + board.w - 0.01 || tray.y >= board.y + board.h - 0.01);
      // a piece with its tabs is a finger-sized target; only 80 and 100 pieces on a screen of
      // 296×300 (no phone's stage is that short: a window, split screen) are smaller, and there the
      // magnifier makes them big again
      const z = zoomFor(s);
      const short = w === 296 && h === 300 && piecesOf(id) >= 80;
      assert.ok(s + 2 * m >= GRAB || (short && (s + 2 * m) * z >= 60), `${id} on ${w}×${h}: a piece is only ${s + 2 * m}px (${z}× with the magnifier)`);
    }
  }
  // the stages of real phones (measured: 390×844 both ways, 360×640, 320×568 both ways): 44 px
  // without the magnifier, also 100 pieces at 320×568 (they overlap more on the tray there)
  for (const [w, h] of [[366, 724], [730, 357], [336, 520], [296, 448], [454, 287]])
    for (const id of SIZE_IDS) {
      const l = layout(w, h, SIZES[id].cols, SIZES[id].rows);
      assert.ok(l.s + 2 * l.m >= GRAB, `${id} on ${w}×${h}: ${l.s + 2 * l.m}px`);
      // the tray still holds at least half of the pieces side by side
      const fit = Math.floor((l.tray.w - 2 * l.m) / l.s) * Math.floor((l.tray.h - 2 * l.m) / l.s);
      assert.ok(fit >= piecesOf(id) * 0.5, `${id} on ${w}×${h}: ${fit} side by side`);
    }
  // a roomy screen keeps the old choice: the pieces as big as the tray allows with little overlap
  assert.equal(layout(366, 724, 10, 10).s, 36);
  assert.equal(layout(300, 600, 2, 2).side, false);
  assert.equal(layout(700, 330, 2, 2).side, true);
});

test('the magnifier: offered only when the pieces are small, and then makes them big', () => {
  assert.equal(zoomFor(ZOOM_FROM), 1);
  assert.equal(zoomFor(120), 1);
  for (let s = 16; s < ZOOM_FROM; s++) {
    const z = zoomFor(s);
    assert.ok(z > 1 && z <= ZOOM_MAX);
    assert.ok(s * z >= Math.min(ZOOM_FROM, 16 * ZOOM_MAX), `${s}px -> ${s * z}`);
  }
  // 48 to 100 pieces on a phone (390×844 upright and sideways): offered; up to 36 pieces: not
  for (const [w, h] of [[366, 724], [730, 357]]) {
    for (const id of ['p48', 'p60', 'p80', 'p100']) assert.ok(zoomFor(layout(w, h, SIZES[id].cols, SIZES[id].rows).s) > 1, `${id} ${w}×${h}`);
    for (const id of ['p9', 'p25', 'p36']) assert.equal(zoomFor(layout(w, h, SIZES[id].cols, SIZES[id].rows).s), 1, `${id} ${w}×${h}`);
  }
  // 9 pieces never need it, not even at 320×568 (upright and sideways); 25 and up there do (pieces
  // of 45 px and less), so the magnifier is offered, off until the child turns it on; 100 pieces
  // there get the most it gives
  for (const [w, h] of [[296, 448], [454, 287]]) {
    assert.equal(zoomFor(layout(w, h, 3, 3).s), 1, `p9 ${w}×${h}`);
    for (const id of SIZE_IDS.slice(1)) assert.ok(zoomFor(layout(w, h, SIZES[id].cols, SIZES[id].rows).s) > 1, `${id} ${w}×${h}`);
    assert.equal(zoomFor(layout(w, h, 10, 10).s), ZOOM_MAX);
  }
  // never on a desktop
  for (const id of SIZE_IDS) assert.equal(zoomFor(layout(1180, 660, SIZES[id].cols, SIZES[id].rows).s), 1);
});

test('the zoomed view never shows past the stage, and zooms around the finger', () => {
  const [w, h] = [300, 600];
  assert.deepEqual(clampPan({ x: 50, y: 20 }, w, h, 2), { x: 0, y: 0 });
  assert.deepEqual(clampPan({ x: -900, y: -900 }, w, h, 2), { x: -300, y: -600 });
  assert.deepEqual(clampPan({ x: -900, y: -900 }, w, h, 1), { x: 0, y: 0 });
  // zooming in around the middle: the stage point under the middle stays there
  const at = zoomAround({ x: 0, y: 0 }, 1, 2, 150, 300, w, h);
  assert.deepEqual(at, { x: -150, y: -300 });
  assert.equal((150 - at.x) / 2, 150);
  // and out again: back to the whole stage
  assert.deepEqual(zoomAround(at, 2, 1, 150, 300, w, h), { x: 0, y: 0 });
});

test('the scattered pieces all lie on the tray, in a shuffled order', () => {
  const rand = mulberry32(4);
  for (const id of SIZE_IDS) {
    const { cols, rows } = SIZES[id];
    const l = layout(296, 440, cols, rows);
    const pos = scatter(piecesOf(id), l.tray, l.s, l.m, rand);
    assert.equal(pos.length, piecesOf(id));
    for (const p of pos) {
      assert.ok(p.x >= l.tray.x - 0.01 && p.y >= l.tray.y - 0.01, JSON.stringify(p));
      assert.ok(p.x + l.s + 2 * l.m <= l.tray.x + l.tray.w + 0.01 && p.y + l.s + 2 * l.m <= l.tray.y + l.tray.h + 0.01, `${id}: ${JSON.stringify(p)} off the tray ${JSON.stringify(l.tray)}`);
    }
  }
  const a = scatter(9, { x: 0, y: 300, w: 300, h: 200 }, 50, 16, mulberry32(1));
  const sorted = a.slice().sort((p, q) => p.y - q.y || p.x - q.x);
  assert.notDeepEqual(a, sorted);
});

test('a piece snaps in only near its own place', () => {
  const board = { x: 10, y: 20, w: 300, h: 200 };
  const s = 100;
  const m = margin(s);
  assert.deepEqual(home(4, 3, board, s, m), { x: 10 + 100 - m, y: 20 + 100 - m });
  const at = home(4, 3, board, s, m);
  assert.equal(snaps(at.x, at.y, at, s), true);
  assert.equal(snaps(at.x + s * SNAP * 0.9, at.y, at, s), true);
  assert.equal(snaps(at.x + s * 0.7, at.y, at, s), false);
  // the place of the piece next to it is not its place
  const next = home(5, 3, board, s, m);
  assert.equal(snaps(next.x, next.y, at, s), false);
});

test('the puzzle is done only when every piece is in its place', () => {
  assert.equal(isComplete([true, true, true, true]), true);
  assert.equal(isComplete([true, false, true, true]), false);
  assert.equal(isComplete([false, false]), false);
  assert.equal(isComplete([]), false);
});

test('a resize keeps the arrangement of the child unless the pieces change size', () => {
  const s = 60;
  const m = margin(s);
  const board = { x: 0, y: 0, w: 120, h: 120 };
  const pos = [{ x: 5, y: 5 }, { x: 40, y: 300 }, { x: 250, y: 410 }, { x: -20, y: 200 }];
  const placed = [true, false, false, false];
  const spread = [0, 1, 2, 3].map((i) => ({ x: i, y: 999 }));
  // a toolbar slides in: the stage is a little shorter, the pieces the same size
  const kept = rearrange({ pos, placed, cols: 2, board, s, m, w: 296, h: 440, resized: false, spread });
  assert.deepEqual(kept[0], home(0, 2, board, s, m)); // placed: on its place
  assert.deepEqual(kept[1], { x: 40, y: 300 }); // left where it was
  assert.deepEqual(kept[2], { x: 296 - s - 2 * m, y: 440 - s - 2 * m }); // moved back inside the stage
  assert.deepEqual(kept[3], { x: 0, y: 200 });
  // the phone turned and the pieces are bigger: spread on the tray again
  const again = rearrange({ pos, placed, cols: 2, board, s, m, w: 600, h: 300, resized: true, spread });
  assert.deepEqual(again.slice(1), spread.slice(1));
  // no positions yet (the first build): spread
  assert.deepEqual(rearrange({ pos: null, placed: [false, false], cols: 2, board, s, m, w: 300, h: 300, resized: false, spread }), spread.slice(0, 2));
});

test('eight pictures, each a whole scene for every board shape; the first three free', () => {
  assert.equal(PICTURES.length, 8);
  assert.equal(new Set(PICTURE_IDS).size, 8);
  for (const id of PICTURE_IDS) {
    for (const id2 of SIZE_IDS) {
      const { cols, rows } = SIZES[id2];
      const svg = pictureSvg(id, cols * 100, rows * 100);
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[\s\S]*<\/svg>$/);
      assert.doesNotMatch(svg, /NaN|undefined|url\(#|\bid="/, `${id} ${id2}`); // no shared ids: it goes into a canvas and the menu
      assert.ok(svg.length > 1500, `${id} looks empty`);
      // cut into its grid: a little detail for every piece (more drawing), still no ids or NaN
      const cut = pictureSvg(id, cols * 40, rows * 40, { cols, rows });
      assert.doesNotMatch(cut, /NaN|undefined|url\(#|\bid="/, `${id} ${id2} cut`);
      assert.ok(cut.length > pictureSvg(id, cols * 40, rows * 40).length + cols * rows * 40, `${id} ${id2}: no details`);
    }
  }
  // the menu's pictures stay as they were: no grid, no details
  assert.equal(pictureSvg('garden', 160, 120), pictureSvg('garden', 160, 120, { cols: 0, rows: 0 }));
  assert.deepEqual(meta.freePictures, ['garden', 'sea', 'fruit']);
});

test('the free part: 9, 25 and 36 pieces with the first three pictures; 48, 60, 80 and 100 in the full version', () => {
  assert.deepEqual(meta.freeSizes, ['p9', 'p25', 'p36']);
  assert.deepEqual(meta.freeSizes, SIZE_IDS.slice(0, 3));
  assert.deepEqual(SIZE_IDS.filter((id) => !meta.freeSizes.includes(id)), ['p48', 'p60', 'p80', 'p100']);
  for (const size of meta.freeSizes) assert.equal(meta.isLocked({ picture: 'fruit', size }, false), false);
  for (const size of ['p48', 'p60', 'p80', 'p100']) {
    assert.equal(meta.isLocked({ picture: 'garden', size }, false), true);
    assert.equal(meta.isLocked({ picture: 'meadow', size }, true), false);
  }
  assert.equal(meta.group, 'puzzles');
  assert.equal(meta.isLocked({ picture: 'garden', size: 'p9' }, false), false);
  assert.equal(meta.isLocked({ picture: 'space', size: 'p9' }, false), true);
  // a size that left the menu is never free (it cannot be chosen; the hook would get the offer)
  for (const size of RETIRED_SIZES) assert.equal(meta.isLocked({ picture: 'garden', size }, false), true);
  assert.equal(meta.isLocked({ picture: 'space', size: 'p100' }, true), false);
});
