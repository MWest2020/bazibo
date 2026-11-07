// Billing adapter for the Android and iOS apps (Capacitor). It wraps the open-source
// cordova-plugin-purchase (MIT), which talks to Google Play Billing and Apple StoreKit. There is
// no receipt server: the store's own purchase record is the truth, read on the device. Nothing
// here makes a network request of its own; the plugin's JS is injected by the native shell, so
// on the web this file finds no plugin and the game uses `noBilling` from unlock.js.
import { PRODUCT_ID } from './unlock.js';

export function isNativeApp() {
  return !!window.Capacitor?.isNativePlatform?.();
}

function pluginReady(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (window.CdvPurchase?.store) return resolve(true);
    const timer = setTimeout(() => resolve(!!window.CdvPurchase?.store), timeoutMs);
    document.addEventListener(
      'deviceready',
      () => {
        clearTimeout(timer);
        resolve(!!window.CdvPurchase?.store);
      },
      { once: true },
    );
  });
}

export function createNativeBilling() {
  const listeners = [];
  let C = null;
  let store = null;
  let platform = null;
  let ready = false;
  let starting = null;

  const owned = () => !!store?.owned({ id: PRODUCT_ID, platform });
  const product = () => store?.get(PRODUCT_ID, platform);
  // Only report after initialize() finished, so a half-loaded store never relocks a paid game.
  const emit = () => {
    if (!ready) return;
    const o = owned();
    for (const fn of listeners) fn(o);
  };

  function start() {
    if (starting) return starting;
    starting = (async () => {
      if (!(await pluginReady())) return { ok: false, reason: 'no-plugin' };
      C = window.CdvPurchase;
      store = C.store;
      store.verbosity = C.LogLevel.WARNING;
      const ios = window.Capacitor?.getPlatform?.() === 'ios';
      platform = ios ? C.Platform.APPLE_APPSTORE : C.Platform.GOOGLE_PLAY;
      store.register([{ id: PRODUCT_ID, type: C.ProductType.NON_CONSUMABLE, platform }]);
      store
        .when()
        // No receipt server: deliver on the device, then finish (on Google Play this
        // acknowledges the purchase, which must happen within three days or it is refunded).
        .approved((t) => t.finish())
        .finished(emit)
        .receiptUpdated(emit);
      const errors = await store.initialize([ios ? { platform, options: { needAppReceipt: false } } : platform]);
      if (errors?.length && !product()) {
        starting = null; // try again on the next buy or restore
        return { ok: false, reason: 'error' };
      }
      ready = true;
      return { ok: true, owned: owned() };
    })();
    return starting;
  }

  return {
    available: true,
    start,
    async buy() {
      const s = await start();
      if (!s.ok) return s;
      const offer = product()?.getOffer();
      if (!offer) return { ok: false, reason: 'no-product' };
      const err = await store.order(offer);
      if (err) return { ok: false, reason: err.code === C.ErrorCode.PAYMENT_CANCELLED ? 'cancelled' : 'error' };
      const o = owned();
      return { ok: true, owned: o, pending: !o };
    },
    async restore() {
      const s = await start();
      if (!s.ok) return s;
      const err = await store.restorePurchases();
      if (err) return { ok: false, reason: 'error' };
      return { ok: true, owned: owned() };
    },
    price() {
      return product()?.pricing?.price || '';
    },
    onOwnedChange(fn) {
      listeners.push(fn);
    },
  };
}
