// Klok kijken: learn to tell the time on a friendly analogue clock.
//   Zet de klok    turn the hands (drag, or + and -) to the time in words and digits
//   Hoe laat is het?   pick the right time for the clock shown
//   Dagritme       (youngest) pick the clock for breakfast, school, bedtime, with a sun or a moon
// Five tiers from whole hours to single minutes and the 24-hour clock; a round is 10 questions and
// earns stars by mistakes. The time logic lives in time.js, the pictures in art.js; the shell
// (web/js/main.js) owns the overlay card, the sound settings and the purchase, passed in as `shell`.
//
// Saved (games.klok): stars per round (`stars`, only ever raised), random rounds done per mode and
// tier (`random`), and which how-to cards were seen (`howSeen`). All read from the save each time.
// An unfinished round is kept while the app stays open ("keep playing"), not across a restart.
import { meta } from './meta.js';
import {
  TIERS,
  TIER_IDS,
  MODES,
  ROUND_LEN,
  ROUNDS_PER_TIER,
  makeRound,
  starsFor,
  phrase,
  digital,
  label,
  hashSeed,
  sameFace,
  minuteOf,
  hour12,
  pointAngle,
  nearestHand,
  dragMinute,
  dragHour,
  nudge,
  hintHand,
  minutePosition,
} from './time.js';
import { clockSvg, setHands, modeSvg, activitySvg } from './art.js';
import { getLang } from '../../js/i18n.js';
import * as store from '../../js/storage.js';
import { newSeed, randomCard } from '../../js/random.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const BULB = '<path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2zm-3 18h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/>';
const tiersOf = (mode) => (mode === 'day' ? ['t1'] : TIER_IDS);

