// Legpuzzel's pictures: whole scenes drawn in code (SVG), so every piece shows something. Each is a
// background (sky, grass, sea, space, a table cloth …) with the app's own drawings on it: the
// coloured-in Kleurplaten pictures (as Letters uses them), the Picturedoku fruit and the Dogudoku
// puppies, plus a few shapes drawn here (the sun, clouds, a tree, stars, a moon). A scene fills any
// shape of board (`pictureSvg(id, w, h)`), from 1:1 for 4 pieces to 5:3 for 60.
import { wordPictureSvg } from '../letters/art.js';
import { pictureSvg as fruitSvg } from '../picturedoku/art.js';
import { dogSvg } from '../dogudoku/art.js';

const INK = '#3a2f6b';
const n = (v) => Math.round(v * 10) / 10;

/** An existing drawing (a whole <svg>) placed with its centre at (x, y), `s` wide and high. */
function place(svg, x, y, s) {
  return svg.replace(/^<svg\b/, `<svg x="${n(x - s / 2)}" y="${n(y - s / 2)}" width="${n(s)}" height="${n(s)}"`);
}
const pic = (id, x, y, s) => place(wordPictureSvg(id), x, y, s);
const fruit = (v, x, y, s) => place(fruitSvg(v), x, y, s);
const dog = (b, x, y, s) => place(dogSvg(b), x, y, s);

const sun = (x, y, r) =>
  Array.from({ length: 10 }, (_, k) => {
    const a = (k * 36 * Math.PI) / 180;
    return `<path d="M${n(x + Math.cos(a) * r * 1.25)} ${n(y + Math.sin(a) * r * 1.25)}L${n(x + Math.cos(a) * r * 1.6)} ${n(y + Math.sin(a) * r * 1.6)}" stroke="#ffb02e" stroke-width="${n(r * 0.18)}" stroke-linecap="round"/>`;
  }).join('') + `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="#ffd23f" stroke="#f0a020" stroke-width="${n(r * 0.08)}"/>`;
const cloud = (x, y, s) =>
  `<g fill="#fff" opacity=".95"><ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(s * 0.5)}" ry="${n(s * 0.22)}"/><circle cx="${n(x - s * 0.18)}" cy="${n(y - s * 0.12)}" r="${n(s * 0.2)}"/><circle cx="${n(x + s * 0.1)}" cy="${n(y - s * 0.18)}" r="${n(s * 0.26)}"/></g>`;
const tree = (x, y, s) =>
  `<rect x="${n(x - s * 0.07)}" y="${n(y)}" width="${n(s * 0.14)}" height="${n(s * 0.45)}" rx="${n(s * 0.03)}" fill="#a8652f" stroke="${INK}" stroke-width="${n(s * 0.025)}"/>` +
  `<circle cx="${n(x)}" cy="${n(y - s * 0.12)}" r="${n(s * 0.34)}" fill="#4fa457" stroke="${INK}" stroke-width="${n(s * 0.025)}"/>` +
  `<circle cx="${n(x - s * 0.12)}" cy="${n(y - s * 0.22)}" r="${n(s * 0.12)}" fill="#7cc66f"/>` +
  `<circle cx="${n(x + s * 0.14)}" cy="${n(y - s * 0.05)}" r="${n(s * 0.05)}" fill="#ff6b6b"/><circle cx="${n(x - s * 0.1)}" cy="${n(y + s * 0.04)}" r="${n(s * 0.05)}" fill="#ff6b6b"/>`;
const star = (x, y, r, fill = '#fff3a8') => {
  const pts = Array.from({ length: 10 }, (_, k) => {
    const a = ((-90 + k * 36) * Math.PI) / 180;
    const rr = k % 2 ? r * 0.45 : r;
    return `${n(x + Math.cos(a) * rr)} ${n(y + Math.sin(a) * rr)}`;
  });
  return `<path d="M${pts.join('L')}Z" fill="${fill}"/>`;
};
const hill = (w, h, y, fill, dip = 0.06) => `<path d="M0 ${n(h * y)}Q${n(w * 0.3)} ${n(h * (y - dip))} ${n(w * 0.55)} ${n(h * y)}T${n(w)} ${n(h * (y - dip * 0.5))}V${n(h)}H0z" fill="${fill}"/>`;
const sky = (w, h, c = '#bfe6ff') => `<rect width="${n(w)}" height="${n(h)}" fill="${c}"/>`;
const flowers = (w, h, y, k) =>
  Array.from({ length: k }, (_, i) => {
    const x = ((i + 0.5) / k) * w + ((i * 37) % 11) - 5;
    const yy = h * y + ((i * 53) % 17);
    const c = ['#ff7eb6', '#ffd23f', '#ffffff', '#b38cff'][i % 4];
    return `<circle cx="${n(x)}" cy="${n(yy)}" r="${n(Math.min(w, h) * 0.014)}" fill="${c}" stroke="${INK}" stroke-width="1"/>`;
  }).join('');

