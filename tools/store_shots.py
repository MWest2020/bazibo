"""Store screenshots and the Play feature graphic, rendered from the real game in headless
Chromium. Writes store/screenshots/<lang>/<device>/*.png (Dutch and English) and
store/feature-graphic{,-en}-1024x500.png.

Every screenshot sits in the brand's screenshot frame (design/brand/store/screenshot-frame-<lang>.svg:
the mark and the caption on top, the real screen in the middle, the trust row at the bottom, on
paper). The frame is made for Play's 1080x1920; for the App Store sizes the top and the trust row
are scaled as one (never stretched) and the screen area takes the rest. The game is shot on a real
device's screen shape (360x640, 430x932, 768x1024) at the pixel ratio that makes it as large as
fits in that area, so nothing is squeezed or stretched.

Run: uv run --with playwright --with pillow python tools/store_shots.py [--feature | --share]
(--feature: only the two feature graphics, from design/brand/store/ through tools/feature.html,
and then the share image; --share: only web/img/share.png, from the Dutch feature graphic as it is)

The share image (web/img/share.png, the Open Graph picture of bazibo.nl) is the Dutch feature
graphic centred on 1200x630 on its own paper colour, so a link preview never drifts from the store.

The screenshots are flattened to RGB (the App Store refuses images with an alpha channel).
"""
import functools
import http.server
import json
import math
import os
import re
import base64
import socket
import sys
import tempfile
import threading
import xml.etree.ElementTree as ET
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "store"
CHROME = os.environ.get(
    "CHROME",
    "/home/agent/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell",
)
W, H = 400, 760  # the game's logical board, as in tests/smoke.py
SHOOTER = (200, H - 86)

# the store's pixel size and the CSS viewport of the device that is shown in the frame (a real
# phone or tablet shape: the screen is scaled to fit the frame's screen area, never stretched)
DEVICES = {
    "play-phone-1080x1920": ((1080, 1920), {"width": 360, "height": 640}),
    "appstore-iphone-6.9-1290x2796": ((1290, 2796), {"width": 430, "height": 932}),
    # an iPad's 3:4 at 768x1024 CSS (the 13" one's own 1032x1376 makes every word tiny in the store)
    "appstore-ipad-13-2064x2752": ((2064, 2752), {"width": 768, "height": 1024}),
}
SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
# a few stars on the first levels so the level screen looks played
PROGRESS = {"stars": {"1": 3, "2": 3, "3": 2, "4": 3, "5": 2, "6": 1}, "muted": True}


# Screenshots only: a seeded Math.random so the bubble queue is reproducible and we can retry
# with another seed until a shot pops something. The game itself is not changed.
SEEDED_RANDOM = """
(() => {
  let s = 1;
  const next = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Math.random = next;
  window.__seed = (n) => { s = n; };
})();
"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def flatten(path):
    from PIL import Image

    img = Image.open(path)
    if img.mode != "RGB":
        img.convert("RGB").save(path, optimize=True)


def load_frame(lang):
    """The brand's screenshot frame for `lang`, in parts: its size, the paper colour, the defs,
    the mark, the caption (and where it sits), the trust row and the screen area (x, y, w, h, rx)."""
    root = ET.parse(ROOT / "design" / "brand" / "store" / f"screenshot-frame-{lang}.svg").getroot()
    q = lambda tag: f"{{{SVG_NS}}}{tag}"
    kids = list(root)
    rects = [k for k in kids if k.tag == q("rect")]
    groups = [k for k in kids if k.tag == q("g")]
    paper = rects[0].get("fill")
    area = next(r for r in rects if r.get("x"))
    text = lambda el: ET.tostring(el, encoding="unicode")
    # the caption: translate(x baseline) scale(s), centred on the frame
    cx, cy, cs = map(float, re.match(r"translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)", groups[0].get("transform")).groups())
    return {
        "size": (float(root.get("width")), float(root.get("height"))),
        "paper": paper,
        "defs": "".join(text(k) for k in kids if k.tag == q("defs")),
        "mark": "".join(text(k) for k in kids if k.tag == q("use")),
        "caption": text(groups[0]),
        "caption_at": (cx, cy, cs, groups[0].get("fill")),
        "trust": text(groups[1]),
        "area": tuple(float(area.get(a)) for a in ("x", "y", "width", "height", "rx")),
        "edge": area.get("stroke"),
    }


def captions(frame, lang):
    """The caption of every scene in `lang` (design/brand/store/captions.json, made by
    tools/store_captions.py), as SVG on the frame: one size for the whole set, at most the frame's
    own and no wider than its line; shot 1 keeps the frame's own caption."""
    sets = json.loads((ROOT / "design" / "brand" / "store" / "captions.json").read_text())[lang]
    fw = frame["size"][0]
    _, cy, cs, fill = frame["caption_at"]
    widest = 858  # the Dutch frame's line (111 to each side of 1080)
    s = min([cs] + [widest / c["advance"] for c in sets.values()])
    out = {}
    for scene, c in sets.items():
        x = (fw - c["advance"] * s) / 2
        out[scene] = f'<g transform="translate({x:.1f} {cy}) scale({s:.5f})" fill="{fill}"><path d="{c["d"]}"/></g>'
    return out


