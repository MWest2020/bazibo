// Full-version gate, kept apart from the game on purpose.
//
// Levels 1-10 are free. Levels 11-30 belong to the "volledige versie": one non-consumable
// in-app product (PRODUCT_ID) bought once through Google Play or the App Store. The store talks
// through a billing adapter (billing-native.js in the Android/iOS app). On the web there is no
// adapter: nothing can be bought and no purchase is ever faked.
//
// Ownership only becomes true when the store reports the product as owned. The last answer is
// cached so a child can keep playing offline; a store answer that says "not owned" (refund,
// restore that finds nothing) clears the cache again.

export const FREE_LEVELS = 10;
export const PRODUCT_ID = 'unlock_all';

export function isLevelLocked(levelId, owned = false) {
  return levelId > FREE_LEVELS && !owned;
}

/** Has every free level been won at least once? `stars` maps level id -> best stars. */
export function allFreeLevelsDone(levels, stars) {
  const free = levels.filter((l) => l.id <= FREE_LEVELS);
  return free.length > 0 && free.every((l) => (stars[l.id] || 0) > 0);
}

/** The web build: no store, nothing to buy. */
export const noBilling = {
  available: false,
  async start() {
    return { ok: false, reason: 'not-available' };
  },
  async buy() {
    return { ok: false, reason: 'not-available' };
  },
  async restore() {
    return { ok: false, reason: 'not-available' };
  },
  price() {
    return '';
  },
  onOwnedChange() {},
};

/**
 * Purchase state around a billing adapter.
 * adapter: { available, start(), buy(), restore(), price(), onOwnedChange(fn) }
 *   start/restore resolve { ok, owned?, reason? }; buy resolves { ok, owned?, pending?, reason? }.
 * cache: { get() -> boolean, set(boolean) } (the game passes its localStorage wrapper).
 */
export function createUnlock({ billing = noBilling, cache = { get: () => false, set() {} } } = {}) {
  let owned = billing.available ? !!cache.get() : false;
  const listeners = new Set();
  const set = (value) => {
    const next = !!value;
    cache.set(next);
    if (next === owned) return;
    owned = next;
    for (const fn of listeners) fn(owned);
  };
  billing.onOwnedChange((value) => set(value));

  return {
    get owned() {
      return owned;
    },
    get available() {
      return billing.available;
    },
    price: () => billing.price() || '',
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Ask the store once at startup. Offline or failing: keep the cached answer. */
    async start() {
      if (!billing.available) return { ok: false, reason: 'not-available' };
      const r = await billing.start().catch(() => ({ ok: false, reason: 'error' }));
      if (r.ok && typeof r.owned === 'boolean') set(r.owned);
      return r;
    },
    async buy() {
      if (!billing.available) return { ok: false, reason: 'not-available' };
      if (owned) return { ok: true, owned: true };
      const r = await billing.buy().catch(() => ({ ok: false, reason: 'error' }));
      if (r.ok && r.owned) set(true);
      return r;
    },
    async restore() {
      if (!billing.available) return { ok: false, reason: 'not-available' };
      const r = await billing.restore().catch(() => ({ ok: false, reason: 'error' }));
      if (r.ok && typeof r.owned === 'boolean') set(r.owned);
      return r;
    },
  };
}
