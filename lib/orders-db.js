import { CHARGEBACK_PENALTY, TIMEZONE } from '@/data/site';
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
 *     chargeback:      { status, markedAt, markedBy, reason, penalty, … }
 *     chargebackLog:   append-only list of every mark/clear, never trimmed
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
      orders.createIndex({ 'chargeback.status': 1, createdAt: -1 }),
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
 * Matches every order belonging to one agent, as `{ id, name }`.
 *
 * Orders taken since agents had their own logins carry `agentId`. Ones taken
 * before that only carry the agent's name, so they are claimed by name too —
 * otherwise an agent's own history would look empty to them. In MongoDB a
 * `null` match also matches documents where the field is absent, which is
 * what those older records look like.
 */
function agentScope(agent) {
  if (!agent) return null;
  const clauses = [];
  if (agent.id) clauses.push({ agentId: String(agent.id) });
  if (agent.name) clauses.push({ agentId: null, agent: agent.name });
  if (clauses.length === 0) return null;
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

/** Escapes a user's text so it can go into a regex as literal characters. */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Free-text search across the fields staff actually look things up by.
 *
 * Substring, case-insensitive, so "smith", "CBM-2026", "acme" and part of a
 * transaction id all work. A phone number is matched on digits alone, so
 * "5125550123" finds a record stored as "(512) 555-0123". A bare number also
 * tries the amount, which is how people search for "51.20".
 */
function searchScope(query) {
  const text = String(query ?? '').trim();
  if (!text) return null;

  const loose = new RegExp(escapeRegex(text), 'i');
  const clauses = [
    { orderId: loose },
    { agent: loose },
    { placedBy: loose },
    { 'result.transactionId': loose },
    { 'result.authCode': loose },
    { 'order.customer.firstName': loose },
    { 'order.customer.lastName': loose },
    { 'order.customer.company': loose },
    { 'order.customer.email': loose },
    { 'order.customer.city': loose },
    { 'order.customer.zip': loose },
    { 'order.invoiceNumber': loose },
    { 'order.description': loose },
    { 'card.last4': loose },
  ];

  // Phone: compare digits to digits so formatting never gets in the way.
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 4) {
    const phone = new RegExp(digits.split('').join('\\D*'));
    clauses.push({ 'order.customer.phone': phone }, { 'order.customer.fax': phone });
  }

  const amount = Number.parseFloat(text.replace(/[^0-9.]/g, ''));
  if (Number.isFinite(amount) && /^\s*\$?[\d,]+(\.\d{1,2})?\s*$/.test(text)) {
    clauses.push({ 'totals.total': amount });
  }

  return { $or: clauses };
}

/** Builds the query for a list or a count, so both always agree. */
function orderFilter({ email = null, agent = null, period = null, query = null, chargedBack = false } = {}) {
  const filter = {};
  if (email) filter['order.customer.email'] = String(email).toLowerCase();
  if (chargedBack) filter['chargeback.status'] = 'charged_back';

  // Each of these can contribute an `$or`, and a plain merge would let the
  // last one win. `$and` keeps every condition in force.
  const scopes = [agentScope(agent), periodScope(period), searchScope(query)].filter(Boolean);
  if (scopes.length === 1) Object.assign(filter, scopes[0]);
  else if (scopes.length > 1) filter.$and = scopes;

  return filter;
}

/**
 * Matches the orders inside one calendar month ("2026-09") or year ("2026").
 *
 * The comparison is done on the date formatted in the business timezone, so a
 * month runs from local midnight to local midnight and matches what the
 * totals table shows. It cannot use an index, which is fine at this volume
 * and is worth it for always agreeing with `agentStats`.
 */
function periodScope(period) {
  if (!period?.value) return null;
  const format = period.type === 'year' ? '%Y' : '%Y-%m';
  return {
    $expr: {
      $eq: [{ $dateToString: { date: '$createdAt', format, timezone: TIMEZONE } }, String(period.value)],
    },
  };
}

/**
 * Every month and year that actually has orders, newest first, so the report
 * picker only ever offers periods with something in them.
 */
