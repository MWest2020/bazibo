// Piano: a toy piano with 8 coloured keys and 5 black keys.
//   Vrij spelen   every key sounds; two fingers play two keys; sliding a finger plays the keys it
//                 passes (a glissando)
//   Liedjes       play along: the next key glows and the strip above shows the notes to come in
//                 the colours of their keys; "Luister" plays the song with the keys lighting up
// The tile opens free play straight away, so a toddler is one tap from the keys. The songs and the
// rules of playing along live in songs.js (pure, tested); the sound is synthesised in
// js/audio.js (`pianoNote`), so it follows the sound setting. No voice, no recordings.
//
// Saved (games.piano): stars per song played to the end (`stars`, only ever raised).
import { meta } from './meta.js';
import { KEYS, SONGS, songById, keyById, keyFrequency, blackSlot, createRun, schedule, starsFor, KEYBOARD_MAP, WHITE_KEYS } from './songs.js';
import { cardSvg } from './art.js';
import * as store from '../../js/storage.js';
import * as sfx from '../../js/audio.js';

const $ = (sel) => document.querySelector(sel);
const STAR = '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/>';
const LOCK = '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/>';
const NOTE = '<path d="M9 17.5V5.2l11-2.4v12.1a3.2 2.6 0 1 1-2-2.4V7.1l-7 1.5v9.3a3.2 2.6 0 1 1-2-2.4z"/>';
const PLAY = '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/>';
const STOP = '<rect x="5.5" y="5.5" width="13" height="13" rx="2.5"/>';
const DONE_PAUSE = 650; // ms between the last note and the end card: let the note ring

