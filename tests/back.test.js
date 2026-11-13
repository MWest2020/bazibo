import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backAction } from '../web/js/back.js';

test('back: leaves the app only from the home screen', () => {
  assert.equal(backAction({ screen: 'home' }), 'exit');
  assert.equal(backAction({ screen: 'settings' }), 'home');
  assert.equal(backAction({ screen: 'transfer' }), 'settings'); // Voortgang overzetten -> settings
  assert.equal(backAction({ screen: 'transfer', overlay: 'card' }), 'transfer-card');
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
  // Vier op een rij: the board goes to its menu (the game is kept), the menu goes home
  assert.equal(backAction({ screen: 'vier' }), 'vier-menu');
  assert.equal(backAction({ screen: 'vier-menu' }), 'home');
  assert.equal(backAction({ screen: 'vier', overlay: 'card' }), 'close');
  assert.equal(backAction({ screen: 'dammen' }), 'dammen-menu');
  assert.equal(backAction({ screen: 'dammen-menu' }), 'home');
  assert.equal(backAction({ screen: 'dammen', overlay: 'card' }), 'close');
  assert.equal(backAction({ screen: 'dammen', overlay: 'busy' }), 'ignore');
  assert.equal(backAction({ screen: 'ganzen' }), 'ganzen-menu');
  assert.equal(backAction({ screen: 'ganzen-menu' }), 'home');
  assert.equal(backAction({ screen: 'ganzen', overlay: 'card' }), 'close');
});

test('back: a Slangetje round goes to its menu (kept), a card on the board too, the menu goes home', () => {
  assert.equal(backAction({ screen: 'slang' }), 'slang-menu');
  assert.equal(backAction({ screen: 'slang', overlay: 'card' }), 'slang-menu');
  assert.equal(backAction({ screen: 'slang', overlay: 'busy' }), 'ignore');
  assert.equal(backAction({ screen: 'slang-menu' }), 'home');
  assert.equal(backAction({ screen: 'slang-menu', overlay: 'card' }), 'close');
});

test('back: a Klok kijken round goes to its menu (kept), a card on it too, the menu goes home', () => {
  assert.equal(backAction({ screen: 'klok' }), 'klok-menu');
  assert.equal(backAction({ screen: 'klok', overlay: 'card' }), 'klok-menu');
  assert.equal(backAction({ screen: 'klok', overlay: 'busy' }), 'ignore');
  assert.equal(backAction({ screen: 'klok-menu' }), 'klok-menu-back'); // to the kinds of round, then home
  assert.equal(backAction({ screen: 'klok-menu', overlay: 'card' }), 'close');
  assert.equal(backAction({ screen: 'letters' }), 'letters-menu');
  assert.equal(backAction({ screen: 'letters', overlay: 'card' }), 'letters-menu');
  assert.equal(backAction({ screen: 'letters-menu' }), 'letters-menu-back');
  assert.equal(backAction({ screen: 'letters-menu', overlay: 'card' }), 'close');
});
