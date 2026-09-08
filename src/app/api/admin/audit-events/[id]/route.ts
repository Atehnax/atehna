import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/audit-events/[id]/route';

export * from '@/admin/api/audit-events/[id]/route';

export const GET = withAdminRoute(handleAdminGET);
