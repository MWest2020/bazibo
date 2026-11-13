import { test } from 'node:test';
import assert from 'node:assert/strict';
import { END, GEESE, BRIDGE, INN, WELL, MAZE, PRISON, WOODS, WAIT_TURNS, kindOf, walk, newGame, throwDie, rollDie, mulberry32 } from '../web/games/ganzen/rules.js';
import { meta } from '../web/games/ganzen/meta.js';
import { boardLayout, nextTap, stoneAt, tapRadius, STONES, STONE } from '../web/games/ganzen/board.js';
import { sceneSvg } from '../web/games/ganzen/scene.js';

/** A game with the geese on these squares, `turn` to throw. */
function at(positions, turn = 0) {
  const g = newGame(positions.length);
  positions.forEach((pos, k) => (g.players[k].pos = pos));
  g.turn = turn;
  return g;
}
const types = (events) => events.map((e) => e.type);

test('the board: 63 squares, the classic special squares', () => {
  assert.deepEqual(GEESE, [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
  for (const g of GEESE) assert.equal(kindOf(g), 'goose');
  assert.equal(kindOf(6), 'bridge');
  assert.equal(kindOf(19), 'inn');
  assert.equal(kindOf(31), 'well');
  assert.equal(kindOf(42), 'maze');
  assert.equal(kindOf(52), 'prison');
  assert.equal(kindOf(58), 'woods');
  assert.equal(kindOf(63), 'end');
  assert.equal(kindOf(0), 'start');
  assert.equal(kindOf(12), '');
});

test('the die only shows 1 to 6, and every face comes up', () => {
  const rand = mulberry32(7);
  const seen = new Set();
  for (let k = 0; k < 600; k++) {
    const r = rollDie(rand);
    assert.ok(r >= 1 && r <= 6);
    seen.add(r);
  }
  assert.equal(seen.size, 6);
  assert.throws(() => throwDie(newGame(2), 7));
  assert.throws(() => throwDie(newGame(2), 0));
});

test('a plain move: every step counted, then the next player', () => {
  const { game, events } = throwDie(newGame(2), 3);
  assert.deepEqual(events[0], { type: 'move', player: 0, from: 0, path: [1, 2, 3], to: 3 });
  assert.equal(game.players[0].pos, 3);
  assert.equal(game.turn, 1);
  assert.equal(newGame(2).players[0].pos, 0); // the old state is untouched
});

test('a goose: move again by the same amount', () => {
  const { game, events } = throwDie(at([1, 0]), 4); // 1 + 4 = 5 (goose), + 4 = 9 (goose), + 4 = 13
  assert.deepEqual(types(events).slice(0, 3), ['move', 'goose', 'goose']);
  assert.deepEqual(events[1].path, [6, 7, 8, 9]);
  assert.equal(game.players[0].pos, 13);
});

test('a goose chain: 18, 23 and 27 are five apart... and 9 to 14 too', () => {
  // from 4, a 5: 9 (goose) -> 14 (goose) -> 19? no: 14 + 5 = 19, the inn
  const { game, events } = throwDie(at([4, 0]), 5);
  assert.deepEqual(types(events), ['move', 'goose', 'goose', 'inn']);
  assert.equal(game.players[0].pos, INN);
  // from 13, a 5: 18 -> 23 -> 28
  const r = throwDie(at([13, 0]), 5);
  assert.equal(r.game.players[0].pos, 28);
  assert.deepEqual(types(r.events), ['move', 'goose', 'goose']);
});

test('the bridge 6 -> 12, the maze 42 -> 37', () => {
  let r = throwDie(at([2, 0]), 4);
  assert.deepEqual(types(r.events).slice(0, 2), ['move', 'bridge']);
  assert.equal(r.game.players[0].pos, BRIDGE.to);
  r = throwDie(at([39, 0]), 3);
  assert.deepEqual(types(r.events).slice(0, 2), ['move', 'maze']);
  assert.equal(r.game.players[0].pos, MAZE.to);
});

test('lost in the woods (58): back to the start', () => {
  const r = throwDie(at([55, 0]), 3);
  assert.deepEqual(types(r.events).slice(0, 2), ['move', 'woods']);
  assert.equal(r.game.players[0].pos, 0);
  assert.equal(kindOf(WOODS), 'woods');
});

test('the inn (19): miss one turn', () => {
  let g = throwDie(at([16, 10]), 3).game; // goose 0 to the inn
  assert.equal(g.players[0].pos, INN);
  assert.equal(g.turn, 1);
  const r = throwDie(g, 1); // goose 1 throws; goose 0 misses its turn
  assert.deepEqual(types(r.events).slice(-2), ['skip', 'released']);
  assert.equal(r.game.turn, 1);
  g = throwDie(r.game, 1).game; // goose 1 again; now goose 0 may throw
  assert.equal(g.turn, 0);
});

for (const [square, name] of [[WELL, 'well'], [PRISON, 'prison']]) {
  test(`the ${name} (${square}): wait until another goose lands there, never more than ${WAIT_TURNS} turns`, () => {
    // on its own: two missed turns, then free
    let g = throwDie(at([square - 2, 0]), 2).game;
    assert.equal(g.players[0].stuck, name);
    let r = throwDie(g, 1);
    assert.deepEqual(r.events.slice(-1)[0], { type: 'skip', player: 0, reason: name, left: 1 });
    assert.equal(r.game.turn, 1);
    r = throwDie(r.game, 1);
    assert.deepEqual(types(r.events).slice(-2), ['skip', 'released']);
    assert.equal(r.game.turn, 1);
    r = throwDie(r.game, 1);
    assert.equal(r.game.turn, 0);
    assert.equal(r.game.players[0].pos, square);

    // freed: the other goose lands there and takes its place
    g = throwDie(at([square - 2, square - 3]), 2).game;
    r = throwDie(g, 3);
    assert.ok(r.events.some((e) => e.type === 'freed' && e.player === 0 && e.by === 1));
    assert.equal(r.game.players[0].stuck, '');
    assert.equal(r.game.players[1].stuck, name);
    assert.equal(r.game.turn, 0);
  });
}

test('two geese waiting at once never block the game', () => {
  const g = at([WELL, PRISON - 3]);
  g.players[0].wait = WAIT_TURNS;
  g.players[0].stuck = 'well';
  g.turn = 1;
  const r = throwDie(g, 3); // goose 1 into the prison
  assert.ok(r.events.some((e) => e.type === 'prison' && e.player === 1));
  // both wait at once: the turns go round, each misses two, then goose 0 throws again
  assert.equal(r.events.filter((e) => e.type === 'skip').length, 4);
  assert.equal(r.game.turn, 0);
  assert.ok(r.game.players.every((p) => p.wait === 0 && !p.stuck));
  let game = r.game;
  for (let k = 0; k < 6 && game.winner < 0; k++) {
    assert.ok(game.players[game.turn].wait === 0, 'a waiting goose was asked to throw');
    game = throwDie(game, 1).game;
  }
});

test('63 exactly: the rest bounces back', () => {
  let r = throwDie(at([60, 0]), 3);
  assert.equal(r.game.winner, 0);
  assert.deepEqual(types(r.events), ['move', 'win']);
  r = throwDie(at([60, 0]), 5); // 61 62 63 62 61
  assert.deepEqual(r.events[0].path, [61, 62, 63, 62, 61]);
  assert.ok(types(r.events).includes('bounce'));
  assert.equal(r.game.players[0].pos, 61);
  assert.equal(r.game.winner, -1);
  // bouncing back onto a goose goes on backwards by the same amount
  r = throwDie(at([61, 0]), 6); // 62 63 62 61 60 59 (goose) -> 58 ... 53
  assert.deepEqual(r.events.find((e) => e.type === 'goose').path, [58, 57, 56, 55, 54, 53]);
  assert.equal(r.game.players[0].pos, 53);
  // a goose forwards that overshoots 63 bounces too: 53 + 6 = 59 (goose) -> 60 61 62 63 62 61
  r = throwDie(at([53, 0]), 6);
  assert.equal(r.game.players[0].pos, 61);
  assert.equal(walk(62, 3).to, 61);
});

test('a whole game with a seeded die always ends with one winner', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rand = mulberry32(seed);
    let game = newGame(2 + (seed % 3));
    let throws = 0;
    while (game.winner < 0) {
      assert.equal(game.players[game.turn].wait, 0);
      game = throwDie(game, rollDie(rand)).game;
      assert.ok(++throws < 2000, `seed ${seed} never ends`);
      for (const p of game.players) assert.ok(p.pos >= 0 && p.pos <= END);
    }
    assert.equal(game.players[game.winner].pos, END);
  }
});

