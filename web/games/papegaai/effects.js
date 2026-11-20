// Papegaai's voices and the maths of a recording, pure: no Web Audio and no screen here, so the
// tests run it in node. sound.js plays a voice from these numbers; papegaai.js runs the screen.
//
// Every voice is the child's own recording, changed in the browser: played faster or slower, the
// other way round, with an echo, as three parrots at once or with a rising pitch. No samples, no
// other voices, no speech synthesis.
//
// A recording ("take") lives in memory only (sound.js keeps it in an AudioBuffer). It is never
// stored or sent; it is gone when the child leaves the game or the app goes to the background.

/** The longest recording, in seconds: after this the parrot stops listening by itself. */
export const MAX_SECONDS = 10;
/** A press shorter than this (ms) is a tap: the parrot keeps listening until the next tap. */
export const HOLD_MS = 350;
/** Less sound than this after trimming the quiet ends, and the parrot says it heard nothing. */
export const MIN_SECONDS = 0.2;
/** A 10 ms block whose peak stays under this counts as quiet (only for trimming the ends). */
export const SILENCE = 0.025;
/** Quiet kept before and after the sound when the ends are trimmed (seconds). */
export const KEEP_BEFORE = 0.06;
export const KEEP_AFTER = 0.15;
/** A short fade at both ends, so a cut never clicks (seconds). */
export const EDGE_FADE = 0.012;
/** A take is made louder or softer so its peak lands here (full scale is 1)... */
export const TARGET_PEAK = 0.6;
/** ...but never more than this much louder: a quiet room stays quiet, its hiss is not pumped up. */
export const MAX_BOOST = 4;

/**
 * The voices, in the order of the buttons. A voice is one or more layers of the take (`rate` is
 * the playback speed: 2 is an octave higher and twice as fast; `rateEnd` makes it glide), with
 * an optional low-pass filter, reverse playback or an echo (`delay` s, `feedback` and `wet`
 * gains, both under 1, so the echo always dies away).
 */
export const VOICES = Object.freeze([
  { id: 'gewoon', rate: 1 },
  { id: 'muis', rate: 1.75 }, // high and quick, a little mouse
  { id: 'beer', rate: 0.62, lowpass: 2400 }, // low and slow, a big soft bear
  { id: 'achteruit', rate: 1, reverse: true }, // the other way round
  { id: 'echo', rate: 1, dry: 0.75, echo: { delay: 0.3, feedback: 0.42, wet: 0.42 } }, // like calling in the mountains
  {
    // a choir of three parrots: low, middle and high, one after the other, left, middle and right
    id: 'koor',
    layers: [
      { rate: 0.8, delay: 0, pan: -0.7, gain: 0.42 },
      { rate: 1, delay: 0.035, pan: 0, gain: 0.42 },
      { rate: 1.26, delay: 0.07, pan: 0.7, gain: 0.42 },
    ],
  },
  { id: 'ballon', rate: 1, rateEnd: 2 }, // a helium balloon: the voice climbs higher and higher
].map((v) => Object.freeze(v)));

export const VOICE_IDS = VOICES.map((v) => v.id);

export function voiceById(id) {
  return VOICES.find((v) => v.id === id) || null;
}

/** The layers of a voice, each with every field filled in. */
export function layersOf(voice) {
  const base = { rate: voice.rate ?? 1, rateEnd: voice.rateEnd ?? null, delay: 0, pan: 0, gain: 1 };
  if (!voice.layers) return [base];
  return voice.layers.map((l) => ({ ...base, rateEnd: null, ...l }));
}

/**
 * How long a layer plays a take of `seconds`. With a glide from `rate` to `rateEnd` (linear in
 * time) the take is used up when the average rate times the time equals its length.
 */
export function layerSeconds(layer, seconds) {
  if (layer.rateEnd) return (2 * seconds) / (layer.rate + layer.rateEnd);
  return seconds / layer.rate;
}

/** How long the echo rings after the sound stops: until it is 40 dB down. */
export function echoTail(echo) {
  if (!echo) return 0;
  const repeats = Math.ceil(Math.log(0.01) / Math.log(echo.feedback));
  return repeats * echo.delay;
}

/** How long a voice plays a take of `seconds`, its echo included. */
export function playSeconds(voice, seconds) {
  const end = Math.max(...layersOf(voice).map((l) => l.delay + layerSeconds(l, seconds)));
  return end + echoTail(voice.echo);
}

/**
 * The most a voice can add up to, for a steady sound at full scale: its layers on top of each
 * other, and an echo whose repeats all line up (wet / (1 - feedback)). The limiter in sound.js
 * catches what is left; this keeps the voices themselves from piling up.
 */
export function worstGain(voice) {
  const dry = (voice.dry ?? 1) * layersOf(voice).reduce((s, l) => s + l.gain, 0);
  const wet = voice.echo ? voice.echo.wet / (1 - voice.echo.feedback) : 0;
  return dry + wet;
}

