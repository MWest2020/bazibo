// Letters: learn the letters by ear (ages 4-7). Everything that matters is spoken, so no reading
// is needed.
//   Tik de letter   hear a letter, tap it
//   Beginletter     see a picture and hear its word, tap the letter it starts with
//   Woordje maken   hear a word, tap its letters in order
// Three tiers (first letters, more letters, the whole alphabet); a round earns stars by mistakes.
// The voice is recorded clips (voice.js); the rounds are pure (round.js); the pictures are the
// app's own drawings (art.js). The shell (web/js/main.js) owns the overlay, sound and purchase.
//
// Saved (games.letters): stars per round (only ever raised), random rounds done per mode and
// tier, which how-to cards were seen, the last tier per mode and the capitals option. All read from
// the save each time. An unfinished round is kept while the app stays open ("keep playing").
import { meta } from './meta.js';
import { MODES, TIER_IDS, ROUNDS_PER_TIER, ROUND_LEN, makeRound, starsFor, hashSeed, nextLetterOk } from './round.js';
import { pictureOf } from './words.js';
import { wordPictureSvg, modeSvg } from './art.js';
import * as voice from './voice.js';
import { getLang } from '../../js/i18n.js';
import * as store from '../../js/storage.js';
import { newSeed, randomCard } from '../../js/random.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const EAR = '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M10 9.5a2 2 0 0 1 4 0c0 1.5-1.5 2-1.5 3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
const AGES = Object.freeze({ t1: '4-5', t2: '5-6', t3: '6-7' });
const MAX_TRIES = 2; // wrong taps on one question before the right letter is shown

