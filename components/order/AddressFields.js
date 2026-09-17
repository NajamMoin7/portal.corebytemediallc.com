'use client';

import { US_STATES, stateLabel } from '@/data/us-states';
import Field from '../ui/Field';

const STATE_OPTIONS = US_STATES.map((state) => ({ value: state.code, label: stateLabel(state) }));

/**
 * Name + US address block. `prefix` is the dotted path the values live under
 * (`customer` or `shipping`) so error keys line up with lib/order.js.
 */
export default function AddressFields({ prefix, values, errors, onChange, autoCompleteSection = '' }) {
  const field = (name) => ({
    id: `${prefix}-${name}`,
    value: values[name] ?? '',
    error: errors[`${prefix}.${name}`],
    onChange: (value) => onChange(`${prefix}.${name}`, value),
  });
  const ac = (token) => (autoCompleteSection ? `${autoCompleteSection} ${token}` : token);

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field {...field('firstName')} label="First Name" autoComplete={ac('given-name')} placeholder="Jordan" required />
        <Field {...field('lastName')} label="Last Name" autoComplete={ac('family-name')} placeholder="Miller" required />
      </div>

      <Field
        {...field('address1')}
        label="Address Line 1"
        autoComplete={ac('address-line1')}
        placeholder="Street address or PO box"
        required
      />
      <Field
        {...field('address2')}
        label="Address Line 2"
        autoComplete={ac('address-line2')}
        placeholder="Apartment, suite, unit, building, floor"
        hint="Optional."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field {...field('city')} label="City" autoComplete={ac('address-level2')} placeholder="Austin" required />
        <Field
          {...field('state')}
          label="State"
          as="select"
          options={STATE_OPTIONS}
          placeholder="Select a state"
          autoComplete={ac('address-level1')}
          required
        />
        <Field
          {...field('zip')}
          label="ZIP Code"
          autoComplete={ac('postal-code')}
          placeholder="78758"
          inputMode="numeric"
          maxLength={10}
          required
        />
      </div>
    </>
  );
}
