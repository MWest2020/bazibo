// Papegaai's sound: the microphone while the child records, and the parrot saying it back in one
// of the voices of voices.js, all with the Web Audio API. No files, no samples, no speech
// synthesis: every voice is made from the child's own recording.
//
// PRIVACY (AGENTS.md): the recording stays in memory, in this module only (`createTake` while
// listening, then one AudioBuffer and its reversed copy; capture-worklet.js keeps nothing). It is never stored and never sent:
// no storage, no network, no transfer. `drop()` forgets it; papegaai.js calls it when the child
// leaves the game and when the app goes to the background. The microphone is on only while the
// child records: every recording opens it and `stopCapture()` stops its tracks again.
//
// Loudness, for little ears: a take is brought to TARGET_PEAK (never more than MAX_BOOST louder),
// the voices' layers and echoes stay within `worstGain`, and everything goes through a limiter (a
// hard compressor) and the shell's soft clipper, so a shout never comes back as a loud peak.
//
// The game keeps its own audio context (like the drums), and follows the app's sound setting
// through audio.js: nothing plays while `isMuted()`.
import * as sfx from '../../js/audio.js';
import { voiceById, layersOf, layerSeconds, playSeconds, createTake, prepareTake, reversed } from './voices.js';

let ac = null;
let master = null;
let meter = null; // an analyser on the way out: the beak moves with what the parrot says
let mic = null; // { stream, src, proc, sink, analyser, take } while recording
let take = null; // { buffer, reverse, gain, seconds }: the one recording, in memory only
let voice = null; // { srcs, out, timer, until } while a voice plays
const VOLUME = 0.85;
const levelBuf = new Float32Array(1024);

/** The limiter's settings (dB and seconds): peaks are held down hard from -10 dB. */
export const LIMIT = Object.freeze({ threshold: -10, knee: 6, ratio: 20, attack: 0.003, release: 0.25 });

const AC = () => globalThis.AudioContext || globalThis.webkitAudioContext;

/**
 * Can this device record at all? Needs Web Audio and getUserMedia, which browsers only give to
 * secure pages (https, localhost, the apps); a page over plain http has no `mediaDevices`.
 */
export function available() {
  return !!AC() && typeof globalThis.navigator?.mediaDevices?.getUserMedia === 'function' && globalThis.isSecureContext !== false;
}

/** Make (or wake) the audio context. Call it in a touch or click handler. */
export function unlock() {
  if (!mic) sfx.unlock(); // never while recording: it puts iOS back into its ambient (playback-only) audio session
  try {
    if (!ac) {
      const Ctx = AC();
      if (!Ctx) return;
      ac = new Ctx();
      master = ac.createGain();
      master.gain.value = sfx.isMuted() ? 0 : VOLUME;
      const limiter = ac.createDynamicsCompressor();
      for (const k of Object.keys(LIMIT)) limiter[k].value = LIMIT[k];
      const pre = ac.createGain();
      pre.gain.value = 1 / 3;
      const clip = ac.createWaveShaper();
      clip.curve = sfx.softClipCurve();
      clip.oversample = '2x';
      master.connect(limiter).connect(pre).connect(clip).connect(ac.destination);
      meter = ac.createAnalyser();
      meter.fftSize = 1024;
      master.connect(meter);
      loadWorklet(); // ready before the first recording
    }
    if (ac.state !== 'running') ac.resume()?.catch?.(() => {});
  } catch {
    ac = null;
  }
}

/** The sound setting changed: a voice that is playing fades out (or the next one sounds again). */
export function followMute() {
  if (master) master.gain.setTargetAtTime(sfx.isMuted() ? 0 : VOLUME, ac.currentTime, 0.02);
}

function audioSession(type) {
  // iOS (16.4+): recording needs play-and-record; afterwards the app's usual ambient again
  try {
    const s = globalThis.navigator?.audioSession;
    if (s && s.type !== type) s.type = type;
  } catch {
    // older systems: nothing to set
  }
}

/**
 * Ask for the microphone. Resolves with the stream, or rejects (NotAllowedError when it was
 * refused, NotFoundError without a microphone, ...). The caller stops its tracks.
 */
export async function openMic() {
  audioSession('play-and-record');
  try {
    return await globalThis.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  } catch (e) {
    audioSession('ambient');
    throw e;
  }
}

