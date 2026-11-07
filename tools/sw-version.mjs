// The service-worker cache name is derived from the content of every cached file, so a release
// can never ship with a stale cache name. `npm run stamp` writes it into web/sw.js and
// `npm test` fails if web/sw.js carries a name that does not match the files.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const WEB = new URL('../web/', import.meta.url).pathname;
export const SW = join(WEB, 'sw.js');

/** The ASSETS list as written in web/sw.js. */
export function assets(src = readFileSync(SW, 'utf8')) {
  const m = src.match(/const ASSETS = \[([\s\S]*?)\];/);
  if (!m) throw new Error('ASSETS list not found in web/sw.js');
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

export function currentVersion(src = readFileSync(SW, 'utf8')) {
  return src.match(/const VERSION = '([^']*)';/)?.[1];
}

/** 'bubbels-' + the first 10 hex characters of a sha256 over all cached files. */
export function expectedVersion(list = assets()) {
  const h = createHash('sha256');
  for (const a of [...list].sort()) {
    const file = a === './' ? 'index.html' : a;
    h.update(a + '\0');
    h.update(readFileSync(join(WEB, file)));
  }
  return `bubbels-${h.digest('hex').slice(0, 10)}`;
}

/** Every file under web/ except sw.js itself, as paths relative to web/. */
export function webFiles(dir = WEB) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...webFiles(p));
    else out.push(relative(WEB, p));
  }
  return out.filter((f) => f !== 'sw.js').sort();
}
