import { cn } from '@/lib/utils';

/** Graphite card surface used for every block of portal content. */
export default function Panel({ className = '', children, ...props }) {
  return (
    <section className={cn('surface-card p-6 sm:p-8', className)} {...props}>
      {children}
    </section>
  );
}
