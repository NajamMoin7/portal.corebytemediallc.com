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
 * Default charges pre-filled on a new order. Staff can override both per order;
 * these only save typing on the common case.
 */
export const ORDER_DEFAULTS = {
  shipping: 5.95,
  tax: 0,
};

export const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders/new', label: 'New Order' },
  { href: '/orders', label: 'Order History' },
];
