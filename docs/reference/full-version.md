# Full version

Every game has a free part (Bubbels: levels 1-10, declared in `web/games/bubbels/meta.js`). One
non-consumable in-app product, `unlock_all` (€ 1), opens everything in every game, in the
Android and iOS apps only. The offer appears at the end of a free part and in Settings. `web/js/unlock.js` keeps the purchase state. It only becomes "owned" when Google Play
or the App Store says so. The last answer is cached so a bought game keeps working offline. The
store calls go through the open-source `cordova-plugin-purchase` (`web/js/billing-native.js`);
there is no receipt server.

Buying and restoring sit behind a parental gate (`web/js/parental-gate.js`): a multiplication
written in words (Dutch or English), with a typed answer. On the website nothing can be bought, and a locked
level only shows a friendly card.

## Random play (full version)

With the full version, every game except Vier op een rij (which is endless already) gets a
"Willekeurig" / "Random" card per difficulty in its level list: Bubbels easy, medium and hard;
Dogudoku 4×4 to 8×8; Picturedoku 4×4, 6×6 and 9×9; Slangetje per kind of round and age. Each tap
makes a new board or puzzle on the device from a fresh seed (`crypto.getRandomValues`), with the
same generators that make the fixed levels (`web/games/<id>/generate.js`, also used by `tools/`),
so a random one passes the same checks: Dogudoku and Picturedoku have exactly one solution
(Picturedoku solvable without guessing), Bubbels boards have no loose bubbles and every colour at
least twice, Slangetje walls come from the tested wall layouts. Big puzzles are made in a worker
(`web/js/gen-worker.js`, falling back to the page) so the screen never freezes, and Dogudoku makes
the next one ahead. Random boards keep no stars; the save counts how many were solved per tier
(`games.<id>.random`, only ever going up). After a loss in Bubbels or Slangetje, "Zelfde nog eens"
replays the same board. `tests/random.test.js` checks 200 seeds per tier and prints the timing.
