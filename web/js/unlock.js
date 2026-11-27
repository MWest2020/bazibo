// The full version, kept apart from the games on purpose.
//
// One non-consumable in-app product (PRODUCT_ID), bought once through Google Play or the App
// Store, opens every game. Each game declares its own free tier in its meta.js (Bubbels: levels
// 1-10). The store talks through a billing adapter (billing-native.js in the Android/iOS app). On
// the website the adapter is the signed code bought through a Stripe Payment Link (unlock-code.js,
// `kind: 'code'`, Mark 27 Nov 2026); never inside the app. Nothing is ever faked: "owned" only
// comes from the store's answer or from a code whose signature checks out.
//
// Ownership only becomes true when the store reports the product as owned. The last answer is
// cached so a child can keep playing offline; a store answer that says "not owned" (refund,
// restore that finds nothing) clears the cache again.

export const PRODUCT_ID = 'unlock_all';

/** Is item `n` (1-based: a level, a puzzle) locked, for a game whose first `free` items are free? */
export function isLocked(n, free, owned = false) {
  return n > free && !owned;
}

/** Has every free level been won at least once? `stars` maps level id -> best stars. */
export function allFreeDone(levels, stars, free) {
  const inTier = levels.filter((l) => l.id <= free);
  return inTier.length > 0 && inTier.every((l) => (stars[l.id] || 0) > 0);
}

/** No store and no code (an app without its store plugin): nothing to buy. */
export const noBilling = {
  available: false,
  kind: 'none',
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
 * adapter: { available, kind, start(), buy(), restore(), price(), onOwnedChange(fn), redeem?(code) }
 *   start/restore resolve { ok, owned?, reason? }; buy resolves { ok, owned?, pending?, reason? };
 *   redeem (the website's code) resolves { ok, owned?, reason? }.
 *   kind: 'store' (the app), 'code' (the website), 'none'.
 * cache: { get() -> boolean, set(boolean) } (the app passes its localStorage wrapper).
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
    get kind() {
      return billing.kind || (billing.available ? 'store' : 'none');
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
    /** The website's code: opens everything exactly like a purchase (the same state and listeners). */
    async redeem(code) {
      if (!billing.available || typeof billing.redeem !== 'function') return { ok: false, reason: 'not-available' };
      const r = await billing.redeem(code).catch(() => ({ ok: false, reason: 'error' }));
      if (r.ok && r.owned) set(true);
      return r;
    },
  };
}
