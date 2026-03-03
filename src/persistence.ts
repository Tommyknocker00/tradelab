import fs from 'fs';
import path from 'path';
import logger from './logger';
import { BotState } from './state';

const STATE_FILE = path.join(process.cwd(), 'data', 'state.json');

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function ensureDataDir(): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveState(state: BotState): void {
  try {
    ensureDataDir();
    const data = JSON.stringify(state, null, 2);
    fs.writeFileSync(STATE_FILE + '.tmp', data, 'utf-8');
    fs.renameSync(STATE_FILE + '.tmp', STATE_FILE);
  } catch (err) {
    logger.error(`Failed to save state: ${err}`);
  }
}

/**
 * Debounced save — waits 500ms after the last call before writing.
 * Prevents hammering the disk on rapid order fills.
 */
export function debouncedSave(state: BotState): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveState(state), 500);
}

export function loadState(): BotState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const data = JSON.parse(raw) as BotState;

    data.lastGridUpdate = new Date(data.lastGridUpdate);
    data.startedAt = new Date(data.startedAt);
    data.openOrders = data.openOrders.map(o => ({
      ...o,
      createdAt: new Date(o.createdAt),
      filledAt: o.filledAt ? new Date(o.filledAt) : undefined,
    }));
    data.filledOrders = data.filledOrders.map(o => ({
      ...o,
      createdAt: new Date(o.createdAt),
      filledAt: o.filledAt ? new Date(o.filledAt) : undefined,
    }));
    data.trades = data.trades.map(t => ({
      ...t,
      timestamp: new Date(t.timestamp),
    }));

    logger.info(`State loaded from disk — ${data.trades.length} trades, P&L: €${data.totalPnl.toFixed(4)}`);
    return data;
  } catch (err) {
    logger.error(`Failed to load state: ${err}`);
    return null;
  }
}

export function stateFileExists(): boolean {
  return fs.existsSync(STATE_FILE);
}

export function clearStateFile(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
      logger.info('State file cleared');
    }
  } catch (err) {
    logger.error(`Failed to clear state file: ${err}`);
  }
}
