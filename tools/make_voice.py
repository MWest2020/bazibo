"""The read-aloud voice for Letters: every clip is made here, once, with Piper (local, offline)
and shipped as small MP3 files. Nothing is spoken by a computer at runtime and nothing goes to a
cloud service.

    uv run --no-project --with piper-tts==1.8.0 --with numpy --with lameenc==1.8.1 \
        python tools/make_voice.py

Writes web/games/letters/voice/<lang>/<key>.mp3 and web/games/letters/voice/manifest.json.
The words must stay in step with web/games/letters/words.js (tests/letters.test.js checks that
every word, letter and phrase the game uses has a clip).

Voices (rhasspy/piper-voices, the model files are MIT; the licence that matters for the voice is
the dataset's, and both allow commercial use and redistribution of the audio):
  nl  nl_NL-alex-medium   dataset CC0 (OHF-Voice/voice-datasets)
  en  en_GB-cori-medium   dataset CC BY 4.0 (Hi-Fi Multi-Speaker English TTS, NVIDIA; the voice
                          of Cori Samuel, LibriVox reader 92): attribution in CREDITS.md
"""
import hashlib
import json
import os
import sys
import urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "games", "letters", "voice")
CACHE = os.path.expanduser("~/.cache/bazibo-voice")
HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"

VOICES = {
    "nl": {
        "path": "nl/nl_NL/alex/medium/",
        "files": {
            "nl_NL-alex-medium.onnx": "22f0497c4d895a09fbc6a469459aa8954ea0955d3c6e19dbcc2e23acbb93e30b",
            "nl_NL-alex-medium.onnx.json": "9ea643871742c038511b6aaf20e6fc098a78a11968122d2f6ca3e50403423f95",
        },
        "length_scale": 1.12,
    },
    "en": {
        "path": "en/en_GB/cori/medium/",
        "files": {
            "en_GB-cori-medium.onnx": None,  # pinned below after the first verified download
            "en_GB-cori-medium.onnx.json": None,
        },
        "length_scale": 1.08,
    },
}
PINS_FILE = os.path.join(ROOT, "tools", "voice-pins.json")

# Letter names as they are said aloud (spelled so Piper says the name, not a sound or a word).
LETTERS = {
    "nl": {
        "a": "aa", "b": "bee", "c": "cee", "d": "dee", "e": "ee", "f": "ef", "g": "gee", "h": "haa",
        "i": "ie", "j": "jee", "k": "kaa", "l": "el", "m": "em", "n": "en", "o": "oo", "p": "pee",
        "q": "kuu", "r": "er", "s": "es", "t": "tee", "u": "uu", "v": "vee", "w": "wee", "x": "iks",
        "y": "ie-grek", "z": "zet",
    },
    "en": {
        "a": "ay", "b": "bee", "c": "see", "d": "dee", "e": "ee", "f": "eff", "g": "jee", "h": "aitch",
        "i": "eye", "j": "jay", "k": "kay", "l": "ell", "m": "em", "n": "en", "o": "oh", "p": "pee",
        "q": "cue", "r": "are", "s": "ess", "t": "tee", "u": "you", "v": "vee", "w": "double you",
        "x": "ex", "y": "why", "z": "zed",
    },
}

# The words (key = the word as written; the game shows its picture and spells it).
WORDS = {
    "nl": ["zon", "huis", "vis", "bloem", "hond", "auto", "kat", "vogel", "boot", "schildpad",
           "olifant", "raket", "appel", "banaan", "druiven", "wortel", "peer", "paddenstoel", "bal"],
    "en": ["sun", "house", "fish", "flower", "dog", "car", "cat", "bird", "boat", "turtle",
           "elephant", "rocket", "apple", "banana", "grapes", "carrot", "pear", "mushroom", "ball"],
}

PHRASES = {
    "nl": {
        "find": "Zoek de letter",
        "first": "Met welke letter begint dit woord?",
        "build": "Maak het woord",
        "good": "Goed zo!",
        "again": "Probeer het nog eens.",
        "thisIs": "Dit is de letter",
        "done": "Knap gedaan!",
    },
    "en": {
        "find": "Find the letter",
        "first": "Which letter does this word start with?",
        "build": "Make the word",
        "good": "Well done!",
        "again": "Try again.",
        "thisIs": "This is the letter",
        "done": "Great job!",
    },
}

