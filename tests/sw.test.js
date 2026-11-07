import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assets, currentVersion, expectedVersion, webFiles } from '../tools/sw-version.mjs';

test('the service worker caches every file the game ships', () => {
  const listed = new Set(assets());
  for (const f of webFiles()) assert.ok(listed.has(f), `web/${f} is missing from ASSETS in web/sw.js`);
  assert.ok(listed.has('./'));
});

test('the cache name matches the content (run `npm run stamp` after changing web/)', () => {
  assert.equal(currentVersion(), expectedVersion());
});
