# Bazibo

**[bazibo.nl](https://bazibo.nl/)**: kids' games with no ads and no tracking, ages 3 to 10
(kinderspelletjes zonder reclame). Get it on
[Google Play](https://play.google.com/store/apps/details?id=work.westerweel.bazibo).

An app of play-and-learn games for children of 3 to 10. It is a plain web app (HTML, CSS and
JavaScript on a canvas), wrapped with Capacitor as an Android and an iOS app. Every game has a free
part; one €1 purchase opens every game. More in [About Bazibo](docs/explanation/about.md).

- **No ads, no tracking:** no adverts, no trackers, no accounts; the games make no network requests
  outside the app's own origin (a Content Security Policy enforces it).
- **Offline:** everything works without internet (service worker).
- **PEGI 3.**
- **Dutch and English:** it follows the device; Dutch is the fallback.

Play it: https://bazibo.nl/ (also at https://mwest2020.github.io/bazibo/).

## Games

In the order of the home screen. Ages are the ones the game's own page names; "-" means the game has
no age band of its own.

| Game (NL / EN) | Group | Ages | What |
|---|---|---|---|
| [Klok kijken / Telling Time](docs/games/klok.md) | Learning | 5-10 | Read and set an analogue clock, from a daily rhythm to the 24-hour clock. |
| [Letters / Letters](docs/games/letters.md) | Learning | 4-7 | Learn the letters by sight: match a letter, find the first or a middle letter, build a word. |
| [Egeltje / Little Hedgehog](docs/games/doolhof.md) | Learning | 4-8 | A hedgehog in a garden maze picks up the alphabet, a word or numbers in order. |
| [Kangoeroe op de getallenlijn / Kangaroo Hops](docs/games/kangoeroe.md) | Learning | 5-8 | Adding and taking away by hops on a number line. |
| [Keukentje / Little Kitchen](docs/games/keuken.md) | Learning | 3-10 | What goes into bread and other dishes, where it comes from, the steps of a recipe. |
| [Winkeltje / Little Shop](docs/games/winkel.md) | Learning | 3-10 | Pay with euro coins and notes, later with cents and change. |
| [Kleurenkermis / Colour Fair](docs/games/kermis.md) | Learning | 3-10 | Does the colour match? Calm by default, or as a race on one tablet. |
| [Kaartpuzzel / Map Puzzle](docs/games/kaart.md) | Learning | 6-12 | Topography: continents, Europe and countries as a puzzle and as "where is...?". |
| [Dogudoku / Dogudoku](docs/games/dogudoku.md) | Puzzles | 3-10 | A Queens / Star Battle logic puzzle with puppies; 60 puzzles. |
| [Picturedoku / Picturedoku](docs/games/picturedoku.md) | Puzzles | 3-10 | Sudoku with pictures, 4×4 to 9×9; 60 puzzles. |
| [Paartjes / Pairs](docs/games/memory.md) | Puzzles | 3+ | Turn over two cards and find the pairs, alone, together or against the computer. |
| [Legpuzzel / Jigsaw](docs/games/legpuzzel.md) | Puzzles | 3-10 | A jigsaw of 9 to 60 pieces, with a magnifier on phones. |
| [Verstoppertje / Hide and Seek](docs/games/verstop.md) | Puzzles | 3-7 | Find the little animal behind a stone, a bush or a little door. |
| [Treintje / Train Tracks](docs/games/treintje.md) | Puzzles | 3-10 | Lay one railway through every square past the stations in order. |
| [Vier op een rij / Four in a Row](docs/games/vier.md) | Board games | 3+ | Together or against the computer; a small board where three in a row wins. |
| [Dammen / Checkers](docs/games/dammen.md) | Board games | - | Checkers on 8×8 and 10×10, together or against the computer. |
| [Tijgers en geitjes (Bagh-Chal) / Tigers and Goats (Bagh-Chal)](docs/games/baghchal.md) | Board games | - | Bagh-Chal from Nepal: goats hem the tigers in, tigers jump goats. |
| [Schaken / Chess](docs/games/schaak.md) | Board games | - | Chess with every rule; tap a piece to see where it may go. |
| [Ganzenbord / Game of the Goose](docs/games/ganzen.md) | Board games | - | Our own goose board with two dice; the child can count every square. |
| [Ludo / Ludo](docs/games/pachisi.md) | Board games | - | The race game with one die, with Pachisi from India as a second mode. |
| [Kwartet / Quartets](docs/games/kwartet.md) | Board games | - | The Dutch card game of asking for the cards you miss. |
| [Kleurplaten / Colouring](docs/games/kleuren.md) | Creative | 3-10 | Tap to colour: pictures for the youngest, mandalas for older children. |
| [Tekenen / Drawing](docs/games/tekenen.md) | Creative | - | Free drawing with a finger; mirror mode and stamps in the full version. |
| [Piano / Piano](docs/games/piano.md) | Creative | 4-10 | A toy piano: play freely or play along with songs. |
| [Drumstel / Drums](docs/games/drums.md) | Creative | 4-10 | Eight drums and cymbals: play freely or play along with rhythms. |
| [Papegaai / Parrot](docs/games/papegaai.md) | Creative | - | Record your voice and the parrot says it back, in funny voices too. |
| [Bubbels schieten / Bubble Shooter](docs/games/bubbels.md) | Action | - | Aim, shoot, pop three of a colour; 30 levels. |
| [Slangetje / Snake](docs/games/slang.md) | Action | 3-10 | A snake that eats numbers in order, the letters of a word or one colour. |

## Run and test

```sh
python3 -m http.server 8080 --directory web      # open http://127.0.0.1:8080/
npm test                                         # node --test, no browser
uv run --with playwright python tests/smoke.py   # every game in headless Chromium
```

No build step and no dependencies at runtime. Details: [Run and test](docs/how-to/run-and-test.md).

## Docs

Everything else lives in [`docs/`](docs/README.md):

- [About Bazibo](docs/explanation/about.md): what the app is, the brand, how the site is published.
- [Layout](docs/reference/layout.md): where everything is in the repository.
- [Full version](docs/reference/full-version.md): the free parts, the one purchase, random play.
- [Save data](docs/reference/save-data.md): the save document and moving progress to another device.
- [Apps](docs/reference/apps.md) and [Release](docs/release.md): building and releasing the Android and iOS apps.
- [Roadmap](docs/reference/roadmap.yml): phases and what "done" means, for westerweel.work/nu/.
- [Design](docs/design/) and [Marketing](docs/marketing/).

For agents and contributors: [AGENTS.md](AGENTS.md).

## Licence

MIT, see `LICENSE`. Third-party material is listed in `CREDITS.md`.
