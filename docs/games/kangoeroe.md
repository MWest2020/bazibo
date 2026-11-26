# Kangoeroe op de getallenlijn

Adding and taking away on a number line, the way Dutch schools teach it in groep 3-4, in
`web/games/kangoeroe/` (ages 5-8; the questions and hops in `hops.js`, pure and tested; the
kangaroo in `art.js`; the screens in `kangoeroe.js`). A kangaroo stands on the line and the child
decides the hops: +1 / −1 (and +10 / −10, or 2s and 5s, on 0-100), each drawn as an arc, or a tap
on the line for one big jump; then **Hier!** ("Here!"). "How many hops?" questions are answered by
picking the number. No timers and no losing: a wrong answer bounces the kangaroo back to the start
and draws the way as dashed arcs (over 10: to the ten, then on); after a second one the kangaroo
hops the way itself. Nothing is spoken.

- t1 (5-6): 0-10, forward only. "Van 3 naar 7: hoeveel sprongen?" and "3 + 4 = ?" with the four
  hops as pips.
- t2 (6-7): 0-20, forward and back, mostly over 10, and the missing number ("5 + ? = 12").
- t3 (7-8): 0-100 with the tens marked: hops of ten, over a ten, two steps ("37 + 20 + 5"),
  counting by 2s and 5s, + and − mixed. A phone shows a window of the line with a map above it.
- Rounds of 8 with stars by mistakes. Free: tier 1; tiers 2-3 and random rounds in the full
  version.
- Saved under `games.kangoeroe`: stars per round, random rounds per tier, the how-to cards seen
  and the last tier.
