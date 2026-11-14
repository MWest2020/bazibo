// Ganzenbord's rules, pure so they can be tested with a seeded die and used by the screens.
// The classic game of the goose, made kind for children:
//   - two dice, as in the classic game (Mark, 2026-11-14): the pips added up are the steps
//   - the classic first throw: 6 and 3 from the start goes to 26, 5 and 4 to 53 (without it a 9
//     from the start would run along the geese 9, 18, 27 ... straight to 63). It also holds for a
//     goose the woods sent back to the start, for the same reason.
//   - geese on 5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54 and 59: move again by the same amount,
//     in the same direction (a goose chain goes on as long as it lands on geese)
//   - the bridge 6 → 12; the maze 42 → 37
//   - the inn 19: miss one turn
//   - the well 31 and the prison 52: classic rule, you wait until another goose lands there and
//     takes your place. Made kind: never longer than WAIT_TURNS (2) turns, so two players can
//     never both be stuck for good
//   - 58: lost in the woods, back to the start (no "death" square)
//   - 63 must be reached exactly; what is left bounces back (from 63 down)
//   - geese may share a square (nobody is sent away)
// Squares are 0 (the start) to 63 (the end).

export const END = 63;
export const GEESE = Object.freeze([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
export const BRIDGE = Object.freeze({ from: 6, to: 12 });
export const INN = 19;
export const WELL = 31;
export const MAZE = Object.freeze({ from: 42, to: 37 });
export const PRISON = 52;
export const WOODS = 58;
export const WAIT_TURNS = 2; // the well and the prison: at most this many missed turns
export const MAX_PLAYERS = 4;
export const FIRST_THROW = Object.freeze({ '6+3': 26, '5+4': 53 }); // a throw from the start only

/** What a square is: 'goose', 'bridge', 'inn', 'well', 'maze', 'prison', 'woods', 'end', 'start' or ''. */
export function kindOf(sq) {
  if (sq === 0) return 'start';
  if (sq === END) return 'end';
  if (GEESE.includes(sq)) return 'goose';
  if (sq === BRIDGE.from) return 'bridge';
  if (sq === INN) return 'inn';
  if (sq === WELL) return 'well';
  if (sq === MAZE.from) return 'maze';
  if (sq === PRISON) return 'prison';
  if (sq === WOODS) return 'woods';
  return '';
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One throw of the die: 1 to 6. */
export const rollDie = (rand = Math.random) => 1 + Math.floor(rand() * 6);

/** One throw of the two dice: [a, b], each 1 to 6. */
export const rollDice = (rand = Math.random) => [rollDie(rand), rollDie(rand)];

/** Where a throw from the start sends a goose, or 0: 6+3 → 26, 5+4 → 53 (either order). */
export function firstThrowJump(dice) {
  const [a, b] = [...dice].sort((x, y) => y - x);
  return FIRST_THROW[`${a}+${b}`] || 0;
}

/**
 * Walk `steps` squares from `from` in direction `dir` (1 forward, -1 back), bouncing back from 63.
 * Returns { path: every square stepped on, in order, to: the last one, dir: the last direction }.
 */
export function walk(from, steps, dir = 1) {
  const path = [];
  let pos = from;
  let d = dir;
  for (let k = 0; k < steps; k++) {
    if (d === 1 && pos === END) d = -1; // bounce
    pos += d;
    if (pos < 0) {
      pos = 0; // never happens with the classic squares, but stay on the board
      break;
    }
    path.push(pos);
  }
  return { path, to: pos, dir: d };
}

/** A new game: every goose on the start, player 0 to throw. */
export function newGame(players) {
  if (!Number.isInteger(players) || players < 2 || players > MAX_PLAYERS) throw new Error(`2 to ${MAX_PLAYERS} players`);
  return { players: Array.from({ length: players }, () => ({ pos: 0, wait: 0, stuck: '', thrown: false })), turn: 0, winner: -1 };
}

const clone = (game) => ({ ...game, players: game.players.map((p) => ({ ...p })) });

/**
 * The current player throws the two dice `dice` ([a, b], each 1 to 6): the pips added up are the
 * steps, and a throw of 6+3 or 5+4 from the start (square 0) jumps to 26 or 53 (event 'first').
 */
export function throwDice(game, dice) {
  if (!Array.isArray(dice) || dice.length !== 2 || !dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6)) {
    throw new Error(`two dice of 1 to 6, not ${JSON.stringify(dice)}`);
  }
  const fromStart = game.players[game.turn].pos === 0;
  return play(game, dice[0] + dice[1], fromStart ? firstThrowJump(dice) : 0);
}

/**
 * The current player moves `roll` steps (the two dice added up; 1 to 12, so the rules can be tested
 * square by square). `jump`, when not 0, is the classic first throw: after the counted steps the
 * goose goes straight there instead of on along the geese. Returns { game: the new state, events } (the old state is left
 * as it was). Events, in order, for the screens to show:
 *   { type: 'move', player, from, path, to }       the counted steps (a bounce included)
 *   { type: 'first', player, from, to }            6+3 or 5+4 from the start: straight to 26 or 53
 *   { type: 'bounce', player }                     63 was passed: the rest went back
 *   { type: 'goose', player, from, path, to }      a goose: the same amount again
 *   { type: 'bridge' | 'maze' | 'woods', player, from, to }
 *   { type: 'inn' | 'well' | 'prison', player }    waiting starts
 *   { type: 'freed', player, by }                  another goose landed in the well or prison
 *   { type: 'win', player }
 *   { type: 'skip', player, reason, left }         after the turn: a waiting player misses a turn
 *   { type: 'released', player }                  that player may throw again next time
 */
export function play(game, roll, jump = 0) {
  if (game.winner >= 0) throw new Error('the game is over');
  if (!Number.isInteger(roll) || roll < 1 || roll > 12) throw new Error(`a throw is 1 to 12 steps, not ${roll}`);
  const g = clone(game);
  const me = g.turn;
  const p = g.players[me];
  p.thrown = true;
  const events = [];
  let w = walk(p.pos, roll, 1);
  events.push({ type: 'move', player: me, from: p.pos, path: w.path, to: w.to });
  if (w.path.includes(END) && w.to !== END) events.push({ type: 'bounce', player: me });
  let pos = w.to;
  if (jump) {
    events.push({ type: 'first', player: me, from: pos, to: jump });
    pos = jump;
  }
  for (let guard = 0; guard < 20; guard++) {
    const kind = kindOf(pos);
    if (kind === 'goose') {
      const from = pos;
      w = walk(pos, roll, w.dir);
      pos = w.to;
      events.push({ type: 'goose', player: me, from, path: w.path, to: pos });
      if (w.path.includes(END) && pos !== END) events.push({ type: 'bounce', player: me });
      continue;
    }
    if (kind === 'bridge') {
      events.push({ type: 'bridge', player: me, from: pos, to: BRIDGE.to });
      pos = BRIDGE.to;
      continue;
    }
    if (kind === 'maze') {
      events.push({ type: 'maze', player: me, from: pos, to: MAZE.to });
      pos = MAZE.to;
      continue;
    }
    if (kind === 'woods') {
      events.push({ type: 'woods', player: me, from: pos, to: 0 });
      pos = 0;
      continue;
    }
    break;
  }
  p.pos = pos;
  const kind = kindOf(pos);
  if (kind === 'end') {
    g.winner = me;
    events.push({ type: 'win', player: me });
    return { game: g, events };
  }
  if (kind === 'inn') {
    p.wait = 1;
    p.stuck = 'inn';
    events.push({ type: 'inn', player: me });
  } else if (kind === 'well' || kind === 'prison') {
    // whoever waits there is freed: this goose takes its place
    g.players.forEach((o, k) => {
      if (k !== me && o.pos === pos && o.stuck === kind) {
        o.wait = 0;
        o.stuck = '';
        events.push({ type: 'freed', player: k, by: me });
      }
    });
    p.wait = WAIT_TURNS;
    p.stuck = kind;
    events.push({ type: kind, player: me });
  }
  // the next player who may throw; those who wait miss this turn
  let next = me;
  for (let guard = 0; guard < 64; guard++) {
    next = (next + 1) % g.players.length;
    const o = g.players[next];
    if (o.wait > 0) {
      o.wait--;
      events.push({ type: 'skip', player: next, reason: o.stuck, left: o.wait });
      if (o.wait === 0) {
        events.push({ type: 'released', player: next });
        o.stuck = '';
      }
      continue;
    }
    break;
  }
  g.turn = next;
  return { game: g, events };
}
