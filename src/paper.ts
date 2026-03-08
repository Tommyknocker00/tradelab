import logger from './logger';
import { getState, fillOrder, recordTrade, addOrder, GridOrder } from './state';
import { config } from './config';

/**
 * Simulate order execution against the current market price.
 * Checks all open orders and fills any that would have triggered.
 */
export function simulateOrderFills(currentPrice: number): void {
  const state = getState();
  state.currentPrice = currentPrice;
  const feeRate = config.makerFeePct / 100;

  const ordersToFill = state.openOrders.filter((order) => {
    if (order.side === 'buy' && currentPrice <= order.price) {
      return state.balanceEur >= order.amountEur;
    }
    if (order.side === 'sell' && currentPrice >= order.price) {
      return state.balanceBtc >= order.amountBtc;
    }
    return false;
  });

  for (const order of ordersToFill) {
    const stateNow = getState();
    if (order.side === 'buy' && stateNow.balanceEur < order.amountEur) continue;
    if (order.side === 'sell' && stateNow.balanceBtc < order.amountBtc) continue;

    const filled = fillOrder(order.id, currentPrice, feeRate);
    if (!filled) continue;

    if (filled.side === 'buy') {
      logger.info(
        `[PAPER] Order gevuld: KOOP ${filled.amountBtc.toFixed(8)} BTC @ €${filled.price.toFixed(2)} (fee: ${config.makerFeePct}%)`,
      );
      placeCounterOrder(filled, currentPrice);
    } else {
      logger.info(
        `[PAPER] Order gevuld: VERKOOP ${filled.amountBtc.toFixed(8)} BTC @ €${filled.price.toFixed(2)} (fee: ${config.makerFeePct}%)`,
      );
      const buyOrder = findMatchingBuyOrder(filled);
      if (buyOrder) {
        const trade = recordTrade(buyOrder.price, filled.price, filled.amountBtc, feeRate);
        logger.info(
          `[PAPER] Winst: €${trade.profitEur.toFixed(4)} (fees: €${trade.feesEur.toFixed(4)}) | Totaal P&L: ${state.totalPnl >= 0 ? '+' : ''}€${state.totalPnl.toFixed(4)}`,
        );
      }
      placeCounterOrder(filled, currentPrice);
    }
  }
}

/**
 * After a fill, place a counter order on the opposite side.
 * Buy fill -> place sell one grid level up.
 * Sell fill -> place buy one grid level down.
 */
function placeCounterOrder(filledOrder: GridOrder, _currentPrice: number): void {
  const state = getState();
  const interval = state.gridInterval;

  if (interval <= 0) return;

  const counterSide: 'buy' | 'sell' = filledOrder.side === 'buy' ? 'sell' : 'buy';
  const counterPrice =
    filledOrder.side === 'buy'
      ? filledOrder.price + interval
      : filledOrder.price - interval;

  if (counterPrice <= 0) return;
  if (counterPrice < state.gridLow || counterPrice > state.gridHigh) return;

  const amountBtc = config.orderSizeEur / counterPrice;
  const counterOrder: GridOrder = {
    id: `grid-${Date.now()}-counter-${Math.random().toString(36).slice(2, 6)}`,
    side: counterSide,
    price: Math.round(counterPrice * 100) / 100,
    amountBtc,
    amountEur: config.orderSizeEur,
    gridLevel: filledOrder.gridLevel,
    status: 'open',
    createdAt: new Date(),
  };

  addOrder(counterOrder);
  logger.info(
    `[PAPER] ${counterSide === 'buy' ? 'Koop' : 'Verkoop'}-order geplaatst op €${counterOrder.price.toFixed(2)} (€${config.orderSizeEur})`,
  );
}

function findMatchingBuyOrder(sellOrder: GridOrder): GridOrder | undefined {
  const state = getState();
  return state.filledOrders
    .filter((o) => o.side === 'buy' && o.gridLevel === sellOrder.gridLevel)
    .sort((a, b) => (b.filledAt?.getTime() ?? 0) - (a.filledAt?.getTime() ?? 0))[0];
}

export function logPaperStatus(): void {
  const state = getState();
  const portfolioValue = state.balanceEur + state.balanceBtc * state.currentPrice;

  logger.info('─'.repeat(60));
  logger.info(`[PAPER] Status Report`);
  logger.info(`  BTC/EUR prijs: €${state.currentPrice.toFixed(2)}`);
  logger.info(`  Balans EUR: €${state.balanceEur.toFixed(2)}`);
  logger.info(`  Balans BTC: ${state.balanceBtc.toFixed(8)}`);
  logger.info(`  Portfolio waarde: €${portfolioValue.toFixed(2)}`);
  logger.info(`  Open orders: ${state.openOrders.length}`);
  logger.info(`  Completed trades: ${state.trades.length}`);
  logger.info(`  Totaal fees: €${state.totalFees.toFixed(4)}`);
  logger.info(`  Totaal P&L (na fees): ${state.totalPnl >= 0 ? '+' : ''}€${state.totalPnl.toFixed(4)}`);
  logger.info('─'.repeat(60));
}
