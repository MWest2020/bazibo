// Drumstel's sounds, synthesised with the Web Audio API: no sound files, no samples.
//   kick    a sine that drops fast in pitch (with its octave and a beater click for small speakers)
//   snare   a short falling tone under a burst of filtered noise (the wires)
//   hi-hat  high, filtered noise with a few metallic square waves, very short (a closed hi-hat)
//   toms    a sine with a small pitch drop, lower toms ring longer
//   crash   bright noise and metallic partials with a long tail; the ride a quieter wash with a bell
//   sticks  the wooden click of the count-in
// The game keeps its own audio context (js/audio.js keeps its own private), but follows the app's
// sound setting through audio.js: `unlock()` also unlocks the shell's sound (and on iOS the
// ambient audio session), a hit is silent while `isMuted()`, and `followMute()` fades a ringing
// cymbal out when the sound is turned off. `suspend()` lets the context sleep in the background.
//
// Loudness, for little ears and small phones: every pad has one voice. Hitting a pad again chokes
// its previous voice in about 10 ms (like a hand on a cymbal), so a child mashing the crash never
// stacks dozens of tails: at most one voice per pad (`MAX_VOICES`) rings at once. Everything then
// goes through a limiter (a hard compressor) with headroom before the shell's soft clipper, so the
// summed peak stays near half of full scale and the clipper never sits in steady distortion.
import * as sfx from '../../js/audio.js';

let ac = null;
let master = null;
let noise = null;
let limiter = null;
const VOLUME = 0.7;
const voices = new Map(); // pad -> { out, srcs }: its ringing voice, choked by the next hit
let building = null; // the voice the current hit is adding its sources to
const CHOKE = 0.004; // s: the time constant of the choke (about -60 dB after 12 ms)
const TAIL = 1.5; // sources stop at attack + decay * TAIL, when the fade is about -50 dB

/** Make (or wake) the audio context. Call it in a touch or click handler. */
export function unlock() {
  sfx.unlock();
  try {
    if (!ac) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = sfx.isMuted() ? 0 : VOLUME;
      // a limiter with headroom, then the shell's soft clipping as a last safety net
      limiter = ac.createDynamicsCompressor();
      limiter.threshold.value = LIMIT.threshold;
      limiter.knee.value = LIMIT.knee;
      limiter.ratio.value = LIMIT.ratio;
      limiter.attack.value = LIMIT.attack;
      limiter.release.value = LIMIT.release;
      const pre = ac.createGain();
      pre.gain.value = 1 / 3;
      const clip = ac.createWaveShaper();
      clip.curve = sfx.softClipCurve();
      clip.oversample = '2x';
      master.connect(limiter).connect(pre).connect(clip).connect(ac.destination);
      noise = ac.createBuffer(1, Math.floor(ac.sampleRate), ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state !== 'running') ac.resume()?.catch?.(() => {});
  } catch {
    ac = null;
  }
}

/** The limiter's settings (dB and seconds): loud hits are held down hard from -14 dB. */
export const LIMIT = Object.freeze({ threshold: -14, knee: 4, ratio: 12, attack: 0.002, release: 0.2 });
export const MAX_VOICES = 9; // one per pad, and the sticks of the count-in

/** The app goes to the background: let the context sleep (the next touch wakes it). */
export function suspend() {
  try {
    if (ac && ac.state === 'running') ac.suspend()?.catch?.(() => {});
  } catch {
    // nothing to do
  }
}

/** How many voices still ring at the context's time (the tests read it). */
export function ringing() {
  if (!ac) return 0;
  let n = 0;
  for (const v of voices.values()) if (v.until > ac.currentTime) n++;
  return n;
}

/** The sound setting changed: a ringing cymbal fades out (or the next hit sounds again). */
export function followMute() {
  if (master) master.gain.setTargetAtTime(sfx.isMuted() ? 0 : VOLUME, ac.currentTime, 0.02);
}

const on = () => ac && !sfx.isMuted();

/** For the tests: forget the context, so the next unlock() makes a new one. */
export function resetForTest() {
  ac = null;
  master = null;
  noise = null;
  limiter = null;
  voices.clear();
}

// Fast attack, then a natural exponential fade (as in js/audio.js).
function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0.0001, t + attack, decay / 4);
}

/** A tone from `f0` to `f1` over `sweep` seconds, fading over `decay`. */
function tone(type, f0, f1, sweep, t, decay, peak, attack = 0.002) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
  env(g, t, peak, attack, decay);
  o.connect(g).connect(building.out);
  o.start(t);
  keep(o, t + attack + decay * TAIL + 0.02);
}

/** A source of the voice being built, and when it ends on its own. */
function keep(src, end) {
  src.stop(end);
  src.end = end;
  building.srcs.push(src);
  building.until = Math.max(building.until, end);
}

