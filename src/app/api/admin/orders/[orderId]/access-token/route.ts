import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET, POST as handleAdminPOST, DELETE as handleAdminDELETE } from '@/admin/api/orders/[orderId]/access-token/route';

export * from '@/admin/api/orders/[orderId]/access-token/route';

export const GET = withAdminRoute(handleAdminGET);
export const POST = withAdminRoute(handleAdminPOST);
export const DELETE = withAdminRoute(handleAdminDELETE);
