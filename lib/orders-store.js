'use client';

import { useSyncExternalStore } from 'react';

/**
 * Local order history.
 *
 * The portal has no database: NMI holds the authoritative transaction record
 * (search by the order reference or transaction id in the merchant portal).
 * This keeps a convenience copy of what was submitted from *this browser* so
 * staff can look back at recent orders without leaving the portal.
 *
 * Stored records never include a full card number — only the masked number
 * and card type that Collect.js returns.
 */

const STORAGE_KEY = 'cbm-portal-orders';
const MAX_RECORDS = 200;
const EMPTY = [];

const listeners = new Set();
let cache = null;

function read() {
  if (typeof window === 'undefined') return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(records) {
  cache = records;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage full or blocked — the in-memory copy still serves this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Newest first. Returns an empty list during server render and hydration. */
export function useOrderHistory() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function saveOrderRecord(record) {
  const next = [record, ...read().filter((existing) => existing.id !== record.id)].slice(0, MAX_RECORDS);
  write(next);
}

export function clearOrderHistory() {
  write([]);
}
