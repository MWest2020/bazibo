// Papegaai (Parrot): the child holds the big button (or taps it), says something for up to ten
// seconds, and the parrot says it back. Then the same recording in other voices: a mouse, a bear,
// backwards, an echo, a choir of three parrots, a helium balloon (effects.js; played by sound.js).
// The beak and three sound waves move with the sound, so a child sees the parrot hears them.
// Calm: no timers on screen, no scores, nothing to lose.
//
// PRIVACY (AGENTS.md, a hard rule for this game): the recording never leaves the device and is
// never saved. It lives in sound.js's memory only and is dropped when the child leaves the game
// or the app goes to the background. Nothing in this folder touches storage.js, the network or
// the transfer code. The microphone is asked for only when the child first presses record; the
// first time on a device that goes through a one-line card and the shell's parental gate
// (`shell.askParent`; the shell remembers that it was passed, never anything heard). A refused
// or missing microphone gives a calm card, and the rest of the app works as before.
import { meta } from './meta.js';
import { VOICES, isTap, levelOf, smooth, beakAngle, wavesLit, askFirst } from './effects.js';
import { parrotSvg, voiceSvg, BEAK_HINGE, MIC, STOP, LOCK } from './art.js';
import * as sound from './sound.js';

const $ = (sel) => document.querySelector(sel);
const now = () => performance.now();
const RELEASE_MS = 150; // after the finger lifts, the browser's own click has passed

