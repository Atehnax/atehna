import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, POST as handleAdminPOST } from '@/admin/api/logo-library/route';

export * from '@/admin/api/logo-library/route';

export const GET = withAdminRoute(handleAdminGET);
export const POST = withAdminRoute(handleAdminPOST);
