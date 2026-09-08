import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, PUT as handleAdminPUT, PATCH as handleAdminPATCH } from '@/admin/api/site-navigation/route';

export * from '@/admin/api/site-navigation/route';

export const GET = withAdminRoute(handleAdminGET);
export const PUT = withAdminRoute(handleAdminPUT);
export const PATCH = withAdminRoute(handleAdminPATCH);