export function createKlok(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  const randomDone = () => store.loadRandomSolved(meta.id);

  // { mode, tier, roundId (null when random), seed, qs, i, cur, mistakes, results, waiting, done }
  let game = null;
  let plays = 0; // counts rounds started, so a late timer never acts on a newer round
  let timer = null;
  let drag = null; // { hand, id } while a finger turns a hand
  let tickN = 0;

  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const locked = (mode, tier) => meta.isLocked({ mode, tier }, shell.unlock.owned);
  const tierInfo = () => TIERS[game.tier];
  const q = () => game.qs[game.i];

  shell.unlock.onChange(() => {
    if (onScreen('klok-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'klok-menu') renderMenu();
    if (name !== 'klok') clearTimer();
  });
  shell.onLangChange(() => {
    if (onScreen('klok-menu')) renderMenu();
    if (game && !game.done) render();
  });

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  // ---------- menu ----------

  function starsText(n) {
    return [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  }

  function renderMenu() {
    const box = $('#klok-menu');
    box.textContent = '';
    if (game && !game.done) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'klok-continue';
      cont.className = 'btn big secondary klok-continue';
      cont.textContent = t('klok.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      box.appendChild(cont);
    }
    const got = stars();
    const done = randomDone();
    for (const mode of MODES) {
      const head = document.createElement('h3');
      head.className = 'klok-mode';
      head.dataset.mode = mode;
      head.innerHTML = `<span class="klok-mode-art">${modeSvg(mode)}</span><span class="klok-mode-text"><span class="klok-mode-title"></span><span class="klok-mode-sub"></span></span>`;
      head.querySelector('.klok-mode-title').textContent = t(`klok.mode.${mode}`);
      head.querySelector('.klok-mode-sub').textContent = t(`klok.mode.${mode}Sub`);
      box.appendChild(head);
      for (const tier of tiersOf(mode)) {
        const line = document.createElement('p');
        line.className = 'klok-age';
        line.textContent = t('klok.tierLine', { age: mode === 'day' ? '4-6' : TIERS[tier].age, what: t(mode === 'day' ? 'klok.tier.day' : `klok.tier.${tier}`) });
        box.appendChild(line);
        const grid = document.createElement('div');
        grid.className = 'level-grid klok-grid';
        grid.dataset.tier = `${mode}-${tier}`;
        grid.appendChild(
          randomCard({
            t,
            tap,
            locked: !shell.unlock.owned,
            solved: done[`${mode}-${tier}`] || 0,
            done: true,
            onPlay: () => playRandom(mode, tier),
            onLocked: () => shell.offerUnlock(t('klok.randomLead')),
          }),
        );
        for (let r = 1; r <= ROUNDS_PER_TIER; r++) {
          const id = `${mode}-${tier}-${r}`;
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'level-btn';
          b.dataset.round = id;
          if (locked(mode, tier)) {
            b.classList.add('locked');
            b.innerHTML = `<span class="num">${r}</span><svg viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
            b.setAttribute('aria-label', t('klok.roundLocked', { n: r }));
            b.addEventListener('click', () => {
              tap();
              offer();
            });
          } else {
            const n = got[id] || 0;
            b.innerHTML = `<span class="num">${r}</span><span class="stars" aria-hidden="true">${starsText(n)}</span>`;
            b.setAttribute('aria-label', n ? t('klok.roundStars', { n: r, stars: n }) : t('klok.roundOpen', { n: r }));
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
  }

  function offer() {
    shell.offerUnlock(t('klok.lockedLead'));
  }

  // ---------- rounds ----------

  function startRound(id) {
    const [mode, tier, r] = id.split('-');
    if (!MODES.includes(mode) || !TIERS[tier] || !(Number(r) >= 1 && Number(r) <= ROUNDS_PER_TIER)) return;
    if (locked(mode, tier)) {
      offer();
      return;
    }
    begin({ mode, tier, roundId: id, seed: hashSeed(`klok:${id}`) });
  }

  function playRandom(mode, tier, seed = null) {
    if (!shell.unlock.owned) {
      shell.offerUnlock(t('klok.randomLead'));
      return;
    }
    begin({ mode, tier, roundId: null, seed: seed ?? newSeed() });
  }

  function begin({ mode, tier, roundId, seed }) {
    plays++;
    clearTimer();
    const qs = makeRound({ mode, tier, seed, lang: getLang() });
    game = { mode, tier, roundId, seed, qs, i: 0, cur: qs[0].start ?? 0, mistakes: 0, results: [], waiting: false, done: false, hint: false };
    shell.show('klok');
    render();
    if (!seenHow()[mode]) {
      shell.showOverlay({
        art: `<span class="klok-ov">${modeSvg(mode)}</span>`,
        title: t('klok.howTitle'),
        text: t(`klok.how.${mode}`),
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

  function resume() {
    if (!game || game.done) return;
    shell.show('klok');
    if (game.waiting) nextQuestion(); // the explanation card was up when the child left
    else render();
  }

  /** Android back and the menu button: to the menu, the round is kept ("keep playing"). */
  function leave() {
    clearTimer();
    shell.hideOverlay();
    shell.show('klok-menu');
  }

  // ---------- one question ----------

  function render() {
    if (!game) return;
    const { mode } = game;
    $('#klok-sub').textContent = t(`klok.mode.${mode}`);
    $('#klok-title').textContent = game.roundId ? t('klok.round', { n: game.roundId.split('-')[2] }) : t('random.title');
    $('#screen-klok').dataset.mode = mode;
    renderPrompt();
    renderFace();
    renderControls();
    renderDots();
    setStatus('');
  }

  function renderPrompt() {
    const box = $('#klok-prompt');
    box.textContent = '';
    const lang = getLang();
    const it = q();
    if (game.mode === 'set') {
      const lead = document.createElement('span');
      lead.className = 'klok-lead';
      lead.textContent = t('klok.setTo');
      const big = document.createElement('span');
      big.className = 'klok-target';
      const dig = document.createElement('span');
      dig.className = 'klok-digital';
      if (tierInfo().digital24) {
        big.textContent = digital(it.target, { h24: true });
        big.classList.add('digits');
        dig.textContent = '';
        dig.hidden = true;
      } else {
        big.textContent = capital(phrase(it.target, lang));
        dig.textContent = digital(it.target);
      }
      box.append(lead, big, dig);
    } else if (game.mode === 'read') {
      const lead = document.createElement('span');
      lead.className = 'klok-target small';
      lead.textContent = t('klok.how.read');
      box.append(lead);
    } else {
      const lead = document.createElement('span');
      lead.className = 'klok-lead';
      lead.textContent = t('klok.whenDo');
      const what = document.createElement('span');
      what.className = 'klok-target';
      what.textContent = t(`klok.act.${it.activity}`);
      box.append(lead, what);
    }
  }

  function renderFace() {
    const face = $('#klok-face');
    const it = q();
    if (game.mode === 'set') {
      face.innerHTML = clockSvg(game.cur, { id: 'kc' });
      face.setAttribute('aria-label', t('klok.clockAria'));
      face.classList.add('interactive');
    } else if (game.mode === 'read') {
      face.innerHTML = clockSvg(it.target, { id: 'kc', dayPart: tierInfo().dayPart });
      face.setAttribute('aria-label', `${t('klok.readAria')}`);
      face.classList.remove('interactive');
    } else {
      face.innerHTML = activitySvg(it.activity); // the daily rhythm: the picture is the question
      face.setAttribute('aria-label', t(`klok.act.${it.activity}`));
      face.classList.remove('interactive');
    }
    face.classList.toggle('activity', game.mode === 'day');
    face.classList.toggle('hinting', false);
  }

  function renderControls() {
    const box = $('#klok-controls');
    box.textContent = '';
    box.dataset.mode = game.mode;
    const lang = getLang();
    const it = q();
    if (game.mode === 'set') {
      const step = Math.min(tierInfo().step, 60);
      const group = (hand, labelKey, minusKey, plusKey, by) => {
        const g = document.createElement('div');
        g.className = `klok-nudge ${hand}`;
        const name = document.createElement('span');
        name.className = 'klok-nudge-name';
        name.textContent = t(labelKey);
        const minus = button('−', `klok-btn round ${hand}`, () => setTime(nudge(game.cur, -by)), t(minusKey));
        const plus = button('+', `klok-btn round ${hand}`, () => setTime(nudge(game.cur, by)), t(plusKey));
        minus.dataset.nudge = `${hand}-`;
        plus.dataset.nudge = `${hand}+`;
        g.append(minus, name, plus);
        return g;
      };
      const row = document.createElement('div');
      row.className = 'klok-nudges';
      row.appendChild(group('hour', 'klok.hourHand', 'klok.hourMinus', 'klok.hourPlus', 60));
      if (step < 60) row.appendChild(group('minute', 'klok.minuteHand', 'klok.minuteMinus', 'klok.minutePlus', step));
      const check = button(t('klok.check'), 'btn big primary klok-check', check_);
      check.id = 'klok-check';
      box.append(row, check);
    } else if (game.mode === 'read') {
      const grid = document.createElement('div');
      grid.className = `klok-options n${it.options.length}`;
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', t('klok.options'));
      it.options.forEach((o, k) => {
        const text = label(o.t, game.tier, lang);
        const b = button(tierInfo().digital24 ? text : capital(text), `klok-option${tierInfo().digital24 ? ' digits' : ''}`, () => answer(k));
        b.dataset.option = String(k);
        grid.appendChild(b);
      });
      box.appendChild(grid);
    } else {
      const grid = document.createElement('div');
      grid.className = 'klok-options clocks';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', t('klok.options'));
      it.options.forEach((o, k) => {
        const b = button('', 'klok-option clock', () => answer(k), `${phrase(o.t, lang)} ${dayPartWord(o.t)}`);
        b.innerHTML = clockSvg(o.t, { dayPart: true, small: true });
        b.dataset.option = String(k);
        grid.appendChild(b);
      });
      box.appendChild(grid);
    }
  }

  function button(text, cls, fn, aria = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('click', () => {
      if (!game || game.waiting || overlayUp()) return;
      sfx.unlock();
      fn();
    });
    return b;
  }

  function renderDots() {
    const box = $('#klok-dots');
    box.textContent = '';
    for (let k = 0; k < ROUND_LEN; k++) {
      const d = document.createElement('span');
      const r = game.results[k];
      d.className = `klok-dot${r === true ? ' good' : r === false ? ' bad' : ''}${k === game.i && !game.done ? ' now' : ''}`;
      box.appendChild(d);
    }
    box.setAttribute('aria-label', t('klok.progress', { done: Math.min(game.i, ROUND_LEN), total: ROUND_LEN }));
  }

  let statusText = '';
  function setStatus(text) {
    statusText = text;
    $('#klok-status').textContent = statusText;
  }

  // ---------- setting the clock ----------

  function setTime(next) {
    if (!game || game.mode !== 'set' || game.waiting) return;
    if (next === game.cur) return;
    game.cur = next;
    setHands($('#klok-face'), 'kc', game.cur);
    sfx.ticktock(tickN++);
    if (game.hint) showHint(); // the highlighted hand follows what is still wrong
  }

  function check_() {
    if (!game || game.mode !== 'set' || game.waiting) return;
    const it = q();
    if (sameFace(game.cur, it.target)) correct();
    else {
      wrong(() => {
        game.cur = it.target;
        setHands($('#klok-face'), 'kc', game.cur);
      });
    }
  }

  // Dragging a hand: pointer events on the clock. The nearer hand (by angle) follows the finger.
  const face = $('#klok-face');
  const toSvg = (e) => {
    const svg = face.querySelector('svg');
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : null;
  };
  face.addEventListener('pointerdown', (e) => {
    if (!game || game.mode !== 'set' || game.waiting || overlayUp()) return;
    const p = toSvg(e);
    if (!p) return;
    const r = Math.hypot(p.x - 100, p.y - 100);
    if (r > 104) return; // outside the clock
    e.preventDefault();
    sfx.unlock();
    const a = pointAngle(p.x, p.y, 100, 100);
    let hand = nearestHand(a, game.cur);
    if (hand === 'minute' && tierInfo().step >= 60) hand = 'hour'; // whole hours: the long hand stays on 12
    drag = { hand, id: e.pointerId };
    face.setPointerCapture?.(e.pointerId);
    face.querySelector(`#kc-${hand}`)?.classList.add('grabbed');
    moveTo(a, true);
  });
  face.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = toSvg(e);
    if (p) moveTo(pointAngle(p.x, p.y, 100, 100));
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    face.querySelector(`#kc-${drag.hand}`)?.classList.remove('grabbed');
    drag = null;
  };
  face.addEventListener('pointerup', endDrag);
  face.addEventListener('pointercancel', endDrag);
  function moveTo(a, jump = false) {
    if (!drag || !game) return;
    setTime(drag.hand === 'minute' ? dragMinute(game.cur, a, tierInfo().step, { jump }) : dragHour(game.cur, a));
  }

  // ---------- answering ----------

  function answer(k) {
    if (!game || game.mode === 'set' || game.waiting) return;
    const it = q();
    const o = it.options[k];
    const buttons = [...document.querySelectorAll('#klok-controls .klok-option')];
    if (o.correct) {
      buttons[k]?.classList.add('right');
      correct();
    } else {
      buttons[k]?.classList.add('wrong');
      const right = it.options.findIndex((x) => x.correct);
      buttons[right]?.classList.add('right');
      wrong();
    }
  }

  function correct() {
    game.results[game.i] = true;
    game.waiting = true;
    sfx.chime();
    setStatus(t('klok.good'));
    $('#klok-face').classList.add('happy');
    renderDots();
    const token = plays;
    timer = setTimeout(() => {
      timer = null;
      if (token !== plays) return;
      $('#klok-face').classList.remove('happy');
      nextQuestion();
    }, 900);
  }

  function wrong(showRight = () => {}) {
    game.results[game.i] = false;
    game.mistakes++;
    game.waiting = true;
    sfx.boop();
    renderDots();
    showRight();
    const it = q();
    const lang = getLang();
    const time = game.mode === 'day' ? `${phrase(it.target, lang)} ${dayPartWord(it.target)}` : tierInfo().digital24 ? digital(it.target, { h24: true }) : phrase(it.target, lang);
    const text = game.mode === 'day' ? t('klok.whyDay', { what: t(`klok.act.${it.activity}`), time }) : `${t('klok.itIs', { time })} ${explain(it.target)}`;
    const token = plays;
    // a moment to see the right answer on the clock or the buttons, then the explanation
    timer = setTimeout(() => {
      timer = null;
      if (token !== plays || !onScreen('klok')) return;
      shell.showOverlay({
        art: `<span class="klok-ov">${clockSvg(it.target, { dayPart: game.mode !== 'set' && (game.mode === 'day' || tierInfo().dayPart), small: true })}</span>`,
        title: t('klok.wrongTitle'),
        text,
        buttons: [[t('klok.goOn'), 'big primary', () => (shell.hideOverlay(), nextQuestion())]],
      });
    }, 700);
  }

  /** Why: where the hands are, and for the 24-hour clock how the hours count on. */
  function explain(target) {
    const h = hour12(target);
    const next = h === 12 ? 1 : h + 1;
    const m = minuteOf(target);
    let why;
    if (m === 0) why = t('klok.whyWhole', { h });
    else if (minutePosition(target) !== null) why = t('klok.whyNumber', { pos: minutePosition(target), h, next });
    else why = t('klok.whyMinute', { m, h, next });
    const h24 = Math.floor((((target % 1440) + 1440) % 1440) / 60);
    if (tierInfo().digital24 && h24 >= 13) why = `${why} ${t('klok.why24', { h12: h24 - 12, h24, part: dayPartWord(target) })}`;
    return why;
  }

  function dayPartWord(time) {
    const h = Math.floor((((time % 1440) + 1440) % 1440) / 60);
    return h < 12 ? t('klok.morning') : h < 18 ? t('klok.afternoon') : t('klok.evening');
  }

  function nextQuestion() {
    if (!game) return;
    game.waiting = false;
    game.hint = false;
    game.i++;
    if (game.i >= ROUND_LEN) {
      finish();
      return;
    }
    game.cur = q().start ?? game.cur;
    render();
  }

  function finish() {
    game.done = true;
    const n = starsFor(game.mistakes);
    if (game.roundId) store.recordStars(meta.id, game.roundId, n);
    else store.recordRandomSolved(meta.id, `${game.mode}-${game.tier}`);
    renderDots();
    sfx.chime();
    const right = game.results.filter(Boolean).length;
    const g = game;
    const buttons = [];
    let text = t('klok.winText', { right, total: ROUND_LEN });
    if (!g.roundId) {
      text = `${text} ${t('random.done', { n: randomDone()[`${g.mode}-${g.tier}`] || 1 })}`;
      buttons.push([t('random.new'), 'big primary', () => (shell.hideOverlay(), playRandom(g.mode, g.tier))]);
    } else {
      const next = nextRoundId(g.roundId);
      if (next && !locked(next.split('-')[0], next.split('-')[1])) buttons.push([t('klok.next'), 'big primary', () => (shell.hideOverlay(), startRound(next))]);
      else if (next) {
        text = `${text} ${t('klok.lastFree')}`;
        buttons.push([t('klok.more'), 'big primary', () => (shell.show('klok-menu'), offer())]);
      }
      buttons.push([t('klok.again'), 'big secondary', () => (shell.hideOverlay(), startRound(g.roundId))]);
    }
    buttons.push([t('klok.rounds'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('klok-menu')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`klok.win${n}`),
      text,
      buttons,
    });
  }

  /** The next round of the same kind: the next round of this tier, then the first of the next tier. */
  function nextRoundId(id) {
    const [mode, tier, r] = id.split('-');
    if (Number(r) < ROUNDS_PER_TIER) return `${mode}-${tier}-${Number(r) + 1}`;
    const tiers = tiersOf(mode);
    const k = tiers.indexOf(tier);
    return k >= 0 && k + 1 < tiers.length ? `${mode}-${tiers[k + 1]}-1` : null;
  }

  // ---------- hint ----------

  function showHint() {
    if (!game || game.waiting) return;
    const face = $('#klok-face');
    face.querySelectorAll('.klok-hand').forEach((h) => h.classList.remove('hint'));
    if (game.mode === 'set') {
      const hand = hintHand(game.cur, q().target);
      face.querySelector(`#kc-${hand}`)?.classList.add('hint');
      setStatus(t(hand === 'minute' ? 'klok.hintMinute' : 'klok.hintHour'));
    } else if (game.mode === 'read') {
      face.querySelector('#kc-minute')?.classList.add('hint');
      setStatus(t('klok.hintRead'));
    } else {
      document.querySelectorAll('#klok-controls .klok-daypart').forEach((d) => d.classList.add('hint'));
      setStatus(t('klok.hintDay'));
    }
  }

  $('#klok-hint').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${BULB}</svg>`;
  $('#klok-hint').addEventListener('click', () => {
    if (!game || game.done || overlayUp()) return;
    tap();
    game.hint = true;
    showHint();
  });
  $('#klok-back').addEventListener('click', () => {
    tap();
    leave();
  });
  document.addEventListener('keydown', (e) => {
    if (!game || !onScreen('klok') || overlayUp() || game.waiting) return;
    if (game.mode === 'set') {
      const step = Math.min(tierInfo().step, 60);
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setTime(nudge(game.cur, step));
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setTime(nudge(game.cur, -step));
      else if (e.key === 'Enter') check_();
    } else if (/^[1-4]$/.test(e.key)) {
      const k = Number(e.key) - 1;
      if (k < q().options.length) answer(k);
    }
  });

  return {
    async init() {
      return true; // everything is made in code; nothing to load
    },
    open() {
      shell.show('klok-menu');
    },
    leave,
    testHook() {
      return {
        state: () =>
          game && {
            mode: game.mode,
            tier: game.tier,
            roundId: game.roundId,
            i: game.i,
            cur: game.cur,
            target: game.qs[game.i]?.target,
            correctOption: game.qs[game.i]?.options?.findIndex((o) => o.correct),
            mistakes: game.mistakes,
            done: game.done,
            waiting: game.waiting,
          },
        start: (id) => startRound(id),
        random: (mode, tier) => playRandom(mode, tier),
        setTime: (x) => setTime(x),
        check: () => check_(),
        answer: (k) => answer(k),
        stars: () => stars(),
      };
    },
  };
}

function capital(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
