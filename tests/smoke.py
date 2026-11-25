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
hint and "keep playing"; the layout at 320×568 and sideways; the digital rounds: klok_digital and
klok_digital_layouts, `tests/smoke.py klok`), play Dammen, Tijgers en geitjes and Ganzenbord (see
dammen_flow, baghchal_flow and ganzen_flow; `tests/smoke.py dammen`, `baghchal` or `ganzen` runs only those), end the free
part of every game and close the offer (offers_bubbels, offers_others; `tests/smoke.py offers`, or
`bubbels` for Bubbels alone: every way out of the offer lands on the list, never on the finished
board), play Paartjes (memory_flow; `tests/smoke.py memory`), play Kwartet (kwartet_flow; `tests/smoke.py kwartet`), play Legpuzzel (legpuzzel_flow; `tests/smoke.py legpuzzel`), play the Piano (piano_flow; `tests/smoke.py piano`), play the drums (drums_flow; `tests/smoke.py drums`), play Egeltje (doolhof_play; `tests/smoke.py doolhof`), play Verstoppertje (verstop_flow; `tests/smoke.py verstop`), lay Treintje's track (treintje_flow; `tests/smoke.py treintje`), play Kangoeroe op de getallenlijn (kangoeroe_flow; `tests/smoke.py kangoeroe`), pay in Winkeltje (winkel_flow; `tests/smoke.py winkel`), play Kaartpuzzel (kaart_flow; `tests/smoke.py kaart`), record and play back in Papegaai with Chromium's fake microphone (papegaai_flow; `tests/smoke.py papegaai`), check that nothing went to the network and nothing threw, that the
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
# the headless shell installed on the dev host; elsewhere (CI) Playwright's own browser is used
CHROME = os.environ.get(
    "CHROME",
    "/home/agent/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell",
)
if not os.path.exists(CHROME):
    CHROME = None
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


def unfold(page):
    """Open the "Volledige versie" fold on the screen in view by a real tap on it (js/fold.js):
    the locked choices wait there, closed, at the end of the menu."""
    head = page.locator(".screen.active details.full-fold:not([open]) > summary")
    if head.count():
        head.first.scroll_into_view_if_needed()
        head.first.click()
        page.wait_for_timeout(120)
        return True
    return False


def choose(page, sel, tap=False):
    """Pick a choice in a menu like a child would: when it waits in the closed "Volledige versie"
    fold, open the fold first (a real tap), then tap the choice."""
    loc = page.locator(sel).first
    if loc.evaluate("el => !!el.closest('details.full-fold:not([open])')"):
        loc.evaluate("el => el.closest('details.full-fold').querySelector('summary').scrollIntoView({block: 'center'})")
        page.locator(".screen.active details.full-fold:not([open]) > summary").first.click()
        page.wait_for_timeout(120)
    if tap:
        loc.tap()
    else:
        loc.click()


STARS_CHECK = r"""
async () => {
  const out = {};
  // quiet stars: a level not played yet shows none; a played one with 1 of 3 shows two outlines
  out.unplayedStars = [...document.querySelectorAll('#levels-free .level-cell')].filter((b) => !b.querySelector('.stars') !== !/, [1-3] (van|of) 3/.test(b.getAttribute('aria-label') || '')).length;
  const { levelCell } = await import('./js/menu.js');
  const probe = levelCell({ num: 99, stars: 1 });
  document.querySelector('#levels-free').appendChild(probe);
  const empty = probe.querySelector('.stars svg.star:not(.on)');
  const earned = probe.querySelector('.stars svg.star.on');
  if (empty && earned) {
    out.levelEmpty = { fill: getComputedStyle(empty).fill, stroke: getComputedStyle(empty).stroke, onFill: getComputedStyle(earned).fill };
  }
  probe.remove();
  const art = document.createElement('div');
  art.className = 'ov-art';
  art.innerHTML = '<svg class="star"></svg><svg class="star on"></svg>';
  document.body.appendChild(art);
  const [e, on] = art.querySelectorAll('svg');
  out.cardEmpty = { fill: getComputedStyle(e).fill, stroke: getComputedStyle(e).stroke };
  out.cardOn = { fill: getComputedStyle(on).fill, stroke: getComputedStyle(on).stroke };
  art.remove();
  out.font = getComputedStyle(document.querySelector('#brand-name')).fontFamily.split(',')[0].replace(/"/g, '').trim();
  out.fontLoaded = document.fonts.check('900 20px "Bazibo Sans"');
  out.score = !!document.querySelector('#hud-score');
  return out;
}
"""


def design_checks(page, name, problems):
    """Bazibo 2.0 phase 1: the vendored font, empty stars as outlines, no points on the board."""
    got = page.evaluate(STARS_CHECK)
    if got["font"] != "Bazibo Sans" or not got["fontLoaded"]:
        problems.append(f"{name}: the vendored font is not used or not loaded: {got['font']!r}, loaded {got['fontLoaded']}")
    le = got.get("levelEmpty")
    if not le or le["fill"] != "none" or le["stroke"] == "none" or le["onFill"] in ("none", le["fill"]):
        problems.append(f"{name}: an empty level star is not an outline (or an earned one not filled): {le}")
    if got.get("unplayedStars"):
        problems.append(f"{name}: {got['unplayedStars']} level cells show stars before they were played, or none after")
    if got["cardEmpty"]["fill"] != "none" or got["cardEmpty"]["stroke"] == "none":
        problems.append(f"{name}: an empty star on the win card is not an outline: {got['cardEmpty']}")
    if got["cardOn"]["fill"] in ("none", got["cardEmpty"]["fill"]):
        problems.append(f"{name}: an earned star on the win card is not filled: {got['cardOn']}")
    if got["score"]:
        problems.append(f"{name}: Bubbels still shows points on the board")


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
    design_checks(page, name, problems)

    choose(page, "#levels-free .level-cell >> nth=0")
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
    if not unfold(page):
        problems.append(f"{name}: no Volledige versie fold on the Bubbels level list")
    choose(page, ".full-fold .level-cell >> nth=0")
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
    if re.search(r"\d+ (punten|points)", page.inner_text("#ov-text")):
        problems.append(f"{name}: the Bubbels win card still shows points: {page.inner_text('#ov-text')!r}")
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
    if page.locator("#dogu-levels > .dogu-grid .level-cell.locked").count():
        problems.append(f"{name}: Dogudoku shows locked puzzles between the free ones")
    unfold(page)
    choose(page, "#dogu-levels .level-cell.locked:not(.random-btn) >> nth=0")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: locked Dogudoku puzzle offers {labels}")
    page.click(f"#ov-buttons button >> text={say['ok']}")
    choose(page, "#dogu-levels .level-cell[data-puzzle='1']")
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
    label = page.locator("#dogu-levels .level-cell[data-puzzle='1']").get_attribute("aria-label") or ""
    if say["stars3"] not in label:
        problems.append(f"{name}: Dogudoku puzzle 1 not saved with 3 stars ({label!r})")
    saved = page.evaluate("window.__bubbels.save().games.dogudoku")
    if not saved or saved.get("stars", {}).get("1") != 3:
        problems.append(f"{name}: Dogudoku save section wrong: {saved}")
    # the first 5×5 (colours too), solved by tapping each square twice: cross, then puppy
    choose(page, "#dogu-levels .level-cell[data-puzzle='13']")
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
    unfold(page)
    choose(page, "#pdoku-levels .level-cell.locked:not(.random-btn) >> nth=0")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: locked Picturedoku puzzle offers {labels}")
    page.click(f"#ov-buttons button >> text={say['ok']}")
    choose(page, "#pdoku-levels .level-cell[data-puzzle='1']")
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
    label = page.locator("#pdoku-levels .level-cell[data-puzzle='1']").get_attribute("aria-label") or ""
    if say["stars3"] not in label:
        problems.append(f"{name}: Picturedoku puzzle 1 not saved with 3 stars ({label!r})")
    saved = page.evaluate("window.__bubbels.save().games.picturedoku")
    if not saved or saved.get("stars", {}).get("1") != 3:
        problems.append(f"{name}: Picturedoku save section wrong: {saved}")
    # Mark's sequence on a free 6×6 and 9×9: place a picture (square first, and picture first),
    # then tap a different picture: the placed square must stay as it is
    for pid in (21, 43):
        choose(page, f"#pdoku-levels .level-cell[data-puzzle='{pid}']")
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
    choose(page, ".seg-card[data-level='3']")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: locked hard computer offers {labels}")
    page.click(f"#ov-buttons button >> text={say['ok']}")
    page.screenshot(path=str(SHOTS / f"{name}-v1-menu.png"), full_page=True)

    # two players, kleuterbord: puppy (player 1) gets three in a row along the bottom
    choose(page, ".option-card.board-small")
    choose(page, ".option-card.mode-duo")
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
    choose(page, ".option-card.board-big")
    choose(page, ".seg-card[data-level='1']")
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
    choose(page, ".slang-grid .level-cell[data-level='5']")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: locked Slangetje level offers {labels}")
    page.click(f"#ov-buttons button >> text={say['ok']}")
    page.screenshot(path=str(SHOTS / f"{name}-s1-menu.png"), full_page=True)

    choose(page, ".slang-grid .level-cell[data-level='1']")
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
    choose(page, ".slang-grid .level-cell[data-level='13']")
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
    choose(page, ".slang-grid .level-cell[data-level='4']")
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
    choose(page, ".slang-grid .level-cell[data-level='2']")
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
    if not page.locator(f"#klok-menu .option-card[data-mode='{mode}']").count():
        page.evaluate("window.__bubbels.klok.menu(null)")
    page.click(f"#klok-menu .option-card[data-mode='{mode}']")
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
    modes = page.eval_on_selector_all("#klok-menu .option-card", "els => els.map(e => e.dataset.mode)")
    if modes != ["day", "set", "read", "dig"]:
        problems.append(f"{name}: Klok menu shows the kinds {modes}, expected the daily rhythm first and the digital clock last")
    klok_mode(page, "set")
    page.screenshot(path=str(SHOTS / f"{name}-k1-set-menu.png"))
    if page.locator("#klok-menu .random-btn").count() != 1:
        problems.append(f"{name}: Klok should show one random card per kind")
    # the website sells nothing: a quarter-hours round is locked and offers only OK
    choose(page, ".klok-grid .level-cell[data-round='set-t3-1']")
    page.wait_for_timeout(200)
    if page.locator("#ov-buttons button").all_inner_texts() != [say["ok"]] or page.evaluate("window.__bubbels.klok.state()"):
        problems.append(f"{name}: Klok locked round did not just offer OK")
    page.click("#ov-buttons button")

    # 1. set the clock, whole hours: drag the hour hand for all 10 questions
    choose(page, ".klok-grid .level-cell[data-round='set-t1-1']")
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
    choose(page, ".klok-grid .level-cell[data-round='read-t2-1']")
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
    choose(page, ".klok-grid .level-cell[data-round='day-t1-1']")
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
    choose(page, ".klok-grid .level-cell[data-round='set-t2-1']")
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
    if not page.locator("#klok-menu .option-card").count():
        problems.append(f"{name}: Klok menu back did not return to the kinds of round")
    page.click("#klok-menu-back")  # home
    page.wait_for_timeout(200)


def klok_hhmm(t, h24=False):
    """A time (minutes) as the digital clock writes it: "03:30" (12-hour) or "14:25"."""
    t %= 1440
    h = t // 60 if h24 else (t // 60) % 12 or 12
    return f"{h:02d}:{t % 60:02d}"


def klok_dig_state(page):
    return page.evaluate("window.__bubbels.klok.state()")


def klok_dig_agree(page, where, problems):
    """Analogue and digital show the same time: the clock's hands, the digital face and every option."""
    st = klok_dig_state(page)
    kind, target = st["kind"], st["target"]
    h24 = kind in ("say24", "write24", "clock24", "later")
    face = page.get_attribute("#klok-face", "aria-label") or ""
    if kind in ("d2a", "say", "say24") and not face.endswith(klok_hhmm(target, h24)):
        problems.append(f"{where}: the digital clock says {face!r}, the answer is {klok_hhmm(target, h24)}")
    if kind in ("a2d", "setA", "clock24"):
        hm = page.evaluate("[document.querySelector('#kc-hour').getAttribute('transform'), document.querySelector('#kc-minute').getAttribute('transform')]")
        want = [f"rotate({(target % 720) / 2:.2f} 100 100)", f"rotate({(target % 60) * 6:.2f} 100 100)"]
        if hm != want:
            problems.append(f"{where}: the hands {hm} do not show {klok_hhmm(target)} ({want})")
    k = st["correctOption"]
    if kind in ("a2d", "write24", "clock24", "later") and page.get_attribute(f"#klok-controls .klok-option[data-option='{k}']", "data-time") != klok_hhmm(target, h24):
        problems.append(f"{where}: the right option is not {klok_hhmm(target, h24)}")


def klok_dig_set(page, where, problems, check_mirror=False):
    """Set the digital clock by real taps on its + and − to the target, then tap Klaar."""
    st = klok_dig_state(page)
    target = st["target"] % 720
    for _ in range(40):
        cur = klok_dig_state(page)["cur"] % 720
        if cur == target:
            break
        dh = (target // 60 - cur // 60) % 12
        dm = (target % 60 - cur % 60) % 60
        if dh:
            page.click("#klok-controls [data-step='hour+']" if dh <= 6 else "#klok-controls [data-step='hour-']")
        else:
            page.click("#klok-controls [data-step='minute+']" if dm <= 30 else "#klok-controls [data-step='minute-']")
    shown = page.get_attribute("#klok-setter-display", "data-time")
    if shown != klok_hhmm(target):
        problems.append(f"{where}: the digital clock shows {shown}, wanted {klok_hhmm(target)}")
    if check_mirror:
        rot = page.get_attribute("#kc-minute", "transform")
        if rot != f"rotate({(target % 60) * 6:.2f} 100 100)":
            problems.append(f"{where}: the clock does not follow the digital clock ({rot})")
    page.click("#klok-check")


def klok_digital(browser, base, problems):
    """Klok kijken, Digitaal: the kind in the menu, a locked tier on the web offers only OK; tier 1
    round 1 played to the end by real taps with one wrong answer (its card shows both clocks), 2
    stars saved; then in the full version a tier 2 round (setting the digital clock with its + and −,
    to a clock and to words, the clock following; the hint) and a tier 3 round on the 24-hour clock,
    each with 3 stars; analogue and digital agree on every question."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.click("#tile-klok")
    page.wait_for_timeout(200)
    klok_mode(page, "dig")
    page.screenshot(path=str(SHOTS / "klok-dig-menu.png"))
    choose(page, ".klok-grid .level-cell[data-round='dig-t2-1']")
    page.wait_for_timeout(200)
    if page.locator("#ov-buttons button").all_inner_texts() != ["Oké"] or page.evaluate("window.__bubbels.klok.state()"):
        problems.append("klok dig: a locked digital round did not just offer OK")
    page.click("#ov-buttons button")
    choose(page, ".klok-grid .level-cell[data-round='dig-t1-1']")
    page.wait_for_timeout(300)
    if not page.is_visible("#overlay") or "digitale klok" not in page.inner_text("#ov-text"):
        problems.append("klok dig: the how-to card is missing")
    page.click("#ov-buttons button")
    page.wait_for_timeout(150)
    kinds = set()
    for i in range(10):
        st = klok_dig_state(page)
        kinds.add(st["kind"])
        klok_dig_agree(page, f"klok dig t1 q{i}", problems)
        if i == 0:
            page.screenshot(path=str(SHOTS / f"klok-dig-t1-{st['kind']}.png"))
            klok_answer(page, right=False)
            page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
            text = page.inner_text("#ov-text")
            if page.inner_text("#ov-title").strip() != "Bijna!" or klok_hhmm(st["target"]) not in text or not page.locator("#ov-art .klok-svg").count() or not page.locator("#ov-art .klok-dig").count():
                problems.append(f"klok dig: the mistake card {page.inner_text('#ov-title')!r} / {text!r}")
            page.screenshot(path=str(SHOTS / "klok-dig-t1-almost.png"))
            page.click("#ov-buttons button")
        else:
            klok_answer(page)
        klok_next(page, i)
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    if kinds != {"d2a", "a2d"}:
        problems.append(f"klok dig t1: the kinds were {kinds}")
    got = page.evaluate("window.__bubbels.klok.stars()").get("dig-t1-1")
    if got != 2:
        problems.append(f"klok dig t1: one mistake should give 2 stars, saved {got}")
    page.screenshot(path=str(SHOTS / "klok-dig-t1-won.png"))
    page.click("#ov-buttons button >> nth=-1")  # Rondes
    page.wait_for_timeout(200)
    if not page.is_visible("#screen-klok-menu") or page.inner_text("#klok-menu-title").strip() != "Digitaal":
        problems.append("klok dig: Rondes did not land on the digital rounds")
    if errors:
        problems.append(f"klok dig: page errors {errors[:3]}")
    ctx.close()

    # the full version: tier 2 (set the digital clock) and tier 3 (the 24-hour clock)
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(OWNED_APP)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.wait_for_function("window.__bubbels.full()", timeout=8000)
    page.click("#tile-klok")
    page.wait_for_timeout(200)
    klok_mode(page, "dig")
    for rid in ("dig-t2-1", "dig-t3-1"):
        choose(page, f".klok-grid .level-cell[data-round='{rid}']")
        page.wait_for_timeout(300)
        if page.is_visible("#overlay"):
            page.click("#ov-buttons button")
            page.wait_for_timeout(150)
        seen = set()
        for i in range(10):
            st = klok_dig_state(page)
            where = f"klok dig {rid} q{i} {st['kind']}"
            klok_dig_agree(page, where, problems)
            if st["kind"] not in seen:
                seen.add(st["kind"])
                page.screenshot(path=str(SHOTS / f"klok-dig-{rid}-{st['kind']}.png"))
            if st["kind"] in ("setA", "setP"):
                if "hint" not in seen:
                    seen.add("hint")
                    page.click("#klok-hint")
                    if not page.locator("#klok-controls .klok-btn.hint").count() or not page.inner_text("#klok-status").strip():
                        problems.append(f"{where}: the hint lights up nothing")
                klok_dig_set(page, where, problems, check_mirror=st["kind"] == "setP")
            else:
                if st["kind"] == "later":
                    times = page.eval_on_selector_all("#klok-controls .klok-option", "els => els.map(e => e.dataset.time)")
                    if klok_hhmm(st["target"], True) != max(times):
                        problems.append(f"{where}: the later of {times} is not the answer")
                klok_answer(page)
            klok_next(page, i)
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
        want = {"dig-t2-1": {"setA", "setP", "say", "hint"}, "dig-t3-1": {"say24", "write24", "clock24", "later"}}[rid]
        if seen != want:
            problems.append(f"klok dig {rid}: the kinds were {seen}")
        got = page.evaluate("window.__bubbels.klok.stars()").get(rid)
        if got != 3:
            problems.append(f"klok dig {rid}: stars {got}, expected 3")
        page.click("#ov-buttons button >> nth=-1")
        page.wait_for_timeout(200)
    if errors:
        problems.append(f"klok dig (full): page errors {errors[:3]}")
    ctx.close()


KLOK_DIG_FIT_JS = """() => {
  const bad = [];
  for (const b of document.querySelectorAll('#klok-controls button, #klok-hint, #klok-back')) {
    const r = b.getBoundingClientRect();
    const name = (b.dataset.option || b.dataset.step || b.id || b.textContent).slice(0, 20);
    if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) bad.push(`${name} off screen`);
    if (r.width < 48 || r.height < 48) bad.push(`${name} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (b.scrollWidth > b.clientWidth + 1) bad.push(`${name} overflows`);
  }
  return bad;
}"""


def klok_digital_layouts(browser, base, problems):
    """Digitaal at 320x568, 390x844 in English, 568x320, 844x390 and desktop: every kind of question
    with the prompt, the clock, the answers and the dots on screen, the clock 110 px or more, every
    button 48 px or more, no sideways scroll."""
    for w, h, lang in ((320, 568, "nl"), (390, 844, "en"), (568, 320, "nl"), (844, 390, "en"), (1280, 800, "nl")):
        mobile = w < 1000
        ctx = browser.new_context(bypass_csp=True, locale="en-GB" if lang == "en" else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
        ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        page.click("#tile-klok")
        page.wait_for_timeout(150)
        page.evaluate("window.__bubbels.klok.menu('dig')")
        page.wait_for_timeout(100)
        page.screenshot(path=str(SHOTS / f"klok-dig-{w}x{h}-{lang}-menu.png"))
        for rid in ("dig-t1-2", "dig-t2-2", "dig-t3-2"):
            page.evaluate(f"window.__bubbels.klok.start('{rid}')")
            page.wait_for_timeout(250)
            if page.is_visible("#overlay"):
                page.click("#ov-buttons button")
                page.wait_for_timeout(150)
            seen = set()
            for i in range(10):
                st = klok_dig_state(page)
                kind = st["kind"]
                if kind not in seen:
                    seen.add(kind)
                    where = f"klok dig {w}x{h} {lang} {kind}"
                    for sel in ("#klok-prompt", "#klok-face", "#klok-controls", "#klok-dots"):
                        r = page.locator(sel).bounding_box()
                        if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                            problems.append(f"{where}: {sel} off screen ({r})")
                    face = page.locator("#klok-face svg").first.bounding_box()
                    if not face or face["width"] < 110 or (kind not in ("d2a", "say", "say24", "write24", "later") and face["height"] < 110):
                        problems.append(f"{where}: the clock is too small ({face})")
                    if page.evaluate("document.documentElement.scrollWidth") > w:
                        problems.append(f"{where}: sideways scroll")
                    bad = page.evaluate(KLOK_DIG_FIT_JS)
                    if bad:
                        problems.append(f"{where}: buttons {bad}")
                    page.screenshot(path=str(SHOTS / f"klok-dig-{w}x{h}-{lang}-{kind}.png"))
                if kind in ("setA", "setP"):
                    page.evaluate(f"window.__bubbels.klok.setTime({st['target']})")
                    page.evaluate("window.__bubbels.klok.check()")
                else:
                    page.evaluate(f"window.__bubbels.klok.answer({st['correctOption']})")
                klok_next(page, i)
            page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
            page.click("#ov-buttons button >> nth=-1")
            page.wait_for_timeout(150)
        # a mistake card on the 24-hour clock and on "which is later"
        page.evaluate("window.__bubbels.klok.start('dig-t3-1')")
        page.wait_for_timeout(250)
        for i in range(10):
            st = klok_dig_state(page)
            if st["kind"] == "later":
                break
            page.evaluate(f"window.__bubbels.klok.answer({st['correctOption']})")
            klok_next(page, i)
        st = klok_dig_state(page)
        page.evaluate(f"window.__bubbels.klok.answer({(st['correctOption'] + 1) % 2})")
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
        r = page.locator("#ov-card, #overlay .card").first.bounding_box() if page.locator("#ov-card, #overlay .card").count() else None
        art = page.locator("#ov-art").bounding_box()
        if not art or art["y"] < -0.5 or art["y"] + art["height"] > h + 0.5:
            problems.append(f"klok dig {w}x{h}: the mistake card's picture is off screen ({art}, card {r})")
        page.screenshot(path=str(SHOTS / f"klok-dig-{w}x{h}-{lang}-almost-later.png"))
        if errors:
            problems.append(f"klok dig {w}x{h}: page errors {errors[:3]}")
        ctx.close()


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
    choose(page, "#dogu-levels .random-btn >> nth=0")
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
    choose(page, "#dogu-levels .random-btn >> nth=0")
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
    choose(page, "#dogu-levels .random-btn >> nth=4")
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
    choose(page, "#pdoku-levels .random-btn >> nth=0")
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
    choose(page, "#pdoku-levels .random-btn >> nth=2")  # 9×9
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
    choose(page, "#levels-random .random-btn >> nth=2")
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
    choose(page, ".slang-grid .random-btn >> nth=0")
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
    if (!c.getClientRects().length) return false; // not drawn (the padlock inside the fold)
    const q = c.getBoundingClientRect();
    return q.left < r.left - 0.5 || q.right > r.right + 0.5 || q.top < r.top - 0.5 || q.bottom > r.bottom + 0.5;
  }).map((c) => c.className.baseVal ?? c.className);
  return { drawn: b.getClientRects().length > 0 && r.width > 0, over: b.scrollWidth > b.clientWidth + 1, bad, right: r.right, vw: innerWidth };
})"""


def play_kleuren(page, name, say, problems):
    """Kleurplaten: a locked page offers only OK on the web; colour the free sun by tapping (a real
    tap on the face, the rays by event), undo once, finish it, find it under "my pictures", and
    check it is still there after a reload."""
    page.click("#tile-kleuren")
    page.wait_for_timeout(250)
    if page.inner_text("#tile-kleuren .tile-name").strip() != say["kleurTile"]:
        problems.append(f"{name}: colouring tile says {page.inner_text('#tile-kleuren .tile-name')!r}")
    unfold(page)
    choose(page, "#kleur-list .kleur-card.locked >> nth=0")
    page.wait_for_timeout(200)
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != [say["ok"]]:
        problems.append(f"{name}: locked colouring page offers {labels}")
    page.click(f"#ov-buttons button >> text={say['ok']}")
    choose(page, "#kleur-list .kleur-card[data-page='p:zon']")
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
    heads = page.locator("#kleur-list h3 .menu-head-name").all_inner_texts()
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
        if small:  # upright too: 6 colours a row where 8 of 44 px do not fit
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


def touch_context(browser, base, w, h, lang="nl", save=None, owned=False):
    ctx = browser.new_context(bypass_csp=True, locale={"nl": "nl-NL", "en": "en-GB"}[lang], viewport={"width": w, "height": h},
                              device_scale_factor=2, is_mobile=True, has_touch=True)
    if owned:
        ctx.add_init_script(OWNED_APP)
    if save:
        ctx.add_init_script(seeded(save))
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    return ctx, page, errors


def tekenen_play(browser, base, problems):
    """The main Tekenen walk (play_tekenen) on its own, for `tests/smoke.py tekenen`."""
    ctx, page, errors = touch_context(browser, base, 390, 844)
    play_tekenen(page, "phone", TEXT["nl"], problems)
    if errors:
        problems.append(f"tekenen: page errors {errors[:2]}")
    ctx.close()


def kleuren_play(browser, base, problems):
    """The main Kleurplaten walk (play_kleuren) on its own, for `tests/smoke.py kleuren`."""
    ctx, page, errors = touch_context(browser, base, 390, 844)
    play_kleuren(page, "phone", TEXT["nl"], problems)
    if errors:
        problems.append(f"kleuren: page errors {errors[:2]}")
    ctx.close()


def trash_checks(page, label, w, h, problems, sel):
    """Every bin in the list: 48 px or more, on screen, no sideways scroll, never over its card's
    middle third (that stays for opening the picture) and never over another card or bin."""
    got = page.evaluate(f"""() => {{
      const box = (el) => {{ const r = el.getBoundingClientRect(); return {{ x: r.x, y: r.y, w: r.width, h: r.height }}; }};
      const bins = [...document.querySelectorAll({json.dumps(sel)})];
      return bins.map((b) => {{
        const card = b.parentElement.firstElementChild;
        const grid = b.closest('.level-grid');
        const others = [...grid.querySelectorAll('.kleur-card, .trash-btn')].filter((el) => el !== card && el !== b && el.offsetParent);
        return {{ bin: box(b), card: box(card), others: others.map(box) }};
      }});
    }}""")
    if not got:
        problems.append(f"{label}: no trash buttons")
    hit = lambda a, b: a["x"] < b["x"] + b["w"] - 0.5 and b["x"] < a["x"] + a["w"] - 0.5 and a["y"] < b["y"] + b["h"] - 0.5 and b["y"] < a["y"] + a["h"] - 0.5
    for g in got:
        r, c = g["bin"], g["card"]
        if r["w"] < 47.5 or r["h"] < 47.5:
            problems.append(f"{label}: a trash button is {r['w']:.0f}x{r['h']:.0f} px")
        if r["x"] < -0.5 or r["x"] + r["w"] > w + 0.5:
            problems.append(f"{label}: a trash button sticks out sideways: {r}")
        middle = {"x": c["x"] + c["w"] / 3, "y": c["y"] + c["h"] / 3, "w": c["w"] / 3, "h": c["h"] / 3}
        if hit(r, middle):
            problems.append(f"{label}: a bin {r} reaches the middle third of its {c['w']:.0f} px card {c}")
        for o in g["others"]:
            if hit(r, o):
                problems.append(f"{label}: a bin {r} lies over another card or bin {o}")
    if page.evaluate("document.documentElement.scrollWidth") > w + 1:
        problems.append(f"{label}: the list scrolls sideways")


def tap_card_middle(page, label, card_sel, opened, back_sel, listed, problems):
    """A real tap on a card's centre and on the corner of its middle third nearest the bin opens the
    picture, never the throw-away card."""
    for fx, fy in ((0.5, 0.5), (0.66, 0.66)):
        c = page.locator(card_sel).bounding_box()
        page.touchscreen.tap(c["x"] + c["width"] * fx, c["y"] + c["height"] * fy)
        page.wait_for_timeout(350)
        if page.locator("#overlay:not([hidden])").count() or not page.locator(f"{opened}.active").count():
            problems.append(f"{label}: a tap at {fx}, {fy} of the card did not open it (card: {page.locator('#overlay:not([hidden])').count()})")
            if page.locator("#overlay:not([hidden])").count():
                page.locator("#ov-buttons .throw-no").tap()
                page.wait_for_selector("#overlay", state="hidden")
            continue
        page.locator(back_sel).tap()
        page.wait_for_selector(f"{listed}.active")
        page.wait_for_timeout(250)


def throw_card_checks(page, label, say_title, say_yes, say_no, problems, art_sel):
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
    page.wait_for_timeout(450)  # the card pops in (scaled); measure it once it stands
    title = page.inner_text("#ov-title").strip()
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if title != say_title or labels != [say_no, say_yes]:
        problems.append(f"{label}: the throw-away card says {title!r} {labels}")
    if page.locator(f"#ov-art {art_sel}").count() != 1:
        problems.append(f"{label}: the throw-away card shows no picture")
    if not page.evaluate("document.activeElement?.classList.contains('throw-no')"):
        problems.append(f"{label}: the focus is not on {say_no}: {page.evaluate('document.activeElement?.className')}")
    for b in page.locator("#ov-buttons button").all():
        r = b.bounding_box()
        if r is None or r["height"] < 48 or r["width"] < 120:
            problems.append(f"{label}: a Ja/Nee button is small: {r}")
    # a second tap where any bin is never lands on Ja
    yes = page.locator("#ov-buttons .throw-yes").bounding_box()
    for r in page.evaluate("[...document.querySelectorAll('.screen.active .trash-btn')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })"):
        if r["x"] < yes["x"] + yes["width"] and yes["x"] < r["x"] + r["w"] and r["y"] < yes["y"] + yes["height"] and yes["y"] < r["y"] + r["h"]:
            problems.append(f"{label}: {say_yes} {yes} lies under a bin {r}")


def teken_draw_new(page, pts):
    """A new drawing by real taps and a drag, then back to "my drawings"."""
    page.locator("#teken-list .teken-new").tap()
    page.wait_for_selector("#screen-tekenen.active")
    page.wait_for_timeout(250)
    teken_drag(page, pts)
    page.locator("#teken-back").tap()
    page.wait_for_selector("#screen-tekenen-list.active")
    page.wait_for_timeout(200)


def teken_ids(page):
    """The kept drawings' ids, oldest first."""
    return page.evaluate("Object.entries(window.__bubbels.teken.drawings()).sort((a, b) => a[1].t - b[1].t).map(([k]) => k)")


def teken_bin(page, key):
    return page.locator(f"#teken-list .keep-item:has(.teken-card[data-id='{key}']) .trash-btn")


def tekenen_delete(browser, base, problems):
    """Throwing a drawing away (Mark, 24 Nov 2026): two drawings made by real input, the bin on
    one asks "Weggooien?" with its picture; a double tap never deletes, Nee keeps it, Ja throws it
    away; after a reload it is gone and the other stays. At the free limit (3) a bin frees a place:
    the "+" opens again and a new drawing is kept. Then the list and card at 844x390 and in English."""
    label = "tekenen delete 390x844"
    ctx, page, errors = touch_context(browser, base, 390, 844)
    page.locator("#tile-tekenen").tap()
    page.wait_for_selector("#screen-tekenen-list.active")
    teken_draw_new(page, [(0.2, 0.3), (0.8, 0.3)])
    teken_draw_new(page, [(0.5, 0.2), (0.5, 0.8)])
    ids = teken_ids(page)
    if len(ids) != 2 or page.locator("#teken-list .teken-card").count() != 2 or page.locator("#teken-list .trash-btn").count() != 2:
        problems.append(f"{label}: expected 2 drawings with a bin each: {ids}, {page.locator('#teken-list .trash-btn').count()} bins")
        ctx.close()
        return
    old, new = ids
    trash_checks(page, label, 390, 844, problems, "#teken-list .trash-btn")
    page.wait_for_timeout(200)  # the thumbnails are drawn one at a time
    page.screenshot(path=str(SHOTS / "teken-delete-list-390x844.png"))
    # a double tap on the bin (the second tap lands on "Ja" at once) throws nothing away
    page.evaluate(f"""() => {{ document.querySelector("#teken-list .keep-item:has(.teken-card[data-id='{old}']) .trash-btn").click();
      document.querySelector('#ov-buttons .throw-yes').click(); }}""")
    if len(teken_ids(page)) != 2 or page.locator("#overlay[hidden]").count():
        problems.append(f"{label}: a double tap on the bin threw a drawing away or closed the card")
    page.locator("#ov-buttons .throw-no").tap()
    page.wait_for_selector("#overlay", state="hidden")
    # Nee keeps it
    teken_bin(page, old).tap()
    throw_card_checks(page, label, "Weggooien?", "Ja", "Nee", problems, "img.ov-teken")
    page.wait_for_timeout(450)
    page.screenshot(path=str(SHOTS / "teken-delete-confirm-390x844.png"))
    page.locator("#ov-buttons button", has_text="Nee").tap()
    page.wait_for_selector("#overlay", state="hidden")
    if teken_ids(page) != [old, new] or page.locator("#teken-list .teken-card").count() != 2:
        problems.append(f"{label}: Nee did not keep the drawing: {teken_ids(page)}")
    # Ja throws it away
    teken_bin(page, old).tap()
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
    page.wait_for_timeout(450)
    page.locator("#ov-buttons button", has_text="Ja").tap()
    page.wait_for_selector("#overlay", state="hidden")
    page.wait_for_timeout(900)  # longer than the autosave's pause
    cards = page.evaluate("[...document.querySelectorAll('#teken-list .teken-card')].map((b) => b.dataset.id)")
    if teken_ids(page) != [new] or cards != [new]:
        problems.append(f"{label}: Ja did not throw the drawing away: kept {teken_ids(page)}, list {cards}")
    if not page.evaluate(f"window.__bubbels.teken.raw()['{old}']?.gone === true"):
        problems.append(f"{label}: no 'deleted' marker for the thrown-away drawing")
    page.reload()
    page.wait_for_selector("html[data-ready='1']")
    if teken_ids(page) != [new]:
        problems.append(f"{label}: after a reload the drawings are {teken_ids(page)}")
    page.locator("#tile-tekenen").tap()
    page.wait_for_selector("#screen-tekenen-list.active")
    cards = page.evaluate("[...document.querySelectorAll('#teken-list .teken-card')].map((b) => b.dataset.id)")
    if cards != [new]:
        problems.append(f"{label}: after a reload the list shows {cards}")
    # the free limit: 3 drawings lock "+", a bin frees a place, a new one is kept
    teken_draw_new(page, [(0.2, 0.6), (0.8, 0.6)])
    teken_draw_new(page, [(0.2, 0.8), (0.8, 0.2)])
    ids = teken_ids(page)
    if len(ids) != 3 or page.locator("#teken-list .teken-new .kleur-badge.lock").count() != 1:
        problems.append(f"{label}: 3 drawings should fill the free album: {ids}")
    gone = ids[1]
    teken_bin(page, gone).tap()
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
    page.wait_for_timeout(450)
    page.locator("#ov-buttons .throw-yes").tap()
    page.wait_for_selector("#overlay", state="hidden")
    if len(teken_ids(page)) != 2 or page.locator("#teken-list .teken-new.full, #teken-list .teken-new .kleur-badge.lock").count():
        problems.append(f"{label}: after throwing one away the '+' is still locked ({teken_ids(page)})")
    teken_draw_new(page, [(0.3, 0.3), (0.7, 0.7)])
    if page.locator("#overlay:not([hidden])").count():
        problems.append(f"{label}: the new drawing after a delete asked {page.inner_text('#ov-title')!r}")
    ids = teken_ids(page)
    if len(ids) != 3 or gone in ids or page.evaluate("window.__bubbels.teken.state().lastSave") != "saved":
        problems.append(f"{label}: the 4th drawing after a delete was not kept: {ids}")
    page.reload()
    page.wait_for_selector("html[data-ready='1']")
    after = teken_ids(page)
    if after != ids:
        problems.append(f"{label}: after a reload {after}, expected {ids}")
    if errors:
        problems.append(f"{label}: page errors {errors[:2]}")
    ctx.close()

    # sideways, and the card in English
    two = {"version": 1, "games": {"tekenen": {"drawings": {f"k{i}": {"s": "s" + "ABCD"[i] + "BA" + "IAIA" + "QAQA", "t": 1000 + i} for i in range(2)}}},
           "settings": {"muted": True}, "purchase": {"owned": False}}
    for w, h, lang in ((320, 568, "nl"), (844, 390, "nl"), (390, 844, "en")):
        label = f"tekenen delete {w}x{h} {lang}"
        ctx, page, errors = touch_context(browser, base, w, h, lang=lang, save=two)
        page.locator("#tile-tekenen").tap()
        page.wait_for_selector("#screen-tekenen-list.active")
        page.wait_for_timeout(300)
        trash_checks(page, label, w, h, problems, "#teken-list .trash-btn")
        name = page.get_attribute("#teken-list .keep-item:has([data-id='k1']) .trash-btn", "aria-label")
        want = {"nl": "Tekening 2 weggooien", "en": "Throw away drawing 2"}[lang]
        if name != want:
            problems.append(f"{label}: the bin is called {name!r}")
        if lang == "nl":
            page.screenshot(path=str(SHOTS / f"teken-delete-list-{w}x{h}.png"))
        tap_card_middle(page, label, "#teken-list .teken-card[data-id='k1']", "#screen-tekenen", "#teken-back", "#screen-tekenen-list", problems)
        if teken_ids(page) != ["k0", "k1"]:
            problems.append(f"{label}: opening by the card's middle changed the album: {teken_ids(page)}")
        teken_bin(page, "k1").tap()
        say = {"nl": ("Weggooien?", "Ja", "Nee"), "en": ("Throw it away?", "Yes", "No")}[lang]
        throw_card_checks(page, label, *say, problems, "img.ov-teken")
        for b in page.locator("#ov-buttons button").all():
            r = b.bounding_box()
            if r["y"] < 0 or r["y"] + r["height"] > h + 0.5:
                problems.append(f"{label}: a Ja/Nee button is off screen: {r}")
        page.wait_for_timeout(450)
        if lang == "nl":
            page.screenshot(path=str(SHOTS / f"teken-delete-confirm-{w}x{h}.png"))
        page.locator("#ov-buttons .throw-yes").tap()
        page.wait_for_selector("#overlay", state="hidden")
        if teken_ids(page) != ["k0"]:
            problems.append(f"{label}: Ja kept {teken_ids(page)}")
        if errors:
            problems.append(f"{label}: page errors {errors[:2]}")
        ctx.close()


def kleuren_delete(browser, base, problems):
    """Throwing a page away in "my pictures": the bin asks "Weggooien?" with the page, Nee keeps it,
    Ja throws its colours away (the sun stays in Pictures, blank); after a reload it is gone and
    the house stays. A locked page in "my pictures" (a new mandala on the web) has no bin. The
    last one thrown away takes the "my pictures" section with it."""
    label = "kleuren delete 390x844"
    save = {"version": 1, "games": {"kleuren": {"art": {
        "p:zon": {"f": {"face": 2, "ray0": 1}, "t": 3000, "done": True},
        "p:huis": {"f": {"roof": 0, "wall": 6}, "t": 2000},
        "m:m1:5": {"f": {"c0": 3}, "t": 1000}}}}, "settings": {"muted": True}, "purchase": {"owned": False}}
    ctx, page, errors = touch_context(browser, base, 390, 844, save=save)
    page.locator("#tile-kleuren").tap()
    page.wait_for_selector("#screen-kleuren-list.active")
    page.wait_for_timeout(200)
    mine = lambda: page.evaluate("[...document.querySelectorAll('#kleur-list .kleur-mine .kleur-card:not(.locked)')].map((b) => b.dataset.page)")
    if mine() != ["p:zon", "p:huis"] or page.locator("#kleur-list .kleur-mine .trash-btn").count() != 2:
        problems.append(f"{label}: my pictures shows {mine()} with {page.locator('#kleur-list .kleur-mine .trash-btn').count()} bins")
    if page.locator("#kleur-list .trash-btn").count() != 2:
        problems.append(f"{label}: bins outside my pictures, or on the locked mandala")
    trash_checks(page, label, 390, 844, problems, "#kleur-list .trash-btn")
    page.screenshot(path=str(SHOTS / "kleur-delete-list-390x844.png"))
    bin_ = lambda key: page.locator(f"#kleur-list .kleur-mine .keep-item:has([data-page='{key}']) .trash-btn")
    bin_("p:zon").tap()
    throw_card_checks(page, label, "Weggooien?", "Ja", "Nee", problems, "svg.ov-kleur")
    page.wait_for_timeout(450)
    page.screenshot(path=str(SHOTS / "kleur-delete-confirm-390x844.png"))
    page.locator("#ov-buttons .throw-no").tap()
    page.wait_for_selector("#overlay", state="hidden")
    if mine() != ["p:zon", "p:huis"]:
        problems.append(f"{label}: Nee did not keep the sun: {mine()}")
    bin_("p:zon").tap()
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
    page.wait_for_timeout(450)
    page.locator("#ov-buttons .throw-yes").tap()
    page.wait_for_selector("#overlay", state="hidden")
    page.wait_for_timeout(600)
    art = page.evaluate("window.__bubbels.kleur.art()")
    if mine() != ["p:huis"] or "p:zon" in art or "p:huis" not in art:
        problems.append(f"{label}: Ja did not throw the sun away: {mine()}, {sorted(art)}")
    if page.locator("#kleur-list .kleur-card[data-page='p:zon']").count() != 1 or page.locator("#kleur-list .kleur-card[data-page='p:zon'] .kleur-badge.check").count():
        problems.append(f"{label}: the sun is not back in Pictures as a blank page")
    page.reload()
    page.wait_for_selector("html[data-ready='1']")
    art = page.evaluate("window.__bubbels.kleur.art()")
    if "p:zon" in art or "p:huis" not in art:
        problems.append(f"{label}: after a reload the pages are {sorted(art)}")
    page.locator("#tile-kleuren").tap()
    page.wait_for_selector("#screen-kleuren-list.active")
    page.wait_for_timeout(200)
    bin_("p:huis").tap()
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
    page.wait_for_timeout(450)
    page.locator("#ov-buttons .throw-yes").tap()
    page.wait_for_selector("#overlay", state="hidden")
    art = page.evaluate("window.__bubbels.kleur.art()")
    if page.locator("#kleur-list .kleur-mine .keep-item").count() or sorted(art) != ["m:m1:5"]:
        problems.append(f"{label}: after throwing the house away my pictures shows {mine()}, kept {sorted(art)}")
    if errors:
        problems.append(f"{label}: page errors {errors[:2]}")
    ctx.close()

    # a small phone and sideways: the bins clear of the middle and of Ja, the card's middle opens it
    for w, h in ((320, 568), (844, 390)):
        label = f"kleuren delete {w}x{h}"
        ctx, page, errors = touch_context(browser, base, w, h, save=save)
        page.locator("#tile-kleuren").tap()
        page.wait_for_selector("#screen-kleuren-list.active")
        page.wait_for_timeout(300)
        trash_checks(page, label, w, h, problems, "#kleur-list .trash-btn")
        page.screenshot(path=str(SHOTS / f"kleur-delete-list-{w}x{h}.png"))
        tap_card_middle(page, label, "#kleur-list .kleur-mine .kleur-card[data-page='p:huis']", "#screen-kleuren", "#kleur-back", "#screen-kleuren-list", problems)
        page.locator("#kleur-list .kleur-mine .keep-item:has([data-page='p:huis']) .trash-btn").tap()
        throw_card_checks(page, label, "Weggooien?", "Ja", "Nee", problems, "svg.ov-kleur")
        page.screenshot(path=str(SHOTS / f"kleur-delete-confirm-{w}x{h}.png"))
        page.locator("#ov-buttons .throw-no").tap()
        page.wait_for_selector("#overlay", state="hidden")
        if sorted(page.evaluate("window.__bubbels.kleur.art()")) != ["m:m1:5", "p:huis", "p:zon"]:
            problems.append(f"{label}: opening or Nee changed the pages")
        if errors:
            problems.append(f"{label}: page errors {errors[:2]}")
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
        small = page.evaluate("""() => [...document.querySelectorAll('#kleur-palette .swatch')].map((b) => b.getBoundingClientRect())
          .filter((r) => r.width < 43.5 || r.height < 43.5).map((r) => Math.round(r.width))""")
        if small:
            problems.append(f"{label}: colours smaller than 44 px: {small}")
        for sel in ("#kleur-page", "#kleur-palette", "#kleur-done", "#kleur-back"):
            r = page.locator(sel).bounding_box()
            if r is None or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                problems.append(f"{label}: {sel} off screen: {r}")
        if page.evaluate("document.documentElement.scrollWidth") > w + 1:
            problems.append(f"{label}: the page scrolls sideways")
        page.screenshot(path=str(SHOTS / f"kleur-mandala-{w}x{h}.png"))
        page.click("#kleur-back")
        choose(page, "#kleur-list .kleur-card[data-page='p:raket']")  # a full-version picture
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
                unfold(page)  # locked random cards wait in the Volledige versie fold
                cards = page.evaluate(CARD_FIT_JS)
                label = f"{w}px {'full' if owned else 'web'} {tile}"
                if not cards:
                    problems.append(f"random cards: none in {label}")
                for i, c in enumerate(cards):
                    if not c["drawn"] or c["over"] or c["bad"] or c["right"] > c["vw"] + 0.5:
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
    choose(page, ".slang-grid .level-cell[data-level='1']")
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
    choose(page, "#dogu-levels .level-cell[data-puzzle='13']")
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
    choose(page, "#pdoku-levels .level-cell[data-puzzle='43']")  # a free 9×9
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
    choose(page, ".option-card.board-big")
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
        choose(page, ".option-card.board-big")
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
    stars = page.locator("#levels-free .level-cell >> nth=0").get_attribute("aria-label")
    nxt = page.locator("#levels-free .level-cell.next .num").inner_text()
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


def letters_build_by_taps(page, round_id, problems, label):
    """Play a whole build round by tapping the tile of each next letter, as a child does; every word
    must fill all its slots and finish, with no page errors, and the round ends with 3 stars."""
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.evaluate(f"window.__bubbels.letters.start('{round_id}')")
    page.wait_for_timeout(250)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    long_words = 0
    for _ in range(8):
        st = page.evaluate("window.__bubbels.letters.state()")
        if st["done"]:
            break
        q = st["q"]
        long_words += len(q["word"]) >= 4
        for letter in q["word"]:
            tiles = page.locator("#letters-options .letters-tile:not(.used)")
            for k in range(tiles.count()):
                if tiles.nth(k).get_attribute("data-letter") == letter:
                    tiles.nth(k).click()
                    break
            page.wait_for_timeout(60)
        filled = page.evaluate("[...document.querySelectorAll('#letters-slots .letters-slot.filled')].map((s) => s.textContent).join('')")
        if filled.lower() != q["word"]:
            problems.append(f"letters {label} build by taps: {q['word']!r} shows {filled!r} after its last letter")
            break
        page.wait_for_timeout(1500)
    st = page.evaluate("window.__bubbels.letters.state()")
    if not st["done"]:
        problems.append(f"letters {label} build by taps: the round did not finish (question {st['i'] + 1})")
    elif page.evaluate("window.__bubbels.letters.stars()").get(round_id) != 3:
        problems.append(f"letters {label} build by taps: stars {page.evaluate('window.__bubbels.letters.stars()').get(round_id)}, want 3")
    if not long_words:
        problems.append(f"letters {label} build by taps: no word of four letters in {round_id}")
    if errors:
        problems.append(f"letters {label} build by taps: page errors {errors[:2]}")
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button:last-child")
        page.wait_for_timeout(150)


def letters_play(browser, base, problems):
    """Letters: one round of each kind played by taps (Dutch and English), with nothing spoken: the
    big letter matches its tile, the word shows a gap at the start or inside it, the build word shows
    for a moment; stars saved; a gentle wrong tap, a locked tier; then the layouts at 320x568 and
    sideways stay on screen."""
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
        for mode in ("tap", "first", "middle", "build"):
            page.evaluate(f"window.__bubbels.letters.start('{mode}-t1-1')")
            page.wait_for_timeout(250)
            if page.is_visible("#overlay"):
                page.click("#ov-buttons button")
                page.wait_for_timeout(200)
            sels = ("#letters-prompt", "#letters-pic", "#letters-options", "#letters-dots") + (("#letters-word",) if mode in ("first", "middle") else ("#letters-slots",) if mode == "build" else ())
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
                        problems.append(f"letters {lang} build t1: the word is not shown at the start ({ghosts}, {q['word']})")
                    for letter in q["word"]:
                        tiles = page.locator("#letters-options .letters-tile:not(.used)")
                        n = tiles.count()
                        for k in range(n):
                            if tiles.nth(k).get_attribute("data-letter") == letter:
                                tiles.nth(k).click()
                                break
                        page.wait_for_timeout(60)
                else:
                    right = q["letter"]
                    if mode == "tap":
                        big = page.text_content("#letters-pic .letters-big")
                        tile = page.text_content(f"#letters-options .letters-tile[data-letter='{right}']")
                        if big != tile:
                            problems.append(f"letters {lang} tap t1: the big letter {big!r} is not drawn like its tile {tile!r}")
                    else:
                        at = q.get("at", 0)
                        word = page.text_content("#letters-word")
                        if word != q["word"][:at] + q["word"][at + 1:] or page.text_content("#letters-word .letters-gap") != "":
                            problems.append(f"letters {lang} {mode}: the word with a gap reads {word!r} for {q['word']!r}")
                        if mode == "middle" and not (0 < at < len(q["word"]) - 1):
                            problems.append(f"letters {lang} middle: the gap of {q['word']!r} is at {at}")
                        if mode == "middle" and page.evaluate("document.querySelector('#letters-word').firstChild.nodeType") != 3:
                            problems.append(f"letters {lang} middle: the gap is not inside the word")
                    page.locator(f"#letters-options .letters-tile[data-letter='{right}']").click()
                    if mode in ("first", "middle"):
                        page.wait_for_timeout(100)
                        if page.text_content("#letters-word") != q["word"]:
                            problems.append(f"letters {lang} {mode}: the gap was not filled ({page.text_content('#letters-word')!r})")
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
    # tiers 2 and 3 (full version): tier 2 matches a capital with its small letter; tier 1 shows the
    # build word for a moment (a tap on the picture shows it again), tiers 2 and 3 the picture only
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
    page.evaluate("window.__bubbels.letters.start('build-t1-1')")
    page.wait_for_timeout(250)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    if not page.evaluate("window.__bubbels.letters.peeking()"):
        problems.append("letters t1 build: the word is not shown at the start")
    page.screenshot(path=str(SHOTS / "letters-390x844-nl-build-t1-peek.png"))
    page.wait_for_timeout(2400)
    if page.evaluate("window.__bubbels.letters.peeking()"):
        problems.append("letters t1 build: the word did not hide after a moment")
    if not page.is_visible("#letters-pic .letters-peek"):
        problems.append("letters t1 build: no eye on the picture once the word is hidden")
    page.screenshot(path=str(SHOTS / "letters-390x844-nl-build-t1-hidden.png"))
    peek_btn = page.locator("#letters-pic button.letters-peekbtn")
    if peek_btn.count() != 1 or not peek_btn.get_attribute("aria-label"):
        problems.append("letters t1 build: the picture is not a named button")
    peek_btn.click()
    page.wait_for_timeout(100)
    if not page.evaluate("window.__bubbels.letters.peeking()"):
        problems.append("letters t1 build: a tap on the picture did not show the word again")
    # two quick wrong taps while the word shows must not keep it on screen for good
    page.evaluate("window.__bubbels.letters.start('build-t1-2')")
    page.wait_for_timeout(200)
    st = page.evaluate("window.__bubbels.letters.state()")
    wrong = [k for k, l in enumerate(st["q"]["tiles"]) if l != st["q"]["word"][0]]
    for _ in range(2):
        page.locator(f"#letters-options .letters-tile[data-k='{wrong[0]}']").click()
        page.wait_for_timeout(120)
    page.wait_for_timeout(2400)
    if page.evaluate("window.__bubbels.letters.peeking()") or not page.is_visible("#letters-pic .letters-peek"):
        problems.append("letters t1 build: after two quick wrong taps the word stayed or the eye did not come")
    # a round of four-letter words built by real taps with the sound on: the 4th letter used to
    # throw in the plink (PENTA[0.1]) and was never drawn, so the word never finished
    letters_build_by_taps(page, "build-t2-3", problems, "t2")
    for tier in ("t2", "t3"):
        page.evaluate(f"window.__bubbels.letters.start('build-{tier}-1')")
        page.wait_for_timeout(250)
        if page.is_visible("#overlay"):
            page.click("#ov-buttons button")
            page.wait_for_timeout(150)
        if page.locator("#letters-slots .ghost").count() or page.locator("#letters-pic button.letters-peekbtn").count():
            problems.append(f"letters {tier} build: the word is shown or can be peeked, want the picture only")
        st = page.evaluate("window.__bubbels.letters.state()")
        if len(st["q"]["tiles"]) <= len(st["q"]["word"]):
            problems.append(f"letters {tier} build: no extra tiles ({st['q']['tiles']})")
        page.screenshot(path=str(SHOTS / f"letters-390x844-nl-build-{tier}.png"))
    # middle letter in tier 3: the gap inside a long word fits the screen
    page.evaluate("window.__bubbels.letters.start('middle-t3-1')")
    page.wait_for_timeout(250)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    r = page.locator("#letters-word").bounding_box()
    if not r or r["x"] < -0.5 or r["x"] + r["width"] > 390.5:
        problems.append(f"letters t3 middle: the word is off screen ({r})")
    page.screenshot(path=str(SHOTS / "letters-390x844-nl-middle-t3.png"))
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
        for mode in ("tap", "first", "middle", "build"):
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

DH_KEYS = {"up": "ArrowUp", "down": "ArrowDown", "left": "ArrowLeft", "right": "ArrowRight"}


def dh_state(page):
    return page.evaluate("window.__bubbels.doolhof.state()")


def dh_idle(page, timeout=6000):
    """Wait until the hedgehog stands still (not walking)."""
    page.wait_for_function("(() => { const s = window.__bubbels.doolhof.state(); return s && (s.done || !s.walking); })()", timeout=timeout)
    return dh_state(page)


def dh_play_to_end(page, label, problems, swipe_first=False):
    """Play the round on screen to its end by real input: the hook's guide says which way, the arrow
    pad, the arrow keys (and one swipe) walk the hedgehog, the crows keep walking."""
    for k in range(400):
        st = dh_idle(page)
        if st["done"]:
            break
        d = page.evaluate("window.__bubbels.doolhof.autopilot()")
        if not d:
            problems.append(f"{label}: no way to {st['expected']}")
            break
        if swipe_first and k == 0:
            b = page.locator("#doolhof-board").bounding_box()
            x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
            dx, dy = {"up": (0, -60), "down": (0, 60), "left": (-60, 0), "right": (60, 0)}[d]
            page.mouse.move(x, y)
            page.mouse.down()
            page.mouse.move(x + dx, y + dy, steps=5)
            page.mouse.up()
        elif k % 2:
            page.keyboard.press(DH_KEYS[d])
        else:
            page.click(f"#doolhof-pad [data-dir={d}]")
        page.wait_for_timeout(120)
    st = dh_state(page)
    if not st["done"]:
        problems.append(f"{label}: the round did not end ({st['i']}/{st['total']})")
    return st


def dh_fits(page, w, h, label, problems):
    """The panel, the garden and the arrows on screen, the arrows 48 px or more, no sideways scroll."""
    for sel in ("#doolhof-target", "#doolhof-canvas", "#doolhof-pad"):
        r = page.locator(sel).bounding_box()
        if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
            problems.append(f"{label}: {sel} off screen ({r})")
    for k in range(4):
        r = page.locator("#doolhof-pad .pad-btn").nth(k).bounding_box()
        if r["width"] < 48 or r["height"] < 48:
            problems.append(f"{label}: an arrow is only {r['width']:.0f}x{r['height']:.0f} px")
    if page.evaluate("document.documentElement.scrollWidth") > w:
        problems.append(f"{label}: sideways scroll")
    st = dh_state(page)
    if st["glyph"] < 14:
        problems.append(f"{label}: letters only {st['glyph']:.0f} px on a {st['cell']} px cell")
    canvas = page.locator("#doolhof-canvas").bounding_box()
    if min(canvas["width"], canvas["height"]) < 150:
        problems.append(f"{label}: the garden is only {canvas['width']:.0f}x{canvas['height']:.0f} px")


def doolhof_play(browser, base, problems):
    """Egeltje (Little Hedgehog): the tile in Leren, a locked tier offers only OK on the web; the
    alphabet a-e played to the end by real input (a swipe, the arrow pad and the arrow keys) with a
    wrong letter bumped (it stays, one mistake, 2 stars saved) and a crow walked into (it flutters
    off, the hedgehog stays, nothing lost, the next step walks on); the waiting garden draws no frames; back + keep playing; the Android
    back button; the end of the free part offers only OK and lands on the list; no voice; the layout
    at 390x844 (Dutch and English), 320x568, 844x390, 568x320 and desktop."""
    title = {"nl": "Egeltje", "en": "Little Hedgehog"}
    group = {"nl": "Leren", "en": "Learning"}
    for lang, w, h, full in (("nl", 390, 844, True), ("en", 390, 844, False), ("nl", 320, 568, False), ("en", 844, 390, False), ("nl", 568, 320, False), ("en", 1280, 800, False)):
        label = f"doolhof {w}x{h} {lang}"
        mobile = w < 1000
        ctx = browser.new_context(bypass_csp=True, locale="en-GB" if lang == "en" else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
        page = ctx.new_page()
        errors, requests = [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("request", lambda r: requests.append(r.url))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        if page.inner_text("#tile-doolhof .tile-name").strip() != title[lang]:
            problems.append(f"{label}: the tile says {page.inner_text('#tile-doolhof .tile-name')!r}")
        heading = page.evaluate("document.querySelector('#tile-doolhof').closest('.tile-group').querySelector('.group-name').textContent")
        if heading.strip() != group[lang]:
            problems.append(f"{label}: the tile is in {heading!r}, not with Letters")
        if w == 390 and lang == "nl":
            page.locator("#tile-doolhof").scroll_into_view_if_needed()
            page.locator("#tile-doolhof").screenshot(path=str(SHOTS / "doolhof-tile.png"))
        page.click("#tile-doolhof")
        page.wait_for_timeout(200)
        if page.locator("#doolhof-menu .option-card").count() != 3:
            problems.append(f"{label}: {page.locator('#doolhof-menu .option-card').count()} kinds of round")
        page.screenshot(path=str(SHOTS / f"doolhof-{w}x{h}-{lang}-menu.png"))
        page.click("#doolhof-menu .option-card[data-mode=abc]")
        page.wait_for_timeout(200)
        choose(page, ".level-cell[data-round='abc-t2-1']")
        page.wait_for_timeout(200)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != [TEXT[lang]["ok"]]:
            problems.append(f"{label}: a locked round offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
        choose(page, ".level-cell[data-round='abc-t1-1']")
        page.wait_for_selector("#screen-doolhof.active")
        if not close_card_if_any(page, 2000):
            problems.append(f"{label}: no how-to card the first time")
        page.wait_for_timeout(250)
        dh_fits(page, w, h, label, problems)
        page.screenshot(path=str(SHOTS / f"doolhof-{w}x{h}-{lang}-abc.png"))
        if page.locator("audio").count():
            problems.append(f"{label}: an audio element (no voice in this game)")
        if not full:
            for rid in ("word-t1-1", "count-t1-1"):
                page.evaluate(f"window.__bubbels.doolhof.start('{rid}')")
                page.wait_for_timeout(200)
                close_card_if_any(page)
                dh_fits(page, w, h, f"{label} {rid}", problems)
                page.screenshot(path=str(SHOTS / f"doolhof-{w}x{h}-{lang}-{rid.split('-')[0]}.png"))
            if errors:
                problems.append(f"{label}: page errors {errors}")
            ctx.close()
            continue

        # waiting for the first step: no animation frames, the crows stand still
        page.evaluate("""(() => { window.__raf = 0; const o = window.requestAnimationFrame.bind(window);
            window.requestAnimationFrame = (f) => { window.__raf++; return o(f); }; })()""")
        crows = dh_state(page)["crows"]
        page.wait_for_timeout(1000)
        if page.evaluate("window.__raf") > 3:
            problems.append(f"{label}: {page.evaluate('window.__raf')} frames in 1 s while the garden waits")
        if dh_state(page)["crows"] != crows:
            problems.append(f"{label}: the crows walked before the first step")

        # a wrong letter: a bump, it stays, one mistake
        d = None
        for _ in range(6):  # a wrong tile next to the hedgehog where it fits (else a step on first)
            d = page.evaluate("window.__bubbels.doolhof.wrongBeside()")
            if d:
                break
            page.click(f"#doolhof-pad [data-dir={page.evaluate('window.__bubbels.doolhof.autopilot()')}]")
            dh_idle(page)
        before = dh_state(page)
        page.click(f"#doolhof-pad [data-dir={d}]")
        st = dh_idle(page)
        if st["hog"] != before["hog"] or st["mistakes"] != 1 or len(st["tiles"]) != len(before["tiles"]) or st["i"] != before["i"]:
            problems.append(f"{label}: a wrong letter was not a soft bump: {before} -> {st}")
        page.screenshot(path=str(SHOTS / f"doolhof-{w}x{h}-{lang}-wrong.png"))

        # a crow: walked into it by an arrow key, it flutters off; the hedgehog stays, nothing is lost
        page.evaluate("window.__bubbels.doolhof.freeze(true)")
        d = page.evaluate("window.__bubbels.doolhof.crowBeside()")
        before = dh_state(page)
        page.keyboard.press(DH_KEYS[d])
        page.wait_for_function("window.__bubbels.doolhof.state().touches === 1", timeout=3000)
        page.wait_for_timeout(250)
        st = dh_state(page)
        page.screenshot(path=str(SHOTS / f"doolhof-{w}x{h}-{lang}-crow.png"))
        if st["hog"] != before["hog"] or st["i"] != before["i"] or st["mistakes"] != before["mistakes"] or st["tiles"] != before["tiles"]:
            problems.append(f"{label}: a crow cost something (moved back, a letter or a mistake): {st}")
        if st["crows"][0] == before["crows"][0]:
            problems.append(f"{label}: the crow did not fly off")
        if not st["flying"] and not page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"):
            problems.append(f"{label}: no flutter drawn for the crow")
        st = dh_idle(page)
        # the same way is free now: the next step walks on at once
        page.keyboard.press(DH_KEYS[d])
        page.wait_for_function(f"window.__bubbels.doolhof.state().hog !== {before['hog']}", timeout=3000)
        st = dh_idle(page)
        if st["mistakes"] != before["mistakes"] or st["touches"] != 1:
            problems.append(f"{label}: walking on after the crow went wrong: {st}")
        page.evaluate("window.__bubbels.doolhof.freeze(false)")

        # the rest of the round by real input, crows walking
        st = dh_play_to_end(page, label, problems, swipe_first=True)
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
        page.screenshot(path=str(SHOTS / f"doolhof-{w}x{h}-{lang}-win.png"))
        got = page.evaluate("window.__bubbels.doolhof.stars()")
        if got.get("abc-t1-1") != 2:
            problems.append(f"{label}: one wrong letter should save 2 stars, saved {got}")
        page.click(f"#ov-buttons button >> nth=-1")  # Rounds
        page.wait_for_timeout(200)

        # back + keep playing: the garden waits for the next step; the Android back button
        choose(page, ".level-cell[data-round='abc-t1-2']")
        page.wait_for_selector("#screen-doolhof.active")
        dh_idle(page)
        d = page.evaluate("window.__bubbels.doolhof.autopilot()")
        page.click(f"#doolhof-pad [data-dir={d}]")
        page.wait_for_timeout(300)
        page.click("#doolhof-back")
        page.wait_for_timeout(200)
        if not page.is_visible("#doolhof-continue") or page.inner_text("#doolhof-continue").strip() != TEXT[lang]["keep"]:
            problems.append(f"{label}: no 'keep playing' for an unfinished round")
        page.click("#doolhof-continue")
        page.wait_for_timeout(300)
        a = dh_state(page)
        page.wait_for_timeout(1300)
        b = dh_state(page)
        if a["started"] or a["crows"] != b["crows"] or a["hog"] != b["hog"]:
            problems.append(f"{label}: after 'keep playing' something moved before a step")
        page.evaluate("window.__bubbels.back()")
        page.wait_for_timeout(200)
        if not page.is_visible("#screen-doolhof-menu"):
            problems.append(f"{label}: the Android back button did not go to the menu")
        page.evaluate("window.__bubbels.back()")  # from the alphabet's rounds to the kinds
        page.wait_for_timeout(150)
        if page.locator("#doolhof-menu .option-card").count() != 3:
            problems.append(f"{label}: back from the rounds did not show the kinds")

        # the end of the free part: "More rounds" offers only OK over the list
        page.click("#doolhof-menu .option-card[data-mode=count]")
        page.wait_for_timeout(150)
        choose(page, ".level-cell[data-round='count-t1-3']")
        page.wait_for_selector("#screen-doolhof.active")
        close_card_if_any(page)
        dh_play_to_end(page, f"{label} count-t1-3", problems)
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
        page.click(f"#ov-buttons button >> text={'Meer rondes' if lang == 'nl' else 'More rounds'}")
        page.wait_for_timeout(250)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != [TEXT[lang]["ok"]]:
            problems.append(f"{label}: the end of the free part offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(200)
        if not page.is_visible("#screen-doolhof-menu") or page.evaluate("window.__bubbels.doolhof.stars()").get("count-t1-3") != 3:
            problems.append(f"{label}: the offer did not land on the list with the stars kept")
        foreign = [u for u in requests if not u.startswith(base)]
        if foreign:
            problems.append(f"{label}: requests outside the app: {foreign[:3]}")
        if errors:
            problems.append(f"{label}: page errors {errors}")
        ctx.close()


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
    for sel in ("#dammen-menu .seg-card[data-level='2']", "#dammen-menu .seg-card[data-level='3']", "#dammen-menu .option-card.board-big"):
        choose(page, sel)
        page.wait_for_timeout(200)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != ["Oké"]:
            problems.append(f"dammen: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "dammen-1-menu.png"), full_page=True)

    # two players on 8x8: both sides play their last legal move (a known 45-move game player 1 wins)
    choose(page, "#dammen-menu .option-card.board-small")
    choose(page, "#dammen-menu .option-card.mode-duo")
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
    choose(page, "#dammen-menu .seg-card[data-level='1']")
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
            choose(page, "#dammen-menu .option-card.look-classic")  # the classic look
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


# ---------- Tijgers en geitjes (Bagh-Chal) ----------

def _bagh_lines():
    """The points one step away along a line, and the jumps (over, to), as in rules.js."""
    nbr, jumps = [], []
    for i in range(25):
        r, c = divmod(i, 5)
        ns, js = [], []
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            if dr and dc and (r + c) % 2:
                continue
            if 0 <= r + dr < 5 and 0 <= c + dc < 5:
                ns.append((r + dr) * 5 + c + dc)
            if 0 <= r + 2 * dr < 5 and 0 <= c + 2 * dc < 5:
                js.append(((r + dr) * 5 + c + dc, (r + 2 * dr) * 5 + c + 2 * dc))
        nbr.append(ns)
        jumps.append(js)
    return nbr, jumps


BAGH_NBR, BAGH_JUMPS = _bagh_lines()


def bagh_state(page):
    return page.evaluate("window.__bubbels.bagh.state()")


def bagh_wait(page, timeout=20000):
    """Until no piece is moving and the computer is not thinking."""
    page.wait_for_function("(() => { const s = window.__bubbels.bagh.state(); return s && (!s.busy || s.over); })()", timeout=timeout)


def bagh_capturable(board):
    out = set()
    for i, v in enumerate(board):
        if v == 2:
            for over, to in BAGH_JUMPS[i]:
                if board[over] == 1 and not board[to]:
                    out.add(over)
    return out


def bagh_after(board, m):
    b = list(board)
    if m["from"] < 0:
        b[m["to"]] = 1
    else:
        b[m["to"]], b[m["from"]] = b[m["from"]], 0
    if m["over"] >= 0:
        b[m["over"]] = 0
    return b


def bagh_tiger_moves(board):
    n = 0
    for i, v in enumerate(board):
        if v == 2:
            n += sum(1 for j in BAGH_NBR[i] if not board[j])
            n += sum(1 for over, to in BAGH_JUMPS[i] if board[over] == 1 and not board[to])
    return n


def bagh_sensible_goat(st):
    """A child who plays the goats sensibly: keeps every goat safe when it can, and hems the tigers in."""
    moves = st["moves"]
    safe = [m for m in moves if not bagh_capturable(bagh_after(st["board"], m))] or moves
    return min(safe, key=lambda m: (bagh_tiger_moves(bagh_after(st["board"], m)), m["to"], m["from"]))


def bagh_play(page, m, how="tap"):
    """Play one move by real input: a tap on the point (placing), tap-tap, or a mouse drag."""
    before = bagh_state(page)["history"]
    if m["from"] < 0:
        page.click(f".bpt[data-i='{m['to']}']")
    elif how == "drag":
        a = page.locator(f".bpt[data-i='{m['from']}']").bounding_box()
        b = page.locator(f".bpt[data-i='{m['to']}']").bounding_box()
        page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2)
        page.mouse.down()
        for k in range(1, 9):
            page.mouse.move(a["x"] + a["width"] / 2 + (b["x"] - a["x"]) * k / 8, a["y"] + a["height"] / 2 + (b["y"] - a["y"]) * k / 8)
        page.mouse.up()
    else:
        if bagh_state(page)["sel"] != m["from"]:
            page.click(f".bpt[data-i='{m['from']}']")
        page.click(f".bpt[data-i='{m['to']}']")
    page.wait_for_function(f"(() => {{ const s = window.__bubbels.bagh.state(); return s.history !== {before} || s.over; }})()", timeout=6000)
    bagh_wait(page)


def bagh_fits(page, w, h, label, problems):
    """The field, the chips, the meadow and the HUD buttons stay on screen; points 44 px or more; no sideways scroll."""
    for sel in ("#baghchal-board", "#baghchal-turn", "#baghchal-meadow", "#baghchal-back", "#baghchal-undo"):
        r = page.locator(sel).bounding_box()
        if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
            problems.append(f"baghchal {label}: {sel} off screen ({r})")
    for sel in ("#baghchal-back", "#baghchal-undo", ".bpt >> nth=0", ".bpt >> nth=24"):
        r = page.locator(sel).bounding_box()
        if r and min(r["width"], r["height"]) < 44:
            problems.append(f"baghchal {label}: {sel} only {r['width']:.0f}x{r['height']:.0f}")
    if page.evaluate("document.documentElement.scrollWidth") > w:
        problems.append(f"baghchal {label}: sideways scroll")
    return page.locator(".bpt >> nth=0").bounding_box()["width"]


def baghchal_flow(browser, base, problems):
    """Tijgers en geitjes on the web build: medium and hard offer only OK; two players: a goat
    placed next to a tiger is jumped by a real drag and hops off to the meadow, the take-back puts
    it back, then the tigers capture five and win (not counted); against easy as the goats: a whole
    game played to the end by real taps and drags (placing, tap-tap, a drag dropped off the field
    that keeps the piece picked up), a take-back, back + keep playing, the win counted; the Android
    back button."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion="reduce")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.inner_text("#tile-baghchal .tile-name").strip() != "Tijgers en geitjes (Bagh\u2011Chal)":
        problems.append(f"baghchal: tile says {page.inner_text('#tile-baghchal .tile-name')!r}")
    group = page.evaluate("document.querySelector('#tile-baghchal').closest('.tile-group')?.contains(document.querySelector('#tile-dammen'))")
    if not group:
        problems.append("baghchal: the tile is not in the section with Dammen")
    page.click("#tile-baghchal")
    page.wait_for_timeout(250)
    for sel in (".bagh-level[data-level='2']", ".bagh-level[data-level='3']"):
        choose(page, sel)
        page.wait_for_timeout(200)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != ["Oké"]:
            problems.append(f"baghchal: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "baghchal-1-menu.png"), full_page=True)

    # two players: a capture by a real drag, the meadow, a take-back, then the tigers win
    page.click(".bagh-opt.mode-duo")
    page.click("#baghchal-play")
    page.wait_for_timeout(300)
    bagh_fits(page, 390, 844, "390x844", problems)
    if "Tik op een leeg punt" not in page.inner_text("#baghchal-status"):
        problems.append(f"baghchal: the placing hint says {page.inner_text('#baghchal-status')!r}")
    if page.locator(".bpt.place").count() != 21:
        problems.append(f"baghchal: {page.locator('.bpt.place').count()} free points shown while placing, expected 21")
    bagh_play(page, {"from": -1, "to": 1, "over": -1})
    page.click(".bpt[data-i='0']")  # the corner tiger: its dots, and the goat it would jump
    page.wait_for_timeout(100)
    targets = page.evaluate("[...document.querySelectorAll('.bpt.target')].map((e) => Number(e.dataset.i)).sort((a, b) => a - b)")
    if targets != [2, 5, 6] or page.locator(".bpt.over").count() != 1:
        problems.append(f"baghchal: the corner tiger shows dots {targets} and {page.locator('.bpt.over').count()} goat to jump")
    page.screenshot(path=str(SHOTS / "baghchal-2-duo-dots.png"))
    bagh_play(page, {"from": 0, "to": 2, "over": 1}, how="drag")
    st = bagh_state(page)
    if st["captured"] != 1 or st["board"][1] or st["board"][2] != 2 or page.locator("#baghchal-meadow .bagh-spot[data-full='true']").count() != 1:
        problems.append(f"baghchal: the drag capture left captured={st['captured']}, board {st['board'][:3]}")
    page.screenshot(path=str(SHOTS / "baghchal-3-meadow.png"))
    if not st["canUndo"]:
        problems.append("baghchal: no take-back after a move in a game together")
    page.click("#baghchal-undo")
    page.wait_for_timeout(150)
    st = bagh_state(page)
    if st["captured"] != 0 or st["board"][1] != 1 or st["board"][0] != 2 or st["turn"] != 2:
        problems.append(f"baghchal: the take-back left captured={st['captured']}, board {st['board'][:3]}, turn {st['turn']}")
    for ply in range(80):
        st = bagh_state(page)
        if st["over"]:
            break
        if st["turn"] == 1:
            # the goats walk into the tigers' way: a goat that can be jumped at once
            m = next((m for m in st["moves"] if bagh_capturable(bagh_after(st["board"], m))), st["moves"][0])
        else:
            m = next((m for m in st["moves"] if m["over"] >= 0), st["moves"][0])
        bagh_play(page, m, how="drag" if ply % 4 == 3 and m["from"] >= 0 else "tap")
    st = bagh_state(page)
    if not st["over"] or st["over"].get("winner") != 2 or st["captured"] != 5:
        problems.append(f"baghchal: the game together did not end with five goats in the meadow: {st['over']}, {st['captured']}")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / "baghchal-4-duo-win.png"))
    if page.inner_text("#ov-title").strip() != "De tijgers winnen!":
        problems.append(f"baghchal: end card says {page.inner_text('#ov-title')!r}")
    if page.evaluate("(window.__bubbels.save().games.baghchal || {}).stars || {}"):
        problems.append("baghchal: a game played together was counted")
    page.click("#ov-buttons button >> text=Menu")
    page.wait_for_timeout(200)

    # against easy as the goats: whole games by real input until the goats win (easy loses often)
    choose(page, ".bagh-level[data-level='1']")
    page.click(".bagh-opt.side-goats")
    won = False
    for attempt in range(4):
        page.click("#baghchal-play")
        page.wait_for_timeout(300)
        bagh_wait(page)
        dropped = took_back = kept = False
        for ply in range(400):
            st = bagh_state(page)
            if st["over"]:
                break
            if st["turn"] != 1 or not st["moves"]:
                bagh_wait(page)
                continue
            m = bagh_sensible_goat(st)
            if attempt == 0 and not took_back and st["history"] == 4:
                # a take-back: the child's move and the computer's answer
                bagh_play(page, m)
                if not bagh_state(page)["over"]:
                    page.click("#baghchal-undo")
                    page.wait_for_timeout(150)
                    after = bagh_state(page)
                    if after["history"] != 4 or after["turn"] != 1 or after["board"] != st["board"]:
                        problems.append(f"baghchal: the take-back against easy left {after['history']} moves")
                took_back = True
                continue
            if attempt == 0 and not kept and st["history"] == 8:
                page.evaluate("window.__bubbels.back()")  # the Android back button
                page.wait_for_timeout(200)
                if not page.is_visible("#baghchal-continue"):
                    problems.append("baghchal: the back button did not lead to the menu with 'keep playing'")
                page.click("#baghchal-continue")
                page.wait_for_timeout(200)
                kept = True
                continue
            if m["from"] >= 0 and not dropped:
                # a drag dropped off the field: the piece goes back and stays picked up
                a = page.locator(f".bpt[data-i='{m['from']}']").bounding_box()
                page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2)
                page.mouse.down()
                page.mouse.move(a["x"] + 20, a["y"] + 40)
                page.mouse.move(195, 40)
                page.mouse.up()
                page.wait_for_timeout(100)
                st2 = bagh_state(page)
                if st2["history"] != st["history"] or st2["sel"] != m["from"]:
                    problems.append(f"baghchal: a drag dropped off the field moved something or dropped the piece ({st2['sel']})")
                page.screenshot(path=str(SHOTS / "baghchal-6-picked-up.png"))
                dropped = True
            how = "drag" if m["from"] >= 0 and ply % 3 == 0 else "tap"
            bagh_play(page, m, how=how)
            if attempt == 0 and ply == 30:
                page.screenshot(path=str(SHOTS / "baghchal-5-vs-easy.png"))
        st = bagh_state(page)
        if not st["over"]:
            problems.append(f"baghchal: the game against easy did not end ({st['history']} moves)")
            break
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
        if st["over"].get("winner") == 1:
            won = True
            page.screenshot(path=str(SHOTS / "baghchal-7-goats-win.png"))
            if page.inner_text("#ov-title").strip() != "Jij wint!":
                problems.append(f"baghchal: the win card says {page.inner_text('#ov-title')!r}")
            stars = page.evaluate("(window.__bubbels.save().games.baghchal || {}).stars || {}")
            if stars.get("cpu-goats-1") != 1:
                problems.append(f"baghchal: the win was not counted: {stars}")
            page.click("#ov-buttons button >> text=Menu")
            break
        print(f"[baghchal] easy game {attempt + 1}: {st['over']}")
        page.click("#ov-buttons button >> text=Menu")
        page.wait_for_timeout(200)
    if not won:
        problems.append("baghchal: four games as sensible goats never beat easy")
    page.wait_for_timeout(200)
    if "1" not in page.inner_text(".bagh-level[data-level='1']"):
        problems.append("baghchal: the menu does not show the win on Easy")
    page.evaluate("document.querySelector('#screen-baghchal-menu [data-go=home]').click()")
    if errors:
        problems.append(f"baghchal: page errors {errors[:3]}")
    ctx.close()


def baghchal_back_mid_move(browser, base, problems):
    """Back while the winning move is still on its way: the game ends on the menu, and "keep
    playing" opens the finished field with its end card (animations on, unlike baghchal_flow)."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.click("#tile-baghchal")
    page.wait_for_timeout(200)
    page.click(".bagh-opt.mode-duo")
    page.click("#baghchal-play")
    page.wait_for_timeout(300)
    # four goats already in the meadow; the corner tiger can take the fifth
    board = [2, 1, 0, 0, 2] + [0] * 5 + [0, 0, 1, 0, 0] + [0] * 5 + [2, 0, 0, 0, 2]
    page.evaluate(f"window.__bubbels.bagh.setGame({board}, 2, 0, 4)")
    page.wait_for_timeout(150)
    page.click(".bpt[data-i='0']")
    page.click(".bpt[data-i='2']")
    page.evaluate("window.__bubbels.back()")  # the Android back button, while the tiger jumps
    page.wait_for_timeout(150)
    if not page.is_visible("#screen-baghchal-menu"):
        problems.append("baghchal back mid-move: not on the menu")
    page.wait_for_function("!!window.__bubbels.bagh.state().over", timeout=5000)
    page.wait_for_timeout(1200)
    if page.is_visible("#overlay"):
        problems.append("baghchal back mid-move: an end card over the menu")
    if page.is_visible("#baghchal-continue"):
        page.click("#baghchal-continue")
    else:
        page.click("#baghchal-play")  # the menu was redrawn without "keep playing": nothing to check
        problems.append("baghchal back mid-move: no 'keep playing' to open the finished game")
    page.wait_for_selector("#overlay:not([hidden])", timeout=3000)
    if page.inner_text("#ov-title").strip() != "De tijgers winnen!":
        problems.append(f"baghchal back mid-move: keep playing shows {page.inner_text('#ov-title')!r}")
    page.screenshot(path=str(SHOTS / "baghchal-8-back-mid-move.png"))
    if errors:
        problems.append(f"baghchal back mid-move: page errors {errors[:2]}")
    ctx.close()


def baghchal_layouts(browser, base, problems):
    """Tijgers en geitjes at 320x568, sideways 844x390 and 568x320, 390x844 in English and on
    desktop, every point 44 px or more; in the full version the hard computer (as the goats, it
    starts) thinks in a worker while the page keeps drawing."""
    for w, h, owned in ((320, 568, False), (844, 390, False), (568, 320, False), (390, 844, False), (1280, 800, False), (390, 844, True)):
        mobile = w < 1000
        english = (w, h) == (390, 844) and not owned
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
        label = f"{w}x{h}{' full' if owned else ''}{' en' if english else ''}"
        if english and page.inner_text("#tile-baghchal .tile-name").strip() != "Tigers and Goats (Bagh\u2011Chal)":
            problems.append(f"baghchal {label}: English tile says {page.inner_text('#tile-baghchal .tile-name')!r}")
        page.click("#tile-baghchal")
        page.wait_for_timeout(200)
        page.screenshot(path=str(SHOTS / f"baghchal-menu-{w}x{h}{'-full' if owned else ''}.png"), full_page=True)
        if owned:
            page.evaluate("window.__frames = 0; (function f() { window.__frames++; requestAnimationFrame(f); })()")
        page.evaluate(f"window.__bubbels.bagh.choose({{ mode: 'cpu', level: {3 if owned else 1}, side: '{'tigers' if owned else 'goats'}' }})")
        page.click("#baghchal-play")
        page.wait_for_timeout(400)
        cell = bagh_fits(page, w, h, label, problems)
        print(f"[baghchal {label}] point {cell:.0f} px")
        if owned:
            bagh_wait(page)
            st = bagh_state(page)
            if st["turn"] != 2 or st["history"] != 1 or st["toPlace"] != 19:
                problems.append(f"baghchal {label}: hard goats did not start ({st['history']} moves)")
            # a tiger move by taps, and hard answers in its worker while the page keeps drawing
            page.evaluate("window.__frames = 0")
            bagh_play(page, next(m for m in st["moves"] if m["over"] < 0))
            st = bagh_state(page)
            if st["turn"] != 2 or st["history"] != 3:
                problems.append(f"baghchal {label}: hard did not answer ({st['history']} moves)")
            if page.evaluate("window.__frames") < 20:
                problems.append(f"baghchal {label}: only {page.evaluate('window.__frames')} frames while the computer thought")
        else:
            # a few goats placed and one picked up, for the screenshot
            for k in range(3):
                st = bagh_state(page)
                bagh_play(page, bagh_sensible_goat(st))
        page.screenshot(path=str(SHOTS / f"baghchal-{w}x{h}{'-full' if owned else ''}.png"))
        if errors:
            problems.append(f"baghchal {label}: page errors {errors[:2]}")
        ctx.close()


# ---------- Schaken ----------

def sk_sq(name):
    """'e2' -> the square's index (a8 is 0, h1 63), as in rules.js."""
    return (8 - int(name[1])) * 8 + "abcdefgh".index(name[0])


def sk_state(page):
    return page.evaluate("window.__bubbels.schaak.state()")


def sk_wait(page, timeout=20000):
    """Until no piece is moving and the computer is not thinking."""
    page.wait_for_function("(() => { const s = window.__bubbels.schaak.state(); return s && (!s.busy || s.over); })()", timeout=timeout)


def sk_click(page, name):
    page.click(f".ssq[data-sq='{name}']")


def sk_drag(page, a, b, end=None):
    """A real mouse drag from square a to square b (or to a point `end`)."""
    ra = page.locator(f".ssq[data-sq='{a}']").bounding_box()
    x0, y0 = ra["x"] + ra["width"] / 2, ra["y"] + ra["height"] / 2
    if end is None:
        rb = page.locator(f".ssq[data-sq='{b}']").bounding_box()
        end = (rb["x"] + rb["width"] / 2, rb["y"] + rb["height"] / 2)
    page.mouse.move(x0, y0)
    page.mouse.down()
    for k in range(1, 9):
        page.mouse.move(x0 + (end[0] - x0) * k / 8, y0 + (end[1] - y0) * k / 8)
    page.mouse.up()


def sk_move(page, text, how="tap", promo_kind=None):
    """Play one move ('e2e4', 'c7c8n') by real input: tap-tap or a drag, and the picker for a promotion."""
    before = sk_state(page)["history"]
    a, b = text[:2], text[2:4]
    if how == "drag":
        sk_drag(page, a, b)
    else:
        if sk_state(page)["sel"] != sk_sq(a):
            sk_click(page, a)
        sk_click(page, b)
    if len(text) == 5:
        page.wait_for_selector(".schaak-promo")
        page.click(f".schaak-promo-btn[data-kind='{promo_kind or {'q': 5, 'r': 4, 'b': 3, 'n': 2}[text[4]]}']")
    page.wait_for_function(f"(() => {{ const s = window.__bubbels.schaak.state(); return s.history !== {before} || s.over; }})()", timeout=6000)
    sk_wait(page)


def sk_fits(page, w, h, label, problems):
    """The board, the chips, the status and the HUD buttons stay on screen; no sideways scroll."""
    for sel in ("#schaak-board", "#schaak-turn", "#schaak-status", "#schaak-back", "#schaak-undo"):
        r = page.locator(sel).bounding_box()
        if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
            problems.append(f"schaak {label}: {sel} off screen ({r})")
    for sel in ("#schaak-back", "#schaak-undo") + (("#schaak-hint",) if page.is_visible("#schaak-hint") else ()):
        r = page.locator(sel).bounding_box()
        if r and min(r["width"], r["height"]) < 44:
            problems.append(f"schaak {label}: {sel} only {r['width']:.0f}x{r['height']:.0f}")
        if r and (r["y"] + r["height"] > h + 0.5 or r["x"] + r["width"] > w + 0.5):
            problems.append(f"schaak {label}: {sel} off screen ({r})")
    if page.evaluate("document.documentElement.scrollWidth") > w:
        problems.append(f"schaak {label}: sideways scroll")
    board = page.locator("#schaak-board").bounding_box()
    cell = page.locator(".ssq >> nth=0").bounding_box()["width"]
    if w < 500 and board["width"] < w - 12:
        problems.append(f"schaak {label}: the board uses {board['width']:.0f} of {w} px")
    return cell


# a two-player game by real taps and drags: en passant, a promotion (to a knight), castling, mate
SK_DUO = ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6", "c8d7", "d6c7", "a6a5", "c7c8n", "a8a6", "g1h3", "a5a4",
          "f1c4", "a6c6", "e1g1", "b7b6", "d1h5", "b6b5", "h5f7"]


def schaak_flow(browser, base, problems):
    """Schaken on the web build: the tile in Bordspellen, medium and hard offer only OK; two players
    by real taps and drags with en passant, a promotion (the picker, "not yet", then a knight),
    castling and Scholar's-mate style checkmate (not counted); the glow on a piece's squares, a
    ring on a capture, a drag dropped off the board that keeps the piece picked up; against easy: a
    move, the computer's answer, the take-back of both, a move by drag, the hint, back + keep
    playing, a king in check glowing with only its saving moves, and a mate that is counted."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion="reduce")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.inner_text("#tile-schaak .tile-name").strip() != "Schaken":
        problems.append(f"schaak: tile says {page.inner_text('#tile-schaak .tile-name')!r}")
    if not page.evaluate("document.querySelector('#tile-schaak').closest('.tile-group')?.contains(document.querySelector('#tile-dammen'))"):
        problems.append("schaak: the tile is not in the section with Dammen")
    page.click("#tile-schaak")
    page.wait_for_timeout(250)
    for sel in (".schaak-level[data-level='2']", ".schaak-level[data-level='3']"):
        choose(page, sel)
        page.wait_for_timeout(200)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != ["Oké"]:
            problems.append(f"schaak: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "schaak-1-menu.png"), full_page=True)

    # two players
    page.click(".schaak-opt.mode-duo")
    page.click("#schaak-play")
    page.wait_for_timeout(300)
    sk_fits(page, 390, 844, "390x844", problems)
    if page.is_visible("#schaak-hint"):
        problems.append("schaak: the hint button shows in a game together")
    sk_click(page, "g1")
    glow = sorted(page.evaluate("[...document.querySelectorAll('.ssq.target')].map((e) => e.dataset.sq)"))
    if glow != ["f3", "h3"]:
        problems.append(f"schaak: the knight on g1 shows {glow}")
    sk_click(page, "e7")  # a black piece is no target: the knight is put down, nothing moves
    if sk_state(page)["sel"] is not None or sk_state(page)["history"] != 0:
        problems.append("schaak: a tap on the other side's piece did something")
    for ply, mv in enumerate(SK_DUO):
        if mv == "e5d6":
            sk_click(page, "e5")
            caps = page.evaluate("[...document.querySelectorAll('.ssq.capture')].map((e) => e.dataset.sq)")
            if caps != ["d6"]:
                problems.append(f"schaak: en passant is not shown as a capture on d6: {caps}")
            page.screenshot(path=str(SHOTS / "schaak-2-en-passant.png"))
        if mv == "c7c8n":
            sk_click(page, "c7")
            sk_click(page, "c8")
            page.wait_for_selector(".schaak-promo")
            kinds = page.evaluate("[...document.querySelectorAll('.schaak-promo-btn')].map((e) => Number(e.dataset.kind))")
            if kinds != [5, 4, 3, 2] or "first" not in (page.get_attribute(".schaak-promo-btn >> nth=0", "class") or ""):
                problems.append(f"schaak: the promotion picker offers {kinds}")
            for sel in (".schaak-promo-btn >> nth=0", ".schaak-promo-cancel"):
                r = page.locator(sel).bounding_box()
                if min(r["width"], r["height"]) < 44:
                    problems.append(f"schaak: {sel} in the picker is only {r['width']:.0f}x{r['height']:.0f}")
            page.screenshot(path=str(SHOTS / "schaak-3-promotion.png"))
            page.click(".schaak-promo-cancel")  # not yet: the pawn stays picked up
            page.wait_for_timeout(100)
            st = sk_state(page)
            if st["promo"] or st["sel"] != sk_sq("c7") or st["history"] != ply:
                problems.append(f"schaak: 'not yet' left promo {st['promo']}, sel {st['sel']}")
            sk_click(page, "c8")
            page.wait_for_selector(".schaak-promo")
            before = sk_state(page)["history"]
            page.click(".schaak-promo-btn[data-kind='2']")
            page.wait_for_function(f"window.__bubbels.schaak.state().history !== {before}", timeout=5000)
            sk_wait(page)
            if sk_state(page)["board"][sk_sq("c8")] != 2:
                problems.append("schaak: the pawn did not become a knight on c8")
            continue
        if mv == "d1h5":
            # a drag dropped off the board: nothing moves, the queen stays picked up
            sk_drag(page, "d1", None, end=(195, 40))
            page.wait_for_timeout(100)
            st = sk_state(page)
            if st["history"] != ply or st["sel"] != sk_sq("d1"):
                problems.append(f"schaak: a drag dropped off the board moved something or dropped the piece ({st['sel']})")
        sk_move(page, mv, how="drag" if mv in ("g1h3", "f1c4", "a6c6") else "tap")
        st = sk_state(page)
        if mv == "e5d6" and st["board"][sk_sq("d5")]:
            problems.append("schaak: en passant left the pawn on d5")
        if mv == "e1g1":
            if st["board"][sk_sq("g1")] != 6 or st["board"][sk_sq("f1")] != 4 or st["board"][sk_sq("h1")]:
                problems.append("schaak: castling did not put the king on g1 and the rook on f1")
            page.screenshot(path=str(SHOTS / "schaak-4-castled.png"))
    st = sk_state(page)
    if st["over"] != {"winner": 1, "reason": "mate"}:
        problems.append(f"schaak: the two-player game did not end in mate: {st['over']}")
    if st["check"] != sk_sq("e8") or page.locator(".ssq.check").count() != 1:
        problems.append(f"schaak: the mated king does not glow ({st['check']})")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / "schaak-5-mate.png"))
    if page.inner_text("#ov-title").strip() != "Schaakmat! Wit wint!":
        problems.append(f"schaak: end card says {page.inner_text('#ov-title')!r}")
    if page.evaluate("(window.__bubbels.save().games.schaak || {}).stars || {}"):
        problems.append("schaak: a game played together was counted")
    page.click("#ov-buttons button >> text=Menu")
    page.wait_for_timeout(200)

    # against easy: a move, the answer, the take-back, a drag, the hint, back + keep playing
    choose(page, ".schaak-level[data-level='1']")
    page.click("#schaak-play")
    page.wait_for_timeout(300)
    if not page.is_visible("#schaak-hint"):
        problems.append("schaak: no hint button against easy")
    sk_move(page, "e2e4")
    sk_wait(page)
    st = sk_state(page)
    if st["history"] != 2 or st["turn"] != 1:
        problems.append(f"schaak: after one move against easy: {st['history']} moves, turn {st['turn']}")
    page.screenshot(path=str(SHOTS / "schaak-6-vs-easy.png"))
    page.click("#schaak-undo")
    page.wait_for_timeout(150)
    st = sk_state(page)
    if st["history"] != 0 or st["turn"] != 1 or st["board"][sk_sq("e2")] != 1:
        problems.append(f"schaak: the take-back left {st['history']} moves, turn {st['turn']}")
    sk_move(page, "d2d4", how="drag")
    sk_wait(page)
    if sk_state(page)["history"] != 2:
        problems.append("schaak: a drag against easy did not play")
    page.click("#schaak-hint")
    page.wait_for_timeout(150)
    st = sk_state(page)
    if not st["hint"] or page.locator(".ssq.hint").count() != 2 or st["sel"] != st["hint"]["from"]:
        problems.append(f"schaak: the hint shows {st['hint']} on {page.locator('.ssq.hint').count()} squares")
    page.screenshot(path=str(SHOTS / "schaak-7-hint.png"))
    to = st["hint"]["to"]
    before = st["history"]
    page.click(f".ssq[data-i='{to}']")
    if page.is_visible(".schaak-promo"):
        page.click(".schaak-promo-btn >> nth=0")
    page.wait_for_function(f"window.__bubbels.schaak.state().history !== {before}", timeout=5000)
    sk_wait(page)
    page.evaluate("window.__bubbels.back()")  # the Android back button
    page.wait_for_timeout(200)
    if not page.is_visible("#schaak-continue"):
        problems.append("schaak: the back button did not lead to the menu with 'keep playing'")
    page.click("#schaak-continue")
    page.wait_for_timeout(200)
    if sk_state(page)["history"] != 4:
        problems.append(f"schaak: keep playing lost moves ({sk_state(page)['history']})")

    # a king in check: it glows, only saving moves count, a piece that cannot help says so
    page.evaluate("window.__bubbels.schaak.setFen('4k3/8/8/8/8/8/4q3/R3K3 w - - 0 1')")
    page.wait_for_timeout(150)
    if sk_state(page)["check"] != sk_sq("e1") or "Schaak" not in page.inner_text("#schaak-status"):
        problems.append(f"schaak: check shows {sk_state(page)['check']}, status {page.inner_text('#schaak-status')!r}")
    sk_click(page, "a1")
    if "schaak" not in page.inner_text("#schaak-status").lower() or sk_state(page)["sel"] is not None:
        problems.append(f"schaak: a rook that cannot help says {page.inner_text('#schaak-status')!r}")
    sk_click(page, "e1")
    if page.evaluate("[...document.querySelectorAll('.ssq.capture')].map((e) => e.dataset.sq)") != ["e2"]:
        problems.append("schaak: the king in check does not show the capture on e2")
    page.screenshot(path=str(SHOTS / "schaak-8-check.png"))

    # a mate against easy is counted
    page.evaluate("window.__bubbels.schaak.setFen('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1')")
    page.wait_for_timeout(150)
    sk_move(page, "a1a8")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    if page.inner_text("#ov-title").strip() != "Schaakmat! Jij wint!":
        problems.append(f"schaak: the win card says {page.inner_text('#ov-title')!r}")
    stars = page.evaluate("(window.__bubbels.save().games.schaak || {}).stars || {}")
    if stars.get("cpu-1") != 1:
        problems.append(f"schaak: the win was not counted: {stars}")
    page.click("#ov-buttons button >> text=Menu")
    page.wait_for_timeout(200)
    if "1" not in page.inner_text(".schaak-level[data-level='1']"):
        problems.append("schaak: the menu does not show the win on Easy")
    page.evaluate("document.querySelector('#screen-schaak-menu [data-go=home]').click()")
    if errors:
        problems.append(f"schaak: page errors {errors[:3]}")
    ctx.close()


def schaak_layouts(browser, base, problems):
    """Schaken at 320x568, 568x320, 390x844 in English, 844x390 and on desktop: everything on
    screen, the board as wide as the phone, a near tap reaching a piece where squares are under 44
    px; in the full version the hard computer thinks in a worker while the page keeps drawing
    (animations on)."""
    for w, h, owned in ((320, 568, False), (568, 320, False), (390, 844, False), (844, 390, False), (1280, 800, False), (390, 844, True)):
        mobile = w < 1000
        english = (w, h) == (390, 844) and not owned
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
        label = f"{w}x{h}{' full' if owned else ''}{' en' if english else ''}"
        if english and page.inner_text("#tile-schaak .tile-name").strip() != "Chess":
            problems.append(f"schaak {label}: English tile says {page.inner_text('#tile-schaak .tile-name')!r}")
        page.click("#tile-schaak")
        page.wait_for_timeout(200)
        page.screenshot(path=str(SHOTS / f"schaak-menu-{w}x{h}{'-full' if owned else ''}.png"), full_page=True)
        page.evaluate(f"window.__bubbels.schaak.choose({{ mode: 'cpu', level: {3 if owned else 1} }})")
        page.click("#schaak-play")
        page.wait_for_timeout(400)
        cell = sk_fits(page, w, h, label, problems)
        print(f"[schaak {label}] square {cell:.0f} px")
        if english and page.inner_text("#schaak-status").strip() != "Your turn":
            problems.append(f"schaak {label}: the status says {page.inner_text('#schaak-status')!r}")
        if cell < 44:
            # small squares: a tap just over the edge of the e2 pawn's square (on the empty e3) still picks the pawn up
            r = page.locator(".ssq[data-sq='e2']").bounding_box()
            page.mouse.click(r["x"] + r["width"] / 2, r["y"] - 3)
            if sk_state(page)["sel"] != sk_sq("e2"):
                problems.append(f"schaak {label}: a near tap reached {sk_state(page)['sel']}, not the e2 pawn")
            sk_click(page, "e2")  # put it down
        # a piece picked up: a tap inside the empty g3, right next to the glowing f3, plays nothing
        sk_click(page, "g1")
        r = page.locator(".ssq[data-sq='g3']").bounding_box()
        page.mouse.click(r["x"] + 3, r["y"] + r["height"] / 2)
        page.wait_for_timeout(150)
        st = sk_state(page)
        if st["history"] != 0 or st["sel"] is not None:
            problems.append(f"schaak {label}: a tap on g3 next to a target played or kept the knight ({st['history']} moves, sel {st['sel']})")
        if owned:
            page.evaluate("window.__frames = 0; (function f() { window.__frames++; requestAnimationFrame(f); })()")
            sk_move(page, "e2e4")
            sk_wait(page)
            st = sk_state(page)
            if st["turn"] != 1 or st["history"] != 2:
                problems.append(f"schaak {label}: hard did not answer ({st['history']} moves)")
            if page.evaluate("window.__frames") < 20:
                problems.append(f"schaak {label}: only {page.evaluate('window.__frames')} frames while the computer thought")
        else:
            sk_click(page, "g1")
        page.screenshot(path=str(SHOTS / f"schaak-{w}x{h}{'-full' if owned else ''}.png"))
        if errors:
            problems.append(f"schaak {label}: page errors {errors[:2]}")
        ctx.close()


# ---------- Ganzenbord ----------

def gans_state(page):
    return page.evaluate("window.__bubbels.gans.state()")


def gans_wait(page, phases=("roll", "count", "over"), timeout=20000):
    """Until the game waits for a child (a throw or a tap) or is over."""
    js = "(() => { const s = window.__bubbels.gans.state(); return s && %s.includes(s.phase) && (s.phase !== 'roll' || s.setup.players[s.turn] === 'kid'); })()" % json.dumps(list(phases))
    page.wait_for_function(js, timeout=timeout)


def ganzen_flow(browser, base, problems):
    """Ganzenbord on the web build: the winter and sea boards and a 3rd goose offer only OK; a game
    against the computer goose played to a win by taps with "count yourself" (every square tapped,
    one wrong tap that only shows where), the goose chain, the bridge, the win card and the counter;
    back + keep playing; the Android back button; no voice is ever asked for."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors, audio = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: "/voice/" in r.url and audio.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.inner_text("#tile-ganzen .tile-name").strip() != "Ganzenbord":
        problems.append(f"ganzen: tile says {page.inner_text('#tile-ganzen .tile-name')!r}")
    page.click("#tile-ganzen")
    page.wait_for_timeout(250)
    for sel in (".ganzen-boardopt.board-winter", ".ganzen-boardopt.board-sea", ".ganzen-slot.slot-2", ".ganzen-slot.slot-3"):
        choose(page, sel)
        page.wait_for_timeout(200)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != ["Oké"]:
            problems.append(f"ganzen: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "ganzen-1-menu.png"), full_page=True)

    # a child against the computer goose, counting yourself; the two dice are set for a short game
    page.click(".ganzen-count.count-on")
    page.evaluate("window.__bubbels.gans.fast(true)")
    page.evaluate("window.__bubbels.gans.rolls([[2, 3], [1, 1], [2, 2], [1, 1], [1, 4], [1, 1], [2, 2], [1, 1], [3, 3], [1, 1], [2, 2]])")
    page.click("#ganzen-play")
    page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / "ganzen-2-start.png"))
    taps = wrong = 0
    for turn in range(40):
        gans_wait(page)
        st = gans_state(page)
        if st["phase"] == "over":
            break
        if st["phase"] == "roll":
            page.click("#ganzen-die")
            continue
        # counting: tap the glowing square (once, first, a wrong one that must change nothing)
        if wrong == 0:
            off = 0 if st["next"] != 0 else 2
            page.click(f".gsq[data-sq='{(st['next'] + 3) % 63 or 2}']")
            page.wait_for_timeout(150)
            after = gans_state(page)
            if after["next"] != st["next"] or after["shown"] != st["shown"]:
                problems.append("ganzen: a wrong tap moved the goose")
            if "gloeit" not in after["msg"]:
                problems.append(f"ganzen: a wrong tap says {after['msg']!r}")
            wrong = 1
        if st["next"] < 0:
            problems.append(f"ganzen: counting with nothing left to tap: {st}")
            break
        page.click(f".gsq[data-sq='{st['next']}']")
        taps += 1
        pops = page.evaluate("document.querySelectorAll('#ganzen-board .count-pop').length")
        if pops > 1:
            problems.append(f"ganzen: {pops} count badges at once")
        if taps == 2:
            page.wait_for_timeout(120)
            page.screenshot(path=str(SHOTS / "ganzen-3-count.png"))
        if taps == 8:
            # leave halfway and come back: the throw is finished at once, the game goes on
            page.click("#ganzen-back")
            page.wait_for_timeout(200)
            if not page.is_visible("#ganzen-continue"):
                problems.append("ganzen: no 'keep playing' halfway a game")
            page.click("#ganzen-continue")
            page.wait_for_timeout(300)
    st = gans_state(page)
    if st["winner"] != 0:
        problems.append(f"ganzen: the child's goose did not win: {st}")
    page.wait_for_selector("#overlay:not([hidden])", timeout=6000)
    page.screenshot(path=str(SHOTS / "ganzen-4-win.png"))
    if page.inner_text("#ov-title").strip() != "Jij wint!":
        problems.append(f"ganzen: end card says {page.inner_text('#ov-title')!r}")
    if page.evaluate("window.__bubbels.gans.wins()").get("won-classic") != 1:
        problems.append(f"ganzen: the win was not counted: {page.evaluate('window.__bubbels.gans.wins()')}")
    if taps < 12:
        problems.append(f"ganzen: only {taps} squares were counted by tapping")
    page.click("#ov-buttons button >> text=Nog een keer")
    page.wait_for_timeout(300)
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(200)
    if not page.is_visible("#screen-ganzen-menu"):
        problems.append("ganzen: the back button did not lead to the menu")

    # leaving during the winning throw still wins: the counter goes up and the card shows
    page.click(".ganzen-count.count-off")
    page.evaluate("window.__bubbels.gans.rolls([[2, 3], [1, 1], [2, 2], [1, 1], [1, 4], [1, 1], [2, 2], [1, 1], [3, 3], [1, 1], [2, 2]])")
    page.click("#ganzen-play")
    left = False
    for turn in range(30):
        gans_wait(page, ("roll", "over"))
        st = gans_state(page)
        if st["phase"] == "over":
            break
        last = st["players"][0]["pos"] == 55
        page.click("#ganzen-die")
        if last:
            page.wait_for_function("window.__bubbels.gans.state().phase === 'moving'", timeout=5000, polling=20)
            page.click("#ganzen-back")
            left = True
            break
    page.wait_for_timeout(300)
    if not left:
        problems.append("ganzen: never reached the winning throw to leave during it")
    elif not page.is_visible("#overlay") or page.inner_text("#ov-title").strip() != "Jij wint!":
        problems.append("ganzen: leaving during the winning throw showed no win card")
    elif page.locator("#ganzen-continue").count():
        problems.append("ganzen: 'keep playing' offered for a game that was won")
    if page.evaluate("window.__bubbels.gans.wins()").get("won-classic") != 2:
        problems.append(f"ganzen: a win left halfway was not counted: {page.evaluate('window.__bubbels.gans.wins()')}")
    page.screenshot(path=str(SHOTS / "ganzen-5-left-win.png"))
    page.click("#ov-buttons button >> text=Menu")
    page.wait_for_timeout(150)
    if audio:
        problems.append(f"ganzen: a voice clip was loaded: {audio[:2]}")
    if errors:
        problems.append(f"ganzen: page errors {errors[:3]}")
    ctx.close()


def ganzen_layouts(browser, base, problems):
    """Ganzenbord at 320x568, sideways 844x390 and 568x320, desktop; the full version with four
    geese on the winter and sea boards; the die and the squares stay on screen; a near tap counts, a
    tap on the next stone does not."""
    for w, h, owned, board in ((320, 568, False, "classic"), (844, 390, False, "classic"), (568, 320, False, "classic"), (1280, 800, False, "classic"),
                               (390, 844, True, "winter"), (568, 320, True, "sea"), (320, 568, True, "sea")):
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
        label = f"{w}x{h}{' full ' + board if owned else ''}"
        if english and page.inner_text("#tile-ganzen .tile-name").strip() != "Game of the Goose":
            problems.append(f"ganzen {label}: English tile says {page.inner_text('#tile-ganzen .tile-name')!r}")
        page.click("#tile-ganzen")
        page.wait_for_timeout(200)
        players = "['kid', 'cpu', 'kid', 'cpu']" if owned else "['kid', 'kid']"
        page.evaluate(f"window.__bubbels.gans.choose({{ board: '{board}', players: {players}, count: true }})")
        page.wait_for_timeout(150)
        page.screenshot(path=str(SHOTS / f"ganzen-menu-{w}x{h}{'-full' if owned else ''}.png"), full_page=True)
        # every player button keeps its texts and its swap icon inside, without overlap
        bad = page.evaluate("""[...document.querySelectorAll('.ganzen-slot')].filter((b) => {
            const r = b.getBoundingClientRect();
            const swap = b.querySelector('.swap, .lock');
            const s = swap ? swap.getBoundingClientRect() : null;
            return [...b.querySelectorAll('.slot-name, .slot-kind > span')].some((t) => {
                const range = document.createRange();
                range.selectNodeContents(t);
                return [...range.getClientRects()].some((q) => q.right > r.right - 2 || (s && !b.classList.contains('locked') && q.right > s.left && q.left < s.right && q.top < s.bottom && q.bottom > s.top));
            }) || [...b.querySelectorAll('.slot-kind > span')].some((t) => t.getClientRects().length > 2); // "een kind" broken over 3+ lines
        }).map((b) => b.dataset.slot)""")
        if bad:
            problems.append(f"ganzen {label}: menu slots {bad} overflow or overlap the swap icon")
        page.evaluate("window.__bubbels.gans.fast(true)")
        page.evaluate("window.__bubbels.gans.rolls([[1, 2]])")
        page.click("#ganzen-play")
        page.wait_for_timeout(400)
        for sel in ("#ganzen-board", "#ganzen-die", "#ganzen-turn", "#ganzen-status", "#ganzen-back"):
            r = page.locator(sel).bounding_box()
            if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                problems.append(f"ganzen {label}: {sel} off screen ({r})")
        for sel in ("#ganzen-die", "#ganzen-back"):
            r = page.locator(sel).bounding_box()
            if r and min(r["width"], r["height"]) < 44:
                problems.append(f"ganzen {label}: {sel} only {r['width']:.0f}x{r['height']:.0f}")
        if page.evaluate("document.documentElement.scrollWidth") > w:
            problems.append(f"ganzen {label}: sideways scroll")
        cell = page.locator(".gsq >> nth=1").bounding_box()["width"]
        print(f"[ganzen {label}] square {cell:.0f} px")
        page.click("#ganzen-die")
        gans_wait(page, ("count",))
        st = gans_state(page)
        # a tap on the middle of the next stone is that stone, never the glowing one (it only wiggles)
        nb = page.locator(f".gsq[data-sq='{st['next'] + 1}']").bounding_box()
        page.mouse.click(nb["x"] + nb["width"] / 2, nb["y"] + nb["height"] / 2)
        page.wait_for_timeout(150)
        if gans_state(page)["next"] != st["next"]:
            problems.append(f"ganzen {label}: a tap on stone {st['next'] + 1} counted for {st['next']}")
        # a tap half a square away from the glowing square still counts
        box = page.locator(f".gsq[data-sq='{st['next']}']").bounding_box()
        page.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 1.0)
        page.wait_for_timeout(150)
        if gans_state(page)["next"] == st["next"]:
            problems.append(f"ganzen {label}: a near tap did not count")
        page.screenshot(path=str(SHOTS / f"ganzen-{w}x{h}{'-full' if owned else ''}.png"))
        if errors:
            problems.append(f"ganzen {label}: page errors {errors[:2]}")
        ctx.close()


# A stand-in for the app's store plugin for the offer tests: nothing is owned until a purchase, and
# `window.__storeNext` says what the next purchase does: 'cancel' (the child or parent backs out in
# the store's own sheet), 'error', 'pending' (paid later) or 'buy'. A restore finds nothing.
STORE_APP = """
window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {} };
(() => {
  let owned = false;
  const done = [];
  window.__storeNext = 'cancel';
  window.CdvPurchase = { LogLevel: {WARNING: 1}, Platform: {GOOGLE_PLAY: 'gp', APPLE_APPSTORE: 'as'},
    ProductType: {NON_CONSUMABLE: 'nc'}, ErrorCode: {PAYMENT_CANCELLED: 1},
    store: { verbosity: 0, register() {},
      when() { const o = { approved: () => o, finished: (fn) => (done.push(fn), o), receiptUpdated: () => o }; return o; },
      initialize: async () => [], owned: () => owned, get: () => ({ pricing: { price: '€ 1,00' }, getOffer: () => ({}) }),
      order: async () => {
        const next = window.__storeNext;
        if (next === 'cancel') return { code: 1 };
        if (next === 'error') return { code: 99 };
        if (next === 'buy') { owned = true; done.forEach((fn) => fn()); }
        return null;
      },
      restorePurchases: async () => null } };
})();
"""


# ---------- Pachisi ----------

def _pa_paths():
    """Every seat's path (positions 1-83) as (row, col), as in rules.js."""
    def turn(r, c, seat):
        for _ in range(seat):
            r, c = 18 - c, r
        return (r, c)
    p = [None] + [(r, 9) for r in range(11, 19)] + [(r, 10) for r in range(18, 10, -1)]
    for seat in (1, 2, 3):
        p += [turn(r, 8, seat) for r in range(11, 19)] + [turn(18, 9, seat)] + [turn(r, 10, seat) for r in range(18, 10, -1)]
    p += [(r, 8) for r in range(11, 19)] + [(18, 9)] + [(r, 9) for r in range(17, 10, -1)]
    return [[None] + [turn(*p[i], seat) for i in range(1, 84)] for seat in range(4)]


PA_PATHS = _pa_paths()
PA_HOME = 84


def pa_state(page):
    return page.evaluate("window.__bubbels.pachisi.state()")


def pa_wait(page, timeout=20000):
    """Until the game waits for a child (a throw, a count or a move) or is over."""
    page.wait_for_function(
        "(() => { const s = window.__bubbels.pachisi.state(); if (!s) return false; if (s.over) return true;"
        " const kid = s.setup.players[s.turn] === 'kid'; return kid && ['roll', 'count', 'move'].includes(s.phase); })()",
        timeout=timeout,
    )


def pa_hit(page, kind, frm=None, pawn=None):
    """A real tap where the thing is drawn: on the pawn (its picture, not a hit centre) or on the
    glowing target."""
    st = pa_state(page)
    if kind == "target":
        box = page.locator("#pachisi-board .pp-target").bounding_box()
        if not box:
            raise AssertionError(f"pachisi: no glowing target: {st['hits']}")
        page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        return
    k = st["turn"]
    if pawn is None:
        pawn = next((i for i, pos in enumerate(st["pawns"][k]) if pos == frm), None)
    if pawn is None:
        raise AssertionError(f"pachisi: no pawn on {frm}: {st['pawns'][k]}")
    box = page.locator(f"#pachisi-board .ppawn[data-player='{k}'][data-pawn='{pawn}']").bounding_box()
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] * 0.62)


def pa_count(page, problems=None, wrong=False):
    """Count yourself: tap every open shell (first a closed one, when `wrong`); in Ludo tap the die
    once per pip (a real tap where a pip not counted yet is drawn)."""
    st = pa_state(page)
    if st["mode"] == "ludo":
        for _ in range(st["pending"]["value"]):
            box = page.locator("#pachisi-tray .pdie-pip:not(.counted)").first.bounding_box()
            page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        return
    shells = st["pending"]["shells"]
    if wrong and not all(shells):
        page.click(f"#pachisi-tray .pshell[data-i='{shells.index(False)}']")
        page.wait_for_timeout(100)
        after = pa_state(page)
        if problems is not None and (after["counted"] or "dicht" not in after["msg"]):
            problems.append(f"pachisi: a closed shell counted or said nothing: {after['counted']}, {after['msg']!r}")
    for i, open_ in enumerate(shells):
        if open_:
            page.click(f"#pachisi-tray .pshell[data-i='{i}']")


def pa_pick(st):
    """A sensible child: a capture, else home, else (Ludo) a new pawn out, else the pawn furthest along."""
    moves = st["moves"]
    if st["mode"] == "ludo":
        return max(moves, key=lambda m: (bool(m["captures"]), m["to"] > 40 >= m["from"], m["from"] == 0, m["to"]))
    return max(moves, key=lambda m: (bool(m["captures"]), m["to"] >= PA_HOME, m["to"]))


def pa_play_move(page, m):
    """Tap the pawn (unless it is picked already), then the glowing square; wait for the next turn."""
    before = (None, pa_state(page)["history"])
    if pa_state(page)["sel"] != m["from"]:
        pa_hit(page, "pawn", m["from"])
        page.wait_for_timeout(60)
    pa_hit(page, "target")
    page.wait_for_function(f"(() => {{ const s = window.__bubbels.pachisi.state(); return (s.history !== {before[1]} && s.phase !== 'moving') || s.over; }})()", timeout=8000)


def pa_fits(page, w, h, label, problems):
    """The cloth, the chips, the shells, the line and the HUD buttons on screen; every target 44 px or more; no sideways scroll."""
    for sel in ("#pachisi-board", "#pachisi-turn", "#pachisi-tray", "#pachisi-status", "#pachisi-back", "#pachisi-undo"):
        r = page.locator(sel).bounding_box()
        if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
            problems.append(f"{label}: {sel} off screen ({r})")
    sizes = page.evaluate("[...document.querySelectorAll('#pachisi-back, #pachisi-undo, #pachisi-tray .pshell, #pachisi-tray .pdie, #pachisi-board .pp-hit')].map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.className, Math.min(r.width, r.height)]; })")
    for name, size in sizes:
        if size < 44:
            problems.append(f"{label}: {name} only {size:.0f} px")
    if page.evaluate("document.documentElement.scrollWidth") > w:
        problems.append(f"{label}: sideways scroll")
    return len(sizes)


def pachisi_flow(browser, base, problems):
    """Pachisi, the second mode of the Ludo tile, on the web build: picked in the menu by a tap; a
    3rd player and medium offer only OK; two children: the shells thrown by a tap, counted by taps (a closed shell does not
    count), a pawn tapped and its square glowing, a capture that sends the other pawn walking home,
    taken back and played again; against easy with 2 pawns, a whole game by real taps (count
    yourself) to the child's win, with a take-back, back + keep playing and the Android back
    button, the win counted."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion="reduce")
    page = ctx.new_page()
    errors, audio = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: "/voice/" in r.url and audio.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.click("#tile-pachisi")
    page.wait_for_timeout(250)
    page.click(".pachisi-opt.mode-pachisi")  # the second mode
    page.wait_for_timeout(150)
    if page.get_attribute(".pachisi-opt.mode-pachisi", "aria-pressed") != "true" or "India" not in page.inner_text(".pachisi-opt.mode-pachisi"):
        problems.append("pachisi: the Pachisi mode was not picked in the menu")
    for sel in (".pachisi-slot.slot-2", ".pachisi-slot.slot-3", ".pachisi-level[data-level='2']"):
        choose(page, sel)
        page.wait_for_timeout(200)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != ["Oké"]:
            problems.append(f"pachisi: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "pachisi-1-menu.png"), full_page=True)

    # two children: a capture by taps, taken back, made again
    choose(page, ".pachisi-slot.slot-1")  # the computer -> a child
    page.wait_for_timeout(100)
    if page.locator(".pachisi-level").count():
        problems.append("pachisi: the computer's levels show without a computer playing")
    page.evaluate("window.__bubbels.pachisi.fast(true)")
    page.click("#pachisi-play")
    page.wait_for_timeout(300)
    pa_fits(page, 390, 844, "pachisi 390x844 duo", problems)
    if "Zon mag gooien" not in page.inner_text("#pachisi-status"):
        problems.append(f"pachisi: the first line says {page.inner_text('#pachisi-status')!r}")
    cell = PA_PATHS[0][47]
    q = PA_PATHS[2].index(cell)
    page.evaluate(f"window.__bubbels.pachisi.setGame([[44, 0, 0, 0], [{q}, 0, 0, 0]], 0)")
    page.evaluate("window.__bubbels.pachisi.shells([[true, false, true, false, true, false], [true, false, true, false, true, false]])")
    page.click("#pachisi-tray")
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'count'", timeout=4000)
    page.screenshot(path=str(SHOTS / "pachisi-2-thrown.png"))
    pa_count(page, problems, wrong=True)
    pa_wait(page)
    st = pa_state(page)
    if st["phase"] != "move" or st["roll"]["steps"] != 3 or page.inner_text("#pachisi-result").strip() != "3":
        problems.append(f"pachisi: after counting three open shells: {st['phase']}, {st['roll']}, result {page.inner_text('#pachisi-result')!r}")
    if st["sel"] is not None:
        problems.append("pachisi: a pawn was picked while two could move")
    pa_hit(page, "pawn", 44)
    page.wait_for_timeout(100)
    st = pa_state(page)
    if st["sel"] != 44 or page.locator(".pp-target").count() != 1 or page.locator(".pp-dot").count() != 2:
        problems.append(f"pachisi: the picked pawn shows {page.locator('.pp-target').count()} targets and {page.locator('.pp-dot').count()} dots")
    page.screenshot(path=str(SHOTS / "pachisi-3-target.png"))
    pa_hit(page, "target")
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'roll'", timeout=6000)
    st = pa_state(page)
    if st["pawns"] != [[47, 0, 0, 0], [0, 0, 0, 0]] or st["turn"] != 1:
        problems.append(f"pachisi: the capture left {st['pawns']}, turn {st['turn']}")
    page.screenshot(path=str(SHOTS / "pachisi-4-captured.png"))
    if not st["canUndo"]:
        problems.append("pachisi: no take-back after a move together")
    page.click("#pachisi-undo")
    page.wait_for_timeout(150)
    st = pa_state(page)
    if st["pawns"] != [[44, 0, 0, 0], [q, 0, 0, 0]] or st["phase"] != "move" or st["roll"]["steps"] != 3:
        problems.append(f"pachisi: the take-back left {st['pawns']}, {st['phase']}, {st['roll']}")
    pa_play_move(page, {"from": 44})
    st = pa_state(page)
    if st["pawns"][1][0] != 0:
        problems.append(f"pachisi: the capture after the take-back left {st['pawns']}")
    # a pawn walks onto its own pawn: the glowing target wins over the pawn standing there
    page.evaluate("window.__bubbels.pachisi.setGame([[10, 13, 0, 0], [0, 0, 0, 0]], 0)")
    page.evaluate("window.__bubbels.pachisi.shells([[true, true, true, false, false, false]])")
    page.click("#pachisi-tray")
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'count'", timeout=4000)
    pa_count(page)
    pa_wait(page)
    pa_hit(page, "pawn", 10)
    page.wait_for_timeout(80)
    if pa_state(page)["sel"] != 10:
        problems.append(f"pachisi: a tap on the pawn on 10 picked {pa_state(page)['sel']}")
    pa_hit(page, "target")
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'roll'", timeout=6000)
    if pa_state(page)["pawns"][0][:2] != [13, 13]:
        problems.append(f"pachisi: the pawn on 10 did not walk onto its own pawn on 13: {pa_state(page)['pawns'][0]}")
    # two pawns on one square (8 on the way out, 76 on the way home): a tap on each picks that one
    page.evaluate("window.__bubbels.pachisi.setGame([[8, 76, 0, 0], [0, 0, 0, 0]], 0)")
    page.evaluate("window.__bubbels.pachisi.shells([[true, true, false, false, false, false]])")
    page.click("#pachisi-tray")
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'count'", timeout=4000)
    pa_count(page)
    pa_wait(page)
    for pawn, frm in ((1, 76), (0, 8), (1, 76)):
        pa_hit(page, "pawn", pawn=pawn)
        page.wait_for_timeout(80)
        if pa_state(page)["sel"] != frm:
            problems.append(f"pachisi: a tap on the drawn pawn {pawn} (on {frm}) picked {pa_state(page)['sel']}")
    page.screenshot(path=str(SHOTS / "pachisi-4b-shared-square.png"))
    pa_hit(page, "target")
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'roll'", timeout=6000)
    if pa_state(page)["pawns"][0][:2] != [8, 78]:
        problems.append(f"pachisi: the pawn on 76 did not walk on: {pa_state(page)['pawns'][0]}")
    if page.evaluate("(window.__bubbels.save().games.pachisi || {}).stars || {}"):
        problems.append("pachisi: a game together was counted")
    page.click("#pachisi-back")
    page.wait_for_timeout(200)

    # against easy with 2 pawns: whole games by real taps until the child wins
    choose(page, ".pachisi-slot.slot-1")  # a child -> the computer
    page.click(".pachisi-opt.pawns-2")
    page.click(".pachisi-opt.count-on")
    won = False
    for attempt, seed in enumerate((11, 12, 13, 14)):
        page.evaluate(f"window.__bubbels.pachisi.seed({seed})")
        page.click("#pachisi-play")
        page.wait_for_timeout(300)
        took_back = kept = False
        for turn in range(600):
            pa_wait(page)
            st = pa_state(page)
            if st["over"]:
                break
            if st["phase"] == "roll":
                page.click("#pachisi-tray")
                page.wait_for_function("['count', 'move', 'shown', 'roll', 'moving'].includes(window.__bubbels.pachisi.state().phase) && window.__bubbels.pachisi.state().phase !== 'rolling'", timeout=4000)
                continue
            if st["phase"] == "count":
                pa_count(page, problems, wrong=(turn == 0 and attempt == 0))
                continue
            m = pa_pick(st)
            if attempt == 0 and not took_back and st["history"] >= 3:
                pa_play_move(page, m)
                pa_wait(page)
                after = pa_state(page)
                if not after["over"] and after["canUndo"]:
                    page.click("#pachisi-undo")
                    page.wait_for_timeout(150)
                    back = pa_state(page)
                    if back["pawns"] != st["pawns"] or back["roll"] != st["roll"] or back["phase"] != "move":
                        problems.append(f"pachisi: the take-back against easy left {back['pawns']} (was {st['pawns']})")
                took_back = True
                continue
            if attempt == 0 and not kept and st["history"] >= 6:
                page.evaluate("window.__bubbels.back()")  # the Android back button
                page.wait_for_timeout(200)
                if not page.is_visible("#pachisi-continue"):
                    problems.append("pachisi: the back button did not lead to the menu with 'keep playing'")
                page.click("#pachisi-continue")
                page.wait_for_timeout(200)
                kept = True
                continue
            if attempt == 0 and st["history"] == 12:
                page.screenshot(path=str(SHOTS / "pachisi-5-vs-easy.png"))
            pa_play_move(page, m)
        st = pa_state(page)
        if not st["over"]:
            problems.append(f"pachisi: the game against easy did not end ({st['throws']} throws)")
            break
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
        if st["winner"] == 0:
            won = True
            page.screenshot(path=str(SHOTS / "pachisi-6-win.png"))
            if page.inner_text("#ov-title").strip() != "Jij wint!":
                problems.append(f"pachisi: the win card says {page.inner_text('#ov-title')!r}")
            stars = page.evaluate("(window.__bubbels.save().games.pachisi || {}).stars || {}")
            if stars.get("cpu-1") != 1 or stars.get("ludo-cpu-1"):
                problems.append(f"pachisi: the win was not counted (as Pachisi's): {stars}")
            page.click("#ov-buttons button >> text=Menu")
            break
        print(f"[pachisi] easy game {attempt + 1} (seed {seed}): the computer won after {st['throws']} throws")
        page.click("#ov-buttons button >> text=Menu")
        page.wait_for_timeout(200)
    if not won:
        problems.append("pachisi: four games by a sensible child never beat easy")
    page.wait_for_timeout(200)
    if "1 keer gewonnen" not in page.inner_text(".pachisi-level[data-level='1']"):
        problems.append("pachisi: the menu does not show the win on Easy")
    if audio:
        problems.append(f"pachisi: a voice clip was loaded: {audio[:1]}")
    if errors:
        problems.append(f"pachisi: page errors {errors[:3]}")
    ctx.close()


def pachisi_back_mid_walk(browser, base, problems, mode="pachisi"):
    """With animations on (Pachisi; Ludo in ludo_back_mid_walk): back while the winning pawn is still
    walking home ends the game with its card (still a win), and two computers play a whole short
    game to the end without errors."""
    ludo = mode == "ludo"
    pre = "ludo" if ludo else "pachisi"
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.click("#tile-pachisi")
    page.wait_for_timeout(200)
    page.evaluate(f"window.__bubbels.pachisi.choose({{ mode: '{mode}', players: ['kid', 'kid'], pawns: 2, count: false }})")
    page.click("#pachisi-play")
    page.wait_for_timeout(300)
    if ludo:
        page.evaluate("window.__bubbels.pachisi.setGame([[44, 38], [10, 0]], 0)")
        page.evaluate("window.__bubbels.pachisi.dice([5])")
    else:
        page.evaluate("window.__bubbels.pachisi.setGame([[84, 80], [10, 0]], 0)")
        page.evaluate("window.__bubbels.pachisi.shells([[true, true, true, true, true, false]])")
    page.click("#pachisi-tray")
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'move'", timeout=8000)
    pa_hit(page, "target")  # one pawn can move: it is picked already
    page.wait_for_timeout(250)
    page.evaluate("window.__bubbels.back()")  # the Android back button, halfway the walk
    page.wait_for_timeout(300)
    st = pa_state(page)
    if not st["over"] or st["winner"] != 0:
        problems.append(f"{pre} back mid-walk: the winning move did not count ({st['over']}, {st['pawns']})")
    if not page.is_visible("#overlay") or page.inner_text("#ov-title").strip() != "Zon wint!":
        problems.append(f"{pre} back mid-walk: no win card")
    page.screenshot(path=str(SHOTS / f"{pre}-7-back-mid-walk.png"))
    page.click("#ov-buttons button >> text=Menu")
    page.wait_for_timeout(200)
    if page.is_visible("#pachisi-continue"):
        problems.append(f"{pre} back mid-walk: 'keep playing' behind a finished game")
    # two computers, 2 pawns, animations on (a little faster): a whole game
    page.evaluate(f"window.__bubbels.pachisi.choose({{ mode: '{mode}', players: ['cpu', 'cpu'], pawns: 2, count: true }}); window.__bubbels.pachisi.fast(true); window.__bubbels.pachisi.seed(3)")
    page.click("#pachisi-play")
    page.wait_for_function("window.__bubbels.pachisi.state().over", timeout=240000)
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    if errors:
        problems.append(f"{pre} back mid-walk: page errors {errors[:2]}")
    ctx.close()


def pachisi_layouts(browser, base, problems, mode="pachisi"):
    """Ludo (mode "ludo", ludo_layouts) and Pachisi at 320x568, 568x320, 390x844 in English, 844x390
    and desktop, and four players with medium in the full version: the board, the chips, the die or
    the shells and the line on screen, every tap area 44 px or more, a pawn picked by a real tap and
    its square glowing."""
    ludo = mode == "ludo"
    pre = "ludo" if ludo else "pachisi"
    sizes = ((320, 568, False), (568, 320, False), (390, 844, False), (844, 390, False), (1280, 800, False), (390, 844, True))
    if not ludo:
        # Pachisi's board and geometry are unchanged since PR #73: its smallest sizes and the full version keep it honest
        sizes = ((320, 568, False), (568, 320, False), (390, 844, True))
    for w, h, owned in sizes:
        mobile = w < 1000
        english = (w, h) == (390, 844) and not owned
        ctx = browser.new_context(bypass_csp=True, locale="en-GB" if english else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile, reduced_motion="reduce")
        if owned:
            ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        if owned:
            page.wait_for_function("window.__bubbels.full()", timeout=8000)
        label = f"{pre} {w}x{h}{' full' if owned else ''}{' en' if english else ''}"
        if english and (page.inner_text("#tile-pachisi .tile-name").strip(), page.inner_text("#tile-pachisi .tile-sub").strip()) != ("Ludo", "with one die"):
            problems.append(f"{label}: English tile says {page.inner_text('#tile-pachisi').strip()!r}")
        page.click("#tile-pachisi")
        page.wait_for_timeout(200)
        players = "['kid', 'cpu', 'cpu', 'kid']" if owned else "['kid', 'cpu']"
        page.evaluate(f"window.__bubbels.pachisi.choose({{ mode: '{mode}', players: {players}, level: {2 if owned else 1}, pawns: 4, count: true }}); window.__bubbels.pachisi.fast(true)")
        page.wait_for_timeout(100)
        page.screenshot(path=str(SHOTS / f"{pre}-menu-{w}x{h}{'-full' if owned else ''}.png"), full_page=True)
        page.click("#pachisi-play")
        page.wait_for_timeout(300)
        if ludo:
            pawns = "[[0, 5, 30, 44], [0, 12, 38, 0], [3, 0, 0, 0], [0, 0, 20, 0]]" if owned else "[[0, 5, 30, 44], [0, 12, 40, 0]]"
        else:
            pawns = "[[0, 5, 30, 84], [0, 12, 40, 0], [3, 3, 0, 0], [0, 0, 60, 70]]" if owned else "[[0, 5, 30, 84], [0, 12, 40, 0]]"
        page.evaluate(f"window.__bubbels.pachisi.setGame({pawns}, 0)")
        if ludo:
            page.evaluate("window.__bubbels.pachisi.dice([3])")
        else:
            page.evaluate("window.__bubbels.pachisi.shells([[true, true, false, true, false, false]])")
        page.click("#pachisi-tray")
        page.wait_for_function("window.__bubbels.pachisi.state().phase === 'count'", timeout=4000)
        pa_count(page)
        pa_wait(page)
        pa_hit(page, "pawn", 5)
        page.wait_for_timeout(150)
        n = pa_fits(page, w, h, label, problems)
        st = pa_state(page)
        if st["mode"] != mode or st["sel"] != 5 or not any(x["kind"] == "target" for x in st["hits"]):
            problems.append(f"{label}: the tapped pawn was not picked ({st['mode']}, {st['sel']})")
        print(f"[{label}] square {page.evaluate('window.__bubbels.pachisi.cell()')} px, {n} targets checked")
        page.screenshot(path=str(SHOTS / f"{pre}-{w}x{h}{'-full' if owned else ''}.png"))
        if errors:
            problems.append(f"{label}: page errors {errors[:2]}")
        ctx.close()


# ---------- Ludo (the tile; the game's id is still pachisi) ----------

def lu_other(pos):
    """The position of seat 2 (player 1 in a 2-player game) on the square seat 0 reaches at `pos`."""
    return (pos - 1 - 20) % 40 + 1


def lu_throw(page, value, count=True):
    """A real tap on the die with `value` coming, then (count yourself) a tap per pip."""
    page.evaluate(f"window.__bubbels.pachisi.dice([{value}])")
    page.click("#pachisi-tray")
    if count:
        page.wait_for_function("window.__bubbels.pachisi.state().phase === 'count'", timeout=4000)
        pa_count(page)


def ludo_flow(browser, base, problems):
    """Ludo on the web build: the tile with its subtitle in Bordspellen, Ludo picked by default, a
    3rd player and medium offer only OK; two children: three tries for a 6 (two misses keep the
    turn), a 6 counted by tapping the die's pips brings a pawn out by real taps and throws again,
    a pawn tapped and its square glowing with dots on the way, a capture by real taps (the other
    pawn walks back to its yard), taken back and made again, a kind word when a pawn would land on
    its own, not counted; against easy with 2 pawns whole seeded games by real taps with "count
    yourself" to the child's win, with a take-back, back + keep playing and the Android back button,
    the win counted as Ludo's."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion="reduce")
    page = ctx.new_page()
    errors, audio = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: "/voice/" in r.url and audio.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    name = page.inner_text("#tile-pachisi .tile-name").strip()
    sub = page.inner_text("#tile-pachisi .tile-sub").strip()
    if name != "Ludo" or sub != "met één dobbelsteen":
        problems.append(f"ludo: tile says {name!r} / {sub!r}")
    if not page.evaluate("document.querySelector('#tile-pachisi').closest('.tile-group')?.contains(document.querySelector('#tile-ganzen'))"):
        problems.append("ludo: the tile is not in the section with Ganzenbord")
    page.locator("#tile-pachisi").evaluate("e => e.closest('.tile-group').scrollIntoView()")
    page.screenshot(path=str(SHOTS / "ludo-0-tile.png"))
    page.click("#tile-pachisi")
    page.wait_for_timeout(250)
    if page.get_attribute(".pachisi-opt.mode-ludo", "aria-pressed") != "true":
        problems.append("ludo: Ludo is not the mode picked by default")
    for sel in (".pachisi-slot.slot-2", ".pachisi-slot.slot-3", ".pachisi-level[data-level='2']"):
        choose(page, sel)
        page.wait_for_timeout(200)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != ["Oké"]:
            problems.append(f"ludo: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "ludo-1-menu.png"), full_page=True)

    # two children
    choose(page, ".pachisi-slot.slot-1")  # the computer -> a child
    page.wait_for_timeout(100)
    page.evaluate("window.__bubbels.pachisi.fast(true)")
    page.click("#pachisi-play")
    page.wait_for_timeout(300)
    pa_fits(page, 390, 844, "ludo 390x844 duo", problems)
    if "Zon mag gooien" not in page.inner_text("#pachisi-status") or pa_state(page)["mode"] != "ludo":
        problems.append(f"ludo: the first line says {page.inner_text('#pachisi-status')!r}")
    # everything in the yard: a 2 and a 4 cannot be used, the same child throws again (three tries)
    for value, left in ((2, 2), (4, 1)):
        lu_throw(page, value)
        pa_wait(page)
        st = pa_state(page)
        if st["turn"] != 0 or st["phase"] != "roll" or st["pawns"][0] != [0, 0, 0, 0]:
            problems.append(f"ludo: try with a {value}: turn {st['turn']}, {st['phase']}")
    # the third try: a 6, counted by tapping its six pips; the pawn comes out by real taps
    lu_throw(page, 6, count=False)
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'count'", timeout=4000)
    page.screenshot(path=str(SHOTS / "ludo-2-die.png"))
    if page.locator("#pachisi-tray .pdie-pip.can").count() != 6:
        problems.append(f"ludo: the die shows {page.locator('#pachisi-tray .pdie-pip').count()} pips to count")
    pa_count(page)
    pa_wait(page)
    st = pa_state(page)
    if st["phase"] != "move" or st["roll"]["value"] != 6 or page.inner_text("#pachisi-result").strip() != "6" or st["sel"] != 0:
        problems.append(f"ludo: after counting six pips: {st['phase']}, {st['roll']}, picked {st['sel']}")
    pa_hit(page, "pawn", 0)  # tapping a yard pawn keeps it picked
    pa_hit(page, "target")
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'roll'", timeout=6000)
    st = pa_state(page)
    if sorted(st["pawns"][0]) != [0, 0, 0, 1] or st["turn"] != 0:
        problems.append(f"ludo: the 6 did not bring a pawn out with another throw: {st['pawns']}, turn {st['turn']}")
    lu_throw(page, 4)
    pa_wait(page)
    pa_hit(page, "target")  # one pawn can move: picked already
    page.wait_for_function("window.__bubbels.pachisi.state().turn === 1 && window.__bubbels.pachisi.state().phase === 'roll'", timeout=6000)
    if sorted(pa_state(page)["pawns"][0]) != [0, 0, 0, 5]:
        problems.append(f"ludo: the pawn did not walk 4: {pa_state(page)['pawns'][0]}")

    # a capture by real taps: two pawns can move, the child picks the one on 20
    q = lu_other(23)
    page.evaluate(f"window.__bubbels.pachisi.setGame([[20, 10, 0, 0], [{q}, 0, 0, 0]], 0)")
    lu_throw(page, 3)
    pa_wait(page)
    st = pa_state(page)
    if st["phase"] != "move" or st["sel"] is not None:
        problems.append(f"ludo: two pawns could move but {st['sel']} was picked")
    pa_hit(page, "pawn", 20)
    page.wait_for_timeout(100)
    st = pa_state(page)
    if st["sel"] != 20 or page.locator(".pp-target").count() != 1 or page.locator(".pp-dot").count() != 2:
        problems.append(f"ludo: the picked pawn shows {page.locator('.pp-target').count()} targets and {page.locator('.pp-dot').count()} dots")
    page.screenshot(path=str(SHOTS / "ludo-3-target.png"))
    pa_hit(page, "target")
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'roll'", timeout=6000)
    st = pa_state(page)
    if st["pawns"] != [[23, 10, 0, 0], [0, 0, 0, 0]] or st["turn"] != 1:
        problems.append(f"ludo: the capture left {st['pawns']}, turn {st['turn']}")
    page.screenshot(path=str(SHOTS / "ludo-4-captured.png"))
    if not st["canUndo"]:
        problems.append("ludo: no take-back after a move together")
    page.click("#pachisi-undo")
    page.wait_for_timeout(150)
    st = pa_state(page)
    if st["pawns"] != [[20, 10, 0, 0], [q, 0, 0, 0]] or st["phase"] != "move" or st["roll"]["value"] != 3:
        problems.append(f"ludo: the take-back left {st['pawns']}, {st['phase']}, {st['roll']}")
    pa_play_move(page, {"from": 20})
    if pa_state(page)["pawns"][1][0] != 0:
        problems.append(f"ludo: the capture after the take-back left {pa_state(page)['pawns']}")
    # a pawn that would land on its own pawn does not glow; a tap on it says why
    page.evaluate("window.__bubbels.pachisi.setGame([[10, 12, 0, 0], [0, 0, 0, 0]], 0)")
    lu_throw(page, 2)
    pa_wait(page)
    st = pa_state(page)
    if [m["from"] for m in st["moves"]] != [12]:
        problems.append(f"ludo: with a 2 the pawn on 10 may move onto its own pawn: {st['moves']}")
    box = page.locator("#pachisi-board .ppawn[data-player='0'][data-pawn='0']").bounding_box()
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] * 0.62)
    page.wait_for_timeout(100)
    if "al een pion van jou" not in pa_state(page)["msg"]:
        problems.append(f"ludo: a tap on the blocked pawn says {pa_state(page)['msg']!r}")
    pa_hit(page, "target")
    page.wait_for_function("window.__bubbels.pachisi.state().phase === 'roll'", timeout=6000)
    if pa_state(page)["pawns"][0][:2] != [10, 14]:
        problems.append(f"ludo: the pawn on 12 did not walk: {pa_state(page)['pawns'][0]}")
    if page.evaluate("(window.__bubbels.save().games.pachisi || {}).stars || {}"):
        problems.append("ludo: a game together was counted")
    page.click("#pachisi-back")
    page.wait_for_timeout(200)

    # against easy with 2 pawns: whole games by real taps until the child wins
    choose(page, ".pachisi-slot.slot-1")  # a child -> the computer
    page.click(".pachisi-opt.pawns-2")
    page.click(".pachisi-opt.count-on")
    won = False
    for attempt, seed in enumerate((21, 22, 23, 24, 25)):
        page.evaluate(f"window.__bubbels.pachisi.seed({seed})")
        page.click("#pachisi-play")
        page.wait_for_timeout(300)
        took_back = kept = False
        for turn in range(900):
            pa_wait(page)
            st = pa_state(page)
            if st["over"]:
                break
            if st["phase"] == "roll":
                page.click("#pachisi-tray")
                page.wait_for_function("['count', 'move', 'shown', 'roll', 'moving'].includes(window.__bubbels.pachisi.state().phase) && window.__bubbels.pachisi.state().phase !== 'rolling'", timeout=4000)
                continue
            if st["phase"] == "count":
                pa_count(page)
                continue
            m = pa_pick(st)
            if attempt == 0 and not took_back and st["history"] >= 3:
                pa_play_move(page, m)
                pa_wait(page)
                after = pa_state(page)
                if not after["over"] and after["canUndo"]:
                    page.click("#pachisi-undo")
                    page.wait_for_timeout(150)
                    back = pa_state(page)
                    if back["pawns"] != st["pawns"] or back["roll"] != st["roll"] or back["phase"] != "move":
                        problems.append(f"ludo: the take-back against easy left {back['pawns']} (was {st['pawns']})")
                took_back = True
                continue
            if attempt == 0 and not kept and st["history"] >= 6:
                page.evaluate("window.__bubbels.back()")  # the Android back button
                page.wait_for_timeout(200)
                if not page.is_visible("#pachisi-continue"):
                    problems.append("ludo: the back button did not lead to the menu with 'keep playing'")
                page.click("#pachisi-continue")
                page.wait_for_timeout(200)
                kept = True
                continue
            if attempt == 0 and st["history"] == 10:
                page.screenshot(path=str(SHOTS / "ludo-5-vs-easy.png"))
            pa_play_move(page, m)
        st = pa_state(page)
        if not st["over"]:
            problems.append(f"ludo: the game against easy did not end ({st['throws']} throws)")
            break
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
        if st["winner"] == 0:
            won = True
            page.screenshot(path=str(SHOTS / "ludo-6-win.png"))
            if page.inner_text("#ov-title").strip() != "Jij wint!":
                problems.append(f"ludo: the win card says {page.inner_text('#ov-title')!r}")
            stars = page.evaluate("(window.__bubbels.save().games.pachisi || {}).stars || {}")
            if stars.get("ludo-cpu-1") != 1 or stars.get("cpu-1"):
                problems.append(f"ludo: the win was not counted as Ludo's: {stars}")
            page.click("#ov-buttons button >> text=Menu")
            break
        print(f"[ludo] easy game {attempt + 1} (seed {seed}): the computer won after {st['throws']} throws")
        page.click("#ov-buttons button >> text=Menu")
        page.wait_for_timeout(200)
    if not won:
        problems.append("ludo: five games by a sensible child never beat easy")
    page.wait_for_timeout(200)
    if "1 keer gewonnen" not in page.inner_text(".pachisi-level[data-level='1']"):
        problems.append("ludo: the menu does not show the win on Easy")
    if audio:
        problems.append(f"ludo: a voice clip was loaded: {audio[:1]}")
    if errors:
        problems.append(f"ludo: page errors {errors[:3]}")
    ctx.close()


def ludo_back_mid_walk(browser, base, problems):
    pachisi_back_mid_walk(browser, base, problems, mode="ludo")


def ludo_layouts(browser, base, problems):
    pachisi_layouts(browser, base, problems, mode="ludo")


def where(page):
    """[the screen being shown, is a card open]"""
    return page.evaluate("[document.querySelector('.screen.active').id.replace('screen-', ''), !document.querySelector('#overlay').hidden]")


def card_buttons(page):
    return page.locator("#ov-buttons button").all_inner_texts() if where(page)[1] else []


def landed(page, label, want, problems):
    """After the offer: on screen `want`, with no card left open."""
    try:
        page.wait_for_selector("#overlay", state="hidden", timeout=4000)
    except Exception:
        pass
    got = where(page)
    if got != [want, False]:
        problems.append(f"offers: {label}: landed on {got[0]} (card open: {got[1]}), expected the {want} screen")
        page.screenshot(path=str(SHOTS / f"offers-{re.sub(r'[^a-z0-9]+', '-', label.lower())}.png"))
        return False
    return True


def web_offer_ok(page, label, want, problems):
    """On a win card at the end of a free part: its first button is the offer; on the web that card
    has only OK; after OK the player is on the `want` list with no card."""
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=8000)
    page.click("#ov-buttons button >> nth=0")
    page.wait_for_timeout(150)
    labels = card_buttons(page)
    if labels != ["Oké"]:
        problems.append(f"offers: {label}: the offer after the last free one is {labels}, not the web card")
    page.click("#ov-buttons button >> nth=0")
    return landed(page, label, want, problems)


def offer_context(browser, base, app=False, save=None):
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844},
                              device_scale_factor=2, is_mobile=True, has_touch=True)
    if app:
        ctx.add_init_script(STORE_APP)
    if save:
        ctx.add_init_script(seeded(save))
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    return ctx, page, errors


# Levels 1-9 won before, so level 10 is the last one of the free part, as for Mark on 15 Nov 2026
BUBBELS_NINE = {"version": 1, "games": {"bubbels": {"stars": {str(i): 2 for i in range(1, 10)}}}, "settings": {"muted": True, "lang": "nl"}}


def bubbels_level10_won(page, label, problems):
    """Play level 10 and end it for real on the game screen (every bubble popped, the normal win
    path with its short wait), then wait for the win card. True when its first button is the offer."""
    page.evaluate("window.__bubbels.play(9)")
    page.wait_for_function("window.__bubbels.state().phase === 'aim'", timeout=4000)
    if where(page)[0] != "game" or page.inner_text("#hud-level") != "Level 10":
        problems.append(f"offers: bubbels {label}: level 10 did not start ({where(page)}, {page.inner_text('#hud-level')!r})")
    page.evaluate("window.__bubbels.clear()")
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=6000)
    labels = card_buttons(page)
    if not labels or labels[0] != "Meer levels":
        problems.append(f"offers: bubbels {label}: the level 10 win card offers {labels}")
        return False
    return True


def bubbels_list(page, label, problems, owned=False):
    """The level list after the offer: level 10 won with 3 stars, the save kept, and level 11 locked
    (or, once bought, open and the next one to play); the board's loop has stopped."""
    stars = (page.evaluate("window.__bubbels.save()").get("games", {}).get("bubbels") or {}).get("stars", {})
    if stars.get("10") != 3 or any(stars.get(str(i)) != 2 for i in range(1, 10)):
        problems.append(f"offers: bubbels {label}: save after level 10 is {stars}")
    ten = page.locator("#levels-free .level-cell >> nth=9").get_attribute("aria-label") or ""
    if "10" not in ten or "3 van 3" not in ten:
        problems.append(f"offers: bubbels {label}: level 10 on the list reads {ten!r}")
    full = page.locator("#screen-levels .full-fold .level-cell").count()
    nxt = page.locator("#levels-free .level-cell.next .num").all_inner_texts()
    if owned and (full or nxt != ["11"]):
        problems.append(f"offers: bubbels {label}: after the purchase {full} levels still locked, next {nxt}")
    if not owned and ((page.locator("#screen-levels .full-fold .level-cell >> nth=0").text_content() or "").split()[:1] != ["11"] or nxt):
        problems.append(f"offers: bubbels {label}: level 11 is not the first locked one (next: {nxt})")
    if page.evaluate("window.__bubbels.state().loop"):
        problems.append(f"offers: bubbels {label}: the game loop still runs on the level list")
    if owned:
        # bought on this very screen: the fold is gone and what it emptied is back (the random
        # boards and their heading), and "Willekeurig" scrolls to them
        left = page.evaluate("[document.querySelectorAll('#screen-levels .full-fold').length, document.querySelectorAll('#screen-levels .fold-emptied').length]")
        if left != [0, 0]:
            problems.append(f"offers: bubbels {label}: after the purchase fold/emptied parts {left}")
        if not page.is_visible("#levels-random-head") or page.locator("#levels-random .random-btn:not(.locked):visible").count() != 3:
            problems.append(f"offers: bubbels {label}: after the purchase the random boards or their heading are not shown")
        page.click("#btn-random-jump")
        page.wait_for_timeout(700)
        top = page.evaluate("document.querySelector('#levels-random-head').getBoundingClientRect().top")
        if not (0 <= top < 844):
            problems.append(f"offers: bubbels {label}: Willekeurig did not scroll to the random boards (heading at {top:.0f})")


def offers_bubbels(browser, base, problems):
    """Mark's report (15 Nov 2026): after the offer at the end of level 10 the player was left on the
    finished board, where even the pause button did nothing. Every way the offer can end must land
    on the level list with level 10 done and level 11 locked (or open, once bought)."""
    t0 = time.time()
    # the website: the offer only has OK
    ctx, page, errors = offer_context(browser, base, save=BUBBELS_NINE)
    page.click("#tile-bubbels")
    if bubbels_level10_won(page, "web", problems):
        page.screenshot(path=str(SHOTS / "offers-bubbels-1-win.png"))
        if web_offer_ok(page, "bubbels web OK", "levels", problems):
            page.screenshot(path=str(SHOTS / "offers-bubbels-2-list.png"))
            bubbels_list(page, "web", problems)
    # a finished board whose card is gone some other way: the pause button leads to the list
    page.evaluate("window.__bubbels.play(9)")
    page.wait_for_function("window.__bubbels.state().phase === 'aim'", timeout=4000)
    page.evaluate("window.__bubbels.clear()")
    page.wait_for_selector("#overlay:not([hidden])", timeout=6000)
    page.evaluate("document.querySelector('#overlay').hidden = true")
    page.click("#btn-pause")
    landed(page, "bubbels pause on a finished board", "levels", problems)
    if errors:
        problems.append(f"offers: bubbels web: page errors {errors[:2]}")
    ctx.close()

    # the app: every way out of the offer card (buttons: buy, restore, later)
    ctx, page, errors = offer_context(browser, base, app=True, save=BUBBELS_NINE)
    # Dogudoku seen once before the purchase, with its fold (checked again once bought, below)
    page.click("#tile-dogudoku")
    page.wait_for_timeout(250)
    if not page.locator("#dogu-levels .full-fold").count():
        problems.append("offers: dogudoku app: no Volledige versie fold before the purchase")
    page.evaluate("document.querySelector('#screen-dogudoku-levels [data-go=home]').click()")
    page.wait_for_timeout(150)
    page.click("#tile-bubbels")

    def to_offer(label):
        if not bubbels_level10_won(page, label, problems):
            return False
        page.click("#ov-buttons button >> nth=0")
        page.wait_for_timeout(150)
        labels = card_buttons(page)
        if len(labels) != 3:
            problems.append(f"offers: bubbels app {label}: the offer card shows {labels}")
            return False
        return True

    def gate_pass():
        # by the gate's OK button: an Enter key would also press the button of the card that the
        # quick stand-in store puts up before the key is let go
        page.wait_for_selector(".gate-input")
        m = re.search(TEXT["nl"]["ask"], page.inner_text("#ov-text"))
        page.fill(".gate-input", str(WORDS["nl"].index(m.group(1)) * WORDS["nl"].index(m.group(2))))
        page.click("#ov-buttons button >> nth=0")

    def gate_wrong_until_closed():
        for _ in range(3):
            page.wait_for_selector(".gate-input")
            page.fill(".gate-input", "999")
            page.click("#ov-buttons button >> nth=0")
            page.wait_for_timeout(80)

    steps = [
        ("later", lambda: page.click("#ov-buttons button >> nth=2")),
        ("gate cancelled", lambda: (page.click("#ov-buttons button >> nth=0"), page.wait_for_selector(".gate-input"), page.click("#ov-buttons button >> nth=1"))),
        ("gate failed", lambda: (page.click("#ov-buttons button >> nth=0"), gate_wrong_until_closed())),
        ("purchase cancelled", lambda: (page.evaluate("window.__storeNext = 'cancel'"), page.click("#ov-buttons button >> nth=0"), gate_pass())),
        ("store error", lambda: (page.evaluate("window.__storeNext = 'error'"), page.click("#ov-buttons button >> nth=0"), gate_pass(),
                                 page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button"), page.click("#ov-buttons button >> nth=0"))),
        ("purchase pending", lambda: (page.evaluate("window.__storeNext = 'pending'"), page.click("#ov-buttons button >> nth=0"), gate_pass(),
                                      page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button"), page.click("#ov-buttons button >> nth=0"))),
        ("restore finds nothing", lambda: (page.click("#ov-buttons button >> nth=1"), gate_pass(),
                                           page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button"), page.click("#ov-buttons button >> nth=0"))),
    ]
    for label, act in steps:
        if not to_offer(label):
            continue
        act()
        if landed(page, f"bubbels app {label}", "levels", problems):
            bubbels_list(page, f"app {label}", problems)
    # bought: the "unlocked" card, then the list with level 11 open and next
    if to_offer("bought"):
        page.evaluate("window.__storeNext = 'buy'")
        page.click("#ov-buttons button >> nth=0")
        gate_pass()
        page.wait_for_function("!!window.__bubbels.full()", timeout=4000)
        page.wait_for_timeout(150)
        page.click("#ov-buttons button >> nth=0")
        if landed(page, "bubbels app bought", "levels", problems):
            page.screenshot(path=str(SHOTS / "offers-bubbels-3-bought.png"))
            bubbels_list(page, "app bought", problems, owned=True)
        # Dogudoku after the purchase in the same session: no fold, every size back with its puzzles
        page.evaluate("document.querySelector('#screen-levels [data-go=home]').click()")
        page.wait_for_timeout(150)
        page.click("#tile-dogudoku")
        page.wait_for_timeout(250)
        got = page.evaluate("""[document.querySelectorAll('#dogu-levels .full-fold, #dogu-levels .fold-emptied, #dogu-levels .locked').length,
            [...document.querySelectorAll('#dogu-levels .menu-head')].filter((h) => h.getClientRects().length).length,
            [...document.querySelectorAll('#dogu-levels .level-cell:not(.random-btn)')].filter((b) => b.getClientRects().length).length]""")
        if got[0] or got[1] != 5 or got[2] != 60:
            problems.append(f"offers: dogudoku app bought: [fold/emptied/locked, sizes shown, puzzles shown] = {got}, want [0, 5, 60]")
    if errors:
        problems.append(f"offers: bubbels app: page errors {errors[:2]}")
    ctx.close()
    print(f"[offers] bubbels: {time.time() - t0:.1f}s")


def offers_others(browser, base, problems):
    """The same at the end of the free part of every other game with a win card (the offer over the
    list, so OK lands there with the save kept), and for the games whose locked parts sit in a
    menu: OK leaves the player on that menu."""
    t0 = time.time()
    ctx, page, errors = offer_context(browser, base)

    def reload_home():  # the save stays; a fresh page is the shortest way home from any screen
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
    # Dogudoku and Picturedoku: puzzle 4 is the last free 4×4, solved by taps
    page.click("#tile-dogudoku")
    choose(page, "#dogu-levels .level-cell[data-puzzle='4']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    pz = page.evaluate("window.__bubbels.dogu.puzzle()")
    for r, c in enumerate(pz["solution"]):
        page.click(f"#dogu-board .dcell[data-r='{r}'][data-c='{c}']")
    if web_offer_ok(page, "dogudoku puzzle 4", "dogudoku-levels", problems):
        stars = page.evaluate("window.__bubbels.save().games.dogudoku.stars")
        locked = "locked" in (page.get_attribute("#dogu-levels .level-cell[data-puzzle='5']", "class") or "")
        if stars.get("4") != 3 or not locked:
            problems.append(f"offers: dogudoku: after puzzle 4 the save is {stars}, puzzle 5 locked: {locked}")
    reload_home()

    page.click("#tile-picturedoku")
    choose(page, "#pdoku-levels .level-cell[data-puzzle='4']")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    pz = page.evaluate("window.__bubbels.pdoku.puzzle()")
    for i, ch in enumerate(pz["givens"]):
        if ch == ".":
            page.click(f"#pdoku-board .pcell[data-i='{i}']")
            page.click(f"#pdoku-palette .pick[data-v='{pz['solution'][i]}']")
    if web_offer_ok(page, "picturedoku puzzle 4", "picturedoku-levels", problems):
        stars = page.evaluate("window.__bubbels.save().games.picturedoku.stars")
        locked = "locked" in (page.get_attribute("#pdoku-levels .level-cell[data-puzzle='5']", "class") or "")
        if stars.get("4") != 3 or not locked:
            problems.append(f"offers: picturedoku: after puzzle 4 the save is {stars}, puzzle 5 locked: {locked}")
    reload_home()

    # Slangetje: counting level 4 is the last free one of its kind
    page.click("#tile-slang")
    choose(page, ".slang-grid .level-cell[data-level='4']")
    close_card_if_any(page)
    slang_round(page, "offers", problems)
    if web_offer_ok(page, "slang level 4", "slang-menu", problems):
        stars = page.evaluate("window.__bubbels.save().games.slang.stars")
        if not stars.get("4"):
            problems.append(f"offers: slang: level 4 not saved ({stars})")
    reload_home()

    # Klok kijken: read-t2-3 is the last free "what time is it" round
    page.click("#tile-klok")
    page.evaluate("window.__bubbels.klok.start('read-t2-3')")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    for i in range(10):
        klok_answer(page)
        klok_next(page, i)
    if web_offer_ok(page, "klok read-t2-3", "klok-menu", problems):
        if page.evaluate("window.__bubbels.klok.stars()").get("read-t2-3") != 3:
            problems.append(f"offers: klok: read-t2-3 not saved ({page.evaluate('window.__bubbels.klok.stars()')})")
    reload_home()

    # Letters: tap-t1-3 is the last free round of its kind
    page.click("#tile-letters")
    page.evaluate("window.__bubbels.letters.start('tap-t1-3')")
    page.wait_for_timeout(300)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
    for _ in range(12):
        st = page.evaluate("window.__bubbels.letters.state()")
        if st["done"]:
            break
        page.locator(f"#letters-options .letters-tile[data-letter='{st['q']['letter']}']").click()
        page.wait_for_function(f"window.__bubbels.letters.state().i > {st['i']} || window.__bubbels.letters.state().done", timeout=5000)
    if web_offer_ok(page, "letters tap-t1-3", "letters-menu", problems):
        if page.evaluate("window.__bubbels.letters.stars()").get("tap-t1-3") != 3:
            problems.append(f"offers: letters: tap-t1-3 not saved ({page.evaluate('window.__bubbels.letters.stars()')})")
    reload_home()

    # locked parts in a menu: OK leaves the player where they were
    for tile, sel, screen in (("vier", ".seg-card[data-level='3']", "vier-menu"),
                              ("dammen", "#dammen-menu .option-card.board-big", "dammen-menu"),
                              ("baghchal", ".bagh-level[data-level='2']", "baghchal-menu"),
                              ("schaak", ".schaak-level[data-level='3']", "schaak-menu"),
                              ("ganzen", ".ganzen-boardopt.board-winter", "ganzen-menu"),
                              ("pachisi", ".pachisi-level[data-level='2']", "pachisi-menu"),
                              ("kleuren", "#kleur-list .kleur-card.locked >> nth=0", "kleuren-list"),
                              ("tekenen", "#teken-mirror", "tekenen")):
        page.click(f"#tile-{tile}")
        page.wait_for_timeout(200)
        if tile == "tekenen":
            page.evaluate("window.__bubbels.teken.open()")
            page.wait_for_timeout(200)
        elif not page.locator(sel).first.evaluate("el => !!el.closest('.full-fold')"):
            problems.append(f"offers: {tile}: the locked {sel} is not in the Volledige versie fold")
        choose(page, sel)
        page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button")
        if card_buttons(page) != ["Oké"]:
            problems.append(f"offers: {tile}: the locked {sel} offers {card_buttons(page)}")
        page.click("#ov-buttons button >> nth=0")
        landed(page, f"{tile} locked part", screen, problems)
        reload_home()
    if errors:
        problems.append(f"offers: page errors {errors[:2]}")
    ctx.close()
    print(f"[offers] other games: {time.time() - t0:.1f}s")


def mem_state(page):
    return page.evaluate("window.__bubbels.memory.state()")


def mem_pairs(st):
    """Index pairs of the cards still in play, by picture."""
    where = {}
    for i, f in enumerate(st["faces"]):
        if not st["found"][i]:
            where.setdefault(f, []).append(i)
    return list(where.values())


def mem_wait(page, timeout=8000):
    """Until nothing happens by itself any more: no miss on show, not the computer's turn."""
    page.wait_for_function("(() => { const s = window.__bubbels.memory.state(); return s && !s.busy && (s.over || s.setup.mode !== 'cpu' || s.turn === 0) && s.open.length < 2; })()", timeout=timeout)


def mem_tap(page, i):
    page.click(f".mcard[data-i='{i}']")


def memory_flow(browser, base, problems):
    """Paartjes (Memory) on the web build: the bigger boards and the other pictures offer only OK; a
    game alone on 2×3 with one miss (the cards stay up for a moment, a third tap changes nothing)
    played to a win with 3 stars saved; a game together on 3×4 won by player 1, with back + keep
    playing during a miss, nothing counted, and "More cards" at the end of the free part; a game
    against the computer whose turn is visible and slow, won by the child and counted; the Android
    back button."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.inner_text("#tile-memory .tile-name").strip() != "Paartjes":
        problems.append(f"memory: tile says {page.inner_text('#tile-memory .tile-name')!r}")
    group = page.evaluate("document.querySelector('#tile-memory').closest('.tile-group').querySelector('.group-name').textContent")
    if group != "Puzzels":
        problems.append(f"memory: tile sits under {group!r}")
    page.click("#tile-memory")
    page.wait_for_timeout(250)
    for sel in (".memory-opt.size-4x4", ".memory-opt.size-4x5", ".memory-opt.theme-book", ".memory-opt.theme-shapes"):
        choose(page, sel)
        page.wait_for_timeout(200)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != ["Oké"]:
            problems.append(f"memory: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "memory-1-menu.png"), full_page=True)

    # alone, 2×3, real timing: one miss first, then every pair
    choose(page, ".memory-opt.size-2x3")
    choose(page, ".memory-opt.theme-fruit")
    choose(page, ".memory-opt.mode-solo")
    page.click("#memory-play")
    page.wait_for_timeout(400)
    st = mem_state(page)
    pairs = mem_pairs(st)
    a, b = pairs[0][0], pairs[1][0]
    mem_tap(page, a)
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "memory-2-first.png"))
    mem_tap(page, b)
    page.wait_for_timeout(300)
    mem_tap(page, pairs[2][0])  # a third card while two are shown: nothing happens
    page.wait_for_timeout(200)
    st = mem_state(page)
    if not (st["up"][a] and st["up"][b]) or st["up"][pairs[2][0]] or st["turns"] != 1:
        problems.append(f"memory: after a miss the cards are {st['up']}, turns {st['turns']}")
    page.screenshot(path=str(SHOTS / "memory-3-miss.png"))
    mem_wait(page)
    st = mem_state(page)
    if any(st["up"]):
        problems.append("memory: the missed cards were not turned back")
    for p in mem_pairs(st):
        mem_tap(page, p[0])
        page.wait_for_timeout(120)
        mem_tap(page, p[1])
        page.wait_for_timeout(250)
        if not mem_state(page)["over"]:
            page.screenshot(path=str(SHOTS / "memory-4-pair.png"))
    page.wait_for_selector("#overlay:not([hidden])", timeout=5000)
    page.screenshot(path=str(SHOTS / "memory-5-solo-win.png"))
    if page.inner_text("#ov-title").strip() != "Alle paartjes!":
        problems.append(f"memory: solo end card says {page.inner_text('#ov-title')!r}")
    if page.evaluate("window.__bubbels.memory.progress()").get("2x3-fruit") != 3:
        problems.append(f"memory: 3 stars not saved: {page.evaluate('window.__bubbels.memory.progress()')}")
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != ["Nog een keer", "Menu"]:
        problems.append(f"memory: solo end card on 2×3 offers {labels}")
    page.click("#ov-buttons button >> text=Menu")
    page.wait_for_timeout(200)

    # together, 3×4: player 1 finds two pairs, misses; back + keep playing during the miss passes the turn
    page.evaluate("window.__bubbels.memory.fast(true)")
    choose(page, ".memory-opt.size-3x4")
    choose(page, ".memory-opt.mode-duo")
    page.click("#memory-play")
    page.wait_for_timeout(300)
    st = mem_state(page)
    if st["turn"] != 0:
        problems.append(f"memory: the first game together starts with player {st['turn'] + 1}")
    pairs = mem_pairs(st)
    for p in pairs[:2]:
        mem_tap(page, p[0])
        mem_tap(page, p[1])
        page.wait_for_timeout(80)
    page.evaluate("window.__bubbels.memory.fast(false)")
    mem_tap(page, pairs[2][0])
    mem_tap(page, pairs[3][0])
    page.wait_for_timeout(100)
    page.click("#memory-back")
    page.wait_for_timeout(200)
    if not page.is_visible("#memory-continue"):
        problems.append("memory: no 'keep playing' halfway a game")
    page.click("#memory-continue")
    page.wait_for_timeout(200)
    st = mem_state(page)
    if any(st["up"][i] and not st["found"][i] for i in range(len(st["up"]))) or st["turn"] != 1:
        problems.append(f"memory: keep playing after a miss: turn {st['turn']}, up {st['up']}")
    page.evaluate("window.__bubbels.memory.fast(true)")
    page.screenshot(path=str(SHOTS / "memory-6-duo.png"))
    # player 2 finds one pair and misses; player 1 finds the rest
    pairs = mem_pairs(st)
    mem_tap(page, pairs[0][0])
    mem_tap(page, pairs[0][1])
    page.wait_for_timeout(80)
    mem_tap(page, pairs[1][0])
    mem_tap(page, pairs[2][0])
    mem_wait(page)
    for p in mem_pairs(mem_state(page)):
        mem_tap(page, p[0])
        mem_tap(page, p[1])
        page.wait_for_timeout(80)
    st = mem_state(page)
    if not st["over"] or st["over"]["winners"] != [0] or st["scores"] != [5, 1]:
        problems.append(f"memory: the game together ended {st['over']} with {st['scores']}")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / "memory-7-duo-win.png"))
    if page.inner_text("#ov-title").strip() != "Speler 1 wint!":
        problems.append(f"memory: duo end card says {page.inner_text('#ov-title')!r}")
    if [k for k in page.evaluate("window.__bubbels.memory.progress()") if k.startswith("cpu") or k.startswith("3x4")]:
        problems.append(f"memory: a game together was counted: {page.evaluate('window.__bubbels.memory.progress()')}")
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != ["Nog een keer", "Meer kaarten", "Menu"]:
        problems.append(f"memory: the end of the free part offers {labels}")
    page.click("#ov-buttons button >> text=Meer kaarten")
    page.wait_for_timeout(200)
    if page.locator("#ov-buttons button").all_inner_texts() != ["Oké"]:
        problems.append("memory: 'More cards' on the web offers more than OK")
    page.click("#ov-buttons button")
    page.wait_for_timeout(200)
    if not page.is_visible("#screen-memory-menu"):
        problems.append("memory: OK on the offer did not land on the menu")
    if page.locator("#memory-continue").count():
        problems.append("memory: 'keep playing' offered for a game that is over")

    # against the computer, 3×4: four pairs, a miss, the computer's turn (visible, slow), then the rest
    choose(page, ".memory-opt.mode-cpu")
    page.click("#memory-play")
    page.wait_for_timeout(300)
    st = mem_state(page)
    if st["turn"] != 0:
        problems.append("memory: the first game against the computer does not start with the child")
    pairs = mem_pairs(st)
    for p in pairs[:4]:
        mem_tap(page, p[0])
        mem_tap(page, p[1])
        page.wait_for_timeout(80)
    page.evaluate("window.__bubbels.memory.fast(false)")
    mem_tap(page, pairs[4][0])
    mem_tap(page, pairs[5][0])
    t0 = time.time()
    page.wait_for_function("(() => { const s = window.__bubbels.memory.state(); return s.turn === 1 && s.open.length === 1; })()", timeout=8000, polling=20)
    waited = time.time() - t0
    if waited < 1.5:
        problems.append(f"memory: the computer's first card came after only {waited:.1f} s")
    if not page.locator(".memory-chip.thinking").count() or "computer" not in page.inner_text("#memory-status").lower():
        problems.append(f"memory: the computer's turn is not shown: {page.inner_text('#memory-status')!r}")
    page.screenshot(path=str(SHOTS / "memory-8-cpu-turn.png"))
    mem_tap(page, mem_pairs(mem_state(page))[0][0])  # a tap during the computer's turn: nothing
    page.evaluate("window.__bubbels.memory.fast(true)")
    for _ in range(12):
        mem_wait(page, 15000)
        st = mem_state(page)
        if st["over"]:
            break
        p = mem_pairs(st)[0]
        mem_tap(page, p[0])
        mem_tap(page, p[1])
        page.wait_for_timeout(60)
    st = mem_state(page)
    if not st["over"] or st["over"]["winners"] != [0]:
        problems.append(f"memory: the child did not win against the computer: {st['over']} {st['scores']}")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / "memory-9-cpu-win.png"))
    if page.inner_text("#ov-title").strip() != "Jij wint!":
        problems.append(f"memory: end card against the computer says {page.inner_text('#ov-title')!r}")
    if page.evaluate("window.__bubbels.memory.progress()").get("cpu-3x4") != 1:
        problems.append(f"memory: the win was not counted: {page.evaluate('window.__bubbels.memory.progress()')}")
    page.click("#ov-buttons button >> text=Nog een keer")
    page.wait_for_timeout(300)
    if mem_state(page)["starter"] != 1:
        problems.append("memory: the computer does not start the second game")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(200)
    if not page.is_visible("#screen-memory-menu"):
        problems.append("memory: the back button did not lead to the menu")
    page.screenshot(path=str(SHOTS / "memory-10-menu-after.png"), full_page=True)
    if errors:
        problems.append(f"memory: page errors {errors[:3]}")
    ctx.close()


def memory_layouts(browser, base, problems):
    """Paartjes at 320x568, sideways 568x320 and 844x390, desktop; the full version with 20 cards on
    small and sideways phones and in English: every card on screen and 44 px or more, the players
    and the back button on screen, no sideways scroll, menu texts inside their buttons."""
    for w, h, owned, size, mode in ((320, 568, False, "3x4", "duo"), (568, 320, False, "3x4", "cpu"), (844, 390, False, "3x4", "solo"), (1280, 800, False, "3x4", "duo"),
                                    (320, 568, True, "4x5", "cpu"), (568, 320, True, "4x5", "duo"), (390, 844, True, "4x5", "solo"), (1280, 800, True, "4x5", "cpu")):
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
        label = f"{w}x{h} {size} {mode}"
        if english and page.inner_text("#tile-memory .tile-name").strip() != "Pairs":
            problems.append(f"memory {label}: English tile says {page.inner_text('#tile-memory .tile-name')!r}")
        page.click("#tile-memory")
        page.wait_for_timeout(200)
        theme = "shapes" if owned and english else "book" if owned else "fruit"
        page.evaluate(f"window.__bubbels.memory.choose({{ size: '{size}', theme: '{theme}', mode: '{mode}' }})")
        page.wait_for_timeout(150)
        page.screenshot(path=str(SHOTS / f"memory-menu-{w}x{h}{'-full' if owned else ''}.png"), full_page=True)
        bad = page.evaluate("""[...document.querySelectorAll('.memory-opt')].filter((b) => {
            const r = b.getBoundingClientRect();
            return [...b.querySelectorAll('.option-title, .option-sub')].some((t) => {
                const range = document.createRange();
                range.selectNodeContents(t);
                return [...range.getClientRects()].some((q) => q.right > r.right - 2);
            }) || r.height < 48;
        }).map((b) => b.className)""")
        if bad:
            problems.append(f"memory {label}: menu options overflow {bad}")
        page.evaluate("window.__bubbels.memory.fast(true)")
        page.click("#memory-play")
        page.wait_for_timeout(500)
        st = mem_state(page)
        # turn two cards so the screenshot shows pictures
        p = mem_pairs(st)
        mem_tap(page, p[0][0])
        page.wait_for_timeout(450)
        for sel in ("#memory-board", "#memory-turn", "#memory-status", "#memory-back"):
            r = page.locator(sel).bounding_box()
            if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                problems.append(f"memory {label}: {sel} off screen ({r})")
        boxes = page.evaluate("[...document.querySelectorAll('.mcard')].map((c) => { const r = c.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })")
        off = [i for i, (l, t_, r, b) in enumerate(boxes) if l < -0.5 or t_ < -0.5 or r > w + 0.5 or b > h + 0.5]
        if off:
            problems.append(f"memory {label}: cards {off} off screen")
        small = min(min(r - l, b - t_) for l, t_, r, b in boxes)
        if small < 44:
            problems.append(f"memory {label}: cards only {small:.0f} px")
        if page.evaluate("document.documentElement.scrollWidth") > w:
            problems.append(f"memory {label}: sideways scroll")
        print(f"[memory {label}] card {small:.0f} px, grid {st['grid']['cols']}x{st['grid']['rows']}")
        page.screenshot(path=str(SHOTS / f"memory-{w}x{h}{'-full' if owned else ''}.png"))
        if errors:
            problems.append(f"memory {label}: page errors {errors[:2]}")
        ctx.close()


def kw_state(page):
    return page.evaluate("window.__bubbels.kwartet.state()")


def kw_wait(page, phases=("ask", "pass", "over"), timeout=30000):
    """Until a child has to do something (ask, or take the phone), or the game is over."""
    page.wait_for_function("(() => { const s = window.__bubbels.kwartet.state(); return s && %s.includes(s.phase) && !s.busy; })()" % json.dumps(list(phases)), timeout=timeout)


def kw_holder(st, card):
    for p, h in enumerate(st["hands"]):
        if card in h:
            return p
    return -1


def kw_ask(page, target, card):
    if page.locator(f".kseat[data-player='{target}']:not([disabled])").count():
        page.click(f".kseat[data-player='{target}']")
    page.click(f"button.kcard.missing[data-card='{card}']")


def kwartet_flow(browser, base, problems):
    """Kwartet on the web build: 6 and 8 sets and a 4th player offer only OK; a game against two
    computers (seeded deal): a question that gets "no", the computers' turns visible and slow, then
    the child asks well and wins, the win counted, "More sets" offers only OK; back + keep playing
    while a question is on screen; two children: the pass-the-phone card hides each child's cards;
    the Android back button."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.inner_text("#tile-kwartet .tile-name").strip() != "Kwartet":
        problems.append(f"kwartet: tile says {page.inner_text('#tile-kwartet .tile-name')!r}")
    group = page.evaluate("document.querySelector('#tile-kwartet').closest('.tile-group').querySelector('.group-name').textContent")
    if group != "Bordspellen":
        problems.append(f"kwartet: tile sits under {group!r}")
    page.click("#tile-kwartet")
    page.wait_for_timeout(250)
    for sel in (".kwartet-opt.sets-6", ".kwartet-opt.sets-8", ".kwartet-slot.slot-3"):
        choose(page, sel)
        page.wait_for_timeout(200)
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != ["Oké"]:
            problems.append(f"kwartet: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "kwartet-1-menu.png"), full_page=True)

    # against two computers, 4 sets, a seeded deal
    page.evaluate("window.__bubbels.kwartet.choose({ sets: 4, players: ['kid', 'cpu', 'cpu'] })")
    page.evaluate(f"window.__bubbels.kwartet.seed({KW_SEED})")
    page.click("#kwartet-play")
    kw_wait(page)
    st = kw_state(page)
    page.screenshot(path=str(SHOTS / "kwartet-2-start.png"))
    if st["phase"] != "ask" or st["viewer"] != 0:
        problems.append(f"kwartet: the game does not start with the child asking: {st['phase']} {st['viewer']}")
    rows = page.locator("#kwartet-hand .krow").count()
    if rows != len({c.rsplit(':', 1)[0] for c in st["hands"][0]}):
        problems.append(f"kwartet: {rows} rows for the child's hand {st['hands'][0]}")
    if page.locator("button.kcard.missing:not([disabled])").count() != len(st["askable"]):
        problems.append("kwartet: not every card the child may ask for is a button")
    # a question that gets "no": a card the chosen player does not have
    miss = next(((p, c) for c in st["askable"] for p in (1, 2) if kw_holder(st, c) not in (p, 0) and st["hands"][p]), None)
    kw_ask(page, miss[0], miss[1])
    page.wait_for_timeout(300)
    bubble = page.inner_text(".kwartet-own .kbubble") if page.locator(".kwartet-own .kbubble").count() else ""
    if "heb jij" not in bubble:
        problems.append(f"kwartet: the child's question bubble says {bubble!r}")
    page.screenshot(path=str(SHOTS / "kwartet-3-question.png"))
    page.wait_for_selector(f".kseat[data-player='{miss[0]}'] .kbubble.no", timeout=4000)
    page.screenshot(path=str(SHOTS / "kwartet-4-no.png"))
    t0 = time.time()
    page.wait_for_function("window.__bubbels.kwartet.state().phase === 'cpu'", timeout=6000, polling=20)
    if not page.locator(".kseat.thinking").count():
        problems.append("kwartet: the computer's turn is not shown")
    page.wait_for_function("window.__bubbels.kwartet.state().phase === 'question'", timeout=6000, polling=20)
    if time.time() - t0 < 0.8:
        problems.append(f"kwartet: the computer asked after only {time.time() - t0:.1f} s")
    page.wait_for_timeout(200)
    if not page.locator(".kseat .kbubble").count():
        problems.append("kwartet: the computer's question has no speech bubble")
    page.screenshot(path=str(SHOTS / "kwartet-5-cpu-asks.png"))

    # back + keep playing while a question is on screen: it is answered at once
    page.click("#kwartet-back")
    page.wait_for_timeout(200)
    if not page.is_visible("#kwartet-continue"):
        problems.append("kwartet: no 'keep playing' halfway a game")
    page.click("#kwartet-continue")
    page.wait_for_timeout(100)
    if kw_state(page)["phase"] == "question":
        problems.append("kwartet: the question was still waiting after keep playing")

    # the child asks well from now on
    page.evaluate("window.__bubbels.kwartet.fast(true)")
    asked = 0
    for _ in range(80):
        kw_wait(page)
        st = kw_state(page)
        if st["phase"] == "over":
            break
        card = st["askable"][0]
        kw_ask(page, kw_holder(st, card), card)
        asked += 1
        if asked == 3:
            page.wait_for_timeout(10)
            page.screenshot(path=str(SHOTS / "kwartet-6-yes.png"))
    st = kw_state(page)
    if not st["over"] or st["over"]["winners"] != [0]:
        problems.append(f"kwartet: the child did not win: {st['over']} {st['quartets']} (try another KW_SEED)")
    page.wait_for_selector("#overlay:not([hidden])", timeout=5000)
    page.screenshot(path=str(SHOTS / "kwartet-7-win.png"))
    if page.inner_text("#ov-title").strip() != "Jij wint!":
        problems.append(f"kwartet: end card says {page.inner_text('#ov-title')!r}")
    if page.evaluate("window.__bubbels.kwartet.wins()").get("won-4") != 1:
        problems.append(f"kwartet: the win was not counted: {page.evaluate('window.__bubbels.kwartet.wins()')}")
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != ["Nog een keer", "Meer kwartetten", "Menu"]:
        problems.append(f"kwartet: end card offers {labels}")
    page.click("#ov-buttons button >> text=Meer kwartetten")
    page.wait_for_timeout(200)
    if page.locator("#ov-buttons button").all_inner_texts() != ["Oké"]:
        problems.append("kwartet: 'More sets' on the web offers more than OK")
    page.click("#ov-buttons button")
    page.wait_for_timeout(200)
    if not page.is_visible("#screen-kwartet-menu"):
        problems.append("kwartet: OK on the offer did not land on the menu")

    # two children on one phone: the pass card hides each child's cards
    page.evaluate("window.__bubbels.kwartet.seed(null)")
    page.evaluate("window.__bubbels.kwartet.fast(false)")
    page.evaluate("window.__bubbels.kwartet.choose({ sets: 4, players: ['kid', 'kid'] })")
    page.click("#kwartet-play")
    page.wait_for_selector("#overlay:not([hidden])", timeout=3000)
    if page.inner_text("#ov-title").strip() != "Speler 1 is aan de beurt" or page.locator("#kwartet-hand .krow").count():
        problems.append(f"kwartet: two children: no pass card first, or the cards show: {page.inner_text('#ov-title')!r}")
    page.screenshot(path=str(SHOTS / "kwartet-8-pass.png"))
    page.click("#ov-buttons button >> text=Laat mijn kaarten zien")
    page.wait_for_timeout(200)
    st = kw_state(page)
    if st["viewer"] != 0 or not page.locator("#kwartet-hand .krow").count():
        problems.append("kwartet: two children: player 1's cards do not show")
    # a card player 2 has (the others may lie on the pile): a "yes"
    kw_ask(page, 1, next((c for c in st["askable"] if c in st["hands"][1]), st["askable"][0]))
    page.evaluate("window.__bubbels.kwartet.fast(true)")
    kw_wait(page, ("ask", "pass", "draw", "over"))
    st = kw_state(page)
    if st["viewer"] != 0 or st["turn"] != 0:
        problems.append(f"kwartet: two children: after a yes player 1 should ask again: {st['phase']} {st['turn']}")
    page.click("#kwartet-back")
    page.wait_for_timeout(200)
    page.click("#kwartet-continue")
    page.wait_for_timeout(300)
    if not page.is_visible("#overlay") or page.locator("#kwartet-hand .krow").count():
        problems.append("kwartet: two children: keep playing shows the cards without the pass card")
    page.click("#ov-buttons button >> text=Laat mijn kaarten zien")
    page.wait_for_timeout(150)
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(200)
    if not page.is_visible("#screen-kwartet-menu"):
        problems.append("kwartet: the back button did not lead to the menu")

    # two children and a computer: after a "no" the asker's cards are hidden at once, while the
    # answer is still on screen
    page.evaluate("window.__bubbels.kwartet.fast(false)")
    page.evaluate("window.__bubbels.kwartet.choose({ sets: 4, players: ['kid', 'kid', 'cpu'] })")
    page.click("#kwartet-play")
    page.wait_for_selector("#overlay:not([hidden])", timeout=3000)
    page.click("#ov-buttons button >> text=Laat mijn kaarten zien")
    page.wait_for_timeout(200)
    st = kw_state(page)
    miss = next(((p, c) for c in st["askable"] for p in (1, 2) if kw_holder(st, c) not in (p, 0) and st["hands"][p]), None)
    if miss:
        kw_ask(page, miss[0], miss[1])
        page.wait_for_selector(f".kseat[data-player='{miss[0]}'] .kbubble.no", timeout=4000)
        if page.locator("#kwartet-hand .krow").count() or kw_state(page)["viewer"] != -1:
            problems.append("kwartet: two children: the asker's cards stay on screen after a no")
    else:
        problems.append("kwartet: two children and a computer: no card to ask that gets a no")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(200)
    kwartet_pile(page, problems)
    if errors:
        problems.append(f"kwartet: page errors {errors[:3]}")
    ctx.close()


KW_SEED = 3
KW_PILE_SEED = 7


def kwartet_pile(page, problems):
    """Two players play with a pile (Mark, 17 Nov): a child against the computer, 4 sets: 5 cards
    each and 6 on the pile. A "no" makes the pile glow and says "Pak een kaart van de stapel"; a
    tap on it brings its top card into the hand (a card back flies there) and passes the turn; the
    computer draws by itself, slowly and visibly. Then played to the end by the test hook, drawing
    whenever the answer is no, until the pile is empty and every set is down."""
    page.evaluate("window.__bubbels.kwartet.fast(false)")
    page.evaluate("window.__bubbels.kwartet.choose({ sets: 4, players: ['kid', 'cpu'] })")
    rule = page.inner_text(".kwartet-rule")
    if "ieder 5 kaarten" not in rule or "stapel" not in rule:
        problems.append(f"kwartet pile: the menu's rule says {rule!r}")
    page.screenshot(path=str(SHOTS / "kwartet-9-menu-2p.png"), full_page=True)
    page.evaluate(f"window.__bubbels.kwartet.seed({KW_PILE_SEED})")
    page.click("#kwartet-play")
    kw_wait(page, ("ask",))
    st = kw_state(page)
    held = [len(h) + 4 * len(q) for h, q in zip(st["hands"], st["quartets"])]
    if held != [5, 5] or len(st["pile"]) != 6:
        problems.append(f"kwartet pile: dealt {held} with {len(st['pile'])} on the pile")
    if page.inner_text("#kwartet-pile .kp-count").strip() != "6" or page.inner_text("#kwartet-pile .kp-name").strip() != "Stapel":
        problems.append(f"kwartet pile: the pile shows {page.inner_text('#kwartet-pile')!r}")
    if not page.locator("#kwartet-pile[disabled]").count():
        problems.append("kwartet pile: the pile can be tapped before a no")
    page.screenshot(path=str(SHOTS / "kwartet-10-pile.png"))
    # a "no": a card that lies on the pile
    card = next((c for c in st["askable"] if c in st["pile"]), None)
    if not card:
        problems.append(f"kwartet pile: no askable card on the pile (try another KW_PILE_SEED) {st}")
        return
    kw_ask(page, 1, card)
    page.wait_for_function("window.__bubbels.kwartet.state().phase === 'draw'", timeout=6000, polling=20)
    page.wait_for_timeout(300)
    status = page.inner_text("#kwartet-status")
    if "Pak een kaart van de stapel" not in status or not page.locator("#kwartet-pile.active:not([disabled])").count() or not page.locator(".kseat .kbubble.no").count():
        problems.append(f"kwartet pile: after a no: {status!r}, the pile not glowing, or no 'no' bubble")
    page.screenshot(path=str(SHOTS / "kwartet-11-no.png"))
    # the "no" goes after a moment; the pile keeps glowing until it is tapped
    kw_wait(page, ("draw",), timeout=6000)
    st = kw_state(page)
    if page.locator(".kbubble").count() or not page.locator("#kwartet-pile.active").count():
        problems.append("kwartet pile: the no bubble stays over the status, or the pile stops glowing")
    page.screenshot(path=str(SHOTS / "kwartet-11-draw.png"))
    top = st["pile"][0]
    box = page.locator("#kwartet-pile").bounding_box()
    if not box or min(box["width"], box["height"]) < 44:
        problems.append(f"kwartet pile: the pile is {box}")
    page.click("#kwartet-pile")
    page.wait_for_timeout(250)
    if not page.locator(".kfly").count():
        problems.append("kwartet pile: no card flies from the pile")
    page.screenshot(path=str(SHOTS / "kwartet-12-drawn.png"))
    st = kw_state(page)
    if top not in st["hands"][0] and not any(top.rsplit(":", 1)[0] == q for q in st["quartets"][0]):
        problems.append(f"kwartet pile: the top card {top} is not in the child's hand {st['hands'][0]}")
    if len(st["pile"]) != 5 or page.inner_text("#kwartet-pile .kp-count").strip() != "5":
        problems.append(f"kwartet pile: after the draw the pile has {len(st['pile'])}")
    if top != card and st["turn"] != 1:
        problems.append(f"kwartet pile: after drawing another card the turn stays with {st['turn']}")
    if not page.locator(f"#kwartet-hand .kcard.fresh[data-card='{top}']").count() and top in st["hands"][0]:
        problems.append("kwartet pile: the drawn card does not pop into the hand")
    # the computer's turn: it asks, and draws by itself after a no, slowly
    seen_cpu_draw = False
    if st["turn"] == 1:
        for _ in range(6):
            page.wait_for_function("(() => { const s = window.__bubbels.kwartet.state(); return s.turn === 0 || s.phase === 'draw' || s.over; })()", timeout=20000, polling=20)
            st = kw_state(page)
            if st["phase"] == "draw" and st["turn"] == 1:
                t0 = time.time()
                if "Robo pakt een kaart van de stapel" not in page.inner_text("#kwartet-status") or not page.locator(".kseat.thinking").count():
                    problems.append(f"kwartet pile: the computer's draw is not shown: {page.inner_text('#kwartet-status')!r}")
                page.screenshot(path=str(SHOTS / "kwartet-13-cpu-draws.png"))
                page.wait_for_function("window.__bubbels.kwartet.state().phase === 'drew'", timeout=5000, polling=20)
                if time.time() - t0 < 0.5:
                    problems.append(f"kwartet pile: the computer drew after only {time.time() - t0:.1f} s")
                seen_cpu_draw = True
                break
            if st["turn"] == 0 or st["over"]:
                break
    # back + keep playing while the child has to draw: the pile still waits for a tap
    # then the rest of the game by the test hook: ask a card the computer has, else one from the pile
    page.evaluate("window.__bubbels.kwartet.fast(true)")
    draws = 1
    left_while_drawing = False
    for _ in range(120):
        kw_wait(page, ("ask", "draw", "over"))
        st = kw_state(page)
        if st["phase"] == "over":
            break
        if st["phase"] == "draw":
            if not left_while_drawing:
                left_while_drawing = True
                page.click("#kwartet-back")
                page.wait_for_timeout(100)
                page.click("#kwartet-continue")
                page.wait_for_timeout(100)
                if kw_state(page)["phase"] != "draw" or not page.locator("#kwartet-pile.active").count():
                    problems.append("kwartet pile: keep playing lost the draw")
            page.click("#kwartet-pile")
            draws += 1
            continue
        has = [c for c in st["askable"] if c in st["hands"][1]]
        kw_ask(page, 1, has[0] if has and (draws > 2 or not [c for c in st["askable"] if c in st["pile"]]) else next((c for c in st["askable"] if c in st["pile"]), st["askable"][0]))
    st = kw_state(page)
    if not st["over"] or st["pile"]:
        problems.append(f"kwartet pile: the game did not end with an empty pile: {st['over']} {len(st['pile'])}")
    if draws < 2:
        problems.append(f"kwartet pile: the child drew only {draws} times")
    if not seen_cpu_draw:
        problems.append("kwartet pile: the computer never drew from the pile (try another KW_PILE_SEED)")
    page.wait_for_selector("#overlay:not([hidden])", timeout=5000)
    title = page.inner_text("#ov-title").strip()
    if title not in ("Jij wint!", "Robo wint!", "Gelijkspel!"):
        problems.append(f"kwartet pile: end card says {title!r}")
    if sum(len(q) for q in st["quartets"]) != 4:
        problems.append(f"kwartet pile: not every set is down {st['quartets']}")
    page.screenshot(path=str(SHOTS / "kwartet-14-pile-end.png"))
    print(f"[kwartet pile] child drew {draws}x, end: {title} {[len(q) for q in st['quartets']]}")
    page.click("#ov-buttons button >> text=Menu")
    page.wait_for_timeout(150)


def kwartet_layouts(browser, base, problems):
    """Kwartet at 320x568, sideways 568x320 and 844x390, desktop; the full version with 8 sets and
    four players on small and sideways phones, 6 sets in English: the players, the status, the hand
    and the back button on screen, the cards you may ask for 44 px or more, a speech bubble inside
    the screen, no sideways scroll, menu texts inside their buttons."""
    for w, h, owned, sets, players in ((320, 568, False, 4, "['kid', 'cpu', 'cpu']"), (320, 568, False, 4, "['kid', 'cpu']"), (568, 320, False, 4, "['kid', 'cpu', 'cpu']"), (844, 390, False, 4, "['kid', 'cpu']"), (1280, 800, False, 4, "['kid', 'cpu', 'cpu']"),
                                       (568, 320, True, 8, "['kid', 'cpu']"),
                                       (320, 568, True, 8, "['kid', 'cpu', 'cpu', 'cpu']"), (568, 320, True, 8, "['kid', 'cpu', 'cpu', 'cpu']"), (390, 844, True, 6, "['kid', 'cpu', 'cpu', 'cpu']")):
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
        label = f"{w}x{h} {sets} sets {players.count(',') + 1}p"
        two = players.count(",") == 1
        name = f"kwartet-{w}x{h}{'-full' if owned else ''}{'-2p' if two else ''}"
        if english and page.inner_text("#tile-kwartet .tile-name").strip() != "Quartets":
            problems.append(f"kwartet {label}: English tile says {page.inner_text('#tile-kwartet .tile-name')!r}")
        page.click("#tile-kwartet")
        page.wait_for_timeout(200)
        page.evaluate(f"window.__bubbels.kwartet.choose({{ sets: {sets}, players: {players} }})")
        page.wait_for_timeout(150)
        page.screenshot(path=str(SHOTS / f"kwartet-menu-{w}x{h}{'-full' if owned else ''}{'-2p' if two else ''}.png"), full_page=True)
        bad = page.evaluate("""[...document.querySelectorAll('.kwartet-opt, .kwartet-slot')].filter((b) => {
            const r = b.getBoundingClientRect();
            return [...b.querySelectorAll('.option-title, .option-sub, .slot-name, .slot-kind')].some((t) => {
                const range = document.createRange();
                range.selectNodeContents(t);
                return [...range.getClientRects()].some((q) => q.right > r.right - 2);
            });
        }).map((b) => b.className)""")
        if bad:
            problems.append(f"kwartet {label}: menu texts overflow {bad}")
        page.evaluate("window.__bubbels.kwartet.seed(5)")
        page.click("#kwartet-play")
        kw_wait(page, ("ask",))
        for sel in ("#kwartet-seats", "#kwartet-status", "#kwartet-hand", "#kwartet-back") + (("#kwartet-pile",) if two else ()):
            r = page.locator(sel).bounding_box()
            if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                # the hand may be taller than the screen: it scrolls inside the table
                if not (sel == "#kwartet-hand" and r and r["x"] >= -0.5 and r["x"] + r["width"] <= w + 0.5 and r["y"] < h):
                    problems.append(f"kwartet {label}: {sel} off screen ({r})")
        b = page.locator("button.kcard.missing:not([disabled]) >> nth=0").bounding_box()
        if not b or min(b["width"], b["height"]) < 44 or b["y"] + b["height"] > h + 0.5:
            problems.append(f"kwartet {label}: the first card to ask for is {b}")
        seats = page.evaluate("[...document.querySelectorAll('.kseat, .kpile')].map((s) => { const r = s.getBoundingClientRect(); return [r.left, r.right, r.width, r.height]; })")
        if two != (page.locator("#kwartet-pile").count() == 1):
            problems.append(f"kwartet {label}: a pile with {players}")
        if any(l < -0.5 or r > w + 0.5 or min(sw, sh) < 44 for l, r, sw, sh in seats):
            problems.append(f"kwartet {label}: seats {seats}")
        if page.evaluate("document.documentElement.scrollWidth") > w:
            problems.append(f"kwartet {label}: sideways scroll")
        print(f"[kwartet {label}] card {b['width']:.0f}x{b['height']:.0f} px")
        page.screenshot(path=str(SHOTS / f"{name}.png"))
        # a question to the last player: its answer bubble stays inside the screen
        st = kw_state(page)
        last = max(p for p in range(len(st["kinds"])) if p != 0 and st["hands"][p])
        kw_ask(page, last, st["askable"][-1])
        page.wait_for_selector(f".kseat[data-player='{last}'] .kbubble", timeout=5000)
        page.wait_for_timeout(300)
        for r in page.evaluate("[...document.querySelectorAll('.kbubble')].map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; })"):
            if r[0] < -0.5 or r[1] > w + 0.5 or r[3] > h + 0.5:
                problems.append(f"kwartet {label}: a speech bubble is off screen {r}")
        page.screenshot(path=str(SHOTS / f"{name}-answer.png"))
        if errors:
            problems.append(f"kwartet {label}: page errors {errors[:2]}")
        ctx.close()


def pz_state(page):
    return page.evaluate("window.__bubbels.puzzel.state()")


def pz_drag(page, a, b, steps=8):
    page.mouse.move(a["x"], a["y"])
    page.mouse.down()
    page.mouse.move(b["x"], b["y"], steps=steps)
    page.mouse.up()


def pz_finish(page, problems, label):
    """Lay every loose piece by the test hook but one, and that last one by a real drag."""
    st = pz_state(page)
    loose = [i for i, done in enumerate(st["placed"]) if not done]
    for i in loose[:-1]:
        if not page.evaluate(f"window.__bubbels.puzzel.place({i})"):
            problems.append(f"legpuzzel {label}: the hook could not lay piece {i}")
    page.wait_for_timeout(150)
    k = page.evaluate("window.__bubbels.puzzel.free()")[0]
    st = pz_state(page)
    pz_drag(page, st["at"][k], st["home"][k], steps=6)
    page.wait_for_timeout(200)
    if not pz_state(page)["over"]:
        problems.append(f"legpuzzel {label}: not done after the last real drag: {pz_state(page)['placed']}")


def legpuzzel_flow(browser, base, problems):
    """Legpuzzel on the web build (Mark, 17 Nov 2026: 9 pieces from 3, 16 from 4, 25 from 5): the
    menu shows 9, 16 and 25 pieces free with their age and 30, 48 and 60 "full version", and no 4, 6,
    12 or 20 any more; a save from before with stars on those sizes and the last size on 12 opens on
    9 and keeps those stars; 30, 48 and 60 pieces and the five other pictures offer only OK; the
    9-piece garden laid by real drags (a drop on another piece's place does not snap, a drop near
    its own does), saved and ticked off, the end card; the 16-piece sea with the example picture off
    and back + keep puzzling halfway, the rest by the hook and the last by a real drag; the 25-piece
    fruit bowl the same way, then "More puzzles" at the end of the free part; the Android back
    button."""
    old = {"garden-p4": 1, "sea-p6": 1, "fruit-p12": 1, "garden-p20": 1}
    save = {"version": 1, "games": {"legpuzzel": {"stars": dict(old), "size": "p12", "ghost": True}},
            "settings": {"muted": True, "lang": "nl"}, "purchase": {"owned": False}}
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(seeded(save))
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.inner_text("#tile-legpuzzel .tile-name").strip() != "Legpuzzel":
        problems.append(f"legpuzzel: tile says {page.inner_text('#tile-legpuzzel .tile-name')!r}")
    group = page.evaluate("document.querySelector('#tile-legpuzzel').closest('.tile-group').querySelector('.group-name').textContent")
    if group != "Puzzels":
        problems.append(f"legpuzzel: tile sits under {group!r}")
    page.click("#tile-legpuzzel")
    page.wait_for_timeout(250)
    # the sizes are level cells: the number of pieces and the age; 30, 48 and 60 locked, in the fold
    titles = page.evaluate("[...document.querySelectorAll('.puzzel-sizes .level-cell')].map((e) => e.querySelector('.num').textContent)")
    if titles != ["9", "16", "25", "30", "48", "60"]:
        problems.append(f"legpuzzel: the sizes are {titles}")
    labels = page.evaluate("[...document.querySelectorAll('.puzzel-sizes .level-cell')].map((e) => e.getAttribute('aria-label'))")
    if labels != ["9 stukjes, vanaf 3 jaar", "16 stukjes, vanaf 4 jaar", "25 stukjes, vanaf 5 jaar"] + [f"{n} stukjes, volledige versie" for n in (30, 48, 60)]:
        problems.append(f"legpuzzel: the size cells say {labels}")
    subs = page.evaluate("[...document.querySelectorAll('.puzzel-sizes .cell-sub')].map((e) => e.textContent)")
    if subs != ["vanaf 3 jaar", "vanaf 4 jaar", "vanaf 5 jaar", "vanaf 6 jaar", "vanaf 7 jaar", "vanaf 9 jaar"]:
        problems.append(f"legpuzzel: the size cells show {subs}")
    locks = page.evaluate("[...document.querySelectorAll('.puzzel-sizes .level-cell')].map((e) => e.classList.contains('locked') && !!e.closest('.full-fold'))")
    if locks != [False] * 3 + [True] * 3:
        problems.append(f"legpuzzel: locked sizes (in the fold) {locks}")
    # the saved last size (12 pieces, gone from the menu) falls back to 9; the old stars stay
    if page.get_attribute(".puzzel-opt.size-p9", "aria-pressed") != "true":
        problems.append("legpuzzel: a saved last size of 12 pieces did not fall back to 9")
    if page.locator(".puzzel-pic.done").count():
        problems.append("legpuzzel: stars of a size that left the menu tick off a picture")
    small = page.evaluate("Math.min(...[...document.querySelectorAll('.puzzel-sizes .level-cell')].filter((e) => !e.closest('.full-fold')).map((e) => e.getBoundingClientRect().height))")
    if small < 48:
        problems.append(f"legpuzzel: a size button is only {small:.0f} px high")
    for sel in (".puzzel-opt.size-p30", ".puzzel-opt.size-p48", ".puzzel-opt.size-p60", ".puzzel-pic.pic-space", ".puzzel-pic.pic-puppies"):
        choose(page, sel)
        page.wait_for_timeout(200)
        if sel == ".puzzel-opt.size-p30" and "9, 16 en 25 stukjes" not in page.inner_text("#ov-text"):
            problems.append(f"legpuzzel: the offer says {page.inner_text('#ov-text')!r}")
        labels = page.locator("#ov-buttons button").all_inner_texts()
        if labels != ["Oké"]:
            problems.append(f"legpuzzel: locked {sel} offers {labels}")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "legpuzzel-1-menu.png"), full_page=True)

    # 9 pieces, the garden: one wrong drop, then every piece by a real drag
    choose(page, ".puzzel-opt.size-p9")
    choose(page, ".puzzel-pic.pic-garden")
    page.wait_for_function("window.__bubbels.puzzel.ready()", timeout=5000)
    page.wait_for_timeout(200)
    page.screenshot(path=str(SHOTS / "legpuzzel-2-start.png"))
    st = pz_state(page)
    pz_drag(page, st["at"][0], st["home"][4])
    page.wait_for_timeout(150)
    if pz_state(page)["placed"][0]:
        problems.append("legpuzzel: a piece snapped into another piece's place")
    for _ in range(9):
        st = pz_state(page)
        if st["over"]:
            break
        i = page.evaluate("window.__bubbels.puzzel.free()")[0]
        near = {"x": st["home"][i]["x"] + st["s"] * 0.2, "y": st["home"][i]["y"] - st["s"] * 0.15}  # a little off: it still snaps
        pz_drag(page, st["at"][i], near)
        page.wait_for_timeout(200)
        if not pz_state(page)["placed"][i]:
            problems.append(f"legpuzzel: piece {i} dropped near its place did not snap ({pz_state(page)['at'][i]} vs {pz_state(page)['home'][i]})")
        if sum(pz_state(page)["placed"]) == 4:
            page.screenshot(path=str(SHOTS / "legpuzzel-3-half.png"))
    st = pz_state(page)
    if not st["over"]:
        problems.append(f"legpuzzel: the 9-piece puzzle is not done: {st['placed']}")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / "legpuzzel-4-done.png"))
    if page.inner_text("#ov-title").strip() != "Klaar!":
        problems.append(f"legpuzzel: end card says {page.inner_text('#ov-title')!r}")
    laid = page.evaluate("window.__bubbels.puzzel.done()")
    if laid.get("garden-p9") != 1 or any(laid.get(k) != 1 for k in old):
        problems.append(f"legpuzzel: the puzzle was not saved as laid, or old stars went: {laid}")
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != ["Volgende plaatje", "Nog een keer", "Menu"]:
        problems.append(f"legpuzzel: end card on 9 pieces offers {labels}")
    page.click("#ov-buttons button >> text=Menu")
    page.wait_for_timeout(200)
    if not page.locator(".puzzel-pic.pic-garden.done .check").count():
        problems.append("legpuzzel: the menu does not tick off the laid picture")

    # 16 pieces, the sea: the example picture off, back + keep puzzling halfway, the rest by the hook
    choose(page, ".puzzel-opt.size-p16")
    choose(page, ".puzzel-pic.pic-sea")
    page.wait_for_function("window.__bubbels.puzzel.ready()", timeout=5000)
    page.wait_for_timeout(200)
    st = pz_state(page)
    if len(st["placed"]) != 16 or st["zoomMax"] != 1 or page.is_visible("#legpuzzel-zoom"):
        problems.append(f"legpuzzel: 16 pieces: {len(st['placed'])} pieces, magnifier {st['zoomMax']}")
    page.screenshot(path=str(SHOTS / "legpuzzel-16-start.png"))
    page.click("#legpuzzel-ghost")
    page.wait_for_timeout(250)
    if page.evaluate("getComputedStyle(document.querySelector('#legpuzzel-board canvas')).opacity") != "0":
        problems.append("legpuzzel: the example picture did not turn off")
    for i in range(8):
        k = page.evaluate("window.__bubbels.puzzel.free()")[0]
        page.evaluate(f"window.__bubbels.puzzel.place({k})")
    page.click("#legpuzzel-back")
    page.wait_for_timeout(200)
    if not page.is_visible("#legpuzzel-continue"):
        problems.append("legpuzzel: no 'keep puzzling' halfway a puzzle")
    page.click("#legpuzzel-continue")
    page.wait_for_timeout(300)
    if sum(pz_state(page)["placed"]) != 8:
        problems.append(f"legpuzzel: keep puzzling lost pieces: {pz_state(page)['placed']}")
    # a browser toolbar slides in (the stage a little shorter): the loose pieces stay put
    before = pz_state(page)
    page.set_viewport_size({"width": 390, "height": 824})
    page.wait_for_timeout(400)
    after = pz_state(page)
    if after["s"] == before["s"]:
        moved = [k for k in range(16) if not before["placed"][k] and abs(after["at"][k]["x"] - before["at"][k]["x"]) + abs(after["at"][k]["y"] - before["at"][k]["y"]) > 1
                 and before["at"][k]["y"] + before["s"] < 790]
        if moved:
            problems.append(f"legpuzzel: a small resize moved loose pieces {moved}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(400)
    page.click("#legpuzzel-ghost")  # the example picture back on
    pz_finish(page, problems, "16 sea")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / "legpuzzel-16-done.png"))
    if page.evaluate("window.__bubbels.puzzel.done()").get("sea-p16") != 1:
        problems.append("legpuzzel: the 16-piece sea was not saved as laid")
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != ["Volgende plaatje", "Nog een keer", "Menu"]:
        problems.append(f"legpuzzel: end card on 16 pieces offers {labels}")
    page.click("#ov-buttons button >> text=Menu")
    page.wait_for_timeout(200)

    # 25 pieces, the fruit bowl: the end of the free part
    choose(page, ".puzzel-opt.size-p25")
    choose(page, ".puzzel-pic.pic-fruit")
    page.wait_for_function("window.__bubbels.puzzel.ready()", timeout=5000)
    page.wait_for_timeout(200)
    st = pz_state(page)
    small = min(page.evaluate("[...document.querySelectorAll('.ppiece')].map((c) => c.getBoundingClientRect().width)"))
    if len(st["placed"]) != 25 or small < 44 or st["zoomMax"] != 1:
        problems.append(f"legpuzzel: 25 pieces at 390x844: {len(st['placed'])} pieces, {small:.0f} px, magnifier {st['zoomMax']}")
    page.screenshot(path=str(SHOTS / "legpuzzel-25-start.png"))
    pz_finish(page, problems, "25 fruit")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / "legpuzzel-5-fruit-done.png"))
    if page.evaluate("window.__bubbels.puzzel.done()").get("fruit-p25") != 1:
        problems.append("legpuzzel: the 25-piece fruit bowl was not saved as laid")
    labels = page.locator("#ov-buttons button").all_inner_texts()
    if labels != ["Volgende plaatje", "Nog een keer", "Meer puzzels", "Menu"]:
        problems.append(f"legpuzzel: the end of the free part offers {labels}")
    page.click("#ov-buttons button >> text=Meer puzzels")
    page.wait_for_timeout(200)
    if page.locator("#ov-buttons button").all_inner_texts() != ["Oké"]:
        problems.append("legpuzzel: 'More puzzles' on the web offers more than OK")
    page.click("#ov-buttons button")
    page.wait_for_timeout(200)
    if not page.is_visible("#screen-legpuzzel-menu"):
        problems.append("legpuzzel: OK on the offer did not land on the menu")
    # the Android back button from a puzzle: its menu
    choose(page, ".puzzel-pic.pic-garden")
    page.wait_for_function("window.__bubbels.puzzel.ready()", timeout=5000)
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(200)
    if not page.is_visible("#screen-legpuzzel-menu"):
        problems.append("legpuzzel: the back button did not lead to the menu")
    if errors:
        problems.append(f"legpuzzel: page errors {errors[:3]}")
    ctx.close()


def legpuzzel_layouts(browser, base, problems):
    """Legpuzzel at 320x568, sideways 568x320 and 844x390, desktop, in English at 390x844; free 16
    and 25 pieces (25 at 320x568 offers the magnifier), the full version with 16, 30, 48 and 60 pieces: the board, every piece and the back button on screen, a piece
    with its tabs 44 px or more, the board and the tray apart, no sideways scroll; the last piece
    laid by a drag on each."""
    for w, h, owned, size, pic in ((320, 568, False, "p25", "fruit"), (568, 320, False, "p16", "garden"), (844, 390, False, "p25", "sea"), (1280, 800, False, "p9", "fruit"),
                                   (320, 568, True, "p30", "puppies"), (568, 320, True, "p30", "space"), (390, 844, True, "p16", "zoo"), (1280, 800, True, "p25", "meadow"),
                                   (320, 568, True, "p60", "street"), (568, 320, True, "p48", "fruit"), (1280, 800, True, "p60", "meadow")):
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
        label = f"{w}x{h} {size} {pic}"
        if english and page.inner_text("#tile-legpuzzel .tile-name").strip() != "Jigsaw":
            problems.append(f"legpuzzel {label}: English tile says {page.inner_text('#tile-legpuzzel .tile-name')!r}")
        page.click("#tile-legpuzzel")
        page.wait_for_timeout(200)
        page.evaluate(f"window.__bubbels.puzzel.chooseSize('{size}')")
        page.wait_for_timeout(100)
        page.screenshot(path=str(SHOTS / f"legpuzzel-menu-{w}x{h}{'-full' if owned else ''}.png"), full_page=True)
        wrapped = page.evaluate("""[...document.querySelectorAll('.puzzel-sizes .num, .puzzel-sizes .cell-sub')]
            .filter((el) => el.offsetParent && !el.hidden).map((el) => { const r = document.createRange(); r.selectNodeContents(el);
            return [el.textContent, new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size]; }).filter(([, n]) => n > 1)""")
        if wrapped:
            problems.append(f"legpuzzel {label}: size labels wrap over two lines: {wrapped}")
        choose(page, f".puzzel-pic.pic-{pic}")
        page.wait_for_function("window.__bubbels.puzzel.ready()", timeout=5000)
        page.wait_for_timeout(250)
        for sel in ("#legpuzzel-board", "#legpuzzel-back", "#legpuzzel-ghost", "#legpuzzel-status"):
            r = page.locator(sel).bounding_box()
            if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                problems.append(f"legpuzzel {label}: {sel} off screen ({r})")
        boxes = page.evaluate("[...document.querySelectorAll('.ppiece')].map((c) => { const r = c.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })")
        off = [i for i, (l, t_, r, b) in enumerate(boxes) if l < -0.5 or t_ < -0.5 or r > w + 0.5 or b > h + 0.5]
        if off:
            problems.append(f"legpuzzel {label}: pieces {off} off screen")
        small = min(r - l for l, t_, r, b in boxes)
        if small < 44:
            problems.append(f"legpuzzel {label}: a piece is only {small:.0f} px")
        board = page.locator("#legpuzzel-board").bounding_box()
        st = pz_state(page)
        half = st["s"] / 2
        on_board = [i for i, p in enumerate(st["at"]) if board["x"] + 2 < p["x"] < board["x"] + board["width"] - 2 and board["y"] + 2 < p["y"] < board["y"] + board["height"] - 2]
        if on_board:
            problems.append(f"legpuzzel {label}: pieces {on_board} start on the board")
        if page.evaluate("document.documentElement.scrollWidth") > w:
            problems.append(f"legpuzzel {label}: sideways scroll")
        # the magnifier only when the pieces are small (never for 9 or 16 pieces, never on a desktop;
        # 25 pieces at 320x568 is the smallest free case)
        zoom_shown = page.is_visible("#legpuzzel-zoom")
        if zoom_shown != (st["zoomMax"] > 1) or (zoom_shown and (not mobile or size in ("p9", "p16"))) or ((w, h, size) == (320, 568, "p25") and not zoom_shown):
            problems.append(f"legpuzzel {label}: magnifier shown {zoom_shown} (zoom {st['zoomMax']})")
        print(f"[legpuzzel {label}] piece {st['s']} px ({small:.0f} with tabs), {'side' if st['side'] else 'upright'}, magnifier {st['zoomMax']:.2f}")
        page.screenshot(path=str(SHOTS / f"legpuzzel-{w}x{h}{'-full' if owned else ''}.png"))
        k = page.evaluate("window.__bubbels.puzzel.free()")[0]
        pz_drag(page, st["at"][k], st["home"][k])
        page.wait_for_timeout(200)
        if not pz_state(page)["placed"][k]:
            problems.append(f"legpuzzel {label}: a drag to its place did not snap")
        if errors:
            problems.append(f"legpuzzel {label}: page errors {errors[:2]}")
        ctx.close()


def pz_view(page):
    return page.locator("#legpuzzel-stage").bounding_box()


def pz_inside(r, p, pad=0):
    return r["x"] + pad < p["x"] < r["x"] + r["width"] - pad and r["y"] + pad < p["y"] < r["y"] + r["height"] - pad


def pz_drag_zoomed(page, i):
    """A real drag of piece i through the magnifier: a piece out of view is first brought in by a finger
    on an empty spot; when its place is out of view, the finger holds the piece at the edge of the
    view in that direction until the view has moved there."""
    r = pz_view(page)
    for _ in range(3):  # the piece out of view: a finger on an empty spot brings it in first
        a = pz_state(page)["at"][i]
        if pz_inside(r, a, 4):
            break
        spot = pz_empty_spot(page)
        if not spot:
            break
        c = {"x": r["x"] + r["width"] / 2, "y": r["y"] + r["height"] / 2}
        pz_drag(page, spot, {"x": spot["x"] + c["x"] - a["x"], "y": spot["y"] + c["y"] - a["y"]})
        page.wait_for_timeout(150)
    a = pz_state(page)["at"][i]
    page.mouse.move(a["x"], a["y"])
    page.mouse.down()
    glided = False
    for _ in range(80):
        h = pz_state(page)["home"][i]
        if pz_inside(r, h, 4):
            break
        glided = True
        page.mouse.move(min(max(h["x"], r["x"] + 6), r["x"] + r["width"] - 6), min(max(h["y"], r["y"] + 6), r["y"] + r["height"] - 6), steps=4)
        page.wait_for_timeout(100)
    for _ in range(30):  # a place near the edge may move the view a little more: follow it
        h = pz_state(page)["home"][i]
        page.mouse.move(h["x"], h["y"], steps=3)
        page.wait_for_timeout(120)
        h2 = pz_state(page)["home"][i]
        if abs(h2["x"] - h["x"]) + abs(h2["y"] - h["y"]) < 1:
            break
    page.mouse.up()
    return glided


def pz_empty_spot(page):
    """A point in the view with no loose piece under it (a finger there moves the zoomed view)."""
    return page.evaluate("""() => {
      const r = document.querySelector('#legpuzzel-stage').getBoundingClientRect();
      for (let y = r.top + 20; y < r.bottom - 20; y += 9)
        for (let x = r.left + 20; x < r.right - 20; x += 9)
          if (!document.elementsFromPoint(x, y).some((e) => e.classList.contains('ppiece') && !e.classList.contains('placed'))) return { x, y };
      return null;
    }""")


def legpuzzel_big(browser, base, problems):
    """Legpuzzel 48 and 60 pieces in the full version on a phone, upright 390x844 (Dutch) and
    sideways 844x390 (English): the age on every size button; every piece on screen and 44 px or
    more; a real drag snaps without the magnifier; the magnifier makes a piece 60 px or more, a
    finger on an empty spot moves the view, a real drag through the magnifier (holding the piece at
    the edge until its place comes into view) snaps; the rest laid by the test hook but the last,
    which a real drag finishes: the end card, the puzzle saved through recordStars and ticked off;
    the magnifier stays on for the next puzzle."""
    ages_nl = ["vanaf 3 jaar", "vanaf 4 jaar", "vanaf 5 jaar", "vanaf 6 jaar", "vanaf 7 jaar", "vanaf 9 jaar"]
    ages_en = ["age 3+", "age 4+", "age 5+", "age 6+", "age 7+", "age 9+"]
    for w, h, size, pic, english in ((390, 844, "p60", "meadow", False), (844, 390, "p48", "street", True), (844, 390, "p60", "zoo", False), (390, 844, "p48", "puppies", True)):
        n = int(size[1:])
        ctx = browser.new_context(bypass_csp=True, locale="en-GB" if english else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        label = f"{w}x{h} {size} {pic}"
        page.click("#tile-legpuzzel")
        page.wait_for_timeout(200)
        subs = page.evaluate("[...document.querySelectorAll('.puzzel-sizes .cell-sub')].map((e) => e.textContent)")
        if subs != (ages_en if english else ages_nl):
            problems.append(f"legpuzzel {label}: the size buttons say {subs}")
        choose(page, f".puzzel-opt.size-{size}")
        page.wait_for_timeout(100)
        if page.get_attribute(f".puzzel-opt.size-{size}", "aria-pressed") != "true":
            problems.append(f"legpuzzel {label}: {size} not chosen")
        page.screenshot(path=str(SHOTS / f"legpuzzel-big-menu-{w}x{h}-{size}.png"), full_page=True)
        choose(page, f".puzzel-pic.pic-{pic}")
        page.wait_for_function("window.__bubbels.puzzel.ready()", timeout=8000)
        page.wait_for_timeout(250)
        st = pz_state(page)
        if len(st["placed"]) != n:
            problems.append(f"legpuzzel {label}: {len(st['placed'])} pieces")
        boxes = page.evaluate("[...document.querySelectorAll('.ppiece')].map((c) => { const r = c.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })")
        off = [i for i, (l, t_, r, b) in enumerate(boxes) if l < -0.5 or t_ < -0.5 or r > w + 0.5 or b > h + 0.5]
        small = min(r - l for l, t_, r, b in boxes)
        if off or small < 44:
            problems.append(f"legpuzzel {label}: pieces off screen {off}, smallest {small:.0f} px")
        if not page.is_visible("#legpuzzel-zoom") or page.get_attribute("#legpuzzel-zoom", "aria-pressed") != "false":
            problems.append(f"legpuzzel {label}: no magnifier (or it starts on)")
        page.screenshot(path=str(SHOTS / f"legpuzzel-big-{w}x{h}-{size}.png"))
        # a real drag without the magnifier
        k = page.evaluate("window.__bubbels.puzzel.free()")[0]
        pz_drag(page, st["at"][k], st["home"][k])
        page.wait_for_timeout(200)
        if not pz_state(page)["placed"][k]:
            problems.append(f"legpuzzel {label}: a drag to its place did not snap")
        # the magnifier
        page.click("#legpuzzel-zoom")
        page.wait_for_timeout(400)
        st = pz_state(page)
        if st["zoom"] <= 1 or st["s"] < 60 or page.get_attribute("#legpuzzel-zoom", "aria-pressed") != "true":
            problems.append(f"legpuzzel {label}: the magnifier gives {st['zoom']:.2f}x, a piece of {st['s']:.0f} px")
        if page.evaluate("document.documentElement.scrollWidth") > w or page.evaluate("document.documentElement.scrollHeight") > h:
            problems.append(f"legpuzzel {label}: the zoomed board makes the page scroll")
        for sel in ("#legpuzzel-back", "#legpuzzel-zoom", "#legpuzzel-ghost"):
            r = page.locator(sel).bounding_box()
            if not r or page.evaluate(f"document.elementFromPoint({r['x'] + r['width'] / 2}, {r['y'] + r['height'] / 2})?.closest('{sel}') === null"):
                problems.append(f"legpuzzel {label}: {sel} covered with the magnifier on")
        page.screenshot(path=str(SHOTS / f"legpuzzel-big-{w}x{h}-{size}-zoom.png"))
        # a finger on an empty spot moves the view
        spot = pz_empty_spot(page)
        if not spot:
            problems.append(f"legpuzzel {label}: no empty spot to move the view")
        else:
            before = pz_state(page)["home"][0]
            r = pz_view(page)
            to = {"x": r["x"] + r["width"] - spot["x"] + r["x"], "y": r["y"] + r["height"] - spot["y"] + r["y"]}  # across the middle
            pz_drag(page, spot, to)
            page.wait_for_timeout(150)
            after = pz_state(page)["home"][0]
            if abs(after["x"] - before["x"]) + abs(after["y"] - before["y"]) < 20:
                problems.append(f"legpuzzel {label}: a finger on an empty spot did not move the view ({before} -> {after})")
            if sum(pz_state(page)["placed"]) != 1:
                problems.append(f"legpuzzel {label}: moving the view laid or lost a piece")
            # the magnifier off and on again: back to the middle of the stage, where the tray is
            page.click("#legpuzzel-zoom")
            page.wait_for_timeout(350)
            page.click("#legpuzzel-zoom")
            page.wait_for_timeout(350)
        # a real drag through the magnifier, to a place that may be out of view
        st = pz_state(page)
        r = pz_view(page)
        free = page.evaluate("window.__bubbels.puzzel.free()")
        far = [i for i in free if not pz_inside(r, st["home"][i], 4)]
        if not free:
            problems.append(f"legpuzzel {label}: no loose piece in view with the magnifier on")
            ctx.close()
            continue
        k = (far or free)[0]
        glided = pz_drag_zoomed(page, k)
        page.wait_for_timeout(250)
        if not pz_state(page)["placed"][k]:
            problems.append(f"legpuzzel {label}: a drag through the magnifier did not snap (view moved: {glided})")
        if far and not glided:
            problems.append(f"legpuzzel {label}: the view did not move to a place out of view")
        print(f"[legpuzzel {label}] magnifier {st['zoom']:.2f}x, piece {st['s']:.0f} px; a drag to a place {'out of' if far else 'in'} view, the view moved along: {glided}")
        page.screenshot(path=str(SHOTS / f"legpuzzel-big-{w}x{h}-{size}-zoom-drag.png"))
        # the rest by the test hook, all but one; the last by a real drag
        st = pz_state(page)
        rest = [i for i in range(n) if not st["placed"][i]]
        for i in rest[:-1]:
            if not page.evaluate(f"window.__bubbels.puzzel.place({i})"):
                problems.append(f"legpuzzel {label}: the hook could not lay piece {i}")
                break
        page.wait_for_timeout(200)
        last = rest[-1]
        pz_drag_zoomed(page, last)
        page.wait_for_timeout(250)
        st = pz_state(page)
        if not st["over"]:
            problems.append(f"legpuzzel {label}: not done after the last piece: {sum(st['placed'])} of {n}")
        else:
            page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
            page.screenshot(path=str(SHOTS / f"legpuzzel-big-{w}x{h}-{size}-done.png"))
            key = f"{pic}-{size}"
            if page.evaluate("window.__bubbels.puzzel.done()").get(key) != 1:
                problems.append(f"legpuzzel {label}: {key} not saved: {page.evaluate('window.__bubbels.puzzel.done()')}")
            want = (f"{'Play again' if english else 'Nog een keer'}")
            page.click(f"#ov-buttons button >> text={want}")
            page.wait_for_function("window.__bubbels.puzzel.ready()", timeout=8000)
            page.wait_for_timeout(300)
            if page.get_attribute("#legpuzzel-zoom", "aria-pressed") != "true" or pz_state(page)["zoom"] <= 1:
                problems.append(f"legpuzzel {label}: the magnifier did not stay on for the next puzzle")
            page.click("#legpuzzel-back")
            page.wait_for_timeout(250)
            if not page.locator(f".puzzel-pic.pic-{pic}.done .check").count():
                problems.append(f"legpuzzel {label}: the menu does not tick off {key}")
        if errors:
            problems.append(f"legpuzzel {label}: page errors {errors[:2]}")
        ctx.close()


# ---------- Piano ----------

# Counts the oscillators the page starts, so the test can tell a key made a sound (or, with the
# sound off, did not).
COUNT_OSC = """
(() => {
  window.__osc = 0;
  for (const AC of [window.AudioContext, window.webkitAudioContext]) {
    if (!AC || AC.prototype.__counted) continue;
    const make = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () { window.__osc++; return make.call(this); };
    AC.prototype.__counted = true;
  }
})();
"""


def pi_state(page):
    return page.evaluate("window.__bubbels.piano.state()")


def pi_key_point(page, key, black=False):
    box = page.locator(f".pkey[data-key='{key}']").bounding_box()
    # a white key low down (under the black keys), a black key in its middle
    return {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] * (0.5 if black else 0.85)}


def pi_touch(cdp, kind, points):
    cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [dict(p, id=i + 1) for i, p in enumerate(points)]})


def piano_flow(browser, base, problems):
    """Piano at 390x844 with real touch: free play (a tap sounds, two fingers hold two keys, a slide
    plays every key it passes, a black key), a locked song offers only OK on the web and leaves the
    child on the list, Vader Jacob played along by tapping the glowing key with one wrong key first
    (the song waits), the end card with 3 stars saved and "More songs" (offer over the list), the
    listen button lighting keys and stopped by a tap, the sound setting followed, the back arrows and
    the Android back button."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(COUNT_OSC)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.inner_text("#tile-piano .tile-name").strip() != "Piano":
        problems.append(f"piano: tile says {page.inner_text('#tile-piano .tile-name')!r}")
    if page.evaluate("document.querySelector('#tile-piano').closest('.tile-group').querySelector('.group-name').textContent") != "Creatief":
        problems.append("piano: the tile is not in the Creatief section")
    page.click("#tile-piano")
    page.wait_for_timeout(250)
    st = pi_state(page)
    if where(page) != ["piano", False] or st["mode"] != "free" or page.inner_text("#piano-title") != "Vrij spelen":
        problems.append(f"piano: the tile opened {where(page)} in {st['mode']} ({page.inner_text('#piano-title')!r}), not free play")

    # a tap sounds
    osc = page.evaluate("window.__osc")
    page.locator(".pkey[data-key='e']").tap()
    page.wait_for_timeout(80)
    st = pi_state(page)
    if st["pressed"] != 1 or page.evaluate("window.__osc") <= osc:
        problems.append(f"piano: a tap on E pressed {st['pressed']} keys and started {page.evaluate('window.__osc') - osc} oscillators")
    # two fingers: two keys down at once, both sound
    pi_touch(cdp, "touchStart", [pi_key_point(page, "c"), pi_key_point(page, "g")])
    page.wait_for_timeout(60)
    st = pi_state(page)
    if sorted(st["down"]) != ["c", "g"] or st["pressed"] != 3:
        problems.append(f"piano: two fingers held {st['down']} ({st['pressed']} presses)")
    page.screenshot(path=str(SHOTS / "piano-flow-two-fingers.png"))
    pi_touch(cdp, "touchEnd", [])
    page.wait_for_timeout(60)
    if pi_state(page)["down"]:
        problems.append(f"piano: keys still down after the fingers left: {pi_state(page)['down']}")
    # a slide from C to G plays C D E F G
    a, b = pi_key_point(page, "c"), pi_key_point(page, "g")
    pi_touch(cdp, "touchStart", [a])
    for k in range(1, 13):
        pi_touch(cdp, "touchMove", [{"x": a["x"] + (b["x"] - a["x"]) * k / 12, "y": a["y"]}])
    pi_touch(cdp, "touchEnd", [])
    page.wait_for_timeout(60)
    st = pi_state(page)
    if st["pressed"] != 8 or st["down"]:
        problems.append(f"piano: a slide over five keys gave {st['pressed'] - 3} presses (down: {st['down']})")
    # a black key
    pi_touch(cdp, "touchStart", [pi_key_point(page, "fis", black=True)])
    page.wait_for_timeout(60)
    if pi_state(page)["down"] != ["fis"]:
        problems.append(f"piano: a touch on the black key between F and G held {pi_state(page)['down']}")
    pi_touch(cdp, "touchEnd", [])
    page.screenshot(path=str(SHOTS / "piano-flow-free-390x844.png"))

    # the song list; a locked song offers only OK on the web and stays on the list
    page.click("#piano-songs-btn")
    page.wait_for_timeout(200)
    page.screenshot(path=str(SHOTS / "piano-flow-songs-390x844.png"))
    locked = page.eval_on_selector_all(".piano-card.locked", "els => els.map(e => e.dataset.song)")
    if locked != ["kortjakje", "maan", "vreugde"]:
        problems.append(f"piano: locked songs on the web are {locked}")
    choose(page, ".piano-card[data-song='kortjakje']")
    page.wait_for_timeout(150)
    if card_buttons(page) != ["Oké"] or "Vader Jacob zijn gratis" not in page.inner_text("#ov-text"):
        problems.append(f"piano: a locked song offered {card_buttons(page)}: {page.inner_text('#ov-text')!r}")
    page.click("#ov-buttons button >> nth=0")
    landed(page, "piano locked song", "piano-songs", problems)

    # Vader Jacob: one wrong key first (the song waits), then every glowing key by a real tap
    choose(page, ".piano-card[data-song='jacob']")
    page.wait_for_timeout(200)
    st = pi_state(page)
    if st["mode"] != "song" or st["glow"] != ["c"] or page.inner_text("#piano-title") != "Vader Jacob":
        problems.append(f"piano: Vader Jacob opened as {st['mode']} with {st['glow']} glowing")
    page.locator(".pkey[data-key='a']").tap()
    page.wait_for_timeout(60)
    st = pi_state(page)
    if st["index"] != 0 or st["misses"] != 1 or st["glow"] != ["c"]:
        problems.append(f"piano: a wrong key moved the song to {st['index']} (misses {st['misses']}, glow {st['glow']})")
    n = st["length"]
    for i in range(n):
        st = pi_state(page)
        if len(st["glow"]) != 1 or st["glow"][0] != st["target"]:
            problems.append(f"piano: note {i}: glowing {st['glow']}, the song wants {st['target']}")
            break
        page.locator(".pkey.glow").tap()
        if i == 9:
            page.wait_for_timeout(120)
            page.screenshot(path=str(SHOTS / "piano-flow-song-390x844.png"))
    try:
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    except Exception:
        problems.append("piano: no end card after the last note of Vader Jacob")
    page.wait_for_timeout(600)  # the stars pop in one by one
    page.screenshot(path=str(SHOTS / "piano-song-done.png"))
    if page.inner_text("#ov-title") != "Super!" or card_buttons(page) != ["Meer liedjes", "Nog een keer", "Liedjes"]:
        problems.append(f"piano: end card {page.inner_text('#ov-title')!r} with {card_buttons(page)}")
    if page.evaluate("window.__bubbels.piano.stars()") != {"jacob": 3}:
        problems.append(f"piano: saved stars {page.evaluate('window.__bubbels.piano.stars()')}")
    if page.evaluate("window.__bubbels.save().games.piano") != {"stars": {"jacob": 3}}:
        problems.append(f"piano: the save has {page.evaluate('window.__bubbels.save().games.piano')}")
    # "More songs": the offer over the song list, OK lands on the list
    web_offer_ok(page, "piano more songs", "piano-songs", problems)
    if page.locator(".piano-card[data-song='jacob'] .piano-card-end svg.on").count() != 3:
        problems.append("piano: the list does not show Vader Jacob's 3 stars")

    # listen: the keys light up one after another, a tap stops it
    choose(page, ".piano-card[data-song='jacob']")
    page.wait_for_timeout(150)
    heard = pi_state(page)["heard"]
    page.click("#piano-listen")
    try:
        page.wait_for_function("window.__bubbels.piano.state().lit.length > 0", timeout=3000)
    except Exception:
        problems.append("piano: listen lit no key")
    page.wait_for_timeout(1500)
    st = pi_state(page)
    if not st["listening"] or st["heard"] - heard < 3 or st["glow"]:
        problems.append(f"piano: listening {st['listening']}, {st['heard'] - heard} notes heard, glow {st['glow']}")
    if page.get_attribute("#piano-listen", "aria-pressed") != "true":
        problems.append("piano: the listen button does not show Stop while it plays")
    page.wait_for_function("window.__bubbels.piano.state().lit.length > 0", timeout=3000)
    page.wait_for_timeout(60)  # the light comes on in a few frames
    page.screenshot(path=str(SHOTS / "piano-flow-listen-390x844.png"))
    # the app to the background: listening stops, no key stays lit or down
    hide = "Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))"
    back = "delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))"
    page.evaluate(hide)
    page.wait_for_timeout(100)
    st = pi_state(page)
    if st["listening"] or st["lit"]:
        problems.append(f"piano: in the background still listening {st['listening']}, lit {st['lit']}")
    page.evaluate(back)
    pi_touch(cdp, "touchStart", [pi_key_point(page, "g")])
    page.wait_for_timeout(60)
    held = pi_state(page)["down"]
    page.evaluate(hide)
    page.wait_for_timeout(60)
    if held != ["g"] or pi_state(page)["down"]:
        problems.append(f"piano: a held key ({held}) stayed down in the background: {pi_state(page)['down']}")
    pi_touch(cdp, "touchEnd", [])
    page.evaluate(back)
    page.click("#piano-listen")
    page.wait_for_function("window.__bubbels.piano.state().lit.length > 0", timeout=3000)
    page.locator(".pkey[data-key='c']").tap()
    page.wait_for_timeout(100)
    st = pi_state(page)
    if st["listening"] or st["lit"] or st["index"] != 1:
        problems.append(f"piano: a tap during listening left listening {st['listening']}, lit {st['lit']}, the song at {st['index']}")

    # back: the song goes to the list, the list to free play, free play home; the Android back the same
    page.click("#piano-back")
    page.wait_for_timeout(100)
    if where(page) != ["piano-songs", False]:
        problems.append(f"piano: back from a song landed on {where(page)}")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(100)
    if where(page) != ["piano", False] or pi_state(page)["mode"] != "free":
        problems.append(f"piano: Android back from the list landed on {where(page)} {pi_state(page)['mode']}")
    page.click("#piano-back")
    page.wait_for_timeout(100)
    if where(page) != ["home", False]:
        problems.append(f"piano: back from free play landed on {where(page)}")

    # the sound setting: off, the piano says so and plays nothing; its button turns it on again
    page.click("#btn-settings")
    page.click("[data-sound='off']")
    page.click("#screen-settings [data-go='home']")
    page.wait_for_timeout(150)
    page.click("#tile-piano")
    page.wait_for_timeout(150)
    if not page.is_visible("#piano-muted"):
        problems.append("piano: no word that the sound is off")
    page.screenshot(path=str(SHOTS / "piano-flow-muted-390x844.png"))
    osc = page.evaluate("window.__osc")
    page.locator(".pkey[data-key='d']").tap()
    page.wait_for_timeout(60)
    if page.evaluate("window.__osc") != osc:
        problems.append("piano: a key made a sound with the sound off")
    page.click("#piano-sound-on")
    page.wait_for_timeout(100)
    osc = page.evaluate("window.__osc")
    page.locator(".pkey[data-key='d']").tap()
    page.wait_for_timeout(60)
    if page.is_visible("#piano-muted") or page.evaluate("window.__osc") <= osc:
        problems.append("piano: 'Geluid aan' did not bring the sound back")
    if page.evaluate("window.__bubbels.save().settings.muted") is not False:
        problems.append("piano: 'Geluid aan' was not saved")
    if errors:
        problems.append(f"piano: page errors {errors[:2]}")
    if foreign:
        problems.append(f"piano: requests outside the app {foreign[:2]}")
    ctx.close()


def piano_layouts(browser, base, problems):
    """Piano on a small phone, sideways and on desktop, free play and a song: every key on screen,
    the coloured keys wide and tall enough for a small finger, no sideways scrolling; in English;
    and in the full version every song open."""
    for w, h, owned in ((320, 568, False), (360, 740, False), (568, 320, False), (844, 390, True), (390, 844, False), (1280, 800, False)):
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
        label = f"{w}x{h}{' full' if owned else ''}"
        page.click("#tile-piano")
        page.wait_for_timeout(250)
        song = "vreugde" if owned else "jacob"
        for mode in ("free", "song"):
            if mode == "song":
                page.click("#piano-songs-btn")
                page.wait_for_timeout(150)
                page.screenshot(path=str(SHOTS / f"piano-songs-{w}x{h}.png"), full_page=True)
                locked = page.locator(".piano-card.locked").count()
                if locked != (0 if owned else 3):
                    problems.append(f"piano {label}: {locked} songs locked")
                choose(page, f".piano-card[data-song='{song}']")
                page.wait_for_timeout(200)
                for k in range(3):
                    page.evaluate(f"window.__bubbels.piano.press(window.__bubbels.piano.state().target)")
                page.wait_for_timeout(150)
            keys = page.eval_on_selector_all(".pkey", "els => els.map(e => { const r = e.getBoundingClientRect(); return [e.dataset.key, e.classList.contains('white'), r.left, r.top, r.width, r.height]; })")
            for key, white, x, y, kw, kh in keys:
                if x < -0.5 or y < -0.5 or x + kw > w + 0.5 or y + kh > h + 0.5:
                    problems.append(f"piano {label} {mode}: key {key} off screen ({x:.0f},{y:.0f} {kw:.0f}x{kh:.0f})")
            whites = [k for k in keys if k[1]]
            narrow = min(k[4] for k in whites)
            short = min(k[5] for k in whites)
            print(f"[piano {label} {mode}] coloured keys {narrow:.0f}x{short:.0f} px, black {min(k[4] for k in keys if not k[1]):.0f} px")
            if narrow < (36 if w < 360 else (41 if w < 390 else 44)) or short < 120:
                problems.append(f"piano {label} {mode}: coloured keys only {narrow:.0f}x{short:.0f} px")
            if page.evaluate("document.documentElement.scrollWidth") > w:
                problems.append(f"piano {label} {mode}: the page scrolls sideways")
            for sel in ("#piano-back", "#piano-title") + (("#piano-listen", "#piano-strip") if mode == "song" else ("#piano-songs-btn",)):
                r = page.locator(sel).bounding_box()
                if not r or r["x"] < 0 or r["y"] < 0 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                    problems.append(f"piano {label} {mode}: {sel} not on screen ({r})")
            if mode == "song":
                bar = page.locator("#piano-songbar").bounding_box()
                top = min(k[3] for k in keys)
                if bar["y"] + bar["height"] > top:
                    problems.append(f"piano {label}: the notes strip runs into the keys")
                if page.locator("#piano-strip .pnote").count() < 4:
                    problems.append(f"piano {label}: the strip shows only {page.locator('#piano-strip .pnote').count()} notes")
            if english:
                want = {"free": "Free play", "song": "Frère Jacques"}[mode]
                if page.inner_text("#piano-title") != want:
                    problems.append(f"piano {label}: English title {page.inner_text('#piano-title')!r}, expected {want!r}")
            page.screenshot(path=str(SHOTS / f"piano-{mode}-{w}x{h}.png"))
        if errors:
            problems.append(f"piano {label}: page errors {errors[:2]}")
        ctx.close()


PI_IN_VIEW = """(k) => {
  if (document.querySelector('#piano-view').scrollLeft) return false;  // only the transform may move the keys
  const v = document.querySelector('#piano-view').getBoundingClientRect();
  const r = document.querySelector(`.pkey[data-key='${k}']`).getBoundingClientRect();
  return r.left >= v.left - 0.5 && r.right <= v.right + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5;
}"""
PI_STILL = "!document.getAnimations().some((a) => a.effect && a.effect.target && a.effect.target.id === 'piano-keys')"


def pi_play_big(page, label, problems, shot=None):
    """Play the open 7-10 song to its end by real taps on the glowing key, checking before every tap
    that the key is in the window (the keyboard follows the song). Returns the windows seen."""
    views = set()
    n = pi_state(page)["length"]
    for i in range(n):
        page.wait_for_function(PI_STILL, timeout=3000)
        st = pi_state(page)
        views.add(st["view"])
        if len(st["glow"]) != 1 or st["glow"][0] != st["target"]:
            problems.append(f"piano {label}: note {i}: glowing {st['glow']}, the song wants {st['target']}")
            return views
        if not page.evaluate(PI_IN_VIEW, st["target"]):
            problems.append(f"piano {label}: note {i} ({st['target']}) is out of sight (window {st['view']}+{st['visible']})")
            return views
        page.locator(".pkey.glow").tap()
        if shot and i == shot[0]:
            page.wait_for_function(PI_STILL, timeout=3000)
            page.wait_for_timeout(150)
            page.screenshot(path=str(SHOTS / shot[1]))
    return views


def piano_big(browser, base, problems):
    """The 7-10 piano. 390x844 on the web with real touch: the age buttons on the song list, the
    locked songs offer only OK, free play shows a window of 8 of the 15 coloured keys with the map
    and the turn line, the map moves the window, the whole Ode to Joy (free, with F#) played to the
    end by taps while the window follows, 3 stars and "More songs", the age kept after a reload, back
    to 4-6. In the full version: Fur Elise played to the end on 390x844 (black keys, the window
    following both ways) and listened to, and on 844x390 every key in sight with no map; the
    window at 320x568 and 568x320."""
    # ---- the web, upright
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(COUNT_OSC)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.click("#tile-piano")
    page.wait_for_timeout(200)
    if pi_state(page)["level"] != "small" or pi_state(page)["keys"] != 13:
        problems.append(f"piano big: a new player starts on {pi_state(page)['level']} with {pi_state(page)['keys']} keys")
    page.click("#piano-songs-btn")
    page.wait_for_timeout(150)
    ages = page.eval_on_selector_all(".piano-level", "els => els.map(e => [e.textContent, e.getAttribute('aria-pressed')])")
    if ages != [["4-6 jaar", "true"], ["7-10 jaar", "false"]]:
        problems.append(f"piano big: the age buttons are {ages}")
    small = min(page.eval_on_selector_all(".piano-level", "els => els.map(e => e.getBoundingClientRect().height)"))
    if small < 56:
        problems.append(f"piano big: the age buttons are only {small:.0f} px high")
    choose(page, ".piano-level[data-level='big']", tap=True)
    page.wait_for_timeout(150)
    page.screenshot(path=str(SHOTS / "piano-big-songs-390x844.png"))
    songs = page.eval_on_selector_all(".piano-card", "els => els.map(e => e.dataset.song)")
    locked = page.eval_on_selector_all(".piano-card.locked", "els => els.map(e => e.dataset.song)")
    if songs != ["free", "ode", "wilhelmus", "bergkoning", "turks", "elise"] or locked != ["wilhelmus", "bergkoning", "turks", "elise"]:
        problems.append(f"piano big: the 7-10 list is {songs}, locked {locked}")
    choose(page, ".piano-card[data-song='elise']")
    page.wait_for_timeout(150)
    if card_buttons(page) != ["Oké"] or "Ode aan de vreugde zijn gratis" not in page.inner_text("#ov-text"):
        problems.append(f"piano big: a locked 7-10 song offered {card_buttons(page)}: {page.inner_text('#ov-text')!r}")
    page.click("#ov-buttons button >> nth=0")
    landed(page, "piano big locked song", "piano-songs", problems)

    # free play: a window of 8 coloured keys, the map, the line to turn the phone
    choose(page, ".piano-card[data-song='free']")
    page.wait_for_timeout(250)
    st = pi_state(page)
    if st["mode"] != "free" or st["keys"] != 25 or st["visible"] != 8 or st["view"] != 0:
        problems.append(f"piano big: free play has {st['keys']} keys, {st['visible']} in sight from {st['view']}")
    if page.inner_text("#piano-sub") != "7\u201110\u00a0jaar":
        problems.append(f"piano big: the free play header says {page.inner_text('#piano-sub')!r}")
    if not page.is_visible("#piano-map") or not page.is_visible("#piano-turn"):
        problems.append("piano big: no map or no line to turn the phone on an upright phone")
    widths = page.eval_on_selector_all(".pkey.white", "els => els.map(e => e.getBoundingClientRect().width)")
    if min(widths) < 44:
        problems.append(f"piano big: coloured keys only {min(widths):.0f} px")
    if page.evaluate("document.documentElement.scrollWidth") > 390:
        problems.append("piano big: the page scrolls sideways")
    page.screenshot(path=str(SHOTS / "piano-big-free-390x844.png"))
    # the map: a finger slid to its right end shows the top keys, and the top C plays
    m = page.locator("#piano-map").bounding_box()
    y = m["y"] + m["height"] / 2
    pi_touch(cdp, "touchStart", [{"x": m["x"] + 20, "y": y}])
    for k in range(1, 9):
        pi_touch(cdp, "touchMove", [{"x": m["x"] + 20 + (m["width"] - 25) * k / 8, "y": y}])
    pi_touch(cdp, "touchEnd", [])
    page.wait_for_timeout(350)
    st = pi_state(page)
    if st["view"] != 7 or not page.evaluate(PI_IN_VIEW, "c6") or st["pressed"]:
        problems.append(f"piano big: the map slid to window {st['view']} (C6 in sight: {page.evaluate(PI_IN_VIEW, 'c6')}, keys pressed {st['pressed']})")
    osc = page.evaluate("window.__osc")
    page.locator(".pkey[data-key='c6']").tap()
    page.wait_for_timeout(60)
    if pi_state(page)["pressed"] != 1 or page.evaluate("window.__osc") <= osc:
        problems.append("piano big: the top C did not sound after sliding the map")
    page.screenshot(path=str(SHOTS / "piano-big-map-390x844.png"))
    # a finger holds the top C while another slides the map to the left end: the held finger lets
    # go of its key, and trembling on the key that slid under it plays nothing
    c6 = pi_key_point(page, "c6")
    pi_touch(cdp, "touchStart", [c6])
    page.wait_for_timeout(60)
    pi_touch(cdp, "touchStart", [c6, {"x": m["x"] + 4, "y": y}])
    page.wait_for_timeout(350)
    for dx in (3, -3, 2):
        pi_touch(cdp, "touchMove", [{"x": c6["x"] + dx, "y": c6["y"]}, {"x": m["x"] + 4, "y": y}])
        page.wait_for_timeout(30)
    st = pi_state(page)
    if st["view"] != 0 or st["pressed"] != 2 or st["down"]:
        problems.append(f"piano big: a finger held while the map moved: window {st['view']}, presses {st['pressed']} (want 2), down {st['down']}")
    pi_touch(cdp, "touchEnd", [])
    page.wait_for_timeout(60)

    # the whole Ode to Joy by taps; the window follows down to the low A and back up
    page.click("#piano-songs-btn")
    page.wait_for_timeout(150)
    choose(page, ".piano-card[data-song='ode']")
    page.wait_for_timeout(250)
    if pi_state(page)["song"] != "ode" or page.inner_text("#piano-sub") != "Liedjes \u00b7 7\u201110\u00a0jaar":
        problems.append(f"piano big: the Ode opened as {pi_state(page)['song']} under {page.inner_text('#piano-sub')!r}")
    # the map slides the glowing F# out of sight; a wrong key held down brings it back, but only
    # once the finger is lifted (the keys never slide under a finger)
    m = page.locator("#piano-map").bounding_box()
    pi_touch(cdp, "touchStart", [{"x": m["x"] + 4, "y": m["y"] + m["height"] / 2}])
    pi_touch(cdp, "touchEnd", [])
    page.wait_for_function(PI_STILL, timeout=3000)
    if pi_state(page)["view"] != 0 or page.evaluate(PI_IN_VIEW, "fis5"):
        problems.append(f"piano big: the map did not slide the Ode's first key away (window {pi_state(page)['view']})")
    c4 = pi_key_point(page, "c4")
    p0 = pi_state(page)["pressed"]
    pi_touch(cdp, "touchStart", [c4])
    page.wait_for_timeout(350)
    pi_touch(cdp, "touchMove", [{"x": c4["x"] + 3, "y": c4["y"]}])
    page.wait_for_timeout(30)
    st = pi_state(page)
    if st["misses"] != 1 or st["view"] != 0 or st["pressed"] != p0 + 1:
        problems.append(f"piano big: a held wrong key: misses {st['misses']}, window {st['view']} while held, presses {st['pressed'] - p0}")
    pi_touch(cdp, "touchEnd", [])
    page.wait_for_timeout(60)
    page.wait_for_function(PI_STILL, timeout=3000)
    if not page.evaluate(PI_IN_VIEW, "fis5") or pi_state(page)["glow"] != ["fis5"]:
        problems.append(f"piano big: after a wrong key the glowing F# is not back in sight (window {pi_state(page)['view']})")
    views = pi_play_big(page, "big ode", problems, shot=(20, "piano-big-song-390x844.png"))
    if len(views) < 2:
        problems.append(f"piano big: the window never moved during the Ode ({views})")
    try:
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    except Exception:
        problems.append(f"piano big: no end card after the Ode ({pi_state(page)})")
        ctx.close()
        return
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "piano-big-done-390x844.png"))
    if page.inner_text("#ov-title") != "Super!" or card_buttons(page) != ["Meer liedjes", "Nog een keer", "Liedjes"]:
        problems.append(f"piano big: Ode end card {page.inner_text('#ov-title')!r} with {card_buttons(page)}")
    if page.evaluate("window.__bubbels.save().games.piano") != {"stars": {"ode": 3}, "level": "big"}:
        problems.append(f"piano big: the save has {page.evaluate('window.__bubbels.save().games.piano')}")
    if "Wilhelmus" not in page.inner_text("#ov-text") and "volledige versie" not in page.inner_text("#ov-text"):
        problems.append(f"piano big: the end card says {page.inner_text('#ov-text')!r}")
    web_offer_ok(page, "piano big more songs", "piano-songs", problems)
    if page.locator(".piano-card[data-song='ode'] .piano-card-end svg.on").count() != 3:
        problems.append("piano big: the list does not show the Ode's 3 stars")

    # the age is kept: after a reload the tile opens the 7-10 piano
    page.reload()
    page.wait_for_selector("html[data-ready='1']")
    page.click("#tile-piano")
    page.wait_for_timeout(250)
    st = pi_state(page)
    if st["level"] != "big" or st["keys"] != 25:
        problems.append(f"piano big: after a reload the piano is {st['level']} with {st['keys']} keys")
    # and back to 4-6: the toy piano as before, no map
    page.click("#piano-songs-btn")
    page.wait_for_timeout(150)
    choose(page, ".piano-level[data-level='small']", tap=True)
    page.wait_for_timeout(150)
    songs = page.eval_on_selector_all(".piano-card", "els => els.map(e => e.dataset.song)")
    choose(page, ".piano-card[data-song='free']")
    page.wait_for_timeout(250)
    st = pi_state(page)
    if songs != ["free", "jacob", "kortjakje", "maan", "vreugde"] or st["keys"] != 13 or page.is_visible("#piano-map") or page.is_visible("#piano-turn"):
        problems.append(f"piano big: back on 4-6 the list is {songs}, {st['keys']} keys, map {page.is_visible('#piano-map')}")
    if page.inner_text("#piano-sub") != "Piano" or page.evaluate("window.__bubbels.save().games.piano.level") != "small":
        problems.append(f"piano big: back on 4-6 the header says {page.inner_text('#piano-sub')!r}")
    if errors:
        problems.append(f"piano big: page errors {errors[:2]}")
    if foreign:
        problems.append(f"piano big: requests outside the app {foreign[:2]}")
    ctx.close()

    # ---- the full version: Fur Elise upright, then sideways and small screens
    for w, h in ((390, 844), (844, 390), (320, 568), (568, 320)):
        label = f"big {w}x{h} full"
        ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        page.click("#tile-piano")
        page.wait_for_timeout(200)
        page.click("#piano-songs-btn")
        page.wait_for_timeout(150)
        choose(page, ".piano-level[data-level='big']", tap=True)
        page.wait_for_timeout(150)
        if page.locator(".piano-card.locked").count():
            problems.append(f"piano {label}: songs locked in the full version")
        choose(page, ".piano-card[data-song='elise']")
        page.wait_for_timeout(250)
        st = pi_state(page)
        whites = page.eval_on_selector_all(".pkey.white", "els => els.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.width, r.height]; })")
        seen = [x for x in whites if x[0] >= -0.5 and x[1] <= w + 0.5]
        narrow = min(x[2] for x in whites)
        short = min(x[3] for x in whites)
        print(f"[piano {label}] {st['visible']} of 15 coloured keys in sight, {narrow:.0f}x{short:.0f} px, map {page.is_visible('#piano-map')}")
        if narrow < (41.5 if w < 360 else 44) or short < 120:
            problems.append(f"piano {label}: coloured keys only {narrow:.0f}x{short:.0f} px")
        if len(seen) != st["visible"]:
            problems.append(f"piano {label}: {len(seen)} coloured keys on screen, the window says {st['visible']}")
        if page.evaluate("document.documentElement.scrollWidth") > w:
            problems.append(f"piano {label}: the page scrolls sideways")
        if (w, h) == (844, 390):
            if st["visible"] != 15 or page.is_visible("#piano-map") or page.is_visible("#piano-turn"):
                problems.append(f"piano {label}: sideways {st['visible']} keys in sight, map {page.is_visible('#piano-map')}")
        elif not page.is_visible("#piano-map") or page.is_visible("#piano-turn") != (h > w):
            problems.append(f"piano {label}: map {page.is_visible('#piano-map')}, turn line {page.is_visible('#piano-turn')}")
        for sel in ("#piano-back", "#piano-title", "#piano-listen", "#piano-strip"):
            r = page.locator(sel).bounding_box()
            if not r or r["x"] < 0 or r["y"] < 0 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                problems.append(f"piano {label}: {sel} not on screen ({r})")
        bar = page.locator("#piano-songbar").bounding_box()
        top = page.locator("#piano-view").bounding_box()["y"]
        if bar["y"] + bar["height"] > top:
            problems.append(f"piano {label}: the notes strip runs into the keys")
        if (w, h) in ((390, 844), (844, 390)):
            views = pi_play_big(page, label, problems, shot=(12, f"piano-big-elise-{w}x{h}.png"))
            try:
                page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
            except Exception:
                problems.append(f"piano {label}: no end card after Fur Elise")
            st = pi_state(page)
            if st["misses"] != 0 or page.evaluate("window.__bubbels.piano.stars()").get("elise") != 3:
                problems.append(f"piano {label}: Fur Elise ended with {st['misses']} misses, stars {page.evaluate('window.__bubbels.piano.stars()')}")
            if card_buttons(page) != ["Nog een keer", "Liedjes"]:
                problems.append(f"piano {label}: the last song's end card has {card_buttons(page)}")
            if w < h and len(views) < 2:
                problems.append(f"piano {label}: the window never moved during Fur Elise ({views})")
            page.click("#ov-buttons button >> nth=0")  # again
            page.wait_for_timeout(200)
            # listening: every key that lights up is in sight
            page.click("#piano-listen")
            outside = []
            for k in range(12):
                page.wait_for_timeout(180)
                page.wait_for_function(PI_STILL, timeout=3000)
                for key in pi_state(page)["lit"]:
                    if not page.evaluate(PI_IN_VIEW, key):
                        outside.append(key)
            if outside:
                problems.append(f"piano {label}: listening lit keys out of sight: {outside}")
            page.click("#piano-listen")
        else:
            page.screenshot(path=str(SHOTS / f"piano-big-{w}x{h}.png"))
        if errors:
            problems.append(f"piano {label}: page errors {errors[:2]}")
        ctx.close()


# ---------- Drumstel ----------


def dr_state(page):
    return page.evaluate("window.__bubbels.drums.state()")


def dr_point(page, pad):
    box = page.locator(f".dpad[data-pad='{pad}']").bounding_box()
    return {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}


def dr_wait(page, cond, timeout=6000):
    page.wait_for_function(f"(() => {{ const s = window.__bubbels.drums.state(); return {cond}; }})()", timeout=timeout)


def drums_flow(browser, base, problems):
    """Drumstel at 390x844 with real touch: the tile in Creatief opens free play, a tap sounds, two
    fingers hit two pads at once; a locked rhythm offers only OK on the web and leaves the child on
    the list; Rock (4-6) played to the end by tapping the glowing pad after the count-in, with one
    wrong pad first (the rhythm waits), 3 stars saved and "More rhythms" (the offer over the list);
    Rock (7-10) played on the beat with two fingers at once; Listen lights the pads and stops in the
    background, no pad stays down there; the back arrows and the Android back button; the sound
    setting followed."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(COUNT_OSC)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.inner_text("#tile-drums .tile-name").strip() != "Drumstel":
        problems.append(f"drums: tile says {page.inner_text('#tile-drums .tile-name')!r}")
    if page.evaluate("document.querySelector('#tile-drums').closest('.tile-group').querySelector('.group-name').textContent") != "Creatief":
        problems.append("drums: the tile is not in the Creatief section")
    page.locator("#tile-drums").scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / "drums-flow-home-390x844.png"))
    page.click("#tile-drums")
    page.wait_for_timeout(250)
    st = dr_state(page)
    if where(page) != ["drums", False] or st["mode"] != "free" or page.inner_text("#drums-title") != "Vrij spelen":
        problems.append(f"drums: the tile opened {where(page)} in {st['mode']} ({page.inner_text('#drums-title')!r}), not free play")

    # a tap sounds
    osc = page.evaluate("window.__osc")
    page.locator(".dpad[data-pad='kick']").tap()
    page.wait_for_timeout(80)
    st = dr_state(page)
    if st["hits"] != 1 or page.evaluate("window.__osc") <= osc:
        problems.append(f"drums: a tap on the kick hit {st['hits']} pads and started {page.evaluate('window.__osc') - osc} oscillators")
    # two fingers: two pads down at once, both sound
    osc = page.evaluate("window.__osc")
    pi_touch(cdp, "touchStart", [dr_point(page, "snare"), dr_point(page, "hihat")])
    page.wait_for_timeout(60)
    st = dr_state(page)
    if sorted(st["down"]) != ["hihat", "snare"] or st["hits"] != 3 or page.evaluate("window.__osc") <= osc:
        problems.append(f"drums: two fingers held {st['down']} ({st['hits']} hits)")
    page.screenshot(path=str(SHOTS / "drums-flow-two-fingers.png"))
    pi_touch(cdp, "touchEnd", [])
    page.wait_for_timeout(60)
    if dr_state(page)["down"]:
        problems.append(f"drums: pads still down after the fingers left: {dr_state(page)['down']}")
    page.screenshot(path=str(SHOTS / "drums-flow-free-390x844.png"))

    # the rhythm list; a locked rhythm offers only OK on the web and stays on the list
    page.click("#drums-list-btn")
    page.wait_for_timeout(200)
    page.screenshot(path=str(SHOTS / "drums-flow-list-390x844.png"), full_page=True)
    locked = page.eval_on_selector_all(".drums-card.locked", "els => els.map(e => e.dataset.rhythm)")
    if locked != ["mars1", "jacob1", "paard1", "mars2", "jacob2", "disco2"]:
        problems.append(f"drums: locked rhythms on the web are {locked}")
    choose(page, ".drums-card[data-rhythm='jacob1']")
    page.wait_for_timeout(150)
    if card_buttons(page) != ["Oké"] or "gratis" not in page.inner_text("#ov-text"):
        problems.append(f"drums: a locked rhythm offered {card_buttons(page)}: {page.inner_text('#ov-text')!r}")
    page.click("#ov-buttons button >> nth=0")
    landed(page, "drums locked rhythm", "drums-list", problems)

    # Rock (4-6): Begin, the count-in, one wrong pad (the rhythm waits), then every glowing pad by a tap
    choose(page, ".drums-card[data-rhythm='rock1']")
    page.wait_for_timeout(200)
    st = dr_state(page)
    if st["phase"] != "ready" or not page.is_visible("#drums-go") or page.inner_text("#drums-title") != "Rock":
        problems.append(f"drums: Rock opened in phase {st['phase']} (Begin shown: {page.is_visible('#drums-go')})")
    page.screenshot(path=str(SHOTS / "drums-flow-ready-390x844.png"))
    page.click("#drums-go")
    try:
        dr_wait(page, "s.count === 2", 3000)
        page.screenshot(path=str(SHOTS / "drums-flow-count-390x844.png"))
        dr_wait(page, "s.phase === 'play' && s.glow.length === 1", 4000)
    except Exception:
        problems.append(f"drums: no count-in and glow after Begin: {dr_state(page)}")
    page.locator(".dpad[data-pad='crash']").tap()
    page.wait_for_timeout(60)
    st = dr_state(page)
    if st["index"] != 0 or st["misses"] != 1 or st["glow"] != ["kick"]:
        problems.append(f"drums: a wrong pad moved the rhythm to {st['index']} (misses {st['misses']}, glow {st['glow']})")
    n = st["length"]
    for i in range(n):
        try:
            dr_wait(page, f"s.done || (s.index === {i} && s.glow.length === 1)", 4000)
        except Exception:
            problems.append(f"drums: step {i} never glowed: {dr_state(page)}")
            break
        st = dr_state(page)
        if st["glow"] != st["target"]:
            problems.append(f"drums: step {i}: glowing {st['glow']}, the rhythm wants {st['target']}")
            break
        page.locator(".dpad.glow").tap()
        if i == 5:
            page.wait_for_timeout(100)
            page.screenshot(path=str(SHOTS / "drums-flow-rhythm-390x844.png"))
    try:
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    except Exception:
        problems.append("drums: no end card after the last step of Rock")
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "drums-flow-done.png"))
    if page.inner_text("#ov-title") != "Super!" or card_buttons(page) != ["Meer ritmes", "Nog een keer", "Ritmes"]:
        problems.append(f"drums: end card {page.inner_text('#ov-title')!r} with {card_buttons(page)}")
    if page.evaluate("window.__bubbels.drums.stars()") != {"rock1": 3}:
        problems.append(f"drums: saved stars {page.evaluate('window.__bubbels.drums.stars()')}")
    web_offer_ok(page, "drums more rhythms", "drums-list", problems)
    if page.locator(".drums-card[data-rhythm='rock1'] .drums-card-end svg.on").count() != 3:
        problems.append("drums: the list does not show Rock's 3 stars")

    # Rock (7-10) on the beat: a ring closes in, both pads of a pair tapped at once with two fingers
    choose(page, ".drums-card[data-rhythm='rock2']")
    page.wait_for_timeout(150)
    page.click("#drums-go")
    shot = False
    t_end = time.time() + 25
    while time.time() < t_end:
        st = dr_state(page)
        if st["phase"] == "done" or where(page)[1]:
            break
        if st["glow"] and st["dueIn"] is not None and st["dueIn"] < 30:
            if not shot and len(st["glow"]) == 2:
                page.screenshot(path=str(SHOTS / "drums-flow-beat-390x844.png"))
                shot = True
            pi_touch(cdp, "touchStart", [dr_point(page, p) for p in st["glow"]])
            pi_touch(cdp, "touchEnd", [])
            page.wait_for_timeout(40)
        else:
            page.wait_for_timeout(8)
    try:
        page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    except Exception:
        problems.append(f"drums: no end card after Rock on the beat: {dr_state(page)}")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "drums-flow-beat-done.png"))
    got = page.evaluate("window.__bubbels.drums.stars()").get("rock2", 0)
    print(f"[drums] Rock on the beat by real taps: {dr_state(page)['good']} of {dr_state(page)['length']} in time, {got} stars")
    if got < 2:
        problems.append(f"drums: Rock on the beat by taps on time gave {got} stars ({dr_state(page)['good']} of {dr_state(page)['length']})")
    if card_buttons(page) != ["Meer ritmes", "Nog een keer", "Ritmes"]:
        problems.append(f"drums: end card on the beat with {card_buttons(page)}")
    page.click("#ov-buttons button >> nth=2")  # Ritmes
    page.wait_for_timeout(150)

    # listen: the count-in, then the pads light up one after another; the background stops it
    choose(page, ".drums-card[data-rhythm='rock1']")
    page.wait_for_timeout(150)
    page.click("#drums-listen")
    try:
        dr_wait(page, "s.lit.length > 0", 5000)
    except Exception:
        problems.append("drums: listen lit no pad")
    page.wait_for_timeout(1200)
    st = dr_state(page)
    if not st["listening"] or st["heard"] < 2 or st["glow"] or page.is_visible("#drums-go"):
        problems.append(f"drums: listening {st['listening']}, {st['heard']} steps heard, glow {st['glow']}")
    if page.get_attribute("#drums-listen", "aria-pressed") != "true":
        problems.append("drums: the listen button does not show Stop while it plays")
    dr_wait(page, "s.lit.length > 0", 3000)
    page.wait_for_timeout(40)
    page.screenshot(path=str(SHOTS / "drums-flow-listen-390x844.png"))
    hide = "Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))"
    back = "delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))"
    page.evaluate(hide)
    page.wait_for_timeout(100)
    st = dr_state(page)
    if st["listening"] or st["lit"]:
        problems.append(f"drums: in the background still listening {st['listening']}, lit {st['lit']}")
    page.evaluate(back)
    # playing along, then the background: back to Begin, and no pad stays down
    page.click("#drums-go")
    dr_wait(page, "s.phase === 'count'", 2000)
    pi_touch(cdp, "touchStart", [dr_point(page, "floor")])
    page.wait_for_timeout(60)
    held = dr_state(page)["down"]
    page.evaluate(hide)
    page.wait_for_timeout(60)
    st = dr_state(page)
    if held != ["floor"] or st["down"] or st["phase"] != "ready" or st["count"]:
        problems.append(f"drums: in the background a held pad ({held}) stayed down {st['down']}, phase {st['phase']}, count {st['count']}")
    pi_touch(cdp, "touchEnd", [])
    page.evaluate(back)
    page.wait_for_timeout(100)
    if not page.is_visible("#drums-go"):
        problems.append("drums: no Begin after coming back from the background")

    # back: the rhythm goes to the list, the list to free play, free play home; the Android back the same
    page.click("#drums-back")
    page.wait_for_timeout(100)
    if where(page) != ["drums-list", False]:
        problems.append(f"drums: back from a rhythm landed on {where(page)}")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(100)
    if where(page) != ["drums", False] or dr_state(page)["mode"] != "free":
        problems.append(f"drums: Android back from the list landed on {where(page)} {dr_state(page)['mode']}")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(100)
    if where(page) != ["home", False]:
        problems.append(f"drums: Android back from free play landed on {where(page)}")

    # the sound setting: off, the kit says so and plays nothing; its button turns it on again
    page.click("#btn-settings")
    page.click("[data-sound='off']")
    page.click("#screen-settings [data-go='home']")
    page.wait_for_timeout(150)
    page.click("#tile-drums")
    page.wait_for_timeout(150)
    if not page.is_visible("#drums-muted"):
        problems.append("drums: no word that the sound is off")
    page.screenshot(path=str(SHOTS / "drums-flow-muted-390x844.png"))
    osc = page.evaluate("window.__osc")
    page.locator(".dpad[data-pad='tom1']").tap()
    page.wait_for_timeout(60)
    if page.evaluate("window.__osc") != osc:
        problems.append("drums: a pad made a sound with the sound off")
    page.click("#drums-sound-on")
    page.wait_for_timeout(100)
    osc = page.evaluate("window.__osc")
    page.locator(".dpad[data-pad='tom1']").tap()
    page.wait_for_timeout(60)
    if page.is_visible("#drums-muted") or page.evaluate("window.__osc") <= osc:
        problems.append("drums: 'Geluid aan' did not bring the sound back")
    if errors:
        problems.append(f"drums: page errors {errors[:2]}")
    if foreign:
        problems.append(f"drums: requests outside the app {foreign[:2]}")
    ctx.close()


def music_bars(browser, base, problems, game):
    """Piano and Drumstel on the shell's bar (phase 2): with every song or rhythm (the longest
    names too) the bar stays 100 px or less at 320x568, in Dutch and English, so the keys and pads
    keep their room. Full version, so every one can be opened."""
    btn, card, key = {"piano": ("#piano-songs-btn", ".piano-card", "song"), "drums": ("#drums-list-btn", ".drums-card", "rhythm")}[game]
    for lang in ("nl", "en"):
        ctx = browser.new_context(bypass_csp=True, locale="nl-NL" if lang == "nl" else "en-GB", viewport={"width": 320, "height": 568}, has_touch=True, is_mobile=True)
        ctx.add_init_script(OWNED_APP)
        ctx.add_init_script("localStorage.setItem('bubbels.settings.v1', JSON.stringify({muted: true, lang: '%s'}))" % lang)
        page = ctx.new_page()
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        page.locator(f"#tile-{game}").scroll_into_view_if_needed()
        page.click(f"#tile-{game}")
        page.wait_for_timeout(300)
        page.click(btn)
        page.wait_for_timeout(200)
        levels = page.eval_on_selector_all(".piano-level", "els => els.map((e) => e.dataset.level)") or [None]
        worst = (0, "")
        for level in levels:
            if level:
                page.click(f".piano-level[data-level='{level}']")
                page.wait_for_timeout(150)
            ids = page.eval_on_selector_all(f"{card}:not(.lead)", f"els => els.map((e) => e.dataset.{key})")
            for rid in ids:
                page.click(f"{card}[data-{key}='{rid}']")
                page.wait_for_timeout(200)
                hud = page.locator(f".{game}-hud").bounding_box()
                title = page.inner_text(f"#{game}-title")
                if hud["height"] > worst[0]:
                    worst = (hud["height"], title)
                page.click(f"#{game}-back")
                page.wait_for_timeout(150)
                if not page.is_visible(card):
                    page.click(btn)
                    page.wait_for_timeout(150)
                if level and page.get_attribute(f".piano-level[data-level='{level}']", "aria-pressed") != "true":
                    page.click(f".piano-level[data-level='{level}']")
                    page.wait_for_timeout(150)
        if worst[0] > 100:
            problems.append(f"{game} 320x568 {lang}: the bar is {worst[0]:.0f} px high with {worst[1]!r} (100 at most)")
        print(f"[{game} 320x568 {lang}] highest bar {worst[0]:.0f} px ({worst[1]!r})")
        ctx.close()


def piano_bars(browser, base, problems):
    music_bars(browser, base, problems, "piano")


def drums_bars(browser, base, problems):
    music_bars(browser, base, problems, "drums")


def drums_layouts(browser, base, problems):
    """Drumstel on a small phone, an ordinary phone (in English), sideways and on desktop, free play
    and a rhythm: the pads stand like a real drum kit (never the plain grid at these sizes), every
    pad on screen, big enough for a small hand, none overlapping, the bar above the kit, Begin on
    screen, no sideways scrolling; in the full version every rhythm open."""
    for w, h, owned in ((320, 568, False), (390, 844, False), (844, 390, True), (568, 320, False), (1280, 800, False)):
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
        label = f"{w}x{h}{' full' if owned else ''}"
        page.click("#tile-drums")
        page.wait_for_timeout(250)
        rhythm = "jacob2" if owned else "rock1"
        for mode in ("free", "rhythm"):
            if mode == "rhythm":
                page.click("#drums-list-btn")
                page.wait_for_timeout(150)
                page.screenshot(path=str(SHOTS / f"drums-list-{w}x{h}.png"), full_page=True)
                locked = page.locator(".drums-card.locked").count()
                if locked != (0 if owned else 6):
                    problems.append(f"drums {label}: {locked} rhythms locked")
                choose(page, f".drums-card[data-rhythm='{rhythm}']")
                page.wait_for_timeout(200)
                go = page.locator("#drums-go").bounding_box()
                if not go or go["x"] < 0 or go["y"] < 0 or go["x"] + go["width"] > w or go["y"] + go["height"] > h:
                    problems.append(f"drums {label}: Begin not on screen ({go})")
                page.screenshot(path=str(SHOTS / f"drums-ready-{w}x{h}.png"))
                page.click("#drums-go")
                page.wait_for_function("window.__bubbels.drums.state().phase === 'play' && window.__bubbels.drums.state().glow.length > 0", timeout=6000)
                page.wait_for_timeout(120)
            pads = page.eval_on_selector_all(".dpad", "els => els.map(e => { const r = e.getBoundingClientRect(); const f = e.querySelector('.dpad-face').getBoundingClientRect(); return [e.dataset.pad, r.left, r.top, r.width, r.height, f.width, f.height]; })")
            for pad, x, y, pw, ph, fw, fh in pads:
                if x < -0.5 or y < -0.5 or x + pw > w + 0.5 or y + ph > h + 0.5:
                    problems.append(f"drums {label} {mode}: pad {pad} off screen ({x:.0f},{y:.0f} {pw:.0f}x{ph:.0f})")
                if fw > pw + 0.5 or fh > ph + 0.5:
                    problems.append(f"drums {label} {mode}: the drawn {pad} ({fw:.0f}) is bigger than its pad ({pw:.0f}x{ph:.0f})")
            for i in range(len(pads)):
                for j in range(i + 1, len(pads)):
                    a, b = pads[i], pads[j]
                    if not (a[1] + a[3] <= b[1] + 0.5 or b[1] + b[3] <= a[1] + 0.5 or a[2] + a[4] <= b[2] + 0.5 or b[2] + b[4] <= a[2] + 0.5):
                        problems.append(f"drums {label} {mode}: {a[0]} and {b[0]} overlap")
            small = min(min(p[3], p[4]) for p in pads)
            face = min(p[5] for p in pads)
            print(f"[drums {label} {mode}] {page.evaluate('window.__bubbels.drums.state().shape')}: pads at least {small:.0f} px, drawn {face:.0f} px")
            if small < 80 or face < 70:
                problems.append(f"drums {label} {mode}: pads only {small:.0f} px (drawn {face:.0f})")
            # it looks like a real kit: the kick lowest and in the middle, the toms on it, the cymbals
            # above, the hi-hat on the left and the floor tom on the right, with the stands drawn
            box = {p[0]: p[1:5] for p in pads}
            mx = lambda k: box[k][0] + box[k][2] / 2
            low = lambda k: box[k][1] + box[k][3]
            kit_ok = (
                all(low(k) <= low("kick") + 0.5 for k in box)
                and mx("tom1") < mx("kick") < mx("tom2")
                and max(low("tom1"), low("tom2")) <= box["kick"][1] + 0.5
                and box["crash"][1] < box["hihat"][1] and box["ride"][1] < box["floor"][1]
                and mx("hihat") == min(mx(k) for k in box)
                and mx("hihat") < mx("snare") <= mx("kick") < mx("floor")
            )
            if not kit_ok:
                problems.append(f"drums {label} {mode}: the pads do not stand like a drum kit: {box}")
            # the whole touch area hits, corners too (the kick's feet): no rounded button drops a tap
            missed = page.evaluate("""() => [...document.querySelectorAll('.dpad')].flatMap((el) => {
                const r = el.getBoundingClientRect();
                return [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]]
                    .filter(([x, y]) => document.elementFromPoint(x, y)?.closest('.dpad') !== el)
                    .map(([x, y]) => `${el.dataset.pad} ${Math.round(x)},${Math.round(y)}`);
            })""")
            if missed:
                problems.append(f"drums {label} {mode}: a tap in a pad's corner misses it: {missed[:4]}")
            kit_box = page.locator("#drums-kit").bounding_box()
            if abs(max(p[2] + p[4] for p in pads) - (kit_box["y"] + kit_box["height"])) > 1:
                problems.append(f"drums {label} {mode}: the kit does not stand on the bottom of its box")
            if page.locator(".drums-stands svg path").count() < 2:
                problems.append(f"drums {label} {mode}: no stands drawn behind the kit")
            want = "wide" if w > h else "tall"
            if page.evaluate("window.__bubbels.drums.state().shape") != want:
                problems.append(f"drums {label} {mode}: the kit is {page.evaluate('window.__bubbels.drums.state().shape')}, expected {want}")
            if page.evaluate("document.documentElement.scrollWidth") > w:
                problems.append(f"drums {label} {mode}: the page scrolls sideways")
            for sel in ("#drums-back", "#drums-title") + (("#drums-listen", "#drums-strip") if mode == "rhythm" else ("#drums-list-btn",)):
                r = page.locator(sel).bounding_box()
                if not r or r["x"] < 0 or r["y"] < 0 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                    problems.append(f"drums {label} {mode}: {sel} not on screen ({r})")
            if mode == "rhythm":
                bar = page.locator("#drums-bar").bounding_box()
                top = min(p[2] for p in pads)
                if bar["y"] + bar["height"] > top + 0.5:
                    problems.append(f"drums {label}: the strip runs into the kit")
                if page.locator("#drums-strip .dstep").count() < 4:
                    problems.append(f"drums {label}: the strip shows only {page.locator('#drums-strip .dstep').count()} steps")
            if english:
                want = {"free": "Free play", "rhythm": "Rock"}[mode]
                if page.inner_text("#drums-title") != want or page.inner_text("#tile-drums .tile-name") != "Drums":
                    problems.append(f"drums {label}: English title {page.inner_text('#drums-title')!r}, expected {want!r}")
            page.screenshot(path=str(SHOTS / f"drums-{mode}-{w}x{h}.png"))
        if errors:
            problems.append(f"drums {label}: page errors {errors[:2]}")
        ctx.close()


def kg_state(page):
    return page.evaluate("window.__bubbels.kangoeroe.state()")


def kg_settle(page):
    """Wait until the kangaroo has made every hop on screen."""
    page.wait_for_function("(() => { const v = window.__bubbels.kangoeroe.view(); return v && !v.moving; })()", timeout=6000)


def kg_next(page, i):
    page.wait_for_function(f"(() => {{ const s = window.__bubbels.kangoeroe.state(); return s.i > {i} || s.done; }})()", timeout=8000)


def kg_tap(page, sel):
    """A real tap on a button that must be on screen and enabled."""
    loc = page.locator(sel)
    if loc.is_disabled():
        raise AssertionError(f"{sel} is disabled")
    loc.tap()


def kg_tap_line(page, n):
    """A real tap on the number line at number n (a little above the line, where a finger lands)."""
    x = page.evaluate(f"window.__bubbels.kangoeroe.x({n})")
    box = page.locator("#kg-linebox").bounding_box()
    page.touchscreen.tap(x, box["y"] + box["height"] * 0.6)


def kangoeroe_flow(browser, base, problems):
    """Kangoeroe op de getallenlijn at 390x844 with real taps: the tile in Leren opens the menu, a
    locked tier offers only OK on the web; round t1-1 played to the end: one wrong answer first (a
    gentle bounce back to the start, the way drawn as dashed arcs, counted once), "how many hops?"
    by tapping +1 to the flag (numbered arcs, +1 greyed at the flag) and then the number, "3 + 4"
    by +1 taps with the pips filling and then Hier!, one sum by a tap on the line; 2 stars saved;
    the next round with back (the Android back button) and "keep playing"; the end of the free part
    offers only OK and lands on the menu with the save kept; no voice, nothing from outside."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    name = page.inner_text("#tile-kangoeroe .tile-name").replace("­", "").replace("\n", " ").strip()
    if name != "Kangoeroe op de getallenlijn":
        problems.append(f"kangoeroe: the tile says {name!r}")
    if page.evaluate("document.querySelector('#tile-kangoeroe').closest('.tile-group').querySelector('.group-name').textContent") != "Leren":
        problems.append("kangoeroe: the tile is not in the Leren section")
    page.locator("#tile-kangoeroe").scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / "kangoeroe-home-390x844.png"))
    page.locator("#tile-kangoeroe").tap()
    page.wait_for_timeout(200)
    if where(page) != ["kangoeroe-menu", False]:
        problems.append(f"kangoeroe: the tile opened {where(page)}")
    locked = page.locator("#kangoeroe-menu .level-cell.locked:not(.random-btn)").count()
    if locked != 6:
        problems.append(f"kangoeroe: {locked} rounds locked on the web, expected 6 (tiers 2 and 3)")
    page.screenshot(path=str(SHOTS / "kangoeroe-menu-390x844.png"), full_page=True)
    choose(page, "#kangoeroe-menu .level-cell[data-round='t2-1']", tap=True)
    page.wait_for_timeout(150)
    if card_buttons(page) != ["Oké"]:
        problems.append(f"kangoeroe: a locked round offers {card_buttons(page)}, not the web's OK")
    page.click("#ov-buttons button")
    page.wait_for_timeout(150)
    if where(page) != ["kangoeroe-menu", False] or kg_state(page):
        problems.append(f"kangoeroe: after OK on a locked round: {where(page)}")

    # round t1-1 by real taps
    choose(page, "#kangoeroe-menu .level-cell[data-round='t1-1']", tap=True)
    page.wait_for_timeout(200)
    if not page.is_visible("#overlay"):
        problems.append("kangoeroe: no how-to card on the first round")
    else:
        page.screenshot(path=str(SHOTS / "kangoeroe-how-390x844.png"))
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    did = {"wrong": False, "count": False, "pips": False, "line": False}
    for i in range(8):
        st = kg_state(page)
        q = st["q"]
        label = f"kangoeroe t1-1 q{i + 1} {q['kind']} {q['start']}"
        if page.locator("#kg-pips").is_visible() != (q["kind"] == "add"):
            problems.append(f"{label}: pips shown {page.locator('#kg-pips').is_visible()}")
        if i == 0:
            # a wrong answer first: back to the start, the way drawn, counted once
            if q["ask"] == "count":
                wrong = next(o for o in q["options"] if o != q["answer"])
                kg_tap(page, f"#kg-hops .kg-hop[data-d='1']")
                kg_tap(page, f"#kg-answer .kg-option[data-n='{wrong}']")
            else:
                kg_tap(page, "#kg-here")  # still on the start: not the answer
            page.wait_for_timeout(120)
            st = kg_state(page)
            arcs = page.locator("#kg-over .kg-arc.hint").count()
            if not st["hint"] or st["mistakes"] != 1 or st["pos"] != q["start"] or st["trail"] or arcs != len(q["hint"]) or st["i"] != 0:
                problems.append(f"{label}: after a wrong answer hint={st['hint']} mistakes={st['mistakes']} pos={st['pos']} trail={st['trail']} arcs={arcs}/{len(q['hint'])}")
            if "Bijna" not in page.inner_text("#kg-status"):
                problems.append(f"{label}: the status after a wrong answer says {page.inner_text('#kg-status')!r}")
            kg_settle(page)
            page.screenshot(path=str(SHOTS / "kangoeroe-hint-390x844.png"))
            did["wrong"] = True
        if q["ask"] == "count":
            for k in range(q["answer"]):
                kg_tap(page, "#kg-hops .kg-hop[data-d='1']")
            st = kg_state(page)
            arcs = page.locator("#kg-static .kg-arc.on").count()
            if st["pos"] != q["to"] or len(st["trail"]) != q["answer"] or arcs != q["answer"]:
                problems.append(f"{label}: after {q['answer']} taps on +1 the kangaroo is on {st['pos']} with {arcs} arcs, not on the flag {q['to']}")
            if not page.locator("#kg-hops .kg-hop[data-d='1']").is_disabled():
                problems.append(f"{label}: +1 still works at the flag")
            nums = page.eval_on_selector_all("#kg-static .kg-arc-label.on", "els => els.map(e => e.textContent)")
            if nums and nums != [str(k + 1) for k in range(q["answer"])]:
                problems.append(f"{label}: the arcs are numbered {nums}")
            kg_settle(page)
            if not did["count"]:
                page.screenshot(path=str(SHOTS / "kangoeroe-count-390x844.png"))
            did["count"] = True
            kg_tap(page, f"#kg-answer .kg-option[data-n='{q['answer']}']")
        elif not did["line"] and i > 0:
            # one sum by a tap on the line: the kangaroo jumps there in one arc, then Hier!
            kg_tap_line(page, q["answer"])
            page.wait_for_timeout(60)
            st = kg_state(page)
            if st["pos"] != q["answer"] or len(st["trail"]) != 1:
                problems.append(f"{label}: a tap on {q['answer']} on the line put the kangaroo on {st['pos']} ({st['trail']})")
            kg_settle(page)
            did["line"] = True
            kg_tap(page, "#kg-here")
        else:
            for k in range(q["answer"] - st["pos"]):
                kg_tap(page, "#kg-hops .kg-hop[data-d='1']")
            pips = page.locator("#kg-pips .kg-pip.on").count()
            if pips != q["terms"][0]:
                problems.append(f"{label}: {pips} pips filled after {q['terms'][0]} hops")
            if not did["pips"]:
                kg_settle(page)
                page.screenshot(path=str(SHOTS / "kangoeroe-add-390x844.png"))
            did["pips"] = True
            kg_tap(page, "#kg-here")
        page.wait_for_timeout(80)
        if i < 7 and "Goed" not in page.inner_text("#kg-status"):
            problems.append(f"{label}: the right answer says {page.inner_text('#kg-status')!r}")
        kg_next(page, i)
    if not all(did.values()):
        problems.append(f"kangoeroe: round t1-1 did not cover every kind of answer: {did}")
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=4000)
    page.screenshot(path=str(SHOTS / "kangoeroe-win-390x844.png"))
    if page.inner_text("#ov-title").strip() != "Goed gedaan!" or page.evaluate("window.__bubbels.kangoeroe.stars()").get("t1-1") != 2:
        problems.append(f"kangoeroe: t1-1 with one mistake ended {page.inner_text('#ov-title')!r}, stars {page.evaluate('window.__bubbels.kangoeroe.stars()')}")
    if card_buttons(page) != ["Volgende ronde", "Nog een keer", "Rondes"]:
        problems.append(f"kangoeroe: the end card offers {card_buttons(page)}")

    # the next round; the Android back button halfway and "keep playing"
    page.click("#ov-buttons button >> nth=0")
    page.wait_for_timeout(200)
    st = kg_state(page)
    if st["roundId"] != "t1-2" or st["i"] != 0:
        problems.append(f"kangoeroe: Volgende ronde started {st['roundId']}")
    q = st["q"]
    if q["ask"] == "count":
        page.evaluate(f"window.__bubbels.kangoeroe.pick({q['answer']})")
    else:
        page.evaluate(f"window.__bubbels.kangoeroe.tapLine({q['answer']})")
        page.evaluate("window.__bubbels.kangoeroe.here()")
    kg_next(page, 0)
    page.evaluate("window.__bubbels.kangoeroe.hop(1)")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(150)
    if where(page) != ["kangoeroe-menu", False] or not page.is_visible("#kangoeroe-continue") or page.inner_text("#kangoeroe-continue").strip() != "Verder spelen":
        problems.append(f"kangoeroe: back from a round went to {where(page)} without Verder spelen")
    page.locator("#kangoeroe-continue").tap()
    page.wait_for_timeout(150)
    st2 = kg_state(page)
    if where(page) != ["kangoeroe", False] or st2["i"] != 1 or st2["roundId"] != "t1-2":
        problems.append(f"kangoeroe: Verder spelen opened {where(page)} at question {st2['i'] + 1}")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(100)
    page.evaluate("window.__bubbels.back()")  # the menu goes home
    page.wait_for_timeout(100)
    if where(page) != ["home", False]:
        problems.append(f"kangoeroe: back from the menu went to {where(page)}")

    # the end of the free part: "Meer rondes" offers only OK on the web, and lands on the menu
    page.locator("#tile-kangoeroe").click()
    page.evaluate("window.__bubbels.kangoeroe.start('t1-3')")
    page.wait_for_timeout(150)
    for i in range(8):
        q = kg_state(page)["q"]
        if q["ask"] == "count":
            page.evaluate(f"window.__bubbels.kangoeroe.pick({q['answer']})")
        else:
            page.evaluate(f"window.__bubbels.kangoeroe.tapLine({q['answer']})")
            page.evaluate("window.__bubbels.kangoeroe.here()")
        kg_next(page, i)
    if "laatste gratis" not in page.inner_text("#ov-text"):
        problems.append(f"kangoeroe: the end of t1-3 says {page.inner_text('#ov-text')!r}")
    if web_offer_ok(page, "kangoeroe t1-3", "kangoeroe-menu", problems):
        if page.evaluate("window.__bubbels.kangoeroe.stars()").get("t1-3") != 3:
            problems.append(f"kangoeroe: t1-3 not saved ({page.evaluate('window.__bubbels.kangoeroe.stars()')})")
    if page.locator("audio").count() or page.evaluate("typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking"):
        problems.append("kangoeroe: something speaks")
    if errors:
        problems.append(f"kangoeroe: page errors {errors[:3]}")
    if foreign:
        problems.append(f"kangoeroe: requests outside the app {foreign[:3]}")
    ctx.close()


def kangoeroe_layouts(browser, base, problems):
    """Kangoeroe on a small phone, an ordinary phone (in English), sideways and on desktop, tier 1
    and (full version) tier 3: every button on screen and 48 px or more, the line and the sum on
    screen, no sideways scrolling; on 0-100 a phone shows a window of the line with the map above
    it, and hopping +10 moves the window so the kangaroo stays in sight."""
    for w, h in ((320, 568), (390, 844), (568, 320), (844, 390), (1280, 800)):
        mobile = w < 1000
        english = (w, h) == (390, 844)
        ctx = browser.new_context(bypass_csp=True, locale="en-GB" if english else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
        ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        for rid in ("t1-1", "t2-1", "t3-1"):
            label = f"kangoeroe {w}x{h} {rid}"
            page.evaluate(f"window.__bubbels.kangoeroe.start('{rid}')")
            page.wait_for_timeout(200)
            if page.is_visible("#overlay"):
                page.click("#ov-buttons button")
                page.wait_for_timeout(150)
            q = kg_state(page)["q"]
            if rid == "t3-1":
                # follow the way with the buttons: the kangaroo never leaves the window
                for a, b in q["hint"]:
                    d = b - a
                    step = d if d in q["buttons"] else (1 if d > 0 else -1)
                    for _ in range(abs(d // step)):
                        page.locator(f"#kg-hops .kg-hop[data-d='{step}']").click()
                    kg_settle(page)
                    page.wait_for_timeout(300)
                    v = page.evaluate("window.__bubbels.kangoeroe.view()")
                    pos = kg_state(page)["pos"]
                    if not (v["lo"] <= pos <= v["lo"] + v["size"]):
                        problems.append(f"{label}: the kangaroo on {pos} is out of the window {v['lo']}-{v['lo'] + v['size']}")
                    lb = page.locator("#kg-linebox").bounding_box()
                    x = page.evaluate(f"window.__bubbels.kangoeroe.x({pos})")
                    if not (lb["x"] <= x <= lb["x"] + lb["width"]):
                        problems.append(f"{label}: the kangaroo on {pos} is drawn outside the line ({x:.0f})")
                v = page.evaluate("window.__bubbels.kangoeroe.view()")
                if mobile and (not v["map"] or v["size"] >= 100):
                    problems.append(f"{label}: a phone shows {v['size']} numbers without the map")
                if not mobile and v["size"] != 100:
                    problems.append(f"{label}: desktop shows only {v['size']} numbers")
                if v["unit"] < 8 and v["size"] > 20:
                    problems.append(f"{label}: numbers only {v['unit']:.1f} px apart")
                print(f"[kangoeroe {w}x{h}] 0-100: {v['size']} in view, {v['unit']:.1f} px a number, map {v['map']}")
            if rid == "t2-1" and q["ask"] == "land" and (w, h) == (390, 844):
                # a double tap (or a held Enter) on Hier! after a wrong answer counts only once:
                # the second try is kept
                page.locator("#kg-here").dblclick()
                page.keyboard.press("Enter")
                page.wait_for_timeout(120)
                st = kg_state(page)
                if st["tries"] != 1 or st["mistakes"] != 1 or not st["hint"] or st["waiting"]:
                    problems.append(f"{label}: a double tap on Hier! counted tries={st['tries']} mistakes={st['mistakes']} waiting={st['waiting']}")
                kg_settle(page)
            spill = page.eval_on_selector_all("#kg-hops .kg-hop", "els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)")
            if spill:
                problems.append(f"{label}: the labels {spill} spill out of their buttons")
            targets = ["#kangoeroe-back"] + [f"#kg-hops .kg-hop >> nth={k}" for k in range(page.locator("#kg-hops .kg-hop").count())]
            targets += ["#kg-here"] if q["ask"] == "land" else [f"#kg-answer .kg-option >> nth={k}" for k in range(len(q["options"]))]
            for sel in targets + ["#kg-sum", "#kg-linebox"] + (["#kg-map"] if page.is_visible("#kg-map") else []):
                r = page.locator(sel).bounding_box()
                if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                    problems.append(f"{label}: {sel} not on screen ({r})")
                elif sel in targets and (r["width"] < 47.5 or r["height"] < 47.5):
                    problems.append(f"{label}: {sel} only {r['width']:.0f}x{r['height']:.0f} px")
                elif sel == "#kg-linebox" and r["height"] < 90:
                    problems.append(f"{label}: the line has only {r['height']:.0f} px")
                elif sel == "#kg-map" and r["height"] < 44:
                    problems.append(f"{label}: the map is {r['height']:.0f} px high")
            if page.evaluate("document.documentElement.scrollWidth") > w:
                problems.append(f"{label}: the page scrolls sideways")
            for sel in ("#wk-shop", "#wk-laid", "#wk-goods"):
                if page.locator(sel).evaluate("e => e.scrollHeight > e.clientHeight + 1"):
                    problems.append(f"{label}: {sel} hides part of what is in it")
            text = page.locator("#kg-sum").evaluate("e => e.scrollWidth > e.clientWidth + 1")
            if text:
                problems.append(f"{label}: the sum does not fit")
            if english and page.inner_text("#kg-sub") != "Kangaroo Hops":
                problems.append(f"{label}: English title {page.inner_text('#kg-sub')!r}")
            page.screenshot(path=str(SHOTS / f"kangoeroe-{rid}-{w}x{h}.png"))
            page.evaluate("window.__bubbels.back()")
            page.wait_for_timeout(100)
        if errors:
            problems.append(f"kangoeroe {w}x{h}: page errors {errors[:2]}")
        ctx.close()


def wk_state(page):
    return page.evaluate("window.__bubbels.winkel.state()")


def wk_poll(page, cond, label, problems, tries=100):
    """Poll the game state in Python (wait_for_function evaluates a string, which the real CSP blocks)."""
    for _ in range(tries):
        st = wk_state(page)
        if st and cond(st):
            return st
        page.wait_for_timeout(60)
    problems.append(f"{label}: waited in vain ({wk_state(page)})")
    return wk_state(page)


def wk_next(page, i, problems, label="winkel"):
    return wk_poll(page, lambda s: s["i"] > i or s["done"], f"{label}: question {i + 1} did not move on", problems)


def wk_tap(page, sel):
    """A real tap on something that must be on screen and enabled."""
    loc = page.locator(sel).first
    if loc.is_disabled():
        raise AssertionError(f"{sel} is disabled")
    loc.tap()


def wk_lay_taps(page, coins):
    """Lay coins from the purse (or till) by real taps on their stacks."""
    for d in coins:
        wk_tap(page, f"#wk-wallet .wk-stack[data-d='{d}']")


def wk_pay_hook(page, i, problems, label):
    """Answer question i through the test hook (the solution, or the cheapest pair), then wait."""
    st = wk_state(page)
    q = st["q"]
    if q["ask"] == "basket":
        for k in q["best"]:
            page.evaluate(f"window.__bubbels.winkel.pick({k})")
    else:
        for d in q["solution"]:
            page.evaluate(f"window.__bubbels.winkel.lay({d})")
    page.evaluate("window.__bubbels.winkel.pay()")
    return wk_next(page, i, problems, label)


def wk_drag(page, src, dst):
    """A real drag with the mouse from the middle of `src` to the middle of `dst`."""
    a = page.locator(src).first.bounding_box()
    b = page.locator(dst).first.bounding_box()
    page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2)
    page.mouse.down()
    for k in range(1, 9):
        page.mouse.move(a["x"] + a["width"] / 2 + (b["x"] + b["width"] / 2 - a["x"] - a["width"] / 2) * k / 8,
                        a["y"] + a["height"] / 2 + (b["y"] + b["height"] / 2 - a["y"] - a["height"] / 2) * k / 8)
        page.wait_for_timeout(16)
    page.mouse.up()
    page.wait_for_timeout(80)


def wk_finger(page, cdp, src, dst):
    """A real finger drag (touch events through CDP) from the middle of `src` to the middle of `dst`."""
    a = page.locator(src).first.bounding_box()
    b = page.locator(dst).first.bounding_box()
    ax, ay = a["x"] + a["width"] / 2, a["y"] + a["height"] / 2
    bx, by = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": ax, "y": ay, "id": 1}]})
    # out and back when the drop is on the coin's own button: a real drag, not a tap
    path = [(ax + 40 * k / 4, ay - 40 * k / 4) for k in range(1, 5)] + [(ax + 40 - 40 * k / 4, ay - 40 + 40 * k / 4) for k in range(1, 5)] if (ax, ay) == (bx, by) else \
        [(ax + (bx - ax) * k / 8, ay + (by - ay) * k / 8) for k in range(1, 9)]
    for x, y in path:
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y, "id": 1}]})
        page.wait_for_timeout(16)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(120)


def winkel_flow(browser, base, problems):
    """Winkeltje at 390x844 with real taps: the tile in Leren opens the menu, a locked tier offers
    only OK on the web; round t1-1 (3-5, whole euros) played to the end by taps on the purse with
    one too-few payment first (the missing coin shown as a ghost, the line says how much, counted
    once, a second tap on Betalen counts nothing), one coin taken back by a tap on the counter, one
    laid and one taken back by a real drag; 2 stars saved; the next round, back (the Android back
    button) + keep playing with the counter kept; the end of the free part offers only OK and lands
    on the menu with the save kept; no voice, nothing from outside."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    name = page.inner_text("#tile-winkel .tile-name").strip()
    if name != "Winkeltje":
        problems.append(f"winkel: the tile says {name!r}")
    if page.evaluate("document.querySelector('#tile-winkel').closest('.tile-group').querySelector('.group-name').textContent") != "Leren":
        problems.append("winkel: the tile is not in the Leren section")
    page.locator("#tile-winkel").scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / "winkel-home-390x844.png"))
    page.locator("#tile-winkel").tap()
    page.wait_for_timeout(200)
    if where(page) != ["winkel-menu", False]:
        problems.append(f"winkel: the tile opened {where(page)}")
    locked = page.locator("#winkel-menu .level-cell.locked:not(.random-btn)").count()
    if locked != 6:
        problems.append(f"winkel: {locked} rounds locked on the web, expected 6 (6-7 and 8-10)")
    if page.locator("#winkel-menu .level-grid:not(.fold-emptied) .level-cell.locked:not(.random-btn)").count() != page.locator("#winkel-menu .full-fold .level-cell.locked:not(.random-btn)").count():
        problems.append("winkel: a locked round sits between the free ones (not in the fold)")
    page.screenshot(path=str(SHOTS / "winkel-menu-390x844.png"), full_page=True)
    choose(page, "#winkel-menu .level-cell[data-round='t2-1']", tap=True)
    page.wait_for_timeout(150)
    if card_buttons(page) != ["Oké"]:
        problems.append(f"winkel: a locked round offers {card_buttons(page)}, not the web's OK")
    page.click("#ov-buttons button")
    page.wait_for_timeout(150)
    if where(page) != ["winkel-menu", False] or wk_state(page):
        problems.append(f"winkel: after OK on a locked round: {where(page)}")

    # round t1-1 by real taps
    choose(page, "#winkel-menu .level-cell[data-round='t1-1']", tap=True)
    page.wait_for_timeout(200)
    if not page.is_visible("#overlay"):
        problems.append("winkel: no how-to card on the first round")
    else:
        page.screenshot(path=str(SHOTS / "winkel-how-390x844.png"))
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    did = {"short": False, "tapBack": False, "dragLay": False, "dragBack": False, "finger": False}
    for i in range(6):
        st = wk_state(page)
        q = st["q"]
        n = q["target"] // 100
        label = f"winkel t1-1 q{i + 1} {q['kind']} {n} euro"
        if not page.is_disabled("#wk-pay"):
            problems.append(f"{label}: Betalen works with nothing on the counter")
        if page.locator("#wk-pips .wk-pip").count() != n:
            problems.append(f"{label}: {page.locator('#wk-pips .wk-pip').count()} dots for {n} euro")
        if i == 0:
            if n < 2:
                problems.append(f"{label}: the first question asks only 1 euro, no too-few try possible")
            # too few first: the missing euro as a ghost, the line says how much, counted once
            wk_lay_taps(page, [100] * (n - 1))
            wk_tap(page, "#wk-pay")
            page.wait_for_timeout(120)
            st = wk_state(page)
            ghosts = page.locator("#wk-laid .wk-ghost").count()
            if not st["fb"] or st["fb"]["why"] != "short" or st["mistakes"] != 1 or ghosts != 1 or len(st["laid"]) != n - 1:
                problems.append(f"{label}: after too few fb={st['fb']} mistakes={st['mistakes']} ghosts={ghosts} laid={st['laid']}")
            if "Nog € 1 erbij" not in page.inner_text("#wk-status").replace("\u00a0", " "):
                problems.append(f"{label}: the line after too few says {page.inner_text('#wk-status')!r}")
            page.screenshot(path=str(SHOTS / "winkel-short-390x844.png"))
            page.locator("#wk-pay").dispatch_event("click")  # a second tap on the same counter
            page.wait_for_timeout(80)
            if wk_state(page)["tries"] != 1:
                problems.append(f"{label}: a second tap on Betalen counted again ({wk_state(page)['tries']} tries)")
            did["short"] = True
            wk_lay_taps(page, [100])
        elif not did["dragLay"]:
            # one laid by a real drag onto the counter, one taken back by dragging it off
            wk_drag(page, "#wk-wallet .wk-stack[data-d='100']", "#wk-counter")
            if len(wk_state(page)["laid"]) != 1:
                problems.append(f"{label}: a drag onto the counter laid {wk_state(page)['laid']}")
            did["dragLay"] = True
            wk_drag(page, "#wk-laid button.wk-piece >> nth=0", "#wk-wallet")
            if wk_state(page)["laid"]:
                problems.append(f"{label}: a drag off the counter left {wk_state(page)['laid']}")
            did["dragBack"] = True
            # the same by a finger (touch events), and a drop back on the coin's own button does nothing
            cdp = ctx.new_cdp_session(page)
            wk_finger(page, cdp, "#wk-wallet .wk-stack[data-d='100']", "#wk-wallet .wk-stack[data-d='100']")
            if wk_state(page)["laid"]:
                problems.append(f"{label}: a finger drag dropped on its own purse coin laid {wk_state(page)['laid']}")
            wk_finger(page, cdp, "#wk-wallet .wk-stack[data-d='100']", "#wk-counter")
            if wk_state(page)["laid"] != [100]:
                problems.append(f"{label}: a finger drag onto the counter laid {wk_state(page)['laid']}")
            wk_finger(page, cdp, "#wk-laid button.wk-piece >> nth=0", "#wk-laid button.wk-piece >> nth=0")
            if wk_state(page)["laid"] != [100]:
                problems.append(f"{label}: a finger drag dropped on its own counter coin left {wk_state(page)['laid']}")
            wk_finger(page, cdp, "#wk-laid button.wk-piece >> nth=0", "#wk-wallet")
            if wk_state(page)["laid"]:
                problems.append(f"{label}: a finger drag off the counter left {wk_state(page)['laid']}")
            if page.locator(".wk-drag").count():
                problems.append(f"{label}: a dragged coin was left on screen")
            did["finger"] = True
            wk_lay_taps(page, [100] * n)
        else:
            # one too many, then a tap on the counter takes it back (before paying: not a mistake)
            wk_lay_taps(page, [100] * (n + 1))
            if page.locator("#wk-pips .wk-pip.over").count() != 1:
                problems.append(f"{label}: one euro too many shows {page.locator('#wk-pips .wk-pip.over').count()} extra dots")
            if not did["tapBack"]:
                wk_tap(page, f"#wk-laid button.wk-piece >> nth={n}")
                did["tapBack"] = True
            else:
                page.locator("#wk-laid button.wk-piece").first.tap()
            if len(wk_state(page)["laid"]) != n:
                problems.append(f"{label}: a tap on the counter did not take a coin back ({wk_state(page)['laid']})")
        if page.locator("#wk-pips .wk-pip.on").count() != n:
            problems.append(f"{label}: {page.locator('#wk-pips .wk-pip.on').count()} dots filled with {n} euro laid")
        if i == 1:
            page.screenshot(path=str(SHOTS / "winkel-t1-pay-390x844.png"))
        wk_tap(page, "#wk-pay")
        page.wait_for_timeout(80)
        if i < 5 and "Goed" not in page.inner_text("#wk-status"):
            problems.append(f"{label}: paying right says {page.inner_text('#wk-status')!r}")
        wk_next(page, i, problems, label)
    if not all(did.values()):
        problems.append(f"winkel: round t1-1 did not cover every way: {did}")
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=4000)
    page.screenshot(path=str(SHOTS / "winkel-win-390x844.png"))
    if page.inner_text("#ov-title").strip() != "Goed gedaan!" or page.evaluate("window.__bubbels.winkel.stars()").get("t1-1") != 2:
        problems.append(f"winkel: t1-1 with one mistake ended {page.inner_text('#ov-title')!r}, stars {page.evaluate('window.__bubbels.winkel.stars()')}")
    if card_buttons(page) != ["Volgende ronde", "Nog een keer", "Rondes"]:
        problems.append(f"winkel: the end card offers {card_buttons(page)}")

    # the next round; the Android back button halfway and "keep playing" with the counter kept
    page.click("#ov-buttons button >> nth=0")
    page.wait_for_timeout(200)
    st = wk_state(page)
    if st["roundId"] != "t1-2" or st["i"] != 0:
        problems.append(f"winkel: Volgende ronde started {st['roundId']}")
    wk_pay_hook(page, 0, problems, "winkel t1-2")
    wk_lay_taps(page, [100])
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(150)
    if where(page) != ["winkel-menu", False] or not page.is_visible("#winkel-continue") or page.inner_text("#winkel-continue").strip() != "Verder spelen":
        problems.append(f"winkel: back from a round went to {where(page)} without Verder spelen")
    page.locator("#winkel-continue").tap()
    page.wait_for_timeout(150)
    st2 = wk_state(page)
    if where(page) != ["winkel", False] or st2["i"] != 1 or st2["roundId"] != "t1-2" or st2["laid"] != [100]:
        problems.append(f"winkel: Verder spelen opened {where(page)} at question {st2['i'] + 1} with {st2['laid']}")
    # two wrong tries, then away in the pause before the shop shows the way: "keep playing" still shows it
    n = st2["q"]["target"] // 100
    for _ in range(n + 1 - len(st2["laid"])):
        page.evaluate("window.__bubbels.winkel.lay(100)")
    page.evaluate("window.__bubbels.winkel.pay()")  # one too many
    if n >= 2:
        page.evaluate("window.__bubbels.winkel.take(0)")
        page.evaluate("window.__bubbels.winkel.take(0)")  # one too few
    else:
        page.evaluate("window.__bubbels.winkel.lay(100)")  # two too many
    page.evaluate("window.__bubbels.winkel.pay()")
    st3 = wk_state(page)
    if st3["tries"] != 2 or not st3["waiting"] or st3["shown"]:
        problems.append(f"winkel: two wrong tries gave tries={st3['tries']} waiting={st3['waiting']} shown={st3['shown']}")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(1800)  # longer than the pause: nothing happens while away
    if wk_state(page)["shown"] or wk_state(page)["i"] != 1:
        problems.append(f"winkel: the help went on while away ({wk_state(page)})")
    page.locator("#winkel-continue").tap()
    st4 = wk_poll(page, lambda x: x["shown"] or x["i"] != 1, "winkel: Verder spelen after two tries", problems)
    if not st4["shown"] or st4["i"] != 1 or sorted(st4["laid"]) != sorted(st4["q"]["solution"]):
        problems.append(f"winkel: Verder spelen after two tries skipped the help ({st4})")
    elif "Kijk" not in page.inner_text("#wk-status"):
        problems.append(f"winkel: the help says {page.inner_text('#wk-status')!r}")
    wk_next(page, 1, problems, "winkel t1-2 help")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(100)
    page.evaluate("window.__bubbels.back()")  # the menu goes home
    page.wait_for_timeout(100)
    if where(page) != ["home", False]:
        problems.append(f"winkel: back from the menu went to {where(page)}")

    # the end of the free part: "Meer rondes" offers only OK on the web, and lands on the menu
    page.locator("#tile-winkel").click()
    page.evaluate("window.__bubbels.winkel.start('t1-3')")
    page.wait_for_timeout(150)
    swapped = False
    for i in range(6):
        q = wk_state(page)["q"]
        if not swapped and q["kind"] == "twos" and q["target"] in (200, 400):
            # too little that the purse cannot make (no 1 euro left): the 1 euro marked to take back,
            # a 2 euro ghost, and a line that says so
            if page.is_visible("#overlay"):
                page.click("#ov-buttons button")
                page.wait_for_timeout(120)
            wk_lay_taps(page, [100])
            wk_tap(page, "#wk-pay")
            page.wait_for_timeout(120)
            st = wk_state(page)
            line = page.inner_text("#wk-status").replace("\u00a0", " ")
            if not st["fb"] or st["fb"]["back"] != [0] or page.locator("#wk-laid button.wk-piece.over").count() != 1 or page.locator("#wk-laid .wk-ghost").count() != q["target"] // 200 or "Pak eerst € 1 terug" not in line:
                problems.append(f"winkel t1-3 q{i + 1}: € {q['target'] // 100} with the 1 euro laid: fb={st['fb']} line={line!r}")
            page.screenshot(path=str(SHOTS / "winkel-swap-390x844.png"))
            wk_tap(page, "#wk-laid button.wk-piece")
            swapped = True
        wk_pay_hook(page, i, problems, "winkel t1-3")
    if not swapped:
        problems.append("winkel t1-3: no twos question of 2 or 4 euro to swap in")
    if "laatste gratis" not in page.inner_text("#ov-text"):
        problems.append(f"winkel: the end of t1-3 says {page.inner_text('#ov-text')!r}")
    if web_offer_ok(page, "winkel t1-3", "winkel-menu", problems):
        if page.evaluate("window.__bubbels.winkel.stars()").get("t1-3") != 2:  # the swap was one mistake
            problems.append(f"winkel: t1-3 not saved ({page.evaluate('window.__bubbels.winkel.stars()')})")
    if page.locator("audio").count() or page.evaluate("typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking"):
        problems.append("winkel: something speaks")
    if errors:
        problems.append(f"winkel: page errors {errors[:3]}")
    if foreign:
        problems.append(f"winkel: requests outside the app {foreign[:3]}")
    ctx.close()


def winkel_full(browser, base, problems):
    """Winkeltje in the full version at 390x844: round t2-1 (6-7) paid exactly by real taps on the
    purse (notes too), 3 stars; in t2-3 the right amount with more pieces than needed says it can
    be done with fewer; an 8-10 change question by real taps on the till, counting up from the price
    (one coin too many first: it is marked, the line says how much, a tap on its pile takes it
    back); a budget question by real taps (a pair that costs too much first, then one that fits)."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(OWNED_APP)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.wait_for_function("window.__bubbels.full()", timeout=8000)
    page.locator("#tile-winkel").tap()
    page.wait_for_timeout(150)
    if page.locator("#winkel-menu .level-cell.locked").count() or page.locator("#winkel-menu .full-fold").count():
        problems.append("winkel full: something is still locked in the full version")
    page.locator("#winkel-menu .level-cell[data-round='t2-1']").tap()
    page.wait_for_timeout(200)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    for i in range(6):
        q = wk_state(page)["q"]
        label = f"winkel t2-1 q{i + 1} {q['target']}"
        wk_lay_taps(page, q["solution"])
        total = page.inner_text("#wk-total")
        want = f"€ {q['target'] // 100}" if q["target"] % 100 == 0 else f"€ {q['target'] // 100},{q['target'] % 100:02d}"
        if want not in total.replace(" ", " "):
            problems.append(f"{label}: the counter says {total!r}, expected {want}")
        if i == 0 or (any(d >= 500 for d in q["solution"]) and not (SHOTS / "winkel-pay-390x844.png").exists()):
            page.screenshot(path=str(SHOTS / "winkel-pay-390x844.png"))
        wk_tap(page, "#wk-pay")
        page.wait_for_timeout(60)
        if "Goed" not in page.inner_text("#wk-status") and i < 5:
            problems.append(f"{label}: paying exactly says {page.inner_text('#wk-status')!r}")
        wk_next(page, i, problems, label)
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=4000)
    if page.evaluate("window.__bubbels.winkel.stars()").get("t2-1") != 3:
        problems.append(f"winkel: t2-1 paid exactly saved {page.evaluate('window.__bubbels.winkel.stars()')}")
    page.click("#ov-buttons button >> text=Rondes")
    page.wait_for_timeout(120)

    # as few as possible: the right amount with more pieces says so
    page.evaluate("window.__bubbels.winkel.start('t2-3')")
    page.wait_for_timeout(150)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    q = wk_state(page)["q"]
    sol = list(q["solution"])
    more = None
    if 200 in sol and q["wallet"].get("100", 0) >= 2 + sol.count(100):
        more = [d for d in sol if d != 200] + [200] * (sol.count(200) - 1) + [100, 100]
    elif 1000 in sol:
        more = [d for d in sol if d != 1000] + [500, 500]
    if more:
        wk_lay_taps(page, more)
        wk_tap(page, "#wk-pay")
        page.wait_for_timeout(100)
        st = wk_state(page)
        if not st["fb"] or st["fb"]["why"] != "more" or f"met {len(sol)}" not in page.inner_text("#wk-status"):
            problems.append(f"winkel t2-3: {more} for {q['target']} said {page.inner_text('#wk-status')!r} ({st['fb']})")
        page.screenshot(path=str(SHOTS / "winkel-fewest-390x844.png"))
    else:
        problems.append(f"winkel t2-3: no way to pay {q['target']} with more pieces ({sol})")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(100)

    # change: count up from the price with coins from the till
    page.evaluate("window.__bubbels.winkel.start('t3-2')")
    page.wait_for_timeout(150)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    for i in range(6):
        q = wk_state(page)["q"]
        if q["kind"] == "change":
            break
        wk_pay_hook(page, i, problems, "winkel t3-2")
    label = f"winkel t3-2 change {q['paid']} - {q['price']}"
    if q["kind"] != "change":
        problems.append(f"{label}: no change question in t3-2")
    else:
        if page.inner_text("#wk-wallet-cap") != "De kassa" or page.inner_text("#wk-pay") != "Teruggeven":
            problems.append(f"{label}: the till says {page.inner_text('#wk-wallet-cap')!r}, the button {page.inner_text('#wk-pay')!r}")
        up = sorted(q["solution"])
        extra = next((d for d in (10, 20, 50, 5) if q["wallet"].get(str(d), 0) > up.count(d)), None)
        wk_lay_taps(page, up + [extra])
        wk_tap(page, "#wk-pay")
        page.wait_for_timeout(100)
        st = wk_state(page)
        over = page.locator(f"#wk-laid .wk-pile.over[data-d='{extra}']").count()
        if not st["fb"] or st["fb"]["why"] != "over" or st["fb"]["over"] != extra or "te veel" not in page.inner_text("#wk-status") or over != 1:
            problems.append(f"{label}: one {extra} cent too many: fb={st['fb']} over-pile={over} {page.inner_text('#wk-status')!r}")
        wk_tap(page, f"#wk-laid .wk-pile[data-d='{extra}']")
        st = wk_state(page)
        if sorted(st["laid"]) != up:
            problems.append(f"{label}: a tap on the {extra} pile left {st['laid']}")
        line = page.inner_text("#wk-upline").replace(" ", " ")
        steps = line.split(" → ")
        if len(steps) != len(up) + 1 or steps[0] != f"€ {q['price'] // 100},{q['price'] % 100:02d}" or steps[-1] != f"€ {q['paid'] // 100},00":
            problems.append(f"{label}: counting up says {line!r}")
        page.screenshot(path=str(SHOTS / "winkel-change-390x844.png"))
        wk_tap(page, "#wk-pay")
        page.wait_for_timeout(80)
        if "Goed" not in page.inner_text("#wk-status"):
            problems.append(f"{label}: the right change says {page.inner_text('#wk-status')!r}")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(100)

    # a budget: two things that fit, by real taps
    page.evaluate("window.__bubbels.winkel.start('t3-3')")
    page.wait_for_timeout(150)
    for i in range(6):
        q = wk_state(page)["q"]
        if q["kind"] == "budget":
            break
        wk_pay_hook(page, i, problems, "winkel t3-3")
    label = "winkel t3-3 budget"
    items = q["items"]
    pairs = [(a, b) for a in range(4) for b in range(a + 1, 4)]
    bad = next(((a, b) for a, b in pairs if items[a]["price"] + items[b]["price"] > q["budget"]), None)
    if q["kind"] != "budget" or not bad:
        problems.append(f"{label}: no budget question with a pair that does not fit ({q})")
    else:
        for k in bad:
            wk_tap(page, f"#wk-goods .wk-good[data-k='{k}']")
        wk_tap(page, "#wk-pay")
        page.wait_for_timeout(100)
        st = wk_state(page)
        if not st["fb"] or st["fb"]["why"] != "over" or "te veel" not in page.inner_text("#wk-status"):
            problems.append(f"{label}: a pair over the budget said {page.inner_text('#wk-status')!r} ({st['fb']})")
        page.screenshot(path=str(SHOTS / "winkel-budget-390x844.png"))
        for k in bad:
            wk_tap(page, f"#wk-goods .wk-good[data-k='{k}']")
        for k in q["best"]:
            wk_tap(page, f"#wk-goods .wk-good[data-k='{k}']")
        wk_tap(page, "#wk-pay")
        page.wait_for_timeout(80)
        if "Goed" not in page.inner_text("#wk-status"):
            problems.append(f"{label}: a pair that fits says {page.inner_text('#wk-status')!r}")
    if errors:
        problems.append(f"winkel full: page errors {errors[:3]}")
    ctx.close()


# the questions to check per layout: (round, kind, extra pieces laid to fill the counter)
WK_LAYOUT = (("t1-1", "count", "all"), ("t1-3", "twos", "all"), ("t2-3", "fewest", "all"), ("t3-2", "cents", "one-each"), ("t3-2", "change", "solution+1"), ("t3-3", "budget", "two"))


def winkel_layouts(browser, base, problems):
    """Winkeltje (full version) at 320x568, 390x844 in English, 568x320, 844x390 and desktop for
    every kind of question with the counter as full as it gets (every coin of the youngest's purse,
    a pile of every coin and note at 8-10): every coin, note, pile, thing and button 48 px or more
    and on screen, no sideways scroll."""
    for w, h in ((320, 568), (390, 844), (568, 320), (844, 390), (1280, 800)):
        mobile = w < 1000
        english = (w, h) == (390, 844)
        ctx = browser.new_context(bypass_csp=True, locale="en-GB" if english else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
        ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        if english and page.inner_text("#tile-winkel .tile-name").strip() != "Little Shop":
            problems.append(f"winkel {w}x{h}: the English tile says {page.inner_text('#tile-winkel .tile-name')!r}")
        for rid, kind, fill in WK_LAYOUT:
            label = f"winkel {w}x{h} {rid} {kind}"
            page.evaluate(f"window.__bubbels.winkel.start('{rid}')")
            page.wait_for_timeout(150)
            if page.is_visible("#overlay"):
                page.click("#ov-buttons button")
                page.wait_for_timeout(120)
            # find the question of this kind in the round
            idx = None
            for k in range(6):
                page.evaluate(f"window.__bubbels.winkel.show({k})")
                if wk_state(page)["q"]["kind"] == kind:
                    idx = k
                    break
            if idx is None:
                problems.append(f"{label}: no such question")
                continue
            q = wk_state(page)["q"]
            if fill == "all":
                for d, n in q["wallet"].items():
                    for _ in range(n):
                        page.evaluate(f"window.__bubbels.winkel.lay({d})")
            elif fill == "one-each":
                for d in q["wallet"]:
                    page.evaluate(f"window.__bubbels.winkel.lay({d})")
            elif fill == "solution+1":
                for d in sorted(q["solution"]) + [next(d for d in (10, 20, 50, 5) if q["wallet"].get(str(d), 0) > q["solution"].count(d))]:
                    page.evaluate(f"window.__bubbels.winkel.lay({d})")
            else:
                for k in q["best"]:
                    page.evaluate(f"window.__bubbels.winkel.pick({k})")
            page.wait_for_timeout(80)
            targets = ["#winkel-back", "#wk-pay"]
            targets += [f"#wk-wallet .wk-stack >> nth={k}" for k in range(page.locator("#wk-wallet button.wk-stack").count())]
            targets += [f"#wk-laid button >> nth={k}" for k in range(page.locator("#wk-laid button").count())]
            targets += [f"#wk-goods button >> nth={k}" for k in range(page.locator("#wk-goods button").count())]
            shown = ["#wk-shop", "#wk-counter", "#wk-wallet", "#wk-status", "#wk-dots"]
            for sel in targets + shown:
                r = page.locator(sel).bounding_box()
                if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                    problems.append(f"{label}: {sel} not on screen ({r})")
                elif sel in targets and (r["width"] < 47.5 or r["height"] < 47.5):
                    problems.append(f"{label}: {sel} only {r['width']:.0f}x{r['height']:.0f} px")
            # nothing overlaps: every button's centre hits that button
            for sel in targets:
                hit = page.locator(sel).evaluate("e => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === e || e.contains(h)); }")
                if not hit:
                    problems.append(f"{label}: {sel} is covered")
            if page.evaluate("document.documentElement.scrollWidth") > w:
                problems.append(f"{label}: the page scrolls sideways")
            for sel in ("#wk-sum", "#wk-total", ".wk-tag", "#wk-pay"):
                if page.locator(sel).count() and page.locator(sel).first.is_visible() and page.locator(sel).first.evaluate("e => e.scrollWidth > e.clientWidth + 1"):
                    problems.append(f"{label}: {sel} does not fit")
            if english and page.inner_text("#wk-sub") != "Little Shop":
                problems.append(f"{label}: English title {page.inner_text('#wk-sub')!r}")
            if english and kind in ("cents", "change") and "." not in page.inner_text("#wk-goods"):
                problems.append(f"{label}: English prices {page.inner_text('#wk-goods')!r}")
            page.screenshot(path=str(SHOTS / f"winkel-layout-{kind}-{w}x{h}.png"))
            page.evaluate("window.__bubbels.back()")
            page.wait_for_timeout(80)
        if errors:
            problems.append(f"winkel {w}x{h}: page errors {errors[:2]}")
        ctx.close()


def winkel_csp(browser, base, problems):
    """Winkeltje under the real CSP (no bypass): a 3-5 question paid by real taps and a real drag
    (the dragged coin is moved through el.style, never an inline style), without a single violation."""
    ctx = browser.new_context(locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script("document.addEventListener('securitypolicyviolation', (e) => (window.__csp = window.__csp || []).push(`${e.violatedDirective} ${e.blockedURI} ${e.sample || ''}`.trim()))")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.locator("#tile-winkel").tap()
    page.wait_for_timeout(150)
    page.locator("#winkel-menu .level-cell[data-round='t1-1']").tap()
    page.wait_for_timeout(200)
    if page.is_visible("#overlay"):
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    for i in range(2):
        q = wk_state(page)["q"]
        n = q["target"] // 100
        wk_drag(page, "#wk-wallet .wk-stack[data-d='100']", "#wk-counter")
        wk_lay_taps(page, [100] * (n - 1))
        if len(wk_state(page)["laid"]) != n:
            problems.append(f"winkel csp q{i + 1}: laid {wk_state(page)['laid']} for {n} euro")
        if i == 0:
            page.screenshot(path=str(SHOTS / "winkel-csp-390x844.png"))
        wk_tap(page, "#wk-pay")
        wk_next(page, i, problems, "winkel csp")
    csp = page.evaluate("window.__csp || []")
    if csp:
        problems.append(f"winkel csp: the CSP blocked {csp[:3]}")
    if errors:
        problems.append(f"winkel csp: page errors {errors[:3]}")
    ctx.close()


def vz_state(page):
    return page.evaluate("window.__bubbels.verstop.state()")


def vz_tap(page, i):
    """A real tap on spot i, in the middle of its button (which must be on screen)."""
    page.locator(f"#vz-spots .vz-spot[data-i='{i}']").tap()


VZ_CLUES_JS = """() => [...document.querySelectorAll('#vz-spots .vz-spot')].map(b => {
  const c = b.querySelector('.vz-clue'), k = c && c.querySelector('.vz-peek');
  const cs = k && getComputedStyle(k), cc = c && getComputedStyle(c);
  const r = b.getBoundingClientRect(), q = k && k.getBoundingClientRect();
  return { i: Number(b.dataset.i), clue: !!c, n: b.querySelectorAll('.vz-clue').length,
    animal: c ? c.dataset.animal : null, feature: c ? (c.dataset.feature || null) : null, show: c ? c.dataset.show : null,
    seen: !!c && cc.visibility === 'visible' && Number(cs.opacity) > 0.9, vis: cc ? cc.visibility : null,
    anim: cs ? cs.animationName : null, opacity: cs ? Number(cs.opacity) : null, transform: cs ? cs.transform : null,
    inside: !!q && q.left >= r.left - 1 && q.right <= r.right + 1 && q.top >= r.top - 1 && q.bottom <= r.bottom + 1,
    box: q ? [q.left - r.left, q.top - r.top, q.right - r.right, q.bottom - r.bottom].map(v => Math.round(v)) : null };
})"""


def vz_clues(page):
    """Each spot's hint as drawn: is there one, whose, how it shows, is it seen now, does it move."""
    return page.evaluate(VZ_CLUES_JS)


def vz_check_clues(page, st, label, problems):
    """The hint on the hidden animals' spots only (in tier 3 the look-alikes too, each with its own
    feature), each drawn inside its own spot's button, none on a friend's spot."""
    tier = st["tier"]
    for c, s in zip(vz_clues(page), st["spots"]):
        who = s["who"]
        want = who["kind"] == "animal"
        if c["clue"] != want or c["n"] > 1:
            problems.append(f"{label}: spot {c['i']} ({who['id']}) has {c['n']} hints")
            continue
        if not want:
            continue
        if c["animal"] != who["id"] or c["feature"] != (who.get("feature") or None):
            problems.append(f"{label}: spot {c['i']} hides the {who['id']} {who.get('feature')} but hints {c['animal']} {c['feature']}")
        if c["show"] != {"t1": "always", "t2": "sometimes", "t3": "rarely"}[tier]:
            problems.append(f"{label}: spot {c['i']} hints {c['show']} in {tier}")
        if not c["inside"]:
            problems.append(f"{label}: the hint of spot {c['i']} leaves its button (left, top, right, bottom past it: {c['box']})")


def vz_spots_fit(page, w, h, label, problems):
    """Every spot on screen, 64 px or more and none overlapping; the animal to find on screen."""
    boxes = page.eval_on_selector_all("#vz-spots .vz-spot", "els => els.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })")
    for k, (x, y, bw, bh) in enumerate(boxes):
        if x < -0.5 or y < -0.5 or x + bw > w + 0.5 or y + bh > h + 0.5:
            problems.append(f"{label}: spot {k} not on screen ({x:.0f},{y:.0f} {bw:.0f}x{bh:.0f})")
        if bw < 63.5 or bh < 63.5:
            problems.append(f"{label}: spot {k} only {bw:.0f}x{bh:.0f} px")
    for a in range(len(boxes)):
        for b in range(a + 1, len(boxes)):
            A, B = boxes[a], boxes[b]
            if A[0] < B[0] + B[2] - 0.5 and B[0] < A[0] + A[2] - 0.5 and A[1] < B[1] + B[3] - 0.5 and B[1] < A[1] + A[3] - 0.5:
                problems.append(f"{label}: spots {a} and {b} overlap")
    for sel in ("#vz-ask-pics", "#vz-ask-text", "#verstop-back"):
        r = page.locator(sel).bounding_box()
        if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
            problems.append(f"{label}: {sel} not on screen ({r})")
    if page.evaluate("document.documentElement.scrollWidth") > w:
        problems.append(f"{label}: the page scrolls sideways")
    return min((b[2] for b in boxes), default=0)


def verstop_flow(browser, base, problems):
    """Verstoppertje at 390x844 with real taps: the tile in Puzzels opens the menu, a locked place
    and a locked tier offer only OK on the web; round garden-t1-1 played to the end with two wrong
    spots first (each creature peeks out and waves, then the spot settles back ajar, counted once),
    then the hedgehog (found, it stays in sight); the stars saved by extra looks; the next round with
    back (the Android back button) and "keep playing"; the end of the free part offers only OK and
    lands on the menu with the save kept; no voice, nothing from outside."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    name = page.inner_text("#tile-verstop .tile-name").replace("\u00ad", "").replace("\n", " ").strip()
    if name != "Verstoppertje":
        problems.append(f"verstop: the tile says {name!r}")
    if page.evaluate("document.querySelector('#tile-verstop').closest('.tile-group').querySelector('.group-name').textContent") != "Puzzels":
        problems.append("verstop: the tile is not in the Puzzels section")
    page.locator("#tile-verstop").scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / "verstop-home-390x844.png"))
    page.locator("#tile-verstop").tap()
    page.wait_for_timeout(200)
    if where(page) != ["verstop-menu", False]:
        problems.append(f"verstop: the tile opened {where(page)}")
    locked = page.locator("#verstop-menu .level-cell.locked:not(.random-btn)").count()
    if locked != 12:
        problems.append(f"verstop: {locked} rounds locked on the web in the garden, expected 12 (tiers 2 and 3)")
    if page.locator("#verstop-menu .vz-scene-btn .lock").count() != 3:
        problems.append("verstop: the forest, beach and farm are not locked on the web")
    page.screenshot(path=str(SHOTS / "verstop-menu-390x844.png"), full_page=True)
    for sel in ("#verstop-menu .vz-scene-btn[data-scene='beach']", "#verstop-menu .level-cell[data-round='garden-t2-1']", "#verstop-menu .random-btn"):
        choose(page, sel, tap=True)
        page.wait_for_timeout(150)
        if card_buttons(page) != ["Oké"]:
            problems.append(f"verstop: {sel} offers {card_buttons(page)}, not the web's OK")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
        if where(page) != ["verstop-menu", False] or vz_state(page):
            problems.append(f"verstop: after OK on {sel}: {where(page)}")

    # round garden-t1-1 by real taps: two wrong spots first
    choose(page, "#verstop-menu .level-cell[data-round='garden-t1-1']", tap=True)
    page.wait_for_timeout(250)
    if not page.is_visible("#overlay"):
        problems.append("verstop: no how-to card on the first round")
    else:
        page.screenshot(path=str(SHOTS / "verstop-how-390x844.png"))
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
    st = vz_state(page)
    if page.inner_text("#vz-ask-text").strip() != "Zoek de egel!" or page.locator("#vz-ask-pics .vz-pic").count() != 1:
        problems.append(f"verstop: garden-t1-1 asks {page.inner_text('#vz-ask-text')!r}")
    n = len(st["spots"])
    if not 4 <= n <= 5:
        problems.append(f"verstop: garden-t1-1 has {n} spots")
    page.screenshot(path=str(SHOTS / "verstop-round-390x844.png"))
    target = next(i for i, s in enumerate(st["spots"]) if s["target"])
    # the hint: a bit of the hedgehog peeks out over its spot from the start, still; no other spot hints
    vz_check_clues(page, st, "verstop garden-t1-1", problems)
    cl = vz_clues(page)
    if [c["i"] for c in cl if c["seen"]] != [target] or cl[target]["anim"] != "none":
        problems.append(f"verstop: garden-t1-1 hints {[(c['i'], c['seen'], c['anim']) for c in cl]}, want only spot {target}, still")
    page.locator(f"#vz-spots .vz-spot[data-i='{target}']").screenshot(path=str(SHOTS / "verstop-hint-t1.png"))
    first_kind = st["spots"][target]["kind"]
    wrong = [i for i, s in enumerate(st["spots"]) if not s["target"]][:2]
    names = {"snail": "de slak", "ladybug": "het lieveheers\u00adbeestje", "mouse": "de muis", "frog": "de kikker", "bird": "het vogeltje", "bee": "de bij", "butterfly": "de vlinder", "mole": "de mol"}
    for k, i in enumerate(wrong):
        vz_tap(page, i)
        page.wait_for_timeout(650)
        cls = page.get_attribute(f"#vz-spots .vz-spot[data-i='{i}']", "class")
        who = st["spots"][i]["who"]["id"]
        if "open" not in cls or "wave" not in cls:
            problems.append(f"verstop: spot {i} did not open and wave ({cls})")
        op = page.evaluate(f"getComputedStyle(document.querySelector(\"#vz-spots .vz-spot[data-i='{i}'] .vz-who\")).opacity")
        if float(op) < 0.9:
            problems.append(f"verstop: the {who} behind spot {i} is not seen (opacity {op})")
        status = page.inner_text("#vz-status").replace("\u00ad", "")
        if status != f"Hoi van {names[who]}!".replace("\u00ad", ""):
            problems.append(f"verstop: spot {i} says {status!r}")
        if k == 0:
            page.screenshot(path=str(SHOTS / "verstop-wave-390x844.png"))
        st2 = vz_state(page)
        if st2["play"]["extra"] != k + 1 or st2["done"]:
            problems.append(f"verstop: after {k + 1} wrong spots extra={st2['play']['extra']} done={st2['done']}")
    page.wait_for_timeout(1500)
    for i in wrong:
        cls = page.get_attribute(f"#vz-spots .vz-spot[data-i='{i}']", "class")
        if "ajar" not in cls or "open" in cls:
            problems.append(f"verstop: spot {i} did not settle back ajar ({cls})")
    page.screenshot(path=str(SHOTS / "verstop-ajar-390x844.png"))
    vz_tap(page, wrong[0])  # a second look at the same spot: it waves again, nothing counted
    page.wait_for_timeout(100)
    if vz_state(page)["play"]["extra"] != 2:
        problems.append("verstop: a second look at a spot was counted")
    vz_tap(page, target)
    page.wait_for_timeout(500)
    cls = page.get_attribute(f"#vz-spots .vz-spot[data-i='{target}']", "class")
    if "found" not in cls or page.inner_text("#vz-status") != "Gevonden!":
        problems.append(f"verstop: the hedgehog was not found ({cls}, {page.inner_text('#vz-status')!r})")
    if any(c["seen"] for c in vz_clues(page)):
        problems.append("verstop: the hint still shows once the hedgehog is found")
    page.screenshot(path=str(SHOTS / "verstop-found-390x844.png"))
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=4000)
    want = 3 if 2 <= (n - 1) // 2 else 2
    got = page.evaluate("window.__bubbels.verstop.stars()").get("garden-t1-1")
    title = page.inner_text("#ov-title").strip()
    if got != want or title != {3: "Super gezocht!", 2: "Goed gezocht!"}[want]:
        problems.append(f"verstop: garden-t1-1 with two extra looks of {n} spots: {got} stars saved, {title!r} (want {want})")
    op = page.evaluate(f"getComputedStyle(document.querySelector(\"#vz-spots .vz-spot[data-i='{target}'] .vz-who\")).opacity")
    if float(op) < 0.9:
        problems.append("verstop: the hedgehog did not stay in sight")
    page.screenshot(path=str(SHOTS / "verstop-win-390x844.png"))
    if card_buttons(page) != ["Volgende ronde", "Nog een keer", "Rondes"]:
        problems.append(f"verstop: the end card offers {card_buttons(page)}")

    # the next round; the Android back button halfway and "keep playing"
    page.click("#ov-buttons button >> nth=0")
    page.wait_for_timeout(200)
    st = vz_state(page)
    if st["roundId"] != "garden-t1-2" or st["play"]["looked"] or st["done"]:
        problems.append(f"verstop: Volgende ronde started {st['roundId']}")
    # the animal moved on: not behind the same kind of spot as in the round before
    if next(s["kind"] for s in st["spots"] if s["target"]) == first_kind:
        problems.append(f"verstop: garden-t1-2 hides the animal behind the {first_kind} again")
    other = next(i for i, s in enumerate(st["spots"]) if not s["target"])
    vz_tap(page, other)
    page.wait_for_timeout(100)
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(150)
    if where(page) != ["verstop-menu", False] or not page.is_visible("#verstop-continue") or page.inner_text("#verstop-continue").strip() != "Verder spelen":
        problems.append(f"verstop: back from a round went to {where(page)} without Verder spelen")
    page.locator("#verstop-continue").tap()
    page.wait_for_timeout(200)
    st2 = vz_state(page)
    cls = page.get_attribute(f"#vz-spots .vz-spot[data-i='{other}']", "class")
    if where(page) != ["verstop", False] or st2["roundId"] != "garden-t1-2" or st2["play"]["looked"] != [other] or "ajar" not in cls:
        problems.append(f"verstop: Verder spelen opened {where(page)} {st2['roundId']} looked {st2['play']['looked']} ({cls})")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(100)
    page.evaluate("window.__bubbels.back()")  # the menu goes home
    page.wait_for_timeout(100)
    if where(page) != ["home", False]:
        problems.append(f"verstop: back from the menu went to {where(page)}")

    # the end of the free part: "Meer rondes" offers only OK on the web, and lands on the menu
    page.locator("#tile-verstop").click()
    page.evaluate("window.__bubbels.verstop.start('garden-t1-6')")
    page.wait_for_timeout(150)
    st = vz_state(page)
    page.evaluate(f"window.__bubbels.verstop.tap({next(i for i, s in enumerate(st['spots']) if s['target'])})")
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=4000)
    if "laatste gratis" not in page.inner_text("#ov-text"):
        problems.append(f"verstop: the end of garden-t1-6 says {page.inner_text('#ov-text')!r}")
    if web_offer_ok(page, "verstop garden-t1-6", "verstop-menu", problems):
        if page.evaluate("window.__bubbels.verstop.stars()").get("garden-t1-6") != 3:
            problems.append(f"verstop: garden-t1-6 not saved ({page.evaluate('window.__bubbels.verstop.stars()')})")
    if page.locator("audio").count() or page.evaluate("typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking"):
        problems.append("verstop: something speaks")
    if errors:
        problems.append(f"verstop: page errors {errors[:3]}")
    if foreign:
        problems.append(f"verstop: requests outside the app {foreign[:3]}")
    ctx.close()


def verstop_layouts(browser, base, problems):
    """Verstoppertje on a small phone, an ordinary phone (in English), sideways and on desktop, with
    every tier in the full version (two animals, look-alikes and the memory question): every spot
    on screen, 64 px or more and none overlapping, the animal to find on screen, no sideways scroll;
    a tier 3 memory round played by real taps to the question and answered."""
    for w, h in ((320, 568), (390, 844), (568, 320), (844, 390), (1280, 800)):
        mobile = w < 1000
        english = (w, h) == (390, 844)
        ctx = browser.new_context(bypass_csp=True, locale="en-GB" if english else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
        ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        smallest = 999
        for rid in ("garden-t1-1", "forest-t2-1", "beach-t3-2", "farm-t3-1"):
            label = f"verstop {w}x{h} {rid}"
            page.evaluate(f"window.__bubbels.verstop.start('{rid}')")
            page.wait_for_timeout(200)
            if page.is_visible("#overlay"):
                page.click("#ov-buttons button")
                page.wait_for_timeout(150)
            st = vz_state(page)
            smallest = min(smallest, vz_spots_fit(page, w, h, label, problems))
            vz_check_clues(page, st, label, problems)
            if english and rid == "garden-t1-1" and page.inner_text("#vz-ask-text").strip() != "Find the hedgehog!":
                problems.append(f"{label}: English asks {page.inner_text('#vz-ask-text')!r}")
            if rid == "forest-t2-1" and page.locator("#vz-ask-pics .vz-pic").count() != 2:
                problems.append(f"{label}: two animals to find but {page.locator('#vz-ask-pics .vz-pic').count()} pictures")
            page.screenshot(path=str(SHOTS / f"verstop-{rid}-{w}x{h}.png"))
            if rid == "beach-t3-2":
                # a look-alike and a creature first, then the animal: every spot closes and asks where the creature was
                alike = next(i for i, s in enumerate(st["spots"]) if s["who"]["kind"] == "animal" and not s["target"])
                crit = next(i for i, s in enumerate(st["spots"]) if s["who"]["kind"] == "creature")
                target = next(i for i, s in enumerate(st["spots"]) if s["target"])
                for i in (alike, crit):
                    vz_tap(page, i) if mobile else page.locator(f"#vz-spots .vz-spot[data-i='{i}']").click()
                    page.wait_for_timeout(250)
                    if i == alike and ("but without a" if english else "maar zonder") not in page.inner_text("#vz-status"):
                        problems.append(f"{label}: a look-alike says {page.inner_text('#vz-status')!r}")
                page.locator(f"#vz-spots .vz-spot[data-i='{target}']").click()
                page.wait_for_function("window.__bubbels.verstop.state().play.phase === 'memory' && !window.__bubbels.verstop.state().waiting", timeout=5000)
                page.wait_for_timeout(500)
                shut = page.locator("#vz-spots .vz-spot.shut").count()
                if shut != len(st["spots"]) - 1:
                    problems.append(f"{label}: {shut} spots closed for the memory question")
                hid = [(c["i"], c["vis"]) for c in vz_clues(page) if c["clue"] and c["vis"] != "hidden"]
                if hid:
                    problems.append(f"{label}: hints not hidden in the memory question: {hid}")
                page.screenshot(path=str(SHOTS / f"verstop-memory-{w}x{h}.png"))
                ask = vz_state(page)["play"]["ask"]
                if ask != crit:
                    problems.append(f"{label}: the memory question asks spot {ask}, not {crit}")
                page.locator(f"#vz-spots .vz-spot[data-i='{ask}']").click()
                page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=4000)
                page.click("#ov-buttons button >> nth=-1")
                page.wait_for_timeout(150)
            else:
                page.evaluate("window.__bubbels.back()")
                page.wait_for_timeout(100)
        print(f"[verstop {w}x{h}] smallest spot {smallest:.0f} px")
        if errors:
            problems.append(f"verstop {w}x{h}: page errors {errors[:2]}")
        ctx.close()


# How a hint shows, read from verstop.css itself: the still transform (t1, and every hint with reduced
# motion) or the animation sought to its peak (t2, t3), on a stand-alone clue outside any spot.
VZ_PEEK_STATES_JS = """() => {
  const box = document.createElement('div');
  box.innerHTML = ['always', 'sometimes', 'rarely'].map(s => `<svg class="vz-svg" viewBox="0 0 100 100" width="10" height="10"><g class="vz-clue" data-show="${s}" data-beat="0"><g class="vz-peek"><rect width="1" height="1"/></g></g></svg>`).join('');
  document.body.appendChild(box);
  const out = {};
  for (const k of box.querySelectorAll('.vz-peek')) {
    const a = k.getAnimations()[0];
    if (a) {
      a.pause();
      a.effect.updateTiming({ delay: 0 });
      const peak = a.effect.getKeyframes().find(f => String(f.opacity) === '1');
      a.currentTime = peak.computedOffset * a.effect.getTiming().duration + 50;
    }
    const cs = getComputedStyle(k);
    out[k.parentNode.dataset.show] = { ty: new DOMMatrix(cs.transform).f, opacity: Number(cs.opacity), animated: !!a };
  }
  box.remove();
  return out;
}"""

# Every animal over every kind of spot, with every feature it may wear, drawn as the hint shows at
# `ty`: the pixels the hint adds to the spot (inside the spot's 100 x 100 box, and outside it, which
# must be none), and the pixels in its feature's colour. A spot is drawn 200 px wide.
VZ_HINT_PIXELS_JS = """async ({ states }) => {
  const A = await import('./games/verstop/art.js');
  const R = await import('./games/verstop/rules.js');
  const cv = document.createElement('canvas'); cv.width = 280; cv.height = 280;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  async function raw(svg, ty, away = false) {
    svg = svg.replace('viewBox="0 0 100 100"', 'viewBox="-20 -20 140 140" width="280" height="280" xmlns="http://www.w3.org/2000/svg"')
      .replace('<g class="vz-who">', '<g class="vz-who" opacity="0">')
      .replace('<g class="vz-peek">', `<g class="vz-peek" transform="translate(0 ${ty})"${away ? ' opacity="0"' : ''}>`);
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    cx.clearRect(0, 0, 280, 280); cx.drawImage(img, 0, 0);
    return cx.getImageData(0, 0, 280, 280).data;
  }
  const rgb = (h) => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const bare = {};
  const out = [];
  for (const st of states) {
    for (const kind of R.SPOT_KINDS) {
      const who = { kind: 'creature', id: 'frog' };
      bare[kind] = bare[kind] || await raw(A.spotSvg(kind, who, 1, null), 0);
      const b = bare[kind];
      for (const animal of R.ANIMAL_IDS) {
        for (const feature of st.features ? [null, ...R.featuresFor(animal)] : [null]) {
          const a = await raw(A.spotSvg(kind, who, 1, { animal, feature, show: st.show, beat: 0 }), st.ty);
          const col = feature && rgb(A.FEATURE_COLORS[feature]);
          let inside = 0, outside = 0, feat = 0;
          for (let i = 0; i < a.length; i += 4) {
            const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]);
            if (d <= 60) continue;
            const x = (i / 4) % 280, y = Math.floor(i / 4 / 280);
            if (x >= 40 && x < 240 && y >= 40 && y < 240) inside++; else outside++;
            if (col && a[i + 3] > 200 && Math.abs(a[i] - col[0]) + Math.abs(a[i + 1] - col[1]) + Math.abs(a[i + 2] - col[2]) < 40) feat++;
          }
          out.push({ state: st.name, kind, animal, feature, inside, outside, feat });
        }
      }
    }
  }
  // between two peeks (slid away, opacity 0) a spot with a hint must look exactly like one without
  const leaks = [];
  for (const kind of R.SPOT_KINDS) {
    const who = { kind: 'creature', id: 'frog' };
    for (const animal of R.ANIMAL_IDS) {
      for (const feature of [null, ...R.featuresFor(animal)]) {
        const a = await raw(A.spotSvg(kind, who, 1, { animal, feature, show: 'sometimes', beat: 0 }), 24, true);
        let n = 0;
        for (let i = 0; i < a.length; i++) if (a[i] !== bare[kind][i]) n++;
        leaks.push({ kind, animal, feature, differ: n });
      }
    }
  }
  return { rows: out, leaks };
}"""

# The least a hint must add to a spot drawn 200 px wide (VZ_HINT_PIXELS_JS), per tier: t1 a clear bit
# of the animal, t2 its head at the peek, t3 less but never nothing; a feature's glimpse in t3.
VZ_HINT_MIN = {"t1": 400, "t2": 600, "t3": 200}
VZ_FEATURE_MIN = 150


def vz_hint_pixels(browser, base, reduce):
    """The pixel matrix of every hint as verstop.css shows it, and the spots with a hint slid away (see VZ_HINT_PIXELS_JS)."""
    ctx = browser.new_context(bypass_csp=True, viewport={"width": 400, "height": 400}, reduced_motion="reduce" if reduce else "no-preference")
    page = ctx.new_page()
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    css = page.evaluate(VZ_PEEK_STATES_JS)
    states = [{"name": f"{tier}{'-reduced' if reduce else ''}", "tier": tier, "show": show, "ty": css[show]["ty"], "features": tier == "t3", "css": css[show]}
              for tier, show in (("t1", "always"), ("t2", "sometimes"), ("t3", "rarely"))]
    res = page.evaluate(VZ_HINT_PIXELS_JS, {"states": states})
    ctx.close()
    return states, res["rows"], res["leaks"]


def verstop_hint_pixels(browser, base, problems):
    """Every hint is on screen, by pixels: every animal over every kind of spot with every feature it
    may wear, still (t1), at the peak of its peek (t2, t3) and with reduced motion, adds at least
    VZ_HINT_MIN pixels to its spot and none outside it, and in t3 at least VZ_FEATURE_MIN pixels in
    its feature's colour; and between two peeks (slid away, opacity 0) a spot with a hint draws exactly
    the same pixels as one without, for every kind of spot. The numbers go to
    shots/verstop-hint-pixels.json."""
    report = []
    for reduce in (False, True):
        states, rows, leaks = vz_hint_pixels(browser, base, reduce)
        if not reduce:
            for r in leaks:
                if r["differ"]:
                    problems.append(f"verstop hint pixels: the {r['kind']} with a {r['animal']} {r['feature'] or ''} hint slid away differs from one without in {r['differ']} values (it gives the spot away)")
        for st in states:
            if st["css"]["opacity"] < 0.99:
                problems.append(f"verstop hint pixels {st['name']}: the hint is not opaque at its peak ({st['css']})")
            if reduce and st["css"]["animated"]:
                problems.append(f"verstop hint pixels {st['name']}: the hint still moves with reduced motion")
        tier_of = {st["name"]: st["tier"] for st in states}
        for r in rows:
            tag = f"verstop hint pixels {r['state']} {r['animal']} {r['feature'] or ''} behind the {r['kind']}"
            if r["inside"] < VZ_HINT_MIN[tier_of[r["state"]]]:
                problems.append(f"{tag}: only {r['inside']} px of the hint in sight (want {VZ_HINT_MIN[tier_of[r['state']]]})")
            if r["outside"]:
                problems.append(f"{tag}: {r['outside']} px drawn outside the spot")
            if r["feature"] and r["feat"] < VZ_FEATURE_MIN:
                problems.append(f"{tag}: only {r['feat']} px of the {r['feature']} in sight (want {VZ_FEATURE_MIN})")
        report.append({"states": states, "rows": rows})
        worst = min(rows, key=lambda r: r["inside"] / VZ_HINT_MIN[tier_of[r["state"]]])
        feats = [r for r in rows if r["feature"]]
        wf = min(feats, key=lambda r: r["feat"]) if feats else None
        print(f"[verstop hint pixels{' reduced' if reduce else ''}] {len(rows)} hints, faintest {worst['inside']} px ({worst['state']} {worst['animal']} {worst['kind']})"
              + (f", faintest feature {wf['feat']} px ({wf['state']} {wf['animal']} {wf['feature']} {wf['kind']})" if wf else ""))
    (SHOTS / "verstop-hint-pixels.json").write_text(json.dumps(report))


def verstop_hints(browser, base, problems):
    """Verstoppertje's hints, by tier, at 390x844 and 844x390: t1 a bit of the animal from the start,
    still; t2 each animal now and then (it moves, and is gone in between: watched over 10 s, each
    clue spot is seen and unseen, a friend's spot never), t3 rarely, the look-alikes too, each with
    its own feature; with prefers-reduced-motion every hint is still and in sight. Gone (computed
    visibility hidden, not just between peeks) on a found spot while the other animal's goes on, and
    on an opened look-alike. Screenshots of every tier in shots/verstop-hint-*."""
    for w, h in ((390, 844), (844, 390)):
        for reduce in (False, True):
            tag = f"verstop hints {w}x{h}{' reduced motion' if reduce else ''}"
            ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion="reduce" if reduce else "no-preference")
            ctx.add_init_script(OWNED_APP)
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(base + "/index.html?test")
            page.wait_for_selector("html[data-ready='1']")
            page.wait_for_function("window.__bubbels.full()", timeout=8000)
            for rid in ("garden-t1-1", "forest-t2-1", "beach-t3-1"):
                label = f"{tag} {rid}"
                page.evaluate(f"window.__bubbels.verstop.start('{rid}')")
                page.wait_for_timeout(150)
                if page.is_visible("#overlay"):
                    page.click("#ov-buttons button")
                st = vz_state(page)
                vz_check_clues(page, st, label, problems)
                hinted = [i for i, s in enumerate(st["spots"]) if s["who"]["kind"] == "animal"]
                seen, unseen, shot = set(), set(), False
                for k in range(1 if rid == "garden-t1-1" or reduce else 28):
                    if k:
                        page.wait_for_timeout(500)
                    cl = vz_clues(page)
                    for c in cl:
                        if c["seen"] and c["i"] not in hinted:
                            problems.append(f"{label}: a hint seen on spot {c['i']}, a friend's")
                    now = {c["i"] for c in cl if c["seen"]}
                    seen |= now
                    unseen |= {i for i in hinted if i not in now}
                    if reduce or rid == "garden-t1-1":
                        for c in cl:
                            if c["clue"] and (c["anim"] != "none" or not c["seen"]):
                                problems.append(f"{label}: the hint of spot {c['i']} is not still and in sight ({c['anim']}, seen {c['seen']})")
                    if now and not shot:
                        page.screenshot(path=str(SHOTS / f"verstop-hint-{rid}-{w}x{h}{'-reduced' if reduce else ''}.png"))
                        shot = True
                    if not reduce and rid != "garden-t1-1":
                        for c in cl:
                            if c["clue"] and c["anim"] not in ("vz-peek-some", "vz-peek-rare"):
                                problems.append(f"{label}: the hint of spot {c['i']} does not come and go ({c['anim']})")
                if seen != set(hinted):
                    problems.append(f"{label}: hints seen on {sorted(seen)}, want {hinted}")
                if not reduce and rid != "garden-t1-1" and unseen != set(hinted):
                    problems.append(f"{label}: hints never gone on {sorted(set(hinted) - unseen)}")
                if not shot:
                    page.screenshot(path=str(SHOTS / f"verstop-hint-{rid}-{w}x{h}{'-reduced' if reduce else ''}.png"))
                if rid == "forest-t2-1":
                    # one animal found: its hint is gone (hidden, not just between two peeks), the other's goes on
                    first, other = hinted
                    vz_tap(page, first)
                    page.wait_for_timeout(300)
                    cl = vz_clues(page)
                    if cl[first]["vis"] != "hidden":
                        problems.append(f"{label}: the hint of the found spot {first} is {cl[first]['vis']}, not hidden")
                    if cl[other]["vis"] != "visible" or cl[other]["anim"] != ("none" if reduce else "vz-peek-some"):
                        problems.append(f"{label}: the other animal's hint after the first find: {cl[other]['vis']} {cl[other]['anim']}")
                if rid == "beach-t3-1":
                    # a look-alike opened: its hint is hidden while it waves and once it is ajar
                    alike = next(i for i, s in enumerate(st["spots"]) if s["who"]["kind"] == "animal" and not s["target"])
                    vz_tap(page, alike)
                    for when, ms in (("waving", 300), ("ajar", 1700)):
                        page.wait_for_timeout(ms)
                        v = vz_clues(page)[alike]["vis"]
                        if v != "hidden":
                            problems.append(f"{label}: the hint of the opened look-alike (spot {alike}, {when}) is {v}")
                page.evaluate("window.__bubbels.back()")
                page.wait_for_timeout(100)
            if errors:
                problems.append(f"{tag}: page errors {errors[:2]}")
            ctx.close()


def km_state(page):
    return page.evaluate("window.__bubbels.kaart.state()")


def km_target(page, rid):
    return page.evaluate(f"window.__bubbels.kaart.target('{rid}')")


def km_chip(page, rid):
    box = page.locator(f"#km-tray .km-chip[data-id='{rid}']").bounding_box()
    return {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] * 0.35}


def km_drag(page, a, b, steps=10):
    """A real mouse drag from a to b (page px)."""
    page.mouse.move(a["x"], a["y"])
    page.mouse.down()
    for k in range(1, steps + 1):
        page.mouse.move(a["x"] + (b["x"] - a["x"]) * k / steps, a["y"] + (b["y"] - a["y"]) * k / steps)
    page.mouse.up()
    page.wait_for_timeout(60)


def km_touch_drag(cdp, a, b, steps=10):
    """A real finger drag (touch events) from a to b."""
    pi_touch(cdp, "touchStart", [{"x": a["x"], "y": a["y"]}])
    for k in range(1, steps + 1):
        pi_touch(cdp, "touchMove", [{"x": a["x"] + (b["x"] - a["x"]) * k / steps, "y": a["y"] + (b["y"] - a["y"]) * k / steps}])
    pi_touch(cdp, "touchEnd", [])


def km_context(browser, w, h, locale="nl-NL", owned=False):
    mobile = w < 1000
    ctx = browser.new_context(bypass_csp=True, locale=locale, viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
    if owned:
        ctx.add_init_script(OWNED_APP)
    return ctx


def km_open(page, base):
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")


def kaart_flow(browser, base, problems):
    """Kaartpuzzel at 390x844 in Dutch with real input: the tile in Leren opens the menu on the
    child's own country (Nederland on an nl-NL device), the other rounds of that map offer only OK
    on the web; round nl-t1-1 played to the end: one wrong drop on another province's place (a
    bounce, counted once, not placed), the pieces by mouse drags, one by a finger (drawn above the
    finger), one by tap-tap; 2 stars saved; the next round, back and "keep playing"; the end of the
    free part offers only OK; "Waar ligt...?" on the free continents with two wrong taps (the right
    one glows, no more mistakes after that); "Ander land" picks the United States (kept after a
    reload); an en-US device starts on the United States, en-GB on the United Kingdom, nl-BE and
    de-DE on no country at all. Nothing from outside, nothing spoken."""
    ctx = km_context(browser, 390, 844)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))
    km_open(page, base)
    name = page.inner_text("#tile-kaart .tile-name").strip()
    if name != "Kaartpuzzel":
        problems.append(f"kaart: the tile says {name!r}")
    if page.evaluate("document.querySelector('#tile-kaart').closest('.tile-group').querySelector('.group-name').textContent") != "Leren":
        problems.append("kaart: the tile is not in the Leren section")
    page.locator("#tile-kaart").scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / "kaart-home-390x844.png"))
    page.locator("#tile-kaart").tap()
    page.wait_for_selector("#kaart-tiers .level-cell")
    if where(page) != ["kaart-menu", False]:
        problems.append(f"kaart: the tile opened {where(page)}")
    packs = page.eval_on_selector_all("#kaart-menu .km-pack", "els => els.map(e => [e.textContent, e.getAttribute('aria-pressed')])")
    if packs != [["Werelddelen", "false"], ["Europa", "false"], ["Nederland", "true"], ["Ander land…", None]]:
        problems.append(f"kaart: the maps on an nl-NL device are {packs}")
    locked = page.locator("#kaart-menu .full-fold .level-cell.locked").count()
    if locked != 5:
        problems.append(f"kaart: {locked} rounds of Nederland locked on the web, expected 5 (tiers 2 and 3)")
    page.screenshot(path=str(SHOTS / "kaart-menu-390x844.png"), full_page=True)
    choose(page, "#kaart-menu .level-cell[data-round='nl-t2-1']", tap=True)
    page.wait_for_timeout(150)
    if card_buttons(page) != ["Oké"]:
        problems.append(f"kaart: a locked round offers {card_buttons(page)}, not the web's OK")
    page.click("#ov-buttons button")
    page.wait_for_timeout(150)
    if where(page) != ["kaart-menu", False] or km_state(page):
        problems.append(f"kaart: after OK on a locked round: {where(page)}")

    # round nl-t1-1 by real drags
    choose(page, "#kaart-tiers .level-cell[data-round='nl-t1-1']", tap=True)
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.screenshot(path=str(SHOTS / "kaart-how-390x844.png"))
    page.click("#ov-buttons button")
    page.wait_for_timeout(200)
    st = km_state(page)
    if st["kind"] != "puzzle" or not st["lines"] or len(st["items"]) != 6:
        problems.append(f"kaart: nl-t1-1 is {st['kind']} with {len(st['items'])} pieces")
    v = page.evaluate("window.__bubbels.kaart.view()")
    if v["max"] != 1:
        problems.append(f"kaart: the Dutch map offers the magnifier at 390 px ({v})")
    first = st["items"][0]
    other = st["items"][1]
    km_drag(page, km_chip(page, first), km_target(page, other))
    st = km_state(page)
    if st["placed"] or st["mistakes"] != 1 or st["tries"].get(first) != 1:
        problems.append(f"kaart: a drop of {first} on {other}'s place: placed {st['placed']}, mistakes {st['mistakes']}, tries {st['tries']}")
    if "nog eens" not in page.inner_text("#km-status"):
        problems.append(f"kaart: a wrong drop says {page.inner_text('#km-status')!r}")
    km_drag(page, km_chip(page, first), km_target(page, other))  # the same piece wrong again: still one mistake, now it glows
    st = km_state(page)
    if st["mistakes"] != 1 or st["glow"] != first:
        problems.append(f"kaart: a second wrong drop: mistakes {st['mistakes']}, glow {st['glow']}")
    page.screenshot(path=str(SHOTS / "kaart-glow-390x844.png"))
    did = {"mouse": 0, "finger": False, "taps": False}
    while True:
        st = km_state(page)
        left = [x for x in st["items"] if x not in st["placed"]]
        if not left:
            break
        rid = page.locator("#km-tray .km-chip").first.get_attribute("data-id")
        t = km_target(page, rid)
        if not did["finger"] and did["mouse"] >= 1:
            # a finger: the piece is drawn above it, so the finger goes below the place
            km_touch_drag(cdp, km_chip(page, rid), {"x": t["x"], "y": t["y"] + 44})
            page.wait_for_timeout(80)
            did["finger"] = True
        elif not did["taps"] and did["mouse"] >= 1:
            page.locator(f"#km-tray .km-chip[data-id='{rid}']").tap()
            page.wait_for_timeout(60)
            if "tik nu" not in page.inner_text("#km-status"):
                problems.append(f"kaart: a tap on the piece {rid} says {page.inner_text('#km-status')!r}")
            page.touchscreen.tap(t["x"], t["y"])
            page.wait_for_timeout(80)
            did["taps"] = True
        else:
            km_drag(page, km_chip(page, rid), t)
            did["mouse"] += 1
        if rid not in km_state(page)["placed"]:
            problems.append(f"kaart: {rid} not placed by {did}")
            page.evaluate(f"window.__bubbels.kaart.place('{rid}')")
        if len(km_state(page)["placed"]) == 2:
            page.screenshot(path=str(SHOTS / "kaart-puzzle-390x844.png"))
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=4000)
    page.screenshot(path=str(SHOTS / "kaart-win-390x844.png"))
    got = page.evaluate("window.__bubbels.kaart.stars()").get("nl-t1-1")
    if page.inner_text("#ov-title").strip() != "Goed gedaan!" or got != 2:
        problems.append(f"kaart: nl-t1-1 with one mistake ended {page.inner_text('#ov-title')!r}, stars {got}")
    if card_buttons(page) != ["Volgende ronde", "Nog een keer", "Rondes"]:
        problems.append(f"kaart: the end card offers {card_buttons(page)}")

    # the next round; back halfway and "keep playing"
    page.click("#ov-buttons button >> nth=0")
    page.wait_for_timeout(250)
    st = km_state(page)
    if st["roundId"] != "nl-t1-2":
        problems.append(f"kaart: Volgende ronde started {st['roundId']}")
    page.evaluate(f"window.__bubbels.kaart.place('{st['items'][0]}')")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(150)
    if where(page) != ["kaart-menu", False] or page.inner_text("#kaart-continue").strip() != "Verder spelen":
        problems.append(f"kaart: back from a round went to {where(page)} without Verder spelen")
    page.locator("#kaart-continue").tap()
    page.wait_for_timeout(150)
    st = km_state(page)
    if where(page) != ["kaart", False] or st["roundId"] != "nl-t1-2" or len(st["placed"]) != 1 or page.locator("#km-tray .km-chip").count() < 1:
        problems.append(f"kaart: Verder spelen opened {where(page)} with {st['placed']}")
    # the end of the free part: the last free round of Nederland offers only OK, lands on the menu
    for rid in st["items"][1:]:
        page.evaluate(f"window.__bubbels.kaart.place('{rid}')")
    page.wait_for_timeout(900)
    if "laatste gratis" not in page.inner_text("#ov-text"):
        problems.append(f"kaart: the end of nl-t1-2 says {page.inner_text('#ov-text')!r}")
    if web_offer_ok(page, "kaart nl-t1-2", "kaart-menu", problems) and page.evaluate("window.__bubbels.kaart.stars()").get("nl-t1-2") != 3:
        problems.append(f"kaart: nl-t1-2 not saved ({page.evaluate('window.__bubbels.kaart.stars()')})")

    # "Waar ligt...?" on the free continents: two wrong taps, the right one glows, then the right tap
    page.evaluate("window.__bubbels.kaart.start('continents-t2-1')")
    page.wait_for_selector("#overlay:not([hidden])", timeout=4000)
    page.click("#ov-buttons button")
    page.wait_for_timeout(200)
    st = km_state(page)
    want = st["items"][0]
    wrong = next(x for x in st["items"] if x != want)
    for k in range(2):
        t = km_target(page, wrong)
        page.touchscreen.tap(t["x"], t["y"])
        page.wait_for_timeout(120)
    st = km_state(page)
    if st["mistakes"] != 1 or st["glow"] != want or st["found"]:
        problems.append(f"kaart: two wrong taps: mistakes {st['mistakes']}, glow {st['glow']}, found {st['found']}")
    if not page.locator(f"#km-regions .km-reg.glow[data-id='{want}']").count():
        problems.append(f"kaart: {want} does not glow after two wrong taps")
    page.screenshot(path=str(SHOTS / "kaart-where-glow-390x844.png"))
    t = km_target(page, want)
    page.touchscreen.tap(t["x"], t["y"])
    page.wait_for_timeout(100)
    st = km_state(page)
    if st["found"] != [want] or "Goed zo" not in page.inner_text("#km-status"):
        problems.append(f"kaart: the right tap found {st['found']}, says {page.inner_text('#km-status')!r}")
    page.wait_for_function("window.__bubbels.kaart.state().i === 1", timeout=4000)
    # the next ones by real taps on their centres
    while not km_state(page)["done"]:
        st = km_state(page)
        if st["waiting"]:
            page.wait_for_timeout(150)
            continue
        t = km_target(page, st["items"][st["i"]])
        page.touchscreen.tap(t["x"], t["y"])
        page.wait_for_timeout(150)
        if km_state(page)["mistakes"] != 1:
            problems.append(f"kaart: a tap on the centre of {st['items'][st['i']]} was wrong")
            break
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=4000)
    if page.evaluate("window.__bubbels.kaart.stars()").get("continents-t2-1") != 2:
        problems.append(f"kaart: continents-t2-1 stars {page.evaluate('window.__bubbels.kaart.stars()')}")
    if card_buttons(page)[0] != "Volgende ronde":
        problems.append(f"kaart: the continents are free, yet the end card offers {card_buttons(page)}")
    page.click("#ov-buttons button >> nth=2")
    page.wait_for_timeout(200)

    # "Ander land…": the United States, kept after a reload
    page.locator("#kaart-country").tap()
    page.wait_for_timeout(150)
    if card_buttons(page) != ["Nederland", "Verenigde Staten", "Verenigd Koninkrijk", "Geen land"]:
        problems.append(f"kaart: Ander land offers {card_buttons(page)}")
    page.click("#ov-buttons button >> nth=1")
    page.wait_for_selector("#kaart-tiers .level-cell")
    packs = page.eval_on_selector_all("#kaart-menu .km-pack", "els => els.map(e => [e.textContent, e.getAttribute('aria-pressed')])")
    if packs[:3] != [["Werelddelen", "false"], ["Europa", "false"], ["Verenigde Staten", "true"]]:
        problems.append(f"kaart: after picking the United States the maps are {packs}")
    km_open(page, base)
    if page.evaluate("window.__bubbels.kaart.country()") != "us":
        problems.append("kaart: the picked country is not kept after a reload")
    if page.locator("audio").count() or page.evaluate("typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking"):
        problems.append("kaart: something speaks")
    if errors:
        problems.append(f"kaart: page errors {errors[:3]}")
    if foreign:
        problems.append(f"kaart: requests outside the app {foreign[:3]}")
    ctx.close()

    # the device language picks the first country (and nobody else is pushed one)
    for locale, want_country, want_packs in (("en-US", "us", ["Continents", "Europe", "United States", "Other country…"]),
                                            ("en-GB", "uk", ["Continents", "Europe", "United Kingdom", "Other country…"]),
                                            ("nl-BE", None, ["Werelddelen", "Europa", "Ander land…"]),
                                            ("de-DE", None, ["Werelddelen", "Europa", "Ander land…"])):
        ctx = km_context(browser, 390, 844, locale=locale)
        page = ctx.new_page()
        km_open(page, base)
        page.evaluate("window.__bubbels.games ? 0 : 0")
        page.locator("#tile-kaart").scroll_into_view_if_needed()
        page.locator("#tile-kaart").tap()
        page.wait_for_selector("#kaart-tiers .level-cell")
        got = page.eval_on_selector_all("#kaart-menu .km-pack", "els => els.map(e => e.textContent)")
        if page.evaluate("window.__bubbels.kaart.country()") != want_country or got != want_packs:
            problems.append(f"kaart {locale}: country {page.evaluate('window.__bubbels.kaart.country()')}, maps {got}")
        pressed = page.eval_on_selector("#kaart-menu .km-pack[aria-pressed='true']", "e => e.dataset.pack")
        if pressed != (want_country or "continents"):
            problems.append(f"kaart {locale}: the menu opens on {pressed}")
        ctx.close()


def kaart_layouts(browser, base, problems):
    """Kaartpuzzel on a small phone, an ordinary phone (in English), sideways both ways and on
    desktop, in the full version: a puzzle (nl-t1-1, us-t3-1 without lines), "Where is...?" (us-t2-1)
    and the capitals (europe-t3-2): the map, the question, the pieces and the buttons on screen, the
    pieces 64 px or more, the buttons 44 px or more, no sideways scrolling; the magnifier only where
    regions are tiny; on 320x568 a real tap on the asked state's centre finds it."""
    for w, h in ((320, 568), (390, 844), (568, 320), (844, 390), (1280, 800)):
        english = (w, h) == (390, 844)
        ctx = km_context(browser, w, h, locale="en-GB" if english else "nl-NL", owned=True)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        km_open(page, base)
        page.wait_for_function("window.__bubbels.full()", timeout=8000)
        for rid in ("nl-t1-1", "us-t2-1", "europe-t3-2", "us-t3-1"):
            label = f"kaart {w}x{h} {rid}"
            page.evaluate(f"window.__bubbels.kaart.start('{rid}')")
            page.wait_for_timeout(300)
            if page.is_visible("#overlay"):
                page.click("#ov-buttons button")
                page.wait_for_timeout(150)
            st = km_state(page)
            v = page.evaluate("window.__bubbels.kaart.view()")
            targets = ["#kaart-back"] + (["#kaart-zoom"] if page.is_visible("#kaart-zoom") else [])
            chips = [f"#km-tray .km-chip >> nth={k}" for k in range(page.locator("#km-tray .km-chip").count())]
            if st["kind"] == "puzzle" and not chips:
                problems.append(f"{label}: no pieces in the tray")
            for sel in targets + chips + ["#km-ask", "#km-mapbox"]:
                r = page.locator(sel).bounding_box()
                if not r or r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                    problems.append(f"{label}: {sel} not on screen ({r})")
                elif sel in targets and (r["width"] < 43.5 or r["height"] < 43.5):
                    problems.append(f"{label}: {sel} only {r['width']:.0f}x{r['height']:.0f} px")
                elif sel in chips and (r["width"] < 63.5 or r["height"] < 63.5):
                    problems.append(f"{label}: the piece {sel} only {r['width']:.0f}x{r['height']:.0f} px")
                elif sel == "#km-mapbox" and (r["height"] < 150 or r["width"] < 250):
                    problems.append(f"{label}: the map is only {r['width']:.0f}x{r['height']:.0f} px")
            if page.evaluate("document.documentElement.scrollWidth") > w:
                problems.append(f"{label}: the page scrolls sideways")
            if page.locator("#km-ask").evaluate("e => e.scrollWidth > e.clientWidth + 1"):
                problems.append(f"{label}: the question does not fit")
            if rid.startswith("nl") and v["max"] != 1:
                problems.append(f"{label}: the Dutch map offers the magnifier")
            if rid.startswith("us") and w <= 390 and v["max"] <= 1:
                problems.append(f"{label}: no magnifier for the small states")
            if w >= 1000 and v["max"] != 1 and rid.startswith("nl"):
                problems.append(f"{label}: a magnifier on desktop")
            if english and page.inner_text("#km-sub") not in ("The Netherlands", "United States", "Europe"):
                problems.append(f"{label}: English title {page.inner_text('#km-sub')!r}")
            if rid == "us-t2-1" and w == 320:
                want = st["items"][0]
                t = km_target(page, want)
                page.touchscreen.tap(t["x"], t["y"])
                page.wait_for_timeout(120)
                if km_state(page)["found"] != [want]:
                    problems.append(f"{label}: a tap on the centre of {want} did not find it ({km_state(page)})")
                page.wait_for_timeout(1300)
                # the magnifier: on, the map 3x, a finger drag pans it, off again
                page.locator("#kaart-zoom").tap()
                page.wait_for_timeout(100)
                if page.evaluate("window.__bubbels.kaart.view()")["z"] <= 1:
                    problems.append(f"{label}: the magnifier does not zoom")
                page.screenshot(path=str(SHOTS / f"kaart-{rid}-zoom-{w}x{h}.png"))
                page.locator("#kaart-zoom").tap()
            page.screenshot(path=str(SHOTS / f"kaart-{rid}-{w}x{h}.png"))
            page.evaluate("window.__bubbels.back()")
            page.wait_for_timeout(100)
        if w == 320:
            # the smallest states with the borders: the magnifier is on from the start, around them
            page.evaluate("window.__bubbels.kaart.start('us-t1-7')")
            page.wait_for_timeout(300)
            v = page.evaluate("window.__bubbels.kaart.view()")
            if v["z"] <= 1:
                problems.append(f"kaart 320x568 us-t1-7: the smallest states do not start with the magnifier ({v})")
            for rid in km_state(page)["items"][:2]:
                t = km_target(page, rid)
                if not (0 <= t["x"] <= w and 0 <= t["y"] <= h):
                    problems.append(f"kaart 320x568 us-t1-7: the place of {rid} is out of the zoomed view ({t})")
            page.screenshot(path=str(SHOTS / "kaart-us-t1-7-zoom-320x568.png"))
            page.evaluate("window.__bubbels.back()")
            page.wait_for_timeout(100)
        if errors:
            problems.append(f"kaart {w}x{h}: page errors {errors[:2]}")
        ctx.close()


PLAY_URL = "https://play.google.com/store/apps/details?id=work.westerweel.bazibo"
# ---------- Papegaai (Parrot) ----------

# Chromium's own stand-ins for a microphone: a fake device that plays a beep, and no permission prompt
MIC_ARGS = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
# counts the microphone requests and the sources the parrot plays, and keeps the microphone tracks
PG_COUNT = """
(() => {
  window.__gum = 0; window.__src = 0; window.__tracks = [];
  for (const AC of [window.AudioContext, window.webkitAudioContext]) {
    if (!AC || AC.prototype.__pgCounted) continue;
    const make = AC.prototype.createBufferSource;
    AC.prototype.createBufferSource = function () { window.__src++; return make.call(this); };
    AC.prototype.__pgCounted = true;
  }
  const md = navigator.mediaDevices;
  if (md && md.getUserMedia) {
    const gum = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { window.__gum++; const s = await gum(c); window.__tracks.push(...s.getTracks()); return s; };
  }
})();
"""
PG_DENY = """
(() => {
  window.__gum = 0;
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__gum++; return Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); };
  // a refused microphone, as the Permissions API reports it once a request was refused
  if (navigator.permissions) navigator.permissions.query = async () => ({ state: localStorage.getItem('pg-refused') ? 'denied' : 'prompt' });
  const gum = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  if (gum) navigator.mediaDevices.getUserMedia = (c) => { localStorage.setItem('pg-refused', '1'); return gum(c); };
})();
"""
PG_NO_MIC = "window.__gum = 0; Object.defineProperty(Navigator.prototype, 'mediaDevices', { get: () => undefined, configurable: true });"
PG_GATE_PASSED = seeded({"version": 1, "games": {}, "settings": {"muted": False, "lang": None, "micGate": True}, "purchase": {"owned": False}})


def pg_state(page):
    return page.evaluate("window.__bubbels.papegaai.state()")


def pg_wait(page, cond, timeout=6000):
    page.wait_for_function(f"(() => {{ const s = window.__bubbels.papegaai.state(); return {cond}; }})()", timeout=timeout)


def pg_mic_on(page):
    """How many microphone tracks are still live."""
    return page.evaluate("window.__tracks.filter((t) => t.readyState === 'live').length")


def pg_hold(page, cdp, ms):
    """Hold the record button with a finger for `ms`, then lift it."""
    box = page.locator("#papegaai-rec").bounding_box()
    pt = {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}
    pi_touch(cdp, "touchStart", [pt])
    page.wait_for_timeout(ms)
    pi_touch(cdp, "touchEnd", [])


def pg_mic_browser(browser):
    return browser.browser_type.launch(executable_path=CHROME, args=MIC_ARGS)


def papegaai_flow(browser, base, problems):
    """Papegaai at 390x844 with real touch and Chromium's fake microphone: the tile in Creatief; a
    voice before any recording asks for one; the first press shows why, then the parental gate
    (cancelling either asks no microphone); after the gate the system is asked once and the
    microphone closed again; a held recording is said back and every free voice plays (sources
    counted, the choir three); a locked voice offers only OK on the web; a tap records until the
    10 s cap; leaving, the background, the back arrow and the Android back button all drop the
    recording and close the microphone."""
    mb = pg_mic_browser(browser)
    ctx = mb.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script(PG_COUNT)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    if page.inner_text("#tile-papegaai .tile-name").strip() != "Papegaai":
        problems.append(f"papegaai: tile says {page.inner_text('#tile-papegaai .tile-name')!r}")
    if page.evaluate("document.querySelector('#tile-papegaai').closest('.tile-group').querySelector('.group-name').textContent") != "Creatief":
        problems.append("papegaai: the tile is not in the Creatief section")
    page.locator("#tile-papegaai").scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / "papegaai-flow-home-390x844.png"))
    page.click("#tile-papegaai")
    page.wait_for_timeout(250)
    st = pg_state(page)
    if where(page) != ["papegaai", False] or st["phase"] != "idle" or st["hasTake"]:
        problems.append(f"papegaai: the tile opened {where(page)} in {st}")
    if st["locked"] != ["achteruit", "echo", "koor", "ballon"]:
        problems.append(f"papegaai: locked voices on the web are {st['locked']}")
    page.screenshot(path=str(SHOTS / "papegaai-flow-start-390x844.png"))

    # a free voice before any recording: the parrot asks for one, nothing plays
    page.locator(".pg-voice[data-voice='muis']").tap()
    page.wait_for_timeout(100)
    if pg_state(page)["say"] != "first" or page.evaluate("window.__src") or where(page)[1]:
        problems.append(f"papegaai: a voice without a recording: {pg_state(page)['say']}, {page.evaluate('window.__src')} sources")

    # the first press: why, then the gate; cancelling either asks no microphone
    page.locator("#papegaai-rec").tap()
    page.wait_for_timeout(200)
    if card_buttons(page) != ["Voor ouders", "Annuleren"] or "toestel" not in page.inner_text("#ov-text"):
        problems.append(f"papegaai: the first press showed {card_buttons(page)}: {page.inner_text('#ov-text')!r}")
    page.screenshot(path=str(SHOTS / "papegaai-flow-why-390x844.png"))
    page.click("#ov-buttons button >> nth=1")
    page.wait_for_timeout(150)
    if where(page) != ["papegaai", False] or page.evaluate("window.__gum"):
        problems.append(f"papegaai: cancelling the why card left {where(page)}, {page.evaluate('window.__gum')} microphone requests")
    page.locator("#papegaai-rec").tap()
    page.wait_for_timeout(150)
    page.click("#ov-buttons button >> nth=0")
    page.wait_for_selector(".gate-input")
    page.screenshot(path=str(SHOTS / "papegaai-flow-gate-390x844.png"))
    page.click("#ov-buttons .btn.secondary")  # cancel the gate
    page.wait_for_timeout(200)
    if where(page) != ["papegaai", False] or page.evaluate("window.__gum") or pg_state(page)["gate"]:
        problems.append(f"papegaai: a cancelled gate left {where(page)}, {page.evaluate('window.__gum')} microphone requests, gate {pg_state(page)['gate']}")
    page.locator("#papegaai-rec").tap()
    page.wait_for_timeout(150)
    page.click("#ov-buttons button >> nth=0")
    solve_gate(page, "nl")
    # Chromium's fake prompt says yes without remembering it; a real browser would now answer
    # 'granted' to the Permissions API, so the gate is not asked again after the background
    ctx.grant_permissions(["microphone"])
    try:
        pg_wait(page, "s.gate && s.mics === 1 && s.phase === 'idle' && s.say === 'ready'")
    except Exception:
        problems.append(f"papegaai: after the gate {pg_state(page)}")
    page.wait_for_timeout(150)
    if page.evaluate("window.__gum") != 1 or pg_mic_on(page) or where(page)[1]:
        problems.append(f"papegaai: after the gate {page.evaluate('window.__gum')} requests, {pg_mic_on(page)} microphones on, card {where(page)[1]}")

    # hold and talk: the parrot listens (the beak moves), then says it back
    box = page.locator("#papegaai-rec").bounding_box()
    pt = {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}
    pi_touch(cdp, "touchStart", [pt])
    try:
        pg_wait(page, "s.phase === 'recording'", 4000)
    except Exception:
        problems.append(f"papegaai: holding the button does not record: {pg_state(page)}")
    page.wait_for_timeout(1300)
    st = pg_state(page)
    page.screenshot(path=str(SHOTS / "papegaai-flow-listening-390x844.png"))
    if st["say"] != "listening" or st["tapMode"] or pg_mic_on(page) != 1:
        problems.append(f"papegaai: while holding {st}, {pg_mic_on(page)} microphones on")
    pi_touch(cdp, "touchEnd", [])
    try:
        pg_wait(page, "s.phase === 'playing' && s.voice === 'gewoon'", 3000)
    except Exception:
        problems.append(f"papegaai: the parrot did not say it back: {pg_state(page)}")
    page.wait_for_timeout(250)
    st = pg_state(page)
    page.screenshot(path=str(SHOTS / "papegaai-flow-playing-390x844.png"))
    if not st["hasTake"] or not 0.5 < st["seconds"] <= 10 or st["sources"] != 1 or pg_mic_on(page):
        problems.append(f"papegaai: after the recording {st}, {pg_mic_on(page)} microphones on")
    if page.evaluate("window.__src") != 1:
        problems.append(f"papegaai: saying it back made {page.evaluate('window.__src')} sources")
    try:
        pg_wait(page, "s.phase === 'ready'", 8000)
    except Exception:
        problems.append(f"papegaai: the parrot never finished: {pg_state(page)}")

    # every free voice plays the recording
    for voice, n in (("gewoon", 1), ("muis", 1), ("beer", 1)):
        src = page.evaluate("window.__src")
        page.locator(f".pg-voice[data-voice='{voice}']").tap()
        page.wait_for_timeout(120)
        st = pg_state(page)
        if st["voice"] != voice or st["phase"] != "playing" or page.evaluate("window.__src") - src != n or st["sources"] != n:
            problems.append(f"papegaai: {voice} played {st['voice']} in {st['phase']} with {page.evaluate('window.__src') - src} sources")
        if voice == "beer":
            page.screenshot(path=str(SHOTS / "papegaai-flow-bear-390x844.png"))
    # a locked voice: only OK on the web, the recording kept
    page.locator(".pg-voice[data-voice='koor']").tap()
    page.wait_for_timeout(150)
    if card_buttons(page) != ["Oké"] or "gratis" not in page.inner_text("#ov-text"):
        problems.append(f"papegaai: a locked voice offered {card_buttons(page)}: {page.inner_text('#ov-text')!r}")
    page.screenshot(path=str(SHOTS / "papegaai-flow-locked-390x844.png"))
    page.click("#ov-buttons button >> nth=0")
    page.wait_for_timeout(150)
    if where(page) != ["papegaai", False] or not pg_state(page)["hasTake"]:
        problems.append(f"papegaai: after the offer {where(page)}, recording kept: {pg_state(page)['hasTake']}")

    # leaving drops the recording (the back arrow)
    page.click("#papegaai-back")
    page.wait_for_timeout(200)
    st = pg_state(page)
    if where(page) != ["home", False] or st["hasTake"] or st["playing"] or st["recording"]:
        problems.append(f"papegaai: the back arrow left {where(page)} with {st}")
    page.click("#tile-papegaai")
    page.wait_for_timeout(200)
    st = pg_state(page)
    if st["phase"] != "idle" or st["hasTake"] or page.locator(".pg-voice.waiting").count() != 3:
        problems.append(f"papegaai: back in the game after leaving: {st}, {page.locator('.pg-voice.waiting').count()} voices waiting")

    # a tap: the parrot listens until the next tap, or stops by itself at 10 s
    page.locator("#papegaai-rec").tap()
    try:
        pg_wait(page, "s.phase === 'recording' && s.tapMode", 4000)
    except Exception:
        problems.append(f"papegaai: a tap does not keep listening: {pg_state(page)}")
    started = time.time()
    if pg_state(page)["say"] != "listeningTap" or page.inner_text("#papegaai-rec-label") != "Tik om te stoppen":
        problems.append(f"papegaai: listening after a tap says {pg_state(page)['say']}, {page.inner_text('#papegaai-rec-label')!r}")
    page.screenshot(path=str(SHOTS / "papegaai-flow-tap-390x844.png"))
    # while it listens, a voice does nothing: no offer over a live microphone, nothing plays
    src = page.evaluate("window.__src")
    page.locator(".pg-voice[data-voice='echo']").tap()
    page.locator(".pg-voice[data-voice='muis']").tap()
    page.wait_for_timeout(150)
    st = pg_state(page)
    if where(page) != ["papegaai", False] or st["phase"] != "recording" or page.evaluate("window.__src") != src:
        problems.append(f"papegaai: a voice tapped while recording opened {where(page)}, {st['phase']}, {page.evaluate('window.__src') - src} sources")
    try:
        pg_wait(page, "s.phase !== 'recording'", 14000)
    except Exception:
        problems.append("papegaai: a recording went on past 10 s")
    took = time.time() - started
    st = pg_state(page)
    if not 9 <= took <= 12 or not st["hasTake"] or st["seconds"] > 10 or pg_mic_on(page):
        problems.append(f"papegaai: the 10 s cap: stopped after {took:.1f}s with {st}, {pg_mic_on(page)} microphones on")

    # the background drops the recording
    page.evaluate("() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }")
    page.wait_for_timeout(150)
    st = pg_state(page)
    page.evaluate("() => { delete document.hidden; }")
    if st["hasTake"] or st["playing"] or st["phase"] != "idle":
        problems.append(f"papegaai: the background kept {st}")

    # the Android back button in the middle of a recording (after a tap): home, the microphone off,
    # nothing kept
    page.locator("#papegaai-rec").tap()
    try:
        pg_wait(page, "s.phase === 'recording'", 4000)
    except Exception:
        problems.append(f"papegaai: no second recording: {pg_state(page)}")
    page.wait_for_timeout(500)
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(300)
    st = pg_state(page)
    if where(page) != ["home", False] or st["hasTake"] or st["recording"] or pg_mic_on(page):
        problems.append(f"papegaai: the Android back button left {where(page)} with {st}, {pg_mic_on(page)} microphones on")
    if errors:
        problems.append(f"papegaai: page errors {errors[:3]}")
    if foreign:
        problems.append(f"papegaai: requests outside the app: {foreign[:3]}")
    ctx.close()
    mb.close()


def papegaai_no_mic(browser, base, problems):
    """A refused microphone (after the gate, and again after a reload without asking the gate
    again) and a device without one (no gate at all) both give the calm card; nothing breaks."""
    mb = pg_mic_browser(browser)
    for kind, script in (("denied", PG_DENY), ("none", PG_NO_MIC)):
        ctx = mb.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script(script)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.click("#tile-papegaai")
        page.wait_for_timeout(200)
        page.locator("#papegaai-rec").tap()
        page.wait_for_timeout(200)
        if kind == "denied":
            page.click("#ov-buttons button >> nth=0")
            solve_gate(page, "nl")
            page.wait_for_timeout(400)
        title = page.inner_text("#ov-title") if where(page)[1] else None
        if title != "De papegaai kan nu niet luisteren" or card_buttons(page) != ["Oké"]:
            problems.append(f"papegaai {kind}: the card says {title!r} with {card_buttons(page)}")
        text = page.inner_text("#ov-text")
        if "grote" not in text or "instellingen" not in text:
            problems.append(f"papegaai {kind}: the card does not say a grown-up can allow it: {text!r}")
        page.screenshot(path=str(SHOTS / f"papegaai-nomic-{kind}-390x844.png"))
        page.click("#ov-buttons button >> nth=0")
        page.wait_for_timeout(150)
        st = pg_state(page)
        if where(page) != ["papegaai", False] or st["phase"] != "idle" or st["hasTake"]:
            problems.append(f"papegaai {kind}: after OK {where(page)} {st}")
        if kind == "denied":
            if page.evaluate("window.__gum") != 1 or not st["gate"]:
                problems.append(f"papegaai denied: {page.evaluate('window.__gum')} requests, gate {st['gate']}")
            # the gate is passed once per device: after a reload a press asks the system again, not the gate
            page.reload()
            page.wait_for_selector("html[data-ready='1']")
            page.click("#tile-papegaai")
            page.wait_for_timeout(200)
            page.locator("#papegaai-rec").tap()
            page.wait_for_timeout(300)
            if page.inner_text("#ov-title") != "De papegaai kan nu niet luisteren" or page.evaluate("window.__gum") != 1:
                problems.append(f"papegaai denied: after a reload {page.inner_text('#ov-title')!r}, {page.evaluate('window.__gum')} requests")
            page.click("#ov-buttons button >> nth=0")
        elif page.evaluate("window.__gum"):
            problems.append("papegaai none: a microphone was asked without one")
        # the rest of the app goes on: home and another game
        page.click("#papegaai-back")
        page.wait_for_timeout(150)
        page.click("#tile-drums")
        page.wait_for_timeout(200)
        if where(page) != ["drums", False]:
            problems.append(f"papegaai {kind}: the drums did not open after: {where(page)}")
        if errors:
            problems.append(f"papegaai {kind}: page errors {errors[:3]}")
        ctx.close()
    mb.close()


def papegaai_permission(browser, base, problems):
    """The gate was passed before, but the system would ask again ('prompt': Android's "only this
    time", a permission taken back): the press shows the why card and the gate first, no
    microphone asked; with 'granted' the press records straight away."""
    mb = pg_mic_browser(browser)
    for state in ("prompt", "granted"):
        ctx = mb.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script(PG_GATE_PASSED)
        ctx.add_init_script(PG_COUNT)
        ctx.add_init_script("navigator.permissions.query = async (d) => (d && d.name === 'microphone' ? { state: '%s' } : { state: 'denied' });" % state)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.click("#tile-papegaai")
        page.wait_for_timeout(200)
        page.locator("#papegaai-rec").tap()
        page.wait_for_timeout(400)
        st = pg_state(page)
        if state == "prompt":
            if card_buttons(page) != ["Voor ouders", "Annuleren"] or page.evaluate("window.__gum"):
                problems.append(f"papegaai permission prompt: {card_buttons(page)}, {page.evaluate('window.__gum')} microphone requests")
            page.click("#ov-buttons button >> nth=0")
            solve_gate(page, "nl")
            try:
                pg_wait(page, "s.mics === 1 && s.phase === 'idle' && s.say === 'ready'")
            except Exception:
                problems.append(f"papegaai permission prompt: after the gate {pg_state(page)}")
        elif where(page)[1] or st["phase"] != "recording" or page.evaluate("window.__gum") != 1:
            problems.append(f"papegaai permission granted: {where(page)}, {st['phase']}, {page.evaluate('window.__gum')} requests")
        if errors:
            problems.append(f"papegaai permission {state}: page errors {errors[:2]}")
        ctx.close()
    mb.close()


def papegaai_layouts(browser, base, problems):
    """Papegaai on a small phone, an ordinary phone in English, sideways and on desktop, after a
    recording: the parrot, what it says, the record button and every voice on screen, buttons
    64 px or more, nothing overlapping, no sideways scrolling; in the full version no voice locked."""
    mb = pg_mic_browser(browser)
    for w, h, owned in ((320, 568, False), (390, 844, False), (568, 320, False), (844, 390, True), (1280, 800, False)):
        mobile = w < 1000
        english = (w, h) == (390, 844)
        ctx = mb.new_context(bypass_csp=True, locale="en-GB" if english else "nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
        ctx.add_init_script(PG_GATE_PASSED)
        ctx.add_init_script(PG_COUNT)
        ctx.grant_permissions(["microphone"])  # allowed before on this device: no gate again
        if owned:
            ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        if owned:
            page.wait_for_function("window.__bubbels.full()", timeout=8000)
        label = f"{w}x{h}{' full' if owned else ''}"
        page.click("#tile-papegaai")
        page.wait_for_timeout(250)
        page.screenshot(path=str(SHOTS / f"papegaai-start-{w}x{h}.png"))
        box = page.locator("#papegaai-rec").bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down()
        try:
            pg_wait(page, "s.phase === 'recording'", 4000)
        except Exception:
            problems.append(f"papegaai {label}: no recording: {pg_state(page)}")
        page.wait_for_timeout(1600)  # Chromium's fake microphone beeps once a second
        page.mouse.up()
        try:
            pg_wait(page, "s.phase === 'playing'", 3000)
        except Exception:
            problems.append(f"papegaai {label}: not said back: {pg_state(page)}")
        page.wait_for_timeout(200)
        st = pg_state(page)
        if st["locked"] != ([] if owned else ["achteruit", "echo", "koor", "ballon"]):
            problems.append(f"papegaai {label}: locked {st['locked']}")
        if owned:
            # the full version: the choir is three parrots, the balloon climbs
            for voice, n in (("achteruit", 1), ("echo", 1), ("koor", 3), ("ballon", 1)):
                src = page.evaluate("window.__src")
                page.click(f".pg-voice[data-voice='{voice}']")
                page.wait_for_timeout(100)
                st = pg_state(page)
                if st["voice"] != voice or page.evaluate("window.__src") - src != n:
                    problems.append(f"papegaai {label}: {voice} played {st['voice']} with {page.evaluate('window.__src') - src} sources")
        rects = page.evaluate("""() => {
            const r = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; };
            return {
                back: r(document.querySelector('#papegaai-back')),
                say: r(document.querySelector('#papegaai-say')),
                stage: r(document.querySelector('#papegaai-stage svg')),
                rec: r(document.querySelector('#papegaai-rec')),
                voices: [...document.querySelectorAll('.pg-voice')].map((e) => [e.dataset.voice, ...r(e)]),
            };
        }""")
        def on_screen(name, x, y, bw, bh):
            if x < -0.5 or y < -0.5 or x + bw > w + 0.5 or y + bh > h + 0.5:
                problems.append(f"papegaai {label}: {name} off screen ({x:.0f},{y:.0f} {bw:.0f}x{bh:.0f})")
        for name in ("back", "say", "stage", "rec"):
            on_screen(name, *rects[name])
        for v in rects["voices"]:
            on_screen(v[0], *v[1:])
        small = [v[0] for v in rects["voices"] if v[3] < 64 or v[4] < 64]
        for name in ("back", "rec"):
            if rects[name][2] < 64 or rects[name][3] < 64:
                small.append(name)
        if small:
            problems.append(f"papegaai {label}: under 64 px: {small} {rects}")
        if rects["stage"][3] < 90:
            problems.append(f"papegaai {label}: the parrot is only {rects['stage'][3]:.0f} px high")
        boxes = [("say", *rects["say"]), ("rec", *rects["rec"])] + [tuple(v) for v in rects["voices"]]
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if not (a[1] + a[3] <= b[1] + 0.5 or b[1] + b[3] <= a[1] + 0.5 or a[2] + a[4] <= b[2] + 0.5 or b[2] + b[4] <= a[2] + 0.5):
                    problems.append(f"papegaai {label}: {a[0]} and {b[0]} overlap")
        if page.evaluate("document.documentElement.scrollWidth") > w:
            problems.append(f"papegaai {label}: the page scrolls sideways")
        if english:
            names = page.eval_on_selector_all(".pg-voice-name", "els => els.map((e) => e.textContent)")
            if page.inner_text("#tile-papegaai .tile-name") != "Parrot" or page.inner_text("#screen-papegaai h2") != "Parrot" or names[:3] != ["Normal", "Mouse", "Bear"]:
                problems.append(f"papegaai {label}: English {page.inner_text('#screen-papegaai h2')!r}, voices {names}")
        print(f"[papegaai {label}] parrot {rects['stage'][3]:.0f} px high, voices {min(v[3] for v in rects['voices']):.0f}x{min(v[4] for v in rects['voices']):.0f} px or more")
        page.screenshot(path=str(SHOTS / f"papegaai-{w}x{h}.png"))
        if errors:
            problems.append(f"papegaai {label}: page errors {errors[:2]}")
        ctx.close()
    mb.close()


APP_ONLY = "window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {} };"


def store_links(browser, base, problems):
    """The Google Play link and "App Store: coming soon" on the home screen and the parents' pages of
    the website, in Dutch and English and at 320 px; the home link asks the parental gate first.
    In a stand-in app none of them shows."""
    pages = [("index.html?test", "#store-play"), ("nl/plannen/index.html", ".store-btn"), ("en/roadmap/index.html", ".store-btn")]
    want = {"nl": ("Download in Google Play", "App Store: binnenkort"), "en": ("Get it on Google Play", "App Store: coming soon")}
    # tablets upright and sideways too: from 560 to 1100 px the widest section (7 tiles) once pushed
    # the home screen past the right edge (issue #81)
    sizes = (("phone", 390, 844, "nl"), ("320", 320, 568, "nl"), ("320-en", 320, 568, "en"), ("desktop", 1280, 800, "en"),
             ("568x320", 568, 320, "nl"), ("600x960", 600, 960, "nl"), ("768x1024", 768, 1024, "en"), ("820x1180", 820, 1180, "nl"),
             ("900x1200", 900, 1200, "nl"), ("960x600", 960, 600, "nl"), ("1024x768", 1024, 768, "en"), ("1180x820", 1180, 820, "nl"))
    for label, w, h, lang in sizes:
        ctx = browser.new_context(locale="nl-NL" if lang == "nl" else "en-GB", viewport={"width": w, "height": h}, has_touch=w < 1000)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        for path, sel in pages:
            page.goto(base + "/" + path)
            if path.startswith("index"):
                page.wait_for_selector("html[data-ready='1']")
                texts = want[lang]
            else:
                texts = want["nl" if path.startswith("nl/") else "en"]
            name = f"store {label} {path.split('?')[0]}"
            link = page.locator(sel)
            if not link.is_visible():
                problems.append(f"{name}: the Google Play link is not visible")
                continue
            if link.get_attribute("href") != PLAY_URL or link.get_attribute("target") != "_blank" or link.get_attribute("rel") != "noopener":
                problems.append(f"{name}: link {link.get_attribute('href')!r} target {link.get_attribute('target')!r} rel {link.get_attribute('rel')!r}")
            block = page.locator("[data-store-links]")
            text = " ".join(block.inner_text().split())
            for t in texts:
                if t not in text:
                    problems.append(f"{name}: {t!r} missing in {text!r}")
            box = link.bounding_box()
            if box["height"] < 44 or box["x"] < 0 or box["x"] + box["width"] > w:
                problems.append(f"{name}: the link is {box}")
            wide = page.evaluate("document.scrollingElement.scrollWidth - innerWidth")
            if wide > 0:
                problems.append(f"{name}: the page is {wide}px too wide")
            if path.startswith("index"):
                # the home screen scrolls in its own box: no sideways scroll there, every tile in sight
                home = page.evaluate("""() => { const s = document.querySelector('#screen-home');
                  const out = [...document.querySelectorAll('#tile-groups .tile')].filter((t) => { const r = t.getBoundingClientRect();
                    return r.left < -0.5 || r.right > innerWidth + 0.5; }).map((t) => t.id);
                  return { wide: s.scrollWidth - s.clientWidth, out }; }""")
                if home["wide"] > 0 or home["out"]:
                    problems.append(f"{name}: the home screen is {home['wide']}px too wide, tiles past the edge: {home['out']}")
            if path.startswith("index"):
                # a stand-in for window.open, so the test never leaves for the real store
                page.evaluate("() => { window.__opened = []; window.open = (u, t) => (window.__opened.push([u, t]), {}); }")
                link.click()
                page.wait_for_timeout(200)
                if not page.is_visible("#overlay"):
                    problems.append(f"{name}: the link opened without the parental gate")
                page.click("#ov-buttons .btn.secondary")  # cancel: nothing opens
                page.wait_for_timeout(200)
                if page.evaluate("window.__opened.length") or page.url.startswith("https://play"):
                    problems.append(f"{name}: a cancelled gate still opened the store")
                link.click()
                solve_gate(page, lang)  # answers with Enter
                page.wait_for_timeout(200)
                opened = page.evaluate("window.__opened")
                if opened != [[PLAY_URL, "_blank"]] or page.is_visible("#overlay"):
                    problems.append(f"{name}: after the gate {opened!r}, overlay {page.is_visible('#overlay')}")
            page.screenshot(path=str(SHOTS / f"store-{label}-{path.split('/')[0].split('.')[0]}.png"), full_page=not path.startswith("index"))
        if errors:
            problems.append(f"store {label}: page errors {errors[:2]}")
        ctx.close()
    # a stand-in app: the same files, no store link anywhere
    ctx = browser.new_context(locale="nl-NL", viewport={"width": 390, "height": 844}, has_touch=True)
    ctx.add_init_script(APP_ONLY)
    page = ctx.new_page()
    for path, sel in pages:
        page.goto(base + "/" + path)
        if path.startswith("index"):
            page.wait_for_selector("html[data-ready='1']")
        else:
            page.wait_for_load_state("load")
        if page.locator("[data-store-links]").is_visible() or page.locator(sel).is_visible():
            problems.append(f"store app {path}: a store link shows inside the app")
    ctx.close()


MENU_CHECK = r"""
() => {
  const sc = document.querySelector('.screen.active');
  const css = getComputedStyle(sc);
  const acc = css.getPropertyValue('--bz-group-acc').trim();
  // the colour the group accent resolves to, as the browser writes a border colour
  const probe = document.createElement('i');
  probe.style.color = acc;
  sc.appendChild(probe);
  const want = getComputedStyle(probe).color;
  probe.remove();
  const folds = [...sc.querySelectorAll('details.full-fold')];
  const was = folds.map((f) => f.open);
  folds.forEach((f) => (f.open = true));
  const small = [];
  for (const el of sc.querySelectorAll('.levels-scroll button, .levels-scroll summary, .bar button')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || el.closest('[hidden]')) continue;
    if (Math.min(r.width, r.height) < 47.5) small.push(`${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  folds.forEach((f, i) => (f.open = was[i]));
  const chosen = [...sc.querySelectorAll('.option-card[aria-pressed="true"], .seg-card[aria-pressed="true"], .level-cell.next, .level-cell[aria-pressed="true"]')]
    .filter((el) => el.offsetParent).map((el) => [String(el.className).split(' ')[0], getComputedStyle(el).borderTopColor]);
  return { group: sc.dataset.group || null, want, small, chosen: chosen.filter(([, c]) => c !== want) };
}
"""
HOME_ORDER = ["learning", "puzzles", "board", "creative", "action"]


def home_calm(browser, base, problems):
    """Bazibo 2.0 phase 1: the paper background. The floating bubbles of 1.0 are gone (Mark, 23 Nov
    2026): no #home-bg canvas, and nothing asks for animation frames while the home screen is shown,
    neither after loading nor after a game and back. Screenshots `shots/home-calm-*.png`."""
    count = "window.__frames = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => { window.__frames++; return raf(f); };"
    for w, h in ((390, 844), (844, 390)):
        label = f"home calm {w}x{h}"
        ctx = browser.new_context(locale="nl-NL", viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=True, is_mobile=True)
        ctx.add_init_script(count)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(300)
        if page.locator("#home-bg").count():
            problems.append(f"{label}: the #home-bg canvas is still there")
        for when in ("after loading", "after a game and back"):
            if when != "after loading":
                page.click("#tile-bubbels")
                page.wait_for_timeout(300)
                page.click("#screen-levels [data-go=home]")
                page.wait_for_selector("#screen-home.active")
                page.wait_for_timeout(300)
            before = page.evaluate("window.__frames")
            page.wait_for_timeout(1000)
            frames = page.evaluate("window.__frames") - before
            if frames:
                problems.append(f"{label}: {frames} animation frames asked for in a second on the home screen {when}")
        page.screenshot(path=str(SHOTS / f"home-calm-{w}x{h}.png"))
        if errors:
            problems.append(f"{label}: page errors {errors[:2]}")
        ctx.close()


def home_targets(browser, base, problems):
    """Every game's first screen and the settings at 320x568 (Dutch and English) and 390x844: the
    back button keeps its 60 px next to a long title (Verstoppertje squeezed it to 33 px at 320),
    the header never wider than the screen, and Bubbels' "Willekeurig" 48 px tall (it was 24).
    Bazibo 2.0 phase 2: the home sections by audience (Leren first), every game screen in its
    group's colour, the chosen option and the next level bordered in that colour, and every button
    of a menu (the fold opened too) 48 px or more."""
    for w, h, lang in ((320, 568, "nl"), (320, 568, "en"), (390, 844, "nl")):
        # the real CSP (no bypass): every menu must build without a style attribute or anything else it blocks
        ctx = browser.new_context(locale="nl-NL" if lang == "nl" else "en-GB", viewport={"width": w, "height": h}, has_touch=True, is_mobile=True)
        ctx.add_init_script("document.addEventListener('securitypolicyviolation', (e) => (window.__csp = window.__csp || []).push(`${e.violatedDirective} ${e.blockedURI} ${e.sample || ''}`.trim()))")
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        order = page.evaluate("[...document.querySelectorAll('#tile-groups .tile-group')].map((g) => g.dataset.group)")
        if order != HOME_ORDER:
            problems.append(f"home {w}x{h} {lang}: the sections are {order}, expected {HOME_ORDER}")
        groups = dict(page.evaluate("[...document.querySelectorAll('#tile-groups .tile')].map((t) => [t.id, t.closest('.tile-group').dataset.group])"))
        tiles = page.evaluate("[...document.querySelectorAll('#tile-groups .tile:not(.soon)')].map((t) => t.id)")
        for tid in tiles + ["btn-settings"]:
            page.goto(base + "/index.html?test")
            page.wait_for_selector("html[data-ready='1']")
            page.click("#" + tid)
            page.wait_for_timeout(250)
            label = f"home {w}x{h} {lang} {tid}"
            got = page.evaluate("""() => { const sc = document.querySelector('.screen.active'); const bar = sc.querySelector('.bar');
              const back = sc.querySelector('.bar > .btn.icon:first-child'); const r = back && back.getBoundingClientRect();
              const rj = sc.querySelector('#btn-random-jump'); const j = rj && rj.offsetParent ? rj.getBoundingClientRect() : null;
              return { screen: sc.id, back: r && [Math.round(r.width), Math.round(r.height)], over: bar ? bar.scrollWidth - bar.clientWidth : 0,
                jump: j && [Math.round(j.width), Math.round(j.height)] }; }""")
            if got["back"] and (got["back"][0] < 56 or got["back"][1] < 56):
                problems.append(f"{label}: the back button on {got['screen']} is {got['back']}")
            if got["over"] > 1:
                problems.append(f"{label}: the header on {got['screen']} is {got['over']}px too wide")
            if tid == "tile-bubbels" and (not got["jump"] or got["jump"][1] < 48):
                problems.append(f"{label}: the random button is {got['jump']}")
            csp = page.evaluate("window.__csp || []")
            if csp:
                problems.append(f"{label}: the CSP blocked {csp[:3]}")
            if tid != "btn-settings":
                menu = page.evaluate(MENU_CHECK)
                if menu["group"] != groups[tid]:
                    problems.append(f"{label}: {got['screen']} is in group {menu['group']!r}, its tile in {groups[tid]!r}")
                if menu["small"]:
                    problems.append(f"{label}: menu buttons under 48 px on {got['screen']}: {menu['small'][:4]}")
                if menu["chosen"]:
                    problems.append(f"{label}: chosen options not in the group colour {menu['want']}: {menu['chosen'][:3]}")
        if errors:
            problems.append(f"home {w}x{h} {lang}: page errors {errors[:2]}")
        ctx.close()


def tj_state(page):
    return page.evaluate("window.__bubbels.treintje.state()")


def tj_xy(page, i):
    return page.evaluate(f"window.__bubbels.treintje.at({i})")


def tj_drag(page, cells, steps=5):
    """A real mouse drag through the middles of these squares, in order."""
    x, y = tj_xy(page, cells[0])
    page.mouse.move(x, y)
    page.mouse.down()
    for c in cells[1:]:
        x1, y1 = tj_xy(page, c)
        for k in range(1, steps + 1):
            page.mouse.move(x + (x1 - x) * k / steps, y + (y1 - y) * k / steps)
        x, y = x1, y1
    page.mouse.up()
    page.wait_for_timeout(60)


def tj_touch_drag(page, cdp, cells, steps=5):
    """A real finger drag (touch events) through the middles of these squares."""
    x, y = tj_xy(page, cells[0])
    pi_touch(cdp, "touchStart", [{"x": x, "y": y}])
    for c in cells[1:]:
        x1, y1 = tj_xy(page, c)
        for k in range(1, steps + 1):
            pi_touch(cdp, "touchMove", [{"x": x + (x1 - x) * k / steps, "y": y + (y1 - y) * k / steps}])
        x, y = x1, y1
    pi_touch(cdp, "touchEnd", [])
    page.wait_for_timeout(60)


# a place along the way through and a square next to it where a step is not allowed: track already
# there (not the square before), a station out of its turn, or the last station too early
TJ_BLOCKED_JS = """async () => {
  const R = await import('./games/treintje/rules.js');
  const s = window.__bubbels.treintje.state();
  const p = { w: s.w, h: s.h, nums: s.nums, walls: s.walls };
  for (let k = 1; k < s.solution.length - 3; k++) {
    const path = s.solution.slice(0, k + 1);
    for (const j of R.neighbours(p, path[k])) {
      if (j === s.solution[k + 1] || j === path[k - 1]) continue;
      const why = R.whyNot(p, path, j);
      if (why === 'used' || why === 'order' || why === 'early') return { k, j, why, next: R.nextStation(p, path) };
    }
  }
  return null;
}"""


def treintje_flow(browser, base, problems):
    """Treintje at 390x844 by real drags: the tile in Puzzels opens the menu with the three ages,
    6-7 and 8-10 in the fold offering only OK on the web; a 3-5 puzzle laid by real drags with one
    blocked step first (nothing happens, a line says why) and one take-back by dragging back, the
    last part by a finger; the little train rides from station 1 to the last; the end card, saved
    per age, "Nog een" gives the next puzzle; back + keep playing with the track kept, the Android
    back button; no voice, nothing from outside."""
    ctx = browser.new_context(bypass_csp=True, locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    errors, foreign = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("request", lambda r: not r.url.startswith(base) and not r.url.startswith("data:") and foreign.append(r.url))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    name = page.inner_text("#tile-treintje .tile-name").strip()
    if name != "Treintje":
        problems.append(f"treintje: the tile says {name!r}")
    if page.evaluate("document.querySelector('#tile-treintje').closest('.tile-group').querySelector('.group-name').textContent") != "Puzzels":
        problems.append("treintje: the tile is not in the Puzzels section")
    page.locator("#tile-treintje").scroll_into_view_if_needed()
    page.locator("#tile-treintje").screenshot(path=str(SHOTS / "treintje-tile.png"))
    page.locator("#tile-treintje").tap()
    page.wait_for_timeout(200)
    if where(page) != ["treintje-menu", False]:
        problems.append(f"treintje: the tile opened {where(page)}")
    ages = page.eval_on_selector_all("#treintje-menu .tj-age", "els => els.map(e => [e.dataset.age, e.classList.contains('locked'), !!e.closest('details.full-fold')])")
    if ages != [["a3", False, False], ["a6", True, True], ["a8", True, True]]:
        problems.append(f"treintje: the age cards are {ages}")
    page.screenshot(path=str(SHOTS / "treintje-menu-390x844.png"), full_page=True)
    for age in ("a6", "a8"):
        choose(page, f"#treintje-menu .tj-age[data-age='{age}']", tap=True)
        page.wait_for_timeout(150)
        if card_buttons(page) != ["Oké"]:
            problems.append(f"treintje: the locked age {age} offers {card_buttons(page)}, not the web's OK")
        page.click("#ov-buttons button")
        page.wait_for_timeout(150)
        if where(page) != ["treintje-menu", False] or tj_state(page):
            problems.append(f"treintje: after OK on {age}: {where(page)}")

    # a 3-5 puzzle: the how-to card first
    page.locator("#treintje-menu .tj-age[data-age='a3']").tap()
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=8000)
    if page.inner_text("#ov-title").strip() != "Leg het spoor":
        problems.append(f"treintje: the first puzzle opens with {page.inner_text('#ov-title')!r}")
    page.screenshot(path=str(SHOTS / "treintje-how-390x844.png"))
    page.click("#ov-buttons button")
    page.wait_for_timeout(150)
    st = tj_state(page)
    if not st or st["age"] != "a3" or (st["w"], st["h"]) != (4, 4) or st["path"] != [st["nums"].index(1)]:
        problems.append(f"treintje: the 3-5 puzzle starts as {st}")
        ctx.close()
        return
    if not 4 <= max(st["nums"]) <= 6:
        problems.append(f"treintje: a 3-5 puzzle with {max(st['nums'])} stations")
    if st["cell"] < 44:
        problems.append(f"treintje: squares of {st['cell']} px at 390x844")
    # a puzzle with a step that is not allowed on the way (the "andere puzzel" button otherwise)
    blocked = page.evaluate(TJ_BLOCKED_JS)
    for _ in range(25):
        if blocked:
            break
        seed = tj_state(page)["seed"]
        page.locator("#treintje-new").tap()
        page.wait_for_function(f"window.__bubbels.treintje.state().seed !== {seed} && document.querySelector('#overlay').hidden", timeout=8000)
        blocked = page.evaluate(TJ_BLOCKED_JS)
    if not blocked:
        problems.append("treintje: no 3-5 puzzle with a blocked step in 25 tries")
        ctx.close()
        return
    st = tj_state(page)
    sol, k, j = st["solution"], blocked["k"], blocked["j"]
    tj_drag(page, sol[: k + 1])
    if tj_state(page)["path"] != sol[: k + 1]:
        problems.append(f"treintje: dragging the first {k + 1} squares laid {tj_state(page)['path']}")
    tj_drag(page, [sol[k], j])  # not allowed: nothing happens
    status = page.inner_text("#tj-status")
    want = {"used": "Daar ligt al spoor.", "order": f"Eerst station {blocked['next']}!", "early": "Het laatste station komt als laatste."}[blocked["why"]]
    if tj_state(page)["path"] != sol[: k + 1] or status != want:
        problems.append(f"treintje: the blocked step ({blocked['why']}) laid {tj_state(page)['path']}, says {status!r}")
    page.screenshot(path=str(SHOTS / "treintje-blocked-390x844.png"))
    tj_drag(page, sol[k: k + 3])
    tj_drag(page, [sol[k + 2], sol[k + 1]])  # dragging back takes one square back
    if tj_state(page)["path"] != sol[: k + 2]:
        problems.append(f"treintje: the take-back left {tj_state(page)['path']}, want {sol[: k + 2]}")
    page.screenshot(path=str(SHOTS / "treintje-half-390x844.png"))
    # the rest by a finger, then the little train rides
    tj_touch_drag(page, cdp, sol[k + 1:])
    st = tj_state(page)
    if not st["done"] or st["path"] != sol:
        problems.append(f"treintje: the whole track by a finger: done={st['done']} path={st['path']}")
    else:
        a = page.evaluate("window.__bubbels.treintje.trainAt()")
        page.wait_for_timeout(700)
        b = page.evaluate("window.__bubbels.treintje.trainAt()")
        if not tj_state(page)["riding"] or not a or not b or abs(a[0] - b[0]) + abs(a[1] - b[1]) < 4:
            problems.append(f"treintje: the train does not ride ({a} -> {b}, riding {tj_state(page)['riding']})")
        page.screenshot(path=str(SHOTS / "treintje-ride-390x844.png"))
        page.wait_for_function("window.__bubbels.treintje.state().arrived", timeout=8000)
        end = page.evaluate(f"window.__bubbels.treintje.at({sol[-1]})")
        b = page.evaluate("window.__bubbels.treintje.trainAt()")
        if abs(b[0] - end[0]) > st["cell"] or abs(b[1] - end[1]) > st["cell"]:
            problems.append(f"treintje: the train stopped at {b}, the last station is at {end}")
        page.screenshot(path=str(SHOTS / "treintje-done-390x844.png"))
        page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=4000)
        if page.inner_text("#ov-title").strip() != "Tuut tuut!" or card_buttons(page) != ["Nog een", "Menu"]:
            problems.append(f"treintje: the end card {page.inner_text('#ov-title')!r} {card_buttons(page)}")
        if page.evaluate("window.__bubbels.treintje.solved()") != {"a3": 1}:
            problems.append(f"treintje: saved {page.evaluate('window.__bubbels.treintje.solved()')}")
        if page.evaluate("window.__bubbels.save().games.treintje.lastAge") != "a3":
            problems.append("treintje: the last age is not saved")
        page.screenshot(path=str(SHOTS / "treintje-win-390x844.png"))
        seed = st["seed"]
        page.click("#ov-buttons button >> nth=0")
        page.wait_for_function(f"window.__bubbels.treintje.state().seed !== {seed} && document.querySelector('#overlay').hidden", timeout=8000)
        st = tj_state(page)
        if st["done"] or len(st["path"]) != 1 or st["age"] != "a3":
            problems.append(f"treintje: Nog een started {st}")
    # a tap on the track takes it back to there (a real tap), then on; back + keep playing with the
    # track kept; the Android back button
    sol = tj_state(page)["solution"]
    tj_drag(page, sol[:5])
    x, y = tj_xy(page, sol[1])
    page.touchscreen.tap(x, y)
    page.wait_for_timeout(80)
    if tj_state(page)["path"] != sol[:2]:
        problems.append(f"treintje: a tap on the track's second square left {tj_state(page)['path']}, want {sol[:2]}")
    tj_drag(page, sol[1:3])
    page.locator("#treintje-back").tap()
    page.wait_for_timeout(150)
    if where(page) != ["treintje-menu", False] or not page.is_visible("#treintje-continue") or page.inner_text("#treintje-continue").strip() != "Verder spelen":
        problems.append(f"treintje: back from a puzzle went to {where(page)} without Verder spelen")
    if "1 gelegd" not in page.inner_text("#treintje-menu .tj-age[data-age='a3']"):
        problems.append("treintje: the 3-5 card does not say 1 gelegd")
    page.locator("#treintje-continue").tap()
    page.wait_for_timeout(150)
    if where(page) != ["treintje", False] or tj_state(page)["path"] != sol[:3]:
        problems.append(f"treintje: Verder spelen opened {where(page)} with {tj_state(page)['path']}")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(100)
    if where(page) != ["treintje-menu", False]:
        problems.append(f"treintje: the Android back button on a puzzle went to {where(page)}")
    page.evaluate("window.__bubbels.back()")
    page.wait_for_timeout(100)
    if where(page) != ["home", False]:
        problems.append(f"treintje: back from the menu went to {where(page)}")
    # one fast move from station 1 over station 2 onto station 4: station 2 is laid and the line
    # names station 3 (the hint is made from the path after the move); a new puzzle clears it
    page.locator("#tile-treintje").tap()
    page.wait_for_timeout(150)
    page.evaluate(f"window.__bubbels.treintje.load({json.dumps(TJ_FAST)})")
    page.wait_for_timeout(100)
    (x0, y0), (x2, y2) = tj_xy(page, 0), tj_xy(page, 2)
    page.mouse.move(x0, y0)
    page.mouse.down()
    page.mouse.move(x2, y2, steps=1)
    page.mouse.up()
    page.wait_for_timeout(60)
    if tj_state(page)["path"] != [0, 1] or page.inner_text("#tj-status") != "Eerst station 3!":
        problems.append(f"treintje: a fast move onto station 4 laid {tj_state(page)['path']} and says {page.inner_text('#tj-status')!r}, want [0, 1] and 'Eerst station 3!'")
    page.evaluate(f"window.__bubbels.treintje.load({json.dumps(TJ_FAST)})")
    page.wait_for_timeout(60)
    if page.inner_text("#tj-status") != "Leg spoor naar station 2" or page.evaluate("document.querySelector('#tj-status').classList.contains('why') || window.__bubbels.treintje.hinting()"):
        problems.append(f"treintje: a new puzzle keeps the old hint: {page.inner_text('#tj-status')!r}")
    if page.locator("audio").count() or page.evaluate("typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking"):
        problems.append("treintje: something speaks")
    if errors:
        problems.append(f"treintje: page errors {errors[:3]}")
    if foreign:
        problems.append(f"treintje: requests outside the app {foreign[:3]}")
    ctx.close()


# 4 x 3 with stations 1 2 4 in the top row (the way: 0 1 5 4 8 9 10 6 2 3 7 11)
TJ_FAST = {"w": 4, "h": 3, "nums": [1, 2, 4, 0, 0, 0, 0, 0, 0, 3, 0, 5], "solution": [0, 1, 5, 4, 8, 9, 10, 6, 2, 3, 7, 11]}


def treintje_csp(browser, base, problems):
    """Treintje under the real CSP (no bypass): a 3-5 puzzle laid by real drags and the train's
    ride drawn without a single violation; a screenshot of the finished board."""
    ctx = browser.new_context(locale="nl-NL", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script("document.addEventListener('securitypolicyviolation', (e) => (window.__csp = window.__csp || []).push(`${e.violatedDirective} ${e.blockedURI} ${e.sample || ''}`.trim()))")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/index.html?test")
    page.wait_for_selector("html[data-ready='1']")
    page.locator("#tile-treintje").tap()
    page.wait_for_timeout(150)
    page.locator("#treintje-menu .tj-age[data-age='a3']").tap()
    page.wait_for_selector("#overlay:not([hidden]) #ov-buttons button", timeout=8000)
    page.click("#ov-buttons button")  # the how-to card
    page.wait_for_timeout(150)
    sol = tj_state(page)["solution"]
    tj_drag(page, sol[:6])
    page.screenshot(path=str(SHOTS / "treintje-csp-half-390x844.png"))
    tj_drag(page, sol[5:])
    # polled from here: wait_for_function evaluates a string in the page, which the real CSP blocks
    for _ in range(80):
        if tj_state(page)["arrived"]:
            break
        page.wait_for_timeout(100)
    else:
        problems.append(f"treintje csp: the train did not arrive ({tj_state(page)})")
    page.locator("#tj-board").screenshot(path=str(SHOTS / "treintje-csp-board-390x844.png"))
    csp = page.evaluate("window.__csp || []")
    if csp:
        problems.append(f"treintje csp: the CSP blocked {csp[:3]}")
    if errors:
        problems.append(f"treintje csp: page errors {errors[:3]}")
    ctx.close()


# a seed per age that gives its biggest board, so every layout is checked at its tightest
TJ_BIG_SEED_JS = """async (age) => {
  const G = await import('./games/treintje/generate.js');
  const big = Math.max(...G.AGES[age].sizes.map((s) => s[0] * s[1]));
  for (let seed = 1; seed < 200; seed++) { const p = G.makePuzzle(age, seed); if (p.w * p.h === big) return seed; }
  return 1;
}"""


def treintje_layouts(browser, base, problems):
    """Every age (the full version) at 320x568, 390x844 in English, 568x320, 844x390 and desktop on
    its biggest board: every square 44 px or more and on screen, the HUD on screen, no sideways
    scroll, a first step by a real drag; the English names (Train Tracks)."""
    for w, h, lang in ((320, 568, "nl"), (390, 844, "en"), (568, 320, "nl"), (844, 390, "nl"), (1280, 800, "nl")):
        mobile = w < 1000
        label = f"treintje {w}x{h} {lang}"
        ctx = browser.new_context(bypass_csp=True, locale="nl-NL" if lang == "nl" else "en-GB", viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
        ctx.add_init_script(OWNED_APP)
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html?test")
        page.wait_for_selector("html[data-ready='1']")
        if lang == "en":
            name = page.inner_text("#tile-treintje .tile-name").strip()
            if name != "Train Tracks":
                problems.append(f"{label}: the tile says {name!r}")
        page.click("#tile-treintje")
        page.wait_for_timeout(200)
        if lang == "en":
            title = page.inner_text("#screen-treintje-menu .bar h2").strip()
            cards = page.eval_on_selector_all("#treintje-menu .tj-age .option-title", "els => els.map(e => e.textContent)")
            if title != "Train Tracks" or cards != ["Ages 3-5", "Ages 6-7", "Ages 8-10"]:
                problems.append(f"{label}: the menu says {title!r} {cards}")
        if page.locator("#treintje-menu .locked").count():
            problems.append(f"{label}: something is locked in the full version")
        page.screenshot(path=str(SHOTS / f"treintje-menu-{w}x{h}-{lang}.png"))
        for age in ("a3", "a6", "a8"):
            seed = page.evaluate(TJ_BIG_SEED_JS, age)
            page.evaluate(f"window.__bubbels.treintje.start('{age}', {seed})")
            page.wait_for_timeout(150)
            if where(page)[1]:
                page.click("#ov-buttons button")  # the how-to card
                page.wait_for_timeout(150)
            st = tj_state(page)
            r = page.locator("#tj-board").bounding_box()
            cw, ch = r["width"] / st["w"], r["height"] / st["h"]
            if min(cw, ch) < 43.5:
                problems.append(f"{label} {age} {st['w']}x{st['h']}: squares of {cw:.1f}x{ch:.1f} px")
            if r["x"] < -0.5 or r["y"] < -0.5 or r["x"] + r["width"] > w + 0.5 or r["y"] + r["height"] > h + 0.5:
                problems.append(f"{label} {age}: the board is off screen ({r})")
            for sel in ("#treintje-back", "#treintje-new", "#tj-status"):
                b = page.locator(sel).bounding_box()
                if not b or b["x"] < -0.5 or b["y"] < -0.5 or b["x"] + b["width"] > w + 0.5 or b["y"] + b["height"] > h + 0.5:
                    problems.append(f"{label} {age}: {sel} not on screen ({b})")
                if sel != "#tj-status" and b and min(b["width"], b["height"]) < 44:
                    problems.append(f"{label} {age}: {sel} is {b['width']:.0f}x{b['height']:.0f}")
            boxes = [(r["x"] + cw * (i % st["w"]), r["y"] + ch * (i // st["w"])) for i in range(st["w"] * st["h"])]
            for i, (x, y) in enumerate(boxes):
                if x < -0.5 or y < -0.5 or x + cw > w + 0.5 or y + ch > h + 0.5:
                    problems.append(f"{label} {age}: square {i} off screen")
                    break
            if page.evaluate("document.documentElement.scrollWidth") > w:
                problems.append(f"{label} {age}: the page scrolls sideways")
            sol = st["solution"]
            tj_drag(page, sol[:3])
            if tj_state(page)["path"] != sol[:3]:
                problems.append(f"{label} {age}: a real drag laid {tj_state(page)['path']}, want {sol[:3]}")
            page.screenshot(path=str(SHOTS / f"treintje-{age}-{w}x{h}-{lang}.png"))
            page.evaluate("window.__bubbels.back()")
            page.wait_for_timeout(100)
        if errors:
            problems.append(f"{label}: page errors {errors[:3]}")
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
            tekenen_delete(browser, base, problems)
            kleuren_delete(browser, base, problems)
            klok_layouts(browser, base, problems)
            klok_touch(browser, base, problems)
            klok_digital(browser, base, problems)
            klok_digital_layouts(browser, base, problems)
            letters_play(browser, base, problems)
            doolhof_play(browser, base, problems)
            transfer_flow(browser, base, problems)
            transfer_camera_race(browser, base, problems)
            dammen_flow(browser, base, problems)
            dammen_layouts(browser, base, problems)
            baghchal_flow(browser, base, problems)
            baghchal_back_mid_move(browser, base, problems)
            baghchal_layouts(browser, base, problems)
            schaak_flow(browser, base, problems)
            schaak_layouts(browser, base, problems)
            ganzen_flow(browser, base, problems)
            ganzen_layouts(browser, base, problems)
            ludo_flow(browser, base, problems)
            ludo_back_mid_walk(browser, base, problems)
            ludo_layouts(browser, base, problems)
            pachisi_flow(browser, base, problems)
            pachisi_back_mid_walk(browser, base, problems)
            pachisi_layouts(browser, base, problems)
            offers_bubbels(browser, base, problems)
            offers_others(browser, base, problems)
            memory_flow(browser, base, problems)
            memory_layouts(browser, base, problems)
            kwartet_flow(browser, base, problems)
            kwartet_layouts(browser, base, problems)
            legpuzzel_flow(browser, base, problems)
            legpuzzel_layouts(browser, base, problems)
            legpuzzel_big(browser, base, problems)
            piano_flow(browser, base, problems)
            piano_layouts(browser, base, problems)
            piano_big(browser, base, problems)
            drums_flow(browser, base, problems)
            drums_layouts(browser, base, problems)
            verstop_flow(browser, base, problems)
            verstop_layouts(browser, base, problems)
            verstop_hints(browser, base, problems)
            verstop_hint_pixels(browser, base, problems)
            treintje_flow(browser, base, problems)
            treintje_layouts(browser, base, problems)
            treintje_csp(browser, base, problems)
            kangoeroe_flow(browser, base, problems)
            kangoeroe_layouts(browser, base, problems)
            winkel_flow(browser, base, problems)
            winkel_full(browser, base, problems)
            winkel_layouts(browser, base, problems)
            winkel_csp(browser, base, problems)
            kaart_flow(browser, base, problems)
            kaart_layouts(browser, base, problems)
            papegaai_flow(browser, base, problems)
            papegaai_no_mic(browser, base, problems)
            papegaai_permission(browser, base, problems)
            papegaai_layouts(browser, base, problems)
            store_links(browser, base, problems)
            home_targets(browser, base, problems)
            home_calm(browser, base, problems)
            browser.close()
    finally:
        httpd.shutdown()
    return report(problems)


# the parts that can be run on their own: `uv run --with playwright python tests/smoke.py dammen`
PARTS = {"dammen": (dammen_flow, dammen_layouts), "baghchal": (baghchal_flow, baghchal_back_mid_move, baghchal_layouts),
         "schaak": (schaak_flow, schaak_layouts),
         "ganzen": (ganzen_flow, ganzen_layouts),
         "ludo": (ludo_flow, ludo_back_mid_walk, ludo_layouts),
         "pachisi": (pachisi_flow, pachisi_back_mid_walk, pachisi_layouts),
         "offers": (offers_bubbels, offers_others), "bubbels": (offers_bubbels,),
         "memory": (memory_flow, memory_layouts),
         "kwartet": (kwartet_flow, kwartet_layouts),
         "legpuzzel": (legpuzzel_flow, legpuzzel_layouts, legpuzzel_big),
         "piano": (piano_flow, piano_layouts, piano_big, piano_bars),
         "drums": (drums_flow, drums_layouts, drums_bars),
         "letters": (letters_play,),
         "kangoeroe": (kangoeroe_flow, kangoeroe_layouts),
         "winkel": (winkel_flow, winkel_full, winkel_layouts, winkel_csp),
         "treintje": (treintje_flow, treintje_layouts, treintje_csp),
         "verstop": (verstop_flow, verstop_layouts, verstop_hints, verstop_hint_pixels),
         "verstop-pixels": (verstop_hint_pixels,),
         "kaart": (kaart_flow, kaart_layouts),
         "papegaai": (papegaai_flow, papegaai_no_mic, papegaai_permission, papegaai_layouts),
         "doolhof": (doolhof_play,),
         "klok": (klok_layouts, klok_touch, klok_digital, klok_digital_layouts),
         "store": (store_links, home_targets, home_calm),
         "tekenen": (tekenen_play, tekenen_delete, tekenen_fits, tekenen_locked_four),
         "kleuren": (kleuren_play, kleuren_delete, kleuren_fits)}


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
