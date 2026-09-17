import { cn } from '@/lib/utils';

const TONES = {
  gold: 'bg-gold text-ink',
  outline: 'border border-gold/45 text-gold bg-ink/70 backdrop-blur-sm',
  dark: 'bg-ink/80 text-cream border border-line backdrop-blur-sm',
  sale: 'bg-red-500/90 text-white',
  muted: 'bg-charcoal text-muted border border-line',
};

export default function Badge({ tone = 'gold', className = '', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em]',
        TONES[tone] || TONES.gold,
        className,
      )}
    >
      {children}
    </span>
  );
}
