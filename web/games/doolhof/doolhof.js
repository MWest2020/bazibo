// Egeltje (Little Hedgehog): walk a hedgehog through a garden maze and pick up the letters in
// alphabetical order, the letters of a pictured word, or numbers in order. A swipe, an arrow on the
// pad or an arrow key walks it to the next crossing (round bends by itself). Nothing is ever lost:
// a wrong letter is a soft bump, a crow it walks into flutters up and flies off (rules.js); there
// is always a way no crow stands on. No timer, no game over, nothing spoken.
// The rules live in rules.js and maze.js, the pictures in art.js; the shell (web/js/main.js) owns
// the overlay card, the sound setting and the purchase, and passes them in as `shell`.
//
// Saved (games.doolhof): stars per round (only ever raised), random rounds done per kind and tier,
// which how-to cards were seen and the last tier per kind. All read from the save each time. An
// unfinished round is kept while the app stays open ("keep playing"); it waits for the first step.
import { meta } from './meta.js';
import { MODES, TIER_IDS, ROUNDS_PER_TIER, AGES, CROW_MS, WORD_HINT, createRound, roundSeed, stepHog, continueDir, stepCrows, expected, targetTile, currentWord, helpOn, pathDirection, tileAt, crowAt, placementOk, starsFor } from './rules.js';
import { isOpen, beside, exits, rowOf, colOf, DIR_NAMES } from './maze.js';
import { hogSvg, crowSvg, modeSvg, drawGarden, drawStone, drawHog, drawCrow, glyphPx } from './art.js';
import { wordPictureSvg } from '../letters/art.js';
import { getLang } from '../../js/i18n.js';
import * as store from '../../js/storage.js';
import { newSeed, randomCard } from '../../js/random.js';
import * as sfx from '../../js/audio.js';
import { foldLocked } from '../../js/fold.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const ARROW = '<path d="M12 4 4.5 13H9v7h6v-7h4.5z"/>';
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const HOG_STEP = 0.2; // seconds per cell: a calm walk
const SURPRISE_S = 0.45; // a crow touch: the hedgehog curls up in surprise for a moment (only drawn; it can walk on)
const FLY_S = 0.8; // a crow fluttering off to its new place
const SWIPE = 22; // px of finger movement that count as a swipe while the finger is down
const FLICK = 8; // px: a shorter movement is a tap (walk towards it)
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createDoolhof(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  const randomDone = () => store.loadRandomSolved(meta.id);
  const lastTier = () => store.loadGameOption(meta.id, 'lastTier', {}) || {};

  // { mode, tier, roundId (null when random), seed, lang, s (the rules' state), walk, pending, prevCrows, flights, hogAcc, crowAcc, curl, done }
  let game = null;
  let menuMode = null;
  let plays = 0; // counts rounds started, so a late card never lands on a newer round
  let cardTimer = null;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let frozen = false; // the test hook can hold the crows still
  let cell = 40;
  let dpr = 1;
  const fx = { bump: 0, bumpDir: null, shake: 0, parts: [] };
  const canvas = $('#doolhof-canvas');
  const ctx = canvas.getContext('2d');

  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const locked = (mode, tier) => meta.isLocked({ mode, tier }, shell.unlock.owned);

  shell.unlock.onChange(() => {
    if (onScreen('doolhof-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'doolhof-menu') renderMenu();
    if (name === 'doolhof') requestAnimationFrame(() => (fit(), draw()));
    else stopLoop();
  });
  shell.onLangChange(() => {
    if (onScreen('doolhof-menu')) renderMenu();
    // a word round's words belong to its language: a kept one in the other language is dropped
    if (game && !game.done && game.mode === 'word' && game.lang !== getLang()) game = null;
    if (game && onScreen('doolhof')) {
      renderHud();
      renderTarget();
    }
  });
  window.addEventListener('resize', () => {
    if (game && onScreen('doolhof')) {
      fit();
      draw();
    }
  });

  // ---------- menu ----------

  function starsText(n) {
    return [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  }

  function renderMenu() {
    const box = $('#doolhof-menu');
    box.textContent = '';
    $('#doolhof-menu-title').textContent = menuMode ? t(`doolhof.mode.${menuMode}`) : t('doolhof.menu');
    if (game && !game.done) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'doolhof-continue';
      cont.className = 'btn big secondary letters-continue';
      cont.textContent = t('doolhof.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      box.appendChild(cont);
    }
    if (!menuMode) {
      for (const mode of MODES) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'klok-modecard doolhof-modecard';
        b.dataset.mode = mode;
        b.innerHTML = `<span class="klok-mode-art">${modeSvg(mode)}</span><span class="klok-mode-text"><span class="klok-mode-title"></span><span class="klok-mode-sub"></span><span class="klok-mode-age"></span></span>`;
        b.querySelector('.klok-mode-title').textContent = t(`doolhof.mode.${mode}`);
        b.querySelector('.klok-mode-sub').textContent = t(`doolhof.mode.${mode}Sub`);
        b.querySelector('.klok-mode-age').textContent = t('doolhof.ages', { age: '4-8' });
        b.addEventListener('click', () => {
          tap();
          menuMode = mode;
          renderMenu();
          $('#screen-doolhof-menu .levels-scroll').scrollTop = 0;
        });
        box.appendChild(b);
      }
      return;
    }
    const mode = menuMode;
    const got = stars();
    const rtier = TIER_IDS.includes(lastTier()[mode]) ? lastTier()[mode] : 't1';
    const rgrid = document.createElement('div');
    rgrid.className = 'level-grid klok-grid klok-random';
    rgrid.appendChild(
      randomCard({
        t,
        tap,
        title: `${t('random.play')} · ${t(`doolhof.tier.${mode}.${rtier}`)}`,
        locked: !shell.unlock.owned,
        solved: randomDone()[`${mode}-${rtier}`] || 0,
        done: true,
        onPlay: () => playRandom(mode, rtier),
        onLocked: () => shell.offerUnlock(t('doolhof.randomLead')),
      }),
    );
    box.appendChild(rgrid);
    for (const tier of TIER_IDS) {
      const line = document.createElement('p');
      line.className = 'klok-age';
      line.textContent = t('doolhof.tierLine', { age: AGES[tier], what: t(`doolhof.tier.${mode}.${tier}`) });
      box.appendChild(line);
      const grid = document.createElement('div');
      grid.className = 'level-grid klok-grid';
      grid.dataset.tier = `${mode}-${tier}`;
      for (let r = 1; r <= ROUNDS_PER_TIER; r++) {
        const id = `${mode}-${tier}-${r}`;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'level-btn';
        b.dataset.round = id;
        if (locked(mode, tier)) {
          b.classList.add('locked');
          b.innerHTML = `<span class="num">${r}</span><svg viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
          b.setAttribute('aria-label', t('doolhof.roundLocked', { n: r }));
          b.addEventListener('click', () => {
            tap();
            offer();
          });
        } else {
          const n = got[id] || 0;
          b.innerHTML = `<span class="num">${r}</span><span class="stars" aria-hidden="true">${starsText(n)}</span>`;
          b.setAttribute('aria-label', n ? t('doolhof.roundStars', { n: r, stars: n }) : t('doolhof.roundOpen', { n: r }));
          b.addEventListener('click', () => {
            tap();
            startRound(id);
          });
        }
        grid.appendChild(b);
      }
      box.appendChild(grid);
    }
    foldLocked(box);
  }

  /** The menu's back: from one kind of round to the list of kinds, from there to the home screen. */
  function menuBack() {
    if (menuMode) {
      menuMode = null;
      renderMenu();
    } else shell.show('home');
  }
  $('#doolhof-menu-back').addEventListener('click', () => {
    tap();
    menuBack();
  });

  function offer() {
    shell.offerUnlock(t('doolhof.lockedLead'));
  }

  // ---------- rounds ----------

  const isLandscape = () => window.innerWidth > window.innerHeight * 1.2;

  function startRound(id) {
    const [mode, tier, r] = String(id).split('-');
    if (!MODES.includes(mode) || !TIER_IDS.includes(tier) || !(Number(r) >= 1 && Number(r) <= ROUNDS_PER_TIER)) return;
    if (locked(mode, tier)) {
      offer();
      return;
    }
    const landscape = isLandscape();
    begin({ mode, tier, roundId: id, round: Number(r), seed: roundSeed(id, getLang(), landscape), landscape });
  }

  function playRandom(mode, tier, seed = null) {
    if (!shell.unlock.owned) {
      shell.offerUnlock(t('doolhof.randomLead'));
      return;
    }
    if (!MODES.includes(mode) || !TIER_IDS.includes(tier)) return;
    begin({ mode, tier, roundId: null, round: 0, seed: seed ?? newSeed(), landscape: isLandscape() });
  }

  function begin({ mode, tier, roundId, round, seed, landscape }) {
    plays++;
    cancelCard();
    menuMode = mode; // "Rounds" and the back button land on this kind of round
    if (lastTier()[mode] !== tier) store.saveGameOption(meta.id, 'lastTier', { ...lastTier(), [mode]: tier });
    const lang = getLang();
    const s = createRound({ mode, tier, lang, seed, landscape, round });
    game = { mode, tier, roundId, seed, lang, s, walk: null, chosen: false, pending: null, prevCrows: s.crows.map((c) => c.cell), flights: [], hogAcc: 0, crowAcc: 0, curl: 0, done: false };
    fx.bump = fx.shake = 0;
    fx.parts = [];
    shell.show('doolhof');
    renderHud();
    setStatus(t('doolhof.start'));
    renderTarget();
    fit();
    draw();
    if (!seenHow()[mode]) {
      shell.showOverlay({
        art: `<span class="doolhof-ov">${hogSvg()}${crowSvg()}</span>`,
        title: t('doolhof.howTitle'),
        text: `${t(`doolhof.how.${mode}`, { seq: s.seq.slice(0, 3).join(', ') })} ${t('doolhof.how.crow')}`,
        buttons: [
          [
            t('common.ok'),
            'big primary',
            () => {
              store.saveGameOption(meta.id, 'howSeen', { ...seenHow(), [mode]: true });
              shell.hideOverlay();
            },
          ],
        ],
      });
    }
  }

  /** Back to an unfinished round: everything waits for the first step again. */
  function resume() {
    if (!game || game.done) return;
    hold();
    shell.show('doolhof');
    renderHud();
    renderTarget();
    setStatus(t('doolhof.start'));
    fit();
    draw();
  }

  function hold() {
    if (!game) return;
    game.walk = game.pending = null;
    game.s.started = false; // the crows wait for the next step
    game.curl = 0;
    game.flights = [];
  }

  /** Android back and the menu button: to the menu, the round is kept ("keep playing"). */
  function leave() {
    cancelCard();
    hold();
    shell.hideOverlay();
    shell.show('doolhof-menu');
  }

  function cancelCard() {
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
  }

  // ---------- the panel above the garden ----------

  function renderHud() {
    $('#doolhof-sub').textContent = t(`doolhof.mode.${game.mode}`);
    $('#doolhof-title').textContent = game.roundId ? t('doolhof.round', { n: game.roundId.split('-')[2] }) : t('random.title');
  }

  let statusText = '';
  function setStatus(text) {
    statusText = text;
    const el = $('#doolhof-status');
    if (el) el.textContent = text;
  }

  const big = (v) => `<span class="doolhof-big" aria-hidden="true">${v}</span>`;

  function renderTarget() {
    const s = game.s;
    const box = $('#doolhof-target');
    box.textContent = '';
    box.dataset.mode = s.mode;
    const art = document.createElement('span');
    art.className = 'doolhof-target-art';
    const main = document.createElement('span');
    main.className = 'doolhof-target-main';
    const prompt = document.createElement('span');
    prompt.className = 'doolhof-prompt';
    const strip = document.createElement('span');
    strip.className = 'doolhof-strip';
    const prog = document.createElement('span');
    prog.className = 'doolhof-progress';
    const want = expected(s);
    if (s.mode === 'word') {
      const w = currentWord(s);
      const hint = WORD_HINT[s.tier];
      art.innerHTML = wordPictureSvg(w.picture);
      art.setAttribute('role', 'img');
      art.setAttribute('aria-label', t('doolhof.picture'));
      prompt.textContent = hint === 'picture' ? t('doolhof.findPicture') : t('doolhof.findWord');
      strip.classList.add('word');
      strip.dataset.hint = hint;
      [...w.word].forEach((ch, k) => {
        const span = document.createElement('span');
        const done = k < w.done || s.over;
        span.className = `doolhof-slot${done ? ' done' : ''}${k === w.done && !s.over ? ' next' : ''}`;
        if (done || hint !== 'picture') span.textContent = ch;
        strip.appendChild(span);
      });
      strip.setAttribute('role', 'img');
      strip.setAttribute('aria-label', hint === 'picture' && !s.over ? t('doolhof.wordLabel', { done: w.done, total: w.word.length }) : w.word);
      if (hint === 'ghost' && want) main.insertAdjacentHTML('beforeend', big(want));
      prog.textContent = s.words.length > 1 ? t('doolhof.progress', { done: Math.min(w.index + (s.over ? 1 : 0), s.words.length), total: s.words.length }) : '';
    } else {
      art.innerHTML = big(want ?? s.seq[s.seq.length - 1]);
      prompt.textContent = want ? t('doolhof.find', { v: want }) : t('doolhof.good');
      const from = Math.max(0, Math.min(s.i - 2, s.seq.length - 7));
      s.seq.slice(from, from + 7).forEach((v, k) => {
        const span = document.createElement('span');
        const at = from + k;
        span.className = `doolhof-slot${at < s.i ? ' done' : ''}${at === s.i && !s.over ? ' next' : ''}`;
        span.textContent = v;
        strip.appendChild(span);
      });
      strip.setAttribute('aria-hidden', 'true');
      prog.textContent = t('doolhof.progress', { done: s.i, total: s.seq.length });
    }
    main.prepend(prompt);
    main.appendChild(strip);
    const status = document.createElement('span');
    status.id = 'doolhof-status';
    status.className = 'doolhof-status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = statusText;
    box.append(art, main, prog, status);
  }

  // ---------- walking ----------

  /** The child picks a way: a swipe, an arrow or a key. The hedgehog walks to the next crossing. */
  function steer(dir) {
    if (!game || game.done || !onScreen('doolhof') || overlayUp() || !DIR_NAMES.includes(dir)) return;
    sfx.unlock();
    const s = game.s;
    if (game.walk) {
      // already walking: turn here if that way is open, or at the next place it is
      if (isOpen(s.maze, s.hog, dir)) {
        game.walk = dir;
        game.chosen = true; // the next step is the child's own
      } else game.pending = dir;
      return;
    }
    if (!isOpen(s.maze, s.hog, dir)) {
      fx.shake = 1; // a hedge: a little wobble, nothing else
      startLoop();
      return;
    }
    if (!s.started) setStatus('');
    // the first step lands after HOG_STEP, while the hedgehog is drawn walking towards it
    game.walk = dir;
    game.chosen = true;
    game.pending = null;
    game.hogAcc = 0;
    startLoop();
  }

  function takeStep() {
    const s = game.s;
    const dir = game.walk;
    if (!dir) return;
    // only the step the child chose may touch a crow or bump a wrong letter; a walk going on by
    // itself stops in front of them (a crow may have stepped in since the last step)
    const crowsBefore = s.crows.map((c) => c.cell);
    const e = stepHog(s, dir, { auto: !game.chosen });
    game.chosen = false;
    noteFlights(crowsBefore);
    if (e.type === 'blocked' || e.type === 'wait' || e.type === 'stop') {
      game.walk = null;
      game.pending = null;
      return;
    }
    if (e.type === 'move') {
      let next = continueDir(s, dir);
      if (game.pending && isOpen(s.maze, s.hog, game.pending) && crowAt(s, beside(s.maze, s.hog, game.pending)) < 0) {
        next = game.pending;
        game.pending = null;
      }
      game.walk = next;
      return;
    }
    game.walk = null;
    game.pending = null;
    if (e.type === 'wrong') {
      sfx.boop();
      fx.bump = 1;
      fx.bumpDir = dir;
      setStatus(s.mode === 'word' && WORD_HINT[s.tier] !== 'ghost' ? t('doolhof.wrongWord', { v: e.value }) : t('doolhof.wrong', { v: e.value, want: e.want }));
    } else if (e.type === 'crow') {
      // the crow flutters up and flies off; the hedgehog stays and can walk on at once
      sfx.thud(0.2);
      game.curl = SURPRISE_S;
      setStatus(t('doolhof.crow'));
    } else if (e.type === 'eat' || e.type === 'done') {
      sfx.plink(s.i);
      burst(s.hog);
      if (e.type === 'done') {
        finish();
        return;
      }
      if (e.word) {
        const w = s.words[currentWord(s).index - 1];
        setStatus(t('doolhof.wordDone', { word: w ? w.word : '' }));
      } else setStatus('');
      renderTarget();
    }
  }

  function finish() {
    const s = game.s;
    game.done = true;
    const n = starsFor(s.mistakes);
    if (game.roundId) store.recordStars(meta.id, game.roundId, n);
    else store.recordRandomSolved(meta.id, `${game.mode}-${game.tier}`);
    setStatus(t('doolhof.good'));
    renderTarget();
    sfx.chime();
    const token = plays;
    cancelCard();
    cardTimer = setTimeout(() => {
      cardTimer = null;
      if (token !== plays || !onScreen('doolhof')) return;
      showWinCard(n);
    }, 900);
  }

  function showWinCard(n) {
    const g = game;
    const s = g.s;
    const total = s.seq.length;
    let text = t('doolhof.winText', { right: total - s.mistakes, total });
    const buttons = [];
    if (!g.roundId) {
      text = `${text} ${t('random.done', { n: randomDone()[`${g.mode}-${g.tier}`] || 1 })}`;
      buttons.push([t('random.new'), 'big primary', () => (shell.hideOverlay(), playRandom(g.mode, g.tier))]);
    } else {
      const next = nextRoundId(g.roundId);
      if (next && !locked(next.split('-')[0], next.split('-')[1])) buttons.push([t('doolhof.next'), 'big primary', () => (shell.hideOverlay(), startRound(next))]);
      else if (next) {
        text = `${text} ${t('doolhof.lastFree')}`;
        // the offer over the round list, so "Later" lands there and not on the finished garden
        buttons.push([t('doolhof.more'), 'big primary', () => (shell.show('doolhof-menu'), offer())]);
      }
      buttons.push([t('doolhof.again'), 'big secondary', () => (shell.hideOverlay(), startRound(g.roundId))]);
    }
    buttons.push([t('doolhof.rounds'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('doolhof-menu')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`doolhof.win${n}`),
      text,
      buttons,
    });
  }

  /** The next round of the same kind: the next round of this tier, then the first of the next tier. */
  function nextRoundId(id) {
    const [mode, tier, r] = id.split('-');
    if (Number(r) < ROUNDS_PER_TIER) return `${mode}-${tier}-${Number(r) + 1}`;
    const k = TIER_IDS.indexOf(tier);
    return k >= 0 && k + 1 < TIER_IDS.length ? `${mode}-${TIER_IDS[k + 1]}-1` : null;
  }

  // ---------- the loop ----------

  function startLoop() {
    if (raf || !onScreen('doolhof')) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  const crowStep = () => CROW_MS[game.s.tier] / 1000;

  function frame(now) {
    raf = 0;
    if (!game || !onScreen('doolhof')) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    clock += dt;
    const s = game.s;
    const live = !game.done && !overlayUp();
    if (live && game.walk) {
      game.hogAcc += dt;
      while (game.walk && game.hogAcc >= HOG_STEP) {
        game.hogAcc -= HOG_STEP;
        takeStep();
        if (game.done) break;
      }
      if (!game.walk) game.hogAcc = 0;
    }
    if (game.curl > 0) game.curl = Math.max(0, game.curl - dt);
    for (const f of game.flights) f.t += dt;
    game.flights = game.flights.filter((f) => f.t < FLY_S);
    if (live && s.started && !frozen) {
      game.crowAcc += dt;
      if (game.crowAcc >= crowStep()) {
        game.crowAcc -= crowStep();
        const crowsBefore = s.crows.map((c) => c.cell);
        game.prevCrows = crowsBefore;
        stepCrows(s);
        noteFlights(crowsBefore);
      }
    }
    fx.bump = Math.max(0, fx.bump - dt * 4);
    fx.shake = Math.max(0, fx.shake - dt * 4);
    fx.parts = fx.parts.filter((p) => (p.life -= dt) > 0);
    for (const p of fx.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    }
    draw();
    if (needsFrames()) raf = requestAnimationFrame(frame);
  }

  /** Draw only while something moves: before the first step nothing does (no frames). */
  function needsFrames() {
    if (!game || !onScreen('doolhof')) return false;
    if (fx.bump || fx.shake || fx.parts.length || game.flights.length || game.curl > 0) return true;
    if (game.done || overlayUp()) return false;
    return !!game.walk || (game.s.started && !frozen) || (helpOn(game.s) && !reducedMotion());
  }

  /**
   * A crow that did not walk one step but flew (walked into, or making way for a new letter, or out
   * of the garden and back): its flight is drawn from where it was to where it landed.
   */
  function noteFlights(before) {
    const s = game.s;
    s.crows.forEach((c, k) => {
      const from = before[k];
      if (from === c.cell) return;
      if (from >= 0 && c.cell >= 0 && exits(s.maze, from).some((d) => beside(s.maze, from, d) === c.cell)) return;
      game.flights = game.flights.filter((f) => f.k !== k);
      game.flights.push({ k, from, to: c.cell, t: 0 });
      game.prevCrows[k] = c.cell;
      // the crows' next walking step waits for the landing (CROW_MS is longer than FLY_S), so a
      // landing crow never hops on a cell straight away
      game.crowAcc = 0;
    });
  }

  function burst(c) {
    if (reducedMotion()) return;
    const x = (colOf(game.s.maze, c) + 0.5) * cell;
    const y = (rowOf(game.s.maze, c) + 0.5) * cell;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      fx.parts.push({ x, y, vx: Math.cos(a) * cell * 3, vy: Math.sin(a) * cell * 3 - cell * 1.5, life: 0.35, color: i % 2 ? '#ffc531' : '#7fcf7a' });
    }
  }

  // ---------- drawing ----------

  function fit() {
    if (!game) return;
    $('#doolhof-stage').classList.toggle('side', isLandscape());
    const wrap = $('#doolhof-board');
    const { cols, rows } = game.s;
    const w = wrap.clientWidth - 8;
    const h = wrap.clientHeight - 8;
    cell = Math.max(16, Math.floor(Math.min(w / cols, h / rows, 96)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${cols * cell}px`;
    canvas.style.height = `${rows * cell}px`;
    canvas.width = Math.round(cols * cell * dpr);
    canvas.height = Math.round(rows * cell * dpr);
  }

  const centre = (c) => [(colOf(game.s.maze, c) + 0.5) * cell, (rowOf(game.s.maze, c) + 0.5) * cell];
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

  function draw() {
    if (!game) return;
    const s = game.s;
    const reduced = reducedMotion();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s.cols * cell, s.rows * cell);
    if (fx.shake && !reduced) ctx.translate(Math.sin(clock * 60) * cell * 0.04 * fx.shake, 0);
    drawGarden(ctx, s.maze, cell);
    const target = targetTile(s);
    const glow = helpOn(s) ? (reduced ? 0 : clock) : null;
    for (const tile of s.tiles) {
      const [x, y] = centre(tile.cell);
      drawStone(ctx, x, y, cell, tile.value, tile === target ? glow : null);
    }
    const crowF = Math.min(1, game.crowAcc / (crowStep() * 0.4));
    s.crows.forEach((c, k) => {
      const flight = !reduced && game.flights.find((x) => x.k === k);
      if (flight) {
        // fluttering: up from where it was, an arc over the garden, down where it lands (or off
        // the top of the garden when it has to wait outside for a while)
        const sky = (at) => [centre(at)[0], -cell];
        const a = flight.from >= 0 ? centre(flight.from) : sky(flight.to);
        const b = flight.to >= 0 ? centre(flight.to) : sky(flight.from);
        const f = Math.min(1, flight.t / FLY_S);
        const [x, y] = lerp(a, b, f);
        drawCrow(ctx, x, y - Math.sin(f * Math.PI) * cell * 0.9, cell, b[0] < a[0] ? 'left' : 'right', 0, clock);
        return;
      }
      if (c.cell < 0) return; // out of the garden for a while
      const from = game.prevCrows[k];
      const near = from !== undefined && from >= 0 && exits(s.maze, from).some((d) => beside(s.maze, from, d) === c.cell);
      const f = reduced || !near || !s.started ? 1 : crowF;
      const [x, y] = near ? lerp(centre(from), centre(c.cell), f) : centre(c.cell);
      drawCrow(ctx, x, y, cell, c.face, f < 1 ? f : 0);
    });
    const walkF = game.walk && !reduced ? Math.min(1, game.hogAcc / HOG_STEP) : 1;
    let [hx, hy] = centre(s.hog);
    if (game.walk && !reduced) {
      // between this cell and the next one on the way
      const next = beside(s.maze, s.hog, game.walk);
      const tile = next >= 0 ? tileAt(s, next) : null;
      if (next >= 0 && isOpen(s.maze, s.hog, game.walk) && (!tile || tile === target) && crowAt(s, next) < 0) [hx, hy] = lerp(centre(s.hog), centre(next), walkF * 0.999);
    }
    if (fx.bump && fx.bumpDir && !reduced) {
      const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[fx.bumpDir];
      const k = Math.sin(fx.bump * Math.PI) * cell * 0.22;
      hx += dx * k;
      hy += dy * k;
    }
    drawHog(ctx, hx, hy, cell, s.face, { walk: game.walk ? walkF : 0, curl: game.curl > 0 && !game.walk ? 1 : 0 });
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.min(1, p.life / 0.2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- input ----------

  for (const b of document.querySelectorAll('#doolhof-pad [data-dir]')) {
    b.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${ARROW}</svg>`);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      steer(b.dataset.dir);
    });
    b.addEventListener('click', (e) => {
      if (e.detail === 0) steer(b.dataset.dir); // a keyboard press on the button (a tap was handled on pointerdown)
    });
  }

  const dirOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  let swipe = null;
  const board = $('#doolhof-board');
  board.addEventListener('pointerdown', (e) => {
    swipe = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false };
    board.setPointerCapture?.(e.pointerId);
  });
  board.addEventListener('pointermove', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
    steer(dirOf(dx, dy));
    swipe = { ...swipe, x: e.clientX, y: e.clientY, moved: true }; // a longer swipe can turn again
  });
  board.addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const sw = swipe;
    swipe = null;
    if (sw.moved || !game) return;
    const mx = e.clientX - sw.x0;
    const my = e.clientY - sw.y0;
    if (Math.max(Math.abs(mx), Math.abs(my)) >= FLICK) {
      steer(dirOf(mx, my));
      return;
    }
    // a tap: walk towards where the child tapped, seen from the hedgehog
    const rect = canvas.getBoundingClientRect();
    const [x, y] = centre(game.s.hog);
    const dx = e.clientX - (rect.left + x);
    const dy = e.clientY - (rect.top + y);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * 0.5) return;
    const first = dirOf(dx, dy);
    // the main way is a hedge: try the other axis towards the tap
    const other = Math.abs(dx) > Math.abs(dy) ? (dy > 0 ? 'down' : 'up') : dx > 0 ? 'right' : 'left';
    steer(isOpen(game.s.maze, game.s.hog, first) || !isOpen(game.s.maze, game.s.hog, other) ? first : other);
  });
  board.addEventListener('pointercancel', () => (swipe = null));

  document.addEventListener('keydown', (e) => {
    if (!game || !onScreen('doolhof')) return;
    if ((e.key === ' ' || e.key === 'Enter') && e.target?.closest?.('#doolhof-pad')) return;
    if (KEYS[e.key]) {
      e.preventDefault();
      steer(KEYS[e.key]);
    }
  });

  $('#doolhof-back').addEventListener('click', () => {
    tap();
    leave();
  });

  return {
    async init() {
      return true;
    },
    open() {
      menuMode = null;
      shell.show('doolhof-menu');
    },
    leave,
    menuBack,
    testHook() {
      const snap = () => {
        if (!game) return null;
        const s = game.s;
        return {
          mode: s.mode,
          tier: s.tier,
          lang: s.lang,
          roundId: game.roundId,
          cols: s.cols,
          rows: s.rows,
          i: s.i,
          total: s.seq.length,
          seq: [...s.seq],
          expected: expected(s),
          hog: s.hog,
          tiles: s.tiles.map((x) => ({ cell: x.cell, value: x.value })),
          crows: s.crows.map((c) => c.cell),
          mistakes: s.mistakes,
          touches: s.touches,
          surprised: game.curl > 0,
          flying: game.flights.length,
          started: s.started,
          walking: !!game.walk,
          over: s.over,
          done: game.done,
          cell,
          glyph: glyphPx(cell, 'a'),
          looping: !!raf,
        };
      };
      return {
        state: snap,
        start: (id) => startRound(id),
        menu: (mode) => ((menuMode = mode || null), renderMenu()),
        random: (mode, tier, seed) => playRandom(mode, tier, seed),
        autopilot: () => (game ? pathDirection(game.s) : null),
        steer: (dir) => steer(dir),
        freeze: (on) => {
          frozen = !!on;
          if (!frozen) startLoop();
        },
        stars: () => stars(),
        /** Move a crow next to the hedgehog (test only); returns the way to walk into it. */
        crowBeside: () => {
          const s = game?.s;
          if (!s || !s.crows.length) return null;
          for (const d of exits(s.maze, s.hog)) {
            const c = beside(s.maze, s.hog, d);
            if (!tileAt(s, c) && crowAt(s, c) < 0) {
              s.crows[0].cell = c;
              game.prevCrows = s.crows.map((x) => x.cell);
              draw();
              return d;
            }
          }
          return null;
        },
        /** Move a wrong tile next to the hedgehog where it fits (test only); returns the way to it. */
        wrongBeside: () => {
          const s = game?.s;
          const wrong = s?.tiles.find((x) => x.value !== expected(s));
          if (!wrong) return null;
          const from = wrong.cell;
          for (const d of exits(s.maze, s.hog)) {
            const c = beside(s.maze, s.hog, d);
            if (tileAt(s, c) || crowAt(s, c) >= 0) continue;
            wrong.cell = -1;
            if (placementOk(s, c)) {
              wrong.cell = c;
              draw();
              return d;
            }
            wrong.cell = from;
          }
          return null;
        },
      };
    },
  };
}
