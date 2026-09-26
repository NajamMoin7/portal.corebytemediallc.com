import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

/** The root has no content of its own: signed in goes to the dashboard, otherwise to login. */
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? '/dashboard' : '/login');
}
