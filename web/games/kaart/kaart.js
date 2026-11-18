// Kaartpuzzel (Map Puzzle): topography with map packs. The continents and Europe for everyone, and
// the child's own country (the Netherlands, the United States, the United Kingdom) when the device
// says so; the menu can pick another country. Two ways to play a pack: a puzzle (drag every region
// onto the map; close by, it snaps in) and "Waar ligt...?" (a name is shown, tap the region, a
// capital or an ocean). Calm: no timers; a wrong drop or tap is a gentle bounce, and after two the
// right place glows. Stars by mistakes. Nothing is spoken.
//
// The maps are pure data (packs/<id>.js, made by tools/gen-kaart.mjs from Natural Earth); what a tap
// or a drop means is pure (map.js), the rounds too (rounds.js). This file draws and listens. The map
// is one SVG: the world layer (sea, land around, regions) is scaled to fit and, on a small phone with
// tiny regions, by the magnifier; marks and names are drawn on top in screen px.
//
// Saved (games.kaart): stars per round ("nl-t2-1", only ever raised), the last pack, the country
// picked in the menu, and which how-to cards were seen. An unfinished round is kept while the app
// stays open ("keep playing").
import { meta } from './meta.js';
import { PACK_IDS, COUNTRY_IDS, FREE_PACK, packInfo, defaultCountry, menuPacks, loadPack } from './packs.js';
import { TIERS, TIER_IDS, MAX_TRIES, roundsOf, makeRound, roundId, parseRoundId, nextRound, starsFor, sameNameAsRegion } from './rounds.js';
import { shapeOf, hitRegion, hitPoint, snaps, fitMap, zoomFor, fiddly } from './map.js';
import { clampPan, zoomAround } from '../legpuzzel/rules.js';
import { howSvg } from './art.js';
import { addStrings, getLang } from '../../js/i18n.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const LOUPE = '<circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15 15l5.5 5.5M10 7v6M7 10h6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';
const PIECE = '<path d="M5 9h3.2a2.3 2.3 0 1 1 4.6 0H16v3.2a2.3 2.3 0 1 1 0 4.6V20H5z" fill="currentColor"/>';
const FINGER = 22; // px: how far from a small region's centre a tap still picks it
const LIFT = 44; // px: a piece dragged by a finger is drawn this far above it, so the finger never hides it
const MOVE = 8; // px: a finger that moves further pans the map instead of tapping
const MARK = 14; // px: a region drawn smaller than this gets a dashed ring, so it can be seen
// the colours of placed and found regions: soft, different enough side by side, dark borders on all
const COLOURS = ['#ffb4a2', '#a8dadc', '#ffd166', '#b5e48c', '#cdb4db', '#f4a261', '#90caf9', '#f7a1c4'];
const sw = (n) => Math.round(n * 10) / 10;

