"""Make web/fonts/bazibo-sans.woff2 from the upstream Nunito variable font (SIL OFL 1.1, no
Reserved Font Name). Run once by hand when the font changes; the app has no build step.

  curl -L -o /tmp/Nunito.ttf "https://github.com/google/fonts/raw/main/ofl/nunito/Nunito%5Bwght%5D.ttf"
  uv run --with fonttools==4.68.0 --with brotli==1.2.1 python tools/subset_font.py /tmp/Nunito.ttf

Pinned versions: the same input with the same fontTools and brotli gives the same bytes. A newer
fontTools may write a slightly different file; then commit that file and update these pins.

Keeps the weight axis from 400 to 900 (what the stylesheets use) and Latin plus Latin Extended
(Dutch, English and the accented names in the games), so the file stays small. Prints its size and
the sha256 of both files, as recorded in CREDITS.md.
"""
import hashlib
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "fonts" / "bazibo-sans.woff2"
# Basic Latin, Latin-1, Latin Extended-A/B, Latin Extended Additional, punctuation, euro, arrows
UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0100-024F,U+0259,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+1E00-1EFF,"
    "U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD"
)


def main(src):
    data = Path(src).read_bytes()
    font = TTFont(src, lazy=False)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "tnum", "lnum"]
    opts.name_IDs = ["*"]  # keep the copyright and licence names
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, {"wght": (400, 900)})
    font.recalcTimestamp = False  # keep upstream's date in the head table, so the bytes are reproducible
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(OUT), opts)
    out = OUT.read_bytes()
    print(f"{OUT.relative_to(ROOT)}: {len(out)} bytes, sha256 {hashlib.sha256(out).hexdigest()}; "
          f"source sha256 {hashlib.sha256(data).hexdigest()}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
