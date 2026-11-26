# Papegaai (Parrot)

Children love hearing themselves (Mark, 20 Nov 2026). In `web/games/papegaai/` a friendly parrot,
drawn in code, says back what the child says: hold the big button (or tap it, and tap again to
stop), talk for up to 10 seconds, and the parrot repeats it with its beak and three sound waves
moving with the sound. Then the same recording in other voices, all made on the device with the
Web Audio API from the child's own recording (no samples, no other voices, no speech synthesis):
Gewoon (as recorded), Muis (high and quick), Beer (low and slow), and in the full version
Achteruit (backwards), Echo, Koor (a choir of three parrots, low, middle and high) and Ballon (a
helium balloon: the pitch climbs). Calm: no timers, no scores, nothing to lose.

- `effects.js` (pure, tested): the voices' numbers, the 10 s cap (`createTake`), trimming the quiet
  ends, the gain that brings a take to a comfortable level (never more than 4× louder), the beak.
- `sound.js`: the microphone (through `capture-worklet.js`, or a ScriptProcessor where there is no
  AudioWorklet) and the voices, through a limiter and the shell's soft clipper; tested with a stand-in
  AudioContext.
- Privacy: the recording stays in memory only, is never saved or sent, and is dropped when the child
  leaves the game or the app goes to the background. The microphone is on only while recording; the
  first press on a device shows a one-line card and the parental gate first (the shell remembers only
  that yes, as `settings.micGate`). A refused or missing microphone shows a calm card. Android declares
  `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` (Capacitor's WebView client asks for both) and the
  microphone as not required; iOS has `NSMicrophoneUsageDescription`.
- Free: recording, Gewoon, Muis and Beer; the full version adds the other four voices. Nothing is saved.
