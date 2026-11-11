// The read-aloud voice: short MP3 clips made offline with Piper (tools/make_voice.py), played
// through the app's own sound bus, so the sound setting mutes them like every other sound.
// A new line stops the one still playing. Clips are fetched once and kept decoded.
import * as sfx from '../../js/audio.js';

const BASE = 'games/letters/voice';
const cache = new Map(); // "<lang>/<key>" -> Promise<AudioBuffer | null>
let playing = [];
let token = 0;

/** What was asked to be said, newest last (the tests read it; headless browsers stay silent). */
export const spoken = [];

function decode(ac, data) {
  // the callback form also works on older WebKit, where decodeAudioData returns no promise
  return new Promise((resolve, reject) => ac.decodeAudioData(data, resolve, reject));
}

function clip(lang, key) {
  const id = `${lang}/${key}`;
  if (!cache.has(id)) {
    const out = sfx.output();
    const p = out
      ? fetch(`${BASE}/${lang}/${key}.mp3`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
          .then((data) => decode(out.ac, data))
          .catch(() => {
            cache.delete(id); // try again next time (offline at first, say)
            return null;
          })
      : Promise.resolve(null);
    if (out) cache.set(id, p);
    return p;
  }
  return cache.get(id);
}

/** Stop whatever is being said. */
export function stop() {
  token++;
  for (const s of playing) {
    try {
      s.stop();
    } catch {
      /* already ended */
    }
  }
  playing = [];
}

/**
 * Say clips one after another (`keys` like ['p-find', 'l-b']). Resolves true when it started,
 * false when sound is off or the clips could not be loaded.
 */
export async function say(lang, keys, { gap = 0.22 } = {}) {
  stop();
  const mine = token;
  spoken.push(`${lang}:${keys.join('+')}`);
  if (spoken.length > 50) spoken.shift();
  sfx.unlock();
  const out = sfx.output();
  if (!out || sfx.isMuted()) return false;
  const bufs = await Promise.all(keys.map((k) => clip(lang, k)));
  if (mine !== token) return false; // something newer was asked meanwhile
  let t = out.ac.currentTime + 0.04;
  let any = false;
  for (const b of bufs) {
    if (!b) continue;
    const src = out.ac.createBufferSource();
    src.buffer = b;
    src.connect(out.master);
    src.start(t);
    playing.push(src);
    t += b.duration + gap;
    any = true;
  }
  return any;
}

/** Load a language's clips ahead of time, so the first question speaks without delay. */
export function warm(lang, keys) {
  for (const k of keys) clip(lang, k);
}
