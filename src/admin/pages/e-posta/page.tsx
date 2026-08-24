import AdminOrderEmailSettingsPageClient from '@/admin/features/e-posta/components/AdminOrderEmailSettingsPageClient';
import { getOrderEmailAdminState } from '@/shared/server/orderEmailSettings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Samodejna e-pošta'
};

export default async function AdminOrderEmailSettingsPage() {
  return (
    <AdminOrderEmailSettingsPageClient
      initialState={await getOrderEmailAdminState()}
    />
  );
}
