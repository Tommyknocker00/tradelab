import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { config } from './config';
import { startBot, stopBot, getBotStatus, botEvents } from './bot';
import { forceFlush } from './state';
import { authMiddleware, handleLogin, handleLogout, isWsAuthenticated } from './auth';
import logger from './logger';

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// Auth routes (before middleware)
app.post('/api/auth/login', handleLogin);
app.post('/api/auth/logout', handleLogout);

// Login page served without auth
app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Auth middleware — protects everything below
app.use(authMiddleware);

app.use(express.static(path.join(__dirname, '..', 'public')));

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

// WebSocket — authenticate and push updates
wss.on('connection', (ws: WebSocket, req) => {
  if (!isWsAuthenticated(req.headers.cookie)) {
    ws.close(1008, 'Not authenticated');
    return;
  }

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
  if (config.dashboardPassword) {
    logger.info(`Dashboard password protection: ENABLED (length: ${config.dashboardPassword.length})`);
  } else {
    logger.info('Dashboard password protection: DISABLED (set DASHBOARD_PASSWORD in .env)');
  }
  logger.info('Waiting for bot start command from dashboard...');
});
