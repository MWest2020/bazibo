"""Playwright smoke test: serve web/ locally, open Bubbels from the home screen, play level 1 with
5 real drag-and-release shots, solve the first Dogudoku puzzle by tapping (with one wrong puppy
first, which must light up), solve the first Picturedoku puzzle (one wrong picture first, then
square-then-picture) and try picture-first on a 6×6, check that nothing went to the network and nothing threw, that the
animation loops stop when they are not needed, that settings, the language switch, the parental
gate and the free-tier offer work in Dutch and English, that a returning player keeps their
progress, and save screenshots to shots/ (also a sideways phone).

Run: uv run --with playwright python tests/smoke.py
"""
import functools
import http.server
import math
import os
import re
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


WORDS = {
    "nl": ["nul", "een", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien", "elf", "twaalf"],
    "en": ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"],
}
# what the page must say, per language
TEXT = {
    "nl": {"ok": "Oké", "promise": "Geen reclame. Nooit.", "tile": "Bubbels schieten", "soon": "Komt eraan!",
           "more": "Meer levels", "wrong": "Dat klopt niet", "ask": r"Hoeveel is (\w+) keer (\w+)\?",
           "settings": "Instellingen", "puzzles": "Puzzels", "stars3": "3 van 3", "dogWin": "Super!",
           "brand": "Idaveld", "lore": "Idaveld: waar de goden speelden"},
    "en": {"ok": "OK", "promise": "No ads. Ever.", "tile": "Bubble Shooter", "soon": "Coming soon!",
           "more": "More levels", "wrong": "That is not right", "ask": r"What is (\w+) times (\w+)\?",
           "settings": "Settings", "puzzles": "Puzzles", "stars3": "3 of 3", "dogWin": "Super!",
           "brand": "Idaveld", "lore": "Idaveld: where the gods played"},
}


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def run(browser, base, name, context_args, problems, lang="nl"):
    # bypass_csp: the page CSP forbids eval, which Playwright needs for wait_for_function
    ctx = browser.new_context(bypass_csp=True, locale={"nl": "nl-NL", "en": "en-GB"}[lang], **context_args)
    say = TEXT[lang]
    page = ctx.new_page()
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))

    page.goto(base + "/index.html?test=1")
    page.wait_for_selector("html[data-ready='1']")
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / f"{name}-1-home.png"))
    if page.evaluate("window.__bubbels.lang()") != lang:
        problems.append(f"{name}: device language {lang} not followed")
    for sel, want in (("#tile-bubbels .tile-name", say["tile"]), (".promise", say["promise"]), ("#brand-name", say["brand"]), ("#brand-lore", say["lore"])):
        if page.inner_text(sel).strip() != want:
            problems.append(f"{name}: {sel} says {page.inner_text(sel)!r}, expected {want!r}")

    play_dogudoku(page, name, say, problems)
    play_picturedoku(page, name, say, problems)

    page.click("#tile-bubbels")
    page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / f"{name}-2-levels.png"))

    if page.evaluate("window.__bubbels.homeLoop()"):
        problems.append(f"{name}: home-screen animation still runs on the level screen")

    page.click("#levels-free .level-btn >> nth=0")
    page.wait_for_timeout(1300)
    page.screenshot(path=str(SHOTS / f"{name}-3-hint.png"))  # level 1: the drag-and-let-go hand
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
            page.screenshot(path=str(SHOTS / f"{name}-4-aim-shot{i + 1}.png"))
        page.mouse.up()
        if i == 1:
            page.wait_for_timeout(380)
            page.screenshot(path=str(SHOTS / f"{name}-4-in-flight.png"))
    if not page.evaluate("window.__bubbels.state().loop"):
        problems.append(f"{name}: game loop not running while playing")
    wait_aim()
    page.wait_for_timeout(200)
    state = page.evaluate("window.__bubbels.state()")
    page.screenshot(path=str(SHOTS / f"{name}-5-after-5-shots.png"))

    # pause card, then the friendly locked screen for level 11
    page.click("#btn-pause")
    page.wait_for_timeout(350)
    page.screenshot(path=str(SHOTS / f"{name}-6-pause.png"))
    if page.evaluate("window.__bubbels.state().loop"):
        problems.append(f"{name}: game loop still runs while paused")
    page.click("#ov-buttons button >> text=Levels")
    page.wait_for_timeout(100)
    if page.evaluate("window.__bubbels.state().loop"):
        problems.append(f"{name}: game loop still runs on the level screen")
    page.click("#levels-full .level-btn >> nth=0")
    page.wait_for_timeout(350)
    page.screenshot(path=str(SHOTS / f"{name}-7-locked.png"))
    # the web build sells nothing: the locked card only has an OK button
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: web locked card offers {labels}")
    if page.evaluate("window.__bubbels.full()"):
        problems.append(f"{name}: web build reports the full version as owned")
    page.click(f"#ov-buttons button >> text={say['ok']}")

    # winning the last free level leads to the offer, not to level 11
    page.evaluate("window.__bubbels.setIndex(9); window.__bubbels.win(3)")
    page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / f"{name}-7b-free-tier-end.png"))
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if not labels or labels[0] != say["more"]:
        problems.append(f"{name}: end of the free tier offers {labels}")
    else:
        page.click(f"#ov-buttons button >> text={say['more']}")
        page.wait_for_timeout(200)
        if page.locator("#ov-buttons button").all_inner_texts() != [say["ok"]]:
            problems.append(f"{name}: the offer after level 10 is not the web card")
        page.click(f"#ov-buttons button >> text={say['ok']}")

    # parental gate (used before buying in the app): a wrong answer brings a new question,
    # the right one passes. The sum is in words, so read it back with a small word list.
    page.evaluate("window.__bubbels.gate()")
    page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / f"{name}-8-gate.png"))
    first = page.inner_text("#ov-text")
    page.fill(".gate-input", "7")
    page.click("#ov-buttons button >> text=OK")
    question = page.inner_text("#ov-text")
    if question == first or say["wrong"] not in question:
        problems.append(f"{name}: gate did not ask a new question after a wrong answer: {question!r}")
    m = re.search(say["ask"], question)
    if not m:
        problems.append(f"{name}: gate question not understood: {question!r}")
    else:
        words = WORDS[lang]
        page.fill(".gate-input", str(words.index(m.group(1)) * words.index(m.group(2))))
        page.keyboard.press("Enter")
        page.wait_for_timeout(100)
        if page.evaluate("document.documentElement.dataset.gate") != "passed":
            problems.append(f"{name}: right answer did not pass the gate")

    # settings: switch the language, it sticks after a reload; then switch back
    page.evaluate("document.querySelector('[data-go=home]').click()")
    page.click("#btn-settings")
    page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / f"{name}-8b-settings.png"))
    other = "en" if lang == "nl" else "nl"
    page.click(f"[data-lang={other}]")
    page.wait_for_timeout(100)
    if page.inner_text("#screen-settings h2") != TEXT[other]["settings"]:
        problems.append(f"{name}: language switch did not translate the settings screen")
    page.goto(f"{base}/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.evaluate("window.__bubbels.lang()") != other or page.inner_text(".promise").strip() != TEXT[other]["promise"]:
        problems.append(f"{name}: language choice not kept after a reload")
    page.click("#btn-settings")
    page.click(f"[data-lang={lang}]")
    if page.get_attribute("#privacy-link", "href") != ("privacy/en.html" if lang == "en" else "privacy/index.html"):
        problems.append(f"{name}: privacy link does not follow the language")

    # privacy pages: served next to the game, no scripts, no outside requests
    for path in ("privacy/index.html", "privacy/en.html"):
        r = page.goto(f"{base}/{path}")
        if not r or r.status != 200 or "mark@westerweel.work" not in page.content():
            problems.append(f"{name}: {path} missing or incomplete")
    page.screenshot(path=str(SHOTS / f"{name}-9-privacy.png"))
    page.goto(f"{base}/index.html?test")
    page.wait_for_selector("html[data-ready='1']")

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


def play_dogudoku(page, name, say, problems):
    """Open Dogudoku, put one puppy wrong (it must light up), then solve puzzle 1 by tapping."""
    page.click("#tile-dogudoku")
    page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / f"{name}-d1-puzzles.png"))
    # a locked puzzle: on the web only a friendly card with OK
    page.click("#dogu-levels .level-btn.locked >> nth=0")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: locked Dogudoku puzzle offers {labels}")
    page.click(f"#ov-buttons button >> text={say['ok']}")
    page.click("#dogu-levels .level-btn[data-puzzle='1']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):  # the how-to card, first time per size
        page.click("#ov-buttons button")
    pz = page.evaluate("window.__bubbels.dogu.puzzle()")
    sol, n = pz["solution"], pz["n"]
    cell = lambda r, c: f"#dogu-board .dcell[data-r='{r}'][data-c='{c}']"
    # one wrong puppy: same column as the right one in row 0
    page.click(cell(0, sol[0]))
    page.click(cell(1, sol[0]))
    page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / f"{name}-d2-oops.png"))
    st = page.evaluate("window.__bubbels.dogu.state()")
    if not st["status"] or page.locator("#dogu-board .dcell.bad").count() != 2:
        problems.append(f"{name}: a wrong puppy did not light up ({st['status']!r})")
    page.click(cell(1, sol[0]))  # lift it again
    for r in range(1, n):
        page.click(cell(r, sol[r]))
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / f"{name}-d3-solved.png"))
    if not page.evaluate("window.__bubbels.dogu.state().solved"):
        problems.append(f"{name}: Dogudoku puzzle 1 not solved by tapping the solution")
    page.wait_for_timeout(1300)
    if page.inner_text("#ov-title") != say["dogWin"]:
        problems.append(f"{name}: Dogudoku win card says {page.inner_text('#ov-title')!r}")
    page.screenshot(path=str(SHOTS / f"{name}-d4-win.png"))
    page.click(f"#ov-buttons button >> text={say['puzzles']}")
    page.wait_for_timeout(200)
    label = page.locator("#dogu-levels .level-btn[data-puzzle='1']").get_attribute("aria-label") or ""
    if say["stars3"] not in label:
        problems.append(f"{name}: Dogudoku puzzle 1 not saved with 3 stars ({label!r})")
    saved = page.evaluate("window.__bubbels.save().games.dogudoku")
    if not saved or saved.get("stars", {}).get("1") != 3:
        problems.append(f"{name}: Dogudoku save section wrong: {saved}")
    page.evaluate("document.querySelector('#screen-dogudoku-levels [data-go=home]').click()")
    page.wait_for_timeout(200)


