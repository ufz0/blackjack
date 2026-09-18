import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, deal, hit, stand, resetBankroll } from './game/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MAX_GAMES = 2000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const games = new Map();

function gameFor(client) {
  if (typeof client !== 'string' || client.length === 0 || client.length > 64) {
    throw Object.assign(new Error('Missing or invalid client id'), { status: 400 });
  }
  let game = games.get(client);
  if (!game) {
    game = createGame();
    games.set(client, game);
    if (games.size > MAX_GAMES) {
      games.delete(games.keys().next().value);
    }
  }
  return game;
}

function view(game) {
  return {
    status: game.status,
    bankroll: game.bankroll,
    player: game.player,
    dealer: game.dealer,
    lastResult: game.lastResult,
  };
}

function route(handler) {
  return (req, res) => {
    try {
      res.json(view(handler(req)));
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Something went wrong' });
    }
  };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/state', route((req) => gameFor(req.query.client)));
app.post('/api/deal', route((req) => deal(gameFor(req.body?.client), req.body?.bet)));
app.post('/api/hit', route((req) => hit(gameFor(req.body?.client))));
app.post('/api/stand', route((req) => stand(gameFor(req.body?.client))));
app.post('/api/reset', route((req) => resetBankroll(gameFor(req.body?.client))));

app.listen(PORT, () => {
  console.log(`Blackjack listening on http://localhost:${PORT}`);
});
