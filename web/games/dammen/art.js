// Dammen's pictures, drawn in code (SVG). Two looks:
//   pets     player 1 a light cream piece with a puppy face (floppy ears), player 2 a dark lilac
//            piece with a kitten face (pointy ears and whiskers). Light against dark AND puppy
//            against kitten, so the sides are easy to tell apart, also for children who see
//            colours differently.
//   classic  plain ivory and dark pieces with grooved rings.
// A king wears a gold crown. The board: cream light squares and lilac dark ones in a lilac frame,
// the app's own colours.
const INK = '#2b2370';

export const LOOKS = Object.freeze(['pets', 'classic']);

const PIECES = {
  pets: {
    1: { disc: '#fff6e6', rim: '#d99a3b', ring: '#f2d3a2' },
    2: { disc: '#4d3f9e', rim: '#251c63', ring: '#6f62c4' },
  },
  classic: {
    1: { disc: '#fbf6ea', rim: '#b7a681', ring: '#e2d7bd' },
    2: { disc: '#38323f', rim: '#16131b', ring: '#57505f' },
  },
};

// a puppy face: round apricot head with floppy brown ears hanging down (never pointy)
const PUPPY =
  '<path d="M26 34c-9-2-14 6-12 18 1 7 5 11 10 10 3-6 4-17 2-28z" fill="#a8652f" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>' +
  '<path d="M74 34c9-2 14 6 12 18-1 7-5 11-10 10-3-6-4-17-2-28z" fill="#a8652f" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>' +
  '<circle cx="50" cy="52" r="24" fill="#f3c48b" stroke="' + INK + '" stroke-width="2.4"/>' +
  '<ellipse cx="50" cy="62" rx="12" ry="9" fill="#fff1dc"/>' +
  '<circle cx="41" cy="48" r="3.6" fill="' + INK + '"/><circle cx="59" cy="48" r="3.6" fill="' + INK + '"/>' +
  '<circle cx="42.2" cy="46.8" r="1.2" fill="#fff"/><circle cx="60.2" cy="46.8" r="1.2" fill="#fff"/>' +
  '<ellipse cx="50" cy="58" rx="4.6" ry="3.4" fill="' + INK + '"/>' +
  '<path d="M44 64c3 3 9 3 12 0" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"/>' +
  '<path d="M50 61.4v2.6" stroke="' + INK + '" stroke-width="2"/>' +
  '<circle cx="35" cy="59" r="3" fill="#ff9db5" opacity=".6"/><circle cx="65" cy="59" r="3" fill="#ff9db5" opacity=".6"/>';

// a kitten face: grey head with pointy ears, whiskers and green eyes
const KITTEN =
  '<path d="M29 40 30 18l17 13z" fill="#c9c6d6" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>' +
  '<path d="M71 40 70 18 53 31z" fill="#c9c6d6" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>' +
  '<path d="M33 35 33.5 25l8 6.5z" fill="#ffb3c6"/><path d="M67 35 66.5 25l-8 6.5z" fill="#ffb3c6"/>' +
  '<ellipse cx="50" cy="53" rx="25" ry="22" fill="#dedbe8" stroke="' + INK + '" stroke-width="2.4"/>' +
  '<path d="M44 33c2 4 2 7 0 9M50 32v10M56 33c-2 4-2 7 0 9" fill="none" stroke="#a7a2bb" stroke-width="2.2" stroke-linecap="round"/>' +
  '<ellipse cx="41" cy="51" rx="4" ry="4.6" fill="#7cc87a" stroke="' + INK + '" stroke-width="1.6"/><ellipse cx="59" cy="51" rx="4" ry="4.6" fill="#7cc87a" stroke="' + INK + '" stroke-width="1.6"/>' +
  '<ellipse cx="41" cy="51.4" rx="1.4" ry="3" fill="' + INK + '"/><ellipse cx="59" cy="51.4" rx="1.4" ry="3" fill="' + INK + '"/>' +
  '<path d="M47 58h6l-3 3.4z" fill="#ff8fab" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/>' +
  '<path d="M50 61.4c-1 3-4.6 3.6-6.4 1.6M50 61.4c1 3 4.6 3.6 6.4 1.6" fill="none" stroke="' + INK + '" stroke-width="1.8" stroke-linecap="round"/>' +
  '<path d="M38 58 24 55M38 61 24 63M62 58l14-3M62 61l14 2" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round"/>';

