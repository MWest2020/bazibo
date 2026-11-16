// Piano pictures, drawn in code: the home tile (a little toy piano), and the cards in the song
// list (the toy piano for free play, a row of coloured notes for a song).
import { WHITE_KEYS, keyById, songById } from './songs.js';

const INK = '#2b2370';
const BODY = '#5b4bdb';
const BODY_DARK = '#3b2fa8';

/** A toy piano: a purple body with coloured keys and black keys. `w`x`h` view box. */
function toyPiano(w, h) {
  const pad = w * 0.06;
  const top = h * 0.3;
  const kw = (w - pad * 2) / WHITE_KEYS.length;
  const kh = h - top - pad;
  let s = `<rect x="1.5" y="${h * 0.12}" width="${w - 3}" height="${h * 0.86}" rx="${w * 0.1}" fill="${BODY}" stroke="${INK}" stroke-width="3"/>`;
  s += `<rect x="${w * 0.36}" y="${h * 0.17}" width="${w * 0.28}" height="${h * 0.07}" rx="${h * 0.035}" fill="${BODY_DARK}"/>`;
  s += `<circle cx="${w * 0.18}" cy="${h * 0.205}" r="${h * 0.04}" fill="#ffc531"/><circle cx="${w * 0.82}" cy="${h * 0.205}" r="${h * 0.04}" fill="#ff7ac8"/>`;
  WHITE_KEYS.forEach((k, i) => {
    s += `<rect x="${pad + i * kw + 0.8}" y="${top}" width="${kw - 1.6}" height="${kh}" rx="${kw * 0.22}" fill="${k.color}" stroke="${INK}" stroke-width="1.6"/>`;
  });
  for (const slot of [1, 2, 4, 5, 6]) {
    const bw = kw * 0.58;
    s += `<rect x="${pad + slot * kw - bw / 2}" y="${top}" width="${bw}" height="${kh * 0.56}" rx="${bw * 0.25}" fill="${INK}"/>`;
  }
  return s;
}

export function tileSvg() {
  return `<svg class="piano-tile-svg" viewBox="0 0 92 92" aria-hidden="true"><g transform="translate(0 4)">${toyPiano(92, 84)}</g></svg>`;
}

/** The picture on a card in the song list: free play shows the piano, a song its first notes. */
export function cardSvg(id) {
  if (id === 'free') return `<svg viewBox="0 0 84 62" aria-hidden="true">${toyPiano(84, 62)}</svg>`;
  const song = songById(id);
  const notes = song ? song.notes.slice(0, 6) : [];
  const rank = (key) => WHITE_KEYS.findIndex((k) => k.id === key);
  let s = '<path d="M4 50 H80 M4 40 H80 M4 30 H80 M4 20 H80" stroke="#d6cff7" stroke-width="2"/>';
  notes.forEach((n, i) => {
    const x = 10 + i * 13;
    const y = 50 - rank(n.key) * 5;
    const color = keyById(n.key)?.color || INK;
    s += `<path d="M${x + 5} ${y} V${y - 22}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
    s += `<ellipse cx="${x}" cy="${y}" rx="6.2" ry="5" transform="rotate(-20 ${x} ${y})" fill="${color}" stroke="${INK}" stroke-width="2"/>`;
  });
  return `<svg viewBox="0 0 84 62" aria-hidden="true">${s}</svg>`;
}
