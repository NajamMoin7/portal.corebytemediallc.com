'use client';

import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { formatDateTime, formatPhone, formatPrice } from '@/lib/utils';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Panel from '../ui/Panel';
import { CheckCircleIcon, CopyIcon } from '../ui/Icons';

const AVS_LABELS = {
  X: 'Exact match (address + 9-digit ZIP)',
  Y: 'Exact match (address + 5-digit ZIP)',
  A: 'Address matches, ZIP does not',
  W: '9-digit ZIP matches, address does not',
  Z: '5-digit ZIP matches, address does not',
  N: 'No match on address or ZIP',
  U: 'Address unavailable',
  R: 'Issuer system unavailable — retry',
  S: 'Service not supported',
  E: 'AVS not eligible',
  G: 'Global non-AVS participant',
  B: 'Address matches, ZIP not verified',
  C: 'Address and ZIP not verified',
  D: 'International exact match',
  I: 'International, not verified',
  M: 'International exact match',
  P: 'International ZIP matches, address not verified',
  '0': 'AVS not supported by the processor',
};

const CVV_LABELS = {
  M: 'CVV matched',
  N: 'CVV did not match',
  P: 'CVV not processed',
  S: 'CVV should be on the card but was not provided',
  U: 'Issuer cannot verify CVV',
};

/**
 * Shown in place of the form once the gateway approves. Everything the staff
 * member might need to quote back to the customer is on this one screen.
 */
export default function OrderConfirmation({ record, onNewOrder }) {
  const { toast } = useToast();
  const { order, result, card, totals } = record;
  const shipTo = order.shipToBilling ? order.customer : order.shipping;

  async function copy(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, variant: 'success', duration: 2000 });
    } catch {
      toast({ title: `Could not copy ${label.toLowerCase()}`, variant: 'error' });
    }
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <Panel className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(201,162,39,0.12),transparent_70%)]"
        />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
              <CheckCircleIcon size={24} />
            </span>
            <div className="space-y-1.5">
              <span className="eyebrow">{record.transactionType === 'auth' ? 'Authorised' : 'Payment approved'}</span>
              <h2 className="text-2xl text-cream sm:text-3xl">{formatPrice(totals.total)} charged successfully</h2>
              <p className="text-sm text-muted">
                {formatDateTime(record.createdAt)} · {card.type ? `${card.type} ` : ''}
                {card.last4 ? `•••• ${card.last4}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onNewOrder}>
              New order
            </Button>
            <Button href="/orders" variant="ghost">
              Order history
            </Button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <h3 className="eyebrow">Transaction</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Order reference">
              <Copyable value={order.orderId} onCopy={() => copy(order.orderId, 'Order reference')} />
            </Row>
            <Row label="NMI transaction ID">
              <Copyable value={result.transactionId} onCopy={() => copy(result.transactionId, 'Transaction ID')} />
            </Row>
            <Row label="Auth code">{result.authCode || '—'}</Row>
            <Row label="Gateway response">
              <Badge tone="gold">{result.responseCode || 'OK'}</Badge>
              <span className="ml-2 text-muted">{result.responseText || result.message}</span>
            </Row>
            <Row label="Address check (AVS)">{AVS_LABELS[result.avsResponse] || result.avsResponse || 'Not returned'}</Row>
            <Row label="CVV check">{CVV_LABELS[result.cvvResponse] || result.cvvResponse || 'Not returned'}</Row>
          </dl>
        </Panel>

        <Panel className="space-y-4">
          <h3 className="eyebrow">Customer</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Name">
              {order.customer.firstName} {order.customer.lastName}
            </Row>
            <Row label="Email">{order.customer.email}</Row>
            <Row label="Phone">{formatPhone(order.customer.phone)}</Row>
            <Row label="Ship to">
              <address className="not-italic leading-relaxed text-cream">
                {shipTo.firstName} {shipTo.lastName}
                <br />
                {shipTo.address1}
                {shipTo.address2 && (
                  <>
                    <br />
                    {shipTo.address2}
                  </>
                )}
                <br />
                {shipTo.city}, {shipTo.state} {shipTo.zip}
              </address>
            </Row>
            {order.notes && <Row label="Notes">{order.notes}</Row>}
          </dl>
        </Panel>
      </div>

      <Panel className="space-y-5">
        <h3 className="eyebrow">Items</h3>
        <ul className="divide-y divide-line/60">
          {order.items.map((item, index) => (
            <li key={item.key || index} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1 text-sm">
                <p className="text-cream">
                  {item.quantity}× {item.name}
                  {item.sku && <span className="ml-2 text-xs text-faint">{item.sku}</span>}
                </p>
                <p className="text-xs text-muted">
                  {[item.size, item.color, item.printMethod, item.placement].filter(Boolean).join(' · ') || 'No options'}
                </p>
                {item.artworkUrl && (
                  <a
                    href={item.artworkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block break-all text-xs text-gold hover:text-champagne"
                  >
                    {item.artworkUrl}
                  </a>
                )}
                {item.notes && <p className="text-xs text-muted">{item.notes}</p>}
              </div>
              <span className="shrink-0 text-sm tabular-nums text-cream">
                {formatPrice(item.quantity * item.unitPrice)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto max-w-xs space-y-2 border-t border-line/60 pt-4 text-sm">
          <div className="flex justify-between text-muted">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>Shipping</dt>
            <dd className="tabular-nums">{formatPrice(totals.shipping)}</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>Tax</dt>
            <dd className="tabular-nums">{formatPrice(totals.tax)}</dd>
          </div>
          <div className="flex justify-between border-t border-line/60 pt-2 text-cream">
            <dt>Total</dt>
            <dd className="font-semibold tabular-nums text-gold">{formatPrice(totals.total)}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-xs uppercase tracking-[0.14em] text-faint sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words text-cream">{children}</dd>
    </div>
  );
}

function Copyable({ value, onCopy }) {
  if (!value) return '—';
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-medium tabular-nums">{value}</span>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy"
        className="rounded-full p-1 text-faint transition-colors hover:bg-white/5 hover:text-gold"
      >
        <CopyIcon size={14} />
      </button>
    </span>
  );
}
