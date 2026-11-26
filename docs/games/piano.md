# Piano

A toy piano, in `web/games/piano/` (the keyboards, the songs and playing along in `songs.js`, pure
and tested; the pictures in `art.js`; the screen in `piano.js`). The sound is synthesised in
`web/js/audio.js` (`pianoNote`), so it follows the sound setting. No voice, no recordings.

- Two pianos by age, picked at the top of the song list and kept: 4-6 has 8 coloured keys and 5
  black keys; 7-10 has two octaves, 15 coloured keys with their names on them and 10 black keys.
  When the 15 keys do not all fit 44 px wide (an upright phone) it shows a window of 7 to 14 of
  them, a little map of the whole keyboard above it moves the window, and a line asks to turn the
  phone.
- **Vrij spelen / Free play:** every key sounds; two fingers play two keys; sliding a finger plays
  the keys it passes. The tile opens free play straight away, so a toddler is one tap from the keys.
- **Liedjes / Songs:** play along: the next key glows and the strip above shows the notes to come in
  the colours of their keys; "Luister" / "Listen" plays the song with the keys lighting up. A wrong
  key never moves a song on; stars count wrong keys only, never time.
- Free: free play on both pianos and the first song of each level (Vader Jacob; the whole Ode to
  Joy). The full version adds the other songs.
- Saved under `games.piano`: stars per song played to the end (only ever raised) and the piano
  picked (`small` or `big`).
