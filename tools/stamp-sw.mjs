// Write the content-hash cache name into web/sw.js. Run after changing anything under web/.
import { readFileSync, writeFileSync } from 'node:fs';
import { SW, currentVersion, expectedVersion } from './sw-version.mjs';

const src = readFileSync(SW, 'utf8');
const before = currentVersion(src);
const after = expectedVersion();
if (before === after) {
  console.log(`web/sw.js already at ${after}`);
} else {
  writeFileSync(SW, src.replace(`const VERSION = '${before}';`, `const VERSION = '${after}';`));
  console.log(`web/sw.js: ${before} -> ${after}`);
}
