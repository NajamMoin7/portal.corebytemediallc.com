import { cn } from '@/lib/utils';

/** Standard page title block, as on the storefront's interior pages. */
export default function PageHeader({ eyebrow, title, description, className = '', children }) {
  return (
    <header className={cn('flex flex-col items-start gap-4', className)}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 className="text-balance text-3xl leading-tight text-cream sm:text-4xl lg:text-[2.75rem]">{title}</h1>
      {description && <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted sm:text-base">{description}</p>}
      {children}
      <span className="mt-2 h-px w-16 bg-gradient-to-r from-gold to-transparent" aria-hidden="true" />
    </header>
  );
}
