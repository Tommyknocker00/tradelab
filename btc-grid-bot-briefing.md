# TradeLab — Cursor Briefing

## Doel
Een autonome Bitcoin trading bot die draait als Node.js service op een Hetzner VPS. De bot gebruikt een dynamische grid strategie op basis van ATR (Average True Range) om automatisch te kopen en verkopen binnen een volatiliteitsgestuurde prijsrange.

Fase 1: Paper trading (simulatie, geen echt geld).
Fase 2: Live trading via Bitvavo API.

---

## Tech Stack
- **Runtime:** Node.js 20+ met TypeScript
- **Exchange:** Bitvavo (officiële npm package: `@bitvavo/node-api`)
- **Scheduler:** node-cron (voor periodieke checks)
- **Logging:** winston
- **Config:** dotenv
- **Testing:** Jest

---

## Project structuur

```
tradelab/
├── src/
│   ├── index.ts              # Entry point
│   ├── bot.ts                # Hoofdlogica bot loop
│   ├── grid.ts               # Grid berekening (dynamisch via ATR)
│   ├── exchange.ts           # Bitvavo API wrapper
│   ├── paper.ts              # Paper trading simulatie
│   ├── state.ts              # State management (open orders, balans)
│   ├── indicators.ts         # ATR berekening
│   └── logger.ts             # Logging setup
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Kern Logica

### 1. ATR-gebaseerde dynamische grid

- Haal candle data op (bijv. laatste 14 candles van 1u interval)
- Bereken ATR over die periode
- Stel grid range in als: `huidige prijs ± (ATR * multiplier)`
- Verdeel die range in N gelijke grid levels (bijv. 10 levels)
- Per grid level: plaats een koop-order onder huidige prijs, verkoop-order erboven

### 2. Grid herberekening
- Elke X minuten (instelbaar, bijv. 60 min): herbereken ATR en pas grid aan
- Annuleer open orders buiten nieuwe range
- Plaats nieuwe orders op nieuwe levels

### 3. Order logica
- Per grid level: koop voor vaste EUR waarde (bijv. €5 per level)
- Zodra koop-order gevuld is: plaats direct een verkoop-order op het level erboven
- Zodra verkoop gevuld is: plaats direct een nieuw koop-order op dat level
- Herhaal → elke swing pakt een kleine winst

### 4. Paper trading mode
- Zelfde logica als live, maar geen echte API orders
- Simuleer order fills op basis van live koers
- Houd bij: gesimuleerde balans EUR/BTC, trades, P&L
- Log alles overzichtelijk

---

## Environment variables (.env)

```
BITVAVO_API_KEY=
BITVAVO_API_SECRET=
TRADING_PAIR=BTC-EUR
PAPER_TRADING=true          # false voor live
GRID_LEVELS=10              # Aantal grid levels
GRID_ATR_PERIOD=14          # ATR periode (candles)
GRID_ATR_MULTIPLIER=1.5     # Range = prijs ± (ATR * multiplier)
ORDER_SIZE_EUR=5             # EUR per grid level
CHECK_INTERVAL_MINUTES=60   # Hoe vaak grid herberekend wordt
STARTING_BALANCE_EUR=100    # Alleen voor paper trading
STARTING_BALANCE_BTC=0      # Alleen voor paper trading
```

---

## Bitvavo API gebruik

```typescript
// Benodigde endpoints:
// - getCandles(market, interval, limit)  → voor ATR berekening
// - getTicker(market)                    → huidige prijs
// - createOrder(market, side, type, body) → order plaatsen
// - cancelOrder(market, orderId)         → order annuleren
// - getOpenOrders(market)               → open orders ophalen
// - getBalance(symbol)                  → balans ophalen
```

---

## Logging output (voorbeeld)

```
[2024-01-15 09:00:00] INFO  BTC/EUR prijs: €89.450
[2024-01-15 09:00:00] INFO  ATR (14): €2.340 | Range: €85.870 - €92.960
[2024-01-15 09:00:00] INFO  Grid herberekend: 10 levels à €715 interval
[2024-01-15 09:00:01] INFO  [PAPER] Koop-order geplaatst op €88.000 (€5)
[2024-01-15 09:12:33] INFO  [PAPER] Order gevuld: KOOP 0.0000567 BTC @ €88.000
[2024-01-15 09:12:33] INFO  [PAPER] Verkoop-order geplaatst op €88.715
[2024-01-15 09:45:12] INFO  [PAPER] Order gevuld: VERKOOP 0.0000567 BTC @ €88.715
[2024-01-15 09:45:12] INFO  [PAPER] Winst op trade: €0.04 | Totaal P&L: +€0.04
```

---

## Fase 1 deliverable (paper trading)
- Bot draait stabiel en logt alle gesimuleerde trades
- P&L overzicht na X uur/dagen
- Config makkelijk aanpasbaar via .env

## Fase 2 (live, later)
- Zet `PAPER_TRADING=false`
- Voeg risicolimieten toe (max drawdown, stop loss op totale positie)
- Rate limit handling Bitvavo API

---

## Fase 3 (security, als laatste)
- **Cloudflare Zero Trust Access** instellen voor de dashboard/logs URL
- Login via Google account + 2FA — geen code nodig, alleen Cloudflare dashboard
- Tijdens development: gewoon open laten, alleen lokaal of via IP testen
- IP-whitelist als tussenoplossing (tijdelijk in Hetzner firewall)

---

## Notities voor Cursor
- Begin met `paper.ts` en `indicators.ts` — dit is de kern
- Gebruik `@bitvavo/node-api` voor exchange communicatie
- Alle magic numbers via .env, nooit hardcoded
- Schrijf unit tests voor ATR berekening en grid logica
- TypeScript strict mode aan
