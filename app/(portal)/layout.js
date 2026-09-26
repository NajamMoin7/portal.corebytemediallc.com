import { BRAND, SITE_URL } from '@/data/site';
import { requireUser } from '@/lib/auth';
import PortalHeader from '@/components/PortalHeader';
import PortalSidebar from '@/components/PortalSidebar';

/**
 * Everything under this group requires a session. The check runs on the
 * server for every full page load and reads the user from the database, so an
 * account that has been deactivated or archived loses access at once. The API
 * routes verify independently, so a stale client cannot charge anything.
 *
 * Super admins get the sidebar shell — they have administration tabs to move
 * between. Agents get the simpler top header over the same pages.
 */
export default async function PortalLayout({ children }) {
  const user = await requireUser();

  const footer = (
    <footer className="mt-auto border-t border-line bg-obsidian">
      <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-faint sm:flex-row">
        <span>&copy; 2026 {BRAND.legalName}. Internal use only.</span>
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
          corebytemediallc.com
        </a>
      </div>
    </footer>
  );

  if (user.role === 'superadmin') {
    return (
      <PortalSidebar user={user}>
        {children}
        {footer}
      </PortalSidebar>
    );
  }

  return (
    <>
      <PortalHeader user={user} />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      {footer}
    </>
  );
}
