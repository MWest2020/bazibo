"""The captions of the store screenshots, set in Fredoka SemiBold and converted to outlines, so the
screenshot tool loads no font (design/brand/LICENSES.md). Writes design/brand/store/captions.json:
per language and scene, the caption's text, its advance width in font units and its path (y down,
the baseline at 0), the same shape as the caption in the brand's screenshot frames
(`design-kit text2path`: no kerning, 1000 units to the em). Shot 1 keeps the frame's own caption.

Run by hand when a caption changes, then tools/store_shots.py:

  curl -L -o /tmp/Fredoka.ttf "https://github.com/google/fonts/raw/main/ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf"
  uv run --with fonttools==4.68.0 python tools/store_captions.py --check /tmp/Fredoka.ttf

`--check` (always use it) also sets the Dutch frame's caption and fails unless it comes out exactly as in
design/brand/store/screenshot-frame-nl.svg (the same font, weight and setting as the brand).
"""
import json
import re
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "design" / "brand" / "store" / "captions.json"

# Short, like the frame's own line; the games by the names they have in the app (web/games/*/strings.js)
CAPTIONS = {
    "nl": {
        "winkel": "Winkeltje: betalen met munten",
        "pop": "Bubbels schieten: mik en knal",
        "treintje": "Treintje: leg het spoor",
        "klok": "Klok kijken: hoe laat is het?",
        "keuken": "Keukentje: wat gaat erin?",
        "picturedoku-9x9": "Picturedoku: plaatjespuzzels",
        "kleurplaat": "Kleurplaten: mandala's kleuren",
    },
    "en": {
        "winkel": "Little Shop: pay with coins",
        "pop": "Bubble Shooter: aim and pop",
        "treintje": "Train Tracks: lead the train",
        "klok": "Telling Time: what time is it?",
        "keuken": "Little Kitchen: what goes in?",
        "picturedoku-9x9": "Picturedoku: picture puzzles",
        "kleurplaat": "Colouring: mandalas",
    },
}


def setter(src):
    font = instantiateVariableFont(TTFont(src), {"wght": 600, "wdth": 100})
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()

    def outline(text):
        pen, x = SVGPathPen(glyphs, ntos=lambda v: f"{round(v, 1):g}"), 0
        for ch in text:
            g = glyphs[cmap[ord(ch)]]
            g.draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
            x += g.width
        return {"text": text, "advance": x, "d": pen.getCommands()}

    return outline


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    src = args[0] if args else "/opt/habitat/fonts/fredoka/Fredoka[wdth,wght].ttf"
    outline = setter(src)
    if "--check" in sys.argv:
        svg = (ROOT / "design" / "brand" / "store" / "screenshot-frame-nl.svg").read_text()
        brand = re.search(r'scale\(0\.059\)" fill="#28245c">\s*<path d="([^"]+)"', svg).group(1)
        nums = lambda s: [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", s)]
        ours = nums(outline("Spelen en leren, zonder reclame")["d"])
        if len(ours) != len(nums(brand)) or max(abs(a - b) for a, b in zip(ours, nums(brand))) > 0.06:
            sys.exit("the frame's caption does not come out the same: another Fredoka?")
        print("the frame's caption comes out the same")
    data = {lang: {scene: outline(text) for scene, text in scenes.items()} for lang, scenes in CAPTIONS.items()}
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    print("wrote", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
