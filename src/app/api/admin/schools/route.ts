import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, PATCH as handleAdminPATCH } from '@/admin/api/schools/route';

export * from '@/admin/api/schools/route';

export const GET = withAdminRoute(handleAdminGET);
export const PATCH = withAdminRoute(handleAdminPATCH);
