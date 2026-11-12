// The home tile: a little mirrored drawing (six mirror lines) with a star in the middle, drawn by
// the game's own renderer.
import { thumbCanvas } from './render.js';

const ITEMS = [
  { k: 's', c: 9, z: 2, a: 6, pts: [[2048, 1250], [2300, 900], [2048, 560]] },
  { k: 's', c: 7, z: 1, a: 6, pts: [[2048, 1350], [2600, 1300], [3000, 1600], [3150, 2048]] },
  { k: 's', c: 4, z: 2, a: 6, pts: [[2048, 400], [2048, 260]] },
  { k: 's', c: 1, z: 1, a: 6, pts: [[2450, 700], [2750, 500], [2950, 650]] },
  { k: 'p', s: 0, c: 2, z: 2, a: 0, x: 2048, y: 2048 },
];

export function tileCanvas() {
  return thumbCanvas(ITEMS, 92, 'mini-drawing');
}
