/**
 * Brand and portal configuration.
 *
 * Mirrors the values on corebytemediallc.com so the portal looks and reads like
 * the storefront. The portal is deployed on its own (portal.corebytemediallc.com)
 * and shares nothing at runtime with the website, so brand details are kept
 * here rather than imported across projects.
 */

export const PORTAL_URL = 'https://portal.corebytemediallc.com';
export const SITE_URL = 'https://corebytemediallc.com';

export const BRAND = {
  name: 'Core Byte Media LLC',
  shortName: 'Core Byte Media',
  legalName: 'Core Byte Media LLC',
  portalName: 'Order Portal',
};

/** Same generated artwork as the website (`public/logo`). */
export const LOGO = {
  full: '/logo/core-byte-media-logo.png',
  fullWidth: 1022,
  fullHeight: 677,
  mark: '/logo/core-byte-media-mark.png',
  markWidth: 471,
  markHeight: 539,
  alt: 'Core Byte Media LLC',
};

export const CONTACT = {
  email: 'support@corebytemediallc.com',
  phoneDisplay: '(754) 247-8047',
  phoneHref: '+17542478047',
};

export const CURRENCY = {
  code: 'USD',
  symbol: '$',
  locale: 'en-US',
  decimals: 2,
};

export const COUNTRY = { code: 'US', name: 'United States' };

/**
 * Business timezone. "Today", "this month" and "this year" in the agent
 * totals are worked out in this zone, not in the server's (Netlify runs in
 * UTC). IANA name — see https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 */
export const TIMEZONE = 'America/New_York';

/**
 * What a chargeback costs the agent who took the order.
 *
 * The card networks bill the merchant a fixed fee whenever a customer
 * disputes a charge, so the same flat amount is recorded against the agent.
 * Changing this only affects chargebacks marked afterwards — penalties
 * already recorded keep the amount that applied at the time.
 */
export const CHARGEBACK_PENALTY = 35;

export const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders/new', label: 'New Order' },
  { href: '/orders', label: 'Order History' },
  { href: '/agents', label: 'Agents', superAdminOnly: true },
  { href: '/reports', label: 'Reports', superAdminOnly: true },
];
