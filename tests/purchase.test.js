import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUnlock, noBilling, isLocked, PRODUCT_ID } from '../web/js/unlock.js';
import { meta } from '../web/games/bubbels/meta.js';

const FREE_LEVELS = meta.free;

function memoryCache(initial = false) {
  let v = initial;
  return { get: () => v, set: (x) => (v = x), peek: () => v };
}

function fakeBilling(answers = {}) {
  const listeners = [];
  return {
    available: true,
    calls: [],
    start: async () => answers.start ?? { ok: true, owned: false },
    buy: async () => answers.buy ?? { ok: true, owned: true },
    restore: async () => answers.restore ?? { ok: true, owned: false },
    price: () => answers.price ?? '€ 1,00',
    onOwnedChange: (fn) => listeners.push(fn),
    emit: (owned) => listeners.forEach((fn) => fn(owned)),
  };
}

test('product id and free levels', () => {
  assert.equal(PRODUCT_ID, 'unlock_all');
  assert.equal(FREE_LEVELS, 10);
  assert.equal(isLocked(FREE_LEVELS, FREE_LEVELS), false);
  assert.equal(isLocked(FREE_LEVELS + 1, FREE_LEVELS), true);
  assert.equal(isLocked(FREE_LEVELS + 1, FREE_LEVELS, true), false);
  // one purchase for every game: another game's own free tier uses the same owned flag
  assert.equal(isLocked(6, 5, false), true);
  assert.equal(isLocked(6, 5, true), false);
});

test('the web build can never unlock, whatever the cache says', async () => {
  const cache = memoryCache(true); // e.g. a value left behind or set by hand
  const u = createUnlock({ billing: noBilling, cache });
  assert.equal(u.available, false);
  assert.equal(u.owned, false);
  assert.deepEqual(await u.buy(), { ok: false, reason: 'not-available' });
  assert.deepEqual(await u.restore(), { ok: false, reason: 'not-available' });
  assert.equal(u.owned, false);
});

test('a bought game stays open offline: the cached answer survives a failed start', async () => {
  const u = createUnlock({ billing: fakeBilling({ start: { ok: false, reason: 'error' } }), cache: memoryCache(true) });
  assert.equal(u.owned, true);
  await u.start();
  assert.equal(u.owned, true);
});

test('start trusts the store: not owned clears the cache (refund)', async () => {
  const cache = memoryCache(true);
  const u = createUnlock({ billing: fakeBilling({ start: { ok: true, owned: false } }), cache });
  const seen = [];
  u.onChange((o) => seen.push(o));
  await u.start();
  assert.equal(u.owned, false);
  assert.equal(cache.peek(), false);
  assert.deepEqual(seen, [false]);
});

test('buying unlocks and caches; a cancelled buy changes nothing', async () => {
  const cache = memoryCache(false);
  const ok = createUnlock({ billing: fakeBilling(), cache });
  assert.deepEqual(await ok.buy(), { ok: true, owned: true });
  assert.equal(ok.owned, true);
  assert.equal(cache.peek(), true);

  const cache2 = memoryCache(false);
  const no = createUnlock({ billing: fakeBilling({ buy: { ok: false, reason: 'cancelled' } }), cache: cache2 });
  assert.equal((await no.buy()).reason, 'cancelled');
  assert.equal(no.owned, false);
  assert.equal(cache2.peek(), false);
});

test('a pending payment does not unlock until the store reports it as owned', async () => {
  const billing = fakeBilling({ buy: { ok: true, owned: false, pending: true } });
  const u = createUnlock({ billing, cache: memoryCache() });
  const r = await u.buy();
  assert.equal(r.pending, true);
  assert.equal(u.owned, false);
  billing.emit(true); // later, the store finishes the payment
  assert.equal(u.owned, true);
});

test('restore finds a purchase, or reports none', async () => {
  const found = createUnlock({ billing: fakeBilling({ restore: { ok: true, owned: true } }), cache: memoryCache() });
  assert.equal((await found.restore()).owned, true);
  assert.equal(found.owned, true);

  const none = createUnlock({ billing: fakeBilling({ restore: { ok: true, owned: false } }), cache: memoryCache() });
  const r = await none.restore();
  assert.equal(r.ok, true);
  assert.equal(none.owned, false);
});

test('a store that throws is reported as an error and keeps the state', async () => {
  const billing = fakeBilling();
  billing.buy = async () => {
    throw new Error('bridge gone');
  };
  const u = createUnlock({ billing, cache: memoryCache() });
  assert.deepEqual(await u.buy(), { ok: false, reason: 'error' });
  assert.equal(u.owned, false);
});

test('buying when already owned does not open the store again', async () => {
  const billing = fakeBilling();
  let opened = 0;
  billing.buy = async () => (opened++, { ok: true, owned: true });
  const u = createUnlock({ billing, cache: memoryCache(true) });
  await u.buy();
  assert.equal(opened, 0);
});
