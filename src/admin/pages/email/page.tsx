import AdminOrderEmailSettingsPageClient from '@/admin/features/email/components/AdminOrderEmailSettingsPageClient';
import { getOrderEmailAdminState } from '@/shared/server/orderEmailSettings';
import { getQuoteEmailAdminState } from '@/shared/server/quoteEmailSettings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Email'
};

export default async function AdminOrderEmailSettingsPage() {
  const [initialState, initialQuoteState] = await Promise.all([
    getOrderEmailAdminState(),
    getQuoteEmailAdminState()
  ]);
  return (
    <AdminOrderEmailSettingsPageClient
      initialState={initialState}
      initialQuoteState={initialQuoteState}
    />
  );
}
