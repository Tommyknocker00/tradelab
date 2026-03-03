# Deployment op Hetzner VPS

Stappen om TradeLab te draaien op een Hetzner VPS.

## VPS Specificaties

Een klein instance is genoeg. De bot gebruikt nauwelijks resources:
- **CX22** (2 vCPU, 4 GB RAM) is ruim voldoende
- Ubuntu 24.04 LTS aanbevolen
- Locatie: Falkenstein of Nuremberg (dicht bij Bitvavo servers in NL)

## Server Setup

### 1. Node.js installeren

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # v20.x
```

### 2. Project deployen

```bash
# Project naar server kopiëren (via git, scp, of rsync)
cd /opt
git clone <jouw-repo-url> tradelab
cd tradelab

# Dependencies installeren
npm ci --production=false

# TypeScript compileren
npm run build

# .env aanmaken
cp .env.example .env
nano .env  # Vul API keys en configuratie in
```

### 3. Draaien met systemd

Maak een systemd service aan zodat de bot automatisch start en herstart bij crashes.

```bash
sudo nano /etc/systemd/system/tradelab.service
```

```ini
[Unit]
Description=TradeLab Trading Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tradelab
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable tradelab
sudo systemctl start tradelab

# Status checken
sudo systemctl status tradelab

# Logs bekijken
sudo journalctl -u tradelab -f
```

### 4. Firewall

Hetzner heeft een ingebouwde firewall in het Cloud dashboard. Stel in:

| Richting | Protocol | Poort | Bron | Doel |
|----------|----------|-------|------|------|
| Inbound | TCP | 22 | Jouw IP | SSH |
| Inbound | TCP | 3000 | Jouw IP | Dashboard |
| Outbound | TCP | 443 | * | Bitvavo API |

Dashboard poort (3000) voorlopig alleen openzetten voor je eigen IP. In Fase 3 gaat dit via Cloudflare Zero Trust.

## Updates Deployen

```bash
cd /opt/tradelab
git pull
npm ci
npm run build
sudo systemctl restart tradelab
```

## Monitoring

### Logs

De bot logt naar twee plekken:
1. **Console** (zichtbaar via `journalctl`)
2. **`tradelab.log`** in de project directory (max 10MB, 5 rotaties)

```bash
# Live systemd logs
sudo journalctl -u tradelab -f

# Log file
tail -f /opt/tradelab/tradelab.log
```

### Health check

Het dashboard op poort 3000 is de snelste manier om te zien of alles draait. De API endpoint `/api/status` geeft JSON terug met alle bot state.

```bash
curl http://localhost:3000/api/status | jq .
```

### Process monitoring

```bash
# CPU en geheugen
sudo systemctl status tradelab
ps aux | grep node

# Draaitijd
curl -s http://localhost:3000/api/status | jq '.uptime'
```

## Fase 3: Cloudflare Zero Trust (later)

Voor het beveiligen van het dashboard zonder code-wijzigingen:

1. Domein koppelen aan Cloudflare DNS
2. Cloudflare Tunnel installeren op de VPS (`cloudflared`)
3. Zero Trust Access policy aanmaken: alleen jouw Google account + 2FA
4. Hetzner firewall: poort 3000 dichtgooit voor publiek, alleen via tunnel

Dit vereist geen wijzigingen in de TradeLab code. Het is puur een infra/netwerk laag die ervoor wordt gezet.

## Troubleshooting

| Probleem | Oorzaak | Oplossing |
|----------|---------|-----------|
| Bot start niet | Missende .env variabelen | Check logs: `journalctl -u tradelab -n 50` |
| Geen candle data | API key niet nodig maar netwerk geblokkeerd | Check firewall outbound 443 |
| Dashboard niet bereikbaar | Poort 3000 niet open in firewall | Hetzner Cloud → Firewall → Regel toevoegen |
| Rate limit errors | Te veel API calls | Verhoog `CHECK_INTERVAL_MINUTES` |
| Bot stopt na error | Unhandled rejection | Check logs, bot herstart automatisch via systemd |