/** Turn the microphone off. */
export function closeStream(stream) {
  try {
    for (const tr of stream?.getTracks?.() || []) tr.stop();
  } catch {
    // already stopped
  }
  if (!mic) audioSession('ambient');
}

let worklet = null; // resolves true once the capture worklet is loaded, false when it cannot be

/** Load the capture worklet once (it is a file of this game, so the CSP's 'self' allows it). */
function loadWorklet() {
  if (!worklet) {
    worklet = ac?.audioWorklet?.addModule
      ? ac.audioWorklet.addModule(new URL('./capture-worklet.js', import.meta.url).href).then(
          () => true,
          () => false,
        )
      : Promise.resolve(false);
  }
  return worklet;
}

/**
 * Start listening on an open microphone stream: its blocks go into a new take (the old one is
 * forgotten first), up to MAX_SECONDS, then `onFull` is called (once). The samples come from the
 * capture worklet (capture-worklet.js), or from a ScriptProcessor where there is no AudioWorklet.
 * Resolves with the take's collector; the caller checks that the child is still there.
 */
export async function startCapture(stream, onFull) {
  stopVoice();
  forgetTake();
  if (!ac) unlock();
  if (!ac) throw new Error('no audio');
  const useWorklet = await loadWorklet();
  const src = ac.createMediaStreamSource(stream);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 1024;
  const sink = ac.createGain();
  sink.gain.value = 0; // the capture node must reach the output to run; nothing of the microphone is heard
  const me = { stream, src, proc: null, sink, analyser, take: createTake(ac.sampleRate), told: false };
  const push = (block) => {
    if (mic !== me) return;
    if (me.take.push(block) === 'full' && !me.told) {
      me.told = true;
      onFull?.();
    }
  };
  if (useWorklet) {
    me.proc = new globalThis.AudioWorkletNode(ac, 'papegaai-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    me.proc.port.onmessage = (e) => push(e.data);
  } else {
    me.proc = ac.createScriptProcessor(4096, 1, 1);
    me.proc.onaudioprocess = (e) => push(e.inputBuffer.getChannelData(0));
  }
  src.connect(analyser);
  src.connect(me.proc);
  me.proc.connect(sink).connect(ac.destination);
  mic = me;
  return me.take;
}

/** Is the microphone listening right now? */
export function recording() {
  return !!mic;
}

function closeMic() {
  const m = mic;
  mic = null;
  if (!m) return null;
  if (m.proc.port) {
    m.proc.port.onmessage = null;
    m.proc.port.postMessage('stop');
  } else m.proc.onaudioprocess = null;
  for (const n of [m.src, m.proc, m.sink, m.analyser]) {
    try {
      n.disconnect();
    } catch {
      // not connected
    }
  }
  closeStream(m.stream);
  return m;
}

/**
 * Stop listening and keep what was heard as the take. Returns { seconds } or null when the parrot
 * heard (almost) nothing; the samples themselves never leave this module.
 */
export function stopCapture() {
  const m = closeMic();
  if (!m) return null;
  const prep = prepareTake(m.take.samples(), ac.sampleRate);
  m.take.clear();
  if (!prep) return null;
  const make = (data) => {
    const b = ac.createBuffer(1, data.length, ac.sampleRate);
    b.getChannelData(0).set(data);
    return b;
  };
  take = { buffer: make(prep.data), reverse: make(reversed(prep.data)), gain: prep.gain, seconds: prep.seconds };
  return { seconds: take.seconds, gain: take.gain };
}

function forgetTake() {
  take = null;
}

/** Is there a recording to play? */
export function hasTake() {
  return !!take;
}

export function takeSeconds() {
  return take ? take.seconds : 0;
}

/**
 * Forget everything: stop listening (without keeping it), stop the voice, drop the recording.
 * For leaving the game and the background.
 */
export function drop() {
  const m = closeMic();
  m?.take.clear();
  stopVoice();
  forgetTake();
}

/** The app goes to the background: everything is dropped and the context sleeps. */
export function suspend() {
  drop();
  try {
    if (ac && ac.state === 'running') ac.suspend()?.catch?.(() => {});
  } catch {
    // nothing to do
  }
}

/**
 * The parrot says the take in voice `id`. Returns how long it plays (seconds), or 0 when nothing
 * plays (no take, the sound is off). `onEnd` runs when it is done, not when it is stopped.
 */
export function play(id, onEnd) {
  stopVoice();
  const v = voiceById(id);
  if (!v || !take || !ac || sfx.isMuted()) return 0;
  const t = ac.currentTime + 0.03;
  const out = ac.createGain();
  out.gain.value = take.gain; // the take at a comfortable level
  out.connect(master);
  // the layers go into `bus`, through the bear's filter, then dry to `out` and into the echo
  const bus = ac.createGain();
  bus.gain.value = 1;
  let into = bus;
  if (v.lowpass) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = v.lowpass;
    f.Q.value = 0.7;
    bus.connect(f);
    into = f;
  }
  const dry = ac.createGain();
  dry.gain.value = v.dry ?? 1;
  into.connect(dry).connect(out);
  const nodes = [out, bus, dry];
  if (v.echo) {
    const delay = ac.createDelay(1);
    delay.delayTime.value = v.echo.delay;
    const fb = ac.createGain();
    fb.gain.value = v.echo.feedback;
    const wet = ac.createGain();
    wet.gain.value = v.echo.wet;
    into.connect(delay);
    delay.connect(fb).connect(delay); // each repeat softer than the last
    delay.connect(wet).connect(out);
    nodes.push(delay, fb, wet);
  }
  const srcs = [];
  for (const l of layersOf(v)) {
    const s = ac.createBufferSource();
    s.buffer = v.reverse ? take.reverse : take.buffer;
    const at = t + l.delay;
    s.playbackRate.setValueAtTime(l.rate, at);
    if (l.rateEnd) s.playbackRate.linearRampToValueAtTime(l.rateEnd, at + layerSeconds(l, take.seconds));
    const g = ac.createGain();
    g.gain.value = l.gain;
    let node = s.connect(g);
    if (l.pan && ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = l.pan;
      node = node.connect(p);
      nodes.push(p);
    }
    node.connect(bus);
    nodes.push(g);
    s.start(at);
    srcs.push(s);
  }
  const length = playSeconds(v, take.seconds);
  const me = { srcs, nodes, out, until: t + length };
  me.timer = setTimeout(() => {
    if (voice !== me) return;
    stopVoice();
    onEnd?.();
  }, (length + 0.08) * 1000);
  voice = me;
  return length;
}

