import OrderHistory from '@/components/OrderHistory';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';

export const metadata = {
  title: 'Order history',
};

export default function OrdersPage() {
  return (
    <div className="container-page py-10 lg:py-14">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <PageHeader
          eyebrow="Orders"
          title="Order history"
          description="Orders charged from this browser, newest first."
        />
        <Button href="/orders/new" className="shrink-0">
          New order
        </Button>
      </div>
      <OrderHistory />
    </div>
  );
}
