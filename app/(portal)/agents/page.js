import AgentsManager from '@/components/AgentsManager';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/ui/Notice';
import { requireSuperAdmin } from '@/lib/auth';
import { listUsers } from '@/lib/users';

export const metadata = {
  title: 'Agents',
};

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  // Redirects agents back to the dashboard; only a super admin gets this far.
  const admin = await requireSuperAdmin();

  let users = [];
  let error = null;
  try {
    users = await listUsers();
  } catch (loadError) {
    console.error('[agents] could not load the staff list', loadError);
    error = 'Could not reach the database. Check MONGODB_URI and the Atlas network access list.';
  }

  return (
    <div className="container-page py-10 lg:py-14">
      <PageHeader
        eyebrow="Super admin"
        title="Agents"
        description="Create the accounts your agents sign in with, reset their passwords, and switch access on or off."
        className="mb-10"
      />

      {error ? (
        <Notice tone="error" title="Agents are unavailable">
          {error}
        </Notice>
      ) : (
        <AgentsManager users={users} currentUserId={admin.id} />
      )}
    </div>
  );
}
