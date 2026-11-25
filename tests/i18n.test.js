import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LANGS, allStrings, pickLang, setLang, t, getLang } from '../web/js/i18n.js';
import '../web/games/bubbels/strings.js';
import '../web/games/dogudoku/strings.js';
import '../web/games/picturedoku/strings.js';
import '../web/games/memory/strings.js';
import { THEMES as MEMORY_THEMES, THEME_IDS as MEMORY_THEME_IDS } from '../web/games/memory/art.js';
import '../web/games/legpuzzel/strings.js';
import { PICTURE_IDS as PUZZEL_PICTURES } from '../web/games/legpuzzel/pictures.js';
import '../web/games/vier/strings.js';
import '../web/games/dammen/strings.js';
import '../web/games/baghchal/strings.js';
import '../web/games/schaak/strings.js';
import '../web/games/ganzen/strings.js';
import '../web/games/pachisi/strings.js';
import { LOOKS as PACHISI_LOOKS } from '../web/games/pachisi/art.js';
import '../web/games/kwartet/strings.js';
import { SETS as KWARTET_SETS } from '../web/games/kwartet/art.js';
import '../web/games/slang/strings.js';
import '../web/games/kleuren/strings.js';
import { PICTURES } from '../web/games/kleuren/pictures.js';
import { PALETTE } from '../web/games/kleuren/art.js';
import '../web/games/tekenen/strings.js';
import { STAMPS } from '../web/games/tekenen/drawing.js';
import '../web/games/klok/strings.js';
import '../web/games/letters/strings.js';
import '../web/games/verstop/strings.js';
import { SCENE_IDS as VZ_SCENES, ANIMAL_IDS as VZ_ANIMALS, CREATURE_IDS as VZ_CREATURES, FEATURE_IDS as VZ_FEATURES, SPOT_KINDS as VZ_SPOTS, TIER_IDS as VZ_TIERS } from '../web/games/verstop/rules.js';
import '../web/games/kangoeroe/strings.js';
import { TIER_IDS as KANGOEROE_TIERS } from '../web/games/kangoeroe/hops.js';
import '../web/games/winkel/strings.js';
import { TIER_IDS as WINKEL_TIERS, ITEM_IDS as WINKEL_ITEMS } from '../web/games/winkel/rules.js';
import '../web/games/kaart/strings.js';
import { PACK_IDS as KAART_PACKS } from '../web/games/kaart/packs.js';
import '../web/games/doolhof/strings.js';
import '../web/games/keuken/strings.js';
import { TIER_IDS as KEUKEN_TIERS } from '../web/games/keuken/rules.js';
import { INGREDIENT_IDS as KEUKEN_INGS, DISH_IDS as KEUKEN_DISHES, SOURCE_IDS as KEUKEN_SOURCES, ORIGIN_IDS as KEUKEN_ORIGINS, GROUP_IDS as KEUKEN_GROUPS, RECIPES as KEUKEN_RECIPES } from '../web/games/keuken/dishes.js';
import '../web/games/treintje/strings.js';
import { AGE_IDS as TREINTJE_AGES } from '../web/games/treintje/generate.js';
import '../web/games/piano/strings.js';
import { SONG_IDS as PIANO_SONGS, KEY_IDS as PIANO_KEYS } from '../web/games/piano/songs.js';
import '../web/games/drums/strings.js';
import { RHYTHM_IDS as DRUM_RHYTHMS, PAD_IDS as DRUM_PADS, LEVELS as DRUM_LEVELS } from '../web/games/drums/kit.js';
import '../web/games/papegaai/strings.js';
import { VOICE_IDS as PARROT_VOICES } from '../web/games/papegaai/effects.js';
import '../web/js/random.js';
import { GAMES, GROUPS, OTHER_GROUP } from '../web/js/games.js';
import { BRAND } from '../web/js/brand.js';

const WEB = new URL('../web/', import.meta.url).pathname;
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? jsFiles(join(dir, d.name)) : d.name.endsWith('.js') ? [join(dir, d.name)] : [],
  );
}

test('every key exists in both languages, with the same placeholders and no empty text', () => {
  const tables = allStrings();
  const keys = new Set(LANGS.flatMap((l) => Object.keys(tables[l])));
  assert.ok(keys.size > 50, `only ${keys.size} keys`);
  for (const key of keys) {
    for (const l of LANGS) {
      assert.equal(typeof tables[l][key], 'string', `${key} is missing in ${l}`);
      assert.ok(tables[l][key].trim(), `${key} is empty in ${l}`);
    }
    assert.deepEqual(placeholders(tables.en[key]), placeholders(tables.nl[key]), `placeholders differ for ${key}`);
  }
});

