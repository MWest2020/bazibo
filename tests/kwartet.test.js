import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PER_SET, newGame, ask, askable, opponents, canAsk, nextPlayer, winners, setOf, cardsOf, mulberry32 } from '../web/games/kwartet/rules.js';
import { emptyMemory, observe, laidDown, choose } from '../web/games/kwartet/ai.js';
import { SETS, SET_IDS, pictureOf, pictureSvg } from '../web/games/kwartet/art.js';
import { pickSets } from '../web/games/kwartet/kwartet.js';
import { meta } from '../web/games/kwartet/meta.js';

/** A game with these hands (and no kwartetten yet), `turn` to ask. */
function table(hands, turn = 0, sets = null) {
  const all = sets || [...new Set(hands.flat().map(setOf))];
  return { sets: all, players: hands.length, hands: hands.map((h) => h.slice().sort()), quartets: hands.map(() => []), turn, over: null };
}

test('eight sets of four, every card its own picture and a drawing; the free four first', () => {
  assert.equal(SETS.length, 8);
  const pics = new Set();
  for (const s of SETS) {
    assert.equal(s.cards.length, PER_SET);
    for (const c of s.cards) {
      assert.ok(!pics.has(c), `${c} is in two sets`);
      pics.add(c);
      assert.match(pictureSvg(c), /^<svg[\s\S]*<\/svg>$/, `${c} has no drawing`);
    }
  }
  assert.deepEqual(SETS.filter((s) => s.free).map((s) => s.id), ['fruit', 'pets', 'vehicles', 'garden']);
  assert.equal(pictureOf('zoo:2'), 'giraffe');
  assert.deepEqual(cardsOf('fruit'), ['fruit:0', 'fruit:1', 'fruit:2', 'fruit:3']);
  assert.equal(setOf('weather:3'), 'weather');
});

test('which sets a game uses: the free four on the website, any of the eight with the full version', () => {
  assert.deepEqual(pickSets(4, false), ['fruit', 'pets', 'vehicles', 'garden']);
  const seen = new Set();
  for (let seed = 1; seed < 40; seed++) {
    const s = pickSets(6, true, mulberry32(seed));
    assert.equal(new Set(s).size, 6);
    s.forEach((id) => seen.add(id));
  }
  assert.equal(seen.size, 8);
  assert.deepEqual(pickSets(8, true, mulberry32(1)), SET_IDS);
});