export function createPiano(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const locked = (id) => meta.isLocked(id, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;

  let song = null; // null: free play; else the song being played along
  let run = null;
  let finishing = false; // the last note was played, the end card is coming
  let finishTimer = null;
  let listen = null; // { timers: [], step } while the listen button plays the song
  let pressed = 0; // keys pressed (also counted with the sound off: the test hook reads it)
  let heard = 0; // notes played by the listen button
  const holders = new Map(); // pointer (or computer key) -> the piano key it holds
  const keyEls = {};

  // ---------- the keyboard ----------

  const keysEl = $('#piano-keys');
  function buildKeys() {
    keysEl.textContent = '';
    keysEl.style.setProperty('--whites', WHITE_KEYS.length);
    for (const k of KEYS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pkey ${k.white ? 'white' : 'black'}`;
      b.dataset.key = k.id;
      if (k.white) {
        b.style.setProperty('--key', k.color);
        b.style.setProperty('--key-hi', mix(k.color, '#ffffff', 0.45)); // the light top of the key
        b.style.setProperty('--key-lo', mix(k.color, '#000000', 0.28)); // its darker front edge
      }
      else b.style.setProperty('--slot', blackSlot(k.id));
      b.innerHTML = '<span class="pkey-mark" aria-hidden="true"></span>';
      // pointers are handled on the whole keyboard (below); a click from a screen reader or the
      // keyboard (Enter, Space) comes with detail 0 and plays the key too
      b.addEventListener('click', (e) => {
        if (e.detail !== 0 || overlayUp()) return;
        hit(k.id, `click-${k.id}`, false);
        setTimeout(() => release(`click-${k.id}`), 180);
      });
      keyEls[k.id] = b;
      keysEl.appendChild(b);
    }
    labelKeys();
  }
  function labelKeys() {
    keysEl.setAttribute('aria-label', t('piano.keys'));
    for (const k of KEYS) keyEls[k.id].setAttribute('aria-label', t(`piano.note.${k.id}`));
  }

  const keyAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('.pkey');
    return el && keysEl.contains(el) ? el.dataset.key : null;
  };

  keysEl.addEventListener('pointerdown', (e) => {
    if (overlayUp() || e.button > 0) return;
    e.preventDefault();
    sfx.unlock();
    keysEl.setPointerCapture?.(e.pointerId); // keeps the moves coming when a finger slides off
    const key = keyAt(e.clientX, e.clientY);
    if (key) hit(key, e.pointerId, false);
    else holders.set(e.pointerId, null); // between two keys: a slide on to one still plays it
  });
  keysEl.addEventListener('pointermove', (e) => {
    if (!holders.has(e.pointerId)) return; // only a finger (or mouse button) that went down on the keys
    const key = keyAt(e.clientX, e.clientY);
    const now = holders.get(e.pointerId);
    if (key === now) return;
    release(e.pointerId, true);
    if (key) hit(key, e.pointerId, true);
    else holders.set(e.pointerId, null); // off the keys: keep following this finger
  });
  const up = (e) => release(e.pointerId);
  keysEl.addEventListener('pointerup', up);
  keysEl.addEventListener('pointercancel', up);
  keysEl.addEventListener('lostpointercapture', up);
  keysEl.addEventListener('contextmenu', (e) => e.preventDefault()); // a long press is a held key

  /** A key goes down under a pointer: it sounds, and when playing along it may move the song on. */
  function hit(key, holder, slide) {
    holders.set(holder, key);
    keyEls[key]?.classList.add('down');
    sfx.pianoNote(keyFrequency(key));
    pressed++;
    if (listen) stopListening();
    if (!song || !run || finishing || run.done) return;
    if (slide && key !== run.target()) return; // sliding over the keys never counts as a mistake
    const r = run.press(key);
    if (r === 'wrong') nudge();
    else if (r === 'right') renderSong();
    else if (r === 'done') finish();
  }

  /** A pointer lets go (or slides on to another key). */
  function release(holder, keepFollowing = false) {
    if (!holders.has(holder)) return;
    const key = holders.get(holder);
    if (keepFollowing) holders.set(holder, null);
    else holders.delete(holder);
    if (key && ![...holders.values()].includes(key)) keyEls[key]?.classList.remove('down');
  }

  function releaseAll() {
    holders.clear();
    for (const el of Object.values(keyEls)) el.classList.remove('down');
  }

  // The glowing key gives a little wiggle after a wrong key, so the eye finds it again.
  function nudge() {
    const el = keyEls[run.target()];
    if (!el) return;
    el.classList.remove('nudge');
    void el.offsetWidth; // restart the animation
    el.classList.add('nudge');
  }

  // ---------- screens ----------

  function render() {
    const free = !song;
    $('#screen-piano').dataset.mode = free ? 'free' : 'song';
    $('#piano-sub').textContent = free ? t('games.piano') : t('piano.songs');
    $('#piano-title').textContent = free ? t('piano.free') : t(`piano.song.${song.id}`);
    $('#piano-songs-btn').hidden = !free;
    $('#piano-spacer').hidden = free;
    $('#piano-songbar').hidden = free;
    renderMuted();
    renderListen();
    renderSong();
  }

  function renderMuted() {
    $('#piano-muted').hidden = !shell.isMuted();
  }

  function renderListen() {
    const b = $('#piano-listen');
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${listen ? STOP : PLAY}</svg><span></span>`;
    b.querySelector('span').textContent = t(listen ? 'piano.stop' : 'piano.listen');
    b.setAttribute('aria-label', t(listen ? 'piano.stop' : 'piano.listen'));
    b.setAttribute('aria-pressed', String(!!listen));
  }

  /** The glow on the next key and the strip of notes to come. */
  function renderSong() {
    for (const el of Object.values(keyEls)) el.classList.remove('glow', 'nudge');
    keysEl.classList.toggle('listening', !!listen);
    if (!song) return;
    const at = listen ? listen.step : run.index;
    if (!listen && !run.done) keyEls[run.target()]?.classList.add('glow');
    $('#piano-status').textContent = t(listen ? 'piano.listening' : 'piano.prompt');
    const strip = $('#piano-strip');
    strip.textContent = '';
    const fit = Math.max(4, Math.floor(((strip.clientWidth || 300) - 20) / 30));
    const from = Math.max(0, Math.min(at - 1, song.notes.length - fit));
    song.notes.slice(from, from + fit).forEach((n, k) => {
      const i = from + k;
      const d = document.createElement('span');
      d.className = `pnote${i < at ? ' past' : ''}${i === at ? ' now' : ''}${n.beats >= 2 ? ' long' : n.beats < 1 ? ' short' : ''}`;
      d.style.setProperty('--key', keyById(n.key).color);
      strip.appendChild(d);
    });
    strip.setAttribute('aria-label', t('piano.progress', { done: Math.min(run.index, song.notes.length), total: song.notes.length }));
  }

  function renderSongs() {
    const box = $('#piano-songlist');
    box.textContent = '';
    const got = stars();
    const card = (id, title, sub, isLocked, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `piano-card${isLocked ? ' locked' : ''}`;
      b.dataset.song = id;
      b.innerHTML = `<span class="piano-card-art">${cardSvg(id)}</span><span class="piano-card-text"><span class="piano-card-title"></span><span class="piano-card-sub"></span></span><span class="piano-card-end" aria-hidden="true"></span>`;
      b.querySelector('.piano-card-title').textContent = title;
      b.querySelector('.piano-card-sub').textContent = sub;
      b.querySelector('.piano-card-sub').hidden = !sub;
      const end = b.querySelector('.piano-card-end');
      if (isLocked) end.innerHTML = `<svg viewBox="0 0 24 24">${LOCK}</svg>`;
      else if (n !== null) end.innerHTML = [0, 1, 2].map((k) => `<svg class="${k < n ? 'on' : ''}" viewBox="0 0 24 24">${STAR}</svg>`).join('');
      return b;
    };
    const free = card('free', t('piano.free'), t('piano.freeSub'), false, null);
    free.setAttribute('aria-label', t('piano.free'));
    free.addEventListener('click', () => {
      tap();
      playFree();
    });
    box.appendChild(free);
    for (const s of SONGS) {
      const name = t(`piano.song.${s.id}`);
      const isLocked = locked(s.id);
      const b = card(s.id, name, '', isLocked, got[s.id] || 0);
      b.setAttribute('aria-label', isLocked ? t('piano.songLocked', { song: name }) : got[s.id] ? t('piano.songStars', { song: name, stars: got[s.id] }) : t('piano.songOpen', { song: name }));
      b.addEventListener('click', () => {
        tap();
        choose(s.id);
      });
      box.appendChild(b);
    }
  }

  function playFree() {
    stopListening();
    clearFinish();
    song = null;
    run = null;
    shell.show('piano');
    render();
  }

  function choose(id) {
    const s = songById(id);
    if (!s) return;
    if (locked(id)) {
      shell.offerUnlock(t('piano.lockedLead'));
      return;
    }
    stopListening();
    clearFinish();
    song = s;
    run = createRun(s);
    shell.show('piano');
    render();
  }

  function showSongs() {
    stopListening();
    clearFinish();
    shell.show('piano-songs');
  }

  /** The back arrow (and the Android back button) on the piano: a song goes to the list, free play home. */
  function back() {
    if (song) showSongs();
    else shell.show('home');
  }

  // ---------- listening ----------

  function startListening() {
    if (!song) return;
    stopListening();
    clearFinish();
    run.restart(); // listen first, then play it yourself from the start
    const steps = schedule(song);
    listen = { timers: [], step: 0 };
    const me = listen;
    steps.forEach((st, i) => {
      me.timers.push(
        setTimeout(() => {
          if (listen !== me) return;
          listen.step = i;
          const el = keyEls[st.key];
          el?.classList.add('lit');
          sfx.pianoNote(keyFrequency(st.key));
          heard++;
          renderSong();
          me.timers.push(setTimeout(() => el?.classList.remove('lit'), st.hold));
        }, st.at + 250),
      );
    });
    const last = steps[steps.length - 1];
    me.timers.push(
      setTimeout(() => {
        if (listen === me) stopListening();
      }, last.at + 250 + last.hold + 300),
    );
    renderListen();
    renderSong();
  }

  function stopListening() {
    if (!listen) return;
    for (const id of listen.timers) clearTimeout(id);
    listen = null;
    for (const el of Object.values(keyEls)) el.classList.remove('lit');
    if (onScreen('piano')) {
      renderListen();
      renderSong();
    }
  }

  $('#piano-listen').addEventListener('click', () => {
    if (overlayUp()) return;
    sfx.unlock();
    if (listen) stopListening();
    else startListening();
  });

  // ---------- the end of a song ----------

  function clearFinish() {
    if (finishTimer) clearTimeout(finishTimer);
    finishTimer = null;
    finishing = false;
  }

  function finish() {
    finishing = true;
    renderSong();
    const s = song;
    const n = starsFor(run.misses);
    store.recordStars(meta.id, s.id, n);
    finishTimer = setTimeout(() => {
      finishTimer = null;
      if (song !== s || !onScreen('piano')) return;
      sfx.chime();
      const k = SONGS.indexOf(s);
      const next = SONGS[k + 1] || null;
      const buttons = [];
      let text = t('piano.winText', { song: t(`piano.song.${s.id}`) });
      if (next && !locked(next.id)) buttons.push([t('piano.next'), 'big primary', () => choose(next.id)]);
      else if (next) {
        text = `${text} ${t('piano.lastFree')}`;
        buttons.push([t('piano.more'), 'big primary', () => (showSongs(), shell.offerUnlock(t('piano.lockedLead')))]);
      }
      buttons.push([t('piano.again'), buttons.length ? 'big secondary' : 'big primary', () => choose(s.id)]);
      buttons.push([t('piano.songs'), 'big secondary', showSongs]);
      shell.showOverlay({
        art: [0, 1, 2].map((i) => `<svg class="star ${i < n ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`).join(''),
        title: t(`piano.win${n}`),
        text,
        buttons,
      });
    }, DONE_PAUSE);
  }

  // ---------- wiring ----------

  $('#piano-back').addEventListener('click', () => {
    tap();
    back();
  });
  $('#piano-songs-btn').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${NOTE}</svg><span data-i18n="piano.songs"></span>`;
  $('#piano-songs-btn').addEventListener('click', () => {
    tap();
    showSongs();
  });
  $('#piano-songs-back').addEventListener('click', () => {
    tap();
    playFree();
  });
  $('#piano-sound-on').addEventListener('click', () => {
    sfx.unlock();
    shell.setMuted(false);
    tap();
  });
  shell.onMutedChange(() => onScreen('piano') && renderMuted());
  shell.unlock.onChange(() => {
    if (onScreen('piano-songs')) renderSongs();
  });
  shell.onShow((name) => {
    if (name === 'piano-songs') renderSongs();
    if (name !== 'piano') {
      stopListening();
      releaseAll();
    }
  });
  shell.onLangChange(() => {
    labelKeys();
    $('#piano-songs-btn span').textContent = t('piano.songs');
    if (onScreen('piano-songs')) renderSongs();
    if (onScreen('piano')) render();
  });
  window.addEventListener('resize', () => onScreen('piano') && song && renderSong());

  // A computer keyboard plays too: A S D F G H J K for the coloured keys, W E T Y U for the black.
  document.addEventListener('keydown', (e) => {
    if (!onScreen('piano') || overlayUp() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = KEYBOARD_MAP[e.key.toLowerCase()];
    if (!key) return;
    e.preventDefault();
    sfx.unlock();
    hit(key, `kb-${e.key.toLowerCase()}`, false);
  });
  document.addEventListener('keyup', (e) => release(`kb-${e.key.toLowerCase()}`));

  buildKeys();
  $('#piano-songs-btn span').textContent = t('piano.songs');

  return {
    async init() {
      return true; // everything is made in code; nothing to load
    },
    open() {
      playFree();
    },
    back,
    /** The Android back button on the song list: back to free play. */
    songsBack() {
      playFree();
    },
    /** The Android back button over the end card: to the song list. */
    toSongs() {
      showSongs();
    },
    testHook() {
      return {
        state: () => ({
          mode: song ? 'song' : 'free',
          song: song?.id || null,
          index: run ? run.index : null,
          length: song ? song.notes.length : null,
          target: run ? run.target() : null,
          misses: run ? run.misses : null,
          done: run ? run.done : null,
          listening: !!listen,
          listenStep: listen ? listen.step : null,
          pressed,
          heard,
          down: Object.keys(keyEls).filter((k) => keyEls[k].classList.contains('down')),
          lit: Object.keys(keyEls).filter((k) => keyEls[k].classList.contains('lit')),
          glow: Object.keys(keyEls).filter((k) => keyEls[k].classList.contains('glow')),
        }),
        choose: (id) => choose(id),
        free: () => playFree(),
        press: (key) => {
          hit(key, `hook-${key}`, false);
          release(`hook-${key}`);
        },
        listen: () => startListening(),
        stop: () => stopListening(),
        stars: () => stars(),
      };
    },
  };
}

/** `a` moved a fraction `f` towards `b` (both #rrggbb). */
function mix(a, b, f) {
  const c = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * f).toString(16).padStart(2, '0')).join('')}`;
}
