import OrderForm from '@/components/OrderForm';
import PageHeader from '@/components/PageHeader';
import { isGatewayConfigured } from '@/lib/nmi';

export const metadata = {
  title: 'New order',
};

export default function NewOrderPage() {
  return (
    <div className="container-page py-10 lg:py-14">
      <PageHeader
        eyebrow="New Order"
        title="Take a print order"
        description="Enter the customer, what they are ordering and their card. The card is charged through NMI as soon as you submit."
        className="mb-10"
      />
      <OrderForm
        gatewayConfigured={isGatewayConfigured()}
        transactionType={process.env.NMI_TRANSACTION_TYPE === 'auth' ? 'auth' : 'sale'}
      />
    </div>
  );
}
