// What search engines and link previews read (web/js/seo.js): robots.txt, the sitemap, the
// titles, descriptions, canonical and hreflang links, Open Graph and the schema.org data. None of
// it may load anything, and the brand name repeated in the static copies must match brand.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND } from '../web/js/brand.js';
import { t, setLang } from '../web/js/i18n.js';
import { PLAY_URL } from '../web/js/store-links.js';
import { SITE, urlLang, canonicalHome, setCanonical } from '../web/js/seo.js';

const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const read = (p) => readFileSync(join(WEB, p), 'utf8');
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const attr = (tag, name) => unescape(tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? '');
const head = (html) => html.slice(0, html.indexOf('</head>'));
const metaContent = (html, key, value) =>
  [...head(html).matchAll(/<meta\b[^>]*>/g)].map((m) => m[0]).filter((m) => attr(m, key) === value).map((m) => attr(m, 'content'));
const alternates = (html) =>
  Object.fromEntries(
    [...head(html).matchAll(/<link\b[^>]*rel="alternate"[^>]*>/g)].map((m) => [attr(m[0], 'hreflang'), attr(m[0], 'href')]),
  );
const canonicals = (html) => [...head(html).matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)].map((m) => attr(m[0], 'href'));
/** The file under web/ that serves an address on the site. */
const fileFor = (url) => {
  const path = new URL(url).pathname.slice(1);
  return path === '' || path.endsWith('/') ? `${path}index.html` : path;
};

const sitemap = read('sitemap.xml');
const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
  loc: m[1].match(/<loc>([^<]*)<\/loc>/)[1],
  alt: Object.fromEntries([...m[1].matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((x) => [x[1], x[2]])),
}));

// the parents' pages, each with its language and its other-language twin
const PAGES = {
  'nl/privacy/': 'nl',
  'en/privacy/': 'en',
  'nl/voorwaarden/': 'nl',
  'en/terms/': 'en',
  'nl/plannen/': 'nl',
  'en/roadmap/': 'en',
};
const REDIRECTS = ['privacy/index.html', 'privacy/en.html', 'plannen/index.html', 'roadmap/index.html', 'terms/index.html', 'voorwaarden/index.html'];

