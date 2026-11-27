// The shell: home screen with a tile per game, settings, the overlay card, the parental gate and
// the one purchase that opens every game. Each game lives in web/games/<id>/.
import { BRAND } from './brand.js';
import { markSvg, wordmarkSvg } from './logo.js';
import { GAMES, GROUPS, OTHER_GROUP } from './games.js';
import { homeLayout } from './home-grid.js';
import { t, getLang, setLang, pickLang, onLangChange, translateDom } from './i18n.js';
import { COLORS, drawBubble } from './bubble-art.js';
import * as store from './storage.js';
import * as sfx from './audio.js';
import { createUnlock, noBilling } from './unlock.js';
import { isNativeApp, createNativeBilling } from './billing-native.js';
import { createGate } from './parental-gate.js';
import { backAction } from './back.js';
import { createTransfer } from './transfer-ui.js';
import { PLAY_URL } from './store-links.js'; // shows the store links on the website, never in the app
import { webCodeAllowed, createCodeBilling, verifyCode, takeUnlockParam, activate, deviceId, BMC_URL, UNLOCK_PUBLIC_KEY, MAX_INPUT } from './unlock-code.js';
import { REVOKED } from './revoked.js';
import { urlLang, setCanonical } from './seo.js';
import '../games/bubbels/strings.js';
import { createBubbels } from '../games/bubbels/bubbels.js';
import '../games/dogudoku/strings.js';
import { createDogudoku } from '../games/dogudoku/dogudoku.js';
import { dogSvg } from '../games/dogudoku/art.js';
import '../games/picturedoku/strings.js';
import { createPicturedoku } from '../games/picturedoku/picturedoku.js';
import { pictureSvg } from '../games/picturedoku/art.js';
import '../games/memory/strings.js';
import { createMemory } from '../games/memory/memory.js';
import { tileSvg as memoryTileSvg } from '../games/memory/art.js';
import '../games/legpuzzel/strings.js';
import { createLegpuzzel } from '../games/legpuzzel/legpuzzel.js';
import { tileSvg as puzzelTileSvg } from '../games/legpuzzel/art.js';
import '../games/vier/strings.js';
import { createVier } from '../games/vier/vier.js';
import { tokenSvg } from '../games/vier/art.js';
import '../games/dammen/strings.js';
import { createDammen } from '../games/dammen/dammen.js';
import { tileSvg as dammenTileSvg } from '../games/dammen/art.js';
import '../games/baghchal/strings.js';
import { createBaghchal } from '../games/baghchal/baghchal.js';
import { tileSvg as baghchalTileSvg } from '../games/baghchal/art.js';
import '../games/schaak/strings.js';
import { createSchaak } from '../games/schaak/schaak.js';
import { tileSvg as schaakTileSvg } from '../games/schaak/art.js';
import '../games/ganzen/strings.js';
import { createGanzen } from '../games/ganzen/ganzen.js';
import { tileSvg as ganzenTileSvg } from '../games/ganzen/art.js';
import '../games/pachisi/strings.js';
import { createPachisi } from '../games/pachisi/pachisi.js';
import { tileSvg as pachisiTileSvg } from '../games/pachisi/ludo-art.js'; // Ludo is the tile (Pachisi is its second mode)
import '../games/kwartet/strings.js';
import { createKwartet } from '../games/kwartet/kwartet.js';
import { tileSvg as kwartetTileSvg } from '../games/kwartet/art.js';
import '../games/slang/strings.js';
import { createSlang } from '../games/slang/slang.js';
import { snakeSvg } from '../games/slang/art.js';
import '../games/kleuren/strings.js';
import { createKleuren } from '../games/kleuren/kleuren.js';
import { tileMandalaSvg } from '../games/kleuren/tile.js';
import '../games/tekenen/strings.js';
import { createTekenen } from '../games/tekenen/tekenen.js';
import { tileCanvas as tekenenTileCanvas } from '../games/tekenen/tile.js';
import '../games/klok/strings.js';
import { createKlok } from '../games/klok/klok.js';
import { tileSvg as klokTileSvg } from '../games/klok/art.js';
import '../games/letters/strings.js';
import { createLetters } from '../games/letters/letters.js';
import { tileSvg as lettersTileSvg } from '../games/letters/art.js';
import '../games/verstop/strings.js';
import { createVerstop } from '../games/verstop/verstop.js';
import { tileSvg as verstopTileSvg } from '../games/verstop/art.js';
import '../games/treintje/strings.js';
import { createTreintje } from '../games/treintje/treintje.js';
import { tileSvg as treintjeTileSvg } from '../games/treintje/art.js';
import '../games/kermis/strings.js';
import { createKermis } from '../games/kermis/kermis.js';
import { tileSvg as kermisTileSvg } from '../games/kermis/art.js';
import '../games/keuken/strings.js';
import { createKeuken } from '../games/keuken/keuken.js';
import { tileSvg as keukenTileSvg } from '../games/keuken/art.js';
import '../games/kangoeroe/strings.js';
import { createKangoeroe } from '../games/kangoeroe/kangoeroe.js';
import { tileSvg as kangoeroeTileSvg } from '../games/kangoeroe/art.js';
import '../games/winkel/strings.js';
import { createWinkel } from '../games/winkel/winkel.js';
import { tileSvg as winkelTileSvg } from '../games/winkel/art.js';
import '../games/kaart/strings.js';
import { createKaart } from '../games/kaart/kaart.js';
import { tileSvg as kaartTileSvg } from '../games/kaart/art.js';
import '../games/doolhof/strings.js';
import { createDoolhof } from '../games/doolhof/doolhof.js';
import { tileSvg as doolhofTileSvg } from '../games/doolhof/art.js';
import '../games/piano/strings.js';
import { createPiano } from '../games/piano/piano.js';
import { tileSvg as pianoTileSvg } from '../games/piano/art.js';
import '../games/drums/strings.js';
import { createDrums } from '../games/drums/drums.js';
import { tileSvg as drumsTileSvg } from '../games/drums/art.js';
import '../games/papegaai/strings.js';
import { createPapegaai } from '../games/papegaai/papegaai.js';
import { tileSvg as papegaaiTileSvg } from '../games/papegaai/art.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';

