// Keukentje (Little Kitchen): what goes into bread and other dishes, as plain data (no DOM). Kept
// correct and simple, the way children know them: no amounts, no brands, nothing about allergies and
// never "good" or "bad" food. Mark checks this list (25 Nov 2026: "een spelletje met wat er in brood
// zit, of gerechten, zodat kids dat ook leren").
//
// A dish has
//   need   every ingredient it is made of (the 6-7 rounds fill one bowl for each),
//   key    the two or three a young child knows it by (the 3-5 rounds),
//   maybe  what is often in it but not always (ham on a tosti, an egg in apple pie, any vegetable
//          in vegetable soup): never offered and never used as a distractor, so a child who
//          "knows better" is never told it is wrong.
// Names are in strings.js: keuken.ing.<id>, keuken.dish.<id>, keuken.the.<dish> ("de pizza").

/** Every ingredient, in the order of the pictures in art.js. */
export const INGREDIENT_IDS = Object.freeze([
  'bloem', 'water', 'gist', 'zout', 'melk', 'ei', 'brood', 'kaas', 'ham', 'tomaat', 'boter', 'suiker',
  'appel', 'kaneel', 'sla', 'komkommer', 'yoghurt', 'aardbei', 'banaan', 'hagelslag', 'pindakaas', 'rijst',
  'pasta', 'wortel', 'prei', 'ui', 'knoflook', 'paprika', 'broccoli', 'aardappel', 'boerenkool', 'kipvlees',
  'boontjes',
]);

const dish = (need, key, maybe = []) => Object.freeze({ need: Object.freeze(need), key: Object.freeze(key), maybe: Object.freeze(maybe) });

/** The 16 dishes (in this order in the tests and when a line names "the dish it belongs to"). */
export const DISHES = Object.freeze({
  brood: dish(['bloem', 'water', 'gist', 'zout'], ['bloem', 'water', 'gist']),
  pannenkoeken: dish(['bloem', 'melk', 'ei'], ['bloem', 'melk', 'ei'], ['zout', 'boter', 'suiker']),
  tosti: dish(['brood', 'kaas'], ['brood', 'kaas'], ['ham', 'boter']),
  pizza: dish(['bloem', 'gist', 'tomaat', 'kaas'], ['bloem', 'tomaat', 'kaas'], ['water', 'zout', 'ham', 'ui', 'paprika', 'knoflook']),
  groentesoep: dish(['water', 'wortel', 'prei', 'ui'], ['water', 'wortel', 'prei'], ['zout', 'aardappel', 'broccoli', 'paprika', 'boontjes', 'knoflook', 'tomaat']),
  appeltaart: dish(['bloem', 'boter', 'suiker', 'appel', 'kaneel'], ['appel', 'bloem', 'suiker'], ['ei', 'zout']),
  salade: dish(['sla', 'tomaat', 'komkommer'], ['sla', 'tomaat', 'komkommer'], ['ui', 'paprika', 'ei', 'kaas', 'wortel', 'ham', 'kipvlees', 'appel', 'pasta', 'rijst', 'zout']),
  yoghurtfruit: dish(['yoghurt', 'aardbei', 'banaan'], ['yoghurt', 'aardbei', 'banaan'], ['appel']),
  hagelslagbrood: dish(['brood', 'boter', 'hagelslag'], ['brood', 'boter', 'hagelslag']),
  poffertjes: dish(['bloem', 'melk', 'ei', 'gist', 'boter'], ['bloem', 'melk', 'gist'], ['suiker', 'zout']),
  roti: dish(['bloem', 'kipvlees', 'aardappel', 'boontjes'], ['bloem', 'kipvlees', 'aardappel'], ['ei', 'ui', 'knoflook', 'water', 'zout']),
  rijstgroente: dish(['rijst', 'paprika', 'broccoli', 'wortel'], ['rijst', 'paprika', 'broccoli'], ['ui', 'knoflook', 'boontjes', 'prei', 'ei', 'kipvlees', 'zout']),
  pastasaus: dish(['pasta', 'tomaat', 'ui', 'knoflook'], ['pasta', 'tomaat', 'ui'], ['kaas', 'zout', 'paprika', 'wortel']),
  stamppot: dish(['aardappel', 'boerenkool', 'melk', 'boter'], ['aardappel', 'boerenkool', 'melk'], ['zout']),
  smoothie: dish(['banaan', 'aardbei', 'melk'], ['banaan', 'aardbei', 'melk'], ['yoghurt', 'appel']),
  pindakaasbrood: dish(['brood', 'pindakaas'], ['brood', 'pindakaas'], ['boter']),
});
export const DISH_IDS = Object.freeze(Object.keys(DISHES));

/** Hot dishes steam when they are ready; the rest sparkle. */
export const HOT = Object.freeze(new Set(['brood', 'pannenkoeken', 'tosti', 'pizza', 'groentesoep', 'appeltaart', 'poffertjes', 'roti', 'rijstgroente', 'pastasaus', 'stamppot']));

/**
 * Pairs a child easily mixes up (by look or by use): the 6-7 rounds put one of these next to the
 * real ingredient, the 3-5 rounds never do.
 */
export const LOOKALIKES = Object.freeze([
  ['zout', 'suiker'],
  ['bloem', 'suiker'],
  ['melk', 'yoghurt'],
  ['melk', 'water'],
  ['boter', 'kaas'],
  ['ui', 'knoflook'],
  ['ui', 'aardappel'],
  ['tomaat', 'paprika'],
  ['tomaat', 'appel'],
  ['sla', 'boerenkool'],
  ['prei', 'boontjes'],
  ['kaneel', 'hagelslag'],
  ['rijst', 'suiker'],
]);

