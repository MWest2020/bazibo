"""Playwright smoke test: serve web/ locally, open Bubbels from the home screen, play level 1 with
5 real drag-and-release shots, solve the first Dogudoku puzzle by tapping (with one wrong puppy
first, which must light up), solve the first Picturedoku puzzle (one wrong picture first, then
square-then-picture) and check on 4×4, 6×6 and 9×9 that tapping another picture after a placement
never changes the placed square, play Vier op een rij (a two-player game to a win on the
kleuterbord, and a game against the easy computer with one take-back), play Slangetje (a counting
round and a letters round to the end with the arrow pad and a swipe, the pause card and "keep
playing"; also on a 320×568 phone and sideways), check that nothing went to the network and nothing threw, that the
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
           "brand": "Bazibo", "lore": "Bazibo: “bāzi” betekent spel", "vierTile": "Vier op een rij",
           "pupWins": "Puppy wint!", "again": "Nog een keer", "keep": "Verder spelen",
           "slangTile": "Slangetje", "egg": "EI", "levels": "Levels"},
    "en": {"ok": "OK", "promise": "No ads. Ever.", "tile": "Bubble Shooter", "soon": "Coming soon!",
           "more": "More levels", "wrong": "That is not right", "ask": r"What is (\w+) times (\w+)\?",
           "settings": "Settings", "puzzles": "Puzzles", "stars3": "3 of 3", "dogWin": "Super!",
           "brand": "Bazibo", "lore": "Bazibo: “bāzi” means play", "vierTile": "Four in a Row",
           "pupWins": "Puppy wins!", "again": "Play again", "keep": "Keep playing",
           "slangTile": "Snake", "egg": "EGG", "levels": "Levels"},
}


# A stand-in for the app's store plugin that says the full version is owned, so the smoke test can
# open locked levels (the website itself sells nothing).
OWNED_APP = """
window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {} };
window.CdvPurchase = { LogLevel: {WARNING: 1}, Platform: {GOOGLE_PLAY: 'gp', APPLE_APPSTORE: 'as'},
  ProductType: {NON_CONSUMABLE: 'nc'}, ErrorCode: {PAYMENT_CANCELLED: 1},
  store: { verbosity: 0, register() {}, when() { const o = { approved: () => o, finished: () => o, receiptUpdated: () => o }; return o; },
    initialize: async () => [], owned: () => true, get: () => ({ pricing: { price: '1' }, getOffer: () => ({}) }),
    order: async () => null, restorePurchases: async () => null } };
