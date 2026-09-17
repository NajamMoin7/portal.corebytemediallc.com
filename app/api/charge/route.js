import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createTransaction, isGatewayConfigured } from '@/lib/nmi';
import {
  itemsSummary,
  normaliseOrder,
  orderTotals,
  shippingAddress,
  validateOrder,
} from '@/lib/order';
import { CURRENCY } from '@/data/site';

/**
 * POST /api/charge
 *
 * Body: `{ order, paymentToken, card }` where `paymentToken` is the single-use
 * token Collect.js produced in the browser and `card` is the masked summary
 * it returned alongside (kept only for the response and the local history —
 * it is never sent to the gateway).
 *
 * The order is re-normalised and re-validated here, and the amount is
 * recomputed from the line items, so the client cannot charge a different
 * figure from the one its form shows.
 */
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Your session has expired. Sign in again.' }, { status: 401 });
  }

  if (!isGatewayConfigured()) {
    return NextResponse.json(
      { ok: false, message: 'The payment gateway is not configured. Set NMI_SECURITY_KEY.' },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request body.' }, { status: 400 });
  }

  const paymentToken = typeof body?.paymentToken === 'string' ? body.paymentToken.trim() : '';
  if (!paymentToken || paymentToken.length > 200) {
    return NextResponse.json({ ok: false, message: 'Missing payment token. Re-enter the card details.' }, { status: 400 });
  }

  const order = normaliseOrder(body?.order);
  const { valid, errors } = validateOrder(order);
  if (!valid) {
    return NextResponse.json(
      { ok: false, message: 'The order has validation errors.', errors },
      { status: 422 },
    );
  }

  const totals = orderTotals(order);
  const shipTo = shippingAddress(order);
  const transactionType = process.env.NMI_TRANSACTION_TYPE === 'auth' ? 'auth' : 'sale';

  const fields = {
    type: transactionType,
    payment_token: paymentToken,
    amount: totals.total.toFixed(2),
    currency: CURRENCY.code,
    orderid: order.orderId,
    order_description: itemsSummary(order.items),
    tax: totals.tax.toFixed(2),
    shipping: totals.shipping.toFixed(2),

    // Billing details drive AVS on the card.
    first_name: order.customer.firstName,
    last_name: order.customer.lastName,
    address1: order.customer.address1,
    address2: order.customer.address2,
    city: order.customer.city,
    state: order.customer.state,
    zip: order.customer.zip,
    country: order.customer.country,
    phone: order.customer.phone,
    email: order.customer.email,

    shipping_first_name: shipTo.firstName,
    shipping_last_name: shipTo.lastName,
    shipping_address1: shipTo.address1,
    shipping_address2: shipTo.address2,
    shipping_city: shipTo.city,
    shipping_state: shipTo.state,
    shipping_zip: shipTo.zip,
    shipping_country: order.customer.country,
    shipping_email: order.customer.email,

    // Free-text fields that appear against the transaction in the NMI portal.
    merchant_defined_field_1: 'Core Byte Media portal',
    merchant_defined_field_2: `Placed by ${session.email}`,
    merchant_defined_field_3: order.items
      .map((item) => [item.sku, item.printMethod, item.placement].filter(Boolean).join(' / '))
      .join(' | ')
      .slice(0, 255),
    merchant_defined_field_4: order.notes.slice(0, 255),
    merchant_defined_field_5: order.items
      .map((item) => item.artworkUrl)
      .filter(Boolean)
      .join(' ')
      .slice(0, 255),

    customer_receipt: process.env.NMI_CUSTOMER_RECEIPT === 'true' ? 'true' : undefined,
    ipaddress:
      request.headers.get('x-nf-client-connection-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      undefined,
  };

  let result;
  try {
    result = await createTransaction(fields);
  } catch (error) {
    console.error('[charge] gateway request failed', error);
    return NextResponse.json(
      {
        ok: false,
        status: 'error',
        message:
          'Could not reach the payment gateway. Nothing was charged — check the connection and try again.',
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ...result,
    orderId: order.orderId,
    amount: totals.total,
    totals,
    transactionType,
  });
}
