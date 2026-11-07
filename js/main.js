// Screens, menus and wiring. The game logic itself lives in game.js.
import { Game } from './game.js';
import { loadLevels } from './levels.js';
import { COLORS, getSprite } from './bubble-art.js';
import * as store from './storage.js';
import * as sfx from './audio.js';
import { FREE_LEVELS, isLevelLocked, allFreeLevelsDone, createUnlock, noBilling } from './unlock.js';
import { isNativeApp, createNativeBilling } from './billing-native.js';
import { createGate } from './parental-gate.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';

const progress = store.load();
let levels = [];
let index = 0; // index into levels of the level being played
let game = null;

// The full version: bought in the Android/iOS app; on the web nothing can be bought.
const unlock = createUnlock({ billing: isNativeApp() ? createNativeBilling() : noBilling, cache: store.fullCache });
const locked = (id) => isLevelLocked(id, unlock.owned);
unlock.onChange(() => {
  if ($('#screen-levels').classList.contains('active')) renderLevels();
});

sfx.setMuted(progress.muted);

// ---------- screens ----------

function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  hideOverlay();
  homeAnim.running = name === 'home';
  if (homeAnim.running) homeAnim.start();
  if (game) game.active = name === 'game';
  if (name === 'game') requestAnimationFrame(() => game.resize());
  if (name === 'levels') renderLevels();
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) {
    sfx.unlock();
    sfx.click();
    show(go.dataset.go);
  }
});

$('#btn-play').addEventListener('click', () => {
  sfx.unlock();
  sfx.click();
  const firstOpen = levels.findIndex((l) => !progress.stars[l.id] && !locked(l.id));
  play(firstOpen >= 0 ? firstOpen : 0);
});
$('#btn-levels').addEventListener('click', () => {
  sfx.unlock();
  sfx.click();
  show('levels');
});

// ---------- level select ----------

