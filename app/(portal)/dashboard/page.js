import Link from 'next/link';
import OrderHistory from '@/components/OrderHistory';
import PageHeader from '@/components/PageHeader';
import Panel from '@/components/ui/Panel';
import { ArrowRightIcon, CheckCircleIcon, AlertIcon, ListIcon, PlusIcon } from '@/components/ui/Icons';
import { isGatewayConfigured, isTokenizationConfigured } from '@/lib/nmi';
import { getSession } from '@/lib/auth';
import { cn } from '@/lib/utils';

export const metadata = {
  title: 'Dashboard',
};

const ACTIONS = [
  {
    href: '/orders/new',
    Icon: PlusIcon,
    title: 'New order',
    description: 'Enter a customer, their products and card, and charge it through NMI.',
    primary: true,
  },
  {
    href: '/orders',
    Icon: ListIcon,
    title: 'Order history',
    description: 'Orders charged from this browser, with transaction IDs for NMI lookups.',
  },
];

export default async function DashboardPage() {
  const session = await getSession();
  const checks = [
    { label: 'NMI public key (Collect.js)', ok: isTokenizationConfigured(), env: 'NEXT_PUBLIC_NMI_TOKENIZATION_KEY' },
    { label: 'NMI private key (charges)', ok: isGatewayConfigured(), env: 'NMI_SECURITY_KEY' },
    {
      label: 'Transaction mode',
      ok: true,
      value: process.env.NMI_TRANSACTION_TYPE === 'auth' ? 'Authorise only' : 'Sale (charge immediately)',
    },
  ];
  const allGood = checks.every((check) => check.ok);

  return (
    <div className="container-page py-10 lg:py-14">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back${session?.email ? `, ${session.email.split('@')[0]}` : ''}`}
        description="Take print orders over the phone or in person, charge the card, and keep a record of what was ordered."
        className="mb-10"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
          {ACTIONS.map(({ href, Icon, title, description, primary }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'group surface-card relative flex flex-col gap-5 p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/45',
                primary && 'border-gold/35 bg-gradient-to-br from-graphite via-graphite to-gold/[0.06]',
              )}
            >
              <span
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-lg border transition-colors',
                  primary ? 'border-gold/50 bg-gold/10 text-gold' : 'border-line text-muted group-hover:text-gold',
                )}
              >
                <Icon size={22} />
              </span>
              <span className="space-y-1.5">
                <span className="block font-display text-xl text-cream">{title}</span>
                <span className="block text-sm leading-relaxed text-muted">{description}</span>
              </span>
              <span className="mt-auto inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.16em] text-gold">
                Open
                <ArrowRightIcon size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>

        <Panel className="space-y-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="eyebrow">Gateway status</h2>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em]',
                allGood ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
              )}
            >
              {allGood ? 'Ready' : 'Action needed'}
            </span>
          </div>
          <ul className="space-y-3 text-sm">
            {checks.map((check) => (
              <li key={check.label} className="flex items-start gap-3">
                {check.ok ? (
                  <CheckCircleIcon size={18} className="mt-0.5 shrink-0 text-emerald-400" />
                ) : (
                  <AlertIcon size={18} className="mt-0.5 shrink-0 text-red-400" />
                )}
                <span className="min-w-0">
                  <span className="block text-cream">{check.label}</span>
                  <span className="block text-xs text-muted">
                    {check.value || (check.ok ? 'Configured' : `Missing ${check.env}`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {!allGood && (
            <p className="text-xs leading-relaxed text-faint">
              Add the missing variables in Netlify under Site configuration → Environment variables, then trigger a
              redeploy.
            </p>
          )}
        </Panel>
      </div>

      <section className="mt-12 space-y-5">
        <div className="flex items-end justify-between gap-4">
          <h2 className="eyebrow">Recent orders</h2>
          <Link href="/orders" className="text-xs uppercase tracking-[0.14em] text-muted hover:text-gold">
            View all
          </Link>
        </div>
        <OrderHistory limit={5} compact />
      </section>
    </div>
  );
}
