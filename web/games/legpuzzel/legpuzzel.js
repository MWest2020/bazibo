// Legpuzzel (jigsaw): drag the pieces of a picture to their places. 4 to 30 pieces with round tabs,
// no turning; a piece dropped near its own place snaps in with a soft plink and stays. A faint
// example picture on the board helps (the eye button turns it off). The geometry and the rules
// live in rules.js, the pictures in pictures.js; the shell (web/js/main.js) owns the overlay card,
// the sound settings and the purchase.
//
// Drawing: the picture (an SVG scene) is drawn once into an image the size of the board; every
// piece is its own small canvas, cut out with its outline (a Path2D from rules.piecePath) and moved
// with a CSS transform, so dragging never redraws anything.
//
// Saved (games.legpuzzel): in `stars`, 1 for every picture and size laid at least once
// ('<picture>-<size>'); the last size ('size') and the example picture on or off ('ghost'). A puzzle
// in progress is kept while the app stays open ("keep puzzling").
import { meta } from './meta.js';
import { SIZES, SIZE_IDS, piecesOf, makeEdges, sidesOf, piecePath, layout, scatter, home, snaps, isComplete, rearrange } from './rules.js';
import { PICTURES, PICTURE_IDS, pictureSvg } from './pictures.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const CHECK = '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>';
const EYE = '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>';

export const DEFAULT_SIZE = 'p4';
export const puzzleKey = (p) => `${p.picture}-${p.size}`;

/** A little cut-up square for the size buttons: cols × rows pieces, two of them lifted out. */
export function sizeSvg(cols, rows) {
  const s = 54 / Math.max(cols, rows);
  let out = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const lifted = (r === rows - 1 && c === cols - 1) || (rows > 2 && r === 0 && c === 1);
      out += `<rect x="${(c * s + (lifted ? 3 : 0)).toFixed(1)}" y="${(r * s - (lifted ? 4 : 0)).toFixed(1)}" width="${(s - 1.5).toFixed(1)}" height="${(s - 1.5).toFixed(1)}" rx="2" fill="${lifted ? '#ffd23f' : (r + c) % 2 ? '#8fd0ff' : '#b9e1ff'}" stroke="#3a2f6b" stroke-width="1.4"/>`;
    }
  return `<svg class="psize" viewBox="-2 -6 ${(cols * s + 6).toFixed(1)} ${(rows * s + 8).toFixed(1)}" aria-hidden="true">${out}</svg>`;
}