// Filled in boot(), after the save data has loaded (storage.js: Preferences in the apps).
let settings = { muted: false, lang: null };
let unlock = null; // the full version: bought in the Android/iOS app; on the website with a signed code

// The website's code (unlock-code.js), never in the app: `#unlock=<code>` (or `?unlock=`) from the parent's mail is
// taken out of the address at once (before anything else reads it) and redeemed once the games are
// ready. In the app takeUnlockParam does nothing.
const WEB_CODE = webCodeAllowed(window);
const deepCode = takeUnlockParam(window);
// Test hook (only with ?test): the smoke test signs codes with a key of its own, never the real one,
// and puts its public key (and test revocations) here with an init script. A link cannot set these.
const TESTING = new URLSearchParams(location.search).has('test');
const unlockKey = () => (TESTING && typeof window.__baziboUnlockTestKey === 'string' ? window.__baziboUnlockTestKey : UNLOCK_PUBLIC_KEY);
const unlockRevoked = () => (TESTING && Array.isArray(window.__baziboUnlockTestRevoked) ? [...REVOKED, ...window.__baziboUnlockTestRevoked] : REVOKED);
const NO_CACHE = { get: () => false, set() {} }; // the website trusts only a code that checks out, never a cached flag

// ---------- screens ----------

const showHooks = [];

function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  hideOverlay();
  if (name === 'settings') renderSettings();
  for (const fn of showHooks) fn(name);
}

// Until boot() has loaded the save data, settings taps would change a default save (review of PR #3).
const starting = () => !document.documentElement.dataset.ready;

const tap = () => {
  sfx.unlock();
  sfx.click();
};

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go && !starting()) {
    tap();
    show(go.dataset.go);
  }
});

// ---------- language ----------

function renderLanguage() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.title = t('meta.title'); // the tab and search results; the static copy in index.html is the Dutch one
  $('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  $('#brand-text').textContent = BRAND.name; // the words; the drawn wordmark beside them is aria-hidden
  $('#brand-tagline').textContent = BRAND.tagline[lang];
  $('#brand-lore').textContent = BRAND.lore[lang];
  translateDom(document);
  $('#privacy-link').href = lang === 'en' ? 'en/privacy/index.html' : 'nl/privacy/index.html';
  $('#terms-link').href = lang === 'en' ? 'en/terms/index.html' : 'nl/voorwaarden/index.html';
  $('#roadmap-link').href = lang === 'en' ? 'en/roadmap/index.html' : 'nl/plannen/index.html';
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
}
onLangChange(renderLanguage);
setCanonical(document, location.search); // bazibo.nl, with ?lang= when the address has it (js/seo.js)
// the logo, drawn once: the cut-paper b and the drawn name (web/js/logo.js, from design/brand/logo/)
$('#brand-mark').innerHTML = markSvg();
$('#brand-word').innerHTML = wordmarkSvg();

document.querySelectorAll('[data-lang]').forEach((b) =>
  b.addEventListener('click', () => {
    if (starting()) return;
    tap();
    settings.lang = b.dataset.lang;
    store.saveSettings(settings);
    setLang(settings.lang);
    renderSettings();
  }),
);

// ---------- sound ----------

const soundListeners = new Set();

function setMuted(muted) {
  settings.muted = !!muted;
  sfx.setMuted(settings.muted);
  store.saveSettings(settings);
  for (const fn of soundListeners) fn(settings.muted);
}

document.querySelectorAll('[data-sound]').forEach((b) =>
  b.addEventListener('click', () => {
    if (starting()) return;
    sfx.unlock();
    setMuted(b.dataset.sound === 'off');
    renderSettings();
    sfx.click();
  }),
);

// ---------- settings ----------

function renderSettings() {
  if (!unlock) return; // still loading the save data
  for (const b of document.querySelectorAll('[data-sound]')) b.setAttribute('aria-pressed', String((b.dataset.sound === 'off') === settings.muted));
  $('#full-status').textContent = unlock.owned ? t('settings.fullOwned') : unlock.available ? t('settings.fullApp') : t('settings.fullWeb'); // the website's code is "available" too
  $('#btn-full').hidden = unlock.owned;
}
$('#btn-full').addEventListener('click', () => {
  tap();
  offerUnlock();
});
// Voortgang overzetten changes the save, so a parent opens it (the same gate as buying)
$('#btn-transfer').addEventListener('click', () => {
  if (starting()) return;
  tap();
  askParent(() => show('transfer'));
});