const CROWN =
  '<g transform="translate(50 15)"><path d="M-17 7-19-9-8-1 0-12 8-1 19-9 17 7z" fill="#ffc531" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>' +
  '<circle cx="-19" cy="-9" r="3" fill="#ffc531" stroke="' + INK + '" stroke-width="1.8"/><circle cx="0" cy="-12" r="3" fill="#ffc531" stroke="' + INK + '" stroke-width="1.8"/><circle cx="19" cy="-9" r="3" fill="#ffc531" stroke="' + INK + '" stroke-width="1.8"/>' +
  '<circle cx="0" cy="1" r="2.6" fill="#ff6b8b"/></g>';

/** A piece: `player` 1 or 2, `king`, in `look` ('pets' or 'classic'). */
export function pieceSvg(player, king = false, look = 'pets', { cls = '' } = {}) {
  const set = PIECES[look] || PIECES.pets;
  const k = set[player === 2 ? 2 : 1];
  let face = '';
  if (look === 'classic') {
    face = `<circle cx="50" cy="50" r="27" fill="none" stroke="${k.ring}" stroke-width="4"/><circle cx="50" cy="50" r="15" fill="none" stroke="${k.ring}" stroke-width="3"/>`;
  } else {
    face = player === 2 ? KITTEN : PUPPY;
  }
  return (
    `<svg class="piece ${king ? 'king' : ''} ${cls}" data-player="${player}" viewBox="0 0 100 100" aria-hidden="true">` +
    `<circle cx="50" cy="55" r="44" fill="#000" opacity=".2"/>` +
    `<circle cx="50" cy="50" r="44" fill="${k.disc}" stroke="${k.rim}" stroke-width="5"/>` +
    `<circle cx="50" cy="50" r="37" fill="none" stroke="${k.ring}" stroke-width="3"/>` +
    face +
    (king ? CROWN : '') +
    `</svg>`
  );
}

/** A small board for the menu: `size`×`size` with a few pieces in their starting places. */
export function boardSvg(size, look = 'pets', { cls = '' } = {}) {
  const cell = 10;
  const w = size * cell + 6;
  let sq = '';
  const p = PIECES[look] || PIECES.pets;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const dark = (r + c) % 2 === 1;
      sq += `<rect x="${3 + c * cell}" y="${3 + r * cell}" width="${cell}" height="${cell}" fill="${dark ? '#8f7fe6' : '#fdf3e1'}"/>`;
      if (!dark) continue;
      const side = r < 2 ? 2 : r >= size - 2 ? 1 : 0;
      if (side) sq += `<circle cx="${3 + c * cell + cell / 2}" cy="${3 + r * cell + cell / 2}" r="3.8" fill="${p[side].disc}" stroke="${p[side].rim}" stroke-width="1"/>`;
    }
  }
  return `<svg class="mini-dam ${cls}" viewBox="0 0 ${w} ${w}" aria-hidden="true"><rect x="0" y="0" width="${w}" height="${w}" rx="5" fill="#6f5fe6" stroke="${INK}" stroke-width="1.4"/>${sq}</svg>`;
}

/** The home tile: a corner of the board with a puppy and a crowned kitten. */
export function tileSvg() {
  const cell = 25;
  let sq = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) sq += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="${(r + c) % 2 ? '#8f7fe6' : '#fdf3e1'}"/>`;
  const at = (r, c, svg) => svg.replace('<svg ', `<svg x="${c * cell + 1}" y="${r * cell + 1}" width="${cell - 2}" height="${cell - 2}" `);
  return (
    `<svg class="dam-tile" viewBox="-4 -4 108 108" aria-hidden="true"><rect x="-4" y="-4" width="108" height="108" rx="14" fill="#6f5fe6"/>${sq}` +
    at(3, 0, pieceSvg(1)) + at(2, 1, pieceSvg(1)) + at(1, 2, pieceSvg(2)) + at(0, 3, pieceSvg(2, true)) + at(3, 2, pieceSvg(1)) +
    `</svg>`
  );
}
