// Pachisi, the original game from India: throw six cowrie shells, count the ones that land open
// (mouth up) and walk a pawn that many squares; every pawn goes from the Charkoni in the middle
// down its own arm, round the whole cloth and back up into the middle. The rules live in
// rules.js, the computer players in ai.js, the pictures in art.js; the shell (web/js/main.js) owns
// the overlay card, the sound settings and the purchase, and passes them in as `shell`.
//
// "Zelf tellen" (count yourself): after the throw the child taps the open shells one by one and
// each one shows its count; then the steps show. Without it the shells count themselves. Then the
// pawns that can move glow; a tap on one makes the square it would reach glow (with small dots on
// the way), and a tap on that square walks it there, hop by hop, with the count on every square.
// When only one pawn can move it is picked already. Squares are small on a phone, so a tap goes
// to the nearest thing that can be tapped now, within a round area of 44 px or more round it.
// No voice (as in Ganzenbord), no timers. A captured pawn is never beaten: it walks back to the
// middle and starts again.
//
// Players: 2 (free) to 4 (full version), each a child or the computer (easy free, medium in the
// full version). Saved (games.pachisi): `setup` { players: ['kid'|'cpu', ...], level, pawns, count }
// and `stars` { 'cpu-<level>': games a child won against the computer } (a counter that only goes up).
import { meta } from './meta.js';
import {
  HOME, SIZE, MAX_PLAYERS, PAWN_COUNTS, PATHS, rowOf, colOf, isCastle,
  newGame, applyThrow, playMove, legalMoves, stepsOf, throwShells, readThrow, opponentsOn, mulberry32,
} from './rules.js';
import { chooseMove } from './ai.js';
import { pawnSvg, shellSvg, boardSvg, miniBoardSvg, LOOKS } from './art.js';
import { robotBadge, kidSvg } from '../ganzen/art.js';
import { robotSvg } from '../vier/art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const SWAP = '<svg class="swap" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 0 0-13.5-2M5 16a8 8 0 0 0 13.5 2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M5 2.5v4h4M19 21.5v-4h-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const UNDO = '<path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';

export const DEFAULT_SETUP = Object.freeze({ players: Object.freeze(['kid', 'cpu']), level: 1, pawns: 4, count: true });
const HOP = 230; // ms per square
const PAUSE = 900; // ms to read a message
const CPU_WAIT = 700; // ms before the computer throws
const CPU_PICK = 550; // ms the computer's choice glows before it walks
/** The smallest tap area round anything that can be tapped on the board, in px. */
export const MIN_HIT = 44;

/** The counter key for a child's win against the computer at a level. */
export const winKey = (level) => `cpu-${level}`;

/** A saved setup, made safe: 2-4 players of a known kind, a known level, 2 or 4 pawns, count on or off. */
export function cleanSetup(s) {
  const out = { players: DEFAULT_SETUP.players.slice(), level: DEFAULT_SETUP.level, pawns: DEFAULT_SETUP.pawns, count: DEFAULT_SETUP.count };
  if (!s || typeof s !== 'object') return out;
  if (Array.isArray(s.players) && s.players.length >= 2 && s.players.length <= MAX_PLAYERS && s.players.every((p) => p === 'kid' || p === 'cpu')) out.players = s.players.slice();
  if (s.level === 1 || s.level === 2) out.level = s.level;
  if (PAWN_COUNTS.includes(s.pawns)) out.pawns = s.pawns;
  if (typeof s.count === 'boolean') out.count = s.count;
  return out;
}

/** Turn a point (in cell units, from the board's top-left) a quarter counter-clockwise `seat` times round the middle. */
function turnPoint(x, y, seat) {
  for (let k = 0; k < seat; k++) [x, y] = [y, SIZE - x];
  return [x, y];
}

/**
 * Where every pawn stands, in cell units (x, y of its foot and its size), for `shown` positions:
 * on a square in the middle of it (several on one square side by side), still in the Charkoni in a
 * row in the triangle in front of their arm, home again in a smaller row nearer the middle.
 */
