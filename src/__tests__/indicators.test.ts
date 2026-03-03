import { trueRange, calculateATR, Candle } from '../indicators';

function makeCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    timestamp: Date.now(),
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1,
    ...overrides,
  };
}

describe('trueRange', () => {
  it('returns high - low when no previous close', () => {
    const candle = makeCandle({ high: 110, low: 90 });
    expect(trueRange(candle)).toBe(20);
  });

  it('returns high - low when it is the max', () => {
    const candle = makeCandle({ high: 110, low: 90 });
    expect(trueRange(candle, 100)).toBe(20);
  });

  it('uses |high - prevClose| when that is largest', () => {
    const candle = makeCandle({ high: 120, low: 105 });
    expect(trueRange(candle, 95)).toBe(25); // |120 - 95| = 25
  });

  it('uses |low - prevClose| when that is largest', () => {
    const candle = makeCandle({ high: 102, low: 80 });
    expect(trueRange(candle, 110)).toBe(30); // |80 - 110| = 30
  });
});

describe('calculateATR', () => {
  it('throws when insufficient candles', () => {
    const candles = [makeCandle(), makeCandle()];
    expect(() => calculateATR(candles, 14)).toThrow('Need at least 14 candles');
  });

  it('calculates ATR correctly for a known dataset', () => {
    const prices = [
      { high: 100, low: 90, close: 95 },
      { high: 105, low: 92, close: 100 },
      { high: 108, low: 97, close: 103 },
      { high: 107, low: 95, close: 96 },
      { high: 104, low: 91, close: 99 },
    ];

    const candles: Candle[] = prices.map((p, i) => ({
      timestamp: i,
      open: p.close,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: 1,
    }));

    const atr = calculateATR(candles, 4);
    expect(atr).toBeGreaterThan(0);
    expect(typeof atr).toBe('number');
    expect(Number.isFinite(atr)).toBe(true);
  });

  it('returns consistent results for identical candles', () => {
    const candle = makeCandle({ high: 100, low: 90, close: 95 });
    const candles = Array.from({ length: 15 }, () => ({ ...candle }));
    const atr = calculateATR(candles, 14);
    expect(atr).toBe(10);
  });

  it('increases with higher volatility', () => {
    const lowVol: Candle[] = Array.from({ length: 15 }, (_, i) => ({
      timestamp: i,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1,
    }));

    const highVol: Candle[] = Array.from({ length: 15 }, (_, i) => ({
      timestamp: i,
      open: 100,
      high: 120,
      low: 80,
      close: 100,
      volume: 1,
    }));

    const atrLow = calculateATR(lowVol, 14);
    const atrHigh = calculateATR(highVol, 14);
    expect(atrHigh).toBeGreaterThan(atrLow);
  });
});
