'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { BRAND } from '@/data/site';
import { cn } from '@/lib/utils';
import Logo from './Logo';
import NavSpinner from './ui/NavSpinner';
import {
  CloseIcon,
  GridIcon,
  ListIcon,
  LogoutIcon,
  MenuIcon,
  PlusIcon,
  ReceiptIcon,
  UserIcon,
} from './ui/Icons';

/**
 * Super admin chrome: a fixed left sidebar of tabs, with the page itself on
 * the right. Agents keep the simpler top header — they only have two places
 * to go, so a sidebar would be mostly empty for them.
 *
 * Below `lg` the sidebar becomes a slide-in drawer behind a top bar, so the
 * same navigation works on a phone.
 */

const SECTIONS = [
  {
    heading: 'Overview',
    links: [{ href: '/dashboard', label: 'Dashboard', Icon: GridIcon }],
  },
  {
    heading: 'Orders',
    links: [
      { href: '/orders/new', label: 'New Order', Icon: PlusIcon },
      { href: '/orders', label: 'Order History', Icon: ListIcon, exact: true },
    ],
  },
  {
    heading: 'Administration',
    links: [
      { href: '/agents', label: 'Agents', Icon: UserIcon },
      { href: '/reports', label: 'Reports', Icon: ReceiptIcon },
    ],
  },
];

export default function PortalSidebar({ user, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close the drawer on navigation, adjusted during render so the panel is
  // gone in the same pass that paints the new page.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  function isActive(link) {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      toast({ title: 'Could not sign out', description: 'Check your connection and try again.', variant: 'error' });
      setSigningOut(false);
    }
  }

  const nav = (
    <nav aria-label="Portal navigation" className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
      {SECTIONS.map((section) => (
        <div key={section.heading} className="space-y-1.5">
          <p className="px-3 text-[0.6rem] uppercase tracking-[0.2em] text-faint">{section.heading}</p>
          <ul className="space-y-1">
            {section.links.map((link) => {
              const active = isActive(link);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                      active ? 'bg-gold/10 text-gold' : 'text-cream/75 hover:bg-white/[0.04] hover:text-cream',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold transition-opacity',
                        active ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <link.Icon size={17} className={active ? 'text-gold' : 'text-muted group-hover:text-cream'} />
                    <span className="flex-1">{link.label}</span>
                    <NavSpinner />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const identity = (
    <div className="border-t border-line/60 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
          <UserIcon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-cream">{user.name}</p>
          <p className="truncate text-xs text-faint">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-full p-2 text-cream/70 transition-colors hover:bg-white/5 hover:text-gold disabled:opacity-50"
        >
          <LogoutIcon size={17} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-gold focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-ink"
      >
        Skip to content
      </a>

      {/* Desktop: a column that stays put while the page scrolls. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-obsidian lg:flex">
        <div className="flex items-center gap-3 border-b border-line/60 px-5 py-5">
          <Logo variant="mark" height={34} href="/dashboard" priority />
          <span className="min-w-0">
            <span className="block truncate text-[0.62rem] uppercase tracking-[0.22em] text-gold">
              {BRAND.portalName}
            </span>
            <span className="block truncate text-[0.62rem] uppercase tracking-[0.16em] text-faint">Super admin</span>
          </span>
        </div>
        {nav}
        {identity}
      </aside>

      {/* Mobile: top bar + slide-in drawer. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[100] flex h-16 items-center justify-between gap-4 border-b border-line bg-ink/90 px-5 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-3">
            <Logo variant="mark" height={30} href="/dashboard" priority />
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-gold">{BRAND.portalName}</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="admin-drawer"
            className="rounded-full p-2.5 text-cream/80 transition-colors hover:bg-white/5 hover:text-gold"
          >
            {open ? <CloseIcon size={19} /> : <MenuIcon size={19} />}
          </button>
        </header>

        <div
          id="admin-drawer"
          className={cn('fixed inset-0 z-[110] lg:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')}
        >
          <div
            className={cn('absolute inset-0 bg-ink/70 backdrop-blur-sm transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-obsidian transition-transform duration-300',
              open ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
              <span className="text-[0.62rem] uppercase tracking-[0.22em] text-gold">{BRAND.portalName}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-2 text-cream/80 hover:text-gold"
              >
                <CloseIcon size={18} />
              </button>
            </div>
            {nav}
            {identity}
          </div>
        </div>

        <main id="main" className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
