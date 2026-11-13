import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LANGS, allStrings, pickLang, setLang, t, getLang } from '../web/js/i18n.js';
import '../web/games/bubbels/strings.js';
import '../web/games/dogudoku/strings.js';
import '../web/games/picturedoku/strings.js';
import '../web/games/vier/strings.js';
import '../web/games/dammen/strings.js';
import '../web/games/ganzen/strings.js';
import '../web/games/slang/strings.js';
import '../web/games/kleuren/strings.js';
import { PICTURES } from '../web/games/kleuren/pictures.js';
import { PALETTE } from '../web/games/kleuren/art.js';
import '../web/games/tekenen/strings.js';
import { STAMPS } from '../web/games/tekenen/drawing.js';
import '../web/games/klok/strings.js';
import '../web/games/letters/strings.js';
import '../web/js/random.js';
import { GAMES } from '../web/js/games.js';
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
  for (const n of [1, 2, 3]) used.add(`bubbels.win${n}`); // built as t(`bubbels.win${stars}`)
  for (const n of [1, 2, 3]) used.add(`dogudoku.win${n}`);
  for (const r of ['row', 'col', 'region', 'touch', 'bush']) used.add(`dogudoku.rule.${r}`).add(`dogudoku.oops.${r}`);
  for (const n of [1, 2, 3]) used.add(`pdoku.win${n}`);
  for (const r of ['row', 'col', 'box']) used.add(`pdoku.rule.${r}`).add(`pdoku.oops.${r}`);
  for (let v = 1; v <= 9; v++) used.add(`pdoku.pic.${v}`);
  for (const n of [1, 2, 3]) used.add(`vier.level${n}`);
  for (const id of ['big', 'small']) used.add(`vier.${id}`).add(`vier.${id}Sub`);
  for (const n of [3, 4]) used.add(`vier.row${n}`);
  for (const id of ['pup', 'bubble', 'apple', 'flower', 'fish', 'pug']) used.add(`vier.tok.${id}`);
  for (const n of [1, 2, 3]) used.add(`dam.level${n}`);
  for (const b of ['classic', 'winter', 'sea']) used.add(`ganzen.board.${b}`).add(`ganzen.board.${b}Sub`);
  for (const g of ['white', 'yellow', 'blue', 'pink']) used.add(`ganzen.goose.${g}`);
  for (const k of ['kid', 'cpu', 'off']) used.add(`ganzen.kind.${k}`);
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
  for (const m of ['set', 'read', 'day']) used.add(`klok.mode.${m}`).add(`klok.mode.${m}Sub`).add(`klok.how.${m}`);
  for (const k of ['t1', 't2', 't3', 't4', 't5', 'day']) used.add(`klok.tier.${k}`);
  for (const n of [1, 2, 3]) used.add(`klok.win${n}`);
  for (const a of ['breakfast', 'school', 'lunch', 'play', 'dinner', 'bath', 'bed']) used.add(`klok.act.${a}`);
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
  assert.equal(t('bubbels.points', { score: 120 }), '120 points');
  assert.equal(t('no.such.key'), 'no.such.key');
  setLang('nl');
});

test('the brand has a name and a tagline in every language', () => {
  assert.ok(BRAND.name);
  for (const l of LANGS) assert.ok(BRAND.tagline[l], `tagline missing for ${l}`);
});
