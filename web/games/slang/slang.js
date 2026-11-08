// Slangetje: steer a friendly snake and eat things in the right order: numbers (counting), the
// letters of a word, or only the fruit of one colour. A mistake is a gentle "oops" and one part
// shorter, never a game over; the oldest tier has walls and bumping ends the round (try again).
// The rules live in rules.js, the pictures in art.js; the shell (web/js/main.js) owns the overlay
// card, the sound settings and the purchase, and passes them in as `shell`.
//
// Saved (games.slang): stars per level (`stars`, only ever raised) and which how-to cards were seen
// ('howSeen'). Both read from the save each time they are used. An unfinished round is kept while
// the app stays open ("keep playing" in the menu), not across a restart.
//
// The snake waits for the child: a round, and a round coming back from the pause or the menu,
// starts with the first swipe or arrow.
import { meta } from './meta.js';
import { MODES, TIERS, OPPOSITE, tierOf, createRound, turn, step, expected, total, currentWord, starsFor, parSeconds, pathDirection, isCorrect, canCompact, countSequence } from './rules.js';
import { snakeSvg, modeSvg, wordPictureSvg, numberFruitSvg, colorFruitSvg, drawBoard, drawNumberFruit, drawLetterTile, drawColorFruit, drawHelpRing, drawSnake, ITEM_R, glyphSizes, FRUIT_COLORS } from './art.js';
import { getLang } from '../../js/i18n.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const ARROW = '<path d="M12 4 4.5 13H9v7h6v-7h4.5z"/>';
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
const SWIPE = 22; // px of finger movement that turn the snake while the finger is still down
const FLICK = 8; // px: a shorter movement is a tap (steer towards it), a longer one a swipe (review of PR #12)
const MIN_CELL = 20; // px: below this a big board is shrunk, so numbers and letters stay readable
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createSlang(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};

  let levels = [];
  let loadFailed = false;
  let game = null; // { level, state, prev (the snake one step ago) }
  let paused = false; // the pause card is up
  let manual = false; // tests step the snake themselves (test hook only)
  let raf = 0;
  let last = 0;
  let acc = 0; // seconds since the last step
  let clock = 0; // seconds of animation, for the little wobbles
  let plays = 0; // counts rounds started, so a late card never lands on a newer round
  let cardTimer = null;
  const fx = { flash: 0, squash: 0, shake: 0, parts: [] };
  let cell = 24;
  let dpr = 1;
  const canvas = $('#slang-canvas');
  const ctx = canvas.getContext('2d');

  const locked = (level) => !level.free && !shell.unlock.owned;
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const colorName = (i) => t(`slang.color.${i}`);
  const interval = () => 1 / game.level.speed;

  shell.unlock.onChange(() => {
    if (onScreen('slang-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'slang-menu') renderMenu();
    if (name === 'slang') requestAnimationFrame(() => (fit(), draw()));
    else stopLoop();
  });
  shell.onLangChange(() => {
    // a kept letters round spells the word of the new language (review of PR #12)
    if (game && game.state.mode === 'letters' && !game.state.over && getLang() !== game.state.lang) {
      game = { ...game, state: createRound(game.level, { lang: getLang(), landscape: game.landscape, compact: game.state.compact }), prev: null };
      setStatus(t('slang.goOn'));
    }
    if (onScreen('slang-menu')) renderMenu();
    if (game) {
      renderHud();
      renderTarget();
    }
  });
  window.addEventListener('resize', () => {
    if (onScreen('slang') && game) {
      fit();
      draw();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game && onScreen('slang') && game.state.started && !game.state.over && !overlayUp()) pause();
  });

  // ---------- menu ----------

  function starsText(n) {
    return [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  }

  function renderMenu() {
    const box = $('#slang-menu');
    box.textContent = '';
    if (game && !game.state.over) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'slang-continue';
      cont.className = 'btn big secondary slang-continue';
      cont.textContent = t('slang.continue');
      cont.addEventListener('click', () => {
        tap();
        resumeFromMenu();
      });
      box.appendChild(cont);
    }
    const got = stars();
    for (const mode of MODES) {
      const ofMode = levels.filter((l) => l.mode === mode);
      if (!ofMode.length) continue;
      const head = document.createElement('h3');
      head.className = 'slang-mode';
      head.dataset.mode = mode;
      head.innerHTML = `<span class="slang-mode-art">${modeSvg(mode)}</span><span class="slang-mode-text"><span class="slang-mode-title"></span><span class="slang-mode-sub"></span></span>`;
      head.querySelector('.slang-mode-title').textContent = t(`slang.mode.${mode}`);
      head.querySelector('.slang-mode-sub').textContent = t(`slang.mode.${mode}Sub`);
      box.appendChild(head);
      const nextOpen = ofMode.find((l) => !got[l.id] && !locked(l));
      for (const tier of Object.keys(TIERS)) {
        const group = ofMode.filter((l) => l.tier === tier);
        if (!group.length) continue;
        const age = document.createElement('p');
        age.className = 'slang-age';
        age.textContent = t('slang.age', { age: TIERS[tier].age });
        box.appendChild(age);
        const grid = document.createElement('div');
        grid.className = 'level-grid slang-grid';
        for (const level of group) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'level-btn';
          b.dataset.level = String(level.id);
          if (locked(level)) {
            b.classList.add('locked');
            b.innerHTML = `<span class="num">${level.id}</span><svg viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
            b.setAttribute('aria-label', t('slang.levelLocked', { n: level.id }));
            b.addEventListener('click', () => {
              tap();
              offer();
            });
          } else {
            const n = got[level.id] || 0;
            if (nextOpen && nextOpen.id === level.id) b.classList.add('next');
            b.innerHTML = `<span class="num">${level.id}</span><span class="stars" aria-hidden="true">${starsText(n)}</span>`;
            b.setAttribute('aria-label', n ? t('slang.levelStars', { n: level.id, stars: n }) : t('slang.levelOpen', { n: level.id }));
            b.addEventListener('click', () => {
              tap();
              start(level.id);
            });
          }
          grid.appendChild(b);
        }
        box.appendChild(grid);
      }
    }
  }

  /** The app-wide offer, with a line about what it opens here. */
  function offer() {
    shell.offerUnlock(t('slang.lockedLead', { free: levels.filter((l) => l.free).length || meta.free, total: levels.length || 30 }));
  }

  // ---------- a round ----------

  function start(id) {
    const level = levels.find((l) => l.id === id);
    if (!level) return;
    if (locked(level)) {
      offer();
      return;
    }
    plays++;
    cancelCard();
    paused = false;
    acc = 0;
    fx.flash = fx.squash = fx.shake = 0;
    fx.parts = [];
    const landscape = window.innerWidth > window.innerHeight * 1.2;
    const make = (compact) => ({ level, landscape, state: createRound(level, { lang: getLang(), landscape, compact }), prev: null });
    game = make(false);
    shell.show('slang');
    renderHud();
    setStatus(t('slang.start'));
    renderTarget();
    fit();
    if (cell < MIN_CELL && canCompact(level)) {
      // a small screen: the same level on a board two squares smaller, so everything stays readable
      game = make(true);
      renderTarget();
      fit();
    }
    draw();
    const how = howKeys(level).filter((k) => !seenHow()[k]);
    if (how.length) {
      shell.showOverlay({
        art: `<span class="slang-ov">${modeSvg(level.mode)}</span>`,
        title: t('slang.howTitle'),
        text: howText(level),
        buttons: [
          [
            t('common.ok'),
            'big primary',
            () => {
              store.saveGameOption(meta.id, 'howSeen', { ...seenHow(), ...Object.fromEntries(how.map((k) => [k, true])) });
              shell.hideOverlay();
              startLoop(); // the help ring may move again
            },
          ],
        ],
      });
    }
    startLoop();
  }

  /** Which how-to cards this level needs: the kind of round, a new way of counting, and bumps. */
  function howKeys(level) {
    const keys = [level.mode];
    if (level.mode === 'count' && (level.step || 1) !== 1) keys.push(level.step < 0 ? 'count-down' : 'count-twos');
    if (tierOf(level).selfHit) keys.push('bump');
    return keys;
  }

  /** The how-to text, with this level's own numbers (1, 2, 3 … or 2, 4, 6 … or 10, 9, 8 …). */
  function howText(level) {
    let text = t(`slang.how.${level.mode}`, level.mode === 'count' ? { seq: countSequence(level).slice(0, 3).join(', ') } : {});
    if (tierOf(level).selfHit) text = `${text} ${t('slang.how.bump')}`;
    return text;
  }

  function renderHud() {
    const { level } = game;
    $('#slang-sub').textContent = t(`slang.mode.${level.mode}`);
    $('#slang-title').textContent = t('slang.level', { n: level.id });
  }

  /** The "eat this" panel above the board. */
  function renderTarget() {
    const s = game.state;
    const box = $('#slang-target');
    box.textContent = '';
    const art = document.createElement('span');
    art.className = 'slang-target-art';
    const main = document.createElement('span');
    main.className = 'slang-target-main';
    const what = document.createElement('span');
    what.className = 'slang-target-what';
    const prog = document.createElement('span');
    prog.className = 'slang-target-progress';
    const next = expected(s);
    if (s.mode === 'letters') {
      const w = currentWord(s);
      art.innerHTML = wordPictureSvg(w.id);
      what.classList.add('slang-word');
      w.letters.forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = `slang-letter ${i < w.done ? 'done' : i === w.done && !s.over ? 'next' : ''}`;
        span.textContent = ch;
        what.appendChild(span);
      });
      what.setAttribute('aria-label', s.over ? t('slang.winText') : t('slang.eatLetter', { letter: next }));
      const words = s.level.words.length;
      prog.textContent = words > 1 ? t('slang.progress', { done: Math.min(w.index + (s.over ? 1 : 0), words), total: words }) : '';
    } else if (s.mode === 'count') {
      art.innerHTML = numberFruitSvg(s.over ? s.seq[s.seq.length - 1] : next);
      what.textContent = s.over ? t('slang.winText') : t('slang.eatNumber', { n: next });
      prog.textContent = t('slang.progress', { done: s.idx, total: total(s) });
    } else {
      art.innerHTML = colorFruitSvg(s.over ? s.seq[s.seq.length - 1] : next);
      what.textContent = s.over ? t('slang.winText') : t('slang.eatColor', { color: colorName(next) });
      prog.textContent = t('slang.progress', { done: s.idx, total: total(s) });
    }
    main.appendChild(what);
    const status = document.createElement('span');
    status.id = 'slang-status';
    status.className = 'slang-status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = statusText;
    box.append(art, main, prog, status); // the status gets a row of its own, the panel's full width
  }

  let statusText = '';
  function setStatus(text) {
    statusText = text;
    const el = $('#slang-status');
    if (el) el.textContent = text;
  }

  /** The child steers: a swipe, an arrow button or a key. The first one starts the snake. */
  function steer(dir) {
    if (!game || game.state.over || !onScreen('slang') || overlayUp()) return;
    sfx.unlock();
    const s = game.state;
    const wasStarted = s.started;
    if (turn(s, dir) && !wasStarted) {
      game.prev = null; // no slide back to where it was before the hold (review of PR #12)
      setStatus('');
      acc = 0;
      startLoop();
    }
  }

  function advance() {
    const s = game.state;
    game.prev = s.snake.map((p) => p.slice());
    const before = expected(s);
    const events = step(s);
    for (const e of events) {
      if (e.type === 'eat') {
        sfx.munch();
        fx.squash = 1;
        burst(s.snake[0], e.value);
        if (s.over) continue; // the 'done' event follows
        if (s.mode === 'colors' && expected(s) !== before) {
          setStatus(t('slang.newColor', { color: colorName(expected(s)) }));
          sfx.plink(3);
        } else setStatus('');
        renderTarget();
      } else if (e.type === 'oops') {
        sfx.boop();
        fx.flash = 1;
        fx.shake = 1;
        const want = expected(s);
        setStatus(
          s.mode === 'count' ? t('slang.oopsNumber', { n: want }) : s.mode === 'letters' ? t('slang.oopsLetter', { letter: want }) : t('slang.oopsColor', { color: colorName(want) }),
        );
      } else if (e.type === 'done') finish();
      else if (e.type === 'crash') crashed();
    }
  }

  function finish() {
    const { level, state: s } = game;
    const seconds = s.steps / level.speed; // the snake's own time, pauses not counted
    const n = starsFor({ tier: level.tier, mistakes: s.mistakes, seconds, par: parSeconds(level, s.cols, s.rows) });
    store.recordStars(meta.id, String(level.id), n);
    setStatus('');
    renderTarget();
    sfx.chime();
    const token = plays;
    cancelCard();
    cardTimer = setTimeout(() => {
      cardTimer = null;
      if (token !== plays || !onScreen('slang')) return;
      showWinCard(level, n);
    }, 900);
  }

  function showWinCard(level, n) {
    const ofMode = levels.filter((l) => l.mode === level.mode);
    const next = ofMode[ofMode.indexOf(level) + 1]; // "Next" stays with the same kind of round
    const buttons = [];
    let text = t('slang.winText');
    if (next && !locked(next)) buttons.push([t('slang.next'), 'big primary', () => (shell.hideOverlay(), start(next.id))]);
    else if (next) {
      text = `${text} ${t('slang.lastFree')}`;
      // the offer over the level list, so "Later" lands there and not on the finished board
      buttons.push([t('slang.more'), 'big primary', () => (shell.show('slang-menu'), offer())]);
    }
    buttons.push([t('slang.levels'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('slang-menu')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`slang.win${n}`),
      text,
      buttons,
    });
  }

  function crashed() {
    const { level } = game;
    sfx.lose();
    fx.flash = 1;
    fx.shake = 1;
    const token = plays;
    cancelCard();
    cardTimer = setTimeout(() => {
      cardTimer = null;
      if (token !== plays || !onScreen('slang')) return;
      shell.showOverlay({
        art: `<span class="slang-ov">${snakeSvg()}</span>`,
        title: t('slang.crash'),
        text: t('slang.crashText'),
        buttons: [
          [t('slang.again'), 'big primary', () => (shell.hideOverlay(), start(level.id))],
          [t('slang.menuBtn'), 'big secondary', () => shell.show('slang-menu')],
        ],
      });
    }, 800);
  }

  function cancelCard() {
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
  }

  /** The snake waits until the child steers again (after the pause card or the menu). */
  function hold() {
    const s = game?.state;
    if (!s || s.over) return;
    if (s.started) {
      s.started = false;
      s.queue = [];
      setStatus(t('slang.goOn'));
    }
  }

  function pause() {
    if (!game || game.state.over || overlayUp()) return;
    paused = true;
    hold();
    shell.showOverlay({
      art: `<span class="slang-ov">${snakeSvg()}</span>`,
      title: t('slang.pause'),
      text: t('slang.pauseText'),
      buttons: [
        [t('slang.resume'), 'big primary', resume],
        [t('slang.menuBtn'), 'big secondary', leave],
      ],
    });
  }

  function resume() {
    shell.hideOverlay();
    paused = false;
    startLoop();
  }

  function resumeFromMenu() {
    if (!game || game.state.over) return;
    paused = false;
    hold();
    shell.show('slang');
    renderHud();
    renderTarget();
    fit();
    draw();
    startLoop();
  }

  /** The board -> the menu (the round is kept for this session: "keep playing"). */
  function leave() {
    cancelCard();
    hold();
    paused = false;
    shell.hideOverlay();
    shell.show('slang-menu');
  }

  // ---------- the loop ----------

  function startLoop() {
    if (raf || !onScreen('slang')) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function frame(now) {
    raf = 0;
    if (!game || !onScreen('slang')) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    clock += dt;
    const s = game.state;
    if (s.started && !s.over && !paused && !manual && !overlayUp()) {
      acc += dt;
      while (acc >= interval() && !s.over) {
        acc -= interval();
        advance();
      }
    }
    fx.flash = Math.max(0, fx.flash - dt * 3);
    fx.squash = Math.max(0, fx.squash - dt * 5);
    fx.shake = Math.max(0, fx.shake - dt * 4);
    fx.parts = fx.parts.filter((p) => (p.life -= dt) > 0);
    for (const p of fx.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    }
    draw();
    // Only keep drawing while something moves (review of PR #12: a waiting snake ran 60 fps):
    // the snake, an effect, or the youngest tier's pulsing help ring.
    if (needsFrames()) raf = requestAnimationFrame(frame);
  }

  function needsFrames() {
    if (!game) return false;
    const s = game.state;
    if (fx.flash || fx.squash || fx.shake || fx.parts.length) return true;
    if (s.over || paused || overlayUp()) return false;
    if (s.started && !manual) return true;
    return tierOf(s.level).help && !reducedMotion();
  }

  function burst([r, c], value) {
    if (reducedMotion()) return;
    const x = (c + 0.5) * cell;
    const y = (r + 0.5) * cell;
    const color = game.state.mode === 'count' ? '#ff9f43' : game.state.mode === 'letters' ? '#c9a14a' : FRUIT_COLORS[value % FRUIT_COLORS.length].base;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      fx.parts.push({ x, y, vx: Math.cos(a) * cell * 4, vy: Math.sin(a) * cell * 4 - cell * 2, life: 0.35, color });
    }
  }

  // ---------- drawing ----------

  function fit() {
    if (!game) return;
    const stage = $('#slang-stage');
    stage.classList.toggle('side', window.innerWidth > window.innerHeight * 1.2);
    const wrap = $('#slang-board');
    const { cols, rows } = game.state;
    const w = wrap.clientWidth - 8;
    const h = wrap.clientHeight - 8;
    cell = Math.max(10, Math.floor(Math.min(w / cols, h / rows, 60)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${cols * cell}px`;
    canvas.style.height = `${rows * cell}px`;
    canvas.width = Math.round(cols * cell * dpr);
    canvas.height = Math.round(rows * cell * dpr);
  }

  /** The snake's parts in pixels, sliding from where they were a step ago to where they are now. */
  function snakePoints() {
    const s = game.state;
    const f = s.started && !s.over && !manual ? Math.min(1, acc / interval()) : 1;
    const prev = game.prev || s.snake;
    return s.snake.map(([r, c], i) => {
      const p = prev[i] || prev[prev.length - 1];
      let rr = r;
      let cc = c;
      if (p && Math.abs(p[0] - r) + Math.abs(p[1] - c) === 1) {
        rr = p[0] + (r - p[0]) * f;
        cc = p[1] + (c - p[1]) * f;
      }
      return [(cc + 0.5) * cell, (rr + 0.5) * cell];
    });
  }

  function draw() {
    if (!game) return;
    const s = game.state;
    const reduced = reducedMotion();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s.cols * cell, s.rows * cell);
    if (fx.shake && !reduced) ctx.translate(Math.sin(clock * 70) * cell * 0.1 * fx.shake, 0);
    drawBoard(ctx, { cols: s.cols, rows: s.rows, cell, wrap: s.wrap, walls: s.walls });
    const help = tierOf(s.level).help && !s.over;
    for (const it of s.items) {
      const x = (it.c + 0.5) * cell;
      const y = (it.r + 0.5) * cell;
      const r = cell * ITEM_R;
      if (help && isCorrect(s, it)) drawHelpRing(ctx, x, y, r, reduced ? 0 : clock);
      if (s.mode === 'count') drawNumberFruit(ctx, x, y, r, it.value, cell);
      else if (s.mode === 'letters') drawLetterTile(ctx, x, y, r * 0.92, it.value, cell);
      else drawColorFruit(ctx, x, y, r, it.value);
    }
    const tongue = !reduced && s.started && !s.over && clock % 2.6 < 0.3;
    drawSnake(ctx, snakePoints(), cell, s.dir, { flash: fx.flash, tongue, squash: reduced ? 0 : fx.squash });
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.min(1, p.life / 0.2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- input ----------

  for (const b of document.querySelectorAll('#slang-pad [data-dir]')) {
    b.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${ARROW}</svg>`);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      steer(b.dataset.dir);
    });
    b.addEventListener('click', (e) => {
      if (e.detail === 0) steer(b.dataset.dir); // a keyboard press on the button (a tap was handled on pointerdown)
    });
  }

  let swipe = null; // { x, y, moved }
  const board = $('#slang-board');
  board.addEventListener('pointerdown', (e) => {
    swipe = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false };
    board.setPointerCapture?.(e.pointerId);
  });
  board.addEventListener('pointermove', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    swipe = { ...swipe, x: e.clientX, y: e.clientY, moved: true }; // a longer swipe can turn again
  });
  const dirOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  const endSwipe = (e) => {
    if (!swipe) return;
    const sw = swipe;
    swipe = null;
    if (sw.moved || !game) return;
    // a short swipe (8 px or more, under the turning distance) still goes the way the finger went
    const mx = e.clientX - sw.x0;
    const my = e.clientY - sw.y0;
    if (Math.max(Math.abs(mx), Math.abs(my)) >= FLICK) {
      steer(dirOf(mx, my));
      return;
    }
    // a tap: steer towards where the child tapped, seen from the head
    const rect = canvas.getBoundingClientRect();
    const [hr, hc] = game.state.snake[0];
    const dx = e.clientX - (rect.left + (hc + 0.5) * cell);
    const dy = e.clientY - (rect.top + (hr + 0.5) * cell);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * 0.6) return;
    let dir = dirOf(dx, dy);
    const s = game.state;
    const facing = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (dir === OPPOSITE[facing] && s.started) {
      // behind the snake: turn along the other axis, towards the tap (or to one side when it is
      // straight behind), instead of doing nothing
      dir = facing === 'up' || facing === 'down' ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
    }
    steer(dir);
  };
  board.addEventListener('pointerup', endSwipe);
  board.addEventListener('pointercancel', () => (swipe = null));

  document.addEventListener('keydown', (e) => {
    if (!onScreen('slang') || !game) return;
    // Space or Enter on a focused arrow button presses that button (its click steers)
    if ((e.key === ' ' || e.key === 'Enter') && e.target?.closest?.('#slang-pad')) return;
    if (KEYS[e.key]) {
      e.preventDefault();
      steer(KEYS[e.key]);
    } else if ((e.key === ' ' || e.key === 'p' || e.key === 'Escape') && !overlayUp()) {
      e.preventDefault();
      pause();
    }
  });

  $('#slang-pause').addEventListener('click', () => {
    tap();
    pause();
  });
  $('#slang-back').addEventListener('click', () => {
    tap();
    leave();
  });

  return {
    open() {
      if (loadFailed) {
        shell.showOverlay({ title: t('error.title'), text: t('slang.loadError'), buttons: [[t('error.retry'), 'big primary', () => location.reload()]] });
        return;
      }
      shell.show('slang-menu');
    },
    leave,
    /** Load the levels; false if that failed (opening the game then explains). */
    async init() {
      try {
        const res = await fetch(new URL('./levels.json', import.meta.url));
        if (!res.ok) throw new Error(`levels.json: HTTP ${res.status}`);
        levels = await res.json();
        return true;
      } catch (err) {
        console.error(err);
        loadFailed = true;
        return false;
      }
    },
    testHook() {
      const snap = () => {
        if (!game) return null;
        const s = game.state;
        return {
          id: game.level.id,
          mode: s.mode,
          cols: s.cols,
          rows: s.rows,
          snake: s.snake.map((p) => p.slice()),
          dir: s.dir,
          started: s.started,
          idx: s.idx,
          total: total(s),
          expected: expected(s),
          items: s.items.map((it) => ({ r: it.r, c: it.c, value: it.value })),
          mistakes: s.mistakes,
          over: s.over,
          paused,
          cell,
          compact: !!s.compact,
          glyphs: glyphSizes(cell),
          looping: !!raf,
        };
      };
      return {
        start: (id) => start(id),
        manual: (on) => {
          manual = !!on;
          if (!manual) startLoop();
        },
        advance: (n = 1) => {
          for (let i = 0; i < n && game && game.state.started && !game.state.over; i++) advance();
          draw();
          return snap();
        },
        autopilot: () => (game ? pathDirection(game.state) : null),
        steer: (dir) => steer(dir),
        pause: () => pause(),
        state: snap,
        stars: () => stars(),
        levels: () => levels.map((l) => ({ id: l.id, mode: l.mode, tier: l.tier, free: !!l.free })),
      };
    },
  };
}
