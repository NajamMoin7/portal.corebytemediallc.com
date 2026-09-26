import AgentStats from '@/components/AgentStats';
import OrderHistory from '@/components/OrderHistory';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import { requireUser } from '@/lib/auth';
import { loadAgentStats, loadOrderHistory } from '@/lib/orders-db';

export const metadata = {
  title: 'Order history',
};

// Always read fresh from the database — never serve a cached copy of the list.
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const user = await requireUser();
  const admin = user.role === 'superadmin';

  // Agents see only what they took; the super admin sees every order.
  const scope = admin ? {} : { agent: { id: user.id, name: user.name } };

  const [{ records, total, error }, stats] = await Promise.all([
    loadOrderHistory({ limit: 200, ...scope }),
    loadAgentStats(scope),
  ]);

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <PageHeader
          eyebrow="Orders"
          title={admin ? 'Order history' : 'Your orders'}
          description={
            admin
              ? 'Every approved order, newest first, with the agent who took it.'
              : 'Every order you have charged, newest first.'
          }
        />
        <Button href="/orders/new" className="shrink-0">
          New order
        </Button>
      </div>

      <section className="mb-10 space-y-5">
        <h2 className="eyebrow">{admin ? 'Agent totals' : 'Your totals'}</h2>
        <AgentStats rows={stats.rows} error={stats.error} />
      </section>

      <h2 className="eyebrow mb-5">{admin ? 'All orders' : 'Your orders'}</h2>
      <OrderHistory records={records} total={total} error={error} />
    </div>
  );
}
