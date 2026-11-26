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
request outside the local server. It also checks that the web build sells nothing, that the end
of the free levels leads to the offer, walks through the parental gate in both languages, switches
the language in settings, checks that a returning player keeps their progress, and opens the
privacy and terms pages. A name after `smoke.py` runs only that part: `dammen`, `baghchal`, `schaak`, `ganzen`, `ludo`, `pachisi`, `doolhof`, `verstop`, `treintje`, `keuken`, `kermis`, `winkel`, `papegaai` (with Chromium's fake microphone),
`offers` (every game's free part ended and its offer closed, and for Bubbels every way out of the
offer in a stand-in app, from "Later" to a purchase; the player always lands on the game's list
with the save kept) or `bubbels` (that Bubbels part alone, about 20 s).

CI runs the whole smoke test on every push and PR (the `smoke` job in `.github/workflows/ci.yml`,
Playwright 1.65.2 and its headless Chromium installed on the runner; the screenshots are kept as
an artifact when it fails).