/** Is the parrot speaking? */
export function playing() {
  return !!voice;
}

/** How many sources the voice that is playing uses (the tests and the smoke test read it). */
export function voiceSources() {
  return voice ? voice.srcs.length : 0;
}

/** Stop the voice that is playing, with a fade of a few ms so it never clicks. */
export function stopVoice() {
  const v = voice;
  voice = null;
  if (!v) return;
  clearTimeout(v.timer);
  const t = ac.currentTime;
  try {
    v.out.gain.cancelScheduledValues(t);
    v.out.gain.setTargetAtTime(0, t, 0.01);
  } catch {
    // the context is gone
  }
  for (const s of v.srcs) {
    try {
      s.stop(t + 0.06);
    } catch {
      // already stopped
    }
  }
  setTimeout(() => {
    for (const n of [...v.srcs, ...v.nodes]) {
      try {
        n.disconnect();
      } catch {
        // not connected
      }
    }
  }, 120);
}

function levelFrom(analyser) {
  if (!analyser) return null;
  if (analyser.getFloatTimeDomainData) {
    analyser.getFloatTimeDomainData(levelBuf);
    return levelBuf;
  }
  const b = new Uint8Array(levelBuf.length);
  analyser.getByteTimeDomainData(b);
  for (let i = 0; i < b.length; i++) levelBuf[i] = (b[i] - 128) / 128;
  return levelBuf;
}

/** The latest block of what the microphone hears, or of what the parrot says (for the beak). */
export function levelSamples() {
  if (mic) return levelFrom(mic.analyser);
  if (voice) return levelFrom(meter);
  return null;
}

/** For the tests: forget the context, so the next unlock() makes a new one. */
export function resetForTest() {
  drop();
  ac = null;
  worklet = null;
  master = null;
  meter = null;
}
