import OrderForm from '@/components/OrderForm';
import PageHeader from '@/components/PageHeader';
import { isGatewayConfigured } from '@/lib/nmi';
import { requireUser } from '@/lib/auth';

export const metadata = {
  title: 'New order',
};

export default async function NewOrderPage() {
  const user = await requireUser();

  return (
    <div className="container-page py-10 lg:py-14">
      <PageHeader
        eyebrow="New Order"
        title="Take a print order"
        description="Enter the card, the amount and the customer's details. The card is charged through NMI as soon as you submit, and recorded against your account."
        className="mb-10"
      />
      <OrderForm
        agent={{ id: user.id, name: user.name }}
        gatewayConfigured={isGatewayConfigured()}
        transactionType={process.env.NMI_TRANSACTION_TYPE === 'auth' ? 'auth' : 'sale'}
      />
    </div>
  );
}
