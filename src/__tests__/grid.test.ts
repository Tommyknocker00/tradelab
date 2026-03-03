import { calculateGrid } from '../grid';
import { Candle } from '../indicators';

jest.mock('../config', () => ({
  config: {
    grid: {
      levels: 10,
      atrPeriod: 14,
      atrMultiplier: 1.5,
    },
    orderSizeEur: 5,
  },
}));

jest.mock('../logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

function makeCandles(count: number, basePrice: number, volatility: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: i,
    open: basePrice,
    high: basePrice + volatility,
    low: basePrice - volatility,
    close: basePrice + (i % 2 === 0 ? volatility * 0.5 : -volatility * 0.5),
    volume: 1,
  }));
}

describe('calculateGrid', () => {
  const currentPrice = 85000;
  const candles = makeCandles(15, currentPrice, 1000);

  it('returns correct grid structure', () => {
    const grid = calculateGrid(currentPrice, candles);

    expect(grid).toHaveProperty('low');
    expect(grid).toHaveProperty('high');
    expect(grid).toHaveProperty('levels');
    expect(grid).toHaveProperty('interval');
    expect(grid).toHaveProperty('atr');
  });

  it('creates grid centered around current price', () => {
    const grid = calculateGrid(currentPrice, candles);

    expect(grid.low).toBeLessThan(currentPrice);
    expect(grid.high).toBeGreaterThan(currentPrice);
  });

  it('grid range is based on ATR * multiplier', () => {
    const grid = calculateGrid(currentPrice, candles);
    const expectedRange = grid.atr * 1.5;

    expect(grid.low).toBeCloseTo(currentPrice - expectedRange, 0);
    expect(grid.high).toBeCloseTo(currentPrice + expectedRange, 0);
  });

  it('creates buy levels below price and sell levels above', () => {
    const grid = calculateGrid(currentPrice, candles);

    const buyLevels = grid.levels.filter(l => l.side === 'buy');
    const sellLevels = grid.levels.filter(l => l.side === 'sell');

    for (const level of buyLevels) {
      expect(level.price).toBeLessThan(currentPrice);
    }
    for (const level of sellLevels) {
      expect(level.price).toBeGreaterThanOrEqual(currentPrice);
    }
  });

  it('creates the expected number of levels', () => {
    const grid = calculateGrid(currentPrice, candles);
    expect(grid.levels.length).toBe(11); // 10 levels + 1
  });

  it('levels are evenly spaced', () => {
    const grid = calculateGrid(currentPrice, candles);
    const prices = grid.levels.map(l => l.price).sort((a, b) => a - b);

    for (let i = 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      expect(diff).toBeCloseTo(grid.interval, 0);
    }
  });

  it('interval is correct relative to range and levels', () => {
    const grid = calculateGrid(currentPrice, candles);
    const expectedInterval = (grid.high - grid.low) / 10;
    expect(grid.interval).toBeCloseTo(expectedInterval, 0);
  });
});