"""


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
    play_vier(page, name, say, problems)
    play_slang(page, name, say, problems)

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
    if page.get_attribute("#privacy-link", "href") != ("en/privacy/index.html" if lang == "en" else "nl/privacy/index.html"):
        problems.append(f"{name}: privacy link does not follow the language")
    if page.get_attribute("#terms-link", "href") != ("en/terms/index.html" if lang == "en" else "nl/voorwaarden/index.html"):
        problems.append(f"{name}: terms link does not follow the language")

    # privacy pages: served next to the game, no scripts, no outside requests
    for path in ("nl/privacy/index.html", "en/privacy/index.html", "nl/voorwaarden/index.html", "en/terms/index.html"):
        r = page.goto(f"{base}/{path}")
        if not r or r.status != 200 or "hallo@bazibo.nl" not in page.content():
            problems.append(f"{name}: {path} missing or incomplete")
    # old and language-neutral URLs land on the page in the right language
    for path, want in (("privacy/", "nl/privacy/" if lang == "nl" else "en/privacy/"), ("privacy/en.html", "en/privacy/"),
                       ("terms/", "en/terms/"), ("voorwaarden/", "nl/voorwaarden/")):
        page.goto(f"{base}/{path}")
        try:
            page.wait_for_url(f"**/{want}index.html", timeout=6000)
        except Exception:
            problems.append(f"{name}: {path} does not lead to {want} (at {page.url})")
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
    """Open Dogudoku: on a 4×4, two diagonal neighbours must light up (puppies never touch, on every
    size), then solve puzzle 1 by tapping; also solve the first 5×5 (tap twice: cross, puppy)."""
    page.click("#tile-dogudoku")
    page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / f"{name}-d1-puzzles.png"))
    # a locked puzzle: on the web only a friendly card with OK
    page.click("#dogu-levels .level-btn.locked:not(.random-btn) >> nth=0")
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
    if page.locator("#dogu-rules .rule[data-rule='touch']").count() != 1:
        problems.append(f"{name}: the 4×4 does not show the never-touch rule")
    # two puppies that touch diagonally: the right one in row 0 and a free neighbour in row 1
    page.click(cell(0, sol[0]))
    diag = next(c for c in (sol[0] - 1, sol[0] + 1)
                if 0 <= c < n and "bush" not in (page.get_attribute(cell(1, c), "class") or ""))
    page.click(cell(1, diag))
    page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / f"{name}-d2-oops.png"))
    st = page.evaluate("window.__bubbels.dogu.state()")
    touch_lit = "oops" in (page.get_attribute("#dogu-rules .rule[data-rule='touch']", "class") or "")
    if not st["status"] or page.locator("#dogu-board .dcell.bad").count() != 2 or not touch_lit:
        problems.append(f"{name}: two touching puppies on a 4×4 did not light up ({st['status']!r})")
    page.click(cell(1, diag))  # lift it again
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
    # the first 5×5 (colours too), solved by tapping each square twice: cross, then puppy
    page.click("#dogu-levels .level-btn[data-puzzle='13']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    pz = page.evaluate("window.__bubbels.dogu.puzzle()")
    for r, c in enumerate(pz["solution"]):
        page.click(cell(r, c))
        page.click(cell(r, c))
    page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / f"{name}-d5-solved-5x5.png"))
    if pz["n"] != 5 or not page.evaluate("window.__bubbels.dogu.state().solved"):
        problems.append(f"{name}: Dogudoku 5×5 puzzle 13 not solved by tapping")
    page.wait_for_timeout(1500)
    page.click(f"#ov-buttons button >> text={say['puzzles']}")
    page.wait_for_timeout(200)
    page.evaluate("document.querySelector('#screen-dogudoku-levels [data-go=home]').click()")
    page.wait_for_timeout(200)


def play_picturedoku(page, name, say, problems):
    """Open Picturedoku, put one picture wrong (it must light up), then solve puzzle 1 by tapping:
    first square-then-picture, then picture-first (the brush), and check the win and the stars."""
    page.click("#tile-picturedoku")
    page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / f"{name}-p1-puzzles.png"))
    page.click("#pdoku-levels .level-btn.locked:not(.random-btn) >> nth=0")
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
    # Mark's sequence (2026-11-08): after a placement, tapping another picture changes nothing;
    # on 4×4 it only shows where to tap (no picture-first here)
    page.click(pick(sol[empties[1]]))
    st = page.evaluate("window.__bubbels.pdoku.state()")
    if st["brush"] != 0 or not st["status"] or str(st["board"][first]) != sol[first]:
        problems.append(f"{name}: 4×4 picture after a placement changed the square, armed it or said nothing ({st})")
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
    # Mark's sequence on a free 6×6 and 9×9: place a picture (square first, and picture first),
    # then tap a different picture: the placed square must stay as it is
    for pid in (21, 43):
        page.click(f"#pdoku-levels .level-btn[data-puzzle='{pid}']")
        page.wait_for_timeout(300)
        if page.is_visible("#overlay"):
            page.click("#ov-buttons button")
        pz = page.evaluate("window.__bubbels.pdoku.puzzle()")
        e = [i for i, ch in enumerate(pz["givens"]) if ch == "."]
        page.click(cell(e[0]))
        page.click(pick(1))  # square first
        page.click(pick(2))  # another picture: arms 2, the square keeps 1
        page.click(cell(e[1]))  # picture first: 2 into an empty square
        page.click(pick(3))  # another picture: switches to 3, the square keeps 2
        st = page.evaluate("window.__bubbels.pdoku.state()")
        armed = "brushing" in (page.get_attribute("#pdoku-board", "class") or "")
        if st["board"][e[0]] != 1 or st["board"][e[1]] != 2 or st["brush"] != 3 or not armed:
            problems.append(f"{name}: {pz['n']}×{pz['n']} switching pictures changed a square ({st['board'][e[0]]}, {st['board'][e[1]]}, brush {st['brush']})")
        if pid == 21:
            page.screenshot(path=str(SHOTS / f"{name}-p4-armed.png"))
        page.click(pick(3))  # put the picture down again
        page.click("#pdoku-back")
        page.wait_for_timeout(200)
    page.evaluate("document.querySelector('#screen-picturedoku-levels [data-go=home]').click()")
    page.wait_for_timeout(200)


def vier_wait(page):
    """Until no token is falling and the computer is not thinking."""
    page.wait_for_function("(() => { const s = window.__bubbels.vier.state(); return s && !s.busy && (s.over || s.setup.mode === 'duo' || s.turn === 1); })()", timeout=8000)


def vier_greedy(board, cols, rows, need, me):
    """A simple player for the smoke test: win if it can, block if it must, else the middle-most free column."""
    def land(b, c):
        for r in range(rows - 1, -1, -1):
            if not b[r * cols + c]:
                return r
        return -1

    def wins(b, c, p):
        r = land(b, c)
        if r < 0:
            return False
        for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
            n = 1
            for sign in (1, -1):
                rr, cc = r + dr * sign, c + dc * sign
                while 0 <= rr < rows and 0 <= cc < cols and b[rr * cols + cc] == p:
                    n += 1
                    rr, cc = rr + dr * sign, cc + dc * sign
            if n >= need:
                return True
        return False

    free = [c for c in range(cols) if land(board, c) >= 0]
    for p in (me, 3 - me):
        for c in free:
            if wins(board, c, p):
                return c
    return sorted(free, key=lambda c: abs(c - (cols - 1) / 2))[0]


def play_vier(page, name, say, problems):
    """Vier op een rij: the hard computer is locked on the web; a two-player game on the kleuterbord
    played to a win by tapping columns (counter saved, end card, the other player starts the next
    game, "keep playing"); then a game against the easy computer on the big board, with one take-back."""
    if page.inner_text("#tile-vier .tile-name").strip() != say["vierTile"]:
        problems.append(f"{name}: Vier op een rij tile says {page.inner_text('#tile-vier .tile-name')!r}")
    page.click("#tile-vier")
    page.wait_for_timeout(250)
    page.click(".vier-level[data-level='3']")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: locked hard computer offers {labels}")
    page.click(f"#ov-buttons button >> text={say['ok']}")
    page.screenshot(path=str(SHOTS / f"{name}-v1-menu.png"), full_page=True)

    # two players, kleuterbord: puppy (player 1) gets three in a row along the bottom
    page.click(".vier-opt.board-small")
    page.click(".vier-opt.mode-duo")
    page.click("#vier-play")
    page.wait_for_timeout(300)
    for col in (0, 0, 1, 1, 2):
        page.click(f".vcol[data-col='{col}']")
        vier_wait(page)
    st = page.evaluate("window.__bubbels.vier.state()")
    if not st["over"] or st["over"].get("winner") != 1 or len(st["over"]["cells"]) != 3:
        problems.append(f"{name}: two-player game on the kleuterbord did not end in a win for player 1: {st['over']}")
    page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / f"{name}-v2-duo-win.png"))
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    if page.inner_text("#ov-title").strip() != say["pupWins"]:
        problems.append(f"{name}: two-player end card says {page.inner_text('#ov-title')!r}")
    wins = page.evaluate("(window.__bubbels.save().games.vier || {}).stars || {}")
    if any(k.startswith("duo-") for k in wins):
        problems.append(f"{name}: a game played together was counted: {wins}")
    page.click(f"#ov-buttons button >> text={say['again']}")
    page.wait_for_timeout(200)
    if page.evaluate("window.__bubbels.vier.state().turn") != 2:
        problems.append(f"{name}: the next game should start with the other player")
    page.click("#vier-back")
    page.wait_for_timeout(200)
    if not page.is_visible("#vier-continue") or page.inner_text("#vier-continue").strip() != say["keep"]:
        problems.append(f"{name}: no 'keep playing' for an unfinished game")

    # against the easy computer on the big board
    page.click(".vier-opt.board-big")
    page.click(".vier-level[data-level='1']")
    page.click("#vier-play")
    page.wait_for_timeout(300)

    # review of PR #11: back + "keep playing" while the computer thinks must never give it two moves
    for col in (3, 2, 4):
        page.click(f".vcol[data-col='{col}']")
        page.wait_for_function("window.__bubbels.vier.state().thinking", timeout=4000)
        page.click("#vier-back")
        page.wait_for_timeout(50)
        page.click("#vier-continue")
        page.wait_for_timeout(50)
        page.click("#vier-back")
        page.click("#vier-continue")
        vier_wait(page)
        page.wait_for_timeout(900)  # long enough for a second, stray computer move to land
        st = page.evaluate("window.__bubbels.vier.state()")
        ones, twos = st["board"].count(1), st["board"].count(2)
        if st["over"]:
            break
        if ones != twos or ones + twos != st["history"] or st["turn"] != 1:
            problems.append(f"{name}: back + keep playing during the think: {ones} child tokens, {twos} computer tokens, {st['history']} moves, turn {st['turn']}")
            break
    # a take-back while the computer is still thinking cancels its move
    st = page.evaluate("window.__bubbels.vier.state()")
    if not st["over"]:
        before = st["history"]
        free = [c for c in range(7) if st["board"][c] == 0]
        page.click(f".vcol[data-col='{free[0]}']")
        page.wait_for_function("window.__bubbels.vier.state().thinking", timeout=4000)
        page.click("#vier-undo")
        page.wait_for_timeout(1200)
        st = page.evaluate("window.__bubbels.vier.state()")
        if st["history"] != before or st["turn"] != 1 or st["thinking"]:
            problems.append(f"{name}: take-back during the think left {st['history']} moves (expected {before}), turn {st['turn']}")
    page.evaluate("window.__bubbels.vier.start(1)")  # a fresh game for the full play-through
    page.wait_for_timeout(300)
    took_back = False
    for move in range(30):
        st = page.evaluate("window.__bubbels.vier.state()")
        if st["over"]:
            break
        col = vier_greedy(st["board"], 7, 6, 4, 1)
        page.click(f".vcol[data-col='{col}']")
        vier_wait(page)
        if move == 2 and not took_back:
            before = page.evaluate("window.__bubbels.vier.state()")
            if not before["over"]:
                page.click("#vier-undo")
                page.wait_for_timeout(100)
                after = page.evaluate("window.__bubbels.vier.state()")
                if after["history"] != before["history"] - 2 or after["turn"] != 1:
                    problems.append(f"{name}: take-back went from {before['history']} to {after['history']} moves")
                took_back = True
        if move == 1:
            page.screenshot(path=str(SHOTS / f"{name}-v3-vs-easy.png"))
    st = page.evaluate("window.__bubbels.vier.state()")
    if not st["over"]:
        problems.append(f"{name}: the game against the easy computer did not finish")
    filled = sum(1 for v in st["board"] if v)
    if filled != st["history"]:
        problems.append(f"{name}: board has {filled} tokens but {st['history']} moves")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / f"{name}-v4-end.png"))
    page.click("#ov-buttons button >> nth=-1")  # Menu
    page.wait_for_timeout(200)
    page.evaluate("document.querySelector('#screen-vier-menu [data-go=home]').click()")
    page.wait_for_timeout(200)


def slang_round(page, name, problems, shot=None, swipe=False):
    """Play the Slangetje round on the board to its end: the test hook's path finder says which
    way to go, the arrow pad (or one real swipe) steers, and the hook moves the snake one step at
    a time, so the result does not depend on timing."""
    page.evaluate("window.__bubbels.slang.manual(true)")
    if swipe:
        b = page.locator("#slang-board").bounding_box()
        x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
        start = page.evaluate("window.__bubbels.slang.state()")
        d = page.evaluate("window.__bubbels.slang.autopilot()") or start["dir"]
        dx, dy = {"up": (0, -60), "down": (0, 60), "left": (-60, 0), "right": (60, 0)}[d]
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + dx, y + dy, steps=5)
        page.mouse.up()
        if not page.evaluate("window.__bubbels.slang.state().started"):
            problems.append(f"{name}: a swipe on the board did not start the snake")
    for i in range(1500):
        st = page.evaluate("window.__bubbels.slang.state()")
        if st["over"]:
            break
        d = page.evaluate("window.__bubbels.slang.autopilot()")
        if d and (d != st["dir"] or not st["started"]):
            page.click(f"#slang-pad [data-dir={d}]")
        page.evaluate("window.__bubbels.slang.advance(1)")
        if shot and i == 5:
            page.screenshot(path=str(SHOTS / shot))
    st = page.evaluate("window.__bubbels.slang.state()")
    page.evaluate("window.__bubbels.slang.manual(false)")
    if st["over"] != "done" or st["mistakes"]:
        problems.append(f"{name}: Slangetje round {st['id']} ended {st['over']} with {st['mistakes']} mistakes ({st['idx']}/{st['total']})")
    return st


def play_slang(page, name, say, problems):
    """Slangetje: a locked level offers only OK on the web; counting level 1 played to the end (how-to
    card first, one swipe, then the arrow pad), 3 stars saved; the letters level 13 spells the word of
    this language; the pause card, "keep playing" from the menu, and the snake waiting for a swipe."""
    if page.inner_text("#tile-slang .tile-name").strip() != say["slangTile"]:
        problems.append(f"{name}: Slangetje tile says {page.inner_text('#tile-slang .tile-name')!r}")
    page.click("#tile-slang")
    page.wait_for_timeout(250)
    page.click(".slang-grid .level-btn[data-level='5']")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: locked Slangetje level offers {labels}")
    page.click(f"#ov-buttons button >> text={say['ok']}")
    page.screenshot(path=str(SHOTS / f"{name}-s1-menu.png"), full_page=True)

    page.click(".slang-grid .level-btn[data-level='1']")
    page.wait_for_timeout(300)
    if not page.is_visible("#overlay"):
        problems.append(f"{name}: no how-to card the first time")
    else:
        page.click("#ov-buttons button")
    page.wait_for_timeout(200)
    st = page.evaluate("window.__bubbels.slang.state()")
    if st["started"] or len(st["items"]) != 3:
        problems.append(f"{name}: counting level 1 should wait for the child with 1, 2, 3 on the board: {st}")
    slang_round(page, name, problems, shot=f"{name}-s2-count.png", swipe=True)
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / f"{name}-s3-win.png"))
    if page.inner_text("#ov-title").strip() != "Super!":
        problems.append(f"{name}: Slangetje win card says {page.inner_text('#ov-title')!r}")
    got = page.evaluate("window.__bubbels.slang.stars()")
    if got.get("1") != 3:
        problems.append(f"{name}: Slangetje stars not saved: {got}")
    page.click(f"#ov-buttons button >> text={say['levels']}")
    page.wait_for_timeout(200)

    # letters: the word in this language
    page.click(".slang-grid .level-btn[data-level='13']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    word = "".join(page.locator("#slang-target .slang-letter").all_inner_texts())
    if word != say["egg"]:
        problems.append(f"{name}: the letters round spells {word!r}, expected {say['egg']!r}")
    slang_round(page, name, problems, shot=f"{name}-s4-letters.png")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.click(f"#ov-buttons button >> text={say['levels']}")
    page.wait_for_timeout(200)

    # waiting for the first swipe: no animation frames (review of PR #12), and a short swipe goes
    # the way the finger went
    page.click(".slang-grid .level-btn[data-level='4']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    page.wait_for_timeout(400)
    page.evaluate("""(() => { window.__raf = 0; const o = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (f) => { window.__raf++; return o(f); }; })()""")
    page.wait_for_timeout(1000)
    frames = page.evaluate("window.__raf")
    if frames > 3:
        problems.append(f"{name}: {frames} animation frames in 1 s while the snake waits for a swipe")
    page.evaluate("window.__bubbels.slang.manual(true)")
    b = page.locator("#slang-board").bounding_box()
    x, y = b["x"] + b["width"] * 0.3, b["y"] + b["height"] * 0.3
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 12, y, steps=3)
    page.mouse.up()
    st = page.evaluate("window.__bubbels.slang.advance(1)")
    if st["dir"] != "right":
        problems.append(f"{name}: a 12 px swipe to the right turned the snake {st['dir']}")
    page.evaluate("window.__bubbels.slang.manual(false)")
    page.click("#slang-back")
    page.wait_for_timeout(200)

    # pause, the menu, "keep playing": the snake waits for a new swipe
    page.click(".slang-grid .level-btn[data-level='2']")
    page.wait_for_timeout(300)
    page.click("#slang-pad [data-dir=up]")
    page.wait_for_timeout(700)
    page.click("#slang-pause")
    page.wait_for_timeout(200)
    st = page.evaluate("window.__bubbels.slang.state()")
    if not st["paused"] or st["started"]:
        problems.append(f"{name}: the pause card did not stop the snake: {st}")
    page.click("#ov-buttons button >> nth=-1")  # Menu
    page.wait_for_timeout(200)
    if not page.is_visible("#slang-continue") or page.inner_text("#slang-continue").strip() != say["keep"]:
        problems.append(f"{name}: no 'keep playing' for an unfinished Slangetje round")
    page.click("#slang-continue")
    page.wait_for_timeout(500)
    before = page.evaluate("window.__bubbels.slang.state()")
    page.wait_for_timeout(600)
    after = page.evaluate("window.__bubbels.slang.state()")
    if after["snake"] != before["snake"] or after["started"]:
        problems.append(f"{name}: after 'keep playing' the snake moved before a swipe")
    page.click("#slang-back")
    page.wait_for_timeout(200)
    page.evaluate("document.querySelector('#screen-slang-menu [data-go=home]').click()")
    page.wait_for_timeout(200)


def slang_glyphs(browser, base, w, h, problems):
    """With the full version (a stand-in store), the biggest boards on a small screen: every number
    and letter at least 11 px (review of PR #12), board and pad on screen."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(OWNED_APP)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.click("#tile-slang")
    page.wait_for_timeout(200)
    for level, what in ((12, "number2"), (9, "number2"), (22, "letter"), (30, "letter")):
        page.evaluate(f"window.__bubbels.slang.start({level})")
        page.wait_for_timeout(300)
        if page.is_visible("#overlay"):
            page.click("#ov-buttons button")
            page.wait_for_timeout(150)
        st = page.evaluate("window.__bubbels.slang.state()")
        g = st["glyphs"][what]
        print(f"[{w}x{h}] level {level}: {st['cols']}x{st['rows']}{' compact' if st['compact'] else ''}, square {st['cell']} px, {what} {g:.1f} px")
        if g < 11:
            problems.append(f"{w}x{h}: Slangetje level {level} draws {what} at {g:.1f} px")
        for sel in ("#slang-canvas", "#slang-pad", "#slang-target"):
            r = page.locator(sel).bounding_box()
            if r["x"] < 0 or r["y"] < 0 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                problems.append(f"{w}x{h}: Slangetje level {level}: {sel} off screen {r}")
        page.screenshot(path=str(SHOTS / f"glyphs-{w}x{h}-{level}.png"))
        page.click("#slang-back")
        page.wait_for_timeout(150)
    if errors:
        problems.append(f"{w}x{h}: page errors: {errors}")
    ctx.close()


def random_play(browser, base, problems):
    """Random play (full version): on the web every random card is locked and offers only OK; with
    the full version (stand-in store) a random puzzle opens in every game, and a 4×4 Dogudoku and a
    4×4 Picturedoku are solved by tapping, which counts one solved and offers another one."""
    # the website sells nothing: the random cards are locked
    ctx = browser.new_context(locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.click("#tile-dogudoku")
    page.wait_for_timeout(200)
    locked = page.locator("#dogu-levels .random-btn.locked").count()
    if locked != 5:
        problems.append(f"random (web): {locked} locked random cards in Dogudoku, expected 5")
    page.click("#dogu-levels .random-btn >> nth=0")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != ["Oké"] or page.evaluate("window.__bubbels.dogu.puzzle()") is not None:
        problems.append(f"random (web): a locked random card offers {labels} or opened a puzzle")
    ctx.close()

    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(OWNED_APP)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.wait_for_function("window.__bubbels.full()", timeout=8000)

    def dismiss():
        page.wait_for_timeout(300)
        if page.is_visible("#overlay"):
            page.click("#ov-buttons button")
            page.wait_for_timeout(150)

    # Dogudoku: a random 4×4 by tapping the first random card, solved by tapping
    page.click("#tile-dogudoku")
    page.wait_for_timeout(200)
    if page.locator("#dogu-levels .random-btn:not(.locked)").count() != 5:
        problems.append("random: Dogudoku does not show 5 open random cards")
    page.screenshot(path=str(SHOTS / "random-dogu-list.png"))
    page.click("#dogu-levels .random-btn >> nth=0")
    page.wait_for_function("window.__bubbels.dogu.puzzle() && window.__bubbels.dogu.puzzle().random === 's4'", timeout=8000)
    dismiss()
    pz = page.evaluate("window.__bubbels.dogu.puzzle()")
    if page.inner_text("#dogu-title").strip() != "Willekeurig":
        problems.append(f"random: Dogudoku title {page.inner_text('#dogu-title')!r}")
    for r, c in enumerate(pz["solution"]):
        page.click(f"#dogu-board .dcell[data-r='{r}'][data-c='{c}']")
    page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / "random-dogu-solved.png"))
    if not page.evaluate("window.__bubbels.dogu.state().solved"):
        problems.append("random: the random Dogudoku 4×4 was not solved by tapping")
    page.wait_for_timeout(1400)
    if page.evaluate("window.__bubbels.dogu.randomSolved()").get("s4") != 1:
        problems.append(f"random: Dogudoku count {page.evaluate('window.__bubbels.dogu.randomSolved()')}")
    if "1 opgelost" not in page.inner_text("#ov-text"):
        problems.append(f"random: Dogudoku win card says {page.inner_text('#ov-text')!r}")
    first_id = pz["id"]
    page.click("#ov-buttons button >> text=Nog een")
    page.wait_for_function(f"window.__bubbels.dogu.puzzle() && window.__bubbels.dogu.puzzle().id !== '{first_id}'", timeout=8000)
    if page.evaluate("window.__bubbels.dogu.puzzle().random") != "s4":
        problems.append("random: 'another one' did not open a new random 4×4")
    # the biggest board too (made in a worker)
    page.click("#dogu-back")
    page.wait_for_timeout(200)
    page.click("#dogu-levels .random-btn >> nth=4")
    page.wait_for_function("window.__bubbels.dogu.puzzle() && window.__bubbels.dogu.puzzle().n === 8", timeout=15000)
    dismiss()
    page.screenshot(path=str(SHOTS / "random-dogu-8x8.png"))
    page.click("#dogu-back")
    page.wait_for_timeout(200)
    label = page.locator("#dogu-levels .random-btn >> nth=0").get_attribute("aria-label") or ""
    if "1 opgelost" not in label:
        problems.append(f"random: Dogudoku 4×4 card label {label!r}")
    page.evaluate("document.querySelector('#screen-dogudoku-levels [data-go=home]').click()")
    page.wait_for_timeout(200)

    # Picturedoku: a random 4×4, solved square first, then the picture
    page.click("#tile-picturedoku")
    page.wait_for_timeout(200)
    page.click("#pdoku-levels .random-btn >> nth=0")
    page.wait_for_function("window.__bubbels.pdoku.puzzle() && window.__bubbels.pdoku.puzzle().random === 's4'", timeout=8000)
    dismiss()
    pz = page.evaluate("window.__bubbels.pdoku.puzzle()")
    for i, ch in enumerate(pz["givens"]):
        if ch == ".":
            page.click(f"#pdoku-board .pcell[data-i='{i}']")
            page.click(f"#pdoku-palette .pick[data-v='{pz['solution'][i]}']")
    page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / "random-pdoku-solved.png"))
    if not page.evaluate("window.__bubbels.pdoku.state().solved"):
        problems.append("random: the random Picturedoku 4×4 was not solved by tapping")
    page.wait_for_timeout(1400)
    if page.evaluate("window.__bubbels.pdoku.randomSolved()").get("s4") != 1:
        problems.append(f"random: Picturedoku count {page.evaluate('window.__bubbels.pdoku.randomSolved()')}")
    page.click("#ov-buttons button >> nth=-1")
    page.wait_for_timeout(200)
    page.click("#pdoku-levels .random-btn >> nth=2")  # 9×9
    page.wait_for_function("window.__bubbels.pdoku.puzzle() && window.__bubbels.pdoku.puzzle().n === 9", timeout=8000)
    dismiss()
    page.click("#pdoku-back")
    page.wait_for_timeout(200)
    page.evaluate("document.querySelector('#screen-picturedoku-levels [data-go=home]').click()")
    page.wait_for_timeout(200)

    # Bubbels: the random section under the levels, a hard board opens
    page.click("#tile-bubbels")
    page.wait_for_timeout(200)
    if page.locator("#levels-random .random-btn:not(.locked)").count() != 3:
        problems.append("random: Bubbels does not show 3 open random cards")
    page.locator("#levels-random").scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / "random-bubbels-list.png"))
    page.click("#levels-random .random-btn >> nth=2")
    page.wait_for_function("window.__bubbels.random() && window.__bubbels.random().tier === 'hard'", timeout=8000)
    page.wait_for_timeout(400)
    if page.inner_text("#hud-level").strip() != "Moeilijk":
        problems.append(f"random: Bubbels HUD says {page.inner_text('#hud-level')!r}")
    page.screenshot(path=str(SHOTS / "random-bubbels-game.png"))
    page.click("#btn-pause")
    page.wait_for_timeout(200)
    page.click("#ov-buttons button >> nth=-1")  # Levels
    page.wait_for_timeout(200)
    page.evaluate("document.querySelector('#screen-levels [data-go=home]').click()")
    page.wait_for_timeout(200)

    # Slangetje: a random counting round for the youngest, played to the end
    page.click("#tile-slang")
    page.wait_for_timeout(200)
    page.click(".slang-grid .random-btn >> nth=0")
    page.wait_for_function("window.__bubbels.slang.state() && String(window.__bubbels.slang.state().id).startsWith('r-count-tiny')", timeout=8000)
    dismiss()
    page.screenshot(path=str(SHOTS / "random-slang.png"))
    slang_round(page, "random", problems)
    page.wait_for_timeout(1100)
    if page.evaluate("window.__bubbels.slang.randomSolved()").get("count-tiny") != 1:
        problems.append(f"random: Slangetje count {page.evaluate('window.__bubbels.slang.randomSolved()')}")
    if errors:
        problems.append(f"random: page errors: {errors}")
    ctx.close()


