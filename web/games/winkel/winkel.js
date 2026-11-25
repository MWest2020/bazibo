// Winkeltje (Little Shop): counting money in a little shop drawn in code. The child buys a thing by
// laying coins (and later notes) from the purse on the counter until the price is paid, then taps
// Betalen; later it gives change from the till by counting up from the price, adds two things, and
// picks what fits a budget. A tap on a coin lays it on the counter, a tap on the counter takes it
// back; dragging works both ways too. The shopkeeper (a mouse in an apron behind the counter) says
// everything in a speech bubble, as a shop would (`shopLine`): the price at the start, "Nog € 1,
// alsjeblieft." with ghost coins for too little, what is over for too much, thanks and the thing in
// a bag when it is right. Nothing is ever "wrong", and after MAX_TRIES the shop shows how to pay.
// No voice; the sounds are the shell's (plink, boop, bounce, chime).
// The maths is pure (rules.js), the drawings in art.js; the shell (web/js/main.js) owns the overlay
// card, the sound settings and the purchase, passed in as `shell`.
//
// Saved (games.winkel): stars per round (only ever raised), random rounds done per tier, which
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
  money,
  total,
  left,
  lay,
  takeBack,
  takeOne,
  toggle,
  judge,
  judgeBasket,
  countUp,
  fewest,
  isNote,
  shopLine,
  lineText,
} from './rules.js';
import { moneySvg, itemSvg, howSvg, keeperSvg, tillSvg, bagSvg } from './art.js';
import * as store from '../../js/storage.js';
import { newSeed, randomCard } from '../../js/random.js';
import * as sfx from '../../js/audio.js';
import { getLang } from '../../js/i18n.js';
import { foldLocked } from '../../js/fold.js';
import { menuLine, levelCell } from '../../js/menu.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const MINUS = '−';
const DRAG_START = 10; // px a finger moves before a tap becomes a drag

