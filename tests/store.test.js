import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listing, check, LOCALES } from '../tools/store-to-fastlane.mjs';

// The texts fastlane pushes to Google Play and the App Store must fit the stores' limits.
for (const lang of Object.keys(LOCALES)) {
  test(`store: the ${lang} listing has every field and fits the limits`, () => {
    const f = listing(lang);
    assert.deepEqual(check(f, lang), []);
    assert.ok(f.full.length > 200);
  });
}
