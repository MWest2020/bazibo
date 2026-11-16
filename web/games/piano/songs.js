// Piano: the keyboard and the songs, as data, with the pure rules of playing along. No DOM, no
// sound, so `tests/piano.test.js` checks all of it.
//
// The keyboard is one octave and a bit, like a toy piano: 8 coloured keys from C to the high C and
// the 5 black keys between them. It sounds an octave higher than written (C5 to C6), where a toy
// piano sits and where small phone speakers carry.
//
// A song is a string of notes: a note name (C D E F G A B, a ' for the high C, # for a black key)
// with an optional length after a colon in beats (1 = a quarter note; `G:2` is a half note,
// `A:.5` an eighth). A | is a bar line, only there to read it.

/** The keys, low to high. `white` keys have a colour; black keys sit between two white ones. */
export const KEYS = Object.freeze([
  { id: 'c', white: true, color: '#ff5d6c' },
  { id: 'cis', white: false },
  { id: 'd', white: true, color: '#ff9a3d' },
  { id: 'dis', white: false },
  { id: 'e', white: true, color: '#ffd23f' },
  { id: 'f', white: true, color: '#7ed957' },
  { id: 'fis', white: false },
  { id: 'g', white: true, color: '#3ccfc0' },
  { id: 'gis', white: false },
  { id: 'a', white: true, color: '#4aa8ff' },
  { id: 'ais', white: false },
  { id: 'b', white: true, color: '#9b7bff' },
  { id: 'c2', white: true, color: '#ff7ac8' },
].map((k, i) => Object.freeze({ ...k, semi: i })));

export const WHITE_KEYS = KEYS.filter((k) => k.white);
export const KEY_IDS = KEYS.map((k) => k.id);
const BY_ID = Object.fromEntries(KEYS.map((k) => [k.id, k]));
export const keyById = (id) => BY_ID[id] || null;

/** The lowest key's pitch as a MIDI number: C5 (an octave above middle C). */
export const BASE_MIDI = 72;

/** Equal temperament, A4 = 440 Hz. */
export function frequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function keyFrequency(id) {
  const k = keyById(id);
  return k ? frequency(BASE_MIDI + k.semi) : null;
}

/** Where a black key sits: the number of white keys to its left (it straddles that edge). */
export function blackSlot(id) {
  const k = keyById(id);
  if (!k || k.white) return null;
  return KEYS.slice(0, k.semi).filter((x) => x.white).length;
}

const NAME = { C: 'c', 'C#': 'cis', D: 'd', 'D#': 'dis', E: 'e', F: 'f', 'F#': 'fis', G: 'g', 'G#': 'gis', A: 'a', 'A#': 'ais', B: 'b', "C'": 'c2' };

/** "C D:2 E:.5" -> [{ key: 'c', beats: 1 }, ...]. Throws on a note the keyboard does not have. */
export function parseSong(text) {
  const notes = [];
  for (const tok of text.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const m = /^([A-G](?:#|')?)(?::(\d*\.?\d+))?$/.exec(tok);
    if (!m || !NAME[m[1]]) throw new Error(`piano: unknown note ${JSON.stringify(tok)}`);
    const beats = m[2] === undefined ? 1 : Number(m[2]);
    if (!(beats > 0 && beats <= 4)) throw new Error(`piano: odd length ${JSON.stringify(tok)}`);
    notes.push(Object.freeze({ key: NAME[m[1]], beats }));
  }
  return Object.freeze(notes);
}

// The songs: traditional children's melodies, all in the public domain, in C so they need only
// the coloured keys. Order matters: the first is the free one (meta.js), the rest come with the
// full version. Names live in strings.js as `piano.song.<id>`.
const RAW = [
  {
    // Vader Jacob / Frère Jacques. The "bim bam bom" is played an octave up (C' G C') so it stays
    // on the keyboard; the leap is the same fourth.
    id: 'jacob',
    bpm: 112,
    notes: `C D E C | C D E C | E F G:2 | E F G:2 |
            G:.5 A:.5 G:.5 F:.5 E C | G:.5 A:.5 G:.5 F:.5 E C | C' G C':2 | C' G C':2`,
  },
  {
    // Altijd is Kortjakje ziek / Twinkle Twinkle Little Star
    id: 'kortjakje',
    bpm: 104,
    notes: `C C G G | A A G:2 | F F E E | D D C:2 | G G F F | E E D:2 |
            G G F F | E E D:2 | C C G G | A A G:2 | F F E E | D D C:2`,
  },
  {
    // Au clair de la lune: the first part, twice
    id: 'maan',
    bpm: 100,
    notes: `C C C D | E:2 D:2 | C E D D | C:4 | C C C D | E:2 D:2 | C E D D | C:4`,
  },
  {
    // Ode an die Freude (Beethoven), the tune every toy piano plays
    id: 'vreugde',
    bpm: 108,
    notes: `E E F G | G F E D | C C D E | E:1.5 D:.5 D:2 |
            E E F G | G F E D | C C D E | D:1.5 C:.5 C:2`,
  },
];

export const SONGS = Object.freeze(RAW.map((s) => Object.freeze({ id: s.id, bpm: s.bpm, notes: parseSong(s.notes) })));
export const SONG_IDS = SONGS.map((s) => s.id);
export const songById = (id) => SONGS.find((s) => s.id === id) || null;

/**
 * When each note starts and how long it sounds, in milliseconds, for the listen button. A note is
 * held a little shorter than its length so repeated keys light up twice.
 */
export function schedule(song, speed = 1) {
  const beat = 60000 / song.bpm / speed;
  let at = 0;
  return song.notes.map((n) => {
    const step = { key: n.key, at: Math.round(at), hold: Math.round(Math.min(n.beats * beat * 0.8, n.beats * beat - 60)) };
    at += n.beats * beat;
    return step;
  });
}

export function songLength(song, speed = 1) {
  return Math.round(song.notes.reduce((s, n) => s + n.beats, 0) * (60000 / song.bpm / speed));
}

/** Stars for playing a song along: gentle, a few wrong keys still give three. Never by time. */
export function starsFor(misses) {
  if (misses <= 3) return 3;
  if (misses <= 10) return 2;
  return 1;
}

/**
 * Playing along: the next key glows; the right key moves on, any other key only sounds (and is
 * counted as a miss). Pure state, so the tests can play every song.
 */
export function createRun(song) {
  let i = 0;
  let misses = 0;
  return {
    get index() {
      return i;
    },
    get misses() {
      return misses;
    },
    get done() {
      return i >= song.notes.length;
    },
    /** The key that should be pressed now, or null at the end. */
    target() {
      return i < song.notes.length ? song.notes[i].key : null;
    },
    /** A key pressed: 'right' (moved on), 'done' (that was the last note), 'wrong' or 'over'. */
    press(key) {
      if (i >= song.notes.length) return 'over';
      if (key !== song.notes[i].key) {
        misses++;
        return 'wrong';
      }
      i++;
      return i >= song.notes.length ? 'done' : 'right';
    },
    restart() {
      i = 0;
      misses = 0;
    },
  };
}

// Computer keyboards: the middle row plays the coloured keys, the row above the black ones.
export const KEYBOARD_MAP = Object.freeze({
  a: 'c', w: 'cis', s: 'd', e: 'dis', d: 'e', f: 'f', t: 'fis', g: 'g', y: 'gis', h: 'a', u: 'ais', j: 'b', k: 'c2',
});
