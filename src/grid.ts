import logger from './logger';
import { config } from './config';
import { Candle, calculateATR } from './indicators';
import { getState, addOrder, cancelAllOrders, GridOrder } from './state';

export interface GridLevel {
  index: number;
  price: number;
  side: 'buy' | 'sell';
}

export interface GridConfig {
  low: number;
  high: number;
  levels: GridLevel[];
  interval: number;
  atr: number;
}

/**
 * Calculate grid boundaries and levels based on ATR.
 * Buy levels below current price, sell levels above.
 */
export function calculateGrid(
  currentPrice: number,
  candles: Candle[],
): GridConfig {
  const { levels: numLevels, atrPeriod, atrMultiplier } = config.grid;
  const atr = calculateATR(candles, atrPeriod);
  const range = atr * atrMultiplier;
  const gridLow = currentPrice - range;
  const gridHigh = currentPrice + range;
  const interval = (gridHigh - gridLow) / numLevels;

  const levels: GridLevel[] = [];

  for (let i = 0; i <= numLevels; i++) {
    const price = gridLow + i * interval;
    levels.push({
      index: i,
      price: Math.round(price * 100) / 100,
      side: price < currentPrice ? 'buy' : 'sell',
    });
  }

  logger.info(
    `Grid calculated — ATR: €${atr.toFixed(2)} | Range: €${gridLow.toFixed(2)} - €${gridHigh.toFixed(2)} | Interval: €${interval.toFixed(2)}`,
  );

  return { low: gridLow, high: gridHigh, levels, interval, atr };
}

/**
 * Apply a new grid: cancel existing orders and place new ones.
 * Returns the new grid orders ready to be tracked.
 */
export function applyGrid(
  gridConfig: GridConfig,
  currentPrice: number,
): GridOrder[] {
  const state = getState();

  const cancelled = cancelAllOrders();
  if (cancelled > 0) {
    logger.info(`Cancelled ${cancelled} existing orders for grid recalculation`);
  }

  state.gridLow = gridConfig.low;
  state.gridHigh = gridConfig.high;
  state.gridInterval = gridConfig.interval;
  state.atr = gridConfig.atr;
  state.lastGridUpdate = new Date();

  const newOrders: GridOrder[] = [];

  for (const level of gridConfig.levels) {
    if (Math.abs(level.price - currentPrice) < gridConfig.interval * 0.1) continue;

    const amountBtc = config.orderSizeEur / level.price;
    const order: GridOrder = {
      id: `grid-${Date.now()}-${level.index}-${Math.random().toString(36).slice(2, 6)}`,
      side: level.side,
      price: level.price,
      amountBtc,
      amountEur: config.orderSizeEur,
      gridLevel: level.index,
      status: 'open',
      createdAt: new Date(),
    };

    addOrder(order);
    newOrders.push(order);
  }

  logger.info(
    `Grid applied: ${newOrders.filter(o => o.side === 'buy').length} buy orders, ` +
    `${newOrders.filter(o => o.side === 'sell').length} sell orders`,
  );

  return newOrders;
}