// phones upright and sideways, a tablet, a desktop: the space the board gets on each
const SPACES = [[308, 330], [300, 300], [260, 300], [378, 520], [540, 370], [330, 420], [700, 700], [1000, 700], [600, 240]];

test('the board: 64 stepping stones on one path, a step apart, with clear space round every stone', () => {
  for (const [w, h] of SPACES) {
    const lay = boardLayout(w, h);
    const tag = `${w}x${h}`;
    assert.equal(lay.stones.length, STONES, tag);
    assert.ok(lay.w <= w && lay.h <= h, `${tag}: the board ${lay.w}x${lay.h} is bigger than its space`);
    assert.ok(lay.step <= 72 + 1e-9, `${tag}: step ${lay.step}`);
    assert.ok(lay.size <= lay.step * STONE + 1e-9, tag);
    const r = (lay.size * 1.3) / 2; // the biggest stone (63)
    for (const [k, [x, y]] of lay.stones.entries()) {
      assert.ok(x - r >= 0 && y - r >= 0 && x + r <= lay.w && y + r <= lay.h, `${tag}: stone ${k} sticks out of the board`);
      if (k) {
        const [px, py] = lay.stones[k - 1];
        const d = Math.hypot(x - px, y - py);
        // the step along the path; a bend makes the straight line a little shorter
        assert.ok(d <= lay.step + 1e-6 && d >= lay.step * 0.9, `${tag}: stone ${k} is ${d.toFixed(1)} from ${k - 1} (step ${lay.step.toFixed(1)})`);
      }
      for (let j = 0; j < k - 1; j++) {
        const d = Math.hypot(x - lay.stones[j][0], y - lay.stones[j][1]);
        assert.ok(d >= lay.step * 0.98, `${tag}: stones ${j} and ${k} are only ${d.toFixed(1)} apart (step ${lay.step.toFixed(1)})`);
      }
    }
    // there is grass between the stones: a gap of at least a quarter of a stone, never under 6 px
    assert.ok(lay.step - lay.size >= Math.min(6, lay.size * 0.25), `${tag}: no gap between the stones`);
    // the start in the bottom-left corner, 63 in the middle, beside the pond
    assert.ok(lay.stones[0][0] < lay.w / 3 && lay.stones[0][1] > (lay.h * 2) / 3, `${tag}: the start is not bottom-left`);
    const [ex, ey] = lay.stones[STONES - 1];
    assert.ok(Math.abs(ex - lay.w / 2) < lay.w / 3 && Math.abs(ey - lay.h / 2) < lay.h / 3, `${tag}: 63 is not in the middle`);
    assert.ok(lay.pond, `${tag}: no pond`);
    for (const [k, [x, y]] of lay.stones.entries()) {
      const p = lay.pond;
      assert.ok(!(x > p.l && x < p.r && y > p.t && y < p.b), `${tag}: stone ${k} stands in the pond`);
    }
  }
});

