import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as V from '../web/games/papegaai/voices.js';
import { meta } from '../web/games/papegaai/meta.js';
import { parrotSvg, tileSvg, voiceSvg, SIGN_IDS, BEAK_HINGE } from '../web/games/papegaai/art.js';
import * as sound from '../web/games/papegaai/sound.js';
import * as sfx from '../web/js/audio.js';
import * as store from '../web/js/storage.js';
import { payloadOf } from '../web/js/transfer.js';
import { backAction } from '../web/js/back.js';

const GAME = new URL('../web/games/papegaai/', import.meta.url);

// ---------- the voices ----------

test('the voices: the child’s own voice, a mouse, a bear, backwards, an echo, a choir and a balloon', () => {
  assert.deepEqual(V.VOICE_IDS, ['gewoon', 'muis', 'beer', 'achteruit', 'echo', 'koor', 'ballon']);
  const v = Object.fromEntries(V.VOICES.map((x) => [x.id, x]));
  assert.equal(v.gewoon.rate, 1);
  assert.ok(v.muis.rate >= 1.5 && v.muis.rate <= 2, 'the mouse is higher and quicker');
  assert.ok(v.beer.rate >= 0.5 && v.beer.rate <= 0.75 && v.beer.lowpass > 0, 'the bear is lower, slower and softer');
  assert.equal(v.achteruit.reverse, true);
  assert.ok(v.echo.echo.delay >= 0.15 && v.echo.echo.delay <= 0.5);
  assert.ok(v.echo.echo.feedback > 0 && v.echo.echo.feedback < 0.6, 'every echo is softer than the one before');
  assert.ok(v.echo.echo.wet < 1);
  const choir = V.layersOf(v.koor);
  assert.equal(choir.length, 3, 'three parrots');
  assert.deepEqual(choir.map((l) => l.rate), [...choir.map((l) => l.rate)].sort((a, b) => a - b), 'low, middle, high');
  assert.equal(new Set(choir.map((l) => l.rate)).size, 3);
  assert.ok(choir.every((l) => Math.abs(l.pan) <= 1));
  assert.ok(v.ballon.rateEnd > v.ballon.rate, 'the balloon climbs');
  for (const voice of V.VOICES) {
    for (const l of V.layersOf(voice)) {
      assert.ok(l.rate >= 0.5 && l.rate <= 2, `${voice.id}: rate ${l.rate}`);
      if (l.rateEnd) assert.ok(l.rateEnd >= 0.5 && l.rateEnd <= 2.5);
      assert.ok(l.delay >= 0 && l.delay < 0.2);
    }
    assert.equal(V.voiceById(voice.id), voice);
  }
  assert.equal(V.voiceById('robot'), null);
});

test('the voices never pile up: layers and echoes stay within 1.5 times the take', () => {
  for (const voice of V.VOICES) assert.ok(V.worstGain(voice) <= 1.5, `${voice.id} adds up to ${V.worstGain(voice)}`);
  assert.equal(V.worstGain(V.voiceById('gewoon')), 1);
});

test('how long a voice plays: slower is longer, the balloon’s glide uses the take up exactly, the echo dies away', () => {
  const s = 4;
  assert.equal(V.playSeconds(V.voiceById('gewoon'), s), 4);
  assert.ok(Math.abs(V.playSeconds(V.voiceById('muis'), s) - 4 / 1.75) < 1e-9);
  assert.ok(V.playSeconds(V.voiceById('beer'), s) > 6);
  // the balloon: a linear glide from 1 to 2 over T uses (1 + 2) / 2 * T seconds of the take
  const b = V.voiceById('ballon');
  const T = V.playSeconds(b, s);
  assert.ok(Math.abs(((b.rate + b.rateEnd) / 2) * T - s) < 1e-9);
  // the echo: after its tail the repeats are 40 dB down
  const e = V.voiceById('echo').echo;
  const tail = V.echoTail(e);
  assert.ok(e.feedback ** Math.round(tail / e.delay) <= 0.01);
  assert.ok(tail < 3, `the echo rings ${tail}s`);
  // every voice of the longest take ends within half a minute
  for (const voice of V.VOICES) assert.ok(V.playSeconds(voice, V.MAX_SECONDS) < 30, voice.id);
});

