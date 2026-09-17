import { CURRENCY } from '@/data/site';

/** Joins class names, dropping falsy values. */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

const priceFormatter = new Intl.NumberFormat(CURRENCY.locale, {
  style: 'currency',
  currency: CURRENCY.code,
  minimumFractionDigits: CURRENCY.decimals,
  maximumFractionDigits: CURRENCY.decimals,
});

export function formatPrice(value) {
  return priceFormatter.format(Number(value) || 0);
}

/** Rounds to cents, avoiding the usual 0.1 + 0.2 float drift. */
export function toCents(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Parses a money input; empty or junk becomes 0. */
export function parseMoney(value) {
  const number = Number.parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) ? toCents(number) : 0;
}

/**
 * Order reference sent to NMI as `orderid`, e.g. CBM-20260917-48213. Unique
 * enough for a single-user portal; NMI's own transaction id is the real key.
 */
export function generateOrderNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 90000 + 10000);
  return `CBM-${stamp}-${random}`;
}

export const ORDER_NUMBER_PATTERN = /^CBM-\d{8}-\d{5}$/;

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date instanceof Date ? date : new Date(date));
}

/** Basic, permissive email shape check — the server validates again. */
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
}

/**
 * US phone numbers in the formats people actually type. Strict only about
 * digit count.
 */
export function isValidPhone(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 10) return true;
  return digits.length === 11 && digits.startsWith('1');
}

/** Formats 10 digits as (555) 123-4567, leaving anything else untouched. */
export function formatPhone(value) {
  const digits = String(value).replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return value;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

/** US ZIP codes: five digits, optionally with a four-digit extension. */
export function isValidZipCode(value) {
  return /^\d{5}(-\d{4})?$/.test(String(value).trim());
}

/** Optional artwork links must at least look like an http(s) URL. */
export function isValidUrl(value) {
  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
