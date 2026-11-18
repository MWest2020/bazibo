// Kangoeroe op de getallenlijn (Kangaroo Hops): adding and taking away on a number line, the way
// Dutch schools teach it in groep 3-4. A kangaroo stands on the line; the child decides the hops
// (+1, -1, +10, -10, or 2s and 5s), each hop drawn as an arc, or taps the line for one big jump,
// then "Hier!". "How many hops?" questions are answered by picking the number. No timers, no
// losing: a wrong answer bounces the kangaroo back to the start and draws the way as dashed arcs
// (over 10: to the ten, then on); after a second one the kangaroo hops the way itself.
// Three tiers (0-10, 0-20, 0-100); a round is 8 questions and earns stars by mistakes. The
// questions and the hops are pure (hops.js), the drawings in art.js; the shell (web/js/main.js)
// owns the overlay card, the sound settings and the purchase, passed in as `shell`.
//
// Saved (games.kangoeroe): stars per round (only ever raised), random rounds done per tier, which
// how-to cards were seen and the last tier. All read from the save each time. An unfinished round
// is kept while the app stays open ("keep playing").
import { meta } from './meta.js';
import {
  TIERS,
  TIER_IDS,
  ROUNDS_PER_TIER,
  ROUND_LEN,
  MAX_TRIES,
  makeRound,
  starsFor,
  hashSeed,
  isRight,
  landing,
  startHops,
  canHop,
  hop,
  jump,
  undo,
  pipsDone,
  wayFor,
  arcLabel,
  viewSize,
  startView,
  followView,
} from './hops.js';
import { kangaroo, howSvg } from './art.js';
import * as store from '../../js/storage.js';
import { newSeed, randomCard } from '../../js/random.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const UNDO = '<path d="M9 7 4 12l5 5M4.5 12H15a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
const MINUS = '−';
const PAD = 18; // px left and right of the line, so the end numbers and the kangaroo fit
const HOP_MS = 280;
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const signed = (n) => (n < 0 ? `${MINUS}${-n}` : `+${n}`);

