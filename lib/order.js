import { US_STATES } from '@/data/us-states';
import { COUNTRY, ORDER_DEFAULTS } from '@/data/site';
import { CUSTOM_PRODUCT_ID, findProduct } from '@/data/products';
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
 * Keeping the shape, normalisation and validation in one module means the
 * server never trusts the client's arithmetic or field checks — it re-runs
 * exactly the same rules on the raw request body before touching the gateway.
 */

const STATE_CODES = new Set(US_STATES.map((state) => state.code));

export const MAX_ITEMS = 10;
export const MAX_QUANTITY = 500;
export const MAX_UNIT_PRICE = 5000;
export const MAX_TOTAL = 25000;

export function emptyAddress() {
  return {
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
  };
}

export function emptyItem(product = null) {
  return {
    key: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: product ? String(product.id) : '',
    name: product ? product.name : '',
    sku: product ? product.sku : '',
    size: product?.sizes?.length === 1 ? product.sizes[0] : '',
    color: product?.colors?.length === 1 ? product.colors[0] : '',
    quantity: '1',
    unitPrice: product ? String(product.price) : '',
    printMethod: '',
    placement: '',
    artworkUrl: '',
    notes: '',
  };
}

export function emptyOrder() {
  return {
    orderId: generateOrderNumber(),
    customer: {
      ...emptyAddress(),
      email: '',
      phone: '',
      country: COUNTRY.code,
    },
    shipToBilling: true,
    shipping: emptyAddress(),
    items: [emptyItem()],
    charges: {
      shipping: String(ORDER_DEFAULTS.shipping),
      tax: String(ORDER_DEFAULTS.tax),
    },
    notes: '',
  };
}

const text = (value, max = 200) => String(value ?? '').trim().slice(0, max);

function normaliseAddress(input = {}) {
  return {
    firstName: text(input.firstName, 60),
    lastName: text(input.lastName, 60),
    address1: text(input.address1, 120),
    address2: text(input.address2, 120),
    city: text(input.city, 60),
    state: text(input.state, 2).toUpperCase(),
    zip: text(input.zip, 10),
  };
}

/**
 * Coerces an untrusted order (form state or request body) into clean values.
 * Strings are trimmed and length-capped; money and quantities become numbers.
 */
export function normaliseOrder(input = {}) {
  const items = Array.isArray(input.items) ? input.items.slice(0, MAX_ITEMS) : [];

  return {
    orderId: text(input.orderId, 40),
    customer: {
      ...normaliseAddress(input.customer),
      email: text(input.customer?.email, 120).toLowerCase(),
      phone: text(input.customer?.phone, 30),
      country: COUNTRY.code,
    },
    shipToBilling: input.shipToBilling !== false,
    shipping: normaliseAddress(input.shipping),
    items: items.map((item) => {
      const productId = text(item?.productId, 20);
      const product = productId === CUSTOM_PRODUCT_ID ? null : findProduct(productId);
      return {
        key: text(item?.key, 40),
        productId,
        // Catalogue lines take their name and SKU from the catalogue, never
        // from the request, so the transaction record cannot be mislabelled.
        name: product ? product.name : text(item?.name, 120),
        sku: product ? product.sku : text(item?.sku, 40),
        size: text(item?.size, 30),
        color: text(item?.color, 30),
        quantity: Number.parseInt(item?.quantity, 10),
        unitPrice: parseMoney(item?.unitPrice),
        printMethod: text(item?.printMethod, 60),
        placement: text(item?.placement, 60),
        artworkUrl: text(item?.artworkUrl, 500),
        notes: text(item?.notes, 500),
      };
    }),
    charges: {
      shipping: parseMoney(input.charges?.shipping),
      tax: parseMoney(input.charges?.tax),
    },
    notes: text(input.notes, 1000),
  };
}

/** Subtotal, charges and total for a normalised order, all rounded to cents. */
export function orderTotals(order) {
  const subtotal = toCents(
    order.items.reduce((sum, item) => {
      const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
      return sum + quantity * (Number(item.unitPrice) || 0);
    }, 0),
  );
  const shipping = toCents(order.charges.shipping);
  const tax = toCents(order.charges.tax);
  return { subtotal, shipping, tax, total: toCents(subtotal + shipping + tax) };
}

