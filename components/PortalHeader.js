'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { NAV_LINKS } from '@/data/site';
import { useToast } from '@/context/ToastContext';
import { useScrolledPast } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import AgentPicker from './AgentPicker';
import Logo from './Logo';
import { CloseIcon, LogoutIcon, MenuIcon, UserIcon } from './ui/Icons';

/**
 * Portal chrome: the storefront header treatment (mark, gold underline nav,
 * blur on scroll) with the shop actions swapped for the signed-in user and a
 * logout button.
 */
export default function PortalHeader({ email }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const scrolled = useScrolledPast(12);

  // Close the mobile menu on navigation, adjusted during render so the panel
  // is gone in the same pass that paints the new page.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  function isActive(href) {
    if (href === '/orders') return pathname === '/orders';
    return pathname === href || pathname.startsWith(`${href}/`);
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

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-gold focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-ink"
      >
        Skip to content
      </a>

      <header
        className={cn(
          'sticky top-0 z-[100] w-full transition-all duration-400',
          scrolled
            ? 'border-b border-line bg-ink/85 backdrop-blur-xl supports-[backdrop-filter]:bg-ink/70'
            : 'border-b border-line/60 bg-ink',
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4 md:h-20">
          <div className="flex items-center gap-3">
            <Logo variant="mark" height={scrolled ? 34 : 40} href="/dashboard" priority className="transition-all duration-400" />
            <span className="hidden border-l border-line pl-3 text-[0.65rem] uppercase tracking-[0.28em] text-gold sm:block">
              Order Portal
            </span>
          </div>

          <nav aria-label="Portal navigation" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative block px-4 py-2 text-[0.72rem] font-medium uppercase tracking-[0.16em] transition-colors duration-300',
                        active ? 'text-gold' : 'text-cream/75 hover:text-cream',
                      )}
                    >
                      {link.label}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute inset-x-4 bottom-0.5 h-px origin-left bg-gold transition-transform duration-300',
                          active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            <AgentPicker className="mr-2 hidden lg:flex" />

            <span className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-muted xl:inline-flex">
              <UserIcon size={14} className="text-gold/70" />
              <span className="max-w-[14rem] truncate">{email}</span>
            </span>

            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-full p-2.5 text-cream/80 transition-colors hover:bg-white/5 hover:text-gold disabled:opacity-50"
            >
              <LogoutIcon size={19} />
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="rounded-full p-2.5 text-cream/80 transition-colors hover:bg-white/5 hover:text-gold lg:hidden"
            >
              {menuOpen ? <CloseIcon size={19} /> : <MenuIcon size={19} />}
            </button>
          </div>
        </div>

        <span
          aria-hidden="true"
          className={cn(
            'block h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent transition-opacity duration-500',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
        />
      </header>

      <div
        id="mobile-menu"
        className={cn('fixed inset-x-0 top-16 z-[99] lg:hidden', menuOpen ? 'pointer-events-auto' : 'pointer-events-none')}
      >
        <div
          className={cn(
            'absolute inset-x-0 top-0 h-screen bg-ink/70 backdrop-blur-sm transition-opacity duration-300',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
        <nav
          aria-label="Mobile navigation"
          className={cn(
            'relative border-b border-line bg-graphite/98 backdrop-blur-xl transition-all duration-300',
            menuOpen ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0',
          )}
        >
          <div className="container-page border-b border-line/60 py-4">
            <AgentPicker stacked />
          </div>
          <ul className="container-page flex flex-col py-2">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href} className="border-b border-line/60 last:border-0">
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between py-4 text-sm uppercase tracking-[0.16em] transition-colors',
                      active ? 'text-gold' : 'text-cream/80',
                    )}
                  >
                    {link.label}
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="container-page flex items-center justify-between gap-3 border-t border-line/60 py-4 text-xs text-muted">
            <span className="truncate">{email}</span>
            <button type="button" onClick={signOut} className="uppercase tracking-[0.14em] text-gold">
              Sign out
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
