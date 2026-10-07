'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CloseIcon, SearchIcon } from './ui/Icons';

/**
 * Search box for the order history.
 *
 * A real `<form method="get">`, so pressing Enter works with or without
 * JavaScript and the result is a plain `?q=…` URL that can be bookmarked or
 * shared. Submitting always returns to page one — staying on page 7 of a
 * search that now has two results would show nothing.
 */
export default function OrderSearch({ query = '', basePath = '/orders', total = null }) {
  const router = useRouter();
  const [value, setValue] = useState(query);

  function submit(event) {
    event.preventDefault();
    const text = value.trim();
    router.push(text ? `${basePath}?q=${encodeURIComponent(text)}` : basePath);
  }

  function clear() {
    setValue('');
    router.push(basePath);
  }

  return (
    <form onSubmit={submit} action={basePath} method="get" role="search" className="space-y-2">
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint">
          <SearchIcon size={16} />
        </span>
        <input
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search by name, email, phone, order reference, transaction ID, invoice…"
          aria-label="Search orders"
          className={cn(
            'h-12 w-full rounded-lg border border-line bg-charcoal/60 pl-11 pr-24 text-sm text-cream outline-none',
            'transition-colors placeholder:text-faint focus:border-gold/55',
          )}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="rounded-full p-2 text-faint transition-colors hover:bg-white/5 hover:text-cream"
            >
              <CloseIcon size={15} />
            </button>
          )}
          <button
            type="submit"
            className="rounded-full bg-gold/15 px-4 py-2 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold/25"
          >
            Search
          </button>
        </div>
      </div>

      {query && (
        <p className="text-xs text-muted">
          {total === 0 ? 'No orders match' : `${total} ${total === 1 ? 'order matches' : 'orders match'}`}{' '}
          <span className="text-cream">&ldquo;{query}&rdquo;</span>
          {' · '}
          <button type="button" onClick={clear} className="text-gold hover:text-champagne">
            Clear
          </button>
        </p>
      )}
    </form>
  );
}