export function createPapegaai(shell) {
  const { t, tap } = shell;
  const locked = (id) => meta.isLocked(id, shell.unlock.owned);
  const onScreen = () => $('#screen-papegaai').classList.contains('active');
  const overlayUp = () => !$('#overlay').hidden;
  const micBusy = () => phase === 'recording' || phase === 'opening' || phase === 'asking';

  // idle (nothing recorded) | asking (the gate passed, the system asks for the microphone) |
  // opening (the microphone is starting) | recording | playing | ready (a recording to play)
  let phase = 'idle';
  let say = 'start'; // what the parrot says (papegaai.say.<say>)
  let pressAt = 0; // when the record button went down
  let tapMode = false; // the press was a tap: listen until the next tap (or MAX_SECONDS)
  let liftedEarly = false; // the finger lifted (after a hold) before the microphone was on
  let attempt = 0; // a recording that is still opening, so a newer one (or leaving) can cancel it
  let voice = null; // the voice playing
  let level = 0;
  let raf = 0;
  let mics = 0; // microphone requests (the test hook reads it)
  let played = 0; // voices played (the test hook reads it)
  let micOpenedHere = false; // the microphone opened since the app last came to the foreground
  let fingerDown = false; // a finger (or the mouse) is on the record button
  let onRelease = null; // a card waiting for that finger to lift (afterRelease)

  const stage = $('#papegaai-stage');
  stage.innerHTML = parrotSvg();
  const beak = stage.querySelector('.pg-beak-low');
  const waves = [...stage.querySelectorAll('.pg-wave')];
  const rec = $('#papegaai-rec');
  const voiceBox = $('#papegaai-voices');
  const voiceEls = {};

  // ---------- the voice buttons ----------

  function buildVoices() {
    voiceBox.textContent = '';
    for (const v of VOICES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pg-voice';
      b.dataset.voice = v.id;
      b.innerHTML = `${voiceSvg(v.id)}<span class="pg-voice-name"></span><svg class="pg-lock" viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>`;
      b.addEventListener('click', () => {
        // while the microphone is (being) opened, a voice does nothing at all: no click sound
        // (tap() puts iOS back in its playback-only session) and no offer card over a live mic
        if (overlayUp() || micBusy()) return;
        tap();
        chooseVoice(v.id);
      });
      voiceEls[v.id] = b;
      voiceBox.appendChild(b);
    }
  }

  function renderVoices() {
    const can = sound.hasTake() && phase !== 'recording' && phase !== 'opening';
    voiceBox.setAttribute('aria-label', t('papegaai.voices'));
    for (const v of VOICES) {
      const b = voiceEls[v.id];
      const name = t(`papegaai.voice.${v.id}`);
      const isLocked = locked(v.id);
      b.querySelector('.pg-voice-name').textContent = name;
      b.classList.toggle('locked', isLocked);
      b.classList.toggle('waiting', !can && !isLocked);
      b.classList.toggle('on', voice === v.id);
      b.setAttribute('aria-label', isLocked ? t('papegaai.voiceLocked', { voice: name }) : name);
      b.setAttribute('aria-pressed', String(voice === v.id));
    }
  }

  function chooseVoice(id) {
    if (micBusy()) return; // never an offer (and its gate and the store) over a live microphone
    if (locked(id)) {
      shell.offerUnlock(t('papegaai.lockedLead'));
      return;
    }
    if (!sound.hasTake()) {
      setSay('first');
      rec.classList.remove('nudge');
      void rec.offsetWidth;
      rec.classList.add('nudge');
      return;
    }
    sound.unlock();
    playVoice(id);
  }

  function playVoice(id) {
    if (shell.isMuted()) {
      voice = null;
      phase = 'ready';
      setSay('again');
      render();
      return;
    }
    const length = sound.play(id, () => {
      voice = null;
      phase = 'ready';
      setSay('again');
      render();
    });
    if (!length) {
      phase = sound.hasTake() ? 'ready' : 'idle';
      render();
      return;
    }
    played++;
    voice = id;
    phase = 'playing';
    setSay('playing');
    render();
    loop();
  }

  // ---------- recording ----------

  function startRecording() {
    if (!sound.available()) {
      afterRelease(() => noMic('none'));
      return;
    }
    if (!shell.micGate.passed()) {
      afterRelease(askGrownUp);
      return;
    }
    sound.unlock();
    sound.stopVoice();
    voice = null;
    phase = 'opening';
    tapMode = false;
    liftedEarly = false;
    setSay('opening');
    render();
    const mine = ++attempt;
    // the gate was passed before; if the system would ask again ("only this time" on Android, a
    // permission taken back), a grown-up answers the gate again first
    micState().then((state) => {
      if (mine !== attempt) return;
      if (askFirst(true, state)) {
        toRest();
        afterRelease(askGrownUp);
        return;
      }
      openAndRecord(mine);
    });
  }

  /**
   * What the system would do with a microphone request: 'granted', 'denied', 'prompt', or
   * 'unknown' (no Permissions API, or it does not know the microphone). After a microphone that
   * opened in this visit to the foreground it is not asked again (some WebViews answer 'prompt'
   * for ever), until the app has been in the background.
   */
  function micState() {
    if (micOpenedHere) return Promise.resolve('granted');
    try {
      const q = globalThis.navigator?.permissions?.query?.({ name: 'microphone' });
      if (!q || typeof q.then !== 'function') return Promise.resolve('unknown');
      return q.then((r) => r?.state || 'unknown', () => 'unknown');
    } catch {
      return Promise.resolve('unknown');
    }
  }

  function openAndRecord(mine) {
    mics++;
    sound
      .openMic()
      .then(async (stream) => {
        const gone = () => mine !== attempt || !onScreen() || document.hidden || liftedEarly;
        if (gone()) {
          // left, went to the background, or a hold that ended before the microphone was on
          sound.closeStream(stream);
          if (mine === attempt) toRest();
          return;
        }
        await sound.startCapture(stream, () => stopRecording()); // closes the stream itself if it fails
        micOpenedHere = true;
        if (gone()) {
          sound.drop(); // closes the microphone again; nothing was kept
          if (mine === attempt) toRest();
          return;
        }
        phase = 'recording';
        setSay(tapMode ? 'listeningTap' : 'listening');
        render();
        loop();
      })
      .catch((e) => {
        if (mine !== attempt) return;
        toRest();
        const kind = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'none';
        afterRelease(() => onScreen() && noMic(kind));
      });
  }

  /**
   * Show a card only once the finger is off the record button: the click a browser makes after a
   * touch must not land on a button of a card that came up under the finger.
   */
  function afterRelease(fn) {
    if (fingerDown) onRelease = fn;
    else setTimeout(fn, RELEASE_MS);
  }

  function stopRecording() {
    if (phase !== 'recording') return;
    const got = sound.stopCapture();
    tapMode = false;
    if (!got) {
      phase = 'idle';
      setSay('nothing');
      render();
      return;
    }
    playVoice('gewoon');
  }

  /** Back to waiting: with a recording to play, or without. */
  function toRest() {
    phase = sound.hasTake() ? 'ready' : 'idle';
    tapMode = false;
    setSay(sound.hasTake() ? 'again' : 'start');
    render();
  }

  // The first time on a device: why the parrot needs the microphone, then the parental gate. A
  // cancelled card or gate asks nothing.
  function askGrownUp() {
    shell.showOverlay({
      art: `<span class="pg-why-art">${parrotSvg('pg-why-svg')}</span>`,
      title: t('papegaai.why.title'),
      text: t('papegaai.why.text'),
      buttons: [
        [t('papegaai.why.parent'), 'big primary', () => shell.askParent(gatePassed)],
        [t('common.cancel'), 'big secondary', shell.hideOverlay],
      ],
    });
  }

  // The grown-up passed: remember that (the shell keeps only this yes, on this device), then let
  // the system ask for the microphone while the grown-up still holds the phone. The microphone is
  // closed again at once: it is only on while the child records.
  function gatePassed() {
    shell.micGate.pass();
    shell.hideOverlay();
    phase = 'asking';
    setSay('opening');
    render();
    const mine = ++attempt;
    // on the next task: the Enter that answered the gate must not also press the button of a card
    // that comes at once (a microphone refused before, without a system question)
    setTimeout(() => {
      if (mine !== attempt) return;
      if (!sound.available()) {
        toRest();
        noMic('none');
        return;
      }
      mics++;
      askSystem(mine);
    }, 0);
  }

  function askSystem(mine) {
    sound
      .openMic()
      .then((stream) => {
        sound.closeStream(stream);
        micOpenedHere = true;
        if (mine !== attempt) return;
        toRest();
        setSay('ready');
      })
      .catch((e) => {
        if (mine !== attempt) return;
        toRest();
        if (onScreen()) noMic(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'none');
      });
  }

  /** A calm card: the microphone was refused or is not there. Nothing else changes. */
  function noMic(kind) {
    shell.showOverlay({
      art: `<span class="pg-why-art">${parrotSvg('pg-why-svg')}</span>`,
      title: t('papegaai.nomic.title'),
      text: t(kind === 'denied' ? 'papegaai.nomic.denied' : 'papegaai.nomic.none'),
      buttons: [[t('common.ok'), 'big primary', shell.hideOverlay]],
    });
  }

  // Hold to talk, or tap to start and tap again to stop. Pointer capture keeps the lift here.
  rec.addEventListener('pointerdown', (e) => {
    if (overlayUp() || e.button > 0) return;
    e.preventDefault();
    rec.setPointerCapture?.(e.pointerId);
    fingerDown = true;
    if (phase === 'recording' && tapMode) {
      stopRecording();
      return;
    }
    if (phase === 'opening' && tapMode) {
      liftedEarly = true; // a second tap before the microphone was on: never mind
      return;
    }
    if (phase === 'recording' || phase === 'opening' || phase === 'asking') return;
    pressAt = now();
    startRecording();
  });
  const lift = () => {
    fingerDown = false;
    if (onRelease) {
      const fn = onRelease;
      onRelease = null;
      setTimeout(fn, RELEASE_MS);
    }
    if (phase !== 'recording' && phase !== 'opening') return;
    if (tapMode) return;
    if (isTap(now() - pressAt)) {
      tapMode = true; // a tap: keep listening until the next tap
      setSay(phase === 'recording' ? 'listeningTap' : say);
      render();
      return;
    }
    if (phase === 'opening') liftedEarly = true;
    else stopRecording();
  };
  rec.addEventListener('pointerup', lift);
  rec.addEventListener('pointercancel', lift);
  rec.addEventListener('contextmenu', (e) => e.preventDefault()); // a long press is just holding
  // the keyboard or a screen reader (a click without a pointer): start, then stop
  rec.addEventListener('click', (e) => {
    if (e.detail !== 0 || overlayUp()) return;
    if (phase === 'recording') stopRecording();
    else if (phase !== 'opening' && phase !== 'asking') {
      pressAt = now();
      startRecording();
      tapMode = true;
    }
  });

  // ---------- the beak and the waves ----------

  function loop() {
    if (raf) return;
    const frame = () => {
      raf = 0;
      const samples = sound.levelSamples();
      level = smooth(level, samples ? levelOf(samples) : 0);
      drawLevel();
      if (samples || level > 0.01) raf = requestAnimationFrame(frame);
      else {
        level = 0;
        drawLevel();
      }
    };
    raf = requestAnimationFrame(frame);
  }

  function drawLevel() {
    beak.setAttribute('transform', `rotate(${beakAngle(level)} ${BEAK_HINGE[0]} ${BEAK_HINGE[1]})`);
    const lit = wavesLit(level);
    waves.forEach((w, i) => w.classList.toggle('lit', i < lit));
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    level = 0;
    drawLevel();
  }

  // ---------- the screen ----------

  function setSay(key) {
    say = key;
    $('#papegaai-say').textContent = t(`papegaai.say.${key}`);
  }

  function render() {
    const screen = $('#screen-papegaai');
    screen.dataset.phase = phase;
    const listening = phase === 'recording' || phase === 'opening';
    rec.classList.toggle('on', listening);
    rec.setAttribute('aria-pressed', String(listening));
    rec.setAttribute('aria-label', t('papegaai.recAria'));
    rec.querySelector('svg').innerHTML = listening && tapMode ? STOP : MIC;
    $('#papegaai-rec-label').textContent = t(listening && tapMode ? 'papegaai.tapStop' : 'papegaai.hold');
    $('#papegaai-muted').hidden = !shell.isMuted();
    stage.setAttribute('aria-label', t('papegaai.parrot'));
    renderVoices();
  }

  /**
   * Forget everything: the recording, what is being heard, the voice. Leaving the game and the
   * background both come here, so a recording never outlives the child's visit.
   */
  function dropAll() {
    onRelease = null;
    attempt++; // a microphone that is still opening is closed as soon as it arrives
    sound.drop();
    stopLoop();
    voice = null;
    tapMode = false;
    phase = 'idle';
    setSay('start');
    render();
  }

  function open() {
    sound.unlock(); // inside the tile's click: on iOS the first sound needs a gesture
    dropAll();
    shell.show('papegaai');
  }

  function back() {
    shell.show('home'); // onShow drops the recording
  }

  // ---------- wiring ----------

  $('#papegaai-back').addEventListener('click', () => {
    if (micBusy()) dropAll(); // the microphone off first, then the click sound
    tap();
    back();
  });
  $('#papegaai-sound-on').addEventListener('click', () => {
    if (micBusy()) return; // no tap() or unlock while the microphone is on
    sound.unlock();
    shell.setMuted(false);
    tap();
  });
  shell.onMutedChange(() => {
    sound.followMute();
    if (onScreen()) render();
  });
  shell.unlock.onChange(() => onScreen() && render());
  shell.onShow((name) => {
    if (name !== 'papegaai') {
      if (sound.hasTake() || sound.recording() || sound.playing() || phase !== 'idle') dropAll();
    } else render();
  });
  shell.onLangChange(() => {
    setSay(say);
    render();
  });
  // the app goes to the background (home button, a call, the screen off): the recording is gone
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    micOpenedHere = false; // a permission given "only this time" may lapse in the background
    if (sound.hasTake() || sound.recording() || sound.playing() || phase !== 'idle') dropAll();
    sound.suspend(); // the next touch wakes it
  });

  buildVoices();
  setSay('start');
  render();

  return {
    async init() {
      return true; // everything is made in code; nothing to load
    },
    open,
    back,
    testHook() {
      return {
        state: () => ({
          phase,
          say,
          tapMode,
          hasTake: sound.hasTake(),
          seconds: Math.round(sound.takeSeconds() * 100) / 100,
          recording: sound.recording(),
          playing: sound.playing(),
          voice,
          sources: sound.voiceSources(),
          level: Math.round(level * 100) / 100,
          beak: beakAngle(level),
          mics,
          played,
          gate: shell.micGate.passed(),
          locked: VOICES.filter((v) => locked(v.id)).map((v) => v.id),
        }),
        voices: () => VOICES.map((v) => v.id),
      };
    },
  };
}