test('every key used in index.html and in the code exists', () => {
  const tables = allStrings();
  const html = readFileSync(join(WEB, 'index.html'), 'utf8');
  const used = new Set([...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]));
  for (const f of jsFiles(WEB)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9.]+)'/g)) used.add(m[1]);
  }
  for (const g of GAMES) used.add(g.titleKey);
  for (const g of [...GROUPS, OTHER_GROUP]) used.add(g.titleKey); // the section headings on the home screen
  for (const n of [1, 2, 3]) used.add(`bubbels.win${n}`); // built as t(`bubbels.win${stars}`)
  for (const n of [1, 2, 3]) used.add(`dogudoku.win${n}`);
  for (const r of ['row', 'col', 'region', 'touch', 'bush']) used.add(`dogudoku.rule.${r}`).add(`dogudoku.oops.${r}`);
  for (const n of [1, 2, 3]) used.add(`pdoku.win${n}`);
  for (const r of ['row', 'col', 'box']) used.add(`pdoku.rule.${r}`).add(`pdoku.oops.${r}`);
  for (let v = 1; v <= 9; v++) used.add(`pdoku.pic.${v}`);
  for (const id of MEMORY_THEME_IDS) used.add(`memory.theme.${id}`).add(`memory.theme.${id}Sub`);
  for (const id of ['solo', 'duo', 'cpu']) used.add(`memory.mode.${id}`).add(`memory.mode.${id}Sub`);
  for (const id of Object.values(MEMORY_THEMES).flat()) used.add(`memory.pic.${id}`);
  for (const id of PUZZEL_PICTURES) used.add(`puzzel.pic.${id}`);
  for (const n of [1, 2, 3]) used.add(`vier.level${n}`);
  for (const id of ['big', 'small']) used.add(`vier.${id}`).add(`vier.${id}Sub`);
  for (const n of [3, 4]) used.add(`vier.row${n}`);
  for (const id of ['pup', 'bubble', 'apple', 'flower', 'fish', 'pug']) used.add(`vier.tok.${id}`);
  for (const n of [1, 2, 3]) used.add(`dam.level${n}`);
  for (const n of [1, 2, 3]) used.add(`bagh.level${n}`);
  for (const side of ['goats', 'tigers']) used.add(`bagh.side.${side}`).add(`bagh.side.${side}Sub`);
  for (const n of [1, 2, 3]) used.add(`schaak.level${n}`);
  for (const c of [1, 2]) for (let k = 1; k <= 6; k++) used.add(`schaak.p${c}.${k}`); // a square's piece, built as t(`schaak.p${color}.${kind}`)
  for (let k = 2; k <= 5; k++) used.add(`schaak.kind.${k}`); // the promotion picker
  for (const r of ['stalemate', 'repeat', 'fifty', 'material']) used.add(`schaak.draw.${r}`);
  for (const s of KWARTET_SETS) {
    used.add(`kwartet.set.${s.id}`);
    for (const c of s.cards) used.add(`kwartet.card.${c}`).add(`kwartet.the.${c}`);
  }
  for (const k of ['kid', 'cpu', 'off']) used.add(`kwartet.kind.${k}`);
  for (const n of [1, 2, 3]) used.add(`kwartet.cpu${n}`);
  for (const b of ['classic', 'winter', 'sea']) used.add(`ganzen.board.${b}`).add(`ganzen.board.${b}Sub`);
  for (const g of ['white', 'yellow', 'blue', 'pink']) used.add(`ganzen.goose.${g}`);
  for (const k of ['kid', 'cpu', 'off']) used.add(`ganzen.kind.${k}`);
  for (const l of PACHISI_LOOKS) used.add(`pachisi.p.${l.id}`);
  for (const k of ['kid', 'cpu', 'off']) used.add(`pachisi.kind.${k}`);
  for (const n of [1, 2]) used.add(`pachisi.level${n}`);
  for (const n of [2, 4]) used.add(`pachisi.pawns${n}`).add(`pachisi.pawns${n}Sub`);
  for (const m of ['ludo', 'pachisi']) {
    used.add(`pachisi.mode.${m}`).add(`pachisi.mode.${m}Sub`); // the two modes in the menu
    // lines that differ per mode, built as t(`${mode}.${key}`) (tm in pachisi.js)
    for (const k of ['how', 'boardLabel', 'trayLabel', 'trayCount', 'yourThrow', 'throw', 'countNow', 'countSelfSub', 'countAutoSub', 'pawns4Sub', 'captured', 'captured.you', 'hitStart', 'winText']) used.add(`${m}.${k}`);
  }
  for (const k of ['needSix', 'ownThere', 'tooFar', 'mustEnter', 'clearStart']) used.add(`ludo.${k}`); // why a pawn cannot move (modes.js)
  for (const g of GAMES) if (g.subKey) used.add(g.subKey); // the small line under a name on the home screen
  for (const e of ['bounce', 'goose', 'bridge', 'maze', 'woods', 'inn', 'well', 'prison', 'skip.inn', 'skip.well', 'skip.prison']) used.add(`ganzen.ev.${e}`);
  for (const s of ['goose', 'bridge', 'inn', 'well', 'maze', 'prison', 'woods', 'end', 'start']) used.add(`ganzen.sq.${s}`);
  for (const id of ['small', 'big']) used.add(`dam.${id}`).add(`dam.${id}Sub`);
  for (const look of ['pets', 'classic']) used.add(`dam.look.${look}`).add(`dam.look.${look}Sub`).add(`dam.name.${look}1`).add(`dam.name.${look}2`);
  for (const m of ['count', 'letters', 'colors']) used.add(`slang.mode.${m}`).add(`slang.mode.${m}Sub`).add(`slang.how.${m}`);
  used.add('slang.how.bump');
  for (const k of ['easy', 'medium', 'hard']) used.add(`bubbels.tier.${k}`);
  for (const n of [1, 2, 3]) used.add(`slang.win${n}`);
  for (let c = 0; c < 6; c++) used.add(`slang.color.${c}`);
  for (const p of PICTURES) used.add(`kleur.pic.${p.name}`); // built as t(`kleur.pic.${name}`)
  for (let c = 0; c < PALETTE.length; c++) used.add(`kleur.colour.${c}`);
  for (const s of STAMPS) used.add(`teken.stamp.${s}`); // built as t(`teken.stamp.${name}`)
  for (const m of ['set', 'read', 'day', 'dig']) used.add(`klok.mode.${m}`).add(`klok.mode.${m}Sub`).add(`klok.how.${m}`);
  for (const k of ['t1', 't2', 't3', 't4', 't5', 'day']) used.add(`klok.tier.${k}`);
  for (const k of ['t1', 't2', 't3']) used.add(`klok.digTier.${k}`);
  for (const k of ['d2a', 'a2d', 'setA', 'say', 'later']) used.add(`klok.dig.${k}`); // the one-line digital questions
  for (const p of ['hour', 'minute']) used.add(`klok.dig.${p}Plus`).add(`klok.dig.${p}Minus`);
  for (const n of [1, 2, 3]) used.add(`klok.win${n}`);
  for (const a of ['breakfast', 'school', 'lunch', 'play', 'dinner', 'bath', 'bed']) used.add(`klok.act.${a}`);
  for (const id of TREINTJE_AGES) used.add(`treintje.age.${id}`).add(`treintje.sub.${id}`).add(`treintje.how.${id}`);
  for (const w of ['order', 'early', 'wall', 'used']) used.add(`treintje.why.${w}`); // built as t(`treintje.why.${why}`)
  for (const id of PIANO_SONGS) used.add(`piano.song.${id}`); // built as t(`piano.song.${id}`)
  for (const id of PIANO_KEYS) used.add(`piano.note.${id}`);
  for (const n of [1, 2, 3]) used.add(`piano.win${n}`);
  for (const id of DRUM_RHYTHMS) used.add(`drums.rhythm.${id}`); // built as t(`drums.rhythm.${id}`)
  for (const id of DRUM_PADS) used.add(`drums.pad.${id}`);
  for (const l of DRUM_LEVELS) used.add(`drums.level.${l.id}`).add(`drums.age.${l.id}`);
  for (const n of [0, 1, 2, 3]) used.add(`drums.win${n}`);
  for (const id of VZ_SCENES) used.add(`verstop.scene.${id}`);
  for (const id of VZ_TIERS) used.add(`verstop.tier.${id}`).add(`verstop.short.${id}`).add(`verstop.how.${id}`);
  for (const id of VZ_ANIMALS) used.add(`verstop.the.${id}`).add(`verstop.an.${id}`);
  for (const id of VZ_CREATURES) used.add(`verstop.the.${id}`);
  for (const id of VZ_FEATURES) used.add(`verstop.feat.${id}`).add(`verstop.bare.${id}`);
  for (const id of VZ_SPOTS) used.add(`verstop.spot.${id}`);
  for (const n of [1, 2, 3]) used.add(`verstop.win${n}`);
  for (const id of PARROT_VOICES) used.add(`papegaai.voice.${id}`); // built as t(`papegaai.voice.${id}`)
  for (const k of ['start', 'opening', 'listening', 'listeningTap', 'playing', 'again', 'nothing', 'first', 'ready']) used.add(`papegaai.say.${k}`);
  for (const id of KANGOEROE_TIERS) used.add(`kangoeroe.tier.${id}`).add(`kangoeroe.short.${id}`).add(`kangoeroe.how.${id}`);
  for (const k of ['count', 'add', 'land', 'missing', 'skipOn', 'skipBack']) used.add(`kangoeroe.lead.${k}`);
  for (const n of [1, 2, 3]) used.add(`kangoeroe.win${n}`);
  // Keukentje: built as t(`keuken.<kind>.${id}`)
  for (const id of KEUKEN_TIERS) used.add(`keuken.tier.${id}`).add(`keuken.short.${id}`).add(`keuken.how.${id}`);
  for (const k of ['fill', 'fillAll', 'which', 'from', 'steps', 'odd']) used.add(`keuken.lead.${k}`);
  for (const n of [1, 2, 3]) used.add(`keuken.win${n}`);
  for (const id of KEUKEN_INGS) used.add(`keuken.ing.${id}`);
  for (const id of KEUKEN_DISHES) used.add(`keuken.dish.${id}`).add(`keuken.the.${id}`);
  for (const id of KEUKEN_SOURCES) used.add(`keuken.src.${id}`).add(`keuken.gives.${id}`);
  for (const id of KEUKEN_ORIGINS) used.add(`keuken.fact.${id}`);
  for (const id of KEUKEN_GROUPS) used.add(`keuken.group.${id}`).add(`keuken.also.${id}`);
  for (const [r, steps] of Object.entries(KEUKEN_RECIPES)) steps.forEach((_, k) => used.add(`keuken.step.${r}.${k + 1}`));
  for (const id of WINKEL_TIERS) used.add(`winkel.tier.${id}`).add(`winkel.short.${id}`).add(`winkel.how.${id}`);
  for (const k of ['exact', 'fewest', 'two']) used.add(`winkel.lead.${k}`); // built as t(`winkel.lead.${kind}`)
  for (const id of WINKEL_ITEMS) used.add(`winkel.item.${id}`);
  for (const n of [1, 2, 3]) used.add(`winkel.win${n}`);
  for (const id of KAART_PACKS) used.add(`kaart.pack.${id}`);
  for (const k of ['t1', 't2', 't3.cities', 't3.seas']) used.add(`kaart.tier.${k}`);
  for (const k of ['puzzle', 'where', 'point.city', 'point.sea']) used.add(`kaart.how.${k}`);
  for (const n of [1, 2, 3]) used.add(`kaart.win${n}`);
  for (const m of ['abc', 'word', 'count']) {
    used.add(`doolhof.mode.${m}`).add(`doolhof.mode.${m}Sub`).add(`doolhof.how.${m}`);
    for (const k of ['t1', 't2', 't3']) used.add(`doolhof.tier.${m}.${k}`);
  }
  for (const n of [1, 2, 3]) used.add(`doolhof.win${n}`);
  for (const key of used) assert.ok(key in tables.nl, `"${key}" is used but has no text`);
});

