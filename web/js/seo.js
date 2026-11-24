// What search engines and link previews read, and nothing else: the page never loads any of it.
// bazibo.nl is the canonical site; the same files are mirrored on GitHub Pages and ship inside the
// apps, so the canonical link always names bazibo.nl and the mirror never competes with it.
//
// The home screen is one page in two languages. A crawler has no saved choice and renders pages
// with an English browser, so without its own address the Dutch home would never be indexed.
// `?lang=nl` and `?lang=en` give each language an address (a saved choice still wins, see
// main.js); the plain address is the x-default that follows the device. The hreflang links in
// index.html and web/sitemap.xml name these three addresses; tests/seo.test.js keeps them in step.
import { LANGS } from './i18n.js';

export const SITE = 'https://bazibo.nl/';

/** The language the address asks for (`?lang=nl` or `?lang=en`), or null. */
export function urlLang(search = '') {
  let lang = null;
  try {
    lang = new URLSearchParams(search).get('lang');
  } catch {
    return null;
  }
  return LANGS.includes(lang) ? lang : null;
}

/** The home screen's canonical address for this address: only `lang` is kept. */
export function canonicalHome(search = '') {
  const lang = urlLang(search);
  return lang ? `${SITE}?lang=${lang}` : SITE;
}

/** Adds the canonical link to the home page (it is not in index.html: it depends on the address). */
export function setCanonical(doc, search) {
  let link = doc.querySelector('link[rel="canonical"]');
  if (!link) {
    link = doc.createElement('link');
    link.rel = 'canonical';
    doc.head.appendChild(link);
  }
  link.href = canonicalHome(search);
  return link.href;
}
