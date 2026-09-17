import { AlertIcon, CheckCircleIcon, InfoIcon } from './Icons';
import { cn } from '@/lib/utils';

const TONES = {
  info: { Icon: InfoIcon, classes: 'border-sky-400/30 bg-sky-400/[0.06] text-sky-100', icon: 'text-sky-300' },
  warning: { Icon: AlertIcon, classes: 'border-gold/40 bg-gold/[0.07] text-champagne', icon: 'text-gold' },
  error: { Icon: AlertIcon, classes: 'border-red-500/40 bg-red-500/[0.07] text-red-100', icon: 'text-red-400' },
  success: { Icon: CheckCircleIcon, classes: 'border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-100', icon: 'text-emerald-400' },
};

/** Inline status banner. */
export default function Notice({ tone = 'info', title, children, className = '' }) {
  const { Icon, classes, icon } = TONES[tone] || TONES.info;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border p-4 text-sm', classes, className)}>
      <Icon size={18} className={cn('mt-0.5 shrink-0', icon)} />
      <div className="min-w-0 space-y-1 leading-relaxed">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-[0.8125rem] opacity-90">{children}</div>}
      </div>
    </div>
  );
}