export async function listReportPeriods({ agent = null } = {}) {
  const orders = await ordersCollection();
  const rows = await orders
    .aggregate([
      ...(agentScope(agent) ? [{ $match: agentScope(agent) }] : []),
      {
        $group: {
          _id: { $dateToString: { date: '$createdAt', format: '%Y-%m', timezone: TIMEZONE } },
          count: { $sum: 1 },
          total: { $sum: '$totals.total' },
        },
      },
      { $sort: { _id: -1 } },
    ])
    .toArray();

  const months = rows.map((row) => ({ value: row._id, count: row.count, total: round(row.total) }));
  const byYear = new Map();
  for (const month of months) {
    const year = month.value.slice(0, 4);
    const entry = byYear.get(year) || { value: year, count: 0, total: 0 };
    entry.count += month.count;
    entry.total = round(entry.total + month.total);
    byYear.set(year, entry);
  }
  return { months, years: [...byYear.values()].sort((a, b) => b.value.localeCompare(a.value)) };
}

/**
 * Newest first. `limit` caps the list, `skip` pages through it, `email`
 * filters to one customer and `agent` to one agent — agents only ever see
 * their own orders.
 */
export async function listOrderRecords({
  limit = 100,
  skip = 0,
  email = null,
  agent = null,
  period = null,
  query = null,
  chargedBack = false,
} = {}) {
  const orders = await ordersCollection();
  const documents = await orders
    .find(orderFilter({ email, agent, period, query, chargedBack }))
    .sort({ createdAt: -1 })
    .skip(Math.max(Number(skip) || 0, 0))
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 1000))
    .toArray();
  return documents.map(toRecord);
}

export async function countOrderRecords({
  email = null,
  agent = null,
  period = null,
  query = null,
  chargedBack = false,
} = {}) {
  const orders = await ordersCollection();
  return orders.countDocuments(orderFilter({ email, agent, period, query, chargedBack }));
}

/** A single order by its CBM reference, or null. */
export async function findOrderRecord(orderId) {
  const orders = await ordersCollection();
  const document = await orders.findOne({ orderId: String(orderId) });
  return document ? toRecord(document) : null;
}

export const STAT_PERIODS = ['day', 'prevMonth', 'month', 'year'];

/**
 * Column headings for the totals table, worked out in the business timezone
 * so they roll over with the calendar: in September they read "Previous
 * Month (Aug)" and "This Month (Sep)"; in October, "(Sep)" and "(Oct)".
 *
 * The month names are built from a UTC date and formatted in UTC on purpose —
 * only the year and month come from the timezone, so no hour-of-day or DST
 * shift can push the label into a neighbouring month.
 */
export function statPeriodLabels(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year').value);
  const month = Number(parts.find((part) => part.type === 'month').value);

  // Mid-month at noon, so the name is never ambiguous. A month of 0 rolls
  // back into December of the previous year by itself.
  const named = (offset) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(
      new Date(Date.UTC(year, month - 1 + offset, 15, 12)),
    );

  return [
    { key: 'day', label: 'Today' },
    { key: 'prevMonth', label: `Previous Month (${named(-1)})` },
    { key: 'month', label: `This Month (${named(0)})` },
    { key: 'year', label: `Year (${String(year).slice(-2)})` },
  ];
}

/**
 * Per-agent totals for today, this month, this year and all time.
 *
 * One aggregation pipeline does all the work in the database:
 *   $group by agent, and for each period add the order's total only when
 *   `createdAt` is on or after the start of that period. `$dateTrunc` on
 *   `$$NOW` gives "start of today / this month / this year" in the business
 *   timezone, so the boundaries do not shift with the server's clock.
 *
 * The previous month is a half-open range — on or after the start of last
 * month and before the start of this one — so an order never counts in two
 * month columns at once.
 *
 * Agents with no orders still appear (with zeros) so the table is complete,
 * and any agent no longer in the list is kept so history does not vanish.
 */
