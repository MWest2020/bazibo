// Schaken (chess): tap a piece and the squares it may go to glow (a dot for a quiet move, a ring
// around a piece it can capture), then tap one of them, or drag the piece there. Only legal moves
// glow, so an illegal try simply does not happen. A king in check glows softly; a pawn that reaches
// the far row asks what it becomes (the queen first). Two ways to play: together on one screen, or
// against the computer (ai.js) at three levels, the child with white; medium and hard are in the
// full version, easy has a hint button. Calm: no clocks.
// The rules live in rules.js, the pieces in art.js; the shell (web/js/main.js) owns the overlay
// card, the sound settings and the purchase, and passes them in as `shell`. The computer thinks in
// a worker (ai-worker.js) through Dammen's think.js, so the screen never freezes.
//
// Saved (games.schaak): the child's wins against the computer per level, as non-decreasing
// counters in `stars` ('cpu-<level>'), and the last menu choice ('setup': { mode, level }). Games
// played together are not counted.
//
// Small squares: on a 320 px phone a square is under 44 px. A tap inside a square always means that
// square once a piece is picked up (a glowing square plays, anything else puts the piece down), so a
// tap never plays a move by snapping to a neighbour. Only picking a piece up snaps: with nothing
// picked up, a tap within a finger (TOUCH_REACH) of a piece that can move picks it up; and a tap
// between the squares (on the frame) goes to the nearest tappable square within reach (resolveTap).
import { meta } from './meta.js';
import {
  WHITE, BLACK, KING, FLAG_EP, FLAG_CASTLE_K, FLAG_CASTLE_Q, PROMOTIONS,
  legalMoves, newGame, play, sameMove, colorOf, kindOf, squareName, isLight, isCheck, toFen, fromFen, other,
} from './rules.js';
import { chooseMove, hintMove, mulberry32, PAGE_NODES } from './ai.js';
import { createThinker } from '../dammen/think.js';
import { pieceSvg } from './art.js';
import { robotSvg, duoSvg, TROPHY } from '../vier/art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';
import { foldLocked } from '../../js/fold.js';

const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const UNDO = '<path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';
const BULB = '<path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="#ffd45c" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.6 19.5h4.8M10.4 22h3.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';

export const DEFAULT_SETUP = Object.freeze({ mode: 'cpu', level: 1 });
const CPU_DELAY = 520; // ms before the computer moves, so it feels like a turn
const WORKER_TIMEOUT = 6000; // a worker that does not answer: this move is made on the page
const STEP_MS = 260;
const DRAG_START = 8; // px a finger moves before a press becomes a drag
export const TOUCH_REACH = 26; // px from a square's centre: a finger's reach for small squares
const KID = WHITE; // against the computer the child plays white (and starts)

/**
 * Which square a tap or a drop means (pure). `hit`: the square the point is inside (-1: none, e.g.
 * the frame); `picked`: a piece is picked up; `cands`: the squares that can be tapped now (pieces
 * that can move, and with a piece picked up its targets); `near`: the nearest of those with its
 * distance { i, d } (or null); `own`: the hit square holds a piece of the side to move.
 * A square that was hit means that square, except that with nothing picked up a tap on an empty or
 * immovable spot within reach of a movable piece picks that piece up (never a move).
 */
export function resolveTap({ hit, picked, cands, near, reach, own = false }) {
  const inReach = !!near && near.d <= reach;
  if (hit < 0) return inReach ? near.i : -1;
  if (picked || cands.includes(hit) || own) return hit;
  return inReach ? near.i : hit;
}

/** The counter key for a result. */
export const winKey = (setup) => `cpu-${setup.level}`;

/** Where the piece on `from` may go: [{ to, capture }] (a promotion's four moves count once). */
export function targetsFrom(moves, from) {
  const out = new Map();
  for (const m of moves) if (m.from === from && !out.has(m.to)) out.set(m.to, { to: m.to, capture: !!m.captured });
  return [...out.values()];
}

/** The moves from `from` to `to` (four for a promotion, the queen first). */
export function movesTo(moves, from, to) {
  const list = moves.filter((m) => m.from === from && m.to === to);
  return list.sort((a, b) => PROMOTIONS.indexOf(a.promo) - PROMOTIONS.indexOf(b.promo));
}

