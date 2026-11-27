# Run and test

## Run

```sh
python3 -m http.server 8080 --directory web
# open http://127.0.0.1:8080/
```

No build step and no dependencies at runtime. Opening `index.html` straight from disk does not
work, because ES modules and service workers need http.

## Test

```sh
npm test                                         # node --test: grid, shots, levels, sw cache, gate, purchase, i18n, save data
uv run --with playwright python tests/smoke.py   # serves web/, plays in NL and EN, screenshots in shots/
uv run --with playwright python tests/smoke.py offers   # only the end-of-free-part offers (bubbels: Bubbels alone)
```

The smoke test uses the headless Chromium at the path in `CHROME` (default: the Playwright
cache on the dev machine, else Playwright's own browser) and fails on page errors or on any
request outside the local server. It also checks that the web offer shows only OK to the child, that the end
of the free levels leads to the offer, walks through the parental gate in both languages, switches
the language in settings, checks that a returning player keeps their progress, and opens the
privacy and terms pages. A name after `smoke.py` runs only that part: `dammen`, `baghchal`, `schaak`, `ganzen`, `ludo`, `pachisi`, `doolhof`, `verstop`, `treintje`, `keuken`, `kermis`, `winkel`, `papegaai` (with Chromium's fake microphone), `home` (the home grid at 1920x1080, 1366x768, 1024x768, 820x1180, 390x844, 844x390, 360x640 and 320x568: balanced rows, no tile alone in a last row, every section equally wide, `shots/home-grid-*`),
`offers` (every game's free part ended and its offer closed, and for Bubbels every way out of the
offer in a stand-in app, from "Later" to a purchase; the player always lands on the game's list
with the save kept), `bubbels` (that Bubbels part alone, about 20 s) or `unlock` (the website's
unlock code, `web_unlock` and `web_unlock_native`, about a minute: under the real CSP, test codes
signed in the page with a key made there, the parents' way in under the offer's OK and the gate,
the four how-it-works steps and the payment link opened (a `?test` stand-in, never fetched), the
"binnenkort" card without a payment link (`web_unlock_soon`), garbled, forged, changed and revoked codes refused
before any call, the activation mocked by route interception as 400, 409, 200, 503 and a cut
network, every game's first screen with nothing locked, kept after a reload with no call, a
tampered and a revoked kept code closed again, the `#unlock=` link (new load and `hashchange`) and
the older `?unlock=` link removed from the address, one quiet retry on the next start and no call
after it, a code through the transfer screen's scanner; no request outside the origin but the
activation; in a stand-in app no parents' link, no code entry, no payment link, the deep link ignored,
the scanner ignoring a code and the app's own CSP blocking the activation address; Settings' "Voor
ouders: ik heb een code" behind the gate (gone once open, absent in the app); `sw_update`, on its
own server over a copy of `web/`: the build from before the update fix, opened from a `#unlock=`
link, replaced by a new one (the worker reloads the old page itself and the code comes along as
`?unlock=`), then a new build reaching the page on the home screen without a second reload, and
with a card open only after it is closed; screenshots `shots/unlock-*`).

CI runs the whole smoke test on every push and PR (the `smoke` job in `.github/workflows/ci.yml`,
Playwright 1.65.2 and its headless Chromium installed on the runner; the screenshots are kept as
an artifact when it fails).
