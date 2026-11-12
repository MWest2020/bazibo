// The drawing on the page and when it is kept: what the controller (tekenen.js) does with a
// drawing, without the screen, so it can be tested (tests/tekenen.test.js). `store` is storage.js
// (or a stand-in with loadDrawing, countDrawings and saveDrawing); `owned()` says whether the full
// version is open.
//
// The rules:
//   - undo goes back to the drawing as it was opened, never further (a kept drawing can not be
//     undone into nothing);
//   - a drawing that was kept when it was opened may always be kept again, also on a locked device
//     with more drawings than the free version keeps;
//   - a page that is empty is never written by the autosave. Only when the child leaves (or the
//     page is finished) does an empty page delete the kept drawing: after "clear the page", or a
//     new drawing undone to nothing.
import { visible, decode, pack, mayKeep, newId } from './drawing.js';

export function createSession({ store, gameId, owned, now = () => Date.now() }) {
  let id = null; // the kept drawing's id (null: new, not kept yet)
  let items = [];
  let floor = 0; // undo stops here: the items the drawing was opened with
  let keptAtOpen = false;

  const stored = () => !!(id && store.loadDrawing(gameId, id));

  return {
    /** Open a kept drawing (its id), or a new empty page (null). */
    open(key) {
      const saved = key ? store.loadDrawing(gameId, key) : null;
      id = saved ? key : null;
      items = saved ? decode(saved.s) : [];
      floor = items.length;
      keptAtOpen = !!saved;
    },
    get id() {
      return id;
    },
    get items() {
      return items;
    },
    hasInk: () => visible(items).length > 0,
    canUndo: () => items.length > floor,
    /** Kept now, or when it was opened (then it may be kept again whatever the album holds). */
    kept: () => keptAtOpen || stored(),
    /** A finished stroke or stamp. False when the page is full (drawing.js pack). */
    add(it) {
      items.push(it);
      if (pack(items) === null) {
        items.pop();
        return false;
      }
      return true;
    },
    undo() {
      if (items.length <= floor) return false;
      items.pop();
      return true;
    },
    /** "Clear the page": an item of its own, so undo brings the drawing back. */
    clear() {
      if (!visible(items).length) return false;
      items.push({ k: 'c' });
      return true;
    },
    /**
     * Write the drawing. `final`: the child leaves or finishes it. Returns 'saved', 'empty'
     * (nothing to write), 'deleted', 'nospace' (the album is full: mayKeep), 'full' (too big:
     * never happens, add() refuses first) or 'refused' (storage.js said no).
     */
    write({ final = false } = {}) {
      const text = pack(items);
      if (text === null) return 'full';
      if (!text) {
        if (final && stored()) {
          store.saveDrawing(gameId, id, '', now());
          keptAtOpen = false;
          return 'deleted';
        }
        return 'empty';
      }
      if (!mayKeep({ owned: owned(), count: store.countDrawings(gameId), saved: keptAtOpen || stored() })) return 'nospace';
      if (!id) id = newId(now());
      return store.saveDrawing(gameId, id, text, now()) ? 'saved' : 'refused';
    },
  };
}
