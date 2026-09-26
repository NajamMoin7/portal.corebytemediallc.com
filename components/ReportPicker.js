'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Field from './ui/Field';

/**
 * Chooses which period the report covers.
 *
 * Selecting navigates to `/reports?period=…&value=…`, so the server rebuilds
 * the figures and the page can be bookmarked or shared. Only periods that
 * actually have orders are offered, which rules out empty reports.
 */
export default function ReportPicker({ periodType, value, months, years }) {
  const router = useRouter();

  const options = (periodType === 'year' ? years : months).map((entry) => ({
    value: entry.value,
    label: `${entry.label} — ${entry.count} order${entry.count === 1 ? '' : 's'}`,
  }));

  function go(nextType, nextValue) {
    const list = nextType === 'year' ? years : months;
    const target = nextValue ?? list[0]?.value;
    if (!target) return;
    router.push(`/reports?period=${nextType}&value=${target}`);
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
      <div
        role="radiogroup"
        aria-label="Report period"
        className="inline-flex shrink-0 rounded-lg border border-line p-1"
      >
        {['month', 'year'].map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={periodType === type}
            onClick={() => go(type)}
            className={cn(
              'rounded-md px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors',
              periodType === type ? 'bg-gold/15 text-gold' : 'text-muted hover:text-cream',
            )}
          >
            {type === 'month' ? 'Monthly' : 'Yearly'}
          </button>
        ))}
      </div>

      <Field
        id="report-period"
        label={periodType === 'year' ? 'Year' : 'Month'}
        as="select"
        options={options}
        value={value}
        onChange={(next) => go(periodType, next)}
        className="w-full sm:max-w-xs"
      />
    </div>
  );
}

const DOWNLOAD_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] transition-all duration-300';

/**
 * Download links.
 *
 * Deliberately plain `<a download>` and not `next/link` or `fetch`: Link
 * would intercept the click and try a client-side navigation to an endpoint
 * that returns a file, and fetch would hold the whole CSV in memory. A normal
 * navigation lets the browser stream it straight to disk under the name the
 * Content-Disposition header gives it.
 */
export function ReportDownloads({ period, disabled = false }) {
  const href = (type) => `/api/reports/export?period=${period.type}&value=${period.value}&type=${type}`;

  if (disabled) {
    return <p className="text-sm text-faint">Nothing to download — this period has no orders.</p>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={href('orders')}
        download
        className={cn(DOWNLOAD_BASE, 'bg-gradient-to-br from-champagne via-gold to-gold-dark font-semibold text-ink hover:brightness-110')}
      >
        <DownloadIcon size={14} />
        Download orders (CSV)
      </a>
      <a
        href={href('summary')}
        download
        className={cn(DOWNLOAD_BASE, 'border border-gold/45 text-gold hover:border-gold hover:bg-gold/10 hover:text-champagne')}
      >
        <DownloadIcon size={14} />
        Download agent summary (CSV)
      </a>
    </div>
  );
}

/** Arrow into a tray — the usual download affordance. */
function DownloadIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}
