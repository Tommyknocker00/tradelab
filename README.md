# TradeLab

Autonome BTC grid trading bot met een dynamische ATR-strategie. Draait als Node.js service met een real-time web dashboard.

## Quick Start

```bash
# Dependencies installeren
npm install

# Development mode (hot reload)
npm run dev

# Production build
npm run build
npm start

# Tests
npm test
```

Open `http://localhost:3000` voor het dashboard. Klik **INITIALIZE** om de bot te starten.

## Hoe het werkt

De bot handelt in BTC/EUR via een **grid strategie**. Hij plaatst automatisch koop-orders onder de huidige prijs en verkoop-orders erboven, verspreid over een grid van prijslevels.

De grid range wordt bepaald door **ATR (Average True Range)** — een maatstaf voor volatiliteit. Hoe volatieler de markt, hoe breder het grid. Elke keer dat de prijs door een level beweegt, pakt de bot een klein winstje.

Zie [docs/grid-strategie.md](docs/grid-strategie.md) voor de volledige uitleg.

## Project Structuur

```
src/
├── index.ts          Express server + WebSocket + API endpoints
├── bot.ts            Hoofdloop: start/stop, grid cycles, price ticks
├── grid.ts           Grid berekening op basis van ATR
├── exchange.ts       Bitvavo API wrapper
├── paper.ts          Paper trading simulatie
├── state.ts          In-memory state: orders, trades, balansen
├── indicators.ts     ATR berekening
├── config.ts         Environment variable parsing
├── logger.ts         Winston logging (console + file)
└── __tests__/        Unit tests (Jest)

public/
├── index.html        Dashboard HTML
├── style.css         Cyberpunk/Lab thema
└── app.js            Real-time UI via WebSocket

docs/
├── grid-strategie.md Uitleg trading strategie + ATR
├── configuratie.md   Alle .env opties met toelichting
├── bitvavo-api.md    Bitvavo API referentie
└── deployment.md     Hetzner VPS deployment guide
```

## Fases

| Fase | Status | Wat |
|------|--------|-----|
| 1    | **Actief** | Paper trading — simulatie, geen echt geld |
| 2    | Gepland | Live trading via Bitvavo API |
| 3    | Gepland | Security: Cloudflare Zero Trust, 2FA |

## Configuratie

Alle instellingen via `.env`. Kopieer `.env.example` als startpunt:

```bash
cp .env.example .env
```

Zie [docs/configuratie.md](docs/configuratie.md) voor uitleg per variabele.

## Tech Stack

- **Runtime**: Node.js 20+ / TypeScript (strict mode)
- **Exchange**: Bitvavo (`bitvavo` npm package)
- **Web**: Express + WebSocket (ws)
- **Logging**: Winston (console + `tradelab.log`)
- **Testing**: Jest + ts-jest