// The Google Play link under the home tiles (website only, see store-links.js) leaves the game, so
// a parent opens it: the same gate as buying. It stays a real link for keyboards and screen readers.
$('#store-play').addEventListener('click', (e) => {
  e.preventDefault();
  if (starting()) return;
  tap();
  askParent(() => {
    hideOverlay();
    const w = window.open(PLAY_URL, '_blank');
    if (w) w.opener = null;
    else location.href = PLAY_URL; // a blocked new tab: go there in this one
  });
});
// A middle click or a long press ("open in new tab", Android Chrome) would pass the gate: no menu.
for (const ev of ['auxclick', 'contextmenu']) {
  $('#store-play').addEventListener(ev, (e) => e.preventDefault());
}

// ---------- home tiles ----------

/** One section per group (GROUPS in games.js) with its games' tiles, in GAMES order. The art is
 *  drawn into each `.tile-art` later (drawTileArt and friends); the texts come from translateDom. */
function buildTiles() {
  const box = $('#tile-groups');
  // a game whose group is not in GROUPS still gets a tile, in an "Overig" section at the end
  const known = new Set(GROUPS.map((g) => g.id));
  const lost = GAMES.filter((g) => !known.has(g.group));
  for (const g of lost) console.error(`home: game ${g.id} has an unknown group ${JSON.stringify(g.group)}; shown under ${OTHER_GROUP.id}`);
  for (const group of [...GROUPS, OTHER_GROUP]) {
    const list = group === OTHER_GROUP ? lost : GAMES.filter((g) => g.group === group.id);
    if (!list.length) continue;
    const section = document.createElement('section');
    section.className = 'tile-group';
    section.dataset.group = group.id;
    const head = document.createElement('h2');
    head.className = 'group-name';
    head.id = `group-${group.id}`;
    head.dataset.i18n = group.titleKey;
    head.textContent = t(group.titleKey);
    // the section's name beside its own mark: the b on this group's scrap (design/brand/logo/mark-<group>.svg)
    const top = document.createElement('div');
    top.className = 'group-head';
    if (group !== OTHER_GROUP) {
      const mark = document.createElement('span');
      mark.className = 'group-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.innerHTML = markSvg(group.id);
      top.append(mark);
    }
    top.append(head);
    const tiles = document.createElement('div');
    tiles.className = 'tiles';
    tiles.setAttribute('role', 'group');
    tiles.setAttribute('aria-labelledby', head.id);
    for (const game of list) {
      const tile = document.createElement('button');
      tile.id = `tile-${game.id}`;
      tile.className = game.status === 'ready' ? 'tile' : 'tile soon';
      tile.type = 'button';
      tile.dataset.game = game.id;
      // Bubbels paints its bubbles on a canvas; the other games put their own drawing in a span
      const art = document.createElement(game.id === 'bubbels' ? 'canvas' : 'span');
      if (art instanceof HTMLCanvasElement) art.width = art.height = 160;
      art.className = 'tile-art';
      art.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'tile-name';
      name.dataset.i18n = game.titleKey;
      name.textContent = t(game.titleKey);
      tile.append(art, name);
      if (game.subKey) {
        // a small second line under the name (Pachisi: "the original game from India")
        const sub = document.createElement('span');
        sub.className = 'tile-sub';
        sub.dataset.i18n = game.subKey;
        sub.textContent = t(game.subKey);
        tile.append(sub);
      }
      tiles.append(tile);
    }
    section.append(top, tiles);
    box.append(section);
  }
}
buildTiles();

/** Balanced rows in every section (home-grid.js): 8 tiles where 7 fit are 2 rows of 4, never 7 and
 *  one alone, and every section as wide as the widest. The sizes come from style.css (--tile-min,
 *  --tile-max, --tile-gap, --group-pad, max-width per screen size); this sets --cols and --tracks
 *  per section, --tile and --groups-w on the box. Again on every resize (and when the home screen
 *  shows), because the media queries change those sizes. */
function layoutTiles() {
  const box = $('#tile-groups');
  const screen = $('#screen-home');
  if (!screen.clientWidth) return; // hidden: the observer calls again when it shows
  const px = (el, prop) => parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
  const inner = box.parentElement;
  // the real width, not clientWidth's rounded one: a phone 392.73 px wide must not get half a pixel too much
  const room = Math.floor(screen.getBoundingClientRect().width - (screen.offsetWidth - screen.clientWidth)) - px(screen, 'padding-left') - px(screen, 'padding-right') - px(inner, 'padding-left') - px(inner, 'padding-right');
  const max = px(box, 'max-width') || Infinity;
  const tileMax = parseFloat(getComputedStyle(box).getPropertyValue('--tile-max')); // "none" on phones: the tiles fill the row
  const groups = [...box.querySelectorAll('.tile-group .tiles')];
  const lay = homeLayout(groups.map((g) => g.children.length), {
    width: Math.min(room, max),
    tileMin: px(box, '--tile-min'),
    tileMax: Number.isFinite(tileMax) ? tileMax : Infinity,
    gap: px(box, '--tile-gap'),
    pad: px(box, '--group-pad'),
  });
  box.style.setProperty('--tile', `${lay.tile}px`);
  box.style.setProperty('--groups-w', `${lay.groupsWidth}px`);
  groups.forEach((g, i) => {
    const { cols, shortStarts } = lay.sections[i];
    g.style.setProperty('--cols', cols);
    g.style.setProperty('--tracks', cols * 2);
    // a row one tile shorter stands centred (half-width tracks, see .tiles.brick in style.css)
    g.classList.toggle('brick', shortStarts.length > 0);
    [...g.children].forEach((tile, k) => tile.classList.toggle('row-in', shortStarts.includes(k)));
  });
}
layoutTiles();
new ResizeObserver(layoutTiles).observe($('#screen-home'));

