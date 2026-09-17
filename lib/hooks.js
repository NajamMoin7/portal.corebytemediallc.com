'use client';

import { useSyncExternalStore } from 'react';

/**
 * Shared client hooks built on useSyncExternalStore.
 *
 * These replace the "read a browser API in useEffect, then setState" pattern.
 * That pattern causes a cascading render on every mount and is flagged by
 * react-hooks/set-state-in-effect; subscribing to the external source directly
 * is both cheaper and the intended API.
 */

function noopSubscribe() {
  return () => {};
}

/**
 * False during server render and the hydration pass, true afterwards.
 *
 * Use it to gate anything that depends on browser-only state (localStorage,
 * window size) so the server and client markup still match.
 */
export function useIsHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function subscribeToScroll(onChange) {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

/** True once the page has scrolled past `threshold` pixels. */
export function useScrolledPast(threshold = 12) {
  return useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > threshold,
    () => false,
  );
}
