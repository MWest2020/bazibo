// Kleurenkermis (Colour Fair): a colour game about the Stroop effect, our own and calm. At a little
// fair stall a chameleon (hostSvg) shows a thing in a colour (3-5: "klopt deze kleur?"), a colour
// word in its own or another ink (6-7: Ja or Nee) or a colour word whose letters are coloured (8-10:
// "tik de kleur van de letters, niet het woord", four colour buttons). It says every line in a
// speech bubble (hostLine).
//
// Rustig (calm, the default): no time; a tap that does not fit is greyed with a short line, after
// MAX_TRIES the answer glows; stars by mistakes only. Alone, the answer buttons are big at the bottom;
// together (2 to 4 children on one tablet) each child has a corner of their own (Zon, Maan, Wolk,
// Bloem; the top corners face the other way and the sign shows the question twice) and they take
// turns, the corner whose turn it is lit up.
// Race (the full version; Mark, 26 Nov 2026: "we kunnen de race een speloptie maken", the only
// Bazibo game with a race): every child at once in their own corner, real multi-touch; the first
// right tap wins the question's point, a wrong tap gives only that child a short pause (never minus
// points, no harsh sound, no red flash); alone, the child races the little turtle. A cheerful end
// with everyone placed.
// The rounds, the taps and the race are pure (rules.js), the colours and things in colours.js, the
// drawings in art.js; the shell (web/js/main.js) owns the overlay card, the sound and the purchase.
//
// Saved (games.kermis): stars per round (Rustig, only ever raised), random rounds done per tier
// (Rustig), which how-to cards were seen (per tier and `race`), the last tier, mode (`lastMode`)
// and number of players (`lastPlayers`). An unfinished game is kept while the app stays open
// ("keep playing").
import { meta } from './meta.js';
import { TIERS, TIER_IDS, MODES, PLAYER_COUNTS, PLAYER_IDS, SLOTS, ROUNDS_PER_TIER, ROUND_LEN, MAX_TRIES, PAUSE_MS, NEXT_MS, makeRound, starsFor, hashSeed, startState, tapAnswer, raceStart, raceNext, raceTap, places, turtlePlan, hostLine, lineText } from './rules.js';
import { INKS } from './colours.js';
import { thingSvg, hostSvg, turtleSvg, playerSvg, swatchSvg, YES_SVG, NO_SVG, flagSvg, playersSvg, stallSvg } from './art.js';
import * as store from '../../js/storage.js';
import { newSeed, randomCard } from '../../js/random.js';
import * as sfx from '../../js/audio.js';
import { foldLocked } from '../../js/fold.js';
import { menuHead, menuLine, levelCell, optionCard, optionBox, segCard } from '../../js/menu.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const TURTLE = 'turtle';

