import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { config } from './config';
import { startBot, stopBot, getBotStatus, botEvents } from './bot';
import { forceFlush } from './state';
import logger from './logger';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

app.get('/api/status', (_req, res) => {
  res.json(getBotStatus());
});

app.post('/api/bot/start', async (_req, res) => {
  try {
    await startBot();
    res.json({ success: true, message: 'Bot started' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Failed to start bot: ${message}`);
    res.status(500).json({ success: false, message });
  }
});

app.post('/api/bot/stop', async (_req, res) => {
  try {
    await stopBot();
    res.json({ success: true, message: 'Bot stopped' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, message });
  }
});

// WebSocket — push updates to connected clients
wss.on('connection', (ws: WebSocket) => {
  logger.info('Dashboard client connected');
  ws.send(JSON.stringify({ type: 'status', data: getBotStatus() }));

  ws.on('close', () => {
    logger.info('Dashboard client disconnected');
  });
});

function broadcast(data: unknown): void {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

botEvents.on('update', () => {
  broadcast({ type: 'status', data: getBotStatus() });
});

// Graceful shutdown — save state before exit
function shutdown(signal: string): void {
  logger.info(`${signal} received — saving state and shutting down...`);
  try {
    forceFlush();
  } catch { /* state might not be initialized */ }
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const PORT = config.dashboardPort;
server.listen(PORT, () => {
  logger.info(`TradeLab dashboard running on http://localhost:${PORT}`);
  logger.info('Waiting for bot start command from dashboard...');
});
