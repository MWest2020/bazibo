// Picturedoku: a sudoku with pictures. Every picture goes once in every row, column and box.
// 4×4 for the youngest (pictures only), 6×6 and 9×9 for older children (who may switch to numbers).
// Two ways to play: tap a square, then a picture in the palette; or pick a picture first and tap
// squares with it. The rules live in rules.js, the pictures in art.js; the shell (web/js/main.js)
// owns the overlay card, the sound settings and the purchase, and passes them in as `shell`.
import { meta } from './meta.js';
import { parse, conflicts, candidates, peers, isSolved, nextHint, starsFor, boxOf } from './rules.js';
import { pictureSvg, numberSvg } from './art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';

export const AGE = Object.freeze({ 4: 3, 6: 6, 9: 8 }); // board size -> from what age
export const HINTS = Object.freeze({ tiny: Infinity, small: 3, full: 3 }); // hints per puzzle

// Small pictures for the rule chips under the board.
const RULE_ART = {
  row: '<rect x="2" y="9" width="20" height="6" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="12" r="1.8" fill="#e5484d"/><circle cx="12" cy="12" r="1.8" fill="#ffc531"/><circle cx="17" cy="12" r="1.8" fill="#8e5bd6"/>',
  col: '<rect x="9" y="2" width="6" height="20" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="7" r="1.8" fill="#e5484d"/><circle cx="12" cy="12" r="1.8" fill="#ffc531"/><circle cx="12" cy="17" r="1.8" fill="#8e5bd6"/>',
  box: '<rect x="4" y="4" width="16" height="16" rx="2.5" fill="#fff" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="9" r="1.9" fill="#e5484d"/><circle cx="15" cy="9" r="1.9" fill="#ffc531"/><circle cx="9" cy="15" r="1.9" fill="#8e5bd6"/><circle cx="15" cy="15" r="1.9" fill="#ff8a3d"/>',
};
const PENCIL = '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19z" fill="#ffd23f" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 7l3.5 3.5M4 20l4.5-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
const ERASER = '<path d="M9 20h11M4.6 14.6 13.4 5.8a2 2 0 0 1 2.8 0l3.9 3.9a2 2 0 0 1 0 2.8L12 20H8.6l-4-4a1 1 0 0 1 0-1.4z" fill="#ffb3c7" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><path d="M8.5 10.7l5.8 5.8" stroke="currentColor" stroke-width="1.8"/>';
const UNDO = '<path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';

