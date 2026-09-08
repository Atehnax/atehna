import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, POST as handleAdminPOST } from '@/admin/api/audit-events/prune/route';

export * from '@/admin/api/audit-events/prune/route';

export const GET = withAdminRoute(handleAdminGET, { allowCron: true });
export const POST = withAdminRoute(handleAdminPOST);
