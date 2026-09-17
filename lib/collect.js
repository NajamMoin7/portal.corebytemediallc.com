'use client';

/**
 * Loads NMI's Collect.js once and resolves with the global it exposes.
 *
 * Collect.js reads the tokenization key from the script tag's
 * `data-tokenization-key` attribute at load time; `CollectJS.configure()` is
 * then called by the card component to mount the inline iframes.
 *
 * Docs: NMI merchant portal → Integration → Collect.js
 */

const SCRIPT_ID = 'nmi-collect-js';
const DEFAULT_URL = 'https://secure.nmi.com/token/Collect.js';

export const COLLECT_JS_URL = process.env.NEXT_PUBLIC_NMI_COLLECT_JS_URL || DEFAULT_URL;
export const TOKENIZATION_KEY = process.env.NEXT_PUBLIC_NMI_TOKENIZATION_KEY || '';

let pending = null;

export function loadCollectJs() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Collect.js can only load in the browser.'));
  }
  if (window.CollectJS) return Promise.resolve(window.CollectJS);
  if (pending) return pending;

  if (!TOKENIZATION_KEY) {
    return Promise.reject(new Error('NEXT_PUBLIC_NMI_TOKENIZATION_KEY is not set.'));
  }

  pending = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    const script = existing || document.createElement('script');

    const onLoad = () => {
      if (window.CollectJS) resolve(window.CollectJS);
      else reject(new Error('Collect.js loaded but did not initialise.'));
    };
    const onError = () => {
      pending = null;
      script.remove();
      reject(new Error('Collect.js failed to load. Check the network and NEXT_PUBLIC_NMI_COLLECT_JS_URL.'));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = COLLECT_JS_URL;
      script.async = true;
      script.dataset.tokenizationKey = TOKENIZATION_KEY;
      script.dataset.variant = 'inline';
      document.head.appendChild(script);
    }
  });

  return pending;
}