def frame_layout(frame, size, viewport):
    """Where the screen goes in a frame of `size` pixels: the frame's top and trust row scaled by
    one factor (the narrower of width and height), the screen area in between, and the device's
    screen as large as fits in that area, centred. Returns the frame's scale, the device pixel
    ratio and the screen's box in store pixels."""
    fw, fh = frame["size"]
    ax, ay, aw, ah, _ = frame["area"]
    w, h = size
    k = min(w / fw, h / fh)
    side, top, bottom = ax * k, ay * k, (fh - ay - ah) * k
    aw, ah = w - 2 * side, h - top - bottom
    dpr = min(aw / viewport["width"], ah / viewport["height"])
    sw, sh = round(viewport["width"] * dpr), round(viewport["height"] * dpr)
    box = ((w - sw) / 2, top + (ah - sh) / 2, sw, sh)
    return k, dpr, box


def frame_shot(page, frame, size, k, box, raw, out, caption=None):
    """Put the raw screenshot `raw` into the frame, with `caption` (SVG on the frame) in place of
    the frame's own, and write the store image `out`."""
    fw, fh = frame["size"]
    w, h = size
    x, y, sw, sh = box
    rx = frame["area"][4] * k
    data = base64.b64encode(Path(raw).read_bytes()).decode()
    ox = (w - fw * k) / 2
    svg = f"""<svg xmlns="{SVG_NS}" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{frame['defs']}
  <rect width="{w}" height="{h}" fill="{frame['paper']}"/>
  <g transform="translate({ox} 0) scale({k})">{frame['mark']}{caption or frame['caption']}</g>
  <g transform="translate({ox} {h - fh * k}) scale({k})">{frame['trust']}</g>
  <clipPath id="screen"><rect x="{x}" y="{y}" width="{sw}" height="{sh}" rx="{rx}"/></clipPath>
  <image href="data:image/png;base64,{data}" x="{x}" y="{y}" width="{sw}" height="{sh}" clip-path="url(#screen)" preserveAspectRatio="none"/>
  <rect x="{x}" y="{y}" width="{sw}" height="{sh}" rx="{rx}" fill="none" stroke="{frame['edge']}" stroke-opacity="0.35" stroke-width="{3 * k}"/>
</svg>"""
    page.set_viewport_size({"width": int(w), "height": int(h)})
    page.set_content(f"<!doctype html><html><body style='margin:0'>{svg}</body></html>")
    page.wait_for_timeout(100)
    page.screenshot(path=str(out))
    flatten(out)


SHARE = ROOT / "web" / "img" / "share.png"
REVIEW_IAP = OUT / "review-iap-en.png"


