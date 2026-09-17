/**
 * Product catalogue for the order form.
 *
 * A trimmed copy of the storefront catalogue (data/products.js on
 * corebytemediallc.com): the portal only needs names, SKUs, prices and the
 * size/colour options. Prices are in USD and are the *default* unit price —
 * staff can override the price on any line when quoting custom work.
 *
 * Keep the SKUs in step with the website so NMI transaction records and the
 * storefront refer to the same products.
 */

const SIZE_SETS = {
  apparel: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  relaxed: ['S', 'M', 'L', 'XL', 'XXL'],
  oneSize: ['One Size'],
  mug: ['11 oz', '15 oz'],
};

const COLORS = {
  black: 'Black',
  charcoal: 'Charcoal',
  graphite: 'Graphite',
  white: 'White',
  sand: 'Sand',
  navy: 'Navy',
  olive: 'Olive',
  bone: 'Bone',
};

function build({ colorKeys, salePrice, price, ...rest }) {
  return {
    ...rest,
    // The storefront charges the sale price when one is set; the portal
    // pre-fills the same figure so quotes match the website.
    listPrice: price,
    price: salePrice ?? price,
    colors: colorKeys.map((key) => COLORS[key]),
  };
}

export const CATEGORIES = [
  { slug: 't-shirts', name: 'T-Shirts' },
  { slug: 'oversized-t-shirts', name: 'Oversized T-Shirts' },
  { slug: 'hoodies', name: 'Hoodies' },
  { slug: 'sweatshirts', name: 'Sweatshirts' },
  { slug: 'polo-shirts', name: 'Polo Shirts' },
  { slug: 'caps', name: 'Caps' },
  { slug: 'mugs', name: 'Mugs' },
  { slug: 'tote-bags', name: 'Tote Bags' },
];