/** Noise through a chain of filters ([type, frequency, Q]), fading over `decay`. */
function hiss(t, decay, peak, filters, attack = 0.001) {
  const src = ac.createBufferSource();
  src.buffer = noise;
  let node = src;
  for (const [type, f, q] of filters) {
    const b = ac.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    node = node.connect(b);
  }
  const g = ac.createGain();
  env(g, t, peak, attack, decay);
  node.connect(g).connect(building.out);
  const len = Math.min(attack + decay * TAIL + 0.02, noise.duration);
  src.start(t, Math.random() * Math.max(0, noise.duration - len - 0.01));
  keep(src, t + len);
}

// The metallic part of a cymbal: square waves at clashing, inharmonic ratios (as in classic drum
// machines), high-passed so only the shimmer is left.
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
function metal(t, decay, peak, scale, cutoff, count = METAL.length) {
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = cutoff;
  const g = ac.createGain();
  env(g, t, peak, 0.001, decay);
  hp.connect(g).connect(building.out);
  for (const f of METAL.slice(0, count)) {
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = f * scale;
    o.connect(hp);
    o.start(t);
    keep(o, t + 0.001 + decay * TAIL + 0.02);
  }
}

const VOICES = {
  kick(t, v) {
    tone('sine', 160, 48, 0.11, t, 0.42, 0.95 * v);
    tone('sine', 320, 96, 0.08, t, 0.12, 0.25 * v); // the octave: heard on a phone speaker
    hiss(t, 0.012, 0.3 * v, [['bandpass', 3500, 1]]); // the beater
  },
  snare(t, v) {
    tone('triangle', 240, 170, 0.06, t, 0.1, 0.45 * v);
    tone('sine', 180, 150, 0.05, t, 0.08, 0.3 * v);
    hiss(t, 0.2, 0.7 * v, [['highpass', 1200, 0.7], ['bandpass', 3200, 0.8]]);
  },
  hihat(t, v) {
    hiss(t, 0.05, 0.45 * v, [['highpass', 7000, 0.7], ['bandpass', 10000, 0.9]]);
    metal(t, 0.05, 0.05 * v, 2.6, 7000, 3);
  },
  tom1(t, v) {
    drum(t, v, 250, 0.3);
  },
  tom2(t, v) {
    drum(t, v, 190, 0.36);
  },
  floor(t, v) {
    drum(t, v, 130, 0.46);
  },
  crash(t, v) {
    hiss(t, 1.5, 0.5 * v, [['highpass', 3500, 0.7], ['bandpass', 7000, 0.5]]);
    hiss(t, 0.1, 0.3 * v, [['bandpass', 4000, 0.8]]); // the stick hitting the edge
    metal(t, 1.0, 0.04 * v, 2.2, 6000);
  },
  ride(t, v) {
    tone('sine', 3100, 3100, 0, t, 0.5, 0.12 * v, 0.001); // the bell
    tone('triangle', 4700, 4700, 0, t, 0.25, 0.05 * v, 0.001);
    hiss(t, 1.0, 0.22 * v, [['bandpass', 8000, 1.2]]);
    metal(t, 0.8, 0.025 * v, 3.3, 7000, 4);
  },
  sticks(t, v) {
    hiss(t, 0.03, 0.5 * v, [['bandpass', 2600, 4]]);
    tone('sine', 1900, 1700, 0.03, t, 0.03, 0.15 * v, 0.001);
  },
};

function drum(t, v, f, decay) {
  tone('sine', f * 1.35, f, 0.08, t, decay, 0.8 * v);
  tone('triangle', f * 2, f * 1.6, 0.05, t, 0.08, 0.15 * v); // the attack, for small speakers
  hiss(t, 0.03, 0.15 * v, [['bandpass', f * 6, 1]]);
}

export const VOICE_IDS = Object.keys(VOICES);

/**
 * Hit pad `id` (a pad id from kit.js, or 'sticks'). Two fingers may hit two pads at once; the same
 * pad again chokes its previous voice first.
 */
export function hit(id, vol = 1) {
  if (!on() || !VOICES[id]) return false;
  const t = ac.currentTime + 0.003;
  const old = voices.get(id);
  if (old && old.until > t) {
    old.out.gain.cancelScheduledValues(t);
    old.out.gain.setTargetAtTime(0, t, CHOKE);
    for (const s of old.srcs) {
      if (s.end > t + CHOKE * 6) {
        // older WebKit throws on a second stop(); the choke must never break a hit
        try { s.stop(t + CHOKE * 6); } catch { /* already stopped */ }
      }
    }
    old.until = t + CHOKE * 6;
  }
  const out = ac.createGain();
  out.gain.value = 1;
  out.connect(master);
  building = { out, srcs: [], until: t };
  VOICES[id](t, vol);
  voices.set(id, building);
  building = null;
  return true;
}

