import { NextResponse } from 'next/server';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';
import { REPORT_TYPES, buildReport, parsePeriod, reportCsv, reportFilename } from '@/lib/reports';

/**
 * GET /api/reports/export?period=month&value=2026-09&type=orders
 *
 * Streams a month's or year's orders back as a CSV download. Super admin
 * only — the file contains every customer's contact details.
 */
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Your session has expired. Sign in again.' }, { status: 401 });
  }
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ ok: false, message: 'Only a super admin can download reports.' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const period = parsePeriod(params.get('period'), params.get('value'));
  if (!period) {
    return NextResponse.json(
      { ok: false, message: 'Choose a month (2026-09) or a year (2026) to export.' },
      { status: 400 },
    );
  }

  const type = REPORT_TYPES.includes(params.get('type')) ? params.get('type') : 'orders';

  let csv;
  try {
    csv = reportCsv(await buildReport(period), type);
  } catch (error) {
    console.error('[reports] export failed', error);
    return NextResponse.json({ ok: false, message: 'Could not build the report.' }, { status: 503 });
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${reportFilename(period, type)}"`,
      // A report is a snapshot of live data; never let a proxy keep a copy.
      'Cache-Control': 'no-store',
    },
  });
}
