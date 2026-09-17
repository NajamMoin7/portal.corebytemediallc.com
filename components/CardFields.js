'use client';

import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TOKENIZATION_KEY, loadCollectJs } from '@/lib/collect';
import { cn } from '@/lib/utils';
import Notice from './ui/Notice';
import { LockIcon } from './ui/Icons';
import { Skeleton } from './ui/LoadingSpinner';

const FIELDS = [
  { id: 'ccnumber', label: 'Card Number', placeholder: '0000 0000 0000 0000', span: 'sm:col-span-2' },
  { id: 'ccexp', label: 'Expiry', placeholder: 'MM / YY', span: '' },
  { id: 'cvv', label: 'CVV', placeholder: '•••', span: '' },
];

/**
 * Colour tokens from globals.css, repeated here because Collect.js renders
 * the inputs inside its own iframes where our stylesheet cannot reach.
 */
const IFRAME_INPUT_CSS = {
  color: '#f4f2ec',
  'background-color': 'transparent',
  border: 'none',
  'border-radius': '0',
  'box-shadow': 'none',
  outline: 'none',
  'font-family': 'Inter, ui-sans-serif, system-ui, sans-serif',
  'font-size': '14px',
  'font-weight': '400',
  height: '46px',
  'line-height': '46px',
  padding: '0 16px',
  margin: '0',
  width: '100%',
};

/**
 * PCI-scoped card entry.
 *
 * Collect.js mounts one iframe per field into the empty containers below, so
 * card data is entered on NMI's origin and never touches this page's DOM or
 * the portal server. The parent calls `ref.current.requestToken()` at submit
 * time; the resulting single-use token is delivered through `onToken`.
 */
export default function CardFields({ ref, onToken, onTimeout, disabled = false }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState({ ccnumber: null, ccexp: null, cvv: null });
  const [messages, setMessages] = useState({});

  // Latest callbacks, so the configure() closure never goes stale.
  const onTokenRef = useRef(onToken);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTokenRef.current = onToken;
    onTimeoutRef.current = onTimeout;
  });

  useImperativeHandle(ref, () => ({
    isReady: () => ready,
    /** True only once every field has reported valid. */
    isComplete: () => FIELDS.every((field) => status[field.id] === true),
    requestToken: () => {
      if (window.CollectJS) window.CollectJS.startPaymentRequest();
    },
  }));

  useEffect(() => {
    if (!TOKENIZATION_KEY) return undefined;
    let cancelled = false;

    loadCollectJs()
      .then((CollectJS) => {
        if (cancelled) return;

        // Strict-mode remounts and route revisits call this again; clearing the
        // containers stops Collect.js stacking a second set of iframes.
        FIELDS.forEach((field) => {
          const node = document.getElementById(field.id);
          if (node) node.innerHTML = '';
        });

        CollectJS.configure({
          variant: 'inline',
          styleSniffer: false,
          googleFont: 'Inter:400',
          customCss: IFRAME_INPUT_CSS,
          placeholderCss: { color: '#6d6960' },
          focusCss: { outline: 'none', border: 'none' },
          invalidCss: { color: '#f87171' },
          validCss: { color: '#f4f2ec' },
          timeoutDuration: 15000,
          fields: Object.fromEntries(
            FIELDS.map((field) => [
              field.id,
              { selector: `#${field.id}`, title: field.label, placeholder: field.placeholder },
            ]),
          ),
          fieldsAvailableCallback: () => {
            if (!cancelled) setReady(true);
          },
          validationCallback: (field, valid, message) => {
            if (cancelled) return;
            setStatus((current) => ({ ...current, [field]: Boolean(valid) }));
            setMessages((current) => ({ ...current, [field]: valid ? '' : message || 'Check this field.' }));
          },
          timeoutCallback: () => {
            if (!cancelled) onTimeoutRef.current?.();
          },
          callback: (response) => {
            if (!cancelled) onTokenRef.current?.(response);
          },
        });
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!TOKENIZATION_KEY) {
    return (
      <Notice tone="warning" title="Card entry is not configured">
        Set <code className="text-champagne">NEXT_PUBLIC_NMI_TOKENIZATION_KEY</code> (the NMI public key) so
        Collect.js can load. Orders cannot be charged until it is.
      </Notice>
    );
  }

  if (loadError) {
    return (
      <Notice tone="error" title="Card fields failed to load">
        {loadError}
      </Notice>
    );
  }

  return (
    <div className="space-y-5">
      <div className={cn('grid gap-5 sm:grid-cols-4', disabled && 'pointer-events-none opacity-60')}>
        {FIELDS.map((field) => {
          const invalid = status[field.id] === false;
          const valid = status[field.id] === true;
          return (
            <div key={field.id} className={cn('space-y-2', field.span)}>
              <label htmlFor={field.id} className="block text-xs uppercase tracking-[0.14em] text-muted">
                {field.label}
                <span className="ml-1 text-gold">*</span>
              </label>
              <div className="relative h-12">
                {!ready && <Skeleton className="absolute inset-0 rounded-lg" />}
                <div
                  id={field.id}
                  className={cn(
                    'collect-field h-12 w-full overflow-hidden rounded-lg border bg-charcoal/60 transition-colors',
                    invalid ? 'border-red-500/60' : valid ? 'border-gold/45' : 'border-line',
                    !ready && 'opacity-0',
                  )}
                />
              </div>
              {invalid && messages[field.id] && (
                <p role="alert" className="text-xs text-red-400">
                  {messages[field.id]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="flex items-center gap-2 text-xs text-faint">
        <LockIcon size={14} className="text-gold/70" />
        Card details are entered directly with NMI and tokenised in the browser. They are never stored by
        this portal.
      </p>
    </div>
  );
}