test('the board: every stone has a round tap area of 44 px or more that never covers the middle of another stone', () => {
  for (const [w, h] of SPACES) {
    const lay = boardLayout(w, h);
    const radius = Math.max(44, lay.step) / 2; // the buttons are circles (ganzen.css)
    for (const [k, [x, y]] of lay.stones.entries()) {
      for (const [j, [ox, oy]] of lay.stones.entries()) {
        if (j !== k) assert.ok(Math.hypot(x - ox, y - oy) >= radius, `${w}x${h}: the button of ${j} covers the middle of ${k}`);
      }
    }
  }
});

test('a tap goes to the nearest stone: the centre of every stone is that stone, never its neighbour', () => {
  for (const [w, h] of SPACES) {
    const lay = boardLayout(w, h);
    const tag = `${w}x${h}`;
    assert.ok(tapRadius(lay) >= 22, `${tag}: tap circle under 44 px`);
    for (const [k, [x, y]] of lay.stones.entries()) {
      assert.equal(stoneAt(lay, x, y), k, `${tag}: a tap on the centre of ${k}`);
      // a tap a little off the stone, away from the board's middle, is still that stone
      const dx = x < lay.w / 2 ? -1 : 1;
      assert.equal(stoneAt(lay, x + dx * lay.size * 0.45, y), k, `${tag}: a tap just beside ${k}`);
    }
    assert.equal(stoneAt(lay, lay.pond.cx, lay.pond.cy), -1, `${tag}: a tap in the pond is no stone`);
  }
});

test('the board: the same size gives the same layout, and the step is never above the maximum', () => {
  assert.equal(boardLayout(308, 330), boardLayout(308, 330));
  for (const [w, h] of [[2000, 1400], [1600, 1600], [900, 900], [5000, 3000]]) {
    for (const max of [72, 60, 40]) assert.ok(boardLayout(w, h, max).step <= max, `${w}x${h} max ${max}: ${boardLayout(w, h, max).step}`);
  }
});

