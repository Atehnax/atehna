import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, PUT as handleAdminPUT } from '@/admin/api/landing-page/defaults/route';

export * from '@/admin/api/landing-page/defaults/route';

export const GET = withAdminRoute(handleAdminGET);
export const PUT = withAdminRoute(handleAdminPUT);
