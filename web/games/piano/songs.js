// Piano: the keyboards and the songs, as data, with the pure rules of playing along. No DOM, no
// sound, so `tests/piano.test.js` checks all of it.
//
// Two levels, by age. 4-6: the toy piano, one octave and a bit (8 coloured keys from C to the high
// C and the 5 black keys between them), sounding an octave higher than written (C5 to C6), where a
// toy piano sits and where small phone speakers carry; its songs stay on the coloured keys. 7-10:
// two octaves from middle C, with longer songs that use the black keys, a wider range and quicker
// notes.

// The keyboards. Each level has its own: the toy piano for 4-6 (above) and, for 7-10, two
// octaves from middle C (C4) to C6 with all their black keys, sounding where they are written.
// A white key has the colour of its note name (every C is red), so the same colours keep
// meaning the same notes on the bigger keyboard.
const COLOR = { c: '#ff5d6c', d: '#ff9a3d', e: '#ffd23f', f: '#7ed957', g: '#3ccfc0', a: '#4aa8ff', b: '#9b7bff' };
const PITCH = ['c', 'cis', 'd', 'dis', 'e', 'f', 'fis', 'g', 'gis', 'a', 'ais', 'b'];

/** A keyboard from its keys (low to high, a semitone apart) and the MIDI number of the lowest. */
function makeBoard(id, list, baseMidi, keymap) {
  const keys = Object.freeze(list.map((k, i) => Object.freeze({ ...k, semi: i, midi: baseMidi + i, pc: PITCH[(baseMidi + i) % 12] })));
  const byId = Object.fromEntries(keys.map((k) => [k.id, k]));
  const whites = Object.freeze(keys.filter((k) => k.white));
  const slot = (k) => keys.slice(0, k.semi).filter((x) => x.white).length;
  return Object.freeze({
    id,
    keys,
    whites,
    ids: Object.freeze(keys.map((k) => k.id)),
    baseMidi,
    keymap: Object.freeze(keymap),
    keyById: (kid) => byId[kid] || null,
    keyByMidi: (m) => keys[m - baseMidi] || null,
    frequency: (kid) => (byId[kid] ? frequency(byId[kid].midi) : null),
    /** Where a black key sits: the number of white keys to its left (it straddles that edge). */
    blackSlot: (kid) => (byId[kid] && !byId[kid].white ? slot(byId[kid]) : null),
    /** The part of the keyboard a key covers, in white-key widths from the left edge. */
    span(kid) {
      const k = byId[kid];
      if (!k) return null;
      const s = slot(k);
      return k.white ? [s, s + 1] : [s - 0.35, s + 0.35];
    },
  });
}

/** The toy piano (4-6): 8 coloured keys from C to the high C and the 5 black keys between them. */
export const SMALL = makeBoard(
  'small',
  [
    { id: 'c', white: true, color: COLOR.c },
    { id: 'cis', white: false },
    { id: 'd', white: true, color: COLOR.d },
    { id: 'dis', white: false },
    { id: 'e', white: true, color: COLOR.e },
    { id: 'f', white: true, color: COLOR.f },
    { id: 'fis', white: false },
    { id: 'g', white: true, color: COLOR.g },
    { id: 'gis', white: false },
    { id: 'a', white: true, color: COLOR.a },
    { id: 'ais', white: false },
    { id: 'b', white: true, color: COLOR.b },
    { id: 'c2', white: true, color: '#ff7ac8' },
  ],
  72, // C5, an octave above middle C: where a toy piano sits and small phone speakers carry
  // computer keyboards: the middle row plays the coloured keys, the row above the black ones
  { a: 'c', w: 'cis', s: 'd', e: 'dis', d: 'e', f: 'f', t: 'fis', g: 'g', y: 'gis', h: 'a', u: 'ais', j: 'b', k: 'c2' },
);

/** The bigger piano (7-10): C4 to C6, 15 coloured keys and 10 black keys; ids like `fis4`. */
export const BIG = makeBoard(
  'big',
  Array.from({ length: 25 }, (_, i) => {
    const pc = PITCH[i % 12];
    const id = `${pc}${4 + Math.floor(i / 12)}`;
    return COLOR[pc] ? { id, white: true, color: COLOR[pc] } : { id, white: false };
  }),
  60,
  // the tracker layout: Z to M (and the row above) the low octave, Q to I (and the digits) the high one
  Object.fromEntries(
    [...'zsxdcvgbhnjm', ...'q2w3er5t6y7ui'].map((c, i) => [c, `${PITCH[i % 12]}${4 + Math.floor(i / 12)}`]),
  ),
);

