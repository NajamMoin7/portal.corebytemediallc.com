import { NextResponse } from 'next/server';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';
import { EmailTakenError, createUser, listUsers, validateUserInput } from '@/lib/users';

/**
 * GET  /api/agents — every user, for the super admin's management table.
 * POST /api/agents — create an agent (or another super admin).
 *
 * Both are super-admin only. Agents have no reason to read the staff list and
 * every check runs here on the server, not only in the UI.
 */

async function guard() {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ ok: false, message: 'Your session has expired. Sign in again.' }, { status: 401 }) };
  }
  if (!isSuperAdmin(user)) {
    return { response: NextResponse.json({ ok: false, message: 'Only a super admin can manage agents.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const { user, response } = await guard();
  if (response) return response;

  try {
    return NextResponse.json({ ok: true, users: await listUsers(), me: user.id });
  } catch (error) {
    console.error('[agents] list failed', error);
    return NextResponse.json({ ok: false, message: 'Could not reach the database.' }, { status: 503 });
  }
}

export async function POST(request) {
  const { user, response } = await guard();
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
  }

  const input = {
    name: body?.name,
    email: body?.email,
    password: body?.password,
    role: body?.role === 'superadmin' ? 'superadmin' : 'agent',
    status: body?.status === 'inactive' ? 'inactive' : 'active',
  };

  const { valid, errors } = validateUserInput(input, { requirePassword: true });
  if (!valid) {
    return NextResponse.json({ ok: false, message: 'Check the highlighted fields.', errors }, { status: 422 });
  }

  try {
    const created = await createUser({ ...input, createdBy: user.email });
    return NextResponse.json({ ok: true, user: created }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return NextResponse.json(
        { ok: false, message: error.message, errors: { email: 'That email already has an account.' } },
        { status: 409 },
      );
    }
    console.error('[agents] create failed', error);
    return NextResponse.json({ ok: false, message: 'Could not save the agent.' }, { status: 503 });
  }
}
