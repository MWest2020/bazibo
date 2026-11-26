// Kleurenkermis (Colour Fair): the colours, the things whose colour every child knows, and the
// shapes that tell the colour buttons apart. Pure data; rules.js makes the rounds from it, art.js
// draws it.
//
// Colour-blind safe (tested in tests/kermis.test.js): every pair of inks that a question can put
// side by side differs by CIE76 ΔE 18 or more for normal vision and for simulated protanopia and
// deuteranopia (Machado et al. 2009, severity 1), and 15 or more for tritanopia: tier 2's four
// colours, tier 3's six, and in tier 1 a thing's own colour against each colour it may be shown in.
// So red and green also differ in lightness (a dark red, a light green), and tier 3 has pink rather
// than purple (blue and purple look alike to many colour-blind children). Every colour button also
// carries its own shape (SHAPES) and its name, so no button is told apart by colour alone.

/** The inks, as drawn and as the letters are coloured. */
export const INKS = Object.freeze({
  rood: '#c92a2a',
  blauw: '#1c7ed6',
  geel: '#ffd43b',
  groen: '#69c94a',
  oranje: '#f76707',
  roze: '#f783c4',
  paars: '#7b3fb5',
  bruin: '#8d5a2b',
});
export const INK_IDS = Object.freeze(Object.keys(INKS));

/** Tier 2: short colour words every reader of 6-7 knows. */
export const WORD_COLOURS = Object.freeze(['rood', 'blauw', 'geel', 'groen']);
/** Tier 3: the colours of the real Stroop task (and of its four buttons). */
export const STROOP_COLOURS = Object.freeze(['rood', 'blauw', 'geel', 'groen', 'oranje', 'roze']);

/** The shape on each colour button, one per colour (never colour alone). */
export const SHAPES = Object.freeze({
  rood: 'circle',
  blauw: 'square',
  geel: 'triangle',
  groen: 'diamond',
  oranje: 'hexagon',
  roze: 'star',
});

/**
 * Tier 1: things whose colour a child of 3-5 knows, each with its one own colour (`ink`) and the
 * colours it may be shown in for a "Nee" (`not`): only colours that are plainly wrong for it. Never
 * a colour the thing really comes in (green or red bananas, purple carrots, yellow ladybirds, red
 * unripe blueberries, autumn leaves, a copper beech's purple leaves...): when in doubt, leave the
 * colour out. Things with many real colours stay out altogether (tomatoes come pink, purple and
 * brown, aubergines yellow and white; water has no colour, and a red drop reads as blood). Mark
 * checks these.
 */
export const THINGS = Object.freeze({
  banaan: Object.freeze({ ink: 'geel', not: Object.freeze(['blauw', 'roze']) }),
  citroen: Object.freeze({ ink: 'geel', not: Object.freeze(['blauw', 'paars', 'roze']) }),
  kuiken: Object.freeze({ ink: 'geel', not: Object.freeze(['blauw', 'groen', 'paars']) }),
  zon: Object.freeze({ ink: 'geel', not: Object.freeze(['blauw', 'groen', 'paars']) }),
  aardbei: Object.freeze({ ink: 'rood', not: Object.freeze(['blauw', 'paars']) }),
  lieveheersbeestje: Object.freeze({ ink: 'rood', not: Object.freeze(['blauw', 'groen', 'paars']) }),
  wortel: Object.freeze({ ink: 'oranje', not: Object.freeze(['blauw', 'roze', 'groen']) }),
  sinaasappel: Object.freeze({ ink: 'oranje', not: Object.freeze(['blauw', 'paars', 'roze']) }),
  kikker: Object.freeze({ ink: 'groen', not: Object.freeze(['roze', 'paars']) }),
  blad: Object.freeze({ ink: 'groen', not: Object.freeze(['blauw']) }),
  komkommer: Object.freeze({ ink: 'groen', not: Object.freeze(['blauw', 'roze', 'paars']) }),
  broccoli: Object.freeze({ ink: 'groen', not: Object.freeze(['blauw', 'roze', 'oranje']) }),
  varken: Object.freeze({ ink: 'roze', not: Object.freeze(['blauw', 'groen', 'geel']) }),
  flamingo: Object.freeze({ ink: 'roze', not: Object.freeze(['blauw', 'groen']) }),
  bosbes: Object.freeze({ ink: 'blauw', not: Object.freeze(['oranje', 'geel']) }),
  kastanje: Object.freeze({ ink: 'bruin', not: Object.freeze(['blauw', 'roze', 'paars']) }),
});
export const THING_IDS = Object.freeze(Object.keys(THINGS));
