# Licences

## The artwork

Everything in `design/brand/` — every mark, letterform, icon and store image, round 3 included —
was drawn for Bazibo as plain SVG geometry. No stock, no traced material, no third-party artwork.
The round-3 mark (the cut-paper b on its coloured scraps) and the drawn `bazibo` lettering are my
own path data, carried over and reworked from the round-2 directions `knipsel` and `kralen`.

**CC0-1.0** (public domain dedication). Bazibo may use, change and relicense all of it, in the
app, in the stores, on the site and in the public MIT repository, without attribution.

## Fonts

Only SIL Open Font License 1.1 fonts are used, and only as outlines: every piece of text in the
logo and the store art is converted to paths (`design-kit text2path`), so nothing here loads a
font and nothing here needs a webfont or a CDN.

| Family | Used for | Licence | Licence file |
|---|---|---|---|
| Fredoka | display: the store captions and the feature-graphic line | SIL Open Font License 1.1 (OFL-1.1) | `/opt/habitat/fonts/fredoka/OFL.txt` |
| Nunito | text: the trust rows | SIL Open Font License 1.1 (OFL-1.1) | `/opt/habitat/fonts/nunito/OFL.txt` |
| Andika | reading: letter tiles in the learning games (named in `tokens.json`, not used in this artwork) | SIL Open Font License 1.1 (OFL-1.1) | `/opt/habitat/fonts/andika/OFL.txt` |
| Baloo 2 | display in the round-2 palette of `directions/knipsel/tokens.json` (history; not used in the round-3 set) | SIL Open Font License 1.1 (OFL-1.1) | `/opt/habitat/fonts/baloo2/OFL.txt` |
| Lexend | text in the round-2 palette of `directions/knipsel/tokens.json` (history; not used in the round-3 set) | SIL Open Font License 1.1 (OFL-1.1) | `/opt/habitat/fonts/lexend/OFL.txt` |

Shipping a font with the app means copying its `OFL.txt` into `web/fonts/<family>/` and listing
it in `CREDITS.md`, as the repository's rules already require for Nunito.

The `bazibo` wordmark is **not** set in any of these: its letters are drawn by hand in this
delivery (`logo/wordmark.svg`), so the name carries no font licence at all.

## What is not here

No image models, no stock libraries, no tracing of other marks, no AI-generated artwork. The
shapes are hand-written path data; the only machine step is `design-kit text2path`, which turns
the OFL fonts above into outlines.
