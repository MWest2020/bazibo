# Drumstel (Drums)

A colourful drum kit, in `web/games/drums/` (id `drums`; the kit, the rhythms and playing along in
`kit.js`, pure and tested; the pads and stands in `art.js`; the sound in `sound.js`; the screen in
`drums.js`). The sound is synthesised on the device and follows the app's sound setting. No voice,
no recordings.

- 8 pads (kick, snare, hi-hat, three toms, crash and ride), standing like a real kit, laid out for
  a sideways or an upright screen (`kitLayout`), every pad 80 px or more.
- **Vrij spelen / Free play:** every pad sounds; two fingers hit two pads at once. The tile opens
  free play straight away.
- **Ritmes / Rhythms:** play along: after a count-in ("1 2 3 4") the next pad glows on its beat. For
  4-6 the rhythm waits for the child (only the order counts); for 7-10 it runs on and a step counts
  when it is hit on the beat (a ring closes in on the pad). "Luister" / "Listen" plays the rhythm
  with the pads lighting up.
- Free: free play and the first rhythm of each level (the rock beat for 4-6 and for 7-10). The full
  version adds the other rhythms.
- Saved under `games.drums`: stars per rhythm played to the end (only ever raised).
