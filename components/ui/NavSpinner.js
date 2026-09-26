'use client';

import { useLinkStatus } from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Spinner for the tab that was just clicked.
 *
 * `useLinkStatus` reports the pending state of the enclosing `<Link>`, so this
 * must be rendered *inside* one. Every portal page is dynamic (it reads the
 * session and the database on each request), so there is a real wait between
 * the click and the new page — this marks which tab caused it, while the
 * `loading.js` skeleton fills the content area.
 *
 * It renders nothing until pending, so idle tabs keep their exact layout.
 */
export default function NavSpinner({ size = 14, className = '' }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('relative inline-block shrink-0 animate-fade-in', className)}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full border-2 border-current opacity-20" />
      <span className="absolute inset-0 animate-spin-slow rounded-full border-2 border-transparent border-t-current" />
    </span>
  );
}
