import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, PATCH as handleAdminPATCH } from '@/admin/api/audit-events/settings/route';

export * from '@/admin/api/audit-events/settings/route';

export const GET = withAdminRoute(handleAdminGET);
export const PATCH = withAdminRoute(handleAdminPATCH);
