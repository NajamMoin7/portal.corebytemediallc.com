import OrderHistory from '@/components/OrderHistory';
import PageHeader from '@/components/PageHeader';
import ReportPicker, { ReportDownloads } from '@/components/ReportPicker';
import Notice from '@/components/ui/Notice';
import Panel from '@/components/ui/Panel';
import { requireSuperAdmin } from '@/lib/auth';
import { listReportPeriods } from '@/lib/orders-db';
import { buildReport, parsePeriod, periodLabel } from '@/lib/reports';
import { formatPrice } from '@/lib/utils';

export const metadata = {
  title: 'Reports',
};

export const dynamic = 'force-dynamic';

/** "2026-09" → "September 2026", for the picker's labels. */
const labelled = (entries, type) =>
  entries.map((entry) => ({ ...entry, label: periodLabel({ type, value: entry.value }) }));

export default async function ReportsPage({ searchParams }) {
  await requireSuperAdmin();

  const { period: periodParam, value: valueParam } = await searchParams;

  let periods = { months: [], years: [] };
  let loadError = null;
  try {
    periods = await listReportPeriods();
  } catch (error) {
    console.error('[reports] could not list periods', error);
    loadError = 'Could not reach the database. Check MONGODB_URI and the Atlas network access list.';
  }

  const months = labelled(periods.months, 'month');
  const years = labelled(periods.years, 'year');
  const periodType = periodParam === 'year' ? 'year' : 'month';

  // Fall back to the most recent period with orders in it, so the page opens
  // on something useful rather than an empty picker.
  const fallback = (periodType === 'year' ? years : months)[0]?.value;
  const period = parsePeriod(periodType, valueParam ?? fallback);

  const report = period ? await buildReport(period) : null;

  return (
    <div className="container-page py-10 lg:py-14">
      <PageHeader
        eyebrow="Super admin"
        title="Reports"
        description="Month-by-month and year-by-year takings, with the orders behind them. Download either as a CSV for your records."
        className="mb-10"
      />

      {loadError && (
        <Notice tone="error" title="Reports are unavailable">
          {loadError}
        </Notice>
      )}

      {!loadError && months.length === 0 && (
        <Notice tone="info" title="No orders yet">
          Reports appear here as soon as the first order is charged.
        </Notice>
      )}

      {!loadError && months.length > 0 && (
        <div className="space-y-10">
          <Panel className="space-y-6">
            <ReportPicker periodType={periodType} value={period?.value ?? ''} months={months} years={years} />
            {period && <ReportDownloads period={period} disabled={report?.totals.count === 0} />}
          </Panel>

          {report && (
            <>
              <section className="grid gap-5 sm:grid-cols-3">
                <Summary label="Period" value={periodLabel(report.period)} />
                <Summary label="Orders" value={report.totals.count.toLocaleString()} />
                <Summary label="Total charged" value={formatPrice(report.totals.total)} gold />
              </section>

              <section className="space-y-5">
                <h2 className="eyebrow">By agent</h2>
                <Panel className="overflow-x-auto p-0">
                  <table className="w-full min-w-[28rem] text-sm">
                    <thead>
                      <tr className="border-b border-line/60 text-left text-[0.65rem] uppercase tracking-[0.16em] text-faint">
                        <th scope="col" className="px-5 py-4 font-medium">Agent</th>
                        <th scope="col" className="px-5 py-4 text-right font-medium">Orders</th>
                        <th scope="col" className="px-5 py-4 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byAgent.map((row) => (
                        <tr key={row.agent} className="border-b border-line/40 last:border-0">
                          <th scope="row" className="px-5 py-4 text-left font-medium text-cream">{row.agent}</th>
                          <td className="px-5 py-4 text-right tabular-nums text-muted">{row.count}</td>
                          <td className="px-5 py-4 text-right tabular-nums text-cream">{formatPrice(row.total)}</td>
                        </tr>
                      ))}
                      {report.byAgent.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-sm text-faint">
                            No orders in {periodLabel(report.period)}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-line/60 bg-white/[0.02]">
                        <th scope="row" className="px-5 py-4 text-left text-xs uppercase tracking-[0.14em] text-muted">
                          Total
                        </th>
                        <td className="px-5 py-4 text-right tabular-nums text-muted">{report.totals.count}</td>
                        <td className="px-5 py-4 text-right font-semibold tabular-nums text-gold">
                          {formatPrice(report.totals.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </Panel>
              </section>

              <section className="space-y-5">
                <h2 className="eyebrow">Orders in {periodLabel(report.period)}</h2>
                {report.truncated && (
                  <Notice tone="warning" title="Long period">
                    Showing the most recent {report.records.length} of {report.totals.count} orders. The CSV download
                    has the same limit — export month by month for a complete set.
                  </Notice>
                )}
                <OrderHistory records={report.records} total={report.totals.count} compact />
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Summary({ label, value, gold = false }) {
  return (
    <Panel className="space-y-1.5 py-6">
      <p className="eyebrow">{label}</p>
      <p className={`font-display text-2xl ${gold ? 'text-gold' : 'text-cream'}`}>{value}</p>
    </Panel>
  );
}
