// Drumstel: a colourful drum kit with 8 pads (kick, snare, hi-hat, three toms, crash and ride).
//   Vrij spelen   every pad sounds; two fingers hit two pads at once
//   Ritmes        play along: after a count-in ("1 2 3 4") the next pad glows on its beat. For 4-6 the
//                 rhythm waits for the child (only the order counts); for 7-10 it runs on and a step
//                 counts when it is hit on the beat (a ring closes in on the pad). "Luister" plays the
//                 rhythm with the pads lighting up.
// The tile opens free play straight away. The rhythms and the rules of playing along live in kit.js
// (pure, tested); the sound is synthesised in sound.js and follows the app's sound setting. No
// voice, no recordings.
//
// Saved (games.drums): stars per rhythm played to the end (`stars`, only ever raised).
import { meta } from './meta.js';
import { PADS, LEVELS, RHYTHMS, SHAPES, kitShape, rhythmById, levelOf, schedule, beatMs, createRun, starsFor, timedStars, COUNT_IN, KEYBOARD_MAP } from './kit.js';
import { padSvg, padGlyph, cardSvg } from './art.js';
import * as sound from './sound.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const DRUM = '<path d="M12 4c5 0 9 1.6 9 3.6v8.8C21 18.4 17 20 12 20s-9-1.6-9-3.6V7.6C3 5.6 7 4 12 4zm0 2C8 6 5 7 5 7.6S8 9.2 12 9.2s7-1 7-1.6S16 6 12 6z"/>';
const PLAY = '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/>';
const STOP = '<rect x="5.5" y="5.5" width="13" height="13" rx="2.5"/>';
const DONE_PAUSE = 700; // ms between the last hit and the end card: let the cymbal ring
const now = () => performance.now();

