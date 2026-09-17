import { TIMEZONE } from '@/data/site';
import { cn, formatPrice } from '@/lib/utils';
import Notice from './ui/Notice';
import Panel from './ui/Panel';

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
];

/**
 * Who charged what: one row per agent, one column per period. The leader in
 * each column is highlighted in gold; a totals row closes the table. Data
 * comes from `agentStats()` in lib/orders-db.js.
 */
export default function AgentStats({ rows = [], error = null, className = '' }) {
  if (error) {
    return (
      <Notice tone="error" title="Agent totals are unavailable">
        {error}
      </Notice>
    );
  }

  const totals = Object.fromEntries(
    PERIODS.map(({ key }) => [
      key,
      rows.reduce(
        (sum, row) => ({ total: sum.total + row[key].total, count: sum.count + row[key].count }),
        { total: 0, count: 0 },
      ),
    ]),
  );
  const leaders = Object.fromEntries(
    PERIODS.map(({ key }) => {
      const best = Math.max(0, ...rows.map((row) => row[key].total));
      return [key, best > 0 ? best : null];
    }),
  );

  return (
    <Panel className={cn('overflow-x-auto p-0', className)}>
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-line/60 text-left text-[0.65rem] uppercase tracking-[0.16em] text-faint">
            <th scope="col" className="px-5 py-4 font-medium">
              Agent
            </th>
            {PERIODS.map(({ key, label }) => (
              <th key={key} scope="col" className="px-5 py-4 text-right font-medium">
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
              {PERIODS.map(({ key }) => (
                <Cell key={key} period={row[key]} leader={leaders[key] !== null && row[key].total === leaders[key]} />
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line/60 bg-white/[0.02]">
            <th scope="row" className="px-5 py-4 text-left text-xs uppercase tracking-[0.14em] text-muted">
              Total
            </th>
            {PERIODS.map(({ key }) => (
              <Cell key={key} period={totals[key]} strong />
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

function Cell({ period, leader = false, strong = false }) {
  const empty = period.count === 0;
  return (
    <td className="px-5 py-4 text-right tabular-nums">
      <span className={cn('block', strong ? 'font-semibold text-gold' : leader ? 'text-gold' : empty ? 'text-faint' : 'text-cream')}>
        {formatPrice(period.total)}
      </span>
      <span className="block text-xs text-faint">
        {period.count} order{period.count === 1 ? '' : 's'}
      </span>
    </td>
  );
}