def make_share(src=OUT / "feature-graphic-1024x500.png", dst=SHARE):
    """The link-preview image: the feature graphic centred on 1200x630 (1.91:1, what Open Graph
    previews crop to), padded with the graphic's own background colour."""
    from PIL import Image

    img = Image.open(src).convert("RGB")
    out = Image.new("RGB", (1200, 630), img.getpixel((2, 2)))
    out.paste(img, ((1200 - img.width) // 2, (630 - img.height) // 2))
    out.save(dst, optimize=True)
    print("wrote", dst.relative_to(ROOT), "(run npm run stamp)")


def shoot(browser, base, name, size, viewport, lang):
    """The eight scenes of `name` in `lang`: shot raw on the device's screen, then framed."""
    final = OUT / "screenshots" / lang / name
    final.mkdir(parents=True, exist_ok=True)
    frame = load_frame(lang)
    scale, dpr, screen = frame_layout(frame, size, viewport)  # (k and box are the board's, below)
    tmp_dir = tempfile.TemporaryDirectory()
    out = Path(tmp_dir.name)
    ctx = browser.new_context(
        bypass_csp=True, viewport=viewport, device_scale_factor=dpr, is_mobile=True, has_touch=True,
        locale={"nl": "nl-NL", "en": "en-GB"}[lang],
    )
    ctx.add_init_script(f"localStorage.setItem('bubbels.v1', {json.dumps(json.dumps(PROGRESS))})")
    settings = {"muted": True, "lang": lang}
    ctx.add_init_script(f"localStorage.setItem('bubbels.settings.v1', {json.dumps(json.dumps(settings))})")
    ctx.add_init_script(SEEDED_RANDOM)
    page = ctx.new_page()

    def home():
        """A fresh start on the home screen (every scene starts from there)."""
        page.goto(base + "/index.html?test=1")
        page.wait_for_selector("html[data-ready='1']")
        # as in the app: the store links are for parents on bazibo.nl only (web/js/store-links.js), and
        # a store screenshot must never show a link to a store (the iPad's home screen reaches them)
        page.add_style_tag(content="[data-store-links] { display: none !important; }")

    def how_to():
        """Close the how-to card a game shows on its first round."""
        page.wait_for_timeout(300)
        if page.is_visible("#overlay"):
            page.click("#ov-buttons button")
            page.wait_for_timeout(200)

    shots = []

    def snap(file):
        shots.append(out / file)
        page.screenshot(path=str(shots[-1]))

    # 1. the home screen, every section in sight
    home()
    page.wait_for_timeout(900)
    snap("1-start.png")

    # 2. Winkeltje (3-5): the shopkeeper mouse asks € 3 for a toy car, three euros on the counter
    home()
    page.click("#tile-winkel")
    page.wait_for_timeout(300)
    page.evaluate("window.__bubbels.winkel.start('t1-1')")
    how_to()
    page.evaluate("window.__bubbels.winkel.show(4)")
    page.wait_for_timeout(200)
    q = page.evaluate("window.__bubbels.winkel.state()")["q"]
    for _ in range(q["target"] // 100):
        page.evaluate("window.__bubbels.winkel.lay(100)")
    page.wait_for_timeout(400)
    st = page.evaluate("window.__bubbels.winkel.state()")
    if sum(st["laid"]) != q["target"] or not page.is_visible(".wk-bubble"):
        sys.exit(f"[{name}] Winkeltje: {st['laid']} on the counter for {q['target']}, or no bubble")
    snap("2-winkel.png")

    # 3. Bubbels schieten: level 7, caught the moment a shot pops bubbles
    home()
    page.click("#tile-bubbels")
    page.wait_for_timeout(400)
    if lang == "en" and name.startswith("appstore-iphone"):
        # not a store shot: the App Store review's picture of where the full version sits (the
        # level list with its "Full version" fold; store/forms.md, In-app purchase)
        page.screenshot(path=str(REVIEW_IAP))
        flatten(REVIEW_IAP)
    tmp = out / "3-pop.png"
    caught = False
    for seed in range(1, 9):
        page.evaluate(f"window.__seed({seed}); window.__bubbels.play(6)")  # level 7: a colourful board
        page.wait_for_timeout(900)
        box = page.locator("#game").bounding_box()
        k = box["width"] / W

        def to_page(x, y):
            return box["x"] + x * k, box["y"] + y * k

        def aim(deg):
            a = math.radians(deg)
            sx, sy = to_page(*SHOOTER)
            tx, ty = to_page(SHOOTER[0] + math.cos(a) * 260, SHOOTER[1] - math.sin(a) * 260)
            page.mouse.move(sx, sy - 40 * k)
            page.mouse.down()
            page.mouse.move(tx, ty, steps=6)
            page.wait_for_timeout(150)

        # fire until a shot pops bubbles, and catch the moment the pop starts
        for deg in (82, 98, 110, 70, 120, 90):
            before = page.evaluate("window.__bubbels.state().bubbles")
            aim(deg)
            page.mouse.up()
            for _ in range(30):
                page.wait_for_timeout(50)
                st = page.evaluate("window.__bubbels.state()")
                if st["effects"] > 0 and st["bubbles"] < before:
                    page.wait_for_timeout(70)
                    page.screenshot(path=str(tmp))
                    caught = True
                    break
            page.wait_for_function("['aim','won','lost'].includes(window.__bubbels.state().phase) && window.__bubbels.state().effects === 0", timeout=8000)
            if caught or page.evaluate("window.__bubbels.state().phase") != "aim":
                break
        if caught:
            break
    if not caught:
        page.screenshot(path=str(tmp))
        print(f"[{name}] no popping shot caught; 3-pop.png shows the board")
    shots.append(tmp)

    # 4. Treintje (3-5): the track laid past every station, the little train riding along it
    home()
    page.click("#tile-treintje")
    page.wait_for_timeout(300)
    page.evaluate("window.__bubbels.treintje.start('a3', 11)")
    how_to()
    sol = page.evaluate("window.__bubbels.treintje.state()")["solution"]
    at = lambda i: page.evaluate(f"window.__bubbels.treintje.at({i})")
    x, y = at(sol[0])
    page.mouse.move(x, y)
    page.mouse.down()
    for c in sol[1:]:
        x1, y1 = at(c)
        for step in range(1, 6):
            page.mouse.move(x + (x1 - x) * step / 5, y + (y1 - y) * step / 5)
        x, y = x1, y1
    page.mouse.up()
    # the whole train on the bottom row, past station 1 and before it turns up the right side
    page.wait_for_function("""(() => {
      const b = document.querySelector('#tj-board').getBoundingClientRect();
      const st = window.__bubbels.treintje.state(), cw = b.width / st.w, ch = b.height / st.h;
      const cars = [...document.querySelectorAll('#tj-train .tj-car')].map((c) => c.getBoundingClientRect());
      return cars.length > 0 && cars.every((r) => r.top + r.height / 2 > b.top + (st.h - 1) * ch + ch * 0.2
        && r.left + r.width / 2 > b.left + cw * 0.5 && r.left + r.width / 2 < b.left + (st.w - 1) * cw);
    })()""", polling=20, timeout=10000)
    st = page.evaluate("window.__bubbels.treintje.state()")
    if not st["riding"] or page.is_visible("#overlay"):
        sys.exit(f"[{name}] Treintje: the train is not riding ({st['path']} of {sol})")
    snap("4-treintje.png")

    # 5. Klok kijken (6-7): "set the clock" with half hours, the hand to look at glowing
    home()
    page.click("#tile-klok")
    page.wait_for_timeout(300)
    page.evaluate("window.__bubbels.klok.start('set-t2-1')")
    how_to()
    page.click("#klok-hint")
    page.wait_for_timeout(500)
    snap("5-klok.png")

    # 6. Keukentje (3-5): every ingredient in its bowl, the cook bear with the dish ready
    home()
    page.click("#tile-keuken")
    page.wait_for_timeout(300)
    page.evaluate("window.__bubbels.keuken.start('t1-1')")
    how_to()
    for ingredient in page.evaluate("window.__bubbels.keuken.state()")["todo"]:
        page.evaluate(f"window.__bubbels.keuken.tap({json.dumps(ingredient)})")
        page.wait_for_timeout(250)
    page.wait_for_timeout(500)
    st = page.evaluate("window.__bubbels.keuken.state()")
    if (st["line"] or {}).get("key") != "keuken.ready" or page.is_visible("#overlay"):
        sys.exit(f"[{name}] Keukentje: the dish is not ready ({st['line']})")
    snap("6-keuken.png")

    # 7. Picturedoku (8-10): a 9×9 with pictures and pencil notes
    home()
    page.click("#tile-picturedoku")
    page.wait_for_timeout(300)
    fill = 14
    page.evaluate("window.__bubbels.pdoku.play(43)")
    how_to()
    pz = page.evaluate("window.__bubbels.pdoku.puzzle()")
    empties = [i for i, ch in enumerate(pz["givens"]) if ch == "."]
    for i in empties[:fill]:
        page.evaluate(f"window.__bubbels.pdoku.tapCell({i}); window.__bubbels.pdoku.tapPalette({pz['solution'][i]})")
    page.click("#pdoku-pencil")  # a few pencil notes, then a chosen square
    for i in empties[fill:fill + 3]:
        page.evaluate(f"window.__bubbels.pdoku.tapCell({i})")
        for v in page.evaluate(f"window.__bubbels.pdoku.candidates({i})")[:3]:
            page.evaluate(f"window.__bubbels.pdoku.tapPalette({v})")
        page.evaluate(f"window.__bubbels.pdoku.tapCell({i})")
    page.click("#pdoku-pencil")
    page.evaluate(f"window.__bubbels.pdoku.tapCell({empties[-1]})")
    page.wait_for_timeout(500)
    snap("7-picturedoku-9x9.png")

    # 8. Kleurplaten: a free mandala, coloured ring by ring with the mirror on
    home()
    page.click("#tile-kleuren")
    page.wait_for_timeout(300)
    page.evaluate("""(() => {
      const k = window.__bubbels.kleur;
      k.open('f:m1:2207');
      const ids = k.state().regions;
      const groups = [...new Set(ids.map((id) => id.replace(/\\d+$/, '')))];
      const colours = [0, 2, 9, 7, 3, 1, 8, 5, 6, 4, 11];
      k.mirror(true);
      groups.forEach((g, i) => { k.pick(colours[i % colours.length]); k.paint(ids.find((id) => id.replace(/\\d+$/, '') === g)); });
      k.pick(9);
    })()""")
    page.wait_for_timeout(400)
    snap("8-kleurplaat.png")
    ctx.close()
    caps = captions(frame, lang)
    for old in final.glob("*.png"):  # a scene that made way for another leaves no file behind
        old.unlink()
    framer = browser.new_page()
    framed = []
    for raw in shots:
        framed.append(final / raw.name)
        frame_shot(framer, frame, size, scale, screen, raw, framed[-1], caps.get(raw.stem.split("-", 1)[1]))
    framer.close()
    tmp_dir.cleanup()
    return framed


def main():
    if "--share" in sys.argv:
        make_share()
        return
    port = free_port()
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}/web"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME)
            for lang in () if "--feature" in sys.argv else ("nl", "en"):
                for name, (size, viewport) in DEVICES.items():
                    for s in shoot(browser, base, name, size, viewport, lang):
                        print("wrote", s.relative_to(ROOT))
            page = browser.new_page(viewport={"width": 1024, "height": 500})
            for lang, fg in (("nl", OUT / "feature-graphic-1024x500.png"), ("en", OUT / "feature-graphic-en-1024x500.png")):
                page.goto(f"http://127.0.0.1:{port}/tools/feature.html?lang={lang}")
                page.wait_for_selector("html[data-ready='1']")
                page.wait_for_timeout(300)
                page.screenshot(path=str(fg))
                flatten(fg)
                print("wrote", fg.relative_to(ROOT))
            browser.close()
        make_share()
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