export function createLetters(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  const randomDone = () => store.loadRandomSolved(meta.id);
  const lastTier = () => store.loadGameOption(meta.id, 'lastTier', {}) || {};
  const upper = () => store.loadGameOption(meta.id, 'upper', false) === true;
  const show = (l) => (upper() ? l.toUpperCase() : l);

  // { mode, tier, roundId (null when random), seed, lang, qs, i, mistakes, results, tries, placed, waiting, done }
  let game = null;
  let plays = 0; // counts rounds started, so a late timer never acts on a newer round
  let timer = null;
  let menuMode = null;

  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const locked = (mode, tier) => meta.isLocked({ mode, tier }, shell.unlock.owned);
  const q = () => game.qs[game.i];
  const len = () => ROUND_LEN[game.mode];

  shell.unlock.onChange(() => {
    if (onScreen('letters-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'letters-menu') renderMenu();
    if (name !== 'letters') {
      clearTimer();
      voice.stop();
    }
  });
  shell.onLangChange(() => {
    if (onScreen('letters-menu')) renderMenu();
    // a round's words belong to its language: a kept round in the other language is dropped
    if (game && !game.done && game.lang !== getLang()) game = null;
    if (game && !game.done && onScreen('letters')) render();
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
      if (token === plays && game && onScreen('letters')) fn();
    }, ms);
  }

  // ---------- menu ----------

  function starsText(n) {
    return [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  }

  function renderMenu() {
    const box = $('#letters-menu');
    box.textContent = '';
    $('#letters-menu-title').textContent = menuMode ? t(`letters.mode.${menuMode}`) : t('letters.menu');
    renderCaseToggle();
    if (game && !game.done) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'letters-continue';
      cont.className = 'btn big secondary letters-continue';
      cont.textContent = t('letters.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      box.appendChild(cont);
    }
    if (!menuMode) {
      for (const mode of MODES) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'klok-modecard letters-modecard';
        b.dataset.mode = mode;
        b.innerHTML = `<span class="klok-mode-art">${modeSvg(mode)}</span><span class="klok-mode-text"><span class="klok-mode-title"></span><span class="klok-mode-sub"></span><span class="klok-mode-age"></span></span>`;
        b.querySelector('.klok-mode-title').textContent = t(`letters.mode.${mode}`);
        b.querySelector('.klok-mode-sub').textContent = t(`letters.mode.${mode}Sub`);
        b.querySelector('.klok-mode-age').textContent = t('letters.ages', { age: '4-7' });
        b.addEventListener('click', () => {
          tap();
          menuMode = mode;
          renderMenu();
          $('#screen-letters-menu .levels-scroll').scrollTop = 0;
        });
        box.appendChild(b);
      }
      return;
    }
    const mode = menuMode;
    const got = stars();
    const done = randomDone();
    const rtier = TIER_IDS.includes(lastTier()[mode]) ? lastTier()[mode] : 't1';
    const rgrid = document.createElement('div');
    rgrid.className = 'level-grid klok-grid klok-random';
    rgrid.appendChild(
      randomCard({
        t,
        tap,
        title: `${t('random.play')} · ${t(`letters.tier.${rtier}`)}`,
        locked: !shell.unlock.owned,
        solved: done[`${mode}-${rtier}`] || 0,
        done: true,
        onPlay: () => playRandom(mode, rtier),
        onLocked: () => shell.offerUnlock(t('letters.randomLead')),
      }),
    );
    box.appendChild(rgrid);
    for (const tier of TIER_IDS) {
      const line = document.createElement('p');
      line.className = 'klok-age';
      line.textContent = t('letters.tierLine', { age: AGES[tier], what: t(`letters.tier.${tier}`) });
      box.appendChild(line);
      const grid = document.createElement('div');
      grid.className = 'level-grid klok-grid';
      grid.dataset.tier = `${mode}-${tier}`;
      for (let r = 1; r <= ROUNDS_PER_TIER; r++) {
        const id = `${mode}-${tier}-${r}`;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'level-btn';
        b.dataset.round = id;
        if (locked(mode, tier)) {
          b.classList.add('locked');
          b.innerHTML = `<span class="num">${r}</span><svg viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
          b.setAttribute('aria-label', t('letters.roundLocked', { n: r }));
          b.addEventListener('click', () => {
            tap();
            offer();
          });
        } else {
          const n = got[id] || 0;
          b.innerHTML = `<span class="num">${r}</span><span class="stars" aria-hidden="true">${starsText(n)}</span>`;
          b.setAttribute('aria-label', n ? t('letters.roundStars', { n: r, stars: n }) : t('letters.roundOpen', { n: r }));
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

  function renderCaseToggle() {
    const b = $('#letters-case');
    b.textContent = upper() ? 'Aa' : 'aA';
    b.setAttribute('aria-pressed', String(upper()));
    b.setAttribute('aria-label', upper() ? t('letters.caseOn') : t('letters.caseOff'));
    b.title = t('letters.case');
  }
  $('#letters-case').addEventListener('click', () => {
    tap();
    store.saveGameOption(meta.id, 'upper', !upper());
    renderCaseToggle();
  });

  /** The menu's back: from one kind of round to the three kinds, from there to the home screen. */
  function menuBack() {
    if (menuMode) {
      menuMode = null;
      renderMenu();
    } else shell.show('home');
  }
  $('#letters-menu-back').addEventListener('click', () => {
    tap();
    menuBack();
  });

  function offer() {
    shell.offerUnlock(t('letters.lockedLead'));
  }

  // ---------- rounds ----------

  function startRound(id) {
    const [mode, tier, r] = String(id).split('-');
    if (!MODES.includes(mode) || !TIER_IDS.includes(tier) || !(Number(r) >= 1 && Number(r) <= ROUNDS_PER_TIER)) return;
    if (locked(mode, tier)) {
      offer();
      return;
    }
    begin({ mode, tier, roundId: id, seed: hashSeed(`letters:${getLang()}:${id}`) });
  }

  function playRandom(mode, tier, seed = null) {
    if (!shell.unlock.owned) {
      shell.offerUnlock(t('letters.randomLead'));
      return;
    }
    if (!MODES.includes(mode) || !TIER_IDS.includes(tier)) return;
    begin({ mode, tier, roundId: null, seed: seed ?? newSeed() });
  }

  function begin({ mode, tier, roundId, seed }) {
    plays++;
    clearTimer();
    voice.stop();
    menuMode = mode; // "Rounds" and the back button land on this kind of round
    if (lastTier()[mode] !== tier) store.saveGameOption(meta.id, 'lastTier', { ...lastTier(), [mode]: tier });
    const lang = getLang();
    const qs = makeRound({ mode, tier, lang, seed });
    game = { mode, tier, roundId, seed, lang, qs, i: 0, mistakes: 0, results: [], tries: 0, placed: [], waiting: false, done: false };
    shell.show('letters');
    render();
    if (!seenHow()[mode]) {
      shell.showOverlay({
        art: `<span class="klok-ov">${modeSvg(mode)}</span>`,
        title: t('letters.howTitle'),
        text: t(`letters.how.${mode}`),
        buttons: [
          [
            t('common.ok'),
            'big primary',
            () => {
              store.saveGameOption(meta.id, 'howSeen', { ...seenHow(), [mode]: true });
              shell.hideOverlay();
              speakQuestion();
            },
          ],
        ],
      });
    } else speakQuestion();
  }

  function resume() {
    if (!game || game.done) return;
    shell.show('letters');
    if (game.waiting) nextQuestion();
    else {
      render();
      speakQuestion();
    }
  }

  /** Android back and the menu button: to the menu, the round is kept ("keep playing"). */
  function leave() {
    clearTimer();
    voice.stop();
    shell.hideOverlay();
    shell.show('letters-menu');
  }

  // ---------- speaking ----------

  function questionKeys() {
    const it = q();
    if (game.mode === 'tap') return ['p-find', `l-${it.letter}`];
    if (game.mode === 'first') return [`w-${it.word}`, 'p-first'];
    return ['p-build', `w-${it.word}`];
  }

  function speakQuestion() {
    if (!game || game.done) return;
    voice.say(game.lang, questionKeys());
  }

  $('#letters-replay').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${EAR}</svg>`;
  $('#letters-replay').addEventListener('click', () => {
    if (!game || game.done || overlayUp()) return;
    sfx.unlock();
    speakQuestion();
  });

  // ---------- one question ----------

  function render() {
    if (!game) return;
    $('#letters-sub').textContent = t(`letters.mode.${game.mode}`);
    $('#letters-title').textContent = game.roundId ? t('letters.round', { n: game.roundId.split('-')[2] }) : t('random.title');
    $('#screen-letters').dataset.mode = game.mode;
    $('#letters-muted').hidden = !sfx.isMuted();
    $('#letters-muted').textContent = t('letters.muted');
    renderPrompt();
    renderPicture();
    renderSlots();
    renderOptions();
    renderDots();
    setStatus('');
  }

  function renderPrompt() {
    $('#letters-prompt').textContent = t(game.mode === 'tap' ? 'letters.find' : game.mode === 'first' ? 'letters.first' : 'letters.build');
  }

  function renderPicture() {
    const box = $('#letters-pic');
    if (game.mode === 'tap') {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = wordPictureSvg(pictureOf(game.lang, q().word));
    box.setAttribute('aria-label', q().word);
  }

  function renderSlots() {
    const box = $('#letters-slots');
    box.textContent = '';
    if (game.mode !== 'build') {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const word = q().word;
    for (let k = 0; k < word.length; k++) {
      const s = document.createElement('span');
      s.className = `letters-slot${k < game.placed.length ? ' filled' : ''}${k === game.placed.length ? ' next' : ''}`;
      s.textContent = k < game.placed.length ? show(word[k]) : '';
      box.appendChild(s);
    }
  }

  function renderOptions() {
    const box = $('#letters-options');
    box.textContent = '';
    const it = q();
    const list = game.mode === 'build' ? it.tiles : it.options;
    box.className = `letters-options n${list.length}`;
    list.forEach((l, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'letters-tile';
      b.dataset.k = String(k);
      b.dataset.letter = l;
      b.textContent = show(l);
      b.setAttribute('aria-label', t('letters.tile', { l: show(l) }));
      if (game.mode === 'build' && usedTiles().has(k)) b.classList.add('used');
      b.addEventListener('click', () => {
        if (!game || game.waiting || overlayUp() || b.classList.contains('used') || b.disabled) return;
        sfx.unlock();
        if (game.mode === 'build') placeTile(k);
        else answer(k);
      });
      box.appendChild(b);
    });
  }

  /** Build mode: which tiles are already in the word (each placed letter takes one tile). */
  function usedTiles() {
    const used = new Set();
    const tiles = q().tiles;
    for (const l of game.placed) {
      const k = tiles.findIndex((x, i) => x === l && !used.has(i));
      if (k >= 0) used.add(k);
    }
    return used;
  }

  function renderDots() {
    const box = $('#letters-dots');
    box.textContent = '';
    for (let k = 0; k < len(); k++) {
      const d = document.createElement('span');
      const r = game.results[k];
      d.className = `klok-dot${r === true ? ' good' : r === false ? ' bad' : ''}${k === game.i && !game.done ? ' now' : ''}`;
      box.appendChild(d);
    }
    box.setAttribute('aria-label', t('letters.progress', { done: Math.min(game.i, len()), total: len() }));
  }

  function setStatus(text) {
    $('#letters-status').textContent = text;
  }

  // ---------- answering ----------

  function answer(k) {
    if (!game || game.mode === 'build' || game.waiting || game.done) return;
    const it = q();
    const tiles = [...document.querySelectorAll('#letters-options .letters-tile')];
    if (it.options[k] === it.letter) {
      tiles[k]?.classList.add('right');
      correct();
      return;
    }
    tiles[k]?.classList.add('wrong');
    if (tiles[k]) tiles[k].disabled = true;
    oops(() => {
      const right = it.options.indexOf(it.letter);
      tiles[right]?.classList.add('right');
      voice.say(game.lang, ['p-thisIs', `l-${it.letter}`]);
    });
  }

  function placeTile(k) {
    if (!game || game.mode !== 'build' || game.waiting || game.done) return;
    const it = q();
    const letter = it.tiles[k];
    if (nextLetterOk(it.word, game.placed, letter)) {
      game.placed.push(letter);
      sfx.plink(0.7 + game.placed.length * 0.1);
      renderSlots();
      renderOptions();
      if (game.placed.length === it.word.length) {
        $('#letters-slots').classList.add('done');
        correct([`w-${it.word}`, 'p-good']);
      }
      return;
    }
    const tile = document.querySelector(`#letters-options .letters-tile[data-k="${k}"]`);
    tile?.classList.remove('wrong');
    void tile?.offsetWidth; // restart the shake
    tile?.classList.add('wrong');
    oops(() => {
      // after two wrong tries the next letter goes in by itself, so nobody gets stuck
      game.placed.push(it.word[game.placed.length]);
      game.tries = 0;
      game.waiting = false;
      renderSlots();
      renderOptions();
      if (game.placed.length === it.word.length) correct([`w-${it.word}`]);
    }, true);
  }

  function correct(keys = ['p-good']) {
    if (game.results[game.i] === undefined) game.results[game.i] = true;
    game.waiting = true;
    voice.say(game.lang, keys);
    setStatus(t('letters.good'));
    $('#letters-stage').classList.add('happy');
    renderDots();
    later(1300, () => {
      $('#letters-stage').classList.remove('happy');
      $('#letters-slots').classList.remove('done');
      nextQuestion();
    });
  }

  /** A wrong tap: gentle, counted once per question; after MAX_TRIES the answer is shown. */
  function oops(showRight, build = false) {
    if (game.results[game.i] === undefined) {
      game.results[game.i] = false;
      game.mistakes++;
      renderDots();
    }
    game.tries++;
    sfx.boop();
    setStatus(t('letters.again'));
    if (game.tries < MAX_TRIES) {
      const it = q();
      voice.say(game.lang, ['p-again', game.mode === 'tap' ? `l-${it.letter}` : `w-${it.word}`]);
      return;
    }
    game.waiting = true;
    later(build ? 500 : 300, () => {
      showRight();
      if (!build) later(1800, nextQuestion);
    });
  }

  function nextQuestion() {
    if (!game) return;
    game.waiting = false;
    game.tries = 0;
    game.placed = [];
    game.i++;
    if (game.i >= len()) {
      finish();
      return;
    }
    render();
    speakQuestion();
  }

  function finish() {
    game.done = true;
    const n = starsFor(game.mistakes);
    if (game.roundId) store.recordStars(meta.id, game.roundId, n);
    else store.recordRandomSolved(meta.id, `${game.mode}-${game.tier}`);
    renderDots();
    sfx.chime();
    voice.say(game.lang, ['p-done']);
    const right = game.results.filter(Boolean).length;
    const g = game;
    const buttons = [];
    let text = t('letters.winText', { right, total: len() });
    if (!g.roundId) {
      text = `${text} ${t('random.done', { n: randomDone()[`${g.mode}-${g.tier}`] || 1 })}`;
      buttons.push([t('random.new'), 'big primary', () => (shell.hideOverlay(), playRandom(g.mode, g.tier))]);
    } else {
      const next = nextRoundId(g.roundId);
      if (next && !locked(next.split('-')[0], next.split('-')[1])) buttons.push([t('letters.next'), 'big primary', () => (shell.hideOverlay(), startRound(next))]);
      else if (next) {
        text = `${text} ${t('letters.lastFree')}`;
        buttons.push([t('letters.more'), 'big primary', () => (shell.show('letters-menu'), offer())]);
      }
      buttons.push([t('letters.again2'), 'big secondary', () => (shell.hideOverlay(), startRound(g.roundId))]);
    }
    buttons.push([t('letters.rounds'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('letters-menu')]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`letters.win${n}`),
      text,
      buttons,
    });
  }

  /** The next round of the same kind: the next round of this tier, then the first of the next tier. */
  function nextRoundId(id) {
    const [mode, tier, r] = id.split('-');
    if (Number(r) < ROUNDS_PER_TIER) return `${mode}-${tier}-${Number(r) + 1}`;
    const k = TIER_IDS.indexOf(tier);
    return k >= 0 && k + 1 < TIER_IDS.length ? `${mode}-${TIER_IDS[k + 1]}-1` : null;
  }

  $('#letters-back').addEventListener('click', () => {
    tap();
    leave();
  });
  document.addEventListener('keydown', (e) => {
    if (!game || !onScreen('letters') || overlayUp() || game.waiting || game.done) return;
    if (e.target?.closest?.('button') && (e.key === 'Enter' || e.key === ' ')) return;
    if (!/^[a-z]$/i.test(e.key)) return;
    const l = e.key.toLowerCase();
    const it = q();
    if (game.mode === 'build') {
      const used = usedTiles();
      const k = it.tiles.findIndex((x, i) => x === l && !used.has(i));
      if (k >= 0) placeTile(k);
    } else {
      const k = it.options.indexOf(l);
      if (k >= 0) answer(k);
    }
  });

  return {
    async init() {
      return true; // the clips load on first use
    },
    open() {
      menuMode = null;
      shell.show('letters-menu');
    },
    leave,
    menuBack,
    testHook() {
      return {
        state: () =>
          game && {
            mode: game.mode,
            tier: game.tier,
            lang: game.lang,
            roundId: game.roundId,
            i: game.i,
            q: game.qs[game.i],
            placed: [...game.placed],
            mistakes: game.mistakes,
            done: game.done,
            waiting: game.waiting,
          },
        start: (id) => startRound(id),
        menu: (mode) => ((menuMode = mode || null), renderMenu()),
        random: (mode, tier) => playRandom(mode, tier),
        answer: (k) => answer(k),
        place: (k) => placeTile(k),
        spoken: () => [...voice.spoken],
        stars: () => stars(),
      };
    },
  };
}
