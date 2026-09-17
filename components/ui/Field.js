'use client';

import { cn } from '@/lib/utils';

/**
 * Labelled form control in the storefront's checkout style. Renders an input,
 * select or textarea depending on `as`; error and hint text are wired to the
 * control with aria-describedby.
 *
 * Validation state is owned by the parent — this only renders what it is given.
 */
export default function Field({
  id,
  label,
  value,
  error,
  onChange,
  as = 'input',
  options = [],
  hint = null,
  required = false,
  placeholder = '',
  disabled = false,
  className = '',
  prefix = null,
  ...rest
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');

  const baseClasses = cn(
    'w-full rounded-lg border bg-charcoal/60 px-4 text-sm text-cream outline-none transition-colors placeholder:text-faint',
    error ? 'border-red-500/60 focus:border-red-500' : 'border-line focus:border-gold/55',
    disabled && 'cursor-not-allowed opacity-70',
    prefix && 'pl-8',
  );

  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={id} className="block text-xs uppercase tracking-[0.14em] text-muted">
        {label}
        {required && <span className="ml-1 text-gold">*</span>}
      </label>

      {as === 'textarea' && (
        <textarea
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className={cn(baseClasses, 'resize-y py-3')}
          {...rest}
        />
      )}

      {as === 'select' && (
        <div className="relative">
          <select
            id={id}
            name={id}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy || undefined}
            className={cn(baseClasses, 'h-12 appearance-none pr-10')}
            {...rest}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value} className="bg-graphite">
                {option.label}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-faint"
          >
            ▾
          </span>
        </div>
      )}

      {as === 'input' && (
        <div className="relative">
          {prefix && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted"
            >
              {prefix}
            </span>
          )}
          <input
            id={id}
            name={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy || undefined}
            className={cn(baseClasses, 'h-12')}
            {...rest}
          />
        </div>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-faint">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Numbered section header, matching the storefront checkout. */
export function Fieldset({ legend, step, description, children, action = null }) {
  return (
    <fieldset className="space-y-5">
      <legend className="mb-5 w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            {step && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/35 text-xs font-semibold text-gold">
                {step}
              </span>
            )}
            <span className="font-display text-lg text-cream">{legend}</span>
          </span>
          {action}
        </div>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
      </legend>
      {children}
    </fieldset>
  );
}