/** Each game's screens take the colour of its group (data-group; the tokens in style.css): the
 *  selected option and the next level in a menu. A game's screens are `screen-<id>...`; Bubbels,
 *  the first game, kept the plain names. */
function markGroups() {
  const plain = { bubbels: ['#screen-levels', '#screen-game'] };
  for (const game of GAMES) {
    for (const s of document.querySelectorAll([`.screen[id^="screen-${game.id}"]`, ...(plain[game.id] || [])].join(','))) s.dataset.group = game.group;
  }
}
markGroups();

function drawTileArt() {
  const c = $('#tile-bubbels .tile-art');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  for (const [x, y, r, col] of [
    [54, 58, 32, 0],
    [110, 50, 27, 3],
    [82, 110, 36, 1],
  ]) {
    drawBubble(ctx, x, y, r, COLORS[col % COLORS.length]);
  }
}

function drawDoguTile() {
  // a little 3×3 garden with two puppies, from the game's own pictures
  const box = $('#tile-dogudoku .tile-art');
  box.innerHTML = `<span class="mini-board">${'<span></span>'.repeat(9)}</span>`;
  const spots = box.querySelectorAll('.mini-board span');
  spots[2].innerHTML = dogSvg(0);
  spots[3].innerHTML = dogSvg(3);
  spots[7].innerHTML = dogSvg(4);
}

function drawPicturedokuTile() {
  // a little 2×2 sudoku with four of the game's pictures
  const box = $('#tile-picturedoku .tile-art');
  box.innerHTML = `<span class="mini-sudoku">${[1, 2, 3, 4].map((v) => `<span>${pictureSvg(v)}</span>`).join('')}</span>`;
}

function drawMemoryTile() {
  $('#tile-memory .tile-art').innerHTML = memoryTileSvg();
}

function drawPuzzelTile() {
  $('#tile-legpuzzel .tile-art').innerHTML = puzzelTileSvg();
}

function drawVierTile() {
  // a little board with three tokens in a slanting row
  const box = $('#tile-vier .tile-art');
  const spots = new Array(12).fill('');
  spots[9] = tokenSvg('pup');
  spots[6] = tokenSvg('pup');
  spots[3] = tokenSvg('pup');
  spots[10] = tokenSvg('bubble');
  spots[11] = tokenSvg('bubble');
  spots[7] = tokenSvg('bubble');
  box.innerHTML = `<span class="mini-vier-tile">${spots.map((s) => `<span>${s}</span>`).join('')}</span>`;
}

function drawDammenTile() {
  $('#tile-dammen .tile-art').innerHTML = dammenTileSvg();
}

function drawBaghchalTile() {
  $('#tile-baghchal .tile-art').innerHTML = baghchalTileSvg();
}

function drawSchaakTile() {
  $('#tile-schaak .tile-art').innerHTML = schaakTileSvg();
}

function drawGanzenTile() {
  $('#tile-ganzen .tile-art').innerHTML = ganzenTileSvg();
}

function drawPachisiTile() {
  $('#tile-pachisi .tile-art').innerHTML = pachisiTileSvg();
}

function drawKwartetTile() {
  $('#tile-kwartet .tile-art').innerHTML = kwartetTileSvg();
}

function drawSlangTile() {
  $('#tile-slang .tile-art').innerHTML = snakeSvg();
}

function drawKleurenTile() {
  $('#tile-kleuren .tile-art').innerHTML = tileMandalaSvg();
}

function drawTekenenTile() {
  const box = $('#tile-tekenen .tile-art');
  box.textContent = '';
  box.appendChild(tekenenTileCanvas());
}

function drawLettersTile() {
  $('#tile-letters .tile-art').innerHTML = lettersTileSvg();
}

function drawVerstopTile() {
  $('#tile-verstop .tile-art').innerHTML = verstopTileSvg();
}

function drawTreintjeTile() {
  $('#tile-treintje .tile-art').innerHTML = treintjeTileSvg();
}

function drawKermisTile() {
  $('#tile-kermis .tile-art').innerHTML = kermisTileSvg();
}

function drawKeukenTile() {
  $('#tile-keuken .tile-art').innerHTML = keukenTileSvg();
}

function drawKangoeroeTile() {
  $('#tile-kangoeroe .tile-art').innerHTML = kangoeroeTileSvg();
}

function drawWinkelTile() {
  $('#tile-winkel .tile-art').innerHTML = winkelTileSvg();
}

function drawKaartTile() {
  $('#tile-kaart .tile-art').innerHTML = kaartTileSvg();
}

