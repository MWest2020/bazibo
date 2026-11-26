# Winkeltje (Little Shop)

Counting money in a little shop drawn in code, in `web/games/winkel/` (id `winkel`, ages 3-10; the
money maths in `rules.js`, pure and tested in whole cents, never floats; the coins, notes, things
and tile in `art.js`; the screens in `winkel.js`). The child buys a thing by laying coins (and
later notes) from the purse on the counter until the price is paid, then taps **Betalen**
("Pay"). A tap on a coin lays it, a tap on the counter takes it back; dragging works both ways.
Nothing is ever wrong: too little shows what is missing (dashed ghost coins and "Nog € 1 erbij"),
too much marks what is over; after two tries the shop lays the right money itself. No timers, no
voice. Prices are written "€ 2,50" in Dutch and "€ 2.50" in English. The coins and notes are our
own: the right colours, the real sizes relative to each other and the value large, never the real
designs.

- t1 (3-5): whole euros up to € 5 with € 1 coins, a dot per euro filling as they are laid; then
  € 2 coins as "two at once".
- t2 (6-7): up to € 20 with € 1, € 2, € 5 and € 10 and 50-cent coins: pay exactly, then with as
  few coins and notes as possible (`fewest`, a bounded change-making table).
- t3 (8-10): cents with every coin; change from the till by counting up from the price
  ("€ 3,40 → € 3,50 → € 4,00 → € 5,00"); two things together; a budget (pick two things that fit).
- Rounds of 6 with stars by mistakes. Free: tier 1; tiers 2-3 and random rounds in the full
  version.
- Saved under `games.winkel`: stars per round, random rounds per tier, the how-to cards seen and
  the last tier.
