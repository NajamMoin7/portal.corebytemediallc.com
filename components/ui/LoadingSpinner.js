import Image from 'next/image';
import { LOGO } from '@/data/site';
import { cn } from '@/lib/utils';

/**
 * Gold ring spinner. `size` is the diameter in pixels.
 * Under prefers-reduced-motion the ring stops turning (globals.css) — the
 * label below still communicates that something is loading.
 */
export function Spinner({ size = 40, className = '' }) {
  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <span className="absolute inset-0 rounded-full border-2 border-gold/15" />
      <span className="absolute inset-0 animate-spin-slow rounded-full border-2 border-transparent border-t-gold border-r-gold/40" />
    </span>
  );
}

/**
 * Full-screen branded loader used by the App Router `loading.js` files.
 */
export default function LoadingSpinner({ label = 'Preparing your experience', showLogo = true }) {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-8 bg-ink px-6 py-24 text-center">
      {showLogo && (
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span className="absolute inset-0 animate-pulse-ring rounded-full border border-gold/40" aria-hidden="true" />
          <span className="absolute inset-0 animate-spin-slow rounded-full border-2 border-transparent border-t-gold border-r-gold/30" />
          <Image
            src={LOGO.mark}
            alt=""
            width={LOGO.markWidth}
            height={LOGO.markHeight}
            className="h-11 w-auto opacity-90"
            priority
          />
        </div>
      )}
      {!showLogo && <Spinner size={48} />}

      <div className="flex flex-col items-center gap-3">
        <span className="eyebrow">{label}</span>
        <span className="h-px w-24 overflow-hidden bg-line">
          <span className="block h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-gold to-transparent" />
        </span>
      </div>
    </div>
  );
}

/** Rectangular shimmer block for inline placeholder content. */
export function Skeleton({ className = '' }) {
  return <div className={cn('skeleton rounded-md', className)} aria-hidden="true" />;
}
