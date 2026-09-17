'use client';

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { AGENTS, isValidAgent } from '@/data/agents';

/**
 * Which agent is taking orders in this browser.
 *
 * The portal has one shared login, so the agent is chosen in the header and
 * remembered in localStorage — the same person normally uses the same
 * machine all shift. It is sent with every charge and the server validates
 * it against `data/agents.js` again, so the client value is never trusted.
 */

const STORAGE_KEY = 'cbm-portal-agent';

const listeners = new Set();

function readAgent() {
  if (typeof window === 'undefined') return '';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) || '';
    return isValidAgent(stored) ? stored : '';
  } catch {
    return '';
  }
}

function writeAgent(name) {
  try {
    if (name) window.localStorage.setItem(STORAGE_KEY, name);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked — the change still reaches subscribers for this tab.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const AgentContext = createContext({ agent: '', agents: AGENTS, setAgent: () => {} });

export function AgentProvider({ children }) {
  // Empty during server render and hydration so markup matches; the stored
  // name appears right after.
  const agent = useSyncExternalStore(subscribe, readAgent, () => '');
  const setAgent = useCallback((name) => writeAgent(isValidAgent(name) ? name : ''), []);

  return <AgentContext.Provider value={{ agent, agents: AGENTS, setAgent }}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  return useContext(AgentContext);
}
