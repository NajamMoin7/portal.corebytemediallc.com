import { TIMEZONE } from '@/data/site';
import { cn, formatPrice } from '@/lib/utils';
import Notice from './ui/Notice';
import Panel from './ui/Panel';

/** Used when a caller does not pass labels (they come from statPeriodLabels). */
const FALLBACK_PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'prevMonth', label: 'Previous Month' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'Year' },
];

/**
 * Who charged what: one row per agent, one column per period.
 *
 * The two month columns sit next to each other on purpose — last month beside
 * this month is the comparison people actually want, and the change between
 * them is spelled out under the current figure. Column headings name the
 * months ("Previous Month (Aug)"), so they stay meaningful as the calendar
 * rolls forward.
 *
 * Data comes from `agentStats()` and `statPeriodLabels()` in lib/orders-db.js.
 */
export default function AgentStats({ rows = [], periods = FALLBACK_PERIODS, error = null, className = '' }) {
  if (error) {
    return (
      <Notice tone="error" title="Agent totals are unavailable">
        {error}
      </Notice>
    );
  }

  const totals = Object.fromEntries(
    periods.map(({ key }) => [
      key,
      rows.reduce(
        (sum, row) => ({ total: sum.total + row[key].total, count: sum.count + row[key].count }),
        { total: 0, count: 0 },
      ),
    ]),
  );

  // The best figure in each column, so the leader can be picked out in gold.
  const leaders = Object.fromEntries(
    periods.map(({ key }) => {
      const best = Math.max(0, ...rows.map((row) => row[key].total));
      return [key, best > 0 ? best : null];
    }),
  );

  return (
    <Panel className={cn('overflow-x-auto p-0', className)}>
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-line/60 text-left text-[0.65rem] uppercase tracking-[0.16em] text-faint">
            <th scope="col" className="px-5 py-4 font-medium">
              Agent
            </th>
            {periods.map(({ key, label }) => (
              <th
                key={key}
                scope="col"
                className={cn('px-5 py-4 text-right font-medium', key === 'month' && 'text-gold/70')}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.agent} className="border-b border-line/40 last:border-0">
              <th scope="row" className="px-5 py-4 text-left font-medium text-cream">
                {row.agent}
              </th>
              {periods.map(({ key }) => (
                <Cell
                  key={key}
                  period={row[key]}
                  leader={leaders[key] !== null && row[key].total === leaders[key]}
                  // Only the current month is compared — the others have no
                  // natural "previous" to measure against.
                  previous={key === 'month' ? row.prevMonth : null}
                />
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={periods.length + 1} className="px-5 py-8 text-center text-sm text-faint">
                No orders yet.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-line/60 bg-white/[0.02]">
            <th scope="row" className="px-5 py-4 text-left text-xs uppercase tracking-[0.14em] text-muted">
              Total
            </th>
            {periods.map(({ key }) => (
              <Cell key={key} period={totals[key]} previous={key === 'month' ? totals.prevMonth : null} strong />
            ))}
          </tr>
        </tfoot>
      </table>
      <p className="border-t border-line/40 px-5 py-3 text-xs text-faint">
        Approved charges only. Days, months and years follow {TIMEZONE.replace('_', ' ')} time.
      </p>
    </Panel>
  );
}

function Cell({ period, leader = false, strong = false, previous = null }) {
  const empty = period.count === 0;
  return (
    <td className="px-5 py-4 text-right tabular-nums">
      <span className={cn('block', strong ? 'font-semibold text-gold' : leader ? 'text-gold' : empty ? 'text-faint' : 'text-cream')}>
        {formatPrice(period.total)}
      </span>
      <span className="block text-xs text-faint">
        {period.count} order{period.count === 1 ? '' : 's'}
      </span>
      {previous && <Change current={period.total} previous={previous.total} />}
    </td>
  );
}

/**
 * Month-on-month movement, as an amount and a percentage.
 *
 * Coming off a month with nothing in it there is no meaningful percentage, so
 * only the amount is shown — a jump from £0 is not "+100%".
 */
function Change({ current, previous }) {
  const difference = Math.round((current - previous) * 100) / 100;
  if (difference === 0) {
    return <span className="mt-0.5 block text-[0.7rem] text-faint">Level with last month</span>;
  }

  const up = difference > 0;
  const percent = previous > 0 ? Math.round((difference / previous) * 100) : null;

  return (
    <span className={cn('mt-0.5 block text-[0.7rem]', up ? 'text-emerald-400' : 'text-red-400')}>
      {up ? '▲' : '▼'} {formatPrice(Math.abs(difference))}
      {percent !== null && ` (${up ? '+' : '−'}${Math.abs(percent)}%)`}
    </span>
  );
}
