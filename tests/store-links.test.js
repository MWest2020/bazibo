import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAY_URL, inApp, showStoreLinks } from '../web/js/store-links.js';

const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const read = (p) => readFileSync(join(WEB, p), 'utf8');
const htmlFiles = (dir = '') =>
  readdirSync(join(WEB, dir)).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(join(WEB, p)).isDirectory()) return htmlFiles(p);
    return p.endsWith('.html') ? [p] : [];
  });

test('the app is recognised: the Capacitor bridge or the app\'s own address', () => {
  assert.equal(inApp({ Capacitor: { isNativePlatform: () => true }, location: { protocol: 'https:', hostname: 'bazibo.nl' } }), true);
  assert.equal(inApp({ location: { protocol: 'https:', hostname: 'localhost' } }), true); // Android
  assert.equal(inApp({ location: { protocol: 'capacitor:', hostname: 'localhost' } }), true); // iOS
  assert.equal(inApp({ location: { protocol: 'https:', hostname: 'bazibo.nl' } }), false);
  assert.equal(inApp({ location: { protocol: 'https:', hostname: 'mwest2020.github.io' } }), false);
  assert.equal(inApp({ location: { protocol: 'http:', hostname: '127.0.0.1' } }), false); // local dev
  assert.equal(inApp({ Capacitor: { isNativePlatform: () => false }, location: { protocol: 'https:', hostname: 'bazibo.nl' } }), false);
});

test('the store links are shown on the website and stay hidden in the app', () => {
  const els = [{ hidden: true }, { hidden: true }];
  const doc = { querySelectorAll: (sel) => (sel === '[data-store-links], [data-web-only]' ? els : []) };
  assert.equal(showStoreLinks(doc, { location: { protocol: 'https:', hostname: 'localhost' } }), false);
  assert.ok(els.every((e) => e.hidden));
  assert.equal(showStoreLinks(doc, { location: { protocol: 'https:', hostname: 'bazibo.nl' } }), true);
  assert.ok(els.every((e) => !e.hidden));
});

test('the home screen and the parents\' pages link to Google Play, App Store "coming soon"', () => {
  const pages = {
    'index.html': ['Download in Google Play', 'App Store: binnenkort'],
    'nl/plannen/index.html': ['Download in Google Play', 'App Store: binnenkort'],
    'en/roadmap/index.html': ['Get it on Google Play', 'App Store: coming soon'],
  };
  for (const [page, texts] of Object.entries(pages)) {
    const html = read(page);
    for (const text of texts) assert.ok(html.includes(text), `${page}: "${text}" is missing`);
    assert.ok(html.includes(`href="${PLAY_URL}"`), `${page}: no link to the Play store page`);
    assert.match(html, /store-links\.js|main\.js/, `${page}: nothing shows the store links`);
  }
  for (const page of ['nl/plannen/index.html', 'en/roadmap/index.html']) {
    assert.match(read(page), /script-src 'self'/, `${page}: the CSP blocks store-links.js`);
    assert.match(read(page), /<script type="module" src="\.\.\/\.\.\/js\/store-links\.js"><\/script>/);
  }
});

test('every store link ships hidden inside a data-store-links block, opens a new tab, noopener', () => {
  // the same files go into the Android and iOS apps: hidden until store-links.js says "website"
  let count = 0;
  for (const page of htmlFiles()) {
    const html = read(page);
    for (const m of html.matchAll(/<a\b[^>]*play\.google\.com[^>]*>/g)) {
      count++;
      assert.match(m[0], /target="_blank"/, `${page}: ${m[0]}`);
      assert.match(m[0], /rel="noopener"/, `${page}: ${m[0]}`);
      const before = html.slice(0, m.index);
      const open = before.lastIndexOf('data-store-links');
      assert.ok(open >= 0, `${page}: a store link outside a data-store-links block`);
      const tagStart = before.lastIndexOf('<', open);
      const tag = html.slice(tagStart, html.indexOf('>', open) + 1);
      assert.match(tag, /\shidden[\s>]/, `${page}: the store block does not ship hidden: ${tag}`);
      const tagName = tag.match(/^<(\w+)/)[1];
      assert.ok(!before.slice(tagStart).includes(`</${tagName}>`), `${page}: a store link outside its block`);
    }
    assert.doesNotMatch(html, /apps\.apple\.com/, `${page}: no App Store link yet`);
  }
  assert.ok(count >= 3);
});
