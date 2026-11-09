// Kleurplaten: tap a colour, tap a part of the picture, and it is coloured. Pictures for the
// youngest (pictures.js), mandalas for older children (mandala.js; in the full version endless new
// ones). Every page is saved as it is coloured (storage.js saveArt), so "Mijn kleurplaten" shows it
// again later. No reading is needed: the list is pictures, the palette is colours.
// The shell (web/js/main.js) owns the overlay card, the sound settings and the purchase.
import { meta } from './meta.js';
import { PICTURES, FREE_PICTURES } from './pictures.js';
import { MANDALA_TIERS, FREE_MANDALAS } from './mandala.js';
import { pageFor, pictureKey, mandalaKey, FREE_MANDALA_KEYS, targets } from './pages.js';
import { PALETTE, WHITE, pageSvg, ICONS } from './art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';
import { newSeed, randomCard } from '../../js/random.js';

const $ = (sel) => document.querySelector(sel);
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const CHECK = '<path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>';
const SAVE_DELAY = 400; // ms after the last tap before the page is written
export const TOTAL_PAGES = PICTURES.length + FREE_MANDALAS.length;

export function createKleuren(shell) {
  const { t, tap } = shell;
  let page = null; // the page on the screen (pages.js pageFor)
  let fills = {}; // region id -> palette index (white is never stored)
  let done = false;
  let undo = []; // [[[region, before, after], ...], ...]
  let colour = 0; // the chosen palette index
  let mirror = false; // mandalas: colour all copies at once
  let zoomed = false;
  let saveTimer = 0;
  let plays = 0; // a late "done" card never lands on a newer page

  const owned = () => shell.unlock.owned;
  const locked = (p) => !p.free && !owned();
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const nameOf = (p) => (p.kind === 'picture' ? t(`kleur.pic.${p.name}`) : t('kleur.mandala'));

  shell.unlock.onChange(() => onScreen('kleuren-list') && renderList());
  shell.onShow((name) => {
    if (name === 'kleuren-list') renderList();
    if (name === 'kleuren') requestAnimationFrame(fit);
  });
  shell.onLangChange(() => {
    if (onScreen('kleuren-list')) renderList();
    if (page) renderHud();
  });
  window.addEventListener('resize', () => onScreen('kleuren') && fit());
  document.addEventListener('visibilitychange', () => document.hidden && flush());

  // ---------- the list ----------

  function card(p, saved, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kleur-card';
    b.dataset.page = p.key;
    const isLocked = locked(p);
    b.innerHTML = pageSvg(p, saved?.f || {}, { cls: 'kleur-thumb' });
    if (isLocked) {
      b.classList.add('locked');
      b.insertAdjacentHTML('beforeend', `<svg class="kleur-badge lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`);
      b.setAttribute('aria-label', t('kleur.pageLocked', { name: nameOf(p) }));
    } else {
      if (saved?.done) b.insertAdjacentHTML('beforeend', `<svg class="kleur-badge check" viewBox="0 0 24 24" aria-hidden="true">${CHECK}</svg>`);
      const state = saved?.done ? 'kleur.pageDone' : saved ? 'kleur.pageBusy' : 'kleur.pageNew';
      b.setAttribute('aria-label', t(state, { name: nameOf(p) }));
    }
    b.addEventListener('click', () => {
      tap();
      if (isLocked) offer();
      else onClick();
    });
    return b;
  }

  function section(title, age, cls = '') {
    const head = document.createElement('h3');
    head.className = 'dogu-size';
    head.innerHTML = '<span class="dogu-size-n"></span><span class="dogu-size-age"></span>';
    head.querySelector('.dogu-size-n').textContent = title;
    if (age) head.querySelector('.dogu-size-age').textContent = age;
    else head.querySelector('.dogu-size-age').remove(); // "my pictures" has no age
    const grid = document.createElement('div');
    grid.className = `level-grid kleur-grid ${cls}`;
    $('#kleur-list').append(head, grid);
    return grid;
  }

  function renderList() {
    const box = $('#kleur-list');
    box.textContent = '';
    const art = store.loadArt(meta.id);
    // my pictures: everything coloured so far, newest first (new mandalas can only be found here)
    const mine = Object.entries(art)
      .filter(([key]) => pageFor(key))
      .sort((a, b) => (b[1].t || 0) - (a[1].t || 0));
    if (mine.length) {
      const grid = section(t('kleur.mine'), '', 'kleur-mine');
      for (const [key, saved] of mine) {
        const p = pageFor(key);
        grid.appendChild(card(p, saved, () => openPage(key)));
      }
    }
    const pics = section(t('kleur.pictures'), t('kleur.picturesAge'));
    for (const pic of PICTURES) {
      const key = pictureKey(pic.id);
      pics.appendChild(card(pageFor(key), art[key], () => openPage(key)));
    }
    const mand = section(t('kleur.mandalas'), t('kleur.mandalasAge'));
    for (const key of FREE_MANDALA_KEYS) mand.appendChild(card(pageFor(key), art[key], () => openPage(key)));
    const solved = store.loadRandomSolved(meta.id);
    for (const tier of Object.keys(MANDALA_TIERS)) {
      const age = MANDALA_TIERS[tier].age;
      const c = randomCard({
        t,
        tap,
        title: t(age === 7 ? 'kleur.newShort7' : 'kleur.newShort9'),
        locked: !owned(),
        done: true,
        solved: solved[tier] || 0,
        onPlay: () => newMandala(tier),
        onLocked: offer,
      });
      c.setAttribute('aria-label', `${t(age === 7 ? 'kleur.newMandala7' : 'kleur.newMandala9')}${owned() ? '' : `, ${t('random.full')}`}`);
      c.dataset.tier = tier;
      mand.appendChild(c);
    }
  }

  function offer() {
    shell.offerUnlock(t('kleur.lockedLead', { free: FREE_PICTURES + FREE_MANDALAS.length, total: TOTAL_PAGES }));
  }

  // ---------- colouring ----------

  function openPage(key) {
    const p = pageFor(key);
    if (!p) return;
    if (locked(p)) {
      offer();
      return;
    }
    flush();
    plays++;
    page = p;
    const saved = store.loadArt(meta.id)[key];
    fills = { ...(saved?.f || {}) };
    done = !!saved?.done;
    undo = [];
    mirror = p.kind === 'mandala' && p.symmetry;
    zoomed = false;
    renderHud();
    renderPage();
    renderTools();
    shell.show('kleuren');
  }

  function newMandala(tier, seed = null) {
    if (!owned()) {
      offer();
      return;
    }
    openPage(mandalaKey(tier, seed ?? newSeed() % 1e9));
  }

  function renderHud() {
    $('#kleur-title').textContent = nameOf(page);
    $('#kleur-sub').textContent = page.kind === 'picture' ? t('kleur.pictures') : t(page.tier === 'm1' ? 'kleur.newMandala7' : 'kleur.newMandala9').replace(/^[^,]*, /, '');
  }

  function renderPage() {
    const box = $('#kleur-page');
    box.innerHTML = pageSvg(page, fills, { live: true, cls: `kleur-svg ${page.kind}` });
    box.classList.toggle('zoom', zoomed);
    box.scrollTo?.(0, 0);
  }

  function paintRegion(id, c) {
    const el = $(`#kleur-page path[data-r="${CSS.escape(id)}"]`);
    if (el) el.setAttribute('fill', Number.isInteger(c) ? PALETTE[c] : '#ffffff');
  }

  /** Colour region `id` (and its copies when mirroring) with the chosen colour. */
  function paint(id) {
    if (!page) return false;
    const ids = targets(page, id, mirror);
    const next = colour === WHITE ? undefined : colour;
    const changes = ids.map((r) => [r, fills[r], next]).filter(([, before, after]) => before !== after);
    if (!changes.length) return false;
    apply(changes, 2);
    undo.push(changes);
    sfx.plink((colour % 9) + 1);
    return true;
  }

  /** Apply changes: k = 2 sets the "after" colour, k = 1 the "before" one (undo). */
  function apply(changes, k) {
    for (const ch of changes) {
      const c = ch[k];
      if (c === undefined) delete fills[ch[0]];
      else fills[ch[0]] = c;
      paintRegion(ch[0], c);
    }
    renderTools();
    scheduleSave();
  }

  function undoLast() {
    const last = undo.pop();
    if (!last) return;
    apply(last, 1);
  }

  function restart() {
    shell.showOverlay({
      title: t('kleur.restartTitle'),
      text: t('kleur.restartText'),
      buttons: [
        [
          t('kleur.restartYes'),
          'big primary',
          () => {
            shell.hideOverlay();
            const changes = Object.entries(fills).map(([r, c]) => [r, c, undefined]);
            if (changes.length) {
              apply(changes, 2);
              undo.push(changes);
            }
            done = false;
            scheduleSave();
          },
        ],
        [t('common.cancel'), 'big secondary', shell.hideOverlay],
      ],
    });
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, SAVE_DELAY);
  }

  /** Write the page now (after a pause in tapping, when leaving, when the app goes to the background). */
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    if (!page) return;
    const before = store.loadArt(meta.id)[page.key];
    if (!before && !Object.keys(fills).length && !done) return; // an untouched page is not saved
    store.saveArt(meta.id, page.key, { f: fills, done });
  }

  function finish() {
    const first = !done;
    done = true;
    flush();
    if (first && page.random) store.recordRandomSolved(meta.id, page.tier);
    sfx.chime();
    const stage = $('#kleur-page');
    stage.classList.remove('sparkle');
    void stage.offsetWidth;
    stage.classList.add('sparkle');
    const token = plays;
    const finished = page;
    setTimeout(() => {
      if (token !== plays || !onScreen('kleuren')) return;
      stage.classList.remove('sparkle');
      doneCard(finished);
    }, 1100);
  }

  function doneCard(p) {
    const buttons = [];
    if (p.kind === 'picture') {
      const next = PICTURES.slice(p.index + 1).map((x) => pageFor(pictureKey(x.id))).find((x) => !locked(x));
      if (next) buttons.push([t('kleur.next'), 'big primary', () => openPage(next.key)]);
    } else if (owned()) {
      buttons.push([t('kleur.newOne'), 'big primary', () => newMandala(p.tier)]);
    }
    buttons.push([t('kleur.list'), buttons.length ? 'big secondary' : 'big primary', leave]);
    shell.showOverlay({ art: pageSvg(p, fills, { cls: 'ov-kleur' }), title: t('kleur.doneTitle'), text: t('kleur.doneText'), buttons });
  }

  function leave() {
    flush();
    shell.show('kleuren-list');
  }

  // ---------- palette and tools ----------

  function renderPalette() {
    const box = $('#kleur-palette');
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
        renderTools();
      });
      box.appendChild(b);
    });
  }

  function renderTools() {
    for (const b of document.querySelectorAll('#kleur-palette .swatch')) b.setAttribute('aria-pressed', String(Number(b.dataset.c) === colour));
    $('#kleur-undo').disabled = !undo.length;
    const isMandala = page?.kind === 'mandala';
    $('#kleur-mirror').hidden = !isMandala;
    $('#kleur-zoom').hidden = !isMandala;
    $('#kleur-mirror').setAttribute('aria-pressed', String(mirror));
    $('#kleur-zoom').setAttribute('aria-pressed', String(zoomed));
  }

  /** The page as large as fits: square, beside or above the palette. */
  function fit() {
    const stage = $('#kleur-stage');
    const side = window.innerWidth > window.innerHeight * 1.2;
    stage.classList.toggle('side', side);
    const panel = $('#kleur-stage .kleur-side');
    const w = stage.clientWidth - 24 - (side ? panel.offsetWidth + 16 : 0);
    const h = stage.clientHeight - 16 - (side ? 0 : panel.offsetHeight + 12);
    const size = Math.max(160, Math.floor(Math.min(w, h, 720)));
    const el = $('#kleur-page');
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
  }

  $('#kleur-page').addEventListener('click', (e) => {
    const path = e.target.closest?.('path[data-r]');
    if (!path) return;
    sfx.unlock();
    paint(path.dataset.r);
  });
  $('#kleur-back').addEventListener('click', () => {
    tap();
    leave();
  });
  $('#kleur-undo').addEventListener('click', () => {
    tap();
    undoLast();
  });
  $('#kleur-restart').addEventListener('click', () => {
    tap();
    restart();
  });
  $('#kleur-mirror').addEventListener('click', () => {
    tap();
    mirror = !mirror;
    renderTools();
  });
  $('#kleur-zoom').addEventListener('click', () => {
    tap();
    zoomed = !zoomed;
    $('#kleur-page').classList.toggle('zoom', zoomed);
    renderTools();
  });
  $('#kleur-done').addEventListener('click', () => {
    tap();
    finish();
  });
  for (const [id, icon] of [['#kleur-undo', ICONS.undo], ['#kleur-restart', ICONS.restart], ['#kleur-mirror', ICONS.mirror], ['#kleur-zoom', ICONS.zoom], ['#kleur-done', ICONS.done]]) {
    $(id).insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`);
  }
  renderPalette();
  onLangPalette();
  function onLangPalette() {
    shell.onLangChange(() => {
      for (const b of document.querySelectorAll('#kleur-palette .swatch')) b.setAttribute('aria-label', t(`kleur.colour.${b.dataset.c}`));
    });
  }

  return {
    open() {
      shell.show('kleuren-list');
    },
    leave,
    async init() {
      return true; // everything is drawn in code: nothing to load
    },
    testHook() {
      return {
        open: (key) => openPage(key),
        newMandala: (tier, seed) => newMandala(tier, seed),
        paint: (id) => paint(id),
        pick: (c) => {
          colour = c;
          renderTools();
        },
        mirror: (on) => {
          mirror = !!on;
          renderTools();
        },
        undo: () => undoLast(),
        finish: () => finish(),
        flush: () => flush(),
        state: () => ({ key: page?.key || null, kind: page?.kind || null, fills: { ...fills }, done, undo: undo.length, colour, mirror, zoomed, regions: page ? page.regions.map((r) => r.id) : [] }),
        art: () => store.loadArt(meta.id),
      };
    },
  };
}
