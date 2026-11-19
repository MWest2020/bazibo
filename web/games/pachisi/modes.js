// The two modes of the race game: Ludo (the default: one die, the cross of 40 squares) and
// Pachisi (the original from India: six cowrie shells, the cloth of 3×8 arms). The screen
// (pachisi.js) plays either through one of these objects, so "count yourself", the gentle capture,
// the touch picking, take-back and the hand-off are the same in both. Everything here is pure.
//
// A mode: { id, SIZE (cells across), LAST (the last position), newGame, applyThrow, playMove,
// legalMoves, stepsOf, randomThrow(rand), readThrow(thr), items(roll) (what the child counts: one
// boolean per shell or pip, true counts), isDone(pos), pawnSpots(seats, shown), placeOf(seats, k,
// pos), boardSvg(seats), chooseMove(g, level, rand), why(g, pawn) (why a pawn cannot move: a
// string key or null), safeAt(g, k, pos) (a castle) }.
import * as P from './rules.js';
import * as L from './ludo-rules.js';
import { chooseMove as pachisiMove } from './ai.js';
import { chooseMove as ludoMove } from './ludo-ai.js';
import { boardSvg as clothSvg } from './art.js';
import { boardSvg as ludoBoardSvg, yardNests, yardCentre } from './ludo-art.js';

export const MODE_IDS = Object.freeze(['ludo', 'pachisi']);

// ---------- Pachisi's geometry ----------

/** Turn a point (in cell units, from the board's top-left) a quarter counter-clockwise `seat` times round the middle. */
function turnCcw(x, y, seat, size) {
  for (let k = 0; k < seat; k++) [x, y] = [y, size - x];
  return [x, y];
}

/**
 * Where every Pachisi pawn stands, in cell units (x, y of its foot and its size), for `shown`
 * positions: on a square in the middle of it (several on one square side by side), still in the
 * Charkoni in a row in the triangle in front of their arm, home again in a smaller row nearer the middle.
 */
