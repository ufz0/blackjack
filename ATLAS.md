# ATLAS.md

Project notes for atlas (terminal sessions).

## Stack

- Node 22 + Express (only dependency), ESM, no build step
- Server-authoritative game: `game/engine.js` (pure logic, `node:test`), `server.js` (routes + in-memory sessions)
- Client: vanilla HTML/CSS/JS in `public/`
- Docker: multi-stage `node:22-alpine`; compose service on port 3000

## Commands

- `npm start` / `npm run dev` (node --watch)
- `npm test`
- `docker compose up --build`

## Branch workflow (agreed with the user)

- Initial commit landed on `main`; every commit after that goes to `dev`
- `main` is only updated via PR (dev → main)
- Repo: `github.com/ufz0/blackjack` (public)

## API

- `GET /api/state?client=` — current game state (creates the game if new)
- `POST /api/deal {client, bet}` — start a round
- `POST /api/hit {client}`
- `POST /api/stand {client}`
- `POST /api/reset {client}` — rebuy bankroll
- `GET /api/health`

Client id is a UUID in `localStorage`; the server keeps one game per id in memory.

## Conventions

- Dealer stands on all 17, blackjack pays 3:2, six-deck shoe
- Payouts in `settle()` are total credits returned (stake included on win/push)
