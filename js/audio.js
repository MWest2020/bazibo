// All sounds are synthesised with the Web Audio API: no sound files, no downloads.
// The context is created on the first touch/click (browsers require a user gesture).

let ac = null;
let master = null;
let noise = null;
let muted = false;
const VOLUME = 0.7;

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
      const comp = ac.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ac.destination);
      noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.3), ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  } catch {
    ac = null;
  }
}

const on = () => ac && !muted;

function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
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
  o.stop(t + attack + dur + 0.02);
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
  src.start(t, Math.random() * 0.2, dur + 0.02);
}

/** A soft bubble pop. `i` is the position in a chain: later pops climb a little in pitch. */
export function pop(i = 0, vol = 1) {
  if (!on()) return;
  const t = ac.currentTime + 0.005;
  const f = 420 * 2 ** ((Math.random() - 0.5) * 0.45) * 2 ** (Math.min(i, 12) * 0.07);
  tone('sine', f * 0.7, f * 1.9, t, 0.07, 0.42 * vol, 0.003); // the "blop" sweeping up
  hiss(t, 0.035, 0.22 * vol, 'bandpass', f * 5, f * 3, 1.4); // the film snapping
}

export function stick() {
  if (!on()) return;
  const t = ac.currentTime + 0.005;
  tone('sine', 300, 170, t, 0.08, 0.28);
}

export function shoot() {
  if (!on()) return;
  const t = ac.currentTime + 0.005;
  hiss(t, 0.14, 0.1, 'bandpass', 700, 2600, 0.9);
}

export function tick() {
  if (!on()) return;
  tone('triangle', 900, 700, ac.currentTime + 0.003, 0.03, 0.07);
}

export function bounce() {
  if (!on()) return;
  tone('sine', 210, 120, ac.currentTime + 0.003, 0.09, 0.14);
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