export function createLegpuzzel(shell) {
  const { t, tap } = shell;
  const done = () => store.loadProgress(meta.id).stars;
  const savedSize = () => {
    const s = store.loadGameOption(meta.id, 'size', DEFAULT_SIZE);
    return SIZE_IDS.includes(s) ? s : DEFAULT_SIZE;
  };
  const ghostOn = () => store.loadGameOption(meta.id, 'ghost', true) !== false;

  let size = null; // the menu's size
  let game = null; // { picture, size, cols, rows, edges, placed: [bool], pos: [{x, y}], over }
  let lay = null; // rules.layout for the stage as it is now
  let image = null; // the picture, drawn at the board's size
  let pieces = []; // the piece canvases
  let drag = null; // { i, id, dx, dy }
  let z = 10;
  let builds = 0; // so a slow picture never lands on a newer puzzle or size
  let cardTimer = null;

  const locked = (p) => meta.isLocked(p, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const picName = (id) => t(`puzzel.pic.${id}`);

  shell.unlock.onChange(() => {
    if (onScreen('legpuzzel-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'legpuzzel-menu') renderMenu();
    if (name === 'legpuzzel') requestAnimationFrame(() => build());
  });
  shell.onLangChange(() => {
    if (onScreen('legpuzzel-menu')) renderMenu();
    if (game) renderHud();
  });
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!onScreen('legpuzzel')) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => build(), 120);
  });

  // ---------- menu ----------

  function renderMenu() {
    if (!size) size = savedSize();
    if (!shell.unlock.owned && !meta.freeSizes.includes(size)) size = meta.freeSizes[meta.freeSizes.length - 1];
    const owned = shell.unlock.owned;
    const box = $('#legpuzzel-menu');
    box.textContent = '';
    const lockIcon = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
    const head = (key) => {
      const h = document.createElement('h3');
      h.className = 'vier-head';
      h.textContent = t(key);
      box.appendChild(h);
    };
    if (game && !game.over) {
      const actions = document.createElement('div');
      actions.className = 'puzzel-keep';
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'legpuzzel-continue';
      cont.className = 'btn big secondary';
      cont.textContent = t('puzzel.continue');
      cont.addEventListener('click', () => {
        tap();
        shell.show('legpuzzel');
      });
      actions.appendChild(cont);
      box.appendChild(actions);
    }

    head('puzzel.sizeHead');
    const sizes = document.createElement('div');
    sizes.className = 'vier-row puzzel-sizes';
    for (const id of SIZE_IDS) {
      const cfg = SIZES[id];
      const isLocked = !owned && !meta.freeSizes.includes(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-opt dam-opt puzzel-opt size-${id} ${isLocked ? 'locked' : ''}`;
      b.setAttribute('aria-pressed', String(size === id && !isLocked));
      b.innerHTML = `<span class="vier-opt-art">${sizeSvg(cfg.cols, cfg.rows)}</span><span class="vier-opt-text"><span class="vier-opt-title"></span><span class="vier-opt-sub"></span></span>${isLocked ? lockIcon : ''}`;
      b.querySelector('.vier-opt-title').textContent = t('puzzel.pieces', { n: piecesOf(id) });
      b.querySelector('.vier-opt-sub').textContent = isLocked ? t('puzzel.fullVersion') : t('puzzel.age', { age: cfg.age });
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('puzzel.lockedLead'));
          return;
        }
        size = id;
        store.saveGameOption(meta.id, 'size', id);
        renderMenu();
      });
      sizes.appendChild(b);
    }
    box.appendChild(sizes);

    head('puzzel.pictureHead');
    const grid = document.createElement('div');
    grid.className = 'puzzel-pictures';
    const laid = done();
    for (const { id } of PICTURES) {
      const isLocked = locked({ picture: id, size });
      const wasDone = !!laid[puzzleKey({ picture: id, size })];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `puzzel-pic pic-${id} ${isLocked ? 'locked' : ''} ${wasDone ? 'done' : ''}`;
      b.dataset.picture = id;
      b.innerHTML = `<span class="puzzel-thumb">${pictureSvg(id, 160, 120)}</span><span class="puzzel-pic-name"></span>${isLocked ? lockIcon : wasDone ? `<svg class="check" viewBox="0 0 24 24" aria-hidden="true">${CHECK}</svg>` : ''}`;
      b.querySelector('.puzzel-pic-name').textContent = picName(id);
      b.setAttribute('aria-label', `${picName(id)}${isLocked ? `, ${t('puzzel.fullVersion')}` : wasDone ? `, ${t('puzzel.done')}` : ''}`);
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('puzzel.lockedLead'));
          return;
        }
        start({ picture: id, size });
      });
      grid.appendChild(b);
    }
    box.appendChild(grid);
  }

  // ---------- a puzzle ----------

  function start(p) {
    if (locked(p)) {
      shell.offerUnlock(t('puzzel.lockedLead'));
      return;
    }
    cancelCard();
    shell.hideOverlay();
    const { cols, rows } = SIZES[p.size];
    game = { ...p, cols, rows, edges: makeEdges(cols, rows), placed: new Array(cols * rows).fill(false), pos: null, over: false };
    lay = null;
    renderHud();
    shell.show('legpuzzel'); // onShow builds the pieces
  }

  function cancelCard() {
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
  }

  function renderHud() {
    $('#legpuzzel-title').textContent = picName(game.picture);
    $('#legpuzzel-sub').textContent = t('puzzel.pieces', { n: piecesOf(game.size) });
    $('#legpuzzel-ghost').setAttribute('aria-pressed', String(ghostOn()));
    renderStatus();
  }

  function renderStatus() {
    if (!game) return;
    const left = game.placed.filter((x) => !x).length;
    $('#legpuzzel-status').textContent = game.over ? t('puzzel.win') : left === piecesOf(game.size) ? t('puzzel.start') : left === 1 ? t('puzzel.leftOne') : t('puzzel.left', { n: left });
  }

  /** (Re)build the board and the pieces for the stage as it is now; loose pieces are spread again
   *  on the tray when the stage changed size. */
  async function build() {
    if (!game || !onScreen('legpuzzel')) return;
    const stage = $('#legpuzzel-stage');
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const next = layout(w, h, game.cols, game.rows);
    if (!next) return;
    const same = lay && lay.s === next.s && lay.board.x === next.board.x && lay.board.y === next.board.y && lay.tray.w === next.tray.w && lay.tray.h === next.tray.h && pieces.length;
    if (same && game.pos) return;
    const token = ++builds;
    // loose pieces are spread again only when the pieces change size; a toolbar sliding in or out
    // must not undo the child's own arrangement
    const resized = !game.pos || !lay || lay.s !== next.s;
    lay = next;
    const { s, m, board } = lay;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pictureSvg(game.picture, board.w, board.h))}`;
    try {
      await img.decode();
    } catch {
      /* drawn as far as it got */
    }
    if (token !== builds || !game) return;
    image = img;
    // the board: a frame with the faint example picture
    const el = $('#legpuzzel-board');
    el.style.left = `${board.x}px`;
    el.style.top = `${board.y}px`;
    el.style.width = `${board.w}px`;
    el.style.height = `${board.h}px`;
    el.classList.toggle('done', game.over);
    const ghost = el.querySelector('canvas') || el.appendChild(document.createElement('canvas'));
    ghost.width = Math.round(board.w * dpr);
    ghost.height = Math.round(board.h * dpr);
    const g = ghost.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, board.w, board.h);
    g.drawImage(img, 0, 0, board.w, board.h);
    el.classList.toggle('ghost-off', !ghostOn());
    // the pieces
    for (const p of pieces) p.remove();
    const loose = game.placed.map((x) => !x);
    const spread = resized ? scatter(piecesOf(game.size), lay.tray, s, m) : null;
    game.pos = rearrange({ pos: game.pos, placed: game.placed, cols: game.cols, board, s, m, w, h, resized, spread });
    pieces = game.pos.map((_, i) => makePiece(i, s, m, dpr));
    pieces.forEach((p, i) => {
      p.classList.toggle('placed', !loose[i]);
      stage.appendChild(p);
      moveTo(i, game.pos[i]);
    });
    renderStatus();
  }

  function makePiece(i, s, m, dpr) {
    const c = i % game.cols;
    const r = Math.floor(i / game.cols);
    const side = s + 2 * m;
    const canvas = document.createElement('canvas');
    canvas.className = 'ppiece';
    canvas.width = Math.round(side * dpr);
    canvas.height = Math.round(side * dpr);
    canvas.style.width = canvas.style.height = `${side}px`;
    canvas.dataset.i = String(i);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', t('puzzel.piece', { n: i + 1 }));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const path = new Path2D(piecePath(sidesOf(game.edges, game.cols, game.rows, c, r), s, m));
    ctx.save();
    ctx.clip(path);
    ctx.drawImage(image, m - c * s, m - r * s, game.cols * s, game.rows * s);
    ctx.restore();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke(path);
    ctx.strokeStyle = 'rgba(58,47,107,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke(path);
    canvas.hit = (x, y) => ctx.isPointInPath(path, x * dpr, y * dpr); // x, y: px inside the drawing
    canvas.addEventListener('pointerdown', (e) => grab(e, i));
    return canvas;
  }

  function moveTo(i, p) {
    pieces[i].style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  /** The loose piece really under the finger: the corners of a piece's drawing around its tabs are
   *  see-through, so a touch there goes to the piece underneath. */
  function pieceAt(x, y) {
    const hits = document.elementsFromPoint(x, y).filter((el) => el.classList?.contains('ppiece'));
    for (const el of hits) {
      const k = Number(el.dataset.i);
      if (game.placed[k]) continue;
      const r = el.getBoundingClientRect();
      if (el.hit(x - r.left, y - r.top)) return k;
    }
    // near enough: the top loose piece whose drawing was touched
    const loose = hits.map((el) => Number(el.dataset.i)).filter((k) => !game.placed[k]);
    return loose.length ? loose[0] : -1;
  }

  function grab(e, tapped) {
    if (!game || game.over || drag) return;
    if (!game.pos) return; // the pieces are still being cut
    const i = pieceAt(e.clientX, e.clientY);
    if (i < 0 || (game.placed[i] && i === tapped)) return;
    e.preventDefault();
    sfx.unlock();
    const el = pieces[i];
    el.setPointerCapture?.(e.pointerId);
    el.style.zIndex = String(++z);
    el.classList.add('lift');
    drag = { i, id: e.pointerId, dx: e.clientX - game.pos[i].x, dy: e.clientY - game.pos[i].y };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const stage = $('#legpuzzel-stage');
    const side = lay.s + 2 * lay.m;
    // keep at least half a piece on the stage
    const x = Math.min(Math.max(e.clientX - drag.dx, -side / 2), stage.clientWidth - side / 2);
    const y = Math.min(Math.max(e.clientY - drag.dy, -side / 2), stage.clientHeight - side / 2);
    game.pos[drag.i] = { x, y };
    moveTo(drag.i, game.pos[drag.i]);
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { i } = drag;
    drag = null;
    const el = pieces[i];
    el.classList.remove('lift');
    const at = home(i, game.cols, lay.board, lay.s, lay.m);
    const p = game.pos[i];
    if (snaps(p.x, p.y, at, lay.s)) {
      game.pos[i] = at;
      game.placed[i] = true;
      el.classList.add('placed', 'snap');
      el.style.zIndex = '1';
      setTimeout(() => el.classList.remove('snap'), 400);
      moveTo(i, at);
      sfx.plink(1 + ((game.placed.filter(Boolean).length - 1) % 9)); // a note higher with every piece
      renderStatus();
      if (isComplete(game.placed)) finish();
    } else {
      // a drop somewhere else: it stays where it was let go, gently back onto the stage
      const stage = $('#legpuzzel-stage');
      const side = lay.s + 2 * lay.m;
      game.pos[i] = { x: Math.min(Math.max(p.x, 0), stage.clientWidth - side), y: Math.min(Math.max(p.y, 0), stage.clientHeight - side) };
      moveTo(i, game.pos[i]);
    }
  }

  const stageEl = $('#legpuzzel-stage');
  stageEl.addEventListener('pointermove', onMove);
  stageEl.addEventListener('pointerup', onUp);
  stageEl.addEventListener('pointercancel', onUp);

  function finish() {
    game.over = true;
    store.recordStars(meta.id, puzzleKey(game), 1);
    $('#legpuzzel-board').classList.add('done');
    renderStatus();
    setTimeout(() => sfx.chime(), 200);
    setTimeout(() => sfx.win(), 600);
    const g = game;
    cancelCard();
    cardTimer = setTimeout(() => {
      cardTimer = null;
      if (game === g && onScreen('legpuzzel')) showEndCard();
    }, 1200);
  }

  function showEndCard() {
    const p = { picture: game.picture, size: game.size };
    const art = `<span class="puzzel-ov">${pictureSvg(p.picture, 160, 120)}</span>`;
    const order = PICTURE_IDS.filter((id) => !locked({ picture: id, size: p.size }));
    const nextPic = order[(order.indexOf(p.picture) + 1) % order.length];
    const buttons = [[t('puzzel.next'), 'big primary', () => start({ picture: nextPic, size: p.size })]];
    buttons.push([t('puzzel.again'), 'big secondary', () => start(p)]);
    // the menu first, then the offer: whatever closes it, the child lands on the menu (as Bubbels since #36)
    if (!shell.unlock.owned && p.size === meta.freeSizes[meta.freeSizes.length - 1]) buttons.push([t('puzzel.more'), 'big secondary', () => (shell.show('legpuzzel-menu'), shell.offerUnlock(t('puzzel.lockedLead')))]);
    buttons.push([t('puzzel.menuBtn'), 'big secondary', () => shell.show('legpuzzel-menu')]);
    shell.showOverlay({ art, title: t('puzzel.win'), text: t('puzzel.winText', { name: picName(p.picture), n: piecesOf(p.size) }), buttons });
  }

  $('#legpuzzel-ghost').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${EYE}</svg>`;
  $('#legpuzzel-ghost').addEventListener('click', () => {
    tap();
    store.saveGameOption(meta.id, 'ghost', !ghostOn());
    $('#legpuzzel-ghost').setAttribute('aria-pressed', String(ghostOn()));
    $('#legpuzzel-board').classList.toggle('ghost-off', !ghostOn());
  });
  $('#legpuzzel-back').addEventListener('click', () => {
    tap();
    leave();
  });

  /** The puzzle -> the menu (kept for this session: "keep puzzling"). */
  function leave() {
    shell.hideOverlay();
    cancelCard();
    drag = null;
    shell.show('legpuzzel-menu');
  }

  return {
    open() {
      shell.show('legpuzzel-menu');
    },
    leave,
    async init() {
      return true;
    },
    testHook() {
      const stagePos = () => $('#legpuzzel-stage').getBoundingClientRect();
      return {
        start: (p) => start(p),
        chooseSize: (s) => {
          size = s;
          if (onScreen('legpuzzel-menu')) renderMenu();
        },
        ready: () => !!(game && lay && pieces.length === piecesOf(game.size) && game.pos),
        state: () =>
          game && lay
            ? (() => {
                const o = stagePos();
                const half = lay.s / 2 + lay.m;
                return {
                  picture: game.picture,
                  size: game.size,
                  placed: game.placed.slice(),
                  over: game.over,
                  s: lay.s,
                  side: lay.side,
                  // page coordinates of each piece's middle, now and in its place
                  at: game.pos.map((p) => ({ x: o.left + p.x + half, y: o.top + p.y + half })),
                  home: game.pos.map((_, i) => {
                    const h = home(i, game.cols, lay.board, lay.s, lay.m);
                    return { x: o.left + h.x + half, y: o.top + h.y + half };
                  }),
                };
              })()
            : null,
        done: () => done(),
        // the loose pieces a finger on their middle would pick up (not covered by another piece)
        free: () => {
          if (!game || !lay) return [];
          const o = stagePos();
          const half = lay.s / 2 + lay.m;
          return game.pos.flatMap((p, i) => (!game.placed[i] && pieceAt(o.left + p.x + half, o.top + p.y + half) === i ? [i] : []));
        },
      };
    },
  };
}
