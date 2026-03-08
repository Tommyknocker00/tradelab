import dotenv from 'dotenv';
dotenv.config();

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing env var: ${key}`);
  return val;
}

function envNum(key: string, fallback?: number): number {
  const raw = process.env[key];
  if (raw !== undefined) return Number(raw);
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing env var: ${key}`);
}

function envBool(key: string, fallback?: boolean): boolean {
  const raw = process.env[key];
  if (raw !== undefined) return raw === 'true';
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing env var: ${key}`);
}

export const config = {
  bitvavo: {
    apiKey: env('BITVAVO_API_KEY', ''),
    apiSecret: env('BITVAVO_API_SECRET', ''),
  },
  tradingPair: env('TRADING_PAIR', 'BTC-EUR'),
  paperTrading: envBool('PAPER_TRADING', true),
  grid: {
    levels: envNum('GRID_LEVELS', 10),
    atrPeriod: envNum('GRID_ATR_PERIOD', 14),
    atrMultiplier: envNum('GRID_ATR_MULTIPLIER', 1.5),
  },
  orderSizeEur: envNum('ORDER_SIZE_EUR', 5),
  checkIntervalMinutes: envNum('CHECK_INTERVAL_MINUTES', 60),
  startingBalance: {
    eur: envNum('STARTING_BALANCE_EUR', 100),
    /** Static BTC amount (legacy). Ignored when btcEur > 0. */
    btc: envNum('STARTING_BALANCE_BTC', 0),
    /** EUR value to put in BTC — calculated from live price at start/reset. E.g. 50 = €50 worth of BTC. */
    btcEur: envNum('STARTING_BALANCE_BTC_EUR', 0),
  },
  makerFeePct: envNum('MAKER_FEE_PCT', 0.15),
  dashboardPort: envNum('DASHBOARD_PORT', 3000),
  dashboardPassword: env('DASHBOARD_PASSWORD', ''),
  sessionSecret: env('SESSION_SECRET', ''),
  /** Webhook URL voor alerts (Discord, ntfy.sh, etc). Leeg = geen webhook. */
  alertWebhookUrl: env('ALERT_WEBHOOK_URL', ''),
  /** E-mailadres voor alerts. Leeg = geen e-mailmeldingen. */
  alertEmail: env('ALERT_EMAIL', ''),
  /** Resend API key (https://resend.com). Gebruikt HTTPS in plaats van SMTP — werkt beter vanaf VPS. 100 e-mails/dag gratis. */
  resendApiKey: env('RESEND_API_KEY', ''),
  smtp: {
    host: env('SMTP_HOST', 'smtp.office365.com'),
    port: envNum('SMTP_PORT', 587),
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
  },
} as const;
