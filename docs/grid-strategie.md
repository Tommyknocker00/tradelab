# Grid Strategie — Hoe TradeLab handelt

## Het idee in het kort

Grid trading profiteert van **zijwaartse prijsbewegingen**. De bot plaatst een raster (grid) van koop- en verkoop-orders rond de huidige prijs. Elke keer dat de prijs op en neer beweegt door dat grid, maakt de bot een kleine winst per level.

Het werkt het best als de prijs binnen een range blijft bewegen. Bij een sterke trend in één richting worden er veel orders aan één kant gevuld zonder tegenhanger — dat is het risico.

## ATR: Hoe de grid range wordt bepaald

**ATR (Average True Range)** meet de gemiddelde prijsbeweging per candle over een bepaalde periode. Het is een maatstaf voor volatiliteit.

### True Range berekening

Per candle is de True Range het **grootste** van:
- `high - low` (spread binnen de candle)
- `|high - vorige close|` (gap omhoog)
- `|low - vorige close|` (gap omlaag)

### ATR berekening

ATR is het simpele gemiddelde van de True Range over N candles. Wij gebruiken standaard **14 candles van 1 uur**, dus de ATR kijkt naar de volatiliteit van de afgelopen ~14 uur.

### Grid range formule

```
grid_low  = huidige_prijs - (ATR × multiplier)
grid_high = huidige_prijs + (ATR × multiplier)
```

Met de default multiplier van **1.5** en een ATR van bijv. €2.000:
- Range = €3.000 boven en onder de prijs
- Totale grid breedte = €6.000

## Grid levels en orders

De range wordt verdeeld in N gelijke stappen (default: **10 levels**).

```
Voorbeeld bij BTC = €85.000, ATR = €2.000, multiplier = 1.5:

Grid range:  €82.000 — €88.000
Interval:    €600 per level

Level 10: €88.000  SELL
Level  9: €87.400  SELL
Level  8: €86.800  SELL
Level  7: €86.200  SELL
Level  6: €85.600  SELL
          -------- €85.000 (huidige prijs)
Level  5: €84.400  BUY
Level  4: €83.800  BUY
Level  3: €83.200  BUY
Level  2: €82.600  BUY
Level  1: €82.000  BUY
```

Elke order is een vast EUR bedrag (default: **€5**). De hoeveelheid BTC per order wordt berekend als `€5 / prijs_op_dat_level`.

## Order flow

1. **Koop-order gevuld** → direct een verkoop-order plaatsen één level hoger
2. **Verkoop-order gevuld** → direct een koop-order plaatsen één level lager
3. Het verschil tussen koop en verkoop = **winst** (één grid interval)

### Voorbeeld trade

```
Koop   0.0000588 BTC @ €85.000  (kost €5.00)
Verkoop 0.0000588 BTC @ €85.600  (opbrengst €5.035)
Winst: €0.035 per trade
```

Bij 10 levels en actieve markt kunnen er meerdere van deze mini-trades per uur plaatsvinden.

## Grid herberekening

Elke **60 minuten** (instelbaar) wordt het grid opnieuw berekend:
1. Nieuwe ATR berekenen op basis van recente candles
2. Oude open orders annuleren
3. Nieuw grid plaatsen rond de huidige prijs

Dit zorgt ervoor dat het grid meebeweegt met de markt en zich aanpast aan veranderende volatiliteit.

## Wanneer werkt het goed / slecht

### Goed
- **Sideways market**: prijs beweegt op en neer binnen een range → veel fills, consistente kleine winsten
- **Hoge volatiliteit**: grotere ATR → breder grid → grotere winst per trade

### Risico's
- **Sterke trend omlaag**: alle koop-orders worden gevuld, prijs blijft dalen → je zit met BTC die minder waard is (unrealized loss)
- **Sterke trend omhoog**: alle verkoop-orders gevuld, prijs stijgt verder → je mist de verdere stijging
- **Flash crash**: extreem snelle daling kan orders vullen ver buiten verwachte range

## Winstberekening

Winst per trade = `(verkoop_prijs - koop_prijs) × hoeveelheid_BTC`

Met 10 levels, €5 per level, en een interval van €600:
- Winst per trade ≈ **€0.035**
- Bij 10 trades per dag ≈ **€0.35/dag**
- Bij 100 trades per dag ≈ **€3.50/dag**

Dit zijn schattingen — werkelijke resultaten hangen af van marktcondities. Paper trading geeft je een realistisch beeld voordat je live gaat.

## Tuning tips

| Parameter | Hoger = | Lager = |
|-----------|---------|---------|
| `GRID_LEVELS` | Meer trades, kleinere winst per trade | Minder trades, grotere winst per trade |
| `GRID_ATR_MULTIPLIER` | Breder grid, minder kans op out-of-range | Smaller grid, meer trades maar meer risico |
| `GRID_ATR_PERIOD` | Stabieler grid (reageert trager) | Reactiever grid (past sneller aan) |
| `ORDER_SIZE_EUR` | Meer EUR per trade, meer exposure | Minder risico per trade |
| `CHECK_INTERVAL_MINUTES` | Grid past minder vaak aan | Grid volgt de markt beter |
