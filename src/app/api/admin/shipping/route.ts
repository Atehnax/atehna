import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, PUT as handleAdminPUT } from '@/admin/api/shipping/route';

export * from '@/admin/api/shipping/route';

export const GET = withAdminRoute(handleAdminGET);
export const PUT = withAdminRoute(handleAdminPUT);