export function createWinkel(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  const randomDone = () => store.loadRandomSolved(meta.id);
  const lastTier = () => {
    const v = store.loadGameOption(meta.id, 'lastTier', 't1');
    return TIER_IDS.includes(v) ? v : 't1';
  };

  // { tier, roundId (null when random), seed, qs, i, laid, picked, fb (what the last try showed,
  //   until the counter changes), line (what the shopkeeper says now), mistakes, results, tries,
  //   shown, waiting, done }
  let game = null;
  let plays = 0; // counts rounds started, so a late timer never acts on a newer round
  let timer = null;

  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const locked = (tier) => meta.isLocked({ tier }, shell.unlock.owned);
  const q = () => game.qs[game.i];
  const busy = () => !game || game.waiting || game.done || overlayUp();
  const fmt = (c) => money(c, getLang(), { decimals: !!(game && TIERS[game.tier].cents) });
  const units = () => ({ cent: t('winkel.cent'), euro: t('winkel.euro') });
  const art = (d, cls = '') => moneySvg(d, { unit: d >= 100 ? units().euro : units().cent, cls });

  $('#wk-keeper').innerHTML = keeperSvg();
  $('#wk-till-art').innerHTML = tillSvg();

  shell.unlock.onChange(() => {
    if (onScreen('winkel-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'winkel-menu') renderMenu();
    if (name !== 'winkel') {
      clearTimer();
      dropDrag();
    }
  });
  shell.onLangChange(() => {
    if (onScreen('winkel-menu')) renderMenu();
    if (game && !game.done && onScreen('winkel')) render();
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
      if (token === plays && game && onScreen('winkel')) fn();
    }, ms);
  }

  // ---------- menu ----------

  function renderMenu() {
    const box = $('#winkel-menu');
    box.textContent = '';
    if (game && !game.done) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'winkel-continue';
      cont.className = 'btn big secondary menu-continue';
      cont.textContent = t('winkel.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      box.appendChild(cont);
    }
    const head = document.createElement('div');
    head.className = 'wk-menu-art';
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
        title: `${t('random.play')} · ${t(`winkel.short.${rtier}`)}`,
        locked: !shell.unlock.owned,
        solved: done[rtier] || 0,
        done: true,
        onPlay: () => playRandom(rtier),
        onLocked: () => shell.offerUnlock(t('winkel.randomLead')),
      }),
    );
    box.appendChild(rgrid);
    for (const tier of TIER_IDS) {
      box.appendChild(menuLine(t('winkel.tierLine', { age: TIERS[tier].age, what: t(`winkel.tier.${tier}`) })));
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
          b.setAttribute('aria-label', t('winkel.roundLocked', { n: r }));
          b.addEventListener('click', () => {
            tap();
            offer();
          });
        } else {
          b.setAttribute('aria-label', n ? t('winkel.roundStars', { n: r, stars: n }) : t('winkel.roundOpen', { n: r }));
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

  $('#winkel-menu-back').addEventListener('click', () => {
    tap();
    shell.show('home');
  });

  function offer() {
    shell.offerUnlock(t('winkel.lockedLead'));
  }

  // ---------- rounds ----------

  function startRound(id) {
    const [tier, r] = String(id).split('-');
    if (!TIER_IDS.includes(tier) || !(Number(r) >= 1 && Number(r) <= ROUNDS_PER_TIER)) return;
    if (locked(tier)) {
      offer();
      return;
    }
    begin({ tier, roundId: id, seed: hashSeed(`winkel:${id}`), round: Number(r) });
  }

  function playRandom(tier, seed = null) {
    if (!shell.unlock.owned) {
      shell.offerUnlock(t('winkel.randomLead'));
      return;
    }
    if (!TIER_IDS.includes(tier)) return;
    begin({ tier, roundId: null, seed: seed ?? newSeed(), round: 0 });
  }

  function begin({ tier, roundId, seed, round }) {
    plays++;
    clearTimer();
    dropDrag();
    if (lastTier() !== tier) store.saveGameOption(meta.id, 'lastTier', tier);
    const qs = makeRound({ tier, seed, round });
    game = { tier, roundId, seed, qs, i: 0, laid: [], picked: [], fb: null, line: null, mistakes: 0, results: [], tries: 0, shown: false, right: false, waiting: false, done: false };
    hello();
    shell.show('winkel');
    render();
    if (!seenHow()[tier]) {
      shell.showOverlay({
        art: `<span class="wk-ov">${howSvg()}</span>`,
        title: t('winkel.howTitle'),
        text: t(`winkel.how.${tier}`),
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
    shell.show('winkel');
    // left in the pause after a second try: the shop still shows how to pay before moving on
    if (game.waiting && !game.right && !game.shown && game.tries >= MAX_TRIES) {
      render();
      later(600, showWay);
    } else if (game.waiting) nextQuestion();
    else render();
  }

  /** Android back and the menu button: to the menu, the round is kept ("keep playing"). */
  function leave() {
    clearTimer();
    dropDrag();
    shell.hideOverlay();
    shell.show('winkel-menu');
  }
  $('#winkel-back').addEventListener('click', () => {
    tap();
    leave();
  });

  // ---------- one question ----------

  function render() {
    if (!game) return;
    const it = q();
    const screen = $('#screen-winkel');
    screen.dataset.tier = game.tier;
    screen.dataset.ask = it.ask;
    screen.dataset.kind = it.kind;
    $('#wk-stage').classList.toggle('happy', !!game.right);
    $('#wk-sub').textContent = t('winkel.menu');
    $('#wk-title').textContent = game.roundId ? t('winkel.round', { n: game.roundId.split('-')[1] }) : t('random.title');
    renderSay();
    renderGoods();
    renderSum();
    renderCounter();
    renderWallet();
    renderPay();
    renderDots();
  }

  /** The shopkeeper's line in the bubble; it bobs happily while a right answer is thanked. */
  function renderSay() {
    if (!game.line) hello();
    $('#wk-say').textContent = lineText(game.line, t, fmt);
    $('#wk-keeper').classList.toggle('happy', !!game.right);
  }

  /** The greeting with the price at the start of a question (`again`: the price once more). */
  function hello(again = false) {
    game.line = { ...shopLine(q(), { say: 'hello', i: game.i, again }), hello: true };
  }

  function say(line) {
    game.line = line;
    renderSay();
  }

  /** The thing (or things) to buy with their price tags; in a budget question, four to pick from. */
  function renderGoods() {
    const it = q();
    const box = $('#wk-goods');
    box.textContent = '';
    box.className = `wk-goods n${it.items.length}`;
    box.setAttribute('aria-label', t('winkel.goods'));
    it.items.forEach((item, k) => {
      const name = t(`winkel.item.${item.id}`);
      const el = document.createElement(it.ask === 'basket' ? 'button' : 'div');
      // paid: the thing goes into a bag (in a budget question the two that were bought)
      const sold = !!game.right && (it.ask !== 'basket' || game.picked.includes(k));
      el.className = `wk-good${sold ? ' sold' : ''}`;
      el.dataset.item = item.id;
      el.dataset.k = String(k);
      el.innerHTML = `${sold ? bagSvg(item.id) : itemSvg(item.id)}<span class="wk-tag">${fmt(item.price)}</span>`;
      if (it.ask === 'basket') {
        el.type = 'button';
        const on = game.picked.includes(k);
        el.classList.toggle('picked', on);
        el.setAttribute('aria-pressed', String(on));
        el.setAttribute('aria-label', t('winkel.priceAria', { item: name, price: fmt(item.price) }));
        if (game.shown && it.best.includes(k)) el.classList.add('right');
        if (game.fb && game.fb.why === 'over' && on) el.classList.add('over');
        el.addEventListener('click', () => {
          sfx.unlock();
          pickItem(k);
        });
      } else {
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', t('winkel.priceAria', { item: name, price: fmt(item.price) }));
      }
      box.appendChild(el);
    });
    if (it.ask === 'change') {
      const paid = document.createElement('div');
      paid.className = 'wk-paid';
      paid.setAttribute('role', 'img');
      paid.setAttribute('aria-label', `${t('winkel.paid')}: ${fmt(it.paid)}`);
      paid.innerHTML = `${art(it.paid)}<span class="wk-paid-word">${t('winkel.paid')}</span>`;
      box.appendChild(paid);
    }
  }

  /** The sum to work out: two things together, or the change ("€ 5,00 − € 3,40"). */
  function renderSum() {
    const it = q();
    const el = $('#wk-sum');
    let text = '';
    const end = game.right || game.shown ? fmt(it.target) : '?';
    if (it.kind === 'two') text = `${fmt(it.items[0].price)} + ${fmt(it.items[1].price)} = ${end}`;
    else if (it.kind === 'change') text = `${fmt(it.paid)} ${MINUS} ${fmt(it.price)} = ${end}`;
    el.textContent = text;
    el.hidden = !text;
    // sideways phones show the sum of two things on the counter (the shelf has no room for it)
    $('#wk-sum-side').textContent = it.kind === 'two' ? text : '';
  }

  /** What lies on the counter (or in the basket), its total, and what is missing or over. */
  function renderCounter() {
    const it = q();
    const box = $('#wk-laid');
    box.textContent = '';
    const counter = $('#wk-counter');
    counter.classList.toggle('right', !!(game.right || game.shown));
    counter.setAttribute('aria-label', t(it.ask === 'basket' ? 'winkel.basket' : 'winkel.counter'));
    const fb = game.fb;
    if (it.ask === 'basket') {
      const sum = game.picked.reduce((s, k) => s + it.items[k].price, 0);
      $('#wk-total').textContent = t('winkel.together', { amount: fmt(sum) });
      for (const k of game.picked) {
        const item = it.items[k];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `wk-piece wk-basket-item${fb && fb.why === 'over' ? ' over' : ''}${game.shown ? ' right' : ''}`;
        b.dataset.k = String(k);
        b.innerHTML = itemSvg(item.id);
        b.setAttribute('aria-label', t('winkel.outAria', { item: t(`winkel.item.${item.id}`) }));
        b.addEventListener('click', () => {
          sfx.unlock();
          pickItem(k);
        });
        box.appendChild(b);
      }
      $('#wk-pips').hidden = true;
      $('#wk-upline').hidden = true;
      return;
    }
    const sum = total(game.laid);
    $('#wk-total').textContent = t(it.ask === 'change' ? 'winkel.back' : 'winkel.onCounter', { amount: fmt(sum) });
    // too much: the pieces that are over; a counter the purse cannot put right by adding or taking
    // back alone (too little, or too much with nothing that makes it): the pieces to swap
    const extra = new Set(fb && fb.why === 'over' && fb.extra ? fb.extra : fb && fb.back ? fb.back : []);
    const done = game.right || game.shown;
    if (!TIERS[game.tier].piles) {
      // the youngest: every coin on its own, so they can be counted
      game.laid.forEach((d, i) => {
        const b = pieceButton(d, `wk-piece${extra.has(i) ? ' over' : ''}${done ? ' right' : ''}`);
        b.dataset.i = String(i);
        b.setAttribute('aria-label', t('winkel.backAria', { v: fmt(d) }));
        box.appendChild(b);
      });
    } else {
      // a pile per coin or note, biggest first; a tap takes one back
      const kinds = [...new Set(game.laid)].sort((a, b) => b - a);
      for (const d of kinds) {
        const idx = game.laid.map((x, i) => (x === d ? i : -1)).filter((i) => i >= 0);
        const n = idx.length;
        const b = pieceButton(d, `wk-piece wk-pile${isNote(d) ? ' note' : ''}${idx.some((i) => extra.has(i)) ? ' over' : ''}${done ? ' right' : ''}`, Math.min(n, 3));
        if (n > 1) b.insertAdjacentHTML('beforeend', `<span class="wk-count">×${n}</span>`);
        b.setAttribute('aria-label', n > 1 ? t('winkel.pileAria', { n, v: fmt(d) }) : t('winkel.backAria', { v: fmt(d) }));
        box.appendChild(b);
      }
    }
    // what goes on: the missing coins (or those to swap in) as dashed ghosts, never buttons. The
    // youngest see each coin; the others a small ghost per coin with its count, first on the
    // counter, so it stays in sight however many piles lie there
    if (fb && fb.ghosts && fb.ghosts.length) {
      const piles = TIERS[game.tier].piles;
      const kinds = piles ? [...new Set(fb.ghosts)].sort((a, b) => b - a) : fb.ghosts;
      for (const d of kinds) {
        const g = document.createElement('span');
        g.className = `wk-piece wk-ghost${isNote(d) ? ' note' : ''}${piles ? ' wk-pile' : ''}`;
        g.setAttribute('aria-hidden', 'true');
        g.innerHTML = art(d);
        const n = piles ? fb.ghosts.filter((x) => x === d).length : 1;
        if (n > 1) g.insertAdjacentHTML('beforeend', `<span class="wk-count">×${n}</span>`);
        box.appendChild(g);
      }
    }
    renderPips();
    const up = $('#wk-upline');
    if (it.ask === 'change') {
      up.hidden = false;
      up.textContent = countUp(it.price, game.laid).map(fmt).join(' → ');
    } else up.hidden = true;
  }

  function pieceButton(d, cls, stack = 1) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.dataset.d = String(d);
    const layers = [];
    for (let k = stack - 1; k >= 0; k--) layers.push(`<span class="wk-layer l${k}">${art(d)}</span>`);
    b.innerHTML = layers.join('');
    return b;
  }

  /** The youngest: a dot per euro of the price, filled as coins are laid (a € 2 fills two). */
  function renderPips() {
    const box = $('#wk-pips');
    const it = q();
    const on = game.tier === 't1' && it.ask === 'pay';
    box.hidden = !on;
    if (!on) return;
    const n = it.target / 100;
    const sum = Math.floor(total(game.laid) / 100);
    const done = Math.min(n, sum);
    const parts = [];
    for (let k = 0; k < Math.max(n, sum); k++) parts.push(`<span class="wk-pip${k < done ? ' on' : ''}${k >= n ? ' over' : ''}"></span>`);
    box.innerHTML = parts.join('');
    box.setAttribute('aria-label', t('winkel.pips', { done, n }));
  }

  /** The purse (or the till): a stack per coin and note with how many are left. */
  function renderWallet() {
    const it = q();
    const box = $('#wk-wallet');
    box.textContent = '';
    const cap = $('#wk-wallet-cap');
    if (it.ask === 'basket') {
      // what the child has, to look at only
      box.setAttribute('aria-label', t('winkel.purse', { budget: fmt(it.budget) }));
      box.className = 'wk-wallet purse';
      cap.hidden = false;
      cap.textContent = t('winkel.purse', { budget: fmt(it.budget) });
      const have = fewest(it.budget, { 100: 5, 200: 5, 500: 2, 1000: 1 }) || [];
      for (const d of have) {
        const s = document.createElement('span');
        s.className = `wk-stack still${isNote(d) ? ' note' : ''}`;
        s.setAttribute('aria-hidden', 'true');
        s.innerHTML = art(d);
        box.appendChild(s);
      }
      return;
    }
    box.className = 'wk-wallet';
    box.setAttribute('aria-label', t(it.ask === 'change' ? 'winkel.till' : 'winkel.wallet'));
    cap.hidden = it.ask !== 'change';
    cap.textContent = t('winkel.till');
    const rest = left(it.wallet, game.laid);
    const kinds = Object.keys(it.wallet)
      .map(Number)
      .sort((a, b) => a - b);
    for (const d of kinds) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `wk-stack${isNote(d) ? ' note' : ''}`;
      b.dataset.d = String(d);
      const n = rest[d] || 0;
      b.innerHTML = `${art(d)}<span class="wk-count">${n}</span>`;
      b.disabled = n <= 0;
      b.setAttribute('aria-label', t(isNote(d) ? 'winkel.noteAria' : 'winkel.coinAria', { v: fmt(d), n }));
      box.appendChild(b);
    }
  }

  function renderPay() {
    const it = q();
    const b = $('#wk-pay');
    b.textContent = t(it.ask === 'change' ? 'winkel.give' : it.ask === 'basket' ? 'winkel.buy' : 'winkel.pay');
    syncPay();
  }

  function syncPay() {
    const it = q();
    const b = $('#wk-pay');
    const empty = it.ask === 'basket' ? game.picked.length !== it.pick : !game.laid.length;
    b.disabled = !game || game.waiting || game.done || empty;
  }

  function renderDots() {
    const box = $('#wk-dots');
    box.textContent = '';
    for (let k = 0; k < ROUND_LEN; k++) {
      const d = document.createElement('span');
      const r = game.results[k];
      d.className = `klok-dot${r === true ? ' good' : r === false ? ' bad' : ''}${k === game.i && !game.done ? ' now' : ''}`;
      box.appendChild(d);
    }
    box.setAttribute('aria-label', t('winkel.progress', { done: Math.min(game.i, ROUND_LEN), total: ROUND_LEN }));
  }

  /** After the counter changed: forget what the last try showed, draw it again. */
  function changed() {
    game.fb = null;
    // after a try the shopkeeper says the price once more (no second greeting)
    if (!game.line?.hello) {
      hello(true);
      renderSay();
    }
    renderCounter();
    renderWallet();
    renderGoods();
    syncPay();
  }

  // ---------- laying, taking back, paying ----------

  function layCoin(d) {
    if (busy()) return;
    const next = lay(q(), game.laid, d);
    if (!next) {
      sfx.bounce();
      return;
    }
    game.laid = next;
    sfx.plink(Math.min(9, next.length));
    changed();
  }

  /** Take back the piece at `i` (the youngest) or one of a pile of `d`. */
  function takeCoin({ i = null, d = null }) {
    if (busy()) return;
    const next = i !== null ? takeBack(game.laid, i) : takeOne(game.laid, d);
    if (!next) return;
    game.laid = next;
    sfx.click();
    changed();
  }

  function pickItem(k) {
    if (busy() || q().ask !== 'basket') return;
    const next = toggle(q(), game.picked, k);
    if (!next) {
      sfx.bounce();
      return;
    }
    game.picked = next;
    sfx.plink(next.length + 1);
    changed();
  }

  function pay() {
    if (busy()) return;
    const it = q();
    // the same counter judged again (a double tap) counts nothing
    if (game.fb) {
      sfx.bounce();
      return;
    }
    const res = it.ask === 'basket' ? judgeBasket(it, game.picked) : judge(it, game.laid);
    if (res.ok) correct();
    else if (res.why !== 'count') wrong(res);
  }

  function correct() {
    if (game.results[game.i] === undefined) game.results[game.i] = true;
    game.waiting = true;
    game.right = true;
    game.line = shopLine(q(), { say: 'try', res: { ok: true } });
    sfx.chime();
    render();
    later(1800, nextQuestion);
  }

  /** Not yet: show what is missing or over, count it once; after MAX_TRIES the shop shows the way. */
  function wrong(res) {
    if (game.results[game.i] === undefined) {
      game.results[game.i] = false;
      game.mistakes++;
    }
    game.tries++;
    game.fb = res;
    sfx.boop();
    renderCounter();
    renderGoods();
    renderDots();
    syncPay();
    say(shopLine(q(), { say: 'try', res, laid: game.laid }));
    if (game.tries < MAX_TRIES) return;
    game.waiting = true;
    syncPay();
    later(1400, showWay);
  }

  /** The shop lays the right money (or picks a pair that fits), then the next question. */
  function showWay() {
    const it = q();
    game.shown = true;
    game.fb = null;
    if (it.ask === 'basket') game.picked = [...it.best];
    else game.laid = [...it.solution].reverse(); // small first: counting up
    game.line = shopLine(it, { say: 'show' });
    render();
    later(2400, nextQuestion);
  }

  function nextQuestion() {
    if (!game) return;
    game.waiting = false;
    game.tries = 0;
    game.shown = false;
    game.right = false;
    game.fb = null;
    game.laid = [];
    game.picked = [];
    game.i++;
    if (game.i >= ROUND_LEN) {
      finish();
      return;
    }
    hello();
    render();
  }

  function finish() {
    game.done = true;
    game.i = ROUND_LEN - 1;
    const n = starsFor(game.mistakes);
    if (game.roundId) store.recordStars(meta.id, game.roundId, n);
    else store.recordRandomSolved(meta.id, game.tier);
    renderDots();
    syncPay();
    sfx.chime();
    const right = game.results.filter(Boolean).length;
    const g = game;
    const buttons = [];
    let text = t('winkel.winText', { right, total: ROUND_LEN });
    if (!g.roundId) {
      text = `${text} ${t('random.done', { n: randomDone()[g.tier] || 1 })}`;
      buttons.push([t('random.new'), 'big primary', () => (shell.hideOverlay(), playRandom(g.tier))]);
    } else {
      const next = nextRoundId(g.roundId);
      if (next && !locked(next.split('-')[0])) buttons.push([t('winkel.next'), 'big primary', () => (shell.hideOverlay(), startRound(next))]);
      else if (next) {
        text = `${text} ${t('winkel.lastFree')}`;
        buttons.push([t('winkel.moreRounds'), 'big primary', () => (shell.show('winkel-menu'), offer())]);
      }
      buttons.push([t('winkel.again2'), 'big secondary', () => (shell.hideOverlay(), startRound(g.roundId))]);
    }
    buttons.push([t('winkel.rounds'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('winkel-menu')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`winkel.win${n}`),
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

  $('#wk-pay').addEventListener('click', () => {
    sfx.unlock();
    pay();
  });

  // ---------- taps and drags on the purse and the counter ----------
  // A finger or mouse that lifts where it went down is a tap, handled on pointerup (a browser may
  // send no click for a touch right after a drag); one that moves DRAG_START px carries a copy of
  // the coin: dropped on the counter it is laid, a coin from the counter dropped anywhere else goes
  // back. The click a browser sends after either is eaten; a click without a pointer before it
  // (the keyboard) does the tap.

  let drag = null; // { from, d, i, x0, y0, id, ghost }
  let eatUntil = 0; // eat the click that follows a tap or drag handled here

  function dropDrag() {
    if (drag?.ghost) drag.ghost.remove();
    drag = null;
    $('#wk-counter')?.classList.remove('drop');
  }

  const inCounter = (x, y) => {
    const r = $('#wk-counter').getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  function onDown(e) {
    eatUntil = 0;
    if (e.button > 0 || drag) return;
    const b = e.target.closest('button[data-d]');
    if (!b || b.disabled || busy()) return;
    drag = { from: b.closest('#wk-wallet') ? 'wallet' : 'counter', d: Number(b.dataset.d), i: b.dataset.i != null ? Number(b.dataset.i) : null, x0: e.clientX, y0: e.clientY, id: e.pointerId, ghost: null };
  }

  function placeGhost(x, y) {
    const g = drag.ghost;
    g.style.transform = `translate(${(x - g.offsetWidth / 2).toFixed(1)}px, ${(y - g.offsetHeight * 0.75).toFixed(1)}px)`;
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < DRAG_START) return;
      const g = document.createElement('div');
      g.className = `wk-drag${isNote(drag.d) ? ' note' : ''}`;
      g.setAttribute('aria-hidden', 'true');
      g.innerHTML = art(drag.d);
      $('#screen-winkel').appendChild(g);
      drag.ghost = g;
    }
    e.preventDefault();
    placeGhost(e.clientX, e.clientY);
    $('#wk-counter').classList.toggle('drop', drag.from === 'wallet' && inCounter(e.clientX, e.clientY));
  }

  const piece = (d) => (d.i !== null ? { i: d.i } : { d: d.d });

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    const moved = !!d.ghost;
    dropDrag();
    eatUntil = performance.now() + 700;
    sfx.unlock();
    if (!moved) {
      // a tap: lay the coin, or take it back
      if (d.from === 'wallet') layCoin(d.d);
      else takeCoin(piece(d));
      return;
    }
    const over = inCounter(e.clientX, e.clientY);
    if (d.from === 'wallet' && over) layCoin(d.d);
    else if (d.from === 'counter' && !over) takeCoin(piece(d));
  }

  const eaten = () => {
    const eat = performance.now() < eatUntil;
    eatUntil = 0;
    return eat;
  };
  for (const sel of ['#wk-wallet', '#wk-laid']) $(sel).addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', (e) => {
    if (drag && e.pointerId === drag.id) dropDrag();
  });

  $('#wk-wallet').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b || eaten()) return;
    sfx.unlock();
    layCoin(Number(b.dataset.d));
  });
  $('#wk-laid').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b || eaten()) return;
    sfx.unlock();
    takeCoin(b.dataset.i != null ? { i: Number(b.dataset.i) } : { d: Number(b.dataset.d) });
  });

  return {
    async init() {
      return true;
    },
    open() {
      shell.show('winkel-menu');
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
            laid: [...game.laid],
            picked: [...game.picked],
            fb: game.fb,
            line: game.line && { key: game.line.key, text: $('#wk-say').textContent },
            mistakes: game.mistakes,
            tries: game.tries,
            shown: game.shown,
            done: game.done,
            waiting: game.waiting,
          },
        start: (id) => startRound(id),
        /** Go straight to question `i` of this round (layout checks). */
        show: (i) => {
          if (!game || !(i >= 0 && i < ROUND_LEN)) return;
          clearTimer();
          Object.assign(game, { i, laid: [], picked: [], fb: null, tries: 0, shown: false, right: false, waiting: false });
          hello();
          render();
        },
        random: (tier) => playRandom(tier),
        lay: (d) => layCoin(d),
        take: (i) => takeCoin({ i }),
        takeOne: (d) => takeCoin({ d }),
        pick: (k) => pickItem(k),
        pay: () => pay(),
        stars: () => stars(),
        /** A string in the language shown (the smoke test builds the expected lines with it). */
        t: (key) => t(key),
      };
    },
  };
}
