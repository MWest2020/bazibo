// Piano: a toy piano with 8 coloured keys and 5 black keys (4-6), or two octaves (7-10).
//   Vrij spelen   every key sounds; two fingers play two keys; sliding a finger plays the keys it
//                 passes (a glissando)
//   Liedjes       play along: the next key glows and the strip above shows the notes to come in
//                 the colours of their keys; "Luister" plays the song with the keys lighting up
// The tile opens free play straight away, so a toddler is one tap from the keys. The age is picked
// at the top of the song list and kept. The 7-10 piano has 15 coloured keys: when they do not all
// fit 44 px wide (an upright phone), it shows a window of 7 to 14 of them, a little map of the
// whole keyboard above it moves the window (fingers on the keys only play), playing along moves
// it to the keys to come, and a line asks to turn the phone. The songs and the rules of playing
// along live in songs.js (pure, tested); the sound is synthesised in js/audio.js (`pianoNote`), so
// it follows the sound setting. No voice, no recordings.
//
// Saved (games.piano): stars per song played to the end (`stars`, only ever raised) and the age
// picked (`level`: 'small' or 'big').
import { meta } from './meta.js';
import { LEVELS, levelById, songById, songsFor, createRun, schedule, starsFor, followView } from './songs.js';
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
const MIN_KEY = 46; // px: the narrowest a coloured key of the 7-10 piano gets (44 and its gap)
const MIN_VISIBLE = 7; // the window never shows fewer coloured keys (an octave, nearly)

