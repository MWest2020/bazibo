// Full-version gate, kept apart from the game on purpose.
//
// Levels 1-10 are free. Levels 11-30 belong to the "volledige versie". Buying it will go through
// Google Play Billing once the game is wrapped as an Android app (TWA + Digital Goods API).
// Until then NOTHING can be bought: unlock() never grants access and never fakes a purchase.
// The game only shows a friendly locked screen.

export const FREE_LEVELS = 10;

export function isFullVersion() {
  return false; // later: ask the Play Billing purchase state
}

export function isLevelLocked(levelId) {
  return levelId > FREE_LEVELS && !isFullVersion();
}

/** Stub for the future purchase flow. Always reports that buying is not available yet. */
export async function unlock() {
  return { ok: false, reason: 'not-available-yet' };
}

/** Has every free level been won at least once? `stars` maps level id -> best stars. */
export function allFreeLevelsDone(levels, stars) {
  const free = levels.filter((l) => !isLevelLocked(l.id));
  return free.length > 0 && free.every((l) => (stars[l.id] || 0) > 0);
}
