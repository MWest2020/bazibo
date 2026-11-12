// Tekenen: free drawing with a finger. Every colour of Kleurplaten's palette, three brushes, an
// eraser, undo and "clear the page" are free, and up to FREE_DRAWINGS drawings are kept in "my
// drawings". The full version adds mirror mode (2, 4, 6 or 8 mirror lines through the middle, so
// every stroke becomes a mandala), stamps, and an album of up to MAX_DRAWINGS (100).
// A drawing is a list of strokes and stamps (drawing.js), saved as a short text through
// storage.js saveDrawing; it is drawn again at any size by render.js. What is kept when is
// session.js (tested without a screen).
// The shell (web/js/main.js) owns the overlay card, the sound settings and the purchase.
import { meta } from './meta.js';
import { GRID, STAMPS, ERASER, FREE_DRAWINGS, MAX_DRAWINGS, STROKE_TOLERANCE, visible, decode, simplify, mayKeep, clampCoord } from './drawing.js';
import { AXES, axisAngles, transforms } from './symmetry.js';
import { drawItems, drawMore, drawStrokeTail, thumbCanvas, stampIcon } from './render.js';
import { createSession } from './session.js';
import { PALETTE, WHITE, ICONS } from '../kleuren/art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const SAVE_DELAY = 600; // ms after the last stroke before the drawing is written
const TOOL_ICONS = {
  clear:
    '<path d="M6 7h12l-1 13a1.5 1.5 0 0 1-1.5 1.4h-7A1.5 1.5 0 0 1 7 20z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M4 7h16M9.5 7V4.5h5V7M10 11v6.5M14 11v6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  eraser:
    '<path d="M3.5 15.5 13 6a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8L13 20H8z" fill="#ff8fc7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8.2 10.8l7 7M8 20h12.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
};

/** A small picture of n mirror lines (0: a single stroke, "no mirror"). */
function mirrorIcon(n) {
  const lines = axisAngles(n)
    .map((th) => {
      const dx = 9 * Math.cos(th);
      const dy = 9 * Math.sin(th);
      return `M${(12 - dx).toFixed(2)} ${(12 - dy).toFixed(2)}L${(12 + dx).toFixed(2)} ${(12 + dy).toFixed(2)}`;
    })
    .join('');
  if (!n) return '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 15c2-5 5-6 8-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
  return `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="${lines}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>`;
}


