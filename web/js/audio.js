// All sound effects are synthesised with the Web Audio API: no sound files for them. The only
// recorded sound is Letters' read-aloud voice (web/games/letters/voice/, made offline with Piper),
// played through the same bus via output().
// The context is created on the first touch/click (browsers require a user gesture).

let ac = null;
let master = null;
let noise = null;
let muted = false;
const VOLUME = 0.9;

export function setMuted(m) {
  muted = !!m;
  if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ac.currentTime, 0.02);
}

export function isMuted() {
  return muted;
}

export function unlock() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      // soft clipping instead of a compressor: a single pop passes almost untouched (a compressor
      // squashed it to a fifth of full scale), a long chain of overlapping pops cannot clip
      const pre = ac.createGain();
      pre.gain.value = 1 / 3;
      const clip = ac.createWaveShaper();
      clip.curve = softClipCurve();
      clip.oversample = '2x';
      master.connect(pre).connect(clip).connect(ac.destination);
      noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 1), ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  } catch {
    ac = null;
  }
}

const on = () => ac && !muted;

/** The context and the sound bus, for recorded clips (Letters' voice). Null before the first touch. */
export function output() {
  return ac && master ? { ac, master } : null;
}

/** tanh over the shaper's [-1, 1] input, which `pre` maps from [-3, 3]. */
export function softClipCurve(n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * 3);
  return c;
}

/**
 * Keeps many pops close together from turning into noise: a sound is let through only when at
 * least `gap` seconds have passed since the last one that was let through. Pure, so it is tested.
 */
export function makeLimiter() {
  let last = -Infinity;
  return (now, gap) => {
    if (now - last < gap) return false;
    last = now;
    return true;
  };
}
const popGate = makeLimiter();

// Fast attack, then a natural exponential fade that is still about -30 dB after `decay` seconds
// (a ramp straight down to silence made sounds only ~1/3 of their length audible).
const TAIL = 1.5; // sources stop at attack + decay * TAIL, when the fade is about -50 dB
function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0.0001, t + attack, decay / 4);
}

function tone(type, f0, f1, t, dur, peak, attack = 0.004) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, peak, attack, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + attack + dur * TAIL + 0.02);
}

function hiss(t, dur, peak, filterType, f0, f1, q = 1) {
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = filterType;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  env(g, t, peak, 0.002, dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, dur * TAIL + 0.02);
}

/**
 * A bubble pop. `i` is the position in a chain: later pops climb a little in pitch. `gap` is the
 * shortest time (s) since the previous pop; closer pops are skipped (falling bubbles use a long
 * gap so a lost level does not turn into a hailstorm).
 * The pitch sits around 0.5-1.5 kHz so small phone speakers still carry it.
 */
export function pop(i = 0, vol = 1, gap = 0.03) {
  if (!on() || !popGate(ac.currentTime, gap)) return;
  const t = ac.currentTime + 0.005;
  const f = 640 * 2 ** ((Math.random() - 0.5) * 0.4) * 2 ** (Math.min(i, 12) * 0.06);
  tone('sine', f * 0.75, f * 2, t, 0.11, 0.75 * vol, 0.003); // the "blop" sweeping up
  tone('triangle', f * 1.5, f * 3, t, 0.06, 0.22 * vol, 0.002); // brightness for small speakers
  hiss(t, 0.05, 0.35 * vol, 'bandpass', f * 4.5, f * 2.5, 1.3); // the film snapping
}

export function stick() {
  if (!on()) return;
  const t = ac.currentTime + 0.005;
  tone('sine', 420, 220, t, 0.09, 0.4);
}

export function shoot() {
  if (!on()) return;
  const t = ac.currentTime + 0.005;
  hiss(t, 0.14, 0.5, 'bandpass', 700, 2600, 0.9);
  tone('sine', 380, 760, t, 0.1, 0.25);
}

export function tick() {
  if (!on()) return;
  tone('triangle', 1100, 820, ac.currentTime + 0.003, 0.06, 0.3);
}

export function bounce() {
  if (!on()) return;
  tone('sine', 320, 170, ac.currentTime + 0.003, 0.09, 0.22);
}

export function lid() {
  if (!on()) return;
  const t = ac.currentTime + 0.005;
  tone('triangle', 150, 110, t, 0.18, 0.25);
  tone('triangle', 110, 80, t + 0.12, 0.22, 0.22);
}

export function click() {
  if (!on()) return;
  tone('sine', 660, 880, ac.currentTime + 0.003, 0.05, 0.12);
}

