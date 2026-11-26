# Paartjes (Memory)

Find the pairs, in `web/games/memory/` (rules in `rules.js`, the computer in `ai.js`, the cards in
`art.js`, the screens in `memory.js`). On screen it is "Paartjes" / "Pairs", never "Memory" (a
Ravensburger trademark, as "Connect Four" is for Vier op een rij).

- Four boards: 6 cards (2 × 3, ages 3+), 12 (3 × 4, 4+), 16 (4 × 4, 5+) and 20 (4 × 5, 6+). The
  grid turns to fit the screen (`bestGrid`): tall on an upright phone, wide on a sideways one;
  20 cards on a 320 × 568 phone are still over 60 px.
- Three sets of cards, all drawn in code: fruit (the Picturedoku fruit plus a strawberry, cherries,
  a lemon and a melon drawn in the same style), the picture book (the coloured-in Kleurplaten
  pictures Letters uses: sun, house, cat …) and shapes (ten friendly shapes, each its own shape
  and colour). Within a set every picture differs by shape and colour.
- Tap a card and it flips over. The same picture twice is a pair: it stays up with a gold ring and
  a hop, and the same player goes on (the classic rule). Two different pictures stay up for a
  moment and turn back by themselves; a tap meanwhile does nothing.
- Alone (stars by turns: 3 within two turns a pair, 2 within three; no clock), together on one
  screen taking turns (the pairs take the finder's colour), or against a gentle computer that
  remembers a card it saw only now and then and forgets some of it each turn (`ai.js`). Its turn
  is slow and visible: the robot chip wobbles, "the computer is choosing", a card, then the next.
  A child who remembers what was shown beats it almost always (`npm test` plays 200 games).
  Together and against the computer, who starts takes turns from game to game.
- Free: 6 and 12 cards with the fruit, in every way to play. The full version adds 16 and 20 cards
  and the picture-book and shapes cards (`meta.js`). The end card of a 12-card game offers "More
  cards" (the shell's `offerUnlock`).
- Saved under `games.memory`: the best stars alone per board and set, the child's wins against the
  computer per board (counters that only go up), and the last menu choice. A game in progress is
  kept while the app stays open ("keep playing").
