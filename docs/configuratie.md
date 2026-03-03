# Configuratie Referentie

Alle configuratie gaat via het `.env` bestand in de project root. Kopieer `.env.example` als startpunt.

## Alle variabelen

### Bitvavo API

| Variabele | Type | Default | Uitleg |
|-----------|------|---------|--------|
| `BITVAVO_API_KEY` | string | `""` | API key van Bitvavo. Niet nodig voor paper trading — de bot haalt dan alleen publieke marktdata op (candles, ticker). |
| `BITVAVO_API_SECRET` | string | `""` | API secret van Bitvavo. Bewaar dit nooit in version control. |

**API key aanmaken**: Bitvavo → Instellingen → API → Nieuwe API key. Geef minimaal **View** en **Trade** rechten. **Withdraw** nooit aanzetten via de API.

### Trading

| Variabele | Type | Default | Uitleg |
|-----------|------|---------|--------|
| `TRADING_PAIR` | string | `BTC-EUR` | Market pair. Bitvavo notatie: `BTC-EUR`, `ETH-EUR`, etc. |
| `PAPER_TRADING` | boolean | `true` | `true` = simulatie (geen echte orders). `false` = live orders via Bitvavo. |
| `ORDER_SIZE_EUR` | number | `5` | Hoeveel EUR per grid order. Bij 10 levels = max €50 aan open orders. |

### Grid Instellingen

| Variabele | Type | Default | Uitleg |
|-----------|------|---------|--------|
| `GRID_LEVELS` | number | `10` | Aantal grid levels boven + onder de prijs. Meer = vaker trades maar kleiner per stuk. |
| `GRID_ATR_PERIOD` | number | `14` | Hoeveel candles voor de ATR berekening. Standaard 14 candles van 1 uur = ~14 uur terugkijken. |
| `GRID_ATR_MULTIPLIER` | number | `1.5` | Grid range = `prijs ± (ATR × multiplier)`. Hoger = breder grid. |
| `CHECK_INTERVAL_MINUTES` | number | `60` | Hoe vaak het grid opnieuw berekend wordt (in minuten). De prijs wordt los daarvan elke 30 seconden gecheckt voor paper fills. |

### Paper Trading

| Variabele | Type | Default | Uitleg |
|-----------|------|---------|--------|
| `STARTING_BALANCE_EUR` | number | `100` | Startbalans EUR voor simulatie. |
| `STARTING_BALANCE_BTC` | number | `0` | Startbalans BTC voor simulatie. |

### Dashboard

| Variabele | Type | Default | Uitleg |
|-----------|------|---------|--------|
| `DASHBOARD_PORT` | number | `3000` | Poort waarop het web dashboard draait. |

## Voorbeeldconfiguraties

### Conservatief (breed grid, weinig exposure)

```env
GRID_LEVELS=6
GRID_ATR_MULTIPLIER=2.0
ORDER_SIZE_EUR=3
CHECK_INTERVAL_MINUTES=120
```

Breed grid, minder trades, kleiner risico. Goed voor beginnen.

### Agressief (smal grid, veel trades)

```env
GRID_LEVELS=20
GRID_ATR_MULTIPLIER=1.0
ORDER_SIZE_EUR=10
CHECK_INTERVAL_MINUTES=30
```

Smal grid met veel levels. Meer trades maar hoger risico bij sterke trends.

### BTC high-volatility

```env
GRID_LEVELS=15
GRID_ATR_MULTIPLIER=1.5
GRID_ATR_PERIOD=7
ORDER_SIZE_EUR=5
CHECK_INTERVAL_MINUTES=30
```

Korte ATR periode waardoor het grid sneller reageert op veranderende volatiliteit. Goed bij sterk wisselende markt.

## Hoe configuratie werkt in de code

Alle env vars worden bij startup geladen via `src/config.ts`. Elke variabele heeft een fallback waarde — als een variabele niet in `.env` staat, wordt de default gebruikt. Bij missende verplichte variabelen (zonder fallback) crasht de app direct bij startup met een duidelijke foutmelding.

Configuratie wordt **niet** dynamisch herladen. Na een wijziging in `.env` moet de bot herstart worden.
