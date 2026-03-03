export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * True Range for a single candle is the greatest of:
 *   - high - low
 *   - |high - previous close|
 *   - |low  - previous close|
 * For the first candle in the series, TR = high - low.
 */
export function trueRange(candle: Candle, prevClose?: number): number {
  const hl = candle.high - candle.low;
  if (prevClose === undefined) return hl;
  return Math.max(hl, Math.abs(candle.high - prevClose), Math.abs(candle.low - prevClose));
}

/**
 * Average True Range (ATR) — simple moving average of True Range
 * over the given period. Requires at least `period` candles.
 */
export function calculateATR(candles: Candle[], period: number): number {
  if (candles.length < period) {
    throw new Error(`Need at least ${period} candles for ATR, got ${candles.length}`);
  }

  const relevantCandles = candles.slice(-period - 1);
  let sum = 0;
  let count = 0;

  for (let i = 1; i < relevantCandles.length; i++) {
    sum += trueRange(relevantCandles[i], relevantCandles[i - 1].close);
    count++;
  }

  if (count < period) {
    sum += trueRange(relevantCandles[0]);
    count++;
  }

  return sum / count;
}
