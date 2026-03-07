import logger from './logger';
import { config } from './config';
import { getCandles, getCurrentPrice } from './exchange';
import { calculateGrid, applyGrid } from './grid';
import { simulateOrderFills, logPaperStatus } from './paper';
import { getState, initState, restoreState, forceFlush, getPortfolioValue } from './state';
import { appendPnlPoint, clearPnlHistory, getPnlHistory } from './pnlHistory';
import { stateFileExists } from './persistence';
import { EventEmitter } from 'events';

export const botEvents = new EventEmitter();

let tickInterval: ReturnType<typeof setInterval> | null = null;
let gridInterval: ReturnType<typeof setInterval> | null = null;

export async function startBot(): Promise<void> {
  let resumed = false;

  if (stateFileExists()) {
    const saved = restoreState();
    if (saved) {
      saved.isRunning = true;
      resumed = true;
      logger.info('═'.repeat(60));
      logger.info(`  TradeLab Bot RESUMING from saved state`);
      logger.info(`  Trades: ${saved.trades.length} | P&L: €${saved.totalPnl.toFixed(4)}`);
      logger.info(`  EUR: €${saved.balanceEur.toFixed(2)} | BTC: ${saved.balanceBtc.toFixed(8)}`);
      logger.info('═'.repeat(60));
    }
  }

  if (!resumed) {
    clearPnlHistory();
    let startBtc = config.startingBalance.btc;
    if (config.startingBalance.btcEur > 0) {
      const price = await getCurrentPrice(config.tradingPair);
      startBtc = config.startingBalance.btcEur / price;
      logger.info(`Dynamic 50/50: €${config.startingBalance.btcEur} in BTC @ €${price.toFixed(2)} = ${startBtc.toFixed(8)} BTC`);
    }
    const state = initState(config.startingBalance.eur, startBtc);
    state.isRunning = true;
  }

  logger.info('═'.repeat(60));
  logger.info(`  TradeLab Bot ${resumed ? 'Resumed' : 'Starting'}`);
  logger.info(`  Mode: ${config.paperTrading ? 'PAPER TRADING' : 'LIVE TRADING'}`);
  logger.info(`  Pair: ${config.tradingPair}`);
  logger.info(`  Grid Levels: ${config.grid.levels}`);
  logger.info(`  ATR Period: ${config.grid.atrPeriod} | Multiplier: ${config.grid.atrMultiplier}x`);
  logger.info(`  Order Size: €${config.orderSizeEur} per level`);
  logger.info('═'.repeat(60));

  await runGridCycle();

  // Price check every 30 seconds for paper trading fills
  tickInterval = setInterval(async () => {
    try {
      await priceTick();
    } catch (err) {
      logger.error(`Price tick error: ${err}`);
    }
  }, 30_000);

  // Grid recalculation at configured interval
  const gridMs = config.checkIntervalMinutes * 60 * 1000;
  gridInterval = setInterval(async () => {
    try {
      await runGridCycle();
    } catch (err) {
      logger.error(`Grid cycle error: ${err}`);
    }
  }, gridMs);

  logger.info(`Bot running — price check every 30s, grid update every ${config.checkIntervalMinutes}min`);
}

export async function stopBot(): Promise<void> {
  const state = getState();
  state.isRunning = false;
  if (tickInterval) clearInterval(tickInterval);
  if (gridInterval) clearInterval(gridInterval);
  tickInterval = null;
  gridInterval = null;
  forceFlush();
  logger.info('Bot stopped — state saved');
  botEvents.emit('update');
}

async function runGridCycle(): Promise<void> {
  const market = config.tradingPair;
  const state = getState();

  const price = await getCurrentPrice(market);
  state.currentPrice = price;
  logger.info(`${market} prijs: €${price.toFixed(2)}`);

  const candles = await getCandles(market, '1h', config.grid.atrPeriod + 1);
  const gridConfig = calculateGrid(price, candles);
  applyGrid(gridConfig, price);

  appendPnlPoint(getState().totalPnl);
  botEvents.emit('update');
}

async function priceTick(): Promise<void> {
  const state = getState();
  if (!state.isRunning) return;

  const price = await getCurrentPrice(config.tradingPair);
  state.currentPrice = price;

  if (config.paperTrading) {
    simulateOrderFills(price);
  }

  appendPnlPoint(getState().totalPnl);
  botEvents.emit('update');
}

export function getBotStatus() {
  try {
    const state = getState();
    const portfolioValue = state.balanceEur + state.balanceBtc * state.currentPrice;
    const uptime = Date.now() - state.startedAt.getTime();

    return {
      isRunning: state.isRunning,
      mode: config.paperTrading ? 'paper' : 'live',
      pair: config.tradingPair,
      currentPrice: state.currentPrice,
      balanceEur: state.balanceEur,
      balanceBtc: state.balanceBtc,
      portfolioValue,
      totalPnl: state.totalPnl,
      totalFees: state.totalFees,
      makerFeePct: config.makerFeePct,
      openOrders: state.openOrders.map(o => ({
        id: o.id,
        side: o.side,
        price: o.price,
        amountBtc: o.amountBtc,
        amountEur: o.amountEur,
        gridLevel: o.gridLevel,
      })),
      trades: state.trades.slice(-50).reverse(),
      grid: {
        low: state.gridLow,
        high: state.gridHigh,
        interval: state.gridInterval,
        atr: state.atr,
        levels: config.grid.levels,
      },
      uptime,
      lastGridUpdate: state.lastGridUpdate,
      startedAt: state.startedAt,
      pnlHistory: getPnlHistory(),
    };
  } catch {
    return {
      isRunning: false,
      mode: config.paperTrading ? 'paper' : 'live',
      pair: config.tradingPair,
      currentPrice: 0,
      balanceEur: config.startingBalance.eur,
      balanceBtc: config.startingBalance.btc,
      portfolioValue: config.startingBalance.eur,
      totalPnl: 0,
      totalFees: 0,
      makerFeePct: config.makerFeePct,
      openOrders: [],
      trades: [],
      grid: { low: 0, high: 0, interval: 0, atr: 0, levels: config.grid.levels },
      uptime: 0,
      lastGridUpdate: null,
      startedAt: null,
      pnlHistory: [],
    };
  }
}
