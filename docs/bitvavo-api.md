# Bitvavo API Referentie

Notities over de Bitvavo API zoals gebruikt in TradeLab.

## Package

```bash
npm i bitvavo
```

GitHub: https://github.com/bitvavo/node-bitvavo-api
Docs: https://docs.bitvavo.com/

## Initialisatie

```typescript
const bitvavo = require('bitvavo')().options({
  APIKEY: '...',
  APISECRET: '...',
  ACCESSWINDOW: 10000,
  DEBUGGING: false,
});
```

De package is CommonJS (geen ESM), vandaar `require()`. TypeScript types zijn er niet bij — wij definiëren onze eigen interfaces in `exchange.ts`.

## Endpoints die wij gebruiken

### Publiek (geen API key nodig)

#### `candles(market, interval, options)`

Haalt candle/OHLCV data op. Nodig voor ATR berekening.

```typescript
const data = await bitvavo.candles('BTC-EUR', '1h', { limit: 15 });
// Returns: Array van [timestamp, open, high, low, close, volume]
// Alle waarden behalve timestamp zijn strings
// Resultaat is gesorteerd nieuwste eerst — wij reversen dit
```

Beschikbare intervals: `1m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `8h`, `12h`, `1d`.

#### `tickerPrice(options)`

Huidige prijs van een market.

```typescript
const ticker = await bitvavo.tickerPrice({ market: 'BTC-EUR' });
// Returns: { market: 'BTC-EUR', price: '85432.10' }
```

### Privaat (API key vereist)

#### `placeOrder(market, side, orderType, body)`

Order plaatsen. Wij gebruiken limit orders met `postOnly: true` om maker fees te betalen (goedkoper dan taker).

```typescript
const order = await bitvavo.placeOrder('BTC-EUR', 'buy', 'limit', {
  amount: '0.0001',
  price: '84000',
  postOnly: true,
});
// Returns: { orderId: '...', market: '...', status: 'new', ... }
```

Side: `'buy'` of `'sell'`
Order types: `'limit'`, `'market'`, `'stopLoss'`, `'stopLossLimit'`, `'takeProfit'`, `'takeProfitLimit'`

#### `cancelOrder(market, orderId)`

```typescript
await bitvavo.cancelOrder('BTC-EUR', 'order-id-hier');
// Returns: { orderId: '...' }
```

#### `ordersOpen(options)`

Alle open orders ophalen.

```typescript
const orders = await bitvavo.ordersOpen({ market: 'BTC-EUR' });
// Returns: Array van order objects
```

#### `balance(options)`

Account balans ophalen.

```typescript
const balances = await bitvavo.balance({ symbol: 'BTC' });
// Returns: [{ symbol: 'BTC', available: '0.001', inOrder: '0.0005' }]
```

## Rate Limiting

Bitvavo staat **1000 gewichtspunten per minuut** toe per IP/API key. Elk endpoint heeft een eigen gewicht (de meeste publieke endpoints kosten 1 punt).

```typescript
const remaining = bitvavo.getRemainingLimit();
```

Bij een ban (429) moet je wachten tot de minuut voorbij is. De bot zou idealiter het remaining limit checken voor elke call en pauzeren als het te laag wordt. Dit staat op de roadmap voor Fase 2 (live trading).

## Bitvavo fees

| Type | Fee |
|------|-----|
| Maker (limit order die in het book gaat) | **0.15%** |
| Taker (limit/market order die direct vult) | **0.25%** |

Wij gebruiken `postOnly: true` zodat orders altijd in het book gaan → altijd maker fee. Dit is relevant voor de winstberekening: een round-trip (koop + verkoop) kost 0.30% aan fees.

Bij een grid interval van €600 op BTC van €85.000 is de winst per level ≈ 0.7%. Minus 0.3% fees = **netto ≈ 0.4% per round-trip**.

## Gotchas

- Alle prijzen en amounts van de API zijn **strings**, niet numbers. Altijd `parseFloat()` bij het verwerken.
- Candles worden **nieuwste eerst** teruggegeven. Voor chronologische verwerking (ATR) moeten we reversen.
- De WebSocket connectie kan droppen. Voor robuuste live trading is reconnect logica nodig (Fase 2).
- Minimum order size voor BTC-EUR is ~€5. Onze default `ORDER_SIZE_EUR=5` zit daar net op.
- `postOnly` orders worden geweigerd als ze direct zouden matchen. Bij volatile markten kan dit voorkomen — de bot moet hier graceful mee omgaan.
