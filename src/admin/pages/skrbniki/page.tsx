import { redirect } from 'next/navigation';
import AdminAccountSettingsClient from '@/admin/features/skrbniki/components/AdminAccountSettingsClient';
import { getAdminPageSession, getAdminSessionPolicy } from '@/shared/auth/adminSession';

export const metadata = { title: 'Skrbniki' };
export const dynamic = 'force-dynamic';

export default async function AdminAccountSettingsPage() {
  const session = await getAdminPageSession();
  if (!session) redirect('/admin');
  const policy = await getAdminSessionPolicy();
  return <AdminAccountSettingsClient username={session.username} initialPolicy={policy} />;
}
