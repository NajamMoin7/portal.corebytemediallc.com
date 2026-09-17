import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  checkCredentials,
  createSessionToken,
  isAuthConfigured,
  sessionCookieOptions,
} from '@/lib/auth';

/**
 * Best-effort brute-force throttle: 10 failed attempts per IP per 15 minutes.
 * The map lives in the function instance's memory, so on Netlify it resets
 * whenever the instance is recycled — it slows an attacker down rather than
 * stopping one, which is proportionate for a single-user tool.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map();

function clientIp(request) {
  return (
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

function isThrottled(ip) {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    failures.set(ip, { first: Date.now(), count: 1 });
  } else {
    entry.count += 1;
  }
}

export async function POST(request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          'Portal login is not configured. Set PORTAL_EMAIL, PORTAL_PASSWORD and PORTAL_SESSION_SECRET.',
      },
      { status: 503 },
    );
  }

  const ip = clientIp(request);
  if (isThrottled(ip)) {
    return NextResponse.json(
      { ok: false, message: 'Too many failed attempts. Try again in 15 minutes.' },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
  }

  const email = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!checkCredentials(email, password)) {
    recordFailure(ip);
    return NextResponse.json({ ok: false, message: 'Incorrect email or password.' }, { status: 401 });
  }

  failures.delete(ip);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(email.trim().toLowerCase()), sessionCookieOptions());
  return response;
}