/** The levels, youngest first: which keyboard, for which ages (shown as "4-6 jaar"). */
export const LEVELS = Object.freeze([
  Object.freeze({ id: 'small', ages: '4-6', board: SMALL }),
  Object.freeze({ id: 'big', ages: '7-10', board: BIG }),
]);
export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;

// The toy piano's keys, as before (the shell, the pictures and the tests use them).
export const KEYS = SMALL.keys;
export const WHITE_KEYS = SMALL.whites;
export const KEY_IDS = SMALL.ids;
export const keyById = SMALL.keyById;

/** The lowest key's pitch as a MIDI number: C5 (an octave above middle C). */
export const BASE_MIDI = SMALL.baseMidi;

/** Equal temperament, A4 = 440 Hz. */
export function frequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export const keyFrequency = SMALL.frequency;
export const blackSlot = SMALL.blackSlot;

const NAME = { C: 'c', 'C#': 'cis', D: 'd', 'D#': 'dis', E: 'e', F: 'f', 'F#': 'fis', G: 'g', 'G#': 'gis', A: 'a', 'A#': 'ais', B: 'b', "C'": 'c2' };
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * A song as text -> [{ key, beats }, ...]. Throws on a note the keyboard does not have.
 *   the toy piano: note names, a ' for the high C, # for a black key: `C D:2 E:.5 F# C'`
 *   the big piano: note name and octave, # or b: `C4 F#4:.5 Bb4 C6:2`
 * The length after the colon is in beats (1 = a quarter note); without one a note is one beat.
 * `R:.5` is a rest: it lengthens the step after the note before it (`beats`, from this note to
 * the next) and is kept as `rest`, so the listen button lets go of the key in time. A | is a bar
 * line, only there to read it.
 */
