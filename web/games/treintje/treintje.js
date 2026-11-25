// Treintje (Train Tracks): lay one railway through every square of a grid, starting on station 1
// and passing the stations in order; then the little train rides it to the last station. Only
// random puzzles, made on the device per age (generate.js, in the shell's worker when it can); the
// rules and what a finger means are pure (rules.js), the drawings in art.js. No timers and nothing
// is ever "wrong": a step that is not allowed just does not happen (a short line says why). No
// voice; the sounds are the shell's (plink at a station, chime at the end).
//
// Saved (games.treintje): puzzles solved per age (`random`, through recordRandomSolved), the how-to
// cards seen (`howSeen`) and the last age (`lastAge`). The puzzle in hand is kept while the app
// stays open ("keep playing").
import { meta } from './meta.js';
import { AGES, AGE_IDS, makePuzzle } from './generate.js';
import { startPath, nextStation, stationCount, cellCount, isSolved, pressAt, dragAlong, cellsOnMove, whyNot, step, route, routeLength, pointAt } from './rules.js';
import { U, groundSvg, fenceSvg, trackSvg, stationsSvg, headSvg, TRAIN, TRAIN_GAP, trainSvg, ageArt } from './art.js';
import * as store from '../../js/storage.js';
import { newSeed, generate, makeRandom } from '../../js/random.js';
import * as sfx from '../../js/audio.js';
import { foldLocked } from '../../js/fold.js';
import { menuHead, optionCard } from '../../js/menu.js';

