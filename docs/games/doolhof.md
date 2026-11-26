# Egeltje (Little Hedgehog)

A garden maze, in `web/games/doolhof/` (id `doolhof`; ages 4-8): a little hedgehog walks between
hedges and picks up letters in alphabetical order, the letters of a pictured word, or numbers in
order. Mark asked for "a maze chase like eating an alphabet" that must not look or sound like
Pac-Man: a brown hedgehog seen from the side, black-blue birds with an orange beak, a green garden
with hedges between the cells, no chomping, no arcade sounds, no ghosts, no dying, no timer.

- `maze.js` (pure): a seeded depth-first maze on 5x6, 5x7 or 6x8 cells (lying down on a sideways
  screen), then every dead end opened and a few more gaps cut, so there are loops everywhere.
- `rules.js` (pure): the rounds, the steps, the crows. A swipe, an arrow on the pad, an arrow key
  or a tap beside the hedgehog walks it to the next crossing; it goes round bends by itself and
  stops at a hedge, on the right letter, and in front of a crow or a wrong letter (also a crow that
  stepped in during the walk): only a step the child chooses bumps or touches.
- Only the next few values are on the board (`WINDOW`), one tile per value (a letter that comes
  twice, the p in "appel", appears when the first is picked up). A tile is never placed where it
  would cut the garden in two (`placementOk`), so every letter can be reached without walking over
  another, after every step.
- A chosen step onto a wrong letter is a soft bump: the hedgehog stays, the letter stays ("Boink!
  Dat is de d. Zoek de c."), one mistake per letter; after two bumps the right one glows. Tier 1
  wrong letters never look like the letters asked for (`plainOk`, either way round; when a word is
  done, the old word's wrong tiles that look like the new word's letters are taken away).
- The crows are friendly and slow (a step a second, walking only after the first step, never onto
  the hedgehog). A walk stops in front of one; a chosen step straight into one makes the hedgehog curl up
  for a moment and roll back to the start of its corridor (at most 3 cells, `ROLLBACK`), and the
  crow flies to the far side of the garden. No letters are lost, and stars count wrong letters
  only (Letters' `starsFor`), never crows and never time.
- Three kinds and three tiers, harder by what must be told apart, not by speed:
  - **Het alfabet / The alphabet**: a-e (4-5, plain wrong letters such as an x or an s, one crow),
    ten in a row (5-6, look-alikes of the letters on the board: a d or a q next to the b), the whole
    alphabet (6-8, mirrored b/d/p/q first, two crows).
  - **Woordjes / Words**: three pictured words a round, from Letters' word lists and pictures.
    Tier 1 three-letter words with every letter shown faintly and the next one big, tier 2 the
    word shown with look-alike wrong letters, tier 3 long words with the picture only (empty
    slots) and mirrored look-alikes.
  - **Tellen / Counting**: 1-5, 1-10 with look-alike numbers (6/9, 1/7, 12/21), and counting in
    twos to 20 with the odd numbers in between as the wrong ones.
- Free: every round of tier 1 in all three kinds; tiers 2 and 3 and random gardens are in the full
  version (`meta.js`). Nothing is spoken; the only sounds are the app's own effects (a plink per
  letter, a soft boop, a soft thud for a crow, the end chime).
- Saved under `games.doolhof`: stars per round, random rounds done per kind and tier, how-to cards
  seen and the last tier per kind. A round in progress is kept while the app stays open ("keep
  playing"); the garden then waits for the next step.
