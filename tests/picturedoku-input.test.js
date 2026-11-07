// The taps of Picturedoku (web/games/picturedoku/input.js), played through like a child would.
// Mark, 2026-11-08: "als je wil switchen van pictogram wordt het vakje waar je op staat
// overgenomen" — switching to another picture must never change a square by itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '../web/games/picturedoku/rules.js';
import { tapCell, tapPicture, tapEraser } from '../web/games/picturedoku/input.js';

const PUZZLES = JSON.parse(readFileSync(new URL('../web/games/picturedoku/puzzles.json', import.meta.url), 'utf8'));
const first = (n) => PUZZLES.find((p) => p.n === n);

/** A little board in play that carries out the decisions, like the screen does. */
function game(p) {
  const s = { n: p.n, tier: p.tier, board: parse(p.givens), notes: new Array(p.n * p.n).fill(0), given: parse(p.givens).map(Boolean), selected: -1, brush: 0, pencil: false };
  const last = { notice: '' };
  const run = (r) => {
    for (const [i, v, m] of r.changes) {
      s.board[i] = v;
      s.notes[i] = m;
    }
    s.selected = r.selected;
    s.brush = r.brush;
    last.notice = r.notice;
    return r;
  };
  return {
    s,
    last,
    cell: (i) => run(tapCell(s, i)),
    pic: (v) => run(tapPicture(s, v)),
    eraser: () => run(tapEraser(s)),
    empties: () => s.board.map((v, i) => (!v && !s.given[i] ? i : -1)).filter((i) => i >= 0),
  };
}

for (const n of [4, 6, 9]) {
  test(`Mark's sequence on ${n}×${n}: place a picture, tap another picture, the square stays (square first)`, () => {
    const g = game(first(n));
    const x = g.empties()[0];
    g.cell(x);
    g.pic(1);
    assert.equal(g.s.board[x], 1);
    assert.equal(g.s.selected, -1, 'after a placement nothing stays chosen');
    g.pic(2);
    assert.equal(g.s.board[x], 1, 'switching pictures changed the square');
    if (n === 4) {
      assert.equal(g.s.brush, 0, 'no picture-first on 4×4');
      assert.equal(g.last.notice, 'pickSquare');
    } else assert.equal(g.s.brush, 2, 'the tap only switched the armed picture');
  });
}

for (const n of [6, 9]) {
  test(`Mark's sequence on ${n}×${n}: paint a square picture-first, tap another picture, the square stays`, () => {
    const g = game(first(n));
    const [x, y] = g.empties();
    g.pic(1); // arm
    g.cell(x); // place
    assert.equal(g.s.board[x], 1);
    assert.equal(g.s.selected, -1);
    g.pic(2); // switch
    assert.equal(g.s.board[x], 1, 'switching pictures repainted the last square');
    assert.equal(g.s.brush, 2);
    g.cell(y);
    assert.equal(g.s.board[y], 2, 'the new armed picture goes into the next empty square');
    // a filled square while armed: chosen, not changed; the next picture tap replaces it on purpose
    g.cell(x);
    assert.equal(g.s.board[x], 1);
    assert.equal(g.s.selected, x);
    g.pic(3);
    assert.equal(g.s.board[x], 3);
    assert.equal(g.s.selected, -1);
    // tapping the armed picture again puts it down
    g.pic(2);
    assert.equal(g.s.brush, 0);
  });
}

test('a fixed picture never changes: chosen square or armed picture', () => {
  const p = first(6);
  const g = game(p);
  const fixed = g.s.given.indexOf(true);
  const was = g.s.board[fixed];
  g.cell(fixed);
  g.pic((was % 6) + 1);
  assert.equal(g.s.board[fixed], was);
  assert.equal(g.last.notice, 'fixed');
  g.pic(1); // arm
  g.cell(fixed); // chooses it, places nothing
  assert.equal(g.s.board[fixed], was);
  g.eraser(); // the eraser on a fixed picture does nothing either
  assert.equal(g.s.board[fixed], was);
});

test('the same picture on a chosen filled square takes it out', () => {
  const g = game(first(4));
  const x = g.empties()[0];
  g.cell(x);
  g.pic(3);
  g.cell(x);
  g.pic(3);
  assert.equal(g.s.board[x], 0);
});

test('pencil: notes in a chosen square, which stays chosen; armed + pencil notes empty squares only', () => {
  const g = game(first(9));
  const [x, y] = g.empties();
  g.s.pencil = true;
  g.cell(x);
  g.pic(1);
  g.pic(2);
  assert.equal(g.s.notes[x], (1 << 1) | (1 << 2));
  assert.equal(g.s.selected, x);
  g.cell(x); // put the square down again
  g.pic(4); // nothing chosen: arm 4
  g.cell(y);
  assert.equal(g.s.notes[y], 1 << 4);
  assert.equal(g.s.board[y], 0);
  g.s.pencil = false;
  g.cell(y); // armed 4 into the empty square: placed, its notes gone
  assert.equal(g.s.board[y], 4);
  assert.equal(g.s.notes[y], 0);
});

test('eraser: on a chosen square, armed on 6×6 and up, and on 4×4 only with a chosen square', () => {
  const g4 = game(first(4));
  const x = g4.empties()[0];
  g4.cell(x);
  g4.pic(1);
  g4.eraser();
  assert.equal(g4.last.notice, 'pickSquare');
  assert.equal(g4.s.board[x], 1);
  g4.cell(x);
  g4.eraser();
  assert.equal(g4.s.board[x], 0);
  assert.equal(g4.s.selected, -1);
  const g9 = game(first(9));
  const [a, b] = g9.empties();
  g9.pic(5);
  g9.cell(a);
  g9.pic(5); // put down
  g9.eraser(); // arm the eraser
  assert.equal(g9.s.brush, -1);
  g9.cell(a);
  assert.equal(g9.s.board[a], 0);
  g9.cell(b); // an empty square: nothing happens
  assert.equal(g9.s.board[b], 0);
});
