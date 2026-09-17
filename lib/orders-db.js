import { getCollection, isDatabaseConfigured } from './mongodb';

/**
 * Order records in MongoDB.
 *
 * One document per approved charge in the `orders` collection. This is the
 * portal's own record of what was ordered; NMI remains the authority on the
 * money (refunds, voids and captures happen there, keyed by `transactionId`).
 *
 * Document shape:
 *   {
 *     orderId:         'CBM-20260917-AB12'   // unique, the CBM reference
 *     createdAt:       Date
 *     placedBy:        'staff@…'             // portal login that took the order
 *     transactionType: 'sale' | 'auth'
 *     order:           normalised order (lib/order.js)
 *     totals:          { subtotal, shipping, tax, total }
 *     card:            { last4, type, exp }  // never a full card number
 *     result:          gateway reply (lib/nmi.js normaliseGatewayResponse)
 *     ipAddress:       string | null
 *   }
 *
 * Server-only module.
 */

const COLLECTION = 'orders';

let indexesReady;

/**
 * Creates the indexes once per process. `createIndex` is idempotent, so this
 * is safe to call on every write; the promise is cached to avoid the
 * round-trip each time.
 */
async function ordersCollection() {
  const orders = await getCollection(COLLECTION);
  if (!indexesReady) {
    indexesReady = Promise.all([
      orders.createIndex({ orderId: 1 }, { unique: true }),
      orders.createIndex({ createdAt: -1 }),
      orders.createIndex({ 'result.transactionId': 1 }),
      orders.createIndex({ 'order.customer.email': 1 }),
    ]).catch((error) => {
      indexesReady = undefined;
      throw error;
    });
  }
  await indexesReady;
  return orders;
}

const digits = (value) => String(value ?? '').replace(/\D/g, '');

/**
 * Reduces the masked card summary Collect.js returned to the parts that are
 * safe to keep. Last four and expiry are permitted under PCI DSS; the masked
 * number itself is discarded so nothing card-shaped is ever stored.
 */
export function sanitiseCard(card = {}) {
  return {
    last4: digits(card.number).slice(-4),
    type: String(card.type ?? '').trim().slice(0, 20),
    exp: digits(card.exp).slice(0, 4),
  };
}

/** Inserts an approved order. Throws on a duplicate `orderId` or connection failure. */
export async function saveOrderRecord(record) {
  const orders = await ordersCollection();
  const document = {
    orderId: record.orderId,
    createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt ?? Date.now()),
    placedBy: record.placedBy ?? null,
    transactionType: record.transactionType,
    order: record.order,
    totals: record.totals,
    card: sanitiseCard(record.card),
    result: record.result,
    ipAddress: record.ipAddress ?? null,
  };
  await orders.insertOne(document);
  return toRecord(document);
}

/** Newest first. `limit` caps the list; `email` filters to one customer. */
export async function listOrderRecords({ limit = 100, email = null } = {}) {
  const orders = await ordersCollection();
  const filter = email ? { 'order.customer.email': String(email).toLowerCase() } : {};
  const documents = await orders
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 500))
    .toArray();
  return documents.map(toRecord);
}

export async function countOrderRecords() {
  const orders = await ordersCollection();
  return orders.countDocuments();
}

/** A single order by its CBM reference, or null. */
export async function findOrderRecord(orderId) {
  const orders = await ordersCollection();
  const document = await orders.findOne({ orderId: String(orderId) });
  return document ? toRecord(document) : null;
}

/**
 * What the history pages render: the list plus the total count, or a
 * human-readable `error` when the database is unconfigured or unreachable.
 * Never throws — a database outage must not take the whole portal down.
 */
export async function loadOrderHistory({ limit = 100 } = {}) {
  if (!isDatabaseConfigured()) {
    return {
      records: [],
      total: 0,
      error: 'MONGODB_URI is not set. Add the MongoDB connection string to the environment and redeploy.',
    };
  }
  try {
    const [records, total] = await Promise.all([listOrderRecords({ limit }), countOrderRecords()]);
    return { records, total, error: null };
  } catch (error) {
    console.error('[orders] could not load order history', error);
    return { records: [], total: 0, error: 'Could not reach the database. Check MONGODB_URI and the Atlas network access list.' };
  }
}

/**
 * Converts a MongoDB document into the plain JSON the React components use.
 * `_id` (an ObjectId) and `createdAt` (a Date) are not serialisable across
 * the server → client component boundary, so they become strings here.
 */
function toRecord(document) {
  const { _id, ...rest } = document;
  return {
    ...rest,
    id: document.orderId,
    createdAt: document.createdAt instanceof Date ? document.createdAt.toISOString() : String(document.createdAt),
  };
}