/** Each scene: draw(w, h) -> the inside of the picture, w × h units. `free`: in the free version. */
const SCENES = [
  {
    id: 'garden',
    free: true,
    draw: (w, h, m = Math.min(w, h)) =>
      sky(w, h) + sun(w * 0.14, h * 0.16, m * 0.08) + cloud(w * 0.62, h * 0.14, m * 0.3) + cloud(w * 0.9, h * 0.26, m * 0.2) +
      hill(w, h, 0.62, '#9ad66f') + flowers(w, h, 0.8, 9) +
      pic('house', w * 0.4, h * 0.5, m * 0.72) + pic('dog', w * 0.8, h * 0.7, m * 0.42) + pic('flower', w * 0.1, h * 0.76, m * 0.3),
  },
  {
    id: 'sea',
    free: true,
    draw: (w, h, m = Math.min(w, h)) =>
      sky(w, h, '#cdeeff') + cloud(w * 0.3, h * 0.12, m * 0.28) + cloud(w * 0.85, h * 0.2, m * 0.22) + // the boat brings its own sun

      `<rect y="${n(h * 0.5)}" width="${n(w)}" height="${n(h * 0.5)}" fill="#4aa8e8"/>` +
      Array.from({ length: 5 }, (_, k) => `<path d="M0 ${n(h * (0.56 + k * 0.09))}q${n(w / 16)} ${n(-h * 0.025)} ${n(w / 8)} 0t${n(w / 8)} 0t${n(w / 8)} 0t${n(w / 8)} 0t${n(w / 8)} 0t${n(w / 8)} 0t${n(w / 8)} 0t${n(w / 8)} 0" fill="none" stroke="#9ad7ff" stroke-width="${n(m * 0.012)}"/>`).join('') +
      pic('boat', w * 0.45, h * 0.42, m * 0.62) + pic('fish', w * 0.2, h * 0.8, m * 0.3) + pic('fish', w * 0.78, h * 0.86, m * 0.24) + pic('bird', w * 0.16, h * 0.3, m * 0.22),
  },
  {
    id: 'fruit',
    free: true,
    draw: (w, h, m = Math.min(w, h)) => {
      const sq = m / 7;
      let cloth = '';
      for (let y = h * 0.45, r = 0; y < h; y += sq, r++) for (let x = 0, c = 0; x < w; x += sq, c++) if ((r + c) % 2 === 0) cloth += `<rect x="${n(x)}" y="${n(y)}" width="${n(sq)}" height="${n(sq)}" fill="#ff8f8f"/>`;
      return (
        `<rect width="${n(w)}" height="${n(h)}" fill="#fff4cf"/>` +
        `<rect y="${n(h * 0.45)}" width="${n(w)}" height="${n(h * 0.55)}" fill="#fff"/>${cloth}` +
        `<rect x="${n(w * 0.08)}" y="${n(h * 0.08)}" width="${n(w * 0.22)}" height="${n(h * 0.26)}" rx="6" fill="#bfe6ff" stroke="#c48a4a" stroke-width="${n(m * 0.02)}"/>` +
        `<ellipse cx="${n(w * 0.5)}" cy="${n(h * 0.72)}" rx="${n(m * 0.42)}" ry="${n(m * 0.16)}" fill="#7cc6fe" stroke="${INK}" stroke-width="${n(m * 0.012)}"/>` +
        fruit(3, w * 0.38, h * 0.52, m * 0.32) + fruit(2, w * 0.6, h * 0.5, m * 0.34) + fruit(1, w * 0.3, h * 0.66, m * 0.3) + fruit(5, w * 0.7, h * 0.64, m * 0.3) +
        fruit(4, w * 0.86, h * 0.88, m * 0.26) + fruit(6, w * 0.12, h * 0.88, m * 0.24) + fruit(7, w * 0.8, h * 0.2, m * 0.2)
      );
    },
  },
  {
    id: 'space',
    free: false,
    draw: (w, h, m = Math.min(w, h)) =>
      `<rect width="${n(w)}" height="${n(h)}" fill="#22205a"/>` +
      Array.from({ length: 24 }, (_, k) => star(((k * 97) % 100) / 100 * w, ((k * 61 + 13) % 100) / 100 * h, m * (0.015 + (k % 3) * 0.01))).join('') +
      `<circle cx="${n(w * 0.2)}" cy="${n(h * 0.24)}" r="${n(m * 0.13)}" fill="#f2eedc"/><circle cx="${n(w * 0.17)}" cy="${n(h * 0.21)}" r="${n(m * 0.03)}" fill="#d8d2b8"/><circle cx="${n(w * 0.24)}" cy="${n(h * 0.29)}" r="${n(m * 0.02)}" fill="#d8d2b8"/>` +
      `<ellipse cx="${n(w * 0.8)}" cy="${n(h * 0.74)}" rx="${n(m * 0.24)}" ry="${n(m * 0.06)}" fill="none" stroke="#ffb35c" stroke-width="${n(m * 0.02)}"/><circle cx="${n(w * 0.8)}" cy="${n(h * 0.74)}" r="${n(m * 0.13)}" fill="#ff7eb6"/>` +
      pic('rocket', w * 0.5, h * 0.5, m * 0.8),
  },
  {
    id: 'zoo',
    free: false,
    draw: (w, h, m = Math.min(w, h)) =>
      sky(w, h, '#d7f0ff') + sun(w * 0.86, h * 0.14, m * 0.07) + cloud(w * 0.35, h * 0.12, m * 0.26) +
      hill(w, h, 0.6, '#b6e07c') + tree(w * 0.1, h * 0.5, m * 0.45) + flowers(w, h, 0.84, 7) +
      pic('elephant', w * 0.48, h * 0.55, m * 0.7) + pic('turtle', w * 0.84, h * 0.78, m * 0.34) + pic('bird', w * 0.82, h * 0.36, m * 0.24),
  },
  {
    id: 'puppies',
    free: false,
    draw: (w, h, m = Math.min(w, h)) => {
      let dots = '';
      for (let y = 0, r = 0; y < h + 20; y += m / 6, r++) for (let x = (r % 2) * (m / 12); x < w + 20; x += m / 6) dots += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(m * 0.02)}" fill="#ffd8e8"/>`;
      const cols = w >= h * 1.2 ? 3 : 2;
      const rows = 6 / cols;
      let dogs = '';
      for (let k = 0; k < 6; k++) dogs += dog(k, ((k % cols) + 0.5) * (w / cols), (Math.floor(k / cols) + 0.5) * (h / rows), Math.min(w / cols, h / rows) * 0.9);
      return `<rect width="${n(w)}" height="${n(h)}" fill="#fff0f6"/>${dots}${dogs}`;
    },
  },
  {
    id: 'street',
    free: false,
    draw: (w, h, m = Math.min(w, h)) =>
      sky(w, h, '#c9ecff') + cloud(w * 0.2, h * 0.14, m * 0.28) + sun(w * 0.86, h * 0.14, m * 0.07) +
      pic('house', w * 0.22, h * 0.4, m * 0.5) + pic('house', w * 0.78, h * 0.38, m * 0.44) +
      `<rect y="${n(h * 0.62)}" width="${n(w)}" height="${n(h * 0.38)}" fill="#8c8aa8"/>` +
      `<path d="M0 ${n(h * 0.8)}H${n(w)}" stroke="#fff" stroke-width="${n(m * 0.02)}" stroke-dasharray="${n(m * 0.08)} ${n(m * 0.06)}"/>` +
      pic('car', w * 0.55, h * 0.74, m * 0.5) + pic('cat', w * 0.5, h * 0.42, m * 0.3),
  },
  {
    id: 'meadow',
    free: false,
    draw: (w, h, m = Math.min(w, h)) =>
      sky(w, h, '#e1f4ff') + cloud(w * 0.75, h * 0.12, m * 0.3) + sun(w * 0.12, h * 0.14, m * 0.07) +
      hill(w, h, 0.45, '#a3dc78', 0.08) + tree(w * 0.86, h * 0.4, m * 0.42) + flowers(w, h, 0.62, 10) +
      pic('cat', w * 0.25, h * 0.58, m * 0.4) + pic('dog', w * 0.6, h * 0.62, m * 0.42) + pic('turtle', w * 0.84, h * 0.86, m * 0.28) +
      fruit(6, w * 0.1, h * 0.88, m * 0.2) + pic('bird', w * 0.45, h * 0.24, m * 0.22) + fruit(7, w * 0.38, h * 0.88, m * 0.18),
  },
];

export const PICTURES = Object.freeze(SCENES.map(({ id, free }) => Object.freeze({ id, free })));
export const PICTURE_IDS = Object.freeze(PICTURES.map((p) => p.id));

/** A scene as a whole SVG document, w × h units (also a data: URL for a canvas). */
export function pictureSvg(id, w, h, { cls = '' } = {}) {
  const scene = SCENES.find((s) => s.id === id) || SCENES[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 ${n(w)} ${n(h)}" width="${n(w)}" height="${n(h)}" aria-hidden="true">${scene.draw(w, h)}</svg>`;
}
