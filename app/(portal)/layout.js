import { redirect } from 'next/navigation';
import { BRAND, SITE_URL } from '@/data/site';
import { getSession } from '@/lib/auth';
import { AgentProvider } from '@/context/AgentContext';
import PortalHeader from '@/components/PortalHeader';

/**
 * Everything under this group requires a session. The check runs on the
 * server for every full page load; the API routes verify the cookie again
 * independently, so a stale client cannot charge anything.
 */
export default async function PortalLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <AgentProvider>
      <PortalHeader email={session.email} />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <footer className="mt-auto border-t border-line bg-obsidian">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-faint sm:flex-row">
          <span>&copy; 2026 {BRAND.legalName}. Internal use only.</span>
          <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
            corebytemediallc.com
          </a>
        </div>
      </footer>
    </AgentProvider>
  );
}
