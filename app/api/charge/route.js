import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createTransaction, isGatewayConfigured } from '@/lib/nmi';
import { isDatabaseConfigured } from '@/lib/mongodb';
import { sanitiseCard, saveOrderRecord } from '@/lib/orders-db';
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
 * it returned alongside (reduced to last four / type / expiry for the order
 * record — it is never sent to the gateway).
 *
 * The order is re-normalised and re-validated here, and the amount is
 * recomputed from the line items, so the client cannot charge a different
 * figure from the one its form shows.
 *
 * On approval the order is written to MongoDB. A failed write after a
 * successful charge is reported as `saved: false` rather than as an error,
 * because the card has already been charged and NMI holds the transaction.
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
  const ipAddress =
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    undefined;

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
    ipaddress: ipAddress,
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

  if (!result.ok) {
    return NextResponse.json({
      ...result,
      orderId: order.orderId,
      amount: totals.total,
      totals,
      transactionType,
    });
  }

  // The charge went through — record it. Nothing below may turn the response
  // into a failure, or staff would retry and charge the customer twice.
  let record = null;
  let saved = false;
  let saveError = null;
  if (isDatabaseConfigured()) {
    try {
      record = await saveOrderRecord({
        orderId: order.orderId,
        createdAt: new Date(),
        placedBy: session.email,
        transactionType,
        order,
        totals,
        card: body?.card,
        result,
        ipAddress: ipAddress ?? null,
      });
      saved = true;
    } catch (error) {
      console.error(`[charge] approved transaction ${result.transactionId} was not saved to the database`, error);
      saveError = 'The payment was approved but the order could not be saved to the database. Note the transaction ID.';
    }
  } else {
    saveError = 'The payment was approved but MONGODB_URI is not set, so the order was not saved. Note the transaction ID.';
  }

  if (!record) {
    record = {
      id: order.orderId,
      orderId: order.orderId,
      createdAt: new Date().toISOString(),
      placedBy: session.email,
      transactionType,
      order,
      totals,
      card: sanitiseCard(body?.card),
      result,
    };
  }

  return NextResponse.json({
    ...result,
    orderId: order.orderId,
    amount: totals.total,
    totals,
    transactionType,
    saved,
    saveError,
    record,
  });
}
