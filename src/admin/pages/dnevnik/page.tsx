import AdminAuditLogPageClient from '@/admin/components/AdminAuditLogPageClient';

export const metadata = {
  title: 'Dnevnik sprememb'
};

export const dynamic = 'force-dynamic';

export default function AdminAuditLogPage() {
  return <AdminAuditLogPageClient />;
}
