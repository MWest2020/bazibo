// Kwartet: the Dutch quartets card game. A child against 1-3 computer players, or children
// together on one device (a "pass the phone" card between their turns hides the cards). Ask
// another player for a card of a set you hold; you get it: ask again; you do not: the turn passes.
// Two players play with a pile: after a "no" the asker taps the pile (a computer draws by itself)
// and the card flies into the hand. Four of a set are laid down as a kwartet; the most kwartetten
// wins. The rules live in rules.js,
// the computer in ai.js, the cards in art.js; the shell (web/js/main.js) owns the overlay card,
// the sound settings and the purchase.
//
// Made readable for young children: the cards you may ask for are big buttons in your hand (the
// missing places of each set you hold), every question and answer shows as a speech bubble with
// the card's picture, and the computer's turns go slowly, one question at a time.
//
// Saved (games.kwartet): the child's wins against the computer per number of sets, as counters in
// `stars` ('won-<sets>'; only games with one child, only going up), and the last menu choice
// ('setup': { sets, players }). Games between children are not counted.
import { meta } from './meta.js';
import { newGame, ask as askRule, draw as drawRule, canDraw, usesPile, handSize, askable, opponents, setOf, cardsOf, shuffle, PER_SET, MAX_PLAYERS, mulberry32 } from './rules.js';
import { emptyMemory, observe, drew, laidDown, choose } from './ai.js';
import { SETS, SET_IDS, setById, pictureOf, pictureSvg, robotSvg, CPU_COLORS, CARD_BACK } from './art.js';
import { tokenSvg, TROPHY } from '../vier/art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';
import { foldLocked } from '../../js/fold.js';

const $ = (sel) => document.querySelector(sel);
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const KID_TOKENS = Object.freeze(['pup', 'bubble', 'apple', 'flower']); // a child's face per seat

export const SET_COUNTS = Object.freeze([4, 6, 8]);
export const AGES = Object.freeze({ 4: 4, 6: 6, 8: 7 });
export const DEFAULT_SETUP = Object.freeze({ sets: 4, players: Object.freeze(['kid', 'cpu', 'cpu']) });
// How long things take, in ms: slow enough for a young child to follow every question
export const TIMES = Object.freeze({ think: 1000, question: 1400, answer: 1300, quartet: 1500, card: 900, draw: 800, fly: 650 });

export const winKey = (sets) => `won-${sets}`;

/** The sets of a game: the free four on the website; with the full version any of the eight. */
export function pickSets(n, owned, rand = Math.random) {
  if (!owned) return SETS.filter((s) => s.free).map((s) => s.id).slice(0, n);
  const picked = new Set(shuffle(SET_IDS, rand).slice(0, n));
  return SET_IDS.filter((id) => picked.has(id)); // in the menu's order
}