// ---------- a recording ----------

test('a take holds at most MAX_SECONDS (10 s), then says it is full', () => {
  assert.equal(V.MAX_SECONDS, 10);
  for (const rate of [8000, 44100, 48000]) {
    const take = V.createTake(rate);
    assert.equal(take.cap, 10 * rate);
    const block = new Float32Array(4096).fill(0.1);
    let pushes = 0;
    let r;
    do {
      r = take.push(block);
      pushes++;
    } while (r === 'more' && pushes < 1000);
    assert.equal(r, 'full');
    assert.equal(take.length, 10 * rate, 'the last block is cut at the cap');
    assert.equal(take.push(block), 'full', 'nothing more goes in');
    assert.equal(take.length, 10 * rate);
    assert.equal(take.samples().length, 10 * rate);
    take.clear();
    assert.equal(take.length, 0);
    assert.equal(take.samples().length, 0);
  }
});

test('preparing a take: quiet ends trimmed, faded edges, a comfortable gain, nothing for silence', () => {
  const rate = 8000;
  assert.equal(V.prepareTake(new Float32Array(rate * 2), rate), null, 'silence is nothing');
  const hum = new Float32Array(rate * 2).fill(0.01); // a quiet room
  assert.equal(V.prepareTake(hum, rate), null);
  const short = new Float32Array(rate);
  short.fill(0.5, 4000, 4400); // 50 ms of sound
  assert.equal(V.prepareTake(short, rate), null, 'a click is not a recording');
  // one second of quiet, a second of "talking", a second of quiet
  const s = new Float32Array(rate * 3);
  for (let i = rate; i < 2 * rate; i++) s[i] = 0.2 * Math.sin(i / 3);
  const p = V.prepareTake(s, rate);
  assert.ok(p);
  assert.ok(p.seconds > 1 && p.seconds < 1 + V.KEEP_BEFORE + V.KEEP_AFTER + 0.02, `${p.seconds}s kept`);
  assert.equal(p.data.length, Math.round(p.seconds * rate));
  assert.equal(p.data[0], 0);
  assert.equal(p.data[p.data.length - 1], 0);
  assert.ok(p.peak <= 0.2 + 1e-6);
  assert.ok(Math.abs(p.gain * p.peak - V.TARGET_PEAK) < 1e-6, 'brought to the target peak');
  // a soft voice is helped, but never more than MAX_BOOST; a shout is turned down
  assert.equal(V.gainFor(0.05), V.MAX_BOOST);
  assert.ok(V.gainFor(1) < 1 && V.gainFor(1) * 1 <= V.TARGET_PEAK);
  assert.equal(V.gainFor(0), 1);
  for (const peak of [0.03, 0.1, 0.3, 0.6, 0.9, 1]) assert.ok(V.gainFor(peak) * peak <= V.TARGET_PEAK + 1e-9);
});

test('backwards is the take the other way round', () => {
  assert.deepEqual([...V.reversed(Float32Array.from([1, 2, 3, 4]))], [4, 3, 2, 1]);
  assert.equal(V.reversed(new Float32Array(0)).length, 0);
});

test('hold or tap: a short press keeps listening, a longer one stops when the finger lifts', () => {
  assert.equal(V.isTap(0), true);
  assert.equal(V.isTap(V.HOLD_MS - 1), true);
  assert.equal(V.isTap(V.HOLD_MS), false);
  assert.equal(V.isTap(2000), false);
});

