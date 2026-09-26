import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { canSignIn, findUserById } from './users';
import { isDatabaseConfigured } from './mongodb';

/**
 * Portal sessions.
 *
 * Everyone signs in with their own email and password from the `users`
 * collection (see lib/users.js). A successful login sets a signed, HttpOnly
 * cookie whose payload is `{ uid, exp }`, signed with HMAC-SHA256 under
 * `PORTAL_SESSION_SECRET`. Nothing is stored server-side, which suits a
 * stateless Netlify deployment.
 *
 * The cookie carries only the user id: the role, name and status are read
 * from the database on each request (`getCurrentUser`). That costs one
 * indexed lookup and means deactivating or archiving an agent takes effect
 * immediately instead of when their cookie happens to expire.
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

/** True when the portal has what it needs to sign anyone in. */
export function isAuthConfigured() {
  return Boolean(process.env.PORTAL_SESSION_SECRET) && isDatabaseConfigured();
}

/** Constant-time comparison of two strings of any length. */
function safeEqual(a, b) {
  const left = createHash('sha256').update(String(a)).digest();
  const right = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(left, right);
}

function sign(payload) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(userId) {
  const exp = Date.now() + sessionHours() * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ uid: String(userId), exp }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** The `{ uid, exp }` payload of a valid, unexpired token, or null. */
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
    if (!session?.uid || typeof session.exp !== 'number' || session.exp < Date.now()) {
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

/** The signed cookie payload, without touching the database. */
export async function getSession() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * The signed-in user, or null.
 *
 * Memoised per render pass with React's `cache`, so a layout and the page
 * inside it share one database lookup. Returns null when the cookie is
 * missing or stale, or when the account has since been switched off or
 * archived.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  let user;
  try {
    user = await findUserById(session.uid);
  } catch (error) {
    console.error('[auth] could not load the signed-in user', error);
    return null;
  }

  return canSignIn(user) ? user : null;
});

/** The signed-in user, or a redirect to the login page. For pages and layouts. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** As `requireUser`, but also sends non-admins back to the dashboard. */
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== 'superadmin') redirect('/dashboard');
  return user;
}

export function isSuperAdmin(user) {
  return user?.role === 'superadmin';
}
