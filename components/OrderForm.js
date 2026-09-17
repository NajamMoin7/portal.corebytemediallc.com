'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { MAX_ITEMS, emptyItem, emptyOrder, normaliseOrder, orderTotals, validateOrder } from '@/lib/order';
import { saveOrderRecord } from '@/lib/orders-store';
import { TOKENIZATION_KEY } from '@/lib/collect';
import { cn } from '@/lib/utils';
import CardFields from './CardFields';
import AddressFields from './order/AddressFields';
import ItemFields from './order/ItemFields';
import OrderConfirmation from './order/OrderConfirmation';
import OrderSummary from './order/OrderSummary';
import Button from './ui/Button';
import Field, { Fieldset } from './ui/Field';
import Notice from './ui/Notice';
import Panel from './ui/Panel';
import { PlusIcon } from './ui/Icons';

/** Immutable deep set by dotted path: setIn(state, 'customer.email', v). */
function setIn(object, path, value) {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) return { ...object, [head]: value };
  return { ...object, [head]: setIn(object[head] ?? {}, rest.join('.'), value) };
}

function scrollToFirstError() {
  requestAnimationFrame(() => {
    const target = document.querySelector('[aria-invalid="true"], [role="alert"]');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target && typeof target.focus === 'function' && target.matches('input, select, textarea')) {
      target.focus({ preventScroll: true });
    }
  });
}

/**
 * The whole "take an order over the phone" flow on one page:
 * customer → shipping → products → card → charge.
 *
 * Submit sequence:
 *   1. validate the order locally (same rules the server applies);
 *   2. ask Collect.js for a single-use payment token (card data stays in
 *      NMI's iframes);
 *   3. POST the order + token to /api/charge, which runs the sale with the
 *      private key and returns the gateway result.
 */