function drawDoolhofTile() {
  $('#tile-doolhof .tile-art').innerHTML = doolhofTileSvg();
}

function drawPianoTile() {
  $('#tile-piano .tile-art').innerHTML = pianoTileSvg();
}

function drawDrumsTile() {
  $('#tile-drums .tile-art').innerHTML = drumsTileSvg();
}

function drawPapegaaiTile() {
  $('#tile-papegaai .tile-art').innerHTML = papegaaiTileSvg();
}

function drawKlokTile() {
  $('#tile-klok .tile-art').innerHTML = klokTileSvg();
}

const games = {};

document.querySelectorAll('[data-game]').forEach((tile) =>
  tile.addEventListener('click', () => {
    if (starting()) return;
    tap();
    const game = GAMES.find((g) => g.id === tile.dataset.game);
    if (game?.status === 'ready' && games[game.id]) games[game.id].open();
    else showOverlay({ title: t('soon.title'), text: t('soon.text'), buttons: [[t('common.ok'), 'big primary', hideOverlay]] });
  }),
);

// ---------- the full version ----------

/** The offer card: shown at the end of a game's free part, or from the settings. `lead` says why. */
function offerUnlock(lead = '') {
  const art = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
  const join = (...parts) => parts.filter(Boolean).join(' ');
  if (unlock.owned) {
    showOverlay({ art, title: t('offer.title'), text: t('offer.owned'), buttons: [[t('common.ok'), 'big primary', hideOverlay]] });
    return;
  }
  if (unlock.kind === 'code') {
    // the website: the child's card says OK, as before; under it a small way in for a parent,
    // behind the parental gate (buying on Buy Me a Coffee, or a code)
    showOverlay({
      art,
      title: t('offer.title'),
      text: join(lead, t('offer.webCode')),
      buttons: [[t('common.ok'), 'big primary', hideOverlay]],
      parents: [t('offer.parents'), () => askParent(showWebFull)],
    });
    return;
  }
  if (!unlock.available) {
    showOverlay({ art, title: t('offer.title'), text: join(lead, t('offer.web')), buttons: [[t('common.ok'), 'big primary', hideOverlay]] });
    return;
  }
  const price = unlock.price();
  showOverlay({
    art,
    title: t('offer.title'),
    text: join(lead, t('offer.app', { price: price ? ` (${price})` : '' })),
    buttons: [
      [t('offer.buy'), 'big primary', () => askParent(buyFullVersion)],
      [t('offer.restore'), 'big secondary', () => askParent(restoreFullVersion)],
      [t('common.later'), 'big secondary', hideOverlay],
    ],
  });
}

// ---------- the website's code (unlock-code.js; never in the app) ----------

const LOCK_ART = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;

/** For a parent, after the gate: buy on Buy Me a Coffee (a new tab), or enter the code. */
function showWebFull() {
  showOverlay({
    art: LOCK_ART,
    title: t('offer.title'),
    text: t('code.buyText'),
    buttons: [
      [t('code.buy'), 'big primary', openBuyMeACoffee],
      [t('code.have'), 'big secondary', () => askCode()],
      [t('common.later'), 'big secondary', hideOverlay],
    ],
  });
}

function openBuyMeACoffee() {
  const w = window.open(BMC_URL, '_blank');
  if (w) w.opener = null;
  else location.href = BMC_URL; // a blocked new tab: go there in this one
}

/** The code card: paste the code, or scan its QR code (the transfer screen's scanner). */
function askCode(lead = '') {
  let input = null;
  const submit = () => redeemCode(input.value, { again: () => askCode() });
  input = showOverlay({
    title: t('code.title'),
    text: [lead, t('code.text')].filter(Boolean).join(' '),
    field: { label: t('code.label'), onEnter: submit, kind: 'code' },
    buttons: [
      [t('code.ok'), 'big primary', submit],
      [t('code.scan'), 'big secondary', () => games.transfer.receive()],
      [t('common.cancel'), 'big secondary', hideOverlay],
    ],
  });
}

const CODE_PROBLEM = { revoked: 'code.revoked', limit: 'code.limit', unsupported: 'code.old', invalid: 'code.retry' };

/**
 * Check a code (offline, then the one activation call) and open everything like a purchase.
 * `again`: what "Try again" does on a problem (none for the mail's link: no gate there);
 * `after`: what happens after the happy card. Never logs the code.
 */
async function redeemCode(text, { again = null, after = null } = {}) {
  showOverlay({ title: t('busy.title'), text: t('code.checking'), buttons: [] });
  const r = await unlock.redeem(String(text ?? '').slice(0, MAX_INPUT));
  if (r.already) {
    showOverlay({ art: LOCK_ART, title: t('offer.title'), text: t('offer.owned'), buttons: [[t('common.ok'), 'big primary', after || hideOverlay]] });
    return r;
  }
  if (r.ok) {
    showUnlocked(t('unlocked.code'), after);
    return r;
  }
  const buttons = again
    ? [
        [t('code.again'), 'big primary', again],
        [t('common.cancel'), 'big secondary', hideOverlay],
      ]
    : [[t('common.ok'), 'big primary', hideOverlay]];
  showOverlay({ art: LOCK_ART, title: t('code.problem'), text: t(CODE_PROBLEM[r.reason] || 'code.bad'), buttons });
  return r;
}

