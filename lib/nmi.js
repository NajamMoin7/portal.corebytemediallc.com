/**
 * NMI (Network Merchants) Payment API client.
 *
 * Flow used by the portal:
 *   1. Collect.js, loaded in the browser with the PUBLIC tokenization key,
 *      turns the card fields into a single-use `payment_token`. The card
 *      number never reaches this server.
 *   2. The charge route posts that token plus the order to the Payment API
 *      with the PRIVATE security key (`NMI_SECURITY_KEY`).
 *
 * Reference: https://secure.nmi.com/merchants/resources/integration/integration_portal.php
 * The API responds with a URL-encoded string, e.g.
 *   response=1&responsetext=SUCCESS&authcode=123456&transactionid=1234567890
 *   &avsresponse=N&cvvresponse=M&orderid=CBM-...&type=sale&response_code=100
 *
 * Server-only module.
 */

const DEFAULT_API_URL = 'https://secure.nmi.com/api/transact.php';

/** Human-readable reasons for the gateway's numeric response codes. */
const RESPONSE_CODES = {
  100: 'Transaction approved.',
  200: 'Transaction declined by the card issuer.',
  201: 'Do not honor — the issuer declined the card.',
  202: 'Insufficient funds.',
  203: 'Card over its limit.',
  204: 'Transaction not allowed on this card.',
  220: 'Incorrect payment information.',
  221: 'No such card issuer.',
  222: 'No card number on file with the issuer.',
  223: 'Card has expired.',
  224: 'Invalid expiration date.',
  225: 'Invalid card security code (CVV).',
  226: 'Invalid PIN.',
  240: 'Call the issuer for further information.',
  250: 'Pick up card.',
  251: 'Lost card.',
  252: 'Stolen card.',
  253: 'Fraudulent card.',
  260: 'Declined with further instructions available in the NMI portal.',
  261: 'Declined — stop all recurring payments.',
  262: 'Declined — stop this recurring program.',
  263: 'Declined — update cardholder data available.',
  264: 'Declined — retry in a few days.',
  300: 'Transaction was rejected by the gateway.',
  400: 'The processor returned an error.',
  410: 'Invalid merchant configuration.',
  411: 'Merchant account is inactive.',
  420: 'Communication error with the processor.',
  421: 'Communication error with the issuer.',
  430: 'Duplicate transaction at the processor.',
  440: 'Processor format error.',
  441: 'Invalid transaction information.',
  460: 'Processor feature not available.',
  461: 'Unsupported card type.',
};

export function isGatewayConfigured() {
  return Boolean(process.env.NMI_SECURITY_KEY);
}

export function isTokenizationConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_NMI_TOKENIZATION_KEY);
}

/** Parses the gateway's `key=value&key=value` body into an object. */
export function parseGatewayResponse(text) {
  return Object.fromEntries(new URLSearchParams(String(text || '')));
}

/** Turns a raw gateway reply into the shape the portal shows. */
export function normaliseGatewayResponse(raw) {
  const response = String(raw.response || '');
  const code = Number.parseInt(raw.response_code, 10);
  const status = response === '1' ? 'approved' : response === '2' ? 'declined' : 'error';

  const message =
    RESPONSE_CODES[code] ||
    (raw.responsetext ? String(raw.responsetext) : 'The gateway returned an unrecognised response.');

  return {
    ok: status === 'approved',
    status,
    message,
    responseText: raw.responsetext || '',
    responseCode: Number.isFinite(code) ? code : null,
    transactionId: raw.transactionid || '',
    authCode: raw.authcode || '',
    avsResponse: raw.avsresponse || '',
    cvvResponse: raw.cvvresponse || '',
    orderId: raw.orderid || '',
    type: raw.type || '',
  };
}

/**
 * Submits a transaction. `fields` are Payment API parameters without the
 * security key; this adds the key, posts, and normalises the reply.
 *
 * Throws only for configuration or network failures — a declined card is a
 * normal, resolved result (`ok: false, status: 'declined'`).
 */
export async function createTransaction(fields) {
  const securityKey = process.env.NMI_SECURITY_KEY;
  if (!securityKey) {
    throw new Error('NMI_SECURITY_KEY is not configured.');
  }

  const url = process.env.NMI_API_URL || DEFAULT_API_URL;

  const body = new URLSearchParams();
  body.set('security_key', securityKey);
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    body.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let text;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
      signal: controller.signal,
    });
    text = await response.text();
    if (!response.ok) {
      throw new Error(`Gateway responded with HTTP ${response.status}.`);
    }
  } finally {
    clearTimeout(timeout);
  }

  return normaliseGatewayResponse(parseGatewayResponse(text));
}