export function lookalikesOf(id) {
  const out = [];
  for (const [a, b] of LOOKALIKES) {
    if (a === id) out.push(b);
    else if (b === id) out.push(a);
  }
  return out;
}

/**
 * Where an ingredient comes from (8-10). `src` is the answer; the wrong options come only from
 * `not`, sources that are plainly not where it comes from (so cheese never gets "the sea" as a
 * wrong answer: there is salt in cheese). A source is a picture of its own or another ingredient
 * (cheese comes from milk). Names: keuken.src.<id>; what each one gives: keuken.gives.<id>; the
 * line after a right answer: keuken.fact.<ingredient>.
 */
export const SOURCE_IDS = Object.freeze(['koe', 'kip', 'graan', 'cellen', 'rijstveld', 'boom', 'grond', 'zee', 'suikerbiet', 'cacao', 'pinda', 'melk', 'bloem']);
export const ORIGINS = Object.freeze({
  melk: Object.freeze({ src: 'koe', not: Object.freeze(['kip', 'graan', 'boom', 'zee', 'rijstveld']) }),
  kaas: Object.freeze({ src: 'melk', not: Object.freeze(['kip', 'graan', 'boom', 'rijstveld', 'cacao']) }),
  boter: Object.freeze({ src: 'melk', not: Object.freeze(['kip', 'graan', 'boom', 'rijstveld', 'pinda']) }),
  yoghurt: Object.freeze({ src: 'melk', not: Object.freeze(['kip', 'graan', 'rijstveld', 'zee', 'pinda']) }),
  ei: Object.freeze({ src: 'kip', not: Object.freeze(['koe', 'graan', 'boom', 'zee', 'grond']) }),
  bloem: Object.freeze({ src: 'graan', not: Object.freeze(['koe', 'kip', 'zee', 'boom', 'rijstveld']) }),
  gist: Object.freeze({ src: 'cellen', not: Object.freeze(['koe', 'kip', 'boom', 'zee', 'rijstveld']) }),
  rijst: Object.freeze({ src: 'rijstveld', not: Object.freeze(['koe', 'kip', 'boom', 'zee', 'cellen']) }),
  appel: Object.freeze({ src: 'boom', not: Object.freeze(['koe', 'kip', 'zee', 'grond', 'rijstveld']) }),
  aardappel: Object.freeze({ src: 'grond', not: Object.freeze(['koe', 'kip', 'boom', 'zee', 'rijstveld']) }),
  zout: Object.freeze({ src: 'zee', not: Object.freeze(['koe', 'kip', 'boom', 'rijstveld', 'graan']) }),
  suiker: Object.freeze({ src: 'suikerbiet', not: Object.freeze(['koe', 'kip', 'zee', 'rijstveld', 'cellen']) }),
  hagelslag: Object.freeze({ src: 'cacao', not: Object.freeze(['kip', 'zee', 'rijstveld', 'cellen', 'graan']) }),
  pindakaas: Object.freeze({ src: 'pinda', not: Object.freeze(['koe', 'kip', 'boom', 'rijstveld', 'cellen']) }),
});
export const ORIGIN_IDS = Object.freeze(Object.keys(ORIGINS));

/**
 * The odd one out (8-10): three of a group and one that is not. `odd` lists what may be the fourth:
 * only things that plainly do not belong (no peanut among "grows under the ground", no rice among
 * "made from grain"). Lines: keuken.group.<id> after a right answer, keuken.also.<id> after a wrong one.
 */
export const GROUPS = Object.freeze({
  koe: Object.freeze({ members: Object.freeze(['melk', 'kaas', 'boter', 'yoghurt']), odd: Object.freeze(['ei', 'appel', 'wortel', 'aardappel', 'tomaat', 'banaan', 'aardbei', 'sla', 'bloem', 'rijst']) }),
  graan: Object.freeze({ members: Object.freeze(['bloem', 'brood', 'pasta']), odd: Object.freeze(['melk', 'kaas', 'ei', 'appel', 'wortel', 'tomaat', 'banaan', 'aardbei', 'sla', 'komkommer']) }),
  grond: Object.freeze({ members: Object.freeze(['aardappel', 'wortel', 'ui']), odd: Object.freeze(['melk', 'kaas', 'ei', 'appel', 'tomaat', 'banaan', 'aardbei', 'sla', 'komkommer', 'paprika', 'broccoli']) }),
});
export const GROUP_IDS = Object.freeze(Object.keys(GROUPS));

/**
 * Simple recipes in steps (8-10): put them in order. Each step is a picture (`act` in art.js) and
 * a short line keuken.step.<recipe>.<n> (n from 1). The order is the only sensible one.
 */
export const RECIPES = Object.freeze({
  pannenkoeken: Object.freeze(['mix', 'pour', 'flip']),
  brood: Object.freeze(['mix', 'knead', 'rise', 'oven']),
  tosti: Object.freeze(['cheese', 'close', 'iron']),
  pizza: Object.freeze(['knead', 'roll', 'top', 'oven']),
  appeltaart: Object.freeze(['mix', 'tin', 'apples', 'oven']),
  groentesoep: Object.freeze(['cut', 'pot', 'boil', 'serve']),
  smoothie: Object.freeze(['cut', 'blendIn', 'blend', 'glass']),
  stamppot: Object.freeze(['peel', 'boil', 'mash', 'serve']),
});
export const RECIPE_IDS = Object.freeze(Object.keys(RECIPES));