export function createKangoeroe(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  const randomDone = () => store.loadRandomSolved(meta.id);
  const lastTier = () => {
    const v = store.loadGameOption(meta.id, 'lastTier', 't1');
    return TIER_IDS.includes(v) ? v : 't1';
  };

  // { tier, roundId (null when random), seed, qs, i, st: { pos, trail }, mistakes, results, tries,
  //   hint, shown, waiting, done }
  let game = null;
  let plays = 0; // counts rounds started, so a late timer never acts on a newer round
  let timer = null;

  // what is drawn: the view on the line (lo, tweened), the kangaroo's hops still to animate
  const view = { lo: 0, from: 0, to: 0, t0: 0, size: 10, manual: false };
  let geo = null; // { w, h, unit, lineY, roo, maxArc, font, every }
  const roo = { x: 0, lift: 0, face: 1, queue: [], cur: null, t0: 0, happy: 0 };
  let raf = 0;

  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const locked = (tier) => meta.isLocked({ tier }, shell.unlock.owned);
  const q = () => game.qs[game.i];
  const max = () => TIERS[game.tier].max;

  shell.unlock.onChange(() => {
    if (onScreen('kangoeroe-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'kangoeroe-menu') renderMenu();
    if (name !== 'kangoeroe') clearTimer();
  });
  shell.onLangChange(() => {
    if (onScreen('kangoeroe-menu')) renderMenu();
    if (game && !game.done && onScreen('kangoeroe')) renderTexts();
  });

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  /** One step of the round after `ms`, dropped when another round started or the screen changed. */
  function later(ms, fn) {
    clearTimer();
    const token = plays;
    timer = setTimeout(() => {
      timer = null;
      if (token === plays && game && onScreen('kangoeroe')) fn();
    }, ms);
  }

  // ---------- menu ----------

  function starsText(n) {
    return [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  }

  function renderMenu() {
    const box = $('#kangoeroe-menu');
    box.textContent = '';
    if (game && !game.done) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'kangoeroe-continue';
      cont.className = 'btn big secondary klok-continue';
      cont.textContent = t('kangoeroe.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      box.appendChild(cont);
    }
    const head = document.createElement('div');
    head.className = 'kg-menu-art';
    head.innerHTML = howSvg();
    box.appendChild(head);
    const got = stars();
    const done = randomDone();
    const rtier = lastTier();
    const rgrid = document.createElement('div');
    rgrid.className = 'level-grid klok-grid klok-random';
    rgrid.appendChild(
      randomCard({
        t,
        tap,
        title: `${t('random.play')} · ${t(`kangoeroe.short.${rtier}`)}`,
        locked: !shell.unlock.owned,
        solved: done[rtier] || 0,
        done: true,
        onPlay: () => playRandom(rtier),
        onLocked: () => shell.offerUnlock(t('kangoeroe.randomLead')),
      }),
    );
    box.appendChild(rgrid);
    for (const tier of TIER_IDS) {
      const line = document.createElement('p');
      line.className = 'klok-age';
      line.textContent = t('kangoeroe.tierLine', { age: TIERS[tier].age, what: t(`kangoeroe.tier.${tier}`) });
      box.appendChild(line);
      const grid = document.createElement('div');
      grid.className = 'level-grid klok-grid';
      grid.dataset.tier = tier;
      for (let r = 1; r <= ROUNDS_PER_TIER; r++) {
        const id = `${tier}-${r}`;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'level-btn';
        b.dataset.round = id;
        if (locked(tier)) {
          b.classList.add('locked');
          b.innerHTML = `<span class="num">${r}</span><svg viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
          b.setAttribute('aria-label', t('kangoeroe.roundLocked', { n: r }));
          b.addEventListener('click', () => {
            tap();
            offer();
          });
        } else {
          const n = got[id] || 0;
          b.innerHTML = `<span class="num">${r}</span><span class="stars" aria-hidden="true">${starsText(n)}</span>`;
          b.setAttribute('aria-label', n ? t('kangoeroe.roundStars', { n: r, stars: n }) : t('kangoeroe.roundOpen', { n: r }));
          b.addEventListener('click', () => {
            tap();
            startRound(id);
          });
        }
        grid.appendChild(b);
      }
      box.appendChild(grid);
    }
  }

  $('#kangoeroe-menu-back').addEventListener('click', () => {
    tap();
    shell.show('home');
  });

  function offer() {
    shell.offerUnlock(t('kangoeroe.lockedLead'));
  }

  // ---------- rounds ----------

  function startRound(id) {
    const [tier, r] = String(id).split('-');
    if (!TIER_IDS.includes(tier) || !(Number(r) >= 1 && Number(r) <= ROUNDS_PER_TIER)) return;
    if (locked(tier)) {
      offer();
      return;
    }
    begin({ tier, roundId: id, seed: hashSeed(`kangoeroe:${id}`), round: Number(r) });
  }

  function playRandom(tier, seed = null) {
    if (!shell.unlock.owned) {
      shell.offerUnlock(t('kangoeroe.randomLead'));
      return;
    }
    if (!TIER_IDS.includes(tier)) return;
    begin({ tier, roundId: null, seed: seed ?? newSeed(), round: 0 });
  }

  function begin({ tier, roundId, seed, round }) {
    plays++;
    clearTimer();
    if (lastTier() !== tier) store.saveGameOption(meta.id, 'lastTier', tier);
    const qs = makeRound({ tier, seed, round });
    game = { tier, roundId, seed, qs, i: 0, st: startHops(qs[0]), mistakes: 0, results: [], tries: 0, hint: false, shown: false, waiting: false, done: false };
    shell.show('kangoeroe');
    render();
    if (!seenHow()[tier]) {
      shell.showOverlay({
        art: `<span class="kg-ov">${howSvg()}</span>`,
        title: t('kangoeroe.howTitle'),
        text: t(`kangoeroe.how.${tier}`),
        buttons: [
          [
            t('common.ok'),
            'big primary',
            () => {
              store.saveGameOption(meta.id, 'howSeen', { ...seenHow(), [tier]: true });
              shell.hideOverlay();
            },
          ],
        ],
      });
    }
  }

  function resume() {
    if (!game || game.done) return;
    shell.show('kangoeroe');
    if (game.waiting) nextQuestion();
    else render();
  }

  /** Android back and the menu button: to the menu, the round is kept ("keep playing"). */
  function leave() {
    clearTimer();
    shell.hideOverlay();
    shell.show('kangoeroe-menu');
  }
  $('#kangoeroe-back').addEventListener('click', () => {
    tap();
    leave();
  });

  // ---------- one question ----------

  function render() {
    if (!game) return;
    roo.queue = [];
    roo.cur = null;
    roo.happy = 0;
    view.manual = false;
    $('#kg-stage').classList.remove('happy');
    $('#screen-kangoeroe').dataset.tier = game.tier;
    $('#screen-kangoeroe').dataset.ask = q().ask;
    renderTexts();
    setStatus('');
    layout(true);
  }

  /** Everything with words in it (also after a language switch). */
  function renderTexts() {
    $('#kg-sub').textContent = t('kangoeroe.menu');
    $('#kg-title').textContent = game.roundId ? t('kangoeroe.round', { n: game.roundId.split('-')[1] }) : t('random.title');
    renderPrompt();
    renderHops();
    renderAnswer();
    renderDots();
    $('#kg-map').setAttribute('aria-label', t('kangoeroe.map'));
    lineLabel();
  }

  function renderPrompt() {
    const it = q();
    let lead;
    let sum;
    if (it.kind === 'count') {
      lead = t('kangoeroe.lead.count', { a: it.start, b: it.to });
      sum = `${it.start} → ${it.to}`;
    } else if (it.kind === 'missing') {
      lead = t('kangoeroe.lead.missing');
      sum = `${it.start} ${it.to > it.start ? '+' : MINUS} ? = ${it.to}`;
    } else if (it.kind === 'skip') {
      lead = t(it.terms[0] > 0 ? 'kangoeroe.lead.skipOn' : 'kangoeroe.lead.skipBack', { n: it.hops, step: it.step });
      sum = `${it.start} → ?`;
    } else {
      lead = it.kind === 'add' && game.tier === 't1' ? t('kangoeroe.lead.add', { n: it.terms[0] }) : t('kangoeroe.lead.land');
      sum = `${it.start} ${it.terms.map((d) => `${d < 0 ? MINUS : '+'} ${Math.abs(d)}`).join(' ')} = ?`;
    }
    $('#kg-lead').textContent = lead;
    $('#kg-sum').textContent = sum;
    $('#kg-sum').classList.toggle('long', sum.length > 12);
    renderPips();
  }

  /** Tier 1 "3 + 4": the four hops as pips that fill as the kangaroo hops. */
  function renderPips() {
    const box = $('#kg-pips');
    const it = q();
    const on = game.tier === 't1' && it.kind === 'add';
    box.hidden = !on;
    if (!on) return;
    const n = it.terms[0];
    const done = pipsDone(it, game.st);
    box.innerHTML = Array.from({ length: n }, (_, k) => `<span class="kg-pip${k < done ? ' on' : ''}"></span>`).join('');
    box.setAttribute('aria-label', t('kangoeroe.pips', { done, n }));
  }

  function renderHops() {
    const box = $('#kg-hops');
    box.textContent = '';
    box.setAttribute('aria-label', t('kangoeroe.hopsGroup'));
    const u = document.createElement('button');
    u.type = 'button';
    u.id = 'kg-undo';
    u.className = 'kg-hop undo';
    u.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${UNDO}</svg>`;
    u.setAttribute('aria-label', t('kangoeroe.undo'));
    u.addEventListener('click', () => {
      sfx.unlock();
      takeBack();
    });
    box.appendChild(u);
    for (const d of q().buttons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `kg-hop ${d < 0 ? 'back' : 'on'}${Math.abs(d) >= 10 ? ' ten' : ''}`;
      b.dataset.d = String(d);
      b.textContent = signed(d);
      b.setAttribute('aria-label', t(d < 0 ? 'kangoeroe.hopBack' : 'kangoeroe.hopOn', { n: Math.abs(d) }));
      b.addEventListener('click', () => {
        sfx.unlock();
        doHop(d);
      });
      box.appendChild(b);
    }
    box.dataset.n = String(q().buttons.length + 1);
    syncHops();
  }

  /** Grey out the hops that cannot be made now (off the line, past the flag) and the undo with nothing to undo. */
  function syncHops() {
    const busy = !game || game.waiting || game.done;
    for (const b of document.querySelectorAll('#kg-hops .kg-hop[data-d]')) b.disabled = busy || !canHop(q(), game.tier, game.st, Number(b.dataset.d));
    const u = $('#kg-undo');
    if (u) u.disabled = busy || !game.st.trail.length;
  }

  function renderAnswer() {
    const box = $('#kg-answer');
    box.textContent = '';
    box.removeAttribute('role');
    box.removeAttribute('aria-label');
    const it = q();
    if (it.ask === 'land') {
      box.className = 'kg-answer land';
      const b = document.createElement('button');
      b.type = 'button';
      b.id = 'kg-here';
      b.className = 'btn big primary kg-here';
      b.textContent = t('kangoeroe.here');
      b.setAttribute('aria-label', t('kangoeroe.hereAria', { n: game.st.pos }));
      b.addEventListener('click', () => {
        sfx.unlock();
        here();
      });
      box.appendChild(b);
      return;
    }
    box.className = `kg-answer count n${it.options.length}`;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', t('kangoeroe.options'));
    for (const n of it.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'kg-option';
      b.dataset.n = String(n);
      b.textContent = String(n);
      b.setAttribute('aria-label', t('kangoeroe.option', { n }));
      b.addEventListener('click', () => {
        sfx.unlock();
        pick(n);
      });
      box.appendChild(b);
    }
  }

  function renderDots() {
    const box = $('#kg-dots');
    box.textContent = '';
    for (let k = 0; k < ROUND_LEN; k++) {
      const d = document.createElement('span');
      const r = game.results[k];
      d.className = `klok-dot${r === true ? ' good' : r === false ? ' bad' : ''}${k === game.i && !game.done ? ' now' : ''}`;
      box.appendChild(d);
    }
    box.setAttribute('aria-label', t('kangoeroe.progress', { done: Math.min(game.i, ROUND_LEN), total: ROUND_LEN }));
  }

  function setStatus(text) {
    $('#kg-status').textContent = text;
  }

  function lineLabel() {
    const it = q();
    const label = it.ask === 'count' ? t('kangoeroe.lineFlag', { n: game.st.pos, to: it.to }) : t('kangoeroe.line', { n: game.st.pos });
    $('#kg-line').setAttribute('aria-label', label);
  }

  // ---------- the line ----------

  /** Measure the line's box and fit the drawing to it; `fresh` puts the view where a question starts. */
  function layout(fresh = false) {
    if (!game || !onScreen('kangoeroe')) return;
    const box = $('#kg-linebox');
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    const size = viewSize(game.tier, w - 2 * PAD);
    const unit = (w - 2 * PAD) / size;
    const maxDigits = String(max()).length;
    // numbers as big as fit between two ticks (every number on 0-10 even at 320 px), never under 12 px
    const font = Math.max(12, Math.min(22, unit * 0.8, (unit - 6) / (maxDigits * 0.62)));
    const every = [1, 2, 5, 10].find((k) => unit * k >= maxDigits * font * 0.62 + 6) || 10;
    const below = Math.max(30, Math.min(44, font * 1.3 + 16));
    const lineY = h - below;
    const rooH = Math.max(34, Math.min(84, h * 0.3));
    geo = { w, h, unit, lineY, rooH, maxArc: Math.max(14, lineY - rooH - 6), font, every, size };
    const svg = $('#kg-line');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    if (fresh || view.size !== size) {
      view.size = size;
      const lo = fresh ? startView(q(), game.tier, size) : followView(view.to, size, game.st.pos, max());
      view.lo = view.from = view.to = lo;
    }
    if (fresh) {
      roo.queue = [];
      roo.cur = null;
      roo.x = game.st.pos;
      roo.lift = 0;
      roo.face = landing(q()) < q().start ? -1 : 1;
    }
    $('#kg-map').hidden = size >= max();
    drawStatic();
    drawMap();
    drawRoo();
  }

  const xOf = (n) => PAD + (n - view.lo) * geo.unit;
  /** The height of an arc over `d` steps, never so high the kangaroo leaves the box. */
  const arcH = (d) => Math.min(geo.maxArc, Math.max(20, geo.rooH * 0.4, Math.abs(d) * geo.unit * 0.7));

  function arcPath(a, b, y, hh = arcH(b - a)) {
    const xa = xOf(a);
    const xb = xOf(b);
    return { d: `M${xa.toFixed(1)} ${y}Q${((xa + xb) / 2).toFixed(1)} ${(y - 2 * hh).toFixed(1)} ${xb.toFixed(1)} ${y}`, mx: (xa + xb) / 2, my: y - hh, w: Math.abs(xb - xa) };
  }

  /** Ticks, numbers, the start and the flag, the dashed way (hint) and the hops made. */
  function drawStatic() {
    const it = q();
    const { lineY, unit, font, every, w } = geo;
    const lo = Math.floor(view.lo) - 1;
    const hi = Math.ceil(view.lo + geo.size) + 1;
    const parts = [];
    const x0 = Math.max(4, xOf(0));
    const x1 = Math.min(w - 4, xOf(max()));
    parts.push(`<path class="kg-axis" d="M${x0.toFixed(1)} ${lineY}H${x1.toFixed(1)}"/>`);
    for (let n = Math.max(0, lo); n <= Math.min(max(), hi); n++) {
      const x = xOf(n);
      if (x < -20 || x > w + 20) continue;
      const ten = n % 10 === 0;
      const five = n % 5 === 0;
      const tick = ten ? 12 : five && unit < 20 ? 8 : 6;
      parts.push(`<path class="kg-tick${ten ? ' ten' : ''}" d="M${x.toFixed(1)} ${lineY - tick}v${tick * 2}"/>`);
      if (n % every === 0 || (ten && unit * 10 >= font * 2)) {
        parts.push(`<text class="kg-num${ten ? ' ten' : ''}" x="${x.toFixed(1)}" y="${lineY + tick + font * 0.95}" font-size="${font}">${n}</text>`);
      }
    }
    // the start: a green dot; a count question's goal: a flag
    parts.push(`<circle class="kg-start" cx="${xOf(it.start).toFixed(1)}" cy="${lineY}" r="${Math.max(5, Math.min(8, unit * 0.3))}"/>`);
    if (it.ask === 'count') {
      const fx = xOf(it.to);
      const fh = Math.max(26, geo.rooH * 0.7);
      parts.push(`<g class="kg-flag"><path d="M${fx.toFixed(1)} ${lineY}V${lineY - fh}" stroke-width="2.5"/><path class="kg-flag-cloth" d="M${fx.toFixed(1)} ${lineY - fh}l${it.to > it.start ? 15 : -15} 6-${it.to > it.start ? 15 : -15} 6z"/></g>`);
    }
    // the way, dashed (after a wrong answer), drawn over the kangaroo so it never hides behind it
    const over = [];
    if (game.hint) {
      for (const [a, b] of it.hint) {
        const p = arcPath(a, b, lineY);
        over.push(`<path class="kg-arc hint" d="${p.d}"/>`);
        if (p.w >= 20) over.push(`<text class="kg-arc-label hint" x="${p.mx.toFixed(1)}" y="${(p.my - 5).toFixed(1)}">${signed(b - a)}</text>`);
      }
    }
    // the hops made, numbered in a "how many hops?" question
    game.st.trail.forEach(([a, b], k) => {
      const p = arcPath(a, b, lineY);
      parts.push(`<path class="kg-arc ${b < a ? 'back' : 'on'}" d="${p.d}"/>`);
      if (p.w >= 18) parts.push(`<text class="kg-arc-label ${b < a ? 'back' : 'on'}" x="${p.mx.toFixed(1)}" y="${(p.my - 5).toFixed(1)}">${arcLabel(it, game.st.trail, k)}</text>`);
    });
    // where the kangaroo stands, big; green once it is right
    const pos = game.st.pos;
    const pf = Math.max(18, Math.min(26, font * 1.25));
    const pw = String(pos).length * pf * 0.62 + 16;
    const px = Math.max(pw / 2 + 1, Math.min(w - pw / 2 - 1, xOf(pos)));
    const py = lineY + 7;
    parts.push(`<g class="kg-pill${game.shown || game.right ? ' right' : ''}"><rect x="${(px - pw / 2).toFixed(1)}" y="${py}" width="${pw.toFixed(1)}" height="${pf + 8}" rx="${(pf + 8) / 2}"/><text x="${px.toFixed(1)}" y="${py + pf * 0.92 + 2}" font-size="${pf}">${pos}</text></g>`);
    $('#kg-static').innerHTML = parts.join('');
    $('#kg-over').innerHTML = over.join('');
    lineLabel();
  }

  /** t3 on a phone: the whole line 0-100 small, with the part in view; a tap there moves the view. */
  function drawMap() {
    const box = $('#kg-map');
    if (box.hidden) return;
    const w = box.clientWidth || geo.w;
    const m = max();
    const sx = (n) => 10 + (n / m) * (w - 20);
    const parts = [`<path class="kg-map-axis" d="M10 20H${w - 10}"/>`];
    for (let n = 0; n <= m; n += 10) {
      parts.push(`<path class="kg-map-tick" d="M${sx(n).toFixed(1)} 15v10"/>`);
      if (n % 50 === 0) parts.push(`<text class="kg-map-num" x="${sx(n).toFixed(1)}" y="38">${n}</text>`);
    }
    parts.push(`<rect class="kg-map-view" x="${sx(view.lo).toFixed(1)}" y="8" width="${(sx(view.lo + geo.size) - sx(view.lo)).toFixed(1)}" height="24" rx="6"/>`);
    parts.push(`<circle class="kg-map-roo" cx="${sx(game.st.pos).toFixed(1)}" cy="20" r="5"/>`);
    box.innerHTML = `<svg viewBox="0 0 ${w} 44" width="${w}" height="44" aria-hidden="true">${parts.join('')}</svg>`;
  }

  /** The kangaroo where the animation has it now. */
  function drawRoo() {
    const g = $('#kg-roo');
    if (!geo) return;
    const s = geo.rooH / 72;
    const x = xOf(roo.x);
    const y = geo.lineY - roo.lift;
    g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`);
    if (g.dataset.face !== String(roo.face)) {
      g.dataset.face = String(roo.face);
      g.innerHTML = kangaroo(roo.face);
    }
  }

  /** Queue a hop from a to b for the kangaroo to make on screen (the state has already moved). */
  function animateHop(a, b, ms = HOP_MS) {
    roo.queue.push({ a, b, ms });
    run();
  }

  function run() {
    if (raf) return;
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    if (!game || !geo || !onScreen('kangoeroe')) {
      roo.queue = [];
      roo.cur = null;
      return;
    }
    let more = false;
    // the view slides to keep the kangaroo in sight
    if (view.lo !== view.to) {
      const p = Math.min(1, (now - view.t0) / 260);
      view.lo = p >= 1 || reduced() ? view.to : view.from + (view.to - view.from) * (1 - (1 - p) ** 2);
      drawStatic();
      drawMap();
      more = view.lo !== view.to;
    }
    if (!roo.cur && roo.queue.length) {
      roo.cur = roo.queue.shift();
      roo.t0 = now;
      if (roo.cur.b !== roo.cur.a) roo.face = roo.cur.b > roo.cur.a ? 1 : -1;
    }
    if (roo.cur) {
      const { a, b } = roo.cur;
      const ms = reduced() ? 1 : roo.queue.length > 1 ? roo.cur.ms * 0.5 : roo.cur.ms; // a fast finger: hop faster
      const p = Math.min(1, (now - roo.t0) / ms);
      roo.x = a + (b - a) * p;
      roo.lift = (a === b ? 18 : arcH(b - a)) * 4 * p * (1 - p);
      if (p >= 1) {
        roo.x = b;
        roo.lift = 0;
        roo.cur = null;
      }
      more = true;
    } else if (roo.happy) {
      const p = Math.max(0, Math.min(1, (now - roo.happy) / 420));
      roo.lift = 16 * Math.sin(Math.PI * p);
      if (p >= 1) {
        roo.happy = 0;
        roo.lift = 0;
      } else more = true;
    }
    drawRoo();
    if (more || roo.queue.length) run();
  }

  /** Slide the view so the kangaroo stays in sight (unless the child just moved it on the map). */
  function follow() {
    if (!geo) return;
    const to = followView(view.manual ? view.lo : view.to, geo.size, game.st.pos, max());
    view.manual = false;
    if (to === view.to && to === view.lo) return;
    view.from = view.lo;
    view.to = to;
    view.t0 = performance.now();
    run();
  }

  /** After a change of state: the drawing, the pips, the buttons and the labels. */
  function changed() {
    follow();
    drawStatic();
    drawMap();
    renderPips();
    syncHops();
    const h = $('#kg-here');
    if (h) h.setAttribute('aria-label', t('kangoeroe.hereAria', { n: game.st.pos }));
  }

  // a tap on the line: one big jump there (land questions); on the map: move the view there
  $('#kg-line').addEventListener('click', (e) => {
    if (!game || game.waiting || game.done || overlayUp() || !geo) return;
    const r = $('#kg-line').getBoundingClientRect();
    const n = Math.round(view.lo + (e.clientX - r.left - PAD) / geo.unit);
    sfx.unlock();
    tapLine(n);
  });
  $('#kg-map').addEventListener('click', (e) => {
    if (!game || !geo || $('#kg-map').hidden) return;
    const r = $('#kg-map').getBoundingClientRect();
    const n = ((e.clientX - r.left - 10) / (r.width - 20)) * max();
    const lo = Math.max(0, Math.min(max() - geo.size, Math.round(n - geo.size / 2)));
    view.from = view.lo;
    view.to = lo;
    view.t0 = performance.now();
    view.manual = true;
    run();
  });

  const resize = new ResizeObserver(() => layout(false));
  resize.observe($('#kg-linebox'));

  // ---------- hopping and answering ----------

  function doHop(d) {
    if (!game || game.waiting || game.done || overlayUp()) return;
    const next = hop(q(), game.tier, game.st, d);
    if (!next) {
      sfx.bounce();
      return;
    }
    const from = game.st.pos;
    game.st = next;
    if (!game.hint) setStatus('');
    animateHop(from, next.pos);
    sfx.plink(Math.min(9, next.trail.length));
    changed();
  }

  function takeBack() {
    if (!game || game.waiting || game.done || overlayUp()) return;
    const next = undo(game.st);
    if (!next) return;
    const from = game.st.pos;
    game.st = next;
    animateHop(from, next.pos, HOP_MS * 0.7);
    changed();
  }

  function tapLine(n) {
    if (!game || game.waiting || game.done) return;
    const next = jump(q(), game.tier, game.st, n);
    if (!next) return;
    const from = game.st.pos;
    game.st = next;
    animateHop(from, n, HOP_MS * 1.4);
    sfx.plink(Math.min(9, next.trail.length));
    changed();
  }

  function here() {
    if (!game || game.waiting || game.done || q().ask !== 'land' || overlayUp()) return;
    // just bounced back after a wrong answer and not hopped yet: a second (double) tap counts nothing
    if (game.hint && !game.st.trail.length) {
      sfx.bounce();
      return;
    }
    if (isRight(q(), game.st.pos)) correct();
    else wrong();
  }

  function pick(n) {
    if (!game || game.waiting || game.done || q().ask !== 'count' || overlayUp()) return;
    const b = document.querySelector(`#kg-answer .kg-option[data-n="${n}"]`);
    if (isRight(q(), n)) {
      b?.classList.add('right');
      correct();
    } else {
      if (b) {
        b.classList.add('wrong');
        b.disabled = true;
      }
      wrong();
    }
  }

  function correct() {
    if (game.results[game.i] === undefined) game.results[game.i] = true;
    game.waiting = true;
    game.right = true;
    setStatus(t('kangoeroe.good'));
    $('#kg-stage').classList.add('happy');
    sfx.chime();
    roo.happy = performance.now() + (roo.queue.length + (roo.cur ? 1 : 0)) * HOP_MS;
    run();
    changed();
    renderDots();
    later(1300, () => {
      $('#kg-stage').classList.remove('happy');
      nextQuestion();
    });
  }

  /** A wrong answer: back to the start, the way drawn as dashed arcs; after MAX_TRIES the kangaroo hops it. */
  function wrong() {
    if (game.results[game.i] === undefined) {
      game.results[game.i] = false;
      game.mistakes++;
      renderDots();
    }
    game.tries++;
    sfx.boop();
    const from = game.st.pos;
    game.st = startHops(q());
    game.hint = true;
    if (from !== game.st.pos) animateHop(from, game.st.pos, HOP_MS * 1.5);
    else animateHop(from, from, HOP_MS);
    setStatus(t('kangoeroe.again'));
    changed();
    if (game.tries < MAX_TRIES) return;
    game.waiting = true;
    syncHops();
    later(700, showWay);
  }

  /** The kangaroo hops the way itself, the answer turns green, then the next question. */
  function showWay() {
    const it = q();
    game.shown = true;
    const way = wayFor(it);
    for (const [a, b] of way) animateHop(a, b);
    game.st = { pos: landing(it), trail: way };
    setStatus(t('kangoeroe.show'));
    if (it.ask === 'count') document.querySelector(`#kg-answer .kg-option[data-n="${it.answer}"]`)?.classList.add('right');
    changed();
    later(1200 + way.length * HOP_MS, nextQuestion);
  }

  function nextQuestion() {
    if (!game) return;
    game.waiting = false;
    game.tries = 0;
    game.hint = false;
    game.shown = false;
    game.right = false;
    game.i++;
    if (game.i >= ROUND_LEN) {
      finish();
      return;
    }
    game.st = startHops(q());
    render();
  }

  function finish() {
    game.done = true;
    const n = starsFor(game.mistakes);
    if (game.roundId) store.recordStars(meta.id, game.roundId, n);
    else store.recordRandomSolved(meta.id, game.tier);
    renderDots();
    syncHops();
    sfx.chime();
    const right = game.results.filter(Boolean).length;
    const g = game;
    const buttons = [];
    let text = t('kangoeroe.winText', { right, total: ROUND_LEN });
    if (!g.roundId) {
      text = `${text} ${t('random.done', { n: randomDone()[g.tier] || 1 })}`;
      buttons.push([t('random.new'), 'big primary', () => (shell.hideOverlay(), playRandom(g.tier))]);
    } else {
      const next = nextRoundId(g.roundId);
      if (next && !locked(next.split('-')[0])) buttons.push([t('kangoeroe.next'), 'big primary', () => (shell.hideOverlay(), startRound(next))]);
      else if (next) {
        text = `${text} ${t('kangoeroe.lastFree')}`;
        buttons.push([t('kangoeroe.more'), 'big primary', () => (shell.show('kangoeroe-menu'), offer())]);
      }
      buttons.push([t('kangoeroe.again2'), 'big secondary', () => (shell.hideOverlay(), startRound(g.roundId))]);
    }
    buttons.push([t('kangoeroe.rounds'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('kangoeroe-menu')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`kangoeroe.win${n}`),
      text,
      buttons,
    });
  }

  /** The next round: the next one of this tier, then the first of the next tier. */
  function nextRoundId(id) {
    const [tier, r] = id.split('-');
    if (Number(r) < ROUNDS_PER_TIER) return `${tier}-${Number(r) + 1}`;
    const k = TIER_IDS.indexOf(tier);
    return k >= 0 && k + 1 < TIER_IDS.length ? `${TIER_IDS[k + 1]}-1` : null;
  }

  // the keyboard: arrows hop (up and down by ten), Enter is "Hier!", Backspace takes a hop back,
  // a digit picks a number of hops
  document.addEventListener('keydown', (e) => {
    if (!game || !onScreen('kangoeroe') || overlayUp() || game.waiting || game.done) return;
    if (e.target?.closest?.('button') && (e.key === 'Enter' || e.key === ' ')) return;
    const bs = q().buttons;
    const pickD = (want) => bs.find((d) => d === want) ?? null;
    let d = null;
    if (e.key === 'ArrowRight') d = pickD(1) ?? bs.find((x) => x > 0 && x < 10) ?? null;
    else if (e.key === 'ArrowLeft') d = pickD(-1) ?? bs.find((x) => x < 0 && x > -10) ?? null;
    else if (e.key === 'ArrowUp') d = pickD(10);
    else if (e.key === 'ArrowDown') d = pickD(-10);
    if (d !== null) {
      e.preventDefault();
      doHop(d);
    } else if (e.key === 'Enter') here();
    else if (e.key === 'Backspace') takeBack();
    else if (/^[0-9]$/.test(e.key) && q().ask === 'count' && q().options.includes(Number(e.key))) pick(Number(e.key));
  });

  return {
    async init() {
      return true;
    },
    open() {
      shell.show('kangoeroe-menu');
    },
    leave,
    testHook() {
      return {
        state: () =>
          game && {
            tier: game.tier,
            roundId: game.roundId,
            i: game.i,
            q: game.qs[game.i],
            pos: game.st.pos,
            trail: game.st.trail.map((x) => [...x]),
            hint: game.hint,
            mistakes: game.mistakes,
            tries: game.tries,
            done: game.done,
            waiting: game.waiting,
          },
        view: () => geo && { lo: view.lo, to: view.to, size: geo.size, unit: geo.unit, map: !$('#kg-map').hidden, roo: roo.x, moving: !!(roo.cur || roo.queue.length) },
        x: (n) => {
          const r = $('#kg-line').getBoundingClientRect();
          return geo ? r.left + xOf(n) : null;
        },
        start: (id) => startRound(id),
        random: (tier) => playRandom(tier),
        hop: (d) => doHop(d),
        undo: () => takeBack(),
        here: () => here(),
        pick: (n) => pick(n),
        tapLine: (n) => tapLine(n),
        stars: () => stars(),
      };
    },
  };
}
