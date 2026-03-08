import nodemailer from 'nodemailer';
import logger from './logger';
import { config } from './config';

const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // max 1x per uur per type
const lastAlert: Record<string, number> = {};

function shouldAlert(type: string): boolean {
  const now = Date.now();
  const last = lastAlert[type] ?? 0;
  if (now - last < ALERT_COOLDOWN_MS) return false;
  lastAlert[type] = now;
  return true;
}

function hasEmailConfig(): boolean {
  return Boolean(
    config.alertEmail?.trim() &&
      config.smtp.user?.trim() &&
      config.smtp.pass?.trim()
  );
}

export function hasAlertsEnabled(): boolean {
  return Boolean(config.alertWebhookUrl?.trim() || hasEmailConfig());
}

export async function sendTestAlert(): Promise<{ ok: boolean; message: string }> {
  if (!hasEmailConfig()) {
    return { ok: false, message: 'E-mail niet geconfigureerd. Vul ALERT_EMAIL, SMTP_USER en SMTP_PASS in.' };
  }
  try {
    await sendEmail('TradeLab: Testmelding', `
      <h2>TradeLab testmelding</h2>
      <p>Als je dit ontvangt, werkt de e-mailconfiguratie correct. Je ontvangt straks meldingen bij:</p>
      <ul>
        <li>EUR of BTC balans te laag</li>
        <li>API-fouten bij Bitvavo</li>
      </ul>
      <p><em>Deze test negeert de cooldown; echte alerts komen max 1× per uur per type.</em></p>
    `);
    return { ok: true, message: 'Test-e-mail verstuurd naar ' + config.alertEmail };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: 'Verzenden mislukt: ' + msg };
  }
}

async function sendEmail(subject: string, html: string): Promise<void> {
  if (!hasEmailConfig()) return;
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    await transporter.sendMail({
      from: `TradeLab <${config.smtp.user}>`,
      to: config.alertEmail,
      subject,
      html,
    });
  } catch (err) {
    logger.warn(`Email alert failed: ${err}`);
  }
}

async function postWebhook(text: string, extra: Record<string, unknown> = {}): Promise<void> {
  const url = config.alertWebhookUrl?.trim();
  if (!url) return;

  const isNtfy = url.includes('ntfy.sh');
  const { body, contentType } = isNtfy
    ? { body: text, contentType: 'text/plain' as const }
    : { body: JSON.stringify({ content: text, text, ...extra }), contentType: 'application/json' as const };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    });
    if (!res.ok) logger.warn(`Alert webhook failed: ${res.status}`);
  } catch (err) {
    logger.warn(`Alert webhook error: ${err}`);
  }
}

export async function alertLowEur(balanceEur: number, orderSize: number): Promise<void> {
  if (!shouldAlert('low_eur')) return;
  const msg = `TradeLab: EUR balans laag (€${balanceEur.toFixed(2)}). Minimaal €${orderSize} nodig per order. Geen kooporders meer mogelijk.`;
  logger.warn(msg);
  await postWebhook(msg, { type: 'low_eur', balanceEur, orderSizeEur: orderSize });
  if (hasEmailConfig()) {
    await sendEmail('TradeLab: EUR balans te laag', `
      <h2>TradeLab Alert</h2>
      <p><strong>Probleem:</strong> Je EUR balans is te laag (€${balanceEur.toFixed(2)}). Voor een order is minimaal €${orderSize} nodig. De bot kan geen kooporders meer plaatsen.</p>
      <p><strong>Wat te doen:</strong></p>
      <ul>
        <li>Stort EUR op je Bitvavo account (overschrijving vanuit je bank), <strong>of</strong></li>
        <li>Verkoop wat BTC voor EUR via Bitvavo om de balans aan te vullen.</li>
      </ul>
      <p>Na het verhogen van je EUR balans herstelt de bot zich automatisch.</p>
    `);
  }
}

export async function alertLowBtc(balanceBtc: number, btcValueEur: number, orderSize: number): Promise<void> {
  if (!shouldAlert('low_btc')) return;
  const msg = `TradeLab: BTC balans laag (€${btcValueEur.toFixed(2)}). Minimaal €${orderSize} nodig per order. Geen verkooporders meer mogelijk.`;
  logger.warn(msg);
  await postWebhook(msg, { type: 'low_btc', balanceBtc, btcValueEur, orderSizeEur: orderSize });
  if (hasEmailConfig()) {
    await sendEmail('TradeLab: BTC balans te laag', `
      <h2>TradeLab Alert</h2>
      <p><strong>Probleem:</strong> Je BTC balans is te laag (€${btcValueEur.toFixed(2)} waard). Voor een order is minimaal €${orderSize} nodig. De bot kan geen verkooporders meer plaatsen.</p>
      <p><strong>Wat te doen:</strong></p>
      <ul>
        <li>Koop meer BTC op Bitvavo om de balans aan te vullen, <strong>of</strong></li>
        <li>Verlaag je ORDER_SIZE_EUR in de config zodat de huidige BTC genoeg is.</li>
      </ul>
      <p>Bij paper trading: druk op <strong>RESET</strong> in het dashboard om opnieuw te beginnen met een 50/50 balans.</p>
    `);
  }
}

export async function alertApiError(operation: string, error: string): Promise<void> {
  if (!shouldAlert(`api_${operation}`)) return;
  const msg = `TradeLab: API fout bij ${operation}: ${error}`;
  logger.error(msg);
  await postWebhook(msg, { type: 'api_error', operation, error });
  if (hasEmailConfig()) {
    await sendEmail('TradeLab: API fout', `
      <h2>TradeLab Alert</h2>
      <p><strong>Probleem:</strong> Er ging iets mis bij ${operation}: ${error}</p>
      <p><strong>Wat te doen:</strong></p>
      <ul>
        <li>Controleer of Bitvavo bereikbaar is (<a href="https://bitvavo.com">bitvavo.com</a>).</li>
        <li>Check of je API keys nog geldig zijn (Bitvavo → Instellingen → API).</li>
        <li>Herstart de bot via het dashboard of de server.</li>
      </ul>
    `);
  }
}
