// All sounds are synthesised with the Web Audio API: no sound files, no downloads.
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