function starsText(n) {
  return [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
}

function renderLevels() {
  const free = $('#levels-free');
  const full = $('#levels-full');
  free.textContent = '';
  full.textContent = '';
  $('.full-divider').hidden = unlock.owned;
  const nextOpen = levels.find((l) => !progress.stars[l.id] && !locked(l.id));
  levels.forEach((l, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'level-btn';
    if (locked(l.id)) {
      b.innerHTML = `<span class="num">${l.id}</span><svg viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
      b.setAttribute('aria-label', `Level ${l.id}, volledige versie`);
      b.addEventListener('click', () => {
        sfx.unlock();
        sfx.click();
        showLocked();
      });
      full.appendChild(b);
    } else {
      const stars = progress.stars[l.id] || 0;
      if (nextOpen && nextOpen.id === l.id) b.classList.add('next');
      b.innerHTML = `<span class="num">${l.id}</span><span class="stars" aria-hidden="true">${starsText(stars)}</span>`;
      b.setAttribute('aria-label', `Level ${l.id}, ${stars} van 3 sterren`);
      b.addEventListener('click', () => {
        sfx.unlock();
        sfx.click();
        play(i);
      });
      free.appendChild(b);
    }
  });
}

// ---------- playing ----------

function play(i) {
  const level = levels[i];
  if (!level) return;
  if (locked(level.id)) {
    showLocked();
    return;
  }
  index = i;
  $('#hud-level').textContent = `Level ${level.id}`;
  show('game');
  game.start(level);
}

function onWin({ stars, score }) {
  const level = levels[index];
  progress.stars[level.id] = Math.max(stars, progress.stars[level.id] || 0);
  store.save(progress);
  const next = levels[index + 1];
  const nextLocked = !next || locked(next.id);
  const words = ['', 'Goed gedaan!', 'Heel goed!', 'Super!'];
  const buttons = [];
  if (!nextLocked) buttons.push(['Volgende', 'big primary', () => play(index + 1)]);
  else buttons.push(['Levels', 'big primary', () => show('levels')]);
  buttons.push(['Nog een keer', 'big secondary', () => play(index)]);
  showOverlay({
    art: [0, 1, 2].map((k) => `<svg class="star ${k < stars ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
    title: words[stars],
    text: !nextLocked ? `${score} punten` : allFreeLevelsDone(levels, progress.stars) ? `${score} punten. Je hebt alle gratis levels gehaald!` : `${score} punten. Dit was het laatste gratis level.`,
    buttons,
  });
}

function onLose() {
  showOverlay({
    title: 'Bijna!',
    text: 'De bubbels kwamen te laag. Probeer het nog een keer!',
    buttons: [
      ['Nog een keer', 'big primary', () => play(index)],
      ['Levels', 'big secondary', () => show('levels')],
    ],
  });
}

function pause() {
  if (!game || !game.active || game.phase === 'won' || game.phase === 'lost' || game.paused) return;
  game.paused = true;
  showOverlay({
    title: 'Pauze',
    buttons: [
      ['Verder', 'big primary', resume],
      ['Opnieuw', 'big secondary', () => play(index)],
      ['Levels', 'big secondary', () => show('levels')],
    ],
  });
}

function resume() {
  hideOverlay();
  if (game) game.paused = false;
}

function showLocked() {
  const art = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
  const last = levels.length || 30;
  if (!unlock.available) {
    showOverlay({
      art,
      title: 'Volledige versie',
      text: `Level ${FREE_LEVELS + 1} tot en met ${last} komen in de volledige versie van de Bubbels-app. Op deze website kun je level 1 tot en met ${FREE_LEVELS} zo vaak spelen als je wilt!`,
      buttons: [['Oké', 'big primary', hideOverlay]],
    });
    return;
  }
  const price = unlock.price();
  showOverlay({
    art,
    title: 'Volledige versie',
    text: `Level ${FREE_LEVELS + 1} tot en met ${last} zitten in de volledige versie. Eén keer betalen${price ? ` (${price})` : ''}, dan zijn alle levels open. Geen reclame, geen abonnement. Vraag het aan je papa of mama!`,
    buttons: [
      ['Voor ouders: kopen', 'big primary', () => askParent(buyFullVersion)],
      ['Aankoop herstellen', 'big secondary', () => askParent(restoreFullVersion)],
      ['Later', 'big secondary', hideOverlay],
    ],
  });
}

function showBusy() {
  showOverlay({ title: 'Even geduld…', text: 'De winkel van je telefoon is bezig.', buttons: [] });
}

function showUnlocked(title) {
  showOverlay({
    art: `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`,
    title,
    text: 'Alle levels zijn open. Veel plezier!',
    buttons: [['Naar de levels', 'big primary', () => show('levels')]],
  });
}

function showStoreProblem(text) {
  showOverlay({ title: 'Dat lukte niet', text, buttons: [['Oké', 'big primary', hideOverlay]] });
}

async function buyFullVersion() {
  showBusy();
  const r = await unlock.buy();
  if (r.ok && (r.owned || unlock.owned)) showUnlocked('Gelukt!');
  else if (r.ok && r.pending) {
    showOverlay({ title: 'Bijna klaar', text: 'De betaling wordt nog verwerkt. Daarna gaan de levels vanzelf open.', buttons: [['Oké', 'big primary', hideOverlay]] });
  } else if (r.reason === 'cancelled') hideOverlay();
  else showStoreProblem('De winkel gaf geen antwoord. Probeer het later nog eens.');
}

async function restoreFullVersion() {
  showBusy();
  const r = await unlock.restore();
  if (r.ok && r.owned) showUnlocked('Hersteld!');
  else if (r.ok) showStoreProblem('Er is geen aankoop gevonden bij dit account.');
  else showStoreProblem('De winkel gaf geen antwoord. Probeer het later nog eens.');
}

// Parental gate (parental-gate.js): an adult question before buying or restoring.
function askParent(onPass) {
  const gate = createGate();
  let input = null;
  const submit = () => {
    const result = gate.check(input.value);
    if (result === 'pass') onPass();
    else if (result === 'closed') hideOverlay();
    else ask('Dat klopt niet. Nieuwe vraag:');
  };
  const ask = (lead) => {
    input = showOverlay({
      title: 'Vraag voor ouders',
      text: `${lead} ${gate.question}`,
      field: { label: 'Antwoord (in cijfers)', onEnter: submit },
      buttons: [
        ['OK', 'big primary', submit],
        ['Annuleren', 'big secondary', hideOverlay],
      ],
    });
  };
  ask('Typ het antwoord in cijfers.');
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
      sfx.unlock();
      sfx.click();
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

// ---------- HUD ----------

$('#btn-pause').addEventListener('click', () => {
  sfx.unlock();
  sfx.click();
  pause();
});

function renderMute() {
  const b = $('#btn-mute');
  b.setAttribute('aria-pressed', String(progress.muted));
  b.setAttribute('aria-label', progress.muted ? 'Geluid aan' : 'Geluid uit');
}
$('#btn-mute').addEventListener('click', () => {
  sfx.unlock();
  progress.muted = !progress.muted;
  sfx.setMuted(progress.muted);
  store.save(progress);
  renderMute();
  sfx.click();
});
renderMute();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p') {
    if (game?.paused) resume();
    else pause();
  }
});

// ---------- floating bubbles on the start screen ----------

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
    let keepOut = []; // the logo and tagline: bubbles fade while they pass behind the text
    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const base = canvas.getBoundingClientRect();
      keepOut = ['.logo', '.tagline'].map((sel) => {
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
        this.looping = false; // stops until the start screen is shown again
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
  game = new Game($('#game'), { onWin, onLose, onScore: (s) => ($('#hud-score').textContent = String(s)) });
  homeAnim.start();
  try {
    levels = await loadLevels();
  } catch (err) {
    console.error(err);
    showOverlay({ title: 'Oeps', text: 'De levels konden niet geladen worden.', buttons: [['Opnieuw', 'big primary', () => location.reload()]] });
    return;
  }
  // test and debug hook (only with ?test in the address): read-only state, fire at an angle
  if (new URLSearchParams(location.search).has('test')) {
    window.__bubbels = {
      state: () => ({ ...game.snapshot(), loop: game.running, homeLoop: homeAnim.looping }),
      fire: (deg) => game.fire((deg * Math.PI) / 180),
      play: (i) => play(i),
      locked: () => showLocked(),
      gate: () => askParent(() => (document.documentElement.dataset.gate = 'passed')),
      full: () => unlock.owned,
    };
  }
  document.documentElement.dataset.ready = '1';
  unlock.start(); // asks the store in the app; a no-op on the web
}

boot();

// The apps ship their files inside the package, so only the web version needs the offline cache.
if (!isNativeApp() && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
