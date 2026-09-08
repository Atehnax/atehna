import { withAdminRoute } from '@/shared/auth/adminRoute';
import { GET as handleAdminGET } from '@/admin/api/orders/[orderId]/customer/route';

export * from '@/admin/api/orders/[orderId]/customer/route';

export const GET = withAdminRoute(handleAdminGET);
