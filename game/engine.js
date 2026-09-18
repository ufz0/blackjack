export const INITIAL_BANKROLL = 1000;
export const DECKS = 6;

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];

export class Shoe {
  constructor(decks = DECKS, rng = Math.random) {
    this.capacity = decks * 52;
    this.rng = rng;
    this.cards = [];
    this.reshuffle();
  }

  get remaining() {
    return this.cards.length;
  }

  reshuffle() {
    const decks = this.capacity / 52;
    this.cards = [];
    for (let d = 0; d < decks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push({ rank, suit });
        }
      }
    }
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (this.cards.length <= Math.floor(this.capacity * 0.25)) {
      this.reshuffle();
    }
    return this.cards.pop();
  }
}

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 'A') {
      aces += 1;
      total += 11;
    } else if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return {
    total,
    soft: aces > 0,
    isBlackjack: cards.length === 2 && total === 21,
  };
}

export function apiError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function createGame() {
  return {
    bankroll: INITIAL_BANKROLL,
    shoe: new Shoe(),
    status: 'betting',
    player: { cards: [], bet: 0 },
    dealer: { cards: [] },
    lastResult: null,
  };
}

function settle(game, outcome, payout, reason) {
  game.bankroll += payout;
  game.lastResult = {
    outcome,
    payout,
    bet: game.player.bet,
    reason,
    bankroll: game.bankroll,
  };
  return game.lastResult;
}

export function deal(game, bet) {
  if (game.status === 'player' || game.status === 'dealer') {
    throw apiError(400, 'A round is already in progress');
  }
  bet = Number(bet);
  if (!Number.isInteger(bet) || bet <= 0) {
    throw apiError(400, 'Bet must be a positive whole number');
  }
  if (bet > game.bankroll) {
    throw apiError(400, 'Bet exceeds bankroll');
  }

  game.bankroll -= bet;
  game.player.bet = bet;
  game.player.cards = [game.shoe.draw(), game.shoe.draw()];
  game.dealer.cards = [game.shoe.draw(), game.shoe.draw()];
  game.status = 'player';

  const player = handValue(game.player.cards);
  const dealer = handValue(game.dealer.cards);
  if (player.isBlackjack || dealer.isBlackjack) {
    game.status = 'settled';
    if (player.isBlackjack && dealer.isBlackjack) {
      settle(game, 'push', bet, 'Both have blackjack — push');
    } else if (player.isBlackjack) {
      settle(game, 'blackjack', bet * 2.5, 'Blackjack pays three to two');
    } else {
      settle(game, 'lose', 0, 'Dealer has blackjack');
    }
  }
  return game;
}

export function hit(game) {
  if (game.status !== 'player') {
    throw apiError(400, 'No round in progress');
  }
  game.player.cards.push(game.shoe.draw());
  if (handValue(game.player.cards).total > 21) {
    game.status = 'settled';
    settle(game, 'bust', 0, 'Bust — over 21');
  }
  return game;
}

export function stand(game) {
  if (game.status !== 'player') {
    throw apiError(400, 'No round in progress');
  }
  game.status = 'dealer';
  while (handValue(game.dealer.cards).total < 17) {
    game.dealer.cards.push(game.shoe.draw());
  }

  const p = handValue(game.player.cards).total;
  const d = handValue(game.dealer.cards).total;
  const bet = game.player.bet;

  if (d > 21) settle(game, 'win', bet * 2, `Dealer busts with ${d}`);
  else if (p > d) settle(game, 'win', bet * 2, `${p} beats ${d}`);
  else if (p < d) settle(game, 'lose', 0, `Dealer's ${d} beats your ${p}`);
  else settle(game, 'push', bet, `Push at ${p}`);
  game.status = 'settled';
  return game;
}

export function resetBankroll(game) {
  game.bankroll = INITIAL_BANKROLL;
  game.lastResult = null;
  return game;
}
