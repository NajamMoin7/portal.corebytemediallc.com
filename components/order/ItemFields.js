'use client';

import {
  CATEGORIES,
  CUSTOM_PRODUCT_ID,
  PRINT_METHODS,
  PRINT_PLACEMENTS,
  PRODUCTS,
  findProduct,
} from '@/data/products';
import { cn, formatPrice, parseMoney } from '@/lib/utils';
import Field from '../ui/Field';
import { TrashIcon } from '../ui/Icons';

const toOptions = (list) => list.map((value) => ({ value, label: value }));
const METHOD_OPTIONS = toOptions(PRINT_METHODS);
const PLACEMENT_OPTIONS = toOptions(PRINT_PLACEMENTS);

/**
 * One product line: what is being printed, on what, how many, and for how much.
 *
 * Choosing a catalogue product fills the SKU, price and the size/colour
 * options; "Custom item" frees the name and leaves the options open so
 * one-off jobs can still be recorded and charged.
 */
export default function ItemFields({ index, item, errors, onChange, onRemove, canRemove }) {
  const prefix = `items.${index}`;
  const isCustom = item.productId === CUSTOM_PRODUCT_ID;
  const product = isCustom ? null : findProduct(item.productId);

  const field = (name) => ({
    id: `${prefix}-${name}`,
    value: item[name] ?? '',
    error: errors[`${prefix}.${name}`],
    onChange: (value) => onChange(index, { [name]: value }),
  });

  function selectProduct(value) {
    if (value === CUSTOM_PRODUCT_ID) {
      onChange(index, { productId: value, name: '', sku: '', size: '', color: '', unitPrice: '' });
      return;
    }
    const next = findProduct(value);
    if (!next) {
      onChange(index, { productId: '', name: '', sku: '', size: '', color: '', unitPrice: '' });
      return;
    }
    onChange(index, {
      productId: String(next.id),
      name: next.name,
      sku: next.sku,
      size: next.sizes.length === 1 ? next.sizes[0] : '',
      color: next.colors.length === 1 ? next.colors[0] : '',
      unitPrice: String(next.price),
    });
  }

  const quantity = Number.parseInt(item.quantity, 10) || 0;
  const lineTotal = quantity * parseMoney(item.unitPrice);

  return (
    <div className="space-y-5 rounded-xl border border-line bg-charcoal/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-[0.7rem] font-semibold text-gold">
            {index + 1}
          </span>
          <span className="text-sm text-cream">{product?.name || (isCustom ? 'Custom item' : 'Product')}</span>
          {product && <span className="hidden text-xs text-faint sm:inline">{product.sku}</span>}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove item ${index + 1}`}
            className="rounded-full p-2 text-faint transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <TrashIcon size={16} />
          </button>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor={`${prefix}-productId`} className="block text-xs uppercase tracking-[0.14em] text-muted">
            Product<span className="ml-1 text-gold">*</span>
          </label>
          <div className="relative">
            <select
              id={`${prefix}-productId`}
              value={item.productId}
              onChange={(event) => selectProduct(event.target.value)}
              aria-invalid={Boolean(errors[`${prefix}.productId`])}
              className={cn(
                'h-12 w-full appearance-none rounded-lg border bg-charcoal/60 px-4 pr-10 text-sm text-cream outline-none transition-colors',
                errors[`${prefix}.productId`] ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold/55',
              )}
            >
              <option value="">Select a product</option>
              {CATEGORIES.map((category) => (
                <optgroup key={category.slug} label={category.name} className="bg-graphite">
                  {PRODUCTS.filter((entry) => entry.category === category.slug).map((entry) => (
                    <option key={entry.id} value={entry.id} className="bg-graphite">
                      {entry.name} — {formatPrice(entry.price)}
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Other" className="bg-graphite">
                <option value={CUSTOM_PRODUCT_ID} className="bg-graphite">
                  Custom item (enter details manually)
                </option>
              </optgroup>
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-faint">
              ▾
            </span>
          </div>
          {errors[`${prefix}.productId`] && (
            <p role="alert" className="text-xs text-red-400">
              {errors[`${prefix}.productId`]}
            </p>
          )}
        </div>

        {isCustom && (
          <>
            <Field {...field('name')} label="Item Description" placeholder="e.g. 20 oz stainless tumbler" required />
            <Field {...field('sku')} label="SKU / Reference" placeholder="Optional" hint="Optional." />
          </>
        )}

        {product ? (
          <>
            <Field
              {...field('size')}
              label="Size"
              as="select"
              options={toOptions(product.sizes)}
              placeholder="Select a size"
              required
            />
            <Field
              {...field('color')}
              label="Colour"
              as="select"
              options={toOptions(product.colors)}
              placeholder="Select a colour"
              required
            />
          </>
        ) : (
          isCustom && (
            <>
              <Field {...field('size')} label="Size" placeholder="e.g. L or 15 oz" hint="Optional." />
              <Field {...field('color')} label="Colour" placeholder="e.g. Black" hint="Optional." />
            </>
          )
        )}

        <Field
          {...field('quantity')}
          label="Quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          step={1}
          required
        />
        <Field
          {...field('unitPrice')}
          label="Unit Price"
          prefix="$"
          inputMode="decimal"
          placeholder="0.00"
          hint={
            product && product.listPrice !== product.price
              ? `Website price ${formatPrice(product.price)} (list ${formatPrice(product.listPrice)}). Override for custom quotes.`
              : product
                ? `Website price ${formatPrice(product.price)}. Override for custom quotes.`
                : undefined
          }
          required
        />

        <Field
          {...field('printMethod')}
          label="Print Method"
          as="select"
          options={METHOD_OPTIONS}
          placeholder="Select a method"
          hint="Optional — recorded against the transaction."
        />
        <Field
          {...field('placement')}
          label="Print Placement"
          as="select"
          options={PLACEMENT_OPTIONS}
          placeholder="Select a placement"
          hint="Optional."
        />

        <Field
          {...field('artworkUrl')}
          label="Artwork Link"
          type="url"
          placeholder="https://drive.google.com/…"
          hint="Optional. Link to the customer's design file."
          className="sm:col-span-2"
        />
        <Field
          {...field('notes')}
          label="Print Notes"
          as="textarea"
          placeholder="Colours, sizing of the artwork, special instructions."
          hint="Optional."
          className="sm:col-span-2"
        />
      </div>

      <div className="flex items-center justify-between border-t border-line/60 pt-4 text-sm">
        <span className="text-muted">Line total</span>
        <span className="font-medium tabular-nums text-cream">{formatPrice(lineTotal)}</span>
      </div>
    </div>
  );
}