export async function agentStats({ agent = null } = {}) {
  const scope = agentScope(agent);
  const orders = await ordersCollection();

  const since = (unit) => ({ $dateTrunc: { date: '$$NOW', unit, timezone: TIMEZONE } });
  const inPeriod = (unit) => ({ $gte: ['$createdAt', since(unit)] });
  const sumIf = (unit, value) => ({ $sum: { $cond: [inPeriod(unit), value, 0] } });

  // Last month: [start of last month, start of this month).
  const lastMonthStart = { $dateSubtract: { startDate: since('month'), unit: 'month', amount: 1 } };
  const inLastMonth = {
    $and: [{ $gte: ['$createdAt', lastMonthStart] }, { $lt: ['$createdAt', since('month')] }],
  };
  const sumIfLastMonth = (value) => ({ $sum: { $cond: [inLastMonth, value, 0] } });

  const rows = await orders
    .aggregate([
      ...(scope ? [{ $match: scope }] : []),
      {
        $group: {
          _id: { $ifNull: ['$agent', 'Unassigned'] },
          day: sumIf('day', '$totals.total'),
          dayCount: sumIf('day', 1),
          prevMonth: sumIfLastMonth('$totals.total'),
          prevMonthCount: sumIfLastMonth(1),
          month: sumIf('month', '$totals.total'),
          monthCount: sumIf('month', 1),
          year: sumIf('year', '$totals.total'),
          yearCount: sumIf('year', 1),
          all: { $sum: '$totals.total' },
          allCount: { $sum: 1 },
          chargebackCount: { $sum: { $cond: [{ $eq: ['$chargeback.status', 'charged_back'] }, 1, 0] } },
          chargebackAmount: { $sum: { $cond: [{ $eq: ['$chargeback.status', 'charged_back'] }, '$totals.total', 0] } },
          chargebackPenalty: {
            $sum: {
              $cond: [
                { $eq: ['$chargeback.status', 'charged_back'] },
                // Penalties keep the amount recorded at the time, so an older
                // chargeback is not repriced when the fee changes.
                { $ifNull: ['$chargeback.penalty', CHARGEBACK_PENALTY] },
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray();

  const byAgent = new Map(rows.map((row) => [row._id, row]));

  // Everyone who can take orders, so a new agent shows a zero row rather than
  // being invisible until their first sale. Archived staff are included only
  // when they actually have orders, which the merge below handles.
  // Scoped to one agent: show their own row even before their first order,
  // so the table never comes back empty.
  let staffNames = agent?.name ? [agent.name] : [];
  if (!agent) {
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
      return {
        agent: name,
        chargebacks: {
          count: row.chargebackCount || 0,
          amount: round(row.chargebackAmount || 0),
          penalty: round(row.chargebackPenalty || 0),
        },
        day: period('day'),
        prevMonth: period('prevMonth'),
        month: period('month'),
        year: period('year'),
        all: period('all'),
      };
    })
    // Busiest this month first — that is the column people scan.
    .sort(
      (a, b) =>
        b.month.total - a.month.total ||
        b.year.total - a.year.total ||
        a.agent.localeCompare(b.agent),
    );
}

const round = (value) => Math.round(value * 100) / 100;

/** `agentStats()` with the same never-throws contract as `loadOrderHistory`. */
export async function loadAgentStats({ agent = null } = {}) {
  const periods = statPeriodLabels();
  if (!isDatabaseConfigured()) return { rows: [], periods, error: 'MONGODB_URI is not set.' };
  try {
    return { rows: await agentStats({ agent }), periods, error: null };
  } catch (error) {
    console.error('[orders] could not load agent stats', error);
    return { rows: [], periods, error: 'Could not reach the database.' };
  }
}

/**
 * What the history pages render: the list plus the total count, or a
 * human-readable `error` when the database is unconfigured or unreachable.
 * Never throws — a database outage must not take the whole portal down.
 */
export async function loadOrderHistory({
  limit = 100,
  page = 1,
  agent = null,
  period = null,
  query = null,
} = {}) {
  const empty = { records: [], total: 0, page: 1, pageSize: limit, pageCount: 1, query };
  if (!isDatabaseConfigured()) {
    return {
      ...empty,
      error: 'MONGODB_URI is not set. Add the MongoDB connection string to the environment and redeploy.',
    };
  }
  try {
    const total = await countOrderRecords({ agent, period, query });
    const pageCount = Math.max(1, Math.ceil(total / limit));
    // Clamp rather than 404: a stale link to page 9 of a list that has since
    // shrunk should land on the last page, not an error.
    const current = Math.min(Math.max(Number(page) || 1, 1), pageCount);
    const records = await listOrderRecords({ limit, skip: (current - 1) * limit, agent, period, query });
    return { records, total, page: current, pageSize: limit, pageCount, query, error: null };
  } catch (error) {
    console.error('[orders] could not load order history', error);
    return { ...empty, error: 'Could not reach the database. Check MONGODB_URI and the Atlas network access list.' };
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
    chargeback: document.chargeback
      ? {
          ...document.chargeback,
          markedAt: document.chargeback.markedAt ? document.chargeback.markedAt.toISOString() : null,
          clearedAt: document.chargeback.clearedAt ? document.chargeback.clearedAt.toISOString() : null,
        }
      : null,
    // The log is for the audit trail on the server; the list does not need it.
    chargebackLog: undefined,
    id: document.orderId,
    createdAt: document.createdAt instanceof Date ? document.createdAt.toISOString() : String(document.createdAt),
  };
}

/* -------------------------------------------------------------------------- */
/* Chargebacks                                                                 */
/* -------------------------------------------------------------------------- */

export const CHARGEBACK_STATUSES = ['none', 'charged_back'];

/**
 * Marks an order as charged back and records the penalty against the agent
 * who took it.
 *
 * The agent is never passed in: it is read from the order itself, so a
 * penalty always lands on whoever actually took the payment. The fee in force
 * at the time is copied onto the record, so changing `CHARGEBACK_PENALTY`
 * later does not silently reprice past chargebacks.
 *
 * Nothing is deleted or overwritten — every mark and clear is appended to
 * `chargebackLog`, so the full history survives even after a dispute is won.
 */
export async function markChargeback(orderId, { by, reason = '', penalty = CHARGEBACK_PENALTY } = {}) {
  const orders = await ordersCollection();
  const now = new Date();

  const document = await orders.findOneAndUpdate(
    { orderId: String(orderId) },
    {
      $set: {
        chargeback: {
          status: 'charged_back',
          markedAt: now,
          markedBy: by ?? null,
          reason: String(reason ?? '').trim().slice(0, 500),
          penalty: Number(penalty) || 0,
          clearedAt: null,
          clearedBy: null,
        },
      },
      $push: {
        chargebackLog: {
          action: 'marked',
          at: now,
          by: by ?? null,
          reason: String(reason ?? '').trim().slice(0, 500),
          penalty: Number(penalty) || 0,
        },
      },
    },
    { returnDocument: 'after' },
  );

  return document ? toRecord(document) : null;
}

/**
 * Clears a chargeback — the dispute was won, or it was marked by mistake.
 *
 * The penalty stops counting, but the record of it having happened stays in
 * `chargebackLog`.
 */
export async function clearChargeback(orderId, { by, reason = '' } = {}) {
  const orders = await ordersCollection();
  const now = new Date();

  const document = await orders.findOneAndUpdate(
    { orderId: String(orderId) },
    {
      $set: {
        'chargeback.status': 'none',
        'chargeback.clearedAt': now,
        'chargeback.clearedBy': by ?? null,
        'chargeback.penalty': 0,
      },
      $push: {
        chargebackLog: {
          action: 'cleared',
          at: now,
          by: by ?? null,
          reason: String(reason ?? '').trim().slice(0, 500),
        },
      },
    },
    { returnDocument: 'after' },
  );

  return document ? toRecord(document) : null;
}

/** Charged-back orders, newest first — optionally for one agent. */
export async function listChargebacks({ agent = null, limit = 100 } = {}) {
  return listOrderRecords({ agent, limit, chargedBack: true });
}

/**
 * Chargeback headline for a scope: how many, how much was disputed and what
 * the penalties come to. Never throws.
 */
export async function loadChargebackSummary({ agent = null } = {}) {
  const empty = { count: 0, amount: 0, penalty: 0, records: [], error: null };
  if (!isDatabaseConfigured()) return { ...empty, error: 'MONGODB_URI is not set.' };

  try {
    const records = await listChargebacks({ agent, limit: 200 });
    return {
      count: records.length,
      amount: round(records.reduce((sum, record) => sum + (Number(record.totals?.total) || 0), 0)),
      penalty: round(records.reduce((sum, record) => sum + (Number(record.chargeback?.penalty) || 0), 0)),
      records,
      error: null,
    };
  } catch (error) {
    console.error('[orders] could not load chargebacks', error);
    return { ...empty, error: 'Could not reach the database.' };
  }
}