test('the landscapes: drawn in code for the meadow, winter and the sea, the same every time', () => {
  const lay = boardLayout(378, 520);
  for (const theme of ['classic', 'winter', 'sea']) {
    const svg = sceneSvg(theme, lay);
    assert.match(svg, /^<svg [^>]*class="ganzen-scene"/);
    assert.ok(!/href|url\(http|<image|<script/i.test(svg), `${theme}: only drawn shapes`);
    const plain = (x) => x.replace(/gz-[a-z]+-\d+/g, 'gz');
    assert.equal(plain(svg), plain(sceneSvg(theme, lay)), `${theme}: not the same twice`);
    assert.ok(!svg.includes('NaN'), `${theme}: NaN in the picture`);
  }
  assert.notEqual(sceneSvg('classic', lay), sceneSvg('winter', lay));
});

test('count yourself: the next square to tap follows the path, also back after 63', () => {
  assert.equal(nextTap([1, 2, 3], 0), 1);
  assert.equal(nextTap([1, 2, 3], 2), 3);
  assert.equal(nextTap([1, 2, 3], 3), -1);
  assert.equal(nextTap([62, 63, 62], 2), 62);
});

test('free: the classic board with 2 players; 3-4 players and the themed boards are in the full version', () => {
  assert.equal(meta.isLocked({ board: 'classic', players: ['kid', 'cpu'] }, false), false);
  assert.equal(meta.isLocked({ board: 'classic', players: ['kid', 'kid'] }, false), false);
  assert.equal(meta.isLocked({ board: 'classic', players: ['kid', 'cpu', 'kid'] }, false), true);
  assert.equal(meta.isLocked({ board: 'winter', players: ['kid', 'cpu'] }, false), true);
  assert.equal(meta.isLocked({ board: 'sea', players: ['kid', 'kid'] }, false), true);
  assert.equal(meta.isLocked({ board: 'sea', players: ['kid', 'cpu', 'cpu', 'kid'] }, true), false);
});

test('a saved setup is made safe before use', async () => {
  const { cleanSetup } = await import('../web/games/ganzen/ganzen.js');
  assert.deepEqual(cleanSetup(null), { board: 'classic', players: ['kid', 'cpu'], count: true });
  assert.deepEqual(cleanSetup({ board: 'constructor', players: ['kid'], count: 'yes' }), { board: 'classic', players: ['kid', 'cpu'], count: true });
  assert.deepEqual(cleanSetup({ board: 'winter', players: ['cpu', 'kid', 'kid', 'cpu'], count: false }), { board: 'winter', players: ['cpu', 'kid', 'kid', 'cpu'], count: false });
  assert.deepEqual(cleanSetup({ players: ['kid', 'kid', 'kid', 'kid', 'kid'] }).players, ['kid', 'cpu']);
  assert.deepEqual(cleanSetup({ players: ['kid', 'dog'] }).players, ['kid', 'cpu']);
});

test('messages about the one child playing say "je"/"you", never "Jij slaat"/"You misses"', async () => {
  await import('../web/games/ganzen/strings.js');
  const { allStrings } = await import('../web/js/i18n.js');
  const { YOU_KEYS } = await import('../web/games/ganzen/ganzen.js');
  const tables = allStrings();
  const freed = ['ganzen.ev.freed.you', 'ganzen.ev.freed.byYou'];
  for (const lang of ['nl', 'en']) {
    for (const key of [...YOU_KEYS.map((k) => `${k}.you`), ...freed]) {
      const text = tables[lang][key];
      assert.equal(typeof text, 'string', `${key} is missing in ${lang}`);
      assert.ok(!/\bJij\b|: [A-Z]/.test(text), `${lang} ${key}: ${text}`);
      if (lang === 'en') assert.ok(!/\bYou (is|misses|waits|gets|rests|throws)\b/.test(text), `${key}: ${text}`);
    }
    // the third-person messages start with the goose's name, never "X: name" with a capital after a colon
    for (const key of YOU_KEYS) assert.ok(!/: \{name\}/.test(tables[lang][key]), `${lang} ${key}: ${tables[lang][key]}`);
    assert.ok(!tables[lang]['ganzen.ev.freed.you'].includes('{name}'));
  }
  // the hint while counting names the count, not a square number
  assert.match(tables.nl['ganzen.tapHere'], /gloeit: tel \{n\}/);
  assert.match(tables.en['ganzen.tapHere'], /glowing square: count \{n\}/);
});
