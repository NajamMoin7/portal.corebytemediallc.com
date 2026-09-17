import AgentStats from '@/components/AgentStats';
import OrderHistory from '@/components/OrderHistory';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import { loadAgentStats, loadOrderHistory } from '@/lib/orders-db';

export const metadata = {
  title: 'Order history',
};

// Always read fresh from the database — never serve a cached copy of the list.
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const [{ records, total, error }, stats] = await Promise.all([loadOrderHistory({ limit: 200 }), loadAgentStats()]);

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <PageHeader
          eyebrow="Orders"
          title="Order history"
          description="Every approved order, newest first, with the agent who took it."
        />
        <Button href="/orders/new" className="shrink-0">
          New order
        </Button>
      </div>
      <section className="mb-10 space-y-5">
        <h2 className="eyebrow">Agent totals</h2>
        <AgentStats rows={stats.rows} error={stats.error} />
      </section>

      <h2 className="eyebrow mb-5">All orders</h2>
      <OrderHistory records={records} total={total} error={error} />
    </div>
  );
}
