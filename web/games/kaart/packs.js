// Kaartpuzzel's map packs. A pack is one map (web/games/kaart/packs/<id>.js, made by
// tools/gen-kaart.mjs from Natural Earth) with its regions, their names in Dutch and English and a
// set of points (capitals, or the oceans on the world map). Two kinds:
//   - `world`: for everyone (the continents, Europe's countries)
//   - `country`: the provinces or states of one country, shown first only to children whose device
//     says they live there (`locales`), so nobody outside the Netherlands is pushed Dutch provinces.
// Adding a country: a block in tools/gen-kaart.mjs (the data file with its names), an entry here
// and its name `kaart.pack.<id>` in strings.js. Nothing else.

export const PACKS = Object.freeze([
  Object.freeze({ id: 'continents', kind: 'world', silhouette: false }),
  Object.freeze({ id: 'europe', kind: 'world', silhouette: true }),
  Object.freeze({ id: 'nl', kind: 'country', locales: Object.freeze(['nl', 'nl-NL']), silhouette: true }),
  Object.freeze({ id: 'us', kind: 'country', locales: Object.freeze(['en-US']), silhouette: true }),
  Object.freeze({ id: 'uk', kind: 'country', locales: Object.freeze(['en-GB']), silhouette: true }),
]);
export const PACK_IDS = Object.freeze(PACKS.map((p) => p.id));
export const COUNTRY_IDS = Object.freeze(PACKS.filter((p) => p.kind === 'country').map((p) => p.id));
export const packInfo = (id) => PACKS.find((p) => p.id === id) || null;
/** The free pack: every tier of it, for everyone. */
export const FREE_PACK = 'continents';

/**
 * The country pack for the device's language (navigator.language), by an exact tag: "nl-NL" or
 * plain "nl" for the Netherlands, "en-US", "en-GB". Anything else gets none, Flemish Dutch
 * (nl-BE) and English without a region we know (en-AU, plain "en") too: better no country than the
 * wrong one.
 */
export function defaultCountry(tag) {
  const t = String(tag || '').replace(/_/g, '-').toLowerCase();
  if (!t) return null;
  for (const p of PACKS) {
    if (p.kind !== 'country') continue;
    if (p.locales.some((l) => t === l.toLowerCase() || (l.includes('-') && t.startsWith(`${l.toLowerCase()}-`)))) return p.id;
  }
  return null;
}

/** The packs in the menu's order: the world, then the child's own country (if any). */
export function menuPacks(country) {
  const world = PACKS.filter((p) => p.kind === 'world').map((p) => p.id);
  return COUNTRY_IDS.includes(country) ? [...world, country] : world;
}

const loaded = new Map();
/** The pack's data, loaded once when first asked for (the menu asks for every pack it shows, for the
 *  map on its card; a round for its own). The maps are the biggest part of the game. */
export function loadPack(id) {
  if (!PACK_IDS.includes(id)) return Promise.reject(new Error(`no pack ${id}`));
  if (!loaded.has(id)) loaded.set(id, import(`./packs/${id}.js`).then((m) => m.default));
  return loaded.get(id);
}
