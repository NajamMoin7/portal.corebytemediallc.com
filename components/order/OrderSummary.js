'use client';

import { formatPrice, parseMoney } from '@/lib/utils';
import Button from '../ui/Button';
import Field from '../ui/Field';
import { Spinner } from '../ui/LoadingSpinner';
import { CreditCardIcon } from '../ui/Icons';

const STATUS_LABEL = {
  tokenizing: 'Securing card details',
  charging: 'Contacting gateway',
};

/**
 * Sticky sidebar: the running total, the two adjustable charges and the
 * charge button. Totals here are for display — the server recomputes them
 * from the line items before anything is sent to NMI.
 */
export default function OrderSummary({ order, errors, onChange, status, canCharge, transactionType }) {
  const subtotal = order.items.reduce((sum, item) => {
    const quantity = Number.parseInt(item.quantity, 10) || 0;
    return sum + quantity * parseMoney(item.unitPrice);
  }, 0);
  const shipping = parseMoney(order.charges.shipping);
  const tax = parseMoney(order.charges.tax);
  const total = subtotal + shipping + tax;
  const busy = status !== 'idle';

  return (
    <aside className="surface-card space-y-6 p-6 lg:sticky lg:top-28">
      <div className="space-y-1">
        <span className="eyebrow">Order Summary</span>
        <p className="text-xs text-faint">
          Reference <span className="font-medium tabular-nums text-muted">{order.orderId}</span>
        </p>
      </div>

      <ul className="space-y-3 border-t border-line/60 pt-5 text-sm">
        {order.items.map((item, index) => {
          const quantity = Number.parseInt(item.quantity, 10) || 0;
          const options = [item.size, item.color].filter(Boolean).join(', ');
          return (
            <li key={item.key || index} className="flex justify-between gap-4">
              <span className="min-w-0 text-muted">
                <span className="text-cream">{quantity || '–'}×</span> {item.name || 'Product'}
                {options && <span className="block truncate text-xs text-faint">{options}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-cream">{formatPrice(quantity * parseMoney(item.unitPrice))}</span>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-4 border-t border-line/60 pt-5">
        <Field
          id="charges-shipping"
          label="Shipping"
          prefix="$"
          inputMode="decimal"
          value={order.charges.shipping}
          error={errors['charges.shipping']}
          onChange={(value) => onChange('charges.shipping', value)}
          disabled={busy}
        />
        <Field
          id="charges-tax"
          label="Tax"
          prefix="$"
          inputMode="decimal"
          value={order.charges.tax}
          error={errors['charges.tax']}
          onChange={(value) => onChange('charges.tax', value)}
          disabled={busy}
        />
      </div>

      <dl className="space-y-2 border-t border-line/60 pt-5 text-sm">
        <div className="flex justify-between text-muted">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>Shipping</dt>
          <dd className="tabular-nums">{formatPrice(shipping)}</dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>Tax</dt>
          <dd className="tabular-nums">{formatPrice(tax)}</dd>
        </div>
        <div className="flex justify-between border-t border-line/60 pt-3 text-base text-cream">
          <dt className="font-display">Total to charge</dt>
          <dd className="font-semibold tabular-nums text-gold">{formatPrice(total)}</dd>
        </div>
      </dl>

      {errors.total && (
        <p role="alert" className="text-xs text-red-400">
          {errors.total}
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
