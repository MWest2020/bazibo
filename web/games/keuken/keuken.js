// Keukentje (Little Kitchen): what goes into bread and other dishes. The child cooks in a little
// kitchen drawn in code: a dish with empty bowls, and the ingredients to tap; when every bowl is
// full the dish is ready (it steams or sparkles). Older children say which dish the full bowls make,
// where an ingredient comes from, put the steps of a recipe in order and find the odd one out.
// Nothing is ever wrong: a tap that does not fit bounces back with a short line ("Dat hoort bij de
// pizza!"); after MAX_TRIES the answer glows. No timers, no voice; the shell's sounds.
// The rounds and what a tap means are pure (rules.js), the data in dishes.js, the drawings in
// art.js; the shell (web/js/main.js) owns the overlay card, the sound settings and the purchase.
//
// Saved (games.keuken): stars per round (only ever raised), random rounds done per tier, which
// how-to cards were seen and the last tier. All read from the save each time. An unfinished round
// is kept while the app stays open ("keep playing").
import { meta } from './meta.js';
import { TIERS, TIER_IDS, ROUNDS_PER_TIER, ROUND_LEN, MAX_TRIES, makeRound, starsFor, hashSeed, startState, tapOption, stillToTap } from './rules.js';
import { HOT, RECIPES } from './dishes.js';
import { ingredientSvg, dishSvg, sourceSvg, actSvg, howSvg, wallSvg, clocheSvg } from './art.js';
import * as store from '../../js/storage.js';
import { newSeed, randomCard } from '../../js/random.js';
import * as sfx from '../../js/audio.js';
import { foldLocked } from '../../js/fold.js';
import { menuLine, levelCell } from '../../js/menu.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';

/** The picture of a step ("pizza.3"): its recipe's act. */
const stepAct = (id) => {
  const [recipe, n] = id.split('.');
  return RECIPES[recipe]?.[Number(n) - 1];
};

