import { US_STATES } from '@/data/us-states';
import { formatPhone, parseMoney } from './utils';

/**
 * "Magic clipboard": turns a blob of pasted customer details into form fields.
 *
 * Agents are usually copying from an email, a chat message, a CRM record or a
 * spreadsheet row, so the shapes vary a lot. Two passes handle it:
 *
 *   1. labelled lines — `Email: x@y.com`, `Phone = 555…`, `Zip<TAB>78701`;
 *   2. whatever is left, by what the line looks like — an address block has
 *      no labels at all:
 *
 *        John Smith
 *        Acme, Inc
 *        123 Main St, Apt 4
 *        Austin, TX 78701
 *        (512) 555-0123
 *        john@example.com
 *
 * Nothing here writes to the form. It returns what it recognised so the agent
 * can look it over first — a wrong guess on a card payment is expensive, so
 * the parse is always reviewed before it is applied.
 *
 * Pure module: no DOM, no network. Safe on the server and easy to test.
 */

const STATE_BY_CODE = new Map(US_STATES.map((state) => [state.code, state.code]));
const STATE_BY_NAME = new Map(US_STATES.map((state) => [state.name.toLowerCase(), state.code]));

/** Every field the parser can fill, in the order the review list shows them. */
export const PASTE_FIELDS = [
  { key: 'firstName', label: 'First name', scoped: true },
  { key: 'lastName', label: 'Last name', scoped: true },
  { key: 'company', label: 'Company', scoped: true },
  { key: 'address1', label: 'Address', scoped: true },
  { key: 'address2', label: 'Address (cont.)', scoped: true },
  { key: 'city', label: 'City', scoped: true },
  { key: 'state', label: 'State', scoped: true },
  { key: 'zip', label: 'Zip code', scoped: true },
  { key: 'phone', label: 'Phone', scoped: true },
  { key: 'fax', label: 'Fax', scoped: true },
  { key: 'email', label: 'Email', scoped: true },
  { key: 'website', label: 'Website', scoped: true },
  { key: 'amount', label: 'Amount', scoped: false },
  { key: 'invoiceNumber', label: 'Invoice number', scoped: false },
  { key: 'description', label: 'Description', scoped: false },
];

