# Kaartpuzzel (Map Puzzle)

Topography with map packs, in `web/games/kaart/` (id `kaart`, ages 6-12). The maps come from
Natural Earth (public domain), projected, clipped and simplified by `tools/gen-kaart.mjs` into one
small ES module per pack (`packs/<id>.js`: SVG paths, a centre per region, names in Dutch and
English, capitals or oceans); the raw data is not committed (the tool's header says how to fetch
it). What a tap or a drop means is pure in `map.js`, the rounds in `rounds.js` (both tested in
`tests/kaart.test.js`); the screens in `kaart.js`.

- Packs: Werelddelen / Continents (seven, with the five oceans as labels) and Europe (41
  countries, the Dutch point of view: Natural Earth's NLD edition) for everyone; the Netherlands
  (12 provinces, the IJsselmeer as water), the United States (50 states, Alaska and Hawaii in
  boxes) and the United Kingdom (4 nations) as own-country packs. The menu shows the country the
  device's language says (`navigator.language`, exact: nl-NL or nl → the Netherlands, en-US → the
  US, en-GB → the UK, anything else none, nl-BE too); "Ander land…" picks another or none (saved).
- t1 (6-8): a puzzle with every border drawn, up to 8 pieces a round, the biggest first. Drag a
  piece from the row onto the map (a finger's piece is drawn above the finger); inside its outline
  or close to its centre it snaps in (never half way to another centre), on another region's
  place it bounces back. Puzzles (with borders) whose pieces are too small to drop on a phone start with the magnifier. A tap on a piece, then on its place, works too.
- t2 (7-10): "Waar ligt Utrecht?": tap the region. Small regions (Luxembourg, Rhode Island) are
  picked by a tap on or right by their outline (inside a neighbour only within a fifth of a
  finger), and get a dashed ring when tiny.
- t3 (9-12): the whole puzzle without borders (the land only; for the continents an empty sea),
  then the capitals as dots ("Waar ligt Utrecht (stad)?") or, on the world map, the oceans.
- Calm: no timers. A wrong drop or tap is a bounce and says what was tapped; it counts once per
  piece or question, and after two the right place glows. Stars by mistakes. Nothing is spoken.
- Phones with tiny regions (Europe, the US) get a magnifier (3x) and the map pans with a finger.
- Free: the whole Continents pack and tier 1 of every pack (`meta.js`); the rest in the full
  version. Saved under `games.kaart`: stars per round (`nl-t2-1`), the last pack, the country and
  the how-to cards seen.
- Adding a country: a block in `tools/gen-kaart.mjs`, an entry in `packs.js` and its name
  `kaart.pack.<id>` in `strings.js`.