test('the device language is followed, with Dutch as the fallback', () => {
  assert.equal(pickLang(null, ['en-GB', 'nl']), 'en');
  assert.equal(pickLang(null, ['nl-BE']), 'nl');
  assert.equal(pickLang(null, ['de-DE', 'en-US']), 'en');
  assert.equal(pickLang(null, ['de-DE', 'fr']), 'nl');
  assert.equal(pickLang(null, []), 'nl');
  assert.equal(pickLang('en', ['nl']), 'en'); // a saved choice wins
  assert.equal(pickLang('xx', ['en']), 'en');
});

test('t() fills placeholders and the brand name, and switches language', () => {
  setLang('nl');
  assert.equal(t('bubbels.level', { n: 4 }), 'Level 4');
  assert.match(t('offer.web'), new RegExp(`${BRAND.name}-app`));
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(t('bubbels.lastFree'), 'That was the last free level.');
  assert.equal(t('no.such.key'), 'no.such.key');
  setLang('nl');
});

test('the brand has a name and a tagline in every language', () => {
  assert.ok(BRAND.name);
  for (const l of LANGS) assert.ok(BRAND.tagline[l], `tagline missing for ${l}`);
});

test('every game sits in one section of the home screen, and no section is empty', () => {
  const ids = GROUPS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, 'a section id twice');
  assert.ok(!ids.includes(OTHER_GROUP.id), 'the fallback section is not a real one');
  for (const g of GAMES) assert.ok(ids.includes(g.group), `${g.id}: group ${g.group} is not in GROUPS`);
  for (const id of ids) assert.ok(GAMES.some((g) => g.group === id), `section ${id} has no games`);
});
