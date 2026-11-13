// Asking the computer for a move in a worker (ai-worker.js), safely. One job at a time:
//   - cancel() while a search runs stops that worker; a fresh one starts with the next job, so a
//     cancelled search never delays the next one
//   - a worker error (or a message that cannot be read) answers the job at once from the page,
//     and from then on this session thinks on the page (`broken`)
//   - no answer within `timeout`: that worker is stopped and the job is answered from the page;
//     the next job tries a fresh worker (a slow phone is not a broken worker)
//   - a reply without a move is answered from the page too
// `makeWorker()` returns a Worker (or throws); `onPage(request)` returns a move or null (it may
// throw: that counts as null). Pure of the DOM, so it is tested with a fake worker.
export function createThinker({ makeWorker, onPage, timeout = 6000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let worker = null;
  let broken = false;
  let job = null; // { id, done(move), fallback(), cancel() }

  const page = (request) =>
    Promise.resolve()
      .then(() => onPage(request))
      .catch(() => null);

  function drop() {
    try {
      worker?.terminate();
    } catch {
      // already gone
    }
    worker = null;
  }

  function fail() {
    broken = true;
    const j = job;
    drop();
    j?.fallback();
  }

  function get() {
    if (broken) return null;
    if (worker) return worker;
    try {
      worker = makeWorker();
    } catch {
      worker = null;
    }
    if (!worker) {
      broken = true;
      return null;
    }
    worker.onmessage = (e) => {
      const j = job;
      if (!j || e.data?.id !== j.id) return;
      if (e.data.ok && e.data.move) j.done(e.data.move);
      else j.fallback();
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
    return worker;
  }

  /** Stop the job in flight (its promise resolves with null). */
  function cancel() {
    const j = job;
    if (!j) return;
    job = null;
    drop(); // the search may still be running: a fresh worker next time
    j.cancel();
  }

  /** Ask for a move: resolves with the worker's move, the page's when anything goes wrong, or null when cancelled. */
  function ask(id, request) {
    cancel();
    const w = get();
    if (!w) return page(request);
    return new Promise((resolve) => {
      let finished = false;
      const j = { id };
      const end = (v) => {
        if (finished) return;
        finished = true;
        clearTimer(j.timer);
        if (job === j) job = null;
        resolve(v);
      };
      j.done = end;
      j.cancel = () => end(null);
      j.fallback = () => {
        if (finished) return;
        clearTimer(j.timer);
        if (job === j) job = null;
        page(request).then(end);
      };
      j.timer = setTimer(() => {
        if (job === j) {
          job = null;
          drop();
        }
        j.fallback();
      }, timeout);
      job = j;
      try {
        w.postMessage({ id, ...request });
      } catch {
        fail();
      }
    });
  }

  return {
    ask,
    cancel,
    get broken() {
      return broken;
    },
    get busy() {
      return !!job;
    },
  };
}
