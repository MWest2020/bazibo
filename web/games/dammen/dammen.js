// Dammen (checkers): tap a piece, then where it goes. Capturing is compulsory: the pieces that can
// capture glow, and a multi-capture is tapped jump by jump (as soon as only one way is left, the
// rest goes by itself). Two ways to play: together on one screen, or against the computer (ai.js)
// at three levels; medium and hard, and the international 10×10 board, are in the full version.
// The rules live in rules.js, the pictures in art.js; the shell (web/js/main.js) owns the overlay
// card, the sound settings and the purchase, and passes them in as `shell`.
//
// Saved (games.dammen): the child's wins against the computer per board and level, as
// non-decreasing counters in `stars` ('cpu-<variant>-<level>'), the last menu choice ('setup':
// { variant, mode, level }) and the look of the pieces ('look': 'pets' | 'classic'). Games played
// together are not counted. Player 1 (the child against the computer) plays from the bottom and
// always starts, as in real draughts.
//
// Small squares: on a 10×10 board on a small phone a square is under 44 px, so a tap goes to the
// nearest square that can be tapped right now (a piece that can move, or a dot), up to almost a
// square away. That gives every useful target a finger-sized area.
import { meta } from './meta.js';
import { VARIANTS, legalMoves, newGame, play, owner, isKing, isDark, sameMove } from './rules.js';
import { chooseMove, mulberry32, PAGE_NODES } from './ai.js';
import { pieceSvg, boardSvg, LOOKS } from './art.js';
import { robotSvg, duoSvg, TROPHY } from '../vier/art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const UNDO = '<path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';

export const DEFAULT_SETUP = Object.freeze({ variant: 'small', mode: 'cpu', level: 1 });
const CPU_DELAY = 480; // ms before the computer moves, so it feels like a turn
const WORKER_TIMEOUT = 6000; // a worker that does not answer: think on the page instead
const HOP_MS = 240;

/** The counter key for a result. */
export const winKey = (setup) => `cpu-${setup.variant}-${setup.level}`;

/**
 * Tapping a move step by step. `moves`: the legal moves; `from`: the chosen piece; `steps`: the
 * squares tapped so far. Returns { targets: the next squares to tap, done: the move when it is
 * decided (the tapped way is complete, or only one way is left) }.
 */
export function pickTargets(moves, from, steps) {
  const cands = moves.filter((m) => m.from === from && steps.every((s, k) => m.path[k] === s));
  if (!cands.length) return { targets: [], done: null };
  if (steps.length) {
    const complete = cands.find((m) => m.path.length === steps.length);
    if (complete) return { targets: [], done: complete };
    if (cands.every((m) => sameMove(m, cands[0]))) return { targets: [], done: cands[0] };
  }
  const targets = [...new Set(cands.map((m) => m.path[steps.length]))];
  return { targets, done: null };
}

