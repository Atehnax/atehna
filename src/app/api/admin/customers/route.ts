import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, PATCH as handleAdminPATCH } from '@/admin/api/customers/route';

export * from '@/admin/api/customers/route';

export const GET = withAdminRoute(handleAdminGET);
export const PATCH = withAdminRoute(handleAdminPATCH);
