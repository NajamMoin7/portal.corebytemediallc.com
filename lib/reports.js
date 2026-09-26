import { TIMEZONE } from '@/data/site';
import { countOrderRecords, listOrderRecords } from './orders-db';
import { formatPhone } from './utils';

/**
 * Month and year reports for the super admin.
 *
 * A report is every approved order inside one calendar month ("2026-09") or
 * year ("2026"), plus a per-agent summary. Both are offered as CSV so they
 * open straight in Excel or Google Sheets.
 *
 * Server-only module.
 */

export const REPORT_TYPES = ['orders', 'summary'];
export const PERIOD_TYPES = ['month', 'year'];

/** Reports are read in one go, so this caps a runaway export. */
const MAX_ROWS = 5000;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_PATTERN = /^\d{4}$/;

/** Validates an untrusted `{ type, value }` period, or returns null. */
export function parsePeriod(type, value) {
  const periodType = PERIOD_TYPES.includes(type) ? type : null;
  if (!periodType) return null;
  const text = String(value ?? '').trim();
  if (periodType === 'month' && !MONTH_PATTERN.test(text)) return null;
  if (periodType === 'year' && !YEAR_PATTERN.test(text)) return null;
  return { type: periodType, value: text };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-09" becomes "September 2026"; "2026" stays "2026". */
export function periodLabel(period) {
  if (!period) return '';
  if (period.type === 'year') return period.value;
  const [year, month] = period.value.split('-');
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

/** A filename-safe stem, e.g. `core-byte-orders-2026-09`. */
export function reportFilename(period, type) {
  return `core-byte-${type}-${period.value}.csv`;
}

/**
 * The orders in a period plus per-agent and overall totals.
 *
 * Returns `{ period, records, totals, byAgent, truncated }`. `truncated` is
 * true when the period holds more orders than one export allows, so the page
 * can say so rather than quietly leaving rows out.
 */
export async function buildReport(period, { agent = null } = {}) {
  const [records, total] = await Promise.all([
    listOrderRecords({ period, agent, limit: MAX_ROWS }),
    countOrderRecords({ period, agent }),
  ]);

  const byAgent = new Map();
  for (const record of records) {
    const name = record.agent || 'Unassigned';
    const entry = byAgent.get(name) || { agent: name, count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(record.totals?.total) || 0;
    byAgent.set(name, entry);
  }

  const rows = [...byAgent.values()]
    .map((entry) => ({ ...entry, total: round(entry.total) }))
    .sort((a, b) => b.total - a.total || a.agent.localeCompare(b.agent));

  return {
    period,
    records,
    byAgent: rows,
    totals: {
      count: total,
      total: round(rows.reduce((sum, row) => sum + row.total, 0)),
    },
    truncated: total > records.length,
  };
}

const round = (value) => Math.round(value * 100) / 100;

/* -------------------------------------------------------------------------- */
/* CSV                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Escapes one CSV value.
 *
 * Besides the usual quoting, a leading `=`, `+`, `-` or `@` is prefixed with
 * a quote: spreadsheets treat those as the start of a formula, and customer
 * data should never be executed when the file is opened.
 */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers, rows) {
  // A BOM makes Excel read the file as UTF-8 rather than the system codepage.
  return `﻿${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Dates in the business timezone, so they match the portal and the totals. */
function formatDate(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

const address = (to) =>
  [to?.address1, to?.address2, to?.city && `${to.city}, ${to.state} ${to.zip}`].filter(Boolean).join(', ');

const ORDER_HEADERS = [
  'Order Reference', 'Date', 'Agent', 'Placed By', 'Type',
  'Amount', 'Invoice Number', 'Description',
  'Customer', 'Company', 'Email', 'Phone',
  'Billing Address', 'Shipping Address',
  'Transaction ID', 'Auth Code', 'Card', 'AVS', 'CVV',
];

/** One row per order: the detailed export. */
export function ordersCsv(report) {
  const rows = report.records.map((record) => {
    const { order, result, card } = record;
    const shipTo = order.shipToBilling ? order.customer : order.shipping;
    return [
      record.orderId,
      formatDate(record.createdAt),
      record.agent || '',
      record.placedBy || '',
      record.transactionType === 'auth' ? 'Authorised' : 'Sale',
      (Number(record.totals?.total) || 0).toFixed(2),
      order.invoiceNumber || '',
      order.description || '',
      `${order.customer.firstName} ${order.customer.lastName}`.trim(),
      order.customer.company || '',
      order.customer.email || '',
      formatPhone(order.customer.phone || ''),
      address(order.customer),
      order.shipToBilling ? 'Same as billing' : address(shipTo),
      result?.transactionId || '',
      result?.authCode || '',
      card?.last4 ? `${card.type || 'card'} ****${card.last4}` : '',
      result?.avsResponse || '',
      result?.cvvResponse || '',
    ];
  });

  return toCsv(ORDER_HEADERS, rows);
}

/** One row per agent, with a total row: the summary export. */
export function summaryCsv(report) {
  const rows = report.byAgent.map((row) => [row.agent, row.count, row.total.toFixed(2)]);
  rows.push(['TOTAL', report.totals.count, report.totals.total.toFixed(2)]);
  return toCsv([`Agent (${periodLabel(report.period)})`, 'Orders', 'Amount'], rows);
}

export function reportCsv(report, type) {
  return type === 'summary' ? summaryCsv(report) : ordersCsv(report);
}
