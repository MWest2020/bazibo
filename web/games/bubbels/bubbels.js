// Bubbels, the bubble shooter: level select, the board's overlays and the HUD. The game logic
// lives in game.js; the shell (web/js/main.js) owns the overlay card, sound settings and the
// purchase, and passes them in as `shell`.
import { Game } from './game.js';
import { loadLevels } from './levels.js';
import { meta } from './meta.js';
import * as store from '../../js/storage.js';
import { isLocked, allFreeDone } from '../../js/unlock.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';

export function createBubbels(shell) {
  const { t, tap } = shell;
  const progress = store.loadProgress(meta.id);
  let levels = [];
  let index = 0; // index into levels of the level being played
  let game = null;

  const locked = (id) => isLocked(id, meta.free, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');

  shell.unlock.onChange(() => {
    if (onScreen('levels')) renderLevels();
  });
  shell.onShow((name) => {
    if (game) game.active = name === 'game';
    if (name === 'game') requestAnimationFrame(() => game.resize());
    if (name === 'levels') renderLevels();
  });
  shell.onLangChange(() => {
    if (onScreen('levels')) renderLevels();
    if (levels[index]) $('#hud-level').textContent = t('bubbels.level', { n: levels[index].id });
    renderMute();
  });

  // ---------- level select ----------

  const nextOpenIndex = () => levels.findIndex((l) => !progress.stars[l.id] && !locked(l.id));

  $('#btn-play').addEventListener('click', () => {
    tap();
    const i = nextOpenIndex();
    play(i >= 0 ? i : 0);
  });

  function starsText(n) {
    return [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
  }

  function renderLevels() {
    const free = $('#levels-free');
    const full = $('#levels-full');
    free.textContent = '';
    full.textContent = '';
    $('.full-divider').hidden = shell.unlock.owned;
    const nextOpen = levels[nextOpenIndex()];
    levels.forEach((l, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'level-btn';
      if (locked(l.id)) {
        b.innerHTML = `<span class="num">${l.id}</span><svg viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
        b.setAttribute('aria-label', t('bubbels.levelLocked', { n: l.id }));
        b.addEventListener('click', () => {
          tap();
          offer();
        });
        full.appendChild(b);
      } else {
        const stars = progress.stars[l.id] || 0;
        if (nextOpen && nextOpen.id === l.id) b.classList.add('next');
        b.innerHTML = `<span class="num">${l.id}</span><span class="stars" aria-hidden="true">${starsText(stars)}</span>`;
        b.setAttribute('aria-label', t('bubbels.levelStars', { n: l.id, stars }));
        b.addEventListener('click', () => {
          tap();
          play(i);
        });
        free.appendChild(b);
      }
    });
  }

  /** The app-wide offer, with a line about which levels it opens here. */
  function offer() {
    shell.offerUnlock(t('bubbels.lockedLead', { from: meta.free + 1, to: levels.length || 30 }));
  }

  // ---------- playing ----------

  function play(i) {
    const level = levels[i];
    if (!level) return;
    if (locked(level.id)) {
      offer();
      return;
    }
    index = i;
    $('#hud-level').textContent = t('bubbels.level', { n: level.id });
    shell.show('game');
    game.start(level);
  }

  function onWin({ stars, score }) {
    const level = levels[index];
    progress.stars[level.id] = Math.max(stars, progress.stars[level.id] || 0);
    store.saveProgress(meta.id, progress);
    const next = levels[index + 1];
    const buttons = [];
    let text = t('bubbels.points', { score });
    if (next && !locked(next.id)) {
      buttons.push([t('bubbels.next'), 'big primary', () => play(index + 1)]);
    } else if (next) {
      // the end of the free part: the next step is the offer (the buy button sits behind the gate)
      text = allFreeDone(levels, progress.stars, meta.free) ? t('bubbels.allFree', { score }) : t('bubbels.lastFree', { score });
      buttons.push([t('bubbels.more'), 'big primary', offer]);
    } else {
      buttons.push([t('bubbels.levels'), 'big primary', () => shell.show('levels')]);
    }
    buttons.push([t('bubbels.again'), 'big secondary', () => play(index)]);
    shell.showOverlay({
      art: [0, 1, 2].map((k) => `<svg class="star ${k < stars ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
      title: t(`bubbels.win${stars}`),
      text,
      buttons,
    });
  }

  function onLose() {
    shell.showOverlay({
      title: t('bubbels.loseTitle'),
      text: t('bubbels.loseText'),
      buttons: [
        [t('bubbels.again'), 'big primary', () => play(index)],
        [t('bubbels.levels'), 'big secondary', () => shell.show('levels')],
      ],
    });
  }

  function pause() {
    if (!game || !game.active || game.phase === 'won' || game.phase === 'lost' || game.paused) return;
    game.paused = true;
    shell.showOverlay({
      title: t('bubbels.pause'),
      buttons: [
        [t('bubbels.resume'), 'big primary', resume],
        [t('bubbels.restart'), 'big secondary', () => play(index)],
        [t('bubbels.levels'), 'big secondary', () => shell.show('levels')],
      ],
    });
  }

  function resume() {
    shell.hideOverlay();
    if (game) game.paused = false;
  }

  // ---------- HUD ----------

  $('#btn-pause').addEventListener('click', () => {
    tap();
    pause();
  });

  function renderMute() {
    const b = $('#btn-mute');
    const muted = shell.isMuted();
    b.setAttribute('aria-pressed', String(muted));
    b.setAttribute('aria-label', muted ? t('bubbels.soundOn') : t('bubbels.soundOff'));
  }
  $('#btn-mute').addEventListener('click', () => {
    shell.setMuted(!shell.isMuted());
    tap();
  });
  shell.onMutedChange(renderMute);
  renderMute();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  document.addEventListener('keydown', (e) => {
    if (!onScreen('game')) return;
    if (e.key === 'Escape' || e.key === 'p') {
      if (game?.paused) resume();
      else pause();
    }
  });

  return {
    open() {
      shell.show('levels');
    },
    /** Load the levels; false (after showing a card) if that failed. */
    async init() {
      game = new Game($('#game'), {
        onWin,
        onLose,
        onScore: (s) => ($('#hud-score').textContent = String(s)),
        hintText: () => t('bubbels.hint'),
      });
      try {
        levels = await loadLevels();
        return true;
      } catch (err) {
        console.error(err);
        shell.showOverlay({ title: t('error.title'), text: t('bubbels.loadError'), buttons: [[t('error.retry'), 'big primary', () => location.reload()]] });
        return false;
      }
    },
    testHook() {
      return {
        state: () => ({ ...game.snapshot(), loop: game.running }),
        fire: (deg) => game.fire((deg * Math.PI) / 180),
        play: (i) => play(i),
        locked: () => offer(),
        win: (stars = 3) => onWin({ stars, score: 100 }),
        setIndex: (i) => (index = i),
      };
    },
  };
}