export function pawnSpots(seats, shown) {
  const groups = new Map();
  shown.forEach((list, k) =>
    list.forEach((pos, i) => {
      const key = pos <= 0 ? `w${k}` : pos >= HOME ? `h${k}` : `c${PATHS[seats[k]][pos]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push([k, i]);
    }),
  );
  const out = shown.map((list) => list.map(() => null));
  for (const [key, list] of groups) {
    const n = list.length;
    if (key[0] === 'c') {
      const cell = Number(key.slice(1));
      const cx = colOf(cell) + 0.5;
      const cy = rowOf(cell) + 0.5;
      const offs = n === 1 ? [[0, 0]] : n === 2 ? [[-0.24, 0], [0.24, 0]] : n === 3 ? [[-0.24, -0.16], [0.24, -0.16], [0, 0.2]] : [[-0.24, -0.18], [0.24, -0.18], [-0.24, 0.2], [0.24, 0.2]];
      list.forEach(([k, i], j) => {
        const [ox, oy] = offs[j % offs.length];
        out[k][i] = { x: cx + ox, y: cy + oy, s: n === 1 ? 1.3 : 0.95 };
      });
    } else {
      const k = list[0][0];
      const seat = seats[k];
      const home = key[0] === 'h';
      list.forEach(([kk, i], j) => {
        const dx = (j - (n - 1) / 2) * (home ? 0.32 : 0.6);
        const [x, y] = turnPoint(9.5 + dx, home ? 10.05 : 10.62, seat);
        out[kk][i] = { x, y, s: home ? 0.55 : 0.66 };
      });
    }
  }
  return out;
}

/** Where a position of player k is, in cell units (the middle of its square, or of the Charkoni's triangle / the middle). */
export function placeOf(seats, k, pos) {
  if (pos >= HOME) return { x: 9.5, y: 9.5 };
  if (pos <= 0) {
    const [x, y] = turnPoint(9.5, 10.55, seats[k]);
    return { x, y };
  }
  const cell = PATHS[seats[k]][pos];
  return { x: colOf(cell) + 0.5, y: rowOf(cell) + 0.5 };
}

/**
 * What can be tapped on the board now, in cell units: the selected pawn's target first, then every
 * pawn that can move, each where pawnSpots draws it (two pawns on one square sit side by side, so
 * each can be tapped). `sel`: the selected move's `from`, or null.
 */
export function buildHits(g, shown, sel) {
  const k = g.turn;
  const moves = legalMoves(g);
  const spots = pawnSpots(g.seats, shown);
  const out = [];
  const chosen = sel === null || sel === undefined ? null : moves.find((m) => m.from === sel);
  if (chosen) {
    const pl = placeOf(g.seats, k, chosen.to);
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
  let forced = []; // tests: the next throws (arrays of six booleans)
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

    const intro = document.createElement('div');
    intro.className = 'pachisi-intro';
    intro.innerHTML = `<span class="pachisi-intro-art">${miniBoardSvg()}</span><p></p>`;
    intro.querySelector('p').textContent = t('pachisi.how');
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
        const n = counts[winKey(level)] || 0;
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
          sub: t(`pachisi.pawns${n}Sub`),
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
          art: on ? `<span class="pachisi-countart">${shellSvg(true)}${shellSvg(true)}${shellSvg(false)}</span>` : `<span class="pachisi-countart"><b>3</b></span>`,
          title: t(on ? 'pachisi.countSelf' : 'pachisi.countAuto'),
          sub: t(on ? 'pachisi.countSelfSub' : 'pachisi.countAutoSub'),
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
    if (game && !game.over) {
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
    const g = newGame(setup.players.length, setup.pawns);
    game = { setup, g, shown: g.pawns.map((p) => p.slice()), phase: 'roll', sel: null, counted: new Set(), history: [], msg: '', pendingThrow: null, pendingMove: null, over: false };
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
    el.insertAdjacentHTML('afterbegin', boardSvg(game.g.seats));
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
    renderTray();
    fitBoard();
  }

  function renderHud() {
    $('#pachisi-sub').textContent = hasCpu() ? t(`pachisi.level${game.setup.level}`) : t('pachisi.together');
    $('#pachisi-title').textContent = t('games.pachisi');
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
      const home = game.shown[k].filter((p) => p >= HOME).length;
      chip.querySelectorAll('.home-dots i').forEach((d, i) => d.classList.toggle('on', i < home));
      chip.setAttribute('aria-label', `${nameOf(k)}${isCpu(k) ? `, ${t('pachisi.kind.cpu')}` : ''}: ${t('pachisi.homeCount', { n: home, all: g.pawns[k].length })}`);
    }
    const tray = $('#pachisi-tray');
    const canThrow = !game.over && game.phase === 'roll' && !isCpu(cur);
    tray.classList.toggle('ready', canThrow);
    tray.classList.toggle('counting', game.phase === 'count');
    tray.setAttribute('aria-label', game.phase === 'count' ? t('pachisi.shellsCount') : t('pachisi.shellsLabel'));
    tray.setAttribute('aria-disabled', String(!(canThrow || game.phase === 'count')));
    let text = game.msg;
    if (!text && !game.over) {
      if (game.phase === 'count') text = t('pachisi.countNow');
      else if (game.phase === 'roll') text = isCpu(cur) ? t('pachisi.cpuThrows', { name: nameOf(cur) }) : kids() === 1 ? t('pachisi.yourThrow') : t('pachisi.throw', { name: nameOf(cur) });
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

  // ---------- the shells ----------

  /** The tray's six shells: as thrown (`shells`), or all closed before the first throw. */
  function renderTray() {
    const tray = $('#pachisi-tray');
    // before a throw the shells lie on their backs; after it they show the last throw
    const shells = !game || game.phase === 'roll' ? null : game.pendingThrow?.roll.shells || game.g.roll?.shells || game.lastShells || null;
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

  /** Throw the six shells: they tumble, land open or closed; then they are counted. */
  async function throwNow() {
    if (!game || game.over || game.phase !== 'roll') return;
    const token = plays;
    const cur = game.g.turn;
    const shells = forced.length ? forced.shift() : throwShells(rand);
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
      faces.forEach((f) => {
        f.dataset.face = '';
        f.querySelector('.pshell-face').innerHTML = shellSvg(Math.random() < 0.5);
      });
      sfx.tick();
      await sleep(80 + k * 16);
      if (token !== plays) return;
    }
    tray.classList.remove('tumble');
    const result = applyThrow(game.g, shells);
    game.pendingThrow = { roll: { shells: shells.slice(), ...readThrow(shells) }, game: result.game, events: result.events };
    game.lastShells = shells.slice();
    renderTray();
    const { open } = game.pendingThrow.roll;
    tray.setAttribute('aria-label', t('pachisi.shellsShow', { open }));
    if (game.setup.count && !isCpu(cur) && open > 0) {
      game.phase = 'count';
      renderTray();
      updateTurn();
      return; // the child taps the open shells (countShell)
    }
    // the shells count themselves, one by one
    await sleep(250);
    for (let i = 0; i < shells.length; i++) {
      if (!shells[i]) continue;
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

  /** Count yourself: a tap on shell i. */
  async function countShell(i) {
    if (!game || game.phase !== 'count' || !game.pendingThrow) return;
    const { shells } = game.pendingThrow.roll;
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

  /** The steps show; the throw counts. A throw no pawn can use is lost. */
  async function reveal(token) {
    const p = game.pendingThrow;
    const { open, steps, grace } = p.roll;
    const cur = game.g.turn;
    game.phase = 'shown';
    const head = open === 0 ? t('pachisi.res.none') : open === 1 ? t('pachisi.res.one') : open === 6 ? t('pachisi.res.six') : t('pachisi.res.n', { open, n: steps });
    const nomove = p.events.some((e) => e.type === 'nomove');
    setMsg(nomove ? `${head} ${t('pachisi.noMove', { n: steps })}` : grace ? `${head} ${t('pachisi.again')}` : head);
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
    game.lastShells = game.g.roll?.shells.slice() || game.lastShells;
    game.msg = '';
    const moves = legalMoves(game.g);
    game.sel = moves.length === 1 ? moves[0].from : null; // one choice: it is picked already
    renderTray();
    renderMarks();
    updateTurn();
    if (isCpu(game.g.turn)) cpuMove();
  }

  function cpuMove() {
    const token = plays;
    const g = game.g;
    const move = chooseMove(g, game.setup.level, rand);
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
  const selectedMove = () => (game?.sel === null || game?.sel === undefined ? null : legalMoves(game.g).find((m) => m.from === game.sel) || null);

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
    const moves = game.phase === 'move' ? legalMoves(g) : [];
    const sel = selectedMove();
    if (game.phase === 'move') {
      for (const m of moves) {
        const sameSpot = g.pawns[k].map((pos, i) => (pos === m.from ? i : -1)).filter((i) => i >= 0);
        for (const i of sameSpot) pawnEls[k][i].classList.add(m.from === game.sel ? 'sel' : 'can');
      }
      if (human) {
        hits = buildHits(g, game.shown, game.sel);
        for (const h of hits) {
          if (h.kind === 'target') h.label = h.to >= HOME ? t('pachisi.hitHome') : t('pachisi.hitTarget', { n: h.to - h.from });
          else h.label = h.from === 0 ? t('pachisi.hitStart', { name: nameOf(k) }) : t('pachisi.hitPawn', { name: nameOf(k), left: HOME - h.from });
        }
      }
    }
    if (sel) {
      const way = stepsOf(sel);
      for (const pos of way.slice(0, -1)) {
        const pl = placeOf(g.seats, k, pos);
        const d = document.createElement('span');
        d.className = 'pp-dot';
        d.style.left = `${pl.x * cell}px`;
        d.style.top = `${pl.y * cell}px`;
        marks.appendChild(d);
      }
      const pl = placeOf(g.seats, k, sel.to);
      const glow = document.createElement('span');
      glow.className = `pp-target ${sel.to >= HOME ? 'home' : ''}`;
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
    const spots = pawnSpots(g.seats, game.shown);
    const near = g.pawns[k].findIndex((pos, i) => pos < HOME && Math.hypot(spots[k][i].x - cx, spots[k][i].y - cy) < 0.9);
    if (near < 0) return;
    const to = Math.min(HOME, g.pawns[k][near] + g.roll.steps);
    const cellTo = PATHS[g.seats[k]][to];
    if (to < HOME && isCastle(cellTo) && opponentsOn(g, k, cellTo).length) setMsg(t('pachisi.blocked'));
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
    const res = playMove(g0, move);
    game.pendingMove = res;
    game.phase = 'moving';
    game.sel = null;
    game.msg = '';
    renderMarks();
    updateTurn();
    const way = stepsOf(move);
    for (let s = 0; s < way.length; s++) {
      if (token !== plays) return;
      game.shown[k][move.pawn] = way[s];
      const el = pawnEls[k][move.pawn];
      el.classList.remove('hop');
      void el.offsetWidth;
      el.classList.add('hop');
      placePawns();
      countPop(placeOf(g0.seats, k, way[s]), s + 1);
      sfx.plink(Math.min(s + 1, 9));
      await sleep(way.length > 12 ? HOP * 0.7 : HOP);
    }
    if (token !== plays) return;
    sfx.thud(0.35);
    let said = false;
    for (const e of res.events) {
      if (token !== plays) return;
      if (e.type === 'capture') {
        setMsg(t(isYou(e.player) ? 'pachisi.captured.you' : 'pachisi.captured', { name: nameOf(e.player) }));
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
    if (!said && move.to < HOME && isCastle(PATHS[g0.seats[k]][move.to])) {
      setMsg(t('pachisi.castle'));
      await sleep(PAUSE * 0.8);
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

  /** A captured pawn walks back to the Charkoni along its own way, quickly and calmly. */
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
    const spots = pawnSpots(game.g.seats, game.shown);
    spots.forEach((row, k) =>
      row.forEach((sp, i) => {
        const el = pawnEls[k]?.[i];
        if (!el) return;
        const s = sp.s * cell;
        el.style.width = el.style.height = `${s}px`;
        el.style.transform = `translate(${sp.x * cell - s / 2}px, ${sp.y * cell - s * 0.7}px)`;
        el.style.zIndex = String(10 + Math.round(sp.y * 4));
        el.classList.toggle('home', game.shown[k][i] >= HOME);
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
        const key = winKey(game.setup.level);
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
    const text = cpuWon ? t('pachisi.cpuWinsText') : t(game.g.over?.reason === 'limit' ? 'pachisi.limitText' : 'pachisi.winText');
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
  tray.innerHTML = Array.from({ length: 6 }, (_, i) => `<span class="pshell" data-i="${i}"><span class="pshell-face"></span><span class="pshell-n" aria-hidden="true"></span></span>`).join('');
  tray.addEventListener('click', (e) => {
    if (!game) return;
    if (game.phase === 'roll' && !isCpu(game.g.turn) && !game.over) {
      tap();
      throwNow();
      return;
    }
    if (game.phase !== 'count') return;
    const { shells } = game.pendingThrow.roll;
    let s = e.target.closest('.pshell');
    if (e.detail === 0) {
      // the keyboard: the next open shell not counted yet
      const next = shells.findIndex((open, i) => open && !game.counted.has(i));
      if (next >= 0) countShell(next);
      return;
    }
    if (!s) {
      // between two shells: the nearest one
      let bestD = Infinity;
      for (const el of tray.querySelectorAll('.pshell')) {
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
    cell = Math.max(10, Math.min(40, Math.floor((Math.min(w, h) / SIZE) * 4) / 4));
    const el = $('#pachisi-board');
    el.style.width = el.style.height = `${cell * SIZE}px`;
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
        /** The next throws, each six booleans (true: open). */
        shells: (list) => {
          if (!list.every((s) => Array.isArray(s) && s.length === 6)) throw new Error('shells: every throw is six booleans');
          forced = list.map((s) => s.map(Boolean));
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
                moves: game.phase === 'move' ? legalMoves(game.g).map((m) => ({ ...m, captures: m.captures.slice() })) : [],
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
          game.g = { ...game.g, pawns: pawns.map((p) => p.slice()), turn, roll: null };
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
