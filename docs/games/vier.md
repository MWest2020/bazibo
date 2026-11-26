# Vier op een rij

Four in a row, in `web/games/vier/` (rules in `rules.js`, the computer in `ai.js`, tokens and
pictures drawn as SVG in `art.js`, the screens in `vier.js`). Our own name and look: a lilac frame
with round holes and picture tokens, never "Connect Four" or its blue frame with red and yellow.

- Two boards: the big board, 7×6, four in a row wins (ages 6+), and the kleuterbord, 5×4, three
  in a row wins (ages 3+, no reading needed).
- Play together on one screen, taking turns, or against the computer at three levels. Easy plays
  near the middle and only sometimes takes a win or blocks one, so a young child can beat it;
  medium always wins or blocks when it can and otherwise avoids handing over a win; hard looks a
  few moves ahead (minimax with alpha-beta, depth 4 on the big board, 5 on the kleuterbord). On
  the big board a child who sets up two threats at once can beat hard. The kleuterbord is a
  forced win for whoever starts, and hard plays it perfectly; so against the computer the child
  always starts there, and beats hard only with exact play. The computer only ever plays a legal
  move, one per turn (`npm test` checks every level, and that hard and medium never miss a win or
  a block).
- Tap anywhere in a column: the token drops with a little bounce and a soft "tok". A row lights
  up with gold rings and hops; a draw gets a friendly card. Against the computer a move can be
  taken back (also after the computer won, or while it is still thinking); together it cannot.
  Who starts takes turns: together per board (remembered), against the computer from game to game
  (the child starts the first one, and always on the kleuterbord).
- Each player picks a token (puppy, bubble, apple, flower, fish, pug); the chips under the board
  show whose turn it is with pictures, not text alone. Leaving a game for the menu keeps it for
  as long as the app stays open ("keep playing"); it is not saved, so closing the app ends it.
- Free: playing together on both boards and the easy and medium computer. Hard is in the full
  version (`meta.js`). The child's wins against the computer are counted per board and level
  (never lowered, `storage.js`); games played together are not counted.