/** A kept code that no longer opens anything (revoked, or over the device limit): say so kindly. */
function showCodeRefused(reason) {
  showOverlay({ art: LOCK_ART, title: t('code.problem'), text: t(CODE_PROBLEM[reason] || 'code.bad'), buttons: [[t('common.ok'), 'big primary', hideOverlay]] });
}

function showBusy() {
  showOverlay({ title: t('busy.title'), text: t('busy.text'), buttons: [] });
}

function showUnlocked(title, after = null) {
  showOverlay({
    art: `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`,
    title,
    text: t('unlocked.text'),
    buttons: [[t('unlocked.go'), 'big primary', after || hideOverlay]],
  });
}

function showStoreProblem(text) {
  showOverlay({ title: t('problem.title'), text, buttons: [[t('common.ok'), 'big primary', hideOverlay]] });
}

async function buyFullVersion() {
  showBusy();
  const r = await unlock.buy();
  if (r.ok && (r.owned || unlock.owned)) showUnlocked(t('unlocked.bought'));
  else if (r.ok && r.pending) showOverlay({ title: t('pending.title'), text: t('pending.text'), buttons: [[t('common.ok'), 'big primary', hideOverlay]] });
  else if (r.reason === 'cancelled') hideOverlay();
  else showStoreProblem(t('problem.noAnswer'));
}

async function restoreFullVersion() {
  showBusy();
  const r = await unlock.restore();
  if (r.ok && r.owned) showUnlocked(t('unlocked.restored'));
  else if (r.ok) showStoreProblem(t('problem.noPurchase'));
  else showStoreProblem(t('problem.noAnswer'));
}

// Parental gate (parental-gate.js): an adult question before buying or restoring.
function askParent(onPass) {
  const gate = createGate({ lang: getLang() });
  let input = null;
  const submit = () => {
    const result = gate.check(input.value);
    if (result === 'pass') onPass();
    else if (result === 'closed') hideOverlay();
    else ask(t('gate.wrong'));
  };
  const ask = (lead) => {
    input = showOverlay({
      title: t('gate.title'),
      text: `${lead} ${gate.question}`,
      field: { label: t('gate.label'), onEnter: submit },
      buttons: [
        [t('gate.ok'), 'big primary', submit],
        [t('common.cancel'), 'big secondary', hideOverlay],
      ],
    });
  };
  ask(t('gate.lead'));
}

// ---------- overlay ----------

