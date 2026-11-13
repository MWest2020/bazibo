// Where the squares sit: a spiral on an 8×8 grid, from the start (0) in the bottom-left corner,
// along the edge and inwards, to the end (63) in the middle. Pure, so it can be tested.

export const GRID = 8;

/** The [row, col] of every square 0..63, in order; each next to the one before. */
export function spiral() {
  const out = [];
  let top = 0;
  let bottom = GRID - 1;
  let left = 0;
  let right = GRID - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) out.push([bottom, c]); // along the bottom, to the right
    bottom--;
    for (let r = bottom; r >= top; r--) out.push([r, right]); // up the right side
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) out.push([top, c]); // along the top, to the left
      top++;
    }
    if (left <= right) {
      for (let r = top; r <= bottom; r++) out.push([r, left]); // down the left side
      left++;
    }
  }
  return out;
}

/** Count yourself: the next square to tap after `done` taps along `path`, or -1 when all are done. */
export const nextTap = (path, done) => (done < path.length ? path[done] : -1);
