/**
 * In-memory P&L history for charting. Not persisted.
 * Samples every 60 seconds, max 500 points.
 */
const MAX_POINTS = 500;
const SAMPLE_INTERVAL_MS = 60_000;

export interface PnlPoint {
  t: number;
  pnl: number;
}

let history: PnlPoint[] = [];
let lastAppendAt = 0;

export function appendPnlPoint(pnl: number): void {
  const now = Date.now();
  if (now - lastAppendAt < SAMPLE_INTERVAL_MS && history.length > 0) return;

  lastAppendAt = now;
  history.push({ t: now, pnl });
  if (history.length > MAX_POINTS) history.shift();
}

export function getPnlHistory(): PnlPoint[] {
  return [...history];
}

export function clearPnlHistory(): void {
  history = [];
  lastAppendAt = 0;
}
