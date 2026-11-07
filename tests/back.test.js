import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backAction } from '../web/js/back.js';

test('back: leaves the app only from the home screen', () => {
  assert.equal(backAction({ screen: 'home' }), 'exit');
  assert.equal(backAction({ screen: 'settings' }), 'home');
  assert.equal(backAction({ screen: 'levels' }), 'home');
});

test('back: playing a level pauses first, a card on the game screen leaves the level', () => {
  assert.equal(backAction({ screen: 'game' }), 'pause');
  assert.equal(backAction({ screen: 'game', overlay: 'card' }), 'levels');
});

test('back: other cards and the parental gate close; a busy store card is left alone', () => {
  assert.equal(backAction({ screen: 'home', overlay: 'card' }), 'close');
  assert.equal(backAction({ screen: 'settings', overlay: 'card' }), 'close');
  assert.equal(backAction({ screen: 'levels', overlay: 'card' }), 'close');
  assert.equal(backAction({ screen: 'game', overlay: 'busy' }), 'ignore');
  assert.equal(backAction({ screen: 'home', overlay: 'busy' }), 'ignore');
});

test('back: a Dogudoku puzzle goes to its list, the list to home, a card there closes', () => {
  assert.equal(backAction({ screen: 'dogudoku' }), 'dogudoku-levels');
  assert.equal(backAction({ screen: 'dogudoku-levels' }), 'home');
  assert.equal(backAction({ screen: 'dogudoku', overlay: 'card' }), 'close');
  assert.equal(backAction({ screen: 'dogudoku', overlay: 'busy' }), 'ignore');
});

test('back: a Picturedoku puzzle goes to its list, the list to home', () => {
  assert.equal(backAction({ screen: 'picturedoku' }), 'picturedoku-levels');
  assert.equal(backAction({ screen: 'picturedoku-levels' }), 'home');
  assert.equal(backAction({ screen: 'picturedoku', overlay: 'card' }), 'close');
});
