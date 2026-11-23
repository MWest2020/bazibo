// Verstoppertje (Hide and Seek): find the animal shown at the top. It hides behind one of the spots
// in the scene (a stone, a bush, a little door in a tree, an advent-calendar flap...); a tap lifts,
// pushes aside or opens that spot. Behind every other spot lives a friendly creature that peeks out
// and waves: never "wrong", no buzzer, no losing, no timers, no voice (only the shell's plink and
// chime). After the wave the spot settles back ajar, with the creature peeking out of the crack, so
// the child sees where they already looked (clearer for a three-year-old than a spot that closes
// all the way and looks untouched; the memory question of tier 3 closes them all on purpose).
// Found: a little celebration, the animal stays in sight, then the next round. Stars count only
// the extra looks, gently. A bit of every hidden animal peeks out over its spot (`cluesOf`; from the
// start in tier 1, now and then in tier 2, rarely and with its feature's colour in tier 3), so a
// child who watches is not just guessing (Mark's playtest, 23 Nov 2026).
//
// The rounds and what a tap means are pure (rules.js), the drawings in art.js; the shell
// (web/js/main.js) owns the overlay card, the sound settings and the purchase, passed in as `shell`.
//
// Saved (games.verstop): stars per round (only ever raised), random rounds done per tier, which
// how-to cards were seen, the last scene and the last tier. All read from the save each time. An
// unfinished round is kept while the app stays open ("keep playing").
import { meta } from './meta.js';
import {
  SCENE_IDS,
  SCENES,
  TIERS,
  TIER_IDS,
  ROUNDS_PER_TIER,
  makeRound,
  fixedRound,
  parseRoundId,
  roundId,
  roundSeed,
  newPlay,
  look,
  stillToFind,
  starsFor,
  spotLayout,
  isTarget,
  cluesOf,
} from './rules.js';
import { figureSvg, spotSvg, sceneSvg, sceneCardSvg, howSvg, figureFit, SPOT_ART } from './art.js';
import * as store from '../../js/storage.js';
import { newSeed, randomCard } from '../../js/random.js';
import * as sfx from '../../js/audio.js';
import { foldLocked } from '../../js/fold.js';
import { optionCard, menuLine, levelCell } from '../../js/menu.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const WAVE_MS = 1400; // a creature peeks out and waves this long before its spot settles back ajar
const FOUND_MS = 1600; // the celebration before the end card or the memory question

