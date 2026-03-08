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
| `ORDER_SIZE_EUR` | number | `10` | Hoeveel EUR per grid order. Lager = meer orders mogelijk met zelfde EUR (bij beperkt budget). |

### Grid Instellingen

| Variabele | Type | Default | Uitleg |
|-----------|------|---------|--------|
| `GRID_LEVELS` | number | `6` | Aantal grid levels boven + onder de prijs. Minder = rustiger, EUR gaat langer mee. |
| `GRID_ATR_PERIOD` | number | `14` | Hoeveel candles voor de ATR berekening. Standaard 14 candles van 1 uur = ~14 uur terugkijken. |
| `GRID_ATR_MULTIPLIER` | number | `2.0` | Grid range = `prijs ± (ATR × multiplier)`. Hoger = breder grid, minder fills, winstgevender per trade. |
| `CHECK_INTERVAL_MINUTES` | number | `120` | Hoe vaak het grid opnieuw berekend wordt. Hoger = minder vaak, EUR verbruik spreidt zich. |

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
| `ALERT_EMAIL` | string | `""` | E-mailadres voor meldingen. |
| `RESEND_API_KEY` | string | `""` | **Aanbevolen op VPS.** Resend API key (resend.com). Gebruikt HTTPS i.p.v. SMTP — werkt beter als je host SMTP blokkeert. 100 e-mails/dag gratis. |
| `SMTP_HOST` | string | `smtp.office365.com` | SMTP server (Outlook/Hotmail). Alleen nodig als je geen Resend gebruikt. |
| `SMTP_PORT` | number | `587` | SMTP poort. |
| `SMTP_USER` | string | `""` | SMTP inlognaam. |
| `SMTP_PASS` | string | `""` | SMTP wachtwoord. **Hotmail/Outlook:** app-wachtwoord vereist (Microsoft-account → Beveiliging). |
| `ALERT_WEBHOOK_URL` | string | `""` | Optioneel: webhook (Discord, ntfy.sh). |

**Wanneer krijg je een alert?**
- **EUR balans laag** — minder dan 2× ordergrootte (geen kooporders meer mogelijk)
- **BTC balans laag** — BTC-waarde < 2× ordergrootte (geen verkooporders meer mogelijk)
- **API fout** — bij fouten bij prijs ophalen of grid-update

Elk alerttype wordt maximaal 1× per uur verstuurd. De e-mail bevat steeds **wat het probleem is** en **wat je moet doen** (bijv. balans verhogen, RESET drukken, of de bot herstarten).

**E-mail — kies één methode:**

- **Resend (aanbevolen op VPS):** Account op [resend.com](https://resend.com), API key aanmaken. Vul `ALERT_EMAIL` en `RESEND_API_KEY` in. Geen domain verificatie nodig.
- **SMTP (Hotmail/Outlook):** App-wachtwoord aanmaken via Microsoft-account. Vul `ALERT_EMAIL`, `SMTP_USER`, `SMTP_PASS` in. Sommige VPS/hosts blokkeren SMTP — dan Resend gebruiken.

## Voorbeeldconfiguraties

### Beperkt budget (€100/maand bijstorten)

```env
GRID_LEVELS=6
GRID_ATR_MULTIPLIER=2.0
ORDER_SIZE_EUR=10
CHECK_INTERVAL_MINUTES=120
```

Kleine orders, breed grid, trage grid-updates. EUR gaat langer mee; bij daling loop je minder snel leeg. Geen EUR meer? De bot wacht tot sells vullen (BTC → EUR), daarna kan hij weer kopen.

### Conservatief (breed grid, weinig exposure)

```env
GRID_LEVELS=6
GRID_ATR_MULTIPLIER=2.0
ORDER_SIZE_EUR=3
CHECK_INTERVAL_MINUTES=120
```

Breed grid, minimale orders. Zeer klein risico per trade.

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
