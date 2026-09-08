import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, DELETE as handleAdminDELETE, PATCH as handleAdminPATCH } from '@/admin/api/archive/route';

export * from '@/admin/api/archive/route';

export const GET = withAdminRoute(handleAdminGET);
export const DELETE = withAdminRoute(handleAdminDELETE);
export const PATCH = withAdminRoute(handleAdminPATCH);
