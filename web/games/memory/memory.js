// Paartjes (Memory): turn two cards over; the same picture twice is a pair. Alone (stars by the
// number of turns, never a clock), together on one screen taking turns, or against a gentle
// computer (ai.js) that forgets now and then. The rules live in rules.js, the pictures in art.js;
// the shell (web/js/main.js) owns the overlay card, the sound settings and the purchase.
//
// Saved (games.memory): in `stars`, the best stars alone per board and theme ('<size>-<theme>',
// 1-3) and the child's wins against the computer per board ('cpu-<size>', a counter); both only
// go up (recordStars). The last menu choice in 'setup'. Games played together are not counted.
//
// Who starts: alone, the child; together and against the computer it takes turns from game to
// game (the child starts the first game against the computer).
import { meta } from './meta.js';
import { SIZES, SIZE_IDS, pairsOf, newGame, flip, hide, mustHide, starsFor, bestGrid } from './rules.js';
import { emptyMemory, observe, fade, choose } from './ai.js';
import { THEMES, THEME_IDS, THEME_SAMPLE, cardPictureSvg, cardBackSvg, sizeSvg } from './art.js';
import { tokenSvg, robotSvg, duoSvg, TROPHY } from '../vier/art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const MODES = Object.freeze(['solo', 'duo', 'cpu']);
const TOKENS = Object.freeze(['pup', 'bubble']); // player 1 and player 2 (or the child)

export const DEFAULT_SETUP = Object.freeze({ size: '2x3', theme: 'fruit', mode: 'solo' });
// How long things take, in ms: slow enough for a young child to see every card
export const TIMES = Object.freeze({ miss: 1400, pair: 650, cpuFirst: 900, cpuSecond: 1100, card: 900 });

/** The keys in the save. */
export const starKey = (setup) => `${setup.size}-${setup.theme}`;
export const winKey = (setup) => `cpu-${setup.size}`;

