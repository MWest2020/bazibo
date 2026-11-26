# Kleurenkermis (Colour Fair)

A colour game about the Stroop effect (a colour word in another ink), our own and calm (Mark, 26 Nov
2026), in `web/games/kermis/` (id `kermis`, ages 3-10; the colours and things in `colours.js`, the
rounds, taps and race in `rules.js`, both pure and tested; every drawing in code in `art.js`; the
screens in `kermis.js`). A chameleon at a little fair stall shows the question on its sign and says
every line in a speech bubble. Harder by what must be told apart, never by speed:

- 3-5: a thing in a colour (a banana in blue): "Klopt deze kleur?", Ja or Nee with big buttons.
  Sixteen things with one clear colour; a "Nee" shows a colour that is plainly wrong for it.
- 6-7: rood, blauw, geel or groen in its own or another ink: does the word match the colour?
- 8-10: the real Stroop task: tap the colour of the letters, not the word, from four colours.
- Rustig (the default): no time; a tap that does not fit is greyed with "kijk nog eens", stars by
  mistakes only. Together (2-4 children on one tablet) each child has a corner and they take turns;
  the far corners face the other way and the sign shows the question twice.
- Race (full version, the only Bazibo game with one): every child at once in their own corner, by
  multi-touch; the first right tap wins the star, a wrong tap only pauses that child for a moment
  (never minus points) and a wrong guess puts that child out of the question, so guessing never wins
  by elimination; alone, a race against a little turtle; a cheerful end with everyone placed.
- Colour-blind safe: the colours that can meet in a question are far apart also for colour-blind
  eyes (tested by simulation), red and green differ in lightness, every colour button has its own
  shape and name, and Ja/Nee are a tick and a cross, never green and red.
- Rounds of 8. Free: 3-5 in Rustig, alone or together; 6-7, 8-10, random rounds and the race in the
  full version.
- Saved under `games.kermis`: stars per round, random rounds per tier, the how-to cards seen, the
  last tier, mode and number of players.
