# Verstoppertje (Hide and Seek)

A looking game for the youngest, in `web/games/verstop/` (id `verstop`, ages 3-7; the rounds and
what a tap means in `rules.js`, pure and tested; the drawings in `art.js`; the screens in
`verstop.js`). Mark's idea (20 Nov 2026): "find a little animal and where it can be; lift a little
stone or look behind a little tree; if it is not there, another little figure waves", a
seek-and-find crossed with an advent calendar. The name is the generic Dutch word for hide and
seek; nothing of any picture-book franchise (no striped figure, no franchise names), all art our
own, drawn in code.

- The animal to find is shown big at the top ("Zoek de egel!"). The scene (garden, forest, beach,
  farm) has hiding spots drawn as part of it: stones, bushes, little trees, upside-down flowerpots
  and buckets, a haystack, shells, a sandcastle, a log, a little red door in a tree stump and
  numbered advent-calendar windows. A tap lifts the spot, pushes it aside or swings its door open.
- Behind every other spot lives a friendly creature (a snail, ladybird, mouse, frog, bird, bee,
  butterfly or mole) that peeks out and waves ("Hoi van de kikker!"). Then the spot settles back
  ajar with the creature peeking out of the crack, so the child sees where they already looked:
  clearer for a three-year-old than a spot that closes all the way and looks untouched. Never
  "wrong": no buzzer, no losing, no timers, no voice; the sounds are the shell's plink and chime.
- Found: a chime, sparkles and a little hop; the animal stays in sight, then the end card with
  stars and the next round. Stars count only extra looks, each spot once, gently: up to half of
  the other spots is still 3 stars (`starsFor`).
- Harder by what the child must do, never by speed: tier 1 (3-4) 4-5 big spots and one animal;
  tier 2 (4-6) 6-7 spots and two animals in one round; tier 3 (5-7) 7-8 spots, the animal with a
  red scarf, a yellow bow or a pink flower (never one close to the animal's own colour, such as a
  pink flower on the piglet: `NOT_WORN`) among two look-alikes of the same animal (another
  feature or none: "Ook een egel, maar zonder rode sjaal."), and every second round a memory
  question: once the animal is found every spot closes, "Waar was de kikker?", the first creature
  the child met.
- Rounds are seeded per id (`garden-t1-3`), each tested over 200 seeds per scene and tier: the
  animal behind exactly one spot, nobody twice, look-alikes differ by their feature, every round
  ends. The spots stand in a scattered grid (`spotLayout`): 64 px or more and on screen from a
  320 x 568 phone to a desktop, upright and sideways, never overlapping.
- Free: tier 1 in the garden (6 rounds). The full version adds the forest, the beach and the
  farm, tiers 2 and 3 and random rounds (a new place every time).
- Saved under `games.verstop`: stars per round, random rounds per tier, the how-to cards seen,
  the last place and the last tier. A round in progress is kept while the app stays open ("keep
  playing").
