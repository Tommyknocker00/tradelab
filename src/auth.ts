import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from './config';
import logger from './logger';

const SESSION_COOKIE = 'tradelab_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const activeSessions = new Map<string, number>(); // token → expiry timestamp

function isAuthEnabled(): boolean {
  return config.dashboardPassword.length > 0;
}

function getSecret(): string {
  return config.sessionSecret || config.dashboardPassword;
}

function createToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, Date.now() + SESSION_MAX_AGE);
  return token;
}

function isValidToken(token: string): boolean {
  const expiry = activeSessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  header.split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key && rest.length) cookies[key] = rest.join('=');
  });
  return cookies;
}

export function checkPassword(password: string): boolean {
  const expected = config.dashboardPassword;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function handleLogin(req: Request, res: Response): void {
  if (!isAuthEnabled()) {
    res.json({ success: true });
    return;
  }

  const { password } = req.body;
  if (!password || !checkPassword(password)) {
    logger.warn(`Failed login attempt from ${req.ip}`);
    res.status(401).json({ success: false, message: 'Incorrect password' });
    return;
  }

  const token = createToken();
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE,
  });

  logger.info(`Successful login from ${req.ip}`);
  res.json({ success: true });
}

export function handleLogout(_req: Request, res: Response): void {
  const cookies = parseCookies(_req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (token) activeSessions.delete(token);

  res.clearCookie(SESSION_COOKIE);
  res.json({ success: true });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthEnabled()) {
    next();
    return;
  }

  if (req.path === '/login' || req.path === '/login.html' || req.path === '/api/auth/login') {
    next();
    return;
  }

  // Serve login page assets without auth
  if (req.path === '/login.css') {
    next();
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];

  if (token && isValidToken(token)) {
    next();
    return;
  }

  if (req.path.startsWith('/api/')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.redirect('/login');
}

/**
 * Validate a WebSocket connection by checking the cookie header.
 */
export function isWsAuthenticated(cookieHeader: string | undefined): boolean {
  if (!isAuthEnabled()) return true;
  const cookies = parseCookies(cookieHeader);
  const token = cookies[SESSION_COOKIE];
  return !!token && isValidToken(token);
}
