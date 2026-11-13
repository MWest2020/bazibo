"""Playwright smoke test: serve web/ locally, open Bubbels from the home screen, play level 1 with
5 real drag-and-release shots, solve the first Dogudoku puzzle by tapping (with one wrong puppy
first, which must light up), solve the first Picturedoku puzzle (one wrong picture first, then
square-then-picture) and check on 4×4, 6×6 and 9×9 that tapping another picture after a placement
never changes the placed square, play Vier op een rij (a two-player game to a win on the
kleuterbord, and a game against the easy computer with one take-back), play Slangetje (a counting
round and a letters round to the end with the arrow pad and a swipe, the pause card and "keep
playing"; also on a 320×568 phone and sideways), colour a Kleurplaten page (tap, undo, done, "my
pictures", kept after a reload; a mirrored mandala on small and sideways phones), draw in Tekenen (a
real stroke, undo, mirror mode and stamps locked on the web, done, "my drawings", kept after a
reload; mirror mode with 8 lines and a stamp on small and sideways phones), play Klok kijken (a "set the clock"
round by dragging, a "what time is it" round with one mistake, a daily-rhythm round, + and -, the
hint and "keep playing"; the layout at 320×568 and sideways), check that nothing went to the network and nothing threw, that the
animation loops stop when they are not needed, that settings, the language switch, the parental
gate and the free-tier offer work in Dutch and English, that a returning player keeps their
progress, and save screenshots to shots/ (also a sideways phone).

Run: uv run --with playwright python tests/smoke.py
"""
import base64
import functools
import json
import time
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
           "slangTile": "Slangetje", "egg": "EI", "levels": "Levels",
           "kleurTile": "Kleurplaten", "mine": "Mijn kleurplaten", "lovely": "Wat mooi!",
           "tekenTile": "Tekenen", "drawings": "Mijn tekeningen",
           "klokTile": "Klok kijken", "klokWin": "Super!", "klokAlmost": "Bijna!"},
    "en": {"ok": "OK", "promise": "No ads. Ever.", "tile": "Bubble Shooter", "soon": "Coming soon!",
           "more": "More levels", "wrong": "That is not right", "ask": r"What is (\w+) times (\w+)\?",
           "settings": "Settings", "puzzles": "Puzzles", "stars3": "3 of 3", "dogWin": "Super!",
           "brand": "Bazibo", "lore": "Bazibo: “bāzi” means play", "vierTile": "Four in a Row",
           "pupWins": "Puppy wins!", "again": "Play again", "keep": "Keep playing",
           "slangTile": "Snake", "egg": "EGG", "levels": "Levels",
           "kleurTile": "Colouring", "mine": "My pictures", "lovely": "How lovely!",
           "tekenTile": "Drawing", "drawings": "My drawings",
           "klokTile": "Telling Time", "klokWin": "Super!", "klokAlmost": "Almost!"},
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
    play_kleuren(page, name, say, problems)
    play_tekenen(page, name, say, problems)
    play_klok(page, name, say, problems)

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
    if page.get_attribute("#roadmap-link", "href") != ("en/roadmap/index.html" if lang == "en" else "nl/plannen/index.html"):
        problems.append(f"{name}: roadmap link does not follow the language")

    # privacy pages: served next to the game, no scripts, no outside requests
    for path in ("nl/privacy/index.html", "en/privacy/index.html", "nl/voorwaarden/index.html", "en/terms/index.html", "nl/plannen/index.html", "en/roadmap/index.html"):
        r = page.goto(f"{base}/{path}")
        if not r or r.status != 200 or "hallo@bazibo.nl" not in page.content():
            problems.append(f"{name}: {path} missing or incomplete")
    # old and language-neutral URLs land on the page in the right language
    for path, want in (("privacy/", "nl/privacy/" if lang == "nl" else "en/privacy/"), ("privacy/en.html", "en/privacy/"),
                       ("terms/", "en/terms/"), ("voorwaarden/", "nl/voorwaarden/"), ("roadmap/", "en/roadmap/"), ("plannen/", "nl/plannen/")):
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


def close_card_if_any(page, timeout=1200):
    """Close the how-to card if one comes up (it shows once per kind), and wait until it is gone."""
    try:
        page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=timeout)
    except Exception:
        return False
    page.click("#ov-buttons button")
    page.wait_for_selector("#overlay", state="hidden", timeout=3000)
    return True


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
    try:
        page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=3000)
        page.click("#ov-buttons button")
        page.wait_for_selector("#overlay", state="hidden", timeout=3000)
    except Exception:
        problems.append(f"{name}: no how-to card the first time")
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
    page.wait_for_selector("#screen-slang.active")
    close_card_if_any(page)
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
    page.wait_for_selector("#screen-slang.active")
    close_card_if_any(page)
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


def klok_drag(page, hand, to_deg):
    """Drag a hand of the clock with a real pointer, along the rim, to `to_deg` (clockwise from 12)."""
    st = page.evaluate("window.__bubbels.klok.state()")
    svg = page.locator("#klok-face svg").bounding_box()
    # the clock's viewBox is -10 -24 220 238 with the centre at (100, 100)
    sx, sy = svg["width"] / 220, svg["height"] / 238
    cx, cy = svg["x"] + 110 * sx, svg["y"] + 124 * sy
    cur = st["cur"]
    start_deg = ((cur % 720) / 720 * 360) if hand == "hour" else (cur % 60) * 6
    radius = (40 if hand == "hour" else 66) * sx

    def pt(deg, r=radius):
        a = math.radians(deg)
        return cx + r * math.sin(a), cy - r * math.cos(a)

    page.mouse.move(*pt(start_deg))
    page.mouse.down()
    diff = (to_deg - start_deg + 540) % 360 - 180  # the shorter way round
    steps = max(4, int(abs(diff) / 6))
    for k in range(1, steps + 1):
        page.mouse.move(*pt(start_deg + diff * k / steps))
    page.mouse.up()


def klok_mode(page, mode):
    """In the Klok kijken menu, open one kind of round (from the kinds, or from another kind)."""
    if not page.locator(f".klok-modecard[data-mode='{mode}']").count():
        page.evaluate("window.__bubbels.klok.menu(null)")
    page.click(f".klok-modecard[data-mode='{mode}']")
    page.wait_for_timeout(150)


def klok_touch_drag(page, cdp, hand, from_deg, to_deg, steps=8):
    """Drag a hand with real touch events (CDP), from one angle to another, the shorter way round."""
    svg = page.locator("#klok-face svg").bounding_box()
    sx, sy = svg["width"] / 220, svg["height"] / 238
    cx, cy = svg["x"] + 110 * sx, svg["y"] + 124 * sy
    radius = (34 if hand == "hour" else 68) * sx

    def pt(deg):
        a = math.radians(deg)
        return {"x": cx + radius * math.sin(a), "y": cy - radius * math.cos(a), "id": 1}

    diff = (to_deg - from_deg + 540) % 360 - 180
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [pt(from_deg)]})
    for k in range(1, steps + 1):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [pt(from_deg + diff * k / steps)]})
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(60)