test('the beak and the waves move with the sound', () => {
  assert.equal(V.levelOf(new Float32Array(512)), 0);
  assert.equal(V.levelOf(new Float32Array(0)), 0);
  const loud = new Float32Array(512).fill(0.5);
  const soft = new Float32Array(512).fill(0.01);
  assert.ok(V.levelOf(loud) > 0.9);
  assert.ok(V.levelOf(soft) > 0 && V.levelOf(soft) < 0.3);
  assert.equal(V.beakAngle(0), 0);
  assert.equal(V.beakAngle(1), V.BEAK_MAX);
  assert.equal(V.beakAngle(5), V.BEAK_MAX);
  assert.ok(V.beakAngle(0.5) > 0 && V.beakAngle(0.5) < V.BEAK_MAX);
  assert.deepEqual([0, 0.2, 0.5, 0.9].map(V.wavesLit), [0, 1, 2, 3]);
  // up at once, down slowly
  assert.equal(V.smooth(0.2, 0.8), 0.8);
  const down = V.smooth(0.8, 0);
  assert.ok(down < 0.8 && down > 0.5);
});

// ---------- the free part ----------

test('free: recording, the own voice, the mouse and the bear; the full version adds the others', () => {
  assert.equal(meta.id, 'papegaai');
  assert.equal(meta.group, 'creative');
  assert.deepEqual(V.VOICE_IDS.filter((id) => !meta.isLocked(id, false)), ['gewoon', 'muis', 'beer']);
  assert.deepEqual(V.VOICE_IDS.filter((id) => meta.isLocked(id, false)), ['achteruit', 'echo', 'koor', 'ballon']);
  for (const id of V.VOICE_IDS) assert.equal(meta.isLocked(id, true), false);
});

// ---------- the pictures ----------

