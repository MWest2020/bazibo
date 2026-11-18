// Kaartpuzzel's geometry, pure so it can be tested without a screen. A pack's regions are SVG paths
// in the pack's own units (its viewBox, `w` x `h`); this reads them back into rings and answers what
// a tap or a drop means:
//   - `hitRegion`: which region a tap at (x, y) picks: the one under the finger, unless the tap is
//     right at the outline of a small region (smaller than a finger), so Utrecht, Luxembourg or
//     Rhode Island stay tappable on a 320 px phone without stealing taps inside their neighbours;
//     off every region, the nearest small outline or centre within `r`.
//   - `hitPoint`: which capital (the nearest dot within `r`) or which ocean (on the water, the
//     nearest of its anchor points) a tap picks.
//   - `snaps`: does a puzzle piece dropped with its centre at (x, y) go into its place (never as far
//     as half way to another region's centre, at any scale).
// `r` and the snap distance are in pack units: the screen's px divided by the scale it is drawn at.

const shapes = new WeakMap();

/** The rings of a path made by tools/gen-kaart.mjs ("M x y l dx dy ... z", repeated). */
export function parsePath(d) {
  const rings = [];
  const re = /([Mlz])([^Mlz]*)/g;
  let ring = null;
  let x = 0;
  let y = 0;
  for (const [, cmd, args] of d.matchAll(re)) {
    const nums = (args.match(/-?(?:\d+\.?\d*|\.\d+)/g) || []).map(Number);
    if (cmd === 'M') {
      x = nums[0];
      y = nums[1];
      ring = [[x, y]];
      rings.push(ring);
      for (let i = 2; i + 1 < nums.length; i += 2) ring.push([(x = nums[i]), (y = nums[i + 1])]);
    } else if (cmd === 'l') {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        x += nums[i];
        y += nums[i + 1];
        ring.push([x, y]);
      }
    } else ring = null;
  }
  return rings;
}

/** A region's rings, box and size (its longer side), worked out once. */
export function shapeOf(region) {
  let s = shapes.get(region);
  if (!s) {
    const rings = parsePath(region.d);
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const r of rings) for (const [x, y] of r) {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
    s = { rings, box, size: Math.max(box[2] - box[0], box[3] - box[1]) };
    shapes.set(region, s);
  }
  return s;
}