RATE = 22050
KBPS = 40


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(lang):
    v = VOICES[lang]
    pins = json.load(open(PINS_FILE)) if os.path.exists(PINS_FILE) else {}
    os.makedirs(CACHE, exist_ok=True)
    model = None
    for name, want in v["files"].items():
        want = want or pins.get(name)
        path = os.path.join(CACHE, name)
        if not os.path.exists(path) or (want and sha256(path) != want):
            tmp = path + ".part"
            urllib.request.urlretrieve(HF + v["path"] + name, tmp)
            os.replace(tmp, path)
        got = sha256(path)
        if want and got != want:
            raise SystemExit(f"voice {name}: sha256 {got}, pinned {want}")
        if not want:
            pins[name] = got  # first download: pin it so later runs are reproducible
            json.dump(pins, open(PINS_FILE, "w"), indent=2, sort_keys=True)
        if name.endswith(".onnx"):
            model = path
    return model


def clean(samples):
    """int16 PCM -> trimmed, normalised float32: silence off both ends, a short pad, a steady level."""
    x = samples.astype(np.float32) / 32768.0
    win = int(RATE * 0.01)
    if len(x) > win:
        env = np.sqrt(np.convolve(x * x, np.ones(win) / win, mode="same"))
        loud = np.where(env > 10 ** (-42 / 20))[0]
        if len(loud):
            pad = int(RATE * 0.04)
            x = x[max(0, loud[0] - pad): min(len(x), loud[-1] + pad)]
    rms = np.sqrt(np.mean(x * x)) or 1e-9
    gain = min(10 ** (-16 / 20) / rms, 0.95 / (np.max(np.abs(x)) or 1e-9))  # -16 dBFS, peak below -0.5 dB
    x = x * gain
    fade = min(len(x) // 4, int(RATE * 0.008))  # no clicks at the cut
    if fade:
        ramp = np.linspace(0, 1, fade)
        x[:fade] *= ramp
        x[-fade:] *= ramp[::-1]
    return x


def mp3(x):
    import lameenc

    enc = lameenc.Encoder()
    enc.set_bit_rate(KBPS)
    enc.set_in_sample_rate(RATE)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
    return enc.encode(pcm) + enc.flush()


def say(voice, cfg, text):
    chunks = list(voice.synthesize(text, syn_config=cfg))
    pcm = np.concatenate([c.audio_int16_array for c in chunks])
    if chunks and chunks[0].sample_rate != RATE:
        raise SystemExit(f"unexpected sample rate {chunks[0].sample_rate}")
    return pcm


def main():
    from piper import PiperVoice, SynthesisConfig

    manifest = {}
    for lang in ("nl", "en"):
        voice = PiperVoice.load(fetch(lang))
        cfg = SynthesisConfig(length_scale=VOICES[lang]["length_scale"])
        items = {f"l-{k}": v for k, v in LETTERS[lang].items()}
        items.update({f"w-{w}": w for w in WORDS[lang]})
        items.update({f"p-{k}": v for k, v in PHRASES[lang].items()})
        d = os.path.join(OUT, lang)
        os.makedirs(d, exist_ok=True)
        for old in os.listdir(d):
            if old.endswith(".mp3") and old[:-4] not in items:
                os.remove(os.path.join(d, old))
        manifest[lang] = {}
        total = 0
        for key, text in items.items():
            x = clean(say(voice, cfg, text))
            data = mp3(x)
            with open(os.path.join(d, f"{key}.mp3"), "wb") as f:
                f.write(data)
            manifest[lang][key] = {"ms": int(len(x) * 1000 / RATE), "bytes": len(data)}
            total += len(data)
        print(f"{lang}: {len(items)} clips, {total / 1024:.0f} KiB", file=sys.stderr)
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1, sort_keys=True)
        f.write("\n")


if __name__ == "__main__":
    main()
