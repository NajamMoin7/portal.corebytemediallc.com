import Link from 'next/link';
import { cn } from '@/lib/utils';

const VARIANTS = {
  primary:
    'bg-gradient-to-br from-champagne via-gold to-gold-dark text-ink font-semibold shadow-[0_8px_24px_-10px_rgba(201,162,39,0.75)] hover:shadow-[0_12px_32px_-8px_rgba(201,162,39,0.85)] hover:brightness-110',
  outline:
    'border border-gold/45 text-gold hover:border-gold hover:bg-gold/10 hover:text-champagne',
  ghost: 'text-cream/80 hover:text-gold hover:bg-white/5',
  dark: 'bg-charcoal text-cream border border-line hover:border-gold/40 hover:text-gold',
  danger: 'border border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-500/70',
};

const SIZES = {
  sm: 'h-9 px-4 text-xs tracking-[0.14em]',
  md: 'h-11 px-6 text-[0.78rem] tracking-[0.16em]',
  lg: 'h-13 px-8 text-[0.82rem] tracking-[0.18em] md:h-14 md:px-10',
};

const BASE =
  'group relative inline-flex items-center justify-center gap-2 rounded-full uppercase font-medium transition-all duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100 disabled:hover:shadow-none select-none';

/**
 * Renders an `<a>` (via next/link) when `href` is given, otherwise a `<button>`.
 */
export default function Button({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  fullWidth = false,
  ...props
}) {
  const classes = cn(
    BASE,
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    fullWidth && 'w-full',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
