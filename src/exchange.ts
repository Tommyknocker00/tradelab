import logger from './logger';
import { config } from './config';
import { Candle } from './indicators';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bitvavo = require('bitvavo')().options({
  APIKEY: config.bitvavo.apiKey,
  APISECRET: config.bitvavo.apiSecret,
  ACCESSWINDOW: 10000,
  DEBUGGING: false,
});

export interface TickerPrice {
  market: string;
  price: string;
}

export interface BitvavoOrder {
  orderId: string;
  market: string;
  created: number;
  updated: number;
  status: string;
  side: string;
  orderType: string;
  amount: string;
  amountRemaining: string;
  price: string;
  amountQuote?: string;
  filledAmount?: string;
  filledAmountQuote?: string;
}

export interface Balance {
  symbol: string;
  available: string;
  inOrder: string;
}

export async function getCandles(
  market: string,
  interval: string,
  limit: number,
): Promise<Candle[]> {
  try {
    const raw: Array<[number, string, string, string, string, string]> =
      await bitvavo.candles(market, interval, { limit });

    return raw.map((c) => ({
      timestamp: c[0],
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
    })).reverse(); // API returns newest first; we want chronological
  } catch (err) {
    logger.error(`Failed to fetch candles: ${err}`);
    throw err;
  }
}

export async function getCurrentPrice(market: string): Promise<number> {
  try {
    const ticker: TickerPrice = await bitvavo.tickerPrice({ market });
    return parseFloat(ticker.price);
  } catch (err) {
    logger.error(`Failed to fetch ticker price: ${err}`);
    throw err;
  }
}

export async function placeLimitOrder(
  market: string,
  side: 'buy' | 'sell',
  amount: string,
  price: string,
): Promise<BitvavoOrder> {
  try {
    const response = await bitvavo.placeOrder(market, side, 'limit', {
      amount,
      price,
      postOnly: true,
    });
    logger.info(`[LIVE] ${side.toUpperCase()} order placed: ${amount} @ €${price}`);
    return response;
  } catch (err) {
    logger.error(`Failed to place ${side} order: ${err}`);
    throw err;
  }
}

export async function cancelExchangeOrder(
  market: string,
  orderId: string,
): Promise<void> {
  try {
    await bitvavo.cancelOrder(market, orderId);
    logger.info(`[LIVE] Order ${orderId} cancelled`);
  } catch (err) {
    logger.error(`Failed to cancel order ${orderId}: ${err}`);
    throw err;
  }
}

export async function getOpenOrders(market: string): Promise<BitvavoOrder[]> {
  try {
    return await bitvavo.ordersOpen({ market });
  } catch (err) {
    logger.error(`Failed to fetch open orders: ${err}`);
    throw err;
  }
}

export async function getBalance(symbol: string): Promise<Balance> {
  try {
    const balances: Balance[] = await bitvavo.balance({ symbol });
    return balances[0];
  } catch (err) {
    logger.error(`Failed to fetch balance for ${symbol}: ${err}`);
    throw err;
  }
}

export function getRemainingLimit(): number {
  return bitvavo.getRemainingLimit();
}
