// Vier op een rij: drop tokens into the columns; whoever first gets four in a row (three on the
// kleuterbord) wins. Two ways to play: together on one screen, taking turns, or against the
// computer (ai.js) at three levels; the hard computer is in the full version. The rules live in
// rules.js, the pictures in art.js; the shell (web/js/main.js) owns the overlay card, the sound
// settings and the purchase, and passes them in as `shell`.
//
// Saved (games.vier): the child's wins against the computer per board and level, as
// non-decreasing counters in `stars` ('cpu-<board>-<level>'; the storage merge keeps the highest
// of each, so a counter never goes down); the last menu choice ('setup'), the tokens ('tokens')
// and who starts the next game played together, per board ('duoStarter'). Games played together
// are not counted. All read from the save when used.
//
// Who starts: against the computer the child starts the first game and then it alternates, except
// on the kleuterbord, where the child always starts (three in a row on 5×4 is a forced win for
// whoever begins, and the hard computer plays it perfectly). Together, the starter alternates per
// board, also across visits to the menu.
import { meta } from './meta.js';
import { BOARDS, emptyBoard, drop, winAt, isFull, other, landingRow } from './rules.js';
import { chooseMove } from './ai.js';
import { TOKENS, tokenById, nextToken, tokenSvg, robotSvg, duoSvg, boardSvg, TROPHY } from './art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const UNDO = '<path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';

export const DEFAULT_SETUP = Object.freeze({ board: 'big', mode: 'cpu', level: 1 });
export const DEFAULT_TOKENS = Object.freeze(['pup', 'bubble']);
const CPU_DELAY = 520; // ms before the computer drops its token, so it feels like a turn
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The counter key for a result. */
export const winKey = (setup) => `cpu-${setup.board}-${setup.level}`;
/** Against the computer on the kleuterbord the child always starts (a forced win for the starter). */
export const childAlwaysStarts = (setup) => setup.mode === 'cpu' && setup.board === 'small';

