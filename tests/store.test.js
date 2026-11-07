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

test('store: iPhone and iPad screenshots both survive in the App Store folder', async () => {
  const { main } = await import('../tools/store-to-fastlane.mjs');
  const { mkdtempSync, readdirSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const out = mkdtempSync(join(tmpdir(), 'bubbels-meta-'));
  try {
    const log = console.log;
    console.log = () => {};
    try {
      assert.equal(main(out), true);
    } finally {
      console.log = log;
    }
    for (const loc of ['nl-NL', 'en-US']) {
      const files = readdirSync(join(out, 'ios-screenshots', loc));
      // 8 per device: 3 of Bubbels schieten, 2 of Dogudoku, 1 of Picturedoku, 2 of Vier op een rij
      // (Google Play takes at most 8; the App Store up to 10)
      assert.equal(files.filter((f) => f.startsWith('iphone-')).length, 8);
      assert.equal(files.filter((f) => f.startsWith('ipad-')).length, 8);
      assert.equal(readdirSync(join(out, 'android', loc, 'images', 'phoneScreenshots')).length, 8);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
