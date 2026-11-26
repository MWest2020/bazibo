# Slangetje

A snake game that teaches, in `web/games/slang/` (rules in `rules.js`, pictures in `art.js`, the
screens in `slang.js`, 30 levels in `levels.json`). Our own name and look: a friendly cartoon
snake on a grass board, everything drawn in code.

- Three kinds of round, each in three age tiers:
  - **Tellen / Counting:** numbered oranges, eaten in order: 1-3 for the youngest, up to 1-20,
    counting in twos (2, 4 … 20) and counting down (10 … 1) for the oldest.
  - **Letters:** spell a short word that comes with a picture, letter by letter (EI/EGG, ZON/SUN,
    BAL/BALL … WORTEL/CARROT). The words differ per language (`WORDS` in `rules.js`).
  - **Kleuren / Colours:** eat only the fruit of the shown colour; every colour also has its own
    shape (the bubble palette, with purple instead of light blue, so no round asks a child to tell
    blue from light blue). In the older levels the colour changes every few fruits.
- Ages 3-5: slow, the edges wrap around and the snake passes through itself, so a round can never
  be lost; the next thing to eat has a soft gold ring. Ages 5-7: faster, more on the board at once,
  still no way to lose. Ages 7-10: faster again, a fence around the board in most levels, stone
  walls in some, and bumping into a wall or yourself ends the round ("try again").
- A wrong bite is never a game over: a gentle "boop", the snake gets one part shorter and the fruit
  hops to another spot. A right bite gives a soft munch; the end of a round a chime.
- The snake waits for the child: a round (and a round coming back from the pause or the menu)
  starts with the first swipe or arrow. Steer by swiping on the board, by tapping where the snake
  should go, with the big arrow pad, or with the arrow keys on a computer.
- Stars: the youngest tier counts only mistakes (no clock for three-year-olds); the older tiers
  also want the round inside a time (`starsFor`, `parSeconds` in `rules.js`; the snake's own time,
  pauses not counted).
- Free: 10 of the 30 levels, the first ones of every kind (`free: true` in `levels.json`).
  `npm test` checks the level data (walls on the board, never on the start, no walled-off pockets,
  every word spellable) and plays every level to the end in both languages, upright and sideways,
  without a mistake.
- Readable on small phones: things are drawn at almost a whole square, numbers and letters at
  0.6-0.7 of a square, and when a 13-wide board would give squares under 20 px (small phones,
  short sideways phones) the round uses the same level two squares smaller each way, with the
  corner walls moved in (`sizeOf`, `wallCells`). The smoke test measures every number and letter
  at 11 px or more on 320×568, 568×320 and 640×360.
- Things never appear right in front of the head (also after a turn typed ahead), next to another
  thing or in a pocket, so a needed thing is never fenced in by wrong ones.
- The board only animates while something moves (the snake, an effect, the youngest tier's help
  ring); a snake waiting for a swipe costs no frames.
- How-to cards follow the level: counting shows its own numbers (1, 2, 3 … or 2, 4, 6 … or
  10, 9, 8 …), and the oldest tier says that bumping into a fence, a stone or yourself counts.
- Leaving a round for the menu keeps it while the app stays open ("keep playing"); it is not saved.
  A kept letters round spells the new language's word after a language switch.
