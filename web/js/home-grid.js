// The home screen's tile grid: balanced rows in every section (Mark, 27 Nov 2026: "Should be 2*4
// tiles", not 7 and one alone). Pure, so tests/home-grid.test.js can check it; main.js measures the
// screen and sets the result as CSS variables (--cols, --tracks, --tile, --groups-w), style.css
// draws the grid from them.

/** How many tiles of at least `tileMin` px fit side by side in `width` px with `gap` between them. */
export function maxColumns(width, tileMin, gap) {
  return Math.max(1, Math.floor((width + gap) / (tileMin + gap)));
}

/** The columns for `n` tiles when at most `most` fit: as few rows as possible, then as few columns
 *  as fill those rows (8 at 7 → 2 rows of 4, 9 at 7 → 2 rows of 5, 9 at 4 → 3 rows of 3). */
export function columnsFor(n, most) {
  if (n <= 0) return 0;
  const rows = Math.ceil(n / Math.max(1, Math.floor(most)));
  return Math.ceil(n / rows);
}

/** When the last row of `n` tiles in `cols` columns would hold one tile alone (7 in 3 columns:
 *  3, 3, 1), the last cols - 1 rows take one tile less and stand centred (3, 2, 2). Returns the
 *  index of the first tile of each such shorter row; empty when no tile would stand alone. */
export function shortRowStarts(n, cols) {
  if (cols < 2) return [];
  const rows = Math.ceil(n / cols);
  if (rows < 2 || n - (rows - 1) * cols !== 1) return [];
  const short = cols - 1; // rows of cols - 1 tiles: n = (rows - short) * cols + short * (cols - 1)
  const full = rows - short;
  return Array.from({ length: short }, (_, i) => full * cols + i * (cols - 1));
}

/** The whole home: `counts` tiles per section, `width` px for the sections (their padding
 *  included), `tileMin`/`tileMax` px (tileMax Infinity: the tiles fill the row, as on phones),
 *  `gap` between tiles and `pad` inside a section. Every section gets the same width: as wide as
 *  the section with the most columns. At 2 columns (320 px) an odd count still ends in one tile,
 *  centred: 3 columns would be under tileMin. */
export function homeLayout(counts, { width, tileMin, tileMax, gap, pad }) {
  const inner = width - 2 * pad;
  const most = maxColumns(inner, tileMin, gap);
  const fill = !Number.isFinite(tileMax); // phones: a short section keeps the full row's columns, left-aligned as before
  const sections = counts.map((n) => {
    const cols = fill && n < most ? most : columnsFor(n, most);
    return { cols, shortStarts: shortRowStarts(n, cols) };
  });
  const widest = Math.max(1, ...sections.map((s) => s.cols));
  const tile = Math.floor(Math.min(tileMax, (inner - (most - 1) * gap) / most));
  const groupsWidth = Math.min(width, widest * tile + (widest - 1) * gap + 2 * pad);
  return { most, tile, groupsWidth, sections };
}