export function createPicturedoku(shell) {
  const { t, tap } = shell;
  // { stars: { id: 1-3 } }, read from the save each time (a kept copy could be older than the save)
  let progress = store.loadProgress(meta.id);
  const refresh = () => (progress = store.loadProgress(meta.id));
  let numbers = store.loadGameOption(meta.id, 'numbers', false) === true;
  let howSeen = store.loadGameOption(meta.id, 'howSeen', {});
  let puzzles = [];
  let loadFailed = false;
  let current = null; // the puzzle on the board
  let board = []; // n*n: 0 empty, 1..n a picture
  let given = []; // n*n booleans: fixed pictures
  let notes = []; // n*n bitmasks of pencil pictures
  let undo = []; // [[{ i, v, notes }, ...], ...] one entry per action
  let selected = -1; // the chosen square
  let brush = 0; // a picture picked first (1..n), or -1 for the eraser, 0 for none
  let pencil = false;
  let hintsUsed = 0;
  let solved = false;
  let flash = -1; // the last hint's square, highlighted for a moment
  const boards = new Map(); // unfinished boards of this session, so leaving a puzzle loses nothing
  let cells = [];

  const locked = (p) => !p.free && !shell.unlock.owned;
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const asNumbers = () => numbers && current && current.n > 4;
  const art = (v, opts) => (asNumbers() ? numberSvg(v, opts) : pictureSvg(v, opts));
  const picName = (v) => (asNumbers() ? String(v) : t(`pdoku.pic.${v}`));

  shell.unlock.onChange(() => {
    if (onScreen('picturedoku-levels')) renderLevels();
  });
  shell.onShow((name) => {
    if (name === 'picturedoku-levels') renderLevels();
    if (name === 'picturedoku') requestAnimationFrame(fitBoard);
  });
  shell.onLangChange(() => {
    if (onScreen('picturedoku-levels')) renderLevels();
    if (current) {
      renderHud();
      renderRules();
      renderPalette();
      updateBoard();
    }
  });
  window.addEventListener('resize', () => onScreen('picturedoku') && fitBoard());

  // ---------- puzzle list ----------

  function starsText(n) {
    return [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  }

  function renderLevels() {
    const box = $('#pdoku-levels');
    box.textContent = '';
    refresh();
    const sizes = [...new Set(puzzles.map((p) => p.n))];
    const nextOpen = puzzles.find((p) => !progress.stars[p.id] && !locked(p));
    for (const n of sizes) {
      const head = document.createElement('h3');
      head.className = 'dogu-size';
      head.innerHTML = '<span class="dogu-size-n"></span><span class="dogu-size-age"></span>';
      head.querySelector('.dogu-size-n').textContent = t('pdoku.size', { n });
      head.querySelector('.dogu-size-age').textContent = t('pdoku.age', { age: AGE[n] });
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
          b.setAttribute('aria-label', t('pdoku.puzzleLocked', { n: p.id }));
          b.addEventListener('click', () => {
            tap();
            offer();
          });
        } else {
          const stars = progress.stars[p.id] || 0;
          if (nextOpen && nextOpen.id === p.id) b.classList.add('next');
          b.innerHTML = `<span class="num">${p.id}</span><span class="stars" aria-hidden="true">${starsText(stars)}</span>`;
          b.setAttribute('aria-label', stars ? t('pdoku.puzzleStars', { n: p.id, stars }) : t('pdoku.puzzleOpen', { n: p.id }));
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
    shell.offerUnlock(t('pdoku.lockedLead', { free: puzzles.filter((p) => p.free).length || meta.free, total: puzzles.length || 60 }));
  }

  // ---------- playing ----------

  function keep() {
    if (current && !solved) boards.set(current.id, { board: board.slice(), notes: notes.slice(), undo: undo.slice(), hintsUsed });
  }

  function play(id) {
    const p = puzzles.find((q) => q.id === id);
    if (!p) return;
    if (locked(p)) {
      offer();
      return;
    }
    keep();
    current = p;
    const start = parse(p.givens);
    given = start.map(Boolean);
    const kept = boards.get(p.id);
    board = kept ? kept.board.slice() : start;
    notes = kept ? kept.notes.slice() : new Array(start.length).fill(0);
    undo = kept ? kept.undo.slice() : [];
    hintsUsed = kept ? kept.hintsUsed : 0;
    solved = false;
    selected = -1;
    brush = 0;
    pencil = false;
    flash = -1;
    buildBoard();
    renderHud();
    renderRules();
    renderPalette();
    updateBoard();
    shell.show('picturedoku');
    if (!howSeen[p.tier]) showHow();
  }

  function showHow() {
    howSeen = { ...howSeen, [current.tier]: true };
    store.saveGameOption(meta.id, 'howSeen', howSeen);
    const text = current.tier === 'tiny' ? t('pdoku.howTiny') : t('pdoku.how');
    shell.showOverlay({ art: pictureSvg(1, { cls: 'ov-pic' }), title: t('pdoku.howTitle'), text, buttons: [[t('common.ok'), 'big primary', shell.hideOverlay]] });
  }

  function buildBoard() {
    const el = $('#pdoku-board');
    const { n } = current;
    const [bh, bw] = boxOf(n);
    el.textContent = '';
    el.style.setProperty('--n', String(n));
    el.dataset.n = String(n);
    el.classList.remove('won');
    cells = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pcell';
      b.dataset.i = String(i);
      // thick lines between boxes (the board's own border draws the outside)
      if (c < n - 1 && (c + 1) % bw === 0) b.classList.add('er');
      if (r < n - 1 && (r + 1) % bh === 0) b.classList.add('eb');
      if (given[i]) b.classList.add('given');
      b.style.setProperty('--i', String(r + c)); // stagger for the happy bounce
      el.appendChild(b);
      cells.push(b);
    }
  }

  function notesHtml(mask) {
    const { n } = current;
    let html = '';
    for (let v = 1; v <= n; v++) html += `<span class="note">${mask & (1 << v) ? art(v) : ''}</span>`;
    return `<span class="notes n${n}">${html}</span>`;
  }

  function updateBoard() {
    if (!current) return;
    const { n } = current;
    const bad = conflicts(n, board);
    const badCells = new Set(bad.flatMap((x) => x.cells));
    const zone = new Set(bad.length ? zoneOf(bad[0]) : []);
    const peer = selected >= 0 ? new Set(peers(n)[selected]) : new Set();
    const sameValue = selected >= 0 ? board[selected] : brush > 0 ? brush : 0;
    for (let i = 0; i < n * n; i++) {
      const b = cells[i];
      const v = board[i];
      const want = v ? `v${v}${asNumbers() ? 'n' : ''}` : notes[i] ? `m${notes[i]}${asNumbers() ? 'n' : ''}` : '';
      if (b.dataset.show !== want) {
        b.dataset.show = want;
        b.innerHTML = v ? art(v) : notes[i] ? notesHtml(notes[i]) : '';
      }
      b.classList.toggle('sel', i === selected);
      b.classList.toggle('peer', peer.has(i));
      b.classList.toggle('same', !!sameValue && v === sameValue && i !== selected);
      b.classList.toggle('bad', badCells.has(i));
      b.classList.toggle('zone', zone.has(i));
      b.classList.toggle('hinted', i === flash);
      b.setAttribute('aria-label', cellLabel(i));
      b.setAttribute('aria-pressed', String(i === selected));
    }
    // the first broken rule lights up under the board, with a short line
    const first = bad[0]?.rule || '';
    for (const chip of document.querySelectorAll('#pdoku-rules .rule')) chip.classList.toggle('oops', chip.dataset.rule === first);
    $('#pdoku-status').textContent = first ? t(`pdoku.oops.${first}`) : '';
    renderPaletteState();
    renderHint();
    $('#pdoku-undo').disabled = !undo.length || solved;
    $('#pdoku-erase').disabled = solved;
    $('#pdoku-pencil').disabled = solved;
  }

  /** Every square of the row, column or box a conflict is in. */
  function zoneOf(conflict) {
    const { n } = current;
    const a = conflict.cells[0];
    if (conflict.rule === 'row') return [...Array(n).keys()].map((c) => Math.floor(a / n) * n + c);
    if (conflict.rule === 'col') return [...Array(n).keys()].map((r) => r * n + (a % n));
    return [a, ...peers(n)[a]].filter((j) => sameBox(a, j));
  }

  function sameBox(a, b) {
    const { n } = current;
    const [bh, bw] = boxOf(n);
    return Math.floor(a / n / bh) === Math.floor(b / n / bh) && Math.floor((a % n) / bw) === Math.floor((b % n) / bw);
  }

  function cellLabel(i) {
    const { n } = current;
    const pos = { r: Math.floor(i / n) + 1, c: (i % n) + 1 };
    if (board[i]) return t(given[i] ? 'pdoku.cellGiven' : 'pdoku.cellPic', { ...pos, pic: picName(board[i]) });
    if (notes[i]) {
      const pics = [];
      for (let v = 1; v <= n; v++) if (notes[i] & (1 << v)) pics.push(picName(v));
      return t('pdoku.cellNotes', { ...pos, pics: pics.join(', ') });
    }
    return t('pdoku.cellEmpty', pos);
  }

  /** Change squares as one undoable action. changes: [[i, value, notesMask], ...] */
  function apply(changes) {
    const before = changes.map(([i]) => ({ i, v: board[i], notes: notes[i] }));
    let changed = false;
    for (const [i, v, m] of changes) {
      if (board[i] !== v || notes[i] !== m) changed = true;
      board[i] = v;
      notes[i] = m;
    }
    if (changed) undo.push(before);
    return changed;
  }

  /** Put picture v in square i (v = 0 clears it); with the pencil, toggle a small picture instead. */
  function put(i, v) {
    if (solved) return;
    if (given[i]) {
      wiggle(cells[i]);
      $('#pdoku-status').textContent = t('pdoku.fixed');
      return;
    }
    if (pencil && v > 0) {
      if (board[i]) return; // a picture is already there: notes only go in empty squares
      apply([[i, 0, notes[i] ^ (1 << v)]]);
      sfx.click();
      afterChange();
      return;
    }
    if (v > 0 && board[i] === v) v = 0; // the same picture again takes it out
    const changes = [[i, v, 0]];
    if (v > 0) {
      // a placed picture is no longer a possibility for its row, column and box
      for (const j of peers(current.n)[i]) if (notes[j] & (1 << v)) changes.push([j, board[j], notes[j] & ~(1 << v)]);
    }
    if (!apply(changes)) return;
    if (v > 0) sfx.plink(v);
    else sfx.click();
    afterChange();
  }

  function afterChange() {
    flash = -1;
    updateBoard();
    if (board.every(Boolean) && isSolved(current, board)) win();
  }

  function tapCell(i) {
    if (!current || solved) return;
    sfx.unlock();
    if (brush !== 0) {
      selected = i;
      put(i, brush > 0 ? brush : 0); // the eraser (brush -1) clears the picture and the small ones
      updateBoard();
      return;
    }
    selected = selected === i ? -1 : i;
    sfx.click();
    updateBoard();
  }

  function tapPalette(v) {
    if (!current || solved) return;
    sfx.unlock();
    if (selected >= 0 && !given[selected] && brush === 0) {
      put(selected, v);
      // done with this square (with the pencil it stays chosen, for more small pictures); the next
      // picture tapped without a square then starts the picture-first way
      if (!pencil && !solved) {
        selected = -1;
        updateBoard();
      }
      return;
    }
    // no square chosen (or a fixed one): pick the picture first, then tap squares with it
    brush = brush === v ? 0 : v;
    selected = -1;
    sfx.click();
    updateBoard();
  }

  function erase() {
    if (!current || solved) return;
    if (selected >= 0 && !given[selected] && brush === 0) {
      if (apply([[selected, 0, 0]])) sfx.click();
      afterChange();
      return;
    }
    brush = brush === -1 ? 0 : -1;
    selected = -1;
    sfx.click();
    updateBoard();
  }

  function undoLast() {
    if (!current || solved || !undo.length) return;
    for (const { i, v, notes: m } of undo.pop()) {
      board[i] = v;
      notes[i] = m;
    }
    sfx.click();
    flash = -1;
    updateBoard();
  }

  function wiggle(el) {
    el.classList.remove('wiggle');
    void el.offsetWidth; // restart the animation
    el.classList.add('wiggle');
  }

  // ---------- palette and tools ----------

  function renderPalette() {
    const box = $('#pdoku-palette');
    box.textContent = '';
    box.dataset.n = String(current.n);
    for (let v = 1; v <= current.n; v++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.dataset.v = String(v);
      b.innerHTML = art(v);
      b.setAttribute('aria-label', t('pdoku.pick', { pic: picName(v) }));
      b.addEventListener('click', () => tapPalette(v));
      box.appendChild(b);
    }
    $('#pdoku-pencil').hidden = current.tier === 'tiny';
  }

  function renderPaletteState() {
    const { n } = current;
    const count = new Array(n + 1).fill(0);
    for (const v of board) if (v) count[v]++;
    for (const b of document.querySelectorAll('#pdoku-palette .pick')) {
      const v = Number(b.dataset.v);
      b.classList.toggle('armed', brush === v);
      b.classList.toggle('done', count[v] >= n); // every one of this picture is placed
      b.setAttribute('aria-pressed', String(brush === v));
    }
    const er = $('#pdoku-erase');
    er.classList.toggle('armed', brush === -1);
    er.setAttribute('aria-pressed', String(brush === -1));
    $('#pdoku-pencil').setAttribute('aria-pressed', String(pencil));
    $('#pdoku-board').classList.toggle('pencil', pencil);
  }

  $('#pdoku-pencil').addEventListener('click', () => {
    tap();
    pencil = !pencil;
    updateBoard();
  });
  $('#pdoku-erase').addEventListener('click', () => {
    sfx.unlock();
    erase();
  });
  $('#pdoku-undo').addEventListener('click', () => {
    sfx.unlock();
    undoLast();
  });

  // squares: every way of pressing a button (finger, mouse, keyboard) ends in a click
  $('#pdoku-board').addEventListener('click', (e) => {
    const cell = e.target.closest('.pcell');
    if (cell) tapCell(Number(cell.dataset.i));
  });

  // ---------- hints ----------

  const hintLimit = () => HINTS[current?.tier] ?? 3;

  function renderHint() {
    const b = $('#pdoku-hint');
    if (!current) return;
    const left = hintLimit() - hintsUsed;
    const unlimited = !Number.isFinite(hintLimit());
    b.querySelector('.count').textContent = unlimited ? '' : String(Math.max(0, left));
    b.classList.toggle('empty', !unlimited && left <= 0);
    b.setAttribute('aria-label', unlimited ? t('pdoku.hintsUnlimited') : t('pdoku.hintsLeft', { n: Math.max(0, left) }));
  }

  function hint() {
    if (!current || solved) return;
    if (hintsUsed >= hintLimit()) {
      $('#pdoku-status').textContent = t('pdoku.noHints');
      wiggle($('#pdoku-hint'));
      return;
    }
    const h = nextHint(current, board);
    if (!h) return;
    hintsUsed++;
    const changes = [[h.cell, h.to, 0]];
    if (h.to > 0) for (const j of peers(current.n)[h.cell]) if (notes[j] & (1 << h.to)) changes.push([j, board[j], notes[j] & ~(1 << h.to)]);
    apply(changes);
    undo.pop(); // a hint is not undone with the undo button
    selected = h.cell;
    brush = 0;
    flash = h.cell;
    updateBoard();
    $('#pdoku-status').textContent = t(h.why === 'wrong' ? 'pdoku.hintWrong' : h.why === 'only' ? 'pdoku.hintOnly' : 'pdoku.hintFill');
    if (h.to > 0) sfx.plink(h.to);
    if (board.every(Boolean) && isSolved(current, board)) win();
    else
      setTimeout(() => {
        if (flash === h.cell) {
          flash = -1;
          updateBoard();
        }
      }, 1800);
  }

  $('#pdoku-hint').addEventListener('click', () => {
    tap();
    hint();
  });

  // ---------- numbers instead of pictures (6×6 and 9×9) ----------

  function renderNumbers() {
    const b = $('#pdoku-numbers');
    b.hidden = !current || current.n === 4;
    b.setAttribute('aria-pressed', String(numbers));
  }
  $('#pdoku-numbers').addEventListener('click', () => {
    tap();
    numbers = !numbers;
    store.saveGameOption(meta.id, 'numbers', numbers);
    renderNumbers();
    renderPalette();
    updateBoard();
  });

  // ---------- HUD and rules ----------

  function renderHud() {
    $('#pdoku-title').textContent = t('pdoku.puzzle', { n: current.id });
    $('#pdoku-sub').textContent = t('pdoku.size', { n: current.n });
    renderNumbers();
    renderHint();
  }

  function renderRules() {
    const box = $('#pdoku-rules');
    box.textContent = '';
    box.classList.add('pictures'); // pictures only, to keep the board big (the text stays for screen readers)
    for (const r of ['row', 'col', 'box']) {
      const chip = document.createElement('li');
      chip.className = 'rule';
      chip.dataset.rule = r;
      chip.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${RULE_ART[r]}</svg><span></span>`;
      chip.querySelector('span').textContent = t(`pdoku.rule.${r}`);
      box.appendChild(chip);
    }
  }

  /** The board as large as fits: square, between the HUD and the palette. */
  function fitBoard() {
    const stage = $('#pdoku-stage');
    const side = window.innerWidth > window.innerHeight * 1.2; // sideways phone: palette beside the board
    stage.classList.toggle('side', side);
    const panel = $('#pdoku-stage .pdoku-side');
    const w = stage.clientWidth - 24 - (side ? panel.offsetWidth + 16 : 0);
    const h = stage.clientHeight - 16 - (side ? 0 : panel.offsetHeight + 12);
    const size = Math.max(160, Math.floor(Math.min(w, h, 640)));
    const el = $('#pdoku-board');
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
  }

  // ---------- winning ----------

  function win() {
    solved = true;
    boards.delete(current.id);
    const stars = starsFor(hintsUsed);
    store.recordStars(meta.id, current.id, stars);
    refresh();
    selected = -1;
    brush = 0;
    updateBoard();
    $('#pdoku-status').textContent = '';
    $('#pdoku-board').classList.add('won');
    sfx.chime();
    const done = current;
    setTimeout(() => {
      if (current !== done || !onScreen('picturedoku')) return;
      showWinCard(done, stars);
    }, 1400);
  }

  function showWinCard(done, stars) {
    const i = puzzles.indexOf(done);
    const next = puzzles.slice(i + 1).find((p) => !locked(p));
    const nextAny = puzzles[i + 1];
    const buttons = [];
    let text = t('pdoku.winText');
    if (nextAny && !locked(nextAny)) {
      buttons.push([t('pdoku.next'), 'big primary', () => play(nextAny.id)]);
    } else if (next) {
      // the next one of this size is in the full version: offer it, or jump to the next free size
      text = `${t('pdoku.winText')} ${t('pdoku.lastFree')}`;
      buttons.push([t('pdoku.next'), 'big primary', () => play(next.id)]);
      buttons.push([t('pdoku.more'), 'big secondary', offer]);
    } else if (nextAny) {
      text = `${t('pdoku.winText')} ${t('pdoku.lastFree')}`;
      buttons.push([t('pdoku.more'), 'big primary', offer]);
    }
    buttons.push([t('pdoku.puzzles'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('picturedoku-levels')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < stars ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`pdoku.win${stars}`),
      text,
      buttons,
    });
  }

  $('#pdoku-back').addEventListener('click', () => {
    tap();
    leave();
  });

  function leave() {
    keep();
    shell.show('picturedoku-levels');
  }

  // the tool buttons' pictures
  $('#pdoku-pencil').insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${PENCIL}</svg>`);
  $('#pdoku-erase').insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${ERASER}</svg>`);
  $('#pdoku-undo').insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${UNDO}</svg>`);

  return {
    open() {
      if (loadFailed) {
        shell.showOverlay({ title: t('error.title'), text: t('pdoku.loadError'), buttons: [[t('error.retry'), 'big primary', () => location.reload()]] });
        return;
      }
      shell.show('picturedoku-levels');
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
        puzzle: () => (current ? { id: current.id, n: current.n, tier: current.tier, givens: current.givens, solution: current.solution } : null),
        state: () => ({ solved, hintsUsed, board: board.slice(), selected, brush, pencil, status: $('#pdoku-status').textContent }),
        hint: () => hint(),
        tapCell: (i) => tapCell(i),
        tapPalette: (v) => tapPalette(v),
        count: () => puzzles.length,
        free: () => puzzles.filter((p) => p.free).map((p) => p.id),
        candidates: (i) => candidates(current.n, board, i),
      };
    },
  };
}