export function createDammen(shell) {
  const { t, tap } = shell;
  const $ = (sel) => document.querySelector(sel);
  const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const wins = () => store.loadProgress(meta.id).stars;
  const savedSetup = () => {
    const s = store.loadGameOption(meta.id, 'setup', null) || {};
    return {
      variant: typeof s.variant === 'string' && Object.hasOwn(VARIANTS, s.variant) ? s.variant : DEFAULT_SETUP.variant,
      mode: s.mode === 'duo' ? 'duo' : 'cpu',
      level: [1, 2, 3].includes(s.level) ? s.level : DEFAULT_SETUP.level,
    };
  };
  const savedLook = () => {
    const l = store.loadGameOption(meta.id, 'look', 'pets');
    return LOOKS.includes(l) ? l : 'pets';
  };

  let choice = null; // the menu's choice: { variant, mode, level, look }
  let game = null; // { setup, cfg, look, g: rules game, history: [{ g, player }], last: move|null }
  let sel = null; // the tapped piece and the jumps tapped so far: { from, steps: [] }
  let moving = false; // a piece is on its way
  let cpuJob = 0; // the id of the computer's pending move (0: none)
  let cpuTimer = null;
  let cardTimer = null;
  let plays = 0; // counts games started and take-backs, so a late answer never lands on a newer board
  let squares = []; // index -> the square's element
  let worker = null;
  let workerBroken = false;
  let note = ''; // a short message under the turn chips (must capture, crowned...)

  const locked = (setup) => meta.isLocked(setup, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const isCpu = () => game?.setup.mode === 'cpu';
  const humanTurn = () => game && !game.g.over && (!isCpu() || game.g.turn === 1);
  const busy = () => moving || !!cpuJob;
  const name = (p) => t(`dam.name.${game?.look || choice?.look || 'pets'}${p}`);
  const legal = () => (game ? legalMoves(game.g.board, game.cfg, game.g.turn) : []);

  function cancelCpu() {
    if (cpuTimer) clearTimeout(cpuTimer);
    cpuTimer = null;
    cpuJob = 0;
  }
  function cancelCard() {
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
  }

  shell.unlock.onChange(() => {
    if (onScreen('dammen-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'dammen-menu') renderMenu();
    if (name === 'dammen') requestAnimationFrame(fitBoard);
  });
  shell.onLangChange(() => {
    if (onScreen('dammen-menu')) renderMenu();
    if (game) {
      renderHud();
      renderTurn();
      updateBoard();
    }
  });
  window.addEventListener('resize', () => onScreen('dammen') && fitBoard());

  // ---------- menu ----------

  function renderMenu() {
    if (!choice) choice = { ...savedSetup(), look: savedLook() };
    if (locked({ ...choice, mode: 'duo' })) choice.variant = 'small'; // refunded, or the website
    if (locked(choice)) choice.level = 1;
    const box = $('#dammen-menu');
    box.textContent = '';
    const head = (key) => {
      const h = document.createElement('h3');
      h.className = 'vier-head';
      h.textContent = t(key);
      box.appendChild(h);
    };
    const lockIcon = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
    const option = ({ art, title, sub, pressed, onPick, cls = '', label = '', isLocked = false }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-opt dam-opt ${cls} ${isLocked ? 'locked' : ''}`;
      b.setAttribute('aria-pressed', String(!!pressed));
      b.innerHTML = `<span class="vier-opt-art">${art}</span><span class="vier-opt-text"><span class="vier-opt-title"></span><span class="vier-opt-sub"></span></span>${isLocked ? lockIcon : ''}`;
      b.querySelector('.vier-opt-title').textContent = title;
      b.querySelector('.vier-opt-sub').textContent = sub;
      if (label) b.setAttribute('aria-label', label);
      b.addEventListener('click', () => {
        tap();
        onPick();
      });
      return b;
    };

    // the board
    head('dam.boardHead');
    const boards = document.createElement('div');
    boards.className = 'vier-row';
    for (const id of ['small', 'big']) {
      const cfg = VARIANTS[id];
      const isLocked = locked({ variant: id, mode: 'duo', level: 1 });
      boards.appendChild(
        option({
          art: boardSvg(cfg.size, choice.look),
          title: t(`dam.${id}`),
          sub: `${t(`dam.${id}Sub`)} · ${t('dam.age', { age: cfg.age })}`,
          pressed: choice.variant === id,
          cls: `board-${id}`,
          isLocked,
          label: isLocked ? t('dam.bigLocked') : '',
          onPick: () => {
            if (isLocked) {
              shell.offerUnlock(t('dam.lockedBig'));
              return;
            }
            choice.variant = id;
            renderMenu();
          },
        }),
      );
    }
    box.appendChild(boards);

    // the opponent: together, or the computer at a level
    head('dam.opponentHead');
    const opp = document.createElement('div');
    opp.className = 'vier-row';
    opp.appendChild(
      option({
        art: duoSvg(),
        title: t('dam.duo'),
        sub: t('dam.duoSub'),
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
    cpu.querySelector('.vier-cpu-title').textContent = t('dam.cpu');
    cpu.querySelector('.vier-levels').setAttribute('aria-label', t('dam.cpu'));
    const counts = wins();
    for (const level of [1, 2, 3]) {
      const setup = { variant: choice.variant, mode: 'cpu', level };
      const isLocked = locked(setup);
      const n = counts[winKey(setup)] || 0;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-level dam-level ${isLocked ? 'locked' : ''}`;
      b.dataset.level = String(level);
      b.setAttribute('aria-pressed', String(choice.mode === 'cpu' && choice.level === level));
      const dots = [1, 2, 3].map((k) => `<i class="${k <= level ? 'on' : ''}"></i>`).join('');
      b.innerHTML =
        `<span class="dots" aria-hidden="true">${dots}</span><span class="lv-name"></span>` +
        (isLocked ? lockIcon : n ? `<span class="lv-wins"><svg viewBox="0 0 24 24" aria-hidden="true">${TROPHY}</svg>${n}</span>` : '');
      b.querySelector('.lv-name').textContent = t(`dam.level${level}`);
      const label = isLocked ? t('dam.levelLocked', { level: t(`dam.level${level}`) }) : n ? `${t(`dam.level${level}`)}, ${t('dam.wins', { n })}` : t(`dam.level${level}`);
      b.setAttribute('aria-label', `${t('dam.cpu')}: ${label}`);
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('dam.lockedLevel'));
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

    // the look of the pieces
    head('dam.lookHead');
    const looks = document.createElement('div');
    looks.className = 'vier-row';
    for (const look of LOOKS) {
      looks.appendChild(
        option({
          art: `<span class="dam-pair">${pieceSvg(1, false, look)}${pieceSvg(2, false, look)}</span>`,
          title: t(`dam.look.${look}`),
          sub: t(`dam.look.${look}Sub`),
          pressed: choice.look === look,
          cls: `look-${look}`,
          onPick: () => {
            choice.look = look;
            store.saveGameOption(meta.id, 'look', look);
            if (game) {
              game.look = look;
              renderTurn();
              updateBoard(true);
            }
            renderMenu();
          },
        }),
      );
    }
    box.appendChild(looks);

    // play, and keep playing an unfinished game
    const actions = document.createElement('div');
    actions.className = 'vier-actions';
    if (game && !game.g.over) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'dammen-continue';
      cont.className = 'btn big secondary';
      cont.textContent = t('dam.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      actions.appendChild(cont);
    }
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.id = 'dammen-play';
    playBtn.className = 'btn big primary';
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg><span></span>';
    playBtn.querySelector('span').textContent = t('dam.play');
    playBtn.addEventListener('click', () => {
      tap();
      start();
    });
    actions.appendChild(playBtn);
    box.appendChild(actions);
  }

  // ---------- a game ----------

  function start() {
    if (!choice) choice = { ...savedSetup(), look: savedLook() };
    const setup = { variant: choice.variant, mode: choice.mode, level: choice.level };
    if (locked(setup)) {
      shell.offerUnlock(t(setup.variant === 'big' ? 'dam.lockedBig' : 'dam.lockedLevel'));
      return;
    }
    store.saveGameOption(meta.id, 'setup', setup);
    store.saveGameOption(meta.id, 'look', choice.look);
    const cfg = VARIANTS[setup.variant];
    plays++;
    moving = false;
    cancelCpu();
    cancelCard();
    sel = null;
    note = '';
    game = { setup, cfg, look: choice.look, g: newGame(cfg), history: [], last: null };
    buildBoard();
    renderHud();
    renderTurn();
    updateBoard();
    shell.show('dammen');
  }

  function resume() {
    if (!game) return;
    buildBoard();
    renderHud();
    renderTurn();
    updateBoard();
    shell.show('dammen');
    if (isCpu() && game.g.turn === 2 && !game.g.over) cpuTurn();
  }

  function again() {
    shell.hideOverlay();
    if (!game) return;
    choice = { ...game.setup, look: game.look };
    start();
  }

  function buildBoard() {
    const { size } = game.cfg;
    const el = $('#dammen-board');
    el.textContent = '';
    el.style.setProperty('--size', String(size));
    el.dataset.variant = game.cfg.id;
    const grid = document.createElement('div');
    grid.className = 'dam-grid';
    squares = [];
    let n = 0;
    for (let i = 0; i < size * size; i++) {
      let sq;
      if (isDark(game.cfg, i)) {
        sq = document.createElement('button');
        sq.type = 'button';
        sq.className = 'dsq dark';
        sq.dataset.i = String(i);
        sq.dataset.n = String(++n); // squares are numbered 1..50 (or 1..32), as in draughts notation
      } else {
        sq = document.createElement('span');
        sq.className = 'dsq light';
      }
      grid.appendChild(sq);
      squares.push(sq);
    }
    el.appendChild(grid);
    el.setAttribute('aria-label', t('dam.boardLabel'));
  }

  function renderHud() {
    const { setup } = game;
    $('#dammen-sub').textContent = t('dam.hudSize', { n: game.cfg.size });
    $('#dammen-title').textContent = setup.mode === 'cpu' ? t(`dam.level${setup.level}`) : t('dam.duo');
    $('#dammen-undo').classList.toggle('off', setup.mode !== 'cpu');
  }

  function renderTurn() {
    const box = $('#dammen-turn');
    box.textContent = '';
    for (const p of [1, 2]) {
      const chip = document.createElement('span');
      chip.className = 'vier-chip dam-chip';
      chip.dataset.player = String(p);
      chip.innerHTML = `${pieceSvg(p, false, game.look)}<span class="name"></span><span class="count"></span><span class="arrow" aria-hidden="true"></span>`;
      chip.querySelector('.name').textContent = isCpu() ? (p === 1 ? t('dam.you') : t('dam.computer')) : name(p);
      if (isCpu() && p === 2) chip.querySelector('.name').insertAdjacentHTML('afterbegin', robotSvg({ cls: 'tiny' }));
      box.appendChild(chip);
    }
    updateTurn();
  }

  function updateTurn() {
    if (!game) return;
    const { g } = game;
    const count = [0, 0, 0];
    for (const v of g.board) if (v) count[owner(v)]++;
    for (const chip of document.querySelectorAll('#dammen-turn .vier-chip')) {
      const p = Number(chip.dataset.player);
      chip.classList.toggle('on', !g.over && g.turn === p);
      chip.classList.toggle('winner', !!g.over?.winner && g.over.winner === p);
      chip.classList.toggle('thinking', !g.over && isCpu() && g.turn === 2 && p === 2);
      chip.querySelector('.count').textContent = String(count[p]);
    }
    let text = note;
    if (!text && !g.over) {
      if (isCpu()) text = g.turn === 1 ? t('dam.yourTurn') : t('dam.thinking');
      else text = t('dam.turn', { name: name(g.turn) });
    }
    $('#dammen-status').textContent = text;
    const canUndo = isCpu() && !moving && game.history.some((h) => h.player === 1) && (!g.over || !g.over.winner || g.over.winner === 2);
    $('#dammen-undo').disabled = !canUndo;
  }

  /** Draw the pieces and the hints. `redraw`: also redraw pieces that did not change (a new look). */
  function updateBoard(redraw = false) {
    if (!game) return;
    const { g, cfg } = game;
    const moves = humanTurn() && !busy() ? legal() : [];
    const capturing = moves.length > 0 && moves[0].captured.length > 0;
    const movable = new Set(moves.map((m) => m.from));
    const pick = sel ? pickTargets(moves, sel.from, sel.steps) : { targets: [] };
    const targets = new Set(pick.targets);
    const lastSquares = new Set(game.last ? [game.last.from, ...game.last.path] : []);
    let n = 0;
    for (let i = 0; i < squares.length; i++) {
      if (!isDark(cfg, i)) continue;
      n++;
      const sq = squares[i];
      const v = g.board[i];
      const shown = sel && sel.steps.length && i === sel.from ? 0 : v; // a piece halfway a capture shows where it is
      const atStep = sel && sel.steps.length && i === sel.steps[sel.steps.length - 1] ? g.board[sel.from] : 0;
      const want = atStep || shown;
      const key = want ? `${want}-${game.look}` : '';
      if (redraw || sq.dataset.piece !== key) {
        sq.dataset.piece = key;
        sq.innerHTML = want ? pieceSvg(owner(want), isKing(want), game.look) : '';
      }
      sq.classList.toggle('must', capturing && movable.has(i) && !sel);
      sq.classList.toggle('can', movable.has(i));
      sq.classList.toggle('sel', !!sel && i === (sel.steps.length ? sel.steps[sel.steps.length - 1] : sel.from));
      sq.classList.toggle('target', targets.has(i));
      sq.classList.toggle('last', lastSquares.has(i) && !sel);
      sq.classList.toggle('jumped', !!sel && jumpedSoFar().includes(i));
      const label = v ? t(isKing(v) ? 'dam.squareKing' : 'dam.squarePiece', { n, name: name(owner(v)) }) : t('dam.square', { n });
      sq.setAttribute('aria-label', label);
      sq.disabled = !!g.over;
    }
    $('#dammen-board').classList.toggle('over', !!g.over);
    updateTurn();
  }

  /** The pieces taken so far in a capture being tapped jump by jump. */
  function jumpedSoFar() {
    if (!sel || !sel.steps.length) return [];
    const m = legal().find((x) => x.from === sel.from && sel.steps.every((s, k) => x.path[k] === s));
    return m ? m.captured.slice(0, sel.steps.length) : [];
  }

  function say(text) {
    note = text;
    updateTurn();
  }

  function wiggle(i) {
    const sq = squares[i];
    if (!sq) return;
    sq.classList.remove('wiggle');
    void sq.offsetWidth;
    sq.classList.add('wiggle');
    setTimeout(() => sq.classList.remove('wiggle'), 420);
  }

  /** A tap on square i (already snapped to the nearest useful square). */
  function tapSquare(i) {
    if (!game || game.g.over) return;
    if (busy() || !humanTurn()) {
      wiggle(i);
      return;
    }
    sfx.unlock();
    const moves = legal();
    const v = game.g.board[i];
    if (sel) {
      const pick = pickTargets(moves, sel.from, sel.steps);
      if (pick.targets.includes(i)) {
        const steps = [...sel.steps, i];
        const next = pickTargets(moves, sel.from, steps);
        if (next.done) {
          sel = null;
          note = '';
          playMove(next.done);
          return;
        }
        sel = { from: sel.from, steps };
        sfx.tick();
        say(t('dam.goOn'));
        updateBoard();
        return;
      }
      if (sel.steps.length && i !== sel.from) {
        // halfway a capture: only the dots count (a tap on the piece itself starts over)
        wiggle(i);
        say(t('dam.goOn'));
        return;
      }
    }
    if (v && owner(v) === game.g.turn) {
      if (moves.some((m) => m.from === i)) {
        sel = sel && sel.from === i && !sel.steps.length ? null : { from: i, steps: [] };
        sfx.tick();
        note = sel ? '' : note;
        updateBoard();
        return;
      }
      wiggle(i);
      say(moves[0]?.captured.length ? t('dam.mustCapture') : t('dam.cantMove'));
      sel = null;
      updateBoard();
      return;
    }
    if (v) {
      wiggle(i);
      say(t('dam.notYours'));
      return;
    }
    if (sel) {
      sel = null;
      note = '';
      updateBoard();
    }
  }

  /** The squares a tap may go to right now: pieces that can move, and the dots. */
  function tappable() {
    if (!game || !humanTurn() || busy()) return [];
    const moves = legal();
    const out = new Set(sel && sel.steps.length ? [] : moves.map((m) => m.from));
    if (sel) for (const x of pickTargets(moves, sel.from, sel.steps).targets) out.add(x);
    return [...out];
  }

  /** Board clicks: a keyboard press is the focused square; a finger goes to the nearest useful square. */
  $('#dammen-board').addEventListener('click', (e) => {
    const btn = e.target.closest('.dsq.dark');
    if (!game) return;
    if (e.detail === 0 && btn) {
      tapSquare(Number(btn.dataset.i));
      return;
    }
    const near = nearest(e.clientX, e.clientY);
    if (near >= 0) tapSquare(near);
    else if (btn) tapSquare(Number(btn.dataset.i));
    else if (sel && !sel.steps.length) {
      sel = null;
      updateBoard();
    }
  });

  function nearest(x, y) {
    const cands = tappable();
    if (!cands.length) return -1;
    const hit = document.elementFromPoint(x, y)?.closest?.('.dsq.dark');
    if (hit && cands.includes(Number(hit.dataset.i))) return Number(hit.dataset.i);
    let best = -1;
    let bestD = Infinity;
    let cell = 40;
    for (const i of cands) {
      const r = squares[i].getBoundingClientRect();
      cell = r.width;
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const reach = Math.max(cell * 0.95, 30); // never further than about a square away
    // a tap right on another piece of the player (that cannot move) is that piece, for its message
    if (hit && game.g.board[Number(hit.dataset.i)] && bestD > cell * 0.75) return -1;
    return bestD <= reach ? best : -1;
  }

  /** Play a move: animate it, then update the game. */
  function playMove(move) {
    const g0 = game.g;
    const player = g0.turn;
    const token = plays;
    moving = true;
    updateBoard();
    animate(move, g0.board[move.from], () => {
      if (token !== plays) return;
      moving = false;
      if (game.g !== g0) {
        updateBoard();
        return;
      }
      game.history.push({ g: g0, player, last: game.last });
      game.g = play(g0, game.cfg, move);
      game.last = move;
      if (move.captured.length) sfx.pop(Math.min(move.captured.length, 4), 0.8);
      else sfx.thud(0.4);
      note = move.promote ? t('dam.crowned') : '';
      if (move.promote) sfx.chime();
      updateBoard();
      if (game.g.over) finish();
      else if (isCpu() && game.g.turn === 2 && onScreen('dammen')) cpuTurn();
      else autoSelect();
    });
  }

  /** When exactly one piece must capture, pick it up for the child. */
  function autoSelect() {
    if (!humanTurn()) return;
    const moves = legal();
    const froms = new Set(moves.map((m) => m.from));
    if (moves[0]?.captured.length && froms.size === 1) {
      sel = { from: moves[0].from, steps: [] };
      updateBoard();
    }
    if (moves[0]?.captured.length && !note) say(t('dam.mustCapture'));
  }

  /** The moving piece: hop along its path; the taken pieces fade out at the end. */
  function animate(move, piece, done) {
    const board = $('#dammen-board');
    const from = squares[move.from];
    if (reducedMotion() || !board.isConnected || !from?.getBoundingClientRect().height) {
      done();
      return;
    }
    const b = board.getBoundingClientRect();
    const r0 = from.getBoundingClientRect();
    const fly = document.createElement('span');
    fly.className = 'dfly';
    fly.style.left = `${r0.left - b.left}px`;
    fly.style.top = `${r0.top - b.top}px`;
    fly.style.width = `${r0.width}px`;
    fly.style.height = `${r0.height}px`;
    fly.innerHTML = pieceSvg(owner(piece), isKing(piece), game.look);
    from.innerHTML = '';
    from.dataset.piece = '';
    board.appendChild(fly);
    const frames = [{ transform: 'translate(0, 0) scale(1)', offset: 0 }];
    let px = 0;
    let py = 0;
    move.path.forEach((p, k) => {
      const r = squares[p].getBoundingClientRect();
      const dx = r.left - r0.left;
      const dy = r.top - r0.top;
      // a jump lifts the piece over the one it takes
      if (move.captured.length) frames.push({ transform: `translate(${(px + dx) / 2}px, ${(py + dy) / 2}px) scale(1.2)`, offset: (k + 0.5) / move.path.length });
      frames.push({ transform: `translate(${dx}px, ${dy}px) scale(1)`, offset: (k + 1) / move.path.length });
      px = dx;
      py = dy;
    });
    const ms = HOP_MS * move.path.length + (move.captured.length ? 80 : 0);
    let anim;
    try {
      anim = fly.animate(frames, { duration: ms, easing: 'ease-in-out' });
    } catch {
      anim = null;
    }
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      for (const c of move.captured) squares[c]?.classList.add('taken');
      setTimeout(
        () => {
          fly.remove();
          for (const c of move.captured) squares[c]?.classList.remove('taken');
          done();
        },
        move.captured.length ? 180 : 0,
      );
    };
    if (anim) {
      anim.onfinish = end;
      anim.oncancel = end;
    }
    setTimeout(end, ms + 400); // safety net if the animation never reports back
  }

  // ---------- the computer ----------

  function getWorker() {
    if (workerBroken || typeof Worker === 'undefined') return null;
    if (worker) return worker;
    try {
      worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
      worker.onerror = () => {
        workerBroken = true;
        worker = null;
      };
    } catch {
      workerBroken = true;
      worker = null;
    }
    return worker;
  }

  /** Ask for the computer's move: in the worker for medium and hard, on the page otherwise. */
  function think(board, cfg, level, seed) {
    const onPage = () =>
      new Promise((resolve) => setTimeout(() => resolve(chooseMove(board, cfg, 2, level, mulberry32(seed), level > 1 ? { nodes: PAGE_NODES } : {})), 0));
    const w = level > 1 ? getWorker() : null;
    if (!w) return onPage();
    return new Promise((resolve) => {
      const id = seed;
      let settled = false;
      const settle = (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        w.removeEventListener('message', onMsg);
        resolve(v);
      };
      const onMsg = (e) => {
        if (e.data?.id !== id) return;
        if (e.data.ok) settle(e.data.move);
        else onPage().then(settle);
      };
      const timer = setTimeout(() => {
        // a stuck or broken worker: stop it and think on the page from now on
        try {
          w.terminate();
        } catch {
          // already gone
        }
        worker = null;
        workerBroken = true;
        onPage().then(settle);
      }, WORKER_TIMEOUT);
      w.addEventListener('message', onMsg);
      w.postMessage({ id, board, variant: cfg.id, player: 2, level, seed });
    });
  }

  function cpuTurn() {
    if (cpuJob || moving || !game || game.g.over || game.g.turn !== 2) return;
    const g = game;
    const job = (cpuJob = (Math.random() * 4294967295) >>> 0 || 1);
    const started = performance.now();
    const token = plays;
    updateTurn();
    think(g.g.board.slice(), g.cfg, g.setup.level, job).then((m) => {
      const wait = Math.max(0, CPU_DELAY - (performance.now() - started));
      cpuTimer = setTimeout(() => {
        cpuTimer = null;
        if (cpuJob !== job || token !== plays || game !== g) return;
        cpuJob = 0;
        if (!onScreen('dammen')) {
          updateTurn();
          return; // resume() asks again
        }
        const move = m && legal().find((x) => sameMove(x, m) && x.captured.join() === (m.captured || []).join());
        if (move) playMove(move);
        else updateTurn();
      }, wait);
    });
  }

  // ---------- the end ----------

  function finish() {
    const { g, setup } = game;
    const over = g.over;
    cancelCpu();
    sel = null;
    if (over.winner === 1 && setup.mode === 'cpu') {
      const key = winKey(setup);
      store.recordStars(meta.id, key, (wins()[key] || 0) + 1);
    }
    if (over.winner && (setup.mode === 'duo' || over.winner === 1)) sfx.win();
    else if (over.winner) sfx.lose();
    else sfx.lid();
    note = '';
    updateBoard();
    const done = game;
    cancelCard();
    cardTimer = setTimeout(() => {
      cardTimer = null;
      if (game !== done || !done.g.over || !onScreen('dammen')) return;
      showEndCard();
    }, 900);
  }

  function showEndCard() {
    const { g, setup, look } = game;
    const over = g.over;
    let title;
    let text;
    let art;
    if (over.draw) {
      title = t('dam.draw');
      text = t(over.reason === 'quiet' ? 'dam.drawQuiet' : 'dam.drawRepeat');
      art = `<span class="vier-ov dam-ov">${pieceSvg(1, false, look)}${pieceSvg(2, false, look)}</span>`;
    } else if (setup.mode === 'cpu' && over.winner === 2) {
      title = t('dam.cpuWins');
      text = t('dam.cpuWinsText');
      art = `<span class="vier-ov">${robotSvg()}</span>`;
    } else {
      title = setup.mode === 'cpu' ? t('dam.youWin') : t('dam.nameWins', { name: name(over.winner) });
      text = t('dam.winText');
      art = `<span class="vier-ov won dam-ov">${pieceSvg(over.winner, true, look)}</span>`;
    }
    const buttons = [[t('dam.again'), 'big primary', again]];
    if (setup.mode === 'cpu' && over.winner !== 1) buttons.push([t('dam.undo'), 'big secondary', () => (shell.hideOverlay(), undoMove())]);
    buttons.push([t('dam.menuBtn'), 'big secondary', () => shell.show('dammen-menu')]);
    shell.showOverlay({ art, title, text, buttons });
  }

  /** Against the computer: take back the child's last move (and the computer's answer). */
  function undoMove() {
    if (!isCpu() || moving || !game.history.some((h) => h.player === 1)) return;
    if (game.g.over?.winner === 1) return; // a win is a win
    cancelCpu();
    cancelCard();
    plays++;
    while (game.history.length) {
      const h = game.history.pop();
      game.g = h.g;
      game.last = h.last;
      if (h.player === 1) break;
    }
    sel = null;
    note = '';
    updateBoard();
    autoSelect();
  }

  $('#dammen-undo').insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${UNDO}</svg>`);
  $('#dammen-undo').addEventListener('click', () => {
    tap();
    undoMove();
  });
  $('#dammen-back').addEventListener('click', () => {
    tap();
    leave();
  });

  /** The board -> the menu (the game is kept for this session: "keep playing"). */
  function leave() {
    shell.hideOverlay();
    cancelCpu();
    cancelCard();
    // a piece on its way still lands (its timer runs on); the computer answers when the child is back
    sel = null;
    shell.show('dammen-menu');
  }

  function fitBoard() {
    if (!game) return;
    const stage = $('#dammen-stage');
    const side = window.innerWidth > window.innerHeight * 1.2; // sideways: the turn panel beside the board
    stage.classList.toggle('side', side);
    const panel = $('#dammen-stage .vier-side');
    const { size } = game.cfg;
    const w = stage.clientWidth - 12 - (side ? panel.offsetWidth + 12 : 0);
    const h = stage.clientHeight - 10 - (side ? 0 : panel.offsetHeight + 10);
    const frame = 0.18; // the frame around the squares, in squares
    const cell = Math.max(22, Math.floor(Math.min(w / (size + frame * 2), h / (size + frame * 2), 76)));
    $('#dammen-board').style.setProperty('--cell', `${cell}px`);
  }

  return {
    open() {
      shell.show('dammen-menu');
    },
    leave,
    async init() {
      return true;
    },
    testHook() {
      return {
        choose: (setup) => {
          choice = { ...(choice || { ...savedSetup(), look: savedLook() }), ...setup };
          if (onScreen('dammen-menu')) renderMenu();
        },
        start: () => start(),
        tap: (i) => tapSquare(i),
        state: () =>
          game
            ? {
                board: game.g.board.slice(),
                turn: game.g.turn,
                over: game.g.over,
                busy: busy(),
                thinking: !!cpuJob,
                history: game.history.length,
                sel: sel ? { from: sel.from, steps: sel.steps.slice() } : null,
                setup: { ...game.setup },
                size: game.cfg.size,
                look: game.look,
                moves: legal().map((m) => ({ from: m.from, path: m.path.slice(), captured: m.captured.slice() })),
              }
            : null,
        /** For tests: put a position on the board (player 1 to move). */
        setBoard: (board) => {
          if (!game) return;
          cancelCpu();
          game.g = newGame(game.cfg, board.slice(), 1);
          game.history = [];
          game.last = null;
          sel = null;
          updateBoard();
        },
        undo: () => undoMove(),
        wins: () => wins(),
      };
    },
  };
}