test('the deal: every card once, as even as can be, the starter gets the first card', () => {
  for (let players = 2; players <= 4; players++) {
    for (const n of [4, 6, 8]) {
      const g = newGame({ sets: SET_IDS.slice(0, n), players, starter: 1, rand: mulberry32(players * 10 + n) });
      const all = [...g.hands.flat(), ...g.quartets.flat().flatMap(cardsOf)];
      assert.equal(all.length, n * PER_SET);
      assert.equal(new Set(all).size, n * PER_SET);
      const sizes = g.hands.map((h, p) => h.length + g.quartets[p].length * PER_SET);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${sizes}`);
      assert.ok(sizes[1] >= sizes[0]);
    }
  }
  assert.throws(() => newGame({ sets: ['fruit'], players: 2 }));
  assert.throws(() => newGame({ sets: SET_IDS.slice(0, 4), players: 5 }));
});

test('a set dealt whole is laid down at once', () => {
  // find a seed where someone is dealt a whole set
  for (let seed = 1; seed < 500; seed++) {
    const g = newGame({ sets: SET_IDS.slice(0, 4), players: 2, rand: mulberry32(seed) });
    if (g.quartets.flat().length) {
      for (const h of g.hands) for (const s of g.sets) assert.ok(h.filter((c) => setOf(c) === s).length < PER_SET);
      return;
    }
  }
  assert.fail('no deal with a whole set in 500 seeds');
});

test('you may ask only for a missing card of a set you hold, and only someone with cards', () => {
  const g = table([['fruit:0', 'pets:1'], ['fruit:1', 'fruit:2'], ['pets:0', 'fruit:3', 'pets:2', 'pets:3']]);
  assert.deepEqual(askable(g, 0), ['fruit:1', 'fruit:2', 'fruit:3', 'pets:0', 'pets:2', 'pets:3']);
  assert.deepEqual(opponents(g, 0), [1, 2]);
  assert.equal(canAsk(g, 1, 'fruit:0'), false); // your own card
  assert.equal(canAsk(g, 0, 'fruit:1'), false); // yourself
  assert.equal(canAsk(g, 1, 'fruit:1'), true);
  const noSet = table([['fruit:0'], ['pets:0', 'fruit:1', 'fruit:2', 'fruit:3']], 0, ['fruit', 'pets']);
  assert.equal(canAsk(noSet, 1, 'pets:1'), false); // a set you do not hold
  assert.equal(ask(noSet, 1, 'pets:1'), null);
});

test('got it: the card moves and you ask again; not: the turn passes round the table', () => {
  const g = table([['fruit:0', 'pets:1'], ['fruit:1', 'fruit:2'], ['pets:0', 'fruit:3', 'pets:2', 'pets:3']]);
  let r = ask(g, 1, 'fruit:1');
  assert.equal(r.got, true);
  assert.equal(r.laid, null);
  assert.deepEqual(r.game.hands[0], ['fruit:0', 'fruit:1', 'pets:1']);
  assert.deepEqual(r.game.hands[1], ['fruit:2']);
  assert.equal(r.game.turn, 0);
  r = ask(r.game, 1, 'fruit:3');
  assert.equal(r.got, false);
  assert.equal(r.game.turn, 1);
  assert.deepEqual(g.hands[0], ['fruit:0', 'pets:1']); // the old state is untouched
  // a "no" from player 2 passes the turn to the next player round the table (player 1, who still
  // has cards), not to the player who was asked
  const far = ask(g, 2, 'fruit:2');
  assert.equal(far.got, false);
  assert.equal(far.game.turn, 1);
  assert.deepEqual(opponents(g, 0), [1, 2]);
});

test('four of a set are laid down as a kwartet; a player without cards is skipped', () => {
  const g = table([['fruit:0', 'fruit:1', 'fruit:2'], ['fruit:3', 'pets:0'], ['pets:1', 'pets:2', 'pets:3']]);
  const r = ask(g, 1, 'fruit:3');
  assert.equal(r.laid, 'fruit');
  assert.deepEqual(r.game.quartets[0], ['fruit']);
  assert.deepEqual(r.game.hands[0], []);
  // no cards left to ask with: the turn goes on to the next player who has cards
  assert.equal(r.game.turn, 1);
  const skip = table([['pets:0'], [], ['pets:1', 'pets:2'], ['pets:3']], 0, ['fruit', 'pets']);
  skip.quartets = [[], ['fruit'], [], []];
  assert.equal(nextPlayer(skip, 0), 2);
  const r2 = ask(skip, 2, 'pets:3'); // no: player 1 has no cards, so player 2 goes next
  assert.equal(r2.got, false);
  assert.equal(r2.game.turn, 2);
  assert.deepEqual(opponents(skip, 0), [2, 3]);
});

test('the last kwartet ends the game; most kwartetten wins, the same number shares', () => {
  const g = table([['pets:0', 'pets:1', 'pets:2'], ['pets:3']], 0, ['fruit', 'pets', 'zoo']);
  g.quartets = [['fruit'], ['zoo']];
  const r = ask(g, 1, 'pets:3');
  assert.ok(r.game.over);
  assert.deepEqual(r.game.over.winners, [0]);
  assert.deepEqual(winners({ quartets: [['a'], ['b'], []] }), [0, 1]);
  assert.equal(canAsk(r.game, 1, 'pets:3'), false);
});

test('the computer only uses what the table saw, and uses it', () => {
  const g = table([['fruit:0'], ['fruit:1', 'pets:0'], ['fruit:2', 'fruit:3', 'pets:1', 'pets:2', 'pets:3']], 0, ['fruit', 'pets']);
  // it saw player 2 get fruit:2: it asks player 2 for it
  let m = observe(emptyMemory(), { asker: 2, target: 1, card: 'fruit:2', got: true }, () => 0);
  assert.deepEqual(choose(g, 0, m, () => 0), { target: 2, card: 'fruit:2' });
  // it remembers player 1 saying no to fruit:3: it does not ask player 1 for it again
  m = { holds: {}, lacks: { 1: ['fruit:3'] } };
  assert.deepEqual(observe(emptyMemory(), { asker: 2, target: 1, card: 'fruit:3', got: false }, () => 0).lacks, { 1: ['fruit:3'], 2: ['fruit:3'] });
  for (let k = 0; k < 20; k++) {
    const rand = mulberry32(k);
    const c = choose(g, 0, m, rand);
    if (c.card === 'fruit:3') assert.equal(c.target, 2);
  }
  // a laid-down set is forgotten; nothing to ask: null
  assert.deepEqual(laidDown(observe(emptyMemory(), { asker: 2, target: 1, card: 'fruit:2', got: true }, () => 0), 'fruit').holds, {});
  assert.equal(choose(table([[], ['fruit:0']], 0, ['fruit']), 0, emptyMemory()), null);
  // a fact sticks only sometimes
  assert.deepEqual(observe(emptyMemory(), { asker: 2, target: 1, card: 'fruit:2', got: true }, () => 0.99).holds, {});
});

/** A whole game: player 0 is a child who remembers everything it saw, the others the computers. */
function playOut(seed, players, sets, childSmart) {
  const rand = mulberry32(seed);
  let g = newGame({ sets: SET_IDS.slice(0, sets), players, starter: seed % players, rand });
  let mem = Array.from({ length: players }, () => emptyMemory());
  let asks = 0;
  while (!g.over && asks++ < 3000) {
    const me = g.turn;
    let c;
    if (me === 0) c = childSmart ? choose(g, 0, mem[0], rand, 1) : choose(g, 0, emptyMemory(), rand);
    else c = choose(g, me, mem[me], rand);
    assert.ok(c && canAsk(g, c.target, c.card), `player ${me} made an illegal ask`);
    const r = ask(g, c.target, c.card);
    mem = mem.map((m, p) => observe(m, { asker: me, ...c, got: r.got }, rand, p === 0 && childSmart ? 1 : undefined));
    if (r.laid) mem = mem.map((m) => laidDown(m, r.laid));
    g = r.game;
  }
  assert.ok(g.over, 'the game never ended');
  return g.over.winners;
}

test('the computers only ask what may be asked, and every game ends', () => {
  for (let seed = 1; seed <= 200; seed++) playOut(seed, 2 + (seed % 3), [4, 6, 8][seed % 3], seed % 2 === 0);
});

test('the computers are gentle: a child who pays attention often wins against two of them', () => {
  let smart = 0;
  let guess = 0;
  for (let seed = 1; seed <= 200; seed++) {
    if (playOut(seed, 3, 4, true).includes(0)) smart++;
    if (playOut(seed + 1000, 3, 4, false).includes(0)) guess++;
  }
  // three players: a fair share is a third
  assert.ok(smart >= 95, `an attentive child won (or shared) only ${smart} of 200`);
  assert.ok(guess >= 40, `a guessing child won (or shared) only ${guess} of 200`);
});

test('the free part: 4 sets and up to 3 players; the full version opens 6 and 8 sets and a 4th player', () => {
  assert.equal(meta.group, 'board');
  assert.equal(meta.isLocked({ sets: 4, players: ['kid', 'cpu', 'cpu'] }, false), false);
  assert.equal(meta.isLocked({ sets: 4, players: ['kid', 'kid'] }, false), false);
  assert.equal(meta.isLocked({ sets: 6, players: ['kid', 'cpu'] }, false), true);
  assert.equal(meta.isLocked({ sets: 4, players: ['kid', 'cpu', 'cpu', 'cpu'] }, false), true);
  assert.equal(meta.isLocked({ sets: 8, players: ['kid', 'cpu', 'kid', 'cpu'] }, true), false);
});
