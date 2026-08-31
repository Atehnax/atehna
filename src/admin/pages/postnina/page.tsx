import AdminShippingPageClient from '@/admin/features/shipping/components/AdminShippingPageClient';
import { getShippingAdminState } from '@/shared/server/shipping';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Poštnina'
};

export default async function AdminShippingPage() {
  return <AdminShippingPageClient initialState={await getShippingAdminState()} />;
}
