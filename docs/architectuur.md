# Architectuur Overzicht

Hoe de code modules samenwerken. Handig als referentie bij doorontwikkeling.

## Module afhankelijkheden

```
index.ts
  ├── bot.ts
  │     ├── exchange.ts      (Bitvavo API calls)
  │     ├── grid.ts          (berekent grid levels)
  │     │     ├── indicators.ts  (ATR berekening)
  │     │     └── state.ts       (orders toevoegen/annuleren)
  │     ├── paper.ts         (simuleert fills)
  │     │     └── state.ts       (balans bijwerken, trades loggen)
  │     └── state.ts         (init, getState)
  ├── config.ts              (env vars)
  └── logger.ts              (winston)
```

## Data flow: één bot cycle

```
1. getCurrentPrice()           → Bitvavo API → huidige BTC prijs
2. getCandles()                → Bitvavo API → laatste 15 candles (1h)
3. calculateATR()              → ATR waarde
4. calculateGrid()             → grid boundaries + levels
5. applyGrid()                 → cancel oude orders, plaats nieuwe
6. [elke 30s] priceTick()      → check prijs, simuleer fills (paper)
7. [elke 60m] runGridCycle()   → herhaal stap 1-5
```

## State management

Alle state zit **in-memory** in `state.ts`. Er is geen database. Bij een restart begint alles opnieuw.

Dit is bewust zo voor Fase 1 (paper trading). Overwegingen voor Fase 2:
- **SQLite** of **JSON file** voor state persistence
- Trade history bewaren over restarts heen
- Open orders herstellen na crash

### State structuur

```typescript
BotState {
  balanceEur / balanceBtc     // Huidige balansen
  openOrders[]                // Orders die wachten op fill
  filledOrders[]              // Historische gevulde orders
  trades[]                    // Completed round-trips (koop+verkoop)
  totalPnl                    // Running P&L totaal
  currentPrice                // Laatst bekende BTC prijs
  gridLow / gridHigh          // Huidige grid boundaries
  gridInterval                // Prijs verschil per level
  atr                         // Laatst berekende ATR
  isRunning                   // Bot actief ja/nee
}
```

## WebSocket communicatie

De Express server draait een WebSocket server op dezelfde poort. Het dashboard verbindt hier naartoe voor real-time updates.

```
Bot event ("update") → botEvents EventEmitter → broadcast naar alle WS clients
```

Events worden getriggerd na:
- Elke price tick (30s)
- Elke grid herberekening
- Bot start/stop

Het dashboard ontvangt JSON berichten:
```json
{
  "type": "status",
  "data": { /* volledige bot status */ }
}
```

## API Endpoints

| Method | Pad | Wat |
|--------|-----|-----|
| `GET` | `/api/status` | Volledige bot status als JSON |
| `POST` | `/api/bot/start` | Start de bot |
| `POST` | `/api/bot/stop` | Stop de bot |
| `GET` | `/` | Dashboard (static files) |

## Paper vs Live

De `paper.ts` module wordt alleen actief gebruikt als `PAPER_TRADING=true`. In paper mode:
- Orders worden **niet** naar Bitvavo gestuurd
- Fills worden gesimuleerd op basis van de live ticker prijs
- Candle data en ticker prijs komen **wel** van de echte Bitvavo API (publieke endpoints, geen key nodig)
- State management is identiek aan live mode

Voor live trading (Fase 2) moet `bot.ts` worden uitgebreid om:
- Echte orders te plaatsen via `exchange.placeLimitOrder()`
- Open orders te monitoren via `exchange.getOpenOrders()`
- Order fills te detecteren (polling of WebSocket subscription)
- Rate limiting te respecteren

## Tests

Tests staan in `src/__tests__/`. Momenteel getest:

- **indicators.test.ts**: True Range berekening, ATR berekening, edge cases
- **grid.test.ts**: Grid structuur, level spreiding, buy/sell verdeling

De grid test mockt `config` en `logger` om onafhankelijk van env vars te draaien.

```bash
npm test              # Alle tests
npm test -- --watch   # Watch mode
npm test -- --coverage # Coverage rapport
```
