import logger from './logger';
import { debouncedSave, loadState, saveState } from './persistence';

export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'filled' | 'cancelled';

export interface GridOrder {
  id: string;
  side: OrderSide;
  price: number;
  amountBtc: number;
  amountEur: number;
  gridLevel: number;
  status: OrderStatus;
  createdAt: Date;
  filledAt?: Date;
}

export interface Trade {
  id: string;
  buyPrice: number;
  sellPrice: number;
  amountBtc: number;
  feesEur: number;
  profitEur: number;
  timestamp: Date;
}

export interface BotState {
  balanceEur: number;
  balanceBtc: number;
  openOrders: GridOrder[];
  filledOrders: GridOrder[];
  trades: Trade[];
  totalPnl: number;
  totalFees: number;
  currentPrice: number;
  gridLow: number;
  gridHigh: number;
  gridInterval: number;
  atr: number;
  lastGridUpdate: Date;
  isRunning: boolean;
  startedAt: Date;
}

let state: BotState;

function triggerSave(): void {
  debouncedSave(state);
}

export function initState(startEur: number, startBtc: number): BotState {
  state = {
    balanceEur: startEur,
    balanceBtc: startBtc,
    openOrders: [],
    filledOrders: [],
    trades: [],
    totalPnl: 0,
    totalFees: 0,
    currentPrice: 0,
    gridLow: 0,
    gridHigh: 0,
    gridInterval: 0,
    atr: 0,
    lastGridUpdate: new Date(),
    isRunning: false,
    startedAt: new Date(),
  };
  logger.info(`State initialized — EUR: €${startEur.toFixed(2)}, BTC: ${startBtc}`);
  return state;
}

export function restoreState(): BotState | null {
  const saved = loadState();
  if (!saved) return null;
  state = saved;
  return state;
}

export function forceFlush(): void {
  if (state) saveState(state);
}

export function getState(): BotState {
  if (!state) throw new Error('State not initialized — call initState() first');
  return state;
}

export function addOrder(order: GridOrder): void {
  state.openOrders.push(order);
  triggerSave();
}

export function fillOrder(orderId: string, fillPrice: number, feeRate: number): GridOrder | null {
  const idx = state.openOrders.findIndex(o => o.id === orderId);
  if (idx === -1) return null;

  const order = state.openOrders.splice(idx, 1)[0];
  order.status = 'filled';
  order.filledAt = new Date();
  state.filledOrders.push(order);

  if (order.side === 'buy') {
    const feeEur = order.amountEur * feeRate;
    state.balanceEur -= order.amountEur;
    state.balanceBtc += order.amountBtc * (1 - feeRate);
    state.totalFees += feeEur;
  } else {
    const grossEur = order.amountBtc * fillPrice;
    const feeEur = grossEur * feeRate;
    state.balanceEur += grossEur - feeEur;
    state.balanceBtc -= order.amountBtc;
    state.totalFees += feeEur;
  }

  triggerSave();
  return order;
}

export function cancelOrder(orderId: string): boolean {
  const idx = state.openOrders.findIndex(o => o.id === orderId);
  if (idx === -1) return false;
  state.openOrders[idx].status = 'cancelled';
  state.openOrders.splice(idx, 1);
  return true;
}

export function cancelAllOrders(): number {
  const count = state.openOrders.length;
  state.openOrders = [];
  triggerSave();
  return count;
}

export function recordTrade(buyPrice: number, sellPrice: number, amountBtc: number, feeRate: number): Trade {
  const grossProfit = (sellPrice - buyPrice) * amountBtc;
  const buyFee = (buyPrice * amountBtc) * feeRate;
  const sellFee = (sellPrice * amountBtc) * feeRate;
  const feesEur = buyFee + sellFee;
  const profitEur = grossProfit - feesEur;

  const trade: Trade = {
    id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    buyPrice,
    sellPrice,
    amountBtc,
    feesEur,
    profitEur,
    timestamp: new Date(),
  };
  state.trades.push(trade);
  state.totalPnl += profitEur;
  triggerSave();
  return trade;
}

export function getPortfolioValue(): number {
  return state.balanceEur + state.balanceBtc * state.currentPrice;
}
