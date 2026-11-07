import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeQuestion, createGate, MAX_TRIES } from '../web/js/parental-gate.js';

const seq = (...xs) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

test('questions are written in words and have two-digit or three-digit answers', () => {
  for (let i = 0; i < 200; i++) {
    const q = makeQuestion();
    assert.match(q.text, /^Hoeveel is [a-z]+ keer [a-z]+\?$/);
    assert.doesNotMatch(q.text, /\d/);
    assert.equal(q.answer, q.a * q.b);
    assert.ok(q.answer >= 18 && q.answer <= 108, `answer ${q.answer}`);
  }
});

test('the questions vary', () => {
  const seen = new Set(Array.from({ length: 100 }, () => makeQuestion().text));
  assert.ok(seen.size > 15, `only ${seen.size} different questions`);
});

test('the right answer passes, also with spaces around it', () => {
  const gate = createGate({ rand: seq(0.15, 0.6) }); // 7 keer 7
  assert.equal(gate.question, 'Hoeveel is zeven keer zeven?');
  assert.equal(gate.check(' 49 '), 'pass');
});

test('wrong, empty or non-numeric answers fail and bring a new question', () => {
  const gate = createGate({ rand: seq(0, 0, 0.99, 0.99) }); // 6x3, then 12x9
  assert.equal(gate.check('17'), 'retry');
  assert.equal(gate.question, 'Hoeveel is twaalf keer negen?');
  assert.equal(gate.check(''), 'retry');
  assert.equal(gate.triesLeft, MAX_TRIES - 2);
});

test('answers that only look like the number do not pass', () => {
  for (const input of ['18.0', '018x', '1 8', '+18', '18e0', 'achttien']) {
    const gate = createGate({ rand: seq(0, 0) }); // 6x3 = 18
    assert.equal(gate.check(input), 'retry', input);
  }
});

test('after three wrong answers the gate stays closed, even for the right answer', () => {
  const gate = createGate({ rand: seq(0, 0) }); // always 6x3 = 18
  assert.equal(gate.check('1'), 'retry');
  assert.equal(gate.check('2'), 'retry');
  assert.equal(gate.check('3'), 'closed');
  assert.equal(gate.check('18'), 'closed');
});

test('tapping digits at random almost never gets through', () => {
  let passed = 0;
  for (let i = 0; i < 2000; i++) {
    const gate = createGate();
    let r = 'retry';
    while (r === 'retry') r = gate.check(String(Math.floor(Math.random() * 10)));
    if (r === 'pass') passed++;
  }
  assert.equal(passed, 0); // single digits can never be an answer
});
