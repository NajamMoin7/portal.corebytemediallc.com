import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

/** The root has no content of its own: signed in goes to the dashboard, otherwise to login. */
export default async function RootPage() {
  const session = await getSession();
  redirect(session ? '/dashboard' : '/login');
}