/** Labels people actually type, reduced to letters so `Zip Code:` ≡ `zipcode`. */
const LABELS = new Map(
  Object.entries({
    firstname: 'firstName', first: 'firstName', fname: 'firstName', givenname: 'firstName',
    lastname: 'lastName', last: 'lastName', lname: 'lastName', surname: 'lastName', familyname: 'lastName',
    name: 'fullName', fullname: 'fullName', customer: 'fullName', customername: 'fullName',
    contact: 'fullName', contactname: 'fullName', client: 'fullName', clientname: 'fullName',
    cardholder: 'fullName', cardholdername: 'fullName', billto: 'fullName', shipto: 'fullName',
    attn: 'fullName', attention: 'fullName',
    company: 'company', companyname: 'company', business: 'company', businessname: 'company',
    organisation: 'company', organization: 'company', org: 'company',
    email: 'email', emailaddress: 'email', mail: 'email', eaddress: 'email',
    phone: 'phone', phonenumber: 'phone', telephone: 'phone', tel: 'phone', mobile: 'phone',
    cell: 'phone', cellphone: 'phone', contactnumber: 'phone', phoneno: 'phone',
    fax: 'fax', faxnumber: 'fax', faxno: 'fax',
    website: 'website', web: 'website', url: 'website', site: 'website', homepage: 'website',
    address: 'address1', address1: 'address1', addressline1: 'address1', street: 'address1',
    streetaddress: 'address1', billingaddress: 'address1', shippingaddress: 'address1', addr: 'address1',
    address2: 'address2', addressline2: 'address2', addresscont: 'address2', apt: 'address2',
    apartment: 'address2', suite: 'address2', unit: 'address2', floor: 'address2', building: 'address2',
    city: 'city', town: 'city', cityname: 'city',
    state: 'state', province: 'state', stateprovince: 'state', region: 'state',
    zip: 'zip', zipcode: 'zip', postcode: 'zip', postalcode: 'zip', postal: 'zip',
    amount: 'amount', total: 'amount', charge: 'amount', chargeamount: 'amount',
    price: 'amount', amountdue: 'amount', totaldue: 'amount', grandtotal: 'amount',
    invoice: 'invoiceNumber', invoicenumber: 'invoiceNumber', invoiceno: 'invoiceNumber',
    inv: 'invoiceNumber', invno: 'invoiceNumber', ponumber: 'invoiceNumber', po: 'invoiceNumber',
    reference: 'invoiceNumber', ref: 'invoiceNumber',
    description: 'description', desc: 'description', notes: 'description', note: 'description',
    memo: 'description', details: 'description', item: 'description', service: 'description',
    product: 'description', job: 'description',
  }),
);

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const URL_LIKE = /^(https?:\/\/|www\.)\S+$|^[A-Za-z0-9-]+\.(com|net|org|io|co|us|biz|info|shop|store|dev|app)(\/\S*)?$/i;
const ZIP = /^\d{5}(-\d{4})?$/;
const SECOND_LINE = /^(apt|apartment|suite|ste|unit|#|floor|fl|bldg|building|rm|room|po\s*box|p\.?o\.?\s*box)\b/i;
const STREET = /^(\d+[\w-]*)\s+\S/;
const COMPANYISH = /\b(inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|llp|pllc|plc|group|holdings|enterprises|services|solutions|studio|studios|media|labs?)\b\.?$/i;
const COUNTRY_LINE = /^(usa|u\.s\.a\.?|united states( of america)?|us)$/i;

/** `City, ST 78701` / `Austin TX 78701-1234` / `Austin, Texas 78701` */
const CITY_STATE_ZIP = /^(.+?)[,\s]+([A-Za-z]{2}|[A-Za-z][A-Za-z\s]{3,})[,\s]+(\d{5}(?:-\d{4})?)$/;

const digitsOf = (value) => String(value).replace(/\D/g, '');
const letters = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

/** A 2-letter code or a full state name becomes a code, else null. */
export function toStateCode(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  if (STATE_BY_CODE.has(upper)) return upper;
  return STATE_BY_NAME.get(text.toLowerCase()) ?? null;
}

/** 10 digits, or 11 starting with a US country code. */
function toPhone(value) {
  const digits = digitsOf(value);
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return local.length === 10 ? formatPhone(local) : null;
}

/** "Smith, John" and "John A. Smith" both give a first and a last name. */
function splitName(value) {
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return null;

  if (text.includes(',')) {
    const [last, first] = text.split(',').map((part) => part.trim());
    if (last && first) return { firstName: first, lastName: last };
  }

  const parts = text.split(' ').filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normaliseWebsite(value) {
  const text = String(value).trim().replace(/[.,;]+$/, '');
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text.replace(/^\/\//, '')}`;
}

/**
 * Reads a pasted blob.
 *
 * Returns `{ fields, matched, leftovers }` — `fields` keyed by the parser's
 * own names (`firstName`, `amount`, …), `matched` the ones it is confident
 * about in display order, and `leftovers` the lines it could not place, which
 * the UI offers as a description rather than throwing away.
 */
export function parsePastedContact(input) {
  const text = String(input ?? '');
  if (!text.trim()) return { fields: {}, matched: [], leftovers: [] };

  const fields = {};
  const set = (key, value) => {
    if (value === null || value === undefined || value === '') return;
    if (fields[key] === undefined) fields[key] = value;
  };

  // A spreadsheet row arrives as one line of tabs; treat those as line breaks
  // unless the line is a `label<TAB>value` pair, which pass one understands.
  const rawLines = text
    .split(/\r?\n/)
    .flatMap((line) => (line.split('\t').length > 2 ? line.split('\t') : [line]))
    .map((line) => line.trim())
    .filter(Boolean);

  /* ---- Pass 1: labelled values ---- */
  const rest = [];
  for (const line of rawLines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9\s/#.'-]{0,28}?)\s*[:=\t]\s*(.+)$/);
    const target = match && LABELS.get(letters(match[1]));
    if (!target) {
      rest.push(line);
      continue;
    }

    const value = match[2].trim();
    if (target === 'fullName') {
      const name = splitName(value);
      if (name) {
        set('firstName', name.firstName);
        set('lastName', name.lastName);
      }
    } else if (target === 'state') {
      set('state', toStateCode(value));
    } else if (target === 'phone' || target === 'fax') {
      set(target, toPhone(value) ?? value);
    } else if (target === 'amount') {
      const amount = parseMoney(value);
      if (amount > 0) set('amount', amount.toFixed(2));
    } else if (target === 'email') {
      set('email', (value.match(EMAIL) ?? [])[0]?.toLowerCase());
    } else if (target === 'website') {
      set('website', normaliseWebsite(value));
    } else if (target === 'zip') {
      const zip = (value.match(/\d{5}(-\d{4})?/) ?? [])[0];
      set('zip', zip);
    } else {
      set(target, value);
    }
  }

  /* ---- Pass 2: unlabelled lines, by shape ---- */
  const leftovers = [];
  for (const line of rest) {
    // Email can sit inside a longer line, so check before anything else.
    const email = line.match(EMAIL);
    if (email && !fields.email) {
      set('email', email[0].toLowerCase());
      if (line.trim() === email[0]) continue;
    }

    if (COUNTRY_LINE.test(line)) continue;

    if (!fields.website && URL_LIKE.test(line) && !line.includes('@')) {
      set('website', normaliseWebsite(line));
      continue;
    }

    const csz = line.match(CITY_STATE_ZIP);
    if (csz && toStateCode(csz[2])) {
      set('city', csz[1].replace(/,$/, '').trim());
      set('state', toStateCode(csz[2]));
      set('zip', csz[3]);
      continue;
    }

    if (ZIP.test(line)) {
      set('zip', line);
      continue;
    }

    // An amount is explicit about being money; a bare number is not.
    const money = line.match(/(?:^|\s)\$\s?([\d,]+(?:\.\d{2})?)\b/);
    if (money && !fields.amount) {
      const amount = parseMoney(money[1]);
      if (amount > 0) {
        set('amount', amount.toFixed(2));
        continue;
      }
    }

    const phone = toPhone(line);
    if (phone && digitsOf(line).length >= 10) {
      if (!fields.phone) {
        set('phone', phone);
        continue;
      }
      if (!fields.fax) {
        set('fax', phone);
        continue;
      }
    }

    if (!fields.address2 && SECOND_LINE.test(line)) {
      set('address2', line);
      continue;
    }

    if (!fields.address1 && STREET.test(line)) {
      // "123 Main St, Apt 4" carries both lines at once.
      const [street, ...extra] = line.split(',').map((part) => part.trim());
      set('address1', street);
      if (extra.length && !fields.address2) set('address2', extra.join(', '));
      continue;
    }

    if (!fields.company && COMPANYISH.test(line)) {
      set('company', line);
      continue;
    }

    // A name is the fallback: letters, no digits, at most a few words.
    if (!fields.firstName && /^[A-Za-z][A-Za-z.,'\- ]*$/.test(line) && line.split(/\s+/).length <= 4) {
      const name = splitName(line);
      if (name) {
        set('firstName', name.firstName);
        set('lastName', name.lastName);
        continue;
      }
    }

    leftovers.push(line);
  }

  const matched = PASTE_FIELDS.filter((field) => fields[field.key] !== undefined && fields[field.key] !== '');
  return { fields, matched, leftovers };
}

/**
 * Turns parsed values into the dotted paths `OrderForm.setField` expects.
 * `scope` is `customer` for billing or `shipping` for the delivery address;
 * the order-level fields (amount, invoice, description) are only applied when
 * filling the billing block, since they are not part of an address.
 */
export function toFormPatch(fields, { scope = 'customer', keys = null } = {}) {
  const patch = {};
  for (const field of PASTE_FIELDS) {
    const value = fields[field.key];
    if (value === undefined || value === '') continue;
    if (keys && !keys.includes(field.key)) continue;

    if (field.scoped) {
      // The shipping block has no phone, fax or website inputs.
      if (scope === 'shipping' && ['phone', 'fax', 'website'].includes(field.key)) continue;
      patch[`${scope}.${field.key}`] = value;
    } else if (scope === 'customer') {
      patch[field.key] = value;
    }
  }
  return patch;
}

/**
 * Is this paste worth intercepting?
 *
 * Only when it spans several lines and yields enough fields to be a real
 * contact block — otherwise an ordinary paste into one input is left alone.
 */
export function looksLikeContactBlock(text, minimumFields = 3) {
  if (!text || !/\r?\n|\t/.test(text)) return false;
  return parsePastedContact(text).matched.length >= minimumFields;
}
