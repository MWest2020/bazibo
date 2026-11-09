// Runs a game's generator off the page (see random.js), so making a big puzzle never freezes the
// screen. Only the generator modules listed in random.js are ever loaded here.
const ALLOWED = new Set([
  '../games/bubbels/generate.js',
  '../games/dogudoku/generate.js',
  '../games/picturedoku/generate.js',
  '../games/slang/generate.js',
]);

self.onmessage = async (e) => {
  const { id, url, fn, args } = e.data || {};
  let mod;
  try {
    if (!ALLOWED.has(url)) throw new Error(`not a generator: ${url}`);
    mod = await import(new URL(url, import.meta.url).href);
    if (typeof mod[fn] !== 'function') throw new Error(`no ${fn} in ${url}`);
  } catch (err) {
    // could not load the generator here: the page takes over (random.js)
    self.postMessage({ id, ok: false, kind: 'load', error: String(err?.message || err) });
    return;
  }
  try {
    self.postMessage({ id, ok: true, value: mod[fn](...args) });
  } catch (err) {
    self.postMessage({ id, ok: false, kind: 'run', error: String(err?.message || err) });
  }
};
