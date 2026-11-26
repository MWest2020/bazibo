# Letters

Learn the letters by sight, in `web/games/letters/` (ages 4-7; the rounds in `round.js` and the
words in `words.js`, pure and tested; the pictures in `art.js`, which colours in the Kleurplaten
drawings and reuses the Picturedoku fruit; the screens in `letters.js`). Nothing is spoken: every
question is a big letter, a picture or a word to look at. (Until 13 Nov 2026 a Piper voice read
the questions aloud; Mark dropped it because children did not like the robot voice.)

- What makes a tier harder is never the number of tiles (Mark, 18 Nov 2026: "3 or 6 letters
  doesn't matter to a 4-year-old") but what the child must tell apart and how much of the word is
  given. Look-alikes come from two tables in `words.js`: `SIMILAR` (small letters that look alike
  without being mirrors: m/n, i/l/j, o/c/a, s/z; `SIMILAR_UPPER` for capitals: E/F, P/R/B, O/Q/C)
  and `LOOKALIKE` (mirror images: b/d/p/q, n/u, m/w), used from tier 3 and only on small letters
  (capital B, D, P and Q are not mirror images). Look-alikes are picked in the case the tiles are
  drawn in (the capitals option).
- Four kinds of round:
  - **Tik de letter / Tap the letter**: one big letter, tap the same one. Tier 1 draws it exactly
    like its tile, with one look-alike among the tiles (an n next to the m); tier 2 shows the
    capital, find the small letter (with the capitals option on, the other way round), again with
    a look-alike; tier 3 mixes both cases and puts two look-alikes next to every letter, a mirrored
    one for b, d, p, q, n, u, m and w (half of every round). A capital I is never offered next to a
    small l. The case is fixed when a round starts.
  - **Beginletter / First letter**: a picture with its word underneath, the first letter left
    out ("_on"); tap the missing letter. The word is shown in every tier, so a picture that could
    be two words (puppy or dog) is never a guess. Unchanged: Mark's children like it as it is.
  - **Middenletter / Middle letter**: the same with a letter inside the word left out ("k_t"),
    never the first or last letter and never one half of a pair that makes one sound (ui, oo, ee,
    sh, ck), so the gap is a sound of its own (`MIDDLE` in `words.js`, with per gap the words a
    wrong letter would spell: k_t never offers i, o or u for kit, kot, kut). Tier 1 a vowel in a
    short word; tier 2 words up to 6 letters, any listed gap, with a look-alike among the
    choices; tier 3 every word with two look-alikes, mirrored first.
  - **Woordje maken / Build a word**: a picture, tap the word's letters in order. Tier 1 shows the
    word for 2 seconds (a tap on the picture, the eye, shows it again) and has one extra tile;
    tier 2 has the picture only, with two extra tiles of which one looks like a letter of the
    word; tier 3 the same with two look-alikes, one of them mirrored when the word has b, d, p,
    q, n, u, m or w (a d next to "bal"). Extra tiles never sound like a letter of the word.
- Three tiers: the first letters (a i o m s k), more letters, the whole alphabet. Lowercase by
  default, as Dutch schools start; the "aA" button in the menu bar switches to capitals.
- "First letter" never offers letters that sound alike at the start of a word (`CONFUSABLE` in
  `words.js`: English c/k/s, Dutch k/c/q, v/f, z/s), nor a letter that would spell another word in
  the gap (`ALSO_A_WORD`: kat/mat, huis/muis, pear/bear). A new word goes on that list too. The
  wrong choices come from the tier's letters plus the first letters of its words, so in tier 1
  the answer is not simply the one letter from outside a i o m s k.
- Sounds are ambient (`AVAudioSession` `.ambient` in `ios/App/App/AppDelegate.swift`,
  `audioSession.type = 'ambient'` in `audio.js`): the iPhone's silent switch mutes them and a
  parent's music keeps playing.
- A wrong tap is gentle: the tile shakes and fades, "Probeer het nog eens"; after two wrong tries
  the right letter lights up (building: the next letter goes in by itself). Stars by mistakes per
  question (counted once). The only sounds are the app's own effects (a plink per placed letter, a
  soft boop, the end chime), muted by the sound setting.
- Free: every round of the first tier, in all four kinds. The other tiers and random practice are
  in the full version (`meta.js`).
- Saved under `games.letters`: stars per round, random rounds done, how-to cards seen, the last
  tier per kind and the capitals option.