export function createMemory(shell) {
  const { t, tap } = shell;
  const progress = () => store.loadProgress(meta.id).stars;
  const savedSetup = () => {
    const s = store.loadGameOption(meta.id, 'setup', null) || {};
    return {
      size: SIZE_IDS.includes(s.size) ? s.size : DEFAULT_SETUP.size,
      theme: THEME_IDS.includes(s.theme) ? s.theme : DEFAULT_SETUP.theme,
      mode: MODES.includes(s.mode) ? s.mode : DEFAULT_SETUP.mode,
    };
  };

  let choice = null; // the menu's choice: { size, theme, mode }
  let game = null; // rules.js state plus { setup, starter }
  let memory = emptyMemory(); // what the computer remembers
  let timer = null; // the next step that happens by itself (turning back, the computer's card); one at a time
  let cardTimer = null; // the end card
  let fast = false; // the smoke test: short waits
  let lastStarter = { duo: 1, cpu: 1 }; // so the first game together or against the computer starts with player 1
  let cards = [];
  let hop = new Set(); // the cards of the pair just found: they hop once
  let message = ''; // a short line under the players (a pair, a miss)

  const locked = (setup) => meta.isLocked(setup, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const wait = (ms) => (fast ? Math.min(ms, 30) : ms);
  const isCpu = () => game?.setup.mode === 'cpu';
  const cpuTurnNow = () => isCpu() && !game.over && game.turn === 1;
  const picName = (id) => t(`memory.pic.${id}`);
  const names = (mode) => (mode === 'cpu' ? [t('memory.you'), t('memory.computer')] : [t('memory.player1'), t('memory.player2')]);

  function cancelTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }
  function cancelCard() {
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
  }
  function later(ms, fn) {
    cancelTimer();
    const g = game;
    timer = setTimeout(() => {
      timer = null;
      if (game === g && onScreen('memory')) fn();
    }, wait(ms));
  }

  shell.unlock.onChange(() => {
    if (onScreen('memory-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'memory-menu') renderMenu();
    if (name === 'memory') requestAnimationFrame(fitBoard);
  });
  shell.onLangChange(() => {
    if (onScreen('memory-menu')) renderMenu();
    if (game) {
      renderHud();
      renderSide();
      updateCards();
    }
  });
  window.addEventListener('resize', () => onScreen('memory') && fitBoard());

  // ---------- menu ----------

  function renderMenu() {
    if (!choice) choice = savedSetup();
    if (locked(choice)) {
      // the purchase was refunded, or this is the website: back to what is free
      if (!meta.freeSizes.includes(choice.size)) choice.size = meta.freeSizes[0];
      if (!meta.freeThemes.includes(choice.theme)) choice.theme = meta.freeThemes[0];
    }
    const owned = shell.unlock.owned;
    const box = $('#memory-menu');
    box.textContent = '';
    const lockIcon = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
    const counts = progress();
    const head = (key) => {
      const h = document.createElement('h3');
      h.className = 'vier-head';
      h.textContent = t(key);
      box.appendChild(h);
    };
    const option = ({ art, title, sub, pressed, isLocked, cls, onPick, extra = '' }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-opt dam-opt memory-opt ${cls} ${isLocked ? 'locked' : ''}`;
      b.setAttribute('aria-pressed', String(!!pressed && !isLocked));
      b.innerHTML = `<span class="vier-opt-art">${art}</span><span class="vier-opt-text"><span class="vier-opt-title"></span><span class="vier-opt-sub"></span>${extra}</span>${isLocked ? lockIcon : ''}`;
      b.querySelector('.vier-opt-title').textContent = title;
      b.querySelector('.vier-opt-sub').textContent = isLocked ? t('memory.fullVersion') : sub;
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('memory.lockedLead'));
          return;
        }
        onPick();
        renderMenu();
      });
      return b;
    };

    // how many cards
    head('memory.sizeHead');
    const sizes = document.createElement('div');
    sizes.className = 'vier-row memory-sizes';
    for (const id of SIZE_IDS) {
      const cfg = SIZES[id];
      const isLocked = !owned && !meta.freeSizes.includes(id);
      const stars = counts[starKey({ size: id, theme: choice.theme })] || 0;
      const won = counts[winKey({ size: id })] || 0;
      let extra = '';
      if (!isLocked && choice.mode === 'solo' && stars) {
        extra = `<span class="memory-stars" aria-label="${t('memory.stars', { n: stars })}">${[1, 2, 3].map((k) => `<svg class="${k <= stars ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join('')}</span>`;
      } else if (!isLocked && choice.mode === 'cpu' && won) {
        extra = `<span class="memory-wins" aria-label="${t('memory.wins', { n: won })}"><svg viewBox="0 0 24 24" aria-hidden="true">${TROPHY}</svg>${won}</span>`;
      }
      sizes.appendChild(
        option({
          art: sizeSvg(cfg.cols, cfg.rows),
          title: `${cfg.rows} × ${cfg.cols}`,
          sub: `${t('memory.cards', { n: cfg.cols * cfg.rows })} · ${t('memory.age', { age: cfg.age })}`,
          pressed: choice.size === id,
          isLocked,
          cls: `size-${id}`,
          extra,
          onPick: () => (choice.size = id),
        }),
      );
    }
    box.appendChild(sizes);

    // which pictures
    head('memory.themeHead');
    const themes = document.createElement('div');
    themes.className = 'vier-row memory-themes';
    for (const id of THEME_IDS) {
      themes.appendChild(
        option({
          art: `<span class="memory-sample">${cardPictureSvg(THEME_SAMPLE[id])}</span>`,
          title: t(`memory.theme.${id}`),
          sub: t(`memory.theme.${id}Sub`),
          pressed: choice.theme === id,
          isLocked: !owned && !meta.freeThemes.includes(id),
          cls: `theme-${id}`,
          onPick: () => (choice.theme = id),
        }),
      );
    }
    box.appendChild(themes);

    // who plays
    head('memory.modeHead');
    const modes = document.createElement('div');
    modes.className = 'vier-row memory-modes';
    const modeArt = { solo: tokenSvg(TOKENS[0]), duo: duoSvg(), cpu: robotSvg() };
    for (const id of MODES) {
      modes.appendChild(
        option({
          art: modeArt[id],
          title: t(`memory.mode.${id}`),
          sub: t(`memory.mode.${id}Sub`),
          pressed: choice.mode === id,
          isLocked: false,
          cls: `mode-${id}`,
          onPick: () => (choice.mode = id),
        }),
      );
    }
    box.appendChild(modes);

    // play, and keep playing an unfinished game
    const actions = document.createElement('div');
    actions.className = 'vier-actions';
    if (game && !game.over) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'memory-continue';
      cont.className = 'btn big secondary';
      cont.textContent = t('memory.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      actions.appendChild(cont);
    }
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.id = 'memory-play';
    playBtn.className = 'btn big primary';
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg><span></span>';
    playBtn.querySelector('span').textContent = t('memory.play');
    playBtn.addEventListener('click', () => {
      tap();
      start();
    });
    actions.appendChild(playBtn);
    box.appendChild(actions);
  }

  // ---------- a game ----------

  function start() {
    if (!choice) choice = savedSetup();
    const setup = { ...choice };
    if (locked(setup)) {
      shell.offerUnlock(t('memory.lockedLead'));
      return;
    }
    store.saveGameOption(meta.id, 'setup', setup);
    let starter = 0;
    if (setup.mode !== 'solo') {
      starter = 1 - lastStarter[setup.mode]; // take turns at starting, from game to game
      lastStarter[setup.mode] = starter;
    }
    cancelTimer();
    cancelCard();
    shell.hideOverlay();
    game = { ...newGame({ size: setup.size, faces: THEMES[setup.theme], players: setup.mode === 'solo' ? 1 : 2, starter }), setup, starter };
    memory = emptyMemory();
    hop = new Set();
    message = '';
    buildBoard();
    renderHud();
    renderSide();
    updateCards();
    shell.show('memory');
    if (cpuTurnNow()) cpuTurn();
  }

  /** Back from the menu ("keep playing"): what was waiting happens at once. */
  function resume() {
    if (!game) return;
    if (mustHide(game)) game = keep(hide(game));
    buildBoard();
    renderHud();
    renderSide();
    updateCards();
    shell.show('memory');
    if (cpuTurnNow()) cpuTurn();
  }

  /** The rules return a new state: keep the screen's own fields on it. */
  const keep = (next) => Object.assign(next, { setup: game.setup, starter: game.starter });

  function buildBoard() {
    const el = $('#memory-board');
    el.textContent = '';
    cards = game.cards.map((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mcard';
      b.dataset.i = String(i);
      b.style.setProperty('--i', String(i));
      b.innerHTML = `<span class="mcard-in"><span class="mcard-face mcard-back">${cardBackSvg()}</span><span class="mcard-face mcard-front">${cardPictureSvg(c.face)}</span></span>`;
      b.addEventListener('click', () => tapCard(i));
      el.appendChild(b);
      return b;
    });
    el.setAttribute('aria-label', t('memory.boardLabel'));
    fitBoard();
  }

  function renderHud() {
    const { setup } = game;
    const cfg = SIZES[setup.size];
    $('#memory-sub').textContent = `${cfg.rows} × ${cfg.cols} · ${t(`memory.theme.${setup.theme}`)}`;
    $('#memory-title').textContent = t(`memory.mode.${setup.mode}`);
  }

  function renderSide() {
    const box = $('#memory-turn');
    box.textContent = '';
    const { setup } = game;
    const who = names(setup.mode);
    for (let p = 0; p < game.players; p++) {
      const chip = document.createElement('span');
      chip.className = 'vier-chip memory-chip';
      chip.dataset.player = String(p);
      const art = setup.mode === 'cpu' && p === 1 ? robotSvg() : tokenSvg(TOKENS[p]);
      chip.innerHTML = `${art}<span class="name"></span><span class="score"></span><span class="arrow" aria-hidden="true"></span>`;
      chip.querySelector('.name').textContent = setup.mode === 'solo' ? '' : who[p];
      box.appendChild(chip);
    }
    updateSide();
  }

  function updateSide() {
    if (!game) return;
    const solo = game.setup.mode === 'solo';
    const total = pairsOf(game.setup.size);
    for (const chip of document.querySelectorAll('#memory-turn .memory-chip')) {
      const p = Number(chip.dataset.player);
      chip.classList.toggle('on', !game.over && !solo && game.turn === p);
      chip.classList.toggle('winner', !!game.over && !solo && game.over.winners.length === 1 && game.over.winners[0] === p);
      chip.classList.toggle('thinking', isCpu() && p === 1 && cpuTurnNow());
      chip.classList.toggle('solo', solo);
      chip.querySelector('.score').textContent = solo ? `${t('memory.found', { n: game.scores[0], total })} · ${t('memory.turns', { n: game.turns })}` : String(game.scores[p]);
    }
    let text = message;
    if (!text && !game.over) {
      if (cpuTurnNow()) text = t('memory.thinking');
      else if (solo) text = game.open.length === 1 ? t('memory.pickOne') : t('memory.pickTwo');
      else if (isCpu()) text = t('memory.yourTurn');
      else text = t('memory.turn', { name: names('duo')[game.turn] });
    }
    $('#memory-status').textContent = text;
  }

  function updateCards() {
    if (!game) return;
    game.cards.forEach((c, i) => {
      const el = cards[i];
      if (!el) return;
      const up = c.up || c.found;
      el.classList.toggle('up', up);
      el.classList.toggle('found', c.found);
      el.classList.toggle('p0', c.found && c.by === 0 && game.players === 2);
      el.classList.toggle('p1', c.found && c.by === 1 && game.players === 2);
      el.classList.toggle('hop', hop.has(i));
      el.setAttribute('aria-label', c.found ? t('memory.cardFound', { n: i + 1, name: picName(c.face) }) : up ? t('memory.cardUp', { n: i + 1, name: picName(c.face) }) : t('memory.cardDown', { n: i + 1 }));
      el.disabled = c.found;
    });
    updateSide();
  }

  /** A child's tap on a card. */
  function tapCard(i) {
    if (!game || game.over) return;
    const c = game.cards[i];
    if (timer || cpuTurnNow() || mustHide(game) || c.up || c.found) {
      if (!c.found) {
        cards[i]?.classList.add('wiggle');
        setTimeout(() => cards[i]?.classList.remove('wiggle'), 400);
      }
      return;
    }
    sfx.unlock();
    turnOver(i);
  }

  /** Turn card i over (the child's or the computer's), and what follows. */
  function turnOver(i) {
    const { game: next, result } = flip(game, i);
    if (!result) return;
    game = keep(next);
    memory = observe(memory, game, i);
    hop = new Set();
    message = '';
    if (result === 'first') {
      sfx.plink(3); // a card turned
      updateCards();
      if (cpuTurnNow()) later(TIMES.cpuSecond, cpuPick);
      return;
    }
    if (result === 'miss') {
      sfx.plink(1);
      message = t('memory.miss');
      updateCards();
      later(TIMES.miss, turnBack);
      return;
    }
    // a pair (maybe the last one)
    const pair = game.cards.flatMap((x, k) => (x.face === game.cards[i].face ? [k] : []));
    hop = new Set(pair);
    for (const k of pair) memory = observe(memory, game, k);
    sfx.chime();
    if (result === 'over') {
      updateCards();
      finish();
      return;
    }
    message = isCpu() && game.turn === 1 ? t('memory.cpuPair') : game.setup.mode === 'solo' ? t('memory.pairSolo') : t('memory.pair');
    updateCards();
    if (cpuTurnNow()) later(TIMES.pair + TIMES.cpuFirst, cpuPick);
  }

  /** Two different pictures: turn them back, and the other player goes. */
  function turnBack() {
    if (!game || !mustHide(game)) return;
    game = keep(hide(game));
    message = '';
    sfx.tick();
    updateCards();
    if (cpuTurnNow()) cpuTurn();
  }

  /** The computer's turn begins: some of what it remembered fades, then it picks a card. */
  function cpuTurn() {
    if (!cpuTurnNow()) return;
    memory = fade(memory, game);
    updateSide();
    later(game.open.length ? TIMES.cpuSecond : TIMES.cpuFirst, cpuPick);
  }

  function cpuPick() {
    if (!cpuTurnNow() || mustHide(game)) return;
    const i = choose(game, memory);
    if (i >= 0) turnOver(i);
  }

  function finish() {
    cancelTimer();
    const { setup, over } = game;
    if (setup.mode === 'solo') store.recordStars(meta.id, starKey(setup), starsFor(game.turns, pairsOf(setup.size)));
    else if (setup.mode === 'cpu' && over.winners.length === 1 && over.winners[0] === 0) {
      const key = winKey(setup);
      store.recordStars(meta.id, key, (progress()[key] || 0) + 1);
    }
    const cpuWon = setup.mode === 'cpu' && over.winners.length === 1 && over.winners[0] === 1;
    setTimeout(() => (cpuWon ? sfx.lose() : sfx.win()), wait(350));
    const done = game;
    cancelCard();
    cardTimer = setTimeout(() => {
      cardTimer = null;
      if (game === done && onScreen('memory')) showEndCard();
    }, wait(TIMES.card));
  }

  function showEndCard() {
    const { setup, over, scores } = game;
    let title;
    let text = '';
    let art;
    if (setup.mode === 'solo') {
      const stars = starsFor(game.turns, pairsOf(setup.size));
      title = t('memory.soloWin');
      text = t('memory.soloWinText', { n: game.turns });
      art = `<span class="memory-ov-stars" aria-label="${t('memory.stars', { n: stars })}">${[1, 2, 3].map((k) => `<svg class="${k <= stars ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join('')}</span>`;
    } else if (over.winners.length === 2) {
      title = t('memory.draw');
      text = t('memory.score', { a: scores[0], b: scores[1] });
      art = `<span class="vier-ov">${tokenSvg(TOKENS[0])}${setup.mode === 'cpu' ? robotSvg() : tokenSvg(TOKENS[1])}</span>`;
    } else {
      const w = over.winners[0];
      const [a, b] = [scores[w], scores[1 - w]];
      if (setup.mode === 'cpu' && w === 1) {
        title = t('memory.cpuWins');
        text = t('memory.cpuWinsText', { a: scores[0], b: scores[1] });
        art = `<span class="vier-ov">${robotSvg()}</span>`;
      } else {
        title = setup.mode === 'cpu' ? t('memory.youWin') : t('memory.nameWins', { name: names(setup.mode)[w] });
        text = t('memory.score', { a, b });
        art = `<span class="vier-ov won">${tokenSvg(TOKENS[w])}</span>`;
      }
    }
    const buttons = [[t('memory.again'), 'big primary', start]];
    // the end of the free part: the biggest free board, on a device without the full version
    // (the menu first, then the offer: whatever closes it, the child lands on the menu, never on the
    // finished cards; as Bubbels does since PR #36)
    if (!shell.unlock.owned && setup.size === meta.freeSizes[meta.freeSizes.length - 1]) buttons.push([t('memory.more'), 'big secondary', () => (shell.show('memory-menu'), shell.offerUnlock(t('memory.lockedLead')))]);
    buttons.push([t('memory.menuBtn'), 'big secondary', () => shell.show('memory-menu')]);
    shell.showOverlay({ art, title, text, buttons });
  }

  $('#memory-back').addEventListener('click', () => {
    tap();
    leave();
  });

  /** The board -> the menu (the game is kept for this session: "keep playing"). */
  function leave() {
    shell.hideOverlay();
    cancelTimer(); // a miss is turned back, and the computer goes on, when the child comes back
    cancelCard();
    shell.show('memory-menu');
  }

  function fitBoard() {
    if (!game) return;
    const stage = $('#memory-stage');
    const side = window.innerWidth > window.innerHeight * 1.2; // sideways: the players beside the cards
    stage.classList.toggle('side', side);
    const panel = $('#memory-stage .memory-side');
    const w = stage.clientWidth - 24 - (side ? panel.offsetWidth + 16 : 0);
    const h = stage.clientHeight - 16 - (side ? 0 : panel.offsetHeight + 12);
    const grid = bestGrid(game.cols, game.rows, w, h);
    const cell = Math.max(44, Math.min(grid.cell, 150));
    const el = $('#memory-board');
    el.style.setProperty('--cols', String(grid.cols));
    el.style.setProperty('--rows', String(grid.rows));
    el.style.setProperty('--cell', `${cell}px`);
  }

  return {
    open() {
      shell.show('memory-menu');
    },
    leave,
    async init() {
      return true;
    },
    testHook() {
      return {
        choose: (setup) => {
          choice = { ...(choice || savedSetup()), ...setup };
          if (onScreen('memory-menu')) renderMenu();
        },
        start: () => start(),
        tap: (i) => tapCard(i),
        fast: (on) => (fast = !!on),
        state: () =>
          game
            ? {
                faces: game.cards.map((c) => c.face),
                up: game.cards.map((c) => c.up),
                found: game.cards.map((c) => c.found),
                turn: game.turn,
                starter: game.starter,
                open: game.open.slice(),
                scores: game.scores.slice(),
                turns: game.turns,
                over: game.over,
                busy: !!timer,
                setup: { ...game.setup },
                grid: { cols: Number($('#memory-board').style.getPropertyValue('--cols')), rows: Number($('#memory-board').style.getPropertyValue('--rows')) },
              }
            : null,
        progress: () => progress(),
      };
    },
  };
}
