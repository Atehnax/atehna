import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, DELETE as handleAdminDELETE } from '@/admin/api/audit-events/route';

export * from '@/admin/api/audit-events/route';

export const GET = withAdminRoute(handleAdminGET);
export const DELETE = withAdminRoute(handleAdminDELETE);
