import { redirect } from 'next/navigation';
import { BRAND, CONTACT } from '@/data/site';
import { getSession, isAuthConfigured } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';
import Logo from '@/components/Logo';

export const metadata = {
  title: 'Sign in',
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/dashboard');

  return (
    <main id="main" className="relative flex flex-1 items-center justify-center px-5 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(55%_70%_at_50%_0%,rgba(201,162,39,0.12),transparent_70%)]"
      />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="mb-8 flex flex-col items-center gap-5 text-center">
          <Logo height={96} href={null} priority />
          <div className="space-y-2">
            <span className="eyebrow">{BRAND.portalName}</span>
            <h1 className="text-3xl text-cream">Sign in to continue</h1>
            <p className="text-sm text-muted">Staff access only. Sessions expire automatically.</p>
          </div>
        </div>

        <div className="surface-card p-7 sm:p-8">
          <LoginForm configured={isAuthConfigured()} />
        </div>

        <p className="mt-8 text-center text-xs text-faint">
          Trouble signing in? Contact{' '}
          <a href={`mailto:${CONTACT.email}`} className="text-muted hover:text-gold">
            {CONTACT.email}
          </a>
        </p>
      </div>
    </main>
  );
}
