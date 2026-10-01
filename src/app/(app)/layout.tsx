import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AppShell from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The middleware already gates these routes; this second check is what makes
  // the session available for rendering and covers any matcher drift.
  const session = await auth();
  if (!session?.user) redirect('/login?expired=1');

  return <AppShell userName={session.user.name ?? session.user.email ?? ''}>{children}</AppShell>;
}
