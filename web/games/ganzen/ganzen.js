// Ganzenbord (the game of the goose): throw the die and walk your goose along the spiral to 63.
// The rules live in rules.js (special squares, waiting, the bounce at 63), the spiral in board.js,
// the pictures in art.js; the shell (web/js/main.js) owns the overlay card, the sound settings and
// the purchase, and passes them in as `shell`.
//
// "Zelf tellen" (count yourself): after the throw the child taps every square the goose walks to,
// one by one; each tap makes the goose hop and shows the count big on that square. Without it the
// goose hops by itself, with the same big numbers. There is no voice in this game (Mark, 13 Nov):
// only the shell's short sound effects, which follow the sound setting.
//
// Players: 2 (free) to 4 (full version), each a child or a computer goose; the computer throws and
// walks by itself. Saved (games.ganzen): `setup` { board, players: ['kid'|'cpu', ...], count } and
// `stars` { 'won-<board>': games a child's goose won } (a counter that only goes up).
import { meta } from './meta.js';
import { END, MAX_PLAYERS, kindOf, newGame, throwDie, rollDie } from './rules.js';
import { spiral, nextTap, GRID } from './board.js';
import { gooseSvg, iconSvg, dieSvg, boardThumb, kidSvg, robotBadge, THEMES, BOARDS, GEESE_LOOK } from './art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const CELLS = spiral();
// two arrows going round: tap to change
const SWAP = '<svg class="swap" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 0 0-13.5-2M5 16a8 8 0 0 0 13.5 2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M5 2.5v4h4M19 21.5v-4h-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Messages with a second-person form for the one child playing ("Je zit in de put"), in strings.js as `<key>.you`. */
export const YOU_KEYS = Object.freeze(['ganzen.ev.inn', 'ganzen.ev.well', 'ganzen.ev.prison', 'ganzen.ev.skip.inn', 'ganzen.ev.skip.well', 'ganzen.ev.skip.prison', 'ganzen.threw']);

export const DEFAULT_SETUP = Object.freeze({ board: 'classic', players: Object.freeze(['kid', 'cpu']), count: true });
const HOP = 260; // ms per step
const PAUSE = 900; // ms to read a message on a special square
const CPU_WAIT = 800; // ms before a computer goose throws

/** The counter key for a child's win on a board. */
export const winKey = (board) => `won-${board}`;

/** A saved setup, made safe: a known board, 2-4 players of a known kind, count on or off. */
export function cleanSetup(s) {
  const out = { board: DEFAULT_SETUP.board, players: DEFAULT_SETUP.players.slice(), count: DEFAULT_SETUP.count };
  if (!s || typeof s !== 'object') return out;
  if (typeof s.board === 'string' && BOARDS.includes(s.board)) out.board = s.board;
  if (Array.isArray(s.players) && s.players.length >= 2 && s.players.length <= MAX_PLAYERS && s.players.every((p) => p === 'kid' || p === 'cpu')) out.players = s.players.slice();
  if (typeof s.count === 'boolean') out.count = s.count;
  return out;
}

