import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnsFor, maxColumns, shortRowStarts, homeLayout } from '../web/js/home-grid.js';

test('columns: as few rows as fit, then rows as even as possible', () => {
  assert.equal(columnsFor(8, 7), 4); // Leren on a wide screen: 2 rows of 4, not 7 + 1
  assert.equal(columnsFor(9, 7), 5);
  assert.equal(columnsFor(7, 7), 7);
  assert.equal(columnsFor(3, 7), 3);
  assert.equal(columnsFor(13, 7), 7);
  assert.equal(columnsFor(1, 7), 1);
  assert.equal(columnsFor(1, 1), 1);
  assert.equal(columnsFor(9, 4), 3); // 3 rows of 3 when only 4 fit
  assert.equal(columnsFor(8, 3), 3); // phones: 3, 3, 2 as before
  assert.equal(columnsFor(0, 7), 0);
});

test('max columns: tiles of the minimum width and the gaps between them', () => {
  assert.equal(maxColumns(338, 96, 10), 3); // 390 px phone
  assert.equal(maxColumns(1156, 140, 12), 7); // desktop at the 1180 px cap
  assert.equal(maxColumns(764, 124, 12), 5); // 820 px tablet
  assert.equal(maxColumns(50, 96, 10), 1);
});

test('a tile never stands alone in the last row', () => {
  assert.deepEqual(shortRowStarts(7, 3), [3, 5]); // 3, 2, 2
  assert.deepEqual(shortRowStarts(8, 3), []); // 3, 3, 2
  assert.deepEqual(shortRowStarts(10, 3), [6, 8]); // 3, 3, 2, 2
  assert.deepEqual(shortRowStarts(5, 2), [4]); // 2, 2 and the last one centred
  assert.deepEqual(shortRowStarts(7, 7), []);
  assert.deepEqual(shortRowStarts(1, 1), []);
  for (let n = 1; n <= 30; n++) {
    for (let most = 3; most <= 9; most++) {
      const cols = columnsFor(n, most);
      const starts = shortRowStarts(n, cols);
      // the row lengths: full rows, then the shorter ones (or the plain grid's last row)
      const rows = [];
      if (starts.length) {
        for (let k = 0; k < starts[0] / cols; k++) rows.push(cols);
        for (const _ of starts) rows.push(cols - 1);
      } else {
        for (let i = 0; i < n; i += cols) rows.push(Math.min(cols, n - i));
      }
      assert.equal(rows.reduce((a, b) => a + b, 0), n, `${n} at ${most}: ${rows}`);
      assert.ok(rows.length === 1 || rows.at(-1) > 1 || cols === 2, `${n} at ${most}: ${rows}`);
      assert.ok(cols <= most, `${n} at ${most}: ${cols} columns`);
    }
  }
});

test('every section as wide as the widest, tiles within the minimum and the maximum', () => {
  const counts = [8, 6, 7, 5, 2]; // Leren, Puzzels, Bordspellen, Creatief, Actie
  const desk = homeLayout(counts, { width: 1180, tileMin: 140, tileMax: 140, gap: 12, pad: 12 });
  assert.deepEqual(desk.sections.map((s) => s.cols), [4, 6, 7, 5, 2]);
  assert.equal(desk.tile, 140);
  assert.equal(desk.groupsWidth, 7 * 140 + 6 * 12 + 24);
  const phone = homeLayout(counts, { width: 358, tileMin: 96, tileMax: Infinity, gap: 10, pad: 10 });
  assert.deepEqual(phone.sections.map((s) => s.cols), [3, 3, 3, 3, 3]); // Actie's 2 stay left in a row of 3, as before
  assert.deepEqual(phone.sections[2].shortStarts, [3, 5]); // Bordspellen: 3, 2, 2
  assert.equal(phone.tile, 106);
  assert.ok(phone.groupsWidth <= 358);
  // 320 px: 2 columns; an odd count ends in one centred tile (3 columns would be under the minimum)
  const small = homeLayout(counts, { width: 288, tileMin: 96, tileMax: Infinity, gap: 10, pad: 10 });
  assert.deepEqual(small.sections.map((s) => s.cols), [2, 2, 2, 2, 2]);
  assert.deepEqual(small.sections[2].shortStarts, [6]);
  assert.ok(small.tile >= 96);
});