export function parseSong(text, board = SMALL) {
  const notes = [];
  for (const tok of text.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const m = board === SMALL ? /^([A-G](?:#|')?|R)(?::(\d*\.?\d+))?$/.exec(tok) : /^([A-G][#b]?\d|R)(?::(\d*\.?\d+))?$/.exec(tok);
    if (!m) throw new Error(`piano: unknown note ${JSON.stringify(tok)}`);
    const beats = m[2] === undefined ? 1 : Number(m[2]);
    if (!(beats > 0 && beats <= 4)) throw new Error(`piano: odd length ${JSON.stringify(tok)}`);
    if (m[1] === 'R') {
      const last = notes[notes.length - 1];
      if (!last) throw new Error('piano: a song cannot start with a rest');
      last.beats += beats;
      last.rest = (last.rest || 0) + beats;
      continue;
    }
    let key = null;
    if (board === SMALL) key = NAME[m[1]] || null;
    else {
      const n = /^([A-G])([#b]?)(\d)$/.exec(m[1]);
      key = board.keyByMidi(12 * (Number(n[3]) + 1) + LETTER[n[1]] + (n[2] === '#' ? 1 : n[2] === 'b' ? -1 : 0))?.id || null;
    }
    if (!key) throw new Error(`piano: unknown note ${JSON.stringify(tok)}`);
    notes.push({ key, beats });
  }
  return Object.freeze(notes.map((n) => Object.freeze(n)));
}

// The songs, all in the public domain, per level. Order matters: the first of each level is the
// free one (meta.js), the rest come with the full version. Names live in strings.js as
// `piano.song.<id>`; ids are unique over both levels (stars are saved per id).
//
// 4-6: traditional children's melodies in C, so they need only the coloured keys.
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

// 7-10: the melodies as written in the scores they were checked against (named per song); only
// grace notes and trills are left out. Lengths in quarter notes, so a sixteenth is `:.25`.
const RAW_BIG = [
  {
    // Ode an die Freude (Beethoven, 9th symphony, 1824), the whole tune (A A B A) in D major, the
    // key of the symphony, so F# is a black key. Checked against the score on en.wikipedia.org
    // "Ode to Joy" (there in G major, here a fifth up), with the tied F# in bar 12.
    id: 'ode',
    bpm: 112,
    notes: `F#5 F#5 G5 A5 | A5 G5 F#5 E5 | D5 D5 E5 F#5 | F#5:1.5 E5:.5 E5:2 |
            F#5 F#5 G5 A5 | A5 G5 F#5 E5 | D5 D5 E5 F#5 | E5:1.5 D5:.5 D5:2 |
            E5 E5 F#5 D5 | E5 F#5:.5 G5:.5 F#5 D5 | E5 F#5:.5 G5:.5 F#5 E5 | D5 E5 A4 F#5:2 |
            F#5 G5 A5 | A5 G5 F#5 E5 | D5 D5 E5 F#5 | E5:1.5 D5:.5 D5:2`,
  },
  {
    // Wilhelmus (melody from about 1570), the first verse: lines 1-2 twice, then 5-6 and 7-8,
    // in G major. Checked against the three scores on nl.wikipedia.org "Wilhelmus" (the bars in
    // 2/4 and 3/4 as there).
    id: 'wilhelmus',
    bpm: 84,
    notes: `D4 | G4 G4 A4:.5 B4:.5 C5:.5 A4:.5 | B4 A4:.5 B4:.5 C5 B4 | A4:.5 G4:.5 A4 | G4:3 |
            D4 | G4 G4 A4:.5 B4:.5 C5:.5 A4:.5 | B4 A4:.5 B4:.5 C5 B4 | A4:.5 G4:.5 A4 | G4:3 |
            B4:.5 C5:.5 | D5:2 E5 | D5:2 C5 | B4 A4:.5 B4:.5 C5 | B4 A4 G4 | A4:3 |
            D4 | G4:.5 F#4:.5 G4:.5 A4:.5 B4 | A4:2 G4 | F#4 D4 E4:.5 F#4:.5 | G4 G4 F#4 | G4:3`,
  },
  {
    // In de hal van de bergkoning (Grieg, Peer Gynt, 1875): the theme in B minor, its answer on
    // F#, and the theme again. Checked against the two scores on en.wikipedia.org "In the Hall of
    // the Mountain King" (the theme two octaves up, the answer one octave up, so both fit).
    id: 'bergkoning',
    bpm: 120,
    notes: `B4:.5 C#5:.5 D5:.5 E5:.5 F#5:.5 D5:.5 F#5 | E#5:.5 C#5:.5 E#5 E5:.5 C5:.5 E5 |
            B4:.5 C#5:.5 D5:.5 E5:.5 F#5:.5 D5:.5 F#5:.5 B5:.5 | A5:.5 F#5:.5 D5:.5 F#5:.5 A5 R |
            F#4:.5 G#4:.5 A#4:.5 B4:.5 C#5:.5 A#4:.5 C#5 | D5:.5 A#4:.5 D5 C#5:.5 A#4:.5 C#5 |
            F#4:.5 G#4:.5 A#4:.5 B4:.5 C#5:.5 A#4:.5 C#5 | D5:.5 A#4:.5 D5 C#5 R |
            B4:.5 C#5:.5 D5:.5 E5:.5 F#5:.5 D5:.5 F#5 | E#5:.5 C#5:.5 E#5 E5:.5 C5:.5 E5 |
            B4:.5 C#5:.5 D5:.5 E5:.5 F#5:.5 D5:.5 F#5:.5 B5:.5 | A5:.5 F#5:.5 D5:.5 F#5:.5 A5 R`,
  },
  {
    // Turkse mars (Mozart, Rondo alla turca, piano sonata K. 331, 1783): the opening, its eight
    // bars and their answer. Checked against the Mutopia Project's LilyPond source
    // (KV331_3_RondoAllaTurca, voices `righta` and `rightaa`) and the score on en.wikipedia.org
    // "Piano Sonata No. 11 (Mozart)"; the grace notes left out, the trill near the end one B.
    id: 'turks',
    bpm: 116,
    notes: `B4:.25 A4:.25 G#4:.25 A4:.25 | C5:.5 R:.5 D5:.25 C5:.25 B4:.25 C5:.25 |
            E5:.5 R:.5 F5:.25 E5:.25 D#5:.25 E5:.25 | B5:.25 A5:.25 G#5:.25 A5:.25 B5:.25 A5:.25 G#5:.25 A5:.25 |
            C6 A5:.5 C6:.5 | B5:.5 A5:.5 G5:.5 A5:.5 | B5:.5 A5:.5 G5:.5 A5:.5 | B5:.5 A5:.5 G5:.5 F#5:.5 | E5 |
            B4:.25 A4:.25 G#4:.25 A4:.25 | C5:.5 R:.5 D5:.25 C5:.25 B4:.25 C5:.25 |
            E5:.5 R:.5 F5:.25 E5:.25 D#5:.25 E5:.25 | B5:.25 A5:.25 G#5:.25 A5:.25 B5:.25 A5:.25 G#5:.25 A5:.25 |
            C6:.5 R:.5 A5:.5 B5:.5 | C6:.5 B5:.5 A5:.5 G#5:.5 | A5:.5 E5:.5 F5:.5 D5:.5 | C5 B4 | A4`,
  },
  {
    // Für Elise (Beethoven, WoO 59, 1810): bars 1-8 with the first ending, the right hand.
    // Checked against the Mutopia Project's LilyPond source (fur_Elise_WoO59) and the score on
    // en.wikipedia.org "Für Elise".
    id: 'elise',
    bpm: 72,
    notes: `E5:.25 D#5:.25 | E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 | A4:.5 R:.25 C4:.25 E4:.25 A4:.25 |
            B4:.5 R:.25 E4:.25 G#4:.25 B4:.25 | C5:.5 R:.25 E4:.25 E5:.25 D#5:.25 |
            E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 | A4:.5 R:.25 C4:.25 E4:.25 A4:.25 |
            B4:.5 R:.25 E4:.25 C5:.25 B4:.25 | A4`,
  },
];

const make = (level, board) => (s) => Object.freeze({ id: s.id, level, bpm: s.bpm, notes: parseSong(s.notes, board) });
/** Every song, the toy piano's first. */
export const SONGS = Object.freeze([...RAW.map(make('small', SMALL)), ...RAW_BIG.map(make('big', BIG))]);
/** The songs of one level, in their order. */
export const songsFor = (level) => SONGS.filter((s) => s.level === level);
export const SONG_IDS = SONGS.map((s) => s.id);
export const songById = (id) => SONGS.find((s) => s.id === id) || null;

/**
 * When each note starts and how long it sounds, in milliseconds, for the listen button. A note is
 * held a little shorter than its length (without the rest after it) so repeated keys light up
 * twice.
 */
export function schedule(song, speed = 1) {
  const beat = 60000 / song.bpm / speed;
  let at = 0;
  return song.notes.map((n) => {
    const sound = (n.beats - (n.rest || 0)) * beat;
    const step = { key: n.key, at: Math.round(at), hold: Math.round(Math.min(sound * 0.8, sound - 60)) };
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

/**
 * The bigger keyboard does not fit an upright phone, so it shows `visible` of its `total` white
 * keys from white key `view` on. While playing along it follows the song: it stays put while the
 * key to press and the few after it are in sight, else it moves to show them, centred. `spans`
 * are the keys' spans (board.span) from the key to press on. Returns the new `view`.
 */
export function followView(spans, view, visible, total) {
  const max = Math.max(0, total - visible);
  if (!spans.length || max === 0) return Math.min(Math.max(0, view), max);
  let [lo, hi] = spans[0];
  for (const [a, b] of spans.slice(1, 8)) {
    if (Math.max(hi, b) - Math.min(lo, a) > visible) break;
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  const fits = (v) => lo >= v - 1e-9 && hi <= v + visible + 1e-9;
  if (fits(view)) return view;
  let v = Math.round((lo + hi) / 2 - visible / 2);
  const [a, b] = spans[0];
  if (a < v) v = Math.floor(a);
  if (b > v + visible) v = Math.ceil(b - visible);
  return Math.min(Math.max(0, v), max);
}

/** The toy piano on a computer keyboard: the middle row plays the coloured keys, the row above the black ones. */
export const KEYBOARD_MAP = SMALL.keymap;
