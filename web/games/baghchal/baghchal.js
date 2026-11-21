// Tijgers en geitjes (Bagh-Chal, "tigers and goats" from Nepal): the goats first put their 20
// goats on the field one by one, then walk; the tigers walk or jump over a goat. Tap a piece and
// then one of its dots, or drag it there; while placing, tap an empty point. A captured goat is
// never eaten: it hops off to the meadow beside the field and falls asleep. Calm, no timers.
// Two ways to play: together on one screen, or against the computer (ai.js) at three levels with
// the child as the goats or the tigers; medium and hard are in the full version.
// The rules live in rules.js, the pictures in art.js; the shell (web/js/main.js) owns the overlay
// card, the sound settings and the purchase, and passes them in as `shell`. The computer thinks
// in a worker (ai-worker.js) through Dammen's think.js, so the screen never freezes.
//
// Saved (games.baghchal): the child's wins against the computer per side and level, as
// non-decreasing counters in `stars` ('cpu-<side>-<level>'), and the last menu choice ('setup':
// { mode, level, side }). Games played together are not counted.
import { meta } from './meta.js';
import { GOAT, TIGER, POINTS, WIN_CAPTURES, legalMoves, newGame, play, sameMove, other } from './rules.js';
import { chooseMove, mulberry32, PAGE_NODES } from './ai.js';
import { createThinker } from '../dammen/think.js';
import { pieceSvg, sleepyGoatSvg, grassSvg, boardSvg, miniBoardSvg } from './art.js';
import { robotSvg, duoSvg, TROPHY } from '../vier/art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';
import { foldLocked } from '../../js/fold.js';

const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const UNDO = '<path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';

export const SIDES = Object.freeze(['goats', 'tigers']);
export const DEFAULT_SETUP = Object.freeze({ mode: 'cpu', level: 1, side: 'goats' });
const CPU_DELAY = 520; // ms before the computer moves, so it feels like a turn
const WORKER_TIMEOUT = 6000; // a worker that does not answer: this move is made on the page
const STEP_MS = 280;
const DRAG_START = 8; // px a finger moves before a press becomes a drag

const kindOf = (player) => (player === TIGER ? 'tiger' : 'goat');
const playerOf = (side) => (side === 'tigers' ? TIGER : GOAT);

/** The counter key for a result. */
export const winKey = (setup) => `cpu-${setup.side}-${setup.level}`;

/** The points the piece on `from` can go to (`from` -1: where a goat can be placed). */
export function targetsFor(moves, from) {
  return [...new Set(moves.filter((m) => m.from === from).map((m) => m.to))];
}

