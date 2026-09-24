import { redirect } from 'next/navigation';
import AdminInstitutionsDirectory from '@/admin/features/stranke/components/AdminInstitutionsDirectory';
import { resolveInstitutionDirectoryViewId } from '@/shared/domain/institutionDirectory';
import { getInstitutionDirectoryView } from '@/shared/server/institutionDirectoryViews';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Šole in zavodi' };

export default async function AdminInstitutionsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { tab } = await searchParams;
  const resolvedId = resolveInstitutionDirectoryViewId(tab);
  if (resolvedId && resolvedId !== tab) redirect('/admin/stranke/sole-in-zavodi?tab=' + resolvedId);
  const directoryId = resolvedId ?? 'vsi-seznami';
  const directory = await getInstitutionDirectoryView(directoryId);
  return <AdminInstitutionsDirectory directoryId={directoryId} initialDirectory={directory} />;
}
