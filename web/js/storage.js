// Progress lives only in this browser. Storage can be missing or throw (private mode,
// blocked site data), so every access is guarded and the game works without it.

const KEY = 'bubbels.v1';

export function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return { stars: data.stars && typeof data.stars === 'object' ? data.stars : {}, muted: !!data.muted };
  } catch {
    return { stars: {}, muted: false };
  }
}

export function save(progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* not available: progress stays in memory for this session */
  }
}