export function createPiano(shell) {
  const { t, tap } = shell;
  const stars = () => store.loadProgress(meta.id).stars;
  const locked = (id) => meta.isLocked(id, shell.unlock.owned);
  const onScreen = (name) => $(`#screen-${name}`).classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;

  let level = levelById(store.loadGameOption(meta.id, 'level', 'small'))?.id || 'small';
  let board = levelById(level).board;
  let visible = board.whites.length; // coloured keys in sight (the 7-10 piano on a narrow screen: fewer)
  let view = 0; // the first coloured key in sight
  let keyW = 0; // px per coloured key, its gap included, while the window is on
  let song = null; // null: free play; else the song being played along
  let run = null;
  let finishing = false; // the last note was played, the end card is coming
  let finishTimer = null;
  let listen = null; // { timers: [], step } while the listen button plays the song
  let pressed = 0; // keys pressed (also counted with the sound off: the test hook reads it)
  let heard = 0; // notes played by the listen button
  const holders = new Map(); // pointer (or computer key) -> the piano key it holds
  const frozen = new Set(); // fingers that were down when the window moved: they play nothing more until lifted
  let pendingFollow = false; // the window should follow the song once every finger is up
  const fingersDown = () => [...holders.keys()].some((h) => typeof h === 'number'); // pointer ids are numbers
  const keyEls = {};

  // ---------- the keyboard ----------

  const keysEl = $('#piano-keys');
  const bodyEl = $('#piano-stage .piano-body');
  const mapEl = $('#piano-map');
  function buildKeys() {
    keysEl.textContent = '';
    for (const id of Object.keys(keyEls)) delete keyEls[id];
    holders.clear();
    frozen.clear();
    pendingFollow = false;
    const big = level !== 'small';
    bodyEl.classList.toggle('big', big);
    keysEl.style.setProperty('--whites', board.whites.length);
    for (const k of board.keys) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pkey ${k.white ? 'white' : 'black'}`;
      b.dataset.key = k.id;
      if (k.white) {
        b.style.setProperty('--key', k.color);
        b.style.setProperty('--key-hi', mix(k.color, '#ffffff', 0.45)); // the light top of the key
        b.style.setProperty('--key-lo', mix(k.color, '#000000', 0.28)); // its darker front edge
      }
      else b.style.setProperty('--slot', board.blackSlot(k.id));
      b.innerHTML = `<span class="pkey-mark" aria-hidden="true"></span>${big && k.white ? '<span class="pkey-name" aria-hidden="true"></span>' : ''}`;
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
    buildMap();
    labelKeys();
  }
  function labelKeys() {
    keysEl.setAttribute('aria-label', t('piano.keys'));
    const big = level !== 'small';
    for (const k of board.keys) {
      const name = t(`piano.note.${big ? k.pc : k.id}`);
      keyEls[k.id].setAttribute('aria-label', big ? t('piano.noteOct', { note: name, oct: Math.floor(k.midi / 12) - 1 }) : name);
      const tag = keyEls[k.id].querySelector('.pkey-name');
      if (tag) tag.textContent = name;
    }
    mapEl.setAttribute('aria-label', t('piano.map'));
    labelMap();
  }

  // ---------- the window on the 7-10 piano ----------

  /** The whole keyboard, small, with a frame around the keys in sight. */
  function buildMap() {
    const n = board.whites.length;
    let svg = `<svg viewBox="0 0 ${n * 10} 30" preserveAspectRatio="none" aria-hidden="true">`;
    board.whites.forEach((k, i) => (svg += `<rect x="${i * 10 + 0.6}" y="0" width="8.8" height="30" rx="2" fill="${k.color}"/>`));
    for (const k of board.keys) if (!k.white) svg += `<rect x="${board.blackSlot(k.id) * 10 - 3.2}" y="0" width="6.4" height="17" rx="1.5" fill="#2b2370"/>`;
    mapEl.innerHTML = `${svg}</svg><span id="piano-map-frame" class="piano-map-frame"></span>`;
  }
  function labelMap() {
    const first = board.whites[view];
    const last = board.whites[Math.min(board.whites.length, view + visible) - 1];
    const name = (k) => t('piano.noteOct', { note: t(`piano.note.${k.pc}`), oct: Math.floor(k.midi / 12) - 1 });
    mapEl.setAttribute('aria-valuemin', '0');
    mapEl.setAttribute('aria-valuemax', String(board.whites.length - visible));
    mapEl.setAttribute('aria-valuenow', String(view));
    if (first && last) mapEl.setAttribute('aria-valuetext', t('piano.mapAt', { from: name(first), to: name(last) }));
  }

  /** How many coloured keys fit, and the keyboard's width and place for that. */
  function layoutKeys() {
    const total = board.whites.length;
    const portrait = window.innerHeight > window.innerWidth;
    const avail = $('#piano-view').clientWidth;
    visible = level === 'small' || !avail ? total : Math.min(total, Math.max(MIN_VISIBLE, Math.floor(avail / MIN_KEY)));
    const windowed = visible < total;
    keyW = windowed ? avail / visible : 0;
    bodyEl.classList.toggle('windowed', windowed);
    // the gap after the last key falls outside, so key i starts at exactly i * keyW
    keysEl.style.width = windowed ? `${keyW * total - 2}px` : '';
    mapEl.hidden = !windowed;
    $('#piano-turn').hidden = !(windowed && portrait);
    setView(view, false);
  }

  /** Show the coloured keys from `v` on (kept on the keyboard). */
  function setView(v, animate = true) {
    const next = Math.min(Math.max(0, Math.round(v)), board.whites.length - visible);
    if (next !== view) {
      // the keys slide under any finger still down: it lets go of its key and plays nothing more
      // until it is lifted, so a trembling finger never plays the key that slid under it
      for (const [h, key] of holders) {
        if (typeof h !== 'number') continue;
        frozen.add(h);
        holders.set(h, null);
        if (key && ![...holders.values()].includes(key)) keyEls[key]?.classList.remove('down');
      }
    }
    view = next;
    keysEl.classList.toggle('sliding', animate);
    keysEl.style.transform = keyW ? `translateX(${-view * keyW}px)` : '';
    const frame = mapEl.querySelector('.piano-map-frame');
    const n = board.whites.length;
    frame.style.left = `${(view / n) * 100}%`;
    frame.style.width = `${(visible / n) * 100}%`;
    labelMap();
  }

  /**
   * Playing along (or listening): keep the key to press and the ones after it in sight. While a
   * finger is on the keys the window waits, and moves when the last finger is lifted.
   */
  function follow(at) {
    if (!song || visible >= board.whites.length) return;
    if (fingersDown()) {
      pendingFollow = true;
      return;
    }
    pendingFollow = false;
    const spans = song.notes.slice(at, at + 8).map((n) => board.span(n.key));
    const v = followView(spans, view, visible, board.whites.length);
    if (v !== view) setView(v);
  }

  // Only the transform moves the keys: where `overflow: clip` is missing, undo the scroll a browser
  // makes to show a key that got focus.
  $('#piano-view').addEventListener('scroll', (e) => {
    e.currentTarget.scrollLeft = 0;
    e.currentTarget.scrollTop = 0;
  });

  // The map: a finger on it (or a click) moves the window there; fingers on the keys only play.
  let mapFinger = null;
  const mapTo = (e) => {
    const r = mapEl.getBoundingClientRect();
    setView(((e.clientX - r.left) / r.width) * board.whites.length - visible / 2, false);
  };
  mapEl.addEventListener('pointerdown', (e) => {
    if (overlayUp() || e.button > 0) return;
    e.preventDefault();
    mapFinger = e.pointerId;
    mapEl.setPointerCapture?.(e.pointerId);
    mapTo(e);
  });
  mapEl.addEventListener('pointermove', (e) => e.pointerId === mapFinger && mapTo(e));
  const mapUp = (e) => {
    if (e.pointerId === mapFinger) mapFinger = null;
  };
  mapEl.addEventListener('pointerup', mapUp);
  mapEl.addEventListener('pointercancel', mapUp);
  mapEl.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, PageUp: -7, PageDown: 7, Home: -99, End: 99 }[e.key];
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    setView(view + step);
  });

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
    if (!holders.has(e.pointerId) || frozen.has(e.pointerId)) return; // only a finger (or mouse button) that went down on the keys
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
    sfx.pianoNote(board.frequency(key));
    pressed++;
    if (listen) stopListening();
    if (!song || !run || finishing || run.done) return;
    if (slide && key !== run.target()) return; // sliding over the keys never counts as a mistake
    const r = run.press(key);
    if (r === 'wrong') {
      nudge();
      follow(run.index); // the child may have slid the window away: bring the glowing key back
    }
    else if (r === 'right') renderSong();
    else if (r === 'done') finish();
  }

  /** A pointer lets go (or slides on to another key). */
  function release(holder, keepFollowing = false) {
    if (!keepFollowing) frozen.delete(holder);
    if (!holders.has(holder)) return;
    const key = holders.get(holder);
    if (keepFollowing) holders.set(holder, null);
    else holders.delete(holder);
    if (key && ![...holders.values()].includes(key)) keyEls[key]?.classList.remove('down');
    if (!keepFollowing && pendingFollow && !fingersDown() && song && run && (listen || !run.done)) follow(listen ? listen.step : Math.min(run.index, song.notes.length - 1));
  }

  function releaseAll() {
    holders.clear();
    frozen.clear();
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
    $('#screen-piano').dataset.level = level;
    // the 7-10 piano says so above the title (a non-breaking hyphen keeps "7-10" together)
    // and a non-breaking space, so a narrow header wraps after the dot ("Liedjes ·" / "7-10 jaar")
    const ages = level === 'small' ? null : t('piano.ages', { age: levelById(level).ages.replace('-', '\u2011') }).replace(' ', '\u00a0');
    $('#piano-sub').textContent = free ? ages || t('games.piano') : ages ? `${t('piano.songs')} · ${ages}` : t('piano.songs');
    $('#piano-title').textContent = free ? t('piano.free') : t(`piano.song.${song.id}`);
    $('#piano-songs-btn').hidden = !free;
    $('#piano-spacer').hidden = free;
    $('#piano-songbar').hidden = free;
    renderMuted();
    renderListen();
    layoutKeys();
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
    if (!run.done || listen) follow(Math.min(at, song.notes.length - 1));
    $('#piano-status').textContent = t(listen ? 'piano.listening' : 'piano.prompt');
    const strip = $('#piano-strip');
    const big = song.level !== 'small';
    strip.classList.toggle('big', big);
    strip.textContent = '';
    const fit = Math.max(4, Math.floor(((strip.clientWidth || 300) - 20) / 30));
    const from = Math.max(0, Math.min(at - 1, song.notes.length - fit));
    song.notes.slice(from, from + fit).forEach((n, k) => {
      const i = from + k;
      const d = document.createElement('span');
      const key = board.keyById(n.key);
      d.className = `pnote${i < at ? ' past' : ''}${i === at ? ' now' : ''}${n.beats >= 2 ? ' long' : n.beats < 1 ? ' short' : ''}${key.white ? '' : ' sharp'}`;
      if (key.white) d.style.setProperty('--key', key.color);
      // on the 7-10 piano a note sits higher the higher it sounds (middle C low, the top C high)
      if (big) d.style.setProperty('--lift', `${((72 - key.midi) / 12) * 8}px`);
      strip.appendChild(d);
    });
    strip.setAttribute('aria-label', t('piano.progress', { done: Math.min(run.index, song.notes.length), total: song.notes.length }));
  }

  function renderSongs() {
    const box = $('#piano-songlist');
    box.textContent = '';
    const got = stars();
    // the age: two big buttons at the top, the one picked filled in
    const ages = document.createElement('div');
    ages.className = 'piano-levels';
    ages.setAttribute('role', 'group');
    ages.setAttribute('aria-label', t('piano.levels'));
    for (const l of LEVELS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'piano-level';
      b.dataset.level = l.id;
      b.setAttribute('aria-pressed', String(l.id === level));
      b.textContent = t('piano.ages', { age: l.ages });
      b.addEventListener('click', () => {
        if (l.id === level) return;
        tap();
        setLevel(l.id);
        renderSongs();
      });
      ages.appendChild(b);
    }
    box.appendChild(ages);
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
    const free = card(level === 'small' ? 'free' : 'free-big', t('piano.free'), t(level === 'small' ? 'piano.freeSub' : 'piano.freeSubBig'), false, null);
    free.dataset.song = 'free';
    free.setAttribute('aria-label', t('piano.free'));
    free.addEventListener('click', () => {
      tap();
      playFree();
    });
    box.appendChild(free);
    for (const s of songsFor(level)) {
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

  /** The age picked: its keyboard, kept for next time. */
  function setLevel(id) {
    if (id === level || !levelById(id)) return;
    stopListening();
    releaseAll();
    level = id;
    board = levelById(id).board;
    view = 0;
    store.saveGameOption(meta.id, 'level', id);
    buildKeys();
    if (onScreen('piano')) render();
  }

  const lockedLead = (lvl) => t(lvl === 'small' ? 'piano.lockedLead' : 'piano.lockedLeadBig');

  function choose(id) {
    const s = songById(id);
    if (!s) return;
    if (locked(id)) {
      shell.offerUnlock(lockedLead(s.level));
      return;
    }
    if (s.level !== level) setLevel(s.level);
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
          sfx.pianoNote(board.frequency(st.key));
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
      const list = songsFor(s.level);
      const next = list[list.indexOf(s) + 1] || null;
      const buttons = [];
      let text = t('piano.winText', { song: t(`piano.song.${s.id}`) });
      if (next && !locked(next.id)) buttons.push([t('piano.next'), 'big primary', () => choose(next.id)]);
      else if (next) {
        text = `${text} ${t('piano.lastFree')}`;
        buttons.push([t('piano.more'), 'big primary', () => (showSongs(), shell.offerUnlock(lockedLead(s.level)))]);
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
  window.addEventListener('resize', () => {
    if (!onScreen('piano')) return;
    layoutKeys();
    if (song) renderSong();
  });
  // the app goes to the background (home button, a call): the song stops playing itself and no key
  // stays down, like the pause in Bubbels and Slangetje
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    stopListening();
    releaseAll();
  });

  // A computer keyboard plays too: on the toy piano A S D F G H J K for the coloured keys, W E T Y
  // U for the black; on the 7-10 piano Z to M and Q to I, with the rows above for the black keys.
  document.addEventListener('keydown', (e) => {
    if (!onScreen('piano') || overlayUp() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target === mapEl) return;
    const key = board.keymap[e.key.toLowerCase()];
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
          level,
          keys: board.keys.length,
          view,
          visible,
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
        setLevel: (id) => setLevel(id),
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
