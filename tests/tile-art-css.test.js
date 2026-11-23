import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// PR #95: with the home bubbles gone, the first paint of the home screen hung Chrome (159, the
// Playwright headless shell) in layerization (PaintArtifactCompositor::Update) and the renderer
// grew to gigabytes. The trigger was `#tile-baghchal .tile-art svg { filter: drop-shadow(...) }`
// (and the same in dammen and schaak): a descendant selector, so the filter also landed on the
// <svg> pieces NESTED inside the tile drawing. Only the drawing's root may carry a filter.
const WEB = new URL('../web/', import.meta.url).pathname;

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'vendor' ? [] : cssFiles(p);
    return e.name.endsWith('.css') ? [p] : [];
  });
}

/** [selector, body] for every innermost rule of a stylesheet (comments dropped). */
export function rules(css) {
  const out = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push([m[1].trim(), m[2]]);
  return out;
}

/** A selector that reaches an svg inside .tile-art without the child combinator (so nested ones too). */
export const reachesNestedSvg = (sel) => /\.tile-art\b[^,]*\ssvg\b/.test(sel.replace(/\s*>\s*/g, '>'));

test('the rule reader and the selector check', () => {
  assert.deepEqual(rules('/* x */ a b { filter: none; } @media (x) { .c { color: red } }').map(([s]) => s), ['a b', '.c']);
  assert.ok(reachesNestedSvg('#tile-dammen .tile-art svg'));
  assert.ok(!reachesNestedSvg('#tile-dammen .tile-art > svg'));
  assert.ok(!reachesNestedSvg('#tile-dammen .tile-art>svg'));
});

test('no filter on svgs nested in a home tile drawing (it hangs Chrome on the home screen)', () => {
  const bad = [];
  for (const file of cssFiles(WEB)) {
    for (const [selector, body] of rules(readFileSync(file, 'utf8'))) {
      if (!/(^|;|\s)filter\s*:/.test(body)) continue;
      for (const sel of selector.split(',')) if (reachesNestedSvg(sel)) bad.push(`${file.slice(WEB.length)}: ${sel.trim()}`);
    }
  }
  assert.deepEqual(bad, [], 'use `.tile-art > svg` so only the root svg gets the filter');
});