test('the parrot, its beak and every voice sign are drawn, with nothing that refers outside', () => {
  const svgs = [parrotSvg(), tileSvg(), ...SIGN_IDS.map(voiceSvg)];
  for (const svg of svgs) {
    assert.match(svg, /^<svg/);
    assert.doesNotMatch(svg, /\bid=|url\(|href|NaN|undefined/);
  }
  assert.match(parrotSvg(), /class="pg-beak-low"/);
  assert.equal((parrotSvg().match(/class="pg-wave"/g) || []).length, 3);
  assert.deepEqual([...SIGN_IDS].sort(), [...V.VOICE_IDS].sort());
  assert.equal(new Set(SIGN_IDS.map(voiceSvg)).size, SIGN_IDS.length, 'two voices look the same');
  assert.equal(BEAK_HINGE.length, 2);
});

// ---------- the sound, with a stand-in for Web Audio ----------

// A stand-in for the Web Audio API that records every node and connection. `currentTime` is
// moved by the test; a ScriptProcessor is fed by hand.
function fakeAudio() {
  const made = { nodes: [], sources: [], compressors: [], processors: [], streams: [], suspended: 0, edges: [] };
  const param = (v = 0) => ({ value: v, setValueAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.end = x; }, setTargetAtTime(x) { this.target = x; }, cancelScheduledValues() {}, exponentialRampToValueAtTime() {} });
  const node = (kind, extra = {}) => {
    const n = {
      kind,
      out: [],
      connect(m) {
        n.out.push(m);
        made.edges.push([n, m]);
        return m;
      },
      disconnect() {
        n.out = [];
        n.gone = true;
      },
      ...extra,
    };
    made.nodes.push(n);
    return n;
  };
  class Ctx {
    constructor() {
      made.ctx = this;
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.state = 'running';
      this.destination = node('destination');
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      made.suspended++;
      this.state = 'suspended';
      return Promise.resolve();
    }
    createGain() {
      return node('gain', { gain: param(1) });
    }
    createWaveShaper() {
      return node('shaper');
    }
    createAnalyser() {
      return node('analyser', { fftSize: 2048, getFloatTimeDomainData(a) { a.fill(0.25); } });
    }
    createDynamicsCompressor() {
      const c = node('compressor', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
      made.compressors.push(c);
      return c;
    }
    createBiquadFilter() {
      return node('filter', { frequency: param(), Q: param(), type: '' });
    }
    createDelay(max) {
      return node('delay', { max, delayTime: param() });
    }
    createStereoPanner() {
      return node('panner', { pan: param() });
    }
    createScriptProcessor(size) {
      const p = node('processor', { size, onaudioprocess: null });
      made.processors.push(p);
      return p;
    }
    createMediaStreamSource(stream) {
      return node('mic', { stream });
    }
    createBuffer(ch, len, rate) {
      const d = new Float32Array(len);
      return { length: len, duration: len / rate, getChannelData: () => d };
    }
    createBufferSource() {
      const s = node('source', { buffer: null, playbackRate: param(1), startAt: null, stopAt: Infinity, start(t) { s.startAt = t; }, stop(t) { s.stopAt = t; } });
      made.sources.push(s);
      return s;
    }
  }
  const stream = () => {
    const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
    const s = { getTracks: () => tracks, tracks };
    made.streams.push(s);
    return s;
  };
  return { Ctx, made, stream };
}

async function withFakeAudio(fn) {
  const fake = fakeAudio();
  globalThis.AudioContext = fake.Ctx;
  try {
    sound.resetForTest();
    sfx.setMuted(false);
    return await fn(fake);
  } finally {
    sfx.setMuted(false);
    sound.resetForTest();
    delete globalThis.AudioContext;
  }
}

/** Feed the processor `seconds` of a sound at `amp` in blocks, as the microphone would. */
function feed(proc, seconds, amp, rate = 8000) {
  let left = Math.round(seconds * rate);
  let i = 0;
  while (left > 0 && proc.onaudioprocess) {
    const n = Math.min(proc.size, left);
    const d = new Float32Array(n);
    for (let k = 0; k < n; k++) d[k] = amp * Math.sin((i + k) / 3);
    proc.onaudioprocess({ inputBuffer: { getChannelData: () => d } });
    i += n;
    left -= n;
  }
}

/** Every path from `from` to the speakers, as lists of node kinds. */
function pathsToSpeakers(from) {
  const out = [];
  const walk = (n, trail, seen) => {
    if (n.kind === 'destination') return void out.push([...trail, 'destination']);
    if (seen.has(n)) return;
    seen.add(n);
    for (const m of n.out) walk(m, [...trail, n.kind], seen);
    seen.delete(n);
  };
  walk(from, [], new Set());
  return out;
}

test('sound: the microphone is heard only by the recorder, a recording is capped at 10 s and the microphone closed', async () => {
  await withFakeAudio(async ({ made, stream }) => {
    sound.unlock();
    const s1 = stream();
    let full = 0;
    await sound.startCapture(s1, () => full++);
    assert.equal(sound.recording(), true);
    const proc = made.processors[0];
    // nothing of the microphone reaches the speakers: its only way out is through a muted gain
    const mic = made.nodes.find((n) => n.kind === 'mic');
    for (const path of pathsToSpeakers(mic)) {
      const gains = made.edges.filter(([a]) => a.kind === 'gain' && path.includes('gain')).map(([a]) => a);
      assert.ok(path.includes('processor') && gains.some((g) => g.gain.value === 0), `the microphone is heard: ${path}`);
    }
    feed(proc, 12, 0.3);
    assert.equal(full, 1, 'told once that it is full');
    const got = sound.stopCapture();
    assert.ok(got);
    assert.ok(got.seconds <= 10 + 1e-9, `${got.seconds}s kept`);
    assert.ok(got.seconds > 9.5);
    assert.ok(s1.tracks.every((t) => t.stopped), 'the microphone is off after recording');
    assert.equal(sound.recording(), false);
    assert.equal(sound.hasTake(), true);
    assert.ok(mic.gone && proc.gone, 'the microphone nodes are disconnected');
  });
});

test('sound: silence keeps nothing; a new recording replaces the old; leaving drops everything', async () => {
  await withFakeAudio(async ({ made, stream }) => {
    sound.unlock();
    await sound.startCapture(stream());
    feed(made.processors[0], 2, 0);
    assert.equal(sound.stopCapture(), null, 'heard nothing');
    assert.equal(sound.hasTake(), false);
    await sound.startCapture(stream());
    feed(made.processors[1], 1.5, 0.2);
    assert.ok(sound.stopCapture());
    assert.equal(sound.hasTake(), true);
    assert.ok(sound.play('gewoon') > 0);
    const s3 = stream();
    await sound.startCapture(s3);
    assert.equal(sound.hasTake(), false, 'the old recording is gone when a new one starts');
    assert.equal(sound.playing(), false);
    feed(made.processors[2], 1, 0.2);
    sound.drop(); // leaving in the middle of a recording
    assert.equal(sound.hasTake(), false);
    assert.equal(sound.recording(), false);
    assert.ok(s3.tracks.every((t) => t.stopped));
    await sound.startCapture(stream());
    feed(made.processors[3], 1, 0.2);
    sound.stopCapture();
    sound.play('koor');
    sound.suspend(); // the background
    assert.equal(sound.hasTake(), false);
    assert.equal(sound.playing(), false);
    assert.equal(made.suspended, 1);
  });
});

test('sound: every voice plays the take through the limiter and the clipper, within its gain', async () => {
  await withFakeAudio(async ({ made, stream }) => {
    sound.unlock();
    // the limiter: a hard compressor with headroom, before the shell's soft clipper
    assert.equal(made.compressors.length, 1);
    const lim = made.compressors[0];
    assert.ok(sound.LIMIT.threshold <= -6 && sound.LIMIT.ratio >= 12 && sound.LIMIT.attack <= 0.005);
    assert.equal(lim.threshold.value, sound.LIMIT.threshold);
    assert.equal(lim.ratio.value, sound.LIMIT.ratio);
    assert.deepEqual(pathsToSpeakers(lim), [['compressor', 'gain', 'shaper', 'destination']]);
    await sound.startCapture(stream());
    feed(made.processors[0], 2, 0.9); // a shout
    const got = sound.stopCapture();
    assert.ok(got.gain * 0.9 <= V.TARGET_PEAK + 1e-6, 'a shout is turned down');
    for (const voice of V.VOICES) {
      const before = made.sources.length;
      const length = sound.play(voice.id);
      assert.ok(length > 0, voice.id);
      assert.ok(Math.abs(length - V.playSeconds(voice, sound.takeSeconds())) < 1e-9);
      const srcs = made.sources.slice(before);
      assert.equal(srcs.length, V.layersOf(voice).length, `${voice.id}: one source per layer`);
      assert.equal(sound.voiceSources(), srcs.length);
      for (const s of srcs) {
        assert.ok(s.buffer && s.startAt >= 0, `${voice.id}: a source that does not start`);
        // each source reaches the speakers only through the limiter and the clipper
        const paths = pathsToSpeakers(s);
        assert.ok(paths.length > 0, `${voice.id}: not connected`);
        for (const p of paths) {
          assert.deepEqual(p.slice(-4), ['compressor', 'gain', 'shaper', 'destination'], `${voice.id}: ${p}`);
        }
      }
      if (voice.reverse) assert.notEqual(srcs[0].buffer, made.sources[before - 1]?.buffer);
      if (voice.rateEnd) assert.equal(srcs[0].playbackRate.end, voice.rateEnd);
      // an echo's loop is always softer than 1, so it dies away
      const delays = made.nodes.filter((n) => n.kind === 'delay' && !n.gone);
      for (const d of delays) {
        for (const g of d.out.filter((n) => n.kind === 'gain' && n.out.includes(d))) assert.ok(g.gain.value < 1, `${voice.id}: the echo feeds back at ${g.gain.value}`);
      }
      sound.stopVoice();
      assert.equal(sound.playing(), false);
      for (const s of srcs) assert.ok(s.stopAt < Infinity, `${voice.id}: a source keeps playing after stop`);
    }
    // the sound setting is followed: nothing plays with the sound off
    sfx.setMuted(true);
    assert.equal(sound.play('gewoon'), 0);
    assert.equal(sound.playing(), false);
  });
});

test('sound: without Web Audio or getUserMedia the game says so instead of breaking', async () => {
  delete globalThis.AudioContext;
  assert.equal(sound.available(), false);
  await withFakeAudio(async () => {
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    try {
      Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
      assert.equal(sound.available(), false, 'no mediaDevices (a page over plain http)');
      Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: async () => ({}) } }, configurable: true });
      assert.equal(sound.available(), true);
    } finally {
      if (nav) Object.defineProperty(globalThis, 'navigator', nav);
    }
  });
});

