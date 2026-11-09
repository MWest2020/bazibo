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
const MAX_TIMEOUTS = 2; // after this many stuck workers, generate on the page for the rest of the session
let worker = null;
let workerBroken = false;
let timeouts = 0;
let nextId = 1;
const waiting = new Map(); // job id -> { fallback, settle }

/** Stop the worker; every job it still had is made on the page instead. */
function dropWorker({ broken = false } = {}) {
  try {
    worker?.terminate();
  } catch {
    // already gone
  }
  worker = null;
  if (broken) workerBroken = true;
  const jobs = [...waiting.values()];
  waiting.clear();
  for (const job of jobs) job.fallback();
}

function getWorker() {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./gen-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const job = waiting.get(e.data?.id);
      if (!job) return;
      waiting.delete(e.data.id);
      if (e.data.ok) job.settle(e.data.value);
      else if (e.data.kind === 'load') {
        // the worker cannot load generators here (old WebView, blocked import): page from now on
        job.fallback();
        dropWorker({ broken: true });
      } else job.fallback(); // a generator error in the worker: try once more on the page
    };
    worker.onerror = () => dropWorker({ broken: true }); // could not start at all
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
 * board or puzzle. In a worker when possible; any worker trouble (cannot load, an error, no answer
 * within 8 s) makes the same job again on the page, once. Rejects only if that fails too.
 */
export function generate(game, fn, args) {
  if (!MODULES[game]) return Promise.reject(new Error(`no generator for ${game}`));
  const w = getWorker();
  if (!w) return onPage(game, fn, args);
  return new Promise((resolve, reject) => {
    const id = nextId++;
    let finished = false;
    const timer = setTimeout(() => {
      if (!waiting.has(id)) return;
      // a stuck worker: replace it (or give up on workers after a few), and redo its jobs on the page
      timeouts++;
      dropWorker({ broken: timeouts >= MAX_TIMEOUTS });
    }, WORKER_TIMEOUT_MS);
    const finish = (fnDone) => (v) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      fnDone(v);
    };
    waiting.set(id, {
      settle: finish(resolve),
      fallback: () => onPage(game, fn, args).then(finish(resolve), finish(reject)),
    });
    w.postMessage({ id, url: MODULES[game], fn, args });
  });
}

const nextFrame = () =>
  new Promise((r) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(r, 0));
    else setTimeout(r, 0);
  });

/**
 * generate() with the shell's cards: the "making a new puzzle" card at once (so a slow phone, or the
 * page fallback, never looks frozen), then a frame for it to paint, then the work. `ready`: a
 * puzzle made ahead (used if it worked). `stillWanted()`: false when the child left meanwhile, and
 * then the result is dropped. Resolves with the result, or null (failed or no longer wanted).
 */
export async function makeRandom(shell, game, fn, args, { ready = null, stillWanted = () => true } = {}) {
  shell.showOverlay({ title: shell.t('random.title'), text: shell.t('random.busy'), buttons: [] });
  const busyCard = document.querySelector('#ov-text');
  const ours = () => busyCard && busyCard.textContent === shell.t('random.busy');
  try {
    await nextFrame();
    const value = (ready && (await ready.catch(() => null))) || (await generate(game, fn, args));
    if (ours()) shell.hideOverlay();
    return stillWanted() ? value : null;
  } catch (err) {
    console.error(err);
    if (!stillWanted()) {
      if (ours()) shell.hideOverlay();
      return null;
    }
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
export function randomCard({ t, title = null, solved = 0, locked = false, done = false, onPlay, onLocked, tap = () => {} }) {
  // `done`: "12 gehaald" (boards and rounds) instead of "12 opgelost" (puzzles)
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
    sub.textContent = t(done ? 'random.done' : 'random.solved', { n: solved });
    b.setAttribute('aria-label', `${title ? `${title}: ` : ''}${t(done ? 'random.ariaDone' : 'random.aria', { n: solved })}`);
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
    'random.done': '{n} gehaald',
    'random.ariaDone': 'Willekeurig, {n} gehaald',
    'random.jump': 'Willekeurig',
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
    'random.done': '{n} done',
    'random.ariaDone': 'Random, {n} done',
    'random.jump': 'Random',
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
