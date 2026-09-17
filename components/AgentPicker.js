'use client';

import { useAgent } from '@/context/AgentContext';
import { cn } from '@/lib/utils';

/**
 * "Who is taking this order?" — a row of pills that behaves as a radio
 * group. Lives in the header so it is visible on every page, and the choice
 * sticks until someone picks a different name.
 */
export default function AgentPicker({ className = '', stacked = false }) {
  const { agent, agents, setAgent } = useAgent();

  return (
    <div
      role="radiogroup"
      aria-label="Agent"
      className={cn('flex items-center gap-2', stacked && 'flex-wrap', className)}
    >
      <span className={cn('text-[0.65rem] uppercase tracking-[0.2em]', agent ? 'text-faint' : 'text-gold')}>Agent</span>
      {agents.map((name) => {
        const selected = name === agent;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setAgent(name)}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              selected
                ? 'border-gold/60 bg-gold/15 text-gold'
                : 'border-line text-cream/75 hover:border-gold/40 hover:text-cream',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-2 w-2 rounded-full border transition-colors',
                selected ? 'border-gold bg-gold' : 'border-faint',
              )}
            />
            {name}
          </button>
        );
      })}
    </div>
  );
}