// ---------- privacy (AGENTS.md: a hard rule for this game) ----------

test('privacy: nothing in the game folder stores, sends or moves a recording', () => {
  const files = readdirSync(GAME).filter((f) => f.endsWith('.js'));
  assert.ok(files.includes('papegaai.js') && files.includes('sound.js') && files.includes('capture-worklet.js'));
  const banned = [
    [/storage\.js/, 'storage.js'],
    [/transfer(-ui)?\.js/, 'the transfer code'],
    [/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bcaches\b|document\.cookie/, 'browser storage'],
    [/Preferences/, 'Capacitor Preferences'],
    [/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|RTCPeerConnection/, 'the network'],
    [/createObjectURL|\bdownload\b|navigator\.share|MediaRecorder/, 'a file of the recording'],
    [/\bstore\./, 'the save'],
  ];
  for (const f of files) {
    const src = readFileSync(new URL(f, GAME), 'utf8').replace(/^\s*\/\/.*$/gm, ''); // code, not comments
    for (const [re, what] of banned) assert.doesNotMatch(src, re, `${f} touches ${what}`);
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
      assert.ok(['./meta.js', './voices.js', './art.js', './sound.js', '../../js/audio.js', '../../js/i18n.js'].includes(m[1]), `${f} imports ${m[1]}`);
    }
  }
});