def klok_touch(browser, base, problems):
    """Klok kijken with real touch: the long hand dragged over 12 carries the hour (half hours and five
    minutes, forwards and backwards), and at 12:00, with both hands up, a touch near the centre takes
    the short hand."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(OWNED_APP)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.wait_for_function("window.__bubbels.full()", timeout=8000)
    page.click("#tile-klok")
    for rid in ("set-t2-1", "set-t4-1"):
        page.evaluate(f"window.__bubbels.klok.start('{rid}')")
        page.wait_for_timeout(250)
        if page.is_visible("#overlay"):
            page.click("#ov-buttons button")
            page.wait_for_timeout(150)
        page.evaluate("window.__bubbels.klok.setTime(9 * 60 + 30)")
        # one drag from 6 round to 1 past the 12 (forwards): 9:30 -> 10:05 (five minutes) or 10:00 (half hours)
        for a, b in ((180, 260), (260, 340), (340, 390)):
            klok_touch_drag(page, cdp, "minute", a, b, steps=6)
        got = page.evaluate("window.__bubbels.klok.state().cur") % 720
        want = 10 * 60 + (5 if rid == "set-t4-1" else 0)
        if got != want:
            problems.append(f"klok touch {rid}: forwards over 12 gave {got // 60}:{got % 60:02d}, expected {want // 60}:{want % 60:02d}")
        page.evaluate("window.__bubbels.klok.setTime(10 * 60 + 5)")
        for a, b in ((30, -40), (-40, -120), (-120, -180)):
            klok_touch_drag(page, cdp, "minute", a, b, steps=6)
        got = page.evaluate("window.__bubbels.klok.state().cur") % 720
        if rid == "set-t4-1" and got != 9 * 60 + 30:
            problems.append(f"klok touch {rid}: backwards over 12 gave {got // 60}:{got % 60:02d}, expected 9:30")
        if rid == "set-t2-1" and got // 60 != 9:
            problems.append(f"klok touch {rid}: backwards over 12 stayed in hour {got // 60}")
        # 12:00: both hands point up; a touch near the centre moves the short hand
        page.evaluate("window.__bubbels.klok.setTime(12 * 60)")
        klok_touch_drag(page, cdp, "hour", 0, 90)
        got = page.evaluate("window.__bubbels.klok.state().cur") % 720
        if got != 3 * 60:
            problems.append(f"klok touch {rid}: at 12:00 the touch near the centre gave {got // 60}:{got % 60:02d}, expected 3:00 (the short hand)")
        page.screenshot(path=str(SHOTS / f"klok-touch-{rid}.png"))
        page.click("#klok-back")
        page.wait_for_timeout(150)
    ctx.close()


def klok_answer(page, right=True):
    st = page.evaluate("window.__bubbels.klok.state()")
    k = st["correctOption"] if right else (st["correctOption"] + 1) % page.locator("#klok-controls .klok-option").count()
    page.click(f"#klok-controls .klok-option[data-option='{k}']")


def klok_next(page, i):
    page.wait_for_function(f"window.__bubbels.klok.state().i > {i} || window.__bubbels.klok.state().done", timeout=5000)


def play_klok(page, name, say, problems):
    """Klok kijken: the tile, the lock on the web, a "set the clock" round by dragging, a "what time
    is it" round with one mistake (and its explanation card), a daily-rhythm round, + and -, the hint
    and "keep playing"."""
    if page.inner_text("#tile-klok .tile-name").strip() != say["klokTile"]:
        problems.append(f"{name}: Klok tile says {page.inner_text('#tile-klok .tile-name')!r}")
    page.click("#tile-klok")
    page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / f"{name}-k1-menu.png"))
    modes = page.eval_on_selector_all(".klok-modecard", "els => els.map(e => e.dataset.mode)")
    if modes != ["day", "set", "read"]:
        problems.append(f"{name}: Klok menu shows the kinds {modes}, expected the daily rhythm first")
    klok_mode(page, "set")
    page.screenshot(path=str(SHOTS / f"{name}-k1-set-menu.png"))
    if page.locator(".klok-random .random-btn").count() != 1:
        problems.append(f"{name}: Klok should show one random card per kind")
    # the website sells nothing: a quarter-hours round is locked and offers only OK
    page.click(".klok-grid .level-btn[data-round='set-t3-1']")
    page.wait_for_timeout(200)
    if page.locator("#ov-buttons button").all_inner_texts() != [say["ok"]] or page.evaluate("window.__bubbels.klok.state()"):
        problems.append(f"{name}: Klok locked round did not just offer OK")
    page.click("#ov-buttons button")

    # 1. set the clock, whole hours: drag the hour hand for all 10 questions
    page.click(".klok-grid .level-btn[data-round='set-t1-1']")
    page.wait_for_timeout(300)
    if not page.is_visible("#overlay"):
        problems.append(f"{name}: Klok how-to card missing")
    else:
        page.click("#ov-buttons button")
    for i in range(10):
        st = page.evaluate("window.__bubbels.klok.state()")
        klok_drag(page, "hour", (st["target"] % 720) / 720 * 360)
        if i == 0:
            page.screenshot(path=str(SHOTS / f"{name}-k2-set.png"))
        st2 = page.evaluate("window.__bubbels.klok.state()")
        if st2["cur"] % 720 != st["target"] % 720:
            problems.append(f"{name}: Klok drag ended at {st2['cur']}, wanted {st['target']}")
            page.evaluate(f"window.__bubbels.klok.setTime({st['target']})")
        page.click("#klok-check")
        klok_next(page, i)
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    if page.inner_text("#ov-title").strip() != say["klokWin"] or page.evaluate("window.__bubbels.klok.stars()").get("set-t1-1") != 3:
        problems.append(f"{name}: Klok set round: {page.inner_text('#ov-title')!r}, stars {page.evaluate('window.__bubbels.klok.stars()')}")
    page.screenshot(path=str(SHOTS / f"{name}-k3-won.png"))
    page.click("#ov-buttons button >> nth=-1")  # Rondes
    page.wait_for_timeout(200)

    # 2. what time is it, half hours: one mistake first (explanation card), then all right
    klok_mode(page, "read")
    page.click(".klok-grid .level-btn[data-round='read-t2-1']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    page.screenshot(path=str(SHOTS / f"{name}-k4-read.png"))
    klok_answer(page, right=False)
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    if page.inner_text("#ov-title").strip() != say["klokAlmost"] or len(page.inner_text("#ov-text")) < 20:
        problems.append(f"{name}: Klok mistake card: {page.inner_text('#ov-title')!r} / {page.inner_text('#ov-text')!r}")
    page.screenshot(path=str(SHOTS / f"{name}-k5-almost.png"))
    page.click("#ov-buttons button")
    klok_next(page, 0)
    for i in range(1, 10):
        klok_answer(page)
        klok_next(page, i)
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    if page.evaluate("window.__bubbels.klok.stars()").get("read-t2-1") != 2:
        problems.append(f"{name}: Klok read round with one mistake: stars {page.evaluate('window.__bubbels.klok.stars()')}")
    page.click("#ov-buttons button >> nth=-1")
    page.wait_for_timeout(200)

    # 3. the daily rhythm
    klok_mode(page, "day")
    page.click(".klok-grid .level-btn[data-round='day-t1-1']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    page.screenshot(path=str(SHOTS / f"{name}-k6-day.png"))
    for i in range(10):
        klok_answer(page)
        klok_next(page, i)
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    if page.evaluate("window.__bubbels.klok.stars()").get("day-t1-1") != 3:
        problems.append(f"{name}: Klok daily rhythm: stars {page.evaluate('window.__bubbels.klok.stars()')}")
    page.click("#ov-buttons button >> nth=-1")
    page.wait_for_timeout(200)

    # 4. half hours with + and -, the hint, then leave and "keep playing"
    klok_mode(page, "set")
    page.click(".klok-grid .level-btn[data-round='set-t2-1']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    st = page.evaluate("window.__bubbels.klok.state()")
    page.click("#klok-hint")
    if not page.locator("#klok-face .klok-hand.hint").count() or not page.inner_text("#klok-status").strip():
        problems.append(f"{name}: Klok hint shows nothing")
    for _ in range(30):
        st = page.evaluate("window.__bubbels.klok.state()")
        if st["cur"] % 720 == st["target"] % 720:
            break
        diff = (st["target"] - st["cur"]) % 720
        if diff % 60:
            page.click("#klok-controls [data-nudge='minute+']")
        else:
            page.click("#klok-controls [data-nudge='hour+']" if diff <= 360 else "#klok-controls [data-nudge='hour-']")
    st = page.evaluate("window.__bubbels.klok.state()")
    if st["cur"] % 720 != st["target"] % 720:
        problems.append(f"{name}: Klok + and - did not reach the target ({st})")
    page.click("#klok-check")
    klok_next(page, 0)
    page.click("#klok-back")
    page.wait_for_timeout(200)
    if not page.is_visible("#klok-continue") or page.inner_text("#klok-continue").strip() != say["keep"]:
        problems.append(f"{name}: Klok keep-playing button missing")
    else:
        page.click("#klok-continue")
        page.wait_for_timeout(200)
        if page.evaluate("window.__bubbels.klok.state().i") != 1:
            problems.append(f"{name}: Klok keep playing lost the round")
        page.click("#klok-back")
    page.click("#klok-menu-back")  # to the kinds of round
    page.wait_for_timeout(150)
    if not page.locator(".klok-modecard").count():
        problems.append(f"{name}: Klok menu back did not return to the kinds of round")
    page.click("#klok-menu-back")  # home
    page.wait_for_timeout(200)


KLOK_FIT_JS = """() => [...document.querySelectorAll('#klok-controls button, #klok-hint, #klok-back')].filter((b) => {
  const r = b.getBoundingClientRect();
  return r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5 || b.scrollWidth > b.clientWidth + 1;
}).map((b) => (b.dataset.option || b.dataset.nudge || b.id || b.textContent).slice(0, 20))"""


def klok_layouts(browser, base, problems):
    """Klok kijken at 320×568 and sideways (844×390, 640×360, 568×320): prompt, clock and controls on
    screen, no sideways scroll, in every mode."""
    for w, h, lang in ((320, 568, "en"), (844, 390, "nl"), (640, 360, "nl"), (640, 360, "en"), (568, 320, "nl"), (568, 320, "en")):
        ctx = browser.new_context(bypass_csp=True, locale="en-GB" if lang == "en" else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script(OWNED_APP)  # the quarter-hours round is in the full version
        page = ctx.new_page()
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        page.click("#tile-klok")
        for rid in ("set-t2-1", "read-t1-1", "read-t3-1", "day-t1-1"):
            page.evaluate(f"window.__bubbels.klok.start('{rid}')")
            page.wait_for_timeout(250)
            if page.is_visible("#overlay"):
                page.click("#ov-buttons button")
                page.wait_for_timeout(150)
            for sel in ("#klok-prompt", "#klok-face", "#klok-controls", "#klok-dots"):
                if sel == "#klok-prompt" and rid.startswith("read") and w > h:
                    continue  # sideways, the bar already asks "what time is it?"
                r = page.locator(sel).bounding_box()
                if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                    problems.append(f"klok {w}x{h} {rid}: {sel} off screen ({r})")
            face = page.locator("#klok-face svg, #klok-face .klok-activity").first.bounding_box()
            if not face or min(face["width"], face["height"]) < 120:
                problems.append(f"klok {w}x{h} {rid}: clock or picture too small ({face})")
            if page.evaluate("document.documentElement.scrollWidth") > w:
                problems.append(f"klok {w}x{h} {rid}: sideways scroll")
            bad = page.evaluate(KLOK_FIT_JS)
            if bad:
                problems.append(f"klok {w}x{h} {page.evaluate('window.__bubbels.lang()')} {rid}: buttons overflow: {bad}")
            page.screenshot(path=str(SHOTS / f"klok-{w}x{h}-{lang}-{rid}.png"))
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


CARD_FIT_JS = """() => [...document.querySelectorAll('.screen.active .random-btn')].map((b) => {
  const r = b.getBoundingClientRect();
  const bad = [...b.children].filter((c) => {
    const q = c.getBoundingClientRect();
    return q.left < r.left - 0.5 || q.right > r.right + 0.5 || q.top < r.top - 0.5 || q.bottom > r.bottom + 0.5;
  }).map((c) => c.className.baseVal ?? c.className);
  return { over: b.scrollWidth > b.clientWidth + 1, bad, right: r.right, vw: innerWidth };
})"""


def play_kleuren(page, name, say, problems):
    """Kleurplaten: a locked page offers only OK on the web; colour the free sun by tapping (a real
    tap on the face, the rays by event), undo once, finish it, find it under "my pictures", and
    check it is still there after a reload."""
    page.click("#tile-kleuren")
    page.wait_for_timeout(250)
    if page.inner_text("#tile-kleuren .tile-name").strip() != say["kleurTile"]:
        problems.append(f"{name}: colouring tile says {page.inner_text('#tile-kleuren .tile-name')!r}")
    page.click("#kleur-list .kleur-card.locked >> nth=0")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: locked colouring page offers {labels}")
    page.click(f"#ov-buttons button >> text={say['ok']}")
    page.click("#kleur-list .kleur-card[data-page='p:zon']")
    page.wait_for_timeout(300)
    if not page.is_disabled("#kleur-done") or not page.is_disabled("#kleur-undo"):
        problems.append(f"{name}: on a blank page Done and Undo should be off")
    page.click("#kleur-palette .swatch[data-c='2']")
    face = page.locator("#kleur-page path[data-r='face']").bounding_box()
    page.mouse.click(face["x"] + face["width"] / 2, face["y"] + face["height"] * 0.8)  # below the smile
    page.wait_for_timeout(150)
    st = page.evaluate("window.__bubbels.kleur.state()")
    if st["fills"].get("face") != 2:
        problems.append(f"{name}: tapping the sun's face did not colour it ({st['fills']})")
    if page.is_disabled("#kleur-undo") or page.is_disabled("#kleur-done"):
        problems.append(f"{name}: after one tap Undo and Done should be on")
    page.click("#kleur-undo")
    if page.evaluate("Object.keys(window.__bubbels.kleur.state().fills).length") != 0 or not page.is_disabled("#kleur-done"):
        problems.append(f"{name}: undo after one tap did not take it back")
    page.mouse.click(face["x"] + face["width"] / 2, face["y"] + face["height"] * 0.8)
    page.click("#kleur-palette .swatch[data-c='1']")
    for i in range(8):
        page.evaluate(f"document.querySelector(\"#kleur-page path[data-r='ray{i}']\").dispatchEvent(new MouseEvent('click', {{bubbles: true}}))")
    page.click("#kleur-palette .swatch[data-c='0']")
    page.evaluate("document.querySelector(\"#kleur-page path[data-r='ray0']\").dispatchEvent(new MouseEvent('click', {bubbles: true}))")
    page.click("#kleur-undo")
    st = page.evaluate("window.__bubbels.kleur.state()")
    if st["fills"].get("ray0") != 1 or len(st["fills"]) != 9:
        problems.append(f"{name}: colouring or undo went wrong: {st['fills']}")
    # start over (it asks first), then undo brings every colour back
    page.click("#kleur-restart")
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
    page.click("#ov-buttons button >> nth=0")
    page.wait_for_selector("#overlay", state="hidden")
    if page.evaluate("Object.keys(window.__bubbels.kleur.state().fills).length") != 0 or page.is_disabled("#kleur-undo"):
        problems.append(f"{name}: start over left colours or Undo off")
    page.click("#kleur-undo")
    if page.evaluate("window.__bubbels.kleur.state().fills") != st["fills"]:
        problems.append(f"{name}: undo after start over did not bring the colours back")
    if page.get_attribute("#kleur-page path[data-r='ray3']", "fill").lower() != "#ff8a3d":
        problems.append(f"{name}: a coloured ray is not drawn in its colour")
    page.screenshot(path=str(SHOTS / f"{name}-k1-sun.png"))
    page.click("#kleur-done")
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=4000)
    if page.inner_text("#ov-title").strip() != say["lovely"]:
        problems.append(f"{name}: the done card says {page.inner_text('#ov-title')!r}")
    page.screenshot(path=str(SHOTS / f"{name}-k2-done.png"))
    page.click("#ov-buttons button >> nth=-1")  # back to the list
    page.wait_for_timeout(250)
    heads = page.locator("#kleur-list h3 .dogu-size-n").all_inner_texts()
    if not heads or heads[0] != say["mine"]:
        problems.append(f"{name}: no 'my pictures' section first: {heads}")
    if page.locator("#kleur-list .kleur-mine .kleur-card[data-page='p:zon'] .kleur-badge.check").count() != 1:
        problems.append(f"{name}: the finished sun is not under my pictures with a check")
    page.screenshot(path=str(SHOTS / f"{name}-k3-mine.png"))
    page.reload()
    page.wait_for_selector("html[data-ready='1']")
    art = page.evaluate("window.__bubbels.kleur.art()")
    if not art.get("p:zon", {}).get("done") or len(art["p:zon"]["f"]) != 9:
        problems.append(f"{name}: the sun was not kept after a reload: {art.get('p:zon')}")


def teken_drag(page, pts):
    """A real drag with the mouse over the drawing page; pts are fractions of the page."""
    box = page.locator("#teken-canvas").bounding_box()
    at = lambda fx, fy: (box["x"] + box["width"] * fx, box["y"] + box["height"] * fy)
    page.mouse.move(*at(*pts[0]))
    page.mouse.down()
    for a, b in zip(pts, pts[1:]):
        for i in range(1, 9):
            page.mouse.move(*at(a[0] + (b[0] - a[0]) * i / 8, a[1] + (b[1] - a[1]) * i / 8))
    page.mouse.up()
    page.wait_for_timeout(80)


def is_white(rgb):
    return all(c > 245 for c in rgb)


def play_tekenen(page, name, say, problems):
    """Tekenen: draw a real stroke, undo it, mirror mode and stamps are locked on the web (only OK),
    finish a drawing, find it under "my drawings", and check it is still there after a reload."""
    if page.inner_text("#tile-tekenen .tile-name").strip() != say["tekenTile"]:
        problems.append(f"{name}: drawing tile says {page.inner_text('#tile-tekenen .tile-name')!r}")
    page.click("#tile-tekenen")
    page.wait_for_timeout(250)
    if page.inner_text("#screen-tekenen-list h2").strip() != say["drawings"]:
        problems.append(f"{name}: the drawing list is called {page.inner_text('#screen-tekenen-list h2')!r}")
    page.click("#teken-list .teken-new")
    page.wait_for_timeout(300)
    if not page.is_disabled("#teken-done") or not page.is_disabled("#teken-undo"):
        problems.append(f"{name}: on a blank page Done and Undo should be off")
    page.click("#teken-palette .swatch[data-c='0']")
    teken_drag(page, [(0.2, 0.3), (0.5, 0.3), (0.6, 0.5)])
    st = page.evaluate("window.__bubbels.teken.state()")
    if st["items"] != 1 or is_white(page.evaluate("window.__bubbels.teken.pixel(0.35, 0.3)")):
        problems.append(f"{name}: a drag did not draw a stroke ({st}, {page.evaluate('window.__bubbels.teken.pixel(0.35, 0.3)')})")
    if page.is_disabled("#teken-undo") or page.is_disabled("#teken-done"):
        problems.append(f"{name}: after a stroke Undo and Done should be on")
    page.click("#teken-undo")
    page.wait_for_timeout(50)
    if page.evaluate("window.__bubbels.teken.state().items") != 0 or not is_white(page.evaluate("window.__bubbels.teken.pixel(0.35, 0.3)")):
        problems.append(f"{name}: undo did not take the stroke back")
    # mirror mode and stamps are the full version: on the web they offer only OK
    for sel in ("#teken-mirror", "#teken-stamp"):
        if page.locator(f"{sel} .kleur-badge.lock").count() != 1:
            problems.append(f"{name}: {sel} shows no lock on the web")
        page.click(sel)
        page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != [say["ok"]]:
            problems.append(f"{name}: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_selector("#overlay", state="hidden")
        st = page.evaluate("window.__bubbels.teken.state()")
        if st["mirror"] or st["tray"] or st["tool"] == "stamp":
            problems.append(f"{name}: a locked tool opened on the web: {st}")
    page.click("#teken-palette .swatch[data-c='7']")
    page.click("#teken-stage .teken-size[data-z='2']")
    teken_drag(page, [(0.3, 0.7), (0.5, 0.55), (0.7, 0.7)])
    page.click("#teken-palette .swatch[data-c='4']")
    teken_drag(page, [(0.5, 0.15), (0.5, 0.45)])
    if page.evaluate("window.__bubbels.teken.state().items") != 2:
        problems.append(f"{name}: expected 2 strokes, got {page.evaluate('window.__bubbels.teken.state()')}")
    page.screenshot(path=str(SHOTS / f"{name}-t1-draw.png"))
    page.click("#teken-done")
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=8000)  # after the sparkle; slow on a busy host
    if page.inner_text("#ov-title").strip() != say["lovely"]:
        problems.append(f"{name}: the drawing done card says {page.inner_text('#ov-title')!r}")
    page.screenshot(path=str(SHOTS / f"{name}-t2-done.png"))
    page.click("#ov-buttons button >> nth=-1")  # my drawings
    page.wait_for_timeout(250)
    if page.locator("#teken-list .teken-card").count() != 1:
        problems.append(f"{name}: my drawings shows {page.locator('#teken-list .teken-card').count()} drawings")
    page.screenshot(path=str(SHOTS / f"{name}-t3-mine.png"))
    page.reload()
    page.wait_for_selector("html[data-ready='1']")
    kept = page.evaluate("window.__bubbels.teken.drawings()")
    if len(kept) != 1:
        problems.append(f"{name}: after a reload {len(kept)} drawings are kept")
    page.click("#tile-tekenen")
    page.wait_for_timeout(250)
    page.click("#teken-list .teken-card >> nth=0")
    page.wait_for_timeout(300)
    st = page.evaluate("window.__bubbels.teken.state()")
    if st["items"] != 2 or not st["kept"] or is_white(page.evaluate("window.__bubbels.teken.pixel(0.5, 0.3)")):
        problems.append(f"{name}: the drawing did not come back after a reload: {st}")
    if not page.is_disabled("#teken-undo"):
        problems.append(f"{name}: undo can go back past the drawing as it was opened")
    # clear the page, let the autosave pass, undo: the drawing is back and stays kept
    page.click("#teken-clear")
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
    page.click("#ov-buttons button >> nth=0")
    page.wait_for_timeout(900)
    if page.evaluate("window.__bubbels.teken.state().items") != 0 or len(page.evaluate("window.__bubbels.teken.drawings()")) != 1:
        problems.append(f"{name}: clear emptied the page wrongly or the autosave deleted the drawing")
    page.click("#teken-undo")
    page.wait_for_timeout(900)
    st = page.evaluate("window.__bubbels.teken.state()")
    if st["items"] != 2 or not st["kept"] or st["lastSave"] != "saved":
        problems.append(f"{name}: undo after clear did not bring the drawing back for good: {st}")
    page.click("#teken-back")
    page.wait_for_timeout(150)
    # two more drawings fill the free album; the fourth "+" offers the full version first
    for n in range(2):
        page.click("#teken-list .teken-new")
        page.wait_for_timeout(200)
        page.evaluate(f"window.__bubbels.teken.stroke([[0.2, {0.3 + n * 0.2}], [0.8, {0.3 + n * 0.2}]])")
        page.click("#teken-back")
        page.wait_for_timeout(200)
    if page.locator("#teken-list .teken-card").count() != 3 or page.locator("#teken-list .teken-new .kleur-badge.lock").count() != 1:
        problems.append(f"{name}: after 3 drawings the album should be full and the new card locked")
    page.click("#teken-list .teken-new")
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]] or page.evaluate("document.querySelector('#screen-tekenen').classList.contains('active')"):
        problems.append(f"{name}: a 4th drawing on the web offers {labels} or opened the page")
    page.screenshot(path=str(SHOTS / f"{name}-t4-full.png"))
    page.click("#ov-buttons button")
    page.wait_for_selector("#overlay", state="hidden")
    page.click("#screen-tekenen-list [data-go='home']")
    page.wait_for_timeout(150)


def tekenen_fits(browser, base, problems):
    """Tekenen in the full version on small and sideways phones: the page, palette and tools fit
    (no sideways scroll), mirror mode with 8 lines makes 16 copies of a stroke, and a stamp lands."""
    for w, h in ((320, 568), (844, 390), (568, 320)):
        ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        label = f"tekenen {w}x{h}"
        page.click("#tile-tekenen")
        page.wait_for_timeout(250)
        page.click("#teken-list .teken-new")
        page.wait_for_timeout(300)
        if page.locator("#teken-stage .kleur-badge.lock").count():
            problems.append(f"{label}: locks are shown in the full version")
        page.click("#teken-mirror")
        page.wait_for_selector("#teken-tray:not([hidden])")
        page.click("#teken-tray button[data-n='8']")
        st = page.evaluate("window.__bubbels.teken.state()")
        if st["mirror"] != 8 or st["copies"] != 16 or st["tray"]:
            problems.append(f"{label}: mirror mode did not switch to 8 lines: {st}")
        if page.locator("#teken-guides line").count() != 8:
            problems.append(f"{label}: {page.locator('#teken-guides line').count()} guide lines for 8 mirror lines")
        page.click("#teken-palette .swatch[data-c='8']")
        teken_drag(page, [(0.3, 0.25), (0.4, 0.2)])
        # mirrored, upside down, and turned by 45 degrees (a copy only 8 lines make, not 6)
        for fx, fy in ((0.35, 0.225), (0.65, 0.225), (0.35, 0.775), (0.65, 0.775), (0.588, 0.1995)):
            if is_white(page.evaluate(f"window.__bubbels.teken.pixel({fx}, {fy})")):
                problems.append(f"{label}: no mirrored copy at {fx}, {fy}")
        page.screenshot(path=str(SHOTS / f"teken-8lines-{w}x{h}.png"))
        page.click("#teken-undo")
        page.click("#teken-mirror")
        page.click("#teken-tray button[data-n='6']")
        teken_drag(page, [(0.3, 0.25), (0.4, 0.2)])
        if page.evaluate("window.__bubbels.teken.state().copies") != 12:
            problems.append(f"{label}: 6 lines do not make 12 copies")
        if not is_white(page.evaluate("window.__bubbels.teken.pixel(0.588, 0.1995)")) or is_white(page.evaluate("window.__bubbels.teken.pixel(0.663, 0.2326)")):
            problems.append(f"{label}: 6 lines drew a 45-degree copy, or no 60-degree one")
        page.click("#teken-stamp")
        page.wait_for_selector("#teken-tray:not([hidden])")
        page.screenshot(path=str(SHOTS / f"teken-stamps-{w}x{h}.png"))
        small = page.evaluate("""() => [...document.querySelectorAll('#teken-palette .swatch, #teken-stage .tool')]
          .map((b) => b.getBoundingClientRect()).filter((r) => r.width && (r.width < 43.5 || r.height < 43.5)).length""")
        if small and w > h:  # sideways the panel has room for 44 px (upright, the colours share one width, as in Kleurplaten)
            problems.append(f"{label}: {small} colours or tools are smaller than 44 px")
        page.click("#teken-tray button[data-stamp='puppy']")
        page.click("#teken-mirror")
        page.click("#teken-tray button[data-n='0']")
        box = page.locator("#teken-canvas").bounding_box()
        page.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.5)
        st = page.evaluate("window.__bubbels.teken.state()")
        if st["items"] != 2 or st["tool"] != "stamp" or st["stamp"] != "puppy":
            problems.append(f"{label}: the puppy stamp did not land: {st}")
        for sel in ("#teken-page", "#teken-palette", "#teken-done", "#teken-back", "#teken-mirror", "#teken-stamp", "#teken-undo"):
            r = page.locator(sel).bounding_box()
            if r is None or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                problems.append(f"{label}: {sel} off screen: {r}")
        size = page.locator("#teken-page").bounding_box()["width"]
        if size < min(w, h) * 0.5:
            problems.append(f"{label}: the page is only {size} px")
        if page.evaluate("document.documentElement.scrollWidth") > w + 1:
            problems.append(f"{label}: the page scrolls sideways")
        page.screenshot(path=str(SHOTS / f"teken-mandala-{w}x{h}.png"))
        if errors:
            problems.append(f"{label}: page errors: {errors}")
        ctx.close()


def tekenen_locked_four(browser, base, problems):
    """Review of PR #26 (B2): a locked device with 4 drawings (moved in from another device) clears
    one, waits for the autosave, undoes: after a reload all 4 drawings are still there."""
    save = {"version": 1, "games": {"tekenen": {"drawings": {f"k{i}": {"s": "s" + "ABCD"[i] + "BA" + "IAIA" + "QAQA", "t": 1000 + i} for i in range(4)}}},
            "settings": {"muted": True, "lang": "nl"}, "purchase": {"owned": False}}
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844})
    ctx.add_init_script(seeded(save))
    page = ctx.new_page()
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.click("#tile-tekenen")
    page.wait_for_timeout(250)
    if page.locator("#teken-list .teken-card").count() != 4:
        problems.append(f"tekenen 4 drawings: the list shows {page.locator('#teken-list .teken-card').count()}")
    page.click("#teken-list .teken-card[data-id='k1']")
    page.wait_for_timeout(250)
    page.click("#teken-clear")
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
    page.click("#ov-buttons button >> nth=0")
    page.wait_for_timeout(900)
    page.click("#teken-undo")
    page.wait_for_timeout(900)
    page.click("#teken-back")
    page.wait_for_timeout(200)
    if page.locator("#overlay:not([hidden])").count():
        problems.append(f"tekenen 4 drawings: leaving asked {page.inner_text('#ov-title')!r}")
    page.reload()
    page.wait_for_selector("html[data-ready='1']")
    kept = page.evaluate("window.__bubbels.teken.drawings()")
    if sorted(kept) != ["k0", "k1", "k2", "k3"]:
        problems.append(f"tekenen 4 drawings: after clear, undo and a reload only {sorted(kept)} are kept")
    ctx.close()


def kleuren_fits(browser, base, problems):
    """Kleurplaten in the full version on small and sideways phones: a new mandala and a picture
    fit (page, palette and the done button on screen, no sideways scroll), and mirroring colours
    every copy of a shape at once."""
    for w, h in ((320, 568), (568, 320), (844, 390)):
        ctx = browser.new_context(bypass_csp=True, locale="en-GB", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        page.click("#tile-kleuren")
        page.wait_for_timeout(250)
        label = f"kleuren {w}x{h}"
        new = page.locator("#kleur-list .random-btn:not(.locked)")
        if new.count() != 2:
            problems.append(f"{label}: expected 2 open 'new mandala' cards, got {new.count()}")
        new.nth(1).click()
        page.wait_for_timeout(400)
        st = page.evaluate("window.__bubbels.kleur.state()")
        if st["kind"] != "mandala" or not st["key"].startswith("m:m2:"):
            problems.append(f"{label}: 'new mandala' opened {st['key']}")
        page.evaluate("window.__bubbels.kleur.mirror(true)")
        page.click("#kleur-palette .swatch[data-c='7']")
        shape = next(r for r in st["regions"] if r.startswith("b0"))
        group = re.sub(r"\d+$", "", shape)
        page.evaluate(f"window.__bubbels.kleur.paint('{shape}')")
        coloured = page.evaluate("Object.keys(window.__bubbels.kleur.state().fills)")
        if len(coloured) < 6 or not all(re.sub(r"\d+$", "", k) == group for k in coloured):
            problems.append(f"{label}: mirroring coloured {coloured}")
        for sel in ("#kleur-page", "#kleur-palette", "#kleur-done", "#kleur-back"):
            r = page.locator(sel).bounding_box()
            if r is None or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                problems.append(f"{label}: {sel} off screen: {r}")
        if page.evaluate("document.documentElement.scrollWidth") > w + 1:
            problems.append(f"{label}: the page scrolls sideways")
        page.screenshot(path=str(SHOTS / f"kleur-mandala-{w}x{h}.png"))
        page.click("#kleur-back")
        page.click("#kleur-list .kleur-card[data-page='p:raket']")  # a full-version picture
        page.wait_for_timeout(300)
        if page.evaluate("window.__bubbels.kleur.state().key") != "p:raket":
            problems.append(f"{label}: the full version did not open a locked picture")
        if errors:
            problems.append(f"{label}: page errors: {errors}")
        ctx.close()


def random_cards_fit(browser, base, problems):
    """The random cards fit at 320 and 390 px in all four games, locked (web) and open (full)."""
    for w, h in ((320, 568), (390, 844)):
        for owned in (False, True):
            ctx = browser.new_context(bypass_csp=owned, locale="nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
            if owned:
                ctx.add_init_script(OWNED_APP)
            page = ctx.new_page()
            page.goto(base + "/index.html?test")
            page.wait_for_selector("html[data-ready='1']")
            if owned:
                page.wait_for_function("window.__bubbels.full()", timeout=8000)
            for tile, home in (("bubbels", "levels"), ("dogudoku", "dogudoku-levels"), ("picturedoku", "picturedoku-levels"), ("slang", "slang-menu")):
                page.click(f"#tile-{tile}")
                page.wait_for_timeout(250)
                cards = page.evaluate(CARD_FIT_JS)
                label = f"{w}px {'full' if owned else 'web'} {tile}"
                if not cards:
                    problems.append(f"random cards: none in {label}")
                for i, c in enumerate(cards):
                    if c["over"] or c["bad"] or c["right"] > c["vw"] + 0.5:
                        problems.append(f"random cards: {label} card {i} overflows ({c})")
                if w == 320 and tile in ("bubbels", "slang"):
                    page.locator(".screen.active .random-btn >> nth=0").scroll_into_view_if_needed()
                    page.screenshot(path=str(SHOTS / f"random-card-{w}-{'full' if owned else 'web'}-{tile}.png"))
                page.evaluate(f"document.querySelector('#screen-{home} [data-go=home]').click()")
                page.wait_for_timeout(150)
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


def solve_gate(page, lang):
    """Answer the parental gate that is on screen (the sum is written in words)."""
    page.wait_for_selector(".gate-input")
    m = re.search(TEXT[lang]["ask"], page.inner_text("#ov-text"))
    words = WORDS[lang]
    page.fill(".gate-input", str(words.index(m.group(1)) * words.index(m.group(2))))
    page.keyboard.press("Enter")


def seeded(save):
    return "if (!localStorage.getItem('bubbels.save')) localStorage.setItem('bubbels.save', %s);" % json.dumps(json.dumps(save))


def open_transfer(browser, base, lang, save, viewport=(390, 844)):
    w, h = viewport
    ctx = browser.new_context(bypass_csp=True, locale={"nl": "nl-NL", "en": "en-GB"}[lang], viewport={"width": w, "height": h},
                              device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(seeded(save))
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    outside = []
    page.on("request", lambda r: outside.append(r.url) if not r.url.startswith(base) and not r.url.startswith("data:") else None)
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.click("#btn-settings")
    page.click("#btn-transfer")
    solve_gate(page, lang)
    page.wait_for_selector("#screen-transfer.active")
    page.wait_for_timeout(300)
    return ctx, page, errors, outside


SLOW_CAMERA = """
window.__tracks = [];
const fake = () => new Promise((resolve) => setTimeout(() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  c.getContext('2d').fillRect(0, 0, 64, 64);
  const s = c.captureStream(5);
  window.__tracks.push(...s.getTracks());
  resolve(s);
}, 600));
Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: fake }, configurable: true });
"""


def transfer_camera_race(browser, base, problems):
    """Review of PR #20, B1: a camera that starts slowly, tapped twice, the tab switched and the
    screen left meanwhile, must leave no camera running. On the receive tab exactly one runs."""
    small = {"version": 1, "games": {"bubbels": {"stars": {"1": 3}}}, "settings": {"muted": False, "lang": "nl"}, "purchase": {"owned": False}}
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(seeded(small))
    ctx.add_init_script(SLOW_CAMERA)
    page = ctx.new_page()
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.click("#btn-settings")
    page.click("#btn-transfer")
    solve_gate(page, "nl")
    page.wait_for_selector("#screen-transfer.active")
    live = "window.__tracks.filter((t) => t.readyState === 'live').length"
    page.click("[data-transfer='receive']")
    page.click("[data-transfer='receive']")
    page.click("[data-transfer='send']")
    page.click("[data-transfer='receive']")
    page.wait_for_timeout(1500)
    n = page.evaluate(live)
    if n != 1:
        problems.append(f"transfer camera: {n} cameras run on the receive tab after quick taps (expected 1)")
    page.click("[data-transfer='send']")
    page.click("[data-transfer='receive']")
    page.click("#screen-transfer [data-go='settings']")  # leave while the camera is still starting
    page.wait_for_timeout(1500)
    n = page.evaluate(live)
    if n != 0:
        problems.append(f"transfer camera: {n} cameras still run after leaving the screen")
    ctx.close()


def transfer_flow(browser, base, problems):
    """Voortgang overzetten: the QR codes on one device, read from screenshots by another device
    (jsQR, as on a phone without BarcodeDetector), merged; and the paste fallback with replace.
    The purchase never travels. The screens fit at 320 px and sideways."""
    for lang in ("nl", "en"):
        name = f"transfer-{lang}"
        art = {"p:zon": {"f": {"face": 7, "ray0": 2, "ray1": 3}, "t": 1000, "done": True}}
        for i in range(12):  # enough to need more than one code
            art[f"m:m1:{1000 + i}"] = {"f": {f"b{r % 5}w{r}": (r + i) % 16 for r in range(60)}, "t": 2000 + i, "done": False}
        sender = {"version": 1, "games": {"bubbels": {"stars": {"1": 3, "2": 3, "3": 2}}, "klok": {"stars": {"set-t1-1": 3}}, "kleuren": {"art": art}},
                  "settings": {"muted": False, "lang": lang}, "purchase": {"owned": True}}
        receiver = {"version": 1, "games": {"bubbels": {"stars": {"1": 1, "5": 2}}}, "settings": {"muted": False, "lang": lang}, "purchase": {"owned": False}}
        ca, a, err_a, out_a = open_transfer(browser, base, lang, sender)
        cb, b, err_b, out_b = open_transfer(browser, base, lang, receiver)
        parts = a.evaluate("window.__bubbels.transfer.parts()")
        if len(parts) < 2:
            problems.append(f"{name}: expected several QR codes for 12 pages, got {len(parts)}")
        a.screenshot(path=str(SHOTS / f"{name}-send.png"))
        b.click("[data-transfer='receive']")
        b.wait_for_timeout(600)
        status = b.inner_text("#transfer-status")
        b.screenshot(path=str(SHOTS / f"{name}-scan.png"))
        if not status:
            problems.append(f"{name}: the receive tab shows no status")
        # read the sender's screen, code by code, as a camera would
        seen = set()
        deadline = time.time() + 1.6 * len(parts) + 6
        while time.time() < deadline and b.locator("#overlay").is_hidden():
            png = a.locator("#transfer-qr").screenshot()
            url = "data:image/png;base64," + base64.b64encode(png).decode()
            for text in b.evaluate("(u) => window.__bubbels.transfer.readImage(u)", url):
                seen.add(text)
                b.evaluate("(t) => window.__bubbels.transfer.take(t)", text)
            a.wait_for_timeout(400)
        if len(seen) != len(parts) or b.locator("#overlay").is_hidden():
            problems.append(f"{name}: read {len(seen)} of {len(parts)} codes from the screen; no summary card")
        else:
            b.screenshot(path=str(SHOTS / f"{name}-summary.png"))
            summary = b.inner_text("#ov-text")
            if "12" not in summary and "13" not in summary:
                problems.append(f"{name}: the summary does not count the pages: {summary!r}")
            b.click("#ov-buttons button >> nth=0")  # merge
            b.wait_for_selector("#ov-buttons button")
            b.wait_for_timeout(300)
            with b.expect_navigation():
                b.click("#ov-buttons button >> nth=0")  # done -> reload
            b.wait_for_selector("html[data-ready='1']")
            got = b.evaluate("window.__bubbels.save()")
            if got["games"]["bubbels"]["stars"] != {"1": 3, "2": 3, "3": 2, "5": 2}:
                problems.append(f"{name}: merge gave {got['games']['bubbels']['stars']}")
            if len(got["games"].get("kleuren", {}).get("art", {})) != 13:
                problems.append(f"{name}: merged pages: {len(got['games'].get('kleuren', {}).get('art', {}))}")
            if got["purchase"]["owned"]:
                problems.append(f"{name}: the purchase travelled with the progress")
        # paste fallback, then replace (with its second question)
        a.click("#transfer-copy")
        a.wait_for_timeout(300)
        code = a.input_value("#transfer-code")
        b.click("#btn-settings")
        b.click("#btn-transfer")
        solve_gate(b, lang)
        b.wait_for_selector("#screen-transfer.active")
        b.click("[data-transfer='receive']")
        b.fill("#transfer-input", code)
        b.click("#transfer-use")
        b.wait_for_selector("#overlay:not([hidden])")
        b.click("#ov-buttons button >> nth=1")  # replace
        b.wait_for_timeout(200)
        b.click("#ov-buttons button >> nth=0")  # yes, replace
        b.wait_for_selector("#ov-buttons button")
        b.wait_for_timeout(300)
        with b.expect_navigation():
            b.click("#ov-buttons button >> nth=0")
        b.wait_for_selector("html[data-ready='1']")
        got = b.evaluate("window.__bubbels.save()")
        if got["games"]["bubbels"]["stars"] != {"1": 3, "2": 3, "3": 2} or got["purchase"]["owned"]:
            problems.append(f"{name}: replace gave {got['games'].get('bubbels')} owned={got['purchase']['owned']}")
        # a broken paste is refused with a message, nothing changes
        b.click("#btn-settings")
        b.click("#btn-transfer")
        solve_gate(b, lang)
        b.wait_for_selector("#screen-transfer.active")
        b.click("[data-transfer='receive']")
        b.fill("#transfer-input", code.splitlines()[0][:-6] + "ZZZZZZ")
        b.click("#transfer-use")
        b.wait_for_timeout(300)
        if b.locator("#overlay").is_visible() or not b.inner_text("#transfer-status"):
            problems.append(f"{name}: a broken code was not refused with a message")
        for label, errs, outs in (("sender", err_a, out_a), ("receiver", err_b, out_b)):
            if errs:
                problems.append(f"{name} {label}: page errors: {errs}")
            if outs:
                problems.append(f"{name} {label}: requests outside the site: {outs[:3]}")
        ca.close()
        cb.close()
    small = {"version": 1, "games": {"bubbels": {"stars": {"1": 3}}}, "settings": {"muted": False, "lang": "nl"}, "purchase": {"owned": False}}
    for w, h in ((320, 568), (640, 360)):
        ctx, page, errs, _ = open_transfer(browser, base, "nl", small, (w, h))
        for tab in ("send", "receive"):
            page.click(f"[data-transfer='{tab}']")
            page.wait_for_timeout(300)
            if page.evaluate("document.documentElement.scrollWidth") > w + 1:
                problems.append(f"transfer {w}x{h} {tab}: the page scrolls sideways")
            # no camera in the test browser: the receive tab hides the camera box and shows the paste box
            for sel in (("#transfer-qr", "#transfer-copy") if tab == "send" else ("#transfer-input", "#transfer-use")):
                r = page.locator(sel).bounding_box()
                if r is None or r["x"] < -0.5 or r["x"] + r["width"] > w + 0.5:
                    problems.append(f"transfer {w}x{h}: {sel} off screen: {r}")
            t = page.locator(".transfer-tabs").bounding_box()
            if t is None or t["height"] > 80:
                problems.append(f"transfer {w}x{h}: Versturen/Ontvangen are not on one line: {t}")
            if tab == "send" and h < 500:  # sideways: the hint and the buttons are in view too
                for sel in ("#transfer-copy", ".transfer-pane:not([hidden]) .setting-text"):
                    r = page.locator(sel).bounding_box()
                    if r is None or r["y"] + r["height"] > h + 0.5:
                        problems.append(f"transfer {w}x{h}: {sel} is below the screen: {r}")
            if tab == "send":  # the whole QR code must be on screen without scrolling, or it cannot be scanned
                r = page.locator("#transfer-qr").bounding_box()
                if r is None or r["y"] < -0.5 or r["y"] + r["height"] > h + 0.5:
                    problems.append(f"transfer {w}x{h}: the QR code does not fit on the screen: {r}")
            page.screenshot(path=str(SHOTS / f"transfer-{tab}-{w}x{h}.png"))
        if errs:
            problems.append(f"transfer {w}x{h}: page errors: {errs}")
        ctx.close()


def letters_play(browser, base, problems):
    """Letters: one round of each kind played by taps (Dutch and English), with nothing spoken: the
    big letter matches its tile, the word shows a gap, the build word is traced; stars saved; a
    gentle wrong tap, a locked tier; then the layouts at 320x568 and sideways stay on screen."""
    for lang, w, h, full in (("nl", 390, 844, True), ("en", 390, 844, True), ("nl", 320, 568, False), ("en", 844, 390, False), ("nl", 568, 320, False)):
        ctx = browser.new_context(bypass_csp=True, locale="en-GB" if lang == "en" else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        errors = []
        requests = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("request", lambda r: requests.append(r.url))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.click("#tile-letters")
        page.wait_for_timeout(200)
        if page.locator("#letters-replay, #letters-muted").count():
            problems.append(f"letters {lang}: the voice button or the sound-off note is still there")
        for mode in ("tap", "first", "build"):
            page.evaluate(f"window.__bubbels.letters.start('{mode}-t1-1')")
            page.wait_for_timeout(250)
            if page.is_visible("#overlay"):
                page.click("#ov-buttons button")
                page.wait_for_timeout(200)
            sels = ("#letters-prompt", "#letters-pic", "#letters-options", "#letters-dots") + (("#letters-word",) if mode == "first" else ("#letters-slots",) if mode == "build" else ())
            for sel in sels:
                r = page.locator(sel).bounding_box()
                if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                    problems.append(f"letters {w}x{h} {lang} {mode}: {sel} off screen ({r})")
            if page.evaluate("document.documentElement.scrollWidth") > w:
                problems.append(f"letters {w}x{h} {lang} {mode}: sideways scroll")
            page.screenshot(path=str(SHOTS / f"letters-{w}x{h}-{lang}-{mode}.png"))
            if not full:
                continue
            for _ in range(12):
                st = page.evaluate("window.__bubbels.letters.state()")
                if st["done"]:
                    break
                q = st["q"]
                if mode == "build":
                    ghosts = page.evaluate("[...document.querySelectorAll('#letters-slots .ghost')].map((g) => [g.textContent, +getComputedStyle(g).opacity])")
                    if [g for g, _ in ghosts] != list(q["word"]) or min(o for _, o in ghosts) < 0.15:
                        problems.append(f"letters {lang} build t1: the word to trace is not shown ({ghosts}, {q['word']})")
                    for letter in q["word"]:
                        tiles = page.locator("#letters-options .letters-tile:not(.used)")
                        n = tiles.count()
                        for k in range(n):
                            if tiles.nth(k).get_attribute("data-letter") == letter:
                                tiles.nth(k).click()
                                break
                        page.wait_for_timeout(60)
                else:
                    right = q["letter"] if mode == "tap" else q["word"][0]
                    if mode == "tap":
                        big = page.text_content("#letters-pic .letters-big")
                        tile = page.text_content(f"#letters-options .letters-tile[data-letter='{right}']")
                        if big != tile:
                            problems.append(f"letters {lang} tap t1: the big letter {big!r} is not drawn like its tile {tile!r}")
                    else:
                        word = page.text_content("#letters-word")
                        if word != q["word"][1:] or page.text_content("#letters-word .letters-gap") != "":
                            problems.append(f"letters {lang} first: the word with a gap reads {word!r} for {q['word']!r}")
                    page.locator(f"#letters-options .letters-tile[data-letter='{right}']").click()
                    if mode == "first":
                        page.wait_for_timeout(100)
                        if page.text_content("#letters-word") != q["word"]:
                            problems.append(f"letters {lang} first: the gap was not filled ({page.text_content('#letters-word')!r})")
                page.wait_for_timeout(1500)
            st = page.evaluate("window.__bubbels.letters.state()")
            if not st["done"]:
                problems.append(f"letters {lang} {mode}: round did not finish ({st['i']})")
            got = page.evaluate("window.__bubbels.letters.stars()").get(f"{mode}-t1-1")
            if got != 3:
                problems.append(f"letters {lang} {mode}: stars {got}, want 3")
            if mode == "build":
                page.screenshot(path=str(SHOTS / f"letters-{w}x{h}-{lang}-done.png"))
            page.click("#ov-buttons button:last-child")
            page.wait_for_timeout(150)
        # a wrong tap: gentle (a shake, "try again", counted once, the same question stays)
        if full:
            page.evaluate("window.__bubbels.letters.start('tap-t1-2')")
            page.wait_for_timeout(250)
            st = page.evaluate("window.__bubbels.letters.state()")
            wrong = [o for o in st["q"]["options"] if o != st["q"]["letter"]][0]
            page.locator(f"#letters-options .letters-tile[data-letter='{wrong}']").click()
            page.wait_for_timeout(200)
            after = page.evaluate("window.__bubbels.letters.state()")
            status = page.text_content("#letters-status")
            shaken = "wrong" in (page.get_attribute(f"#letters-options .letters-tile[data-letter='{wrong}']", "class") or "")
            if after["mistakes"] != 1 or after["i"] != st["i"] or not shaken or not status or page.is_visible("#overlay"):
                problems.append(f"letters {lang}: a wrong tap was not handled gently ({after['mistakes']}, {status!r}, {shaken})")
            page.screenshot(path=str(SHOTS / f"letters-{w}x{h}-{lang}-wrong.png"))
            # locked tiers stay locked without the purchase
            page.evaluate("window.__bubbels.letters.start('tap-t2-1')")
            page.wait_for_timeout(250)
            if page.evaluate("window.__bubbels.letters.state()")["tier"] == "t2":
                problems.append(f"letters {lang}: a locked tier opened without the purchase")
            if not page.is_visible("#overlay"):
                problems.append(f"letters {lang}: a locked tier showed no offer")
            page.screenshot(path=str(SHOTS / f"letters-{w}x{h}-{lang}-locked.png"))
        if errors:
            problems.append(f"letters {w}x{h} {lang}: page errors {errors[:2]}")
        clips = [u for u in requests if u.endswith(".mp3") or "/voice" in u]
        if clips:
            problems.append(f"letters {w}x{h} {lang}: asked for voice files {clips[:2]}")
        ctx.close()
    # tiers 2 and 3 (full version): tier 2 matches a capital with its small letter and shows the
    # build word for a moment (a tap on the picture shows it again)
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(OWNED_APP)
    page = ctx.new_page()
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.wait_for_function("window.__bubbels.full()", timeout=8000)
    page.click("#tile-letters")
    page.evaluate("window.__bubbels.letters.start('tap-t2-1')")
    page.wait_for_timeout(250)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    st = page.evaluate("window.__bubbels.letters.state()")
    big = page.text_content("#letters-pic .letters-big")
    if big != st["q"]["letter"].upper() or page.text_content(f"#letters-options .letters-tile[data-letter='{st['q']['letter']}']") != st["q"]["letter"]:
        problems.append(f"letters t2 tap: big {big!r} for {st['q']['letter']!r}, want a capital over small tiles")
    page.screenshot(path=str(SHOTS / "letters-390x844-nl-tap-t2.png"))
    page.evaluate("window.__bubbels.letters.start('tap-t3-1')")
    page.wait_for_timeout(250)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    page.screenshot(path=str(SHOTS / "letters-390x844-nl-tap-t3.png"))
    page.evaluate("window.__bubbels.letters.start('build-t2-1')")
    page.wait_for_timeout(250)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    if not page.evaluate("window.__bubbels.letters.peeking()"):
        problems.append("letters t2 build: the word is not shown at the start")
    page.screenshot(path=str(SHOTS / "letters-390x844-nl-build-t2-peek.png"))
    page.wait_for_timeout(2400)
    if page.evaluate("window.__bubbels.letters.peeking()"):
        problems.append("letters t2 build: the word did not hide after a moment")
    if not page.is_visible("#letters-pic .letters-peek"):
        problems.append("letters t2 build: no eye on the picture once the word is hidden")
    page.screenshot(path=str(SHOTS / "letters-390x844-nl-build-t2-hidden.png"))
    peek_btn = page.locator("#letters-pic button.letters-peekbtn")
    if peek_btn.count() != 1 or not peek_btn.get_attribute("aria-label"):
        problems.append("letters t2 build: the picture is not a named button")
    peek_btn.click()
    page.wait_for_timeout(100)
    if not page.evaluate("window.__bubbels.letters.peeking()"):
        problems.append("letters t2 build: a tap on the picture did not show the word again")
    # two quick wrong taps while the word shows must not keep it on screen for good
    page.evaluate("window.__bubbels.letters.start('build-t2-2')")
    page.wait_for_timeout(200)
    st = page.evaluate("window.__bubbels.letters.state()")
    wrong = [k for k, l in enumerate(st["q"]["tiles"]) if l != st["q"]["word"][0]]
    for _ in range(2):
        page.locator(f"#letters-options .letters-tile[data-k='{wrong[0]}']").click()
        page.wait_for_timeout(120)
    page.wait_for_timeout(2400)
    if page.evaluate("window.__bubbels.letters.peeking()") or not page.is_visible("#letters-pic .letters-peek"):
        problems.append("letters t2 build: after two quick wrong taps the word stayed or the eye did not come")
    page.evaluate("window.__bubbels.letters.start('build-t3-1')")
    page.wait_for_timeout(250)
    if page.locator("#letters-slots .ghost").count():
        problems.append("letters t3 build: the word is shown, want the picture only")
    ctx.close()
    # tier 3 sideways (full version): six tiles in 3x2, each at least 44 px, nothing off screen
    for w, h in ((568, 320), (640, 360)):
        ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        page.click("#tile-letters")
        for mode in ("tap", "first", "build"):
            page.evaluate(f"window.__bubbels.letters.start('{mode}-t3-1')")
            page.wait_for_timeout(250)
            if page.is_visible("#overlay"):
                page.click("#ov-buttons button")
                page.wait_for_timeout(200)
            boxes = page.evaluate("[...document.querySelectorAll('#letters-options .letters-tile')].map((b) => { const r = b.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })")
            for x, y, bw, bh in boxes:
                if min(bw, bh) < 44 or x < -0.5 or y < -0.5 or x + bw > w + 0.5 or y + bh > h + 0.5:
                    problems.append(f"letters t3 {w}x{h} {mode}: tile {round(bw)}x{round(bh)} at {round(x)},{round(y)}")
                    break
            for sel in ("#letters-pic", "#letters-slots") if mode != "tap" else ():
                r = page.locator(sel).bounding_box()
                if r and (r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5):
                    problems.append(f"letters t3 {w}x{h} {mode}: {sel} off screen ({r})")
            page.screenshot(path=str(SHOTS / f"letters-t3-{w}x{h}-{mode}.png"))
        ctx.close()


# ---------- Dammen ----------

def dam_wait(page, timeout=15000):
    """Until no piece is moving and the computer is not thinking."""
    page.wait_for_function("(() => { const s = window.__bubbels.dam.state(); return s && !s.busy; })()", timeout=timeout)


def dam_play(page, move):
    """Play one move by tapping its piece and then each landing square, as a child does."""
    st = page.evaluate("window.__bubbels.dam.state()")
    before = st["history"]
    if not st["sel"] or st["sel"]["from"] != move["from"]:
        page.click(f".dsq[data-i='{move['from']}']")
    for sq in move["path"]:
        if page.evaluate("window.__bubbels.dam.state()")["history"] != before or page.evaluate("window.__bubbels.dam.state().busy"):
            break
        page.click(f".dsq[data-i='{sq}']")
    page.wait_for_function(f"(() => {{ const s = window.__bubbels.dam.state(); return s.history !== {before} || s.over; }})()", timeout=5000)
    dam_wait(page)


def dam_fits(page, w, h, label, problems, min_cell=None):
    """The board, the turn chips and the HUD buttons stay on screen; no sideways scroll."""
    for sel in ("#dammen-board", "#dammen-turn", "#dammen-back", "#dammen-undo"):
        r = page.locator(sel).bounding_box()
        if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
            problems.append(f"dammen {label}: {sel} off screen ({r})")
    for sel in ("#dammen-back", "#dammen-undo"):
        r = page.locator(sel).bounding_box()
        if r and min(r["width"], r["height"]) < 44:
            problems.append(f"dammen {label}: {sel} only {r['width']:.0f}x{r['height']:.0f}")
    if page.evaluate("document.documentElement.scrollWidth") > w:
        problems.append(f"dammen {label}: sideways scroll")
    cell = page.locator(".dsq.dark >> nth=0").bounding_box()
    if min_cell and cell["width"] < min_cell:
        problems.append(f"dammen {label}: squares only {cell['width']:.0f} px")
    return cell["width"]


def dammen_flow(browser, base, problems):
    """Dammen on the web build: locked parts offer only OK; a two-player game on 8x8 played to a
    win by taps (counter not saved for duo, end card); against easy: a move, the computer's answer,
    a take-back, back + keep playing; the glow on the pieces that must capture and a double jump
    by taps; a near tap goes to the nearest movable piece; the Android back button."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.inner_text("#tile-dammen .tile-name").strip() != "Dammen":
        problems.append(f"dammen: tile says {page.inner_text('#tile-dammen .tile-name')!r}")
    page.click("#tile-dammen")
    page.wait_for_timeout(250)
    for sel in (".dam-level[data-level='2']", ".dam-level[data-level='3']", ".dam-opt.board-big"):
        page.click(sel)
        page.wait_for_timeout(200)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != ["Oké"]:
            problems.append(f"dammen: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "dammen-1-menu.png"), full_page=True)

    # two players on 8x8: both sides play their last legal move (a known 45-move game player 1 wins)
    page.click(".dam-opt.board-small")
    page.click(".dam-opt.mode-duo")
    page.click("#dammen-play")
    page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / "dammen-2-start.png"))
    dam_fits(page, 390, 844, "390x844", problems, min_cell=44)
    for ply in range(120):
        st = page.evaluate("window.__bubbels.dam.state()")
        if st["over"]:
            break
        dam_play(page, st["moves"][-1])
        if ply == 20:
            page.screenshot(path=str(SHOTS / "dammen-3-duo.png"))
    st = page.evaluate("window.__bubbels.dam.state()")
    if not st["over"] or st["over"].get("winner") != 1:
        problems.append(f"dammen: the two-player game did not end in a win for player 1: {st['over']}")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / "dammen-4-duo-win.png"))
    if page.inner_text("#ov-title").strip() != "Puppy wint!":
        problems.append(f"dammen: end card says {page.inner_text('#ov-title')!r}")
    if page.evaluate("(window.__bubbels.save().games.dammen || {}).stars || {}"):
        problems.append("dammen: a game played together was counted")
    page.click("#ov-buttons button >> text=Menu")
    page.wait_for_timeout(200)

    # against easy: one move, the computer answers, a take-back, back + keep playing
    page.click(".dam-level[data-level='1']")
    page.click("#dammen-play")
    page.wait_for_timeout(300)
    st = page.evaluate("window.__bubbels.dam.state()")
    # a tap a little off the piece still picks the nearest piece that can move
    m = st["moves"][0]
    box = page.locator(f".dsq[data-i='{m['from']}']").bounding_box()
    page.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 1.3)  # on the light square below it
    if (page.evaluate("window.__bubbels.dam.state().sel") or {}).get("from") is None:
        problems.append("dammen: a tap next to a movable piece did not pick it up")
    page.click(".dsq[data-i='" + str(m['from']) + "']")  # put it down again
    dam_play(page, m)
    st = page.evaluate("window.__bubbels.dam.state()")
    if st["history"] != 2 or st["turn"] != 1:
        problems.append(f"dammen: after one move against easy: {st['history']} moves, turn {st['turn']}")
    page.screenshot(path=str(SHOTS / "dammen-5-vs-easy.png"))
    dam_play(page, st["moves"][0])
    page.click("#dammen-undo")
    page.wait_for_timeout(150)
    st = page.evaluate("window.__bubbels.dam.state()")
    if st["history"] != 2 or st["turn"] != 1:
        problems.append(f"dammen: the take-back left {st['history']} moves, turn {st['turn']}")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(200)
    if not page.is_visible("#dammen-continue"):
        problems.append("dammen: the back button did not lead to the menu with 'keep playing'")
    page.click("#dammen-continue")
    page.wait_for_timeout(200)

    # compulsory capture: the glow is on the pieces that can capture, and a double jump by taps
    board = [0] * 64
    for r, c, v in ((7, 0, 1), (6, 1, 2), (4, 3, 2), (5, 6, 1), (0, 7, 2), (1, 0, 2)):
        board[r * 8 + c] = v
    page.evaluate(f"window.__bubbels.dam.setBoard({board})")
    page.wait_for_timeout(200)
    glow = page.evaluate("[...document.querySelectorAll('.dsq.must')].map((e) => Number(e.dataset.i))")
    if glow != [56]:
        problems.append(f"dammen: the glow is on {glow}, expected only the capturing piece [56]")
    page.screenshot(path=str(SHOTS / "dammen-6-must.png"))
    page.click(".dsq[data-i='46']")  # a piece that cannot: a gentle message
    if "Slaan moet" not in page.inner_text("#dammen-status"):
        problems.append(f"dammen: tapping a piece that may not move says {page.inner_text('#dammen-status')!r}")
    page.click(".dsq[data-i='56']")
    page.click(".dsq[data-i='42']")  # the first landing square: the rest of the double jump goes by itself
    page.wait_for_timeout(100)
    page.screenshot(path=str(SHOTS / "dammen-7-jump.png"))
    dam_wait(page)
    st = page.evaluate("window.__bubbels.dam.state()")
    if st["board"][28] != 1 or st["board"][49] or st["board"][35]:
        problems.append("dammen: the double jump did not land on square 28 with both pieces taken")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(150)
    page.evaluate("document.querySelector('#screen-dammen-menu [data-go=home]').click()")
    if errors:
        problems.append(f"dammen: page errors {errors[:3]}")
    ctx.close()


