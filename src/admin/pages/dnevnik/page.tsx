import AdminAuditLogPageClient from '@/admin/features/dnevnik/components/AdminAuditLogPageClient';

export const metadata = {
  title: 'Dnevnik sprememb'
};

export const dynamic = 'force-dynamic';

export default function AdminAuditLogPage() {
  return <AdminAuditLogPageClient />;
}
