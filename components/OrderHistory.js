'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { cn, formatDateTime, formatPhone, formatPrice } from '@/lib/utils';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Notice from './ui/Notice';
import Panel from './ui/Panel';
import { AlertIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, ReceiptIcon } from './ui/Icons';
import OrderSearch from './OrderSearch';
import ChargebackControl from './order/ChargebackControl';

/**
 * Orders from the database, newest first.
 *
 * The list is fetched on the server (see the dashboard and /orders pages) and
 * handed in as `records`; this component only handles expanding a row and
 * copying IDs. `total` is the count in the database, used for the "view all"
 * link when `limit` trims the list. `error` is shown in place of the list
 * when the database is unavailable.
 *
 * Paging is server-side: pass `page` and `pageCount` and the controls render
 * as plain links to `?page=N`, so a page can be bookmarked, opened in a new
 * tab and works before the JavaScript loads. Search works the same way
 * (`?q=…`) — set `searchable` to show the box.
 *
 * `canManageChargebacks` adds the super admin's chargeback controls to each
 * expanded row; agents only ever see that an order was charged back.
 */
export default function OrderHistory({
  records = [],
  total = null,
  limit = null,
  compact = false,
  error = null,
  page = 1,
  pageCount = 1,
  pageSize = null,
  basePath = '/orders',
  searchable = false,
  query = '',
  canManageChargebacks = false,
}) {
  const { toast } = useToast();
  const [openId, setOpenId] = useState(null);

  const count = total ?? records.length;

  if (error) {
    return (
      <Notice tone="error" title="Order history is unavailable">
        {error}
      </Notice>
    );
  }

  const search = searchable ? (
    <OrderSearch query={query} basePath={basePath} total={count} />
  ) : null;

  if (records.length === 0) {
    return (
      <div className="space-y-5">
        {search}
        <Panel className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 text-gold">
            <ReceiptIcon size={24} />
          </span>
          <div className="space-y-1">
            <p className="text-cream">{query ? 'No matching orders' : 'No orders yet'}</p>
            <p className="max-w-sm text-sm text-muted">
              {query
                ? 'Try a different name, email, phone number or order reference.'
                : 'Every approved charge is saved here. Refunds and voids are handled in the NMI merchant portal.'}
            </p>
          </div>
          {!query && (
            <Button href="/orders/new" variant="outline" size="sm">
              Create an order
            </Button>
          )}
        </Panel>
      </div>
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
      {search}

      <ul className="space-y-3">
        {records.map((record) => {
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
                    <Badge tone={record.transactionType === 'auth' ? 'outline' : 'gold'}>
                      {record.transactionType === 'auth' ? 'Authorised' : 'Paid'}
                    </Badge>
                    {record.agent && <Badge tone="outline">{record.agent}</Badge>}
                    {record.chargeback?.status === 'charged_back' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-red-300">
                        <AlertIcon size={11} />
                        Charged back
                      </span>
                    )}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {formatDateTime(record.createdAt)}
                    {order.invoiceNumber ? ` · Inv. ${order.invoiceNumber}` : ''}
                    {order.description ? ` · ${order.description}` : ''}
                    {card?.last4 ? ` · ${card.type ? `${card.type} ` : ''}•••• ${card.last4}` : ''}
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
                    <Detail label="Agent">{record.agent || '—'}</Detail>
                    {record.placedBy && <Detail label="Placed by">{record.placedBy}</Detail>}
                    <Detail label="Invoice #">{order.invoiceNumber || '—'}</Detail>
                    <Detail label="Description">{order.description || '—'}</Detail>
                    </dl>

                    {(canManageChargebacks || record.chargeback?.status === 'charged_back') && (
                      <div className="pt-2">
                        {canManageChargebacks ? (
                          <ChargebackControl record={record} />
                        ) : (
                          <p className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-xs text-red-200">
                            This order was charged back. A {formatPrice(record.chargeback.penalty || 0)} penalty is
                            recorded against it.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="eyebrow">Customer</h3>
                    <dl className="space-y-3">
                    {order.customer.company && <Detail label="Company">{order.customer.company}</Detail>}
                    <Detail label="Email">{order.customer.email}</Detail>
                    <Detail label="Phone">{formatPhone(order.customer.phone)}</Detail>
                    {order.customer.fax && <Detail label="Fax">{formatPhone(order.customer.fax)}</Detail>}
                    {order.customer.website && <Detail label="Website">{order.customer.website}</Detail>}
                    <Detail label="Bill to">{formatAddress(order.customer)}</Detail>
                    <Detail label="Ship to">
                      {order.shipToBilling ? 'Same as billing' : formatAddress(order.shipping)}
                    </Detail>
                    </dl>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {limit && count > records.length && (
        <div className="text-right">
          <Link href="/orders" className="text-xs uppercase tracking-[0.14em] text-gold hover:text-champagne">
            View all {count} orders →
          </Link>
        </div>
      )}

      {!compact && (
        <div className="flex flex-col gap-4 border-t border-line/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-faint">
            {pageSize && count > 0
              ? `Showing ${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + records.length} of ${count}`
              : `${count} order${count === 1 ? '' : 's'} on record`}
            . Search NMI by the transaction ID for refunds and voids.
          </p>
          {pageCount > 1 && <Pagination page={page} pageCount={pageCount} basePath={basePath} query={query} />}
        </div>
      )}
    </div>
  );
}

/**
 * Page links: first, a window of pages around the current one, and last, so
 * the control stays a fixed width however many pages there are.
 */
function Pagination({ page, pageCount, basePath, query = '' }) {
  // Paging must not drop an active search, or page 2 would silently show
  // every order again.
  const href = (n) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (n > 1) params.set('page', String(n));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  const window = [];
  for (let n = Math.max(1, page - 1); n <= Math.min(pageCount, page + 1); n += 1) window.push(n);
  if (!window.includes(1)) window.unshift(1);
  if (!window.includes(pageCount)) window.push(pageCount);

  return (
    <nav aria-label="Order history pages" className="flex items-center gap-1">
      <PageLink href={href(page - 1)} disabled={page === 1} label="Previous page">
        <ChevronLeftIcon size={14} />
      </PageLink>

      {window.map((n, index) => (
        <span key={n} className="flex items-center gap-1">
          {index > 0 && window[index - 1] !== n - 1 && <span className="px-1 text-xs text-faint">…</span>}
          <PageLink href={href(n)} current={n === page} label={`Page ${n}`}>
            {n}
          </PageLink>
        </span>
      ))}

      <PageLink href={href(page + 1)} disabled={page === pageCount} label="Next page">
        <ChevronRightIcon size={14} />
      </PageLink>
    </nav>
  );
}

function PageLink({ href, children, current = false, disabled = false, label }) {
  const classes = cn(
    'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs tabular-nums transition-colors',
    current
      ? 'border-gold/55 bg-gold/15 text-gold'
      : disabled
        ? 'cursor-not-allowed border-line/60 text-faint/50'
        : 'border-line text-muted hover:border-gold/40 hover:text-gold',
  );

  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={label} className={classes}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} aria-current={current ? 'page' : undefined} className={classes} scroll>
      {children}
    </Link>
  );
}

function formatAddress(to) {
  return [
    [to.firstName, to.lastName].filter(Boolean).join(' '),
    to.company,
    to.address1,
    to.address2,
    `${to.city}, ${to.state} ${to.zip}`,
  ]
    .filter(Boolean)
    .join(', ');
}

function Detail({ label, children }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="text-xs uppercase tracking-[0.14em] text-faint">{label}</dt>
      <dd className="min-w-0 break-words text-cream">{children}</dd>
    </div>
  );
}
