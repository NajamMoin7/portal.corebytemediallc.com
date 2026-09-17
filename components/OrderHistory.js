'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { useIsHydrated } from '@/lib/hooks';
import { clearOrderHistory, useOrderHistory } from '@/lib/orders-store';
import { cn, formatDateTime, formatPhone, formatPrice } from '@/lib/utils';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Notice from './ui/Notice';
import Panel from './ui/Panel';
import { Skeleton } from './ui/LoadingSpinner';
import { ChevronDownIcon, CopyIcon, ReceiptIcon } from './ui/Icons';

/**
 * Orders charged from this browser, newest first. `limit` trims the list for
 * the dashboard; the full page shows everything with a clear-history control.
 */
export default function OrderHistory({ limit = null, compact = false }) {
  const hydrated = useIsHydrated();
  const records = useOrderHistory();
  const { toast } = useToast();
  const [openId, setOpenId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const visible = limit ? records.slice(0, limit) : records;

  if (!hydrated) {
    return (
      <div className="space-y-3">
        {Array.from({ length: compact ? 3 : 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Panel className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 text-gold">
          <ReceiptIcon size={24} />
        </span>
        <div className="space-y-1">
          <p className="text-cream">No orders from this browser yet</p>
          <p className="max-w-sm text-sm text-muted">
            Orders charged here appear in this list. The full record of every transaction is in the NMI merchant
            portal.
          </p>
        </div>
        <Button href="/orders/new" variant="outline" size="sm">
          Create an order
        </Button>
      </Panel>
    );
  }

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copied', variant: 'success', duration: 1800 });
    } catch {
      toast({ title: 'Could not copy', variant: 'error' });
    }
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <Notice tone="info">
          This list is stored in this browser only. Search NMI by the order reference or transaction ID for the
          authoritative record, refunds and voids.
        </Notice>
      )}

      <ul className="space-y-3">
        {visible.map((record) => {
          const open = openId === record.id;
          const { order, result, totals, card } = record;
          const customerName = `${order.customer.firstName} ${order.customer.lastName}`.trim();
          return (
            <li key={record.id} className="surface-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : record.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-cream">
                    <span className="font-medium">{customerName || 'Customer'}</span>
                    <span className="text-xs tabular-nums text-faint">{record.id}</span>
                    <Badge tone={result.transactionType === 'auth' ? 'outline' : 'gold'}>
                      {result.transactionType === 'auth' ? 'Authorised' : 'Paid'}
                    </Badge>
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {formatDateTime(record.createdAt)} · {order.items.length} item{order.items.length === 1 ? '' : 's'}
                    {card?.number ? ` · ${card.type ? `${card.type} ` : ''}${card.number.slice(-4).padStart(8, '•')}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-gold">{formatPrice(totals.total)}</span>
                <ChevronDownIcon
                  size={16}
                  className={cn('shrink-0 text-faint transition-transform duration-300', open && 'rotate-180')}
                />
              </button>

              {open && (
                <div className="grid gap-6 border-t border-line/60 px-5 py-5 text-sm animate-fade-in md:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="eyebrow">Transaction</h3>
                    <dl className="space-y-3">
                    <Detail label="Transaction ID">
                      <span className="inline-flex items-center gap-2">
                        <span className="tabular-nums">{result.transactionId || '—'}</span>
                        {result.transactionId && (
                          <button
                            type="button"
                            onClick={() => copy(result.transactionId)}
                            aria-label="Copy transaction ID"
                            className="rounded-full p-1 text-faint hover:text-gold"
                          >
                            <CopyIcon size={13} />
                          </button>
                        )}
                      </span>
                    </Detail>
                    <Detail label="Auth code">{result.authCode || '—'}</Detail>
                    <Detail label="AVS / CVV">
                      {result.avsResponse || '—'} / {result.cvvResponse || '—'}
                    </Detail>
                    <Detail label="Email">{order.customer.email}</Detail>
                    <Detail label="Phone">{formatPhone(order.customer.phone)}</Detail>
                    <Detail label="Ship to">
                      {(() => {
                        const to = order.shipToBilling ? order.customer : order.shipping;
                        return `${to.address1}${to.address2 ? `, ${to.address2}` : ''}, ${to.city}, ${to.state} ${to.zip}`;
                      })()}
                    </Detail>
                    {order.notes && <Detail label="Notes">{order.notes}</Detail>}
                    </dl>
                  </div>

                  <div className="space-y-3">
                    <h3 className="eyebrow">Items</h3>
                    <ul className="space-y-2">
                      {order.items.map((item, index) => (
                        <li key={item.key || index} className="flex justify-between gap-4">
                          <span className="min-w-0 text-muted">
                            <span className="text-cream">{item.quantity}×</span> {item.name}
                            <span className="block text-xs text-faint">
                              {[item.size, item.color, item.printMethod, item.placement].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-cream">{formatPrice(item.quantity * item.unitPrice)}</span>
                        </li>
                      ))}
                    </ul>
                    <dl className="space-y-1 border-t border-line/60 pt-3 text-xs text-muted">
                      <div className="flex justify-between">
                        <dt>Subtotal</dt>
                        <dd className="tabular-nums">{formatPrice(totals.subtotal)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Shipping</dt>
                        <dd className="tabular-nums">{formatPrice(totals.shipping)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Tax</dt>
                        <dd className="tabular-nums">{formatPrice(totals.tax)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {limit && records.length > limit && (
        <div className="text-right">
          <Link href="/orders" className="text-xs uppercase tracking-[0.14em] text-gold hover:text-champagne">
            View all {records.length} orders →
          </Link>
        </div>
      )}

      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-faint">
          <span>{records.length} order{records.length === 1 ? '' : 's'} stored locally.</span>
          {confirmClear ? (
            <span className="flex items-center gap-3">
              <span>Clear this browser&apos;s history? NMI records are unaffected.</span>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  clearOrderHistory();
                  setConfirmClear(false);
                  setOpenId(null);
                }}
              >
                Clear
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className="uppercase tracking-[0.14em] hover:text-red-300">
              Clear history
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="text-xs uppercase tracking-[0.14em] text-faint">{label}</dt>
      <dd className="min-w-0 break-words text-cream">{children}</dd>
    </div>
  );
}