export function createSchaak(shell) {
  const { t, tap } = shell;
  const $ = (sel) => document.querySelector(sel);
  const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const wins = () => store.loadProgress(meta.id).stars;
  const savedSetup = () => {
    const s = store.loadGameOption(meta.id, 'setup', null) || {};
    return { mode: s.mode === 'duo' ? 'duo' : 'cpu', level: [1, 2, 3].includes(s.level) ? s.level : DEFAULT_SETUP.level };
  };

  let choice = null; // the menu's choice: { mode, level }
  let game = null; // { setup, g: rules game, history: [{ g, player, last }], last: move|null }
  let sel = null; // the tapped piece's square, or null
  let moving = false; // a piece is on its way
  let cpuJob = 0; // the id of the computer's pending move (0: none)
  let cpuTimer = null;
  let cardTimer = null;
  let plays = 0; // counts games started and take-backs, so a late answer never lands on a newer board
  let squares = []; // index -> the square's button
  let note = ''; // a short message under the turn chips
  let drag = null; // { id, from, x, y, active, ghost, w }
  let swallowClick = false; // the click that follows a drag
  let promo = null; // a promotion waiting for the child's choice: { from, to, moves }
  let hint = null; // the hint shown: { from, to }
  let checkCache = { g: null, sq: -1 };

  const locked = (setup) => meta.isLocked(setup, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const isCpu = () => game?.setup.mode === 'cpu';
  const cpuPlayer = () => other(KID);
  const humanTurn = () => !!game && !game.g.over && (!isCpu() || game.g.pos.turn === KID);
  const busy = () => moving || !!cpuJob;
  const legal = () => (game ? legalMoves(game.g.pos) : []);
  const sideName = (p) => t(p === WHITE ? 'schaak.white' : 'schaak.black');
  const name = (p) => (isCpu() ? (p === KID ? t('schaak.you') : t('schaak.computer')) : sideName(p));
  const hintOn = () => isCpu() && game.setup.level === 1;

  /** The square of the king in check (the side to move), or -1. */
  function checkSquare() {
    if (!game) return -1;
    if (checkCache.g !== game.g) {
      const { pos } = game.g;
      checkCache = { g: game.g, sq: isCheck(pos) ? pos.board.indexOf(pos.turn === WHITE ? KING : KING + 8) : -1 };
    }
    return checkCache.sq;
  }

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
    if (onScreen('schaak-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'schaak-menu') renderMenu();
    if (name === 'schaak') requestAnimationFrame(fitBoard);
  });
  shell.onLangChange(() => {
    if (onScreen('schaak-menu')) renderMenu();
    if (game) {
      renderHud();
      renderTurn();
      updateBoard();
      if (promo) openPromo(promo.moves);
    }
  });
  window.addEventListener('resize', () => onScreen('schaak') && fitBoard());

  // ---------- menu ----------

  function renderMenu() {
    if (!choice) choice = savedSetup();
    if (locked(choice)) choice.level = 1; // refunded, or the website
    const box = $('#schaak-menu');
    box.textContent = '';
    const head = (key) => {
      const h = document.createElement('h3');
      h.className = 'menu-head';
      h.textContent = t(key);
      box.appendChild(h);
    };
    const lockIcon = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;

    head('schaak.opponentHead');
    const opp = document.createElement('div');
    opp.className = 'option-row';
    const duo = document.createElement('button');
    duo.type = 'button';
    duo.className = 'option-card schaak-opt mode-duo';
    duo.setAttribute('aria-pressed', String(choice.mode === 'duo'));
    duo.innerHTML = `<span class="option-art">${duoSvg()}</span><span class="option-text"><span class="option-title"></span><span class="option-sub"></span></span>`;
    duo.querySelector('.option-title').textContent = t('schaak.duo');
    duo.querySelector('.option-sub').textContent = t('schaak.duoSub');
    duo.addEventListener('click', () => {
      tap();
      choice.mode = 'duo';
      renderMenu();
    });
    opp.appendChild(duo);

    const cpu = document.createElement('div');
    cpu.className = `option-box ${choice.mode === 'cpu' ? 'on' : ''}`;
    cpu.innerHTML = `<span class="option-art">${robotSvg()}</span><span class="option-title"></span><span class="seg-cards" role="group"></span>`;
    cpu.querySelector('.option-title').textContent = t('schaak.cpu');
    cpu.querySelector('.seg-cards').setAttribute('aria-label', t('schaak.cpu'));
    cpu.querySelector('.seg-cards').dataset.foldHead = t('schaak.cpu'); // its locked levels wait in the fold under this name
    const counts = wins();
    for (const level of [1, 2, 3]) {
      const setup = { mode: 'cpu', level };
      const isLocked = locked(setup);
      const n = counts[winKey(setup)] || 0;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `seg-card schaak-level ${isLocked ? 'locked' : ''}`;
      b.dataset.level = String(level);
      b.setAttribute('aria-pressed', String(choice.mode === 'cpu' && choice.level === level));
      const dots = [1, 2, 3].map((k) => `<i class="${k <= level ? 'on' : ''}"></i>`).join('');
      b.innerHTML =
        `<span class="dots" aria-hidden="true">${dots}</span><span class="lv-name"></span>` +
        (isLocked ? lockIcon : n ? `<span class="lv-wins"><svg viewBox="0 0 24 24" aria-hidden="true">${TROPHY}</svg>${n}</span>` : '');
      b.querySelector('.lv-name').textContent = t(`schaak.level${level}`);
      const label = isLocked ? t('schaak.levelLocked', { level: t(`schaak.level${level}`) }) : n ? `${t(`schaak.level${level}`)}, ${t('schaak.wins', { n })}` : t(`schaak.level${level}`);
      b.setAttribute('aria-label', `${t('schaak.cpu')}: ${label}`);
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('schaak.lockedLevel'));
          return;
        }
        choice.mode = 'cpu';
        choice.level = level;
        renderMenu();
      });
      cpu.querySelector('.seg-cards').appendChild(b);
    }
    opp.appendChild(cpu);
    box.appendChild(opp);

    head('schaak.howHead');
    const how = document.createElement('p');
    how.className = 'schaak-how';
    how.textContent = t('schaak.how');
    box.appendChild(how);

    const actions = document.createElement('div');
    actions.className = 'menu-actions';
    if (game && !game.g.over) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'schaak-continue';
      cont.className = 'btn big secondary';
      cont.textContent = t('schaak.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      actions.appendChild(cont);
    }
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.id = 'schaak-play';
    playBtn.className = 'btn big primary';
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg><span></span>';
    playBtn.querySelector('span').textContent = t('schaak.play');
    playBtn.addEventListener('click', () => {
      tap();
      start();
    });
    actions.appendChild(playBtn);
    box.appendChild(actions);
    foldLocked(box);
  }

  // ---------- a game ----------

  function reset() {
    moving = false;
    cancelCpu();
    cancelCard();
    endDrag();
    closePromo();
    sel = null;
    hint = null;
    note = '';
  }

  function start() {
    if (!choice) choice = savedSetup();
    const setup = { mode: choice.mode, level: choice.level };
    if (locked(setup)) {
      shell.offerUnlock(t('schaak.lockedLevel'));
      return;
    }
    store.saveGameOption(meta.id, 'setup', setup);
    plays++;
    reset();
    game = { setup, g: newGame(), history: [], last: null };
    buildBoard();
    renderHud();
    renderTurn();
    updateBoard();
    shell.show('schaak');
  }

  function resume() {
    if (!game) return;
    buildBoard();
    renderHud();
    renderTurn();
    updateBoard();
    shell.show('schaak');
    if (game.g.over) {
      // the game ended while the child was on the menu (back during the last move): its end card now
      cancelCard();
      showEndCard();
      return;
    }
    if (isCpu() && game.g.pos.turn === cpuPlayer()) cpuTurn();
  }

  function again() {
    shell.hideOverlay();
    if (!game) return;
    choice = { ...game.setup };
    start();
  }

  function buildBoard() {
    const el = $('#schaak-board');
    el.textContent = '';
    const grid = document.createElement('div');
    grid.className = 'schaak-grid';
    squares = [];
    for (let i = 0; i < 64; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `ssq ${isLight(i) ? 'light' : 'dark'}`;
      b.dataset.i = String(i);
      b.dataset.sq = squareName(i);
      const pc = document.createElement('span');
      pc.className = 'pc';
      b.appendChild(pc);
      // the names of the files and ranks along the edges, small in the corners
      if (i >> 3 === 7) b.insertAdjacentHTML('beforeend', `<span class="coord file" aria-hidden="true">${squareName(i)[0]}</span>`);
      if ((i & 7) === 0) b.insertAdjacentHTML('beforeend', `<span class="coord rank" aria-hidden="true">${squareName(i)[1]}</span>`);
      grid.appendChild(b);
      squares.push(b);
    }
    el.appendChild(grid);
    el.setAttribute('aria-label', t('schaak.boardLabel'));
  }

  function renderHud() {
    const { setup } = game;
    $('#schaak-sub').textContent = t('schaak.hud');
    $('#schaak-title').textContent = setup.mode === 'cpu' ? t(`schaak.level${setup.level}`) : t('schaak.duo');
    $('#schaak-hint').hidden = !hintOn();
  }

  function renderTurn() {
    const box = $('#schaak-turn');
    box.textContent = '';
    for (const p of [WHITE, BLACK]) {
      const chip = document.createElement('span');
      chip.className = 'vier-chip schaak-chip';
      chip.dataset.player = String(p);
      chip.innerHTML = `${pieceSvg(p, KING)}<span class="name"></span><span class="arrow" aria-hidden="true"></span>`;
      chip.querySelector('.name').textContent = name(p);
      if (isCpu() && p === cpuPlayer()) chip.querySelector('.name').insertAdjacentHTML('afterbegin', robotSvg({ cls: 'tiny' }));
      box.appendChild(chip);
    }
    updateTurn();
  }

  function canUndo() {
    if (!game || moving) return false;
    const { g, history } = game;
    if (isCpu()) return history.some((h) => h.player === KID) && (!g.over || !g.over.winner || g.over.winner !== KID);
    return history.length > 0 && (!g.over || !!g.over.draw);
  }

  function updateTurn() {
    if (!game) return;
    const { g } = game;
    const turn = g.pos.turn;
    for (const chip of document.querySelectorAll('#schaak-turn .vier-chip')) {
      const p = Number(chip.dataset.player);
      chip.classList.toggle('on', !g.over && turn === p);
      chip.classList.toggle('winner', !!g.over?.winner && g.over.winner === p);
      chip.classList.toggle('thinking', !g.over && isCpu() && turn === cpuPlayer() && p === cpuPlayer());
    }
    let text = note;
    if (!text && !g.over) {
      const check = checkSquare() >= 0;
      if (isCpu() && turn === cpuPlayer()) text = t('schaak.thinking');
      else if (check) text = isCpu() ? t('schaak.checkYou') : t('schaak.checkName', { name: sideName(turn) });
      else if (sel !== null) text = t('schaak.pickTarget');
      else if (isCpu()) text = t('schaak.yourTurn');
      else text = t('schaak.turn', { name: sideName(turn) });
    }
    $('#schaak-status').textContent = text;
    $('#schaak-undo').disabled = !canUndo();
    const h = $('#schaak-hint');
    h.hidden = !hintOn();
    h.disabled = !humanTurn() || busy() || !!promo;
  }

  /** Draw the pieces and the hints. */
  function updateBoard() {
    if (!game) return;
    const { g } = game;
    const moves = humanTurn() && !busy() ? legal() : [];
    const movable = new Set(moves.map((m) => m.from));
    const targets = new Map(sel !== null ? targetsFrom(moves, sel).map((x) => [x.to, x]) : []);
    const last = game.last ? [game.last.from, game.last.to] : [];
    const check = checkSquare();
    for (let i = 0; i < 64; i++) {
      const b = squares[i];
      const v = g.pos.board[i];
      const shown = drag?.active && drag.from === i ? 0 : v;
      const key = shown ? String(shown) : '';
      if (b.dataset.piece !== key) {
        b.dataset.piece = key;
        b.firstChild.innerHTML = shown ? pieceSvg(colorOf(shown), kindOf(shown)) : '';
      }
      const tg = targets.get(i);
      b.classList.toggle('can', movable.has(i));
      b.classList.toggle('sel', sel === i);
      b.classList.toggle('target', !!tg && !tg.capture);
      b.classList.toggle('capture', !!tg && tg.capture);
      b.classList.toggle('last', last.includes(i));
      b.classList.toggle('check', check === i);
      b.classList.toggle('hint', !!hint && (hint.from === i || hint.to === i));
      b.setAttribute('aria-label', v ? t('schaak.sqPiece', { sq: squareName(i), piece: t(`schaak.p${colorOf(v)}.${kindOf(v)}`) }) : t('schaak.sq', { sq: squareName(i) }));
      b.disabled = !!g.over;
    }
    $('#schaak-board').classList.toggle('over', !!g.over);
    updateTurn();
  }

  function say(text) {
    note = text;
    updateTurn();
  }

  function wiggle(i) {
    const b = squares[i];
    if (!b) return;
    b.classList.remove('wiggle');
    void b.offsetWidth;
    b.classList.add('wiggle');
    setTimeout(() => b.classList.remove('wiggle'), 420);
  }

  /** A tap on square i (already snapped to the nearest useful square). */
  function tapSquare(i) {
    if (!game || game.g.over || promo || i < 0 || i >= 64) return;
    if (busy() || !humanTurn()) {
      wiggle(i);
      return;
    }
    sfx.unlock();
    const { pos } = game.g;
    const moves = legal();
    const v = pos.board[i];
    if (sel !== null) {
      const list = movesTo(moves, sel, i);
      if (list.length) {
        choose(list);
        return;
      }
    }
    if (v && colorOf(v) === pos.turn) {
      if (moves.some((m) => m.from === i)) {
        sel = sel === i ? null : i;
        sfx.tick();
        note = '';
        updateBoard();
        return;
      }
      wiggle(i);
      sel = null;
      say(t(checkSquare() >= 0 ? 'schaak.cantMoveCheck' : 'schaak.cantMove'));
      updateBoard();
      return;
    }
    // an empty square or a piece of the other side that is no target: put the piece down
    if (sel !== null) {
      sel = null;
      note = '';
      updateBoard();
    }
  }

  /** The child chose a target: one move, or a promotion that asks what the pawn becomes. */
  function choose(list, opts = {}) {
    if (list.length > 1) {
      sel = list[0].from;
      openPromo(list);
      return;
    }
    sel = null;
    note = '';
    playMove(list[0], opts);
  }

  // ---------- the promotion picker ----------

  function openPromo(moves) {
    promo = { from: moves[0].from, to: moves[0].to, moves };
    const board = $('#schaak-board');
    board.querySelector('.schaak-promo')?.remove();
    const color = colorOf(moves[0].piece);
    const box = document.createElement('div');
    box.className = 'schaak-promo';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', t('schaak.promoteHead'));
    box.innerHTML = '<div class="schaak-promo-card"><p class="schaak-promo-head"></p><div class="schaak-promo-row"></div><button type="button" class="btn secondary schaak-promo-cancel"></button></div>';
    box.querySelector('.schaak-promo-head').textContent = t('schaak.promoteHead');
    const row = box.querySelector('.schaak-promo-row');
    for (const m of moves) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `schaak-promo-btn ${m.promo === PROMOTIONS[0] ? 'first' : ''}`;
      b.dataset.kind = String(m.promo);
      b.innerHTML = `${pieceSvg(color, m.promo)}<span></span>`;
      b.querySelector('span').textContent = t(`schaak.kind.${m.promo}`);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        tap();
        const move = moves.find((x) => x.promo === m.promo);
        closePromo();
        sel = null;
        note = '';
        playMove(move);
      });
      row.appendChild(b);
    }
    const cancel = box.querySelector('.schaak-promo-cancel');
    cancel.textContent = t('schaak.promoteCancel');
    const back = (e) => {
      e.stopPropagation();
      if (e.target !== box && e.target !== cancel) return;
      tap();
      const from = promo?.from ?? null;
      closePromo();
      sel = from; // the pawn stays picked up, its squares glowing
      updateBoard();
    };
    box.addEventListener('click', back);
    cancel.addEventListener('click', back);
    board.appendChild(box);
    updateBoard();
    row.querySelector('.first')?.focus({ preventScroll: true });
  }

  function closePromo() {
    promo = null;
    document.querySelector('#schaak-board .schaak-promo')?.remove();
  }

  // ---------- input: taps (and the keyboard) and drags ----------

  const board = $('#schaak-board');
  board.addEventListener('click', (e) => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    if (!game || e.target.closest('.schaak-promo')) return;
    const btn = e.target.closest('.ssq');
    if (e.detail === 0 && btn) {
      tapSquare(Number(btn.dataset.i)); // the keyboard: the focused square
      return;
    }
    const i = nearest(e.clientX, e.clientY);
    if (i >= 0) tapSquare(i);
  });

  /** The squares a tap may go to right now: pieces that can move, and the glowing squares. */
  function tappable() {
    if (!game || !humanTurn() || busy() || promo) return [];
    const moves = legal();
    const out = new Set(moves.map((m) => m.from));
    if (sel !== null) for (const x of targetsFrom(moves, sel)) out.add(x.to);
    return [...out];
  }

  /** The square under the finger, or the nearest tappable one within a finger's reach. */
  function nearest(x, y) {
    const hitEl = document.elementFromPoint(x, y)?.closest?.('.ssq');
    const hit = hitEl ? Number(hitEl.dataset.i) : -1;
    const cands = tappable();
    let best = -1;
    let bestD = Infinity;
    let cell = 44;
    for (const i of cands) {
      const r = squares[i].getBoundingClientRect();
      cell = r.width;
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const v = hit >= 0 ? game.g.pos.board[hit] : 0;
    return resolveTap({ hit, picked: sel !== null, cands, near: best >= 0 ? { i: best, d: bestD } : null, reach: Math.max(cell / 2, TOUCH_REACH), own: !!v && colorOf(v) === game.g.pos.turn });
  }

  /** The square at a point (for a drop): the square under the finger; off the board, the nearest target within reach. */
  function dropAt(x, y, from) {
    const grid = board.querySelector('.schaak-grid')?.getBoundingClientRect();
    if (!grid) return -1;
    const cell = grid.width / 8;
    const c = Math.floor((x - grid.left) / cell);
    const r = Math.floor((y - grid.top) / cell);
    const under = r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1;
    const tos = targetsFrom(legal(), from).map((tg) => tg.to);
    let near = null;
    for (const i of tos) {
      const d = Math.hypot(grid.left + ((i & 7) + 0.5) * cell - x, grid.top + ((i >> 3) + 0.5) * cell - y);
      if (!near || d < near.d) near = { i, d };
    }
    return resolveTap({ hit: under, picked: true, cands: tos, near, reach: Math.max(cell / 2, TOUCH_REACH) });
  }

  board.addEventListener('pointerdown', (e) => {
    swallowClick = false;
    if (!game || drag || promo || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const btn = e.target.closest('.ssq');
    if (!btn || busy() || !humanTurn()) return;
    const i = Number(btn.dataset.i);
    const v = game.g.pos.board[i];
    if (!v || colorOf(v) !== game.g.pos.turn || !legal().some((m) => m.from === i)) return;
    drag = { id: e.pointerId, from: i, x: e.clientX, y: e.clientY, active: false, ghost: null };
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_START) return;
      if (busy() || !humanTurn() || promo) return endDrag();
      drag.active = true;
      sel = drag.from;
      note = '';
      const r = squares[drag.from].getBoundingClientRect();
      const ghost = document.createElement('span');
      ghost.className = 'schaak-ghost';
      const w = Math.max(r.width * 1.25, 48); // a bit bigger than the square, so it shows round the finger
      ghost.style.width = `${w}px`;
      ghost.style.height = `${w}px`;
      const v = game.g.pos.board[drag.from];
      ghost.innerHTML = pieceSvg(colorOf(v), kindOf(v));
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      drag.w = w;
      updateBoard();
    }
    e.preventDefault();
    // the piece rides just above the finger, so the finger never hides it
    drag.ghost.style.transform = `translate(${e.clientX - drag.w / 2}px, ${e.clientY - drag.w * 0.8}px)`;
    const over = dropAt(e.clientX, e.clientY, drag.from);
    for (const b of squares) b.classList.toggle('hover', Number(b.dataset.i) === over && (b.classList.contains('target') || b.classList.contains('capture')));
  });

  const finishDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    endDrag();
    if (!d.active) return; // a plain tap: the click handles it
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
    const to = e.type === 'pointerup' ? dropAt(e.clientX, e.clientY, d.from) : -1;
    const list = to >= 0 && humanTurn() && !busy() ? movesTo(legal(), d.from, to) : [];
    if (list.length) choose(list, { dragged: true });
    else {
      sel = d.from; // dropped elsewhere: the piece goes back and stays picked up, its squares glowing
      updateBoard();
    }
  };
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);

  function endDrag() {
    if (!drag) return;
    drag.ghost?.remove();
    for (const b of squares) b.classList.remove('hover');
    drag = null;
  }

  // ---------- moves and their animation ----------

  /** Play a move: animate it, then update the game. */
  function playMove(move, { dragged = false } = {}) {
    const g0 = game.g;
    const player = g0.pos.turn;
    const token = plays;
    moving = true;
    hint = null;
    updateBoard();
    animate(move, dragged, () => {
      if (token !== plays) return;
      moving = false;
      if (game.g !== g0) {
        updateBoard();
        return;
      }
      game.history.push({ g: g0, player, last: game.last });
      game.g = play(g0, move);
      game.last = move;
      if (move.captured) sfx.pop(1, 0.8);
      else sfx.thud(0.35);
      note = '';
      if (move.flag === FLAG_CASTLE_K || move.flag === FLAG_CASTLE_Q) note = t('schaak.castled');
      else if (move.flag === FLAG_EP) note = t('schaak.enPassant');
      else if (move.promo) {
        note = t('schaak.promoted');
        sfx.chime();
      }
      if (!game.g.over && checkSquare() >= 0) {
        note = '';
        sfx.boop();
      }
      updateBoard();
      if (game.g.over) finish();
      else if (isCpu() && game.g.pos.turn === cpuPlayer() && onScreen('schaak')) cpuTurn();
    });
  }

  /** A flying copy of a piece from one square to another. */
  function fly(html, from, to, ms) {
    return new Promise((resolve) => {
      const b = board.getBoundingClientRect();
      const el = document.createElement('span');
      el.className = 'schaak-fly';
      el.style.left = `${from.left - b.left}px`;
      el.style.top = `${from.top - b.top}px`;
      el.style.width = `${from.width}px`;
      el.style.height = `${from.height}px`;
      el.innerHTML = html;
      board.appendChild(el);
      const dx = to.left - from.left;
      const dy = to.top - from.top;
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        el.remove();
        resolve();
      };
      try {
        const anim = el.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${dx}px, ${dy}px)` }], { duration: ms, easing: 'ease-in-out' });
        anim.onfinish = end;
        anim.oncancel = end;
      } catch {
        end();
      }
      setTimeout(end, ms + 400); // safety net if the animation never reports back
    });
  }

  function clearSquare(i) {
    const b = squares[i];
    if (!b) return;
    b.firstChild.innerHTML = '';
    b.dataset.piece = '';
  }

  async function animate(move, dragged, done) {
    if (reducedMotion() || !board.isConnected || !squares[move.to]?.getBoundingClientRect().height) {
      done();
      return;
    }
    const color = colorOf(move.piece);
    const flights = [];
    const taken = move.flag === FLAG_EP ? move.to + (color === WHITE ? 8 : -8) : move.captured ? move.to : -1;
    if (taken >= 0) squares[taken].classList.add('taken');
    if (!dragged) {
      const from = squares[move.from].getBoundingClientRect();
      clearSquare(move.from);
      flights.push(fly(pieceSvg(color, kindOf(move.piece)), from, squares[move.to].getBoundingClientRect(), STEP_MS));
    } else clearSquare(move.from);
    if (move.flag === FLAG_CASTLE_K || move.flag === FLAG_CASTLE_Q) {
      const rFrom = move.flag === FLAG_CASTLE_K ? move.to + 1 : move.to - 2;
      const rTo = move.flag === FLAG_CASTLE_K ? move.to - 1 : move.to + 1;
      const rect = squares[rFrom].getBoundingClientRect();
      const rook = squares[rFrom].firstChild.innerHTML;
      clearSquare(rFrom);
      flights.push(fly(rook, rect, squares[rTo].getBoundingClientRect(), STEP_MS + 80));
    }
    await Promise.all(flights);
    if (taken >= 0) {
      await new Promise((r) => setTimeout(r, 140));
      squares[taken]?.classList.remove('taken');
    }
    done();
  }

  // ---------- the hint (easy) ----------

  function showHint() {
    if (!game || !hintOn() || !humanTurn() || busy() || promo) return;
    const m = hintMove(game.g.pos, mulberry32((Math.random() * 4294967295) >>> 0));
    if (!m) return;
    hint = { from: m.from, to: m.to };
    sel = m.from;
    note = t('schaak.hintText');
    sfx.chime();
    updateBoard();
  }

  // ---------- the computer ----------

  /** The page's own move: a smaller budget; null when it fails (the caller then plays any legal move). */
  function pageMove({ fen, keys, level, seed }) {
    try {
      return chooseMove(fromFen(fen), level, mulberry32(seed), level > 1 ? { nodes: PAGE_NODES, keys } : { keys });
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
    if (cpuJob || moving || !game || game.g.over || game.g.pos.turn !== cpuPlayer()) return;
    const g = game;
    const job = (cpuJob = (Math.random() * 4294967295) >>> 0 || 1);
    const started = performance.now();
    const token = plays;
    sel = null;
    updateBoard();
    const request = { fen: toFen(g.g.pos), keys: g.g.keys.slice(-120), level: g.setup.level, seed: job };
    think(request).then((m) => {
      const wait = Math.max(0, CPU_DELAY - (performance.now() - started));
      cpuTimer = setTimeout(() => {
        cpuTimer = null;
        if (cpuJob !== job || token !== plays || game !== g) return;
        cpuJob = 0;
        if (!onScreen('schaak')) {
          updateTurn();
          return; // resume() asks again
        }
        const moves = legal();
        // a reply that is no legal move here (or none at all): the page decides, or any legal
        // move, so the game never hangs on "thinking"
        let move = m && moves.find((x) => sameMove(x, m));
        if (!move) {
          const p = pageMove(request);
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
    hint = null;
    if (setup.mode === 'cpu' && over.winner === KID) {
      const key = winKey(setup);
      store.recordStars(meta.id, key, (wins()[key] || 0) + 1);
    }
    if (over.winner && (setup.mode === 'duo' || over.winner === KID)) sfx.win();
    else if (over.winner) sfx.lose();
    else sfx.lid();
    note = over.winner ? t('schaak.mate') : t('schaak.draw');
    updateBoard();
    const done = game;
    cancelCard();
    cardTimer = setTimeout(() => {
      cardTimer = null;
      if (game !== done || !done.g.over || !onScreen('schaak')) return;
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
      title = t('schaak.draw');
      text = t(`schaak.draw.${over.reason}`);
      art = `<span class="vier-ov schaak-ov">${pieceSvg(WHITE, KING)}${pieceSvg(BLACK, KING)}</span>`;
    } else if (setup.mode === 'cpu' && over.winner !== KID) {
      title = t('schaak.cpuWins');
      text = t('schaak.cpuWinsText');
      art = `<span class="vier-ov">${robotSvg()}</span>`;
    } else {
      title = setup.mode === 'cpu' ? t('schaak.youWin') : t('schaak.nameWins', { name: sideName(over.winner) });
      text = t('schaak.winText');
      art = `<span class="vier-ov won schaak-ov">${pieceSvg(over.winner, KING)}</span>`;
    }
    const buttons = [[t('schaak.again'), 'big primary', again]];
    if (canUndo()) buttons.push([t('schaak.undo'), 'big secondary', () => (shell.hideOverlay(), undoMove())]);
    buttons.push([t('schaak.menuBtn'), 'big secondary', () => shell.show('schaak-menu')]);
    shell.showOverlay({ art, title, text, buttons });
  }

  /** Take back the last move: against the computer the child's last move (and its answer). */
  function undoMove() {
    if (!canUndo()) return;
    cancelCpu();
    cancelCard();
    endDrag();
    closePromo();
    plays++;
    if (isCpu()) {
      while (game.history.length) {
        const h = game.history.pop();
        game.g = h.g;
        game.last = h.last;
        if (h.player === KID) break;
      }
    } else {
      const h = game.history.pop();
      game.g = h.g;
      game.last = h.last;
    }
    sel = null;
    hint = null;
    note = '';
    updateBoard();
  }

  $('#schaak-undo').insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${UNDO}</svg>`);
  $('#schaak-undo').addEventListener('click', () => {
    tap();
    undoMove();
  });
  $('#schaak-hint').insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${BULB}</svg>`);
  $('#schaak-hint').addEventListener('click', () => {
    tap();
    showHint();
  });
  $('#schaak-back').addEventListener('click', () => {
    tap();
    leave();
  });

  /** The board -> the menu (the game is kept for this session: "keep playing"). */
  function leave() {
    shell.hideOverlay();
    cancelCpu();
    cancelCard();
    endDrag();
    closePromo();
    // a piece on its way still lands (its timer runs on); the computer answers when the child is back
    sel = null;
    shell.show('schaak-menu');
  }

  function fitBoard() {
    if (!game) return;
    const stage = $('#schaak-stage');
    const side = window.innerWidth > window.innerHeight * 1.2; // sideways: the turn panel beside the board
    stage.classList.toggle('side', side);
    const panel = $('#schaak-stage .vier-side');
    const w = stage.clientWidth - 4 - (side ? panel.offsetWidth + 12 : 0);
    const h = stage.clientHeight - 6 - (side ? 0 : panel.offsetHeight + 8);
    const frame = 0.1; // the frame around the squares, in squares
    const cell = Math.max(24, Math.floor(Math.min(w / (8 + frame * 2), h / (8 + frame * 2), 80)));
    board.style.setProperty('--cell', `${cell}px`);
  }

  return {
    open() {
      shell.show('schaak-menu');
    },
    leave,
    async init() {
      return true;
    },
    testHook() {
      return {
        choose: (setup) => {
          choice = { ...(choice || savedSetup()), ...setup };
          if (onScreen('schaak-menu')) renderMenu();
        },
        start: () => start(),
        tap: (i) => tapSquare(i),
        state: () =>
          game
            ? {
                fen: toFen(game.g.pos),
                board: game.g.pos.board.slice(),
                turn: game.g.pos.turn,
                over: game.g.over,
                busy: busy(),
                thinking: !!cpuJob,
                history: game.history.length,
                sel,
                promo: promo ? { from: promo.from, to: promo.to } : null,
                hint: hint ? { ...hint } : null,
                check: checkSquare(),
                setup: { ...game.setup },
                canUndo: canUndo(),
                moves: humanTurn() ? legal().map((m) => ({ from: m.from, to: m.to, promo: m.promo, flag: m.flag, captured: m.captured })) : [],
              }
            : null,
        /** For tests: put a position on the board (FEN). */
        setFen: (fen) => {
          if (!game) return;
          plays++;
          reset();
          game.g = newGame(fen);
          game.history = [];
          game.last = null;
          updateBoard();
          if (isCpu() && game.g.pos.turn === cpuPlayer() && !game.g.over) cpuTurn();
        },
        undo: () => undoMove(),
        hint: () => showHint(),
        wins: () => wins(),
      };
    },
  };
}
