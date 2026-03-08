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
| `STARTING_BALANCE_BTC_EUR` | number | `0` | Start met X euro aan BTC (berekend op live koers bij reset/start). 50/50 = zet gelijk aan EUR. |
| `STARTING_BALANCE_BTC` | number | `0` | Alleen als BTC_EUR=0: vaste BTC hoeveelheid. Anders genegeerd. |

### Dashboard

| Variabele | Type | Default | Uitleg |
|-----------|------|---------|--------|
| `DASHBOARD_PORT` | number | `3000` | Poort waarop het web dashboard draait. |
| `DASHBOARD_PASSWORD` | string | `""` | Wachtwoord voor het dashboard. Vermijd `#` in het wachtwoord (wordt als comment gezien). |
| `SESSION_SECRET` | string | `""` | Geheime string voor sessie-cookies. Gebruik een lange random string. |

### Alerts

| Variabele | Type | Default | Uitleg |
|-----------|------|---------|--------|
| `ALERT_EMAIL` | string | `""` | E-mailadres voor meldingen. Vereist SMTP-configuratie. |
| `SMTP_HOST` | string | `smtp.office365.com` | SMTP server (Outlook/Hotmail standaard). |
| `SMTP_PORT` | number | `587` | SMTP poort. |
| `SMTP_USER` | string | `""` | SMTP inlognaam (bijv. je e-mailadres). |
| `SMTP_PASS` | string | `""` | SMTP wachtwoord. **Hotmail/Outlook:** gebruik een app-wachtwoord (Microsoft-account → Beveiliging), niet je normale wachtwoord. |
| `ALERT_WEBHOOK_URL` | string | `""` | Optioneel: webhook (Discord, ntfy.sh). Leeg = geen webhook. |

**Wanneer krijg je een alert?**
- **EUR balans laag** — minder dan 2× ordergrootte (geen kooporders meer mogelijk)
- **BTC balans laag** — BTC-waarde < 2× ordergrootte (geen verkooporders meer mogelijk)
- **API fout** — bij fouten bij prijs ophalen of grid-update

Elk alerttype wordt maximaal 1× per uur verstuurd. De e-mail bevat steeds **wat het probleem is** en **wat je moet doen** (bijv. balans verhogen, RESET drukken, of de bot herstarten).

**E-mail (Hotmail/Outlook):**
1. Maak een app-wachtwoord aan: [account.microsoft.com](https://account.microsoft.com) → Beveiliging → Geavanceerde beveiligingsopties → App-wachtwoorden.
2. Vul `ALERT_EMAIL`, `SMTP_USER` (je e-mail) en `SMTP_PASS` (het app-wachtwoord) in.

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
