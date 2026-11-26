# Kwartet

The Dutch quartets card game, in `web/games/kwartet/` (rules in `rules.js`, the computer players in
`ai.js`, the cards in `art.js`, the screens in `kwartet.js`).

- Eight sets of four cards, each card with its picture and its name: fruit, pets, vehicles, the
  garden, puppies, the zoo, the weather and toys. The pictures are the app's own: the Picturedoku
  fruit, the coloured-in Kleurplaten drawings, the Dogudoku puppies, and ten new ones drawn in the
  Picturedoku style (train, ladybird, lion, giraffe, cloud, rainbow, snowman, teddy bear, kite,
  blocks). Every set has its own colour, and its name above its row.
- With three or four players all cards are dealt. With two (where every question would get a
  yes) each gets 5, 6 or 7 cards (4, 6 or 8 sets) and the rest lies face down as the pile
  (de stapel). On your turn you ask another player for a card of a set you hold. You get it: ask
  again. You do not: with two players you take the top card of the pile (tap the glowing pile; if
  it is the very card you asked for, you may ask again), then the turn goes to the next player
  round the table; an empty pile just passes the turn. Four of a set are laid down at once as a
  kwartet (also straight after the deal). A hand that runs empty takes a card from the pile; with
  no pile left that player sits out. When every set is down, the most kwartetten wins (the same
  number is a draw). The menu says which rule applies.
- Readable for young children: your hand is shown per set as its four places, and the missing
  ones are the big buttons to ask with. Tap a player first when there is more than one. Every
  question and answer is a speech bubble with the card's picture ("Robo, heb jij de trein?", "Ja!
  Alsjeblieft."). The computers take their turns slowly, one question at a time, with the asking
  robot wobbling.
- The computers (`ai.js`) only use what everyone at the table could know (who asked for what, so
  holds a card of that set; who gave what; who said no; a card shown after a lucky draw), never
  the pile. They remember each of those things only now and then. A child who pays attention wins
  or shares about half of the games against two of them, and more than half against one with the
  pile (`npm test`). The computer draws from the pile by itself, slowly, a card back flying to it.
- Children together on one phone: a "pass the phone" card comes between their turns and hides
  every hand until the next child taps "Show my cards". While a computer plays, no hand is shown.
- Free: 4 sets (fruit, pets, vehicles, garden) with up to 3 players, any mix of children and
  computers. The full version adds a 4th player and games with 6 and 8 sets, picked from all eight
  sets. The end card offers "More sets" on a device without the full version.
- Saved under `games.kwartet`: the child's wins against the computer per number of sets (only
  games with one child, counters that only go up) and the last menu choice. A game in progress is
  kept while the app stays open ("keep playing"); a question on screen when the child leaves is
  answered at once on return.
