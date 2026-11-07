"""Playwright smoke test: serve web/ locally, play level 1 with 5 real drag-and-release shots,
check that nothing went to the network and nothing threw, and save screenshots to shots/.

Run: uv run --with playwright python tests/smoke.py
"""
import functools
import http.server
import math
import os
import socket
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
SHOTS = ROOT / "shots"
CHROME = os.environ.get(
    "CHROME",
    "/home/agent/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell",
)
W, H = 400, 760
SHOOTER = (200, H - 86)
ANGLES = [90, 68, 112, 50, 32]  # the last one goes off the right wall


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def run(browser, base, name, context_args, problems):
    # bypass_csp: the page CSP forbids eval, which Playwright needs for wait_for_function
    ctx = browser.new_context(bypass_csp=True, **context_args)
    page = ctx.new_page()
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))

    page.goto(base + "/index.html")
    page.wait_for_selector("html[data-ready='1']")
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / f"{name}-1-home.png"))

    page.click("#btn-levels")
    page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / f"{name}-2-levels.png"))

    page.click("#levels-free .level-btn >> nth=0")
    page.wait_for_timeout(500)
    box = page.locator("#game").bounding_box()
    k = box["width"] / W

    def to_page(x, y):
        return box["x"] + x * k, box["y"] + y * k

    def wait_aim():
        page.wait_for_function(
            "['aim','won','lost'].includes(window.__bubbels.state().phase) && window.__bubbels.state().effects === 0",
            timeout=8000,
        )

    for i, deg in enumerate(ANGLES):
        wait_aim()
        if page.evaluate("window.__bubbels.state().phase") != "aim":
            break
        a = math.radians(deg)
        sx, sy = to_page(*SHOOTER)
        tx, ty = to_page(SHOOTER[0] + math.cos(a) * 260, SHOOTER[1] - math.sin(a) * 260)
        page.mouse.move(sx, sy - 40 * k)
        page.mouse.down()
        page.mouse.move(tx, ty, steps=6)
        if i in (0, 4):
            page.wait_for_timeout(120)
            page.screenshot(path=str(SHOTS / f"{name}-3-aim-shot{i + 1}.png"))
        page.mouse.up()
        if i == 1:
            page.wait_for_timeout(380)
            page.screenshot(path=str(SHOTS / f"{name}-4-in-flight.png"))
    wait_aim()
    page.wait_for_timeout(200)
    state = page.evaluate("window.__bubbels.state()")
    page.screenshot(path=str(SHOTS / f"{name}-5-after-5-shots.png"))

    # pause card, then the friendly locked screen for level 11
    page.click("#btn-pause")
    page.wait_for_timeout(350)
    page.screenshot(path=str(SHOTS / f"{name}-6-pause.png"))
    page.click("#ov-buttons button >> text=Levels")
    page.click("#levels-full .level-btn >> nth=0")
    page.wait_for_timeout(350)
    page.screenshot(path=str(SHOTS / f"{name}-7-locked.png"))

    # offline: the service worker must serve the whole game without the server
    page.evaluate("navigator.serviceWorker.ready.then(() => true)")
    page.wait_for_timeout(300)
    ctx.set_offline(True)
    page.reload()
    try:
        page.wait_for_selector("html[data-ready='1']", timeout=5000)
        offline_ok = True
    except Exception:
        offline_ok = False
        problems.append(f"{name}: game did not start offline")
    ctx.set_offline(False)

    print(f"[{name}] state after shots: {state}; offline start: {offline_ok}")
    if state["shots"] < 5 and state["phase"] == "aim":
        problems.append(f"{name}: only {state['shots']} shots registered")
    if errors:
        problems.append(f"{name}: page errors: {errors}")
    if foreign:
        problems.append(f"{name}: requests outside the local server: {foreign}")
    ctx.close()


def main():
    SHOTS.mkdir(exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=str(WEB)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    problems = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME)
            run(browser, base, "desktop", {"viewport": {"width": 1280, "height": 800}}, problems)
            run(
                browser,
                base,
                "phone",
                {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True},
                problems,
            )
            browser.close()
    finally:
        httpd.shutdown()
    if problems:
        print("FAIL")
        for line in problems:
            print(" -", line)
        sys.exit(1)
    print(f"OK: screenshots in {SHOTS}")


if __name__ == "__main__":
    main()
