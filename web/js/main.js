// The shell: home screen with a tile per game, settings, the overlay card, the parental gate and
// the one purchase that opens every game. Each game lives in web/games/<id>/.
import { BRAND } from './brand.js';
import { GAMES } from './games.js';
import { t, getLang, setLang, pickLang, onLangChange, translateDom } from './i18n.js';
import { COLORS, getSprite, drawBubble } from './bubble-art.js';
import * as store from './storage.js';
import * as sfx from './audio.js';
import { createUnlock, noBilling } from './unlock.js';
import { isNativeApp, createNativeBilling } from './billing-native.js';
import { createGate } from './parental-gate.js';
import { backAction } from './back.js';
import '../games/bubbels/strings.js';
import { createBubbels } from '../games/bubbels/bubbels.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';

// Filled in boot(), after the save data has loaded (storage.js: Preferences in the apps).
let settings = { muted: false, lang: null };
let unlock = null; // the full version: bought in the Android/iOS app; on the web nothing can be bought

// ---------- screens ----------

const showHooks = [];

function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  hideOverlay();
  homeAnim.running = name === 'home';
  if (homeAnim.running) homeAnim.start();
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
  document.title = BRAND.name;
  $('#brand-name').textContent = BRAND.name;
  $('#brand-tagline').textContent = BRAND.tagline[lang];
  translateDom(document);
  $('#privacy-link').href = lang === 'en' ? 'privacy/en.html' : 'privacy/index.html';
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
}
onLangChange(renderLanguage);

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
  $('#full-status').textContent = unlock.owned ? t('settings.fullOwned') : unlock.available ? t('settings.fullApp') : t('settings.fullWeb');
  $('#btn-full').hidden = unlock.owned;
}
$('#btn-full').addEventListener('click', () => {
  tap();
  offerUnlock();
});

// ---------- home tiles ----------

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

function showBusy() {
  showOverlay({ title: t('busy.title'), text: t('busy.text'), buttons: [] });
}

function showUnlocked(title) {
  showOverlay({
    art: `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`,
    title,
    text: t('unlocked.text'),
    buttons: [[t('unlocked.go'), 'big primary', hideOverlay]],
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

function showOverlay({ art = '', title = '', text = '', buttons = [], field = null }) {
  $('#ov-art').innerHTML = art;
  $('#ov-title').textContent = title;
  $('#ov-text').textContent = text;
  const box = $('#ov-buttons');
  box.textContent = '';
  let input = null;
  if (field) {
    input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.maxLength = 3;
    input.className = 'gate-input';
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

// ---------- floating bubbles on the home screen ----------

const homeAnim = {
  running: true,
  started: false,
  looping: false,
  bubbles: [],
  start() {
    if (this.started) {
      this._loop?.();
      return;
    }
    this.started = true;
    const canvas = $('#home-bg');
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let keepOut = []; // the logo, tagline and tiles: bubbles fade while they pass behind them
    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const base = canvas.getBoundingClientRect();
      keepOut = ['.logo', '.tagline', '.tiles'].map((sel) => {
        const r = $(sel).getBoundingClientRect();
        return { x0: r.left - base.left, x1: r.right - base.left, y0: r.top - base.top, y1: r.bottom - base.top };
      });
    };
    const behindText = (x, y, r) => keepOut.some((k) => x + r > k.x0 && x - r < k.x1 && y + r > k.y0 && y - r < k.y1);
    size();
    window.addEventListener('resize', () => this.running && size());
    const make = (initial) => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 60,
      r: 14 + Math.random() * 30,
      c: Math.floor(Math.random() * COLORS.length),
      v: 18 + Math.random() * 30,
      ph: Math.random() * 6.28,
      a: 0.7,
    });
    this.bubbles = Array.from({ length: 16 }, () => make(true));
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!this.running) {
        this.looping = false; // stops until the home screen is shown again
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const b of this.bubbles) {
        if (!reduced) {
          b.y -= b.v * dt;
          b.ph += dt;
        }
        if (b.y < -60) Object.assign(b, make(false));
        const x = b.x + Math.sin(b.ph) * 12;
        const target = behindText(x, b.y, b.r) ? 0.12 : 0.7;
        b.a += (target - b.a) * Math.min(1, dt * 6);
        const spr = getSprite(b.c, b.r * dpr);
        const s = spr.width / dpr;
        ctx.globalAlpha = b.a;
        ctx.drawImage(spr, x - s / 2, b.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    };
    this._loop = () => {
      if (this.looping) return;
      this.looping = true;
      size(); // the screen may have been resized while it was hidden
      last = performance.now();
      requestAnimationFrame(frame);
    };
    this._loop();
  },
};

// ---------- boot ----------

async function boot() {
  await store.init();
  settings = store.loadSettings();
  setLang(pickLang(settings.lang, navigator.languages || [navigator.language]));
  sfx.setMuted(settings.muted);
  unlock = createUnlock({ billing: isNativeApp() ? createNativeBilling() : noBilling, cache: store.fullCache });
  unlock.onChange(() => {
    if ($('#screen-settings').classList.contains('active')) renderSettings();
  });
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
  renderLanguage();
  drawTileArt();
  homeAnim.start();
  const ok = await games.bubbels.init();
  if (!ok) return;
  // test and debug hook (only with ?test in the address)
  if (new URLSearchParams(location.search).has('test')) {
    window.__bubbels = {
      ...games.bubbels.testHook(),
      homeLoop: () => homeAnim.looping,
      offer: () => offerUnlock(),
      gate: () => askParent(() => (document.documentElement.dataset.gate = 'passed')),
      full: () => unlock.owned,
      lang: () => getLang(),
      save: () => store.snapshot(),
      back: () => onBack(),
    };
  }
  document.documentElement.dataset.ready = '1';
  listenForBack();
  unlock.start(); // asks the store in the app; a no-op on the web
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
