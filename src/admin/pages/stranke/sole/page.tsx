import AdminSchoolsTable from '@/admin/features/stranke/components/AdminSchoolsTable';
import { getSchoolDirectory } from '@/shared/server/schoolDirectory';

export const dynamic = 'force-dynamic';

export default async function AdminSchoolsPage() {
  const directory = await getSchoolDirectory();
  return <AdminSchoolsTable initialDirectory={directory} />;
}

