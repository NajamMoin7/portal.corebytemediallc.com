import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Portal sessions.
 *
 * There is no user database: the single staff login is `PORTAL_EMAIL` /
 * `PORTAL_PASSWORD` from the environment, and a successful login sets a
 * signed, HttpOnly cookie. The cookie payload is `{ email, exp }` signed with
 * HMAC-SHA256 under `PORTAL_SESSION_SECRET`; nothing is stored server-side,
 * which suits a stateless Netlify deployment.
 *
 * Server-only module — it reads secrets and must never be imported by a
 * client component.
 */

export const SESSION_COOKIE = 'cbm_portal_session';

const DEFAULT_SESSION_HOURS = 12;

function sessionSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'PORTAL_SESSION_SECRET is missing or too short. Set a random value of at least 16 characters (openssl rand -hex 32).',
    );
  }
  return secret;
}

function sessionHours() {
  const hours = Number.parseFloat(process.env.PORTAL_SESSION_HOURS || '');
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_SESSION_HOURS;
}

/** True when the login credentials have been configured at all. */
export function isAuthConfigured() {
  return Boolean(
    process.env.PORTAL_EMAIL && process.env.PORTAL_PASSWORD && process.env.PORTAL_SESSION_SECRET,
  );
}

/**
 * Constant-time comparison. Both sides are hashed first so the buffers are
 * always the same length, which timingSafeEqual requires.
 */
function safeEqual(a, b) {
  const left = createHash('sha256').update(String(a)).digest();
  const right = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(left, right);
}

export function checkCredentials(email, password) {
  const expectedEmail = process.env.PORTAL_EMAIL || '';
  const expectedPassword = process.env.PORTAL_PASSWORD || '';
  if (!expectedEmail || !expectedPassword) return false;

  const emailMatches = safeEqual(String(email).trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const passwordMatches = safeEqual(String(password), expectedPassword);
  // Evaluate both so a wrong email costs the same time as a wrong password.
  return emailMatches && passwordMatches;
}

function sign(payload) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(email) {
  const exp = Date.now() + sessionHours() * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ email, exp }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  let expected;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  if (!safeEqual(signature, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session?.email || typeof session.exp !== 'number' || session.exp < Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/** Cookie options shared by login (set) and logout (clear). */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.round(sessionHours() * 60 * 60),
  };
}

/** The current session from the request cookies, or null. */
export async function getSession() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