def play_picturedoku(page, name, say, problems):
    """Open Picturedoku, put one picture wrong (it must light up), then solve puzzle 1 by tapping:
    first square-then-picture, then picture-first (the brush), and check the win and the stars."""
    page.click("#tile-picturedoku")
    page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / f"{name}-p1-puzzles.png"))
    page.click("#pdoku-levels .level-btn.locked >> nth=0")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: locked Picturedoku puzzle offers {labels}")
    page.click(f"#ov-buttons button >> text={say['ok']}")
    page.click("#pdoku-levels .level-btn[data-puzzle='1']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):  # the how-to card, first time per size
        page.click("#ov-buttons button")
    pz = page.evaluate("window.__bubbels.pdoku.puzzle()")
    n, givens, sol = pz["n"], pz["givens"], pz["solution"]
    cell = lambda i: f"#pdoku-board .pcell[data-i='{i}']"
    pick = lambda v: f"#pdoku-palette .pick[data-v='{v}']"
    empties = [i for i, ch in enumerate(givens) if ch == "."]
    first = empties[0]
    # one wrong picture: a picture that is already fixed in the same row
    clash = next(givens[j] for j in range(first // n * n, first // n * n + n) if givens[j] != ".")
    page.click(cell(first))
    page.click(pick(clash))
    page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / f"{name}-p2-oops.png"))
    st = page.evaluate("window.__bubbels.pdoku.state()")
    if not st["status"] or page.locator("#pdoku-board .pcell.bad").count() < 2:
        problems.append(f"{name}: a wrong picture did not light up ({st['status']!r})")
    page.click(cell(first))  # choose the square again: the right picture replaces the wrong one
    page.click(pick(sol[first]))
    # on 4×4 a picture tapped without a square only shows where to tap (no picture-first here)
    page.click(pick(sol[empties[1]]))
    st = page.evaluate("window.__bubbels.pdoku.state()")
    if st["brush"] != 0 or not st["status"]:
        problems.append(f"{name}: 4×4 picture without a square armed it or said nothing ({st})")
    for i in empties[1:]:  # square first, then the picture
        page.click(cell(i))
        page.click(pick(sol[i]))
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / f"{name}-p3-solved.png"))
    if not page.evaluate("window.__bubbels.pdoku.state().solved"):
        problems.append(f"{name}: Picturedoku puzzle 1 not solved by tapping the solution")
    page.wait_for_timeout(1300)
    if page.inner_text("#ov-title") != say["dogWin"]:
        problems.append(f"{name}: Picturedoku win card says {page.inner_text('#ov-title')!r}")
    page.click(f"#ov-buttons button >> text={say['puzzles']}")
    page.wait_for_timeout(200)
    label = page.locator("#pdoku-levels .level-btn[data-puzzle='1']").get_attribute("aria-label") or ""
    if say["stars3"] not in label:
        problems.append(f"{name}: Picturedoku puzzle 1 not saved with 3 stars ({label!r})")
    saved = page.evaluate("window.__bubbels.save().games.picturedoku")
    if not saved or saved.get("stars", {}).get("1") != 3:
        problems.append(f"{name}: Picturedoku save section wrong: {saved}")
    # picture-first on a free 6×6: arm a picture, paint a square, switch to another picture
    page.click("#pdoku-levels .level-btn[data-puzzle='21']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    pz = page.evaluate("window.__bubbels.pdoku.puzzle()")
    empty6 = [i for i, ch in enumerate(pz["givens"]) if ch == "."]
    page.click(pick(1))
    page.click(cell(empty6[0]))
    page.click(pick(2))
    st = page.evaluate("window.__bubbels.pdoku.state()")
    if st["brush"] != 2 or st["board"][empty6[0]] != 2 or "brushing" not in (page.get_attribute("#pdoku-board", "class") or ""):
        problems.append(f"{name}: picture-first on 6×6 did not arm, paint and switch ({st['brush']}, {st['board'][empty6[0]]})")
    page.screenshot(path=str(SHOTS / f"{name}-p4-armed.png"))
    page.click(pick(2))  # put the picture down again
    page.click("#pdoku-back")
    page.wait_for_timeout(200)
    page.evaluate("document.querySelector('#screen-picturedoku-levels [data-go=home]').click()")
    page.wait_for_timeout(200)


def run_sideways(browser, base, problems):
    ctx = browser.new_context(
        viewport={"width": 844, "height": 390}, device_scale_factor=2, is_mobile=True, has_touch=True
    )
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html")
    page.wait_for_selector("html[data-ready='1']")
    if page.evaluate("typeof window.__bubbels") != "undefined":
        problems.append("test hook is exposed without ?test")
    page.click("#tile-bubbels")
    page.wait_for_timeout(200)
    page.click("#btn-play")
    page.wait_for_timeout(900)
    box = page.locator("#game").bounding_box()
    print(f"[sideways] board {box['width']:.0f}x{box['height']:.0f}")
    if box["height"] < 340:
        problems.append(f"sideways: board only {box['height']:.0f} px tall")
    page.screenshot(path=str(SHOTS / "sideways-game.png"))
    page.evaluate("document.querySelector('[data-go=home]').click()")
    page.click("#tile-dogudoku")
    page.wait_for_timeout(200)
    page.click("#dogu-levels .level-btn[data-puzzle='13']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    page.wait_for_timeout(300)
    b = page.locator("#dogu-board").bounding_box()
    print(f"[sideways] dogudoku board {b['width']:.0f}x{b['height']:.0f}")
    if b["height"] < 260 or b["y"] < 0 or b["y"] + b["height"] > 390:
        problems.append(f"sideways: Dogudoku board {b['width']:.0f}x{b['height']:.0f} at y={b['y']:.0f}")
    page.screenshot(path=str(SHOTS / "sideways-dogudoku.png"))
    page.evaluate("document.querySelector('#screen-dogudoku-levels [data-go=home]').click()")
    page.click("#tile-picturedoku")
    page.wait_for_timeout(200)
    page.click("#pdoku-levels .level-btn[data-puzzle='43']")  # a free 9×9
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    page.wait_for_timeout(300)
    b = page.locator("#pdoku-board").bounding_box()
    pal = page.locator("#pdoku-palette").bounding_box()
    print(f"[sideways] picturedoku board {b['width']:.0f}x{b['height']:.0f}")
    if b["height"] < 300 or b["y"] < 0 or b["y"] + b["height"] > 390 or pal["y"] + pal["height"] > 390 or pal["x"] < b["x"] + b["width"]:
        problems.append(f"sideways: Picturedoku board {b} / palette {pal}")
    page.screenshot(path=str(SHOTS / "sideways-picturedoku.png"))
    if errors:
        problems.append(f"sideways: page errors: {errors}")
    ctx.close()


def run_returning(browser, base, problems):
    """A player from the single-game version keeps stars, sound setting and purchase cache."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.evaluate(
        """localStorage.clear();
        localStorage.setItem('bubbels.v1', JSON.stringify({stars: {1: 3, 2: 2, 3: 1}, muted: true}));"""
    )
    page.reload()
    page.wait_for_selector("html[data-ready='1']")
    page.click("#tile-bubbels")
    page.wait_for_timeout(200)
    stars = page.locator("#levels-free .level-btn >> nth=0").get_attribute("aria-label")
    nxt = page.locator("#levels-free .level-btn.next .num").inner_text()
    if "3 van 3" not in stars or nxt != "4":
        problems.append(f"returning: progress lost (level 1: {stars!r}, next: {nxt!r})")
    page.evaluate("document.querySelector('[data-go=home]').click()")
    page.click("#btn-settings")
    if page.get_attribute("[data-sound=off]", "aria-pressed") != "true":
        problems.append("returning: sound setting lost")
    page.screenshot(path=str(SHOTS / "returning-settings.png"))
    save = page.evaluate("window.__bubbels.save()")
    if save.get("version") != 1 or not save.get("migrated") or page.evaluate("localStorage.getItem('bubbels.v1')") is None:
        problems.append(f"returning: save not migrated once with the old copy kept: {save}")
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
            run(
                browser,
                base,
                "phone-en",
                {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True},
                problems,
                lang="en",
            )
            run_sideways(browser, base, problems)
            run_returning(browser, base, problems)
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
