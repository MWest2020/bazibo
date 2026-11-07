import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allFreeLevelsDone, FREE_LEVELS } from '../web/js/unlock.js';
import { makeLimiter } from '../web/js/audio.js';

const levels = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));

// Regression: winning level 10 said "alle gratis levels gehaald" even with levels skipped.
test('all free levels done only when every free level has a star', () => {
  const stars = {};
  for (let id = 1; id <= FREE_LEVELS; id++) stars[id] = 1;
  assert.equal(allFreeLevelsDone(levels, stars), true);
  delete stars[4];
  assert.equal(allFreeLevelsDone(levels, stars), false);
  assert.equal(allFreeLevelsDone(levels, { 10: 3 }), false);
  assert.equal(allFreeLevelsDone([], {}), false);
});

test('locked levels do not count towards "all free levels done"', () => {
  const stars = {};
  for (let id = 1; id <= FREE_LEVELS; id++) stars[id] = 2;
  assert.equal(allFreeLevelsDone(levels, stars), true); // 11-30 have no stars and are ignored
});

// Regression: losing set off ~44 pops in about a second on top of the losing tune.
test('the pop limiter lets through at most one sound per gap', () => {
  const gate = makeLimiter();
  let heard = 0;
  // 44 tumbling bubbles popping at random moments within one second, gap 0.16 s
  const times = Array.from({ length: 44 }, (_, i) => (i * 0.023) % 1).sort((a, b) => a - b);
  for (const t of times) if (gate(t, 0.16)) heard++;
  assert.ok(heard <= 7, `${heard} pops heard`);
  assert.ok(heard >= 5, `${heard} pops heard`);
});

test('the pop limiter does not drop chain pops 55 ms apart', () => {
  const gate = makeLimiter();
  for (let i = 0; i < 9; i++) assert.equal(gate(i * 0.055, 0.03), true);
});
