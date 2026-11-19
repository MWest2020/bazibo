// Ludo and Pachisi, one race game in two modes (modes.js). Ludo is the default: throw one die,
// a 6 brings a pawn onto your start square, walk round the cross of 40 squares into your own four
// home squares (ludo-rules.js). Pachisi is the original game from India: throw six cowrie shells,
// count the ones that land open (mouth up) and walk a pawn from the Charkoni in the middle down its
// own arm, round the whole cloth and back up into the middle (rules.js). The computer players are
// in ludo-ai.js and ai.js, the pictures in ludo-art.js and art.js; the shell (web/js/main.js) owns
// the overlay card, the sound settings and the purchase, and passes them in as `shell`.
//
// "Zelf tellen" (count yourself): after the throw the child taps the pips of the die (or the open
// shells) one by one and each one shows its count; then the steps show. Without it the throw
// counts itself. Then the pawns that can move glow; a tap on one makes the square it would reach
// glow (with small dots on the way), and a tap on that square walks it there, hop by hop, with the
// count on every square. When only one pawn can move it is picked already. Squares are small on a
// phone, so a tap goes to the nearest thing that can be tapped now, within a round area of 44 px
// or more round it. No voice (as in Ganzenbord), no timers. A captured pawn is never beaten: it
// walks back to its start and starts again.
//
// Players: 2 (free) to 4 (full version), each a child or the computer (easy free, medium in the
// full version), in either mode. Saved (games.pachisi; the id stays for save compatibility):
// `setup` { mode: 'ludo'|'pachisi', players: ['kid'|'cpu', ...], level, pawns, count } and `stars`
// { 'ludo-cpu-<level>' / 'cpu-<level>' (Pachisi): games a child won against the computer }
// (counters that only go up).
import { meta } from './meta.js';
import { MAX_PLAYERS, PAWN_COUNTS, mulberry32 } from './rules.js';
import { MODE_IDS, PACHISI, modeOf, pachisiSpots, pachisiPlace } from './modes.js';
import { pawnSvg, shellSvg, miniBoardSvg as clothMiniSvg, LOOKS } from './art.js';
import { dieSvg, miniBoardSvg as ludoMiniSvg, PIPS } from './ludo-art.js';
import { robotBadge, kidSvg } from '../ganzen/art.js';
import { robotSvg } from '../vier/art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const SWAP = '<svg class="swap" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 0 0-13.5-2M5 16a8 8 0 0 0 13.5 2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M5 2.5v4h4M19 21.5v-4h-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const UNDO = '<path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';

export const DEFAULT_SETUP = Object.freeze({ mode: 'ludo', players: Object.freeze(['kid', 'cpu']), level: 1, pawns: 4, count: true });
const HOP = 230; // ms per square
const PAUSE = 900; // ms to read a message
const CPU_WAIT = 700; // ms before the computer throws
const CPU_PICK = 550; // ms the computer's choice glows before it walks
/** The smallest tap area round anything that can be tapped on the board, in px. */
export const MIN_HIT = 44;

/** The counter key for a child's win against the computer at a level, per mode (Pachisi keeps its first keys). */
export const winKey = (level, mode = 'ludo') => (mode === 'pachisi' ? `cpu-${level}` : `ludo-cpu-${level}`);

/**
 * A saved setup, made safe: a known mode (a save from before Ludo has none: Ludo), 2-4 players of
 * a known kind, a known level, 2 or 4 pawns, count on or off.
 */
export function cleanSetup(s) {
  const out = { mode: DEFAULT_SETUP.mode, players: DEFAULT_SETUP.players.slice(), level: DEFAULT_SETUP.level, pawns: DEFAULT_SETUP.pawns, count: DEFAULT_SETUP.count };
  if (!s || typeof s !== 'object') return out;
  if (MODE_IDS.includes(s.mode)) out.mode = s.mode;
  if (Array.isArray(s.players) && s.players.length >= 2 && s.players.length <= MAX_PLAYERS && s.players.every((p) => p === 'kid' || p === 'cpu')) out.players = s.players.slice();
  if (s.level === 1 || s.level === 2) out.level = s.level;
  if (PAWN_COUNTS.includes(s.pawns)) out.pawns = s.pawns;
  if (typeof s.count === 'boolean') out.count = s.count;
  return out;
}

/** Pachisi's pawn spots and places (kept here under their old names; Ludo's are in modes.js). */
export const pawnSpots = pachisiSpots;
export const placeOf = pachisiPlace;

/**
 * What can be tapped on the board now, in cell units: the selected pawn's target first, then every
 * pawn that can move, each where pawnSpots draws it (two pawns on one square sit side by side, so
 * each can be tapped). `sel`: the selected move's `from`, or null.
 */
export function buildHits(g, shown, sel, mode = PACHISI) {
  const k = g.turn;
  const moves = mode.legalMoves(g);
  const spots = mode.pawnSpots(g.seats, shown);
  const out = [];
  const chosen = sel === null || sel === undefined ? null : moves.find((m) => m.from === sel);
  if (chosen) {
    const pl = mode.placeOf(g.seats, k, chosen.to);
    out.push({ kind: 'target', from: chosen.from, to: chosen.to, x: pl.x, y: pl.y });
  }
  for (const m of moves) {
    g.pawns[k].forEach((pos, i) => {
      if (pos === m.from) out.push({ kind: 'pawn', from: m.from, pawn: i, x: spots[k][i].x, y: spots[k][i].y });
    });
  }
  return out;
}

/**
 * The hit a tap at (x, y) (cell units) goes to: the nearest one within its round area of `MIN_HIT`
 * px or more (`cell`: px per square), or null. The glowing target wins over a pawn that stands on
 * or right next to it (within half a square more), so a pawn can always walk onto its own pawn.
 */