test('robots.txt lets every crawler in and names the sitemap', () => {
  const robots = read('robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.doesNotMatch(robots, /^Disallow: *\S/m, 'nothing may be blocked: Google needs the scripts to render the home screen');
  assert.match(robots, new RegExp(`^Sitemap: ${SITE}sitemap\\.xml$`, 'm'));
});

test('the sitemap lists every page once, on bazibo.nl, each with the same languages as the page', () => {
  const locs = entries.map((e) => e.loc);
  assert.equal(new Set(locs).size, locs.length, 'a page is listed twice');
  assert.equal(entries.length, 9);
  for (const { loc, alt } of entries) {
    assert.ok(loc.startsWith(SITE), loc);
    assert.ok(existsSync(join(WEB, fileFor(loc))), `${loc}: no file ${fileFor(loc)}`);
    assert.deepEqual(Object.keys(alt).sort(), ['en', 'nl', 'x-default'], loc);
    assert.ok(Object.values(alt).includes(loc), `${loc} is not among its own alternates`);
    for (const other of Object.values(alt)) {
      const twin = entries.find((e) => e.loc === other);
      assert.ok(twin, `${loc}: ${other} is not in the sitemap`);
      assert.deepEqual(twin.alt, alt, `${loc} and ${other} do not name each other the same way`);
    }
    const html = read(fileFor(loc));
    assert.deepEqual(alternates(html), alt, `${fileFor(loc)}: the hreflang links differ from the sitemap`);
  }
  for (const r of REDIRECTS) assert.ok(!locs.some((l) => fileFor(l) === r), `${r} is a redirect page`);
});

test('every parents\' page has its own title, a description, its canonical address and its language', () => {
  const titles = new Set();
  for (const [path, lang] of Object.entries(PAGES)) {
    const html = read(`${path}index.html`);
    assert.match(html, new RegExp(`<html lang="${lang}"`), path);
    const title = head(html).match(/<title>([^<]+)<\/title>/)[1];
    assert.ok(title.includes(BRAND.name), `${path}: the title does not name ${BRAND.name}`);
    assert.ok(title.length <= 65, `${path}: the title is too long for a search result (${title.length})`);
    assert.ok(!titles.has(title), `${path}: the same title as another page`);
    titles.add(title);
    const [desc] = metaContent(html, 'name', 'description');
    assert.ok(desc && desc.length >= 70 && desc.length <= 160, `${path}: description of ${desc?.length} characters`);
    assert.deepEqual(canonicals(html), [`${SITE}${path}`], path);
    assert.equal(alternates(html)[lang], `${SITE}${path}`, `${path}: hreflang ${lang} is not this page`);
    assert.doesNotMatch(html, /name="robots"/, `${path} must stay indexable`);
  }
});

test('the redirect pages are kept out of search results', () => {
  for (const r of REDIRECTS) assert.match(head(read(r)), /<meta name="robots" content="noindex">/, r);
});

test('the home page: Dutch title and description that t() keeps up in both languages', () => {
  const html = read('index.html');
  const title = head(html).match(/<title>([^<]+)<\/title>/)[1];
  const [desc] = metaContent(html, 'name', 'description');
  setLang('nl');
  assert.equal(title, t('meta.title'), 'the static title is the Dutch meta.title');
  assert.equal(desc, t('meta.description'), 'the static description is the Dutch meta.description');
  for (const lang of ['nl', 'en']) {
    setLang(lang);
    assert.ok(t('meta.title').startsWith(BRAND.name), lang);
    assert.ok(t('meta.title').length <= 60, `${lang}: meta.title too long for a search result`);
    assert.ok(t('meta.description').length >= 70 && t('meta.description').length <= 160, `${lang}: meta.description length`);
  }
  setLang('nl');
  assert.deepEqual(canonicals(html), [], 'the home canonical depends on ?lang= and is set by js/seo.js');
  assert.deepEqual(alternates(html), { nl: `${SITE}?lang=nl`, en: `${SITE}?lang=en`, 'x-default': SITE });
  assert.match(read('js/main.js'), /setCanonical\(document, location\.search\)/);
  assert.match(read('js/main.js'), /pickLang\(settings\.lang, \[urlLang\(location\.search\)/);
});

test('the address can ask for a language; the canonical keeps only that', () => {
  assert.equal(urlLang('?lang=en'), 'en');
  assert.equal(urlLang('?test&lang=nl'), 'nl');
  assert.equal(urlLang('?lang=de'), null);
  assert.equal(urlLang(''), null);
  assert.equal(canonicalHome(''), SITE);
  assert.equal(canonicalHome('?test'), SITE);
  assert.equal(canonicalHome('?lang=en&utm_source=x'), `${SITE}?lang=en`);
  assert.equal(canonicalHome('?lang=xx'), SITE);
  const added = [];
  const doc = { querySelector: () => null, createElement: () => ({}), head: { appendChild: (el) => added.push(el) } };
  assert.equal(setCanonical(doc, '?lang=nl'), `${SITE}?lang=nl`);
  assert.equal(added[0].rel, 'canonical');
});

test('Open Graph: a 1200x630 share image from our own site, on the home page and Plannen / Roadmap', () => {
  const png = readFileSync(join(WEB, 'img/share.png'));
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  for (const page of ['index.html', 'nl/plannen/index.html', 'en/roadmap/index.html']) {
    const html = read(page);
    assert.deepEqual(metaContent(html, 'property', 'og:image'), [`${SITE}img/share.png`], page);
    assert.deepEqual(metaContent(html, 'property', 'og:site_name'), [BRAND.name], page);
    for (const key of ['og:title', 'og:description', 'og:url', 'og:locale']) {
      assert.equal(metaContent(html, 'property', key).length, 1, `${page}: ${key}`);
    }
    assert.ok(metaContent(html, 'property', 'og:url')[0].startsWith(SITE), page);
  }
});

test('schema.org: one MobileApplication data block, free with one €1 purchase, the Play link', () => {
  const html = read('index.html');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1);
  const app = JSON.parse(blocks[0][1]);
  assert.equal(app['@context'], 'https://schema.org');
  assert.equal(app['@type'], 'MobileApplication');
  assert.equal(app.name, BRAND.name);
  assert.equal(app.url, SITE);
  assert.equal(app.operatingSystem, 'Android');
  assert.equal(app.installUrl, PLAY_URL);
  assert.ok(app.sameAs.includes(PLAY_URL));
  assert.deepEqual(app.inLanguage, ['nl', 'en']);
  const prices = app.offers.map((o) => [o.price, o.priceCurrency]);
  assert.deepEqual(prices, [['0', 'EUR'], ['1.00', 'EUR']]);
  assert.equal(app.image, `${SITE}img/share.png`);
});

test('nothing in a head loads from another site; the CSP stays strict', () => {
  const pages = ['index.html', ...Object.keys(PAGES).map((p) => `${p}index.html`), ...REDIRECTS];
  for (const page of pages) {
    const h = head(read(page));
    for (const m of h.matchAll(/<(?:link|script)\b[^>]*>/g)) {
      const tag = m[0];
      const url = attr(tag, 'href') || attr(tag, 'src');
      if (!/^[a-z]+:/i.test(url)) continue; // relative: our own
      assert.match(tag, /rel="(?:canonical|alternate)"/, `${page}: an absolute address that the browser would load: ${tag}`);
      assert.ok(url.startsWith(SITE), `${page}: ${url}`);
    }
    const csp = metaContent(read(page), 'http-equiv', 'Content-Security-Policy')[0];
    assert.ok(csp, `${page}: no CSP`);
    // the one exception (Mark, 27 Nov 2026): the home page may connect to the web unlock's
    // activation endpoint, and to nothing else; js/app-csp.js takes it away again in the app
    const rest = page === 'index.html' ? csp.replace("connect-src 'self' https://api.westerweel.work/bazibo/activate;", "connect-src 'self';") : csp;
    assert.doesNotMatch(rest, /unsafe-|https?:|\*/, `${page}: the CSP was loosened: ${csp}`);
  }
});