export const PRODUCTS = [
  build({ id: 1, name: 'Classic Core Tee', sku: 'CBM-TEE-001', category: 't-shirts', price: 28, salePrice: 22, colorKeys: ['black', 'white', 'sand'], sizes: SIZE_SETS.apparel }),
  build({ id: 2, name: 'Premium Oversized Tee', sku: 'CBM-OVR-002', category: 'oversized-t-shirts', price: 38, salePrice: null, colorKeys: ['black', 'bone', 'olive'], sizes: SIZE_SETS.relaxed }),
  build({ id: 3, name: 'Signature Gold Hoodie', sku: 'CBM-HOD-003', category: 'hoodies', price: 78, salePrice: 66, colorKeys: ['black', 'charcoal'], sizes: SIZE_SETS.apparel }),
  build({ id: 4, name: 'Core Byte Essential Hoodie', sku: 'CBM-HOD-004', category: 'hoodies', price: 62, salePrice: null, colorKeys: ['graphite', 'navy', 'black'], sizes: SIZE_SETS.apparel }),
  build({ id: 5, name: 'Minimal Logo Mug', sku: 'CBM-MUG-005', category: 'mugs', price: 18, salePrice: 15, colorKeys: ['white', 'black'], sizes: SIZE_SETS.mug }),
  build({ id: 6, name: 'Heritage Crew Sweatshirt', sku: 'CBM-SWT-006', category: 'sweatshirts', price: 54, salePrice: null, colorKeys: ['charcoal', 'sand', 'black'], sizes: SIZE_SETS.apparel }),
  build({ id: 7, name: 'Monogram Polo Shirt', sku: 'CBM-POL-007', category: 'polo-shirts', price: 44, salePrice: 39, colorKeys: ['navy', 'white', 'black'], sizes: SIZE_SETS.apparel }),
  build({ id: 8, name: 'Structured Gold Cap', sku: 'CBM-CAP-008', category: 'caps', price: 26, salePrice: null, colorKeys: ['black', 'sand'], sizes: SIZE_SETS.oneSize }),
  build({ id: 9, name: 'Everyday Canvas Tote', sku: 'CBM-TOT-009', category: 'tote-bags', price: 22, salePrice: null, colorKeys: ['bone', 'black'], sizes: SIZE_SETS.oneSize }),
  build({ id: 10, name: 'Midnight Oversized Tee', sku: 'CBM-OVR-010', category: 'oversized-t-shirts', price: 40, salePrice: 32, colorKeys: ['black', 'navy'], sizes: SIZE_SETS.relaxed }),
  build({ id: 11, name: 'Atelier Heavy Tee', sku: 'CBM-TEE-011', category: 't-shirts', price: 34, salePrice: null, colorKeys: ['bone', 'olive', 'black'], sizes: SIZE_SETS.apparel }),
  build({ id: 12, name: 'Champagne Accent Hoodie', sku: 'CBM-HOD-012', category: 'hoodies', price: 74, salePrice: 64, colorKeys: ['sand', 'charcoal'], sizes: SIZE_SETS.relaxed }),
  build({ id: 13, name: 'Studio Fleece Sweatshirt', sku: 'CBM-SWT-013', category: 'sweatshirts', price: 52, salePrice: null, colorKeys: ['graphite', 'bone'], sizes: SIZE_SETS.apparel }),
  build({ id: 14, name: 'Executive Piqué Polo', sku: 'CBM-POL-014', category: 'polo-shirts', price: 48, salePrice: null, colorKeys: ['black', 'charcoal'], sizes: SIZE_SETS.apparel }),
  build({ id: 15, name: 'Low Profile Dad Cap', sku: 'CBM-CAP-015', category: 'caps', price: 24, salePrice: 20, colorKeys: ['navy', 'olive'], sizes: SIZE_SETS.oneSize }),
  build({ id: 16, name: 'Ceramic Matte Black Mug', sku: 'CBM-MUG-016', category: 'mugs', price: 20, salePrice: null, colorKeys: ['black', 'charcoal'], sizes: SIZE_SETS.mug }),
  build({ id: 17, name: 'Gilded Rim Mug', sku: 'CBM-MUG-017', category: 'mugs', price: 24, salePrice: 20, colorKeys: ['white', 'bone'], sizes: ['11 oz'] }),
  build({ id: 18, name: 'Market Canvas Tote', sku: 'CBM-TOT-018', category: 'tote-bags', price: 28, salePrice: null, colorKeys: ['sand', 'olive'], sizes: SIZE_SETS.oneSize }),
  build({ id: 19, name: 'Core Tech Longline Tee', sku: 'CBM-OVR-019', category: 'oversized-t-shirts', price: 36, salePrice: null, colorKeys: ['charcoal', 'white'], sizes: SIZE_SETS.relaxed }),
  build({ id: 20, name: 'Signature Crew Sweatshirt', sku: 'CBM-SWT-020', category: 'sweatshirts', price: 58, salePrice: 52, colorKeys: ['black', 'navy'], sizes: SIZE_SETS.apparel }),
  build({ id: 21, name: 'Weekend Relaxed Tee', sku: 'CBM-TEE-021', category: 't-shirts', price: 26, salePrice: 21, colorKeys: ['navy', 'sand'], sizes: SIZE_SETS.apparel }),
  build({ id: 22, name: 'Noir Zip Hoodie', sku: 'CBM-HOD-022', category: 'hoodies', price: 84, salePrice: null, colorKeys: ['black', 'graphite'], sizes: SIZE_SETS.apparel }),
  build({ id: 23, name: 'Artisan Print Tote', sku: 'CBM-TOT-023', category: 'tote-bags', price: 26, salePrice: null, colorKeys: ['black', 'bone'], sizes: SIZE_SETS.oneSize }),
  build({ id: 24, name: 'Summit Structured Cap', sku: 'CBM-CAP-024', category: 'caps', price: 28, salePrice: 24, colorKeys: ['charcoal', 'white'], sizes: SIZE_SETS.oneSize }),
];

/** Sentinel product id for one-off items that are not in the catalogue. */
export const CUSTOM_PRODUCT_ID = 'custom';

export function findProduct(id) {
  return PRODUCTS.find((product) => String(product.id) === String(id)) || null;
}

export function categoryName(slug) {
  return CATEGORIES.find((category) => category.slug === slug)?.name || slug;
}

export const PRINT_METHODS = [
  'DTG (direct to garment)',
  'DTF transfer',
  'Screen print',
  'Sublimation',
  'Embroidery',
  'Vinyl / heat transfer',
];

export const PRINT_PLACEMENTS = [
  'Front centre',
  'Front left chest',
  'Back full',
  'Back upper',
  'Left sleeve',
  'Right sleeve',
  'Front + back',
  'Wrap-around (mug)',
  'Front panel (cap)',
  'Both sides (tote)',
];
