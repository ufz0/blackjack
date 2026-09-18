import test from 'node:test';
import assert from 'node:assert/strict';
import { handValue, createGame, deal, hit, stand } from '../game/engine.js';

test('hand value resolves aces to 11 or 1', () => {
  assert.equal(handValue([{ rank: 'A' }, { rank: 'A' }]).total, 12);
  assert.equal(handValue([{ rank: 'A' }, { rank: 'K' }]).total, 21);
  assert.equal(handValue([{ rank: 'A' }, { rank: '9' }, { rank: '9' }, { rank: '5' }]).total, 24);
  assert.equal(handValue([{ rank: '10' }, { rank: '5' }, { rank: '5' }]).total, 20);
});

test('deal deducts the bet and deals two cards each', () => {
  const game = createGame();
  deal(game, 100);
  assert.equal(game.player.cards.length, 2);
  assert.equal(game.dealer.cards.length, 2);
  assert.ok(['player', 'settled'].includes(game.status));
  assert.ok(game.bankroll >= 900);
});

test('deal validates the bet', () => {
  const game = createGame();
  assert.throws(() => deal(game, 0), /positive whole number/);
  assert.throws(() => deal(game, -5), /positive whole number/);
  assert.throws(() => deal(game, 1001), /exceeds bankroll/);
  assert.throws(() => deal(game, 'nope'), /positive whole number/);
});

test('a round in progress cannot be re-dealt', () => {
  const game = createGame();
  deal(game, 100);
  if (game.status === 'player') {
    assert.throws(() => deal(game, 50), /already in progress/);
  }
});

test('bust settles as a loss', () => {
  const game = createGame();
  game.status = 'player';
  game.player.bet = 100;
  game.player.cards = [{ rank: '8' }, { rank: '9' }];
  game.dealer.cards = [{ rank: '7' }, { rank: '7' }];
  game.shoe.draw = () => ({ rank: 'K', suit: 'S' });

  hit(game);

  assert.equal(game.status, 'settled');
  assert.equal(game.lastResult.outcome, 'bust');
  assert.equal(game.lastResult.payout, 0);
});

test('dealer busts and player wins double', () => {
  const game = createGame();
  game.status = 'player';
  game.bankroll = 900;
  game.player.bet = 100;
  game.player.cards = [{ rank: 'Q' }, { rank: '7' }];
  game.dealer.cards = [{ rank: '9' }, { rank: '2' }];
  const queue = [{ rank: '5' }, { rank: 'K' }];
  game.shoe.draw = () => queue.shift();

  stand(game);

  assert.equal(game.status, 'settled');
  assert.equal(game.lastResult.outcome, 'win');
  assert.equal(game.lastResult.payout, 200);
  assert.equal(game.bankroll, 1100);
});

test('dealer stands on all 17', () => {
  const game = createGame();
  game.status = 'player';
  game.player.bet = 100;
  game.player.cards = [{ rank: '8' }, { rank: '8' }];
  game.dealer.cards = [{ rank: '10' }, { rank: '7' }];
  game.shoe.draw = () => {
    throw new Error('Dealer must not draw at 17');
  };

  stand(game);

  assert.equal(game.lastResult.outcome, 'lose');
  assert.equal(game.dealer.cards.length, 2);
});

test('push returns the bet', () => {
  const game = createGame();
  game.status = 'player';
  game.player.bet = 100;
  game.player.cards = [{ rank: '9' }, { rank: '8' }];
  game.dealer.cards = [{ rank: '8' }, { rank: '9' }];
  game.shoe.draw = () => {
    throw new Error('Dealer must not draw at 17');
  };

  stand(game);

  assert.equal(game.lastResult.outcome, 'push');
  assert.equal(game.lastResult.payout, 100);
});

test('reshuffle happens when the shoe runs low', () => {
  const game = createGame();
  game.shoe.cards = [
    { rank: 'A', suit: 'S' },
    { rank: '2', suit: 'S' },
    { rank: '3', suit: 'S' },
    { rank: '4', suit: 'S' },
  ];
  game.shoe.draw();
  assert.equal(game.shoe.cards.length, game.shoe.capacity - 1);
});
