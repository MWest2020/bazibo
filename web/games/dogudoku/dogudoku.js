// Dogudoku: hide the puppies. A Queens / Star Battle puzzle for children: one puppy per row, per
// column and (from 5×5) per colour, and puppies never touch, not even diagonally (every size). The rules
// live in rules.js, the pictures in art.js; the shell (web/js/main.js) owns the overlay card, the
// sound settings and the purchase, and passes them in as `shell`.
import { meta } from './meta.js';
import { conflicts, isSolved, attacked, nextHint, starsFor, regionGrid, bushSet, rulesOf } from './rules.js';
import { dogSvg, bushSvg, crossSvg, REGIONS, GARDEN, regionBackground } from './art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';

export const AGE = Object.freeze({ 4: 3, 5: 5, 6: 7, 7: 8, 8: 9 }); // board size -> from what age
export const HINTS = Object.freeze({ tiny: Infinity, small: 3, full: 2 }); // hints per puzzle

// Small pictures for the rule chips under the board.
const RULE_ART = {
  row: '<rect x="2" y="9" width="20" height="6" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="12" r="2.2" fill="currentColor"/>',
  col: '<rect x="9" y="2" width="6" height="20" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="2.2" fill="currentColor"/>',
  region: '<path d="M3 5h10v5h8v9H3z" fill="#ffd8a6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8" cy="12" r="2.4" fill="currentColor"/>',
  touch: '<circle cx="8" cy="9" r="3" fill="currentColor"/><circle cx="16" cy="15" r="3" fill="currentColor"/><path d="M4 20 20 4" stroke="#e5484d" stroke-width="2.2" stroke-linecap="round"/>',
  bush: '<circle cx="8" cy="14" r="5" fill="#57a85a"/><circle cx="16" cy="14" r="5" fill="#57a85a"/><circle cx="12" cy="9" r="6" fill="#68b968"/>',
};