test('privacy: only the parental-gate yes is kept, on this device; it does not travel', async () => {
  const m = new Map();
  const prefs = { get: async ({ key }) => ({ value: m.has(key) ? m.get(key) : null }), set: async ({ key, value }) => void m.set(key, value) };
  await store.init({ backend: store.preferencesBackend(prefs), legacyStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  assert.equal(store.micGatePassed(), false);
  store.saveMicGatePassed();
  assert.equal(store.micGatePassed(), true);
  store.saveSettings({ muted: true, lang: 'en' }); // other settings keep it
  await store.flushed();
  const saved = JSON.parse(m.get(store.SAVE_KEY));
  assert.equal(saved.settings.micGate, true);
  assert.equal(saved.games.papegaai, undefined, 'the game has no save section');
  const payload = payloadOf(saved);
  assert.equal('micGate' in payload.settings, false, 'a new device asks a grown-up again');
  // a session that could not read the save keeps the yes when it merges
  const merged = store.mergeSaves({ version: 1, games: {}, settings: { muted: false, lang: null }, purchase: {} }, { games: {}, settings: { micGate: true }, purchase: {} }, false);
  assert.equal(merged.settings.micGate, true);
});

test('the Android back button: Papegaai goes home (leaving drops the recording); a card closes', () => {
  assert.equal(backAction({ screen: 'papegaai' }), 'home');
  assert.equal(backAction({ screen: 'papegaai', overlay: 'card' }), 'close'); // the why card, the gate, the offer
  assert.equal(backAction({ screen: 'papegaai', overlay: 'busy' }), 'ignore');
});