export function createBaghchal(shell) {
  const { t, tap } = shell;
  const $ = (sel) => document.querySelector(sel);
  const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const wins = () => store.loadProgress(meta.id).stars;
  const savedSetup = () => {
    const s = store.loadGameOption(meta.id, 'setup', null) || {};
    return {
      mode: s.mode === 'duo' ? 'duo' : 'cpu',
      level: [1, 2, 3].includes(s.level) ? s.level : DEFAULT_SETUP.level,
      side: SIDES.includes(s.side) ? s.side : DEFAULT_SETUP.side,
    };
  };

  let choice = null; // the menu's choice: { mode, level, side }
  let game = null; // { setup, g: rules game, history: [{ g, player, last }], last: move|null }
  let sel = null; // the tapped piece's point, or null
  let moving = false; // a piece is on its way
  let cpuJob = 0; // the id of the computer's pending move (0: none)
  let cpuTimer = null;
  let cardTimer = null;
  let plays = 0; // counts games started and take-backs, so a late answer never lands on a newer board
  let points = []; // index -> the point's button
  let note = ''; // a short message under the turn chips
  let drag = null; // { id, from, x, y, active, ghost }
  let swallowClick = false; // the click that follows a drag

  const locked = (setup) => meta.isLocked(setup, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const isCpu = () => game?.setup.mode === 'cpu';
  const kid = () => playerOf(game?.setup.side);
  const cpuPlayer = () => other(kid());
  const humanTurn = () => !!game && !game.g.over && (!isCpu() || game.g.turn === kid());
  const busy = () => moving || !!cpuJob;
  const legal = () => (game ? legalMoves(game.g.board, game.g.turn, game.g.toPlace) : []);
  const placing = () => !!game && game.g.turn === GOAT && game.g.toPlace > 0;
  const sideName = (p) => t(p === TIGER ? 'bagh.tigers' : 'bagh.goats');

  function cancelCpu() {
    if (cpuTimer) clearTimeout(cpuTimer);
    cpuTimer = null;
    cpuJob = 0;
    thinker.cancel(); // a search still running in the worker is stopped
  }
  function cancelCard() {
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
  }

  shell.unlock.onChange(() => {
    if (onScreen('baghchal-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'baghchal-menu') renderMenu();
    if (name === 'baghchal') requestAnimationFrame(fitBoard);
  });
  shell.onLangChange(() => {
    if (onScreen('baghchal-menu')) renderMenu();
    if (game) {
      renderHud();
      renderTurn();
      updateBoard();
    }
  });
  window.addEventListener('resize', () => onScreen('baghchal') && fitBoard());

  // ---------- menu ----------

  function renderMenu() {
    if (!choice) choice = savedSetup();
    if (locked(choice)) choice.level = 1; // refunded, or the website
    const box = $('#baghchal-menu');
    box.textContent = '';
    const head = (key) => {
      const h = document.createElement('h3');
      h.className = 'vier-head';
      h.textContent = t(key);
      box.appendChild(h);
    };
    const lockIcon = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
    const option = ({ art, title, sub, pressed, onPick, cls = '' }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-opt bagh-opt ${cls}`;
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
    intro.className = 'bagh-intro';
    intro.innerHTML = `<span class="bagh-intro-art">${miniBoardSvg()}</span><p></p>`;
    intro.querySelector('p').textContent = t('bagh.how');
    box.appendChild(intro);

    // the opponent: together, or the computer at a level
    head('bagh.opponentHead');
    const opp = document.createElement('div');
    opp.className = 'vier-row';
    opp.appendChild(
      option({
        art: duoSvg(),
        title: t('bagh.duo'),
        sub: t('bagh.duoSub'),
        pressed: choice.mode === 'duo',
        cls: 'mode-duo',
        onPick: () => {
          choice.mode = 'duo';
          renderMenu();
        },
      }),
    );
    const cpu = document.createElement('div');
    cpu.className = `vier-cpu ${choice.mode === 'cpu' ? 'on' : ''}`;
    cpu.innerHTML = `<span class="vier-opt-art">${robotSvg()}</span><span class="vier-cpu-title"></span><span class="vier-levels" role="group"></span>`;
    cpu.querySelector('.vier-cpu-title').textContent = t('bagh.cpu');
    cpu.querySelector('.vier-levels').setAttribute('aria-label', t('bagh.cpu'));
    cpu.querySelector('.vier-levels').dataset.foldHead = t('bagh.cpu'); // its locked levels wait in the fold under this name
    const counts = wins();
    for (const level of [1, 2, 3]) {
      const setup = { mode: 'cpu', level, side: choice.side };
      const isLocked = locked(setup);
      const n = counts[winKey(setup)] || 0;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-level bagh-level ${isLocked ? 'locked' : ''}`;
      b.dataset.level = String(level);
      b.setAttribute('aria-pressed', String(choice.mode === 'cpu' && choice.level === level));
      const dots = [1, 2, 3].map((k) => `<i class="${k <= level ? 'on' : ''}"></i>`).join('');
      b.innerHTML =
        `<span class="dots" aria-hidden="true">${dots}</span><span class="lv-name"></span>` +
        (isLocked ? lockIcon : n ? `<span class="lv-wins"><svg viewBox="0 0 24 24" aria-hidden="true">${TROPHY}</svg>${n}</span>` : '');
      b.querySelector('.lv-name').textContent = t(`bagh.level${level}`);
      const label = isLocked ? t('bagh.levelLocked', { level: t(`bagh.level${level}`) }) : n ? `${t(`bagh.level${level}`)}, ${t('bagh.wins', { n })}` : t(`bagh.level${level}`);
      b.setAttribute('aria-label', `${t('bagh.cpu')}: ${label}`);
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('bagh.lockedLevel'));
          return;
        }
        choice.mode = 'cpu';
        choice.level = level;
        renderMenu();
      });
      cpu.querySelector('.vier-levels').appendChild(b);
    }
    opp.appendChild(cpu);
    box.appendChild(opp);

    // the child's side, against the computer
    if (choice.mode === 'cpu') {
      head('bagh.sideHead');
      const sides = document.createElement('div');
      sides.className = 'vier-row';
      for (const side of SIDES) {
        sides.appendChild(
          option({
            art: pieceSvg(side === 'tigers' ? 'tiger' : 'goat'),
            title: t(`bagh.side.${side}`),
            sub: t(`bagh.side.${side}Sub`),
            pressed: choice.side === side,
            cls: `side-${side}`,
            onPick: () => {
              choice.side = side;
              renderMenu();
            },
          }),
        );
      }
      box.appendChild(sides);
    }

    // play, and keep playing an unfinished game
    const actions = document.createElement('div');
    actions.className = 'vier-actions';
    if (game && !game.g.over) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'baghchal-continue';
      cont.className = 'btn big secondary';
      cont.textContent = t('bagh.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      actions.appendChild(cont);
    }
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.id = 'baghchal-play';
    playBtn.className = 'btn big primary';
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg><span></span>';
    playBtn.querySelector('span').textContent = t('bagh.play');
    playBtn.addEventListener('click', () => {
      tap();
      start();
    });
    actions.appendChild(playBtn);
    box.appendChild(actions);
    foldLocked(box);
  }

  // ---------- a game ----------

  function start() {
    if (!choice) choice = savedSetup();
    const setup = { mode: choice.mode, level: choice.level, side: choice.side };
    if (locked(setup)) {
      shell.offerUnlock(t('bagh.lockedLevel'));
      return;
    }
    store.saveGameOption(meta.id, 'setup', setup);
    plays++;
    moving = false;
    cancelCpu();
    cancelCard();
    endDrag();
    sel = null;
    note = '';
    game = { setup, g: newGame(), history: [], last: null };
    buildBoard();
    renderHud();
    renderTurn();
    updateBoard();
    shell.show('baghchal');
    if (isCpu() && game.g.turn === cpuPlayer()) cpuTurn(); // the child plays the tigers: the goats start
  }

  function resume() {
    if (!game) return;
    buildBoard();
    renderHud();
    renderTurn();
    updateBoard();
    shell.show('baghchal');
    if (game.g.over) {
      // the game ended while the child was on the menu (back during the last move): its end card now
      cancelCard();
      showEndCard();
      return;
    }
    if (isCpu() && game.g.turn === cpuPlayer()) cpuTurn();
  }

  function again() {
    shell.hideOverlay();
    if (!game) return;
    choice = { ...game.setup };
    start();
  }

  function buildBoard() {
    const el = $('#baghchal-board');
    el.textContent = '';
    el.insertAdjacentHTML('afterbegin', boardSvg());
    const grid = document.createElement('div');
    grid.className = 'bagh-grid';
    points = [];
    for (let i = 0; i < POINTS; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bpt';
      b.dataset.i = String(i);
      grid.appendChild(b);
      points.push(b);
    }
    el.appendChild(grid);
    el.setAttribute('aria-label', t('bagh.boardLabel'));
    // the meadow: five spots for goats that hop off
    const meadow = $('#baghchal-meadow');
    meadow.textContent = '';
    const h = document.createElement('span');
    h.className = 'bagh-meadow-head';
    h.textContent = t('bagh.meadowHead');
    meadow.appendChild(h);
    const row = document.createElement('span');
    row.className = 'bagh-meadow-row';
    for (let k = 0; k < WIN_CAPTURES; k++) {
      const s = document.createElement('span');
      s.className = 'bagh-spot';
      s.dataset.k = String(k);
      row.appendChild(s);
    }
    meadow.appendChild(row);
  }

  function renderHud() {
    const { setup } = game;
    $('#baghchal-sub').textContent = setup.mode === 'cpu' ? t(`bagh.side.${setup.side}`) : t('bagh.menu');
    $('#baghchal-title').textContent = setup.mode === 'cpu' ? t(`bagh.level${setup.level}`) : t('bagh.duo');
    $('.bagh-meadow-head') && ($('.bagh-meadow-head').textContent = t('bagh.meadowHead'));
  }

  function renderTurn() {
    const box = $('#baghchal-turn');
    box.textContent = '';
    for (const p of [GOAT, TIGER]) {
      const chip = document.createElement('span');
      chip.className = 'vier-chip bagh-chip';
      chip.dataset.player = String(p);
      chip.innerHTML = `${pieceSvg(kindOf(p))}<span class="name"></span><span class="count" hidden></span><span class="arrow" aria-hidden="true"></span>`;
      const nm = chip.querySelector('.name');
      if (isCpu()) {
        nm.textContent = p === kid() ? t('bagh.you') : t('bagh.computer');
        if (p !== kid()) nm.insertAdjacentHTML('afterbegin', robotSvg({ cls: 'tiny' }));
      } else nm.textContent = sideName(p);
      box.appendChild(chip);
    }
    updateTurn();
  }

  function updateTurn() {
    if (!game) return;
    const { g } = game;
    for (const chip of document.querySelectorAll('#baghchal-turn .vier-chip')) {
      const p = Number(chip.dataset.player);
      chip.classList.toggle('on', !g.over && g.turn === p);
      chip.classList.toggle('winner', !!g.over?.winner && g.over.winner === p);
      chip.classList.toggle('thinking', !g.over && isCpu() && g.turn === p && p === cpuPlayer());
      const count = chip.querySelector('.count');
      if (p === GOAT) {
        count.hidden = g.toPlace <= 0;
        count.textContent = t('bagh.toPlaceShort', { n: g.toPlace });
        chip.setAttribute('aria-label', g.toPlace > 0 ? `${chip.querySelector('.name').textContent}: ${t('bagh.toPlace', { n: g.toPlace })}` : chip.querySelector('.name').textContent);
      }
    }
    for (const spot of document.querySelectorAll('#baghchal-meadow .bagh-spot')) {
      const full = Number(spot.dataset.k) < g.captured;
      if (spot.dataset.full !== String(full)) {
        spot.dataset.full = String(full);
        spot.innerHTML = full ? sleepyGoatSvg() : grassSvg();
      }
    }
    $('#baghchal-meadow').setAttribute('aria-label', t('bagh.meadow', { n: g.captured }));
    let text = note;
    if (!text && !g.over) {
      if (isCpu() && g.turn === cpuPlayer()) text = t('bagh.thinking');
      else if (placing() && sel === null) text = t('bagh.place');
      else if (isCpu()) text = t('bagh.yourTurn');
      else text = t('bagh.turn', { name: sideName(g.turn) });
    }
    $('#baghchal-status').textContent = text;
    $('#baghchal-undo').disabled = !canUndo();
  }

  function canUndo() {
    if (!game || moving) return false;
    const { g, history } = game;
    if (isCpu()) return history.some((h) => h.player === kid()) && (!g.over || !g.over.winner || g.over.winner !== kid());
    return history.length > 0 && (!g.over || !!g.over.draw);
  }

  /** Draw the pieces and the hints. */
  function updateBoard() {
    if (!game) return;
    const { g } = game;
    const moves = humanTurn() && !busy() ? legal() : [];
    const movable = new Set(moves.map((m) => m.from));
    const place = placing() && moves.length ? new Set(targetsFor(moves, -1)) : new Set();
    const mine = sel !== null ? moves.filter((m) => m.from === sel) : [];
    const targets = new Set(mine.map((m) => m.to));
    const overs = new Set(mine.filter((m) => m.over >= 0).map((m) => m.over));
    const last = game.last ? [game.last.from, game.last.to].filter((i) => i >= 0) : [];
    for (let i = 0; i < POINTS; i++) {
      const b = points[i];
      const v = g.board[i];
      const shown = drag?.active && drag.from === i ? 0 : v;
      const key = shown ? String(shown) : '';
      if (b.dataset.piece !== key) {
        b.dataset.piece = key;
        b.innerHTML = shown ? pieceSvg(kindOf(shown)) : '';
      }
      b.classList.toggle('can', movable.has(i));
      b.classList.toggle('sel', sel === i);
      b.classList.toggle('target', targets.has(i));
      b.classList.toggle('place', place.has(i));
      b.classList.toggle('over', overs.has(i));
      b.classList.toggle('last', last.includes(i) && sel === null);
      const n = i + 1;
      b.setAttribute('aria-label', v === GOAT ? t('bagh.pointGoat', { n }) : v === TIGER ? t('bagh.pointTiger', { n }) : t('bagh.point', { n }));
      b.disabled = !!g.over;
    }
    $('#baghchal-board').classList.toggle('over', !!g.over);
    updateTurn();
  }

  function say(text) {
    note = text;
    updateTurn();
  }

  function wiggle(i) {
    const b = points[i];
    if (!b) return;
    b.classList.remove('wiggle');
    void b.offsetWidth;
    b.classList.add('wiggle');
    setTimeout(() => b.classList.remove('wiggle'), 420);
  }

  /** A tap on point i. */
  function tapPoint(i) {
    if (!game || game.g.over || i < 0 || i >= POINTS) return;
    if (busy() || !humanTurn()) {
      wiggle(i);
      return;
    }
    sfx.unlock();
    const { g } = game;
    const moves = legal();
    const v = g.board[i];
    if (placing()) {
      const m = moves.find((x) => x.from < 0 && x.to === i);
      if (m) {
        note = '';
        playMove(m);
        return;
      }
      wiggle(i);
      say(v === GOAT ? t('bagh.placeFirst') : t('bagh.notYours'));
      return;
    }
    if (sel !== null) {
      const m = moves.find((x) => x.from === sel && x.to === i);
      if (m) {
        sel = null;
        note = '';
        playMove(m);
        return;
      }
    }
    if (v && v === g.turn) {
      if (moves.some((m) => m.from === i)) {
        sel = sel === i ? null : i;
        sfx.tick();
        note = sel === null ? '' : t('bagh.pickTarget');
        updateBoard();
        return;
      }
      wiggle(i);
      sel = null;
      say(t('bagh.cantMove'));
      updateBoard();
      return;
    }
    if (v) {
      wiggle(i);
      say(t('bagh.notYours'));
      return;
    }
    if (sel !== null) {
      sel = null;
      note = '';
      updateBoard();
    }
  }

  // ---------- input: taps (and the keyboard) and drags ----------

  const board = $('#baghchal-board');
  board.addEventListener('click', (e) => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    const btn = e.target.closest('.bpt');
    if (btn && game) tapPoint(Number(btn.dataset.i));
  });

  board.addEventListener('pointerdown', (e) => {
    swallowClick = false;
    if (!game || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const btn = e.target.closest('.bpt');
    if (!btn || busy() || !humanTurn() || placing()) return;
    const i = Number(btn.dataset.i);
    if (game.g.board[i] !== game.g.turn || !legal().some((m) => m.from === i)) return;
    drag = { id: e.pointerId, from: i, x: e.clientX, y: e.clientY, active: false, ghost: null };
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_START) return;
      if (busy() || !humanTurn()) return endDrag();
      drag.active = true;
      sel = drag.from;
      note = t('bagh.pickTarget');
      const r = points[drag.from].getBoundingClientRect();
      const ghost = document.createElement('span');
      ghost.className = 'bagh-ghost';
      ghost.style.width = `${r.width}px`;
      ghost.style.height = `${r.height}px`;
      ghost.innerHTML = pieceSvg(kindOf(game.g.board[drag.from]));
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      drag.w = r.width;
      updateBoard();
    }
    e.preventDefault();
    drag.ghost.style.transform = `translate(${e.clientX - drag.w / 2}px, ${e.clientY - drag.w / 2}px)`;
    const over = pointAt(e.clientX, e.clientY);
    for (const b of points) b.classList.toggle('hover', Number(b.dataset.i) === over && b.classList.contains('target'));
  });

  const finishDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    endDrag();
    if (!d.active) return; // a plain tap: the click handles it
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
    const to = e.type === 'pointerup' ? pointAt(e.clientX, e.clientY) : -1;
    const m = to >= 0 && humanTurn() && !busy() ? legal().find((x) => x.from === d.from && x.to === to) : null;
    if (m) {
      sel = null;
      note = '';
      playMove(m, { dragged: true });
    } else {
      sel = d.from; // dropped elsewhere: the piece goes back and stays picked up, its dots showing
      updateBoard();
    }
  };
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);

  function endDrag() {
    if (!drag) return;
    drag.ghost?.remove();
    for (const b of points) b.classList.remove('hover');
    drag = null;
  }

  /** The point under the finger, or the nearest one within half a point's spacing. */
  function pointAt(x, y) {
    let best = -1;
    let bestD = Infinity;
    let cell = 44;
    for (let i = 0; i < points.length; i++) {
      const r = points[i].getBoundingClientRect();
      cell = r.width;
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return bestD <= cell * 0.7 ? best : -1;
  }

  // ---------- moves and their animation ----------

  /** Play a move: animate it, then update the game. */
  function playMove(move, { dragged = false } = {}) {
    const g0 = game.g;
    const player = g0.turn;
    const token = plays;
    moving = true;
    updateBoard();
    animate(move, player, dragged, () => {
      if (token !== plays) return;
      moving = false;
      if (game.g !== g0) {
        updateBoard();
        return;
      }
      game.history.push({ g: g0, player, last: game.last });
      game.g = play(g0, move);
      game.last = move;
      if (move.over >= 0) {
        sfx.boop();
        note = t('bagh.hop');
      } else {
        sfx.thud(0.35);
        note = '';
      }
      updateBoard();
      if (game.g.over) finish();
      else if (isCpu() && game.g.turn === cpuPlayer() && onScreen('baghchal')) cpuTurn();
    });
  }

  /** A flying copy of a piece from one rectangle to another (with a hop in the middle). */
  function fly(html, from, to, { ms = STEP_MS, hop = false } = {}) {
    return new Promise((resolve) => {
      const b = board.getBoundingClientRect();
      const el = document.createElement('span');
      el.className = 'bagh-fly';
      el.style.left = `${from.left - b.left}px`;
      el.style.top = `${from.top - b.top}px`;
      el.style.width = `${from.width}px`;
      el.style.height = `${from.height}px`;
      el.innerHTML = html;
      board.appendChild(el);
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const s = to.width / from.width;
      const frames = [{ transform: 'translate(0, 0) scale(1)' }];
      if (hop) frames.push({ transform: `translate(${dx / 2}px, ${dy / 2 - from.height * 0.5}px) scale(${(1 + s) / 2 + 0.15})`, offset: 0.5 });
      frames.push({ transform: `translate(${dx}px, ${dy}px) scale(${s})` });
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        el.remove();
        resolve();
      };
      try {
        const anim = el.animate(frames, { duration: ms, easing: 'ease-in-out' });
        anim.onfinish = end;
        anim.oncancel = end;
      } catch {
        end();
      }
      setTimeout(end, ms + 400); // safety net if the animation never reports back
    });
  }

  async function animate(move, player, dragged, done) {
    if (reducedMotion() || !board.isConnected || !points[move.to]?.getBoundingClientRect().height) {
      done();
      return;
    }
    const target = points[move.to].getBoundingClientRect();
    const piece = pieceSvg(kindOf(player));
    if (move.from < 0) {
      // a new goat comes from the goats' chip
      const chip = document.querySelector('#baghchal-turn .vier-chip[data-player="1"] .piece');
      const r = chip?.getBoundingClientRect();
      if (r?.width) await fly(piece, r, target, { ms: STEP_MS + 60 });
    } else if (!dragged) {
      const from = points[move.from];
      from.innerHTML = '';
      from.dataset.piece = '';
      await fly(piece, from.getBoundingClientRect(), target, { ms: move.over >= 0 ? STEP_MS + 120 : STEP_MS, hop: move.over >= 0 });
    } else {
      const from = points[move.from];
      from.innerHTML = '';
      from.dataset.piece = '';
    }
    if (move.over >= 0) {
      // the goat that was jumped hops off to the meadow and falls asleep there
      const goat = points[move.over];
      const spot = document.querySelector(`#baghchal-meadow .bagh-spot[data-k="${game.g.captured}"]`);
      const sr = spot?.getBoundingClientRect();
      const gr = goat.getBoundingClientRect();
      goat.innerHTML = '';
      goat.dataset.piece = '';
      points[move.to].innerHTML = piece;
      points[move.to].dataset.piece = String(player);
      if (sr?.width) await fly(sleepyGoatSvg(), gr, sr, { ms: 520, hop: true });
    }
    done();
  }

  // ---------- the computer ----------

  /** The page's own move: a smaller budget; null when it fails (the caller then plays any legal move). */
  function pageMove({ board: b, toPlace, captured, player, level, seed }) {
    try {
      return chooseMove({ board: b, toPlace, captured }, player, level, mulberry32(seed), level > 1 ? { nodes: PAGE_NODES } : {});
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  const thinker = createThinker({
    makeWorker: () => (typeof Worker === 'undefined' ? null : new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' })),
    onPage: (request) => new Promise((resolve) => setTimeout(() => resolve(pageMove(request)), 0)),
    timeout: WORKER_TIMEOUT,
  });

  /** Ask for the computer's move: in the worker for medium and hard, on the page for easy. */
  function think(request) {
    if (request.level <= 1) return new Promise((resolve) => setTimeout(() => resolve(pageMove(request)), 0));
    return thinker.ask(request.seed, request);
  }

  function cpuTurn() {
    if (cpuJob || moving || !game || game.g.over || game.g.turn !== cpuPlayer()) return;
    const g = game;
    const job = (cpuJob = (Math.random() * 4294967295) >>> 0 || 1);
    const started = performance.now();
    const token = plays;
    sel = null;
    updateBoard();
    const request = { board: g.g.board.slice(), toPlace: g.g.toPlace, captured: g.g.captured, player: cpuPlayer(), level: g.setup.level, seed: job };
    think(request).then((m) => {
      const wait = Math.max(0, CPU_DELAY - (performance.now() - started));
      cpuTimer = setTimeout(() => {
        cpuTimer = null;
        if (cpuJob !== job || token !== plays || game !== g) return;
        cpuJob = 0;
        if (!onScreen('baghchal')) {
          updateTurn();
          return; // resume() asks again
        }
        const moves = legal();
        // a reply that is no legal move here (or none at all): the page decides, or any legal
        // move, so the game never hangs on "thinking"
        let move = m && moves.find((x) => sameMove(x, m));
        if (!move) {
          const p = pageMove({ ...request, board: g.g.board });
          move = moves.find((x) => sameMove(x, p)) || moves[0];
        }
        if (move) playMove(move);
        else updateBoard();
      }, wait);
    });
  }

  // ---------- the end ----------

  function finish() {
    const { g, setup } = game;
    const over = g.over;
    cancelCpu();
    sel = null;
    if (setup.mode === 'cpu' && over.winner === kid()) {
      const key = winKey(setup);
      store.recordStars(meta.id, key, (wins()[key] || 0) + 1);
    }
    if (over.winner && (setup.mode === 'duo' || over.winner === kid())) sfx.win();
    else if (over.winner) sfx.lose();
    else sfx.lid();
    note = '';
    updateBoard();
    const done = game;
    cancelCard();
    cardTimer = setTimeout(() => {
      cardTimer = null;
      if (game !== done || !done.g.over || !onScreen('baghchal')) return;
      showEndCard();
    }, 900);
  }

  function showEndCard() {
    const { g, setup } = game;
    const over = g.over;
    let title;
    let text;
    let art;
    if (over.draw) {
      title = t('bagh.draw');
      text = t(over.reason === 'quiet' ? 'bagh.drawQuiet' : 'bagh.drawRepeat');
      art = `<span class="vier-ov bagh-ov">${pieceSvg('goat')}${pieceSvg('tiger')}</span>`;
    } else if (setup.mode === 'cpu' && over.winner !== kid()) {
      title = t('bagh.cpuWins');
      text = t('bagh.cpuWinsText');
      art = `<span class="vier-ov">${robotSvg()}</span>`;
    } else {
      title = setup.mode === 'cpu' ? t('bagh.youWin') : t(over.winner === GOAT ? 'bagh.goatsWin' : 'bagh.tigersWin');
      text = t(over.reason === 'trapped' ? 'bagh.trappedText' : over.reason === 'stuck' ? 'bagh.stuckText' : 'bagh.capturedText');
      art = `<span class="vier-ov won bagh-ov">${pieceSvg(kindOf(over.winner))}</span>`;
    }
    const buttons = [[t('bagh.again'), 'big primary', again]];
    if (canUndo()) buttons.push([t('bagh.undo'), 'big secondary', () => (shell.hideOverlay(), undoMove())]);
    buttons.push([t('bagh.menuBtn'), 'big secondary', () => shell.show('baghchal-menu')]);
    shell.showOverlay({ art, title, text, buttons });
  }

  /** Take back the last move: against the computer the child's last move (and its answer). */
  function undoMove() {
    if (!canUndo()) return;
    cancelCpu();
    cancelCard();
    endDrag();
    plays++;
    if (isCpu()) {
      while (game.history.length) {
        const h = game.history.pop();
        game.g = h.g;
        game.last = h.last;
        if (h.player === kid()) break;
      }
    } else {
      const h = game.history.pop();
      game.g = h.g;
      game.last = h.last;
    }
    sel = null;
    note = '';
    updateBoard();
  }

  $('#baghchal-undo').insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${UNDO}</svg>`);
  $('#baghchal-undo').addEventListener('click', () => {
    tap();
    undoMove();
  });
  $('#baghchal-back').addEventListener('click', () => {
    tap();
    leave();
  });

  /** The field -> the menu (the game is kept for this session: "keep playing"). */
  function leave() {
    shell.hideOverlay();
    cancelCpu();
    cancelCard();
    endDrag();
    // a piece on its way still lands (its timer runs on); the computer answers when the child is back
    sel = null;
    shell.show('baghchal-menu');
  }

  function fitBoard() {
    if (!game) return;
    const stage = $('#baghchal-stage');
    const side = window.innerWidth > window.innerHeight * 1.2; // sideways: the turn panel beside the field
    stage.classList.toggle('side', side);
    const panel = $('#baghchal-stage .vier-side');
    const w = stage.clientWidth - 12 - (side ? panel.offsetWidth + 12 : 0);
    const h = stage.clientHeight - 10 - (side ? 0 : panel.offsetHeight + 10);
    const cell = Math.max(44, Math.floor(Math.min(w / 5.2, h / 5.2, 104)));
    board.style.setProperty('--cell', `${cell}px`);
  }

  return {
    open() {
      shell.show('baghchal-menu');
    },
    leave,
    async init() {
      return true;
    },
    testHook() {
      return {
        choose: (setup) => {
          choice = { ...(choice || savedSetup()), ...setup };
          if (onScreen('baghchal-menu')) renderMenu();
        },
        start: () => start(),
        tap: (i) => tapPoint(i),
        state: () =>
          game
            ? {
                board: game.g.board.slice(),
                turn: game.g.turn,
                toPlace: game.g.toPlace,
                captured: game.g.captured,
                over: game.g.over,
                busy: busy(),
                thinking: !!cpuJob,
                history: game.history.length,
                sel,
                setup: { ...game.setup },
                canUndo: canUndo(),
                moves: humanTurn() ? legal().map((m) => ({ ...m })) : [],
              }
            : null,
        /** For tests: put a position on the board. */
        setGame: (b, turn = GOAT, toPlace = 0, captured = 0) => {
          if (!game) return;
          cancelCpu();
          plays++;
          game.g = newGame(b.slice(), turn, toPlace, captured);
          game.history = [];
          game.last = null;
          sel = null;
          updateBoard();
          if (isCpu() && game.g.turn === cpuPlayer() && !game.g.over) cpuTurn();
        },
        undo: () => undoMove(),
        wins: () => wins(),
      };
    },
  };
}
