import crypto from 'node:crypto';

const COOKIE_NAME = 'alegladi_brain_session';
const MAX_AGE_SECONDS = 60 * 60 * 12;

function safeEqual(a = '', b = '') {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function secret() {
  const value = process.env.BRAIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('BRAIN_SESSION_SECRET_NOT_CONFIGURED');
  return value;
}

function sign(exp) {
  return crypto.createHmac('sha256', secret()).update(String(exp)).digest('hex');
}

function parseCookies(req) {
  const raw = req.headers?.cookie || '';
  return Object.fromEntries(raw.split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=');
    return [decodeURIComponent(x.slice(0, i)), decodeURIComponent(x.slice(i + 1))];
  }));
}

export function verifyPassword(input) {
  const expected = process.env.BRAIN_PASSWORD;
  if (!expected) throw new Error('BRAIN_PASSWORD_NOT_CONFIGURED');
  return safeEqual(input, expected);
}

export function createSessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const value = `${exp}.${sign(exp)}`;
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function isAuthenticated(req) {
  try {
    const value = parseCookies(req)[COOKIE_NAME];
    if (!value) return false;
    const [expRaw, signature] = value.split('.');
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    return safeEqual(signature, sign(exp));
  } catch {
    return false;
  }
}

export function requireAuth(req, res) {
  if (isAuthenticated(req)) return true;
  res.status(401).json({ error: 'UNAUTHORIZED' });
  return false;
}