export function createDogudoku(shell) {
  const { t, tap } = shell;
  // { stars: { id: 1-3 } }, read from the save each time (a kept copy could be older than the save)
  let progress = store.loadProgress(meta.id);
  const refresh = () => (progress = store.loadProgress(meta.id));
  // options are read from the save when used (a kept copy could be older than the save, after a
  // failed read that a later read recovered)
  const autoOn = () => store.loadGameOption(meta.id, 'autoCross', false) === true;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  let plays = 0; // counts boards opened, so a late win card never lands on a newer board
  let puzzles = [];
  let loadFailed = false;
  let current = null; // the puzzle on the board
  let marks = new Map(); // 'r,c' -> 'dog' | 'cross'
  let hintsUsed = 0;
  let solved = false;
  const boards = new Map(); // unfinished boards of this session, so leaving a puzzle loses nothing
  let cells = []; // the buttons, row by row
  let flash = null; // the last hint's cell, highlighted for a moment

  const locked = (p) => !p.free && !shell.unlock.owned;
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const key = (r, c) => `${r},${c}`;
  const dogs = () => [...marks].filter(([, v]) => v === 'dog').map(([k]) => k.split(',').map(Number));

  shell.unlock.onChange(() => {
    if (onScreen('dogudoku-levels')) renderLevels();
  });
  shell.onShow((name) => {
    if (name === 'dogudoku-levels') renderLevels();
    if (name === 'dogudoku') requestAnimationFrame(fitBoard);
  });
  shell.onLangChange(() => {
    if (onScreen('dogudoku-levels')) renderLevels();
    if (current) {
      renderHud();
      renderRules();
      updateBoard();
    }
  });
  window.addEventListener('resize', () => onScreen('dogudoku') && fitBoard());

  // ---------- puzzle list ----------

  function starsText(n) {
    return [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  }

  function renderLevels() {
    const box = $('#dogu-levels');
    box.textContent = '';
    refresh();
    const sizes = [...new Set(puzzles.map((p) => p.n))];
    const nextOpen = puzzles.find((p) => !progress.stars[p.id] && !locked(p));
    for (const n of sizes) {
      const head = document.createElement('h3');
      head.className = 'dogu-size';
      head.innerHTML = `<span class="dogu-size-n"></span><span class="dogu-size-age"></span>`;
      head.querySelector('.dogu-size-n').textContent = t('dogudoku.size', { n });
      head.querySelector('.dogu-size-age').textContent = t('dogudoku.age', { age: AGE[n] });
      box.appendChild(head);
      const grid = document.createElement('div');
      grid.className = 'level-grid dogu-grid';
      for (const p of puzzles.filter((q) => q.n === n)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'level-btn';
        b.dataset.puzzle = String(p.id);
        if (locked(p)) {
          b.classList.add('locked');
          b.innerHTML = `<span class="num">${p.id}</span><svg viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
          b.setAttribute('aria-label', t('dogudoku.puzzleLocked', { n: p.id }));
          b.addEventListener('click', () => {
            tap();
            offer();
          });
        } else {
          const stars = progress.stars[p.id] || 0;
          if (nextOpen && nextOpen.id === p.id) b.classList.add('next');
          b.innerHTML = `<span class="num">${p.id}</span><span class="stars" aria-hidden="true">${starsText(stars)}</span>`;
          b.setAttribute('aria-label', stars ? t('dogudoku.puzzleStars', { n: p.id, stars }) : t('dogudoku.puzzleOpen', { n: p.id }));
          b.addEventListener('click', () => {
            tap();
            play(p.id);
          });
        }
        grid.appendChild(b);
      }
      box.appendChild(grid);
    }
  }

  /** The app-wide offer, with a line about what it opens here. */
  function offer() {
    shell.offerUnlock(t('dogudoku.lockedLead', { free: puzzles.filter((p) => p.free).length || meta.free, total: puzzles.length || 60 }));
  }

  // ---------- playing ----------

  function play(id) {
    const p = puzzles.find((q) => q.id === id);
    if (!p) return;
    if (locked(p)) {
      offer();
      return;
    }
    if (current && !solved) boards.set(current.id, { marks, hintsUsed });
    plays++;
    current = p;
    const kept = boards.get(p.id);
    marks = kept ? new Map(kept.marks) : new Map();
    hintsUsed = kept ? kept.hintsUsed : 0;
    solved = false;
    flash = null;
    buildBoard();
    renderHud();
    renderRules();
    updateBoard();
    shell.show('dogudoku');
    if (!seenHow()[p.tier]) showHow();
  }

  function showHow() {
    store.saveGameOption(meta.id, 'howSeen', { ...seenHow(), [current.tier]: true });
    const text = current.tier === 'tiny' ? t('dogudoku.howTiny') : t('dogudoku.how');
    shell.showOverlay({ art: dogSvg(3, { cls: 'ov-dog' }), title: t('dogudoku.howTitle'), text, buttons: [[t('common.ok'), 'big primary', shell.hideOverlay]] });
  }

  function buildBoard() {
    const board = $('#dogu-board');
    const { n } = current;
    const regions = regionGrid(current);
    const bushes = bushSet(current);
    board.textContent = '';
    board.style.setProperty('--n', String(n));
    board.classList.toggle('tiny', current.tier === 'tiny');
    board.classList.remove('won');
    cells = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dcell';
        b.dataset.r = String(r);
        b.dataset.c = String(c);
        const region = regions ? REGIONS[regions[r][c] % REGIONS.length] : GARDEN;
        b.style.background = regionBackground(region);
        if (regions) {
          const id = regions[r][c];
          // a thick line on the right/bottom where the next square is another colour (the board's
          // own border draws the outside)
          if (c < n - 1 && regions[r][c + 1] !== id) b.classList.add('er');
          if (r < n - 1 && regions[r + 1][c] !== id) b.classList.add('eb');
        }
        if (bushes.has(r * n + c)) {
          b.classList.add('bush');
          b.innerHTML = bushSvg();
        }
        b.style.setProperty('--i', String(r + c)); // stagger for the happy bounce
        board.appendChild(b);
        row.push(b);
      }
      cells.push(row);
    }
  }

  /** Breed per cell: by colour region, or by row on the youngest boards. */
  function breedAt(r, c) {
    const regions = regionGrid(current);
    return regions ? regions[r][c] : r;
  }

  function updateBoard() {
    if (!current) return;
    const { n } = current;
    const placed = dogs();
    const bad = conflicts(current, placed);
    const badCells = new Set(bad.flatMap((x) => x.cells.map(([r, c]) => key(r, c))));
    const sure = placed.filter(([r, c]) => !badCells.has(key(r, c)));
    const autoCross = autoOn();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const b = cells[r][c];
        if (b.classList.contains('bush')) {
          b.setAttribute('aria-label', t('dogudoku.cellBush', { r: r + 1, c: c + 1 }));
          continue;
        }
        const m = marks.get(key(r, c));
        const ruled = !m && autoCross && current.tier !== 'tiny' && attacked(current, sure, r, c);
        const want = m === 'dog' ? `dog${breedAt(r, c)}` : m === 'cross' ? 'cross' : ruled ? 'ruled' : '';
        if (b.dataset.show !== want) {
          b.dataset.show = want;
          b.innerHTML = m === 'dog' ? dogSvg(breedAt(r, c)) : m === 'cross' ? crossSvg() : ruled ? crossSvg('auto') : '';
        }
        b.classList.toggle('bad', badCells.has(key(r, c)));
        b.classList.toggle('hinted', flash === key(r, c));
        const label = m === 'dog' ? 'dogudoku.cellDog' : m === 'cross' ? 'dogudoku.cellCross' : 'dogudoku.cellEmpty';
        b.setAttribute('aria-label', t(label, { r: r + 1, c: c + 1 }));
      }
    }
    // the first broken rule lights up under the board, with a short line
    const first = bad[0]?.rule || '';
    for (const chip of document.querySelectorAll('#dogu-rules .rule')) chip.classList.toggle('oops', chip.dataset.rule === first);
    $('#dogu-status').textContent = first ? t(`dogudoku.oops.${first}`) : '';
    renderHint();
  }

  /** One tap: the youngest boards toggle a puppy; the others cycle empty -> cross -> puppy -> empty. */
  function cycle(r, c) {
    if (solved) return;
    const b = cells[r][c];
    if (b.classList.contains('bush')) {
      wiggle(b);
      flashRule('bush');
      return;
    }
    const k = key(r, c);
    const m = marks.get(k);
    let next;
    if (current.tier === 'tiny') next = m === 'dog' ? null : 'dog';
    else next = !m ? 'cross' : m === 'cross' ? 'dog' : null;
    set(r, c, next);
    if (next === 'dog') sfx.yip();
    else sfx.click();
    afterChange();
  }

  function set(r, c, v) {
    if (v) marks.set(key(r, c), v);
    else marks.delete(key(r, c));
  }

  function afterChange() {
    flash = null;
    updateBoard();
    if (isSolved(current, dogs())) win();
  }

  function wiggle(el) {
    el.classList.remove('wiggle');
    void el.offsetWidth; // restart the animation
    el.classList.add('wiggle');
  }

  function flashRule(rule) {
    const chip = document.querySelector(`#dogu-rules .rule[data-rule="${rule}"]`);
    if (chip) wiggle(chip);
    $('#dogu-status').textContent = t(`dogudoku.oops.${rule}`);
  }

  // ---------- pointer: tap to cycle, drag over empty squares to cross them ----------

  let press = null; // { r, c, dragging, id }
  const board = $('#dogu-board');
  const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.dcell');

  board.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.dcell');
    if (!cell || !current) return;
    press = { r: +cell.dataset.r, c: +cell.dataset.c, dragging: false, id: e.pointerId };
    sfx.unlock();
  });
  board.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id || current.tier === 'tiny' || solved) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (!cell) return;
    const r = +cell.dataset.r;
    const c = +cell.dataset.c;
    if (!press.dragging && (r !== press.r || c !== press.c)) {
      press.dragging = true;
      crossIfEmpty(press.r, press.c);
    }
    if (press.dragging) crossIfEmpty(r, c);
  });
  const release = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = null;
    if (e.type === 'pointerup' && !p.dragging) cycle(p.r, p.c);
    else if (p.dragging) afterChange();
  };
  board.addEventListener('pointerup', release);
  board.addEventListener('pointercancel', release);
  // keyboard (Enter/Space on a focused square) gives a click with detail 0; pointer clicks are handled above
  board.addEventListener('click', (e) => {
    const cell = e.target.closest('.dcell');
    if (cell && e.detail === 0) cycle(+cell.dataset.r, +cell.dataset.c);
  });

  function crossIfEmpty(r, c) {
    if (cells[r][c].classList.contains('bush') || marks.has(key(r, c))) return;
    marks.set(key(r, c), 'cross');
    updateBoard();
  }

  // ---------- hints ----------

  const hintLimit = () => HINTS[current?.tier] ?? 2;

  function renderHint() {
    const b = $('#dogu-hint');
    if (!current) return;
    const left = hintLimit() - hintsUsed;
    const unlimited = !Number.isFinite(hintLimit());
    b.querySelector('.count').textContent = unlimited ? '' : String(Math.max(0, left));
    b.classList.toggle('empty', !unlimited && left <= 0);
    b.setAttribute('aria-label', unlimited ? t('dogudoku.hintsUnlimited') : t('dogudoku.hintsLeft', { n: Math.max(0, left) }));
  }

  function hint() {
    if (!current || solved) return;
    if (hintsUsed >= hintLimit()) {
      $('#dogu-status').textContent = t('dogudoku.noHints');
      wiggle($('#dogu-hint'));
      return;
    }
    const h = nextHint(current, marks, { autoCross: autoOn() });
    if (!h) return;
    hintsUsed++;
    set(h.r, h.c, h.to === 'empty' ? null : h.to);
    updateBoard();
    flash = key(h.r, h.c);
    updateBoard();
    if (h.to === 'dog') sfx.yip();
    if (isSolved(current, dogs())) win();
    else
      setTimeout(() => {
        if (flash === key(h.r, h.c)) {
          flash = null;
          updateBoard();
        }
      }, 1800);
  }

  $('#dogu-hint').addEventListener('click', () => {
    tap();
    hint();
  });

  // ---------- auto-cross ----------

  function renderAuto() {
    const b = $('#dogu-auto');
    b.hidden = !current || current.tier === 'tiny';
    b.setAttribute('aria-pressed', String(autoOn()));
  }
  $('#dogu-auto').addEventListener('click', () => {
    tap();
    store.saveGameOption(meta.id, 'autoCross', !autoOn());
    renderAuto();
    updateBoard();
  });

  // ---------- HUD and rules ----------

  function renderHud() {
    $('#dogu-title').textContent = t('dogudoku.puzzle', { n: current.id });
    $('#dogu-sub').textContent = t('dogudoku.size', { n: current.n });
    renderAuto();
    renderHint();
  }

  function renderRules() {
    const rules = rulesOf(current);
    const list = ['row', 'col'];
    if (rules.regions) list.push('region');
    if (rules.touch) list.push('touch');
    if (current.tier === 'tiny') list.push('bush');
    const box = $('#dogu-rules');
    box.textContent = '';
    box.classList.toggle('pictures', current.tier === 'tiny');
    for (const r of list) {
      const chip = document.createElement('li');
      chip.className = 'rule';
      chip.dataset.rule = r;
      chip.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${RULE_ART[r]}</svg><span></span>`;
      chip.querySelector('span').textContent = t(`dogudoku.rule.${r}`);
      box.appendChild(chip);
    }
  }

  /** The board as large as fits: square, between the HUD and the rule chips. */
  function fitBoard() {
    const stage = $('#dogu-stage');
    const rules = $('#dogu-rules');
    const side = window.innerWidth > window.innerHeight * 1.2; // sideways phone: rules beside the board
    stage.classList.toggle('side', side);
    const w = stage.clientWidth - 24 - (side ? rules.offsetWidth + 16 : 0);
    const h = stage.clientHeight - 16 - (side ? 0 : rules.offsetHeight + $('#dogu-status').offsetHeight + 16);
    const size = Math.max(160, Math.floor(Math.min(w, h, 640)));
    board.style.width = `${size}px`;
    board.style.height = `${size}px`;
  }

  // ---------- winning ----------

  function win() {
    solved = true;
    boards.delete(current.id);
    const stars = starsFor(hintsUsed);
    store.recordStars(meta.id, current.id, stars);
    refresh();
    $('#dogu-status').textContent = '';
    board.classList.add('won');
    sfx.woof();
    const done = current;
    const token = plays;
    setTimeout(() => {
      if (token !== plays || !solved || current !== done || !onScreen('dogudoku')) return;
      showWinCard(done, stars);
    }, 1400);
  }

  function showWinCard(done, stars) {
    const nextAny = puzzles[puzzles.indexOf(done) + 1];
    const sameSize = nextAny && nextAny.n === done.n; // "Next" never jumps to a bigger board
    const buttons = [];
    let text = t('dogudoku.winText');
    if (sameSize && !locked(nextAny)) {
      buttons.push([t('dogudoku.next'), 'big primary', () => play(nextAny.id)]);
    } else if (sameSize) {
      // the next one of this size is in the full version
      text = `${t('dogudoku.winText')} ${t('dogudoku.lastFree')}`;
      buttons.push([t('dogudoku.more'), 'big primary', offer]);
    }
    buttons.push([t('dogudoku.puzzles'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('dogudoku-levels')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < stars ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`dogudoku.win${stars}`),
      text,
      buttons,
    });
  }

  $('#dogu-back').addEventListener('click', () => {
    tap();
    leave();
  });

  function leave() {
    if (current && !solved) boards.set(current.id, { marks: new Map(marks), hintsUsed });
    shell.show('dogudoku-levels');
  }

  return {
    open() {
      if (loadFailed) {
        shell.showOverlay({ title: t('error.title'), text: t('dogudoku.loadError'), buttons: [[t('error.retry'), 'big primary', () => location.reload()]] });
        return;
      }
      shell.show('dogudoku-levels');
    },
    leave,
    /** Load the puzzles; false if that failed (the tile then explains). */
    async init() {
      try {
        const res = await fetch(new URL('./puzzles.json', import.meta.url));
        if (!res.ok) throw new Error(`puzzles.json: HTTP ${res.status}`);
        puzzles = await res.json();
        return true;
      } catch (err) {
        console.error(err);
        loadFailed = true;
        return false;
      }
    },
    testHook() {
      return {
        play: (id) => play(id),
        puzzle: () => (current ? { id: current.id, n: current.n, tier: current.tier, solution: current.solution.slice() } : null),
        state: () => ({ solved, hintsUsed, marks: Object.fromEntries(marks), status: $('#dogu-status').textContent }),
        hint: () => hint(),
        tapCell: (r, c) => cycle(r, c),
        count: () => puzzles.length,
        free: () => puzzles.filter((p) => p.free).map((p) => p.id),
      };
    },
  };
}
