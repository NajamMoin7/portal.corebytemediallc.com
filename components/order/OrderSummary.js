'use client';

import { formatPrice, parseMoney } from '@/lib/utils';
import Button from '../ui/Button';
import { Spinner } from '../ui/LoadingSpinner';
import { CreditCardIcon } from '../ui/Icons';

const STATUS_LABEL = {
  tokenizing: 'Securing card details',
  charging: 'Contacting gateway',
};

/**
 * Sidebar: who is taking the order, what is being charged and the charge
 * button. The sticky positioning lives on the grid column in OrderForm.
 * The total here is for display — the server re-reads the amount from the
 * request before anything is sent to NMI.
 */
export default function OrderSummary({ order, agent, errors, status, canCharge, transactionType }) {
  const total = parseMoney(order.amount);
  const busy = status !== 'idle';
  const customerName = `${order.customer.firstName} ${order.customer.lastName}`.trim();

  return (
    <aside className="surface-card space-y-6 p-6">
      <div className="space-y-1">
        <span className="eyebrow">Order Summary</span>
        <p className="text-xs text-faint">
          Reference <span className="font-medium tabular-nums text-muted">{order.orderId}</span>
        </p>
      </div>

      <dl className="space-y-3 border-t border-line/60 pt-5 text-sm">
        <Row label="Agent">
          {agent ? (
            <span className="text-cream">{agent}</span>
          ) : (
            <span className="text-gold">Select your name at the top</span>
          )}
        </Row>
        <Row label="Customer">{customerName || <span className="text-faint">—</span>}</Row>
        {order.customer.company && <Row label="Company">{order.customer.company}</Row>}
        <Row label="Invoice #">{order.invoiceNumber || <span className="text-faint">—</span>}</Row>
        <Row label="Description">
          {order.description ? <span className="line-clamp-2">{order.description}</span> : <span className="text-faint">—</span>}
        </Row>
      </dl>

      <dl className="border-t border-line/60 pt-5">
        <div className="flex justify-between text-base text-cream">
          <dt className="font-display">Total to charge</dt>
          <dd className="font-semibold tabular-nums text-gold">{formatPrice(total)}</dd>
        </div>
      </dl>

      {(errors.agent || errors.amount) && (
        <p role="alert" className="text-xs text-red-400">
          {errors.agent || errors.amount}
        </p>
      )}

      <Button type="submit" fullWidth size="lg" disabled={busy || !canCharge}>
        {busy ? <Spinner size={18} /> : <CreditCardIcon size={17} />}
        {busy ? STATUS_LABEL[status] : transactionType === 'auth' ? `Authorise ${formatPrice(total)}` : `Charge ${formatPrice(total)}`}
      </Button>

      <p className="text-center text-[0.7rem] leading-relaxed text-faint">
        The card is charged immediately through NMI. Refunds and voids are handled in the NMI merchant portal.
      </p>
    </aside>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-cream">{children}</dd>
    </div>
  );
}