export function createGanzen(shell) {
  const { t, tap } = shell;
  const $ = (sel) => document.querySelector(sel);
  const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const wins = () => store.loadProgress(meta.id).stars;

  let choice = null; // the menu's choice: { board, players, count }
  let game = null; // { setup, state: rules game, shown: [square per goose], phase, pending, over }
  let plays = 0; // bumps on start / leave: every running animation checks it and stops
  let speed = 1; // tests make it faster
  let forced = []; // tests: the next throws
  let cells = []; // square -> its element
  let pawns = [];
  let cpuTimer = null;

  const locked = (setup) => meta.isLocked(setup, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const sleep = (ms) => new Promise((r) => setTimeout(r, reducedMotion() ? Math.min(ms, 120) * speed : ms * speed));
  const nameOf = (k) => t(`ganzen.goose.${GEESE_LOOK[k].id}`);
  const isCpu = (k) => game?.setup.players[k] === 'cpu';
  const kids = () => game.setup.players.filter((p) => p === 'kid').length;
  /** "Jij" when one child plays against computer geese; else the goose's colour. */
  /** One child against computer geese: that child's goose is "you". */
  const isYou = (k) => !isCpu(k) && kids() === 1;
  const whoName = (k) => (isYou(k) ? t('ganzen.you') : nameOf(k));
  /** A message about goose k: the ".you" wording when it is the child's ("Je zit in de put"). */
  const about = (key, k, params = {}) => t(isYou(k) && YOU_KEYS.includes(key) ? `${key}.you` : key, { name: nameOf(k), ...params });

  shell.unlock.onChange(() => {
    if (onScreen('ganzen-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'ganzen-menu') renderMenu();
    if (name === 'ganzen') requestAnimationFrame(fitBoard);
  });
  shell.onLangChange(() => {
    if (onScreen('ganzen-menu')) renderMenu();
    if (game) {
      renderHud();
      renderBoard();
      renderTurn();
    }
  });
  window.addEventListener('resize', () => onScreen('ganzen') && fitBoard());

  // ---------- menu ----------

  function renderMenu() {
    if (!choice) choice = cleanSetup(store.loadGameOption(meta.id, 'setup', null));
    if (!shell.unlock.owned) {
      // refunded, or the website: back to what is free
      if (!meta.freeBoards.includes(choice.board)) choice.board = 'classic';
      if (choice.players.length > meta.freePlayers) choice.players = choice.players.slice(0, meta.freePlayers);
    }
    const box = $('#ganzen-menu');
    box.textContent = '';
    const lockIcon = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
    const head = (key) => {
      const h = document.createElement('h3');
      h.className = 'vier-head';
      h.textContent = t(key);
      box.appendChild(h);
    };
    const counts = wins();

    head('ganzen.boardHead');
    const boards = document.createElement('div');
    boards.className = 'vier-row ganzen-boards';
    for (const id of BOARDS) {
      const isLocked = locked({ board: id, players: ['kid', 'kid'] });
      const n = counts[winKey(id)] || 0;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-opt dam-opt ganzen-boardopt board-${id} ${isLocked ? 'locked' : ''}`;
      b.setAttribute('aria-pressed', String(choice.board === id));
      b.innerHTML = `<span class="vier-opt-art">${boardThumb(id)}</span><span class="vier-opt-text"><span class="vier-opt-title"></span><span class="vier-opt-sub"></span></span>${isLocked ? lockIcon : ''}`;
      b.querySelector('.vier-opt-title').textContent = t(`ganzen.board.${id}`);
      b.querySelector('.vier-opt-sub').textContent = isLocked ? t('ganzen.fullVersion') : n ? t('ganzen.wins', { n }) : t(`ganzen.board.${id}Sub`);
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('ganzen.lockedBoard'));
          return;
        }
        choice.board = id;
        renderMenu();
      });
      boards.appendChild(b);
    }
    box.appendChild(boards);

    head('ganzen.playersHead');
    const list = document.createElement('div');
    list.className = 'ganzen-players';
    for (let k = 0; k < MAX_PLAYERS; k++) {
      const kind = choice.players[k] || 'off';
      const isLocked = k >= meta.freePlayers && locked({ board: choice.board, players: new Array(k + 1).fill('kid') });
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `ganzen-slot slot-${k} kind-${kind} ${isLocked ? 'locked' : ''}`;
      b.dataset.slot = String(k);
      const who = kind === 'kid' ? kidSvg() : kind === 'cpu' ? robotBadge() : '';
      b.innerHTML = `<span class="slot-goose">${gooseSvg(k, { num: k + 1 })}</span><span class="slot-text"><span class="slot-name"></span><span class="slot-kind">${who}<span></span></span></span>${isLocked ? lockIcon : SWAP}`;
      b.querySelector('.slot-name').textContent = nameOf(k);
      b.querySelector('.slot-kind > span').textContent = t(`ganzen.kind.${kind}`);
      b.setAttribute('aria-label', isLocked ? t('ganzen.slotLocked', { name: nameOf(k) }) : t('ganzen.slotLabel', { name: nameOf(k), kind: t(`ganzen.kind.${kind}`) }));
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('ganzen.lockedPlayers'));
          return;
        }
        // kid -> computer -> (not playing, for the 3rd and 4th goose) -> kid
        const order = k < 2 ? ['kid', 'cpu'] : ['off', 'kid', 'cpu'];
        const next = order[(order.indexOf(kind) + 1) % order.length];
        const players = [];
        for (let j = 0; j < MAX_PLAYERS; j++) {
          const v = j === k ? next : choice.players[j] || 'off';
          if (v !== 'off') players.push(v);
          else if (j >= 2) break; // the geese play in order: an empty 3rd slot ends the list
        }
        choice.players = players;
        renderMenu();
      });
      list.appendChild(b);
    }
    box.appendChild(list);

    head('ganzen.countHead');
    const counting = document.createElement('div');
    counting.className = 'vier-row';
    for (const on of [true, false]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-opt dam-opt ganzen-count count-${on ? 'on' : 'off'}`;
      b.setAttribute('aria-pressed', String(choice.count === on));
      b.innerHTML = `<span class="vier-opt-art ganzen-count-art">${on ? '<span class="big-num">1 2 3</span>' : dieSvg(4)}</span><span class="vier-opt-text"><span class="vier-opt-title"></span><span class="vier-opt-sub"></span></span>`;
      b.querySelector('.vier-opt-title').textContent = t(on ? 'ganzen.countSelf' : 'ganzen.countAuto');
      b.querySelector('.vier-opt-sub').textContent = t(on ? 'ganzen.countSelfSub' : 'ganzen.countAutoSub');
      b.addEventListener('click', () => {
        tap();
        choice.count = on;
        renderMenu();
      });
      counting.appendChild(b);
    }
    box.appendChild(counting);

    const actions = document.createElement('div');
    actions.className = 'vier-actions';
    if (game && !game.over) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'ganzen-continue';
      cont.className = 'btn big secondary';
      cont.textContent = t('ganzen.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      actions.appendChild(cont);
    }
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.id = 'ganzen-play';
    playBtn.className = 'btn big primary';
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg><span></span>';
    playBtn.querySelector('span').textContent = t('ganzen.play');
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
      shell.offerUnlock(t(setup.board !== 'classic' ? 'ganzen.lockedBoard' : 'ganzen.lockedPlayers'));
      return;
    }
    store.saveGameOption(meta.id, 'setup', setup);
    plays++;
    clearTimeout(cpuTimer);
    const state = newGame(setup.players.length);
    game = { setup, state, shown: state.players.map(() => 0), phase: 'roll', pending: null, over: false, msg: '' };
    buildBoard();
    renderHud();
    shell.show('ganzen');
    renderTurn();
    beginTurn();
  }

  function resume() {
    if (!game) return;
    settle();
    buildBoard();
    renderHud();
    shell.show('ganzen');
    renderTurn();
    beginTurn();
  }

  function again() {
    shell.hideOverlay();
    if (!game) return;
    choice = { ...game.setup, players: game.setup.players.slice() };
    start();
  }

  /**
   * Finish a throw at once (leaving the board halfway): the goose stands where the rules put it.
   * Returns the winner when that throw won the game (the caller records it and shows the card), else -1.
   */
  function settle() {
    if (!game?.pending) return -1;
    game.state = game.pending.result.game;
    game.shown = game.state.players.map((p) => p.pos);
    game.pending = null;
    game.phase = 'roll';
    return game.state.winner;
  }

  function buildBoard() {
    const th = THEMES[game.setup.board] || THEMES.classic;
    const el = $('#ganzen-board');
    el.textContent = '';
    el.dataset.theme = game.setup.board;
    el.style.setProperty('--frame', th.frame);
    el.style.setProperty('--tile-a', th.a);
    el.style.setProperty('--tile-b', th.b);
    el.style.setProperty('--tile-special', th.special);
    el.style.setProperty('--tile-end', th.end);
    el.style.setProperty('--board-ink', th.ink);
    el.style.setProperty('--board-bg', th.bg);
    const grid = document.createElement('div');
    grid.className = 'ganzen-grid';
    cells = [];
    CELLS.forEach(([r, c], sq) => {
      const kind = kindOf(sq);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `gsq ${kind ? `special k-${kind}` : sq % 2 ? 'odd' : 'even'}`;
      b.dataset.sq = String(sq);
      b.style.gridRow = String(r + 1);
      b.style.gridColumn = String(c + 1);
      b.innerHTML = `${kind ? iconSvg(kind === 'goose' ? 'goose' : kind) : ''}<span class="num">${sq || ''}</span>`;
      grid.appendChild(b);
      cells.push(b);
    });
    el.appendChild(grid);
    const layer = document.createElement('div');
    layer.className = 'ganzen-pawns';
    pawns = game.setup.players.map((_, k) => {
      const p = document.createElement('span');
      p.className = `gpawn p${k}`;
      p.innerHTML = gooseSvg(k, { num: k + 1 });
      layer.appendChild(p);
      return p;
    });
    el.appendChild(layer);
    renderBoard();
  }

  function renderHud() {
    $('#ganzen-sub').textContent = t(`ganzen.board.${game.setup.board}`);
    $('#ganzen-title').textContent = t('games.ganzen');
  }

  /** Labels on the squares and where the geese stand. */
  function renderBoard() {
    if (!game) return;
    cells.forEach((b, sq) => {
      const kind = kindOf(sq);
      const here = game.shown.map((s, k) => (s === sq ? nameOf(k) : '')).filter(Boolean);
      const base = kind && kind !== 'start' ? `${sq}: ${t(`ganzen.sq.${kind}`)}` : sq ? String(sq) : t('ganzen.sq.start');
      b.setAttribute('aria-label', here.length ? `${base}. ${here.join(', ')}` : base);
    });
    placePawns();
  }

  function placePawns() {
    if (!game || !pawns.length) return;
    const board = $('#ganzen-board');
    const b = board.getBoundingClientRect();
    if (!b.width) return;
    game.shown.forEach((sq, k) => {
      const r = cells[sq].getBoundingClientRect();
      const same = game.shown.map((s, j) => (s === sq ? j : -1)).filter((j) => j >= 0);
      const n = same.length;
      const i = same.indexOf(k);
      // one goose in the middle; more share the square in a little cluster
      const size = r.width * (n === 1 ? 0.92 : 0.62);
      const ox = n === 1 ? 0 : (i % 2 ? 1 : -1) * r.width * 0.2;
      const oy = n === 1 ? 0 : (n > 2 ? (i < 2 ? -1 : 1) : i ? 1 : -1) * r.height * (n > 2 ? 0.2 : 0.14);
      const p = pawns[k];
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.transform = `translate(${r.left - b.left + r.width / 2 - size / 2 + ox}px, ${r.top - b.top + r.height / 2 - size / 2 + oy}px)`;
      p.classList.toggle('turn', !game.over && game.state.turn === k);
    });
  }

  function renderTurn() {
    const box = $('#ganzen-turn');
    box.textContent = '';
    box.classList.toggle('many', game.setup.players.length > 2); // narrow phones: geese without names
    game.setup.players.forEach((kind, k) => {
      const chip = document.createElement('span');
      chip.className = 'vier-chip ganzen-chip';
      chip.dataset.player = String(k);
      chip.innerHTML = `${gooseSvg(k, { num: k + 1 })}<span class="name"></span>${kind === 'cpu' ? robotBadge() : ''}<span class="arrow" aria-hidden="true"></span>`;
      chip.querySelector('.name').textContent = whoName(k);
      chip.setAttribute('aria-label', `${nameOf(k)}${kind === 'cpu' ? `, ${t('ganzen.kind.cpu')}` : ''}`);
      box.appendChild(chip);
    });
    updateTurn();
  }

  function updateTurn() {
    if (!game) return;
    const cur = game.state.turn;
    for (const chip of document.querySelectorAll('#ganzen-turn .ganzen-chip')) {
      const k = Number(chip.dataset.player);
      chip.classList.toggle('on', !game.over && k === cur);
      chip.classList.toggle('winner', game.over && game.state.winner === k);
      chip.classList.toggle('waiting', game.state.players[k]?.wait > 0);
    }
    const die = $('#ganzen-die');
    const canThrow = !game.over && game.phase === 'roll' && !isCpu(cur);
    die.disabled = !canThrow;
    die.querySelector('.die-label').textContent = t('ganzen.dieBtn');
    if (game.phase === 'roll') die.setAttribute('aria-label', t('ganzen.dieLabel'));
    die.classList.toggle('ready', canThrow);
    let text = game.msg;
    if (!text && !game.over) {
      if (game.phase === 'count') text = t('ganzen.countNow');
      else if (game.phase === 'roll') text = isCpu(cur) ? t('ganzen.cpuThrows', { name: nameOf(cur) }) : kids() === 1 ? t('ganzen.yourThrow') : t('ganzen.throw', { name: nameOf(cur) });
    }
    $('#ganzen-status').textContent = text;
    placePawns();
  }

  /** The line under the board (shown, never spoken: this game has no voice). */
  function setMsg(text) {
    game.msg = text;
    updateTurn();
  }

  function beginTurn() {
    if (!game || game.over) return;
    game.phase = 'roll';
    game.msg = '';
    updateTurn();
    const cur = game.state.turn;
    if (isCpu(cur) && onScreen('ganzen')) {
      clearTimeout(cpuTimer);
      const token = plays;
      cpuTimer = setTimeout(() => {
        if (token === plays && game?.phase === 'roll' && isCpu(game.state.turn)) throwNow();
      }, CPU_WAIT * speed);
    }
  }

  /** Throw the die: it tumbles, then shows the throw; then the goose walks. */
  async function throwNow() {
    if (!game || game.over || game.phase !== 'roll') return;
    const token = plays;
    const cur = game.state.turn;
    const roll = forced.length ? forced.shift() : rollDie();
    game.phase = 'rolling';
    game.msg = '';
    updateTurn();
    sfx.unlock();
    const die = $('#ganzen-die');
    die.classList.add('tumble');
    for (let k = 0; k < 6; k++) {
      $('#ganzen-die .face').innerHTML = dieSvg(k === 5 ? roll : 1 + ((roll + k * 4) % 6));
      sfx.tick();
      await sleep(80 + k * 14);
      if (token !== plays) return;
    }
    die.classList.remove('tumble');
    die.setAttribute('aria-label', t('ganzen.dieShows', { n: roll }));
    const result = throwDie(game.state, roll);
    const move = result.events[0];
    game.pending = { roll, result, path: move.path, taps: 0, player: cur };
    setMsg(about('ganzen.threw', cur, { n: roll }));
    await sleep(450);
    if (token !== plays) return;
    if (game.setup.count && !isCpu(cur)) {
      game.phase = 'count';
      game.msg = '';
      markNext();
      updateTurn();
      return; // the child taps the squares (tapSquare)
    }
    game.phase = 'moving';
    await hopAlong(cur, move.path, token, true);
    if (token !== plays) return;
    await afterMove(token);
  }

  /** Count yourself: the square to tap next glows. */
  function markNext() {
    for (const c of cells) c.classList.remove('next');
    const p = game?.pending;
    if (!p || game.phase !== 'count') return;
    const sq = nextTap(p.path, p.taps);
    if (sq >= 0) cells[sq].classList.add('next');
  }

  /** A tap on a square (only counts while counting yourself). */
  async function tapSquare(sq) {
    if (!game || game.phase !== 'count' || !game.pending) return;
    const p = game.pending;
    const want = nextTap(p.path, p.taps);
    if (sq !== want) {
      // gently show where: the right square wiggles
      cells[want]?.classList.remove('wiggle');
      void cells[want]?.offsetWidth;
      cells[want]?.classList.add('wiggle');
      setMsg(t('ganzen.tapHere', { n: p.taps + 1 }));
      return;
    }
    const token = plays;
    p.taps++;
    game.shown[p.player] = sq;
    countPop(sq, p.taps);
    sfx.plink(Math.min(p.taps, 9)); // a rising note per count (1..9)
    game.msg = '';
    markNext();
    updateTurn();
    if (p.taps < p.path.length) return;
    game.phase = 'moving';
    for (const c of cells) c.classList.remove('next');
    await sleep(350);
    if (token !== plays) return;
    await afterMove(token);
  }

  /** A big number that pops up on the square: the count so far. */
  function countPop(sq, n) {
    const layer = $('#ganzen-board .ganzen-pawns');
    const r = cells[sq].getBoundingClientRect();
    const b = $('#ganzen-board').getBoundingClientRect();
    // one count at a time, as a round badge just above the square, clear of the geese on it
    for (const old of layer.querySelectorAll('.count-pop')) old.remove();
    const pop = document.createElement('span');
    pop.className = 'count-pop';
    pop.textContent = String(n);
    const size = Math.max(30, Math.min(64, r.width * 0.78));
    pop.style.left = `${r.left - b.left + r.width / 2}px`;
    pop.style.top = `${r.top - b.top}px`;
    pop.style.width = `${size}px`;
    pop.style.height = `${size}px`;
    pop.style.fontSize = `${size * 0.62}px`;
    layer.appendChild(pop);
    setTimeout(() => pop.remove(), 1100);
  }

  /** The goose hops square by square; `counting`: show the big numbers. */
  async function hopAlong(player, path, token, counting) {
    for (let k = 0; k < path.length; k++) {
      if (token !== plays) return;
      game.shown[player] = path[k];
      pawns[player]?.classList.remove('hop');
      void pawns[player]?.offsetWidth;
      pawns[player]?.classList.add('hop');
      if (counting) countPop(path[k], k + 1);
      sfx.plink(Math.min(k + 1, 9));
      placePawns();
      await sleep(HOP);
    }
  }

  /** The rest of the throw: special squares, waiting, the winner; then the next turn. */
  async function afterMove(token) {
    const p = game.pending;
    const cur = p.player;
    for (const e of p.result.events.slice(1)) {
      if (token !== plays) return;
      if (e.type === 'bounce') {
        setMsg(t('ganzen.ev.bounce'));
        await sleep(PAUSE * 0.6);
      } else if (e.type === 'goose') {
        setMsg(t('ganzen.ev.goose', { n: p.roll }));
        sfx.chime();
        await sleep(PAUSE * 0.6);
        await hopAlong(cur, e.path, token, true);
      } else if (e.type === 'bridge' || e.type === 'maze' || e.type === 'woods') {
        setMsg(t(`ganzen.ev.${e.type}`, { n: e.to }));
        if (e.type === 'woods') sfx.boop();
        else sfx.chime();
        await sleep(PAUSE * 0.5);
        game.shown[cur] = e.to;
        pawns[cur]?.classList.add('slide');
        placePawns();
        await sleep(PAUSE * 0.8);
        pawns[cur]?.classList.remove('slide');
      } else if (e.type === 'inn' || e.type === 'well' || e.type === 'prison') {
        setMsg(about(`ganzen.ev.${e.type}`, cur));
        sfx.lid();
        await sleep(PAUSE);
      } else if (e.type === 'freed') {
        // "Gele gans haalt je eruit!" / "Je haalt Gele gans eruit!" / "Gele gans haalt Blauwe gans eruit!"
        const key = isYou(e.player) ? 'ganzen.ev.freed.you' : isYou(e.by) ? 'ganzen.ev.freed.byYou' : 'ganzen.ev.freed';
        setMsg(t(key, { name: nameOf(e.player), by: nameOf(e.by) }));
        sfx.chime();
        await sleep(PAUSE);
      } else if (e.type === 'win') {
        game.state = p.result.game;
        game.pending = null;
        finish(cur);
        return;
      } else if (e.type === 'skip') {
        setMsg(about(`ganzen.ev.skip.${e.reason}`, e.player));
        await sleep(PAUSE);
      }
    }
    if (token !== plays) return;
    game.state = p.result.game;
    game.shown = game.state.players.map((x) => x.pos);
    game.pending = null;
    renderBoard();
    beginTurn();
  }

  /** The game is won: count a child's win, cheer, and show the card (`now`: at once, wherever we are). */
  function finish(winner, { now = false } = {}) {
    if (game.over) return; // counted once
    game.over = true;
    game.phase = 'over';
    game.shown[winner] = END;
    renderBoard();
    updateTurn();
    if (!isCpu(winner)) {
      const key = winKey(game.setup.board);
      store.recordStars(meta.id, key, (wins()[key] || 0) + 1);
      sfx.win();
    } else sfx.lose();
    pawns[winner]?.classList.add('won');
    const done = game;
    const card = () => {
      if (game !== done) return;
      const title = isCpu(winner) ? t('ganzen.cpuWins', { name: nameOf(winner) }) : kids() === 1 ? t('ganzen.youWin') : t('ganzen.nameWins', { name: nameOf(winner) });
      shell.showOverlay({
        art: `<span class="ganzen-ov">${gooseSvg(winner, { num: winner + 1 })}${iconSvg('end')}</span>`,
        title,
        text: t(isCpu(winner) ? 'ganzen.cpuWinsText' : 'ganzen.winText'),
        buttons: [
          [t('ganzen.again'), 'big primary', again],
          [t('ganzen.menuBtn'), 'big secondary', () => shell.show('ganzen-menu')],
        ],
      });
    };
    if (now) card();
    else setTimeout(() => onScreen('ganzen') && card(), 1000 * speed);
  }

  // ---------- input ----------

  $('#ganzen-die').innerHTML = `<span class="face">${dieSvg(6)}</span><span class="die-label"></span>`;
  $('#ganzen-die').addEventListener('click', () => {
    if (!game || game.phase !== 'roll' || isCpu(game.state.turn)) return;
    tap();
    throwNow();
  });
  /** A tap near the square to count goes to it (the squares are small on a phone). */
  $('#ganzen-board').addEventListener('click', (e) => {
    if (!game || game.phase !== 'count' || !game.pending) return;
    const btn = e.target.closest('.gsq');
    const want = nextTap(game.pending.path, game.pending.taps);
    if (e.detail === 0 && btn) {
      tapSquare(Number(btn.dataset.sq));
      return;
    }
    const r = cells[want].getBoundingClientRect();
    const d = Math.hypot(r.left + r.width / 2 - e.clientX, r.top + r.height / 2 - e.clientY);
    if (d <= Math.max(r.width * 0.85, 30)) tapSquare(want);
    else if (btn) tapSquare(Number(btn.dataset.sq));
  });
  $('#ganzen-back').addEventListener('click', () => {
    tap();
    leave();
  });

  /** The board -> the menu (the game is kept for this session: "keep playing"). */
  function leave() {
    shell.hideOverlay();
    plays++;
    clearTimeout(cpuTimer);
    const winner = settle();
    $('#ganzen-die')?.classList.remove('tumble');
    shell.show('ganzen-menu');
    if (winner >= 0) {
      // left during the winning throw: still a win, with its card (and no "keep playing" behind it)
      finish(winner, { now: true });
      renderMenu();
    }
  }

  function fitBoard() {
    if (!game) return;
    const stage = $('#ganzen-stage');
    const side = window.innerWidth > window.innerHeight * 1.15;
    stage.classList.toggle('side', side);
    const panel = $('#ganzen-stage .ganzen-side');
    const w = stage.clientWidth - 12 - (side ? panel.offsetWidth + 12 : 0);
    const h = stage.clientHeight - 10 - (side ? 0 : panel.offsetHeight + 10);
    const frame = 0.22; // the frame around the squares, in squares
    const gaps = (GRID - 1) * 2 + 4; // the 2 px gaps between the squares and around them
    const cell = Math.max(20, Math.floor(Math.min((w - gaps) / (GRID + frame * 2), (h - gaps) / (GRID + frame * 2), 92)));
    $('#ganzen-board').style.setProperty('--cell', `${cell}px`);
    requestAnimationFrame(placePawns);
  }

  return {
    open() {
      shell.show('ganzen-menu');
    },
    leave,
    async init() {
      return true;
    },
    testHook() {
      return {
        choose: (setup) => {
          choice = cleanSetup({ ...(choice || cleanSetup(store.loadGameOption(meta.id, 'setup', null))), ...setup });
          if (onScreen('ganzen-menu')) renderMenu();
        },
        start: () => start(),
        rolls: (list) => (forced = list.slice()),
        fast: (on) => (speed = on ? 0.2 : 1),
        tap: (sq) => tapSquare(sq),
        state: () =>
          game
            ? {
                players: game.state.players.map((p) => ({ ...p })),
                shown: game.shown.slice(),
                turn: game.state.turn,
                winner: game.state.winner,
                phase: game.phase,
                next: game.pending && game.phase === 'count' ? nextTap(game.pending.path, game.pending.taps) : -1,
                setup: { ...game.setup, players: game.setup.players.slice() },
                msg: game.msg,
              }
            : null,
        wins: () => wins(),
      };
    },
  };
}
