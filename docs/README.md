# Bazibo docs

The index of everything in `docs/`, sorted the Diátaxis way: how-to guides to get something done,
reference to look things up, explanation for the why. The short overview and the table of games are
in the [README](../README.md); rules for agents and contributors in [AGENTS.md](../AGENTS.md).

## Games

One page per game, named after its folder in `web/games/<id>/`. A new game adds its page here and a
row in the README's games table.

- [Bubbels schieten / Bubble Shooter](games/bubbels.md) (`bubbels`)
- [Dogudoku / Dogudoku](games/dogudoku.md) (`dogudoku`)
- [Picturedoku / Picturedoku](games/picturedoku.md) (`picturedoku`)
- [Paartjes / Pairs](games/memory.md) (`memory`)
- [Legpuzzel / Jigsaw](games/legpuzzel.md) (`legpuzzel`)
- [Verstoppertje / Hide and Seek](games/verstop.md) (`verstop`)
- [Treintje / Train Tracks](games/treintje.md) (`treintje`)
- [Vier op een rij / Four in a Row](games/vier.md) (`vier`)
- [Dammen / Checkers](games/dammen.md) (`dammen`)
- [Tijgers en geitjes (Bagh-Chal) / Tigers and Goats (Bagh-Chal)](games/baghchal.md) (`baghchal`)
- [Schaken / Chess](games/schaak.md) (`schaak`)
- [Ganzenbord / Game of the Goose](games/ganzen.md) (`ganzen`)
- [Ludo / Ludo](games/pachisi.md) (`pachisi`)
- [Kwartet / Quartets](games/kwartet.md) (`kwartet`)
- [Slangetje / Snake](games/slang.md) (`slang`)
- [Kleurplaten / Colouring](games/kleuren.md) (`kleuren`)
- [Tekenen / Drawing](games/tekenen.md) (`tekenen`)
- [Piano / Piano](games/piano.md) (`piano`)
- [Drumstel / Drums](games/drums.md) (`drums`)
- [Papegaai / Parrot](games/papegaai.md) (`papegaai`)
- [Klok kijken / Telling Time](games/klok.md) (`klok`)
- [Letters / Letters](games/letters.md) (`letters`)
- [Egeltje / Little Hedgehog](games/doolhof.md) (`doolhof`)
- [Kangoeroe op de getallenlijn / Kangaroo Hops](games/kangoeroe.md) (`kangoeroe`)
- [Keukentje / Little Kitchen](games/keuken.md) (`keuken`)
- [Winkeltje / Little Shop](games/winkel.md) (`winkel`)
- [Kaartpuzzel / Map Puzzle](games/kaart.md) (`kaart`)

## How-to guides

- [Run and test](how-to/run-and-test.md): serve `web/` locally, `npm test`, the Playwright smoke
  test and what CI runs.
- [Release](release.md): step by step to Google Play and the App Store, signing, save data.

## Reference

- [Layout](reference/layout.md): what lives where in the repository.
- [Full version](reference/full-version.md): the free parts, the one purchase, the parental gate,
  random play.
- [Save data](reference/save-data.md): the save document and "Voortgang overzetten" (move progress).
- [Apps](reference/apps.md): building the Android and iOS apps with Capacitor.
- [Roadmap](reference/roadmap.yml): phases and what "done" means, shown on westerweel.work/nu/.
- [CI example for iOS](ci/ios-build.yml.example): a GitHub Actions job that builds the iOS app and uploads it to TestFlight.

## Explanation

- [About Bazibo](explanation/about.md): what the app is, the brand name and logo, how the website
  is published.

## Design

- [Brand brief](design/brand-brief.md): the brand for an outside designer (Dutch and English).
- [Style audit](design/style-audit.md): what the app looked like in November 2026, measured.
- [Bazibo 2.0 proposal](design/v2-proposal.md): the design proposal that followed from the audit.
- [Token sketch](design/tokens-sketch.css), the logo sketches
  ([a](design/logo-a-refine.svg), [b](design/logo-b-symbol.svg), [c](design/logo-c-wordmark.svg)),
  the [trust row](design/trust-row.svg), the [store mock-up](design/store-v2-mockup.png) and the
  screenshots in [design/shots/](design/shots/).

## Marketing

- [ASO proposal](marketing/aso-proposal.md): the Google Play listing texts (NL and EN).
- [Links plan](marketing/links.md): free places that can link to bazibo.nl.
- [Search Console](marketing/search-console.md): verifying bazibo.nl with Google, steps for Mark.