export function createKermis(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  const randomDone = () => store.loadRandomSolved(meta.id);
  const lastTier = () => {
    const v = store.loadGameOption(meta.id, 'lastTier', 't1');
    return TIER_IDS.includes(v) ? v : 't1';
  };
  const savedMode = () => {
    const v = store.loadGameOption(meta.id, 'lastMode', 'calm');
    return MODES.includes(v) ? v : 'calm';
  };
  const savedPlayers = () => {
    const v = store.loadGameOption(meta.id, 'lastPlayers', 1);
    return PLAYER_COUNTS.includes(v) ? v : 1;
  };
  const owned = () => shell.unlock.owned;
  /** The mode to play: race only in the full version (a refund or the website falls back to calm). */
  const mode = () => (savedMode() === 'race' && owned() ? 'race' : 'calm');

  // { tier, roundId (null when random), seed, qs, i, mode, players: [{ id, slot, cpu }], st, mistakes,
  //   results, tries, help, line, mood, waiting, done, race (rules.raceStart), shownAt }
  let game = null;
  let plays = 0; // counts games and questions started, so a late timer never acts on a newer one
  let timers = [];

  $('#kk-host').innerHTML = hostSvg();
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const locked = (tier, m = 'calm') => meta.isLocked({ tier, mode: m }, owned());
  const q = () => game.qs[game.i];
  const kids = () => game.players.filter((p) => !p.cpu).length;

  shell.unlock.onChange(() => {
    if (onScreen('kermis-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'kermis-menu') renderMenu();
    if (name !== 'kermis') clearTimers();
  });
  shell.onLangChange(() => {
    if (onScreen('kermis-menu')) renderMenu();
    if (game && !game.done && onScreen('kermis')) render();
  });

  function clearTimers() {
    for (const id of timers) clearTimeout(id);
    timers = [];
  }

  /** `fn` after `ms`, dropped when another question started or the screen changed. */
  function after(ms, fn) {
    const token = plays;
    const id = setTimeout(() => {
      timers = timers.filter((x) => x !== id);
      if (token === plays && game && onScreen('kermis') && !overlayUp()) fn();
    }, ms);
    timers.push(id);
  }

  // ---------- menu ----------

  function renderMenu() {
    const box = $('#kermis-menu');
    box.textContent = '';
    if (game && !game.done) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'kermis-continue';
      cont.className = 'btn big secondary menu-continue';
      cont.textContent = t('kermis.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      box.appendChild(cont);
    }
    const head = document.createElement('div');
    head.className = 'kk-menu-art';
    head.innerHTML = stallSvg();
    box.appendChild(head);

    // how we play: calm (the default) or the race (full version)
    const m = mode();
    box.appendChild(menuHead(t('kermis.modeHead')));
    const modes = document.createElement('div');
    modes.className = 'option-row kk-modes';
    const calm = optionCard({ art: hostSvg(), title: t('kermis.mode.calm'), sub: t('kermis.mode.calmSub'), pressed: m === 'calm', cls: 'kk-mode-calm' });
    calm.addEventListener('click', () => {
      tap();
      store.saveGameOption(meta.id, 'lastMode', 'calm');
      renderMenu();
    });
    const raceLocked = locked('t1', 'race');
    const race = optionCard({ art: flagSvg(), title: t('kermis.mode.race'), sub: raceLocked ? t('kermis.fullVersion') : t('kermis.mode.raceSub'), pressed: raceLocked ? undefined : m === 'race', locked: raceLocked, cls: 'kk-mode-race' });
    race.addEventListener('click', () => {
      tap();
      if (raceLocked) {
        shell.offerUnlock(t('kermis.raceLead'));
        return;
      }
      store.saveGameOption(meta.id, 'lastMode', 'race');
      renderMenu();
    });
    modes.append(calm, race);
    box.appendChild(modes);

    // who plays: alone or 2 to 4 together on one tablet
    const n = savedPlayers();
    box.appendChild(menuHead(t('kermis.whoHead')));
    const whoTitle = n === 1 ? (m === 'race' ? 'kermis.who.turtle' : 'kermis.who.alone') : m === 'race' ? 'kermis.who.race' : 'kermis.who.calm';
    const who = optionBox({ art: n === 1 && m === 'race' ? turtleSvg() : playersSvg(n), title: t(whoTitle), on: true, cls: 'kk-who-box' });
    const segs = who.querySelector('.seg-cards');
    for (const k of PLAYER_COUNTS) {
      const s = segCard({ name: t(`kermis.players.${k}`), pressed: k === n, cls: `kk-players-${k}` });
      s.dataset.players = String(k);
      s.addEventListener('click', () => {
        tap();
        store.saveGameOption(meta.id, 'lastPlayers', k);
        renderMenu();
      });
      segs.appendChild(s);
    }
    box.appendChild(who);

    // the rounds per tier, and endless random rounds (full version)
    const rtier = lastTier();
    const rgrid = document.createElement('div');
    rgrid.className = 'level-grid klok-grid';
    rgrid.appendChild(
      randomCard({
        t,
        tap,
        title: `${t('random.play')} · ${t(`kermis.short.${rtier}`)}`,
        locked: !owned(),
        solved: randomDone()[rtier] || 0,
        done: true,
        onPlay: () => playRandom(rtier),
        onLocked: () => shell.offerUnlock(t('kermis.randomLead')),
      }),
    );
    box.appendChild(rgrid);
    const got = stars();
    for (const tier of TIER_IDS) {
      box.appendChild(menuLine(t('kermis.tierLine', { age: TIERS[tier].age, what: t(`kermis.tier.${tier}`) })));
      const grid = document.createElement('div');
      grid.className = 'level-grid klok-grid';
      grid.dataset.tier = tier;
      for (let r = 1; r <= ROUNDS_PER_TIER; r++) {
        const id = `${tier}-${r}`;
        const isLocked = locked(tier);
        const k = isLocked ? 0 : got[id] || 0;
        const b = levelCell({ num: r, stars: k, locked: isLocked });
        b.dataset.round = id;
        b.setAttribute('aria-label', isLocked ? t('kermis.roundLocked', { n: r }) : k ? t('kermis.roundStars', { n: r, stars: k }) : t('kermis.roundOpen', { n: r }));
        b.addEventListener('click', () => {
          tap();
          if (isLocked) offer();
          else startRound(id);
        });
        grid.appendChild(b);
      }
      box.appendChild(grid);
    }
    foldLocked(box);
  }

  $('#kermis-menu-back').addEventListener('click', () => {
    tap();
    shell.show('home');
  });

  function offer() {
    shell.offerUnlock(t('kermis.lockedLead'));
  }

  // ---------- starting ----------

  function startRound(id) {
    const [tier, r] = String(id).split('-');
    if (!TIER_IDS.includes(tier) || !(Number(r) >= 1 && Number(r) <= ROUNDS_PER_TIER)) return;
    if (locked(tier, mode())) {
      offer();
      return;
    }
    begin({ tier, roundId: id, seed: hashSeed(`kermis:${id}`) });
  }

  function playRandom(tier, seed = null) {
    if (!owned()) {
      shell.offerUnlock(t('kermis.randomLead'));
      return;
    }
    if (!TIER_IDS.includes(tier)) return;
    begin({ tier, roundId: null, seed: seed ?? newSeed() });
  }

  function begin({ tier, roundId, seed }) {
    plays++;
    clearTimers();
    if (lastTier() !== tier) store.saveGameOption(meta.id, 'lastTier', tier);
    const m = mode();
    const n = savedPlayers();
    const players = PLAYER_IDS.slice(0, n).map((id, k) => ({ id, slot: n === 1 ? 'solo' : SLOTS[k], cpu: false }));
    if (m === 'race' && n === 1) players.push({ id: TURTLE, slot: 'cpu', cpu: true });
    const qs = makeRound({ tier, seed });
    game = { tier, roundId, seed, qs, i: 0, mode: m, players, st: startState(), mistakes: 0, results: [], tries: 0, help: false, line: null, mood: '', waiting: false, done: false, race: m === 'race' ? raceStart(players.length) : null, shownAt: 0, started: m !== 'race' };
    shell.show('kermis');
    buildPads();
    render();
    const cards = [];
    if (!seenHow()[tier]) cards.push(['kermis.howTitle', `kermis.how.${tier}`, tier]);
    if (m === 'race') cards.push(['kermis.raceTitle', n === 1 ? 'kermis.how.raceTurtle' : 'kermis.how.race', 'race']);
    howCards(cards);
  }

  /** The how-to card of the tier (once) and, before every race, the race card with "Start!". */
  function howCards(cards) {
    if (!cards.length) {
      if (game.mode === 'race' && !game.started) startRace();
      return;
    }
    const [title, text, key] = cards[0];
    const race = key === 'race';
    shell.showOverlay({
      art: `<span class="kk-ov">${race ? flagSvg() : stallSvg()}</span>`,
      title: t(title),
      text: t(text),
      buttons: [
        [
          race ? t('kermis.start') : t('common.ok'),
          'big primary',
          () => {
            store.saveGameOption(meta.id, 'howSeen', { ...seenHow(), [key]: true });
            shell.hideOverlay();
            howCards(cards.slice(1));
          },
        ],
      ],
    });
  }

  function startRace() {
    game.started = true;
    showQuestion();
  }

  function resume() {
    if (!game || game.done) return;
    shell.show('kermis');
    if (game.mode === 'race' && !game.started) {
      render();
      howCards([['kermis.raceTitle', kids() === 1 ? 'kermis.how.raceTurtle' : 'kermis.how.race', 'race']]);
      return;
    }
    if (game.waiting) nextQuestion();
    else showQuestion(false);
  }

  /** Android back and the menu button: to the menu, the game is kept ("keep playing"). */
  function leave() {
    clearTimers();
    plays++;
    shell.hideOverlay();
    shell.show('kermis-menu');
  }
  $('#kermis-back').addEventListener('click', () => {
    tap();
    leave();
  });

  // ---------- the corners (pads) with the answer buttons ----------

  const whoName = (p) => (p.id === TURTLE ? t('kermis.turtle') : p.slot === 'solo' ? t('kermis.you') : t(`kermis.p.${p.id}`));

  function buildPads() {
    const box = $('#kk-pads');
    box.textContent = '';
    const screen = $('#screen-kermis');
    const together = kids() > 1;
    const heads = game.players.length > 1;
    screen.dataset.mode = game.mode;
    screen.dataset.n = String(game.players.length);
    screen.classList.toggle('kk-together', together);
    screen.classList.toggle('kk-vs', !together && heads);
    screen.classList.toggle('kk-faces', game.players.some((p) => !p.cpu && (p.slot === 'tr' || p.slot === 'tl')));
    game.players.forEach((p, k) => {
      const pad = document.createElement('div');
      pad.className = `kk-pad slot-${p.slot}${p.cpu ? ' cpu' : ''}`;
      pad.dataset.p = String(k);
      pad.dataset.who = p.id;
      if (heads) {
        const head = document.createElement('div');
        head.className = 'kk-pad-head';
        head.innerHTML = p.cpu ? `<span class="kk-turtle">${turtleSvg()}</span>` : playerSvg(p.id);
        const name = document.createElement('span');
        name.className = 'kk-pad-name';
        name.textContent = whoName(p);
        head.appendChild(name);
        if (game.mode === 'race') {
          const sc = document.createElement('span');
          sc.className = 'kk-score';
          head.appendChild(sc);
        }
        pad.appendChild(head);
      }
      const ans = document.createElement('div');
      ans.className = 'kk-answers';
      ans.setAttribute('role', 'group');
      pad.appendChild(ans);
      if (game.mode === 'race') {
        const wait = document.createElement('div');
        wait.className = 'kk-wait';
        wait.setAttribute('aria-hidden', 'true');
        wait.innerHTML = '<i></i>';
        pad.appendChild(wait);
      }
      box.appendChild(pad);
    });
  }

  function answerButton(it, a, p) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `kk-ans kk-ans-${a}`;
    b.dataset.a = a;
    const label = document.createElement('span');
    label.className = 'kk-ans-label';
    if (a === 'yes' || a === 'no') {
      b.innerHTML = a === 'yes' ? YES_SVG : NO_SVG;
      label.textContent = t(a === 'yes' ? 'common.yes' : 'common.no');
    } else {
      b.innerHTML = swatchSvg(a);
      label.textContent = t(`kermis.col.${a}`);
    }
    b.appendChild(label);
    // a race is touch at once: answered on pointerdown (every finger its own); the keyboard's click too
    b.addEventListener('pointerdown', (e) => {
      if (game?.mode !== 'race') return;
      e.preventDefault();
      b.dataset.down = String(performance.now());
      sfx.unlock();
      pick(p, a);
    });
    b.addEventListener('click', () => {
      if (game?.mode === 'race' && performance.now() - Number(b.dataset.down || 0) < 1500) return;
      sfx.unlock();
      pick(p, a);
    });
    return b;
  }

  /** The answer buttons of every corner for this question, and which corner may tap. */
  function renderPads() {
    const it = q();
    const now = performance.now();
    const turn = game.mode === 'calm' ? game.i % game.players.length : -1;
    for (const pad of document.querySelectorAll('#kk-pads .kk-pad')) {
      const k = Number(pad.dataset.p);
      const p = game.players[k];
      const ans = pad.querySelector('.kk-answers');
      ans.textContent = '';
      ans.className = `kk-answers ${it.kind === 'stroop' ? 'colours' : 'yesno'}`;
      ans.setAttribute('aria-label', game.players.length > 1 ? whoName(p) : t('kermis.answers'));
      const sc = pad.querySelector('.kk-score');
      if (sc) {
        sc.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg><b></b>`;
        sc.querySelector('b').textContent = String(game.race.scores[k]);
        sc.setAttribute('aria-label', t('kermis.points', { n: game.race.scores[k] }));
      }
      const myTurn = game.mode === 'race' || turn === k;
      pad.classList.toggle('turn', game.mode === 'calm' && game.players.length > 1 && myTurn);
      pad.classList.toggle('off', !myTurn);
      const won = game.race && game.race.winner === k;
      pad.classList.toggle('won', !!won);
      pad.classList.toggle('paused', !!game.race && now < game.race.paused[k]);
      if (p.cpu) {
        // the turtle has no buttons: it shows what it tapped
        const chosen = game.race.tried[k].length || won ? (won ? it.answer : game.race.tried[k][game.race.tried[k].length - 1]) : null;
        if (chosen) {
          const chip = document.createElement('span');
          chip.className = `kk-ans chip ${won ? 'right' : 'tried'}`;
          chip.dataset.a = chosen;
          chip.innerHTML = chosen === 'yes' ? YES_SVG : chosen === 'no' ? NO_SVG : swatchSvg(chosen);
          const label = document.createElement('span');
          label.className = 'kk-ans-label';
          label.textContent = chosen === 'yes' || chosen === 'no' ? t(`common.${chosen}`) : t(`kermis.col.${chosen}`);
          chip.appendChild(label);
          ans.appendChild(chip);
        }
        continue;
      }
      const tried = game.mode === 'race' ? game.race.tried[k] : myTurn ? game.st.tried : [];
      const left = it.options.filter((o) => !tried.includes(o));
      for (const a of it.options) {
        const b = answerButton(it, a, k);
        const isTried = tried.includes(a);
        if (isTried) b.classList.add('tried');
        const solved = game.waiting && a === it.answer && (game.mode === 'calm' ? myTurn : won);
        if (solved) b.classList.add('right');
        if (game.mode === 'calm' && myTurn && !game.waiting && (game.help || left.length === 1) && a === it.answer) b.classList.add('help');
        b.disabled = !myTurn || isTried || game.waiting || game.done || (game.race && game.race.winner !== null) || !game.started;
        ans.appendChild(b);
      }
    }
  }

  // ---------- one question, drawn from its state (also after a language switch) ----------

  function render() {
    if (!game) return;
    const it = q();
    const screen = $('#screen-kermis');
    screen.dataset.tier = game.tier;
    screen.dataset.kind = it.kind;
    $('#kk-sub').textContent = t('kermis.menu');
    $('#kk-title').textContent = game.mode === 'race' ? t('kermis.mode.race') : game.roundId ? t('kermis.round', { n: game.roundId.split('-')[1] }) : t('random.title');
    renderSign();
    renderPads();
    renderDots();
    renderSay();
  }

  /** The question on the stall's sign; together, a second copy upside down for the far side. */
  function renderSign() {
    const it = q();
    for (const box of [$('#kk-show'), $('#kk-flip')]) {
      box.textContent = '';
      box.className = `kk-show ${it.kind}${box.id === 'kk-flip' ? ' flip' : ''}`;
      if (it.kind === 'pic') {
        const pic = document.createElement('div');
        pic.className = 'kk-pic';
        pic.innerHTML = thingSvg(it.thing);
        // the body's colour; after the answer it turns to the thing's own colour
        const solved = game.waiting && game.mode === 'calm';
        pic.style.setProperty('--kk-ink', INKS[solved ? it.own : it.ink]);
        box.appendChild(pic);
        box.setAttribute('aria-label', t('kermis.picLabel', { thing: t(`kermis.thing.${it.thing}`), col: t(`kermis.col.${it.ink}`) }));
      } else {
        const w = document.createElement('p');
        w.className = 'kk-word';
        w.textContent = t(`kermis.col.${it.word}`);
        w.style.color = INKS[it.ink];
        box.appendChild(w);
        box.setAttribute('aria-label', t('kermis.wordLabel', { word: t(`kermis.col.${it.word}`), col: t(`kermis.col.${it.ink}`) }));
      }
    }
  }

  function renderDots() {
    const box = $('#kk-dots');
    box.textContent = '';
    for (let k = 0; k < ROUND_LEN; k++) {
      const d = document.createElement('span');
      const r = game.results[k];
      d.className = `klok-dot${r === true || typeof r === 'number' ? ' good' : r === false ? ' bad' : ''}${k === game.i && !game.done ? ' now' : ''}`;
      box.appendChild(d);
    }
    box.setAttribute('aria-label', t('kermis.progress', { done: Math.min(game.i, ROUND_LEN), total: ROUND_LEN }));
  }

  function helloLine() {
    const it = q();
    const together = game.mode === 'calm' && game.players.length > 1;
    return hostLine(it, { say: 'hello', i: game.i, race: game.mode === 'race', who: together ? game.players[game.i % game.players.length].id : null });
  }

  /** The chameleon's line in the bubble (the task when nothing was said yet), and its mood. */
  function renderSay() {
    if (!game.line) game.line = helloLine();
    $('#kk-say').textContent = lineText(game.line, t);
    $('#kk-host').classList.toggle('happy', game.mood === 'happy');
    $('#kk-chat').classList.toggle('happy', !!game.mood);
  }

  function say(line, mood = '') {
    game.line = line;
    game.mood = mood;
    renderSay();
  }

  // ---------- tapping ----------

  function pick(p, a) {
    if (!game || game.done || overlayUp() || !onScreen('kermis')) return;
    if (game.mode === 'race') racePick(p, a, performance.now());
    else calmPick(p, a);
  }

  function calmPick(p, a) {
    if (game.waiting || p !== game.i % game.players.length) return;
    const it = q();
    const r = tapAnswer(it, game.st, a);
    if (r.ok === null) return;
    if (r.ok === false) {
      if (game.results[game.i] === undefined) {
        game.results[game.i] = false;
        game.mistakes++;
        renderDots();
      }
      game.st = r.st;
      game.tries++;
      if (game.tries >= MAX_TRIES || it.options.length - game.st.tried.length === 1) game.help = true;
      sfx.boop();
      say(hostLine(it, { say: 'try', res: r, a, help: game.help && it.kind === 'stroop' }));
      renderPads();
      padButton(p, a)?.classList.add('bounce');
      return;
    }
    if (game.results[game.i] === undefined) game.results[game.i] = true;
    game.waiting = true;
    game.help = false;
    sfx.chime();
    say(hostLine(it, { say: 'try', res: r, a }), 'happy');
    if (it.kind === 'pic') $('#kk-show .kk-pic')?.style.setProperty('--kk-ink', INKS[it.own]);
    if (it.kind === 'pic') $('#kk-flip .kk-pic')?.style.setProperty('--kk-ink', INKS[it.own]);
    renderPads();
    renderDots();
    after(it.kind === 'pic' && it.answer === 'no' ? 2300 : 1800, nextQuestion);
  }

  const padButton = (p, a) => document.querySelector(`#kk-pads .kk-pad[data-p="${p}"] .kk-ans[data-a="${CSS.escape(a)}"]`);

  function racePick(p, a, now) {
    if (!game.started || game.waiting) return;
    const it = q();
    const { st, res } = raceTap(game.race, p, a, it, now);
    game.race = st;
    if (res === 'right') {
      game.results[game.i] = p;
      game.waiting = true;
      sfx.plink(Math.min(9, st.scores[p] + 2));
      say(hostLine(it, { say: 'won', who: game.players[p].id }), 'happy');
      renderPads();
      renderDots();
      after(NEXT_MS, nextQuestion);
    } else if (res === 'wrong') {
      // only this child waits a moment; nobody loses a point; no sound, no flash
      renderPads();
      const token = plays;
      after(PAUSE_MS + 30, () => token === plays && renderPads());
    }
  }

  /** A question appears: the race clock starts and the turtle plans its taps. */
  function showQuestion(fresh = true) {
    if (fresh) game.shownAt = performance.now();
    plays++;
    clearTimers();
    if (game.mode === 'race') {
      if (!fresh) game.race = raceNext({ ...game.race });
      const k = game.players.findIndex((p) => p.cpu);
      if (k >= 0) {
        const plan = turtlePlan(q(), game.tier, (game.seed ^ hashSeed(`turtle:${game.i}`)) >>> 0);
        for (const step of plan) after(step.at, () => racePick(k, step.a, performance.now()));
      }
    }
    render();
  }

  function nextQuestion() {
    if (!game) return;
    game.waiting = false;
    game.tries = 0;
    game.help = false;
    game.line = null;
    game.mood = '';
    game.st = startState();
    game.i++;
    if (game.i >= ROUND_LEN) {
      finish();
      return;
    }
    if (game.race) game.race = raceNext(game.race);
    showQuestion();
  }

  function finish() {
    game.done = true;
    clearTimers();
    renderDots();
    for (const b of document.querySelectorAll('#kk-pads .kk-ans')) b.disabled = true;
    sfx.chime();
    if (game.mode === 'race') finishRace();
    else finishCalm();
  }

  function finishCalm() {
    const n = starsFor(game.mistakes);
    if (game.roundId) store.recordStars(meta.id, game.roundId, n);
    else store.recordRandomSolved(meta.id, game.tier);
    const right = game.results.filter((r) => r === true).length;
    const g = game;
    const buttons = [];
    let text = t(g.players.length > 1 ? 'kermis.winTogether' : 'kermis.winText', { right, total: ROUND_LEN });
    if (!g.roundId) {
      text = `${text} ${t('random.done', { n: randomDone()[g.tier] || 1 })}`;
      buttons.push([t('random.new'), 'big primary', () => (shell.hideOverlay(), playRandom(g.tier))]);
    } else {
      const next = nextRoundId(g.roundId);
      if (next && !locked(next.split('-')[0])) buttons.push([t('kermis.next'), 'big primary', () => (shell.hideOverlay(), startRound(next))]);
      else if (next) {
        text = `${text} ${t('kermis.lastFree')}`;
        buttons.push([t('kermis.more'), 'big primary', () => (shell.show('kermis-menu'), offer())]);
      }
      buttons.push([t('kermis.again'), 'big secondary', () => (shell.hideOverlay(), startRound(g.roundId))]);
    }
    buttons.push([t('kermis.rounds'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('kermis-menu')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`kermis.win${n}`),
      text,
      buttons,
    });
  }

  /** The end of a race: everyone placed, cheerfully (a shared place for the same points). */
  function finishRace() {
    const g = game;
    const scores = g.race.scores;
    const at = places(scores);
    const order = g.players.map((p, k) => k).sort((a, b) => at[a] - at[b] || a - b);
    const rows = order
      .map((k) => {
        const p = g.players[k];
        const pic = p.cpu ? `<span class="kk-turtle">${turtleSvg()}</span>` : playerSvg(p.id);
        return `<li class="kk-place place-${at[k]}" data-p="${k}"><span class="kk-medal">${at[k]}</span>${pic}<span class="kk-place-name"></span><span class="kk-place-pts"><svg viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg><b></b></span></li>`;
      })
      .join('');
    const kidsOnly = g.players.every((p) => !p.cpu);
    const top = order.filter((k) => at[k] === 1);
    let title;
    if (top.length > 1) title = t('kermis.raceTie');
    else if (!kidsOnly) title = t(g.players[top[0]].cpu ? 'kermis.raceTurtleWon' : 'kermis.raceYouWon');
    else title = t('kermis.raceWon', { who: whoName(g.players[top[0]]) });
    const buttons = [
      [t('kermis.raceAgain'), 'big primary', () => (shell.hideOverlay(), g.roundId ? startRound(g.roundId) : playRandom(g.tier))],
      [t('kermis.rounds'), 'big secondary', () => shell.show('kermis-menu')],
    ];
    shell.showOverlay({ art: `<ol class="kk-places">${rows}</ol>`, title, text: t('kermis.raceText'), buttons });
    // the names and points as text (never in an HTML string)
    for (const li of document.querySelectorAll('#ov-art .kk-place')) {
      const k = Number(li.dataset.p);
      li.querySelector('.kk-place-name').textContent = whoName(g.players[k]);
      li.querySelector('.kk-place-pts b').textContent = String(scores[k]);
      li.querySelector('.kk-place-pts').setAttribute('aria-label', t('kermis.points', { n: scores[k] }));
    }
  }

  /** The next round: the next one of this tier, then the first of the next tier. */
  function nextRoundId(id) {
    const [tier, r] = id.split('-');
    if (Number(r) < ROUNDS_PER_TIER) return `${tier}-${Number(r) + 1}`;
    const k = TIER_IDS.indexOf(tier);
    return k >= 0 && k + 1 < TIER_IDS.length ? `${TIER_IDS[k + 1]}-1` : null;
  }

  // the bounce is a CSS animation; take the class off when it ends so it can run again
  $('#kk-pads').addEventListener('animationend', (e) => e.target.closest?.('.kk-ans')?.classList.remove('bounce'));

  return {
    async init() {
      return true;
    },
    open() {
      shell.show('kermis-menu');
    },
    leave,
    testHook() {
      return {
        state: () =>
          game && {
            tier: game.tier,
            roundId: game.roundId,
            mode: game.mode,
            players: game.players.map((p) => ({ ...p })),
            i: game.i,
            q: game.qs[game.i],
            turn: game.mode === 'calm' ? game.i % game.players.length : null,
            tried: [...game.st.tried],
            help: game.help,
            mistakes: game.mistakes,
            tries: game.tries,
            results: [...game.results],
            done: game.done,
            waiting: game.waiting,
            started: game.started,
            race: game.race && { scores: [...game.race.scores], winner: game.race.winner, paused: game.race.paused.map((x) => Math.max(0, x - performance.now())), tried: game.race.tried.map((x) => [...x]) },
            line: game.line && { key: game.line.key, text: $('#kk-say').textContent },
            mood: game.mood,
          },
        setup: ({ mode: m, players } = {}) => {
          if (m && MODES.includes(m)) store.saveGameOption(meta.id, 'lastMode', m);
          if (players && PLAYER_COUNTS.includes(players)) store.saveGameOption(meta.id, 'lastPlayers', players);
          if (onScreen('kermis-menu')) renderMenu();
          return { mode: mode(), players: savedPlayers() };
        },
        start: (id) => startRound(id),
        random: (tier, seed) => playRandom(tier, seed),
        tap: (p, a) => pick(p, a),
        say: (line) => game && say(line), // the layout test pins the longest lines in the bubble
        stars: () => stars(),
        saved: () => ({ stars: stars(), random: randomDone(), howSeen: seenHow(), lastTier: lastTier(), lastMode: savedMode(), lastPlayers: savedPlayers() }),
      };
    },
  };
}