export function createDrums(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const locked = (id) => meta.isLocked(id, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;

  let rhythm = null; // null: free play; else the rhythm being played along
  let run = null;
  // free | ready (Begin shows) | count (the count-in) | play | done (the end card is coming)
  let phase = 'free';
  let timer = null; // the next moment the glow, the count or a miss changes
  let finishTimer = null;
  let listen = null; // { timers: [], step, count } while the listen button plays the rhythm
  let shownCount = 0;
  let glowIndex = -1; // the step whose glow is showing (its ring animation restarts per step)
  let hits = 0; // pads hit (also counted with the sound off: the test hook reads it)
  let heard = 0; // steps played by the listen button
  const holders = new Map(); // pointer (or computer key) -> the pad it holds
  const padEls = {};

  // ---------- the kit ----------

  const stage = $('#drums-stage');
  const kitEl = $('#drums-kit');
  function buildKit() {
    kitEl.textContent = '';
    for (const p of PADS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `dpad ${p.kind}`;
      b.dataset.pad = p.id;
      b.style.gridArea = p.id;
      b.innerHTML = `<span class="dpad-face">${padSvg(p.id)}<span class="dpad-ring" aria-hidden="true"></span></span>`;
      // pointers are handled on the whole kit (below); a click from a screen reader or the keyboard
      // (Enter, Space) comes with detail 0 and hits the pad too
      b.addEventListener('click', (e) => {
        if (e.detail !== 0 || overlayUp()) return;
        sound.unlock();
        hit(p.id, `click-${p.id}`);
        setTimeout(() => release(`click-${p.id}`), 150);
      });
      padEls[p.id] = b;
      kitEl.appendChild(b);
    }
    labelPads();
  }
  function labelPads() {
    kitEl.setAttribute('aria-label', t('drums.kit'));
    for (const p of PADS) padEls[p.id].setAttribute('aria-label', t(`drums.pad.${p.id}`));
  }

  /** Four across on a wide stage, two across on a tall one; the drawn drum fits its cell. */
  function layout() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const name = kitShape(r.width, r.height);
    const shape = SHAPES[name];
    kitEl.dataset.shape = name;
    kitEl.style.gridTemplateColumns = `repeat(${shape.cols}, minmax(0, 1fr))`;
    kitEl.style.gridTemplateRows = `repeat(${shape.rows}, minmax(0, 1fr))`;
    kitEl.style.gridTemplateAreas = shape.areas.map((row) => `"${row.join(' ')}"`).join(' ');
    const k = kitEl.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(kitEl).rowGap) || 0;
    const cw = (k.width - gap * (shape.cols - 1)) / shape.cols;
    const ch = (k.height - gap * (shape.rows - 1)) / shape.rows;
    kitEl.style.setProperty('--cell', `${Math.max(0, Math.floor(Math.min(cw, ch)))}px`);
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => onScreen('drums') && layout()).observe(stage);

  kitEl.addEventListener('pointerdown', (e) => {
    if (overlayUp() || e.button > 0) return;
    const el = e.target.closest?.('.dpad');
    if (!el || !kitEl.contains(el)) return;
    e.preventDefault();
    sound.unlock();
    kitEl.setPointerCapture?.(e.pointerId); // the lift always comes back here, wherever the finger went
    hit(el.dataset.pad, e.pointerId, eventTime(e));
  });
  const up = (e) => {
    if (e.type === 'pointerup') sound.unlock(); // WebKit counts a lift (not a press) as the gesture
    release(e.pointerId);
  };
  kitEl.addEventListener('pointerup', up);
  kitEl.addEventListener('pointercancel', up);
  kitEl.addEventListener('lostpointercapture', up);
  kitEl.addEventListener('contextmenu', (e) => e.preventDefault()); // a long press is just a held pad

  /**
   * When the finger touched, on the clock the rhythm runs on (`performance.now()`): the event's own
   * time stamp, so a busy page or a slow frame never makes a hit late. Judging is against the
   * picture, not the sound: the child aims at the ring closing in on the pad, which the screen
   * shows on time, so the audio output latency (`outputLatency`, often 20-100 ms on phones) does
   * not move the windows. Only the listen button's sound arrives that much after its light.
   */
  function eventTime(e) {
    const at = now();
    const ts = e?.timeStamp;
    return ts > 0 && ts <= at && at - ts < 500 ? ts : at;
  }

  /** A pad is hit: it sounds and bounces, and when playing along it may count. */
  function hit(pad, holder, at = now()) {
    holders.set(holder, pad);
    const el = padEls[pad];
    if (!el) return;
    el.classList.add('down');
    restartClass(el, 'hit');
    sound.hit(pad);
    hits++;
    if (listen) {
      stopListening(); // a tap stops the listening; the child plays from Begin
      return;
    }
    if (!rhythm || !run || (phase !== 'count' && phase !== 'play')) return;
    const r = run.press(pad, at);
    if (r === 'wrong') nudge();
    else if (r === 'step' || r === 'part') restartClass(el, 'good');
    else if (r === 'done') {
      restartClass(el, 'good');
      finish();
      return;
    }
    frame();
  }

  function release(holder) {
    if (!holders.has(holder)) return;
    const pad = holders.get(holder);
    holders.delete(holder);
    if (pad && ![...holders.values()].includes(pad)) padEls[pad]?.classList.remove('down');
  }

  function releaseAll() {
    holders.clear();
    for (const el of Object.values(padEls)) el.classList.remove('down');
  }

  function restartClass(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation
    el.classList.add(cls);
  }

  // The glowing pad gives a little wiggle after a wrong pad, so the eye finds it again.
  function nudge() {
    for (const pad of run.glow(now())) restartClass(padEls[pad], 'nudge');
  }

  // ---------- playing along ----------

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  /** Back to the start of the rhythm, waiting for Begin (after listening, leaving or the background). */
  function toReady() {
    clearTimer();
    if (!rhythm) return;
    run = createRun(rhythm, { timed: levelOf(rhythm).timed });
    phase = 'ready';
    glowIndex = -1;
    showCount(0);
  }

  function startRun() {
    if (!rhythm) return;
    stopListening();
    clearFinish();
    toReady();
    run.start(now());
    phase = 'count';
    render();
    frame();
  }

  /** Bring the screen up to date with the clock, and wake up again at the next change. */
  function frame() {
    clearTimer();
    if (!run || !run.started || (phase !== 'count' && phase !== 'play')) return;
    const at = now();
    const c = run.countAt(at);
    if (c !== shownCount) {
      if (c) sound.hit('sticks');
      showCount(c);
    }
    if (!c && phase === 'count') {
      phase = 'play';
      renderStatus();
    }
    const missed = run.update(at);
    if (run.done) {
      finish();
      return;
    }
    renderGlow(at);
    if (missed.length) renderStrip();
    const next = run.nextChange(at);
    if (next !== null) timer = setTimeout(frame, Math.max(0, next - at) + 2);
  }

  function showCount(c) {
    shownCount = c;
    const el = $('#drums-count');
    el.hidden = !c;
    if (c) {
      el.textContent = String(c);
      restartClass(el, 'pop');
    }
  }

  /** The glow on the next pad(s); on the beat a ring closes in on them until their beat. */
  function renderGlow(at = now()) {
    const pads = run && (phase === 'play' || phase === 'count') ? run.glow(at) : []; // on the beat the first ring starts on "4"
    const fresh = run && run.index !== glowIndex;
    for (const p of PADS) {
      const el = padEls[p.id];
      const on = pads.includes(p.id);
      if (!on) el.classList.remove('glow');
      else if (fresh || !el.classList.contains('glow')) {
        el.style.setProperty('--lead', `${Math.round(run.lead(at))}ms`);
        restartClass(el, 'glow');
      }
    }
    kitEl.classList.toggle('timed', !!run?.timed);
    if (pads.length && fresh) {
      glowIndex = run.index;
      renderStrip();
    }
  }

  // ---------- screens ----------

  function render() {
    const free = !rhythm;
    $('#screen-drums').dataset.mode = free ? 'free' : 'rhythm';
    $('#drums-sub').textContent = free ? t('games.drums') : t(`drums.age.${rhythm.level}`);
    $('#drums-title').textContent = free ? t('drums.free') : t(`drums.rhythm.${rhythm.id}`);
    $('#drums-list-btn').hidden = !free;
    $('#drums-spacer').hidden = free;
    $('#drums-bar').hidden = free;
    renderMuted();
    renderListen();
    renderGo();
    renderGlow();
    renderStrip();
    renderStatus();
    if (onScreen('drums')) layout();
  }

  function renderMuted() {
    $('#drums-muted').hidden = !shell.isMuted();
  }

  function renderListen() {
    const b = $('#drums-listen');
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${listen ? STOP : PLAY}</svg><span></span>`;
    b.querySelector('span').textContent = t(listen ? 'drums.stop' : 'drums.listen');
    b.setAttribute('aria-label', t(listen ? 'drums.stop' : 'drums.listen'));
    b.setAttribute('aria-pressed', String(!!listen));
  }

  function renderGo() {
    const b = $('#drums-go');
    b.hidden = !rhythm || phase !== 'ready' || !!listen;
    b.querySelector('span').textContent = t('drums.go');
  }

  function renderStatus() {
    if (!rhythm) return;
    const key = listen ? 'drums.listening' : phase === 'ready' ? 'drums.ready' : phase === 'count' ? 'drums.counting' : phase === 'play' ? (run.timed ? 'drums.promptBeat' : 'drums.prompt') : null;
    $('#drums-status').textContent = key ? t(key) : '';
  }

  /** The strip of steps to come, each as the sign of its pad(s). */
  function renderStrip() {
    if (!rhythm) return;
    const strip = $('#drums-strip');
    strip.textContent = '';
    const steps = rhythm.steps;
    const at = listen ? Math.max(0, listen.step) : run ? run.index : 0;
    const fit = Math.max(4, Math.floor(((strip.clientWidth || 300) - 24) / 32));
    const from = Math.max(0, Math.min(at - 1, steps.length - fit));
    steps.slice(from, from + fit).forEach((s, k) => {
      const i = from + k;
      const d = document.createElement('span');
      const st = !listen && run ? run.stepState(i) : i < at ? 'hit' : 'todo';
      d.className = `dstep${s.pads.length > 1 ? ' two' : ''}${i < at ? ' past' : ''}${i === at ? ' now' : ''}${st === 'miss' ? ' miss' : ''}`;
      d.innerHTML = s.pads.map(padGlyph).join('');
      strip.appendChild(d);
    });
    strip.setAttribute('aria-label', t('drums.progress', { done: Math.min(run ? run.index : 0, steps.length), total: steps.length }));
  }

  function renderList() {
    const box = $('#drums-list');
    box.textContent = '';
    const got = stars();
    const card = (id, title, sub, isLocked, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `drums-card${isLocked ? ' locked' : ''}`;
      b.dataset.rhythm = id;
      b.innerHTML = `<span class="drums-card-art">${cardSvg(id)}</span><span class="drums-card-text"><span class="drums-card-title"></span><span class="drums-card-sub"></span></span><span class="drums-card-end" aria-hidden="true"></span>`;
      b.querySelector('.drums-card-title').textContent = title;
      b.querySelector('.drums-card-sub').textContent = sub;
      b.querySelector('.drums-card-sub').hidden = !sub;
      const end = b.querySelector('.drums-card-end');
      if (isLocked) end.innerHTML = `<svg viewBox="0 0 24 24">${LOCK}</svg>`;
      else if (n !== null) end.innerHTML = [0, 1, 2].map((k) => `<svg class="${k < n ? 'on' : ''}" viewBox="0 0 24 24">${STAR}</svg>`).join('');
      return b;
    };
    const free = card('free', t('drums.free'), t('drums.freeSub'), false, null);
    free.setAttribute('aria-label', t('drums.free'));
    free.addEventListener('click', () => {
      tap();
      playFree();
    });
    box.appendChild(free);
    for (const level of LEVELS) {
      const h = document.createElement('h3');
      h.className = 'drums-level';
      h.textContent = t(`drums.level.${level.id}`);
      box.appendChild(h);
      for (const r of level.rhythms) {
        const name = t(`drums.rhythm.${r.id}`);
        const isLocked = locked(r.id);
        const b = card(r.id, name, '', isLocked, got[r.id] || 0);
        b.setAttribute('aria-label', isLocked ? t('drums.rhythmLocked', { rhythm: name }) : got[r.id] ? t('drums.rhythmStars', { rhythm: name, stars: got[r.id] }) : t('drums.rhythmOpen', { rhythm: name }));
        b.addEventListener('click', () => {
          tap();
          choose(r.id);
        });
        box.appendChild(b);
      }
    }
  }

  function stopAll() {
    stopListening();
    clearFinish();
    clearTimer();
    showCount(0);
  }

  function playFree() {
    sound.unlock(); // inside the tile's or the card's click: on iOS the first sound needs a gesture
    stopAll();
    rhythm = null;
    run = null;
    phase = 'free';
    shell.show('drums');
    render();
  }

  function choose(id, { go = false } = {}) {
    const r = rhythmById(id);
    if (!r) return;
    if (locked(id)) {
      shell.offerUnlock(t('drums.lockedLead'));
      return;
    }
    sound.unlock();
    stopAll();
    rhythm = r;
    toReady();
    shell.show('drums');
    render();
    if (go) startRun();
  }

  function showList() {
    stopAll();
    if (rhythm) toReady();
    shell.show('drums-list');
  }

  /** The back arrow (and the Android back button) on the kit: a rhythm goes to the list, free play home. */
  function back() {
    if (rhythm) showList();
    else shell.show('home');
  }

  // ---------- listening ----------

  function startListening() {
    if (!rhythm) return;
    stopListening();
    clearFinish();
    toReady(); // listen first, then play it yourself from Begin
    const beat = beatMs(rhythm);
    const steps = schedule(rhythm);
    listen = { timers: [], step: -1 };
    const me = listen;
    const later = (ms, fn) => me.timers.push(setTimeout(() => listen === me && fn(), ms));
    // the count-in first: four clicks of the sticks, the numbers on the kit
    for (let c = 1; c <= COUNT_IN; c++) {
      later(200 + (c - 1) * beat, () => {
        sound.hit('sticks');
        showCount(c);
      });
    }
    const from = 200 + COUNT_IN * beat;
    steps.forEach((st, i) => {
      later(from + st.at, () => {
        if (i === 0) showCount(0);
        listen.step = i;
        for (const pad of st.pads) {
          padEls[pad]?.classList.add('lit');
          restartClass(padEls[pad], 'hit');
          sound.hit(pad);
        }
        heard++;
        renderStrip();
        me.timers.push(setTimeout(() => st.pads.forEach((pad) => padEls[pad]?.classList.remove('lit')), st.hold));
      });
    });
    const last = steps[steps.length - 1];
    later(from + last.at + last.hold + 400, stopListening);
    render();
  }

  function stopListening() {
    if (!listen) return;
    for (const id of listen.timers) clearTimeout(id);
    listen = null;
    for (const el of Object.values(padEls)) el.classList.remove('lit');
    showCount(0);
    if (onScreen('drums')) render();
  }

  $('#drums-listen').addEventListener('click', () => {
    if (overlayUp()) return;
    sound.unlock();
    if (listen) stopListening();
    else startListening();
  });
  $('#drums-go').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${PLAY}</svg><span></span>`;
  $('#drums-go').addEventListener('click', () => {
    if (overlayUp()) return;
    sound.unlock();
    startRun();
  });

  // ---------- the end of a rhythm ----------

  function clearFinish() {
    if (finishTimer) clearTimeout(finishTimer);
    finishTimer = null;
  }

  function finish() {
    clearTimer();
    phase = 'done';
    renderGlow();
    renderStrip();
    renderStatus();
    const r = rhythm;
    const timed = run.timed;
    const n = timed ? timedStars(run.good, run.total) : starsFor(run.misses);
    const good = run.good;
    const total = run.total;
    if (n > 0) store.recordStars(meta.id, r.id, n);
    finishTimer = setTimeout(() => {
      finishTimer = null;
      if (rhythm !== r || !onScreen('drums')) return;
      if (n > 0) sfx.chime();
      const list = levelOf(r).rhythms;
      const next = list[list.indexOf(r) + 1] || null;
      const buttons = [];
      const beatText = timed ? t('drums.beatText', { good, total }) : '';
      let text = n > 0 ? [t('drums.winText', { rhythm: t(`drums.rhythm.${r.id}`) }), beatText].filter(Boolean).join(' ') : `${beatText} ${t('drums.tryText')}`;
      if (n > 0 && next && !locked(next.id)) buttons.push([t('drums.next'), 'big primary', () => choose(next.id)]);
      else if (n > 0 && next) {
        text = `${text} ${t('drums.lastFree')}`;
        buttons.push([t('drums.more'), 'big primary', () => (showList(), shell.offerUnlock(t('drums.lockedLead')))]);
      }
      buttons.push([t('drums.again'), buttons.length ? 'big secondary' : 'big primary', () => choose(r.id, { go: true })]);
      buttons.push([t('drums.rhythms'), 'big secondary', showList]);
      shell.showOverlay({
        art: [0, 1, 2].map((i) => `<svg class="star ${i < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
        title: t(`drums.win${n}`),
        text,
        buttons,
      });
    }, DONE_PAUSE);
  }

  // ---------- wiring ----------

  $('#drums-back').addEventListener('click', () => {
    tap();
    back();
  });
  $('#drums-list-btn').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${DRUM}</svg><span></span>`;
  $('#drums-list-btn').addEventListener('click', () => {
    tap();
    showList();
  });
  $('#drums-list-back').addEventListener('click', () => {
    tap();
    playFree();
  });
  $('#drums-sound-on').addEventListener('click', () => {
    sound.unlock();
    shell.setMuted(false);
    tap();
  });
  shell.onMutedChange(() => {
    sound.followMute();
    if (onScreen('drums')) renderMuted();
  });
  shell.unlock.onChange(() => {
    if (onScreen('drums-list')) renderList();
  });
  shell.onShow((name) => {
    if (name === 'drums-list') renderList();
    if (name !== 'drums') {
      stopListening();
      releaseAll();
      if (phase === 'count' || phase === 'play') toReady();
    } else requestAnimationFrame(layout);
  });
  shell.onLangChange(() => {
    labelPads();
    $('#drums-list-btn span').textContent = t('drums.rhythms');
    if (onScreen('drums-list')) renderList();
    if (onScreen('drums')) render();
  });
  window.addEventListener('resize', () => {
    if (!onScreen('drums')) return;
    layout();
    renderStrip();
  });
  // the app goes to the background (home button, a call): the rhythm stops and waits for Begin,
  // listening stops and no pad stays down, like the pause in Bubbels and the piano
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    stopListening();
    releaseAll();
    sound.suspend(); // the next touch wakes it
    if (phase === 'count' || phase === 'play') {
      toReady();
      if (onScreen('drums')) render();
    }
  });

  // A computer keyboard plays too: k s h c r and 1 2 3 (KEYBOARD_MAP in kit.js).
  document.addEventListener('keydown', (e) => {
    if (!onScreen('drums') || overlayUp() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const pad = KEYBOARD_MAP[e.key.toLowerCase()];
    if (!pad) return;
    e.preventDefault();
    sound.unlock();
    hit(pad, `kb-${e.key.toLowerCase()}`, eventTime(e));
  });
  document.addEventListener('keyup', (e) => release(`kb-${e.key.toLowerCase()}`));

  buildKit();
  $('#drums-list-btn span').textContent = t('drums.rhythms');

  return {
    async init() {
      return true; // everything is made in code; nothing to load
    },
    open() {
      playFree();
    },
    back,
    /** The Android back button on the rhythm list: back to free play. */
    listBack() {
      playFree();
    },
    /** The Android back button over the end card: to the rhythm list. */
    toList() {
      showList();
    },
    testHook() {
      const has = (cls) => Object.keys(padEls).filter((k) => padEls[k].classList.contains(cls));
      return {
        state: () => ({
          mode: rhythm ? 'rhythm' : 'free',
          rhythm: rhythm?.id || null,
          timed: run ? run.timed : null,
          phase,
          index: run ? run.index : null,
          length: rhythm ? rhythm.steps.length : null,
          target: run ? run.target() : null,
          misses: run ? run.misses : null,
          good: run ? run.good : null,
          done: run ? run.done : null,
          dueIn: run && run.started && !run.done ? run.due(run.index) - now() : null,
          count: shownCount,
          listening: !!listen,
          listenStep: listen ? listen.step : null,
          hits,
          heard,
          shape: kitEl.dataset.shape || null,
          down: has('down'),
          lit: has('lit'),
          glow: has('glow'),
        }),
        choose: (id) => choose(id),
        free: () => playFree(),
        start: () => startRun(),
        press: (pad) => {
          hit(pad, `hook-${pad}`);
          release(`hook-${pad}`);
        },
        listen: () => startListening(),
        stop: () => stopListening(),
        stars: () => stars(),
        rhythms: () => RHYTHMS.map((r) => r.id),
      };
    },
  };
}
