'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { useAgent } from '@/context/AgentContext';
import { CURRENCY } from '@/data/site';
import { emptyOrder, normaliseOrder, validateOrder } from '@/lib/order';
import { TOKENIZATION_KEY } from '@/lib/collect';
import { cn } from '@/lib/utils';
import CardFields from './CardFields';
import { BillingFields, ShippingFields } from './order/AddressFields';
import OrderConfirmation from './order/OrderConfirmation';
import OrderSummary from './order/OrderSummary';
import Field, { Fieldset } from './ui/Field';
import Notice from './ui/Notice';
import Panel from './ui/Panel';

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
 * card + amount → billing details → shipping → charge. The agent taking the
 * order comes from the header picker and is stamped on the record.
 *
 * Submit sequence:
 *   1. validate the order locally (same rules the server applies);
 *   2. ask Collect.js for a single-use payment token (card data stays in
 *      NMI's iframes);
 *   3. POST the order + token to /api/charge, which runs the sale with the
 *      private key, saves the approved order to MongoDB and returns the
 *      gateway result together with the saved record.
 */
export default function OrderForm({ gatewayConfigured, transactionType }) {
  const router = useRouter();
  const { toast } = useToast();
  const { agent } = useAgent();

  const [order, setOrder] = useState(emptyOrder);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [gatewayError, setGatewayError] = useState(null);
  const [record, setRecord] = useState(null);

  const cardRef = useRef(null);
  // Collect.js delivers the token asynchronously; read the order through a ref
  // so the callback sees the values as they are at that moment.
  const orderRef = useRef(order);
  const agentRef = useRef(agent);
  useEffect(() => {
    orderRef.current = order;
    agentRef.current = agent;
  }, [order, agent]);

  const setField = useCallback((path, value) => {
    setOrder((current) => setIn(current, path, value));
    setErrors((current) => {
      if (!current[path]) return current;
      const { [path]: _cleared, ...rest } = current;
      return rest;
    });
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    if (status !== 'idle') return;
    setGatewayError(null);

    const { valid, errors: nextErrors } = validateOrder(normaliseOrder({ ...order, agent }));
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
        body: JSON.stringify({ order: { ...orderRef.current, agent: agentRef.current }, paymentToken, card }),
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

      // The server builds the record (and stores it) so the confirmation
      // screen shows exactly what the database holds.
      setRecord(data.record);
      setStatus('idle');
      toast({ title: 'Payment approved', description: `Transaction ${data.transactionId}`, variant: 'success' });
      if (!data.saved) {
        toast({
          title: 'Order not saved to the database',
          description: data.saveError || 'Note the transaction ID — the charge itself went through.',
          variant: 'error',
          duration: 12000,
        });
      }
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

        {!agent && (
          <Notice tone="warning" title="Select your name first">
            Choose your name in the <strong>Agent</strong> picker at the top of the page so this order is recorded
            against you.
          </Notice>
        )}

        <Panel>
          <Fieldset legend="Billing Information" step="01" description="The card, the amount, and the cardholder's details for the AVS check.">
            <CardFields ref={cardRef} onToken={handleToken} onTimeout={handleTimeout} disabled={busy} />

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="amount"
                label="Amount"
                prefix="$"
                inputMode="decimal"
                value={order.amount}
                error={errors.amount}
                onChange={(value) => setField('amount', value)}
                placeholder="00.00"
                required
                disabled={busy}
              />
              <Field
                id="currency"
                label="Currency"
                as="select"
                options={[{ value: CURRENCY.code, label: CURRENCY.code }]}
                value={CURRENCY.code}
                onChange={() => {}}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="invoiceNumber"
                label="Invoice Number"
                value={order.invoiceNumber}
                error={errors.invoiceNumber}
                onChange={(value) => setField('invoiceNumber', value)}
                placeholder="e.g. 483920"
                disabled={busy}
              />
              <Field
                id="description"
                label="Description"
                value={order.description}
                error={errors.description}
                onChange={(value) => setField('description', value)}
                placeholder="e.g. custom logo"
                hint="Optional. Recorded against the NMI transaction."
                disabled={busy}
              />
            </div>

            <BillingFields values={order.customer} errors={errors} onChange={setField} disabled={busy} />

            {gatewayError && (
              <Notice tone="error" title="Payment not completed">
                {gatewayError}
              </Notice>
            )}
          </Fieldset>
        </Panel>

        <Panel>
          <Fieldset
            legend="Shipping Address"
            step="02"
            action={
              <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={order.shipToBilling}
                  onChange={(event) => setField('shipToBilling', event.target.checked)}
                  className="h-4 w-4 accent-[#c9a227]"
                />
                Same as Billing
              </label>
            }
          >
            {order.shipToBilling ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-faint">
                The order ships to the billing address above.
              </p>
            ) : (
              <ShippingFields values={order.shipping} errors={errors} onChange={setField} disabled={busy} />
            )}
          </Fieldset>
        </Panel>
      </div>

      {/*
        Sticky must sit on the grid item itself: with `lg:items-start` the
        item only wraps its content, so a sticky child would have no room to
        travel. The item's containing block is the form, which spans the page.
      */}
      <div className="lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
        <OrderSummary
          order={order}
          agent={agent}
          errors={errors}
          status={status}
          canCharge={gatewayConfigured && Boolean(TOKENIZATION_KEY)}
          transactionType={transactionType}
        />
      </div>
    </form>
  );
}
