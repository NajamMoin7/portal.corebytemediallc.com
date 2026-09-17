'use client';

import { COUNTRY } from '@/data/site';
import { US_STATES, stateLabel } from '@/data/us-states';
import Field from '../ui/Field';

const STATE_OPTIONS = US_STATES.map((state) => ({ value: state.code, label: stateLabel(state) }));
const COUNTRY_OPTIONS = [{ value: COUNTRY.code, label: COUNTRY.name }];

/**
 * Builds the `Field` props for `prefix.name` so error keys line up with
 * lib/order.js (`customer.email`, `shipping.zip`).
 */
function fieldProps(prefix, values, errors, onChange, autoCompleteSection) {
  const field = (name) => ({
    id: `${prefix}-${name}`,
    value: values[name] ?? '',
    error: errors[`${prefix}.${name}`],
    onChange: (value) => onChange(`${prefix}.${name}`, value),
  });
  const ac = (token) => (autoCompleteSection ? `${autoCompleteSection} ${token}` : token);
  return { field, ac };
}

/** The portal only ships within the US, so this is informational. */
function CountryField({ id, ac }) {
  return (
    <Field
      id={id}
      label="Country"
      as="select"
      options={COUNTRY_OPTIONS}
      value={COUNTRY.code}
      onChange={() => {}}
      autoComplete={ac('country')}
    />
  );
}

const THREE = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';
const TWO = 'grid gap-5 sm:grid-cols-2';

/**
 * Billing details: the cardholder's name, company and address (which drive
 * the AVS check), plus their contact details.
 */
export function BillingFields({ values, errors, onChange, disabled = false }) {
  const { field, ac } = fieldProps('customer', values, errors, onChange, 'billing');

  return (
    <>
      <div className={THREE}>
        <Field {...field('firstName')} label="First Name" autoComplete={ac('given-name')} required disabled={disabled} />
        <Field {...field('lastName')} label="Last Name" autoComplete={ac('family-name')} required disabled={disabled} />
        <Field {...field('company')} label="Company" autoComplete={ac('organization')} disabled={disabled} />
      </div>

      <CountryField id="customer-country" ac={ac} />

      <div className={THREE}>
        <Field {...field('address1')} label="Address" autoComplete={ac('address-line1')} required disabled={disabled} />
        <Field {...field('address2')} label="Address (cont.)" autoComplete={ac('address-line2')} disabled={disabled} />
        <Field {...field('city')} label="City" autoComplete={ac('address-level2')} required disabled={disabled} />
      </div>

      <div className={THREE}>
        <Field
          {...field('state')}
          label="State/Province"
          as="select"
          options={STATE_OPTIONS}
          placeholder="— Select —"
          autoComplete={ac('address-level1')}
          required
          disabled={disabled}
        />
        <Field
          {...field('zip')}
          label="Zip Code"
          autoComplete={ac('postal-code')}
          inputMode="numeric"
          maxLength={10}
          required
          disabled={disabled}
        />
        <Field {...field('phone')} label="Phone Number" type="tel" autoComplete={ac('tel')} required disabled={disabled} />
      </div>

      <div className={THREE}>
        <Field {...field('fax')} label="Fax Number" type="tel" disabled={disabled} />
        <Field {...field('email')} label="Email Address" type="email" autoComplete={ac('email')} required disabled={disabled} />
        <Field {...field('website')} label="Website Address" inputMode="url" autoComplete="url" placeholder="example.com" disabled={disabled} />
      </div>
    </>
  );
}

/** Where the order ships when it differs from the billing address. */
export function ShippingFields({ values, errors, onChange, disabled = false }) {
  const { field, ac } = fieldProps('shipping', values, errors, onChange, 'shipping');

  return (
    <>
      <div className={THREE}>
        <Field {...field('firstName')} label="First Name" autoComplete={ac('given-name')} required disabled={disabled} />
        <Field {...field('lastName')} label="Last Name" autoComplete={ac('family-name')} required disabled={disabled} />
        <Field {...field('company')} label="Company" autoComplete={ac('organization')} disabled={disabled} />
      </div>

      <CountryField id="shipping-country" ac={ac} />

      <div className={TWO}>
        <Field {...field('address1')} label="Address" autoComplete={ac('address-line1')} required disabled={disabled} />
        <Field {...field('address2')} label="Address (cont.)" autoComplete={ac('address-line2')} disabled={disabled} />
      </div>

      <div className={THREE}>
        <Field {...field('city')} label="City" autoComplete={ac('address-level2')} required disabled={disabled} />
        <Field
          {...field('state')}
          label="State/Province"
          as="select"
          options={STATE_OPTIONS}
          placeholder="— Select —"
          autoComplete={ac('address-level1')}
          required
          disabled={disabled}
        />
        <Field
          {...field('zip')}
          label="Zip Code"
          autoComplete={ac('postal-code')}
          inputMode="numeric"
          maxLength={10}
          required
          disabled={disabled}
        />
      </div>

      <Field {...field('email')} label="Email Address" type="email" autoComplete={ac('email')} disabled={disabled} />
    </>
  );
}