def slang_fits(page, w, h, label, problems):
    """Open Slangetje level 1 and check that the board and the arrow pad are fully on screen."""
    page.click("#tile-slang")
    page.wait_for_timeout(200)
    page.click(".slang-grid .level-btn[data-level='1']")
    page.wait_for_timeout(400)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
        page.wait_for_timeout(200)
    b = page.locator("#slang-canvas").bounding_box()
    pad = page.locator("#slang-pad").bounding_box()
    cell = page.evaluate("window.__bubbels && window.__bubbels.slang ? window.__bubbels.slang.state().cell : 0")
    print(f"[{label}] slang board {b['width']:.0f}x{b['height']:.0f}, pad at y={pad['y']:.0f}")
    for what, r in (("board", b), ("arrow pad", pad)):
        if r["x"] < 0 or r["y"] < 0 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
            problems.append(f"{label}: Slangetje {what} off screen: {r}")
    if b["height"] < 180:
        problems.append(f"{label}: Slangetje board only {b['height']:.0f} px tall")
    return cell


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
    page.evaluate("document.querySelector('#screen-picturedoku-levels [data-go=home]').click()")
    page.click("#tile-vier")
    page.wait_for_timeout(200)
    page.click(".vier-opt.board-big")
    page.click("#vier-play")
    page.wait_for_timeout(400)
    b = page.locator("#vier-board").bounding_box()
    side = page.locator("#vier-turn").bounding_box()
    print(f"[sideways] vier board {b['width']:.0f}x{b['height']:.0f}")
    if b["height"] < 280 or b["y"] < 0 or b["y"] + b["height"] > 390 or side["x"] < b["x"] + b["width"]:
        problems.append(f"sideways: Vier op een rij board {b} / turn chips {side}")
    page.screenshot(path=str(SHOTS / "sideways-vier.png"))
    page.click("#vier-back")
    page.wait_for_timeout(200)
    page.evaluate("document.querySelector('#screen-vier-menu [data-go=home]').click()")
    page.wait_for_timeout(200)
    slang_fits(page, 844, 390, "sideways", problems)
    page.screenshot(path=str(SHOTS / "sideways-slang.png"))
    if errors:
        problems.append(f"sideways: page errors: {errors}")
        errors.clear()
    ctx.close()
    # smaller sideways phones (review of PR #11): the board and the turn chips stay on screen
    for w, h in ((640, 360), (568, 320)):
        ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html")
        page.wait_for_selector("html[data-ready='1']")
        page.click("#tile-vier")
        page.wait_for_timeout(200)
        page.click(".vier-opt.board-big")
        page.click("#vier-play")
        page.wait_for_timeout(400)
        b = page.locator("#vier-board").bounding_box()
        side = page.locator("#vier-turn").bounding_box()
        print(f"[sideways {w}x{h}] vier board {b['width']:.0f}x{b['height']:.0f}")
        if b["x"] < 0 or b["y"] < 0 or b["x"] + b["width"] > w or b["y"] + b["height"] > h or side["x"] + side["width"] > w or side["y"] + side["height"] > h:
            problems.append(f"sideways {w}x{h}: Vier op een rij board {b} / turn chips {side}")
        page.screenshot(path=str(SHOTS / f"sideways-vier-{w}x{h}.png"))
        page.goto(base + "/index.html")
        page.wait_for_selector("html[data-ready='1']")
        slang_fits(page, w, h, f"sideways {w}x{h}", problems)
        page.screenshot(path=str(SHOTS / f"sideways-slang-{w}x{h}.png"))
        ctx.close()
    if errors:
        problems.append(f"sideways: page errors: {errors}")


def run_small_phone(browser, base, problems):
    """A 320×568 phone: Slangetje's board and arrows fit, and a round can be played to the end."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 320, "height": 568}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    slang_fits(page, 320, 568, "320x568", problems)
    slang_round(page, "320x568", problems, shot="small-slang.png")
    if errors:
        problems.append(f"320x568: page errors: {errors}")
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
            run_small_phone(browser, base, problems)
            for w, h in ((320, 568), (568, 320), (640, 360)):
                slang_glyphs(browser, base, w, h, problems)
            run_returning(browser, base, problems)
            random_play(browser, base, problems)
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
