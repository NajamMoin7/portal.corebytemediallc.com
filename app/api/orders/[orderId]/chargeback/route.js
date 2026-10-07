import { NextResponse } from 'next/server';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';
import { clearChargeback, findOrderRecord, markChargeback } from '@/lib/orders-db';
import { CHARGEBACK_PENALTY } from '@/data/site';

/**
 * POST /api/orders/[orderId]/chargeback
 *
 * Body: `{ action: 'mark' | 'clear', reason }`.
 *
 * Super admin only. Marking records the fixed penalty against the agent who
 * took the order — read from the order itself, never from the request, so a
 * penalty cannot be aimed at the wrong person.
 *
 * Nothing is removed: clearing a chargeback stops the penalty counting but
 * the whole history stays in the order's `chargebackLog`.
 */
export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Your session has expired. Sign in again.' }, { status: 401 });
  }
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ ok: false, message: 'Only a super admin can record chargebacks.' }, { status: 403 });
  }

  const { orderId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
  }

  const action = body?.action === 'clear' ? 'clear' : 'mark';
  const reason = typeof body?.reason === 'string' ? body.reason : '';

  let existing;
  try {
    existing = await findOrderRecord(orderId);
  } catch (error) {
    console.error('[chargeback] lookup failed', error);
    return NextResponse.json({ ok: false, message: 'Could not reach the database.' }, { status: 503 });
  }

  if (!existing) {
    return NextResponse.json({ ok: false, message: 'That order no longer exists.' }, { status: 404 });
  }

  const alreadyMarked = existing.chargeback?.status === 'charged_back';
  if (action === 'mark' && alreadyMarked) {
    return NextResponse.json({ ok: false, message: 'That order is already marked as charged back.' }, { status: 409 });
  }
  if (action === 'clear' && !alreadyMarked) {
    return NextResponse.json({ ok: false, message: 'That order is not marked as charged back.' }, { status: 409 });
  }

  try {
    const record =
      action === 'mark'
        ? await markChargeback(orderId, { by: user.email, reason, penalty: CHARGEBACK_PENALTY })
        : await clearChargeback(orderId, { by: user.email, reason });

    return NextResponse.json({
      ok: true,
      record,
      message:
        action === 'mark'
          ? `Chargeback recorded against ${record.agent || 'the agent'} — $${CHARGEBACK_PENALTY} penalty.`
          : 'Chargeback cleared. The penalty no longer counts.',
    });
  } catch (error) {
    console.error('[chargeback] update failed', error);
    return NextResponse.json({ ok: false, message: 'Could not save the change.' }, { status: 503 });
  }
}