export function createKwartet(shell) {
  const { t, tap } = shell;
  const wins = () => store.loadProgress(meta.id).stars;
  const savedSetup = () => {
    const s = store.loadGameOption(meta.id, 'setup', null) || {};
    const sets = SET_COUNTS.includes(s.sets) ? s.sets : DEFAULT_SETUP.sets;
    let players = Array.isArray(s.players) ? s.players.filter((k) => k === 'kid' || k === 'cpu').slice(0, MAX_PLAYERS) : [];
    if (players[0] !== 'kid') players = DEFAULT_SETUP.players.slice();
    if (players.length < 2) players = DEFAULT_SETUP.players.slice();
    return { sets, players };
  };

  let choice = null; // the menu's choice: { sets, players: ['kid', 'cpu', ...] }
  let game = null; // rules.js state plus { setup, kinds, names, faces }
  let memories = []; // per computer player, what it remembers of the table
  let rand = Math.random; // the smoke test seeds it
  let fast = false;
  let timer = null; // the next thing that happens by itself (one at a time)
  let cardTimer = null; // the end card
  let phase = 'idle'; // 'ask' (a child chooses), 'question', 'answer', 'draw' (from the pile), 'drew', 'cpu', 'pass', 'over'
  let pending = null; // the question on screen, not answered yet: { asker, target, card }
  let viewer = -1; // the child whose cards are shown (-1: hidden)
  let target = -1; // the player the child will ask
  let bubbles = {}; // player -> { text, card } speech bubbles
  let status = '';
  let fresh = null; // a card that just arrived in the viewer's hand (it pops)
  let leaving = null; // a card the viewer just gave away (it fades)
  let hopSet = null; // a set just laid down by the viewer

  const locked = (setup) => meta.isLocked(setup, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const wait = (ms) => (fast ? Math.min(ms, 25) : ms);
  const kids = () => game.kinds.filter((k) => k === 'kid').length;
  const isKid = (p) => game.kinds[p] === 'kid';
  const cardName = (c) => t(`kwartet.card.${pictureOf(c)}`);
  const cardThe = (c) => t(`kwartet.the.${pictureOf(c)}`);
  const setName = (s) => t(`kwartet.set.${s}`);
  /** The name a player is called by, for the child looking at the screen. */
  const nameOf = (p) => (viewerFor(p) ? t('kwartet.you') : game.names[p]);
  const viewerFor = (p) => kids() === 1 && isKid(p);
  /** A sentence about player p: the "you" form for the one child at the table ('kwartet.getsYou'). */
  const about = (key, p, vars = {}) => (viewerFor(p) ? t(`${key}You`, vars) : t(key, { ...vars, name: game.names[p] }));
  const turnText = (p) => (viewerFor(p) ? t('kwartet.yourTurn') : t('kwartet.turn', { name: game.names[p] }));

  function cancelTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }
  function cancelCard() {
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = null;
  }
  function later(ms, fn) {
    cancelTimer();
    const g = game;
    timer = setTimeout(() => {
      timer = null;
      if (game === g && onScreen('kwartet')) fn();
    }, wait(ms));
  }

  shell.unlock.onChange(() => {
    if (onScreen('kwartet-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'kwartet-menu') renderMenu();
  });
  shell.onLangChange(() => {
    if (onScreen('kwartet-menu')) renderMenu();
    if (game) {
      game.names = namesFor(game.kinds);
      render();
    }
  });

  /** "Jij", "Speler 2", "Robo" …: children by seat number, the computers by name. */
  function namesFor(kinds) {
    let cpu = 0;
    return kinds.map((k, p) => (k === 'cpu' ? t(`kwartet.cpu${++cpu}`) : kinds.filter((x) => x === 'kid').length === 1 ? t('kwartet.you') : t('kwartet.player', { n: p + 1 })));
  }
  function facesFor(kinds) {
    let cpu = 0;
    return kinds.map((k, p) => (k === 'cpu' ? robotSvg(CPU_COLORS[cpu++ % CPU_COLORS.length]) : tokenSvg(KID_TOKENS[p])));
  }

  // ---------- menu ----------

  function renderMenu() {
    if (!choice) choice = savedSetup();
    if (locked(choice)) {
      // refunded, or the website: back to what is free
      if (choice.sets > meta.freeSets) choice.sets = meta.freeSets;
      if (choice.players.length > meta.freePlayers) choice.players = choice.players.slice(0, meta.freePlayers);
    }
    const owned = shell.unlock.owned;
    const box = $('#kwartet-menu');
    box.textContent = '';
    const lockIcon = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
    const head = (key) => {
      const h = document.createElement('h3');
      h.className = 'vier-head';
      h.textContent = t(key);
      box.appendChild(h);
    };
    const counts = wins();

    head('kwartet.setsHead');
    const row = document.createElement('div');
    row.className = 'vier-row kwartet-setcounts';
    for (const n of SET_COUNTS) {
      const isLocked = !owned && n > meta.freeSets;
      const won = counts[winKey(n)] || 0;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `vier-opt dam-opt kwartet-opt sets-${n} ${isLocked ? 'locked' : ''}`;
      b.setAttribute('aria-pressed', String(choice.sets === n && !isLocked));
      b.innerHTML = `<span class="vier-opt-art"><span class="kwartet-stack" style="--n:${Math.min(n, 6)}">${SETS.slice(0, Math.min(n, 4)).map((s) => `<i style="--c:${s.color}"></i>`).join('')}</span></span><span class="vier-opt-text"><span class="vier-opt-title"></span><span class="vier-opt-sub"></span></span>${isLocked ? lockIcon : ''}`;
      b.querySelector('.vier-opt-title').textContent = t('kwartet.sets', { n });
      b.querySelector('.vier-opt-sub').textContent = isLocked ? t('kwartet.fullVersion') : won ? t('kwartet.wins', { n: won }) : t('kwartet.setsSub', { n: n * PER_SET, age: AGES[n] });
      b.addEventListener('click', () => {
        tap();
        if (isLocked) {
          shell.offerUnlock(t('kwartet.lockedSets'));
          return;
        }
        choice.sets = n;
        renderMenu();
      });
      row.appendChild(b);
    }
    box.appendChild(row);

    // the players: seat 1 is always a child; seats 2-4 a child, the computer or empty
    head('kwartet.playersHead');
    const seats = document.createElement('div');
    seats.className = 'kwartet-seatpick';
    const kinds = choice.players;
    const names = namesFor(kinds);
    const faces = facesFor(kinds);
    // the rule that changes with the number of players: two play with a pile
    const rule = document.createElement('p');
    rule.className = 'kwartet-rule';
    rule.textContent = usesPile(kinds.length) ? t('kwartet.rulePile', { n: handSize(choice.sets) }) : t('kwartet.ruleAll');
    for (let p = 0; p < MAX_PLAYERS; p++) {
      const kind = kinds[p] || 'off';
      const isLocked = !owned && p >= meta.freePlayers;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `kwartet-slot slot-${p} kind-${kind} ${isLocked ? 'locked' : ''}`;
      b.dataset.slot = String(p);
      b.disabled = p === 0;
      const face = kind === 'off' ? '<span class="kwartet-empty" aria-hidden="true">+</span>' : faces[p];
      b.innerHTML = `<span class="slot-face">${face}</span><span class="slot-text"><span class="slot-name"></span><span class="slot-kind"></span></span>${isLocked ? lockIcon : p ? '<span class="swap" aria-hidden="true">⟳</span>' : ''}`;
      b.querySelector('.slot-name').textContent = kind === 'off' ? t('kwartet.player', { n: p + 1 }) : names[p];
      b.querySelector('.slot-kind').textContent = isLocked ? t('kwartet.fullVersion') : t(`kwartet.kind.${kind}`);
      b.setAttribute('aria-label', t('kwartet.swap', { who: t('kwartet.player', { n: p + 1 }), kind: t(`kwartet.kind.${kind}`) }));
      if (p > 0)
        b.addEventListener('click', () => {
          tap();
          if (isLocked) {
            shell.offerUnlock(t('kwartet.lockedPlayers'));
            return;
          }
          choice.players = cycleSeat(choice.players, p);
          renderMenu();
        });
      seats.appendChild(b);
    }
    box.appendChild(rule);
    box.appendChild(seats);

    const actions = document.createElement('div');
    actions.className = 'vier-actions';
    if (game && !game.over) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'kwartet-continue';
      cont.className = 'btn big secondary';
      cont.textContent = t('kwartet.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      actions.appendChild(cont);
    }
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.id = 'kwartet-play';
    playBtn.className = 'btn big primary';
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg><span></span>';
    playBtn.querySelector('span').textContent = t('kwartet.play');
    playBtn.addEventListener('click', () => {
      tap();
      start();
    });
    actions.appendChild(playBtn);
    box.appendChild(actions);
    foldLocked(box);
  }

  /**
   * A seat in the menu: computer -> child -> empty -> computer. Seats stay packed (an empty seat
   * moves to the end) and there are always at least two players.
   */
  function cycleSeat(players, p) {
    const list = players.slice();
    const kind = list[p] || 'off';
    const next = { cpu: 'kid', kid: 'off', off: 'cpu' }[kind];
    if (next === 'off') {
      if (list.length <= 2) return list.map((k, i) => (i === p ? 'cpu' : k)); // never fewer than two
      list.splice(p, 1);
      return list;
    }
    if (p >= list.length) list.push(next);
    else list[p] = next;
    return list;
  }

  // ---------- a game ----------

  function start() {
    if (!choice) choice = savedSetup();
    const setup = { sets: choice.sets, players: choice.players.slice() };
    if (locked(setup)) {
      shell.offerUnlock(t(setup.sets > meta.freeSets ? 'kwartet.lockedSets' : 'kwartet.lockedPlayers'));
      return;
    }
    store.saveGameOption(meta.id, 'setup', setup);
    cancelTimer();
    cancelCard();
    shell.hideOverlay();
    const sets = pickSets(setup.sets, shell.unlock.owned, rand);
    const kinds = setup.players;
    game = { ...newGame({ sets, players: kinds.length, starter: 0, rand }), setup, kinds, names: namesFor(kinds), faces: facesFor(kinds) };
    memories = kinds.map(() => emptyMemory());
    pending = null;
    bubbles = {};
    fresh = leaving = hopSet = null;
    viewer = kids() === 1 ? kinds.indexOf('kid') : -1;
    target = -1;
    shell.show('kwartet');
    nextStep(true);
  }

  /** Back from the menu ("keep playing"): a question that was on screen gets its answer at once. */
  function resume() {
    if (!game) return;
    shell.show('kwartet');
    if (game.over) return;
    if (pending) {
      const p = pending;
      pending = null;
      answer(p, true);
      return;
    }
    nextStep(true);
  }

  const keep = (next) => Object.assign(next, { setup: game.setup, kinds: game.kinds, names: game.names, faces: game.faces });

  /** Whose turn is it, and what happens now. */
  function nextStep(first = false) {
    if (game.over) {
      finish();
      return;
    }
    const p = game.turn;
    bubbles = {};
    if (!isKid(p)) {
      if (kids() > 1) viewer = -1; // children together: nobody's cards while a computer plays
      if (game.drawing) {
        // a "no": the computer takes a card from the pile, slowly enough to see
        phase = 'draw';
        status = t('kwartet.draw', { name: game.names[p] });
        render();
        later(TIMES.draw, doDraw);
        return;
      }
      phase = 'cpu';
      status = t('kwartet.thinking', { name: game.names[p] });
      render();
      later(TIMES.think, cpuAsk);
      return;
    }
    if (kids() > 1 && viewer !== p) {
      // children together: the phone goes round, the cards stay hidden until the next child is ready
      phase = 'pass';
      viewer = -1;
      status = t('kwartet.turn', { name: game.names[p] });
      render();
      showPassCard(p);
      return;
    }
    viewer = p;
    if (game.drawing) {
      // a "no": the child takes a card from the pile (the pile glows until it is tapped)
      phase = 'draw';
      status = t('kwartet.drawYou');
      render();
      return;
    }
    phase = 'ask';
    const others = opponents(game, p);
    if (!others.includes(target)) target = others[0];
    status = others.length > 1 ? t('kwartet.pickWho') : t('kwartet.pick');
    if (!first && kids() === 1) status = `${t('kwartet.yourTurn')}. ${status}`;
    render();
  }

  function showPassCard(p) {
    shell.showOverlay({
      art: `<span class="kwartet-ov">${game.faces[p]}</span>`,
      title: t('kwartet.passTitle', { name: game.names[p] }),
      text: t('kwartet.passText', { name: game.names[p] }),
      buttons: [
        [
          t('kwartet.passShow'),
          'big primary',
          () => {
            shell.hideOverlay();
            viewer = p;
            nextStep(true);
          },
        ],
        [t('kwartet.menuBtn'), 'big secondary', () => leave()],
      ],
    });
  }

  /** The child taps a player to ask. */
  function pickTarget(p) {
    if (phase !== 'ask' || !opponents(game, game.turn).includes(p)) return;
    target = p;
    render();
  }

  /** The child taps a missing card: ask the chosen player for it. */
  function tapAsk(card) {
    if (phase !== 'ask' || !game || game.over) return;
    if (!askable(game, game.turn).includes(card)) return;
    if (!opponents(game, game.turn).includes(target)) target = opponents(game, game.turn)[0];
    sfx.unlock();
    question({ asker: game.turn, target, card });
  }

  /** A question goes out: the asker's speech bubble, then (a moment later) the answer. */
  function question(q) {
    pending = q;
    phase = 'question';
    fresh = leaving = hopSet = null;
    const text = viewerFor(q.target) ? t('kwartet.askYou', { card: cardThe(q.card) }) : t('kwartet.ask', { name: game.names[q.target], card: cardThe(q.card) });
    bubbles = { [q.asker]: { text, card: q.card } };
    status = '';
    sfx.tick();
    render();
    later(TIMES.question, () => {
      pending = null;
      answer(q);
    });
  }

  /** The answer: the card moves (or not), the table remembers, and maybe a kwartet is laid down. */
  function answer(q, quick = false) {
    const r = askRule(game, q.target, q.card);
    if (!r) {
      nextStep();
      return;
    }
    game = keep(r.game);
    memories = memories.map((m, p) => (game.kinds[p] === 'cpu' ? observe(m, { ...q, got: r.got }, rand) : m));
    if (r.laid) memories = memories.map((m) => laidDown(m, r.laid));
    phase = 'answer';
    bubbles = { ...bubbles, [q.target]: { text: r.got ? t('kwartet.yes') : t('kwartet.no'), yes: r.got } };
    if (r.got) {
      sfx.plink(5);
      status = about('kwartet.gets', q.asker, { card: cardThe(q.card) });
      if (q.asker === viewer) fresh = q.card;
      if (q.target === viewer) leaving = q.card;
    } else {
      sfx.boop();
      if (r.draw) status = isKid(q.asker) ? t('kwartet.drawYou') : t('kwartet.draw', { name: game.names[q.asker] });
      else status = `${usesPile(game.players) ? `${t('kwartet.pileEmpty')} ` : ''}${turnText(game.turn)}`;
    }
    if (r.laid) {
      status = t('kwartet.quartet', { set: setName(r.laid) });
      if (q.asker === viewer) hopSet = r.laid;
      setTimeout(() => sfx.chime(), wait(250));
    } else if (r.got && !game.over && game.turn === q.asker) {
      status += ` ${t('kwartet.askAgain')}`;
    }
    status += refillText(r.refills);
    // children together: the moment the turn leaves a child (a "no", or no cards left), its cards
    // are hidden, not only once the answer has been on screen for a while
    if (kids() > 1 && game.turn !== viewer) viewer = -1;
    if (r.draw && isKid(q.asker) && q.asker === viewer) {
      // the child taps the pile (it glows); the "no" shows for a moment, then the status is clear
      phase = 'draw';
      render();
      if (!quick)
        later(TIMES.answer, () => {
          bubbles = {};
          render();
        });
      return;
    }
    render();
    flyRefills(r.refills);
    if (quick) {
      nextStep();
      return;
    }
    later(TIMES.answer + (r.laid ? TIMES.quartet : 0), () => nextStep());
  }

  function cpuAsk() {
    if (!game || game.over || isKid(game.turn)) return;
    const me = game.turn;
    const c = choose(game, me, memories[me], rand);
    if (!c) {
      nextStep();
      return;
    }
    question({ asker: me, target: c.target, card: c.card });
  }

  /** "… takes a new card from the pile" for every hand that ran empty. */
  function refillText(refills) {
    return refills.map((f) => ` ${about('kwartet.refill', f.player)}`).join('');
  }
  function flyRefills(refills) {
    for (const f of refills) {
      if (f.player === viewer) fresh = f.card;
    }
    if (refills.some((f) => f.player === viewer)) render();
    for (const f of refills) flyTo(f.player, f.card);
  }

  /** The child taps the pile after a "no". */
  function tapDraw() {
    if (phase !== 'draw' || !game || !isKid(game.turn) || viewer !== game.turn) return;
    sfx.unlock();
    doDraw();
  }

  /** After a "no": the asker takes the top card of the pile. The card flies from the pile. */
  function doDraw() {
    if (!game || !canDraw(game)) return;
    cancelTimer();
    const p = game.turn;
    const asked = game.drawing;
    const r = drawRule(game);
    game = keep(r.game);
    memories = memories.map((m, i) => (game.kinds[i] === 'cpu' ? drew(m, { player: p, card: asked, lucky: r.lucky }, rand) : m));
    if (r.laid) memories = memories.map((m) => laidDown(m, r.laid));
    phase = 'drew';
    fresh = leaving = hopSet = null;
    bubbles = {};
    if (p === viewer) fresh = r.card;
    if (r.lucky) {
      // the very card asked for: shown to everyone, and the asker asks again
      sfx.plink(6);
      bubbles[p] = { text: t('kwartet.lucky'), card: r.card, yes: true };
      status = about('kwartet.luckyDraw', p, { card: cardThe(r.card) });
    } else {
      sfx.tick();
      // the card is named only when one child plays (children together: the others may read along)
      status = p === viewer && kids() === 1 ? t('kwartet.drewYou', { card: cardThe(r.card) }) : t('kwartet.drew', { name: nameOf(p) });
    }
    if (r.laid) {
      status = t('kwartet.quartet', { set: setName(r.laid) });
      if (p === viewer) hopSet = r.laid;
      setTimeout(() => sfx.chime(), wait(250));
    }
    if (!game.over) status += game.turn === p ? ` ${t('kwartet.askAgain')}` : ` ${turnText(game.turn)}`;
    status += refillText(r.refills);
    render();
    flyTo(p, r.card);
    flyRefills(r.refills);
    // children together: the drawing child sees the new card for a moment, then the pass card
    later(TIMES.answer + (r.laid ? TIMES.quartet : 0), () => nextStep());
  }

  /** A card back flies gently from the pile to player p (to the new card when it is the viewer's). */
  function flyTo(p, card) {
    const pile = $('#kwartet-pile .kp-stack');
    const to = p === viewer ? $(`#kwartet-hand .kcard[data-card="${card}"]`) : $(`.kseat[data-player="${p}"] .ks-count`);
    if (!pile || !to || fast || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = pile.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'kfly';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = CARD_BACK;
    Object.assign(el.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    document.body.appendChild(el);
    if (!el.animate) {
      el.remove();
      return;
    }
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = Math.max(0.35, Math.min(1.4, b.height / a.height));
    const anim = el.animate(
      [
        { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(${(1 + s) / 2}) rotate(-8deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)`, opacity: 0.15 },
      ],
      { duration: TIMES.fly, easing: 'ease-in-out' },
    );
    anim.onfinish = anim.oncancel = () => el.remove();
    setTimeout(() => el.remove(), TIMES.fly + 300);
  }

  function finish() {
    cancelTimer();
    phase = 'over';
    pending = null;
    const { setup } = game;
    const winners = game.over.winners;
    const child = game.kinds.indexOf('kid');
    if (kids() === 1 && winners.length === 1 && winners[0] === child) {
      const key = winKey(setup.sets);
      store.recordStars(meta.id, key, (wins()[key] || 0) + 1);
    }
    bubbles = {};
    status = '';
    render();
    const cpuWon = kids() === 1 && !winners.includes(child);
    setTimeout(() => (cpuWon ? sfx.lose() : sfx.win()), wait(300));
    const done = game;
    cancelCard();
    cardTimer = setTimeout(() => {
      cardTimer = null;
      if (game === done && onScreen('kwartet')) showEndCard();
    }, wait(TIMES.card));
  }

  function showEndCard() {
    const winners = game.over.winners;
    const child = game.kinds.indexOf('kid');
    let title;
    if (winners.length > 1) title = t('kwartet.shared');
    else if (kids() === 1 && winners[0] === child) title = t('kwartet.youWin');
    else title = t('kwartet.nameWins', { name: game.names[winners[0]] });
    const order = game.kinds.map((_, p) => p).sort((a, b) => game.quartets[b].length - game.quartets[a].length);
    let text = order.map((p) => t('kwartet.score', { name: nameOf(p), n: game.quartets[p].length })).join(' · ');
    if (kids() === 1 && !winners.includes(child)) text += `. ${t('kwartet.tryAgain')}`;
    const art = `<span class="vier-ov ${winners.length === 1 ? 'won' : ''}">${winners.map((p) => game.faces[p]).join('')}</span>`;
    const buttons = [[t('kwartet.again'), 'big primary', start]];
    // the menu first, then the offer: whatever closes it, the child lands on the menu (as Bubbels since #36)
    if (!shell.unlock.owned) buttons.push([t('kwartet.more'), 'big secondary', () => (shell.show('kwartet-menu'), shell.offerUnlock(t('kwartet.lockedSets')))]);
    buttons.push([t('kwartet.menuBtn'), 'big secondary', () => shell.show('kwartet-menu')]);
    shell.showOverlay({ art, title, text, buttons });
  }

  // ---------- drawing ----------

  function render() {
    if (!game) return;
    renderSeats();
    renderHand();
    $('#kwartet-status').textContent = status;
    $('#kwartet-title').textContent = t('kwartet.sets', { n: game.sets.length });
    $('#kwartet-sub').textContent = t('kwartet.menu');
  }

  function cardFace(card, { cls = '', tag = 'span' } = {}) {
    const set = setById(setOf(card));
    const el = document.createElement(tag);
    el.className = `kcard ${cls}`;
    el.style.setProperty('--c', set.color);
    el.dataset.card = card;
    el.innerHTML = `<span class="kc-band"></span><span class="kc-pic">${pictureSvg(pictureOf(card))}</span><span class="kc-name"></span>`;
    el.querySelector('.kc-name').textContent = cardName(card);
    return el;
  }

  function bubbleEl(b) {
    const el = document.createElement('span');
    el.className = `kbubble ${b.yes === true ? 'yes' : b.yes === false ? 'no' : ''}`;
    if (b.card) el.innerHTML = `<span class="kb-pic">${pictureSvg(pictureOf(b.card))}</span>`;
    const txt = document.createElement('span');
    txt.className = 'kb-text';
    txt.textContent = b.text;
    el.appendChild(txt);
    return el;
  }

  function renderSeats() {
    const box = $('#kwartet-seats');
    box.textContent = '';
    box.setAttribute('aria-label', t('kwartet.seatsLabel'));
    const choosing = phase === 'ask' && opponents(game, game.turn).length > 1;
    for (let p = 0; p < game.players; p++) {
      if (p === viewer) continue; // the viewer's own cards are below
      const seat = document.createElement('button');
      seat.type = 'button';
      seat.className = 'kseat';
      seat.dataset.player = String(p);
      const n = game.hands[p].length;
      const q = game.quartets[p].length;
      seat.classList.toggle('turn', !game.over && game.turn === p);
      seat.classList.toggle('thinking', (phase === 'cpu' || phase === 'draw') && game.turn === p && !isKid(p));
      seat.classList.toggle('target', phase === 'ask' && target === p);
      seat.classList.toggle('pickable', choosing && opponents(game, game.turn).includes(p));
      seat.classList.toggle('out', !n && !game.over);
      seat.disabled = !(phase === 'ask' && opponents(game, game.turn).includes(p));
      seat.innerHTML = `<span class="ks-face">${game.faces[p]}</span><span class="ks-name"></span><span class="ks-count">${CARD_BACK}<b>${n}</b></span><span class="ks-quartets">${game.quartets[p].map((s) => `<i style="--c:${setById(s).color}"></i>`).join('')}</span>`;
      seat.querySelector('.ks-name').textContent = game.names[p];
      seat.setAttribute('aria-label', t('kwartet.seat', { name: game.names[p], cards: t('kwartet.cards', { n }), quartets: t('kwartet.quartets', { n: q }) }));
      if (bubbles[p]) seat.appendChild(bubbleEl(bubbles[p]));
      seat.addEventListener('click', () => {
        tap();
        pickTarget(p);
      });
      box.appendChild(seat);
    }
    if (usesPile(game.players)) box.appendChild(pileEl());
  }

  /** The pile: a stack of card backs with how many are left; a big button when the child must draw. */
  function pileEl() {
    const n = game.pile.length;
    const canTap = phase === 'draw' && isKid(game.turn) && viewer === game.turn;
    const el = document.createElement('button');
    el.type = 'button';
    el.id = 'kwartet-pile';
    el.className = `kpile ${n ? '' : 'empty'} ${canTap ? 'active' : ''}`;
    el.disabled = !canTap;
    const backs = Math.min(n, 3);
    el.innerHTML = `<span class="kp-stack" data-n="${backs}">${backs ? Array.from({ length: backs }, () => CARD_BACK).join('') : '<i class="kp-none"></i>'}</span><span class="kp-count"><b>${n}</b></span><span class="kp-name"></span>`;
    el.querySelector('.kp-name').textContent = t('kwartet.pile');
    el.setAttribute('aria-label', t('kwartet.pileLabel', { cards: n === 1 ? t('kwartet.card1') : t('kwartet.cards', { n }) }));
    el.addEventListener('click', () => {
      tap();
      tapDraw();
    });
    return el;
  }

  function renderHand() {
    const box = $('#kwartet-hand');
    box.textContent = '';
    const mine = $('#kwartet-mine');
    mine.textContent = '';
    const own = $('#kwartet-own');
    own.textContent = '';
    if (viewer < 0) {
      const p = document.createElement('p');
      p.className = 'kwartet-hidden';
      p.textContent = game.over ? '' : t('kwartet.hidden');
      box.appendChild(p);
      return;
    }
    // the viewer's own speech bubble and name
    own.innerHTML = `<span class="ks-face">${game.faces[viewer]}</span><span class="ks-name"></span>`;
    own.querySelector('.ks-name').textContent = game.names[viewer];
    own.classList.toggle('turn', !game.over && game.turn === viewer);
    if (bubbles[viewer]) own.appendChild(bubbleEl(bubbles[viewer]));
    const canAsk = phase === 'ask' && game.turn === viewer;
    const hand = new Set(game.hands[viewer]);
    if (leaving) hand.add(leaving);
    box.setAttribute('aria-label', t('kwartet.handLabel'));
    for (const set of game.sets) {
      const cards = cardsOf(set);
      if (!cards.some((c) => hand.has(c))) continue;
      const group = document.createElement('div');
      group.className = 'kset';
      group.style.setProperty('--c', setById(set).color);
      group.dataset.set = set;
      const label = document.createElement('span');
      label.className = 'kset-name';
      label.textContent = setName(set);
      const row = document.createElement('div');
      row.className = 'krow';
      group.append(label, row);
      for (const c of cards) {
        if (hand.has(c)) {
          const el = cardFace(c, { cls: `${c === fresh ? 'fresh' : ''} ${c === leaving ? 'leaving' : ''}` });
          el.setAttribute('role', 'img');
          el.setAttribute('aria-label', t('kwartet.have', { card: cardThe(c) }));
          row.appendChild(el);
        } else {
          const b = cardFace(c, { cls: 'missing', tag: 'button' });
          b.type = 'button';
          b.disabled = !canAsk;
          b.setAttribute('aria-label', t('kwartet.askFor', { card: cardThe(c) }));
          b.addEventListener('click', () => {
            tap();
            tapAsk(c);
          });
          row.appendChild(b);
        }
      }
      box.appendChild(group);
    }
    // the viewer's kwartetten
    for (const s of game.quartets[viewer]) {
      const badge = document.createElement('span');
      badge.className = `kbadge ${s === hopSet ? 'hop' : ''}`;
      badge.style.setProperty('--c', setById(s).color);
      badge.innerHTML = `<span class="kb-pic">${pictureSvg(setById(s).cards[0])}</span><span class="kb-set"></span>`;
      badge.querySelector('.kb-set').textContent = setName(s);
      mine.appendChild(badge);
    }
    mine.setAttribute('aria-label', t('kwartet.mine'));
  }

  $('#kwartet-back').addEventListener('click', () => {
    tap();
    leave();
  });

  /** The table -> the menu (the game is kept for this session: "keep playing"). */
  function leave() {
    shell.hideOverlay();
    cancelTimer();
    cancelCard();
    if (game && kids() > 1 && !game.over) viewer = -1; // a child's cards never stay on screen for the next one
    shell.show('kwartet-menu');
  }

  return {
    open() {
      shell.show('kwartet-menu');
    },
    leave,
    async init() {
      return true;
    },
    testHook() {
      return {
        choose: (setup) => {
          choice = { ...(choice || savedSetup()), ...setup };
          if (onScreen('kwartet-menu')) renderMenu();
        },
        start: () => start(),
        seed: (n) => (rand = n == null ? Math.random : mulberry32(n)),
        fast: (on) => (fast = !!on),
        state: () =>
          game
            ? {
                hands: game.hands.map((h) => h.slice()),
                quartets: game.quartets.map((q) => q.slice()),
                sets: game.sets.slice(),
                turn: game.turn,
                kinds: game.kinds.slice(),
                over: game.over,
                phase,
                viewer,
                target,
                askable: viewer >= 0 ? askable(game, viewer) : [],
                pile: game.pile.slice(),
                drawing: game.drawing,
                busy: !!timer,
              }
            : null,
        wins: () => wins(),
      };
    },
  };
}
