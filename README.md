# Blackjack

A single-player blackjack web app. The Node server owns the shoe, the bankroll, and the rules; the browser is just the table.

## Run it

Local:

```
npm install
npm start
```

Open http://localhost:3000.

Docker:

```
docker compose up --build
```

Same URL.

## House rules

- Six-deck shoe, reshuffled when a quarter of the cards remain
- Blackjack pays 3:2
- Dealer stands on all 17
- Bankroll starts at 1,000, rebuy when it runs out

## Development

```
npm test
```

The game engine (`game/engine.js`) is pure logic and covered by the `node:test` suite in `test/`.

## Branch workflow

- All changes are committed to `dev`
- `main` is only updated through pull requests
