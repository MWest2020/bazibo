# Vendored libraries

Both are used only by "Voortgang overzetten" (web/js/transfer-ui.js). No CDN, no network.

| File | Library | Licence | How it was made |
|---|---|---|---|
| `qrcode-generator/qrcode.min.js` | qrcode-generator 1.4.4 (Kazuhiko Arase) | MIT, `qrcode-generator/LICENSE` | `npm pack qrcode-generator@1.4.4`, bundled as an ES module: `esbuild entry.mjs --bundle --minify --format=esm` (esbuild 0.24.0), entry = `import q from './qrcode.js'; export default q;` |
| `jsqr/jsqr.min.js` | jsQR 1.4.0 (Cosmo Wolfe) | Apache-2.0, `jsqr/LICENSE` | `npm pack jsqr@1.4.0`, the same esbuild command on `dist/jsQR.js`. Loaded only when the browser has no `BarcodeDetector`. |
