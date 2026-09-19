const CLIENT = (() => {
  const fromUrl = new URLSearchParams(location.search).get('client');
  let id = fromUrl || localStorage.getItem('bj-client');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('bj-client', id);
  }
  return id;
})();

const CHIPS = [10, 25, 100, 500];
const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };

let bet = 0;
let busy = false;
let lastCounts = { player: 0, dealer: 0 };
let flashTimer = null;

const el = {
  console: document.getElementById('console'),
  dealerHand: document.getElementById('dealer-hand'),
  playerHand: document.getElementById('player-hand'),
  dealerValue: document.getElementById('dealer-value'),
  playerValue: document.getElementById('player-value'),
  balance: document.getElementById('balance'),
};

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);

function valueOf(cards) {
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
  return total;
}

async function apiGet(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

async function apiPost(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client: CLIENT, ...body }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

/* ---------- rendering ---------- */

function cardEl(card) {
  const c = document.createElement('div');
  c.className = 'card';
  if (card.suit === 'H' || card.suit === 'D') {
    c.classList.add('red');
  }
  const corner = (cls) =>
    `<div class="corner ${cls}"><span class="rank">${card.rank}</span><span class="suit">${SUIT_GLYPH[card.suit]}</span></div>`;
  const pip = ['J', 'Q', 'K'].includes(card.rank)
    ? `<div class="pip"><span class="face">${card.rank}</span><span class="suit">${SUIT_GLYPH[card.suit]}</span></div>`
    : `<div class="pip"><span class="big">${SUIT_GLYPH[card.suit]}</span></div>`;
  c.innerHTML = corner('tl') + corner('br') + pip;
  return c;
}

function backEl() {
  const c = document.createElement('div');
  c.className = 'card back';
  return c;
}

function slotEl() {
  const c = document.createElement('div');
  c.className = 'slot';
  return c;
}

function renderHand(container, cards, hidden, animateFrom) {
  const n = cards.length;
  container.innerHTML = '';
  if (n === 0) {
    container.append(slotEl(), slotEl());
    return;
  }
  cards.forEach((card, i) => {
    const node = hidden && i === 1 ? backEl() : cardEl(card);
    if (i >= animateFrom) {
      node.classList.add('deal-in');
      node.style.animationDelay = `${(i - animateFrom) * 140 + 40}ms`;
    }
    const off = i - (n - 1) / 2;
    node.style.setProperty('--fan-rot', `${(off * 2.4).toFixed(2)}deg`);
    node.style.setProperty('--fan-y', `${(Math.abs(off) * 3).toFixed(1)}px`);
    container.append(node);
  });
}

function render(s, animate = []) {
  const anim = new Set(animate);
  renderHand(el.playerHand, s.player.cards, false, anim.has('player') ? lastCounts.player : Infinity);
  renderHand(el.dealerHand, s.dealer.cards, s.status === 'player', anim.has('dealer') ? lastCounts.dealer : Infinity);
  lastCounts = { player: s.player.cards.length, dealer: s.dealer.cards.length };

  el.balance.textContent = fmt(s.bankroll);

  const playerTotal = s.player.cards.length ? valueOf(s.player.cards) : 0;
  el.playerValue.textContent = playerTotal || '';
  el.playerValue.classList.toggle('bust', playerTotal > 21);

  if (!s.dealer.cards.length) {
    el.dealerValue.textContent = '';
  } else if (s.status === 'player') {
    el.dealerValue.textContent = valueOf([s.dealer.cards[0]]);
  } else {
    el.dealerValue.textContent = valueOf(s.dealer.cards);
  }

  renderConsole(s);
}

function renderConsole(s) {
  const c = el.console;
  c.innerHTML = '';

  if (s.status === 'player') {
    c.append(actionsPanel());
    return;
  }

  if (s.lastResult) {
    c.append(resultBanner(s.lastResult));
  }

  if (s.status === 'settled' && s.bankroll === 0) {
    c.append(rebuyPanel());
  } else {
    c.append(bettingPanel(s));
    updateBet(s);
  }
}

function resultBanner(r) {
  const div = document.createElement('div');
  div.className = 'result';
  const big = {
    blackjack: `Blackjack — you win ${fmt(r.payout - r.bet)}`,
    win: `You win ${fmt(r.payout - r.bet)}`,
    push: 'Push — bet returned',
    lose: 'Dealer wins',
    bust: 'Bust',
  }[r.outcome] ?? '';
  div.innerHTML = `<div class="result-big ${r.outcome === 'push' ? 'push' : r.payout > 0 ? 'win' : 'lose'}">${big}</div><div class="result-reason">${r.reason}</div>`;
  return div;
}

function bettingPanel(s) {
  const panel = document.createElement('div');
  panel.className = 'panel';

  const row = document.createElement('div');
  row.className = 'bet-row';

  const chips = document.createElement('div');
  chips.className = 'chips';
  for (const v of CHIPS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.value = v;
    chip.textContent = v;
    chip.title = `Add ${v} to your bet`;
    chip.addEventListener('click', () => {
      bet = Math.min(bet + v, s.bankroll);
      updateBet(s);
    });
    chips.append(chip);
  }

  const box = document.createElement('div');
  box.className = 'bet-box';
  box.innerHTML = `<span class="bet-label">Your bet</span><span class="bet-amount" id="bet-amount">${fmt(bet)}</span>`;

  row.append(chips, box);

  const actions = document.createElement('div');
  actions.className = 'actions-row';
  actions.innerHTML = `<button type="button" class="btn" id="bet-clear">Clear</button><button type="button" class="btn primary" id="btn-deal">Deal</button>`;
  actions.querySelector('#bet-clear').addEventListener('click', () => {
    bet = 0;
    updateBet(s);
  });
  actions.querySelector('#btn-deal').addEventListener('click', () =>
    act(() => apiPost('/api/deal', { bet }), ['player', 'dealer'])
  );

  panel.append(row, actions);
  return panel;
}

function actionsPanel() {
  const panel = document.createElement('div');
  panel.className = 'panel';
  const row = document.createElement('div');
  row.className = 'actions-row';
  row.innerHTML = `<button type="button" class="btn" id="btn-hit">Hit</button><button type="button" class="btn primary" id="btn-stand">Stand</button>`;
  row.querySelector('#btn-hit').addEventListener('click', () => act(() => apiPost('/api/hit'), ['player']));
  row.querySelector('#btn-stand').addEventListener('click', () => act(() => apiPost('/api/stand'), ['dealer']));
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'h to hit · s to stand';
  panel.append(row, hint);
  return panel;
}

function rebuyPanel() {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `<div class="rebuy-text">Bankroll is empty — the house extends one more credit line.</div>`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn primary';
  btn.textContent = 'Rebuy 1,000';
  btn.addEventListener('click', () => act(() => apiPost('/api/reset'), []));
  panel.append(btn);
  return panel;
}

function updateBet(s) {
  const amount = document.getElementById('bet-amount');
  if (amount) {
    amount.textContent = fmt(bet);
  }
  const deal = document.getElementById('btn-deal');
  if (deal) {
    deal.disabled = busy || bet <= 0 || bet > s.bankroll;
  }
}

function setBusy(value) {
  busy = value;
  el.console.querySelectorAll('button').forEach((b) => {
    if (b.id === 'btn-deal') {
      b.disabled = value || bet <= 0;
    } else {
      b.disabled = value;
    }
  });
}

function flash(message) {
  el.console.querySelector('.flash')?.remove();
  const div = document.createElement('div');
  div.className = 'flash';
  div.textContent = message;
  el.console.prepend(div);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => div.remove(), 3500);
}

async function act(fn, animate) {
  if (busy) return;
  setBusy(true);
  try {
    const s = await fn();
    bet = 0;
    render(s, animate);
  } catch (err) {
    flash(err.message);
  } finally {
    setBusy(false);
  }
}

/* ---------- keyboard ---------- */

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();
  const deal = document.getElementById('btn-deal');
  const hit = document.getElementById('btn-hit');
  const stand = document.getElementById('btn-stand');
  if (key === 'h' && hit && !hit.disabled) hit.click();
  else if (key === 's' && stand && !stand.disabled) stand.click();
  else if (key === 'd' && deal && !deal.disabled) deal.click();
});

/* ---------- init ---------- */

(async () => {
  try {
    render(await apiGet('/api/state?client=' + encodeURIComponent(CLIENT)));
  } catch {
    el.balance.textContent = '—';
  }
})();