export function win() {
  if (!on()) return;
  const t = ac.currentTime + 0.02;
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone('triangle', f, f, t + i * 0.1, 0.35, 0.18));
}

export function lose() {
  if (!on()) return;
  const t = ac.currentTime + 0.02;
  [392, 329.63, 261.63].forEach((f, i) => tone('sine', f, f * 0.97, t + i * 0.16, 0.3, 0.16));
}

// Dogudoku: a soft, cartoon "woof" (a buzzy tone through a vowel-like filter, falling in pitch).
function bark(t, f0, f1, dur, peak) {
  const o = ac.createOscillator();
  const f = ac.createBiquadFilter();
  const lp = ac.createBiquadFilter();
  const g = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  f.type = 'bandpass';
  f.Q.value = 1.6;
  f.frequency.setValueAtTime(1100, t);
  f.frequency.exponentialRampToValueAtTime(650, t + dur);
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  env(g, t, peak, 0.012, dur);
  o.connect(f).connect(lp).connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.012 + dur * TAIL + 0.02);
  hiss(t, dur * 0.6, peak * 0.35, 'bandpass', 900, 600, 1.2);
}

/** A puppy placed: one tiny, high yip. */
export function yip() {
  if (!on()) return;
  bark(ac.currentTime + 0.005, 950, 640, 0.07, 0.16);
}

/** A puzzle solved: "woof woof", quiet and friendly. */
export function woof() {
  if (!on()) return;
  const t = ac.currentTime + 0.02;
  bark(t, 520, 300, 0.14, 0.3);
  bark(t + 0.24, 600, 330, 0.13, 0.26);
  [784, 988, 1175].forEach((f, i) => tone('triangle', f, f, t + 0.5 + i * 0.09, 0.25, 0.1));
}

// Picturedoku: every picture has its own soft note (a pentatonic scale, so any mix sounds friendly).
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];

/** A picture placed: a short, soft bell note for picture v (1..9). */
export function plink(v = 1) {
  if (!on()) return;
  const f = PENTA[(Math.max(1, v) - 1) % PENTA.length];
  const t = ac.currentTime + 0.004;
  tone('sine', f, f, t, 0.22, 0.16);
  tone('triangle', f * 2, f * 2, t, 0.12, 0.04);
}

/** A puzzle solved: a gentle rising chime. */
export function chime() {
  if (!on()) return;
  const t = ac.currentTime + 0.02;
  [659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => {
    tone('sine', f, f, t + i * 0.11, 0.5, 0.14);
    tone('triangle', f * 2, f * 2, t + i * 0.11, 0.25, 0.035);
  });
}

// Vier op een rij: a token landing in its hole. `depth` 0..1 (top..bottom row): lower holes sound a
// little deeper, like a longer fall.
export function thud(depth = 1) {
  if (!on()) return;
  const t = ac.currentTime + 0.004;
  const f = 330 - depth * 90;
  tone('sine', f, f * 0.55, t, 0.12, 0.42, 0.003); // the "tok"
  tone('triangle', f * 2.2, f * 1.4, t, 0.05, 0.12, 0.002); // a bit of click for small speakers
  tone('sine', f * 0.9, f * 0.6, t + 0.09, 0.07, 0.12, 0.003); // the little bounce
}

// Slangetje: a soft double "munch" for a right bite (two little chomps), and a gentle "boop" for a
// wrong one (never a harsh buzzer).
export function munch() {
  if (!on()) return;
  const t = ac.currentTime + 0.005;
  for (const k of [0, 0.09]) {
    tone('triangle', 280, 170, t + k, 0.06, 0.32, 0.002);
    hiss(t + k, 0.045, 0.22, 'bandpass', 1900, 1200, 1.2);
  }
}

export function boop() {
  if (!on()) return;
  const t = ac.currentTime + 0.005;
  tone('sine', 380, 250, t, 0.22, 0.26, 0.012);
}

// Klok kijken: a soft wooden "tick" and "tock" while a hand turns (alternating, like a real
// clock), rate-limited so a fast spin does not rattle.
const tickGate = makeLimiter();
export function ticktock(i = 0) {
  if (!on() || !tickGate(ac.currentTime, 0.045)) return;
  const t = ac.currentTime + 0.003;
  const f = i % 2 ? 1250 : 1650;
  tone('sine', f, f * 0.8, t, 0.035, 0.12, 0.002);
  hiss(t, 0.02, 0.06, 'bandpass', f * 1.6, f * 1.2, 2);
}
