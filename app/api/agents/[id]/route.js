import { NextResponse } from 'next/server';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';
import {
  EmailTakenError,
  archiveUser,
  countSuperAdmins,
  findUserById,
  restoreUser,
  updateUser,
  validateUserInput,
} from '@/lib/users';

/**
 * PATCH  /api/agents/[id] — update name, email, password, role or status,
 *                           or `{ action: 'restore' }` to un-archive.
 * DELETE /api/agents/[id] — archive the account.
 *
 * DELETE never removes the document: the user is marked archived and
 * deactivated, so they can no longer sign in while their record and every
 * order they took stay in the database.
 *
 * Both are super-admin only, and both refuse changes that would leave the
 * portal with no way in (see `wouldLockOut`).
 */

async function guard(params) {
  const actor = await getCurrentUser();
  if (!actor) {
    return { response: NextResponse.json({ ok: false, message: 'Your session has expired. Sign in again.' }, { status: 401 }) };
  }
  if (!isSuperAdmin(actor)) {
    return { response: NextResponse.json({ ok: false, message: 'Only a super admin can manage agents.' }, { status: 403 }) };
  }

  const { id } = await params;
  const target = await findUserById(id);
  if (!target) {
    return { response: NextResponse.json({ ok: false, message: 'That account no longer exists.' }, { status: 404 }) };
  }
  return { actor, target, id };
}

/**
 * True when the change would remove the last active super admin — demoting,
 * deactivating or archiving them would leave nobody able to manage the portal.
 */
async function wouldLockOut(target, { role, status, archiving = false } = {}) {
  if (target.role !== 'superadmin' || target.status !== 'active' || target.archived) return false;
  const stillAdmin = !archiving && (role ?? target.role) === 'superadmin' && (status ?? target.status) === 'active';
  if (stillAdmin) return false;
  return (await countSuperAdmins({ excludeId: target.id })) === 0;
}

const LOCKOUT_MESSAGE =
  'This is the only active super admin. Give another account the super admin role first.';

export async function PATCH(request, { params }) {
  const { actor, target, id, response } = await guard(params);
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
  }

  if (body?.action === 'restore') {
    const restored = await restoreUser(id);
    return NextResponse.json({ ok: true, user: restored });
  }

  const patch = {};
  if (body?.name !== undefined) patch.name = body.name;
  if (body?.email !== undefined) patch.email = body.email;
  if (body?.password) patch.password = body.password;
  if (body?.role !== undefined) patch.role = body.role;
  if (body?.status !== undefined) patch.status = body.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: 'Nothing to update.' }, { status: 400 });
  }

  const { valid, errors } = validateUserInput(
    { name: patch.name ?? target.name, email: patch.email ?? target.email, password: patch.password, role: patch.role, status: patch.status },
    { requirePassword: false },
  );
  if (!valid) {
    return NextResponse.json({ ok: false, message: 'Check the highlighted fields.', errors }, { status: 422 });
  }

  // A super admin may change their own name, email or password, but must not
  // lock themselves out by demoting or deactivating their own account.
  if (target.id === actor.id && (patch.role === 'agent' || patch.status === 'inactive')) {
    return NextResponse.json(
      { ok: false, message: 'You cannot remove your own access. Ask another super admin to do it.' },
      { status: 409 },
    );
  }

  if (await wouldLockOut(target, { role: patch.role, status: patch.status })) {
    return NextResponse.json({ ok: false, message: LOCKOUT_MESSAGE }, { status: 409 });
  }

  try {
    return NextResponse.json({ ok: true, user: await updateUser(id, patch) });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return NextResponse.json(
        { ok: false, message: error.message, errors: { email: 'That email already has an account.' } },
        { status: 409 },
      );
    }
    console.error('[agents] update failed', error);
    return NextResponse.json({ ok: false, message: 'Could not save the changes.' }, { status: 503 });
  }
}

export async function DELETE(request, { params }) {
  const { actor, target, id, response } = await guard(params);
  if (response) return response;

  if (target.id === actor.id) {
    return NextResponse.json({ ok: false, message: 'You cannot archive your own account.' }, { status: 409 });
  }

  if (await wouldLockOut(target, { archiving: true })) {
    return NextResponse.json({ ok: false, message: LOCKOUT_MESSAGE }, { status: 409 });
  }

  try {
    const archived = await archiveUser(id);
    return NextResponse.json({
      ok: true,
      user: archived,
      message: `${archived.name} can no longer sign in. Their orders are unchanged.`,
    });
  } catch (error) {
    console.error('[agents] archive failed', error);
    return NextResponse.json({ ok: false, message: 'Could not archive the account.' }, { status: 503 });
  }
}
