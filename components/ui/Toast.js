'use client';

import { useToast } from '@/context/ToastContext';
import { AlertIcon, CheckCircleIcon, CloseIcon, InfoIcon } from './Icons';
import { cn } from '@/lib/utils';

const VARIANTS = {
  success: { Icon: CheckCircleIcon, accent: 'text-gold', ring: 'border-gold/35' },
  error: { Icon: AlertIcon, accent: 'text-red-400', ring: 'border-red-500/40' },
  info: { Icon: InfoIcon, accent: 'text-sky-300', ring: 'border-sky-400/35' },
  default: { Icon: InfoIcon, accent: 'text-cream/70', ring: 'border-line' },
};

/**
 * Toast stack. Rendered once at the root; `useToast().toast(...)` pushes here.
 * The region is polite so it never interrupts a screen reader mid-sentence.
 */
export default function ToastViewport() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[130] flex flex-col items-center gap-2.5 px-4 pb-5 sm:items-end sm:px-6 sm:pb-6"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const { Icon, accent, ring } = VARIANTS[toast.variant] || VARIANTS.default;
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border bg-graphite/95 p-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] backdrop-blur-md',
              ring,
            )}
          >
            <Icon size={18} className={cn('mt-0.5 shrink-0', accent)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-cream">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-xs leading-relaxed text-muted">{toast.description}</p>
              )}
              {toast.action}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-faint transition-colors hover:text-cream"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