export function pickHit(hits, x, y, cell) {
  const reach = (Math.max(MIN_HIT, cell * 1.8) * 0.62) / cell;
  let best = null;
  let bestD = Infinity;
  for (const h of hits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  if (!best || bestD > reach) return null;
  const target = hits.find((h) => h.kind === 'target');
  if (target && best !== target) {
    const dT = Math.hypot(target.x - x, target.y - y);
    if (dT <= reach && dT <= bestD + 0.5) return target;
  }
  return best;
}

/**
 * A tap on a pawn that is selected already, with another movable pawn drawn right beside it on the
 * same square (a tiny phone square): the other one, so a second tap switches. Else null.
 */
export function otherOnSquare(hits, h) {
  return hits.find((o) => o.kind === 'pawn' && o.from !== h.from && Math.hypot(o.x - h.x, o.y - h.y) < 0.75) || null;
}

export function createPachisi(shell) {
  const { t, tap } = shell;
  const $ = (sel) => document.querySelector(sel);
  const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const wins = () => store.loadProgress(meta.id).stars;

  let choice = null; // the menu's choice
  let game = null; // { setup, g, shown, phase, sel, counted, history, msg, pendingThrow, pendingMove, over }
  let plays = 0; // bumps on start / leave / undo: every running animation checks it and stops
  let speed = 1; // tests make it faster
  let forced = []; // tests: the next throws (Ludo: 1-6; Pachisi: arrays of six booleans)
  let rand = Math.random; // tests: a seeded generator for the throws and the computer
  let cell = 16; // px per square
  let pawnEls = []; // [player][pawn] -> element
  let cpuTimer = null;
  let hits = []; // the things that can be tapped on the board now: { kind, from, x, y, el }

  const locked = (setup) => meta.isLocked(setup, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const sleep = (ms) => new Promise((r) => setTimeout(r, (reducedMotion() ? Math.min(ms, 120) : ms) * speed));
  const nameOf = (k) => t(`pachisi.p.${LOOKS[k].id}`);
  const isCpu = (k) => game?.setup.players[k] === 'cpu';
  const kids = () => game.setup.players.filter((p) => p === 'kid').length;
  const isYou = (k) => !isCpu(k) && kids() === 1;
  const whoName = (k) => (isYou(k) ? t('pachisi.you') : nameOf(k));
  const hasCpu = () => game.setup.players.includes('cpu');
  /** The mode being played (or chosen in the menu). */
  const M = () => (game ? game.mode : modeOf(choice?.mode));
  /** A line that differs per mode: `ludo.<key>` or `pachisi.<key>`. */
  const tm = (key, vars) => t(`${M().id}.${key}`, vars);

  shell.unlock.onChange(() => {
    if (onScreen('pachisi-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'pachisi-menu') renderMenu();
    if (name === 'pachisi') requestAnimationFrame(fitBoard);
  });
  shell.onLangChange(() => {
    if (onScreen('pachisi-menu')) renderMenu();
    if (game) {
      $('#pachisi-board').setAttribute('aria-label', tm('boardLabel'));
      renderHud();
      renderTurn();
      renderMarks();
    }
  });
  window.addEventListener('resize', () => onScreen('pachisi') && fitBoard());

  // ---------- menu ----------

  function renderMenu() {
    if (!choice) choice = cleanSetup(store.loadGameOption(meta.id, 'setup', null));
    if (!shell.unlock.owned) {
      // refunded, or the website: back to what is free
      if (choice.players.length > meta.freePlayers) choice.players = choice.players.slice(0, meta.freePlayers);
      if (!meta.freeLevels.includes(choice.level)) choice.level = 1;
    }
    const box = $('#pachisi-menu');
    box.textContent = '';
    const lockIcon = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
    const head = (key) => {
      const h = document.createElement('h3');
      h.className = 'vier-head';
      h.textContent = t(key);
      box.appendChild(h);
    };
    const option = ({ art, title, sub, pressed, onPick, cls = '' }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-opt pachisi-opt ${cls}`;
      b.setAttribute('aria-pressed', String(!!pressed));
      b.innerHTML = `<span class="vier-opt-art">${art}</span><span class="vier-opt-text"><span class="vier-opt-title"></span><span class="vier-opt-sub"></span></span>`;
      b.querySelector('.vier-opt-title').textContent = title;
      b.querySelector('.vier-opt-sub').textContent = sub;
      b.addEventListener('click', () => {
        tap();
        onPick();
      });
      return b;
    };

    // which game: Ludo (the default) or Pachisi, the original from India
    head('pachisi.modeHead');
    const modes = document.createElement('div');
    modes.className = 'vier-row pachisi-modes';
    for (const id of MODE_IDS) {
      modes.appendChild(
        option({
          art: `<span class="pachisi-modeart">${id === 'ludo' ? ludoMiniSvg() : clothMiniSvg()}</span>`,
          title: t(`pachisi.mode.${id}`),
          sub: t(`pachisi.mode.${id}Sub`),
          pressed: choice.mode === id,
          cls: `mode-${id}`,
          onPick: () => {
            choice.mode = id;
            renderMenu();
          },
        }),
      );
    }
    box.appendChild(modes);

    const intro = document.createElement('div');
    intro.className = 'pachisi-intro';
    intro.innerHTML = `<span class="pachisi-intro-art">${choice.mode === 'ludo' ? dieSvg(6) : shellSvg(true)}</span><p></p>`;
    intro.querySelector('p').textContent = tm('how');
    box.appendChild(intro);

    // the players: a child, the computer or (3rd and 4th) nobody
    head('pachisi.playersHead');
    const list = document.createElement('div');
    list.className = 'ganzen-players pachisi-players';
    for (let k = 0; k < MAX_PLAYERS; k++) {
      const kind = choice.players[k] || 'off';
      const isLocked = k >= meta.freePlayers && locked({ players: new Array(k + 1).fill('kid'), level: 1 });
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `ganzen-slot pachisi-slot slot-${k} kind-${kind} ${isLocked ? 'locked' : ''}`;
      b.dataset.slot = String(k);
      const who = kind === 'kid' ? kidSvg() : kind === 'cpu' ? robotBadge() : '';
      b.innerHTML = `<span class="slot-goose">${pawnSvg(k)}</span><span class="slot-text"><span class="slot-name"></span><span class="slot-kind">${who}<span></span></span></span>${isLocked ? lockIcon : SWAP}`;
      b.querySelector('.slot-name').textContent = nameOf(k);
      b.querySelector('.slot-kind > span').textContent = t(`pachisi.kind.${kind}`);
      b.setAttribute('aria-label', isLocked ? t('pachisi.slotLocked', { name: nameOf(k) }) : t('pachisi.slotLabel', { name: nameOf(k), kind: t(`pachisi.kind.${kind}`) }));
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('pachisi.lockedPlayers'));
          return;
        }
        // kid -> computer -> (not playing, for the 3rd and 4th) -> kid
        const order = k < 2 ? ['kid', 'cpu'] : ['off', 'kid', 'cpu'];
        const next = order[(order.indexOf(kind) + 1) % order.length];
        const players = [];
        for (let j = 0; j < MAX_PLAYERS; j++) {
          const v = j === k ? next : choice.players[j] || 'off';
          if (v !== 'off') players.push(v);
          else if (j >= 2) break; // the players sit in order: an empty 3rd seat ends the list
        }
        choice.players = players;
        renderMenu();
      });
      list.appendChild(b);
    }
    box.appendChild(list);

    // the computer's level, when the computer plays
    if (choice.players.includes('cpu')) {
      head('pachisi.levelHead');
      const row = document.createElement('div');
      row.className = 'vier-levels pachisi-levels';
      row.setAttribute('role', 'group');
      const counts = wins();
      for (const level of [1, 2]) {
        const isLocked = locked({ players: ['kid', 'cpu'], level });
        const n = counts[winKey(level, choice.mode)] || 0;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `vier-level pachisi-level ${isLocked ? 'locked' : ''}`;
        b.dataset.level = String(level);
        b.setAttribute('aria-pressed', String(choice.level === level));
        const dots = [1, 2].map((d) => `<i class="${d <= level ? 'on' : ''}"></i>`).join('');
        b.innerHTML = `<span class="dots" aria-hidden="true">${dots}</span><span class="lv-name"></span>${isLocked ? lockIcon : n ? '<span class="lv-wins"></span>' : ''}`;
        b.querySelector('.lv-name').textContent = t(`pachisi.level${level}`);
        if (!isLocked && n) b.querySelector('.lv-wins').textContent = t('pachisi.wins', { n });
        b.setAttribute('aria-label', isLocked ? t('pachisi.levelLocked', { level: t(`pachisi.level${level}`) }) : t(`pachisi.level${level}`));
        b.addEventListener('click', () => {
          tap();
          if (isLocked) {
            shell.offerUnlock(t('pachisi.lockedLevel'));
            return;
          }
          choice.level = level;
          renderMenu();
        });
        row.appendChild(b);
      }
      box.appendChild(row);
    }

    head('pachisi.pawnsHead');
    const pawns = document.createElement('div');
    pawns.className = 'vier-row';
    for (const n of PAWN_COUNTS) {
      pawns.appendChild(
        option({
          art: `<span class="pachisi-pawnrow n${n}">${pawnSvg(0).repeat(n)}</span>`,
          title: t(`pachisi.pawns${n}`),
          sub: n === 4 ? tm('pawns4Sub') : t('pachisi.pawns2Sub'),
          pressed: choice.pawns === n,
          cls: `pawns-${n}`,
          onPick: () => {
            choice.pawns = n;
            renderMenu();
          },
        }),
      );
    }
    box.appendChild(pawns);

    head('pachisi.countHead');
    const counting = document.createElement('div');
    counting.className = 'vier-row';
    for (const on of [true, false]) {
      counting.appendChild(
        option({
          art: on ? `<span class="pachisi-countart">${choice.mode === 'ludo' ? dieSvg(3) : shellSvg(true) + shellSvg(true) + shellSvg(false)}</span>` : `<span class="pachisi-countart"><b>3</b></span>`,
          title: t(on ? 'pachisi.countSelf' : 'pachisi.countAuto'),
          sub: tm(on ? 'countSelfSub' : 'countAutoSub'),
          pressed: choice.count === on,
          cls: `count-${on ? 'on' : 'off'}`,
          onPick: () => {
            choice.count = on;
            renderMenu();
          },
        }),
      );
    }
    box.appendChild(counting);

    const actions = document.createElement('div');
    actions.className = 'vier-actions';
    if (game && !game.over && game.mode.id === choice.mode) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'pachisi-continue';
      cont.className = 'btn big secondary';
      cont.textContent = t('pachisi.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      actions.appendChild(cont);
    }
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.id = 'pachisi-play';
    playBtn.className = 'btn big primary';
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg><span></span>';
    playBtn.querySelector('span').textContent = t('pachisi.play');
    playBtn.addEventListener('click', () => {
      tap();
      start();
    });
    actions.appendChild(playBtn);
    box.appendChild(actions);
  }

  // ---------- a game ----------

  function start() {
    if (!choice) choice = cleanSetup(store.loadGameOption(meta.id, 'setup', null));
    const setup = cleanSetup(choice);
    if (locked(setup)) {
      shell.offerUnlock(t(setup.players.length > meta.freePlayers ? 'pachisi.lockedPlayers' : 'pachisi.lockedLevel'));
      return;
    }
    store.saveGameOption(meta.id, 'setup', setup);
    plays++;
    clearTimeout(cpuTimer);
    const mode = modeOf(setup.mode);
    const g = mode.newGame(setup.players.length, setup.pawns);
    game = { setup, mode, g, shown: g.pawns.map((p) => p.slice()), phase: 'roll', sel: null, counted: new Set(), history: [], msg: '', pendingThrow: null, pendingMove: null, over: false };
    buildBoard();
    renderHud();
    shell.show('pachisi');
    renderTurn();
    beginTurn();
  }

  function resume() {
    if (!game) return;
    buildBoard();
    renderHud();
    shell.show('pachisi');
    renderTurn();
    if (game.over) {
      showEndCard();
      return;
    }
    if (game.phase === 'move') enterMove();
    else beginTurn();
  }

  function again() {
    shell.hideOverlay();
    if (!game) return;
    choice = { ...game.setup, players: game.setup.players.slice() };
    start();
  }

  /** Finish whatever was halfway (leaving the board): the throw or the move counts as made. */
  function settle() {
    if (!game) return;
    if (game.pendingThrow) {
      game.g = game.pendingThrow.game;
      game.pendingThrow = null;
      game.phase = game.g.roll ? 'move' : 'roll';
    }
    if (game.pendingMove) {
      game.g = game.pendingMove.game;
      game.pendingMove = null;
      game.phase = game.g.over ? 'over' : game.g.roll ? 'move' : 'roll';
    }
    game.counted = new Set();
    game.sel = null;
    game.msg = '';
    game.shown = game.g.pawns.map((p) => p.slice());
  }

  function buildBoard() {
    const el = $('#pachisi-board');
    el.textContent = '';
    el.classList.toggle('ludo', game.mode.id === 'ludo');
    el.setAttribute('aria-label', tm('boardLabel'));
    el.insertAdjacentHTML('afterbegin', game.mode.boardSvg(game.g.seats));
    for (const cls of ['pachisi-marks', 'pachisi-pawns', 'pachisi-hits']) {
      const layer = document.createElement('div');
      layer.className = cls;
      el.appendChild(layer);
    }
    pawnEls = game.g.pawns.map((list, k) =>
      list.map((_, i) => {
        const p = document.createElement('span');
        p.className = `ppawn p${k}`;
        p.dataset.player = String(k);
        p.dataset.pawn = String(i);
        p.innerHTML = pawnSvg(k);
        el.querySelector('.pachisi-pawns').appendChild(p);
        return p;
      }),
    );
    buildTray();
    renderTray();
    fitBoard();
  }

  function renderHud() {
    $('#pachisi-sub').textContent = hasCpu() ? t(`pachisi.level${game.setup.level}`) : t('pachisi.together');
    $('#pachisi-title').textContent = t(`pachisi.mode.${game.mode.id}`);
  }

  function renderTurn() {
    const box = $('#pachisi-turn');
    box.textContent = '';
    box.classList.toggle('many', game.setup.players.length > 2);
    game.setup.players.forEach((kind, k) => {
      const chip = document.createElement('span');
      chip.className = 'vier-chip pachisi-chip';
      chip.dataset.player = String(k);
      const dots = game.g.pawns[k].map(() => '<i></i>').join('');
      chip.innerHTML = `${pawnSvg(k)}<span class="name"></span>${kind === 'cpu' ? robotBadge() : ''}<span class="home-dots" aria-hidden="true">${dots}</span><span class="arrow" aria-hidden="true"></span>`;
      chip.querySelector('.name').textContent = whoName(k);
      box.appendChild(chip);
    });
    updateTurn();
  }

  /** The chips, the tray and the line under it. */
  function updateTurn() {
    if (!game) return;
    const g = game.g;
    const cur = g.turn;
    for (const chip of document.querySelectorAll('#pachisi-turn .pachisi-chip')) {
      const k = Number(chip.dataset.player);
      chip.classList.toggle('on', !game.over && k === cur);
      chip.classList.toggle('winner', game.over && g.winner === k);
      chip.classList.toggle('thinking', !game.over && k === cur && isCpu(k));
      const home = game.shown[k].filter(game.mode.isDone).length;
      chip.querySelectorAll('.home-dots i').forEach((d, i) => d.classList.toggle('on', i < home));
      chip.setAttribute('aria-label', `${nameOf(k)}${isCpu(k) ? `, ${t('pachisi.kind.cpu')}` : ''}: ${t('pachisi.homeCount', { n: home, all: g.pawns[k].length })}`);
    }
    const tray = $('#pachisi-tray');
    const canThrow = !game.over && game.phase === 'roll' && !isCpu(cur);
    tray.classList.toggle('ready', canThrow);
    tray.classList.toggle('counting', game.phase === 'count');
    tray.setAttribute('aria-label', game.phase === 'count' ? tm('trayCount') : tm('trayLabel'));
    tray.setAttribute('aria-disabled', String(!(canThrow || game.phase === 'count')));
    let text = game.msg;
    if (!text && !game.over) {
      if (game.phase === 'count') text = tm('countNow');
      else if (game.phase === 'roll') text = isCpu(cur) ? t('pachisi.cpuThrows', { name: nameOf(cur) }) : kids() === 1 ? tm('yourThrow') : tm('throw', { name: nameOf(cur) });
      else if (game.phase === 'move' && !isCpu(cur)) text = t(game.sel === null ? 'pachisi.pickPawn' : 'pachisi.pickTarget');
    }
    $('#pachisi-status').textContent = text;
    const res = $('#pachisi-result');
    const roll = game.phase === 'shown' ? game.pendingThrow?.roll : game.phase === 'move' ? g.roll : null;
    res.hidden = !roll;
    res.textContent = roll ? String(roll.steps) : '';
    res.classList.toggle('grace', !!roll?.grace);
    $('#pachisi-undo').disabled = !canUndo();
  }

  function setMsg(text) {
    game.msg = text;
    updateTurn();
  }

  // ---------- the throw: the shells or the die ----------

  /** The tray's insides for the mode: six shells, or one die with room for six pips. */
  function buildTray() {
    const tray = $('#pachisi-tray');
    const ludo = game.mode.id === 'ludo';
    if (tray.dataset.mode === game.mode.id) return;
    tray.dataset.mode = game.mode.id;
    tray.classList.toggle('die', ludo);
    tray.innerHTML = ludo
      ? '<span class="pdie"><span class="pdie-face"></span></span>'
      : Array.from({ length: 6 }, (_, i) => `<span class="pshell" data-i="${i}"><span class="pshell-face"></span><span class="pshell-n" aria-hidden="true"></span></span>`).join('');
  }

  /** The roll the tray shows: as thrown, the last one, or none before the first throw. */
  const trayRoll = () => (!game || game.phase === 'roll' ? null : game.pendingThrow?.roll || game.g.roll || game.lastRoll || null);

  /** The tray: the shells as thrown (or all closed before a throw), or the die with its pips. */
  function renderTray() {
    if (!game) return;
    const roll = trayRoll();
    if (game.mode.id === 'ludo') return renderDie(roll);
    const tray = $('#pachisi-tray');
    // before a throw the shells lie on their backs; after it they show the last throw
    const shells = roll?.shells || null;
    tray.querySelectorAll('.pshell').forEach((s, i) => {
      const open = !!shells?.[i];
      const key = shells ? (open ? 'o' : 's') : 'x';
      if (s.dataset.face !== key) {
        s.dataset.face = key;
        s.querySelector('.pshell-face').innerHTML = shellSvg(open);
      }
      s.classList.toggle('open', open);
      s.classList.toggle('counted', !!game?.counted.has(i));
      s.classList.toggle('can', game?.phase === 'count' && open && !game.counted.has(i));
      s.setAttribute('aria-label', shells ? t(open ? 'pachisi.shellOpen' : 'pachisi.shellShut') : t('pachisi.shellShut'));
      const n = s.querySelector('.pshell-n');
      const order = game?.countOrder?.indexOf(i) ?? -1;
      n.textContent = game?.counted.has(i) && order >= 0 ? String(order + 1) : '';
    });
  }

  /** The die: its pips (each one a spot the child can tap and count), or a resting face. */
  function renderDie(roll, value = roll?.value) {
    const face = $('#pachisi-tray .pdie-face');
    if (!face) return;
    const resting = !value;
    const pips = PIPS[value || 5];
    $('#pachisi-tray .pdie').classList.toggle('resting', resting);
    face.textContent = '';
    pips.forEach(([c, r], i) => {
      const counted = !resting && game.counted.has(i);
      const order = game.countOrder?.indexOf(i) ?? -1;
      const pip = document.createElement('span');
      pip.className = `pdie-pip${counted ? ' counted' : ''}${game.phase === 'count' && !counted ? ' can' : ''}`;
      pip.dataset.i = String(i);
      // positions through the style object: the CSP allows no inline style attributes
      pip.style.left = `${18 + c * 32}%`;
      pip.style.top = `${18 + r * 32}%`;
      pip.textContent = counted && order >= 0 ? String(order + 1) : '';
      face.appendChild(pip);
    });
  }

  function beginTurn() {
    if (!game || game.over) return;
    game.phase = 'roll';
    game.sel = null;
    game.msg = '';
    game.counted = new Set();
    renderMarks();
    renderTray();
    updateTurn();
    const cur = game.g.turn;
    if (isCpu(cur) && onScreen('pachisi')) {
      clearTimeout(cpuTimer);
      const token = plays;
      cpuTimer = setTimeout(() => {
        if (token === plays && game?.phase === 'roll' && isCpu(game.g.turn)) throwNow();
      }, CPU_WAIT * speed);
    }
  }

  /** Throw: the shells or the die tumble and land; then the throw is counted. */
  async function throwNow() {
    if (!game || game.over || game.phase !== 'roll') return;
    const token = plays;
    const cur = game.g.turn;
    const mode = game.mode;
    const thr = forced.length ? forced.shift() : mode.randomThrow(rand);
    game.phase = 'rolling';
    game.msg = '';
    game.counted = new Set();
    game.countOrder = [];
    updateTurn();
    sfx.unlock();
    const tray = $('#pachisi-tray');
    tray.classList.add('tumble');
    const faces = tray.querySelectorAll('.pshell');
    for (let k = 0; k < 5; k++) {
      if (mode.id === 'ludo') renderDie(null, 1 + Math.floor(Math.random() * 6));
      faces.forEach((f) => {
        f.dataset.face = '';
        f.querySelector('.pshell-face').innerHTML = shellSvg(Math.random() < 0.5);
      });
      sfx.tick();
      await sleep(80 + k * 16);
      if (token !== plays) return;
    }
    tray.classList.remove('tumble');
    const result = mode.applyThrow(game.g, thr);
    const roll = mode.readThrow(thr);
    const items = mode.items(roll);
    game.pendingThrow = { roll: { ...roll, items }, game: result.game, events: result.events };
    game.lastRoll = game.pendingThrow.roll;
    renderTray();
    const open = items.filter(Boolean).length;
    tray.setAttribute('aria-label', mode.id === 'ludo' ? t('ludo.trayShow', { n: roll.value }) : t('pachisi.trayShow', { open }));
    if (game.setup.count && !isCpu(cur) && open > 0) {
      game.phase = 'count';
      renderTray();
      updateTurn();
      return; // the child taps the open shells (countShell)
    }
    // the throw counts itself, one by one
    await sleep(250);
    for (let i = 0; i < items.length; i++) {
      if (!items[i]) continue;
      if (token !== plays) return;
      game.counted.add(i);
      game.countOrder.push(i);
      sfx.plink(Math.min(game.counted.size, 9));
      renderTray();
      await sleep(isCpu(cur) ? 200 : 300);
    }
    if (token !== plays) return;
    await reveal(token);
  }

  /** Count yourself: a tap on shell or pip i. */
  async function countShell(i) {
    if (!game || game.phase !== 'count' || !game.pendingThrow) return;
    const shells = game.pendingThrow.roll.items;
    if (i < 0 || i >= shells.length) return;
    if (!shells[i]) {
      const s = $(`#pachisi-tray .pshell[data-i="${i}"]`);
      s.classList.remove('wiggle');
      void s.offsetWidth;
      s.classList.add('wiggle');
      setMsg(t('pachisi.shut'));
      return;
    }
    if (game.counted.has(i)) return;
    game.counted.add(i);
    game.countOrder.push(i);
    sfx.plink(Math.min(game.counted.size, 9));
    game.msg = '';
    renderTray();
    updateTurn();
    if (game.counted.size < shells.filter(Boolean).length) return;
    const token = plays;
    game.phase = 'rolling';
    await sleep(300);
    if (token !== plays) return;
    await reveal(token);
  }

  /** What a throw says: the steps (and in Pachisi how many shells were open). */
  function throwHead(roll) {
    if (game.mode.id === 'ludo') return roll.value === 6 ? t('ludo.res.six') : t('ludo.res.n', { n: roll.value });
    const { open, steps } = roll;
    return open === 0 ? t('pachisi.res.none') : open === 1 ? t('pachisi.res.one') : open === 6 ? t('pachisi.res.six') : t('pachisi.res.n', { open, n: steps });
  }

  /** The steps show; the throw counts. A throw no pawn can use is lost (or, in Ludo, tried again). */
  async function reveal(token) {
    const p = game.pendingThrow;
    const { steps, grace } = p.roll;
    const cur = game.g.turn;
    game.phase = 'shown';
    const head = throwHead(p.roll);
    const nomove = p.events.find((e) => e.type === 'nomove');
    const again = p.events.find((e) => e.type === 'again');
    let line = grace ? `${head} ${t('pachisi.again')}` : head;
    if (nomove && again?.reason === 'try') line = `${head} ${t('ludo.tryAgain', { left: 3 - nomove.tries })}`;
    else if (nomove && game.mode.id === 'ludo' && !game.g.pawns[cur].some((pos) => pos > 0 && !game.mode.isDone(pos)) && !grace) line = `${head} ${t('ludo.noSix')}`;
    else if (nomove) line = `${head} ${t('pachisi.noMove', { n: steps })}${grace ? ` ${t('pachisi.again')}` : ''}`;
    setMsg(line);
    if (grace) sfx.chime();
    await sleep(nomove ? PAUSE * 1.6 : grace || open < 2 ? PAUSE * 1.3 : PAUSE * 0.8);
    if (token !== plays) return;
    game.g = p.game;
    game.pendingThrow = null;
    game.msg = '';
    if (game.g.over) {
      finish(); // the throws ran out (MAX_THROWS)
      return;
    }
    if (nomove) {
      renderTray();
      beginTurn();
      return;
    }
    if (game.g.turn !== cur) return beginTurn(); // never happens: a usable throw waits for its move
    enterMove();
  }

  // ---------- choosing and walking a pawn ----------

  function enterMove() {
    game.phase = 'move';
    if (game.g.roll) game.lastRoll = { ...game.g.roll, items: game.mode.items(game.g.roll) };
    game.msg = '';
    const moves = game.mode.legalMoves(game.g);
    game.sel = moves.length === 1 ? moves[0].from : null; // one choice: it is picked already
    renderTray();
    renderMarks();
    updateTurn();
    if (isCpu(game.g.turn)) cpuMove();
  }

  function cpuMove() {
    const token = plays;
    const g = game.g;
    const move = game.mode.chooseMove(g, game.setup.level, rand);
    clearTimeout(cpuTimer);
    cpuTimer = setTimeout(async () => {
      if (token !== plays || game?.g !== g || !onScreen('pachisi')) return;
      if (!move) return beginTurn();
      game.sel = move.from;
      renderMarks();
      await sleep(CPU_PICK);
      if (token !== plays || game?.g !== g) return;
      walk(move);
    }, 350 * speed);
  }

  /** The move of the selected pawn, or null. */
  const selectedMove = () => (game?.sel === null || game?.sel === undefined ? null : game.mode.legalMoves(game.g).find((m) => m.from === game.sel) || null);

  /** The marks on the board (the glowing pawns, the target and the way there) and the tap areas. */
  function renderMarks() {
    const board = $('#pachisi-board');
    const marks = board?.querySelector('.pachisi-marks');
    const layer = board?.querySelector('.pachisi-hits');
    if (!game || !marks || !layer) return;
    marks.textContent = '';
    layer.textContent = '';
    hits = [];
    for (const row of pawnEls) for (const p of row) p.classList.remove('can', 'sel');
    const g = game.g;
    const k = g.turn;
    const human = !isCpu(k);
    const mode = game.mode;
    const moves = game.phase === 'move' ? mode.legalMoves(g) : [];
    const sel = selectedMove();
    if (game.phase === 'move') {
      for (const m of moves) {
        const sameSpot = g.pawns[k].map((pos, i) => (pos === m.from ? i : -1)).filter((i) => i >= 0);
        for (const i of sameSpot) pawnEls[k][i].classList.add(m.from === game.sel ? 'sel' : 'can');
      }
      if (human) {
        hits = buildHits(g, game.shown, game.sel, mode);
        for (const h of hits) {
          if (h.kind === 'target') h.label = mode.isDone(h.to) ? t('pachisi.hitHome') : t('pachisi.hitTarget', { n: h.from === 0 && mode.id === 'ludo' ? 6 : h.to - h.from });
          else h.label = h.from === 0 ? tm('hitStart', { name: nameOf(k) }) : t('pachisi.hitPawn', { name: nameOf(k), left: mode.LAST - h.from });
        }
      }
    }
    if (sel) {
      const way = mode.stepsOf(sel);
      for (const pos of way.slice(0, -1)) {
        const pl = mode.placeOf(g.seats, k, pos);
        const d = document.createElement('span');
        d.className = 'pp-dot';
        d.style.left = `${pl.x * cell}px`;
        d.style.top = `${pl.y * cell}px`;
        marks.appendChild(d);
      }
      const pl = mode.placeOf(g.seats, k, sel.to);
      const glow = document.createElement('span');
      glow.className = `pp-target ${mode.id === 'pachisi' && sel.to >= mode.LAST ? 'home' : ''}`;
      glow.style.left = `${pl.x * cell}px`;
      glow.style.top = `${pl.y * cell}px`;
      marks.appendChild(glow);
    }
    const size = Math.max(MIN_HIT, cell * 1.8);
    for (const h of hits) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pp-hit ${h.kind}`;
      b.dataset.kind = h.kind;
      b.dataset.from = String(h.from);
      b.style.width = b.style.height = `${size}px`;
      b.style.left = `${h.x * cell - size / 2}px`;
      b.style.top = `${h.y * cell - size / 2}px`;
      b.setAttribute('aria-label', h.label);
      layer.appendChild(b);
      h.el = b;
    }
  }

  /** A tap on the board at (x, y) px from its corner: the nearest thing that can be tapped, within its area. */
  function tapAt(x, y) {
    const best = pickHit(hits, x / cell, y / cell, cell);
    if (best) pick(best);
    else if (game?.phase === 'move' && !isCpu(game.g.turn)) blockedHint(x / cell, y / cell);
  }

  /** A tap on one of the player's own pawns that cannot use this throw: say why, kindly. */
  function blockedHint(cx, cy) {
    const g = game.g;
    const k = g.turn;
    const spots = game.mode.pawnSpots(g.seats, game.shown);
    const near = g.pawns[k].findIndex((pos, i) => Math.hypot(spots[k][i].x - cx, spots[k][i].y - cy) < 0.9);
    if (near < 0) return;
    const why = game.mode.why(g, near);
    if (why) setMsg(t(why));
  }

  function pick(h) {
    if (!game || game.phase !== 'move' || isCpu(game.g.turn)) return;
    if (h.kind === 'pawn') {
      // tapped the selected pawn again with another one beside it on the same square: switch
      const pickFrom = game.sel === h.from ? otherOnSquare(hits, h)?.from ?? h.from : h.from;
      if (game.sel !== pickFrom) {
        game.sel = pickFrom;
        sfx.tick();
        game.msg = '';
        renderMarks();
        updateTurn();
      }
      return;
    }
    const move = selectedMove();
    if (move) {
      game.history.push({ g: game.g, player: game.g.turn });
      walk(move);
    }
  }

  /** Walk the move: hop by hop with the count, a captured pawn walks back home, then the next throw. */
  async function walk(move) {
    const token = plays;
    const g0 = game.g;
    const k = g0.turn;
    const mode = game.mode;
    const res = mode.playMove(g0, move);
    game.pendingMove = res;
    game.phase = 'moving';
    game.sel = null;
    game.msg = '';
    renderMarks();
    updateTurn();
    const way = mode.stepsOf(move);
    for (let s = 0; s < way.length; s++) {
      if (token !== plays) return;
      game.shown[k][move.pawn] = way[s];
      const el = pawnEls[k][move.pawn];
      el.classList.remove('hop');
      void el.offsetWidth;
      el.classList.add('hop');
      placePawns();
      countPop(mode.placeOf(g0.seats, k, way[s]), move.from === 0 && mode.id === 'ludo' ? 6 : s + 1);
      sfx.plink(Math.min(s + 1, 9));
      await sleep(way.length > 12 ? HOP * 0.7 : HOP);
    }
    if (token !== plays) return;
    sfx.thud(0.35);
    let said = false;
    for (const e of res.events) {
      if (token !== plays) return;
      if (e.type === 'capture') {
        setMsg(isYou(e.player) ? tm('captured.you') : tm('captured', { name: nameOf(e.player) }));
        said = true;
        sfx.boop();
        await walkBack(e.player, e.pawn, token);
      } else if (e.type === 'home') {
        setMsg(t('pachisi.home'));
        said = true;
        sfx.chime();
        await sleep(PAUSE * 0.7);
      }
    }
    if (token !== plays) return;
    if (!said && mode.safeAt(g0, k, move.to)) {
      setMsg(t('pachisi.castle'));
      await sleep(PAUSE * 0.8);
    } else if (!said && move.from === 0 && mode.id === 'ludo') {
      setMsg(t('ludo.enter'));
      await sleep(PAUSE * 0.6);
    }
    if (token !== plays) return;
    game.g = res.game;
    game.pendingMove = null;
    game.shown = game.g.pawns.map((p) => p.slice());
    placePawns();
    if (game.g.over) {
      finish();
      return;
    }
    if (res.events.some((e) => e.type === 'again')) {
      setMsg(t('pachisi.againNow'));
      await sleep(PAUSE * 0.7);
      if (token !== plays) return;
    }
    beginTurn();
  }

  /** A captured pawn walks back along its own way to its start (the yard, or the Charkoni), quickly and calmly. */
  async function walkBack(q, i, token) {
    const from = game.shown[q][i];
    const n = Math.max(1, Math.min(18, from));
    for (let s = 1; s <= n; s++) {
      if (token !== plays) return;
      game.shown[q][i] = Math.round(from - (from * s) / n);
      placePawns();
      await sleep(70);
    }
    game.shown[q][i] = 0;
    placePawns();
    await sleep(PAUSE * 0.5);
  }

  /** A big number over a square: the count so far. */
  function countPop(pl, n) {
    const layer = $('#pachisi-board .pachisi-marks');
    if (!layer) return;
    for (const old of layer.querySelectorAll('.pp-pop')) old.remove();
    const pop = document.createElement('span');
    pop.className = 'pp-pop';
    pop.textContent = String(n);
    const size = Math.max(26, Math.min(48, cell * 1.5));
    const below = pl.y * cell - cell * 0.6 - size < 0;
    pop.classList.toggle('below', below);
    pop.style.left = `${pl.x * cell}px`;
    pop.style.top = `${below ? (pl.y + 0.6) * cell : (pl.y - 0.6) * cell}px`;
    pop.style.width = pop.style.height = `${size}px`;
    pop.style.fontSize = `${size * 0.6}px`;
    layer.appendChild(pop);
    setTimeout(() => pop.remove(), 1000);
  }

  function placePawns() {
    if (!game || !pawnEls.length) return;
    const spots = game.mode.pawnSpots(game.g.seats, game.shown);
    spots.forEach((row, k) =>
      row.forEach((sp, i) => {
        const el = pawnEls[k]?.[i];
        if (!el) return;
        const s = sp.s * cell;
        el.style.width = el.style.height = `${s}px`;
        el.style.transform = `translate(${sp.x * cell - s / 2}px, ${sp.y * cell - s * 0.7}px)`;
        el.style.zIndex = String(10 + Math.round(sp.y * 4));
        el.classList.toggle('home', game.mode.isDone(game.shown[k][i]));
      }),
    );
    updateTurn();
  }

  // ---------- the end and take-back ----------

  function finish() {
    if (game.over) return;
    game.over = true;
    game.phase = 'over';
    const winner = game.g.winner;
    renderMarks();
    updateTurn();
    if (!isCpu(winner)) {
      if (hasCpu()) {
        const key = winKey(game.setup.level, game.mode.id);
        store.recordStars(meta.id, key, (wins()[key] || 0) + 1);
      }
      sfx.win();
    } else sfx.lose();
    for (const el of pawnEls[winner] || []) el.classList.add('won');
    const done = game;
    setTimeout(() => game === done && done.over && onScreen('pachisi') && showEndCard(), 1000 * speed);
  }

  function showEndCard() {
    const winner = game.g.winner;
    const cpuWon = isCpu(winner);
    const title = cpuWon ? t('pachisi.cpuWins', { name: nameOf(winner) }) : kids() === 1 ? t('pachisi.youWin') : t('pachisi.nameWins', { name: nameOf(winner) });
    const text = cpuWon ? t('pachisi.cpuWinsText') : game.g.over?.reason === 'limit' ? t('pachisi.limitText') : tm('winText');
    const buttons = [[t('pachisi.againBtn'), 'big primary', again]];
    if (canUndo()) buttons.push([t('pachisi.undo'), 'big secondary', () => (shell.hideOverlay(), undoMove())]);
    buttons.push([t('pachisi.menuBtn'), 'big secondary', () => shell.show('pachisi-menu')]);
    shell.showOverlay({ art: `<span class="pachisi-ov ${cpuWon ? '' : 'won'}">${cpuWon ? robotSvg() : pawnSvg(winner)}</span>`, title, text, buttons });
  }

  /** Can the last move be taken back? Against the computer: the child's last move (and what came after). */
  function canUndo() {
    if (!game || !['roll', 'move', 'over'].includes(game.phase)) return false;
    if (game.phase === 'roll' && isCpu(game.g.turn)) return false; // the computer is about to throw
    const kidMoves = game.history.some((h) => !isCpu(h.player));
    if (!kidMoves) return false;
    if (game.over) return hasCpu() && isCpu(game.g.winner);
    return true;
  }

  function undoMove() {
    if (!canUndo()) return;
    plays++;
    clearTimeout(cpuTimer);
    let h = null;
    while (game.history.length) {
      h = game.history.pop();
      if (!isCpu(h.player)) break;
    }
    if (!h) return;
    game.g = h.g;
    game.over = false;
    game.pendingThrow = null;
    game.pendingMove = null;
    game.shown = game.g.pawns.map((p) => p.slice());
    for (const row of pawnEls) for (const el of row) el.classList.remove('won');
    placePawns();
    enterMove(); // the same throw: pick again
  }

  // ---------- input ----------

  const tray = $('#pachisi-tray');
  tray.addEventListener('click', (e) => {
    if (!game) return;
    if (game.phase === 'roll' && !isCpu(game.g.turn) && !game.over) {
      tap();
      throwNow();
      return;
    }
    if (game.phase !== 'count') return;
    const shells = game.pendingThrow.roll.items;
    const ludo = game.mode.id === 'ludo';
    let s = ludo ? null : e.target.closest('.pshell');
    if (e.detail === 0) {
      // the keyboard: the next open shell (or pip) not counted yet
      const next = shells.findIndex((open, i) => open && !game.counted.has(i));
      if (next >= 0) countShell(next);
      return;
    }
    if (!s) {
      // between two shells: the nearest one; on the die: the nearest pip not counted yet
      let bestD = Infinity;
      for (const el of tray.querySelectorAll(ludo ? '.pdie-pip:not(.counted)' : '.pshell')) {
        const r = el.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - e.clientX, r.top + r.height / 2 - e.clientY);
        if (d < bestD) {
          bestD = d;
          s = el;
        }
      }
    }
    if (s) countShell(Number(s.dataset.i));
  });
  $('#pachisi-board').addEventListener('click', (e) => {
    if (!game || game.phase !== 'move') return;
    const btn = e.target.closest('.pp-hit');
    if (e.detail === 0 && btn) {
      const h = hits.find((x) => x.el === btn);
      if (h) pick(h);
      return;
    }
    const r = $('#pachisi-board .pachisi-hits').getBoundingClientRect();
    tapAt(e.clientX - r.left, e.clientY - r.top);
  });
  $('#pachisi-undo').insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${UNDO}</svg>`);
  $('#pachisi-undo').addEventListener('click', () => {
    tap();
    undoMove();
  });
  $('#pachisi-back').addEventListener('click', () => {
    tap();
    leave();
  });

  /** The board -> the menu (the game is kept for this session: "keep playing"). */
  function leave() {
    shell.hideOverlay();
    plays++;
    clearTimeout(cpuTimer);
    $('#pachisi-tray')?.classList.remove('tumble');
    if (game && !game.over) {
      settle();
      if (game.g.over) {
        // left during the winning walk: still a win, with its card (and no "keep playing" behind it)
        finish();
        shell.show('pachisi-menu');
        showEndCard();
        return;
      }
    }
    shell.show('pachisi-menu');
  }

  function fitBoard() {
    if (!game) return;
    const stage = $('#pachisi-stage');
    const side = window.innerWidth > window.innerHeight * 1.15;
    stage.classList.toggle('side', side);
    const panel = $('#pachisi-stage .pachisi-side');
    const w = stage.clientWidth - 12 - (side ? panel.offsetWidth + 12 : 0);
    const h = stage.clientHeight - 10 - (side ? 0 : panel.offsetHeight + 10);
    const size = game.mode.SIZE;
    cell = Math.max(10, Math.min(size < 15 ? 64 : 40, Math.floor((Math.min(w, h) / size) * 4) / 4));
    const el = $('#pachisi-board');
    el.style.width = el.style.height = `${cell * size}px`;
    el.style.setProperty('--cell', `${cell}px`);
    placePawns();
    renderMarks();
  }

  return {
    open() {
      shell.show('pachisi-menu');
    },
    leave,
    async init() {
      return true;
    },
    testHook() {
      return {
        choose: (setup) => {
          choice = cleanSetup({ ...(choice || cleanSetup(store.loadGameOption(meta.id, 'setup', null))), ...setup });
          if (onScreen('pachisi-menu')) renderMenu();
        },
        start: () => start(),
        /** Pachisi: the next throws, each six booleans (true: open). */
        shells: (list) => {
          if (!list.every((s) => Array.isArray(s) && s.length === 6)) throw new Error('shells: every throw is six booleans');
          forced = list.map((s) => s.map(Boolean));
        },
        /** Ludo: the next throws of the die, each 1-6. */
        dice: (list) => {
          if (!list.every((v) => Number.isInteger(v) && v >= 1 && v <= 6)) throw new Error('dice: every throw is 1-6');
          forced = list.slice();
        },
        /** Seed the throws and the computer's choices, so a game can be played again exactly. */
        seed: (n) => (rand = n ? mulberry32(n) : Math.random),
        fast: (on) => (speed = on ? 0.15 : 1),
        cell: () => cell,
        state: () =>
          game
            ? {
                pawns: game.g.pawns.map((p) => p.slice()),
                shown: game.shown.map((p) => p.slice()),
                seats: game.g.seats.slice(),
                turn: game.g.turn,
                phase: game.phase,
                roll: game.g.roll ? { ...game.g.roll } : null,
                pending: game.pendingThrow ? { ...game.pendingThrow.roll } : null,
                counted: [...game.counted],
                sel: game.sel,
                mode: game.mode.id,
                moves: game.phase === 'move' ? game.mode.legalMoves(game.g).map((m) => ({ ...m, captures: m.captures.slice() })) : [],
                hits: hits.map((h) => ({ kind: h.kind, from: h.from, pawn: h.pawn ?? -1, x: h.x * cell, y: h.y * cell })),
                winner: game.g.winner,
                over: game.over,
                throws: game.g.throws,
                history: game.history.length,
                canUndo: canUndo(),
                msg: $('#pachisi-status').textContent,
                setup: { ...game.setup, players: game.setup.players.slice() },
              }
            : null,
        /** For tests: put the pawns somewhere (positions per player) with player `turn` to throw. */
        setGame: (pawns, turn = 0) => {
          if (!game) return;
          plays++;
          clearTimeout(cpuTimer);
          game.g = { ...game.g, pawns: pawns.map((p) => p.slice()), turn, roll: null, tries: 0 };
          game.shown = pawns.map((p) => p.slice());
          game.history = [];
          game.pendingThrow = null;
          game.pendingMove = null;
          placePawns();
          beginTurn();
        },
        wins: () => wins(),
      };
    },
  };
}