/** Is (x, y) inside these rings (even-odd, like the paths are filled)? */
export function insideRings(rings, x, y) {
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

const dist = (a, x, y) => Math.hypot(a[0] - x, a[1] - y);

/** How far (x, y) is from the nearest edge of these rings. */
export function edgeDistance(rings, x, y) {
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

export const EDGE_SHARE = 0.2; // inside a region, a small neighbour wins only this share of a finger from its outline

/**
 * The region a tap at (x, y) picks, or null (the sea). `r`: a finger's reach in pack units. `among`:
 * only these region ids count (default: all).
 *   - inside a region's path: that region, unless the tap is within EDGE_SHARE * r of a small
 *     region's outline (then the finger was meant for Utrecht, Luxembourg, Rhode Island)
 *   - outside every path (the sea, or a gap): the small region whose outline is nearest within r,
 *     else the nearest centre within r
 */
export function hitRegion(pack, x, y, r, among = null) {
  const regions = among ? pack.regions.filter((g) => among.includes(g.id)) : pack.regions;
  const small = (g) => shapeOf(g).size < 2 * r;
  let inside = null;
  for (const g of regions) {
    const { box, rings } = shapeOf(g);
    if (x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && insideRings(rings, x, y)) {
      inside = g;
      break;
    }
  }
  if (inside && small(inside)) return inside;
  const reach = inside ? r * EDGE_SHARE : r;
  let best = null;
  let bd = Infinity;
  for (const g of regions) {
    if (g === inside || !small(g)) continue;
    const { box, rings } = shapeOf(g);
    if (x < box[0] - reach || x > box[2] + reach || y < box[1] - reach || y > box[3] + reach) continue;
    const d = edgeDistance(rings, x, y);
    if (d <= reach && d < bd) {
      best = g;
      bd = d;
    }
  }
  if (best || inside) return best || inside;
  // just off a coast (or a tiny island): the nearest centre within reach
  for (const g of regions) {
    const d = dist(g.c, x, y);
    if (d <= r && d < bd) {
      best = g;
      bd = d;
    }
  }
  return best;
}

/**
 * The point a tap picks: a capital (the nearest dot within `r`), or an ocean (`sea` packs: on the
 * water, the ocean with the nearest anchor point; on land, none). Returns the point or null.
 */
export function hitPoint(pack, x, y, r) {
  const pts = pack.points?.list || [];
  if (pack.points?.kind === 'sea') {
    const land = pack.regions.some((g) => {
      const { box, rings } = shapeOf(g);
      return x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && insideRings(rings, x, y);
    });
    if (land) return null;
    let best = null;
    let bd = Infinity;
    for (const p of pts) for (const a of p.at) {
      const d = dist(a, x, y);
      if (d < bd) {
        best = p;
        bd = d;
      }
    }
    return best;
  }
  let best = null;
  let bd = Infinity;
  for (const p of pts) {
    const d = dist(p.at[0], x, y);
    if (d <= r && d < bd) {
      best = p;
      bd = d;
    }
  }
  return best;
}

export const SNAP_PX = 30; // a drop this close (screen px) to its place snaps,
export const SNAP_SHARE = 0.3; // or for bigger pieces within this share of their size,
export const SNAP_ROOM = 0.5; // but never more than half way to the next region's centre (no floor beats this)
export const FIDDLY_PX = 16; // a piece that must land closer than this: its puzzle starts with the magnifier on

const room = new WeakMap();
/** How far a region's centre is from the nearest other centre in its pack. */
export function roomOf(pack, region) {
  if (!room.has(region)) {
    let m = Infinity;
    for (const o of pack.regions) if (o !== region) m = Math.min(m, dist(o.c, region.c[0], region.c[1]));
    room.set(region, m);
  }
  return room.get(region);
}

/** How near (pack units) a piece's centre must be dropped to its place, drawn at `scale` px a unit. */
export const snapDistance = (pack, region, scale) => Math.min(Math.max(SNAP_PX / scale, shapeOf(region).size * SNAP_SHARE), roomOf(pack, region) * SNAP_ROOM);

/** Does a round of these pieces, drawn at `scale`, have one that is fiddly to drop (magnifier first)? */
export const fiddly = (pack, ids, scale) => ids.some((id) => snapDistance(pack, pack.regions.find((g) => g.id === id), scale) * scale < FIDDLY_PX);

/**
 * Does a piece dropped with its centre at (x, y) go into its place? Near its own centre, or anywhere
 * inside its own outline (so Massachusetts or Luxembourg can be dropped where they are, not only on
 * one point); never on another region's centre, which lies inside that region.
 */
export const snaps = (pack, region, x, y, scale) => dist(region.c, x, y) <= snapDistance(pack, region, scale) || insideRings(shapeOf(region).rings, x, y);

/**
 * How the whole map fits a box of w x h px with `pad` px around it: { s (px a unit), ox, oy }.
 */
export function fitMap(pack, w, h, pad = 6) {
  const s = Math.max(0.01, Math.min((w - 2 * pad) / pack.w, (h - 2 * pad) / pack.h));
  return { s, ox: (w - pack.w * s) / 2, oy: (h - pack.h * s) / 2 };
}

export const ZOOM_SMALL_PX = 18; // a region drawn smaller than this: the magnifier is offered
export const ZOOM_MAX = 3;
/**
 * How far the magnifier enlarges a map drawn at `s` px a unit: 1 means no magnifier (everything
 * big enough). Only regions in `ids` count (a round's), or all.
 */
export function zoomFor(pack, s, ids = null) {
  const regions = ids ? pack.regions.filter((g) => ids.includes(g.id)) : pack.regions;
  const small = Math.min(...regions.map((g) => shapeOf(g).size * s));
  if (small >= ZOOM_SMALL_PX) return 1;
  return Math.min(ZOOM_MAX, Math.max(1.6, (ZOOM_SMALL_PX * 1.6) / Math.max(small, 1)));
}
