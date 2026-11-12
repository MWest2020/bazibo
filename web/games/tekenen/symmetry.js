// Mirror mode: n mirror lines through the middle of the page (n = 2, 4, 6 or 8), the first one
// upright, the others at equal angles. A stroke is drawn once for every element of that symmetry
// group (the dihedral group: n turns and n mirrorings), so every stroke becomes a mandala.
// Pure maths, tested in tests/tekenen.test.js.

/** The choices in the game; 0 is "no mirror". */
export const AXES = Object.freeze([2, 4, 6, 8]);

// no float dust and no -0, so equal matrices compare equal
const tidy = (v) => {
  const x = Math.round(v * 1e12) / 1e12;
  return x === 0 ? 0 : x;
};

/** The angles of the n mirror lines (radians from the x axis; the first one is upright). */
export function axisAngles(n) {
  if (!n) return [];
  return Array.from({ length: n }, (_, k) => Math.PI / 2 + (k * Math.PI) / n);
}

/**
 * The 2n linear maps of the group as { a, b, c, d } (x' = a·x + c·y, y' = b·x + d·y, around the
 * middle; the order of canvas transform()). n turns first (the first is "as drawn"), then the n
 * mirror images, one per line. n = 0 gives only "as drawn".
 */
export function transforms(n) {
  if (!n) return [{ a: 1, b: 0, c: 0, d: 1 }];
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = (2 * Math.PI * k) / n;
    out.push({ a: tidy(Math.cos(t)), b: tidy(Math.sin(t)), c: tidy(-Math.sin(t)), d: tidy(Math.cos(t)) });
  }
  for (const th of axisAngles(n)) {
    const c2 = tidy(Math.cos(2 * th));
    const s2 = tidy(Math.sin(2 * th));
    out.push({ a: c2, b: s2, c: s2, d: -c2 || 0 });
  }
  return out;
}

/** One point, relative to the middle, through one map. */
export function apply(m, x, y) {
  return [m.a * x + m.c * y, m.b * x + m.d * y];
}

/** Every copy of a point (x, y) on a page of size `size` with n mirror lines. */
export function copies(x, y, n, size) {
  const h = size / 2;
  return transforms(n).map((m) => {
    const [u, v] = apply(m, x - h, y - h);
    return [u + h, v + h];
  });
}
