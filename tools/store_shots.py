"""Store screenshots and the Play feature graphic, rendered from the real game in headless
Chromium. Writes store/screenshots/<lang>/<device>/*.png (Dutch and English) and
store/feature-graphic{,-en}-1024x500.png.

Run: uv run --with playwright --with pillow python tools/store_shots.py

The screenshots are flattened to RGB (the App Store refuses images with an alpha channel).
"""
import functools
import http.server
import json
import math
import os
import socket
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "store"
CHROME = os.environ.get(
    "CHROME",
    "/home/agent/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell",
)
W, H = 400, 760  # the game's logical board, as in tests/smoke.py
SHOOTER = (200, H - 86)

# CSS viewport x device pixel ratio = the store's pixel size
DEVICES = {
    "play-phone-1080x1920": ({"width": 360, "height": 640}, 3),
    "appstore-iphone-6.9-1290x2796": ({"width": 430, "height": 932}, 3),
    "appstore-ipad-13-2064x2752": ({"width": 1032, "height": 1376}, 2),
}
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


def shoot(browser, base, name, viewport, dpr, lang):
    out = OUT / "screenshots" / lang / name
    out.mkdir(parents=True, exist_ok=True)
    ctx = browser.new_context(
        bypass_csp=True, viewport=viewport, device_scale_factor=dpr, is_mobile=True, has_touch=True,
        locale={"nl": "nl-NL", "en": "en-GB"}[lang],
    )
    ctx.add_init_script(f"localStorage.setItem('bubbels.v1', {json.dumps(json.dumps(PROGRESS))})")
    settings = {"muted": True, "lang": lang}
    ctx.add_init_script(f"localStorage.setItem('bubbels.settings.v1', {json.dumps(json.dumps(settings))})")
    ctx.add_init_script(SEEDED_RANDOM)
    page = ctx.new_page()
    page.goto(base + "/index.html?test=1")
    page.wait_for_selector("html[data-ready='1']")
    page.wait_for_timeout(900)
    shots = [out / "1-start.png"]
    page.screenshot(path=str(shots[-1]))

    page.click("#tile-bubbels")
    page.wait_for_timeout(400)
    shots.append(out / "2-levels.png")
    page.screenshot(path=str(shots[-1]))

    tmp = out / "4-pop.png"
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

        if seed == 1:
            aim(64)  # shows the dotted guide line and the ghost bubble where the shot will land
            shots.append(out / "3-aim.png")
            page.screenshot(path=str(shots[-1]))
            page.mouse.up()
            page.wait_for_function("window.__bubbels.state().phase === 'aim' && window.__bubbels.state().effects === 0", timeout=8000)

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
        print(f"[{name}] no popping shot caught; 4-pop.png shows the board")
    shots.append(tmp)

    # Dogudoku: a 4×4 garden for the youngest, and a 6×6 with crosses for the older ones
    page.evaluate("document.querySelector('#overlay').hidden = true; document.querySelector('[data-go=home]').click()")
    page.click("#tile-dogudoku")
    page.wait_for_timeout(300)
    for pid, file, place, auto in ((1, "5-dogudoku-4x4.png", 2, False), (27, "6-dogudoku-6x6.png", 3, True)):
        page.evaluate(f"window.__bubbels.dogu.play({pid})")
        page.wait_for_timeout(300)
        if page.is_visible("#overlay"):
            page.click("#ov-buttons button")
        if auto:
            page.click("#dogu-auto")
        pz = page.evaluate("window.__bubbels.dogu.puzzle()")
        taps = 1 if pz["tier"] == "tiny" else 2
        for r in range(place):
            for _ in range(taps):
                page.evaluate(f"window.__bubbels.dogu.tapCell({r}, {pz['solution'][r]})")
        if pz["tier"] != "tiny":  # one cross the child set by hand
            r = pz["n"] - 1
            page.evaluate(f"window.__bubbels.dogu.tapCell({r}, {(pz['solution'][r] + 2) % pz['n']})")
        page.wait_for_timeout(500)
        shots.append(out / file)
        page.screenshot(path=str(shots[-1]))
    ctx.close()
    for s in shots:
        flatten(s)
    return shots


def main():
    port = free_port()
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}/web"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME)
            for lang in ("nl", "en"):
                for name, (viewport, dpr) in DEVICES.items():
                    for s in shoot(browser, base, name, viewport, dpr, lang):
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
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
