# About Bazibo

**[bazibo.nl](https://bazibo.nl/)**: kids' games with no ads and no tracking, ages 3 to 10
(kinderspelletjes zonder reclame). Get it on
[Google Play](https://play.google.com/store/apps/details?id=work.westerweel.bazibo).

An app of play-and-learn games for children of 3 to 10. No ads, no trackers, no accounts, one
€1 purchase that opens every game. It is a plain web app (HTML, CSS and JavaScript on a canvas),
wrapped with Capacitor as an Android and an iOS app. The games: the bubble shooter
("Bubbels schieten" / "Bubble Shooter"), Dogudoku (a logic puzzle with puppies), Picturedoku (a
sudoku with pictures), Paartjes ("Pairs", turn over two cards and find the pairs), Legpuzzel ("Jigsaw", 9 to 60 pieces), Verstoppertje ("Hide and Seek", find the little animal behind a stone, a bush or a little door), Treintje ("Train Tracks", lay one railway through every square past the stations in order, then the little train rides it), Vier op een rij ("Four in a Row", together or against the computer), Dammen ("Checkers"), Tijgers en geitjes ("Tigers and Goats", Bagh-Chal from Nepal), Schaken ("Chess"), Ganzenbord ("Game of the Goose"), Ludo (the race game with one die, with Pachisi, the original from India, as a second mode), Kwartet ("Quartets", the Dutch card game of asking for cards),
Slangetje ("Snake", a snake that eats numbers in order, the letters of a word or one colour) and
Kleurplaten ("Colouring", pictures for the youngest and mandalas for older children), Klok
kijken ("Telling Time", read and set an analogue clock), Letters (learn the letters by sight:
match a letter, the first or a middle letter of a word, build a word), Egeltje ("Little
Hedgehog", walk a hedgehog through a garden maze and pick up the alphabet, a word or numbers in
order), Kangoeroe op de getallenlijn ("Kangaroo Hops", adding and taking away by hops
on a number line), Keukentje ("Little Kitchen", what goes into bread and other dishes, where it
comes from and the steps of a recipe), Winkeltje ("Little Shop", pay with euro coins and notes in a little shop, later
with cents and change), Kaartpuzzel ("Map Puzzle", topography: the continents, Europe and your own
country as a puzzle and as "where is...?") and Papegaai ("Parrot", record your voice and the parrot
says it back, in funny voices too); more
learning games follow (`docs/reference/roadmap.yml`). The brand name lives in
`web/js/brand.js` (issue #2): Bazibo, from "bāzi", the Persian word for play; it rhymes with
gazebo. The logo is a lowercase b cut from paper, with a little roof (the gazebo) as its counter,
on five scraps in the colours of the game groups, beside the drawn name (`design/brand/`, drawn
inline by `web/js/logo.js`; every app icon is rendered from `design/brand/`). The repository (`MWest2020/bazibo`, renamed from `bubbels` on 2026-11-09), the package id
(`work.westerweel.bazibo`) and the website path (`/bazibo/`) carry the brand name; the first game
and the storage keys keep the name `bubbels`.

- Home screen with a tile per game (a game that is not ready yet can show a "binnenkort" /
  "coming soon" tile) and a
  settings screen: language (Dutch or English; it follows the device and Dutch is the fallback),
  sound, the full version, privacy, terms.

Play it: https://bazibo.nl/ (also at https://mwest2020.github.io/bazibo/). Every merge to `main` runs the tests and publishes `web/` to GitHub Pages through GitHub Actions, and a GitHub webhook makes Plesk (Yourhosting) pull `main` and serve `web/` on bazibo.nl. Releases to the stores: `docs/release.md`.