export function createKaart(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  /** The child's country: picked in the menu ('none' too), else what the device's language says. */
  const country = () => {
    const v = store.loadGameOption(meta.id, 'country', null);
    if (v === 'none') return null;
    if (COUNTRY_IDS.includes(v)) return v;
    return defaultCountry(globalThis.navigator?.language);
  };
  const lastPack = () => {
    const v = store.loadGameOption(meta.id, 'lastPack', null);
    const shown = menuPacks(country());
    if (shown.includes(v)) return v;
    return country() || FREE_PACK;
  };
  const locked = (pack, tier) => meta.isLocked({ pack, tier }, shell.unlock.owned);

  let menuPack = null; // the pack shown in the menu
  let menuToken = 0;
  // { packId, pack, tier, r, roundId, kind, lines, items, i, placed: [], tries: {}, missed: {},
  //   mistakes, results: [], glow, selected, waiting, done }
  let game = null;
  let plays = 0;
  let timer = null;
  let geo = null; // { w, h, s, ox, oy, side }
  const view = { z: 1, at: { x: 0, y: 0 }, max: 1 };
  let drag = null; // { id, pointer, lift, x, y }
  let press = null; // a finger on the map: { pointer, x, y, at, moved }

  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const region = (id) => game.pack.regions.find((g) => g.id === id);
  const point = (id) => game.pack.points.list.find((p) => p.id === id);
  const nameOf = (kind, id) => t(`kaart.${kind}.${game.packId}.${id}`);

  shell.unlock.onChange(() => {
    if (onScreen('kaart-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'kaart-menu') renderMenu();
    if (name !== 'kaart') {
      clearTimer();
      endDrag();
    }
  });
  shell.onLangChange(() => {
    if (onScreen('kaart-menu')) renderMenu();
    if (game && !game.done && onScreen('kaart')) renderTexts();
  });

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }
  function later(ms, fn) {
    clearTimer();
    const token = plays;
    timer = setTimeout(() => {
      timer = null;
      if (token === plays && game && onScreen('kaart')) fn();
    }, ms);
  }

  /** A pack's names go into the string tables once, so every name on screen goes through t(). */
  const named = new Set();
  function addNames(pack) {
    if (named.has(pack.id)) return;
    named.add(pack.id);
    const table = { nl: {}, en: {} };
    for (const g of pack.regions) for (const l of ['nl', 'en']) table[l][`kaart.r.${pack.id}.${g.id}`] = g[l];
    for (const p of pack.points?.list || []) for (const l of ['nl', 'en']) table[l][`kaart.p.${pack.id}.${p.id}`] = p[l];
    addStrings(table);
  }

  // ---------- menu ----------

  function starsText(n) {
    return [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  }

  function renderMenu() {
    const box = $('#kaart-menu');
    const token = ++menuToken;
    if (!menuPack || !menuPacks(country()).includes(menuPack)) menuPack = lastPack();
    box.textContent = '';
    if (game && !game.done) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'kaart-continue';
      cont.className = 'btn big secondary klok-continue';
      cont.textContent = t('kaart.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      box.appendChild(cont);
    }
    const packs = document.createElement('div');
    packs.className = 'km-packs';
    packs.setAttribute('role', 'group');
    packs.setAttribute('aria-label', t('kaart.packs'));
    for (const id of menuPacks(country())) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'km-pack';
      b.dataset.pack = id;
      b.setAttribute('aria-pressed', String(id === menuPack));
      b.textContent = t(`kaart.pack.${id}`);
      b.addEventListener('click', () => {
        tap();
        menuPack = id;
        store.saveGameOption(meta.id, 'lastPack', id);
        renderMenu();
      });
      packs.appendChild(b);
    }
    const other = document.createElement('button');
    other.type = 'button';
    other.id = 'kaart-country';
    other.className = 'km-pack other';
    other.textContent = t('kaart.otherCountry');
    other.addEventListener('click', () => {
      tap();
      pickCountry();
    });
    packs.appendChild(other);
    box.appendChild(packs);
    const head = document.createElement('div');
    head.className = 'km-menu-art';
    head.innerHTML = howSvg();
    box.appendChild(head);
    const tiers = document.createElement('div');
    tiers.id = 'kaart-tiers';
    box.appendChild(tiers);
    const packId = menuPack;
    loadPack(packId).then((pack) => {
      if (token !== menuToken) return;
      addNames(pack);
      const got = stars();
      for (const tier of TIER_IDS) {
        const rounds = roundsOf(pack, tier);
        if (!rounds.length) continue;
        const line = document.createElement('p');
        line.className = 'klok-age';
        const what = tier === 't3' ? `kaart.tier.t3.${pack.points?.kind === 'sea' ? 'seas' : 'cities'}` : `kaart.tier.${tier}`;
        line.textContent = t('kaart.tierLine', { age: TIERS[tier].age, what: t(what) });
        tiers.appendChild(line);
        const grid = document.createElement('div');
        grid.className = 'level-grid klok-grid';
        grid.dataset.tier = tier;
        rounds.forEach((rd, k) => {
          const r = k + 1;
          const id = roundId(packId, tier, r);
          const b = document.createElement('button');
          b.type = 'button';
          b.className = `level-btn km-round ${rd.kind}`;
          b.dataset.round = id;
          const icon = rd.kind === 'puzzle' ? `<svg class="km-kind" viewBox="0 0 24 24" aria-hidden="true">${PIECE}</svg>` : '';
          if (locked(packId, tier)) {
            b.classList.add('locked');
            b.innerHTML = `<span class="num">${r}</span><svg viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
            b.setAttribute('aria-label', t('kaart.roundLocked', { n: r }));
            b.addEventListener('click', () => {
              tap();
              offer();
            });
          } else {
            const n = got[id] || 0;
            b.innerHTML = `${icon}<span class="num">${r}</span><span class="stars" aria-hidden="true">${starsText(n)}</span>`;
            b.setAttribute('aria-label', n ? t('kaart.roundStars', { n: r, stars: n }) : t('kaart.roundOpen', { n: r }));
            b.addEventListener('click', () => {
              tap();
              startRound(id);
            });
          }
          grid.appendChild(b);
        });
        tiers.appendChild(grid);
      }
    }).catch((e) => console.error('kaart: pack', packId, e));
  }

  /** "Ander land": the country packs (and none); the one picked joins the menu, saved. */
  function pickCountry() {
    const choose = (v) => () => {
      store.saveGameOption(meta.id, 'country', v || 'none');
      if (v) {
        menuPack = v;
        store.saveGameOption(meta.id, 'lastPack', v);
      }
      shell.hideOverlay();
      renderMenu();
    };
    shell.showOverlay({
      title: t('kaart.countryTitle'),
      text: t('kaart.countryText'),
      buttons: [
        ...COUNTRY_IDS.map((id) => [t(`kaart.pack.${id}`), `big ${id === country() ? 'primary' : 'secondary'}`, choose(id)]),
        [t('kaart.noCountry'), `big ${country() ? 'secondary' : 'primary'}`, choose(null)],
      ],
    });
  }

  $('#kaart-menu-back').addEventListener('click', () => {
    tap();
    shell.show('home');
  });

  function offer() {
    shell.offerUnlock(t('kaart.lockedLead'));
  }

  // ---------- rounds ----------

  async function startRound(id) {
    const p = parseRoundId(id);
    if (!p || !PACK_IDS.includes(p.pack) || !TIER_IDS.includes(p.tier)) return;
    if (locked(p.pack, p.tier)) {
      offer();
      return;
    }
    const pack = await loadPack(p.pack);
    const round = makeRound(pack, p.tier, p.r);
    if (!round) return;
    addNames(pack);
    plays++;
    clearTimer();
    endDrag();
    store.saveGameOption(meta.id, 'lastPack', p.pack);
    menuPack = p.pack;
    game = { packId: p.pack, pack, tier: p.tier, r: p.r, roundId: id, ...round, i: 0, placed: [], tries: {}, missed: {}, mistakes: 0, results: [], glow: null, selected: null, waiting: false, done: false, found: [] };
    view.z = 1;
    view.at = { x: 0, y: 0 };
    shell.show('kaart');
    buildMap();
    render();
    // pieces too small to drop well at this size (Europe, the US on a phone): the magnifier is on
    // from the start (with the borders; a zoomed map without them
    // would be one plain colour, so there the child zooms when they want)
    if (geo && game.kind === 'puzzle' && game.lines && view.max > 1 && fiddly(game.pack, game.items, geo.s)) {
      // the first such piece's place in the middle (the child pans for the others)
      const first = game.items.map(region).find((g) => fiddly(game.pack, [g.id], geo.s));
      setZoom(true);
      view.at = clampPan({ x: geo.w / 2 - view.z * (geo.ox + geo.s * first.c[0]), y: geo.h / 2 - view.z * (geo.oy + geo.s * first.c[1]) }, geo.w, geo.h, view.z);
      applyView();
    }
    if (!seenHow()[game.kind]) {
      shell.showOverlay({
        art: `<span class="km-ov">${howSvg()}</span>`,
        title: t('kaart.howTitle'),
        text: t(`kaart.how.${game.kind === 'point' ? `point.${game.pack.points.kind}` : game.kind}`),
        buttons: [
          [
            t('common.ok'),
            'big primary',
            () => {
              store.saveGameOption(meta.id, 'howSeen', { ...seenHow(), [game.kind]: true });
              shell.hideOverlay();
            },
          ],
        ],
      });
    }
  }

  function resume() {
    if (!game || game.done) return;
    shell.show('kaart');
    layout();
    // left while a right answer or the last piece was being shown: go on from there
    if (game.waiting) {
      if (game.kind === 'puzzle') finish();
      else nextQuestion();
    }
  }

  function leave() {
    clearTimer();
    endDrag();
    shell.hideOverlay();
    shell.show('kaart-menu');
  }
  $('#kaart-back').addEventListener('click', () => {
    tap();
    leave();
  });

  // ---------- the map ----------

  /** The world layer: the sea, the land around, one path per region. Made once per round. */
  function buildMap() {
    const { pack } = game;
    const regions = pack.regions.map((g, k) => `<path class="km-reg" data-id="${g.id}" data-k="${k % COLOURS.length}" d="${g.d}"/>`).join('');
    $('#km-world').innerHTML = `<rect class="km-sea" x="0" y="0" width="${pack.w}" height="${pack.h}"/>${pack.bg ? `<path class="km-bg" d="${pack.bg}"/>` : ''}<g id="km-regions">${regions}</g>`;
    $('#screen-kaart').dataset.kind = game.kind;
    $('#screen-kaart').dataset.lines = String(game.lines);
    $('#screen-kaart').dataset.silhouette = String(packInfo(game.packId).silhouette);
    $('#screen-kaart').dataset.pack = game.packId;
  }

  /** Every region's look: placed or found (coloured), empty, glowing. */
  function paintRegions() {
    const placed = new Set(game.kind === 'puzzle' ? game.placed : game.kind === 'where' ? game.found : []);
    for (const el of document.querySelectorAll('#km-regions .km-reg')) {
      const id = el.dataset.id;
      const on = placed.has(id);
      el.classList.toggle('on', on);
      el.style.fill = on ? COLOURS[Number(el.dataset.k)] : '';
      el.classList.toggle('glow', game.glow === id && game.kind !== 'point');
      // a puzzle shows only the slots of this round's pieces and what is placed; others are land
      el.classList.toggle('slot', game.kind === 'puzzle' && game.items.includes(id) && !on);
    }
  }

  /** Measure the box, fit the map, keep the magnifier's view inside it. */
  function layout() {
    if (!game || !onScreen('kaart')) return;
    const stage = $('#km-stage');
    stage.classList.toggle('side', stage.clientWidth > stage.clientHeight * 1.1);
    const box = $('#km-mapbox');
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    const fit = fitMap(game.pack, w, h);
    geo = { w, h, ...fit };
    const svg = $('#km-map');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    view.max = zoomFor(game.pack, fit.s);
    if (view.max === 1) view.z = 1;
    else if (view.z > 1) view.z = view.max;
    view.at = clampPan(view.at, w, h, view.z);
    applyView();
    renderTray();
  }

  const scale = () => geo.s * view.z;
  const toBox = ([x, y]) => [view.at.x + view.z * (geo.ox + geo.s * x), view.at.y + view.z * (geo.oy + geo.s * y)];
  const toWorld = (bx, by) => [((bx - view.at.x) / view.z - geo.ox) / geo.s, ((by - view.at.y) / view.z - geo.oy) / geo.s];

  function applyView() {
    if (!geo) return;
    $('#km-world').setAttribute('transform', `translate(${sw(view.at.x)} ${sw(view.at.y)}) scale(${view.z}) translate(${sw(geo.ox)} ${sw(geo.oy)}) scale(${geo.s.toFixed(5)})`);
    const z = $('#kaart-zoom');
    z.hidden = view.max === 1;
    z.setAttribute('aria-pressed', String(view.z > 1));
    drawOver();
  }

  /** Marks, dots and names on top of the map, in screen px (they never scale). */
  function drawOver() {
    if (!game || !geo) return;
    const out = [];
    const { pack } = game;
    const sc = scale();
    const tiny = (g) => shapeOf(g).size * sc < MARK;
    const placed = new Set(game.kind === 'puzzle' ? game.placed : game.found);
    // a ring on a region too small to see, where a piece can go or a tap counts
    for (const g of pack.regions) {
      if (!tiny(g) || placed.has(g.id)) continue;
      if (game.kind === 'puzzle' && (!game.items.includes(g.id) || !game.lines)) continue;
      if (game.kind === 'point') continue;
      const [x, y] = toBox(g.c);
      out.push(`<circle class="km-mark" cx="${sw(x)}" cy="${sw(y)}" r="7"/>`);
    }
    // the capitals as dots; the oceans' names
    if (game.kind === 'point' && pack.points.kind === 'city') {
      for (const p of pack.points.list) {
        const [x, y] = toBox(p.at[0]);
        const right = game.found.includes(p.id);
        out.push(`<circle class="km-dot${right ? ' on' : ''}${game.glow === p.id ? ' glow' : ''}" data-id="${p.id}" cx="${sw(x)}" cy="${sw(y)}" r="${right ? 8 : 6.5}"/>`);
      }
    }
    if (pack.points?.kind === 'sea') {
      for (const p of pack.points.list) {
        const shown = game.kind !== 'point' || game.found.includes(p.id);
        const glow = game.kind === 'point' && game.glow === p.id;
        if (!shown && !glow) continue;
        const [x, y] = toBox(p.at[0]);
        out.push(`<text class="km-sea-name${glow ? ' glow' : ''}" x="${sw(x)}" y="${sw(y)}">${esc(t(`kaart.p.${pack.id}.${p.id}`))}</text>`);
      }
    }
    // the glowing place after two tries
    if (game.glow) {
      const at = game.kind === 'point' ? point(game.glow)?.at[0] : region(game.glow)?.c;
      if (at) {
        const [x, y] = toBox(at);
        out.push(`<circle class="km-ring" cx="${sw(x)}" cy="${sw(y)}" r="${game.kind === 'point' ? 16 : 20}"/>`);
      }
    }
    // names of what is placed or found (when they fit), capitals with their name
    const names = [];
    if (game.kind === 'point' && pack.points.kind === 'city') {
      for (const id of game.found) names.push([point(id).at[0], t(`kaart.p.${pack.id}.${id}`), true]);
    } else {
      for (const id of placed) {
        const g = region(id);
        const label = t(`kaart.r.${pack.id}.${id}`);
        const [x0, , x1] = shapeOf(g).box;
        if ((x1 - x0) * sc >= label.length * 6.2 || id === game.last) names.push([g.c, label, false]);
      }
    }
    for (const [at, label, dot] of names) {
      const [x, y] = toBox(at);
      if (x < 0 || y < 0 || x > geo.w || y > geo.h) continue; // out of the magnifier's view
      const cx = Math.max(label.length * 3.6 + 4, Math.min(geo.w - label.length * 3.6 - 4, x));
      out.push(`<text class="km-name" x="${sw(cx)}" y="${sw(dot ? y - 12 : y + 4)}">${esc(label)}</text>`);
    }
    $('#km-over').innerHTML = out.join('');
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function setZoom(on, cx = geo.w / 2, cy = geo.h / 2) {
    const z = on && view.max > 1 ? view.max : 1;
    view.at = zoomAround(view.at, view.z, z, cx, cy, geo.w, geo.h);
    view.z = z;
    applyView();
  }
  $('#kaart-zoom').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${LOUPE}</svg>`;
  $('#kaart-zoom').addEventListener('click', () => {
    tap();
    if (!game || !geo) return;
    // zoom in where the glow is, else the middle
    let c = [geo.w / 2, geo.h / 2];
    if (game.glow && view.z === 1) c = toBox(game.kind === 'point' ? point(game.glow).at[0] : region(game.glow).c);
    setZoom(view.z === 1, ...c);
  });

  const resize = new ResizeObserver(() => layout());
  resize.observe($('#km-mapbox'));
  resize.observe($('#km-stage'));

  // ---------- texts ----------

  function render() {
    paintRegions();
    renderTexts();
    setStatus('');
    layout();
  }

  function renderTexts() {
    $('#km-sub').textContent = t(`kaart.pack.${game.packId}`);
    $('#km-title').textContent = t('kaart.round', { n: game.r });
    $('#km-map').setAttribute('aria-label', t('kaart.map', { pack: t(`kaart.pack.${game.packId}`) }));
    $('#kaart-zoom').setAttribute('aria-label', t('kaart.zoom'));
    renderAsk();
    renderDots();
    renderTray();
    drawOver();
  }

  function askName() {
    const id = game.items[game.i];
    if (game.kind === 'where') return nameOf('r', id);
    const p = point(id);
    const name = nameOf('p', id);
    return game.pack.points.kind === 'city' && sameNameAsRegion(game.pack, p, getLang()) ? t('kaart.city', { name }) : name;
  }

  function renderAsk() {
    const box = $('#km-ask');
    if (game.kind === 'puzzle') {
      box.innerHTML = `<span class="km-lead">${esc(t(game.lines ? 'kaart.lead.puzzle' : 'kaart.lead.puzzleBlank'))}</span>`;
      return;
    }
    if (game.done || game.i >= game.items.length) return;
    const name = askName();
    const [a, b] = t('kaart.where', { name: '\u0000' }).split('\u0000');
    box.innerHTML = `<span class="km-q">${esc(a)}<b id="km-name">${esc(name)}</b>${esc(b)}</span>`;
  }

  function renderDots() {
    const box = $('#km-dots');
    box.textContent = '';
    const n = game.items.length;
    const done = game.results.length;
    // a long puzzle (the whole map) shows a count instead of 40 dots
    if (n > 12) {
      box.innerHTML = `<span class="km-count">${t('kaart.progress', { done, total: n })}</span>`;
    } else {
      for (let k = 0; k < n; k++) {
        const d = document.createElement('span');
        const r = game.results[k];
        d.className = `klok-dot${r === true ? ' good' : r === false ? ' bad' : ''}${k === done && !game.done ? ' now' : ''}`;
        box.appendChild(d);
      }
    }
    box.setAttribute('aria-label', t('kaart.progress', { done, total: n }));
  }

  function setStatus(text) {
    $('#km-status').textContent = text;
  }

  // ---------- the tray (puzzle) ----------

  /** The next pieces, as many as fit; the rest wait (a count shows how many). */
  function renderTray() {
    const tray = $('#km-tray');
    if (!game || game.kind !== 'puzzle') {
      tray.hidden = true;
      tray.textContent = '';
      tray.dataset.shown = '';
      return;
    }
    tray.hidden = false;
    const left = game.items.filter((id) => !game.placed.includes(id));
    const side = $('#km-stage').classList.contains('side');
    const room = side ? tray.clientHeight : tray.clientWidth;
    const chip = side ? 92 : 88;
    const fit = Math.max(1, Math.floor((room + 8) / chip));
    const shown = left.length > fit ? left.slice(0, Math.max(1, fit - 1)) : left;
    const want = shown.join(',') + (left.length > shown.length ? `+${left.length - shown.length}` : '') + `|${$('html').lang}`;
    if (tray.dataset.shown === want) return;
    tray.dataset.shown = want;
    tray.textContent = '';
    tray.setAttribute('aria-label', t('kaart.tray'));
    for (const id of shown) {
      const g = region(id);
      const { box } = shapeOf(g);
      const pad = Math.max(box[2] - box[0], box[3] - box[1]) * 0.08;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `km-chip${game.selected === id ? ' picked' : ''}`;
      b.dataset.id = id;
      b.innerHTML = `<svg viewBox="${sw(box[0] - pad)} ${sw(box[1] - pad)} ${sw(box[2] - box[0] + 2 * pad)} ${sw(box[3] - box[1] + 2 * pad)}" aria-hidden="true"><path d="${g.d}" style="fill:${COLOURS[game.pack.regions.indexOf(g) % COLOURS.length]}"/></svg><span class="km-chip-name">${esc(nameOf('r', id))}</span>`;
      b.setAttribute('aria-label', t('kaart.piece', { name: nameOf('r', id) }));
      b.addEventListener('pointerdown', (e) => startDrag(e, id));
      // the keyboard (Enter, Space) picks it too; a finger or mouse picks it in upDrag
      b.addEventListener('click', (e) => {
        if (e.detail === 0) pick(id);
      });
      tray.appendChild(b);
    }
    if (left.length > shown.length) {
      const more = document.createElement('span');
      more.className = 'km-more';
      more.textContent = `+${left.length - shown.length}`;
      more.setAttribute('aria-label', t('kaart.moreAria', { n: left.length - shown.length }));
      tray.appendChild(more);
    }
  }

  /** A tap on a piece (no drag): pick it, then tap its place on the map. Again: put it back. */
  function pick(id) {
    if (!game || game.done || game.placed.includes(id)) return;
    sfx.unlock();
    game.selected = game.selected === id ? null : id;
    for (const c of document.querySelectorAll('#km-tray .km-chip')) c.classList.toggle('picked', c.dataset.id === game.selected);
    setStatus(game.selected ? t('kaart.picked', { name: nameOf('r', id) }) : '');
  }

  // ---------- dragging a piece ----------

  function startDrag(e, id) {
    if (!game || game.done || overlayUp() || drag || game.placed.includes(id)) return;
    e.preventDefault();
    sfx.unlock();
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    drag = { id, pointer: e.pointerId, lift: e.pointerType === 'touch' ? LIFT : 0, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, el, moved: false };
    const g = region(id);
    const ghost = $('#km-ghost');
    const small = shapeOf(g).size * scale() < 2 * FINGER;
    ghost.innerHTML = `<g id="km-ghost-g"><path d="${g.d}" style="fill:${COLOURS[game.pack.regions.indexOf(g) % COLOURS.length]}"/></g>${small ? '<circle id="km-ghost-ring" r="14"/>' : ''}`;
    el.addEventListener('pointermove', moveDrag);
    el.addEventListener('pointerup', upDrag);
    el.addEventListener('pointercancel', cancelDrag);
  }

  function placeGhost() {
    const g = region(drag.id);
    const x = drag.x;
    const y = drag.y - drag.lift;
    $('#km-ghost-g').setAttribute('transform', `translate(${sw(x)} ${sw(y)}) scale(${scale().toFixed(5)}) translate(${-g.c[0]} ${-g.c[1]})`);
    $('#km-ghost-ring')?.setAttribute('cx', String(sw(x)));
    $('#km-ghost-ring')?.setAttribute('cy', String(sw(y)));
  }

  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.moved && Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > MOVE) {
      drag.moved = true;
      drag.el.classList.add('lifted');
      $('#km-ghost').hidden = false;
    }
    if (drag.moved) placeGhost();
  }

  function upDrag(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag;
    endDrag();
    if (!d.moved) pick(d.id);
    else dropAt(d.id, d.x, d.y - d.lift);
  }

  function cancelDrag(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    endDrag();
  }

  function endDrag() {
    if (!drag) return;
    const { el } = drag;
    el.removeEventListener('pointermove', moveDrag);
    el.removeEventListener('pointerup', upDrag);
    el.removeEventListener('pointercancel', cancelDrag);
    el.classList.remove('lifted');
    $('#km-ghost').hidden = true;
    $('#km-ghost').innerHTML = '';
    drag = null;
  }

  /** A piece let go with its centre at the page point (px, py). */
  function dropAt(id, px, py) {
    if (!game || game.done || game.placed.includes(id)) return;
    const r = $('#km-mapbox').getBoundingClientRect();
    if (px < r.left || px > r.right || py < r.top || py > r.bottom) {
      bounceChip(id);
      return;
    }
    const [wx, wy] = toWorld(px - r.left, py - r.top);
    const g = region(id);
    if (snaps(game.pack, g, wx, wy, scale())) {
      place(id);
      return;
    }
    // on another empty place of this round: a gentle "not here", counted once per piece
    const open = game.items.filter((x) => x !== id && !game.placed.includes(x));
    const other = hitRegion(game.pack, wx, wy, FINGER / scale(), open);
    if (other) wrong(id, other.id);
    else bounceChip(id);
  }

  function place(id) {
    game.placed.push(id);
    game.results.push(!game.missed[id]);
    game.selected = null;
    game.last = id;
    if (game.glow === id) game.glow = null;
    sfx.plink(1 + ((game.placed.length - 1) % 9));
    const el = document.querySelector(`#km-regions .km-reg[data-id="${id}"]`);
    el?.classList.add('snap');
    setTimeout(() => el?.classList.remove('snap'), 450);
    paintRegions();
    setStatus(t('kaart.goodPlace', { name: nameOf('r', id) }));
    renderDots();
    renderTray();
    drawOver();
    if (game.placed.length === game.items.length) {
      game.waiting = true;
      later(700, finish);
    }
  }

  function bounceChip(id) {
    const c = document.querySelector(`#km-tray .km-chip[data-id="${id}"]`);
    c?.classList.remove('nope');
    void c?.offsetWidth;
    c?.classList.add('nope');
    sfx.bounce();
  }

  /** A wrong drop or tap: the bounce, one mistake per piece or question, the glow after MAX_TRIES. */
  function wrong(id, onId = null) {
    if (!game.missed[id]) {
      game.missed[id] = true;
      game.mistakes++;
    }
    game.tries[id] = (game.tries[id] || 0) + 1;
    sfx.boop();
    if (game.kind === 'puzzle') bounceChip(id);
    if (onId) {
      const sel = game.kind === 'point' && game.pack.points.kind === 'city' ? `#km-over .km-dot[data-id="${onId}"]` : `#km-regions .km-reg[data-id="${onId}"]`;
      const el = document.querySelector(sel);
      el?.classList.remove('nope');
      void el?.getBoundingClientRect();
      el?.classList.add('nope');
      setTimeout(() => el?.classList.remove('nope'), 500);
    }
    const tapped = onId && game.kind !== 'puzzle' ? (game.kind === 'where' ? nameOf('r', onId) : game.pack.points.kind === 'city' ? nameOf('p', onId) : null) : null;
    if (game.tries[id] >= MAX_TRIES) {
      game.glow = id;
      paintRegions();
      setStatus(tapped ? `${t('kaart.thatIs', { name: tapped })} ${t('kaart.glow')}` : t('kaart.glow'));
    } else setStatus(tapped ? `${t('kaart.thatIs', { name: tapped })} ${t('kaart.again')}` : t('kaart.again'));
    drawOver();
  }

  // ---------- tapping the map ----------

  const mapbox = $('#km-mapbox');
  mapbox.addEventListener('pointerdown', (e) => {
    if (!game || !geo || press) return;
    sfx.unlock();
    mapbox.setPointerCapture?.(e.pointerId);
    press = { pointer: e.pointerId, x: e.clientX, y: e.clientY, at: { ...view.at }, moved: false };
  });
  mapbox.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.pointer) return;
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE) press.moved = true;
    if (press.moved && view.z > 1) {
      view.at = clampPan({ x: press.at.x + e.clientX - press.x, y: press.at.y + e.clientY - press.y }, geo.w, geo.h, view.z);
      applyView();
    }
  });
  const release = (e) => {
    if (!press || e.pointerId !== press.pointer) return;
    const p = press;
    press = null;
    if (p.moved || e.type === 'pointercancel') return;
    const r = mapbox.getBoundingClientRect();
    tapAt(e.clientX - r.left, e.clientY - r.top);
  };
  mapbox.addEventListener('pointerup', release);
  mapbox.addEventListener('pointercancel', release);

  /** A tap on the map at (bx, by) in the box. */
  function tapAt(bx, by) {
    if (!game || game.done || game.waiting || overlayUp()) return;
    const [wx, wy] = toWorld(bx, by);
    const reach = FINGER / scale();
    if (game.kind === 'puzzle') {
      // a picked piece goes where the tap is (as if dropped there)
      if (game.selected) {
        // its place under the tap (small places within a finger): placed; another empty place: not there
        const open = game.items.filter((x) => !game.placed.includes(x));
        const g = hitRegion(game.pack, wx, wy, reach, open);
        if (g?.id === game.selected) place(g.id);
        else if (g) wrong(game.selected, g.id);
        return;
      }
      const g = hitRegion(game.pack, wx, wy, reach);
      if (g && game.placed.includes(g.id)) setStatus(t('kaart.thatIs', { name: nameOf('r', g.id) }));
      return;
    }
    const want = game.items[game.i];
    if (game.kind === 'where') {
      const g = hitRegion(game.pack, wx, wy, reach);
      if (!g) return;
      if (g.id === want) right(want);
      else if (!game.glow) wrong(want, g.id);
      else wrongAgain(g.id);
      return;
    }
    const p = hitPoint(game.pack, wx, wy, reach * 1.4);
    if (!p) {
      if (game.pack.points.kind === 'sea') {
        sfx.bounce();
        setStatus(t('kaart.land'));
      }
      return;
    }
    if (p.id === want) right(want);
    else if (!game.glow) wrong(want, p.id);
    else wrongAgain(p.id);
  }

  /** While the right place glows, another tap only wobbles: no more mistakes. */
  function wrongAgain(onId) {
    sfx.bounce();
    const sel = game.kind === 'point' && game.pack.points.kind === 'city' ? `#km-over .km-dot[data-id="${onId}"]` : `#km-regions .km-reg[data-id="${onId}"]`;
    document.querySelector(sel)?.classList.add('nope');
  }

  function right(id) {
    game.found.push(id);
    game.results.push(!game.missed[id]);
    game.glow = null;
    game.waiting = true;
    game.last = id;
    sfx.chime();
    paintRegions();
    const name = game.kind === 'where' ? nameOf('r', id) : nameOf('p', id);
    setStatus(t('kaart.goodName', { name }));
    renderDots();
    drawOver();
    later(1100, () => nextQuestion());
  }

  function nextQuestion() {
    if (!game) return;
    game.waiting = false;
    game.i++;
    if (game.i >= game.items.length) {
      finish();
      return;
    }
    setStatus('');
    renderAsk();
    renderDots();
    drawOver();
  }

  function finish() {
    if (game.done) return;
    game.done = true;
    game.waiting = false;
    const n = starsFor(game.mistakes);
    store.recordStars(meta.id, game.roundId, n);
    renderDots();
    sfx.chime();
    const right = game.results.filter(Boolean).length;
    const total = game.items.length;
    const g = game;
    const buttons = [];
    let text = t('kaart.winText', { right, total });
    const next = nextRound(g.pack, g.tier, g.r);
    if (next && !locked(g.packId, next.tier)) {
      const id = roundId(g.packId, next.tier, next.r);
      buttons.push([t('kaart.next'), 'big primary', () => (shell.hideOverlay(), startRound(id))]);
    } else if (next) {
      text = `${text} ${t('kaart.lastFree')}`;
      buttons.push([t('kaart.more'), 'big primary', () => (shell.show('kaart-menu'), offer())]);
    }
    buttons.push([t('kaart.again2'), 'big secondary', () => (shell.hideOverlay(), startRound(g.roundId))]);
    buttons.push([t('kaart.rounds'), 'big secondary', () => shell.show('kaart-menu')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`kaart.win${n}`),
      text,
      buttons,
    });
  }

  return {
    async init() {
      return true;
    },
    open() {
      shell.show('kaart-menu');
    },
    leave,
    testHook() {
      const centre = (at) => {
        const r = mapbox.getBoundingClientRect();
        const [x, y] = toBox(at);
        return { x: r.left + x, y: r.top + y };
      };
      return {
        state: () =>
          game && {
            pack: game.packId,
            tier: game.tier,
            roundId: game.roundId,
            kind: game.kind,
            lines: game.lines,
            items: game.items.slice(),
            i: game.i,
            placed: game.placed.slice(),
            found: game.found.slice(),
            mistakes: game.mistakes,
            tries: { ...game.tries },
            glow: game.glow,
            done: game.done,
            waiting: game.waiting,
          },
        view: () => geo && { z: view.z, max: view.max, s: geo.s, scale: scale(), w: geo.w, h: geo.h, side: $('#km-stage').classList.contains('side') },
        /** Where on the page a region's centre (or a point) is drawn now. */
        target: (id) => {
          if (!game || !geo) return null;
          const g = game.pack.regions.find((x) => x.id === id);
          const p = game.pack.points?.list.find((x) => x.id === id);
          return centre(game.kind === 'point' && p ? p.at[0] : g ? g.c : p.at[0]);
        },
        country: () => country(),
        menuPack: () => menuPack,
        start: (id) => startRound(id),
        place: (id) => game && !game.placed.includes(id) && place(id),
        answer: () => game && game.kind !== 'puzzle' && !game.waiting && right(game.items[game.i]),
        zoom: (on) => setZoom(on),
        stars: () => stars(),
      };
    },
  };
}