def dammen_layouts(browser, base, problems):
    """Dammen at 320x568, sideways 844x390 and 568x320, and on desktop; the full version: the 10x10
    board on a small phone (a near tap reaches a piece), and the hard computer thinks in a worker
    without freezing the page."""
    for w, h, owned, variant in ((320, 568, False, "small"), (844, 390, False, "small"), (568, 320, False, "small"), (1280, 800, False, "small"),
                                 (320, 568, True, "big"), (568, 320, True, "big"), (390, 844, True, "big")):
        mobile = w < 1000
        english = (w, h) == (390, 844)
        ctx = browser.new_context(bypass_csp=True, locale="en-GB" if english else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
        if owned:
            ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        if owned:
            page.wait_for_function("window.__bubbels.full()", timeout=8000)
        label = f"{w}x{h}{' full ' + variant if owned else ''}"
        if english and page.inner_text("#tile-dammen .tile-name").strip() != "Checkers":
            problems.append(f"dammen {label}: English tile says {page.inner_text('#tile-dammen .tile-name')!r}")
        page.click("#tile-dammen")
        page.wait_for_timeout(200)
        if (w, h) == (320, 568) and not owned:
            page.click(".dam-opt.look-classic")  # the classic look
            page.wait_for_timeout(100)
        page.screenshot(path=str(SHOTS / f"dammen-menu-{w}x{h}{'-full' if owned else ''}.png"), full_page=True)
        page.evaluate(f"window.__bubbels.dam.choose({{ variant: '{variant}', mode: 'cpu', level: {3 if owned else 1} }})")
        page.click("#dammen-play")
        page.wait_for_timeout(400)
        cell = dam_fits(page, w, h, label, problems)
        print(f"[dammen {label}] square {cell:.0f} px")
        st = page.evaluate("window.__bubbels.dam.state()")
        if st["size"] != (10 if variant == "big" else 8):
            problems.append(f"dammen {label}: board size {st['size']}")
        if cell < 44:
            # small squares: a tap a third of a square off still reaches the piece
            m = st["moves"][0]
            box = page.locator(f".dsq[data-i='{m['from']}']").bounding_box()
            page.mouse.click(box["x"] + box["width"] * 1.25, box["y"] + box["height"] * 0.5)
            if (page.evaluate("window.__bubbels.dam.state().sel") or {}).get("from") != m["from"] and not any(x["from"] == (page.evaluate("window.__bubbels.dam.state().sel") or {}).get("from") for x in st["moves"]):
                problems.append(f"dammen {label}: a near tap reached no piece")
        st = page.evaluate("window.__bubbels.dam.state()")
        page.click(f".dsq[data-i='{st['moves'][-1]['from']}']")
        page.wait_for_timeout(150)
        page.screenshot(path=str(SHOTS / f"dammen-{w}x{h}{'-full' if owned else ''}.png"))
        if owned:
            # hard on the big board: the page keeps drawing frames while the computer thinks
            page.evaluate("window.__frames = 0; (function f() { window.__frames++; requestAnimationFrame(f); })()")
            dam_play(page, page.evaluate("window.__bubbels.dam.state()")["moves"][-1])
            st = page.evaluate("window.__bubbels.dam.state()")
            if st["turn"] != 1 or st["history"] != 2:
                problems.append(f"dammen {label}: hard did not answer ({st['history']} moves)")
            if page.evaluate("window.__frames") < 20:
                problems.append(f"dammen {label}: only {page.evaluate('window.__frames')} frames while the computer thought")
        if errors:
            problems.append(f"dammen {label}: page errors {errors[:2]}")
        ctx.close()


def main():
    SHOTS.mkdir(exist_ok=True)
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=str(WEB)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    problems = []
    only = sorted(set(sys.argv[1:]))  # e.g. `tests/smoke.py dammen`: only that game's parts
    unknown = [n for n in only if n not in PARTS]
    if unknown:
        httpd.shutdown()
        print(f"unknown part(s): {', '.join(unknown)}; known: {', '.join(sorted(PARTS))}")
        return 2
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME)
            if only:
                for name in only:
                    for fn in PARTS[name]:
                        fn(browser, base, problems)
                browser.close()
                return report(problems)
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
            random_cards_fit(browser, base, problems)
            kleuren_fits(browser, base, problems)
            tekenen_fits(browser, base, problems)
            tekenen_locked_four(browser, base, problems)
            klok_layouts(browser, base, problems)
            klok_touch(browser, base, problems)
            letters_play(browser, base, problems)
            transfer_flow(browser, base, problems)
            transfer_camera_race(browser, base, problems)
            dammen_flow(browser, base, problems)
            dammen_layouts(browser, base, problems)
            browser.close()
    finally:
        httpd.shutdown()
    return report(problems)


# the parts that can be run on their own: `uv run --with playwright python tests/smoke.py dammen`
PARTS = {"dammen": (dammen_flow, dammen_layouts)}


def report(problems):
    if problems:
        print("FAIL")
        for line in problems:
            print(" -", line)
        return 1
    print(f"OK: screenshots in {SHOTS}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