export function createVier(shell) {
  const { t, tap } = shell;
  const wins = () => store.loadProgress(meta.id).stars;
  const savedSetup = () => {
    const s = store.loadGameOption(meta.id, 'setup', null) || {};
    return {
      board: BOARDS[s.board] ? s.board : DEFAULT_SETUP.board,
      mode: s.mode === 'duo' ? 'duo' : 'cpu',
      level: [1, 2, 3].includes(s.level) ? s.level : DEFAULT_SETUP.level,
    };
  };
  const savedTokens = () => {
    const s = store.loadGameOption(meta.id, 'tokens', null);
    const ok = Array.isArray(s) && s.length === 2 && s.every((id) => TOKENS.some((k) => k.id === id)) && s[0] !== s[1];
    return ok ? s.slice() : DEFAULT_TOKENS.slice();
  };

  let choice = null; // the menu's choice: { board, mode, level, tokens: [p1, p2] }
  let game = null; // { setup, cfg, tokens, board, turn, starter, history: [{ index, player }], over }
  let dropping = false; // a token is falling
  let cpuTimer = null; // the computer is thinking: the timer of its move (one at a time)
  let cardTimer = null; // the end card, shown a moment after the last token lands
  let plays = 0; // counts games started, so a falling token never lands on a newer game
  let cells = [];
  let colButtons = [];

  const locked = (setup) => meta.isLocked(setup, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const tokenName = (id) => t(`vier.tok.${id}`);
  const isCpu = () => game?.setup.mode === 'cpu';
  const humanTurn = () => game && !game.over && (!isCpu() || game.turn === 1);
  const busy = () => dropping || !!cpuTimer;
  const duoStarters = () => store.loadGameOption(meta.id, 'duoStarter', {}) || {};

  /** Stop a pending computer move (leaving the board, a take-back, a new game). */
  function cancelCpu() {
    if (cpuTimer) clearTimeout(cpuTimer);
    cpuTimer = null;
  }
  function cancelCard() {
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
  }

  shell.unlock.onChange(() => {
    if (onScreen('vier-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'vier-menu') renderMenu();
    if (name === 'vier') requestAnimationFrame(fitBoard);
  });
  shell.onLangChange(() => {
    if (onScreen('vier-menu')) renderMenu();
    if (game) {
      renderHud();
      renderTurn();
      updateBoard();
    }
  });
  window.addEventListener('resize', () => onScreen('vier') && fitBoard());

  // ---------- menu ----------

  function renderMenu() {
    if (!choice) choice = { ...savedSetup(), tokens: savedTokens() };
    if (locked(choice)) choice.level = 2; // the purchase was refunded, or this is the website
    const box = $('#vier-menu');
    box.textContent = '';
    const head = (key) => {
      const h = document.createElement('h3');
      h.className = 'vier-head';
      h.textContent = t(key);
      box.appendChild(h);
    };
    const option = ({ art, title, sub, pressed, onPick, cls = '', label = '' }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-opt ${cls}`;
      b.setAttribute('aria-pressed', String(!!pressed));
      b.innerHTML = `<span class="vier-opt-art">${art}</span><span class="vier-opt-text"><span class="vier-opt-title"></span><span class="vier-opt-sub"></span></span>`;
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
    head('vier.boardHead');
    const boards = document.createElement('div');
    boards.className = 'vier-row';
    for (const id of ['small', 'big']) {
      const cfg = BOARDS[id];
      boards.appendChild(
        option({
          art: boardSvg(cfg.cols, cfg.rows),
          title: t(`vier.${id}`),
          sub: `${t(`vier.${id}Sub`)} · ${t('vier.age', { age: cfg.age })}`,
          pressed: choice.board === id,
          cls: `board-${id}`,
          onPick: () => {
            choice.board = id;
            renderMenu();
          },
        }),
      );
    }
    box.appendChild(boards);

    // the opponent: together, or the computer at a level
    head('vier.opponentHead');
    const opp = document.createElement('div');
    opp.className = 'vier-row';
    opp.appendChild(
      option({
        art: duoSvg(),
        title: t('vier.duo'),
        sub: t('vier.duoSub'),
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
    cpu.querySelector('.vier-cpu-title').textContent = t('vier.cpu');
    cpu.querySelector('.vier-levels').setAttribute('aria-label', t('vier.cpu'));
    const counts = wins();
    for (const level of [1, 2, 3]) {
      const setup = { board: choice.board, mode: 'cpu', level };
      const isLocked = locked(setup);
      const n = counts[winKey(setup)] || 0;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-level ${isLocked ? 'locked' : ''}`;
      b.dataset.level = String(level);
      b.setAttribute('aria-pressed', String(choice.mode === 'cpu' && choice.level === level));
      const dots = [1, 2, 3].map((k) => `<i class="${k <= level ? 'on' : ''}"></i>`).join('');
      b.innerHTML =
        `<span class="dots" aria-hidden="true">${dots}</span><span class="lv-name"></span>` +
        (isLocked ? `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>` : n ? `<span class="lv-wins"><svg viewBox="0 0 24 24" aria-hidden="true">${TROPHY}</svg>${n}</span>` : '');
      b.querySelector('.lv-name').textContent = t(`vier.level${level}`);
      const label = isLocked ? t('vier.levelLocked') : n ? `${t(`vier.level${level}`)}, ${t('vier.wins', { n })}` : t(`vier.level${level}`);
      b.setAttribute('aria-label', `${t('vier.cpu')}: ${label}`);
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('vier.lockedLead'));
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

    // the tokens
    head('vier.tokensHead');
    const toks = document.createElement('div');
    toks.className = 'vier-tokens';
    const who = choice.mode === 'cpu' ? [t('vier.you'), t('vier.computer')] : [t('vier.player1'), t('vier.player2')];
    for (const k of [0, 1]) {
      const id = choice.tokens[k];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vier-token-pick';
      b.dataset.slot = String(k);
      b.innerHTML = `${tokenSvg(id)}<span class="who"></span><span class="swap" aria-hidden="true">⟳</span>`;
      b.querySelector('.who').textContent = who[k];
      if (k === 1 && choice.mode === 'cpu') b.querySelector('.who').insertAdjacentHTML('afterbegin', robotSvg({ cls: 'tiny' }));
      b.setAttribute('aria-label', t('vier.swapToken', { who: who[k], name: tokenName(id) }));
      b.addEventListener('click', () => {
        tap();
        choice.tokens[k] = nextToken(choice.tokens[k], choice.tokens[1 - k]);
        renderMenu();
      });
      toks.appendChild(b);
    }
    box.appendChild(toks);

    // play, and keep playing an unfinished game
    const actions = document.createElement('div');
    actions.className = 'vier-actions';
    if (game && !game.over) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'vier-continue';
      cont.className = 'btn big secondary';
      cont.textContent = t('vier.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      actions.appendChild(cont);
    }
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.id = 'vier-play';
    playBtn.className = 'btn big primary';
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg><span></span>';
    playBtn.querySelector('span').textContent = t('vier.play');
    playBtn.addEventListener('click', () => {
      tap();
      start(choice.mode === 'duo' ? duoStarters()[choice.board] || 1 : 1);
    });
    actions.appendChild(playBtn);
    box.appendChild(actions);
  }

  // ---------- a game ----------

  /** Start a new game with the menu's choice. `starter`: who begins (1 = the child or player 1). */
  function start(starter = 1) {
    if (!choice) choice = { ...savedSetup(), tokens: savedTokens() };
    const setup = { board: choice.board, mode: choice.mode, level: choice.level };
    if (locked(setup)) {
      shell.offerUnlock(t('vier.lockedLead'));
      return;
    }
    store.saveGameOption(meta.id, 'setup', setup);
    store.saveGameOption(meta.id, 'tokens', choice.tokens.slice());
    if (childAlwaysStarts(setup)) starter = 1;
    if (setup.mode === 'duo') store.saveGameOption(meta.id, 'duoStarter', { ...duoStarters(), [setup.board]: other(starter) });
    const cfg = BOARDS[setup.board];
    plays++;
    dropping = false;
    cancelCpu();
    cancelCard();
    game = { setup, cfg, tokens: choice.tokens.slice(), board: emptyBoard(cfg), turn: starter, starter, history: [], over: null };
    buildBoard();
    renderHud();
    renderTurn();
    updateBoard();
    shell.show('vier');
    if (isCpu() && game.turn === 2) cpuTurn();
  }

  function resume() {
    if (!game) return;
    buildBoard();
    renderHud();
    renderTurn();
    updateBoard();
    shell.show('vier');
    if (isCpu() && game.turn === 2 && !game.over) cpuTurn(); // cpuTurn ignores a move already pending
  }

  function again() {
    shell.hideOverlay();
    if (!game) return;
    choice = { ...game.setup, tokens: game.tokens.slice() };
    start(other(game.starter)); // take turns at starting (start() keeps the child first on the kleuterbord)
  }

  function buildBoard() {
    const { cols, rows } = game.cfg;
    const el = $('#vier-board');
    el.textContent = '';
    el.style.setProperty('--cols', String(cols));
    el.style.setProperty('--rows', String(rows));
    el.classList.remove('won');
    const grid = document.createElement('div');
    grid.className = 'vier-grid';
    grid.setAttribute('aria-hidden', 'true');
    cells = [];
    for (let i = 0; i < cols * rows; i++) {
      const c = document.createElement('span');
      c.className = 'vhole';
      c.style.setProperty('--i', String(i % cols)); // stagger for the happy hop
      grid.appendChild(c);
      cells.push(c);
    }
    el.appendChild(grid);
    const colRow = document.createElement('div');
    colRow.className = 'vier-cols';
    colButtons = [];
    for (let c = 0; c < cols; c++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vcol';
      b.dataset.col = String(c);
      b.addEventListener('click', () => tapColumn(c));
      colRow.appendChild(b);
      colButtons.push(b);
    }
    el.appendChild(colRow);
    el.setAttribute('aria-label', t('vier.boardLabel'));
  }

  function renderHud() {
    const { setup } = game;
    $('#vier-sub').textContent = t(`vier.${setup.board}`);
    $('#vier-title').textContent = setup.mode === 'cpu' ? t(`vier.level${setup.level}`) : t('vier.duo');
    $('#vier-undo').classList.toggle('off', setup.mode !== 'cpu');
  }

  function renderTurn() {
    const box = $('#vier-turn');
    box.textContent = '';
    const who = isCpu() ? [t('vier.you'), t('vier.computer')] : [tokenName(game.tokens[0]), tokenName(game.tokens[1])];
    for (const p of [1, 2]) {
      const chip = document.createElement('span');
      chip.className = 'vier-chip';
      chip.dataset.player = String(p);
      chip.innerHTML = `${tokenSvg(game.tokens[p - 1])}<span class="name"></span><span class="arrow" aria-hidden="true"></span>`;
      chip.querySelector('.name').textContent = who[p - 1];
      if (isCpu() && p === 2) chip.querySelector('.name').insertAdjacentHTML('afterbegin', robotSvg({ cls: 'tiny' }));
      box.appendChild(chip);
    }
    updateTurn();
  }

  function updateTurn() {
    if (!game) return;
    for (const chip of document.querySelectorAll('#vier-turn .vier-chip')) {
      const p = Number(chip.dataset.player);
      chip.classList.toggle('on', !game.over && game.turn === p);
      chip.classList.toggle('winner', !!game.over?.winner && game.over.winner === p);
      chip.classList.toggle('thinking', !game.over && isCpu() && game.turn === 2 && p === 2);
    }
    let text = '';
    if (!game.over) {
      if (isCpu()) text = game.turn === 1 ? t('vier.yourTurn') : t('vier.thinking');
      else text = t('vier.turn', { name: tokenName(game.tokens[game.turn - 1]) });
    }
    $('#vier-status').textContent = text;
    // a take-back also works while the computer is still thinking (it cancels that move)
    const canUndo = isCpu() && !dropping && game.history.some((h) => h.player === 1) && (!game.over || game.over.winner === 2);
    $('#vier-undo').disabled = !canUndo;
  }

  function updateBoard() {
    if (!game) return;
    const winCells = new Set(game.over?.cells || []);
    for (let i = 0; i < cells.length; i++) {
      const v = game.board[i];
      const want = v ? game.tokens[v - 1] : '';
      if (cells[i].dataset.token !== want) {
        cells[i].dataset.token = want;
        cells[i].innerHTML = v ? tokenSvg(want) : '';
      }
      cells[i].classList.toggle('win', winCells.has(i));
    }
    const { cols } = game.cfg;
    for (let c = 0; c < cols; c++) {
      const full = landingRow(game.board, game.cfg, c) < 0;
      colButtons[c].setAttribute('aria-label', full ? t('vier.colFull', { c: c + 1 }) : t('vier.col', { c: c + 1 }));
      colButtons[c].classList.toggle('full', full);
      colButtons[c].disabled = !!game.over;
    }
    $('#vier-board').classList.toggle('won', !!game.over?.winner);
    updateTurn();
  }

  function tapColumn(c) {
    if (!game || game.over) return;
    if (busy() || !humanTurn()) {
      colButtons[c]?.classList.add('wiggle');
      setTimeout(() => colButtons[c]?.classList.remove('wiggle'), 400);
      return;
    }
    if (landingRow(game.board, game.cfg, c) < 0) {
      sfx.tick();
      $('#vier-status').textContent = t('vier.full');
      colButtons[c].classList.add('wiggle');
      setTimeout(() => colButtons[c]?.classList.remove('wiggle'), 400);
      return;
    }
    sfx.unlock();
    place(c);
  }

  /** Drop the current player's token in column c, animate, then finish the turn. */
  function place(c) {
    const player = game.turn;
    const d = drop(game.board, game.cfg, c, player);
    if (!d) return;
    const token = plays;
    const g = game;
    dropping = true;
    updateTurn();
    animateDrop(d.row, c, g.tokens[player - 1], () => {
      if (token !== plays || game !== g) return;
      dropping = false;
      // never two moves for one turn (review of PR #11: a second computer move could land here)
      if (g.over || g.turn !== player || g.board[d.index]) {
        updateBoard();
        return;
      }
      g.board = d.board;
      g.history.push({ index: d.index, player });
      sfx.thud(d.row / Math.max(1, g.cfg.rows - 1));
      const line = winAt(g.board, g.cfg, d.index);
      if (line) finish({ winner: player, cells: line });
      else if (isFull(g.board)) finish({ draw: true, cells: [] });
      else {
        g.turn = other(player);
        updateBoard();
        if (isCpu() && g.turn === 2 && onScreen('vier')) cpuTurn(); // off the board: resume() asks again
      }
    });
  }

  /** The computer's move, after a short think. Only one can be pending; leaving the board cancels it. */
  function cpuTurn() {
    if (cpuTimer || dropping || !game || game.over || game.turn !== 2) return;
    const g = game;
    cpuTimer = setTimeout(() => {
      cpuTimer = null;
      if (game !== g || g.over || g.turn !== 2 || dropping) return;
      if (!onScreen('vier')) {
        updateTurn();
        return; // resume() asks again
      }
      const col = chooseMove(g.board, g.cfg, 2, g.setup.level);
      if (col >= 0) place(col);
      else updateTurn();
    }, CPU_DELAY + Math.floor(Math.random() * 260));
    updateTurn();
  }

  /** The falling token: from above the board down to its hole, with a little bounce. */
  function animateDrop(row, col, tokenId, done) {
    const board = $('#vier-board');
    const target = cells[row * game.cfg.cols + col];
    if (!target || reducedMotion() || !board.isConnected || !target.getBoundingClientRect().height) {
      done();
      return;
    }
    const b = board.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const fall = document.createElement('span');
    fall.className = 'vfall';
    fall.style.left = `${r.left - b.left}px`;
    fall.style.top = `${r.top - b.top}px`;
    fall.style.width = `${r.width}px`;
    fall.style.height = `${r.height}px`;
    fall.innerHTML = tokenSvg(tokenId);
    board.appendChild(fall);
    const from = -(r.top - b.top) - r.height;
    const ms = 260 + row * 45;
    const anim = fall.animate(
      [
        { transform: `translateY(${from}px)`, easing: 'cubic-bezier(.5,0,1,1)' },
        { transform: 'translateY(0)', offset: 0.72, easing: 'cubic-bezier(0,0,.4,1)' },
        { transform: `translateY(${-r.height * 0.18}px)`, offset: 0.86, easing: 'cubic-bezier(.6,0,1,1)' },
        { transform: 'translateY(0)' },
      ],
      { duration: ms + 140 },
    );
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      fall.remove();
      done();
    };
    anim.onfinish = end;
    anim.oncancel = end;
    setTimeout(end, ms + 600); // safety net if the animation never reports back
  }

  function finish(over) {
    game.over = over;
    cancelCpu();
    const { setup } = game;
    if (over.winner === 1 && setup.mode === 'cpu') {
      const key = winKey(setup);
      store.recordStars(meta.id, key, (wins()[key] || 0) + 1);
    }
    updateBoard();
    if (over.winner && (setup.mode === 'duo' || over.winner === 1)) sfx.win();
    else if (over.winner) sfx.lose();
    else sfx.lid();
    const done = game;
    cancelCard();
    cardTimer = setTimeout(() => {
      cardTimer = null;
      if (game !== done || !done.over || !onScreen('vier')) return;
      showEndCard();
    }, over.winner ? 1300 : 700);
  }

  function showEndCard() {
    const { over, setup, cfg } = game;
    let title;
    let text;
    let art;
    if (over.draw) {
      title = t('vier.draw');
      text = t('vier.drawText');
      art = `<span class="vier-ov">${tokenSvg(game.tokens[0])}${tokenSvg(game.tokens[1])}</span>`;
    } else if (setup.mode === 'cpu' && over.winner === 2) {
      title = t('vier.cpuWins');
      text = t('vier.cpuWinsText');
      art = `<span class="vier-ov">${robotSvg()}</span>`;
    } else {
      title = setup.mode === 'cpu' ? t('vier.youWin') : t('vier.nameWins', { name: tokenName(game.tokens[over.winner - 1]) });
      text = t(`vier.row${cfg.need}`);
      art = `<span class="vier-ov won">${tokenSvg(game.tokens[over.winner - 1])}</span>`;
    }
    const buttons = [[t('vier.again'), 'big primary', again]];
    if (setup.mode === 'cpu' && over.winner === 2) buttons.push([t('vier.undo'), 'big secondary', () => (shell.hideOverlay(), undoMove())]);
    buttons.push([t('vier.menuBtn'), 'big secondary', () => shell.show('vier-menu')]);
    shell.showOverlay({ art, title, text, buttons });
  }

  /** Against the computer: take back the child's last move (and the computer's answer). */
  function undoMove() {
    if (!isCpu() || dropping || !game.history.some((h) => h.player === 1)) return;
    if (game.over && game.over.winner !== 2) return; // a win is a win
    cancelCpu(); // the computer was still thinking: its move is dropped
    cancelCard(); // the computer had just won: no end card after the take-back
    while (game.history.length) {
      const h = game.history.pop();
      game.board[h.index] = 0;
      if (h.player === 1) break;
    }
    game.over = null;
    game.turn = 1;
    $('#vier-board').classList.remove('won');
    updateBoard();
  }

  $('#vier-undo').insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${UNDO}</svg>`);
  $('#vier-undo').addEventListener('click', () => {
    tap();
    undoMove();
  });
  $('#vier-back').addEventListener('click', () => {
    tap();
    leave();
  });

  /** The board -> the menu (the game is kept for this session: "keep playing"). */
  function leave() {
    shell.hideOverlay();
    cancelCpu(); // the computer moves again when the child comes back ("keep playing")
    cancelCard(); // a pending end card must not pop up over the menu
    shell.show('vier-menu');
  }

  function fitBoard() {
    if (!game) return;
    const stage = $('#vier-stage');
    const side = window.innerWidth > window.innerHeight * 1.2; // sideways phone: the turn panel beside the board
    stage.classList.toggle('side', side);
    const panel = $('#vier-stage .vier-side');
    const { cols, rows } = game.cfg;
    const w = stage.clientWidth - 24 - (side ? panel.offsetWidth + 16 : 0);
    const h = stage.clientHeight - 16 - (side ? 0 : panel.offsetHeight + 12);
    const pad = 0.18; // the frame around the holes, in cells
    const cell = Math.max(28, Math.floor(Math.min(w / (cols + pad * 2), h / (rows + pad * 2), 92)));
    const el = $('#vier-board');
    el.style.setProperty('--cell', `${cell}px`);
  }

  return {
    open() {
      shell.show('vier-menu');
    },
    leave,
    async init() {
      return true;
    },
    testHook() {
      return {
        choose: (setup) => {
          choice = { ...(choice || { ...savedSetup(), tokens: savedTokens() }), ...setup };
          if (onScreen('vier-menu')) renderMenu();
        },
        start: (starter) => start(starter),
        tap: (c) => tapColumn(c),
        state: () =>
          game
            ? { board: game.board.slice(), turn: game.turn, busy: busy(), thinking: !!cpuTimer, over: game.over, history: game.history.length, starter: game.starter, setup: { ...game.setup }, tokens: game.tokens.slice() }
            : null,
        undo: () => undoMove(),
        wins: () => wins(),
      };
    },
  };
}