const $ = (sel) => document.querySelector(sel);
const MIN_CELL = 44; // px: every square stays a big enough target
const MAX_CELL = 88;
const HINT_MS = 1800;
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createTreintje(shell) {
  const { t, tap } = shell;
  const solved = () => store.loadRandomSolved(meta.id);
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  const lastAge = () => {
    const v = store.loadGameOption(meta.id, 'lastAge', 'a3');
    return AGE_IDS.includes(v) ? v : 'a3';
  };
  const locked = (age) => meta.isLocked({ age }, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;

  // { age, p (the puzzle), path, done, n (its number in the HUD) }
  let game = null;
  let plays = 0; // counts puzzles asked for, so a late answer never replaces a newer puzzle
  let drag = null; // { id, grabbed, x, y } in board units
  let cell = MIN_CELL; // px per square
  let hintTimer = null;
  let ride = null; // the train riding: { raf, t0, ms, s, arrived }
  const prefetch = {}; // age -> { promise, value }: the next puzzle, made while this one is played

  shell.unlock.onChange(() => {
    if (onScreen('treintje-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'treintje-menu') renderMenu();
    if (name !== 'treintje') {
      stopRide();
      drag = null;
    } else layout();
  });
  shell.onLangChange(() => {
    if (onScreen('treintje-menu')) renderMenu();
    if (game) renderTexts();
  });
  globalThis.addEventListener?.('resize', () => {
    if (game && onScreen('treintje')) layout();
  });

  // ---------- menu ----------

  function renderMenu() {
    const box = $('#treintje-menu');
    box.textContent = '';
    if (game && !game.done) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'treintje-continue';
      cont.className = 'btn big secondary menu-continue';
      cont.textContent = t('treintje.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      box.appendChild(cont);
    }
    box.appendChild(menuHead(t('treintje.pick')));
    const row = document.createElement('div');
    row.className = 'option-row';
    const done = solved();
    const last = lastAge();
    for (const age of AGE_IDS) {
      const isLocked = locked(age);
      const n = done[age] || 0;
      const card = optionCard({
        art: ageArt(age),
        title: t(`treintje.age.${age}`),
        sub: t(`treintje.sub.${age}`),
        age: !isLocked && n ? t('treintje.solved', { n }) : '',
        locked: isLocked,
        cls: `wide tj-age${!isLocked && age === last ? ' lead' : ''}`,
        label: isLocked ? t('treintje.lockedAria', { age: t(`treintje.age.${age}`) }) : t('treintje.cardAria', { age: t(`treintje.age.${age}`), sub: t(`treintje.sub.${age}`), n }),
      });
      card.dataset.age = age;
      card.addEventListener('click', () => {
        tap();
        if (locked(age)) shell.offerUnlock(t('treintje.lockedLead'));
        else newPuzzle(age);
      });
      row.appendChild(card);
    }
    box.appendChild(row);
    foldLocked(box);
  }

  $('#treintje-menu-back').addEventListener('click', () => {
    tap();
    shell.show('home');
  });

  // ---------- puzzles ----------

  function want(age) {
    const job = { value: null, promise: null };
    job.promise = generate(meta.id, 'makePuzzle', [age, newSeed()]).then((v) => (job.value = v));
    job.promise.catch(() => {});
    prefetch[age] = job;
  }

  /** A new puzzle for this age: the one made ahead when it is ready, else made now (with the
   *  shell's "making a puzzle" card while it takes). */
  async function newPuzzle(age) {
    if (!AGES[age]) return;
    if (locked(age)) {
      shell.offerUnlock(t('treintje.lockedLead'));
      return;
    }
    const token = ++plays;
    const job = prefetch[age];
    prefetch[age] = null;
    let p = job?.value || null;
    if (!p) {
      p = await makeRandom(shell, meta.id, 'makePuzzle', [age, newSeed()], { ready: job?.promise || null, stillWanted: () => token === plays });
      if (!p || token !== plays) return;
    }
    begin(age, p);
    want(age);
  }

  function clearHint() {
    clearTimeout(hintTimer);
    hintTimer = null;
    $('#tj-status').classList.remove('why');
  }

  function begin(age, p) {
    plays++;
    stopRide();
    clearHint(); // a hint from the puzzle before never stays on a new one
    if (store.loadGameOption(meta.id, 'lastAge', null) !== age) store.saveGameOption(meta.id, 'lastAge', age);
    game = { age, p, path: startPath(p), done: false, n: (solved()[age] || 0) + 1 };
    drag = null;
    shell.show('treintje');
    drawBase();
    render();
    layout();
    if (!seenHow()[age]) {
      shell.showOverlay({
        art: `<span class="tj-ov">${trainSvg()}</span>`,
        title: t('treintje.howTitle'),
        text: t(`treintje.how.${age}`),
        buttons: [
          [
            t('common.ok'),
            'big primary',
            () => {
              store.saveGameOption(meta.id, 'howSeen', { ...seenHow(), [age]: true });
              shell.hideOverlay();
            },
          ],
        ],
      });
    }
  }

  function resume() {
    if (!game || game.done) return;
    shell.show('treintje');
    render();
  }

  /** Android back and the menu button: to the menu, the puzzle is kept ("keep playing"). */
  function leave() {
    stopRide();
    drag = null;
    shell.hideOverlay();
    shell.show('treintje-menu');
  }
  $('#treintje-back').addEventListener('click', () => {
    tap();
    leave();
  });
  $('#treintje-new').addEventListener('click', () => {
    tap();
    if (game) newPuzzle(game.age);
  });

  // ---------- drawing ----------

  const svg = () => $('#tj-board');

  function drawBase() {
    const { p } = game;
    svg().setAttribute('viewBox', `0 0 ${p.w * U} ${p.h * U}`);
    let s = groundSvg(p.w, p.h);
    for (const [a, b] of p.walls) s += fenceSvg(p.w, a, b);
    $('#tj-base').innerHTML = s;
    $('#tj-train').innerHTML = '';
  }

  function render() {
    if (!game) return;
    const { p, path } = game;
    $('#tj-track').innerHTML = trackSvg(p.w, path);
    const next = game.done ? 0 : nextStation(p, path);
    $('#tj-stations').innerHTML = stationsSvg(p, path, next);
    $('#tj-headmark').innerHTML = game.done ? '' : headSvg(p.w, path[path.length - 1]);
    $('#screen-treintje').dataset.age = game.age;
    renderTexts();
  }

  function renderTexts() {
    if (!game) return;
    const { p, path } = game;
    $('#tj-sub').textContent = t(`treintje.age.${game.age}`);
    $('#tj-title').textContent = t('treintje.title', { n: game.n });
    $('#tj-count').textContent = t('treintje.count', { done: path.length, total: cellCount(p) });
    svg().setAttribute('aria-label', t('treintje.board'));
    if (!hintTimer) setStatus(leadText());
  }

  function leadText() {
    const { p, path } = game;
    if (game.done) return t('treintje.ride');
    const next = nextStation(p, path);
    return next === stationCount(p) ? t('treintje.leadLast') : t('treintje.lead', { n: next });
  }

  function setStatus(text) {
    $('#tj-status').textContent = text;
  }

  /** A short line about why a step did not happen, then back to what to do. */
  function hint(why) {
    if (!why || why === 'far' || why === 'done' || !game || game.done) return;
    const text = why === 'order' ? t('treintje.why.order', { n: nextStation(game.p, game.path) }) : t(`treintje.why.${why}`);
    setStatus(text);
    $('#tj-status').classList.add('why');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hintTimer = null;
      $('#tj-status').classList.remove('why');
      if (game) setStatus(leadText());
    }, HINT_MS);
  }

  /** The board as big as fits beside or under its line of help (each square MIN_CELL to MAX_CELL px). */
  function layout() {
    if (!game) return;
    const stage = $('#tj-stage');
    const side = $('#tj-stage .tj-side');
    const cs = getComputedStyle(stage);
    const gap = parseFloat(cs.columnGap || cs.gap) || 0;
    let w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (cs.flexDirection.startsWith('row')) w -= side.offsetWidth + gap;
    else h -= side.offsetHeight + gap;
    if (w <= 0 || h <= 0) return;
    const { p } = game;
    cell = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(Math.min(w / p.w, h / p.h))));
    svg().style.width = `${cell * p.w}px`;
    svg().style.height = `${cell * p.h}px`;
  }

  // ---------- the finger ----------

  function toBoard(e) {
    const r = svg().getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * game.p.w, ((e.clientY - r.top) / r.height) * game.p.h];
  }

  const playing = () => game && !game.done && onScreen('treintje') && !overlayUp();

  function setPath(path) {
    if (path === game.path) return;
    const before = nextStation(game.p, game.path);
    game.path = path;
    const after = nextStation(game.p, path);
    if (after !== before && (after > before || after === 0)) sfx.plink(0.7);
    render();
    if (isSolved(game.p, path)) finish();
  }

  const board = $('#tj-board');
  board.addEventListener('pointerdown', (e) => {
    if (!playing() || (drag && drag.id !== e.pointerId)) return;
    e.preventDefault();
    sfx.unlock();
    board.setPointerCapture?.(e.pointerId);
    const [x, y] = toBoard(e);
    const { p } = game;
    const j = x >= 0 && y >= 0 && x < p.w && y < p.h ? Math.floor(y) * p.w + Math.floor(x) : -1;
    const r = pressAt(p, game.path, j);
    drag = { id: e.pointerId, grabbed: r.grabbed, x, y };
    setPath(r.path);
    hint(r.why);
  });
  board.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId || !playing()) return;
    e.preventDefault();
    const [x, y] = toBoard(e);
    let cells = cellsOnMove(game.p.w, game.p.h, drag.x, drag.y, x, y);
    drag.x = x;
    drag.y = y;
    if (!drag.grabbed) {
      // the drag starts once the finger reaches the end of the track
      const k = cells.indexOf(game.path[game.path.length - 1]);
      if (k < 0) return;
      drag.grabbed = true;
      cells = cells.slice(k + 1);
    }
    const r = dragAlong(game.p, game.path, cells);
    // the path first: a hint names the next station after the squares this move did lay
    setPath(r.path);
    hint(r.why);
  });
  const lift = (e) => {
    if (drag && drag.id === e.pointerId) drag = null;
  };
  board.addEventListener('pointerup', lift);
  board.addEventListener('pointercancel', lift);

  // the keyboard: the arrows lay track from the end (or take the last piece back), Backspace takes back
  document.addEventListener('keydown', (e) => {
    if (!playing()) return;
    const { p, path } = game;
    const end = path[path.length - 1];
    const go = { ArrowUp: end - p.w, ArrowDown: end + p.w, ArrowLeft: end % p.w ? end - 1 : -1, ArrowRight: (end + 1) % p.w ? end + 1 : -1 }[e.key];
    if (go !== undefined) {
      e.preventDefault();
      if (path.length > 1 && go === path[path.length - 2]) setPath(path.slice(0, -1));
      else {
        const why = whyNot(p, path, go);
        setPath(step(p, path, go));
        hint(why);
      }
    } else if (e.key === 'Backspace' && path.length > 1) {
      e.preventDefault();
      setPath(path.slice(0, -1));
    }
  });

  // ---------- the end: the little train rides ----------

  function finish() {
    game.done = true;
    drag = null;
    clearHint();
    const n = store.recordRandomSolved(meta.id, game.age);
    game.solvedCount = n;
    render();
    sfx.chime();
    startRide(() => winCard(n));
  }

  function startRide(then) {
    stopRide();
    const { p, path } = game;
    const segs = route(p.w, path);
    const len = routeLength(segs);
    const ms = reduced() ? 0 : Math.max(2200, Math.min(5200, path.length * 110));
    $('#tj-train').innerHTML = TRAIN.map((part) => `<g class="tj-car">${part}</g>`).join('');
    const cars = [...$('#tj-train').children];
    const flip = cars.map(() => 1);
    const token = plays;
    const place = (s) => {
      cars.forEach((car, k) => {
        const d = s - k * TRAIN_GAP;
        const pt = pointAt(segs, Math.max(0, d));
        if (Math.abs(pt.dx) > 0.2) flip[k] = pt.dx < 0 ? -1 : 1;
        car.setAttribute('transform', `translate(${(pt.x * U).toFixed(1)} ${(pt.y * U + 32).toFixed(1)}) scale(${(flip[k] * 0.7).toFixed(2)} 0.7)`);
        car.setAttribute('opacity', d < -0.01 ? '0' : '1');
      });
    };
    ride = { raf: 0, t0: performance.now(), ms, s: 0, arrived: false };
    const frame = (now) => {
      if (!ride || token !== plays) return;
      const f = ms ? Math.min(1, (now - ride.t0) / ms) : 1;
      const eased = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
      ride.s = len * eased;
      place(ride.s);
      if (f < 1) ride.raf = requestAnimationFrame(frame);
      else {
        ride.raf = 0;
        ride.arrived = true;
        $('#tj-board').classList.add('arrived');
        setTimeout(() => {
          if (ride && token === plays && onScreen('treintje')) then();
        }, 650);
      }
    };
    $('#tj-board').classList.remove('arrived');
    place(0);
    ride.raf = requestAnimationFrame(frame);
  }

  function stopRide() {
    if (ride?.raf) cancelAnimationFrame(ride.raf);
    ride = null;
    $('#tj-board').classList.remove('arrived');
  }

  function winCard(n) {
    const age = game.age;
    shell.showOverlay({
      art: `<span class="tj-ov">${trainSvg()}</span>`,
      title: t('treintje.winTitle'),
      text: t('treintje.winText', { n }),
      buttons: [
        [t('treintje.next'), 'big primary', () => (shell.hideOverlay(), newPuzzle(age))],
        [t('treintje.toMenu'), 'big secondary', () => shell.show('treintje-menu')],
      ],
    });
  }

  return {
    async init() {
      return true;
    },
    open() {
      shell.show('treintje-menu');
    },
    leave,
    testHook() {
      return {
        state: () =>
          game && {
            age: game.age,
            w: game.p.w,
            h: game.p.h,
            nums: game.p.nums.slice(),
            walls: game.p.walls.map((x) => x.slice()),
            solution: game.p.solution.slice(),
            seed: game.p.seed,
            path: game.path.slice(),
            done: game.done,
            riding: !!ride && !ride.arrived,
            arrived: !!ride?.arrived,
            cell,
          },
        /** The middle of square i on screen (CSS px), for real drags. */
        at: (i) => {
          const r = svg().getBoundingClientRect();
          const { w, h } = game.p;
          return [r.left + ((i % w) + 0.5) * (r.width / w), r.top + (Math.floor(i / w) + 0.5) * (r.height / h)];
        },
        trainAt: () => {
          const car = $('#tj-train .tj-car');
          if (!car) return null;
          const r = car.getBoundingClientRect();
          return [r.left + r.width / 2, r.top + r.height / 2];
        },
        start: (age, seed) => {
          if (locked(age)) return false;
          plays++;
          begin(age, makePuzzle(age, seed >>> 0));
          return true;
        },
        /** A given puzzle ({ w, h, nums, walls, solution }) as a 3-5 puzzle, for the smoke test. */
        load: (p) => {
          plays++;
          begin('a3', { age: 'a3', seed: 0, walls: [], ...p });
          return true;
        },
        hinting: () => !!hintTimer,
        solved: () => solved(),
      };
    },
  };
}