export function createVerstop(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const seenHow = () => store.loadGameOption(meta.id, 'howSeen', {}) || {};
  const randomDone = () => store.loadRandomSolved(meta.id);
  const lastTier = () => {
    const v = store.loadGameOption(meta.id, 'lastTier', 't1');
    return TIER_IDS.includes(v) ? v : 't1';
  };
  const lastScene = () => {
    const v = store.loadGameOption(meta.id, 'lastScene', 'garden');
    return SCENE_IDS.includes(v) ? v : 'garden';
  };

  // { scene, tier, roundId (null when random), seed, round, play, waiting, pending, done }
  let game = null;
  let plays = 0; // counts rounds started, so a late timer never acts on a newer round
  const timers = new Set();
  let menuScene = null; // the scene shown in the menu (the last one played, until the child picks another)

  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const locked = (scene, tier) => meta.isLocked({ scene, tier }, shell.unlock.owned);

  shell.unlock.onChange(() => {
    if (onScreen('verstop-menu')) renderMenu();
  });
  shell.onShow((name) => {
    if (name === 'verstop-menu') renderMenu();
    if (name !== 'verstop') clearTimers();
  });
  shell.onLangChange(() => {
    if (onScreen('verstop-menu')) renderMenu();
    if (game && onScreen('verstop')) renderTexts();
  });

  function clearTimers() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  /** `fn` after `ms`, dropped when another round started or the screen changed. */
  function after(ms, fn) {
    const token = plays;
    const id = setTimeout(() => {
      timers.delete(id);
      if (token === plays && game && onScreen('verstop')) fn();
    }, ms);
    timers.add(id);
  }

  // ---------- names ----------

  const nameOf = (who) => (who.feature ? t('verstop.with', { a: t(`verstop.the.${who.id}`), f: t(`verstop.feat.${who.feature}`) }) : t(`verstop.the.${who.id}`));
  const findName = (f) => nameOf({ kind: 'animal', ...f });

  // ---------- menu ----------

  function renderMenu() {
    const box = $('#verstop-menu');
    box.textContent = '';
    const scene = menuScene || lastScene();
    if (game && !game.done) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.id = 'verstop-continue';
      cont.className = 'btn big secondary menu-continue';
      cont.textContent = t('verstop.continue');
      cont.addEventListener('click', () => {
        tap();
        resume();
      });
      box.appendChild(cont);
    }
    // the places: the garden is free, the others are in the full version
    box.appendChild(menuLine(t('verstop.scenes')));
    const row = document.createElement('div');
    row.className = 'pic-grid vz-scenes';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', t('verstop.scenes'));
    for (const id of SCENE_IDS) {
      const free = !locked(id, 't1');
      const b = optionCard({
        art: sceneCardSvg(id, SCENES[id].spots[0], SCENES[id].animals[0]),
        title: t(`verstop.scene.${id}`),
        pressed: id === scene,
        locked: !free,
        cls: 'pic vz-scene-btn',
        label: free ? t(`verstop.scene.${id}`) : t('verstop.sceneLocked', { scene: t(`verstop.scene.${id}`) }),
      });
      b.dataset.scene = id;
      b.addEventListener('click', () => {
        tap();
        if (!free) {
          offer();
          return;
        }
        menuScene = id;
        if (lastScene() !== id) store.saveGameOption(meta.id, 'lastScene', id);
        renderMenu();
      });
      row.appendChild(b);
    }
    box.appendChild(row);
    const got = stars();
    const done = randomDone();
    const rtier = lastTier();
    const rgrid = document.createElement('div');
    rgrid.className = 'level-grid klok-grid';
    rgrid.appendChild(
      randomCard({
        t,
        tap,
        title: `${t('random.play')} · ${t(`verstop.short.${rtier}`)}`,
        locked: !shell.unlock.owned,
        solved: done[rtier] || 0,
        done: true,
        onPlay: () => playRandom(rtier),
        onLocked: () => shell.offerUnlock(t('verstop.randomLead')),
      }),
    );
    box.appendChild(rgrid);
    for (const tier of TIER_IDS) {
      box.appendChild(menuLine(t('verstop.tierLine', { age: TIERS[tier].age, what: t(`verstop.tier.${tier}`) })));
      const grid = document.createElement('div');
      grid.className = 'level-grid klok-grid';
      grid.dataset.tier = tier;
      for (let r = 1; r <= ROUNDS_PER_TIER; r++) {
        const id = roundId(scene, tier, r);
        const isLocked = locked(scene, tier);
        const n = isLocked ? 0 : got[id] || 0;
        const b = levelCell({ num: r, stars: n, locked: isLocked });
        b.dataset.round = id;
        if (isLocked) {
          b.setAttribute('aria-label', t('verstop.roundLocked', { n: r }));
          b.addEventListener('click', () => {
            tap();
            offer();
          });
        } else {
          b.setAttribute('aria-label', n ? t('verstop.roundStars', { n: r, stars: n }) : t('verstop.roundOpen', { n: r }));
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

  $('#verstop-menu-back').addEventListener('click', () => {
    tap();
    shell.show('home');
  });

  function offer() {
    shell.offerUnlock(t('verstop.lockedLead'));
  }

  // ---------- rounds ----------

  function startRound(id) {
    const p = parseRoundId(id);
    if (!p) return;
    if (locked(p.scene, p.tier)) {
      offer();
      return;
    }
    begin({ scene: p.scene, tier: p.tier, roundId: id, seed: roundSeed(id), n: p.n });
  }

  function playRandom(tier, scene = null, seed = null) {
    if (!shell.unlock.owned) {
      shell.offerUnlock(t('verstop.randomLead'));
      return;
    }
    if (!TIER_IDS.includes(tier)) return;
    const s = seed ?? newSeed();
    // a new place every time (unless one is asked for)
    const where = SCENE_IDS.includes(scene) ? scene : SCENE_IDS[s % SCENE_IDS.length];
    begin({ scene: where, tier, roundId: null, seed: s, n: 0 });
  }

  function begin({ scene, tier, roundId: id, seed, n }) {
    plays++;
    clearTimers();
    if (lastTier() !== tier) store.saveGameOption(meta.id, 'lastTier', tier);
    if (id && lastScene() !== scene) store.saveGameOption(meta.id, 'lastScene', scene);
    if (id) menuScene = scene;
    // the animal never hides where it hid in the round just played (a replay of the same round too)
    const before = game?.round || null;
    const round = id ? fixedRound(id, before) : makeRound({ scene, tier, seed, n, before: before ? [before] : [] });
    game = { scene, tier, roundId: id, seed, round, play: newPlay(), waiting: false, pending: null, done: false };
    shell.show('verstop');
    render();
    if (!seenHow()[tier]) {
      shell.showOverlay({
        art: `<span class="vz-ov">${howSvg()}</span>`,
        title: t('verstop.howTitle'),
        text: t(`verstop.how.${tier}`),
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
    shell.show('verstop');
    render();
    // a celebration cut short by leaving goes on where it was
    if (game.pending === 'finish') finish();
    else if (game.pending === 'memory') startMemory();
  }

  /** Android back and the menu button: to the menu, the round is kept ("keep playing"). */
  function leave() {
    clearTimers();
    shell.hideOverlay();
    shell.show('verstop-menu');
  }
  $('#verstop-back').addEventListener('click', () => {
    tap();
    leave();
  });

  // ---------- the scene ----------

  function render() {
    if (!game) return;
    const scr = $('#screen-verstop');
    scr.dataset.tier = game.tier;
    scr.dataset.scene = game.scene;
    $('#vz-stage').classList.remove('happy');
    $('#vz-bg').innerHTML = sceneSvg(game.scene);
    const box = $('#vz-spots');
    box.textContent = '';
    const clues = cluesOf(game.round); // a bit of each hidden animal peeks out (none on a friend's spot)
    game.round.spots.forEach((spot, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vz-spot';
      b.dataset.i = String(i);
      b.dataset.kind = spot.kind;
      b.innerHTML = spotSvg(spot.kind, spot.who, i + 1, clues[i]);
      const fit = figureFit(spot.kind);
      if (fit.k !== 1) {
        // a figure in a doorway grows to full size once found (see .vz-spot.found in verstop.css)
        b.style.setProperty('--fx', `${(50 - (fit.x + 50 * fit.k) / fit.k).toFixed(2)}px`);
        b.style.setProperty('--fy', `${(94 - (fit.y + 94 * fit.k) / fit.k).toFixed(2)}px`);
        b.style.setProperty('--fs', (1 / fit.k).toFixed(3));
        b.style.setProperty('--hx', `${SPOT_ART[spot.kind].hole.x}px`); // where its door is hinged
      }
      b.addEventListener('click', () => {
        sfx.unlock();
        tapSpot(i);
      });
      box.appendChild(b);
    });
    syncSpots();
    renderTexts();
    setStatus('');
    layout();
  }

  /** Each spot's look from the state: closed, ajar (looked), found; in the memory question all closed. */
  function syncSpots() {
    const { play, round } = game;
    // the hints only while seeking: not in the memory question, nor once the round is over
    $('#vz-stage').dataset.clues = play.phase === 'seek' ? 'on' : 'off';
    for (const b of document.querySelectorAll('#vz-spots .vz-spot')) {
      const i = Number(b.dataset.i);
      const found = play.found.includes(i) || (play.phase === 'done' && play.ask === i);
      const seen = play.phase === 'memory' ? play.memLooked.includes(i) : play.looked.includes(i);
      b.classList.toggle('found', found);
      b.classList.toggle('ajar', !found && seen && !b.classList.contains('open'));
      b.classList.toggle('shut', !found && !seen);
      b.dataset.state = found ? 'found' : seen ? 'seen' : 'closed';
      const spot = round.spots[i];
      const name = t(`verstop.spot.${spot.kind}`);
      const label = found
        ? t('verstop.spotFound', { spot: name, n: i + 1, who: nameOf(spot.who) })
        : seen
          ? t('verstop.spotSeen', { spot: name, n: i + 1, who: nameOf(spot.who) })
          : t('verstop.spotAria', { spot: name, n: i + 1 });
      b.setAttribute('aria-label', label);
    }
  }

  /** The animal(s) to find, big at the top; in the memory question the creature asked about. */
  function renderAsk() {
    const { round, play } = game;
    const pics = $('#vz-ask-pics');
    let text;
    if (play.phase === 'memory' || (play.phase === 'done' && play.ask !== null)) {
      const who = round.spots[play.ask].who;
      pics.innerHTML = `<span class="vz-ask-pic">${figureSvg(who)}</span>`;
      text = t('verstop.where', { c: t(`verstop.the.${who.id}`) });
    } else {
      const left = stillToFind(round, play);
      pics.innerHTML = round.find.map((f, k) => `<span class="vz-ask-pic${left.includes(k) ? '' : ' got'}">${figureSvg({ kind: 'animal', ...f })}</span>`).join('');
      const f0 = round.find[0];
      if (round.find.length > 1) text = t('verstop.find2', { a: findName(round.find[0]), b: findName(round.find[1]) });
      else if (f0.feature) text = t('verstop.findWith', { a: t(`verstop.the.${f0.id}`), f: t(`verstop.feat.${f0.feature}`) });
      else text = t('verstop.find1', { a: t(`verstop.the.${f0.id}`) });
    }
    $('#vz-ask-text').textContent = text;
    pics.dataset.n = String(pics.children.length);
  }

  /** Everything with words in it (also after a language switch). */
  function renderTexts() {
    $('#vz-sub').textContent = `${t('verstop.menu')} · ${t(`verstop.scene.${game.scene}`)}`;
    $('#vz-title').textContent = game.roundId ? t('verstop.round', { n: game.round.n }) : t('random.title');
    $('#vz-scene').setAttribute('aria-label', t('verstop.scene'));
    renderAsk();
    syncSpots();
  }

  function setStatus(text) {
    $('#vz-status').textContent = text;
  }

  /** Place the spots in the scene's box (again after a resize or a turn of the phone). */
  function layout() {
    if (!game || !onScreen('verstop')) return;
    const box = $('#vz-scene');
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    const pad = 6;
    const spots = spotLayout(game.round.spots.length, w - 2 * pad, h - 2 * pad, game.seed);
    const els = document.querySelectorAll('#vz-spots .vz-spot');
    spots.forEach((p, i) => {
      const b = els[i];
      if (!b) return;
      b.style.left = `${(pad + p.x - p.s / 2).toFixed(1)}px`;
      b.style.top = `${(pad + p.y - p.s / 2).toFixed(1)}px`;
      b.style.width = `${p.s.toFixed(1)}px`;
      b.style.height = `${p.s.toFixed(1)}px`;
    });
  }

  const resize = new ResizeObserver(() => layout());
  resize.observe($('#vz-scene'));

  // ---------- looking ----------

  function spotEl(i) {
    return document.querySelector(`#vz-spots .vz-spot[data-i="${i}"]`);
  }

  /** Open a spot: the creature peeks out and waves, then the spot settles back (ajar). */
  function hello(i) {
    const b = spotEl(i);
    if (!b) return;
    b.classList.remove('ajar', 'shut', 'wave', 'open');
    void b.offsetWidth; // start the wave again on a second tap
    b.classList.add('open', 'wave');
    after(WAVE_MS, () => {
      b.classList.remove('open', 'wave');
      syncSpots();
    });
  }

  function tapSpot(i) {
    if (!game || game.waiting || game.done || overlayUp()) return;
    const { round } = game;
    const r = look(round, game.play, i);
    game.play = r.play;
    const who = round.spots[i]?.who;
    if (r.result === 'none') return;
    if (r.result === 'friend' || r.result === 'lookalike') {
      sfx.plink(1 + (i % 8));
      hello(i);
      if (r.result === 'friend') setStatus(t('verstop.hi', { c: t(`verstop.the.${who.id}`) }));
      else {
        const f = round.find[0];
        setStatus(t('verstop.other', { a: t(`verstop.an.${f.id}`), f: t(`verstop.bare.${f.feature}`) }));
      }
      return;
    }
    // found, or the memory question answered
    sfx.chime();
    const b = spotEl(i);
    b?.classList.remove('ajar', 'shut', 'open');
    b?.classList.add('found');
    if (r.result === 'remembered') b?.classList.add('wave');
    syncSpots();
    renderAsk();
    if (r.result === 'found') {
      const left = stillToFind(round, game.play);
      setStatus(t('verstop.foundOne', { b: findName(round.find[left[0]]) }));
      return;
    }
    setStatus(t(r.result === 'remembered' ? 'verstop.remembered' : 'verstop.found'));
    $('#vz-stage').classList.add('happy');
    game.waiting = true;
    game.pending = r.result === 'memory' ? 'memory' : 'finish';
    after(FOUND_MS, () => (game.pending === 'memory' ? startMemory() : finish()));
  }

  /** Tier 3: every spot closes; where did that creature live? */
  function startMemory() {
    game.pending = null;
    game.waiting = false;
    $('#vz-stage').classList.remove('happy');
    for (const b of document.querySelectorAll('#vz-spots .vz-spot')) b.classList.remove('open', 'wave');
    syncSpots();
    renderAsk();
    const who = game.round.spots[game.play.ask].who;
    setStatus(t('verstop.remember', { c: t(`verstop.the.${who.id}`) }));
  }

  function finish() {
    game.pending = null;
    game.waiting = true;
    game.done = true;
    const g = game;
    const n = starsFor(g.play.extra, g.round);
    if (g.roundId) store.recordStars(meta.id, g.roundId, n);
    else store.recordRandomSolved(meta.id, g.tier);
    const names = g.round.find.map(findName);
    const buttons = [];
    let text = t('verstop.winText', { a: names.length > 1 ? t('verstop.and', { a: names[0], b: names[1] }) : names[0] });
    if (!g.roundId) {
      text = `${text} ${t('random.done', { n: randomDone()[g.tier] || 1 })}`;
      buttons.push([t('random.new'), 'big primary', () => (shell.hideOverlay(), playRandom(g.tier))]);
    } else {
      const next = nextRoundId(g.roundId);
      const np = next && parseRoundId(next);
      if (np && !locked(np.scene, np.tier)) buttons.push([t('verstop.next'), 'big primary', () => (shell.hideOverlay(), startRound(next))]);
      else if (np) {
        text = `${text} ${t('verstop.lastFree')}`;
        buttons.push([t('verstop.more'), 'big primary', () => (shell.show('verstop-menu'), offer())]);
      }
      buttons.push([t('verstop.again2'), 'big secondary', () => (shell.hideOverlay(), startRound(g.roundId))]);
    }
    buttons.push([t('verstop.rounds'), buttons.length ? 'big secondary' : 'big primary', () => shell.show('verstop-menu')]);
    shell.showOverlay({
      art: `${[0, 1, 2].map((k) => `<svg class="star ${k < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join('')}`,
      title: t(`verstop.win${n}`),
      text,
      buttons,
    });
  }

  /** The next round: the next one of this tier, then the first of the next tier, in the same place. */
  function nextRoundId(id) {
    const p = parseRoundId(id);
    if (!p) return null;
    if (p.n < ROUNDS_PER_TIER) return roundId(p.scene, p.tier, p.n + 1);
    const k = TIER_IDS.indexOf(p.tier);
    return k + 1 < TIER_IDS.length ? roundId(p.scene, TIER_IDS[k + 1], 1) : null;
  }

  return {
    async init() {
      return true;
    },
    open() {
      shell.show('verstop-menu');
    },
    leave,
    testHook() {
      return {
        state: () => {
          if (!game) return game;
          const clues = cluesOf(game.round);
          return {
            scene: game.scene,
            tier: game.tier,
            roundId: game.roundId,
            spots: game.round.spots.map((s, i) => ({ kind: s.kind, who: { ...s.who }, target: isTarget(game.round, s.who), clue: clues[i] })),
            find: game.round.find.map((f) => ({ ...f })),
            memory: game.round.memory,
            play: JSON.parse(JSON.stringify(game.play)),
            waiting: game.waiting,
            done: game.done,
            stars: starsFor(game.play.extra, game.round),
          };
        },
        start: (id) => startRound(id),
        random: (tier, scene) => playRandom(tier, scene),
        tap: (i) => tapSpot(i),
        stars: () => stars(),
      };
    },
  };
}