export function pachisiSpots(seats, shown) {
  const groups = new Map();
  shown.forEach((list, k) =>
    list.forEach((pos, i) => {
      const key = pos <= 0 ? `w${k}` : pos >= P.HOME ? `h${k}` : `c${P.PATHS[seats[k]][pos]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push([k, i]);
    }),
  );
  const out = shown.map((list) => list.map(() => null));
  for (const [key, list] of groups) {
    const n = list.length;
    if (key[0] === 'c') {
      const cell = Number(key.slice(1));
      const cx = P.colOf(cell) + 0.5;
      const cy = P.rowOf(cell) + 0.5;
      const offs = n === 1 ? [[0, 0]] : n === 2 ? [[-0.24, 0], [0.24, 0]] : n === 3 ? [[-0.24, -0.16], [0.24, -0.16], [0, 0.2]] : [[-0.24, -0.18], [0.24, -0.18], [-0.24, 0.2], [0.24, 0.2]];
      list.forEach(([k, i], j) => {
        const [ox, oy] = offs[j % offs.length];
        out[k][i] = { x: cx + ox, y: cy + oy, s: n === 1 ? 1.3 : 0.95 };
      });
    } else {
      const k = list[0][0];
      const seat = seats[k];
      const home = key[0] === 'h';
      list.forEach(([kk, i], j) => {
        const dx = (j - (n - 1) / 2) * (home ? 0.32 : 0.6);
        const [x, y] = turnCcw(9.5 + dx, home ? 10.05 : 10.62, seat, P.SIZE);
        out[kk][i] = { x, y, s: home ? 0.55 : 0.66 };
      });
    }
  }
  return out;
}

/** Where a Pachisi position of player k is, in cell units (the middle of its square, or of the Charkoni's triangle / the middle). */
export function pachisiPlace(seats, k, pos) {
  if (pos >= P.HOME) return { x: 9.5, y: 9.5 };
  if (pos <= 0) {
    const [x, y] = turnCcw(9.5, 10.55, seats[k], P.SIZE);
    return { x, y };
  }
  const cell = P.PATHS[seats[k]][pos];
  return { x: P.colOf(cell) + 0.5, y: P.rowOf(cell) + 0.5 };
}

// ---------- Ludo's geometry ----------

/**
 * Where every Ludo pawn stands (cell units): on its square (nobody ever shares a square on the
 * track or in the home squares), or in its own nest in the yard.
 */
export function ludoSpots(seats, shown) {
  return shown.map((list, k) =>
    list.map((pos, i) => {
      if (pos <= 0) {
        const nests = yardNests(seats[k]);
        // 2 pawns: the two nests on the diagonal, so they stand apart
        const [x, y] = nests[list.length === 2 ? [0, 3][i] : i % 4];
        return { x, y: y + 0.12, s: 1.15 };
      }
      const cell = L.WAYS[seats[k]][Math.min(pos, L.LAST)];
      return { x: L.colOf(cell) + 0.5, y: L.rowOf(cell) + 0.55, s: 1.1 };
    }),
  );
}

/** Where a Ludo position of player k is (cell units): its square, or the middle of its yard. */
export function ludoPlace(seats, k, pos) {
  if (pos <= 0) {
    const [x, y] = yardCentre(seats[k]);
    return { x, y };
  }
  const cell = L.WAYS[seats[k]][Math.min(pos, L.LAST)];
  return { x: L.colOf(cell) + 0.5, y: L.rowOf(cell) + 0.5 };
}

// ---------- the modes ----------

export const PACHISI = Object.freeze({
  id: 'pachisi',
  SIZE: P.SIZE,
  LAST: P.HOME,
  newGame: P.newGame,
  applyThrow: P.applyThrow,
  playMove: P.playMove,
  legalMoves: P.legalMoves,
  stepsOf: P.stepsOf,
  randomThrow: (rand) => P.throwShells(rand),
  readThrow: (shells) => ({ shells: shells.slice(), ...P.readThrow(shells) }),
  items: (roll) => roll.shells.slice(),
  isDone: (pos) => pos >= P.HOME,
  pawnSpots: pachisiSpots,
  placeOf: pachisiPlace,
  boardSvg: (seats) => clothSvg(seats),
  chooseMove: pachisiMove,
  /** Why pawn i of the player to move cannot use the throw (only a castle an opponent holds is worth saying). */
  why(g, i) {
    const k = g.turn;
    const from = g.pawns[k][i];
    if (from >= P.HOME) return null;
    const to = Math.min(P.HOME, from + g.roll.steps);
    const cell = P.PATHS[g.seats[k]][to];
    return to < P.HOME && P.isCastle(cell) && P.opponentsOn(g, k, cell).length ? 'pachisi.blocked' : null;
  },
  safeAt: (g, k, pos) => pos > 0 && pos < P.HOME && P.isCastle(P.PATHS[g.seats[k]][pos]),
});

const LUDO_WHY = { yard: 'ludo.needSix', own: 'ludo.ownThere', far: 'ludo.tooFar', enter: 'ludo.mustEnter', clear: 'ludo.clearStart' };

export const LUDO = Object.freeze({
  id: 'ludo',
  SIZE: L.SIZE,
  LAST: L.LAST,
  newGame: L.newGame,
  applyThrow: L.applyThrow,
  playMove: L.playMove,
  legalMoves: L.legalMoves,
  stepsOf: L.stepsOf,
  randomThrow: (rand) => L.throwDie(rand),
  readThrow: (value) => L.readThrow(value),
  items: (roll) => new Array(roll.value).fill(true),
  isDone: L.isHome,
  pawnSpots: ludoSpots,
  placeOf: ludoPlace,
  boardSvg: (seats) => ludoBoardSvg(seats),
  chooseMove: ludoMove,
  why(g, i) {
    const r = L.whyNot(g, i);
    return r ? LUDO_WHY[r] || null : null;
  },
  safeAt: () => false,
});

export const MODES = Object.freeze({ ludo: LUDO, pachisi: PACHISI });
export const modeOf = (id) => MODES[id] || LUDO;
