import AdminOrderEmailSettingsPageClient from '@/admin/features/email/components/AdminOrderEmailSettingsPageClient';
import { getOrderEmailAdminState } from '@/shared/server/orderEmailSettings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Email'
};

export default async function AdminOrderEmailSettingsPage() {
  return (
    <AdminOrderEmailSettingsPageClient
      initialState={await getOrderEmailAdminState()}
    />
  );
}
