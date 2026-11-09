# Vendored libraries

Used only by "Voortgang overzetten" (web/js/transfer-ui.js, web/js/transfer.js). No CDN, no network.

| File | Library | Licence | How it was made |
|---|---|---|---|
| `qrcode-generator/qrcode.min.js` | qrcode-generator 1.4.4 (Kazuhiko Arase) | MIT, `qrcode-generator/LICENSE` | from `npm pack qrcode-generator@1.4.4`, bundled as an ES module with `esbuild entry.mjs --bundle --minify --format=esm` (esbuild 0.24.0); entry: `import q from './qrcode.js'; export default q;` |
| `jsqr/jsqr.min.js` | jsQR 1.4.0 (Cosmo Wolfe) | Apache-2.0, `jsqr/LICENSE` | from `npm pack jsqr@1.4.0`, the same esbuild command on `dist/jsQR.js`. Loaded only when the browser has no `BarcodeDetector`. |
| `fflate/fflate.min.js` | fflate 0.8.2 (Arjun Barrett), only `unzlibSync` | MIT, `fflate/LICENSE` | from `npm pack fflate@0.8.2`, `export { unzlibSync } from './esm/browser.js'` bundled the same way. Loaded only when the browser has no `DecompressionStream` (iOS before 16.4). |

The npm tarballs these were built from (sha256), so a rebuild can be compared:

| Tarball | sha256 |
|---|---|
| `qrcode-generator-1.4.4.tgz` | `ab6ed47d378877441deae95972e07b2716c26545a735a23aa6b9d442b33026ed` |
| `jsqr-1.4.0.tgz` | `b5299b37917a1fe7a8cab9dd5cc6b8accf82663add80abe5bf7761a921cc6602` |
| `fflate-0.8.2.tgz` | `61fd5061e2fc8e5e3e3129f7f2fec7bd78a313e1bf4becbf1cc1cc9998d141dc` |

The minified bundles themselves are not byte-identical to anything published upstream (they are
our esbuild output); rebuild with the commands above to check them.
