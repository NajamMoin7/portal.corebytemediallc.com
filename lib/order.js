import { US_STATES } from '@/data/us-states';
import { COUNTRY } from '@/data/site';
import { isValidAgent } from '@/data/agents';
import {
  ORDER_NUMBER_PATTERN,
  generateOrderNumber,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidZipCode,
  parseMoney,
  toCents,
} from './utils';

/**
 * The order model shared by the form (client) and the charge route (server).
 *
 * An order is a single amount charged to a card, with the billing details
 * NMI needs for AVS, an optional shipping address, and the agent who took
 * it. Keeping the shape, normalisation and validation in one module means
 * the server never trusts the client's checks — it re-runs exactly the same
 * rules on the raw request body before touching the gateway.
 */

const STATE_CODES = new Set(US_STATES.map((state) => state.code));

export const MAX_AMOUNT = 25000;

export function emptyAddress() {
  return {
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
  };
}

export function emptyOrder() {
  return {
    orderId: generateOrderNumber(),
    agent: '',
    amount: '',
    invoiceNumber: '',
    description: '',
    customer: {
      ...emptyAddress(),
      phone: '',
      fax: '',
      email: '',
      website: '',
      country: COUNTRY.code,
    },
    shipToBilling: true,
    shipping: {
      ...emptyAddress(),
      email: '',
    },
  };
}

const text = (value, max = 200) => String(value ?? '').trim().slice(0, max);

function normaliseAddress(input = {}) {
  return {
    firstName: text(input.firstName, 60),
    lastName: text(input.lastName, 60),
    company: text(input.company, 100),
    address1: text(input.address1, 120),
    address2: text(input.address2, 120),
    city: text(input.city, 60),
    state: text(input.state, 2).toUpperCase(),
    zip: text(input.zip, 10),
  };
}

/** "example.com" becomes "https://example.com" so a bare domain validates. */
function normaliseWebsite(value) {
  const site = text(value, 200);
  if (!site || /^https?:\/\//i.test(site)) return site;
  return `https://${site}`;
}

/**
 * Coerces an untrusted order (form state or request body) into clean values.
 * Strings are trimmed and length-capped; the amount becomes a number in
 * whole cents.
 */
export function normaliseOrder(input = {}) {
  return {
    orderId: text(input.orderId, 40),
    agent: text(input.agent, 60),
    amount: parseMoney(input.amount),
    invoiceNumber: text(input.invoiceNumber, 40),
    description: text(input.description, 255),
    customer: {
      ...normaliseAddress(input.customer),
      phone: text(input.customer?.phone, 30),
      fax: text(input.customer?.fax, 30),
      email: text(input.customer?.email, 120).toLowerCase(),
      website: normaliseWebsite(input.customer?.website),
      country: COUNTRY.code,
    },
    shipToBilling: input.shipToBilling !== false,
    shipping: {
      ...normaliseAddress(input.shipping),
      email: text(input.shipping?.email, 120).toLowerCase(),
    },
  };
}

/** The figure sent to the gateway, rounded to cents. Kept as an object so records stay uniform. */
export function orderTotals(order) {
  return { total: toCents(order.amount) };
}

function validateAddress(address, prefix, errors) {
  if (!address.firstName) errors[`${prefix}.firstName`] = 'First name is required.';
  if (!address.lastName) errors[`${prefix}.lastName`] = 'Last name is required.';
  if (!address.address1) errors[`${prefix}.address1`] = 'Address is required.';
  if (!address.city) errors[`${prefix}.city`] = 'City is required.';
  if (!address.state) errors[`${prefix}.state`] = 'Select a state.';
  else if (!STATE_CODES.has(address.state)) errors[`${prefix}.state`] = 'Unknown state code.';
  if (!address.zip) errors[`${prefix}.zip`] = 'Zip code is required.';
  else if (!isValidZipCode(address.zip)) errors[`${prefix}.zip`] = 'Enter a valid US zip code.';
}

/**
 * Validates a *normalised* order. Returns `{ valid, errors }` where `errors`
 * is keyed by dotted field path (`customer.email`, `shipping.zip`).
 */
export function validateOrder(order) {
  const errors = {};

  if (!ORDER_NUMBER_PATTERN.test(order.orderId)) {
    errors.orderId = 'Order reference is malformed.';
  }

  if (!order.agent) errors.agent = 'Select your name in the Agent picker at the top of the page.';
  else if (!isValidAgent(order.agent)) errors.agent = 'Unknown agent.';

  if (!(order.amount > 0)) errors.amount = 'Enter an amount above $0.';
  else if (order.amount > MAX_AMOUNT) errors.amount = `Amount cannot exceed $${MAX_AMOUNT.toLocaleString()} in the portal.`;

  validateAddress(order.customer, 'customer', errors);
  if (!order.customer.phone) errors['customer.phone'] = 'Phone number is required.';
  else if (!isValidPhone(order.customer.phone)) errors['customer.phone'] = 'Enter a valid US phone number.';
  if (order.customer.fax && !isValidPhone(order.customer.fax)) errors['customer.fax'] = 'Enter a valid US fax number, or leave it blank.';
  if (!order.customer.email) errors['customer.email'] = 'Email is required.';
  else if (!isValidEmail(order.customer.email)) errors['customer.email'] = 'Enter a valid email address.';
  if (order.customer.website && !isValidUrl(order.customer.website)) {
    errors['customer.website'] = 'Enter a website address like example.com, or leave it blank.';
  }

  if (!order.shipToBilling) {
    validateAddress(order.shipping, 'shipping', errors);
    if (order.shipping.email && !isValidEmail(order.shipping.email)) {
      errors['shipping.email'] = 'Enter a valid email address, or leave it blank.';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** The address the parcel goes to — billing unless a separate one was given. */
export function shippingAddress(order) {
  return order.shipToBilling ? order.customer : order.shipping;
}

/** What appears against the transaction in NMI, e.g. "custom logo (Inv. 483920)". */
export function orderDescription(order, maxLength = 255) {
  const parts = [order.description, order.invoiceNumber ? `Inv. ${order.invoiceNumber}` : ''].filter(Boolean);
  const summary = parts.length ? parts.join(' — ') : 'Core Byte Media order';
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 1)}…` : summary;
}
