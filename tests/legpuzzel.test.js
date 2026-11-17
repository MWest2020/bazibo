import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIZES, SIZE_IDS, RETIRED_SIZES, DEFAULT_SIZE, knownSize, piecesOf, makeEdges, sidesOf, piecePath, margin, layout, scatter, home, snaps, isComplete, rearrange, mulberry32, TAB, SNAP, zoomFor, clampPan, zoomAround, ZOOM_FROM, ZOOM_MAX } from '../web/games/legpuzzel/rules.js';
import { PICTURES, PICTURE_IDS, pictureSvg } from '../web/games/legpuzzel/pictures.js';
import { meta } from '../web/games/legpuzzel/meta.js';

const nums = (d) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

test('six sizes, from 9 pieces for a three-year-old to 60 for a nine-year-old (Mark, 17 Nov 2026)', () => {
  assert.deepEqual(SIZE_IDS.map(piecesOf), [9, 16, 25, 30, 48, 60]);
  assert.deepEqual(SIZE_IDS.map((id) => SIZES[id].age), [3, 4, 5, 6, 7, 9]);
  assert.deepEqual(SIZE_IDS.map((id) => [SIZES[id].cols, SIZES[id].rows]), [[3, 3], [4, 4], [5, 5], [6, 5], [8, 6], [10, 6]]);
  // nothing for two-year-olds any more
  assert.ok(SIZE_IDS.every((id) => SIZES[id].age >= 3));
});

test('a saved last size that left the menu falls back to 9 pieces; the sizes in it stay', () => {
  assert.equal(DEFAULT_SIZE, 'p9');
  for (const id of RETIRED_SIZES) {
    assert.ok(!SIZE_IDS.includes(id), id);
    assert.equal(knownSize(id), 'p9');
  }
  for (const id of SIZE_IDS) assert.equal(knownSize(id), id);
  for (const junk of [undefined, null, '', 'p100', 42]) assert.equal(knownSize(junk), 'p9');
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
      // a piece with its tabs is a finger-sized target; only 60 pieces on a very short screen are
      // smaller, and there the magnifier makes them big again
      const z = zoomFor(s);
      assert.ok(s + 2 * m >= 44 || (s + 2 * m >= 36 && (s + 2 * m) * z >= 60), `${id} on ${w}×${h}: a piece is only ${s + 2 * m}px (${z}× with the magnifier)`);
    }
  }
  // the stages of real phones (measured: 390×844 both ways, 360×640, 320×568 both ways): 44 px without the magnifier
  for (const [w, h] of [[366, 724], [730, 357], [336, 520], [296, 448], [454, 287]])
    for (const id of SIZE_IDS) {
      const l = layout(w, h, SIZES[id].cols, SIZES[id].rows);
      assert.ok(l.s + 2 * l.m >= 44, `${id} on ${w}×${h}: ${l.s + 2 * l.m}px`);
    }
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
  // 48 and 60 pieces on a phone (390×844 upright and sideways): offered; up to 30 pieces: not
  for (const [w, h] of [[366, 724], [730, 357]]) {
    for (const id of ['p48', 'p60']) assert.ok(zoomFor(layout(w, h, SIZES[id].cols, SIZES[id].rows).s) > 1, `${id} ${w}×${h}`);
    for (const id of ['p9', 'p16', 'p25', 'p30']) assert.equal(zoomFor(layout(w, h, SIZES[id].cols, SIZES[id].rows).s), 1, `${id} ${w}×${h}`);
  }
  // 9 and 16 pieces never need it, not even at 320×568 (upright and sideways); 25 there does
  // (pieces of 45 px), so the magnifier is offered, off until the child turns it on
  for (const [w, h] of [[296, 448], [454, 287]]) {
    for (const id of ['p9', 'p16']) assert.equal(zoomFor(layout(w, h, SIZES[id].cols, SIZES[id].rows).s), 1, `${id} ${w}×${h}`);
    assert.ok(zoomFor(layout(w, h, 5, 5).s) > 1, `p25 ${w}×${h}`);
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
    }
  }
  assert.deepEqual(meta.freePictures, ['garden', 'sea', 'fruit']);
});

test('the free part: 9, 16 and 25 pieces with the first three pictures; 30, 48 and 60 in the full version', () => {
  assert.deepEqual(meta.freeSizes, ['p9', 'p16', 'p25']);
  assert.deepEqual(SIZE_IDS.filter((id) => !meta.freeSizes.includes(id)), ['p30', 'p48', 'p60']);
  for (const size of meta.freeSizes) assert.equal(meta.isLocked({ picture: 'fruit', size }, false), false);
  for (const size of ['p30', 'p48', 'p60']) {
    assert.equal(meta.isLocked({ picture: 'garden', size }, false), true);
    assert.equal(meta.isLocked({ picture: 'meadow', size }, true), false);
  }
  assert.equal(meta.group, 'puzzles');
  assert.equal(meta.isLocked({ picture: 'garden', size: 'p9' }, false), false);
  assert.equal(meta.isLocked({ picture: 'space', size: 'p9' }, false), true);
  // a size that left the menu is never free (it cannot be chosen; the hook would get the offer)
  for (const size of RETIRED_SIZES) assert.equal(meta.isLocked({ picture: 'garden', size }, false), true);
  assert.equal(meta.isLocked({ picture: 'space', size: 'p30' }, true), false);
});
