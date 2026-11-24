// The brand in the app is the brand in design/brand/ (round 3, Mark 24 Nov 2026): the logo
// paths in web/js/logo.js match the SVG files, the colour tokens in web/css/style.css match
// tokens.json, and the contrast rules of AGENTS.md hold for them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markSvg, wordmarkSvg, WORDMARK_LETTERS } from '../web/js/logo.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const GROUPS = ['learning', 'puzzles', 'board', 'creative', 'action'];

// every <path>'s d and fill, in order (title, desc and comments left out)
function paths(svg) {
  return [...svg.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<path\b([^>]*)>/g)].map(([, attrs]) => ({
    d: /\bd="([^"]*)"/.exec(attrs)[1],
    fill: (/\bfill="([^"]*)"/.exec(attrs) || [])[1]?.toLowerCase(),
  }));
}

test('the mark and every group mark draw exactly the paths and colours of design/brand/logo/', () => {
  assert.deepEqual(paths(markSvg()), paths(read('design/brand/logo/mark.svg')));
  for (const g of GROUPS) assert.deepEqual(paths(markSvg(g)), paths(read(`design/brand/logo/mark-${g}.svg`)), g);
});

test('the wordmark draws the letters of design/brand/logo/wordmark.svg, placed the same way', () => {
  const src = read('design/brand/logo/wordmark.svg');
  const ours = wordmarkSvg();
  for (const { d } of paths(src)) assert.ok(ours.includes(`d="${d}"`), `missing path ${d.slice(0, 30)}`);
  const uses = [...src.matchAll(/<use href="#wordmark-(\w+)" transform="([^"]*)"/g)].map(([, id, tf]) => [id, tf]);
  const letters = uses.filter(([id]) => id !== 'bead');
  assert.deepEqual(WORDMARK_LETTERS.map(([l, tf]) => [l, tf]), letters);
  const bead = uses.find(([id]) => id === 'bead');
  assert.ok(ours.includes(`transform="${bead[1]}"`) && ours.includes('fill="#d9663f"'), 'the bead');
});

test('the inline logo keeps to the CSP and the page: no ids, no url(#), no style, hidden from screen readers', () => {
  for (const svg of [markSvg(), ...GROUPS.map(markSvg), wordmarkSvg()]) {
    assert.doesNotMatch(svg, /\sid=|url\(#|style=|<use|href=/);
    assert.match(svg, /aria-hidden="true"/);
  }
  assert.doesNotMatch(read('web/js/logo.js'), /Bazibo['"]/, 'the brand name lives in brand.js');
});

// ---- colour ----

function tokens() {
  const css = read('web/css/style.css');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')));
  const out = {};
  for (const [, name, val] of root.matchAll(/--bz-([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[name] = val.toLowerCase();
  return out;
}
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('the colour tokens are the brand palette of design/brand/tokens.json', () => {
  const brand = JSON.parse(read('design/brand/tokens.json')).color;
  const t = tokens();
  assert.equal(t.base, brand.base);
  assert.equal(t.ink, brand.ink);
  assert.equal(t['ink-soft'], brand['ink-soft']);
  assert.equal(t.brand, brand.brand);
  for (const g of GROUPS) {
    const want = brand.groups[g];
    assert.deepEqual([t[`${g}-acc`], t[`${g}-tint`], t[`${g}-ink`]], [want.accent, want.tint, want.text], g);
  }
});

test('AGENTS.md contrast: accents 3:1 on white and the page, group ink 4.5:1 on its tint, text 4.5:1 on the page', () => {
  const t = tokens();
  for (const g of GROUPS) {
    for (const bg of ['#ffffff', t.base]) assert.ok(ratio(t[`${g}-acc`], bg) >= 3, `${g} accent on ${bg}: ${ratio(t[`${g}-acc`], bg).toFixed(2)}`);
    for (const bg of [t[`${g}-tint`], '#ffffff', t.base]) assert.ok(ratio(t[`${g}-ink`], bg) >= 4.5, `${g} ink on ${bg}`);
  }
  for (const k of ['ink', 'ink-soft', 'ink-quiet', 'brand', 'brand-dark']) {
    for (const bg of ['#ffffff', t.base, t['brand-tint']]) assert.ok(ratio(t[k], bg) >= 4.5, `${k} on ${bg}: ${ratio(t[k], bg).toFixed(2)}`);
  }
  assert.ok(ratio('#ffffff', t.brand) >= 4.5, 'white on the brand button');
  assert.ok(ratio(t.ink, t.accent) >= 4.5, 'ink on the accent button');
});
