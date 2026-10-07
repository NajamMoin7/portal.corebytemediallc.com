import Link from 'next/link';
import { notFound } from 'next/navigation';
import AgentStats from '@/components/AgentStats';
import OrderHistory from '@/components/OrderHistory';
import PageHeader from '@/components/PageHeader';
import Badge from '@/components/ui/Badge';
import Notice from '@/components/ui/Notice';
import Panel from '@/components/ui/Panel';
import { AlertIcon, ArrowLeftIcon } from '@/components/ui/Icons';
import { requireSuperAdmin } from '@/lib/auth';
import { loadAgentStats, loadChargebackSummary, loadOrderHistory } from '@/lib/orders-db';
import { findUserById } from '@/lib/users';
import { cn, formatDateTime, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const agent = await findUserById(id).catch(() => null);
  return { title: agent ? agent.name : 'Agent' };
}

/**
 * One agent's profile: who they are, what they have taken, and every
 * chargeback recorded against them with the penalties they carry.
 *
 * Super admin only — an agent cannot open a colleague's record.
 */
export default async function AgentProfilePage({ params }) {
  await requireSuperAdmin();
  const { id } = await params;

  const agent = await findUserById(id).catch(() => null);
  if (!agent) notFound();

  const scope = { agent: { id: agent.id, name: agent.name } };
  const [stats, chargebacks, history] = await Promise.all([
    loadAgentStats(scope),
    loadChargebackSummary(scope),
    loadOrderHistory({ limit: 10, ...scope }),
  ]);

  const row = stats.rows[0];
  const takings = row?.year.total ?? 0;
  const net = Math.round((takings - chargebacks.penalty) * 100) / 100;

  return (
    <div className="container-page py-10 lg:py-14">
      <Link
        href="/agents"
        className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted hover:text-gold"
      >
        <ArrowLeftIcon size={14} />
        All agents
      </Link>

      <PageHeader
        eyebrow={agent.role === 'superadmin' ? 'Super admin' : 'Agent'}
        title={agent.name}
        description={agent.email}
        className="mb-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={agent.status === 'active' && !agent.archived ? 'outline' : 'muted'}>
            {agent.archived ? 'Archived' : agent.status === 'active' ? 'Active' : 'Inactive'}
          </Badge>
          <span className="text-xs text-faint">
            {agent.lastLoginAt ? `Last signed in ${formatDateTime(agent.lastLoginAt)}` : 'Never signed in'}
          </span>
        </div>
      </PageHeader>

      <section className="mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Charged this year" value={formatPrice(takings)} />
        <Summary label="Chargebacks" value={String(chargebacks.count)} tone={chargebacks.count > 0 ? 'bad' : 'plain'} />
        <Summary
          label="Penalties"
          value={formatPrice(chargebacks.penalty)}
          tone={chargebacks.penalty > 0 ? 'bad' : 'plain'}
        />
        <Summary label="Net after penalties" value={formatPrice(net)} tone="gold" />
      </section>

      <section className="mb-10 space-y-5">
        <h2 className="eyebrow">Totals</h2>
        <AgentStats rows={stats.rows} periods={stats.periods} error={stats.error} />
      </section>

      <section className="mb-10 space-y-5">
        <h2 className="eyebrow">Chargebacks</h2>
        {chargebacks.error ? (
          <Notice tone="error" title="Chargebacks are unavailable">
            {chargebacks.error}
          </Notice>
        ) : chargebacks.count === 0 ? (
          <Panel className="py-10 text-center">
            <p className="text-sm text-muted">No chargebacks recorded against {agent.name}.</p>
          </Panel>
        ) : (
          <Panel className="overflow-x-auto p-0">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-line/60 text-left text-[0.65rem] uppercase tracking-[0.16em] text-faint">
                  <th scope="col" className="px-5 py-4 font-medium">Order</th>
                  <th scope="col" className="px-5 py-4 font-medium">Customer</th>
                  <th scope="col" className="px-5 py-4 font-medium">Marked</th>
                  <th scope="col" className="px-5 py-4 font-medium">Reason</th>
                  <th scope="col" className="px-5 py-4 text-right font-medium">Order</th>
                  <th scope="col" className="px-5 py-4 text-right font-medium">Penalty</th>
                </tr>
              </thead>
              <tbody>
                {chargebacks.records.map((record) => (
                  <tr key={record.id} className="border-b border-line/40 last:border-0">
                    <th scope="row" className="px-5 py-4 text-left font-medium tabular-nums text-cream">
                      {record.orderId}
                    </th>
                    <td className="px-5 py-4 text-muted">
                      {`${record.order.customer.firstName} ${record.order.customer.lastName}`.trim() || '—'}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted">
                      {record.chargeback?.markedAt ? formatDateTime(record.chargeback.markedAt) : '—'}
                      {record.chargeback?.markedBy && (
                        <span className="block text-faint">by {record.chargeback.markedBy}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted">{record.chargeback?.reason || '—'}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-cream">{formatPrice(record.totals.total)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-red-300">
                      {formatPrice(record.chargeback?.penalty || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line/60 bg-white/[0.02]">
                  <th scope="row" colSpan={4} className="px-5 py-4 text-left text-xs uppercase tracking-[0.14em] text-muted">
                    {chargebacks.count} {chargebacks.count === 1 ? 'chargeback' : 'chargebacks'}
                  </th>
                  <td className="px-5 py-4 text-right tabular-nums text-muted">{formatPrice(chargebacks.amount)}</td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-red-300">
                    {formatPrice(chargebacks.penalty)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Panel>
        )}
      </section>

      <section className="space-y-5">
        <h2 className="eyebrow">Recent orders</h2>
        <OrderHistory
          records={history.records}
          total={history.total}
          error={history.error}
          limit={10}
          compact
          canManageChargebacks
        />
      </section>
    </div>
  );
}

function Summary({ label, value, tone = 'plain' }) {
  return (
    <Panel className="space-y-1.5 py-6">
      <p className="eyebrow flex items-center gap-2">
        {tone === 'bad' && <AlertIcon size={13} className="text-red-400" />}
        {label}
      </p>
      <p
        className={cn(
          'font-display text-2xl',
          tone === 'gold' ? 'text-gold' : tone === 'bad' ? 'text-red-300' : 'text-cream',
        )}
      >
        {value}
      </p>
    </Panel>
  );
}
