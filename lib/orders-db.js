import { TIMEZONE } from '@/data/site';
import { getCollection, isDatabaseConfigured } from './mongodb';
import { listUsers } from './users';

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
 *     agent:           'Haziq'               // name of the signed-in agent
 *     agentId:         '65f…'                // their users._id, for scoping
 *     transactionType: 'sale' | 'auth'
 *     order:           normalised order (lib/order.js)
 *     totals:          { total }
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
      orders.createIndex({ agent: 1, createdAt: -1 }),
      orders.createIndex({ agentId: 1, createdAt: -1 }),
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
    agent: record.agent ?? null,
    agentId: record.agentId ?? null,
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

/**
 * Newest first. `limit` caps the list, `email` filters to one customer and
 * `agentId` to one agent — agents only ever see their own orders.
 */
export async function listOrderRecords({ limit = 100, email = null, agentId = null } = {}) {
  const orders = await ordersCollection();
  const filter = {};
  if (email) filter['order.customer.email'] = String(email).toLowerCase();
  if (agentId) filter.agentId = String(agentId);
  const documents = await orders
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 500))
    .toArray();
  return documents.map(toRecord);
}

export async function countOrderRecords({ agentId = null } = {}) {
  const orders = await ordersCollection();
  return orders.countDocuments(agentId ? { agentId: String(agentId) } : {});
}

/** A single order by its CBM reference, or null. */
export async function findOrderRecord(orderId) {
  const orders = await ordersCollection();
  const document = await orders.findOne({ orderId: String(orderId) });
  return document ? toRecord(document) : null;
}

export const STAT_PERIODS = ['day', 'month', 'year', 'all'];

/**
 * Per-agent totals for today, this month, this year and all time.
 *
 * One aggregation pipeline does all the work in the database:
 *   $group by agent, and for each period add the order's total only when
 *   `createdAt` is on or after the start of that period. `$dateTrunc` on
 *   `$$NOW` gives "start of today / this month / this year" in the business
 *   timezone, so the boundaries do not shift with the server's clock.
 *
 * Agents with no orders still appear (with zeros) so the table is complete,
 * and any agent no longer in the list is kept so history does not vanish.
 */
export async function agentStats({ agentId = null } = {}) {
  const orders = await ordersCollection();

  const since = (unit) => ({ $dateTrunc: { date: '$$NOW', unit, timezone: TIMEZONE } });
  const inPeriod = (unit) => ({ $gte: ['$createdAt', since(unit)] });
  const sumIf = (unit, value) => ({ $sum: { $cond: [inPeriod(unit), value, 0] } });

  const rows = await orders
    .aggregate([
      ...(agentId ? [{ $match: { agentId: String(agentId) } }] : []),
      {
        $group: {
          _id: { $ifNull: ['$agent', 'Unassigned'] },
          day: sumIf('day', '$totals.total'),
          dayCount: sumIf('day', 1),
          month: sumIf('month', '$totals.total'),
          monthCount: sumIf('month', 1),
          year: sumIf('year', '$totals.total'),
          yearCount: sumIf('year', 1),
          all: { $sum: '$totals.total' },
          allCount: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const byAgent = new Map(rows.map((row) => [row._id, row]));

  // Everyone who can take orders, so a new agent shows a zero row rather than
  // being invisible until their first sale. Archived staff are included only
  // when they actually have orders, which the merge below handles.
  let staffNames = [];
  if (!agentId) {
    try {
      staffNames = (await listUsers())
        .filter((user) => !user.archived && user.status === 'active')
        .map((user) => user.name);
    } catch (error) {
      console.error('[orders] could not list staff for the totals', error);
    }
  }
  const names = [...staffNames, ...rows.map((row) => row._id).filter((name) => !staffNames.includes(name))];

  return names
    .map((name) => {
      const row = byAgent.get(name) || {};
      const period = (key) => ({ total: round(row[key] || 0), count: row[`${key}Count`] || 0 });
      return { agent: name, day: period('day'), month: period('month'), year: period('year'), all: period('all') };
    })
    .sort((a, b) => b.all.total - a.all.total || a.agent.localeCompare(b.agent));
}

const round = (value) => Math.round(value * 100) / 100;

/** `agentStats()` with the same never-throws contract as `loadOrderHistory`. */
export async function loadAgentStats({ agentId = null } = {}) {
  if (!isDatabaseConfigured()) return { rows: [], error: 'MONGODB_URI is not set.' };
  try {
    return { rows: await agentStats({ agentId }), error: null };
  } catch (error) {
    console.error('[orders] could not load agent stats', error);
    return { rows: [], error: 'Could not reach the database.' };
  }
}

/**
 * What the history pages render: the list plus the total count, or a
 * human-readable `error` when the database is unconfigured or unreachable.
 * Never throws — a database outage must not take the whole portal down.
 */
export async function loadOrderHistory({ limit = 100, agentId = null } = {}) {
  if (!isDatabaseConfigured()) {
    return {
      records: [],
      total: 0,
      error: 'MONGODB_URI is not set. Add the MongoDB connection string to the environment and redeploy.',
    };
  }
  try {
    const [records, total] = await Promise.all([
      listOrderRecords({ limit, agentId }),
      countOrderRecords({ agentId }),
    ]);
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