export function createKeuken(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  const randomDone = () => store.loadRandomSolved(meta.id);
  const lastTier = () => {
    const v = store.loadGameOption(meta.id, 'lastTier', 't1');
    return TIER_IDS.includes(v) ? v : 't1';
  };

  // { tier, roundId (null when random), seed, qs, i, st, tried: Set, mistakes, results, tries, help,
  //   say: () => text, waiting, done }
  let game = null;
  let plays = 0; // counts rounds started, so a late timer never acts on a newer round
  let timer = null;

  $('#ke-wall').innerHTML = wallSvg();
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const locked = (tier) => meta.isLocked({ tier }, shell.unlock.owned);
  const q = () => game.qs[game.i];

  shell.unlock.onChange(() => {
    if (onScreen('keuken-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'keuken-menu') renderMenu();
    if (name !== 'keuken') clearTimer();
  });
  shell.onLangChange(() => {
    if (onScreen('keuken-menu')) renderMenu();
    if (game && !game.done && onScreen('keuken')) render();
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
      if (token === plays && game && onScreen('keuken')) fn();
    }, ms);
  }

  // ---------- menu ----------

  function renderMenu() {
    const box = $('#keuken-menu');
    box.textContent = '';
    if (game && !game.done) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'keuken-continue';
      cont.className = 'btn big secondary menu-continue';
      cont.textContent = t('keuken.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      box.appendChild(cont);
    }
    const head = document.createElement('div');
    head.className = 'ke-menu-art';
    head.innerHTML = howSvg();
    box.appendChild(head);
    const got = stars();
    const done = randomDone();
    const rtier = lastTier();
    const rgrid = document.createElement('div');
    rgrid.className = 'level-grid klok-grid';
    rgrid.appendChild(
      randomCard({
        t,
        tap,
        title: `${t('random.play')} · ${t(`keuken.short.${rtier}`)}`,
        locked: !shell.unlock.owned,
        solved: done[rtier] || 0,
        done: true,
        onPlay: () => playRandom(rtier),
        onLocked: () => shell.offerUnlock(t('keuken.randomLead')),
      }),
    );
    box.appendChild(rgrid);
    for (const tier of TIER_IDS) {
      box.appendChild(menuLine(t('keuken.tierLine', { age: TIERS[tier].age, what: t(`keuken.tier.${tier}`) })));
      const grid = document.createElement('div');
      grid.className = 'level-grid klok-grid';
      grid.dataset.tier = tier;
      for (let r = 1; r <= ROUNDS_PER_TIER; r++) {
        const id = `${tier}-${r}`;
        const isLocked = locked(tier);
        const n = isLocked ? 0 : got[id] || 0;
        const b = levelCell({ num: r, stars: n, locked: isLocked });
        b.dataset.round = id;
        if (isLocked) {
          b.setAttribute('aria-label', t('keuken.roundLocked', { n: r }));
          b.addEventListener('click', () => {
            tap();
            offer();
          });
        } else {
          b.setAttribute('aria-label', n ? t('keuken.roundStars', { n: r, stars: n }) : t('keuken.roundOpen', { n: r }));
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

  $('#keuken-menu-back').addEventListener('click', () => {
    tap();
    shell.show('home');
  });

  function offer() {
    shell.offerUnlock(t('keuken.lockedLead'));
  }

  // ---------- rounds ----------

  function startRound(id) {
    const [tier, r] = String(id).split('-');
    if (!TIER_IDS.includes(tier) || !(Number(r) >= 1 && Number(r) <= ROUNDS_PER_TIER)) return;
    if (locked(tier)) {
      offer();
      return;
    }
    begin({ tier, roundId: id, seed: hashSeed(`keuken:${id}`), round: Number(r) });
  }

  function playRandom(tier, seed = null) {
    if (!shell.unlock.owned) {
      shell.offerUnlock(t('keuken.randomLead'));
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
    game = { tier, roundId, seed, qs, i: 0, st: startState(), tried: new Set(), mistakes: 0, results: [], tries: 0, help: false, say: null, waiting: false, done: false };
    shell.show('keuken');
    render();
    if (!seenHow()[tier]) {
      shell.showOverlay({
        art: `<span class="ke-ov">${howSvg()}</span>`,
        title: t('keuken.howTitle'),
        text: t(`keuken.how.${tier}`),
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
    shell.show('keuken');
    if (game.waiting) nextQuestion();
    else render();
  }

  /** Android back and the menu button: to the menu, the round is kept ("keep playing"). */
  function leave() {
    clearTimer();
    shell.hideOverlay();
    shell.show('keuken-menu');
  }
  $('#keuken-back').addEventListener('click', () => {
    tap();
    leave();
  });

  // ---------- one question, drawn from its state (also after a language switch) ----------

  const ingName = (id) => t(`keuken.ing.${id}`);
  const dishName = (id) => t(`keuken.dish.${id}`);

  function render() {
    if (!game) return;
    const it = q();
    const screen = $('#screen-keuken');
    screen.dataset.tier = game.tier;
    screen.dataset.kind = it.kind;
    $('#ke-sub').textContent = t('keuken.menu');
    $('#ke-title').textContent = game.roundId ? t('keuken.round', { n: game.roundId.split('-')[1] }) : t('random.title');
    $('#ke-lead').textContent = lead(it);
    renderShow();
    renderBowls();
    renderOptions();
    renderDots();
    $('#ke-status').textContent = game.say ? game.say() : '';
  }

  function lead(it) {
    if (it.kind === 'fill') return t(game.tier === 't1' ? 'keuken.lead.fill' : 'keuken.lead.fillAll', { dish: t(`keuken.the.${it.dish}`) });
    return t(`keuken.lead.${it.kind}`);
  }

  /** The big picture: the dish being made (fading in as the bowls fill), or the ingredient asked about. */
  function renderShow() {
    const it = q();
    const box = $('#ke-show');
    box.classList.remove('ready', 'hot');
    box.textContent = '';
    box.hidden = it.kind === 'odd';
    if (box.hidden) return;
    const pic = document.createElement('div');
    pic.className = 'ke-dish';
    const name = document.createElement('p');
    name.className = 'ke-name';
    if (it.kind === 'from') {
      pic.innerHTML = ingredientSvg(it.ing);
      name.textContent = ingName(it.ing);
    } else if (it.kind === 'which' && !game.st.placed.length) {
      // under the cover until the child names it
      pic.innerHTML = clocheSvg();
      name.textContent = '?';
    } else {
      pic.innerHTML = dishSvg(it.dish);
      name.textContent = dishName(it.dish);
      if (HOT.has(it.dish)) box.classList.add('hot');
    }
    box.setAttribute('aria-label', name.textContent);
    box.append(pic, name);
    if (it.kind === 'fill' || it.kind === 'steps') {
      const steam = document.createElement('div');
      steam.className = 'ke-steam';
      steam.setAttribute('aria-hidden', 'true');
      steam.innerHTML = '<i></i><i></i><i></i>';
      pic.appendChild(steam);
    }
    syncFill();
  }

  /** How full the dish is (0..1): a fill by its bowls, steps by the steps done. */
  function syncFill() {
    const it = q();
    const pic = $('#ke-show .ke-dish');
    if (!pic) return;
    const total = it.kind === 'fill' ? it.need.length : it.kind === 'steps' ? it.steps.length : 1;
    const p = it.kind === 'fill' || it.kind === 'steps' ? game.st.placed.length / total : 1;
    pic.style.setProperty('--fill', p.toFixed(3));
    $('#ke-show').classList.toggle('ready', it.kind !== 'from' && game.st.placed.length >= total);
  }

  /** The bowls of a fill (empty or with what went in), the full bowls of "which dish?", the slots of the steps. */
  function renderBowls(pop = false) {
    const it = q();
    const box = $('#ke-bowls');
    box.textContent = '';
    box.hidden = it.kind === 'from' || it.kind === 'odd';
    if (box.hidden) return;
    if (it.kind === 'steps') {
      it.steps.forEach((_, k) => {
        const s = document.createElement('div');
        const id = game.st.placed[k];
        s.className = `ke-slot${id ? ' full' : ''}${pop && k === game.st.placed.length - 1 ? ' pop' : ''}`;
        s.innerHTML = id ? actSvg(stepAct(id)) : `<span class="ke-num">${k + 1}</span>`;
        box.appendChild(s);
      });
      box.dataset.n = String(it.steps.length);
      box.setAttribute('aria-label', t('keuken.slots', { n: game.st.placed.length, total: it.steps.length }));
      return;
    }
    const list = it.kind === 'which' ? it.shown : it.need.map((_, k) => game.st.placed[k] || null);
    list.forEach((id, k) => {
      const b = document.createElement('div');
      b.className = `ke-bowl${id ? ' full' : ''}${pop && k === game.st.placed.length - 1 ? ' pop' : ''}`;
      b.innerHTML = `${id ? ingredientSvg(id, 'in') : ''}<span class="ke-bowl-dish"></span>`;
      box.appendChild(b);
    });
    box.dataset.n = String(list.length);
    box.setAttribute(
      'aria-label',
      it.kind === 'which' ? t('keuken.shown', { list: it.shown.map(ingName).join(', ').replace(/­/g, '') }) : t('keuken.bowls', { n: game.st.placed.length, total: it.need.length }),
    );
  }

  function optionArt(it, id) {
    if (it.kind === 'which') return [dishSvg(id), dishName(id)];
    if (it.kind === 'from') return [sourceSvg(id), t(`keuken.src.${id}`)];
    if (it.kind === 'steps') return [actSvg(stepAct(id)), t(`keuken.step.${id}`)];
    return [ingredientSvg(id), ingName(id)];
  }

  function renderOptions() {
    const it = q();
    const box = $('#ke-options');
    box.textContent = '';
    box.className = `ke-options ${it.kind} n${it.options.length}`;
    box.setAttribute('aria-label', t('keuken.options'));
    const glow = game.help ? stillToTap(it, game.st) : [];
    for (const id of it.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ke-opt';
      b.dataset.id = id;
      const [art, name] = optionArt(it, id);
      b.innerHTML = art;
      const label = document.createElement('span');
      label.className = 'ke-label';
      label.textContent = name;
      b.appendChild(label);
      const placed = game.st.placed.includes(id);
      if (placed) b.classList.add(it.kind === 'fill' || it.kind === 'steps' ? 'placed' : 'right');
      if (game.tried.has(id)) b.classList.add('tried');
      if (glow.includes(id)) b.classList.add('help');
      b.disabled = placed || (game.tried.has(id) && it.kind !== 'steps') || game.waiting || game.done;
      b.addEventListener('click', () => {
        sfx.unlock();
        pick(id);
      });
      box.appendChild(b);
    }
  }

  function renderDots() {
    const box = $('#ke-dots');
    box.textContent = '';
    for (let k = 0; k < ROUND_LEN; k++) {
      const d = document.createElement('span');
      const r = game.results[k];
      d.className = `klok-dot${r === true ? ' good' : r === false ? ' bad' : ''}${k === game.i && !game.done ? ' now' : ''}`;
      box.appendChild(d);
    }
    box.setAttribute('aria-label', t('keuken.progress', { done: Math.min(game.i, ROUND_LEN), total: ROUND_LEN }));
  }

  function say(fn) {
    game.say = fn;
    $('#ke-status').textContent = fn ? fn() : '';
  }

  // ---------- tapping ----------

  function pick(id) {
    if (!game || game.waiting || game.done || overlayUp() || !onScreen('keuken')) return;
    const it = q();
    const r = tapOption(it, game.st, id);
    if (r.ok === null) return;
    const btn = document.querySelector(`#ke-options .ke-opt[data-id="${CSS.escape(id)}"]`);
    if (r.ok === false) {
      wrong(it, id, r, btn);
      return;
    }
    game.st = r.st;
    sfx.plink(Math.min(9, game.st.placed.length));
    if (it.kind === 'fill' || it.kind === 'steps') {
      renderBowls(true);
      syncFill();
      if (!r.done && !game.help) say(null);
    }
    if (r.done) correct(it);
    if (it.kind === 'which') renderShow(); // the cover comes off
    renderOptions();
  }

  /** A tap that does not fit: it bounces back with its line; after MAX_TRIES the answer glows. */
  function wrong(it, id, r, btn) {
    if (game.results[game.i] === undefined) {
      game.results[game.i] = false;
      game.mistakes++;
      renderDots();
    }
    game.tries++;
    if (it.kind !== 'steps') game.tried.add(id);
    sfx.boop();
    const line = whyLine(r);
    if (game.tries >= MAX_TRIES) game.help = true;
    say(game.help ? () => `${line()} ${t('keuken.help')}` : line);
    renderOptions();
    const again = document.querySelector(`#ke-options .ke-opt[data-id="${CSS.escape(id)}"]`) || btn;
    again?.classList.add('bounce');
  }

  function whyLine(r) {
    if (r.why === 'belongs') return () => t('keuken.belongs', { dish: t(`keuken.the.${r.about}`) });
    if (r.why === 'lacks') return () => t('keuken.lacks', { ing: ingName(r.about.ing).replace(/­/g, ''), dish: t(`keuken.the.${r.about.dish}`) });
    if (r.why === 'gives') return () => t(`keuken.gives.${r.about}`);
    if (r.why === 'later') return () => t('keuken.later');
    return () => t(`keuken.also.${r.about}`);
  }

  function correct(it) {
    if (game.results[game.i] === undefined) game.results[game.i] = true;
    game.waiting = true;
    game.help = false;
    let ms = 1500;
    if (it.kind === 'fill' || it.kind === 'steps') {
      say(() => t('keuken.ready'));
      ms = 1900;
    } else if (it.kind === 'from') {
      say(() => t(`keuken.fact.${it.ing}`));
      ms = 2800;
    } else if (it.kind === 'odd') {
      say(() => t(`keuken.group.${it.group}`));
      ms = 2200;
    } else say(() => t('keuken.good'));
    sfx.chime();
    renderDots();
    later(ms, nextQuestion);
  }

  function nextQuestion() {
    if (!game) return;
    game.waiting = false;
    game.tries = 0;
    game.help = false;
    game.say = null;
    game.tried = new Set();
    game.i++;
    if (game.i >= ROUND_LEN) {
      finish();
      return;
    }
    game.st = startState();
    render();
  }

  function finish() {
    game.done = true;
    const n = starsFor(game.mistakes);
    if (game.roundId) store.recordStars(meta.id, game.roundId, n);
    else store.recordRandomSolved(meta.id, game.tier);
    renderDots();
    for (const b of document.querySelectorAll('#ke-options .ke-opt')) b.disabled = true;
    sfx.chime();
    const right = game.results.filter(Boolean).length;
    const g = game;
    const buttons = [];
    let text = t('keuken.winText', { right, total: ROUND_LEN });
    if (!g.roundId) {
      text = `${text} ${t('random.done', { n: randomDone()[g.tier] || 1 })}`;
      buttons.push([t('random.new'), 'big primary', () => (shell.hideOverlay(), playRandom(g.tier))]);
    } else {
      const next = nextRoundId(g.roundId);
      if (next && !locked(next.split('-')[0])) buttons.push([t('keuken.next'), 'big primary', () => (shell.hideOverlay(), startRound(next))]);
      else if (next) {
        text = `${text} ${t('keuken.lastFree')}`;
        buttons.push([t('keuken.more'), 'big primary', () => (shell.show('keuken-menu'), offer())]);
      }
      buttons.push([t('keuken.again2'), 'big secondary', () => (shell.hideOverlay(), startRound(g.roundId))]);
    }
    buttons.push([t('keuken.rounds'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('keuken-menu')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`keuken.win${n}`),
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

  // the bounce is a CSS animation; take the class off when it ends so it can run again
  $('#ke-options').addEventListener('animationend', (e) => e.target.closest?.('.ke-opt')?.classList.remove('bounce'));

  return {
    async init() {
      return true;
    },
    open() {
      shell.show('keuken-menu');
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
            placed: [...game.st.placed],
            tried: [...game.tried],
            help: game.help,
            mistakes: game.mistakes,
            tries: game.tries,
            done: game.done,
            waiting: game.waiting,
            todo: stillToTap(game.qs[game.i] || game.qs[0], game.st),
          },
        start: (id) => startRound(id),
        random: (tier, seed) => playRandom(tier, seed),
        tap: (id) => pick(id),
        stars: () => stars(),
        saved: () => ({ stars: stars(), random: randomDone(), howSeen: seenHow(), lastTier: lastTier() }),
      };
    },
  };
}