/**
 * Must a grown-up pass the gate before the microphone is asked for? The first time on a device,
 * and again whenever the system says it would ask (`state` 'prompt' from the Permissions API:
 * "only this time" on Android, a permission taken back). 'granted', 'denied' (the calm card
 * follows) and 'unknown' go straight to the system.
 */
export function askFirst(gatePassed, state) {
  return !gatePassed || state === 'prompt';
}

/** Was this press a tap (keep listening) rather than a hold (stop when the finger lifts)? */
export function isTap(heldMs) {
  return heldMs < HOLD_MS;
}

/**
 * Collects the microphone's blocks of samples, up to MAX_SECONDS. `push` answers 'full' once the
 * take is as long as it may be (the rest of that block is left out), else 'more'.
 */
export function createTake(sampleRate) {
  const cap = Math.floor(MAX_SECONDS * sampleRate);
  const chunks = [];
  let length = 0;
  return {
    cap,
    get length() {
      return length;
    },
    get full() {
      return length >= cap;
    },
    push(block) {
      if (length >= cap) return 'full';
      const n = Math.min(block.length, cap - length);
      chunks.push(Float32Array.from(block.subarray ? block.subarray(0, n) : block.slice(0, n)));
      length += n;
      return length >= cap ? 'full' : 'more';
    },
    samples() {
      const out = new Float32Array(length);
      let at = 0;
      for (const c of chunks) {
        out.set(c, at);
        at += c.length;
      }
      return out;
    },
    /** Forget every sample (leaving the game, the background). */
    clear() {
      chunks.length = 0;
      length = 0;
    },
  };
}

function peakOf(samples, from = 0, to = samples.length) {
  let p = 0;
  for (let i = from; i < to; i++) {
    const a = Math.abs(samples[i]);
    if (a > p) p = a;
  }
  return p;
}

/**
 * Where the sound starts and ends: the first and last 10 ms block that is not quiet, with a
 * little quiet kept around it ({ from, to } in samples, and `sound` in seconds without that
 * quiet). Null when it is quiet all the way.
 */
export function soundSpan(samples, sampleRate) {
  const block = Math.max(1, Math.round(sampleRate * 0.01));
  let first = -1;
  let last = -1;
  for (let i = 0; i < samples.length; i += block) {
    if (peakOf(samples, i, Math.min(samples.length, i + block)) >= SILENCE) {
      if (first < 0) first = i;
      last = Math.min(samples.length, i + block);
    }
  }
  if (first < 0) return null;
  return {
    from: Math.max(0, first - Math.round(KEEP_BEFORE * sampleRate)),
    to: Math.min(samples.length, last + Math.round(KEEP_AFTER * sampleRate)),
    sound: (last - first) / sampleRate, // seconds from the first to the last block with sound
  };
}

/** The gain that brings a take's peak to TARGET_PEAK, never above MAX_BOOST. */
export function gainFor(peak) {
  if (!(peak > 0)) return 1;
  return Math.min(MAX_BOOST, TARGET_PEAK / peak);
}

/**
 * Turn what the microphone heard into a take the parrot can say: the quiet ends trimmed, both
 * ends faded, and the gain that makes it comfortably loud. Null when it heard (almost) nothing.
 */
export function prepareTake(samples, sampleRate) {
  const span = soundSpan(samples, sampleRate);
  if (!span || span.sound < MIN_SECONDS) return null;
  const data = samples.slice(span.from, span.to);
  const seconds = data.length / sampleRate;
  const fade = Math.min(Math.round(EDGE_FADE * sampleRate), Math.floor(data.length / 2));
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    data[i] *= g;
    data[data.length - 1 - i] *= g;
  }
  const peak = peakOf(data);
  return { data, seconds, peak, gain: gainFor(peak) };
}

/** A copy played the other way round. */
export function reversed(data) {
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[data.length - 1 - i];
  return out;
}

/** How loud a block of samples is, from 0 (quiet) to 1 (loud), for the beak and the waves. */
export function levelOf(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  if (rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.max(0, Math.min(1, (db + 50) / 40)); // -50 dB closed, -10 dB wide open
}

/** The level on screen: it jumps up at once and sinks back slowly, so the beak does not jitter. */
export function smooth(prev, next) {
  return next >= prev ? next : prev * 0.82 + next * 0.18;
}

/** How far the lower beak opens (degrees) at a level. */
export const BEAK_MAX = 26;
export function beakAngle(level) {
  return Math.round(Math.max(0, Math.min(1, level)) * BEAK_MAX * 10) / 10;
}

/** How many of the three sound waves in front of the beak light up at a level. */
export function wavesLit(level) {
  return level < 0.12 ? 0 : level < 0.4 ? 1 : level < 0.7 ? 2 : 3;
}
