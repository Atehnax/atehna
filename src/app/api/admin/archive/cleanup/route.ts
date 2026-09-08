import { withAdminRoute } from '@/shared/auth/adminRoute';
import { POST as handleAdminPOST, GET as handleAdminGET } from '@/admin/api/archive/cleanup/route';

export * from '@/admin/api/archive/cleanup/route';

export const POST = withAdminRoute(handleAdminPOST);
export const GET = withAdminRoute(handleAdminGET, { allowCron: true });
