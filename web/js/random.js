// Random play for the full version: a new board or puzzle per difficulty tier, made on the device
// from a fresh seed (no network). The generators live next to each game (games/<id>/generate.js)
// and also feed the build tools, so a random board is checked by the same rules as the fixed ones.
// The bigger puzzles can take a moment on a slow phone, so generating runs in a worker when one is
// available (gen-worker.js), and on the page otherwise.
import { addStrings } from './i18n.js';

/** A fresh 32-bit seed from the device's random source. */
export function newSeed() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

const MODULES = {
  bubbels: '../games/bubbels/generate.js',
  dogudoku: '../games/dogudoku/generate.js',
  picturedoku: '../games/picturedoku/generate.js',
  slang: '../games/slang/generate.js',
};

const WORKER_TIMEOUT_MS = 8000;
let worker = null;
let workerBroken = false;
let nextId = 1;
const waiting = new Map();

function getWorker() {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./gen-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const job = waiting.get(e.data.id);
      if (!job) return;
      waiting.delete(e.data.id);
      if (e.data.ok) job.resolve(e.data.value);
      else job.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      // a worker that cannot start (old WebView, module workers unsupported): run on the page
      workerBroken = true;
      worker = null;
      for (const [, job] of waiting) job.fallback();
      waiting.clear();
    };
  } catch {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

async function onPage(game, fn, args) {
  const mod = await import(new URL(MODULES[game], import.meta.url).href);
  return mod[fn](...args);
}

/**
 * Run a game's generator: `generate('dogudoku', 'randomPuzzle', ['s8', seed])`. Resolves with the
 * board or puzzle; rejects only if the generator itself failed.
 */
export function generate(game, fn, args) {
  if (!MODULES[game]) return Promise.reject(new Error(`no generator for ${game}`));
  const w = getWorker();
  if (!w) return onPage(game, fn, args);
  return new Promise((resolve, reject) => {
    const id = nextId++;
    // a worker that never answers (stuck, killed by the system) must not leave the child waiting
    const timer = setTimeout(() => {
      if (!waiting.has(id)) return;
      waiting.delete(id);
      onPage(game, fn, args).then(resolve, reject);
    }, WORKER_TIMEOUT_MS);
    const done = (fnDone) => (v) => {
      clearTimeout(timer);
      fnDone(v);
    };
    const fallback = () => (clearTimeout(timer), onPage(game, fn, args).then(resolve, reject));
    waiting.set(id, { resolve: done(resolve), reject: done(reject), fallback });
    w.postMessage({ id, url: MODULES[game], fn, args });
  });
}

/**
 * generate() with the shell's cards (optionally finishing one made ahead, `ready`): a "making a new puzzle" card if it takes longer than a
 * moment, and a friendly error card if it fails. Resolves with the result, or null on failure.
 */
export async function makeRandom(shell, game, fn, args, ready = null) {
  let shown = false;
  const timer = setTimeout(() => {
    shown = true;
    shell.showOverlay({ title: shell.t('random.title'), text: shell.t('random.busy'), buttons: [] });
  }, 200);
  try {
    // `ready`: a puzzle made ahead of time (see prefetch below); made now if that failed
    const value = (ready && (await ready.catch(() => null))) || (await generate(game, fn, args));
    clearTimeout(timer);
    if (shown) shell.hideOverlay();
    return value;
  } catch (err) {
    clearTimeout(timer);
    console.error(err);
    shell.showOverlay({ title: shell.t('error.title'), text: shell.t('random.error'), buttons: [[shell.t('common.ok'), 'big primary', shell.hideOverlay]] });
    return null;
  }
}

// A drawn die, used on the "random" cards in every game's level list.
export const DICE_SVG =
  '<svg class="dice" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="#fff" stroke="currentColor" stroke-width="1.8"/>' +
  '<circle cx="8" cy="8" r="1.7" fill="currentColor"/><circle cx="16" cy="8" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/>' +
  '<circle cx="8" cy="16" r="1.7" fill="currentColor"/><circle cx="16" cy="16" r="1.7" fill="currentColor"/></svg>';
const LOCK_SVG =
  '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>';

/**
 * The "random" card for one tier in a level list. Locked (full version only) it shows a lock and
 * calls `onLocked`; otherwise it shows how many random ones were solved and calls `onPlay`.
 */
export function randomCard({ t, title = null, solved = 0, locked = false, onPlay, onLocked, tap = () => {} }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'level-btn random-btn';
  b.dataset.random = '1';
  const label = document.createElement('span');
  label.className = 'random-label';
  label.textContent = title || t('random.play');
  const sub = document.createElement('span');
  sub.className = 'random-sub';
  if (locked) {
    b.classList.add('locked');
    b.innerHTML = DICE_SVG + LOCK_SVG;
    sub.textContent = t('random.full');
    b.setAttribute('aria-label', `${title ? `${title}: ` : ''}${t('random.lockedAria')}`);
  } else {
    b.innerHTML = DICE_SVG;
    sub.textContent = t('random.solved', { n: solved });
    b.setAttribute('aria-label', `${title ? `${title}: ` : ''}${t('random.aria', { n: solved })}`);
  }
  b.append(label, sub);
  b.addEventListener('click', () => {
    tap();
    (locked ? onLocked : onPlay)?.();
  });
  return b;
}

addStrings({
  nl: {
    'random.play': 'Willekeurig',
    'random.solved': '{n} opgelost',
    'random.full': 'Volledige versie',
    'random.aria': 'Willekeurige puzzel, {n} opgelost',
    'random.lockedAria': 'Willekeurige puzzels, volledige versie',
    'random.title': 'Willekeurig',
    'random.busy': 'Even een nieuwe puzzel maken…',
    'random.new': 'Nog een',
    'random.same': 'Zelfde nog eens',
    'random.error': 'Er ging iets mis bij het maken van een puzzel. Probeer het nog eens.',
    'random.lead': 'In de volledige versie maak je eindeloos nieuwe puzzels.',
  },
  en: {
    'random.play': 'Random',
    'random.solved': '{n} solved',
    'random.full': 'Full version',
    'random.aria': 'Random puzzle, {n} solved',
    'random.lockedAria': 'Random puzzles, full version',
    'random.title': 'Random',
    'random.busy': 'Making a new puzzle…',
    'random.new': 'Another one',
    'random.same': 'Same one again',
    'random.error': 'Something went wrong making a puzzle. Please try again.',
    'random.lead': 'The full version makes endless new puzzles.',
  },
});
