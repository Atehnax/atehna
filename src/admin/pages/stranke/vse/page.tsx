import AdminCustomersTable from '@/admin/features/stranke/components/AdminCustomersTable';
import { getCustomerDirectory } from '@/shared/server/customerDirectory';

export const dynamic = 'force-dynamic';

export default async function AdminAllCustomersPage() {
  const directory = await getCustomerDirectory();
  return <AdminCustomersTable initialDirectory={directory} />;
}