export default function OrderForm({ gatewayConfigured, transactionType }) {
  const router = useRouter();
  const { toast } = useToast();

  const [order, setOrder] = useState(emptyOrder);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [gatewayError, setGatewayError] = useState(null);
  const [record, setRecord] = useState(null);

  const cardRef = useRef(null);
  // Collect.js delivers the token asynchronously; read the order through a ref
  // so the callback sees the values as they are at that moment.
  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const setField = useCallback((path, value) => {
    setOrder((current) => setIn(current, path, value));
    setErrors((current) => {
      if (!current[path]) return current;
      const { [path]: _cleared, ...rest } = current;
      return rest;
    });
  }, []);

  const updateItem = useCallback((index, patch) => {
    setOrder((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
    setErrors((current) => {
      const prefix = `items.${index}.`;
      const next = Object.fromEntries(
        Object.entries(current).filter(([key]) => !(key.startsWith(prefix) && key.slice(prefix.length) in patch)),
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, []);

  function addItem() {
    setOrder((current) =>
      current.items.length >= MAX_ITEMS ? current : { ...current, items: [...current.items, emptyItem()] },
    );
  }

  function removeItem(index) {
    setOrder((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }));
    // Item errors are indexed; drop them all rather than reshuffle keys.
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith('items.'))));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (status !== 'idle') return;
    setGatewayError(null);

    const { valid, errors: nextErrors } = validateOrder(normaliseOrder(order));
    setErrors(nextErrors);
    if (!valid) {
      toast({ title: 'Check the highlighted fields', variant: 'error' });
      scrollToFirstError();
      return;
    }

    const card = cardRef.current;
    if (!card?.isReady()) {
      setGatewayError('The card fields have not finished loading. Wait a moment and try again.');
      return;
    }
    if (!card.isComplete()) {
      setGatewayError('Enter the card number, expiry and CVV before charging.');
      document.getElementById('ccnumber')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setStatus('tokenizing');
    card.requestToken();
  }

  async function handleToken(response) {
    const paymentToken = response?.token;
    if (!paymentToken) {
      setStatus('idle');
      setGatewayError('Collect.js did not return a payment token. Re-enter the card details and try again.');
      return;
    }

    setStatus('charging');
    const card = {
      number: response.card?.number || '',
      type: response.card?.type || '',
      exp: response.card?.exp || '',
    };

    try {
      const res = await fetch('/api/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderRef.current, paymentToken, card }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        toast({ title: 'Session expired', description: 'Sign in again to continue.', variant: 'error' });
        router.push('/login');
        router.refresh();
        return;
      }

      if (res.status === 422 && data.errors) {
        setErrors(data.errors);
        setStatus('idle');
        toast({ title: 'Check the highlighted fields', variant: 'error' });
        scrollToFirstError();
        return;
      }

      if (!res.ok || !data.ok) {
        setStatus('idle');
        const detail = data.responseText && data.responseText !== data.message ? ` (${data.responseText})` : '';
        setGatewayError(`${data.message || 'The payment could not be completed.'}${detail}`);
        toast({
          title: data.status === 'declined' ? 'Card declined' : 'Payment not completed',
          description: data.message,
          variant: 'error',
        });
        return;
      }

      const normalised = normaliseOrder(orderRef.current);
      const completed = {
        id: normalised.orderId,
        createdAt: new Date().toISOString(),
        order: normalised,
        totals: orderTotals(normalised),
        result: data,
        card,
      };
      saveOrderRecord(completed);
      setRecord(completed);
      setStatus('idle');
      toast({ title: 'Payment approved', description: `Transaction ${data.transactionId}`, variant: 'success' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setStatus('idle');
      setGatewayError('Could not reach the portal server. Check the connection — the card was not charged.');
    }
  }

  function handleTimeout() {
    setStatus('idle');
    setGatewayError('Securing the card details timed out. Check the connection and try again.');
  }

  function startNewOrder() {
    setOrder(emptyOrder());
    setErrors({});
    setGatewayError(null);
    setRecord(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (record) {
    return <OrderConfirmation record={record} onNewOrder={startNewOrder} />;
  }

  const busy = status !== 'idle';

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      // Enter in a text field must never charge a card by accident; the
      // charge button is the only way to submit.
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
      }}
      className="grid gap-8 lg:grid-cols-12 lg:items-start"
    >
      <div className={cn('space-y-8 lg:col-span-8', busy && 'pointer-events-none opacity-80')}>
        {!gatewayConfigured && (
          <Notice tone="warning" title="Gateway not configured">
            <code className="text-champagne">NMI_SECURITY_KEY</code> is not set, so orders cannot be charged. Add
            it to the environment (Netlify → Site configuration → Environment variables) and redeploy.
          </Notice>
        )}

        <Panel>
          <Fieldset legend="Customer" step="01" description="Billing details — the address is used for the card's AVS check.">
            <AddressFields prefix="customer" values={order.customer} errors={errors} onChange={setField} autoCompleteSection="billing" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="customer-email"
                label="Email Address"
                type="email"
                value={order.customer.email}
                error={errors['customer.email']}
                onChange={(value) => setField('customer.email', value)}
                autoComplete="email"
                placeholder="customer@example.com"
                required
              />
              <Field
                id="customer-phone"
                label="Phone Number"
                type="tel"
                value={order.customer.phone}
                error={errors['customer.phone']}
                onChange={(value) => setField('customer.phone', value)}
                autoComplete="tel"
                placeholder="(512) 555-0123"
                required
              />
            </div>
          </Fieldset>
        </Panel>

        <Panel>
          <Fieldset
            legend="Shipping"
            step="02"
            action={
              <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={order.shipToBilling}
                  onChange={(event) => setField('shipToBilling', event.target.checked)}
                  className="h-4 w-4 accent-[#c9a227]"
                />
                Same as billing address
              </label>
            }
          >
            {order.shipToBilling ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-faint">
                The order ships to the billing address above.
              </p>
            ) : (
              <AddressFields prefix="shipping" values={order.shipping} errors={errors} onChange={setField} autoCompleteSection="shipping" />
            )}
          </Fieldset>
        </Panel>

        <Panel>
          <Fieldset
            legend="Products"
            step="03"
            description="What is being printed. Prices pre-fill from the website catalogue and can be overridden per line."
            action={
              <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={order.items.length >= MAX_ITEMS}>
                <PlusIcon size={14} />
                Add product
              </Button>
            }
          >
            {errors.items && (
              <p role="alert" className="text-sm text-red-400">
                {errors.items}
              </p>
            )}
            <div className="space-y-5">
              {order.items.map((item, index) => (
                <ItemFields
                  key={item.key}
                  index={index}
                  item={item}
                  errors={errors}
                  onChange={updateItem}
                  onRemove={removeItem}
                  canRemove={order.items.length > 1}
                />
              ))}
            </div>
            <Field
              id="notes"
              label="Order Notes"
              as="textarea"
              value={order.notes}
              error={errors.notes}
              onChange={(value) => setField('notes', value)}
              placeholder="Rush job, delivery instructions, anything the production team should know."
              hint="Optional. Recorded against the NMI transaction."
            />
          </Fieldset>
        </Panel>

        <Panel>
          <Fieldset legend="Card Details" step="04" description="Charged through NMI. Enter the card exactly as the customer reads it out.">
            <CardFields ref={cardRef} onToken={handleToken} onTimeout={handleTimeout} disabled={busy} />
            {gatewayError && (
              <Notice tone="error" title="Payment not completed">
                {gatewayError}
              </Notice>
            )}
          </Fieldset>
        </Panel>
      </div>

      <div className="lg:col-span-4">
        <OrderSummary
          order={order}
          errors={errors}
          onChange={setField}
          status={status}
          canCharge={gatewayConfigured && Boolean(TOKENIZATION_KEY)}
          transactionType={transactionType}
        />
      </div>
    </form>
  );
}