export function createTekenen(shell) {
  const { t, tap } = shell;
  const owned = () => shell.unlock.owned;
  const session = createSession({ store, gameId: meta.id, owned });
  let colour = 7; // blue
  let size = 1;
  let tool = 'pen'; // 'pen' | 'eraser' | 'stamp'
  let stamp = 0;
  let mirror = 0; // mirror lines (0, or one of AXES)
  let tray = null; // 'stamps' | 'mirror' while its choices are open over the page
  let current = null; // the stroke under the finger
  let drawn = 0; // how many of its points are on the screen already
  let active = null; // its pointer id
  let px = 0; // the canvas size in pixels
  let dirty = false;
  let lastSave = 'saved'; // what the last write did (session.write)
  let saveTimer = 0;
  let frame = 0;
  let plays = 0; // a late "done" card never lands on a newer drawing
  let checkpoints = []; // [{ n, canvas }]: the page after its first n items, so undo redraws little

  const canvas = $('#teken-canvas');
  const ctx = canvas.getContext('2d');
  const committed = document.createElement('canvas'); // every finished item; the stroke goes on top
  const cctx = committed.getContext('2d');
  const thumbs = new Map(); // id -> { t, canvas }: "my drawings" draws each drawing once

  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const items = () => session.items;
  const hasInk = () => session.hasInk();
  const albumHasRoom = () => mayKeep({ owned: owned(), count: store.countDrawings(meta.id), saved: false });

  shell.unlock.onChange(() => {
    if (!owned()) {
      // the full version went away (a refund): its tools close
      mirror = 0;
      if (tool === 'stamp') tool = 'pen';
      closeTray();
      renderGuides();
    }
    if (onScreen('tekenen-list')) renderList();
    renderTools();
  });
  shell.onShow((name) => {
    if (name === 'tekenen-list') renderList();
    if (name === 'tekenen') requestAnimationFrame(fit);
    else closeTray();
  });
  shell.onLangChange(() => {
    if (onScreen('tekenen-list')) renderList();
    renderPalette();
    renderTools();
    if (tray) openTray(tray);
  });
  window.addEventListener('resize', () => onScreen('tekenen') && fit());
  document.addEventListener('visibilitychange', () => document.hidden && flush());

  // ---------- my drawings ----------

  let thumbQueue = [];
  let thumbTimer = 0;

  /** Draw the waiting thumbnails one at a time, so the list shows at once. */
  function drawThumbs() {
    thumbTimer = 0;
    const job = thumbQueue.shift();
    if (!job) return;
    const { key, d, c } = job;
    drawItems(c.getContext('2d'), decode(d.s), c.width);
    thumbs.set(key, { t: d.t, canvas: c });
    if (thumbQueue.length) thumbTimer = setTimeout(drawThumbs, 0);
  }

  function thumbFor(key, d) {
    const hit = thumbs.get(key);
    if (hit && hit.t === d.t) return hit.canvas;
    const c = thumbCanvas([], 120, 'kleur-thumb'); // white for now
    thumbQueue.push({ key, d, c });
    return c;
  }

  function renderList() {
    const box = $('#teken-list');
    box.textContent = '';
    clearTimeout(thumbTimer);
    thumbQueue = [];
    const grid = document.createElement('div');
    grid.className = 'level-grid kleur-grid teken-grid';
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'kleur-card teken-new';
    add.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${TOOL_ICONS.plus}</svg><span></span>`;
    add.querySelector('span').textContent = t('teken.new');
    if (!albumHasRoom()) {
      add.classList.add('full');
      if (!owned()) add.insertAdjacentHTML('beforeend', `<svg class="kleur-badge lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`);
    }
    add.addEventListener('click', () => {
      tap();
      // a full album says so before the child starts, not after
      if (!albumHasRoom()) albumFull();
      else openDrawing(null);
    });
    grid.appendChild(add);
    const all = Object.entries(store.loadDrawings(meta.id)).sort((a, b) => a[1].t - b[1].t);
    all.forEach(([, d], i) => (d.n = i + 1)); // numbered from the oldest
    const live = new Set(all.map(([key]) => key));
    for (const key of thumbs.keys()) if (!live.has(key)) thumbs.delete(key);
    for (const [key, d] of all.reverse()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'kleur-card teken-card';
      b.dataset.id = key;
      b.setAttribute('aria-label', t('teken.card', { n: d.n }));
      b.appendChild(thumbFor(key, d));
      b.addEventListener('click', () => {
        tap();
        openDrawing(key);
      });
      grid.appendChild(b);
    }
    box.appendChild(grid);
    if (thumbQueue.length) thumbTimer = setTimeout(drawThumbs, 0);
  }

  // ---------- drawing ----------

  function openDrawing(key) {
    flush();
    plays++;
    session.open(key);
    dirty = false;
    lastSave = 'saved';
    current = null;
    active = null;
    checkpoints = [];
    tool = tool === 'eraser' ? 'pen' : tool;
    if (!owned()) {
      mirror = 0;
      if (tool === 'stamp') tool = 'pen';
    }
    closeTray();
    renderGuides();
    renderTools();
    shell.show('tekenen');
    fit();
    renderAll();
  }

  /** The page as large as fits: square, beside or above the palette and tools. */
  function fit() {
    const stage = $('#teken-stage');
    const side = window.innerWidth > window.innerHeight * 1.2;
    stage.classList.toggle('side', side);
    const panel = $('#teken-stage .teken-side');
    const w = stage.clientWidth - 24 - (side ? panel.offsetWidth + 16 : 0);
    const h = stage.clientHeight - 16 - (side ? 0 : panel.offsetHeight + 12);
    const cssSize = Math.max(160, Math.floor(Math.min(w, h, 720)));
    const page = $('#teken-page');
    page.style.width = `${cssSize}px`;
    page.style.height = `${cssSize}px`;
    const want = Math.round(cssSize * Math.min(window.devicePixelRatio || 1, 2));
    if (want !== px) {
      px = want;
      canvas.width = committed.width = px;
      canvas.height = committed.height = px;
      checkpoints = [];
      renderAll();
    }
  }

  /** The page again from its items, from the newest checkpoint that still holds. */
  function renderAll() {
    if (!px) return;
    const list = items();
    checkpoints = checkpoints.filter((c) => c.n <= list.length);
    const cp = checkpoints[checkpoints.length - 1];
    if (cp) {
      cctx.setTransform(1, 0, 0, 1, 0, 0);
      cctx.drawImage(cp.canvas, 0, 0);
      drawMore(cctx, list.slice(cp.n), px);
    } else drawItems(cctx, list, px);
    blit();
  }

  /** Every CHECK_EVERY items, the page is kept as a picture (two of them), so undo is quick. */
  const CHECK_EVERY = 12;
  function checkpoint() {
    const n = items().length;
    const last = checkpoints[checkpoints.length - 1];
    if (n - (last ? last.n : 0) < CHECK_EVERY) return;
    const reuse = checkpoints.length >= 2 ? checkpoints.shift().canvas : document.createElement('canvas');
    reuse.width = px;
    reuse.height = px;
    reuse.getContext('2d').drawImage(committed, 0, 0);
    checkpoints.push({ n, canvas: reuse });
  }

  function blit() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(committed, 0, 0);
    if (current) {
      drawn = 0;
      drawTail();
    }
  }

  /** Only the new points of the stroke under the finger (render.js drawStrokeTail). */
  function drawTail() {
    if (!current || !px) return;
    const s = px / GRID;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawStrokeTail(ctx, current, drawn);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawn = current.pts.length;
  }

  function scheduleTail() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      drawTail();
    });
  }

  function renderGuides() {
    const svg = $('#teken-guides');
    const h = GRID / 2;
    const r = h * 1.5;
    svg.innerHTML = axisAngles(mirror)
      .map((th) => `<line x1="${(h - r * Math.cos(th)).toFixed(1)}" y1="${(h - r * Math.sin(th)).toFixed(1)}" x2="${(h + r * Math.cos(th)).toFixed(1)}" y2="${(h + r * Math.sin(th)).toFixed(1)}"/>`)
      .join('');
    if (mirror) svg.insertAdjacentHTML('beforeend', `<circle cx="${h}" cy="${h}" r="22"/>`);
    $('#teken-page').classList.toggle('mirrored', mirror > 0);
  }

  /** A pointer position as grid units on the page. */
  function toGrid(e) {
    const r = canvas.getBoundingClientRect();
    return [clampCoord(((e.clientX - r.left) / r.width) * GRID), clampCoord(((e.clientY - r.top) / r.height) * GRID)];
  }

  /** A finished stroke or a stamp: on the page, undoable, saved soon. False when the page is full. */
  function addItem(it) {
    if (!session.add(it)) {
      blit();
      shell.showOverlay({ title: t('teken.pageFullTitle'), text: t('teken.pageFullText'), buttons: [[t('common.ok'), 'big primary', shell.hideOverlay]] });
      return false;
    }
    if (px) drawMore(cctx, [it], px);
    checkpoint();
    blit();
    renderTools();
    scheduleSave();
    return true;
  }

  const brushColour = () => (tool === 'eraser' ? ERASER : colour);

  canvas.addEventListener('pointerdown', (e) => {
    // any finger may start a stroke while none is drawing (not only the "primary" one); a second
    // finger during a stroke is left alone
    if (active !== null || e.button > 0) return;
    e.preventDefault();
    sfx.unlock();
    if (tray) {
      closeTray(); // a tap beside the choices only closes them
      return;
    }
    const [x, y] = toGrid(e);
    if (tool === 'stamp') {
      if (addItem({ k: 'p', s: stamp, c: colour, z: size, a: mirror, x, y })) sfx.plink((stamp % 5) + 3);
      return;
    }
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* not every browser captures a pointer that is already gone */
    }
    active = e.pointerId;
    current = { k: 's', c: brushColour(), z: size, a: mirror, pts: [[x, y]] };
    drawn = 0;
    scheduleTail();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== active || !current) return;
    const list = e.getCoalescedEvents?.() || [];
    for (const ev of list.length ? list : [e]) {
      const p = toGrid(ev);
      const last = current.pts[current.pts.length - 1];
      if (p[0] !== last[0] || p[1] !== last[1]) current.pts.push(p);
    }
    scheduleTail();
  });
  const endStroke = (e) => {
    if (e.pointerId !== active || !current) return;
    const stroke = { ...current, pts: simplify(current.pts, STROKE_TOLERANCE) };
    current = null;
    active = null;
    addItem(stroke);
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);
  canvas.addEventListener('lostpointercapture', endStroke);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function undoLast() {
    if (!session.undo()) return;
    renderAll();
    renderTools();
    scheduleSave();
  }

  function clearPage() {
    shell.showOverlay({
      title: t('teken.clearTitle'),
      text: t('teken.clearText'),
      buttons: [
        [
          t('teken.clearYes'),
          'big primary',
          () => {
            shell.hideOverlay();
            if (!session.clear()) return; // undo brings the drawing back
            renderAll();
            renderTools();
            scheduleSave();
          },
        ],
        [t('common.cancel'), 'big secondary', shell.hideOverlay],
      ],
    });
  }

  // ---------- keeping drawings ----------

  function scheduleSave() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, SAVE_DELAY);
  }

  /**
   * Write the drawing (after a pause, when the app goes to the background; `final` when leaving or
   * finishing). session.js decides what may be kept and when an empty page deletes it.
   */
  function flush(final = false) {
    clearTimeout(saveTimer);
    saveTimer = 0;
    if (!dirty && !final) return lastSave;
    dirty = false;
    lastSave = session.write({ final });
    return lastSave;
  }

  /** The album is full: the free version offers the full one, the full version says so. */
  function albumFull() {
    if (owned()) {
      shell.showOverlay({ title: t('teken.albumFullTitle'), text: t('teken.albumFullText', { max: MAX_DRAWINGS }), buttons: [[t('common.ok'), 'big primary', shell.hideOverlay]] });
    } else shell.offerUnlock(t('teken.fullLead', { free: FREE_DRAWINGS, max: MAX_DRAWINGS }));
  }

  function cantSave() {
    shell.showOverlay({ title: t('teken.cantSaveTitle'), text: t('teken.cantSaveText'), buttons: [[t('common.ok'), 'big primary', shell.hideOverlay]] });
  }

  function finish() {
    if (!hasInk()) return;
    const result = flush(true);
    if (result === 'nospace') {
      albumFull();
      return;
    }
    if (result !== 'saved') {
      cantSave();
      return;
    }
    sfx.chime();
    const page = $('#teken-page');
    page.classList.remove('sparkle');
    void page.offsetWidth;
    page.classList.add('sparkle');
    const token = plays;
    const art = `<img class="ov-kleur ov-teken" src="${thumbCanvas(items(), 150).toDataURL('image/png')}" alt="">`;
    setTimeout(() => {
      if (token !== plays || !onScreen('tekenen')) return;
      page.classList.remove('sparkle');
      // the write itself can fail later (a full storage): then the card says so
      if (store.writeFailing()) {
        cantSave();
        return;
      }
      shell.showOverlay({
        art,
        title: t('teken.doneTitle'),
        text: t('teken.doneText'),
        buttons: [
          [t('teken.new'), 'big primary', () => (albumHasRoom() ? openDrawing(null) : albumFull())],
          [t('teken.keep'), 'big secondary', shell.hideOverlay],
          [t('teken.mine'), 'big secondary', goList],
        ],
      });
    }, 1100);
  }

  function goList() {
    closeTray();
    shell.show('tekenen-list');
  }

  /** Back to "my drawings"; a drawing that cannot be kept asks first. */
  function leave() {
    closeTray();
    if (flush(true) === 'nospace' && hasInk()) {
      shell.showOverlay({
        title: t('teken.notSavedTitle'),
        text: owned() ? t('teken.notSavedFull', { max: MAX_DRAWINGS }) : t('teken.notSavedText', { free: FREE_DRAWINGS }),
        buttons: [
          [t('teken.keep'), 'big primary', shell.hideOverlay],
          [t('teken.stop'), 'big secondary', goList],
        ],
      });
      return;
    }
    goList();
  }

  /** The Android back button: an open row of choices first, then the page. */
  function back() {
    if (tray) closeTray();
    else leave();
  }

  // ---------- palette, tools and the rows of choices ----------

  function offer() {
    shell.offerUnlock(t('teken.lockedLead', { free: FREE_DRAWINGS, max: MAX_DRAWINGS }));
  }

  function renderPalette() {
    const box = $('#teken-palette');
    box.textContent = '';
    PALETTE.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      if (i === WHITE) b.classList.add('white');
      b.style.setProperty('--c', c);
      b.dataset.c = String(i);
      b.setAttribute('aria-label', t(`kleur.colour.${i}`));
      b.addEventListener('click', () => {
        sfx.unlock();
        colour = i;
        if (tool === 'eraser') tool = 'pen';
        renderTools();
      });
      box.appendChild(b);
    });
  }

  function badge(el, locked) {
    el.querySelector('.kleur-badge')?.remove();
    if (locked) el.insertAdjacentHTML('beforeend', `<svg class="kleur-badge lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`);
  }

  function renderTools() {
    for (const b of document.querySelectorAll('#teken-palette .swatch')) b.setAttribute('aria-pressed', String(tool !== 'eraser' && Number(b.dataset.c) === colour));
    for (const b of document.querySelectorAll('#teken-stage .teken-size')) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.z) === size));
      b.style.setProperty('--c', tool === 'eraser' ? '#ffffff' : PALETTE[colour]);
    }
    $('#teken-eraser').setAttribute('aria-pressed', String(tool === 'eraser'));
    $('#teken-undo').disabled = !session.canUndo();
    $('#teken-clear').disabled = !hasInk();
    $('#teken-done').disabled = !hasInk();
    const locked = !owned();
    const st = $('#teken-stamp');
    st.setAttribute('aria-pressed', String(tool === 'stamp'));
    st.querySelector('canvas')?.remove();
    st.prepend(stampIcon(STAMPS[stamp], PALETTE[colour === WHITE ? 2 : colour], 30));
    st.setAttribute('aria-label', locked ? t('teken.locked', { name: t('teken.stamps') }) : `${t('teken.stamps')}: ${t(`teken.stamp.${STAMPS[stamp]}`)}`);
    badge(st, locked);
    const mi = $('#teken-mirror');
    mi.setAttribute('aria-pressed', String(mirror > 0));
    mi.querySelector('svg:not(.kleur-badge)').innerHTML = mirrorIcon(mirror || 4);
    mi.setAttribute('aria-label', locked ? t('teken.locked', { name: t('teken.mirror') }) : mirror ? t('teken.mirrorN', { n: mirror }) : t('teken.mirror'));
    badge(mi, locked);
  }

  function choice(label, pressed, inner, onPick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn icon tool teken-choice';
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-pressed', String(pressed));
    if (typeof inner === 'string') b.innerHTML = inner;
    else b.appendChild(inner);
    b.addEventListener('click', () => {
      tap();
      onPick();
    });
    return b;
  }

  function openTray(kind) {
    const box = $('#teken-tray');
    box.textContent = '';
    box.dataset.kind = kind;
    if (kind === 'stamps') {
      box.setAttribute('aria-label', t('teken.stamps'));
      STAMPS.forEach((name, i) => {
        const b = choice(t(`teken.stamp.${name}`), tool === 'stamp' && stamp === i, stampIcon(name, PALETTE[colour === WHITE ? 2 : colour], 40), () => {
          stamp = i;
          tool = 'stamp';
          closeTray();
          renderTools();
        });
        b.dataset.stamp = name;
        box.appendChild(b);
      });
    } else {
      box.setAttribute('aria-label', t('teken.mirror'));
      for (const n of [0, ...AXES]) {
        const b = choice(n ? t('teken.mirrorN', { n }) : t('teken.mirrorOff'), mirror === n, `<svg viewBox="0 0 24 24" aria-hidden="true">${mirrorIcon(n)}</svg>${n ? `<b>${n}</b>` : ''}`, () => {
          mirror = n;
          closeTray();
          renderGuides();
          renderTools();
        });
        b.dataset.n = String(n);
        box.appendChild(b);
      }
    }
    box.hidden = false;
    tray = kind;
  }

  function closeTray() {
    tray = null;
    const box = $('#teken-tray');
    if (box) box.hidden = true;
  }

  for (const b of document.querySelectorAll('#teken-stage .teken-size')) {
    b.addEventListener('click', () => {
      tap();
      size = Number(b.dataset.z);
      renderTools();
    });
  }
  $('#teken-eraser').addEventListener('click', () => {
    tap();
    tool = tool === 'eraser' ? 'pen' : 'eraser';
    closeTray();
    renderTools();
  });
  $('#teken-stamp').addEventListener('click', () => {
    tap();
    if (!owned()) {
      offer();
      return;
    }
    if (tray === 'stamps') closeTray();
    else openTray('stamps');
  });
  $('#teken-mirror').addEventListener('click', () => {
    tap();
    if (!owned()) {
      offer();
      return;
    }
    if (tray === 'mirror') closeTray();
    else openTray('mirror');
  });
  $('#teken-undo').addEventListener('click', () => {
    tap();
    undoLast();
  });
  $('#teken-clear').addEventListener('click', () => {
    tap();
    clearPage();
  });
  $('#teken-done').addEventListener('click', () => {
    tap();
    finish();
  });
  $('#teken-back').addEventListener('click', () => {
    tap();
    leave();
  });
  for (const [sel, icon] of [['#teken-undo', ICONS.undo], ['#teken-clear', TOOL_ICONS.clear], ['#teken-eraser', TOOL_ICONS.eraser], ['#teken-mirror', mirrorIcon(4)], ['#teken-done', ICONS.done]]) {
    $(sel).insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`);
  }
  renderPalette();
  renderTools();


  return {
    open() {
      shell.show('tekenen-list');
    },
    leave,
    back,
    async init() {
      return true; // everything is drawn in code: nothing to load
    },
    testHook() {
      const g = ([fx, fy]) => [clampCoord(fx * GRID), clampCoord(fy * GRID)];
      return {
        open: (key = null) => openDrawing(key),
        stroke: (pts) => addItem({ k: 's', c: brushColour(), z: size, a: mirror, pts: simplify(pts.map(g), STROKE_TOLERANCE) }),
        stamp: (kind, fx, fy) => addItem({ k: 'p', s: STAMPS.indexOf(kind), c: colour, z: size, a: mirror, x: g([fx, fy])[0], y: g([fx, fy])[1] }),
        pick: (c) => {
          colour = c;
          if (tool === 'eraser') tool = 'pen';
          renderTools();
        },
        size: (z) => {
          size = z;
          renderTools();
        },
        mirror: (n) => {
          mirror = n; // bypasses the lock, like Kleurplaten's hook
          renderGuides();
          renderTools();
        },
        undo: () => undoLast(),
        finish: () => finish(),
        flush: () => flush(),
        state: () => ({
          id: session.id,
          items: visible(items()).length,
          history: items().length,
          canUndo: session.canUndo(),
          colour,
          size,
          tool,
          stamp: STAMPS[stamp],
          mirror,
          copies: transforms(mirror).length,
          tray,
          kept: session.kept(),
          lastSave,
          px,
        }),
        drawings: () => store.loadDrawings(meta.id),
        /** The colour on the page at (fx, fy), 0-1 from the top left, as [r, g, b]. */
        pixel: (fx, fy) => [...ctx.getImageData(Math.floor(fx * (px - 1)), Math.floor(fy * (px - 1)), 1, 1).data.slice(0, 3)],
      };
    },
  };
}