function showOverlay({ art = '', title = '', text = '', buttons = [], field = null, parents = null }) {
  $('#ov-art').innerHTML = art;
  $('#ov-title').textContent = title;
  $('#ov-text').textContent = text;
  const box = $('#ov-buttons');
  box.textContent = '';
  // a small way in for parents under the child's buttons (the website's offer only)
  const extra = $('#ov-parents');
  extra.textContent = '';
  extra.hidden = !parents;
  if (parents) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn link ov-parents-btn';
    b.textContent = parents[0];
    b.addEventListener('click', () => {
      tap();
      parents[1]();
    });
    extra.appendChild(b);
  }
  let input = null;
  if (field) {
    input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    if (field.kind === 'code') {
      // the website's unlock code: pasted from the mail (a link works too)
      input.inputMode = 'text';
      input.maxLength = MAX_INPUT;
      input.spellcheck = false;
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('autocorrect', 'off');
      input.className = 'code-input';
    } else {
      input.inputMode = 'numeric';
      input.maxLength = 3;
      input.className = 'gate-input';
    }
    input.setAttribute('aria-label', field.label);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') field.onEnter();
    });
    box.appendChild(input);
  }
  for (const [label, cls, fn] of buttons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${cls}`;
    b.textContent = label;
    b.addEventListener('click', () => {
      tap();
      fn();
    });
    box.appendChild(b);
  }
  $('#overlay').hidden = false;
  (input || box.querySelector('button'))?.focus({ preventScroll: true });
  return input;
}

function hideOverlay() {
  $('#overlay').hidden = true;
}

// ---------- boot ----------

// The canvas games (Bubbels' hint, Slangetje, Egeltje) draw text with "Bazibo Sans"; a canvas does
// not wait for a web font, so boot waits for it (never longer than a second; offline it is cached).
function fontReady() {
  if (!document.fonts?.load) return Promise.resolve();
  const load = Promise.all([document.fonts.load('900 20px "Bazibo Sans"'), document.fonts.load('800 20px "Bazibo Sans"')]).catch(() => {});
  return Promise.race([load, new Promise((done) => setTimeout(done, 1000))]);
}

async function boot() {
  listenForBack(); // first, so the button works even if loading fails below
  await store.init();
  settings = store.loadSettings();
  // a saved choice first, then the address (?lang=, for search engines: js/seo.js), then the device
  setLang(pickLang(settings.lang, [urlLang(location.search), ...(navigator.languages || [navigator.language])]));
  sfx.setMuted(settings.muted);
  // the app: the store (never a code); the website: the signed code; anything else: nothing to buy
  const billing = isNativeApp()
    ? createNativeBilling()
    : WEB_CODE
      ? createCodeBilling({
          load: () => store.loadWebUnlock(),
          keep: (entry) => store.saveWebUnlock(entry),
          verify: (code) => verifyCode(code, { publicKey: unlockKey(), revoked: unlockRevoked() }),
          activate: (code) => activate(code, deviceId()),
          online: () => navigator.onLine !== false,
          onRefused: (reason) => whenReady(() => showCodeRefused(reason)),
        })
      : noBilling;
  unlock = createUnlock({ billing, cache: billing.kind === 'code' ? NO_CACHE : store.fullCache });
  unlock.onChange(() => {
    if ($('#screen-settings').classList.contains('active')) renderSettings();
  });
  // the website checks its kept code before the games draw their menus (offline, a few ms)
  const codeStart = unlock.kind === 'code' ? await unlock.start() : null;
  games.bubbels = createBubbels({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    isMuted: () => settings.muted,
    setMuted,
    onMutedChange: (fn) => soundListeners.add(fn),
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.dogudoku = createDogudoku({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.picturedoku = createPicturedoku({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.memory = createMemory({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.legpuzzel = createLegpuzzel({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.vier = createVier({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.dammen = createDammen({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.baghchal = createBaghchal({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.schaak = createSchaak({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.ganzen = createGanzen({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.pachisi = createPachisi({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.kwartet = createKwartet({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.kleuren = createKleuren({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.tekenen = createTekenen({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.slang = createSlang({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.klok = createKlok({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.letters = createLetters({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.verstop = createVerstop({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.treintje = createTreintje({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.kermis = createKermis({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.keuken = createKeuken({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.kangoeroe = createKangoeroe({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.winkel = createWinkel({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.kaart = createKaart({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.doolhof = createDoolhof({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.piano = createPiano({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    isMuted: () => settings.muted,
    setMuted,
    onMutedChange: (fn) => soundListeners.add(fn),
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.drums = createDrums({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    unlock,
    isMuted: () => settings.muted,
    setMuted,
    onMutedChange: (fn) => soundListeners.add(fn),
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  // Papegaai asks a grown-up (the parental gate) before the microphone the first time on a device;
  // the shell keeps only that yes (storage.js `micGate`), never anything the game heard
  games.papegaai = createPapegaai({
    t,
    show,
    showOverlay,
    hideOverlay,
    offerUnlock,
    askParent,
    micGate: { passed: () => store.micGatePassed(), pass: () => store.saveMicGatePassed() },
    unlock,
    isMuted: () => settings.muted,
    setMuted,
    onMutedChange: (fn) => soundListeners.add(fn),
    onShow: (fn) => showHooks.push(fn),
    onLangChange,
    tap,
  });
  games.transfer = createTransfer({
    t,
    show,
    showOverlay,
    hideOverlay,
    onShow: (fn) => showHooks.push(fn),
    tap,
    // the website only: a scanned or pasted unlock code (behind the same gate as this screen)
    onCode: unlock.kind === 'code' ? (text) => redeemCode(text, { again: () => games.transfer.resume(), after: () => show('settings') }) : null,
  });
  renderLanguage();
  drawTileArt();
  drawDoguTile();
  drawPicturedokuTile();
  drawMemoryTile();
  drawPuzzelTile();
  drawVierTile();
  drawDammenTile();
  drawBaghchalTile();
  drawSchaakTile();
  drawGanzenTile();
  drawPachisiTile();
  drawKwartetTile();
  drawSlangTile();
  drawKleurenTile();
  drawTekenenTile();
  drawKlokTile();
  drawLettersTile();
  drawVerstopTile();
  drawTreintjeTile();
  drawKeukenTile();
  drawKermisTile();
  drawKangoeroeTile();
  drawWinkelTile();
  drawKaartTile();
  drawDoolhofTile();
  drawPianoTile();
  drawDrumsTile();
  drawPapegaaiTile();
  // a Dogudoku, Picturedoku or Slangetje load error is explained when the game is opened
  // (Vier op een rij has nothing to load)
  const [ok] = await Promise.all([games.bubbels.init(), games.dogudoku.init(), games.picturedoku.init(), games.memory.init(), games.legpuzzel.init(), games.vier.init(), games.dammen.init(), games.baghchal.init(), games.schaak.init(), games.ganzen.init(), games.pachisi.init(), games.kwartet.init(), games.slang.init(), games.kleuren.init(), games.tekenen.init(), games.klok.init(), games.letters.init(), games.doolhof.init(), games.verstop.init(), games.treintje.init(), games.kangoeroe.init(), games.keuken.init(), games.kermis.init(), games.winkel.init(), games.kaart.init(), games.piano.init(), games.drums.init(), games.papegaai.init(), fontReady()]);
  if (!ok) return;
  // test and debug hook (only with ?test in the address)
  if (new URLSearchParams(location.search).has('test')) {
    window.__bubbels = {
      ...games.bubbels.testHook(),
      dogu: games.dogudoku.testHook(),
      pdoku: games.picturedoku.testHook(),
      memory: games.memory.testHook(),
      puzzel: games.legpuzzel.testHook(),
      vier: games.vier.testHook(),
      dam: games.dammen.testHook(),
      bagh: games.baghchal.testHook(),
      schaak: games.schaak.testHook(),
      gans: games.ganzen.testHook(),
      pachisi: games.pachisi.testHook(),
      kwartet: games.kwartet.testHook(),
      slang: games.slang.testHook(),
      kleur: games.kleuren.testHook(),
      teken: games.tekenen.testHook(),
      klok: games.klok.testHook(),
      letters: games.letters.testHook(),
      verstop: games.verstop.testHook(),
      treintje: games.treintje.testHook(),
      kangoeroe: games.kangoeroe.testHook(),
      keuken: games.keuken.testHook(),
      kermis: games.kermis.testHook(),
      winkel: games.winkel.testHook(),
      kaart: games.kaart.testHook(),
      doolhof: games.doolhof.testHook(),
      piano: games.piano.testHook(),
      drums: games.drums.testHook(),
      papegaai: games.papegaai.testHook(),
      transfer: games.transfer.testHook(),
      offer: () => offerUnlock(),
      gate: () => askParent(() => (document.documentElement.dataset.gate = 'passed')),
      full: () => unlock.owned,
      unlockKind: () => unlock.kind,
      lang: () => getLang(),
      save: () => store.snapshot(),
      back: () => onBack(),
    };
  }
  document.documentElement.dataset.ready = '1';
  for (const fn of readyQueue.splice(0)) fn();
  if (unlock.kind === 'code') {
    // the mail's link first; otherwise say kindly why a kept code no longer opens anything
    if (deepCode !== null) redeemCode(deepCode);
    else if (codeStart?.reason === 'revoked') showCodeRefused('revoked');
    // the link opened in a tab that already shows Bazibo only changes the #fragment: no reload
    window.addEventListener('hashchange', () => {
      const code = takeUnlockParam(window);
      if (code !== null) redeemCode(code);
    });
  } else unlock.start(); // asks the store in the app
}

// Cards that must wait until the home screen is up (a refused activation retry at startup).
const readyQueue = [];
function whenReady(fn) {
  if (starting()) readyQueue.push(fn);
  else fn();
}

// ---------- the Android back button (apps only) ----------

function currentScreen() {
  return document.querySelector('.screen.active')?.id.replace('screen-', '') || 'home';
}

function overlayState() {
  if ($('#overlay').hidden) return 'none';
  return $('#ov-buttons').querySelector('button, input') ? 'card' : 'busy';
}

function onBack() {
  const App = window.Capacitor?.Plugins?.App;
  const action = backAction({ screen: currentScreen(), overlay: overlayState() });
  if (action === 'close') hideOverlay();
  else if (action === 'levels') show('levels');
  else if (action === 'dogudoku-levels') games.dogudoku.leave();
  else if (action === 'picturedoku-levels') games.picturedoku.leave();
  else if (action === 'memory-menu') games.memory.leave();
  else if (action === 'legpuzzel-menu') games.legpuzzel.leave();
  else if (action === 'vier-menu') games.vier.leave();
  else if (action === 'vier-coop-back') games.vier.coopBack();
  else if (action === 'dammen-menu') games.dammen.leave();
  else if (action === 'baghchal-menu') games.baghchal.leave();
  else if (action === 'schaak-menu') games.schaak.leave();
  else if (action === 'ganzen-menu') games.ganzen.leave();
  else if (action === 'pachisi-menu') games.pachisi.leave();
  else if (action === 'kwartet-menu') games.kwartet.leave();
  else if (action === 'slang-menu') games.slang.leave();
  else if (action === 'kleuren-list') games.kleuren.leave();
  else if (action === 'tekenen-list') games.tekenen.back();
  else if (action === 'klok-menu') games.klok.leave();
  else if (action === 'klok-menu-back') games.klok.menuBack();
  else if (action === 'letters-menu') games.letters.leave();
  else if (action === 'letters-menu-back') games.letters.menuBack();
  else if (action === 'verstop-menu') games.verstop.leave();
  else if (action === 'treintje-menu') games.treintje.leave();
  else if (action === 'kangoeroe-menu') games.kangoeroe.leave();
  else if (action === 'winkel-menu') games.winkel.leave();
  else if (action === 'kaart-menu') games.kaart.leave();
  else if (action === 'keuken-menu') games.keuken.leave();
  else if (action === 'kermis-menu') games.kermis.leave();
  else if (action === 'doolhof-menu') games.doolhof.leave();
  else if (action === 'doolhof-menu-back') games.doolhof.menuBack();
  else if (action === 'piano-back') games.piano.back();
  else if (action === 'piano-songs-back') games.piano.songsBack();
  else if (action === 'piano-songs') games.piano.toSongs();
  else if (action === 'drums-back') games.drums.back();
  else if (action === 'drums-list-back') games.drums.listBack();
  else if (action === 'drums-list') games.drums.toList();
  else if (action === 'transfer-card') games.transfer.onBackCard();
  else if (action === 'settings') show('settings');
  else if (action === 'home') show('home');
  else if (action === 'pause') $('#btn-pause').click();
  else if (action === 'exit') App?.exitApp?.();
}

function listenForBack() {
  const App = window.Capacitor?.Plugins?.App;
  if (!isNativeApp() || !App?.addListener) return; // the website has the browser's own back
  App.addListener('backButton', onBack); // a listener replaces Capacitor's default (close the app)
}

boot();

// The apps ship their files inside the package, so only the web version needs the offline cache.
if (!isNativeApp() && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