function validateAddress(address, prefix, errors) {
  if (!address.firstName) errors[`${prefix}.firstName`] = 'First name is required.';
  if (!address.lastName) errors[`${prefix}.lastName`] = 'Last name is required.';
  if (!address.address1) errors[`${prefix}.address1`] = 'Street address is required.';
  if (!address.city) errors[`${prefix}.city`] = 'City is required.';
  if (!address.state) errors[`${prefix}.state`] = 'Select a state.';
  else if (!STATE_CODES.has(address.state)) errors[`${prefix}.state`] = 'Unknown state code.';
  if (!address.zip) errors[`${prefix}.zip`] = 'ZIP code is required.';
  else if (!isValidZipCode(address.zip)) errors[`${prefix}.zip`] = 'Enter a valid US ZIP code.';
}

/**
 * Validates a *normalised* order. Returns `{ valid, errors }` where `errors`
 * is keyed by dotted field path (`customer.email`, `items.2.quantity`).
 */
export function validateOrder(order) {
  const errors = {};

  if (!ORDER_NUMBER_PATTERN.test(order.orderId)) {
    errors.orderId = 'Order reference is malformed.';
  }

  validateAddress(order.customer, 'customer', errors);
  if (!order.customer.email) errors['customer.email'] = 'Email is required.';
  else if (!isValidEmail(order.customer.email)) errors['customer.email'] = 'Enter a valid email address.';
  if (!order.customer.phone) errors['customer.phone'] = 'Phone number is required.';
  else if (!isValidPhone(order.customer.phone)) errors['customer.phone'] = 'Enter a valid US phone number.';

  if (!order.shipToBilling) {
    validateAddress(order.shipping, 'shipping', errors);
  }

  if (order.items.length === 0) {
    errors.items = 'Add at least one product.';
  }

  order.items.forEach((item, index) => {
    const prefix = `items.${index}`;
    const isCustom = item.productId === CUSTOM_PRODUCT_ID;
    const product = isCustom ? null : findProduct(item.productId);

    if (!item.productId) {
      errors[`${prefix}.productId`] = 'Choose a product.';
    } else if (!isCustom && !product) {
      errors[`${prefix}.productId`] = 'Unknown product.';
    }

    if (isCustom && !item.name) errors[`${prefix}.name`] = 'Describe the custom item.';

    if (product) {
      if (product.sizes.length > 0 && !item.size) errors[`${prefix}.size`] = 'Choose a size.';
      else if (item.size && !product.sizes.includes(item.size)) errors[`${prefix}.size`] = 'Size not offered for this product.';
      if (product.colors.length > 0 && !item.color) errors[`${prefix}.color`] = 'Choose a colour.';
      else if (item.color && !product.colors.includes(item.color)) errors[`${prefix}.color`] = 'Colour not offered for this product.';
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      errors[`${prefix}.quantity`] = 'Quantity must be at least 1.';
    } else if (item.quantity > MAX_QUANTITY) {
      errors[`${prefix}.quantity`] = `Quantity cannot exceed ${MAX_QUANTITY}.`;
    }

    if (!(item.unitPrice > 0)) {
      errors[`${prefix}.unitPrice`] = 'Enter a unit price above $0.';
    } else if (item.unitPrice > MAX_UNIT_PRICE) {
      errors[`${prefix}.unitPrice`] = `Unit price cannot exceed $${MAX_UNIT_PRICE}.`;
    }

    if (item.artworkUrl && !isValidUrl(item.artworkUrl)) {
      errors[`${prefix}.artworkUrl`] = 'Enter a full http(s) link, or leave it blank.';
    }
  });

  if (order.charges.shipping < 0) errors['charges.shipping'] = 'Shipping cannot be negative.';
  if (order.charges.tax < 0) errors['charges.tax'] = 'Tax cannot be negative.';

  const { total } = orderTotals(order);
  if (Object.keys(errors).length === 0) {
    if (!(total > 0)) errors.total = 'Order total must be above $0.';
    else if (total > MAX_TOTAL) errors.total = `Order total cannot exceed $${MAX_TOTAL.toLocaleString()} in the portal.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** One-line description of the items, e.g. "2x Classic Core Tee (M, Black); 1x Custom mug". */
export function itemsSummary(items, maxLength = 255) {
  const summary = items
    .map((item) => {
      const options = [item.size, item.color].filter(Boolean).join(', ');
      return `${item.quantity}x ${item.name}${options ? ` (${options})` : ''}`;
    })
    .join('; ');
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 1)}…` : summary;
}

/** The address the parcel goes to — billing unless a separate one was given. */
export function shippingAddress(order) {
  return order.shipToBilling ? order.customer : order.shipping;
}
