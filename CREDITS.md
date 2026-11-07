# Credits

Bubbels ships no third-party code, fonts, images or sounds.

| Asset | Author | Licence | Source |
|---|---|---|---|
| Game code, bubble drawing, icons (`web/icons/*.png`, rendered by `tools/make_icons.py`) | MWest2020 (with Claude Code) | MIT | this repository |
| Sounds | synthesised at runtime with the Web Audio API in `web/js/audio.js`; no sound files | MIT | this repository |
| UI icons (inline SVG paths in `web/index.html` and `web/js/main.js`) | MWest2020 (with Claude Code) | MIT | this repository |
| Bubble colours | based on the Okabe-Ito colour-blind-safe palette (Masataka Okabe and Kei Ito, "Color Universal Design", 2002), brightened | colour values, not copyrightable | https://jfly.uni-koeln.de/color/ |
| Font | none bundled; the device's own system font is used | n/a | n/a |

Development only (not shipped in `web/`):

| Tool | Licence | Source |
|---|---|---|
| Playwright (smoke test, icon rendering) | Apache-2.0 | https://github.com/microsoft/playwright-python |
| Node.js test runner (`node --test`) | MIT | https://nodejs.org |

Any asset added later must be CC0, MIT, BSD or Apache-2.0 and must get a row here.
