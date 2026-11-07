// Picturedoku's taps, as pure decisions so they can be tested without a screen. One model on every
// size (Mark, 2026-11-08: switching pictures must never change a square by itself):
//   - A picture tap never changes a filled square, unless the child tapped that square right before.
//   - Square first: tap a square (empty or filled), then a picture: it goes in, and nothing stays
//     chosen. With the pencil the square stays chosen, for more small pictures.
//   - Picture first (6×6 and up; on 4×4 a picture tap without a square only shows where to tap):
//     a picture tap with nothing chosen arms it, and each tap on an EMPTY square places it. Another
//     picture tap only switches the armed picture. A tap on a filled square while armed places
//     nothing: it chooses that square, so the next picture tap replaces it on purpose.
//   - The eraser works the same way: on a chosen square, or armed (6×6 and up) on tapped squares.
// s: { n, tier, board, notes, given, selected, brush, pencil }   (brush: picture 1..n, -1 eraser, 0 none)
// Every function returns { selected, brush, changes, notice, wiggle, sound }:
//   changes [[cell, picture, notesMask], ...] to apply as one undoable step; notice '' | 'fixed' |
//   'pickSquare'; wiggle: cells to shake; sound: null | 'click' | ['plink', picture].
import { peers } from './rules.js';

const result = (s, extra = {}) => ({ selected: s.selected, brush: s.brush, changes: [], notice: '', wiggle: [], sound: null, ...extra });

/** What putting picture v (0 = clear) into square i does. */
export function placeInto(s, i, v) {
  if (s.given[i]) return result(s, { notice: 'fixed', wiggle: [i] });
  if (s.pencil && v > 0) {
    if (s.board[i]) return result(s); // small pictures only go in empty squares
    return result(s, { changes: [[i, 0, s.notes[i] ^ (1 << v)]], sound: 'click' });
  }
  if (v > 0 && s.board[i] === v) v = 0; // the same picture again takes it out
  if (!v && !s.board[i] && !s.notes[i]) return result(s);
  const changes = [[i, v, 0]];
  // a placed picture is no longer a possibility for its row, column and box
  if (v > 0) for (const j of peers(s.n)[i]) if (s.notes[j] & (1 << v)) changes.push([j, s.board[j], s.notes[j] & ~(1 << v)]);
  return result(s, { changes, sound: v > 0 ? ['plink', v] : 'click' });
}

/** Picture-first and the armed eraser are for 6×6 and up. */
export const canArm = (s) => s.tier !== 'tiny';

function askForSquare(s) {
  const empty = [];
  for (let i = 0; i < s.board.length; i++) if (!s.given[i] && !s.board[i]) empty.push(i);
  return result(s, { notice: 'pickSquare', wiggle: empty, sound: 'click' });
}

export function tapCell(s, i) {
  if (s.brush === 0) return result(s, { selected: s.selected === i ? -1 : i, sound: 'click' });
  if (s.brush === -1) return { ...placeInto(s, i, 0), selected: -1 }; // the armed eraser
  // a picture is armed
  if (s.board[i] || s.given[i]) return result(s, { selected: i, sound: 'click' }); // choose it, change nothing
  return { ...placeInto(s, i, s.brush), selected: -1 };
}

export function tapPicture(s, v) {
  if (s.selected >= 0) {
    const r = placeInto(s, s.selected, v);
    // after a placement nothing stays chosen; with the pencil the square stays, for more notes
    return { ...r, selected: s.pencil && !s.given[s.selected] ? s.selected : -1 };
  }
  if (!canArm(s)) return askForSquare(s);
  return result(s, { brush: s.brush === v ? 0 : v, sound: 'click' }); // arm, switch or put down
}

export function tapEraser(s) {
  if (s.selected >= 0) return { ...placeInto({ ...s, pencil: false }, s.selected, 0), selected: -1 };
  if (!canArm(s)) return askForSquare(s);
  return result(s, { brush: s.brush === -1 ? 0 : -1, sound: 'click' });
}
